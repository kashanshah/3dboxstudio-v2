import {
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh as ThreeMesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene as ThreeScene,
  ShadowMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  VSMShadowMap,
  WebGLRenderer,
  type IUniform,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ArtworkByPanel } from '@/lib/packaging/artwork';
import type { Mesh } from '@/lib/packaging/template-mesh';
import { requireTemplateRuntime } from '@/lib/packaging/template-runtime';
import {
  artworkUrlSignature,
  defaultScene,
  pickScenePanel,
  sceneMeshes,
  sceneViewMatrices,
  textureTransform,
  type Scene,
} from './carton-scene';
import { analyseSurfaces, solidify } from './carton-surfaces';

/**
 * How each stock reacts to light. Colours still come from the material or the
 * customer's chosen colour; these only describe the surface.
 */
type Finish = {
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  /** Strength of studio reflections; metals need more to read as metal. */
  reflections?: number;
  /** Paper surface relief (0–1). */
  grain: number;
  /** Visible fibres in the board colour (0–1). */
  fiber: number;
};

const FINISHES: Record<string, Finish> = {
  'White board': { roughness: 0.8, grain: 0.45, fiber: 0.12 },
  Kraft: { roughness: 0.9, grain: 1, fiber: 1 },
  'Soft touch': { roughness: 0.94, sheen: 0.35, grain: 0.2, fiber: 0.05 },
  'Matte coated': { roughness: 0.62, grain: 0.18, fiber: 0.04 },
  'Gloss coated': { roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.07, grain: 0.06, fiber: 0.03 },
  Foil: { roughness: 0.3, metalness: 1, reflections: 2.2, grain: 0.04, fiber: 0 },
};
const DEFAULT_FINISH = FINISHES['Soft touch'];
const INSIDE_FINISH: Finish = { roughness: 0.9, grain: 0.45, fiber: 0.12 };
const EDGE_FINISH: Finish = { roughness: 0.95, grain: 0, fiber: 0.3 };

type Surface = 'outside' | 'inside' | 'edge';

type CartonUniforms = {
  uArt: IUniform<Texture>;
  uUseArt: IUniform<boolean>;
  uUvScale: IUniform<Vector2>;
  uUvOffset: IUniform<Vector2>;
  uUvRotation: IUniform<number>;
  uTile: IUniform<boolean>;
  uClip: IUniform<boolean>;
  uUvCrop: IUniform<Vector4>;
  uFaceUv: IUniform<Vector4>;
  uFaceSize: IUniform<Vector2>;
  uEdgeOcclusion: IUniform<Vector4>;
  uEdgeRounded: IUniform<Vector4>;
  uEdgeNormals: IUniform<Vector3[]>;
  uOcclusionWidth: IUniform<number>;
  uRoundRadius: IUniform<number>;
  uFlutePitch: IUniform<number>;
  uGrain: IUniform<number>;
  uFiber: IUniform<number>;
  uFlat: IUniform<number>;
  uOverlayColor: IUniform<Color>;
  uOverlayAlpha: IUniform<number>;
  uOutlineAlpha: IUniform<number>;
};

type ArtworkEntry = { texture: Texture; url: string; loaded: boolean; width: number; height: number };

/** Scene fields that change what is drawn, as opposed to where it is seen from. */
const CONTENT_KEYS: (keyof Scene)[] = ['dimensions', 'templateId', 'opening', 'formation', 'openingMode', 'splitTopHingeSide', 'material', 'outsideColor', 'insideColor', 'artworkByPanel', 'hoverPanel', 'renderStyle'];

const OVERLAY_COLOR = new Color().setRGB(0, 0.46, 0.77, SRGBColorSpace);

export type CartonRenderer = ReturnType<typeof createCartonRenderer>;

