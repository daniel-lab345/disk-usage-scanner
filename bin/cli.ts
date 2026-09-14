#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

import { scan, rollupDirectories } from "../src/scan.js";
import { parseIgnoreFile, type IgnoreRule } from "../src/ignoreFile.js";
import { IgnoreSyntaxError, formatIgnoreError } from "../src/errors.js";
import { formatBytes } from "../src/format.js";

interface Args {
  target: string;
  ignoreFile: string | null;
  top: number;
  dirs: boolean;
}

function parseArgs(argv: string[]): Args {
  let target = ".";
  let ignoreFile: string | null = null;
  let top = 20;
  let dirs = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ignore-file") {
      ignoreFile = argv[++i] ?? null;
    } else if (arg === "--top") {
      const value = Number(argv[++i]);
      if (Number.isFinite(value) && value > 0) {
        top = Math.floor(value);
      }
    } else if (arg === "--dirs") {
      dirs = true;
    } else if (!arg.startsWith("--")) {
      target = arg;
    }
  }

  return { target, ignoreFile, top, dirs };
}

function loadIgnoreRules(explicitPath: string | null, target: string): IgnoreRule[] {
  const path = explicitPath ?? resolve(target, ".duignore");
  if (explicitPath === null && !existsSync(path)) {
    return [];
  }

  const source = readFileSync(path, "utf8");
  return parseIgnoreFile(source, relative(process.cwd(), path) || path);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const target = resolve(args.target);

  let rules: IgnoreRule[];
  try {
    rules = loadIgnoreRules(args.ignoreFile, target);
  } catch (err) {
    if (err instanceof IgnoreSyntaxError) {
      console.error(formatIgnoreError(err));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const entries = scan(target, { ignoreRules: rules });
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);

  if (args.dirs) {
    const totals = rollupDirectories(entries, target);
    totals.sort((a, b) => b.size - a.size);

    for (const dir of totals.slice(0, args.top)) {
      const displayPath = relative(target, dir.path) || ".";
      console.log(`${formatBytes(dir.size).padStart(10)}  ${displayPath}/`);
    }

    console.log("");
    console.log(`${totals.length} directories, ${formatBytes(total)} total`);
    return;
  }

  entries.sort((a, b) => b.size - a.size);

  for (const entry of entries.slice(0, args.top)) {
    const displayPath = relative(target, entry.path) || entry.path;
    console.log(`${formatBytes(entry.size).padStart(10)}  ${displayPath}`);
  }

  console.log("");
  console.log(`${entries.length} files, ${formatBytes(total)} total`);
}

main();
