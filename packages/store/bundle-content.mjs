export const bridgeTag = `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"><script src="/store-bridge.js"></script>`;

export function storePage(html) {
    if (!/<head(?:\s[^>]*)?>/i.test(html)) throw Error("The store edition requires a document head.");
    return html.replace(/<head(?:\s[^>]*)?>/i, tag => tag + bridgeTag);
}
