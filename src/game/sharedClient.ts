export async function sharedRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/shared/" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal,
  });
  const reply = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(reply.error ?? "Could not reach shared islands.");
  return reply as T;
}

export const sharedError = (error: unknown) => error instanceof Error ? error.message : "Could not reach shared islands.";
export const sharedRoute = (id: string) => "#island=" + id;
export const MODE_NAMES = { god: "God", real: "Real", survival: "Survival" } as const;
