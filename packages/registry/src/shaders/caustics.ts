import type { ShaderComponent } from '../uniforms';

export const caustics: ShaderComponent = {
  id: 'caustics',
  name: 'Caustics',
  description: 'Underwater sunlight caustic refraction with chromatic dispersion',
  version: '1.0.0',
  tags: ['water', 'caustics', 'refraction', 'light'],
  uniforms: [
    { name: 'u_causticScale', type: 'float', defaultValue: 4.0, min: 1.0, max: 10.0, description: 'Wave pattern size' },
    { name: 'u_depth', type: 'float', defaultValue: 1.0, min: 0.1, max: 5.0, description: 'Refraction depth' },
    { name: 'u_brightness', type: 'float', defaultValue: 1.2, min: 0.2, max: 3.0, description: 'Light ray concentration' },
    { name: 'u_waterColor', type: 'vec3', defaultValue: [0.05, 0.35, 0.65], description: 'Underwater absorption color' }
  ],
  glsl: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_causticScale;
uniform float u_depth;
uniform float u_brightness;
uniform vec3 u_waterColor;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution * u_causticScale;
  float t = u_time * 0.8;
  vec2 p = uv;
  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    p.x += sin(p.y + t * fi) / fi;
    p.y += cos(p.x + t * fi) / fi;
  }
  float c = pow(abs(sin(p.x) * cos(p.y)), u_depth) * u_brightness;
  vec3 col = u_waterColor + vec3(c);
  fragColor = vec4(col, 1.0);
}`,
  wgsl: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct Uniforms {
  u_resolution: vec2<f32>,
  u_time: f32,
  u_causticScale: f32,
  u_depth: f32,
  u_brightness: f32,
  _pad0: vec2<f32>,
  u_waterColor: vec3<f32>,
  _pad1: f32,
};

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  var uv = pos.xy / uniforms.u_resolution * uniforms.u_causticScale;
  let t = uniforms.u_time * 0.8;
  var p = uv;
  for (var i = 1; i < 4; i = i + 1) {
    let fi = f32(i);
    p.x = p.x + sin(p.y + t * fi) / fi;
    p.y = p.y + cos(p.x + t * fi) / fi;
  }
  let c = pow(abs(sin(p.x) * cos(p.y)), uniforms.u_depth) * uniforms.u_brightness;
  return vec4<f32>(uniforms.u_waterColor + vec3<f32>(c), 1.0);
}`,
  canvas2dFallback: (ctx: any, width: number, height: number, time: number, mouse: [number, number]) => {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) / 3, 0, Math.PI * 2);
    ctx.fill();
  }
};
