const fs = require("node:fs");
const path = require("node:path");

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Generated and third-party artifacts retain their upstream names.
const excluded = new Set([
  ".git",
  ".next",
  ".pnpm-store",
  ".vercel",
  "node_modules",
  "coverage",
  "dist",
  "build",
  "out",
  "drizzle",
  "src/assets",
]);
const conventional = new Set([
  "AGENTS.md",
  "README.md",
  "CLAUDE.md",
  "GEMINI.md",
  "SKILL.md",
]);
const rootFiles = new Set([
  ".gitignore",
  ".env.example",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]);
const rootDirectories = new Set([".agents", ".cursor", ".github", ".vscode"]);
const suffixes = /\.(?:(?:test|spec|d|config)\.)?[a-z0-9]+$/;

function validSegment(segment, directory, parent) {
  if (directory) {
    if (!parent && rootDirectories.has(segment)) return true;
    if (/^(src|tests)\/app(?:\/|$)/.test(parent)) {
      const route = segment.match(
        /^(?:\[([a-z0-9-]+)\]|\[\.\.\.([a-z0-9-]+)\]|\[\[\.\.\.([a-z0-9-]+)\]\]|\(([a-z0-9-]+)\)|[@_]([a-z0-9-]+))$/,
      );
      if (route) return kebab.test(route.slice(1).find(Boolean));
    }
    return kebab.test(segment);
  }
  if (conventional.has(segment)) return true;
  if (!parent && rootFiles.has(segment)) return true;
  if (parent === "public" && segment === "Cursor.png") return true;
  return suffixes.test(segment) && kebab.test(segment.replace(suffixes, ""));
}

/** Paths are repository-relative with POSIX separators, even on macOS/Windows. */
function checkPaths(files) {
  const errors = [];
  const all = new Set(files);
  for (const file of files) {
    const segments = file.split("/");
    if (
      segments.some((_, i) => excluded.has(segments.slice(0, i + 1).join("/")))
    )
      continue;
    segments.forEach((segment, i) => {
      if (
        !validSegment(
          segment,
          i < segments.length - 1,
          segments.slice(0, i).join("/"),
        )
      ) {
        errors.push(
          `${file}: '${segment}' must use lowercase kebab-case (see docs/agent/file-naming.md).`,
        );
      }
    });
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) continue;
    if (!file.startsWith("tests/")) {
      errors.push(`${file}: tests belong under tests/.`);
      continue;
    }
    if (/^tests\/(integration|e2e|fixtures|mocks|utils)\//.test(file)) continue;
    const source = file
      .slice("tests/".length)
      .replace(/\.(test|spec)(?=\.)/, "");
    const candidates = source.startsWith("scripts/")
      ? [source.replace(/\.[cm]?[jt]sx?$/, ".cjs"), source]
      : [`src/${source}`];
    if (!candidates.some((candidate) => all.has(candidate))) {
      errors.push(
        `${file}: test must mirror an existing source path and basename; use tests/integration/ for multi-module suites.`,
      );
    }
  }
  return [...new Set(errors)];
}

function checkNames(root = process.cwd()) {
  const files = [];
  function walk(directory = "") {
    for (const entry of fs.readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name;
      if (excluded.has(file)) continue;
      if (entry.isDirectory()) walk(file);
      else if (
        entry.isFile() &&
        ![".DS_Store", "next-env.d.ts"].includes(entry.name) &&
        !entry.name.endsWith(".tsbuildinfo") &&
        !(
          directory === "" &&
          entry.name.startsWith(".env") &&
          entry.name !== ".env.example"
        )
      )
        files.push(file);
    }
  }
  walk();
  return checkPaths(files);
}

module.exports = { checkNames, checkPaths };
if (require.main === module) {
  const errors = checkNames();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Filename and mirrored test conventions passed.");
}