export function createCartonRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const world = new ThreeScene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  world.environment = environment;

  // One soft key light above and to the right of the viewer. It follows the
  // camera, so whichever side is being inspected gets the same studio
  // modelling: a bright face, a shaded face and a lit top.
  const key = new DirectionalLight(0xfff6ec, 2.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 16;
  world.add(key, key.target);

  // Transparent floor that only shows the shadow, over the studio backdrop.
  const floor = new ThreeMesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.18, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.renderOrder = -2;
  // Soft contact shadow where the carton meets the floor.
  const contact = new ThreeMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: contactShadowTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.renderOrder = -1;
  world.add(floor, contact);

  const carton = new Group();
  world.add(carton);

  const camera = new PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;

  const placeholder = new DataTexture(new Uint8Array([242, 246, 249, 255]), 1, 1);
  placeholder.needsUpdate = true;

  const artwork = new Map<string, ArtworkEntry>();
  const objects: ThreeMesh<BufferGeometry, MeshPhysicalMaterial>[] = [];
  let scene: Scene = defaultScene();
  let meshes: Mesh[] = [];
  let pixelRatio = Math.min(3, window.devicePixelRatio || 1);
  // While a video is being recorded the canvas renders at the video size on
  // a backdrop, and live scene updates wait until recording ends.
  let capture: { width: number; height: number; liveScene: Scene } | null = null;
  let backdrop: CanvasTexture | null = null;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const size = renderer.getSize(new Vector2());
    if (size.x !== width || size.y !== height || ratio !== pixelRatio) {
      pixelRatio = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
    }
  };

  const updateCamera = () => {
    const { view, projection, eye } = capture
      ? sceneViewMatrices(scene, capture.width, capture.height)
      : sceneViewMatrices(scene, Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    camera.matrixWorldInverse.fromArray(view);
    camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
    camera.projectionMatrix.fromArray(projection);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return eye;
  };

  const syncMeshes = () => {
    const thickness = scene.dimensions.thickness;
    meshes = solidify(sceneMeshes(scene), thickness);
    const shading = analyseSurfaces(meshes, thickness);
    const flat = scene.renderStyle === 'flat';
    // Folds bend over roughly their own board thickness; keep at least a
    // millimetre so the soft highlight is visible at normal zoom.
    const roundRadius = Math.max(thickness * 1.5, 0.9);
    // Corrugated board (about 1 mm and up) shows its flutes on cut edges.
    const flutePitch = thickness >= 1 ? thickness * 2.15 : 0;
    const finish = FINISHES[scene.material] ?? DEFAULT_FINISH;
    meshes.forEach((mesh, index) => {
      let object = objects[index];
      if (!object) {
        object = new ThreeMesh(new BufferGeometry(), createCartonMaterial());
        object.matrixAutoUpdate = false;
        object.frustumCulled = false;
        object.castShadow = true;
        object.receiveShadow = true;
        objects[index] = object;
        carton.add(object);
      }
      object.visible = true;
      object.geometry.dispose();
      object.geometry = meshGeometry(mesh);
      if (mesh.model) object.matrix.fromArray(mesh.model);
      else object.matrix.identity();
      object.matrixWorldNeedsUpdate = true;

      const surface = surfaceOf(mesh);
      const material = object.material;
      const uniforms = material.userData.uniforms as CartonUniforms;
      applyFinish(material, surface === 'outside' ? finish : surface === 'inside' ? INSIDE_FINISH : EDGE_FINISH, uniforms, scene.material === 'Kraft' && surface !== 'outside' ? FINISHES.Kraft : null);
      material.color.setRGB(mesh.color[0], mesh.color[1], mesh.color[2], SRGBColorSpace);
      material.side = mesh.doubleSided ? DoubleSide : FrontSide;
      // Inside faces and board edges meet the printed faces along a shared
      // line; nudging them back in depth keeps that line from flickering.
      material.polygonOffset = surface !== 'outside';
      material.polygonOffsetFactor = 1;
      material.polygonOffsetUnits = 2;
      uniforms.uFlat.value = flat ? 1 : 0;
      const size = mesh.uvSize ?? faceSize(mesh);
      uniforms.uFaceSize.value.set(...size);
      const edges = shading[index];
      uniforms.uEdgeOcclusion.value.set(...(edges?.occlusion ?? [0, 0, 0, 0]));
      uniforms.uEdgeRounded.value.set(...(edges?.rounded ?? [0, 0, 0, 0]));
      edges?.neighbourNormals.forEach((normal, edge) => uniforms.uEdgeNormals.value[edge].set(normal[0], normal[1], normal[2]));
      uniforms.uOcclusionWidth.value = Math.min(40, Math.max(2, Math.min(size[0], size[1]) * 0.18));
      uniforms.uRoundRadius.value = roundRadius;
      uniforms.uFlutePitch.value = surface === 'edge' ? flutePitch : 0;

      // A face shows its own artwork (a bend, its panel's); failing that, a
      // stand-in mapped through a uv rectangle: an older design's artwork, or
      // a neighbour's artwork continued over a panel that has none.
      const own = [mesh.panel, mesh.sourcePanel].find(key => key && scene.artworkByPanel[key]);
      const standIn = own ? undefined
        : mesh.fallbackPanel && scene.artworkByPanel[mesh.fallbackPanel] ? { panel: mesh.fallbackPanel, uv: mesh.fallbackUv }
          : mesh.continues?.find(item => scene.artworkByPanel[item.panel]);
      const artworkKey = own ?? standIn?.panel;
      const entry = artworkKey ? artwork.get(artworkKey) : undefined;
      const placement = artworkKey ? scene.artworkByPanel[artworkKey] : undefined;
      const faceUv = standIn?.uv;
      uniforms.uFaceUv.value.set(...(faceUv ?? [0, 0, 1, 1]));
      const useArt = !!mesh.useTexture && !!entry?.loaded && !!placement;
      uniforms.uUseArt.value = useArt;
      uniforms.uArt.value = useArt && entry ? entry.texture : placeholder;
      if (useArt && entry && placement) {
        // Placement is worked out on the panel the artwork belongs to.
        const aspect = (mesh.faceAspect ?? 1) * (faceUv ? Math.abs(faceUv[3] / faceUv[2]) : 1);
        const transform = textureTransform(placement, entry.width / entry.height, aspect);
        uniforms.uUvScale.value.set(transform.scaleX, transform.scaleY);
        uniforms.uUvOffset.value.set(transform.offsetX, transform.offsetY);
        uniforms.uUvRotation.value = placement.rotation * Math.PI / 180;
        uniforms.uTile.value = placement.mode === 'tile';
        uniforms.uClip.value = placement.mode === 'fit';
        const crop = placement.crop;
        if (crop) uniforms.uUvCrop.value.set(crop.x, 1 - crop.y - crop.height, crop.width, crop.height);
        else uniforms.uUvCrop.value.set(0, 0, 1, 1);
      } else {
        uniforms.uUvScale.value.set(1, 1);
        uniforms.uUvOffset.value.set(0, 0);
        uniforms.uUvRotation.value = 0;
        uniforms.uTile.value = false;
        uniforms.uClip.value = false;
        uniforms.uUvCrop.value.set(0, 0, 1, 1);
      }
      const hovered = !!mesh.panel && mesh.panel === scene.hoverPanel;
      uniforms.uOverlayAlpha.value = hovered ? 0.1 : 0;
      uniforms.uOutlineAlpha.value = hovered ? 0.72 : 0;
    });
    for (let index = meshes.length; index < objects.length; index += 1) objects[index].visible = false;
  };

  const stageLights = (eye: [number, number, number]) => {
    const flat = scene.renderStyle === 'flat';
    renderer.toneMapping = flat ? NoToneMapping : NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    world.environmentIntensity = flat ? 0 : 0.72;
    // Turn the studio with the viewer as well, so every side of the carton is
    // lit the way the front is in the default view.
    world.environmentRotation.set(0, scene.yaw + 0.55, 0);
    key.visible = !flat;
    key.castShadow = scene.floorShadow;

    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const mesh of meshes) {
      const m = mesh.model;
      for (let i = 0; i < mesh.vertices.length; i += 8) {
        let x = mesh.vertices[i], y = mesh.vertices[i + 1], z = mesh.vertices[i + 2];
        if (m) [x, y, z] = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }
    if (!Number.isFinite(minY)) return;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
    const groundY = minY - size * 0.0015;
    // Looking up from below the floor, a shadow plane would sit in front of the carton.
    const showFloor = !flat && scene.floorShadow && eye[1] > groundY + size * 0.02;
    floor.visible = showFloor;
    floor.position.set((minX + maxX) / 2, groundY, (minZ + maxZ) / 2);
    floor.scale.setScalar(size * 8);
    contact.visible = showFloor;
    contact.position.set((minX + maxX) / 2, groundY + size * 0.0005, (minZ + maxZ) / 2);
    contact.scale.set((maxX - minX) * 1.35 + size * 0.06, (maxZ - minZ) * 1.35 + size * 0.06, 1);

    const azimuth = scene.yaw + 0.85;
    const elevation = 1.0;
    key.target.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    key.position.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation))
      .multiplyScalar(size * 3)
      .add(key.target.position);
    const shadowCamera = key.shadow.camera;
    shadowCamera.left = shadowCamera.bottom = -size * 1.3;
    shadowCamera.right = shadowCamera.top = size * 1.3;
    shadowCamera.near = size * 0.5;
    shadowCamera.far = size * 7;
    shadowCamera.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = size * 0.002;
  };

  const render = () => {
    if (capture) return;
    resize();
    const eye = updateCamera();
    stageLights(eye);
    renderer.render(world, camera);
  };

  const syncArtwork = (artworkByPanel: ArtworkByPanel) => {
    const active = new Set(Object.keys(artworkByPanel));
    for (const [panel, entry] of artwork) {
      if (!active.has(panel)) {
        entry.texture.dispose();
        artwork.delete(panel);
      }
    }
    for (const [panel, placement] of Object.entries(artworkByPanel)) {
      const url = placement.url;
      const current = artwork.get(panel);
      if (current?.url === url) continue;
      const texture = new Texture();
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = maxAnisotropy;
      // Keep showing the previous image until the new one arrives.
      const entry: ArtworkEntry = current?.loaded
        ? { ...current, url }
        : { texture, url, loaded: false, width: 1, height: 1 };
      artwork.set(panel, entry);
      const image = new Image();
      image.onload = () => {
        if (artwork.get(panel) !== entry) return;
        if (entry.texture !== texture) entry.texture.dispose();
        texture.image = image;
        texture.needsUpdate = true;
        entry.texture = texture;
        entry.loaded = true;
        entry.width = image.naturalWidth || image.width || 1;
        entry.height = image.naturalHeight || image.height || 1;
        syncMeshes();
        render();
      };
      image.onerror = () => {
        if (artwork.get(panel) === entry && entry.texture !== texture) texture.dispose();
        render();
      };
      image.src = url;
    }
  };

  return {
    gl: renderer.getContext(),
    setScene(next: Scene) {
      if (capture) {
        if (artworkUrlSignature(capture.liveScene.artworkByPanel) !== artworkUrlSignature(next.artworkByPanel)) syncArtwork(next.artworkByPanel);
        capture.liveScene = { ...next, dimensions: requireTemplateRuntime(next.templateId).sanitizeParameters(next.dimensions) };
        return;
      }
      const previous = scene;
      const artworkChanged = artworkUrlSignature(previous.artworkByPanel) !== artworkUrlSignature(next.artworkByPanel);
      scene = { ...next, dimensions: requireTemplateRuntime(next.templateId).sanitizeParameters(next.dimensions) };
      if (artworkChanged) syncArtwork(next.artworkByPanel);
      // Orbiting, zooming and panning only move the camera.
      if (artworkChanged || !meshes.length || CONTENT_KEYS.some(key => previous[key] !== next[key])) syncMeshes();
      render();
    },
    render,
    pickPanel(localX: number, localY: number) {
      return pickScenePanel(scene, meshes, localX, localY, canvas.clientWidth, canvas.clientHeight);
    },
    resize() {
      render();
    },
    /** The scene as last set by the page. */
    currentScene() {
      return capture ? capture.liveScene : scene;
    },
    /** Start drawing frames at a fixed video size on an opaque studio backdrop. */
    beginCapture(width: number, height: number) {
      if (capture) return;
      capture = { width, height, liveScene: scene };
      backdrop ??= backdropTexture();
      world.background = backdrop;
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
    },
    /** Draw one video frame: the live scene with these fields changed. */
    captureFrame(overrides: Partial<Scene>) {
      if (!capture) throw new Error('Video capture has not started.');
      const previous = scene;
      scene = { ...capture.liveScene, hoverPanel: null, ...overrides };
      if (!meshes.length || CONTENT_KEYS.some(key => previous[key] !== scene[key])) syncMeshes();
      const eye = updateCamera();
      stageLights(eye);
      renderer.render(world, camera);
      return canvas;
    },
    endCapture() {
      if (!capture) return;
      scene = capture.liveScene;
      capture = null;
      world.background = null;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false);
      syncMeshes();
      render();
    },
    /** A PNG of the current view with its longest side at `longSide` pixels. */
    snapshot(longSide: number) {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const limit = Math.min(renderer.capabilities.maxTextureSize, renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE) as number);
      const target = Math.min(longSide, limit);
      const ratio = target / Math.max(width, height);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      try {
        const eye = updateCamera();
        stageLights(eye);
        renderer.render(world, camera);
        return canvas.toDataURL('image/png');
      } finally {
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        render();
      }
    },
    dispose() {
      for (const object of objects) {
        object.geometry.dispose();
        object.material.dispose();
      }
      for (const entry of artwork.values()) entry.texture.dispose();
      artwork.clear();
      placeholder.dispose();
      environment.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      contact.geometry.dispose();
      contact.material.map?.dispose();
      contact.material.dispose();
      backdrop?.dispose();
      renderer.dispose();
    },
  };
}

