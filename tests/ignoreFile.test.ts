import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIgnoreFile, isIgnored } from "../src/ignoreFile.js";
import { IgnoreSyntaxError } from "../src/errors.js";

test("skips blank lines and comments", () => {
  const rules = parseIgnoreFile("\n  \n# a comment\n*.log\n", ".duignore");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "*.log");
});

test("strips a trailing carriage return from CRLF line endings", () => {
  const rules = parseIgnoreFile("*.log\r\ndist/\r\n", ".duignore");
  assert.equal(rules.length, 2);
  assert.equal(rules[0].source, "*.log");
  assert.equal(rules[1].source, "dist/");
});

test("leading whitespace does not become part of the pattern", () => {
  const rules = parseIgnoreFile("   dist/\n", ".duignore");
  assert.equal(rules[0].source, "dist/");
});

test("a leading '!' negates the rule", () => {
  const rules = parseIgnoreFile("!keep.log\n", ".duignore");
  assert.equal(rules[0].negated, true);
  assert.equal(rules[0].source, "keep.log");
});

test("'*' matches any run of characters and '?' matches exactly one", () => {
  const rules = parseIgnoreFile("*.log\nlog?.txt\n", ".duignore");
  assert.equal(rules[0].regex.test("server.log"), true);
  assert.equal(rules[0].regex.test("server.log.gz"), false);
  assert.equal(rules[1].regex.test("log1.txt"), true);
  assert.equal(rules[1].regex.test("log12.txt"), false);
});

test("a character class is passed through to the regex", () => {
  const rules = parseIgnoreFile("build/[abc].tmp\n", ".duignore");
  assert.equal(rules[0].regex.test("build/a.tmp"), true);
  assert.equal(rules[0].regex.test("build/d.tmp"), false);
});

test("an escaped character is taken literally, including regex metacharacters", () => {
  const rules = parseIgnoreFile("weird\\*name\\.txt\n", ".duignore");
  assert.equal(rules[0].regex.test("weird*name.txt"), true);
  assert.equal(rules[0].regex.test("weirdXname.txt"), false);
});

test("a dangling escape at end of line is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("foo\\\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.line, 1);
  assert.equal(err.column, 4);
  assert.match(err.reason, /dangling escape/);
});

test("an unterminated character class is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("build/[cache\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.line, 1);
  assert.equal(err.column, 7);
  assert.match(err.reason, /unterminated character class/);
});

test("an empty character class is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("build/[]\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.column, 7);
  assert.match(err.reason, /empty character class/);
});

test("a stray ']' without a matching '[' is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("build]cache\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.column, 6);
  assert.match(err.reason, /without a matching/);
});

test("a bare '!' with no pattern is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("!\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.line, 1);
  assert.equal(err.column, 2);
  assert.match(err.reason, /expected a pattern/);
});

test("a '!' followed by only whitespace is a syntax error", () => {
  const err = assert.throws(
    () => parseIgnoreFile("!   \n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.column, 2);
  assert.match(err.reason, /expected a pattern/);
});

test("the syntax error reports the correct line number for later lines", () => {
  const err = assert.throws(
    () => parseIgnoreFile("dist/\n*.log\nbuild/[cache\n", ".duignore"),
    IgnoreSyntaxError,
  ) as IgnoreSyntaxError;
  assert.equal(err.line, 3);
  assert.equal(err.sourceLine, "build/[cache");
});

test("isIgnored: the last matching rule wins", () => {
  const rules = parseIgnoreFile("*.log\n!keep.log\n", ".duignore");
  assert.equal(isIgnored("server.log", rules), true);
  assert.equal(isIgnored("keep.log", rules), false);
  assert.equal(isIgnored("readme.md", rules), false);
});

test("isIgnored: a later plain rule can re-ignore what a negation un-ignored", () => {
  const rules = parseIgnoreFile("*.log\n!keep.log\nkeep.log\n", ".duignore");
  assert.equal(isIgnored("keep.log", rules), true);
});
