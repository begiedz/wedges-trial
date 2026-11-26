export class TransportError extends Error {
  constructor(
    public status: number,
    public code?: "NICKNAME_BLOCKED",
  ) {
    super("REQUEST_FAILED");
  }
}

/** Shared HTTP mechanics only; each endpoint validates its own response. */
export async function requestJson(
  path: string,
  options: {
    body?: object;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  } = {},
): Promise<unknown> {
  const { body, signal, fetcher = fetch } = options;
  const deadline = AbortSignal.timeout(15000);
  const response = await fetcher(path, {
    method: body === undefined ? "GET" : "POST",
    // Protected Preview deployments also need the same-origin access cookie.
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    // Only expose the code this UI handles; malformed/proxy error bodies retain
    // the HTTP status so callers can still recover from ordinary failures.
    let code: "NICKNAME_BLOCKED" | undefined;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        body.error &&
        typeof body.error === "object" &&
        "code" in body.error &&
        body.error.code === "NICKNAME_BLOCKED"
      )
        code = "NICKNAME_BLOCKED";
    } catch {
      /* An error response need not contain JSON. */
    }
    throw new TransportError(response.status, code);
  }
  return response.json();
}
