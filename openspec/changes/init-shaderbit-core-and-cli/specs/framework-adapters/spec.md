# Spec Delta

## Purpose

Provides lightweight component wrappers for React, Vue, Svelte, and standard Web Components that integrate the shader canvas pipeline seamlessly into UI component trees.

## ADDED Requirements

### Requirement: Declarative component bindings
Each framework adapter SHALL render a canvas element, mount the underlying pipeline, pass framework props into shader uniforms, and cleanly tear down resources on unmount.

#### Scenario: React component mounting and unmounting
- **WHEN** a React shader component mounts into the DOM
- **THEN** it instantiates the shader canvas pipeline on the canvas ref, updates uniforms on prop changes, and stops rendering loops upon component unmount

#### Scenario: Svelte / Vue component mounting
- **WHEN** a Vue or Svelte shader component mounts into the DOM
- **THEN** it synchronizes reactive props with shader uniforms and cleans up all WebGL/WebGPU resources when destroyed

### Requirement: Web Component custom element wrapper
The system SHALL provide a vanilla Custom Element (`<shader-bit effect="...">`) allowing zero-framework HTML usage.

#### Scenario: Custom element lifecycle
- **WHEN** `<shader-bit>` is defined and connected to the document
- **THEN** it attaches a shadow root or inner canvas, initializes the requested effect, and responds to attribute changes