function surfaceOf(mesh: Mesh): Surface {
  if (mesh.panel?.startsWith('Interior') || mesh.bend === 'inside') return 'inside';
  if (mesh.doubleSided && !mesh.panel) return 'edge';
  return 'outside';
}

function faceSize(mesh: Mesh): [number, number] {
  const v = mesh.vertices;
  if (v.length < 48) return [1, 1];
  // Quads are a(0,0) b(1,0) c(1,1) | a c d(0,1): u runs a→b, v runs a→d.
  const u = Math.hypot(v[8] - v[0], v[9] - v[1], v[10] - v[2]);
  const w = Math.hypot(v[40] - v[0], v[41] - v[1], v[42] - v[2]);
  return [Math.max(u, 1e-3), Math.max(w, 1e-3)];
}

function meshGeometry(mesh: Mesh) {
  const geometry = new BufferGeometry();
  const buffer = new InterleavedBuffer(mesh.vertices, 8);
  geometry.setAttribute('position', new InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute('normal', new InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute('uv', new InterleavedBufferAttribute(buffer, 2, 6));
  return geometry;
}

function applyFinish(material: MeshPhysicalMaterial, finish: Finish, uniforms: CartonUniforms, fibreOverride: Finish | null) {
  material.roughness = finish.roughness;
  material.metalness = finish.metalness ?? 0;
  material.clearcoat = finish.clearcoat ?? 0;
  material.clearcoatRoughness = finish.clearcoatRoughness ?? 0;
  material.sheen = finish.sheen ?? 0;
  material.envMapIntensity = finish.reflections ?? 1;
  uniforms.uGrain.value = (fibreOverride ?? finish).grain;
  uniforms.uFiber.value = (fibreOverride ?? finish).fiber;
}

function createCartonMaterial() {
  const uniforms: CartonUniforms = {
    uArt: { value: new Texture() },
    uUseArt: { value: false },
    uUvScale: { value: new Vector2(1, 1) },
    uUvOffset: { value: new Vector2() },
    uUvRotation: { value: 0 },
    uTile: { value: false },
    uClip: { value: false },
    uUvCrop: { value: new Vector4(0, 0, 1, 1) },
    uFaceUv: { value: new Vector4(0, 0, 1, 1) },
    uFaceSize: { value: new Vector2(1, 1) },
    uEdgeOcclusion: { value: new Vector4() },
    uEdgeRounded: { value: new Vector4() },
    uEdgeNormals: { value: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] },
    uOcclusionWidth: { value: 1 },
    uRoundRadius: { value: 1 },
    uFlutePitch: { value: 0 },
    uGrain: { value: 0 },
    uFiber: { value: 0 },
    uFlat: { value: 0 },
    uOverlayColor: { value: OVERLAY_COLOR },
    uOverlayAlpha: { value: 0 },
    uOutlineAlpha: { value: 0 },
  };
  const material = new MeshPhysicalMaterial({ sheenRoughness: 0.6, sheenColor: 0xffffff });
  material.userData.uniforms = uniforms;
  material.customProgramCacheKey = () => 'carton-surface-v2';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vArtUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vArtUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', ARTWORK_FRAGMENT)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + uFiber * 0.08 * (cartonFibre - 0.5), 0.04, 1.0);\n  roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.55), artAlpha * step(0.5, metalness));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor *= 1.0 - artAlpha;')
      .replace('#include <normal_fragment_maps>', GRAIN_FRAGMENT)
      .replace('#include <aomap_fragment>', OCCLUSION_FRAGMENT)
      .replace('#include <opaque_fragment>', `${OVERLAY_FRAGMENT}\n#include <opaque_fragment>`);
  };
  return material;
}

