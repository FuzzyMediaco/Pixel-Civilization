let firstControl: Promise<void> | undefined;

/** A shared link may be the first page on this device. Give the worker a chance
 * to cache an optional art pack before its first request leaves this page. */
export function prepareOfflineShell(): Promise<void> {
  if (!import.meta.env?.PROD || typeof window === "undefined" ||
      !("serviceWorker" in navigator) || navigator.userAgent.includes("PixelCivilizationOffline")) {
    return Promise.resolve();
  }
  if (!firstControl) firstControl = new Promise<void>(resolve => {
    const worker = navigator.serviceWorker;
    const finish = () => {
      clearTimeout(timeout);
      worker.removeEventListener("controllerchange", finish);
      resolve();
    };
    // Storage restrictions or a stalled installation must not hold up play.
    const timeout = window.setTimeout(finish, 5000);
    worker.addEventListener("controllerchange", finish);
    void worker.register("/sw.js").catch(finish);
    if (worker.controller) finish();
  });
  return firstControl;
}
