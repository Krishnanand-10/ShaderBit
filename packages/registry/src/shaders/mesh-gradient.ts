import type { ShaderComponent } from '../uniforms';

export const meshGradient: ShaderComponent = {
  id: 'mesh-gradient',
  name: 'Mesh Gradient',
  description: 'Multi-point smooth animated mesh color gradient blending',
  version: '1.0.0',
  tags: ['gradient', 'mesh', 'colors', 'background'],
  uniforms: [
    { name: 'u_speed', type: 'float', defaultValue: 0.5, min: 0.1, max: 3.0, description: 'Animation speed' },
    { name: 'u_waveAmplitude', type: 'float', defaultValue: 0.3, min: 0.0, max: 1.0, description: 'Wave distortion' },
    { name: 'u_color1', type: 'vec3', defaultValue: [0.93, 0.28, 0.6], description: 'Primary mesh color' },
    { name: 'u_color2', type: 'vec3', defaultValue: [0.38, 0.45, 0.95], description: 'Secondary mesh color' },
    { name: 'u_color3', type: 'vec3', defaultValue: [0.24, 0.86, 0.66], description: 'Tertiary mesh color' },
    { name: 'u_color4', type: 'vec3', defaultValue: [0.98, 0.74, 0.23], description: 'Quaternary mesh color' }
  ],
  glsl: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_waveAmplitude;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed;
  uv.x += sin(uv.y * 3.0 + t) * u_waveAmplitude;
  uv.y += cos(uv.x * 3.0 + t) * u_waveAmplitude;
  vec3 top = mix(u_color1, u_color2, uv.x);
  vec3 bottom = mix(u_color3, u_color4, uv.x);
  vec3 col = mix(top, bottom, uv.y);
  fragColor = vec4(col, 1.0);
}`,
  wgsl: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct Uniforms {
  u_resolution: vec2<f32>,
  u_time: f32,
  u_speed: f32,
  u_waveAmplitude: f32,
  _pad0: f32,
  _pad1: vec2<f32>,
  u_color1: vec3<f32>,
  _pad2: f32,
  u_color2: vec3<f32>,
  _pad3: f32,
  u_color3: vec3<f32>,
  _pad4: f32,
  u_color4: vec3<f32>,
  _pad5: f32,
};

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  var uv = pos.xy / uniforms.u_resolution;
  let t = uniforms.u_time * uniforms.u_speed;
  uv.x = uv.x + sin(uv.y * 3.0 + t) * uniforms.u_waveAmplitude;
  uv.y = uv.y + cos(uv.x * 3.0 + t) * uniforms.u_waveAmplitude;
  let top = mix(uniforms.u_color1, uniforms.u_color2, uv.x);
  let bottom = mix(uniforms.u_color3, uniforms.u_color4, uv.x);
  return vec4<f32>(mix(top, bottom, uv.y), 1.0);
}`,
  canvas2dFallback: (ctx: any, width: number, height: number, time: number, mouse: [number, number]) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(0.5, '#6366f1');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};
