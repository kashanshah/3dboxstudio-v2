'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { reverseTuckFoldState, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { ArtworkByPanel, ArtworkPlacement } from '@/lib/packaging/artwork';

export type CartonEngineHandle = {
  exportPng: (filename?: string) => boolean;
  resetCamera: () => void;
};

type Props = {
  dimensions: CartonDimensions;
  opening: number;
  material: string;
  artworkByPanel: ArtworkByPanel;
  cameraPreset: string;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  lightIntensity?: number;
  onPanelSelect?: (panel: string, point: { x: number; y: number }) => void;
};

type Mesh = {
  vertices: Float32Array;
  useTexture: boolean;
  color: [number, number, number];
  model?: Float32Array;
  panel?: string;
  pickCorners?: number[][];
  faceAspect?: number;
};

export const CartonEngine = forwardRef<CartonEngineHandle, Props>(function CartonEngine(
  { dimensions, opening, material, artworkByPanel, cameraPreset, zoom, onZoomChange, lightIntensity = 0.78, onPanelSelect },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const [yaw, setYaw] = useState(-0.55);
  const [pitch, setPitch] = useState(0.28);
  const [hoverPanel, setHoverPanel] = useState<string | null>(null);
  const yawRef = useRef(-0.55);
  const pitchRef = useRef(0.28);
  const cameraAnimationRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean } | null>(null);

  const cancelCameraAnimation = useCallback(() => {
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
  }, []);

  const animateCameraTo = useCallback((targetYaw: number, targetPitch: number) => {
    cancelCameraAnimation();

    const startYaw = yawRef.current;
    const startPitch = pitchRef.current;
    const yawDelta = shortestAngleDelta(startYaw, targetYaw);
    const pitchDelta = targetPitch - startPitch;
    const startedAt = performance.now();
    const duration = 520;

    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      const nextYaw = startYaw + yawDelta * eased;
      const nextPitch = startPitch + pitchDelta * eased;

      yawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      setYaw(nextYaw);
      setPitch(nextPitch);

      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(frame);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    cameraAnimationRef.current = requestAnimationFrame(frame);
  }, [cancelCameraAnimation]);

  const resetCamera = useCallback(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useImperativeHandle(ref, () => ({
    exportPng(filename = '3d-box-studio-carton.png') {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      rendererRef.current?.render();
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
      return true;
    },
    resetCamera,
  }), [resetCamera]);

  useEffect(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas);
    if (!renderer) return;
    rendererRef.current = renderer;

    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    renderer.resize();

    return () => {
      observer.disconnect();
      cancelCameraAnimation();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [cancelCameraAnimation]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setScene({
      dimensions,
      opening,
      material,
      artworkByPanel,
      yaw,
      pitch,
      zoom,
      lightIntensity,
      hoverPanel,
    });
  }, [dimensions, opening, material, artworkByPanel, yaw, pitch, zoom, lightIntensity, hoverPanel]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    cancelCameraAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: yawRef.current, pitch: pitchRef.current, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      const nextYaw = drag.yaw - dx * 0.008;
      const nextPitch = clamp(drag.pitch + dy * 0.006, -1.15, 1.15);
      yawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      setYaw(nextYaw);
      setPitch(nextPitch);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const hovered = rendererRef.current?.pickPanel(event.clientX - rect.left, event.clientY - rect.top) ?? null;
    setHoverPanel(hovered);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag?.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const panel = rendererRef.current?.pickPanel(x, y);
      if (panel) onPanelSelect?.(panel, { x, y });
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const sensitivity = event.ctrlKey ? 0.18 : 0.08;
    const delta = clamp(-event.deltaY * sensitivity, -10, 10);
    if (Math.abs(delta) < 0.05) return;
    onZoomChange?.(clamp(zoom + delta, 40, 140));
  };

  return <canvas
    ref={canvasRef}
    className="carton-engine-canvas"
    aria-label="Interactive WebGL reverse-tuck carton"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { dragRef.current = null; }}
    onPointerLeave={() => { dragRef.current = null; setHoverPanel(null); }}
    onWheel={onWheel}
  />;
});

