# canvas-pipeline Specification

## Purpose
Provides a zero-dependency, high-performance rendering engine that runs fragment shaders on WebGL2 or WebGPU with automatic lifecycle management and fallbacks.

## Requirements

### Requirement: Multi-backend rendering engine
The engine SHALL initialize a WebGL2 rendering context by default, optionally initialize a WebGPU context when requested and supported, and provide a 2D Canvas fallback if hardware acceleration is unavailable.

#### Scenario: WebGL2 context initialized successfully
- **WHEN** client initializes an effect on a browser supporting WebGL2
- **THEN** the engine acquires a WebGL2 context, compiles the vertex and fragment shaders, and binds a full-screen quad

#### Scenario: Fallback to 2D canvas when WebGL2 is unsupported
- **WHEN** client initializes an effect in an environment without WebGL2 support
- **THEN** the engine falls back to 2D canvas procedural gradient rendering without throwing unhandled exceptions

### Requirement: OffscreenCanvas and Web Worker rendering
The engine SHALL support delegating canvas drawing to an OffscreenCanvas running within a Web Worker to keep the main UI thread free from rendering overhead.

#### Scenario: OffscreenCanvas transfer
- **WHEN** OffscreenCanvas mode is enabled and supported by the user agent
- **THEN** canvas control is transferred to a dedicated worker and frame rendering executes off the main thread

### Requirement: Visibility and intersection power-saving
The engine SHALL monitor canvas visibility via IntersectionObserver and Page Visibility APIs, automatically pausing the render loop when offscreen or hidden.

#### Scenario: Canvas scrolls outside viewport
- **WHEN** the canvas element exits the visible viewport
- **THEN** the requestAnimationFrame loop is paused until the canvas intersects the viewport again

#### Scenario: Browser tab becomes hidden
- **WHEN** document visibilityState changes to hidden
- **THEN** the render loop pauses immediately to conserve GPU and battery resources
