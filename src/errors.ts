// Diagnostic error type shared by the ignore-file parser. The whole point of
// carrying line/column/sourceLine around instead of just a message is so the
// CLI (or any caller) can render a code frame instead of a bare string.

export class IgnoreSyntaxError extends Error {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly sourceLine: string;
  readonly reason: string;

  constructor(message: string, file: string, line: number, column: number, sourceLine: string) {
    super(`${file}:${line}:${column}: ${message}`);
    this.name = "IgnoreSyntaxError";
    this.file = file;
    this.line = line;
    this.column = column;
    this.sourceLine = sourceLine;
    this.reason = message;
  }
}

// Renders a rustc-style code frame:
//
//   error: unterminated character class, expected closing ']'
//     --> .duignore:4:11
//       |
//     4 | build/[cache
//       |           ^
export function formatIgnoreError(err: IgnoreSyntaxError): string {
  const lineNumStr = String(err.line);
  const gutter = " ".repeat(lineNumStr.length);
  const caretOffset = " ".repeat(Math.max(0, err.column - 1));

  return [
    `error: ${err.reason}`,
    `  --> ${err.file}:${err.line}:${err.column}`,
    `${gutter} |`,
    `${lineNumStr} | ${err.sourceLine}`,
    `${gutter} | ${caretOffset}^`,
  ].join("\n");
}
