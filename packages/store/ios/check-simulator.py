"""Check the bundled iOS game using Apple's simulator and StoreKit tools."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
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
    try:
        sim("bootstatus", udid, "-b", timeout=600)
    except subprocess.TimeoutExpired:
        # Installation of runtime services can outlive the first progress reader.
        # Give the existing boot a chance to finish before starting it over.
        try:
            sim("bootstatus", udid, "-b", timeout=240)
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            restart(udid)
    except subprocess.CalledProcessError:
        restart(udid)
    subprocess.run(["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", udid], timeout=45, check=True)
    sim("status_bar", udid, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100")


def restart(udid):
    # A hosted Mac can lose launchd before the game is installed. Recover the
    # one requested device; never erase it or reset other simulator devices.
    print("Restarting the simulator after CoreSimulator failed to boot", flush=True)
    sim("shutdown", udid, timeout=120, check=False)
    sim("bootstatus", udid, "-b", timeout=600)


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
        fingerprints = set()
        failures = []
        retrying = set()
        scenes = ["street", "skyline", "guide"]
        for scene in scenes:
            print("Rendering", family, scene, flush=True)
            marker = data / "Library/Caches" / ("PixelStoreCapture-" + scene)
            for old in (marker, marker.with_suffix(".json"), marker.with_suffix(".png")):
                old.unlink(missing_ok=True)
            sim("launch", udid, APP, "-storeTour", scene, timeout=100)
            deadline = time.monotonic() + 210
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(1)
            ready = marker.exists() and marker.read_text() == scene
            details = marker.with_suffix(".json")
            if details.exists():
                print("Installed WKWebView", details.read_text(), flush=True)
                shutil.copyfile(details, output / (scene + "-renderer.json"))
            screen = output / (scene + "-did-not-render.png")
            has_image = False
            for _ in range(5 if ready else 1):
                screen.unlink(missing_ok=True)
                try:
                    sim("io", udid, "screenshot", str(screen), timeout=90)
                except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
                    # The simulator can finish writing the frame before its image
                    # pipeline returns. Only decode a complete, fresh PNG.
                    if not screen.exists() or not screen.read_bytes().endswith(bytes.fromhex("0000000049454e44ae426082")):
                        print("Simulator did not finish its screenshot", flush=True)
                        continue
                check = subprocess.run([str(ROOT / "build/check-frame"), str(screen)], timeout=30)
                fingerprint = hashlib.sha256(screen.read_bytes()).digest()
                if ready and check.returncode == 0 and fingerprint not in fingerprints:
                    fingerprints.add(fingerprint)
                    screen.rename(output / (scene + ".png"))
                    has_image = True
                    break
                if ready:
                    time.sleep(5)
            startup = marker.parent / "PixelStoreLaunchStatus.png"
            if startup.exists():
                shutil.copyfile(startup, output / "native-startup-control.png")
            if marker.with_suffix(".png").exists():
                shutil.copyfile(marker.with_suffix(".png"), output / (scene + "-webkit-diagnostic.png"))
            if has_image:
                print("Captured playable", family, scene, flush=True)
            elif scene not in retrying:
                retrying.add(scene)
                scenes.append(scene)
                if screen.exists():
                    shutil.copyfile(screen, output / (scene + "-first-attempt.png"))
                if details.exists():
                    shutil.copyfile(details, output / (scene + "-first-attempt.json"))
                print("Retrying the failed scene after the other scenes", family, scene, flush=True)
            else:
                failures.append(scene)
                print("Full device capture failed for", family, scene, flush=True)
            stop(udid)
        if failures:
            raise RuntimeError(f"{family} did not display distinct playable captures: {failures}")
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
        sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
        arch = subprocess.check_output(["uname", "-m"], text=True).strip()
        subprocess.run(["xcrun", "--sdk", "iphonesimulator", "swiftc", "-typecheck",
                        "-target", arch + "-apple-ios16.0-simulator", "-sdk", sdk,
                        "Game/IslandStartupStatus.swift"], check=True, timeout=180)
        subprocess.run(["xcodegen", "generate"], check=True)
        subprocess.run(["xcrun", "swiftc", "check-frame.swift", "-o", "build/check-frame"], check=True, timeout=100)
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
