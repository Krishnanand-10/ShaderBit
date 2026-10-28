/**
 * Standalone worker source script string.
 * Self-contained ES2020 JavaScript running directly inside DedicatedWorkerGlobalScope.
 */
export const INLINE_WORKER_SCRIPT = `
(function() {
  let canvas = null;
  let gl = null;
  let program = null;
  let vao = null;
  let buffer = null;
  let rafId = null;
  let isPaused = false;
  let startTime = 0;
  let pausedAt = 0;
  let pausedOffset = 0;
  let dpr = 1;
  let uniforms = {};
  let mouse = [0.5, 0.5];

  const vsSource = \`#version 300 es
    in vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }\`;

  const defaultFsSource = \`#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution;
      fragColor = vec4(st.x, st.y, sin(u_time) * 0.5 + 0.5, 1.0);
    }\`;

  function initGL(glsl) {
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    gl = canvas.getContext('webgl2');
    if (!gl) return false;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, glsl || defaultFsSource);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(fs);
      self.postMessage({ type: 'ERROR', message: err || 'Shader compile failed' });
      return false;
    }

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(program);
      self.postMessage({ type: 'ERROR', message: err || 'Program link failed' });
      return false;
    }

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    return true;
  }

  function applyUniform(name, val) {
    if (!gl || !program) return;
    const loc = gl.getUniformLocation(program, name);
    if (!loc) return;
    const value = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
    if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
      else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
      else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
    }
  }

  function render(timestamp) {
    if (isPaused) return;
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime - pausedOffset) * 0.001;

    if (gl && program && vao) {
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      applyUniform('u_time', elapsed);
      applyUniform('u_resolution', [canvas.width, canvas.height]);
      applyUniform('u_dpr', dpr);
      applyUniform('u_mouse', mouse);

      for (const [k, v] of Object.entries(uniforms)) {
        applyUniform(k, v);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(render);
    }
  }

  self.onmessage = function(e) {
    const data = e.data;
    if (!data) return;
    const type = (data.type || '').toUpperCase();

    switch (type) {
      case 'INIT':
        canvas = data.canvas;
        dpr = data.dpr || 1;
        if (data.width && data.height) {
          canvas.width = Math.floor(data.width * dpr);
          canvas.height = Math.floor(data.height * dpr);
        }
        if (data.uniforms) {
          uniforms = { ...data.uniforms };
        }
        const ok = initGL(data.glsl);
        if (ok) {
          self.postMessage({ type: 'INIT_ACK', success: true, driver: 'webgl2' });
          self.postMessage({ type: 'READY', driver: 'webgl2' });
          if (typeof requestAnimationFrame !== 'undefined') {
            rafId = requestAnimationFrame(render);
          }
        } else {
          self.postMessage({ type: 'ERROR', message: 'Failed to init WebGL2 in worker' });
        }
        break;

      case 'RESIZE':
        if (canvas) {
          dpr = data.dpr || dpr;
          canvas.width = Math.floor(data.width * dpr);
          canvas.height = Math.floor(data.height * dpr);
          if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
        }
        break;

      case 'UNIFORM_UPDATE':
        uniforms[data.name] = data.value;
        break;

      case 'SET_UNIFORMS':
      case 'UNIFORMS':
        if (data.uniforms) {
          Object.assign(uniforms, data.uniforms);
        }
        break;

      case 'POINTER_MOVE':
        mouse = [data.x, data.y];
        break;

      case 'TIME':
        if (typeof data.time === 'number') {
          pausedOffset = (performance.now() - startTime) - (data.time * 1000);
        }
        break;

      case 'PAUSE':
        if (!isPaused) {
          isPaused = true;
          pausedAt = performance.now();
          if (rafId && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(rafId);
          }
        }
        break;

      case 'RESUME':
        if (isPaused) {
          isPaused = false;
          if (pausedAt) {
            pausedOffset += (performance.now() - pausedAt);
          }
          if (typeof requestAnimationFrame !== 'undefined') {
            rafId = requestAnimationFrame(render);
          }
        }
        break;

      case 'VISIBILITY':
      case 'SET_VISIBILITY':
        if (data.visible) {
          if (isPaused) {
            isPaused = false;
            if (pausedAt) pausedOffset += (performance.now() - pausedAt);
            if (typeof requestAnimationFrame !== 'undefined') {
              rafId = requestAnimationFrame(render);
            }
          }
        } else {
          if (!isPaused) {
            isPaused = true;
            pausedAt = performance.now();
            if (rafId && typeof cancelAnimationFrame !== 'undefined') {
              cancelAnimationFrame(rafId);
            }
          }
        }
        break;

      case 'DESTROY':
        if (rafId && typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(rafId);
        }
        if (gl) {
          if (buffer) gl.deleteBuffer(buffer);
          if (vao) gl.deleteVertexArray(vao);
          if (program) gl.deleteProgram(program);
        }
        if (typeof self.close === 'function') {
          self.close();
        }
        break;
    }
  };
})();
`;
