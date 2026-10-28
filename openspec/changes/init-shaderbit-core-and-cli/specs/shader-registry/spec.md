# Spec Delta

## Purpose

Defines the component registry schema, uniform binding contracts, and catalog of standalone GPU shader visual effects.

## ADDED Requirements

### Requirement: Standardized shader component definition
The registry SHALL provide a structured schema for shader effects declaring required GLSL/WGSL code, default uniform values, types, and input bindings (time, resolution, mouse pointer).

#### Scenario: Registering a shader component
- **WHEN** a shader effect definition conforming to the registry schema is loaded
- **THEN** the registry exposes its metadata, uniform descriptors, fragment code, and dependencies with runtime footprint under 5KB

### Requirement: Interactive input and uniform binding
The system SHALL bind normalized time, screen resolution, mouse position, device pixel ratio, and custom parameter uniforms to the active shader program.

#### Scenario: Pointer movement updates uniform values
- **WHEN** the user moves pointer over the active shader canvas
- **THEN** normalized coordinates (x, y) are updated and passed to the shader uniform buffer on the next frame

### Requirement: Built-in starter shader library
The registry SHALL include production-ready starter shader components including Liquid Chrome, Mesh Gradient, Interactive Noise, and Caustics.

#### Scenario: Loading built-in shader effect
- **WHEN** client requests a built-in shader effect by id (e.g. 'liquid-chrome' or 'mesh-gradient')
- **THEN** the registry returns the fully validated effect definition ready for compilation
