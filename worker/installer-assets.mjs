// Installed games check these bytes against offline-index.json. Ordinary HTML can still receive web analytics.
export async function serveGameAsset(request, assets) {
  const asset = await assets.fetch(request);
  const version = new URL(request.url).searchParams.get("edition") ?? "";
  if (!asset.ok || (request.method !== "GET" && request.method !== "HEAD") ||
      !asset.headers.get("content-type")?.startsWith("text/html") || !/^[a-f0-9]{64}$/.test(version)) return asset;
  const headers = new Headers(asset.headers);
  headers.set("content-type", "application/octet-stream");
  headers.set("cache-control", "no-store, no-transform");
  return new Response(asset.body, { status: asset.status, headers });
}
