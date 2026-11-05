const { builtinModules } = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const inside = (file, directory) => file.startsWith(`${directory}/`);
const feature = (file) => file.match(/^src\/features\/([^/]+)(?:\/|$)/)?.[1];
const shared = (file) => /^(src\/(components|i18n|lib))\//.test(file);
const frontend = (file) =>
  !!feature(file) ||
  inside(file, "src/components") ||
  inside(file, "src/client");

/** Parse actual syntax, including re-exports, import types, require and dynamic imports. */
function dependencies(source) {
  const imports = [];
  function visit(node) {
    let specifier;
    let typeOnly = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
      typeOnly = !!node.isTypeOnly || !!node.importClause?.isTypeOnly;
    } else if (ts.isImportTypeNode(node)) {
      specifier = node.argument.literal;
      typeOnly = true;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifier = node.arguments[0];
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      specifier = node.moduleReference.expression;
    }
    if (specifier && ts.isStringLiteralLike(specifier)) {
      imports.push({ specifier: specifier.text, typeOnly, node: specifier });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

/** Sources use repository-relative, slash-separated paths; also usable by regression tests. */
function checkSources(sources) {
  const errors = [];
  const graph = new Map();
  const serverOnly = new Set();
  const report = (file, source, node, message) => {
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    errors.push(`${file}:${line}: ${message}`);
  };
  for (const [file, code] of Object.entries(sources)) {
    const source = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
    );
    const edges = [];
    graph.set(file, edges);
    for (const { specifier, typeOnly, node } of dependencies(source)) {
      if (
        specifier === "server-only" ||
        builtinModules.includes(specifier) ||
        /^(node:|pg$|drizzle-orm(?:\/|$)|@vercel\/functions$)/.test(specifier)
      )
        serverOnly.add(file);
      let target = specifier.startsWith("@/")
        ? path.posix.normalize(`src/${specifier.slice(2)}`)
        : specifier.startsWith(".")
          ? path.posix.normalize(
              path.posix.join(path.posix.dirname(file), specifier),
            )
          : null;
      if (!target) {
        if (
          inside(file, "src/game") ||
          inside(file, "src/api") ||
          (inside(file, "src/client") &&
            /^(react(?:-dom)?(?:\/|$)|next(?:\/|$)|server-only$)/.test(
              specifier,
            ))
        ) {
          report(
            file,
            source,
            node,
            `Forbidden dependency '${specifier}'; domain/contracts stay pure and client orchestration stays React-independent.`,
          );
        }
        continue;
      }
      const extensionless = target.replace(/\.[cm]?jsx?$/, "");
      target =
        [
          target,
          `${extensionless}.ts`,
          `${extensionless}.tsx`,
          `${target}.ts`,
          `${target}.tsx`,
          `${target}/index.ts`,
          `${target}/index.tsx`,
        ].find((candidate) => Object.hasOwn(sources, candidate)) ?? target;
      edges.push({ target, typeOnly, node, source });
      const owner = feature(file);
      const targetOwner = feature(target);
      let reason;
      if (inside(file, "src/game") && !inside(target, "src/game"))
        reason = "Domain may depend only on domain modules.";
      else if (inside(file, "src/api") && !/^(src\/(api|game))\//.test(target))
        reason = "Contracts may depend only on contracts/domain.";
      else if (
        inside(file, "src/client") &&
        !/^(src\/(client|api|game))\//.test(target)
      )
        reason =
          "Client orchestration may depend only on client/contracts/domain.";
      else if (owner && targetOwner && owner !== targetOwner)
        reason =
          "Compose features in app; cross-feature imports are forbidden.";
      else if (owner && /^(src\/(app|server))\//.test(target))
        reason = "Features cannot depend on routes or server implementations.";
      else if (
        shared(file) &&
        /^(src\/(features|app|client|server))\//.test(target)
      )
        reason =
          "Shared modules cannot depend on features, routes, client orchestration or server implementations.";
      else if (
        inside(file, "src/server") &&
        /^(src\/(features|components|client|app))\//.test(target)
      )
        reason = "Server implementations cannot depend on frontend/routes.";
      else if (
        targetOwner &&
        owner !== targetOwner &&
        target !== `src/features/${targetOwner}/index.ts`
      )
        reason = `Import the public API '@/features/${targetOwner}' instead of private internals.`;
      if (reason) report(file, source, node, `${specifier}: ${reason}`);
    }
    if (inside(file, "src/game")) {
      const visitDomain = (node) => {
        if (
          ts.isIdentifier(node) &&
          /^(window|document|navigator|fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|globalThis|process|Audio|HTMLElement)$/.test(
            node.text,
          )
        ) {
          report(
            file,
            source,
            node,
            `Domain cannot use browser/network/process API '${node.text}'.`,
          );
        }
        ts.forEachChild(node, visitDomain);
      };
      visitDomain(source);
    }
  }
  // Check transitive imports too: a shared helper must not hide a server-only dependency.
  for (const file of graph.keys()) {
    const clientEntry =
      frontend(file) || /^\s*["']use client["']/.test(sources[file]);
    if (!clientEntry) continue;
    const seen = new Set();
    const visitClient = (current, chain) => {
      if (seen.has(current)) return;
      seen.add(current);
      if (serverOnly.has(current)) {
        errors.push(
          `${file}:1: Client reaches server-only dependency: ${chain.join(" -> ")}`,
        );
        return;
      }
      for (const edge of graph.get(current) ?? [])
        if (!edge.typeOnly) visitClient(edge.target, [...chain, edge.target]);
    };
    visitClient(file, [file]);
  }
  const visited = new Set();
  const active = new Set();
  function visit(file, chain) {
    if (active.has(file)) {
      errors.push(
        `${file}:1: Circular dependency: ${[...chain.slice(chain.indexOf(file)), file].join(" -> ")}`,
      );
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const edge of graph.get(file) ?? [])
      visit(edge.target, [...chain, file]);
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file, []);
  return errors;
}

function checkArchitecture(root = process.cwd()) {
  const sources = {};
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory() && entry.name !== "__tests__") walk(file);
      else if (
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/.test(file) &&
        !/\.(test|spec)\./.test(file)
      )
        sources[file] = fs.readFileSync(path.join(root, file), "utf8");
    }
  }
  walk("src");
  return checkSources(sources);
}

module.exports = { checkArchitecture, checkSources };
if (require.main === module) {
  const errors = checkArchitecture();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Architecture boundaries passed.");
}
