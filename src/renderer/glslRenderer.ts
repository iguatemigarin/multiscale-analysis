import type { TreeNode } from '../analysis/computeHierarchicalAverages';
import vertexShaderSource from './shaders/vertex.glsl?raw';
import fragmentShaderSource from './shaders/fragment.glsl?raw';

declare const viewMode: { value: string };
declare const visualScaleGrading: { value: string };
declare const intensityMultiplier: { value: string };
declare const clamp: { value: string };

function createCubeGeometry(): { positions: Float32Array; normals: Float32Array; indices: Uint16Array } {
  const positions = new Float32Array([
    // Front
    0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
    // Back
    1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0,
    // Top
    0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0,
    // Bottom
    0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
    // Right
    1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1,
    // Left
    0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,       // Front
    4, 5, 6, 4, 6, 7,       // Back
    8, 9, 10, 8, 10, 11,    // Top
    12, 13, 14, 12, 14, 15, // Bottom
    16, 17, 18, 16, 18, 19, // Right
    20, 21, 22, 20, 22, 23, // Left
  ]);

  return { positions, normals, indices };
}

function perspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function lookAtMatrix(eye: number[], target: number[], up: number[]): Float32Array {
  const zAxis = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
  ]);
}

function normalize(v: number[]): number[] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export class GLSLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private rectBuffer: WebGLBuffer;
  private intensityBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;

  private uProjection: WebGLUniformLocation;
  private uView: WebGLUniformLocation;
  private uResolution: WebGLUniformLocation;
  private uViewMode: WebGLUniformLocation;
  private uColorMode: WebGLUniformLocation;
  private uIntensityMultiplier: WebGLUniformLocation;
  private uClamp: WebGLUniformLocation;
  private uLightDir: WebGLUniformLocation;
  private uBaseZ: WebGLUniformLocation;

  private maxInstances = 16384;
  private rectData: Float32Array;
  private intensityData: Float32Array;
  private indexCount: number;

  // Orbit control
  private rotationX = -0.5;
  private rotationY = 0.3;
  private distance = 1600;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, depth: true });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    this.program = this.createProgram();
    gl.useProgram(this.program);

    this.uProjection = gl.getUniformLocation(this.program, 'u_projection')!;
    this.uView = gl.getUniformLocation(this.program, 'u_view')!;
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!;
    this.uViewMode = gl.getUniformLocation(this.program, 'u_viewMode')!;
    this.uColorMode = gl.getUniformLocation(this.program, 'u_colorMode')!;
    this.uIntensityMultiplier = gl.getUniformLocation(this.program, 'u_intensityMultiplier')!;
    this.uClamp = gl.getUniformLocation(this.program, 'u_clamp')!;
    this.uLightDir = gl.getUniformLocation(this.program, 'u_lightDir')!;
    this.uBaseZ = gl.getUniformLocation(this.program, 'u_baseZ')!;

    const cube = createCubeGeometry();
    this.indexCount = cube.indices.length;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Cube positions
    const posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cube.positions, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

    // Cube normals
    const normalBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cube.normals, gl.STATIC_DRAW);
    const aNormal = gl.getAttribLocation(this.program, 'a_normal');
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

    // Index buffer
    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);

    // Instance rect data (x, y, w, h)
    this.rectBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * 16, gl.DYNAMIC_DRAW);
    const aRect = gl.getAttribLocation(this.program, 'a_instanceRect');
    gl.enableVertexAttribArray(aRect);
    gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aRect, 1);

    // Instance intensity data (intensity, parentIntensity)
    this.intensityBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * 8, gl.DYNAMIC_DRAW);
    const aIntensity = gl.getAttribLocation(this.program, 'a_instanceIntensity');
    gl.enableVertexAttribArray(aIntensity);
    gl.vertexAttribPointer(aIntensity, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aIntensity, 1);

    gl.bindVertexArray(null);

    this.rectData = new Float32Array(this.maxInstances * 4);
    this.intensityData = new Float32Array(this.maxInstances * 2);

    this.setupControls();
  }

  private setupControls(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.rotationY += dx * 0.005;
      this.rotationX += dy * 0.005;
      this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance += e.deltaY * 0.5;
      this.distance = Math.max(100, Math.min(3000, this.distance));
    }, { passive: false });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.rotationY += dx * 0.005;
      this.rotationX += dy * 0.005;
      this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    });
  }

  private createProgram(): WebGLProgram {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexShaderSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader: ' + gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader: ' + gl.getShaderInfoLog(fs));
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link: ' + gl.getProgramInfoLog(program));
    }

    return program;
  }

  render(node: TreeNode, arrayLength: number): void {
    const { gl, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const totalWidth = width * 2;
    const levels = Math.log2(arrayLength) + 1;
    const levelHeight = height / levels;

    let instanceCount = 0;

    const collectRects = (
      node: TreeNode,
      parentNode: TreeNode | null,
      x: number,
      y: number
    ) => {
      if (instanceCount >= this.maxInstances) return;

      const segmentWidth = (totalWidth * node.size) / arrayLength;

      const idx = instanceCount * 4;
      this.rectData[idx] = x;
      this.rectData[idx + 1] = y;
      this.rectData[idx + 2] = segmentWidth;
      this.rectData[idx + 3] = levelHeight;

      const iIdx = instanceCount * 2;
      this.intensityData[iIdx] = node.avg;
      this.intensityData[iIdx + 1] = parentNode ? parentNode.avg : node.avg;

      instanceCount++;

      if (node.children) {
        node.children.forEach((child, i) => {
          collectRects(child, node, x + (i * segmentWidth) / 2, y - levelHeight);
        });
      }
    };

    collectRects(node, null, 0, height - levelHeight);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Camera
    const aspect = width / height;
    const projection = perspectiveMatrix(Math.PI / 4, aspect, 1, 5000);

    const camX = Math.sin(this.rotationY) * Math.cos(this.rotationX) * this.distance;
    const camY = Math.sin(this.rotationX) * this.distance;
    const camZ = Math.cos(this.rotationY) * Math.cos(this.rotationX) * this.distance;

    const view = lookAtMatrix([camX, camY, camZ], [this.panX, this.panY, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(this.uProjection, false, projection);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform2f(this.uResolution, totalWidth, height);
    gl.uniform1i(this.uViewMode, viewMode.value === 'parentAvg' ? 1 : 0);
    gl.uniform1i(this.uColorMode, visualScaleGrading.value === 'mono' ? 0 : 1);
    gl.uniform1f(this.uIntensityMultiplier, Number(intensityMultiplier.value));
    gl.uniform1f(this.uClamp, Number(clamp.value));
    gl.uniform3f(this.uLightDir, 0.5, 1.0, 0.8);
    gl.uniform1f(this.uBaseZ, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.rectData.subarray(0, instanceCount * 4));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.intensityData.subarray(0, instanceCount * 2));

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, instanceCount);

    gl.bindVertexArray(null);
  }

  resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