type Scene = {
  dimensions: CartonDimensions;
  opening: number;
  material: string;
  artworkByPanel: ArtworkByPanel;
  yaw: number;
  pitch: number;
  zoom: number;
  lightIntensity: number;
  hoverPanel: string | null;
};

function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;

  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  const normalLocation = gl.getAttribLocation(program, 'aNormal');
  const uvLocation = gl.getAttribLocation(program, 'aUv');
  const viewProjectionLocation = gl.getUniformLocation(program, 'uViewProjection');
  const modelLocation = gl.getUniformLocation(program, 'uModel');
  const colorLocation = gl.getUniformLocation(program, 'uColor');
  const lightLocation = gl.getUniformLocation(program, 'uLightDirection');
  const lightIntensityLocation = gl.getUniformLocation(program, 'uLightIntensity');
  const useTextureLocation = gl.getUniformLocation(program, 'uUseTexture');
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  const uvScaleLocation = gl.getUniformLocation(program, 'uUvScale');
  const uvOffsetLocation = gl.getUniformLocation(program, 'uUvOffset');
  const uvRotationLocation = gl.getUniformLocation(program, 'uUvRotation');
  const tileLocation = gl.getUniformLocation(program, 'uTile');
  const clipLocation = gl.getUniformLocation(program, 'uClipOutside');
  const overlayColorLocation = gl.getUniformLocation(program, 'uOverlayColor');
  const overlayAlphaLocation = gl.getUniformLocation(program, 'uOverlayAlpha');
  const outlineAlphaLocation = gl.getUniformLocation(program, 'uOutlineAlpha');

  const buffer = gl.createBuffer();
  if (!buffer) return null;

  const panelTextures = new Map<string, { texture: WebGLTexture; url: string; loaded: boolean; width: number; height: number }>();

  let scene: Scene = {
    dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 },
    opening: 18,
    material: 'Soft touch',
    artworkByPanel: {},
    yaw: -0.55,
    pitch: 0.28,
    zoom: 82,
    lightIntensity: 0.78,
    hoverPanel: null,
  };
  let artworkToken = 0;

  const render = () => {
    resize();
    const { width, height, depth } = scene.dimensions;
    const maxDimension = Math.max(width, height, depth);
    const aspect = Math.max(0.1, canvas.width / canvas.height);
    const distance = maxDimension * (3.2 - clamp(scene.zoom / 100, 0.4, 1.4) * 0.9);
    const eye = orbitEye(distance, scene.yaw, scene.pitch);
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const projection = perspective(Math.PI / 4.2, aspect, Math.max(0.1, maxDimension * 0.01), maxDimension * 20);
    const viewProjection = multiply4(projection, view);
    const meshes = buildMeshes(scene.dimensions, scene.opening, materialColor(scene.material));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 8 * 4;
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normalLocation);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, stride, 6 * 4);

    gl.uniformMatrix4fv(viewProjectionLocation, false, viewProjection);
    gl.uniform3f(lightLocation, -0.45, 0.8, 0.55);
    gl.uniform1f(lightIntensityLocation, clamp(scene.lightIntensity, 0.15, 1.5));
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(textureLocation, 0);

    for (const mesh of meshes) {
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.uniformMatrix4fv(modelLocation, false, mesh.model ?? identity4());
      gl.uniform3fv(colorLocation, mesh.color);

      const textureEntry = mesh.panel ? panelTextures.get(mesh.panel) : undefined;
      const placement = mesh.panel ? scene.artworkByPanel[mesh.panel] : undefined;
      const shouldUseTexture = !!mesh.useTexture && !!textureEntry?.loaded && !!placement;
      if (shouldUseTexture && textureEntry && placement) {
        gl.bindTexture(gl.TEXTURE_2D, textureEntry.texture);
        const transform = textureTransform(placement, textureEntry.width / textureEntry.height, mesh.faceAspect ?? 1);
        gl.uniform2f(uvScaleLocation, transform.scaleX, transform.scaleY);
        gl.uniform2f(uvOffsetLocation, transform.offsetX, transform.offsetY);
        gl.uniform1f(uvRotationLocation, placement.rotation * Math.PI / 180);
        gl.uniform1i(tileLocation, placement.mode === 'tile' ? 1 : 0);
        gl.uniform1i(clipLocation, placement.mode === 'fit' ? 1 : 0);
      } else {
        gl.uniform2f(uvScaleLocation, 1, 1);
        gl.uniform2f(uvOffsetLocation, 0, 0);
        gl.uniform1f(uvRotationLocation, 0);
        gl.uniform1i(tileLocation, 0);
        gl.uniform1i(clipLocation, 0);
      }

      const isHovered = !!mesh.panel && mesh.panel === scene.hoverPanel;
      gl.uniform3f(overlayColorLocation, 0.0, 0.46, 0.77);
      gl.uniform1f(overlayAlphaLocation, isHovered ? 0.10 : 0.0);
      gl.uniform1f(outlineAlphaLocation, isHovered ? 0.72 : 0.0);

      gl.uniform1i(useTextureLocation, shouldUseTexture ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices.length / 8);
    }
  };

  const resize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const syncPanelTextures = (artworkByPanel: ArtworkByPanel) => {
    const token = ++artworkToken;
    const activePanels = new Set(Object.keys(artworkByPanel));

    for (const [panel, entry] of panelTextures) {
      if (!activePanels.has(panel) || artworkByPanel[panel]?.url !== entry.url) {
        gl.deleteTexture(entry.texture);
        panelTextures.delete(panel);
      }
    }

    for (const [panel, artwork] of Object.entries(artworkByPanel)) {
      const url = artwork.url;
      const current = panelTextures.get(panel);
      if (current?.url === url) continue;

      const texture = gl.createTexture();
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      uploadPlaceholderTexture(gl);

      const entry = { texture, url, loaded: false, width: 1, height: 1 };
      panelTextures.set(panel, entry);

      const image = new Image();
      image.onload = () => {
        if (token !== artworkToken) return;
        const latest = panelTextures.get(panel);
        if (!latest || latest.url !== url) return;
        gl.bindTexture(gl.TEXTURE_2D, latest.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        latest.loaded = true;
        latest.width = image.naturalWidth || image.width || 1;
        latest.height = image.naturalHeight || image.height || 1;
        render();
      };
      image.onerror = () => {
        const latest = panelTextures.get(panel);
        if (latest?.url === url) latest.loaded = false;
        render();
      };
      image.src = url;
    }
  };

  return {
    setScene(next: Scene) {
      const previousUrls = artworkUrlSignature(scene.artworkByPanel);
      const nextUrls = artworkUrlSignature(next.artworkByPanel);
      scene = next;
      if (previousUrls !== nextUrls) syncPanelTextures(next.artworkByPanel);
      render();
    },
    render,
    pickPanel(localX: number, localY: number) {
      const { width, height, depth } = scene.dimensions;
      const maxDimension = Math.max(width, height, depth);
      const aspect = Math.max(0.1, canvas.width / canvas.height);
      const distance = maxDimension * (3.2 - clamp(scene.zoom / 100, 0.4, 1.4) * 0.9);
      const eye = orbitEye(distance, scene.yaw, scene.pitch);
      const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      const projection = perspective(Math.PI / 4.2, aspect, Math.max(0.1, maxDimension * 0.01), maxDimension * 20);
      const viewProjection = multiply4(projection, view);
      const meshes = buildMeshes(scene.dimensions, scene.opening, materialColor(scene.material))
        .filter(mesh => mesh.panel && mesh.pickCorners);

      const hits = meshes.map(mesh => {
        const model = mesh.model ?? identity4();
        const projected = mesh.pickCorners!.map(point => projectPoint(point, model, viewProjection, canvas.clientWidth, canvas.clientHeight));
        if (!projected.every(Boolean)) return null;
        const polygon = projected as [number, number, number][];
        if (!pointInPolygon(localX, localY, polygon)) return null;
        const depth = polygon.reduce((sum, point) => sum + point[2], 0) / polygon.length;
        return { panel: mesh.panel!, depth };
      }).filter((hit): hit is { panel: string; depth: number } => !!hit);

      hits.sort((a, b) => a.depth - b.depth);
      return hits[0]?.panel ?? null;
    },
    resize() {
      resize();
      render();
    },
    dispose() {
      ++artworkToken;
      gl.deleteBuffer(buffer);
      for (const entry of panelTextures.values()) gl.deleteTexture(entry.texture);
      panelTextures.clear();
      gl.deleteProgram(program);
    },
  };
}

