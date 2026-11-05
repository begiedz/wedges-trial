const fs = require("node:fs");
const path = require("node:path");
const { buildEngineSource } = require("./benchmark-locks.cjs");

const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: node scripts/create-benchmark-preview.cjs <empty-directory>",
  );
fs.mkdirSync(destination, { recursive: true });
if (fs.readdirSync(destination).length)
  throw new Error("Destination must be empty");
fs.mkdirSync(path.join(destination, "api"));
fs.mkdirSync(path.join(destination, "public"));
fs.writeFileSync(
  path.join(destination, "public/index.html"),
  "Temporary lock-engine benchmark",
);
const { source, hash } = buildEngineSource();
fs.writeFileSync(path.join(destination, "engine.cjs"), source);
for (const file of ["benchmark-locks.cjs", "benchmark-preview-handler.cjs"])
  fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
fs.writeFileSync(
  path.join(destination, "api/benchmark.js"),
  `const {Pool} = require('pg');
const {createHandler} = require('../benchmark-preview-handler.cjs');
module.exports = createHandler(require('../engine.cjs'), new Pool({connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 1000, connectionTimeoutMillis: 15000, query_timeout: 15000}), ${JSON.stringify(hash)});
`,
);
fs.writeFileSync(
  path.join(destination, "package.json"),
  JSON.stringify(
    {
      private: true,
      engines: { node: "22.x" },
      dependencies: { pg: require("pg/package.json").version },
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(destination, "vercel.json"),
  JSON.stringify(
    {
      framework: null,
      buildCommand: "",
      outputDirectory: "public",
      functions: {
        "api/benchmark.js": { maxDuration: 300, includeFiles: "*.cjs" },
      },
    },
    null,
    2,
  ),
);
// Never serve source/configuration as static files from the standalone fixture.
fs.writeFileSync(path.join(destination, ".vercelignore"), "node_modules\n");
fs.writeFileSync(
  path.join(destination, ".gitignore"),
  ".vercel\nnode_modules\n.env*\n",
);
console.log(
  `Prepared benchmark fixture: ${destination}; engine SHA256 ${hash}`,
);
