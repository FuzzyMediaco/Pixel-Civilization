(() => {
  const apple = window.webkit?.messageHandlers?.pixelBilling;
  const google = window.PixelBilling;
  if (window.top !== window || (!apple && !google)) return;
  const pending = new Map();
  let next = 0;
  const respond = message => {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timeout);
    if (message.error) call.reject(new Error(message.error));
    else call.resolve(message.value);
  };
  if (google) google.onmessage = event => respond(JSON.parse(event.data));
  function call(action, ...args) {
    const id = String(++next);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error("The store did not respond. Use Restore Purchases to check any completed purchase."));
      }, action === "purchase" || action === "restore" ? 300000 : 30000);
      pending.set(id, {resolve, reject, timeout});
      try {
        const request = {id, action, args};
        if (apple) apple.postMessage(request).then(value => respond({id, value}), error => respond({id, error:String(error)}));
        else google.postMessage(JSON.stringify(request));
      } catch (error) { respond({id, error:String(error)}); }
    });
  }
  Object.defineProperty(window, "pixelStore", {value:Object.freeze({
    platform: apple ? "apple" : "google",
    products: ids => call("products", ids),
    purchase: (productId, accountToken) => call("purchase", productId, accountToken),
    pending: () => call("pending"),
    restore: () => call("restore"),
    finish: receipt => call("finish", receipt),
    manage: () => call("manage")
  })});
})();
