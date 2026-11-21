import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./game/designs/index";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
