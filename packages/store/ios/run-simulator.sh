#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
for stage in compile phone tablet purchases; do
  python3 check-simulator.py "$stage"
done
