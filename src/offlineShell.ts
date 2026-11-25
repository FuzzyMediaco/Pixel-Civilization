let firstControl: Promise<void> | undefined;

export function artOutsideWorkerControl() {
  return import.meta.env?.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator &&
    !navigator.userAgent.includes("PixelCivilizationOffline") && !navigator.serviceWorker.controller;
}

/** Preserve a first-view pack that started downloading before the new worker could intercept it. */
export async function keepViewedEra(era: string) {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.installing ?? registration?.waiting ?? registration?.active;
    if (!worker) return;
    await new Promise<void>(resolve => {
      const channel = new MessageChannel();
      const finish = () => { clearTimeout(timer); channel.port1.close(); resolve(); };
      const timer = window.setTimeout(finish, 5000);
      channel.port1.onmessage = finish;
      worker.postMessage({type:"keep-viewed-era", era}, [channel.port2]);
    });
  } catch { /* The model remains usable when device storage is unavailable. */ }
}

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
