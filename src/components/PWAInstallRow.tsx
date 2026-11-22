import React, { useState } from "react";
import { Download } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { Button, ListRow } from "./ui";

export function PWAInstallRow() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <ListRow
        icon={<Download size={18} />}
        title="Install app"
        subtitle="Add Pixel Civilization to your home screen"
        trailing="Install"
        onClick={() => void install()}
      />
    );
  }

  return (
    <>
      <ListRow
        icon={<Download size={18} />}
        title={isIOS ? "Install on iPhone / iPad" : "Install app"}
        subtitle={
          isIOS
            ? "Add Pixel Civilization to your home screen via Safari"
            : "Install from your browser menu to play like an app"
        }
        trailing={showGuide ? "Hide" : "How"}
        onClick={() => setShowGuide((v) => !v)}
      />
      {showGuide && (
        <div className="ui-panel-card">
          <div className="ui-card-head">
            <strong>{isIOS ? "Add to Home Screen" : "Install Pixel Civilization"}</strong>
          </div>
          {isIOS ? (
            <p className="ui-card-copy">
              1. Tap the <b>Share</b> button in Safari&apos;s toolbar.
              <br />
              2. Scroll down and tap <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="ui-card-copy">
              Open your browser menu (<b>⋮</b> or address-bar install icon) and choose{" "}
              <b>Install app</b> or <b>Add to Home Screen</b>.
            </p>
          )}
          <div className="ui-quick-links">
            <Button small label="Got it" onClick={() => setShowGuide(false)} />
          </div>
        </div>
      )}
    </>
  );
}
