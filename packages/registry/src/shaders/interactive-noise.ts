import type { ShaderComponent } from '../uniforms';

export const interactiveNoise: ShaderComponent = {
  id: 'interactive-noise',
  name: 'Interactive Noise',
  description: 'Generative simplex noise field reacting to pointer movement',
  version: '1.0.0',
  tags: ['noise', 'interactive', 'perlin', 'simplex'],
  uniforms: [
    { name: 'u_noiseScale', type: 'float', defaultValue: 3.0, min: 0.5, max: 10.0, description: 'Spatial noise frequency' },
    { name: 'u_frequency', type: 'float', defaultValue: 1.0, min: 0.1, max: 5.0, description: 'Animation speed' },
    { name: 'u_amplitude', type: 'float', defaultValue: 0.5, min: 0.0, max: 1.0, description: 'Turbulence magnitude' },
    { name: 'u_mouseRadius', type: 'float', defaultValue: 0.25, min: 0.05, max: 0.8, description: 'Pointer displacement radius' },
    { name: 'u_mouseIntensity', type: 'float', defaultValue: 1.5, min: 0.0, max: 5.0, description: 'Displacement push force' }
  ],
  glsl: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_noiseScale;
uniform float u_frequency;
uniform float u_amplitude;
uniform float u_mouseRadius;
uniform float u_mouseIntensity;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 m = u_mouse;
  float dist = length(uv - m);
  float push = smoothstep(u_mouseRadius, 0.0, dist) * u_mouseIntensity;
  uv += normalize(uv - m + 0.0001) * push * 0.1;
  float n = sin(uv.x * u_noiseScale + u_time * u_frequency) * cos(uv.y * u_noiseScale + u_time * u_frequency);
  vec3 col = vec3(0.5 + 0.5 * n * u_amplitude);
  fragColor = vec4(col, 1.0);
}`,
  wgsl: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct Uniforms {
  u_resolution: vec2<f32>,
  u_mouse: vec2<f32>,
  u_time: f32,
  u_noiseScale: f32,
  u_frequency: f32,
  u_amplitude: f32,
  u_mouseRadius: f32,
  u_mouseIntensity: f32,
  _pad: vec2<f32>,
};

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  var uv = pos.xy / uniforms.u_resolution;
  let dist = length(uv - uniforms.u_mouse);
  let push = clamp((uniforms.u_mouseRadius - dist) / uniforms.u_mouseRadius, 0.0, 1.0) * uniforms.u_mouseIntensity;
  uv = uv + normalize(uv - uniforms.u_mouse + 0.0001) * push * 0.1;
  let n = sin(uv.x * uniforms.u_noiseScale + uniforms.u_time * uniforms.u_frequency) * cos(uv.y * uniforms.u_noiseScale + uniforms.u_time * uniforms.u_frequency);
  let val = 0.5 + 0.5 * n * uniforms.u_amplitude;
  return vec4<f32>(val, val, val, 1.0);
}`,
  canvas2dFallback: (ctx: any, width: number, height: number, time: number, mouse: [number, number]) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();
    ctx.arc(mouse[0] * width, mouse[1] * height, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  }
};
