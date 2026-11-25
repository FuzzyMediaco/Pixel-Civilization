"""Check the bundled iOS game using Apple's simulator and StoreKit tools."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parent
APP = "app.pixelcivilization.game"
PRODUCT = ROOT / "build/derived/Build/Products/Debug-iphonesimulator/PixelCivilization.app"


def sim(*args, timeout=120, capture=False, check=True):
    return subprocess.run(["xcrun", "simctl", *args], text=True, timeout=timeout,
                          capture_output=capture, check=check)


def device(family):
    all_devices = json.loads(sim("list", "devices", "available", "-j", capture=True).stdout)["devices"]
    pattern = r"iPhone .*Pro Max" if family == "phone" else r"iPad Pro.*13-inch"
    for runtime, devices in all_devices.items():
        # StoreKit Test on the 26.5 simulator can fail to save its local configuration.
        if runtime.endswith("iOS-26-2"):
            for item in devices:
                if re.search(pattern, item["name"]) and item.get("isAvailable"):
                    print("Using", item["name"], runtime, flush=True)
                    return item["udid"]
    raise RuntimeError("Missing iOS 26.2 " + family + " simulator")


def boot(udid):
    sim("bootstatus", udid, "-b", timeout=420)
    sim("status_bar", udid, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100")


def stop(udid):
    # XCTest's UI automation can stall waiting to detach from a busy WebKit
    # process. simctl manages the actual app lifetime independently of XCTest.
    try:
        sim("terminate", udid, APP, timeout=35)
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        sim("shutdown", udid, timeout=90, check=False)
        boot(udid)


def capture(family, udid):
    boot(udid)
    try:
        sim("install", udid, str(PRODUCT), timeout=120)
        data = Path(sim("get_app_container", udid, APP, "data", capture=True).stdout.strip())
        output = ROOT / "build" / (family + "-screens")
        output.mkdir(parents=True, exist_ok=True)
        for scene in ("street", "skyline", "guide"):
            print("Rendering", family, scene, flush=True)
            marker = data / "Library/Caches" / ("PixelStoreCapture-" + scene)
            marker.unlink(missing_ok=True)
            sim("launch", udid, APP, "-storeTour", scene, timeout=100)
            deadline = time.monotonic() + 210
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(1)
            ready = marker.exists() and marker.read_text() == scene
            name = scene + ("" if ready else "-did-not-render") + ".png"
            sim("io", udid, "screenshot", str(output / name), timeout=45)
            if not ready:
                raise RuntimeError(f"{family} never rendered {scene} with its real controls")
            print("Captured playable", family, scene, flush=True)
            stop(udid)
    finally:
        sim("shutdown", udid, timeout=120, check=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("compile", "phone", "tablet", "purchases"))
    stage = parser.parse_args().stage
    os.chdir(ROOT)
    (ROOT / "build").mkdir(exist_ok=True)
    udid = device("tablet" if stage == "tablet" else "phone")
    build = ["xcodebuild", "-project", "PixelCivilization.xcodeproj", "-scheme", "PixelCivilization",
             "-destination", "platform=iOS Simulator,id=" + udid, "-derivedDataPath", "build/derived",
             "-only-testing:StoreCatalogTests", "CODE_SIGN_IDENTITY=-"]
    if stage == "compile":
        subprocess.run(["xcodegen", "generate"], check=True)
        subprocess.run([*build, "build-for-testing"], timeout=1800, check=True)
    elif stage == "purchases":
        boot(udid)
        try:
            subprocess.run([*build, "test-without-building", "-parallel-testing-enabled", "NO",
                            "-test-timeouts-enabled", "YES", "-default-test-execution-time-allowance", "180",
                            "-maximum-test-execution-time-allowance", "240", "-resultBundlePath", "build/storekit.xcresult"],
                           timeout=600, check=True)
        finally:
            result = ROOT / "build/storekit.xcresult"
            if result.exists():
                with (ROOT / "build/storekit-result.json").open("w") as stream:
                    subprocess.run(["xcrun", "xcresulttool", "get", "test-results", "summary", "--path", str(result)],
                                   stdout=stream, check=False, timeout=50)
            sim("shutdown", udid, timeout=120, check=False)
    else:
        capture(stage, udid)


if __name__ == "__main__":
    main()
