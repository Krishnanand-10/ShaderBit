import type { ShaderComponent } from './uniforms';
import { validateComponent } from './schema';
import { liquidChrome } from './shaders/liquid-chrome';
import { meshGradient } from './shaders/mesh-gradient';
import { interactiveNoise } from './shaders/interactive-noise';
import { caustics } from './shaders/caustics';

export const STARTER_SHADERS: Record<string, ShaderComponent> = {
  'liquid-chrome': liquidChrome,
  'mesh-gradient': meshGradient,
  'interactive-noise': interactiveNoise,
  'caustics': caustics
};

export const CATALOG: ShaderComponent[] = [
  liquidChrome,
  meshGradient,
  interactiveNoise,
  caustics
];

const registry: Map<string, ShaderComponent> = new Map(
  CATALOG.map((comp) => [comp.id, comp])
);

export function registerComponent(component: ShaderComponent): void {
  validateComponent(component);
  registry.set(component.id, component);
}

export function unregisterComponent(id: string): boolean {
  return registry.delete(id);
}

export function getComponent(id: string): ShaderComponent | undefined {
  return registry.get(id);
}

export function hasComponent(id: string): boolean {
  return registry.has(id);
}

export function listComponents(): ShaderComponent[] {
  return Array.from(registry.values());
}

export function getComponentsByTag(tag: string): ShaderComponent[] {
  const normalized = tag.trim().toLowerCase();
  return listComponents().filter((comp) =>
    comp.tags.some((t) => t.toLowerCase() === normalized)
  );
}

export function filterByTag(tag: string): ShaderComponent[] {
  const normalized = tag.trim().toLowerCase();
  return listComponents().filter((comp) =>
    comp.tags.some((t) => t.toLowerCase().includes(normalized))
  );
}

export function searchComponents(query: string): ShaderComponent[] {
  if (!query || !query.trim()) {
    return listComponents();
  }
  const q = query.trim().toLowerCase();
  return listComponents().filter((comp) => {
    const matchId = comp.id.toLowerCase().includes(q);
    const matchName = comp.name.toLowerCase().includes(q);
    const matchDesc = comp.description ? comp.description.toLowerCase().includes(q) : false;
    const matchTags = comp.tags.some((t) => t.toLowerCase().includes(q));
    return matchId || matchName || matchDesc || matchTags;
  });
}

export function resetRegistry(): void {
  registry.clear();
  for (const comp of CATALOG) {
    registry.set(comp.id, comp);
  }
}

export function clearRegistry(): void {
  registry.clear();
}

// Effect aliases for backward / test harness compatibility
export const getEffect = getComponent;
export const hasEffect = hasComponent;
export const listEffects = listComponents;

export class ShaderRegistryCatalog {
  getEffect(id: string): ShaderComponent | undefined {
    return getComponent(id);
  }

  hasEffect(id: string): boolean {
    return hasComponent(id);
  }

  listEffects(): ShaderComponent[] {
    return listComponents();
  }

  getComponent(id: string): ShaderComponent | undefined {
    return getComponent(id);
  }

  hasComponent(id: string): boolean {
    return hasComponent(id);
  }

  listComponents(): ShaderComponent[] {
    return listComponents();
  }

  registerComponent(comp: ShaderComponent): void {
    registerComponent(comp);
  }

  unregisterComponent(id: string): boolean {
    return unregisterComponent(id);
  }

  searchComponents(query: string): ShaderComponent[] {
    return searchComponents(query);
  }

  filterByTag(tag: string): ShaderComponent[] {
    return filterByTag(tag);
  }

  getComponentsByTag(tag: string): ShaderComponent[] {
    return getComponentsByTag(tag);
  }

  reset(): void {
    resetRegistry();
  }
}