/** The light studio gradient behind exported videos, which cannot be transparent. */
function backdropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#f4f7f9');
    gradient.addColorStop(1, '#dfe5eb');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function contactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

const FRAGMENT_PARS = /* glsl */`
varying vec2 vArtUv;
uniform sampler2D uArt;
uniform bool uUseArt;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform float uUvRotation;
uniform bool uTile;
uniform bool uClip;
uniform vec4 uUvCrop;
uniform vec4 uFaceUv;
uniform vec2 uFaceSize;
uniform vec4 uEdgeOcclusion;
uniform vec4 uEdgeRounded;
uniform vec3 uEdgeNormals[4];
uniform float uOcclusionWidth;
uniform float uRoundRadius;
uniform float uFlutePitch;
uniform float uGrain;
uniform float uFiber;
uniform float uFlat;
uniform vec3 uOverlayColor;
uniform float uOverlayAlpha;
uniform float uOutlineAlpha;

float cartonHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float cartonNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cartonHash(i), cartonHash(i + vec2(1.0, 0.0)), u.x),
             mix(cartonHash(i + vec2(0.0, 1.0)), cartonHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 cartonPerturbNormal(vec3 surfPos, vec3 surfNormal, vec2 dHdxy, float facing) {
  vec3 sigmaX = dFdx(surfPos);
  vec3 sigmaY = dFdy(surfPos);
  vec3 r1 = cross(sigmaY, surfNormal);
  vec3 r2 = cross(surfNormal, sigmaX);
  float det = dot(sigmaX, r1) * facing;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNormal - grad);
}
`;

