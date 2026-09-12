import { IgnoreSyntaxError } from "./errors.js";

export interface IgnoreRule {
  readonly source: string;
  readonly negated: boolean;
  readonly regex: RegExp;
}

// Parses a gitignore-flavored filter file into a list of rules. Later rules
// win over earlier ones when both match, and a rule prefixed with "!"
// re-includes a path an earlier rule excluded. That's the entire semantics;
// the interesting part is the diagnostics when a pattern is malformed.
export function parseIgnoreFile(source: string, fileName: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].replace(/\r$/, "");
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const rule = parseLine(rawLine, lineNumber, fileName);
    if (rule !== null) {
      rules.push(rule);
    }
  }

  return rules;
}

function parseLine(line: string, lineNumber: number, fileName: string): IgnoreRule | null {
  let cursor = 0;
  let negated = false;

  // A leading run of whitespace shifts every column number that follows, so
  // find where the real content starts and use that as the parse origin.
  while (cursor < line.length && (line[cursor] === " " || line[cursor] === "\t")) {
    cursor++;
  }

  if (line[cursor] === "!") {
    negated = true;
    cursor++;
    if (cursor >= line.length || line.slice(cursor).trim().length === 0) {
      throw new IgnoreSyntaxError(
        "expected a pattern after '!'",
        fileName,
        lineNumber,
        cursor + 1,
        line,
      );
    }
  }

  const patternStart = cursor;
  let pattern = "";

  while (cursor < line.length) {
    const ch = line[cursor];

    if (ch === "\\") {
      if (cursor === line.length - 1) {
        throw new IgnoreSyntaxError(
          "dangling escape character '\\' at end of pattern",
          fileName,
          lineNumber,
          cursor + 1,
          line,
        );
      }
      // Escaped character is taken literally, whatever it is.
      pattern += escapeRegExpChar(line[cursor + 1]);
      cursor += 2;
      continue;
    }

    if (ch === "[") {
      const closing = line.indexOf("]", cursor + 1);
      if (closing === -1) {
        throw new IgnoreSyntaxError(
          "unterminated character class, expected closing ']'",
          fileName,
          lineNumber,
          cursor + 1,
          line,
        );
      }
      if (closing === cursor + 1) {
        throw new IgnoreSyntaxError(
          "empty character class '[]' matches nothing",
          fileName,
          lineNumber,
          cursor + 1,
          line,
        );
      }
      // Character classes are simple enough (no nested ranges/negation
      // beyond what regex already supports) that we can pass them through.
      pattern += line.slice(cursor, closing + 1);
      cursor = closing + 1;
      continue;
    }

    if (ch === "]") {
      throw new IgnoreSyntaxError(
        "unexpected ']' without a matching '['",
        fileName,
        lineNumber,
        cursor + 1,
        line,
      );
    }

    if (ch === "*") {
      pattern += ".*";
      cursor++;
      continue;
    }

    if (ch === "?") {
      pattern += ".";
      cursor++;
      continue;
    }

    pattern += escapeRegExpChar(ch);
    cursor++;
  }

  if (pattern.length === 0) {
    // Only whitespace after "!", or a bare line of spaces that somehow
    // wasn't caught by the blank-line check (e.g. a line of only tabs
    // followed by nothing). Treat it the same as an empty pattern.
    throw new IgnoreSyntaxError(
      "pattern is empty",
      fileName,
      lineNumber,
      patternStart + 1,
      line,
    );
  }

  return {
    source: line.slice(patternStart),
    negated,
    regex: new RegExp(`^${pattern}$`),
  };
}

function escapeRegExpChar(ch: string): string {
  return /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

// Applies gitignore semantics: the last matching rule decides, and a
// negated rule un-ignores a path that an earlier rule matched.
export function isIgnored(relativePath: string, rules: readonly IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.regex.test(relativePath)) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}
