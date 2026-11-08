/** Only allowlisted diagnostics may enter logs; never log raw database errors. */
const failureCodes: Record<string, string> = {
  "42P01": "DATABASE_TABLE_MISSING",
  "42703": "DATABASE_COLUMN_MISSING",
  "28P01": "DATABASE_AUTH_FAILED",
  "28000": "DATABASE_AUTH_FAILED",
  "3D000": "DATABASE_NOT_FOUND",
  "42501": "DATABASE_PERMISSION_DENIED",
  "53300": "DATABASE_CONNECTION_LIMIT",
  ENOTFOUND: "DATABASE_DNS_FAILED",
  EAI_AGAIN: "DATABASE_DNS_FAILED",
  ECONNREFUSED: "DATABASE_CONNECTION_REFUSED",
  ECONNRESET: "DATABASE_CONNECTION_RESET",
  ETIMEDOUT: "DATABASE_CONNECTION_TIMEOUT",
  ERR_TLS_CERT_ALTNAME_INVALID: "DATABASE_TLS_FAILED",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "DATABASE_TLS_FAILED",
};
export function failureReason(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== "object") break;
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (record.message === "DATABASE_NOT_CONFIGURED")
      return "DATABASE_NOT_CONFIGURED";
    if (
      typeof record.code === "string" &&
      Object.hasOwn(failureCodes, record.code)
    )
      return failureCodes[record.code];
    current = record.cause;
  }
  return "UNKNOWN_SERVER_FAILURE";
}