// Same placement maths as the 2D editor: artwork is a printed layer over the
// board, and transparent pixels show the stock underneath.
const ARTWORK_FRAGMENT = /* glsl */`
  float artAlpha = 0.0;
  {
    vec2 centered = (uFaceUv.xy + vArtUv * uFaceUv.zw) - vec2(0.5) - uUvOffset;
    float c = cos(uUvRotation);
    float s = sin(uUvRotation);
    vec2 texUv = (mat2(c, -s, s, c) * centered) / uUvScale + vec2(0.5);
    bool outside = texUv.x < 0.0 || texUv.x > 1.0 || texUv.y < 0.0 || texUv.y > 1.0;
    if (uTile) texUv = fract(texUv);
    texUv = uUvCrop.xy + texUv * uUvCrop.zw;
    if (uUseArt && !(uClip && outside)) {
      vec4 art = texture2D(uArt, texUv);
      diffuseColor.rgb = mix(diffuseColor.rgb, art.rgb, art.a);
      artAlpha = art.a;
    }
  }
  // Board fibres, measured in millimetres so every face has the same grain.
  // Fine detail fades out once it gets smaller than a pixel, so it never
  // shimmers; the coarse mottle stays visible at any zoom.
  vec2 cartonMm = vArtUv * uFaceSize;
  float cartonFootprint = length(fwidth(cartonMm));
  float cartonDetail = 1.0 - smoothstep(0.08, 0.3, cartonFootprint);
  float cartonFibre = mix(0.5, cartonNoise(cartonMm * vec2(0.45, 3.2)) * 0.55 + cartonNoise(cartonMm * 1.9 + 17.0) * 0.45, cartonDetail);
  float cartonMottle = cartonNoise(cartonMm * 0.16 + 3.0) * 0.6 + cartonNoise(cartonMm * 0.05 + 9.0) * 0.4;
  diffuseColor.rgb *= 1.0 + (1.0 - uFlat) * uFiber * (0.16 * (cartonFibre - 0.5) + 0.12 * (cartonMottle - 0.5));
  // Millimetres to each edge, in the order a→b, b→c, c→d, d→a.
  vec4 cartonEdgeMm = vec4(vArtUv.y * uFaceSize.y, (1.0 - vArtUv.x) * uFaceSize.x, (1.0 - vArtUv.y) * uFaceSize.y, vArtUv.x * uFaceSize.x);
  if (uFlutePitch > 0.0) {
    // Corrugated cut edge: two flat liners with the fluted medium waving
    // between them, and dark hollows on either side of the wave.
    bool acrossU = uFaceSize.x < uFaceSize.y;
    float across = acrossU ? vArtUv.x : vArtUv.y;
    float acrossMm = min(uFaceSize.x, uFaceSize.y);
    float alongMm = (acrossU ? vArtUv.y : vArtUv.x) * max(uFaceSize.x, uFaceSize.y);
    float liner = 0.12;
    float wave = 0.5 + (0.5 - liner * 1.15) * sin(6.2831853 * alongMm / uFlutePitch);
    float toWave = abs(across - wave) * acrossMm;
    float aa = max(fwidth(toWave), 1e-4);
    float medium = 1.0 - smoothstep(acrossMm * 0.07, acrossMm * 0.07 + aa * 1.5, toWave);
    float aaAcross = max(fwidth(across), 1e-4);
    float linerMask = 1.0 - smoothstep(liner, liner + aaAcross, across) + smoothstep(1.0 - liner - aaAcross, 1.0 - liner, across);
    float flute = mix(0.42, 1.0, clamp(max(medium, linerMask), 0.0, 1.0));
    // Fade to the average once the flutes are smaller than a few pixels.
    float resolved = 1.0 - smoothstep(0.15, 0.5, fwidth(alongMm) / uFlutePitch);
    diffuseColor.rgb *= mix(0.8, flute, resolved);
  }
`;

