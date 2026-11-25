"""Print the cause and symbols of an Xcode build-service crash, when available."""
from pathlib import Path
import json
root = Path.home() / "Library/Logs/DiagnosticReports"
for path in sorted(root.glob("*BuildService*.ips"))[-2:]:
    lines = path.read_text().splitlines()
    try:
        record = json.loads("\n".join(lines[1:]))
    except ValueError:
        continue
    print("Apple build service", record.get("exception"), record.get("termination"))
    for thread in record.get("threads", []):
        if thread.get("triggered"):
            print([f.get("symbol") for f in thread.get("frames", [])[:12]])
