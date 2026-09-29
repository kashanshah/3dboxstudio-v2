'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';

export type CartonEngineHandle = {
  exportPng: (filename?: string) => boolean;
  resetCamera: () => void;
};

type Props = {
  dimensions: CartonDimensions;
  opening: number;
  material: string;
  artworkUrl: string | null;
  cameraPreset: string;
  zoom: number;
  lightIntensity?: number;
};

type Mesh = {
  vertices: Float32Array;
  useTexture: boolean;
  color: [number, number, number];
  model?: Float32Array;
};

export const CartonEngine = forwardRef<CartonEngineHandle, Props>(function CartonEngine(
  { dimensions, opening, material, artworkUrl, cameraPreset, zoom, lightIntensity = 0.78 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const [yaw, setYaw] = useState(-0.55);
  const [pitch, setPitch] = useState(0.28);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const resetCamera = () => {
    const preset = cameraForPreset(cameraPreset);
    setYaw(preset.yaw);
    setPitch(preset.pitch);
  };

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
  }));

  useEffect(() => {
    const preset = cameraForPreset(cameraPreset);
    setYaw(preset.yaw);
    setPitch(preset.pitch);
  }, [cameraPreset]);

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
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setScene({
      dimensions,
      opening,
      material,
      artworkUrl,
      yaw,
      pitch,
      zoom,
      lightIntensity,
    });
  }, [dimensions, opening, material, artworkUrl, yaw, pitch, zoom, lightIntensity]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, yaw, pitch };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setYaw(drag.yaw + (event.clientX - drag.x) * 0.008);
    setPitch(clamp(drag.pitch + (event.clientY - drag.y) * 0.006, -1.15, 1.15));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
  };

  return <canvas
    ref={canvasRef}
    className="carton-engine-canvas"
    aria-label="Interactive WebGL reverse-tuck carton"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { dragRef.current = null; }}
    onWheel={onWheel}
  />;
});

type Scene = {
  dimensions: CartonDimensions;
  opening: number;
  material: string;
  artworkUrl: string | null;
  yaw: number;
  pitch: number;
  zoom: number;
  lightIntensity: number;
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

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  uploadPlaceholderTexture(gl);

  let scene: Scene = {
    dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 },
    opening: 18,
    material: 'Soft touch',
    artworkUrl: null,
    yaw: -0.55,
    pitch: 0.28,
    zoom: 82,
    lightIntensity: 0.78,
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
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);

    for (const mesh of meshes) {
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.uniformMatrix4fv(modelLocation, false, mesh.model ?? identity4());
      gl.uniform3fv(colorLocation, mesh.color);
      gl.uniform1i(useTextureLocation, mesh.useTexture && !!scene.artworkUrl ? 1 : 0);
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

  const setArtwork = (url: string | null) => {
    const token = ++artworkToken;
    if (!url) {
      uploadPlaceholderTexture(gl);
      render();
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (token !== artworkToken) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      render();
    };
    image.onerror = () => {
      if (token !== artworkToken) return;
      uploadPlaceholderTexture(gl);
      render();
    };
    image.src = url;
  };

  return {
    setScene(next: Scene) {
      const artworkChanged = next.artworkUrl !== scene.artworkUrl;
      scene = next;
      if (artworkChanged) setArtwork(next.artworkUrl);
      else render();
    },
    render,
    resize() {
      resize();
      render();
    },
    dispose() {
      ++artworkToken;
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}

function buildMeshes(dimensions: CartonDimensions, opening: number, color: [number, number, number]): Mesh[] {
  const { width: w, height: h, depth: d } = dimensions;
  const x0 = -w / 2, x1 = w / 2;
  const y0 = -h / 2, y1 = h / 2;
  const z0 = -d / 2, z1 = d / 2;
  const darker: [number, number, number] = color.map(v => v * 0.86) as [number, number, number];
  const lighter: [number, number, number] = color.map(v => Math.min(1, v * 1.08)) as [number, number, number];

  const front = quad(
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
    [0,0,1], color, true,
  );
  const back = quad(
    [x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],
    [0,0,-1], darker,
  );
  const left = quad(
    [x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],
    [-1,0,0], darker,
  );
  const right = quad(
    [x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],
    [1,0,0], color,
  );
  const bottom = quad(
    [x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],
    [0,-1,0], darker,
  );

  const flap = quad(
    [x0,0,0],[x0,0,d],[x1,0,d],[x1,0,0],
    [0,1,0], lighter,
  );
  flap.model = multiply4(
    translation4(0, y1, z0),
    rotationX4(-(clamp(opening, 0, 100) / 100) * Math.PI * 0.72),
  );

  return [front, back, left, right, bottom, flap];
}

function quad(
  a: number[], b: number[], c: number[], d: number[],
  normal: [number, number, number],
  color: [number, number, number],
  useTexture = false,
): Mesh {
  const vertices = [
    ...vertex(a, normal, [0,0]), ...vertex(b, normal, [1,0]), ...vertex(c, normal, [1,1]),
    ...vertex(a, normal, [0,0]), ...vertex(c, normal, [1,1]), ...vertex(d, normal, [0,1]),
  ];
  return { vertices: new Float32Array(vertices), useTexture, color };
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
void main() {
  vec3 normal = normalize(vNormal);
  float diffuse = max(0.0, dot(normal, normalize(uLightDirection)));
  float light = 0.52 + diffuse * 0.48 * uLightIntensity;
  vec4 base = uUseTexture ? texture2D(uTexture, vUv) : vec4(uColor, 1.0);
  gl_FragColor = vec4(base.rgb * light, base.a);
}
`;

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

function normalize3(v: number[]) {
  const length = Math.hypot(v[0],v[1],v[2]) || 1;
  return [v[0]/length,v[1]/length,v[2]/length];
}
function cross3(a:number[],b:number[]) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot3(a:number[],b:number[]) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function clamp(value:number,min:number,max:number){ return Math.min(max,Math.max(min,value)); }
