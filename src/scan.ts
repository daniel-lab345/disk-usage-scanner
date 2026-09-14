import { readdirSync, lstatSync } from "node:fs";
import { join, relative, dirname } from "node:path";

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
// Directories aren't emitted as entries themselves; use rollupDirectories
// on the result if you want per-directory totals.
export function scan(root: string, options: ScanOptions = {}): ScanEntry[] {
  const rules = options.ignoreRules ?? [];
  const entries: ScanEntry[] = [];
  walk(root, root, rules, entries);
  return entries;
}

export interface DirectoryTotal {
  readonly path: string;
  readonly size: number;
}

// Sums file sizes into every ancestor directory up to (and including) root,
// so a large file three levels deep counts toward each directory that
// contains it, not just its immediate parent.
export function rollupDirectories(entries: readonly ScanEntry[], root: string): DirectoryTotal[] {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    let dir = dirname(entry.path);
    for (;;) {
      totals.set(dir, (totals.get(dir) ?? 0) + entry.size);
      if (dir === root) break;
      const parent = dirname(dir);
      // dirname("/") === "/", so this guards against looping forever if an
      // entry's path somehow isn't under root.
      if (parent === dir) break;
      dir = parent;
    }
  }

  return Array.from(totals, ([path, size]) => ({ path, size }));
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

