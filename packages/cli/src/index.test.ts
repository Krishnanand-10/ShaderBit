import { describe, it, expect } from 'vitest';
import {
  listAvailableShaders,
  createCli,
  initConfig,
  listCommand
} from './index';

describe('@shaderbit/cli', () => {
  it('lists available shaders from registry', () => {
    const list = listAvailableShaders();
    expect(list).toContain('liquid-chrome');
    expect(list).toContain('mesh-gradient');
    expect(list).toContain('interactive-noise');
    expect(list).toContain('caustics');
  });

  it('formats catalog in listCommand', () => {
    const textRes = listCommand();
    expect(textRes.output).toContain('liquid-chrome');

    const jsonRes = listCommand({ json: true });
    expect(JSON.parse(jsonRes.output)).toHaveLength(4);
  });

  it('creates commander CLI instance', () => {
    const cli = createCli();
    expect(cli.name()).toBe('shaderbit');
  });

  it('initializes config object', async () => {
    const config = await initConfig({ framework: 'react', driver: 'webgl2' });
    expect(config.framework).toBe('react');
    expect(config.driver).toBe('webgl2');
    expect(config.typescript).toBe(true);
  });
});
