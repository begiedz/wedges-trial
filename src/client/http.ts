export class TransportError extends Error {
  constructor(public status: number) {
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
  if (!response.ok) throw new TransportError(response.status);
  return response.json();
}
