export type CartonDimensions = {
  width: number;
  height: number;
  depth: number;
  thickness: number;
};

export type CartonPanel = {
  id: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'glue';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'body' | 'flap' | 'glue';
};

export const DEFAULT_CARTON_DIMENSIONS: CartonDimensions = {
  width: 120,
  height: 180,
  depth: 55,
  thickness: 0.5,
};

export function sanitizeCartonDimensions(value: CartonDimensions): CartonDimensions {
  return {
    width: clamp(value.width, 30, 400),
    height: clamp(value.height, 40, 500),
    depth: clamp(value.depth, 15, 250),
    thickness: clamp(value.thickness, 0.3, 2),
  };
}

export function reverseTuckPanels(input: CartonDimensions): CartonPanel[] {
  const d = sanitizeCartonDimensions(input);
  const glue = Math.max(12, Math.min(24, d.depth * 0.35));
  const bodyY = d.depth;
  const body = [
    { id: 'glue' as const, label: 'GLUE', x: 0, width: glue, kind: 'glue' as const },
    { id: 'left' as const, label: 'LEFT', x: glue, width: d.depth, kind: 'body' as const },
    { id: 'front' as const, label: 'FRONT', x: glue + d.depth, width: d.width, kind: 'body' as const },
    { id: 'right' as const, label: 'RIGHT', x: glue + d.depth + d.width, width: d.depth, kind: 'body' as const },
    { id: 'back' as const, label: 'BACK', x: glue + d.depth + d.width + d.depth, width: d.width, kind: 'body' as const },
  ];

  const panels: CartonPanel[] = body.map(panel => ({
    ...panel,
    y: bodyY,
    height: d.height,
  }));

  panels.push(
    {
      id: 'top',
      label: 'TOP',
      x: glue + d.depth,
      y: 0,
      width: d.width,
      height: d.depth,
      kind: 'flap',
    },
    {
      id: 'bottom',
      label: 'BOTTOM',
      x: glue + d.depth,
      y: bodyY + d.height,
      width: d.width,
      height: d.depth,
      kind: 'flap',
    },
  );

  return panels;
}

export function reverseTuckBounds(input: CartonDimensions) {
  const panels = reverseTuckPanels(input);
  return {
    width: Math.max(...panels.map(p => p.x + p.width)),
    height: Math.max(...panels.map(p => p.y + p.height)),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
