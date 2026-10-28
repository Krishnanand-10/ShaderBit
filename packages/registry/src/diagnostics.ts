export interface ShaderDiagnostic {
  line: number;
  column?: number;
  message: string;
  sourceLine?: string;
  context?: string;
}

export interface FormattedShaderError {
  rawLog: string;
  diagnostics: ShaderDiagnostic[];
  formatted: string;
}

/**
 * Parses raw GLSL compilation info logs (e.g. "ERROR: 0:29: 'foo' : syntax error").
 */
export function parseGlslErrorLog(errorLog: string): ShaderDiagnostic[] {
  const results: ShaderDiagnostic[] = [];
  if (!errorLog || typeof errorLog !== 'string') return results;
  const lines = errorLog.split('\n');

  // Match patterns like:
  // "ERROR: 0:29: 'foo' : syntax error"
  // "0:29(14): error: syntax error"
  // "ERROR: 29: syntax error"
  const regexStandard = /(?:ERROR:\s*)?(?:\d+:)?(\d+)(?::|\((\d+)\):|\s+)(.*)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(regexStandard);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      const colNum = match[2] ? parseInt(match[2], 10) : undefined;
      const message = match[3] ? match[3].trim() : trimmed;
      if (!isNaN(lineNum)) {
        results.push({ line: lineNum, column: colNum, message });
      }
    }
  }

  return results;
}

/**
 * Formats a code context window around a specific line number with pointers.
 */
export function formatShaderDiagnosticContext(
  source: string,
  targetLine: number,
  targetColumn?: number,
  contextLines: number = 2
): string {
  if (!source || typeof source !== 'string') return '';
  const sourceLines = source.split('\n');
  const start = Math.max(0, targetLine - 1 - contextLines);
  const end = Math.min(sourceLines.length, targetLine + contextLines);
  const out: string[] = [];

  const maxLineDigits = String(end).length;

  for (let i = start; i < end; i++) {
    const lineNum = i + 1;
    const isTarget = lineNum === targetLine;
    const prefix = isTarget ? '> ' : '  ';
    const lineNumPadded = String(lineNum).padStart(maxLineDigits, ' ');
    out.push(`${prefix}${lineNumPadded} | ${sourceLines[i]}`);

    if (isTarget && targetColumn !== undefined && targetColumn > 0) {
      const indent = ' '.repeat(prefix.length + maxLineDigits + 3 + targetColumn - 1);
      out.push(`${indent}^`);
    }
  }

  return out.join('\n');
}

/**
 * Formats full compilation error log into a readable diagnostic report.
 */
export function formatShaderError(
  errorLog: string,
  source: string,
  options?: { contextRadius?: number }
): FormattedShaderError {
  const radius = options?.contextRadius ?? 2;
  const parsed = parseGlslErrorLog(errorLog);
  const sourceLines = typeof source === 'string' ? source.split('\n') : [];

  const diagnostics: ShaderDiagnostic[] = parsed.map((item) => {
    const srcLine = sourceLines[item.line - 1] ?? '';
    const context = formatShaderDiagnosticContext(source, item.line, item.column, radius);
    return {
      line: item.line,
      column: item.column,
      message: item.message,
      sourceLine: srcLine,
      context
    };
  });

  const formattedBlocks: string[] = [];
  formattedBlocks.push(`Shader compilation failed with ${diagnostics.length || 1} error(s):`);

  if (diagnostics.length === 0) {
    formattedBlocks.push(`  ${(errorLog || '').trim()}`);
  } else {
    for (const diag of diagnostics) {
      formattedBlocks.push(`\n[Line ${diag.line}${diag.column ? `:${diag.column}` : ''}] ${diag.message}`);
      formattedBlocks.push('--------------------------------------------------');
      if (diag.context) {
        formattedBlocks.push(diag.context);
      }
      formattedBlocks.push('--------------------------------------------------');
    }
  }

  return {
    rawLog: errorLog,
    diagnostics,
    formatted: formattedBlocks.join('\n')
  };
}
