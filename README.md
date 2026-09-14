# disk-usage-scanner

Finds what's eating disk space in a directory tree, and lets you filter out
noise (build output, caches, `node_modules`) with a small gitignore-style
filter file. No dependencies — just `node:fs` and `node:path`.

## Why

`du -sh * | sort -h` gets you most of the way there, but the moment you want
to exclude a handful of directories it turns into a pile of `--exclude`
flags or a `find ... -prune` incantation nobody remembers the syntax for a
month later. This tool reads exclude patterns from a file instead, in the
same style as `.gitignore`, and reports the largest files under a directory.

## Usage

```
npx tsc            # build once (no bundler, just the TypeScript compiler)
node dist/bin/cli.js /path/to/project --top 15
```

```
   482.3 MiB  vendor/photos/family-reunion-2019.mov
   210.0 MiB  builds/release-0.9.4.dmg
    64.7 MiB  logs/2026-08-server.log
    12.1 MiB  src/generated/schema.json
     ...

1204 files, 1.2 GiB total
```

If a `.duignore` file exists in the scanned directory, it's picked up
automatically. You can also point at one explicitly:

```
node dist/bin/cli.js . --ignore-file ./config/.duignore
```

Pass `--dirs` to roll file sizes up into their containing directories
instead of listing individual files. A directory's total includes every
file underneath it, at any depth:

```
$ node dist/bin/cli.js . --dirs --top 5
   482.3 MiB  vendor/photos/
   482.3 MiB  vendor/
   210.0 MiB  builds/
    64.7 MiB  logs/
    12.1 MiB  src/generated/

312 directories, 1.2 GiB total
```

### Writing a `.duignore` file

```
# build artifacts
dist/
*.tmp

# don't scan vendored binaries, but do scan the changelog inside it
vendor/**
!vendor/CHANGELOG.md
```

Patterns support `*` (any run of characters), `?` (a single character), and
`[...]` character classes, same idea as shell globbing. A line starting with
`!` re-includes a path an earlier line excluded.

### Error messages

Malformed patterns are reported with the exact line and column, not just
"invalid pattern somewhere in your config":

```
$ node dist/bin/cli.js .
error: unterminated character class, expected closing ']'
  --> .duignore:4:11
    |
  4 | build/[cache
    |           ^
```

## Library usage

The CLI is a thin wrapper around a small library:

```ts
import { scan, parseIgnoreFile } from "disk-usage-scanner";

const rules = parseIgnoreFile(readFileSync(".duignore", "utf8"), ".duignore");
const entries = scan("/path/to/project", { ignoreRules: rules });

const largest = entries.sort((a, b) => b.size - a.size)[0];
console.log(largest.path, largest.size);
```

`parseIgnoreFile` throws `IgnoreSyntaxError` (with `.line`, `.column`, and
`.sourceLine` fields) on a bad pattern. `formatIgnoreError` turns that into
the code-frame string shown above, if you want the same diagnostics in your
own tool.

`rollupDirectories(entries, root)` takes the flat list `scan` returns and
sums file sizes into every ancestor directory up to `root`:

```ts
import { scan, rollupDirectories } from "disk-usage-scanner";

const entries = scan("/path/to/project");
const dirs = rollupDirectories(entries, "/path/to/project");
```

## Status

Early skeleton: directory walking, the ignore-file parser, and
per-directory rollups work end to end, but there's no test suite yet. See
the project's commit history for what's landed since.
