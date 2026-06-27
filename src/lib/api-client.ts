// Thin wrapper over fetch for same-origin JSON calls. It only removes the
// repeated boilerplate (method default, Content-Type header, JSON.stringify) and
// returns the raw Response, so each call site keeps its own status-code handling
// and `.json()` parsing exactly as before — no behavior change, just less repeat.
//
// Pass `body` as a plain value (it gets JSON-stringified and the JSON
// Content-Type added). Everything else (signal, keepalive, extra headers, …) is
// passed straight through to fetch.
type FetchJsonInit = Omit<RequestInit, "body"> & { body?: unknown };

export function fetchJson(url: string, init: FetchJsonInit = {}): Promise<Response> {
  const { body, headers, ...rest } = init;
  const hasBody = body !== undefined;
  return fetch(url, {
    ...rest,
    headers: hasBody ? { "Content-Type": "application/json", ...headers } : headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });
}
