/** Reject migrations targeting a different database from the running application. */
function getMigrationConnection(env) {
  const direct = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!direct) throw new Error("DIRECT_DATABASE_URL_REQUIRED");
  let target;
  let app;
  try {
    target = new URL(direct);
    app = new URL(env.DATABASE_URL_POOLED || env.DATABASE_URL || direct);
  } catch {
    throw new Error("DATABASE_URL_INVALID");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["postgres:", "postgresql:"].includes(app.protocol)
  )
    throw new Error("DATABASE_URL_INVALID");
  if (target.hostname.includes("-pooler."))
    throw new Error("DIRECT_DATABASE_URL_REQUIRED");
  const host = (url) => url.hostname.replace("-pooler.", ".");
  if (
    host(target) !== host(app) ||
    target.port !== app.port ||
    target.pathname !== app.pathname
  )
    throw new Error("DATABASE_TARGET_MISMATCH");
  return direct;
}
module.exports = { getMigrationConnection };
