# Spec Delta

## Purpose

Provides a command-line interface to initialize project configurations and inject shader components and framework wrappers directly into developer codebases.

## ADDED Requirements

### Requirement: Project initialization command
The CLI SHALL provide an initialization command (`shaderbit init`) that detects project environment (framework, TypeScript, styling, target directory) and generates a local configuration file.

#### Scenario: Running shaderbit init
- **WHEN** user executes `shaderbit init` in a project directory
- **THEN** the CLI detects the project framework (React, Vue, Svelte, or Vanilla) and writes `shaderbit.json` configuration

### Requirement: Component injection command
The CLI SHALL provide an installation command (`shaderbit add <component>`) that downloads or resolves the component definition and writes the standalone component file into the target directory.

#### Scenario: Adding a shader component
- **WHEN** user executes `shaderbit add liquid-chrome`
- **THEN** the CLI verifies the component exists in the registry, resolves any necessary helper utilities, and writes the component code into the user's component directory without external runtime dependencies

#### Scenario: Adding an unknown component
- **WHEN** user executes `shaderbit add invalid-effect-name`
- **THEN** the CLI prints a descriptive error message with available component names and exits with non-zero exit code
