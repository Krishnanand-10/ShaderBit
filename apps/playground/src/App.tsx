import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShaderCanvas } from '@shaderbit/react';
import type { ShaderPipeline } from '@shaderbit/core';
import {
  listComponents,
  getComponent,
  type UniformDescriptor,
  type ShaderComponent
} from '@shaderbit/registry';

// Helper: Convert [0..1] RGB array to Hex string
function rgbToHex(rgb: number[]): string {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#ffffff';
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * 255))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * 255))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * 255))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Helper: Convert Hex string to [0..1] RGB tuple
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [1, 1, 1];
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

type DriverMode = 'auto' | 'webgpu' | 'webgl2' | 'canvas2d';

interface ViewportDimensions {
  width: number;
  height: number;
  dpr: number;
}

export const App: React.FC = () => {
  const components = useMemo<ShaderComponent[]>(() => listComponents(), []);
  const [selectedId, setSelectedId] = useState<string>(components[0]?.id || 'liquid-chrome');
  const [driver, setDriver] = useState<DriverMode>('auto');
  const [worker, setWorker] = useState<boolean>(false);
  const [activeDriverName, setActiveDriverName] = useState<string>('Initializing...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  });

  const activeComponent = useMemo<ShaderComponent | undefined>(
    () => getComponent(selectedId) || components[0],
    [selectedId, components]
  );

  // Compute default uniform values for a component
  const getDefaultUniforms = useCallback((comp?: ShaderComponent): Record<string, any> => {
    const defaults: Record<string, any> = {};
    if (comp?.uniforms) {
      for (const u of comp.uniforms) {
        defaults[u.name] = u.defaultValue;
      }
    }
    return defaults;
  }, []);

  // Initialize and hold current uniform values
  const [uniformValues, setUniformValues] = useState<Record<string, any>>(() =>
    getDefaultUniforms(activeComponent)
  );

  // Re-sync uniform values when active component changes
  useEffect(() => {
    setErrorMsg(null);
    setUniformValues(getDefaultUniforms(activeComponent));
  }, [activeComponent, getDefaultUniforms]);

  // Live FPS measurement loop
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 500) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Canvas viewport dimensions tracker
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUniformChange = (name: string, value: any) => {
    setUniformValues((prev: Record<string, any>) => ({ ...prev, [name]: value }));
  };

  const handleResetUniforms = () => {
    setUniformValues(getDefaultUniforms(activeComponent));
  };

  // FPS status color
  const fpsColor = fps >= 50 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444';

  return React.createElement(
    'div',
    {
      style: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#070709',
        color: '#f8fafc',
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        userSelect: 'none'
      }
    },
    // Top Navigation Bar
    React.createElement(
      'header',
      {
        style: {
          padding: '12px 24px',
          background: 'rgba(11, 11, 15, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          zIndex: 40,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
        }
      },
      // Left: Logo & HUD Stats
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement(
            'span',
            {
              style: {
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '1.35rem',
                fontWeight: 900,
                letterSpacing: '-0.03em'
              }
            },
            'ShaderBit'
          ),
          React.createElement(
            'span',
            {
              style: {
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }
            },
            'PLAYGROUND'
          )
        ),
        // Live HUD Metrics (Active Driver, FPS, Canvas Dimensions)
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace'
            }
          },
          // Active Driver badge
          React.createElement(
            'span',
            {
              style: {
                color: activeDriverName.toLowerCase().includes('gpu')
                  ? '#38bdf8'
                  : activeDriverName.toLowerCase().includes('gl')
                  ? '#818cf8'
                  : '#f59e0b',
                fontWeight: 600
              }
            },
            `[${activeDriverName.toUpperCase()}]`
          ),
          React.createElement('span', { style: { color: 'rgba(255, 255, 255, 0.2)' } }, '|'),
          // Live FPS
          React.createElement(
            'span',
            { style: { color: fpsColor, fontWeight: 700 } },
            `${fps} FPS`
          ),
          React.createElement('span', { style: { color: 'rgba(255, 255, 255, 0.2)' } }, '|'),
          // Viewport Dimensions
          React.createElement(
            'span',
            { style: { color: '#94a3b8' } },
            `${dimensions.width}×${dimensions.height} @${dimensions.dpr.toFixed(1)}x`
          )
        )
      ),

      // Center: Starter Shader Switching Buttons
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }
        },
        components.map((c: ShaderComponent) => {
          const isSelected = c.id === selectedId;
          return React.createElement(
            'button',
            {
              key: c.id,
              onClick: () => setSelectedId(c.id),
              style: {
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9))'
                  : 'transparent',
                color: isSelected ? '#ffffff' : '#94a3b8',
                fontSize: '0.8125rem',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none'
              }
            },
            c.name
          );
        })
      ),

      // Right: Driver & Mode Controls
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
        // Driver selector
        React.createElement(
          'select',
          {
            value: driver,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setDriver(e.target.value as DriverMode),
            style: {
              padding: '7px 12px',
              background: '#13131a',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none'
            }
          },
          React.createElement('option', { value: 'auto' }, 'Driver: Auto'),
          React.createElement('option', { value: 'webgpu' }, 'Driver: WebGPU'),
          React.createElement('option', { value: 'webgl2' }, 'Driver: WebGL2'),
          React.createElement('option', { value: 'canvas2d' }, 'Driver: Canvas2D Fallback')
        ),
        // Worker Toggle
        React.createElement(
          'label',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              color: worker ? '#38bdf8' : '#94a3b8',
              padding: '6px 10px',
              borderRadius: '8px',
              background: worker ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${worker ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              transition: 'all 0.15s ease'
            }
          },
          React.createElement('input', {
            type: 'checkbox',
            checked: worker,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setWorker(e.target.checked),
            style: { cursor: 'pointer', accentColor: '#38bdf8' }
          }),
          'Worker'
        ),
        // Toggle Controls Panel Button
        React.createElement(
          'button',
          {
            onClick: () => setShowControls((prev: boolean) => !prev),
            title: 'Toggle Uniforms Panel',
            style: {
              padding: '7px 12px',
              background: showControls ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: showControls ? '#c7d2fe' : '#94a3b8',
              border: `1px solid ${showControls ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer'
            }
          },
          showControls ? 'Hide Controls' : 'Show Controls'
        )
      )
    ),

    // Main Canvas Viewport Area
    React.createElement(
      'main',
      {
        style: {
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#070709'
        }
      },
      // Error Toast if any
      errorMsg &&
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              zIndex: 50,
              fontSize: '0.875rem',
              fontWeight: 500,
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }
          },
          React.createElement('span', null, `Render Pipeline Warning: ${errorMsg}`)
        ),

      // ShaderCanvas Element
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
          onInit: (pipeline: ShaderPipeline) => {
            setActiveDriverName(pipeline.getActiveDriver());
          },
          onError: (err: Error) => {
            setErrorMsg(err.message);
          }
        }),

      // Floating Uniforms Parameter Controls Card
      showControls &&
        activeComponent?.uniforms &&
        activeComponent.uniforms.length > 0 &&
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              width: '320px',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              background: 'rgba(13, 13, 18, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              zIndex: 30,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
            }
          },
          // Header of panel
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }
            },
            React.createElement(
              'div',
              null,
              React.createElement(
                'div',
                { style: { fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' } },
                'Uniform Controls'
              ),
              React.createElement(
                'div',
                { style: { fontSize: '0.75rem', color: '#818cf8', marginTop: '2px' } },
                activeComponent.name
              )
            ),
            React.createElement(
              'button',
              {
                onClick: handleResetUniforms,
                title: 'Reset to default uniform values',
                style: {
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }
              },
              'Reset'
            )
          ),

          // Uniform inputs
          activeComponent.uniforms.map((u: UniformDescriptor) => {
            const val = uniformValues[u.name] ?? u.defaultValue;
            const isVec3Color =
              u.type === 'vec3' &&
              (u.name.toLowerCase().includes('color') ||
                u.name.toLowerCase().includes('tint') ||
                u.name.toLowerCase().includes('light'));
            const isFloat = u.type === 'float';
            const isVec2 = u.type === 'vec2';

            return React.createElement(
              'div',
              {
                key: u.name,
                style: {
                  marginBottom: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }
              },
              React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    marginBottom: '8px'
                  }
                },
                React.createElement(
                  'span',
                  {
                    style: { color: '#e2e8f0', fontWeight: 500 },
                    title: u.description || u.name
                  },
                  u.description || u.name
                ),
                React.createElement(
                  'span',
                  {
                    style: {
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.72rem',
                      color: '#a5b4fc',
                      background: 'rgba(99, 102, 241, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }
                  },
                  isFloat
                    ? Number(val).toFixed(2)
                    : isVec3Color
                    ? rgbToHex(val)
                    : isVec2 && Array.isArray(val)
                    ? `[${val[0].toFixed(1)}, ${val[1].toFixed(1)}]`
                    : String(val)
                )
              ),
              // Float Slider Control
              isFloat &&
                React.createElement('input', {
                  type: 'range',
                  min: u.min ?? 0.0,
                  max: u.max ?? 5.0,
                  step: u.step ?? ((u.max ?? 5.0) - (u.min ?? 0.0)) / 100,
                  value: Number(val),
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleUniformChange(u.name, parseFloat(e.target.value)),
                  style: {
                    width: '100%',
                    accentColor: '#6366f1',
                    cursor: 'pointer',
                    height: '4px'
                  }
                }),
              // Vec3 Color Control
              isVec3Color &&
                React.createElement(
                  'div',
                  { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                  React.createElement('input', {
                    type: 'color',
                    value: rgbToHex(val),
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleUniformChange(u.name, hexToRgb(e.target.value)),
                    style: {
                      flex: 1,
                      height: '32px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'transparent',
                      padding: '2px'
                    }
                  }),
                  React.createElement(
                    'span',
                    {
                      style: {
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.75rem',
                        color: '#94a3b8'
                      }
                    },
                    rgbToHex(val)
                  )
                )
            );
          })
        ),

      // Bottom-Left: Active Effect Information Badge
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            background: 'rgba(13, 13, 18, 0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '12px 18px',
            maxWidth: '380px',
            zIndex: 20,
            pointerEvents: 'none',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
          }
        },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
          React.createElement('span', {
            style: {
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'inline-block',
              boxShadow: '0 0 8px #22c55e'
            }
          }),
          React.createElement(
            'span',
            { style: { fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc' } },
            activeComponent?.name || 'ShaderBit Effect'
          ),
          React.createElement(
            'span',
            { style: { fontSize: '0.7rem', color: '#64748b' } },
            `v${activeComponent?.version || '1.0.0'}`
          )
        ),
        React.createElement(
          'p',
          {
            style: {
              margin: '0 0 8px 0',
              fontSize: '0.75rem',
              color: '#94a3b8',
              lineHeight: 1.4
            }
          },
          activeComponent?.description || 'Interactive GPU shader component'
        ),
        activeComponent?.tags &&
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
            activeComponent.tags.map((tag: string) =>
              React.createElement(
                'span',
                {
                  key: tag,
                  style: {
                    fontSize: '0.65rem',
                    color: '#818cf8',
                    background: 'rgba(129, 140, 248, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }
                },
                `#${tag}`
              )
            )
          )
      )
    )
  );
};