const GRAIN_FRAGMENT = /* glsl */`
#include <normal_fragment_maps>
  if (uFlat < 0.5) {
    // Rounded folds: near an outside crease the surface turns toward the
    // neighbouring face, so the fold catches light like bent board.
    for (int i = 0; i < 4; i++) {
      if (uEdgeRounded[i] < 0.5) continue;
      float bend = 1.0 - smoothstep(0.0, uRoundRadius, cartonEdgeMm[i]);
      if (bend <= 0.0) continue;
      vec3 neighbour = normalize((viewMatrix * vec4(uEdgeNormals[i], 0.0)).xyz) * faceDirection;
      normal = normalize(mix(normal, normalize(normal + neighbour), bend));
    }
  }
  if (uGrain > 0.0 && uFlat < 0.5) {
    float relief = mix(0.5, cartonNoise(cartonMm * 2.6), cartonDetail) * 0.6 + cartonFibre * 0.4;
    float fade = cartonDetail;
    vec2 dHdxy = vec2(dFdx(relief), dFdy(relief)) * uGrain * 0.35 * fade;
    normal = cartonPerturbNormal(-vViewPosition, normal, dHdxy, faceDirection);
  }
`;

// Soft shadow into inside corners and along folds that close over a face,
// which a single shadow-casting light cannot produce.
const OCCLUSION_FRAGMENT = /* glsl */`
#include <aomap_fragment>
  if (uFlat < 0.5) {
    float cartonOcclusion = 1.0;
    for (int i = 0; i < 4; i++) {
      float reach = 1.0 - smoothstep(0.0, uOcclusionWidth, cartonEdgeMm[i]);
      cartonOcclusion *= 1.0 - uEdgeOcclusion[i] * reach * reach;
    }
    reflectedLight.indirectDiffuse *= cartonOcclusion;
    reflectedLight.indirectSpecular *= mix(1.0, cartonOcclusion, 0.7);
    reflectedLight.directDiffuse *= mix(1.0, cartonOcclusion, 0.35);
  }
`;

const OVERLAY_FRAGMENT = /* glsl */`
  // Flat proof: the printed colour exactly, with no lighting.
  outgoingLight = mix(outgoingLight, diffuseColor.rgb, uFlat);
  outgoingLight = mix(outgoingLight, uOverlayColor, uOverlayAlpha);
  float cartonEdge = min(min(vArtUv.x, 1.0 - vArtUv.x), min(vArtUv.y, 1.0 - vArtUv.y));
  outgoingLight = mix(outgoingLight, uOverlayColor, (1.0 - smoothstep(0.002, 0.012, cartonEdge)) * uOutlineAlpha);
`;
