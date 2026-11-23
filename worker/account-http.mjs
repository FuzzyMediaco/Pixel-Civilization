export class AccountError extends Error {
  constructor(status, message, code, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  } });
}

export async function readJson(request, maxBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
    throw new AccountError(415, "Send JSON data.", "content_type");
  }
  if (Number(request.headers.get("Content-Length")) > maxBytes) {
    throw new AccountError(413, "This request is too large.", "too_large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError(400, "Missing JSON data.", "invalid_json");
  const decoder = new TextDecoder();
  const pieces = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AccountError(413, "This request is too large.", "too_large");
      }
      pieces.push(decoder.decode(value, { stream: true }));
    }
    pieces.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }
  try {
    const value = JSON.parse(pieces.join(""));
    if (!value || Array.isArray(value) || typeof value !== "object") throw Error();
    return value;
  } catch {
    throw new AccountError(400, "Enter valid JSON data.", "invalid_json");
  }
}
