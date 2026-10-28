import React, { useState } from 'react';
import { ShaderCanvas } from '@shaderbit/react';
import { listComponents, getComponent } from '@shaderbit/registry';

export const App: React.FC = () => {
  const components = listComponents();
  const [selectedId, setSelectedId] = useState<string>(components[0]?.id || 'liquid-chrome');
  const [driver, setDriver] = useState<'auto' | 'webgpu' | 'webgl2' | 'canvas2d'>('auto');
  const [worker, setWorker] = useState<boolean>(false);

  const activeComponent = getComponent(selectedId) || components[0];

  return React.createElement(
    'div',
    { style: { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' } },
    React.createElement(
      'header',
      { style: { padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('h1', { style: { margin: 0, fontSize: '1.25rem', fontWeight: 600 } }, 'ShaderBit Playground'),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '16px' } },
        React.createElement(
          'select',
          { value: selectedId, onChange: (e: any) => setSelectedId(e.target.value), style: { padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' } },
          components.map(c => React.createElement('option', { key: c.id, value: c.id }, c.name))
        ),
        React.createElement(
          'select',
          { value: driver, onChange: (e: any) => setDriver(e.target.value), style: { padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' } },
          React.createElement('option', { value: 'auto' }, 'Driver: Auto'),
          React.createElement('option', { value: 'webgpu' }, 'Driver: WebGPU'),
          React.createElement('option', { value: 'webgl2' }, 'Driver: WebGL2'),
          React.createElement('option', { value: 'canvas2d' }, 'Driver: Canvas2D Fallback')
        ),
        React.createElement(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement('input', { type: 'checkbox', checked: worker, onChange: (e: any) => setWorker(e.target.checked) }),
          'Worker Mode'
        )
      )
    ),
    React.createElement(
      'main',
      { style: { flex: 1, position: 'relative' } },
      activeComponent && React.createElement(ShaderCanvas, {
        glsl: activeComponent.glsl,
        wgsl: activeComponent.wgsl,
        driver,
        worker,
        autoResize: true,
        style: { width: '100%', height: '100%' }
      })
    )
  );
};