function buildMeshes(dimensions: CartonDimensions, opening: number, color: [number, number, number]): Mesh[] {
  const { width: w, height: h, depth: d } = dimensions;
  const t = clamp(dimensions.thickness, 0.3, Math.min(w, d) * 0.08);
  const fold = reverseTuckFoldState(opening);
  const wallAngle = fold.walls * Math.PI / 2;
  const backAngle = fold.back * Math.PI / 2;
  const topAngle = fold.top * Math.PI / 2;
  const bottomAngle = fold.bottom * Math.PI / 2;

  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const zFront = d / 2;

  const darker: [number, number, number] = color.map(v => v * 0.86) as [number, number, number];
  const lighter: [number, number, number] = color.map(v => Math.min(1, v * 1.08)) as [number, number, number];
  const interior: [number, number, number] = color.map(v => Math.min(1, v * 0.92 + 0.08)) as [number, number, number];

  const frontCorners = [
    [x0, y0, zFront],
    [x1, y0, zFront],
    [x1, y1, zFront],
    [x0, y1, zFront],
  ];

  const leftOuterX = x0 - d * Math.cos(wallAngle);
  const leftOuterZ = zFront - d * Math.sin(wallAngle);
  const leftCorners = [
    [leftOuterX, y0, leftOuterZ],
    [x0, y0, zFront],
    [x0, y1, zFront],
    [leftOuterX, y1, leftOuterZ],
  ];

  const rightOuterX = x1 + d * Math.cos(wallAngle);
  const rightOuterZ = zFront - d * Math.sin(wallAngle);
  const rightCorners = [
    [x1, y0, zFront],
    [rightOuterX, y0, rightOuterZ],
    [rightOuterX, y1, rightOuterZ],
    [x1, y1, zFront],
  ];

  const backDirectionAngle = wallAngle + backAngle;
  const backDx = Math.cos(backDirectionAngle);
  const backDz = -Math.sin(backDirectionAngle);
  const backFarX = rightOuterX + w * backDx;
  const backFarZ = rightOuterZ + w * backDz;
  const backCorners = [
    [rightOuterX, y0, rightOuterZ],
    [backFarX, y0, backFarZ],
    [backFarX, y1, backFarZ],
    [rightOuterX, y1, rightOuterZ],
  ];

  const topOuterY = y1 + d * Math.cos(topAngle);
  const topOuterZ = zFront - d * Math.sin(topAngle);
  const topCorners = [
    [x0, y1, zFront],
    [x1, y1, zFront],
    [x1, topOuterY, topOuterZ],
    [x0, topOuterY, topOuterZ],
  ];

  const bottomOuterY = y0 - d * Math.cos(bottomAngle);
  const bottomOuterZ = zFront - d * Math.sin(bottomAngle);
  const bottomCorners = [
    [x0, bottomOuterY, bottomOuterZ],
    [x1, bottomOuterY, bottomOuterZ],
    [x1, y0, zFront],
    [x0, y0, zFront],
  ];

  const panels: Array<{
    name: string;
    corners: number[][];
    surfaceColor: [number, number, number];
    aspect: number;
  }> = [
    { name: 'Front', corners: frontCorners, surfaceColor: color, aspect: w / h },
    { name: 'Left', corners: leftCorners, surfaceColor: darker, aspect: d / h },
    { name: 'Right', corners: rightCorners, surfaceColor: color, aspect: d / h },
    { name: 'Back', corners: backCorners, surfaceColor: darker, aspect: w / h },
    { name: 'Top', corners: topCorners, surfaceColor: lighter, aspect: w / d },
    { name: 'Bottom', corners: bottomCorners, surfaceColor: darker, aspect: w / d },
  ];

  const exteriorMeshes: Mesh[] = [];
  const interiorMeshes: Mesh[] = [];

  for (const panel of panels) {
    const exterior = quadFromCorners(panel.corners, panel.surfaceColor, true, panel.name);
    exterior.faceAspect = panel.aspect;
    exteriorMeshes.push(exterior);

    const normal = faceNormal(panel.corners);
    const insideCorners = panel.corners.map(point => [
      point[0] - normal[0] * t,
      point[1] - normal[1] * t,
      point[2] - normal[2] * t,
    ]);
    const reversed = [insideCorners[3], insideCorners[2], insideCorners[1], insideCorners[0]];
    const inside = quadFromCorners(reversed, interior, true, `Interior ${panel.name}`);
    inside.faceAspect = panel.aspect;
    interiorMeshes.push(inside);
  }

  return [...exteriorMeshes, ...interiorMeshes];
}

