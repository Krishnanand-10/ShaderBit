import React, { useState, useEffect, useMemo } from 'react';
import { ShaderCanvas } from '@shaderbit/react';
import { listComponents, getComponent, type ShaderUniformDefinition } from '@shaderbit/registry';

function rgbToHex(rgb: number[]): string {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#ffffff';
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * 255))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * 255))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * 255))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [1, 1, 1];
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

export const App: React.FC = () => {
  const components = useMemo(() => listComponents(), []);
  const [selectedId, setSelectedId] = useState<string>(components[0]?.id || 'liquid-chrome');
  const [driver, setDriver] = useState<'auto' | 'webgpu' | 'webgl2' | 'canvas2d'>('auto');
  const [worker, setWorker] = useState<boolean>(false);
  const [activeDriverName, setActiveDriverName] = useState<string>('Initializing...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeComponent = useMemo(
    () => getComponent(selectedId) || components[0],
    [selectedId, components]
  );

  // Initialize and hold current uniform values
  const [uniformValues, setUniformValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    if (activeComponent?.uniforms) {
      for (const u of activeComponent.uniforms) {
        initial[u.name] = u.defaultValue;
      }
    }
    return initial;
  });

  // Re-sync default uniforms when selected effect changes
  useEffect(() => {
    setErrorMsg(null);
    if (activeComponent?.uniforms) {
      const defaults: Record<string, any> = {};
      for (const u of activeComponent.uniforms) {
        defaults[u.name] = u.defaultValue;
      }
      setUniformValues(defaults);
    }
  }, [selectedId, activeComponent]);

  const handleUniformChange = (name: string, value: any) => {
    setUniformValues((prev) => ({ ...prev, [name]: value }));
  };

  return React.createElement(
    'div',
    {
      style: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        userSelect: 'none'
      }
    },
    // Top Bar
    React.createElement(
      'header',
      {
        style: {
          padding: '12px 24px',
          background: 'rgba(15, 15, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        React.createElement(
          'span',
          {
            style: {
              background: 'linear-gradient(135deg, #a855f7, #6366f1, #38bdf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.02em'
            }
          },
          'ShaderBit'
        ),
        React.createElement(
          'span',
          {
            style: {
              background: '#1a1a24',
              color: '#818cf8',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid #312e81'
            }
          },
          activeDriverName.toUpperCase()
        )
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        React.createElement(
          'select',
          {
            value: selectedId,
            onChange: (e: any) => setSelectedId(e.target.value),
            style: {
              padding: '8px 12px',
              background: '#141417',
              color: '#fff',
              border: '1px solid #2d2d38',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }
          },
          components.map((c) =>
            React.createElement('option', { key: c.id, value: c.id }, c.name)
          )
        ),
        React.createElement(
          'select',
          {
            value: driver,
            onChange: (e: any) => setDriver(e.target.value),
            style: {
              padding: '8px 12px',
              background: '#141417',
              color: '#fff',
              border: '1px solid #2d2d38',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }
          },
          React.createElement('option', { value: 'auto' }, 'Driver: Auto'),
          React.createElement('option', { value: 'webgpu' }, 'Driver: WebGPU'),
          React.createElement('option', { value: 'webgl2' }, 'Driver: WebGL2'),
          React.createElement('option', { value: 'canvas2d' }, 'Driver: Canvas2D Fallback')
        ),
        React.createElement(
          'label',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: '#94a3b8'
            }
          },
          React.createElement('input', {
            type: 'checkbox',
            checked: worker,
            onChange: (e: any) => setWorker(e.target.checked)
          }),
          'Offscreen Worker'
        )
      )
    ),

    // Canvas Canvas Viewport Container
    React.createElement(
      'main',
      { style: { flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' } },
      errorMsg &&
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#ef4444',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              zIndex: 30,
              fontSize: '0.875rem'
            }
          },
          `Error: ${errorMsg}`
        ),
      activeComponent &&
        React.createElement(ShaderCanvas, {
          key: `${selectedId}-${driver}-${worker}`,
          component: activeComponent,
          glsl: activeComponent.glsl,
          wgsl: activeComponent.wgsl,
          canvas2dFallback: activeComponent.canvas2dFallback,
          uniforms: uniformValues,
          driver,
          worker,
          autoResize: true,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'block'
          },
          onInit: (pipeline) => {
            setActiveDriverName(pipeline.getActiveDriver());
          },
          onError: (err) => {
            setErrorMsg(err.message);
          }
        }),

      // Floating Uniforms Parameter Controls
      activeComponent?.uniforms &&
        activeComponent.uniforms.length > 0 &&
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              width: '280px',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              background: 'rgba(15, 15, 20, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              zIndex: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }
          },
          React.createElement(
            'div',
            {
              style: {
                fontWeight: 600,
                fontSize: '0.875rem',
                marginBottom: '12px',
                color: '#e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }
            },
            React.createElement('span', null, 'Uniform Controls'),
            React.createElement(
              'span',
              { style: { fontSize: '0.75rem', color: '#94a3b8' } },
              activeComponent.name
            )
          ),
          activeComponent.uniforms.map((u: ShaderUniformDefinition) => {
            const val = uniformValues[u.name] ?? u.defaultValue;
            const isVec3Color = u.type === 'vec3' && u.name.toLowerCase().includes('color');
            const isFloat = u.type === 'float';

            return React.createElement(
              'div',
              { key: u.name, style: { marginBottom: '12px' } },
              React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    marginBottom: '4px',
                    color: '#94a3b8'
                  }
                },
                React.createElement('span', null, u.description || u.name),
                React.createElement(
                  'span',
                  { style: { fontFamily: 'monospace', color: '#cbd5e1' } },
                  isFloat ? Number(val).toFixed(2) : isVec3Color ? rgbToHex(val) : ''
                )
              ),
              isFloat &&
                React.createElement('input', {
                  type: 'range',
                  min: u.min ?? 0.0,
                  max: u.max ?? 5.0,
                  step: ((u.max ?? 5.0) - (u.min ?? 0.0)) / 100,
                  value: Number(val),
                  onChange: (e: any) =>
                    handleUniformChange(u.name, parseFloat(e.target.value)),
                  style: { width: '100%', accentColor: '#818cf8', cursor: 'pointer' }
                }),
              isVec3Color &&
                React.createElement('input', {
                  type: 'color',
                  value: rgbToHex(val),
                  onChange: (e: any) =>
                    handleUniformChange(u.name, hexToRgb(e.target.value)),
                  style: {
                    width: '100%',
                    height: '28px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: 'transparent'
                  }
                })
            );
          })
        ),

      // Interactive mouse cursor badge
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            background: 'rgba(15, 15, 20, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            padding: '8px 16px',
            fontSize: '0.75rem',
            color: '#94a3b8',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        },
        React.createElement('span', {
          style: {
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block'
          }
        }),
        'Move mouse or drag over viewport to interact'
      )
    )
  );
};
