import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./game/designs/index";
import { App } from "./App";

import {openDeviceSaves} from "./game/deviceSaves";
import {autosync, bootAccountSync} from "./game/accountSync";
import {hydrateCustomElements} from "./game/customElements";

const rootEl = document.getElementById("root");
if (rootEl) void (async () => {
  await openDeviceSaves();
  await bootAccountSync();
  hydrateCustomElements();
  window.addEventListener("online", autosync);
  window.setInterval(()=>{if(!document.hidden) void autosync();},60000);
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
})();

if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD && !navigator.userAgent.includes("PixelCivilizationOffline")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
