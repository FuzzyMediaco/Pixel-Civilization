import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./game/designs/index";
import { App } from "./App";
import { PlayerAccount } from "./components/PlayerAccount";

import {openDeviceSaves} from "./game/deviceSaves";
import {autosync, bootAccountSync} from "./game/accountSync";
import {hydrateCustomElements} from "./game/customElements";

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  const hosted = ["pixelcivilization.app", "pixel-civilization.fuzzymedia.workers.dev"].includes(location.hostname);
  const needsAccount = hosted && !navigator.userAgent.includes("PixelCivilizationOffline");
  const readyToSave = () => true;
  const renderAccount = () => root.render(
    <main className="player-entry">
      <div className="player-entry-card">
        <h1>Pixel Civilization</h1>
        <PlayerAccount entry saveNow={readyToSave} />
      </div>
    </main>,
  );

  if (needsAccount) root.render(
    <main className="player-entry"><p role="status">Opening Pixel Civilization…</p></main>,
  );
  void (async () => {
    await openDeviceSaves();
    if (!(await bootAccountSync(needsAccount))) {
      renderAccount();
      return;
    }
    hydrateCustomElements();
    window.addEventListener("online", autosync);
    document.addEventListener("visibilitychange", autosync);
    window.setInterval(() => {
      if (!document.hidden) void autosync();
    }, 30000);
    root.render(<React.StrictMode><App /></React.StrictMode>);
  })().catch(() => {
    if (needsAccount) renderAccount();
  });
}

if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD && !navigator.userAgent.includes("PixelCivilizationOffline")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
