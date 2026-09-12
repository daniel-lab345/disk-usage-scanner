import { readdirSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";

import { isIgnored, type IgnoreRule } from "./ignoreFile.js";

export interface ScanEntry {
  readonly path: string;
  readonly size: number;
  readonly isDirectory: boolean;
}

export interface ScanOptions {
  readonly ignoreRules?: readonly IgnoreRule[];
}

// Walks a directory tree and returns every file with its size in bytes.
// Directories aren't emitted as entries themselves; callers that want
// per-directory totals can bucket files by their parent path.
export function scan(root: string, options: ScanOptions = {}): ScanEntry[] {
  const rules = options.ignoreRules ?? [];
  const entries: ScanEntry[] = [];
  walk(root, root, rules, entries);
  return entries;
}

function walk(root: string, dir: string, rules: readonly IgnoreRule[], out: ScanEntry[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // Permission errors on a subdirectory shouldn't abort the whole scan.
    return;
  }

  for (const name of names) {
    const fullPath = join(dir, name);
    // Ignore patterns are written with forward slashes regardless of
    // platform, so normalize before matching.
    const relPath = relative(root, fullPath).split("\\").join("/");

    let stat;
    try {
      stat = lstatSync(fullPath);
    } catch {
      continue;
    }

    // Symlinks are skipped rather than followed, so a symlink loop can't
    // send the walk into an infinite recursion.
    if (stat.isSymbolicLink()) {
      continue;
    }

    if (isIgnored(relPath, rules)) {
      continue;
    }

    if (stat.isDirectory()) {
      walk(root, fullPath, rules, out);
    } else if (stat.isFile()) {
      out.push({ path: fullPath, size: stat.size, isDirectory: false });
    }
  }
}

