import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { TemplateGeometryOptions, TemplateRuntime } from '@/lib/packaging/template-runtime';
import type { Mesh, TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { apply, creaseHalfWidth, foldSheet, restingSetback, surfaceMeshes, translation, type Mat4, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { panelName, substage } from '@/lib/packaging/templates/folded-box';
import { evaluate, interpolate } from './expression';
import type { DimensionKey, ExpandedTemplate, ParametricTemplate, SurfaceVertex } from './format';
import { compileParametricSheet, definitionError, DIMENSIONS, type OptionValues, type ParametricSheet } from './sheet';

export { TemplateDefinitionError } from './sheet';

/** Folds a parametric template's cutting template into its 3D model. */
export function parametricMeshBuilder(compiled: ParametricSheet): TemplateMeshBuilder {
  const { definition } = compiled;
  const fallbacks = new Map(definition.panels.filter(panel => panel.artworkFallback)
    .map(panel => [panel.name ?? panelName(panel.label), panel.artworkFallback!]));

  return input => {
    const options = { splitTopHingeSide: input.splitTopHingeSide, openingMode: input.openingMode };
    const geometry = compiled.sheet(input.dimensions, options);
    const scope: Record<string, number> = compiled.values(input.dimensions, options);
    for (const panel of geometry.panels) {
      Object.assign(scope, {
        [`${panel.id}.x`]: panel.x, [`${panel.id}.y`]: panel.y,
        [`${panel.id}.width`]: panel.width, [`${panel.id}.height`]: panel.height,
      });
    }
    scope.foldT = evaluate(definition.fold.thickness, scope);
    // The fold engine's crease, for setbacks: half a crease (the furthest a
    // flap can fold out) and the setback that rests a lid on the walls' edges.
    scope.foldCrease = creaseHalfWidth(scope.foldT);
    scope.foldResting = restingSetback(scope.foldT);
    const progress = {
      formation: Math.min(1, Math.max(0, input.formation / 100)),
      opening: Math.min(1, Math.max(0, input.opening / 100)),
    };
    Object.assign(scope, progress);
    for (const [name, value] of definition.fold.motions ?? []) scope[name] = evaluate(value, scope);
    const specOf = (id: string) => definition.panels.find(candidate => candidate.id === id && (candidate.when === undefined || evaluate(candidate.when, scope) !== 0))!;
    const replaced = new Set([...(definition.fold.modelPanels ?? []), ...(definition.fold.surfaces ?? [])].map(piece => piece.of));
    const panels: SheetPanel[] = geometry.panels.filter(panel => !replaced.has(panel.id)).map(panel => {
      const spec = specOf(panel.id);
      return {
        id: panel.id,
        name: spec.name ?? panelName(panel.label),
        // The 3D folds each panel's four-corner shape; the print file cuts the full outline.
        outline: spec.model
          ? spec.model.map(([x, y]) => ({ x: evaluate(x, scope), y: evaluate(y, scope) }))
          : panel.fold ?? panel.outline,
        ...(spec.layer === undefined ? {} : { layer: evaluate(spec.layer, scope) }),
        ...(spec.artworkRotation ? { artworkRotation: spec.artworkRotation } : {}),
        ...(spec.closureFlap ? { closureFlap: true } : {}),
      };
    });
    // Strips of a bending panel: each prints its part of the whole panel's artwork.
    for (const piece of definition.fold.modelPanels ?? []) {
      const whole = geometry.panels.find(panel => panel.id === piece.of);
      if (!whole) continue;
      const spec = specOf(whole.id);
      panels.push({
        id: piece.id,
        name: spec.name ?? panelName(whole.label),
        outline: piece.outline.map(([x, y]) => ({ x: evaluate(x, scope), y: evaluate(y, scope) })),
        artworkFrame: whole.outline,
        piece: whole.id,
        ...(spec.layer === undefined ? {} : { layer: evaluate(spec.layer, scope) }),
        ...(spec.artworkRotation ? { artworkRotation: spec.artworkRotation } : {}),
        ...(spec.closureFlap ? { closureFlap: true } : {}),
      });
    }
    const present = new Set(panels.map(panel => panel.id));
    const active = definition.fold.hinges.filter(hinge => present.has(hinge.child) && (hinge.when === undefined || evaluate(hinge.when, scope) !== 0));
    checkHingeTree(definition, present, active);
    const hinges: SheetHinge[] = active.map(hinge => ({
      child: hinge.child,
      parent: hinge.parent,
      angle: 'angle' in hinge
        ? evaluate(hinge.angle, scope)
        : substage(hinge.drive === 'formation' ? progress.formation : 1 - progress.opening, evaluate(hinge.from, scope), evaluate(hinge.to, scope))
          * (evaluate(hinge.degrees ?? 90, scope) / 90) * (Math.PI / 2),
      ...(hinge.setback === undefined ? {} : { setback: evaluate(hinge.setback, scope) }),
      ...(hinge.sharp ? { sharp: true } : {}),
    }));
    const placement = definition.fold.matrix
      ? definition.fold.matrix.map(value => evaluate(value, scope))
      : translation((definition.fold.offset ?? [0, 0, 0]).map(value => evaluate(value, scope)) as [number, number, number]);
    // Each piece folds on its own: its root and every panel hinged under it.
    const pieces = [
      { root: definition.fold.root, placement },
      ...(definition.fold.pieces ?? []).map(piece => ({ root: piece.root, placement: piece.matrix.map(value => evaluate(value, scope)) })),
    ];
    const parentOf = new Map(hinges.map(hinge => [hinge.child, hinge.parent]));
    const rootOf = (id: string): string => (parentOf.has(id) ? rootOf(parentOf.get(id)!) : id);
    const frames = new Map<string, Mat4>();
    const meshes = pieces.flatMap(piece => foldSheet({
      panels: panels.filter(panel => rootOf(panel.id) === piece.root),
      hinges: hinges.filter(hinge => rootOf(hinge.child) === piece.root),
      root: piece.root, thickness: scope.foldT,
      color: input.color, interiorColor: input.interiorColor,
      placement: piece.placement, frames,
    }));
    // Curved surfaces, through points carried by the folded panels.
    const place = (vertex: SurfaceVertex): [number, number, number] => {
      if ('on' in vertex) {
        const frame = frames.get(vertex.on);
        if (!frame) throw new Error(`a surface is placed on "${vertex.on}", which isn't folded`);
        return apply(frame, [evaluate(vertex.at[0], scope), -evaluate(vertex.at[1], scope), 0]);
      }
      if ('from' in vertex) {
        const point = place(vertex.from);
        const { x, y, z } = vertex.set;
        return [x === undefined ? point[0] : evaluate(x, scope), y === undefined ? point[1] : evaluate(y, scope), z === undefined ? point[2] : evaluate(z, scope)];
      }
      const [a, b] = vertex.mix.map(place), t = evaluate(vertex.t, scope);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    for (const surface of definition.fold.surfaces ?? []) {
      const whole = geometry.panels.find(panel => panel.id === surface.of);
      if (!whole) continue;
      const spec = specOf(whole.id);
      meshes.push(...surfaceMeshes({
        rows: surface.rows.map(row => row.map(point => place(point.place))),
        flat: surface.rows.map(row => row.map(point => ({ x: evaluate(point.flat[0], scope), y: evaluate(point.flat[1], scope) }))),
        panel: { id: whole.id, name: spec.name ?? panelName(whole.label), outline: whole.outline, ...(spec.artworkRotation ? { artworkRotation: spec.artworkRotation } : {}) },
        thickness: scope.foldT, color: input.color, interiorColor: input.interiorColor,
      }));
    }
    return meshes.map((mesh: Mesh) => {
      const own = mesh.panel?.replace(/^Interior /, '');
      const fallback = own ? fallbacks.get(own) : undefined;
      if (!fallback) return mesh;
      mesh.fallbackPanel = mesh.panel!.startsWith('Interior ') ? `Interior ${fallback.name}` : fallback.name;
      mesh.fallbackUv = fallback.uv;
      return mesh;
    });
  };
}

/**
 * Turns a parametric definition into the runtime the studio uses for every
 * template. The definition is checked up front, structurally and by building
 * every variant once at its fallback size, so mistakes surface when the
 * template is registered rather than when someone opens it.
 */
export function compileParametricTemplate(source: ParametricTemplate): TemplateRuntime {
  const compiled = compileParametricSheet(source);
  const { definition } = compiled;
  const buildMeshes = parametricMeshBuilder(compiled);
  const fromOptions = (options?: TemplateGeometryOptions): OptionValues => ({
    splitTopHingeSide: options?.splitTopHingeSide,
    openingMode: options?.openingMode,
  });
  const { openingStage } = definition.assembly;
  const runtime: TemplateRuntime = {
    templateId: definition.templateId,
    structureKey: definition.structureKey,
    rendererKey: definition.rendererKey,
    sanitizeParameters: compiled.sanitize,
    getAdjustableSizes: (dimensions, options) => compiled.adjustableSizes(dimensions, fromOptions(options)),
    getAdjustedPanels: (dimensions, key, options) => compiled.adjustedPanels(dimensions, fromOptions(options), key),
    getPanelSizes: (dimensions, options) => compiled.panelSizes(dimensions, fromOptions(options)),
    getDielinePanels: (dimensions, options) => compiled.sheet(dimensions, fromOptions(options)).panels,
    getDielineBounds: (dimensions, options) => compiled.sheet(dimensions, fromOptions(options)).bounds,
    getExportGeometry: (dimensions, options) => compiled.exportGeometry(dimensions, fromOptions(options)),
    buildMeshes,
    exportSummary: definition.export.summary,
    exportArtworkNote: definition.export.artworkNote,
    assembly: {
      control: definition.assembly.control,
      defaultOpeningMode: definition.assembly.defaultOpeningMode as LegacyOpeningMode,
      legacyOpeningAsFormation: definition.assembly.legacyOpeningAsFormation,
      hasOpeningStage: mode => openingStage === 'always'
        || (Array.isArray(openingStage) ? openingStage.includes(mode) : typeof openingStage === 'object' && !openingStage.except.includes(mode)),
    },
  };

  // Build every variant once so a bad expression fails now, with the template named.
  const fallback = Object.fromEntries(DIMENSIONS.map(key => [key, definition.parameters[key].fallback])) as Record<DimensionKey, number>;
  for (const options of variants(definition)) {
    try {
      const scope = compiled.values(fallback, options);
      // Every adjustable size, at its limits too.
      const sizes = compiled.adjustableSizes(fallback, options);
      for (const extreme of [-1e9, 1e9]) {
        compiled.sheet({ ...fallback, adjustments: Object.fromEntries(sizes.map(size => [size.key, extreme])) }, options);
      }
      for (const check of definition.validations ?? []) {
        evaluate(check.require, scope);
        interpolate(check.message, scope);
      }
      buildMeshes({
        dimensions: fallback, formation: 50, opening: 50,
        openingMode: (options.openingMode ?? definition.assembly.defaultOpeningMode) as LegacyOpeningMode,
        splitTopHingeSide: (options.splitTopHingeSide ?? 'side_a') as 'side_a' | 'side_b',
        color: [1, 1, 1], interiorColor: [1, 1, 1],
      });
    } catch (error) {
      definitionError(definition, `${error instanceof Error ? error.message : String(error)} (options ${JSON.stringify(options)})`);
    }
  }
  return runtime;
}

/** Every panel but the root hangs on exactly one present panel, and the hinges reach the root. */
function checkHingeTree(definition: ExpandedTemplate, present: Set<string>, hinges: ExpandedTemplate['fold']['hinges']) {
  const parents = new Map<string, string>();
  for (const hinge of hinges) {
    if (parents.has(hinge.child)) definitionError(definition, `panel "${hinge.child}" hinges on more than one panel here`);
    if (!present.has(hinge.parent)) definitionError(definition, `panel "${hinge.child}" hinges on "${hinge.parent}", which is left out here`);
    parents.set(hinge.child, hinge.parent);
  }
  const roots = new Set([definition.fold.root, ...(definition.fold.pieces ?? []).map(piece => piece.root)]);
  for (const id of present) {
    if (roots.has(id)) continue;
    if (!parents.has(id)) definitionError(definition, `panel "${id}" has no hinge here`);
    const seen = new Set<string>();
    for (let at = id; !roots.has(at); at = parents.get(at)!) {
      if (seen.has(at)) definitionError(definition, `hinges loop back on themselves at "${at}"`);
      seen.add(at);
    }
  }
}

function variants(definition: ExpandedTemplate): OptionValues[] {
  return (definition.options ?? []).reduce<OptionValues[]>(
    (all, option) => all.flatMap(partial => Object.keys(option.choices).map(choice => ({ ...partial, [option.source]: choice }))),
    [{}],
  );
}
