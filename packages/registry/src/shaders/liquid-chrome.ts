import type { ShaderComponent } from '../uniforms';

export const liquidChrome: ShaderComponent = {
  id: 'liquid-chrome',
  name: 'Liquid Chrome',
  description: 'Iridescent metallic fluid ripple reflection effect with specular highlights',
  version: '1.0.0',
  tags: ['liquid', 'chrome', 'metallic', 'reflection'],
  uniforms: [
    { name: 'u_speed', type: 'float', defaultValue: 1.0, min: 0.1, max: 5.0, description: 'Flow speed multiplier' },
    { name: 'u_reflection', type: 'float', defaultValue: 0.8, min: 0.0, max: 1.0, description: 'Reflection sheen intensity' },
    { name: 'u_roughness', type: 'float', defaultValue: 0.2, min: 0.0, max: 1.0, description: 'Surface roughness' },
    { name: 'u_baseColor', type: 'vec3', defaultValue: [0.7, 0.75, 0.8], description: 'Base metallic tint' },
    { name: 'u_lightColor', type: 'vec3', defaultValue: [1.0, 0.95, 0.9], description: 'Specular light color' }
  ],
  glsl: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_speed;
uniform float u_reflection;
uniform float u_roughness;
uniform vec3 u_baseColor;
uniform vec3 u_lightColor;
out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * u_speed * 0.5;
  vec2 p = uv + (u_mouse - 0.5) * 0.2;
  float d = sin(p.x * 4.0 + t) + cos(p.y * 4.0 + t);
  float ripple = sin(length(p) * 8.0 - t * 2.0 + d);
  vec3 col = mix(u_baseColor, u_lightColor, smoothstep(-0.5, 0.8, ripple) * u_reflection);
  fragColor = vec4(col, 1.0);
}`,
  wgsl: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct Uniforms {
  u_resolution: vec2<f32>,
  u_time: f32,
  u_speed: f32,
  u_mouse: vec2<f32>,
  u_reflection: f32,
  u_roughness: f32,
  u_baseColor: vec3<f32>,
  _pad1: f32,
  u_lightColor: vec3<f32>,
  _pad2: f32,
};

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = (pos.xy * 2.0 - uniforms.u_resolution) / min(uniforms.u_resolution.x, uniforms.u_resolution.y);
  let t = uniforms.u_time * uniforms.u_speed * 0.5;
  let d = sin(uv.x * 4.0 + t) + cos(uv.y * 4.0 + t);
  let ripple = sin(length(uv) * 8.0 - t * 2.0 + d);
  let col = mix(uniforms.u_baseColor, uniforms.u_lightColor, clamp(ripple * uniforms.u_reflection, 0.0, 1.0));
  return vec4<f32>(col, 1.0);
}`,
  canvas2dFallback: (ctx: any, width: number, height: number, time: number, mouse: [number, number]) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#4a5568');
    grad.addColorStop(0.5, '#cbd5e1');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};