function quadFromCorners(
  corners: number[][],
  color: [number, number, number],
  useTexture = false,
  panel?: string,
): Mesh {
  const normal = faceNormal(corners);
  return quad(corners[0], corners[1], corners[2], corners[3], normal, color, useTexture, panel);
}

function faceNormal(corners: number[][]): [number, number, number] {
  const a = corners[0], b = corners[1], d = corners[3];
  const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const ad = [d[0]-a[0], d[1]-a[1], d[2]-a[2]];
  const cross = [
    ab[1] * ad[2] - ab[2] * ad[1],
    ab[2] * ad[0] - ab[0] * ad[2],
    ab[0] * ad[1] - ab[1] * ad[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]) || 1;
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

function quad(
  a: number[], b: number[], c: number[], d: number[],
  normal: [number, number, number],
  color: [number, number, number],
  useTexture = false,
  panel?: string,
): Mesh {
  const vertices = [
    ...vertex(a, normal, [0,0]), ...vertex(b, normal, [1,0]), ...vertex(c, normal, [1,1]),
    ...vertex(a, normal, [0,0]), ...vertex(c, normal, [1,1]), ...vertex(d, normal, [0,1]),
  ];
  const edge1 = Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
  const edge2 = Math.hypot(d[0]-a[0], d[1]-a[1], d[2]-a[2]);
  return {
    vertices: new Float32Array(vertices),
    useTexture,
    color,
    panel,
    pickCorners: panel ? [a,b,c,d] : undefined,
    faceAspect: edge2 > 0 ? edge1 / edge2 : 1,
  };
}

function vertex(position: number[], normal: number[], uv: number[]) {
  return [...position, ...normal, ...uv];
}

function uploadPlaceholderTexture(gl: WebGLRenderingContext) {
  gl.bindTexture(gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D));
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([
      242,246,249,255, 242,246,249,255,
      242,246,249,255, 242,246,249,255,
    ]),
  );
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uViewProjection;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  gl_Position = uViewProjection * world;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform float uLightIntensity;
uniform bool uUseTexture;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform float uUvRotation;
uniform bool uTile;
uniform bool uClipOutside;
uniform vec3 uOverlayColor;
uniform float uOverlayAlpha;
uniform float uOutlineAlpha;
void main() {
  vec3 normal = normalize(vNormal);
  float diffuse = max(0.0, dot(normal, normalize(uLightDirection)));
  float light = 0.52 + diffuse * 0.48 * uLightIntensity;

  vec2 centered = vUv - vec2(0.5) - uUvOffset;
  float c = cos(uUvRotation);
  float s = sin(uUvRotation);
  vec2 rotated = mat2(c, -s, s, c) * centered;
  vec2 texUv = rotated / uUvScale + vec2(0.5);
  bool outside = texUv.x < 0.0 || texUv.x > 1.0 || texUv.y < 0.0 || texUv.y > 1.0;
  if (uTile) texUv = fract(texUv);

  vec4 base = vec4(uColor, 1.0);
  if (uUseTexture && !(uClipOutside && outside)) {
    base = texture2D(uTexture, texUv);
  }

  vec3 shaded = base.rgb * light;
  shaded = mix(shaded, uOverlayColor, uOverlayAlpha);

  float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float edge = 1.0 - smoothstep(0.0, 0.028, edgeDistance);
  shaded = mix(shaded, uOverlayColor, edge * uOutlineAlpha);

  gl_FragColor = vec4(shaded, base.a);
}
`;

function artworkUrlSignature(artworkByPanel: ArtworkByPanel) {
  return Object.keys(artworkByPanel)
    .sort()
    .map(panel => `${panel}:${artworkByPanel[panel]?.url ?? ''}`)
    .join('|');
}

function textureTransform(
  placement: ArtworkPlacement,
  imageAspect: number,
  faceAspect: number,
) {
  let scaleX = 1;
  let scaleY = 1;

  if (placement.mode === 'fill') {
    if (imageAspect > faceAspect) scaleX = imageAspect / faceAspect;
    else scaleY = faceAspect / imageAspect;
  } else if (placement.mode === 'fit') {
    if (imageAspect > faceAspect) scaleY = faceAspect / imageAspect;
    else scaleX = imageAspect / faceAspect;
  }

  const userScale = Math.max(0.25, placement.scale / 100);
  scaleX *= userScale;
  scaleY *= userScale;

  if (placement.mode === 'tile') {
    const tileScale = Math.max(0.2, 100 / Math.max(25, placement.scale));
    scaleX = tileScale;
    scaleY = tileScale;
  }

  const overflowX = Math.max(0, 1 - 1 / Math.max(scaleX, 1e-5));
  const overflowY = Math.max(0, 1 - 1 / Math.max(scaleY, 1e-5));
  const offsetX = placement.alignX * overflowX * 0.5;
  const offsetY = -placement.alignY * overflowY * 0.5;

  return { scaleX, scaleY, offsetX, offsetY };
}

function materialColor(material: string): [number, number, number] {
  switch (material) {
    case 'Kraft': return [0.64, 0.47, 0.29];
    case 'White board': return [0.92, 0.93, 0.94];
    case 'Matte coated': return [0.82, 0.86, 0.89];
    case 'Gloss coated': return [0.77, 0.84, 0.9];
    case 'Foil': return [0.78, 0.64, 0.3];
    default: return [0.78, 0.83, 0.87];
  }
}

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function cameraForPreset(preset: string) {
  switch (preset) {
    case 'Front': return { yaw: 0, pitch: 0 };
    case 'Back': return { yaw: Math.PI, pitch: 0 };
    case 'Left': return { yaw: -Math.PI / 2, pitch: 0 };
    case 'Right': return { yaw: Math.PI / 2, pitch: 0 };
    case 'Top': return { yaw: -0.15, pitch: 1.12 };
    default: return { yaw: -0.55, pitch: 0.28 };
  }
}

function orbitEye(distance: number, yaw: number, pitch: number): [number, number, number] {
  const cosPitch = Math.cos(pitch);
  return [
    Math.sin(yaw) * cosPitch * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * cosPitch * distance,
  ];
}

function identity4() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ]);
}

function translation4(x: number, y: number, z: number) {
  const out = identity4();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function rotationX4(angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([
    1,0,0,0,
    0,c,s,0,
    0,-s,c,0,
    0,0,0,1,
  ]);
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,0,0,0,
    0,f,0,0,
    0,0,(far + near) * nf,-1,
    0,0,(2 * far * near) * nf,0,
  ]);
}

function lookAt(eye: number[], center: number[], up: number[]) {
  const z = normalize3([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -dot3(x,eye),-dot3(y,eye),-dot3(z,eye),1,
  ]);
}

function multiply4(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function projectPoint(
  point: number[],
  model: Float32Array,
  viewProjection: Float32Array,
  width: number,
  height: number,
): [number, number, number] | null {
  const world = multiplyVec4(model, [point[0], point[1], point[2], 1]);
  const clip = multiplyVec4(viewProjection, world);
  if (Math.abs(clip[3]) < 1e-6) return null;
  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  const ndcZ = clip[2] / clip[3];
  return [
    (ndcX * 0.5 + 0.5) * width,
    (1 - (ndcY * 0.5 + 0.5)) * height,
    ndcZ,
  ];
}

function multiplyVec4(matrix: Float32Array, vector: number[]) {
  return [
    matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
    matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
    matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
    matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
  ];
}

function pointInPolygon(x: number, y: number, polygon: [number, number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function normalize3(v: number[]) {
  const length = Math.hypot(v[0],v[1],v[2]) || 1;
  return [v[0]/length,v[1]/length,v[2]/length];
}
function cross3(a:number[],b:number[]) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot3(a:number[],b:number[]) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function clamp(value:number,min:number,max:number){ return Math.min(max,Math.max(min,value)); }
