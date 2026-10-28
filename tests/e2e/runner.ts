/**
 * Master E2E Test Suite Runner for ShaderBit.
 * Executes all 4 tiers of requirement-driven opaque-box tests and zero-dep integrity checks.
 * Produces coverage summary matrix and validates exit code semantics.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

interface SuiteResult {
  file: string;
  tier: string;
  feature: string;
  passed: boolean;
  testCount: number;
  durationMs: number;
  output: string;
}

const TIER_MAPPINGS: Record<string, { tier: string; feature: string }> = {
  'zero-dependency.test.ts': { tier: 'Integrity', feature: 'Zero External 3D Runtime Dep Integrity' },
  'cli-init.test.ts': { tier: 'Tier 1', feature: 'CLI init & Configuration' },
  'cli-list.test.ts': { tier: 'Tier 1', feature: 'CLI list Catalog Display' },
  'cli-add.test.ts': { tier: 'Tier 1', feature: 'CLI add & Code Injection' },
  'core-drivers.test.ts': { tier: 'Tier 1', feature: 'Headless GPU Engine Drivers (WebGL2/WebGPU/2D)' },
  'core-worker.test.ts': { tier: 'Tier 1', feature: 'OffscreenCanvas Worker Bridge' },
  'core-power.test.ts': { tier: 'Tier 1', feature: 'Viewport Power Saving Lifecycle' },
  'core-input.test.ts': { tier: 'Tier 1', feature: 'Pointer & Touch Normalization' },
  'registry-schema.test.ts': { tier: 'Tier 1', feature: 'Registry Schema Validation' },
  'registry-starters.test.ts': { tier: 'Tier 1', feature: 'Registry Starter Effects (4 Shaders)' },
  'registry-uniforms.test.ts': { tier: 'Tier 1', feature: 'Dynamic Uniform Parameter Updates' },
  'adapters.test.ts': { tier: 'Tier 1', feature: 'Framework Adapters (React, Vue, Svelte, Elements)' },
  'canvas-dimensions.test.ts': { tier: 'Tier 2', feature: 'Canvas Dimensions & DPR Boundary Cases' },
  'invalid-shaders.test.ts': { tier: 'Tier 2', feature: 'Invalid Shader Syntax & Compilation Errors' },
  'cli-error-cases.test.ts': { tier: 'Tier 2', feature: 'CLI Error Handling & Unknown Components' },
  'webgl-context-loss.test.ts': { tier: 'Tier 2', feature: 'WebGL Context Loss & Restoration' },
  'boundary-inputs.test.ts': { tier: 'Tier 2', feature: 'Extreme Pointer & Multi-Touch Input Boundaries' },
  'cli-and-compilation.test.ts': { tier: 'Tier 3', feature: 'Pairwise: CLI Add Injection + GPU Compile' },
  'webgl-worker-power.test.ts': { tier: 'Tier 3', feature: 'Pairwise: WebGL2 + Worker + Power Saving' },
  'react-starter-shaders.test.ts': { tier: 'Tier 3', feature: 'Pairwise: React Adapter + Starter Shaders' },
  'vue-starter-shaders.test.ts': { tier: 'Tier 3', feature: 'Pairwise: Vue Adapter + Starter Shaders' },
  'svelte-canvas2d-fallback.test.ts': { tier: 'Tier 3', feature: 'Pairwise: Svelte Adapter + Canvas2D Fallback' },
  'custom-element-reactive.test.ts': { tier: 'Tier 3', feature: 'Pairwise: Custom Element + Dynamic Attributes' },
  'scenario1-cli-onboarding.test.ts': { tier: 'Tier 4', feature: 'Scenario 1: End-to-End CLI Onboarding & Injection' },
  'scenario2-multi-driver-fallback.test.ts': { tier: 'Tier 4', feature: 'Scenario 2: Multi-Driver Fallback & Loss Resilience' },
  'scenario3-worker-rendering.test.ts': { tier: 'Tier 4', feature: 'Scenario 3: OffscreenCanvas Worker Thread Rendering' },
  'scenario4-power-saving-scroll.test.ts': { tier: 'Tier 4', feature: 'Scenario 4: Battery Power-Saving Viewport Scroll' },
  'scenario5-framework-lifecycle.test.ts': { tier: 'Tier 4', feature: 'Scenario 5: Framework Lifecycle & Prop Stress' }
};

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'mocks' && entry.name !== 'harness') {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function runAllTests(): void {
  const e2eDir = path.resolve(import.meta.dirname);
  const testFiles = findTestFiles(e2eDir);

  console.log('======================================================================');
  console.log('              ShaderBit E2E Master Test Suite Runner                  ');
  console.log('======================================================================\n');
  console.log(`Discovered ${testFiles.length} test suite files across Tiers 1-4 and Integrity.\n`);

  let totalTests = 0;
  let passedSuites = 0;
  let failedSuites = 0;
  const suiteResults: SuiteResult[] = [];
  const startTime = Date.now();

  for (const file of testFiles) {
    const fileName = path.basename(file);
    const meta = TIER_MAPPINGS[fileName] || { tier: 'Unknown', feature: fileName };
    const suiteStart = Date.now();

    const proc = spawnSync('node', ['--experimental-strip-types', '--test', file], {
      encoding: 'utf8',
      cwd: path.resolve(e2eDir, '../..'),
      env: { ...process.env, NODE_NO_WARNINGS: '1' }
    });

    const duration = Date.now() - suiteStart;
    const output = (proc.stdout || '') + (proc.stderr || '');
    const passed = proc.status === 0;

    // Extract test count from TAP/reporter output
    let count = 0;
    const passMatch = output.match(/ℹ pass (\d+)/);
    if (passMatch) {
      count = parseInt(passMatch[1], 10);
    } else {
      const fallbackMatch = output.match(/pass (\d+)/i);
      if (fallbackMatch) {
        count = parseInt(fallbackMatch[1], 10);
      }
    }

    totalTests += count;
    if (passed) passedSuites++;
    else failedSuites++;

    suiteResults.push({
      file: fileName,
      tier: meta.tier,
      feature: meta.feature,
      passed,
      testCount: count,
      durationMs: duration,
      output
    });

    const statusBadge = passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
    console.log(`[${meta.tier.padEnd(8)}] ${statusBadge} ${meta.feature.padEnd(52)} (${count} tests, ${duration}ms)`);
    if (!passed) {
      console.error(output);
    }
  }

  const totalDuration = Date.now() - startTime;

  console.log('\n======================================================================');
  console.log('                        Coverage Summary Matrix                       ');
  console.log('======================================================================');
  console.log(`Total Test Suites: ${testFiles.length}`);
  console.log(`Passed Suites:     ${passedSuites}`);
  console.log(`Failed Suites:     ${failedSuites}`);
  console.log(`Total Test Cases:  ${totalTests}`);
  console.log(`Total Elapsed:     ${totalDuration}ms`);
  console.log('======================================================================\n');

  if (failedSuites > 0) {
    console.error(`\x1b[31mFAILED: ${failedSuites} test suites failed.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mSUCCESS: All ${testFiles.length} suites and ${totalTests} test cases passed with 100% pass rate.\x1b[0m`);
    process.exit(0);
  }
}

runAllTests();
