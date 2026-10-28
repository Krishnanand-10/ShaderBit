/**
 * Authoritative Starter Effect Definitions and Registry Catalog derived from PROJECT.md & ORIGINAL_REQUEST.md.
 * Used for opaque-box E2E testing across CLI, Core, Registry, and Adapters.
 */

export interface UniformDescriptor {
  name: string;
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface ShaderComponent {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  glsl: string;
  wgsl: string;
  canvas2dFallback?: (ctx: any, width: number, height: number, time: number, mouse: [number, number]) => void;
  uniforms: UniformDescriptor[];
  dependencies?: Record<string, string>;
}

export const STARTER_SHADERS: Record<string, ShaderComponent> = {
  'liquid-chrome': {
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
    canvas2dFallback: (ctx, width, height, time, mouse) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#4a5568');
      grad.addColorStop(0.5, '#cbd5e1');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  },

  'mesh-gradient': {
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
    canvas2dFallback: (ctx, width, height, time, mouse) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#ec4899');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  },

  'interactive-noise': {
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
    canvas2dFallback: (ctx, width, height, time, mouse) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(mouse[0] * width, mouse[1] * height, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }
  },

  'caustics': {
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
    canvas2dFallback: (ctx, width, height, time, mouse) => {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

export function validateShaderComponent(comp: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!comp || typeof comp !== 'object') {
    return { valid: false, errors: ['Component must be a non-null object'] };
  }
  if (!comp.id || typeof comp.id !== 'string') errors.push('Field "id" is required and must be a string');
  if (!comp.name || typeof comp.name !== 'string') errors.push('Field "name" is required and must be a string');
  if (!comp.glsl || typeof comp.glsl !== 'string') errors.push('Field "glsl" is required and must be a string');
  if (!comp.wgsl || typeof comp.wgsl !== 'string') errors.push('Field "wgsl" is required and must be a string');
  if (!Array.isArray(comp.uniforms)) {
    errors.push('Field "uniforms" must be an array of uniform descriptors');
  } else {
    for (const u of comp.uniforms) {
      if (!u.name) errors.push('Uniform missing name');
      if (!u.type || !['float', 'vec2', 'vec3', 'vec4', 'int'].includes(u.type)) {
        errors.push(`Uniform ${u.name} has invalid type ${u.type}`);
      }
      if (u.defaultValue === undefined) {
        errors.push(`Uniform ${u.name} missing defaultValue`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
