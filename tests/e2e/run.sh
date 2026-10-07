#!/usr/bin/env bash
# Usage: bash tests/e2e/run.sh <file.e2e.js>
# Runs Windows Node + Windows Chrome (WSL has no Chrome libs) against a local http.server.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
FILE="${1:?usage: run.sh <file.e2e.js>}"
[ -d "$HERE/node_modules" ] || (cd "$HERE" && npm install --silent) || exit 1

SERVER_PID=""
cleanup() {
    [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*hs-e2e-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
}
trap cleanup EXIT

(cd "$ROOT" && python3 -m http.server 8765 --bind 0.0.0.0 >/dev/null 2>&1 &) 
SERVER_PID=$(pgrep -f "http.server 8765" | head -1)
("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir='C:\Windows\Temp\hs-e2e-profile' about:blank >/dev/null 2>&1 &)

for _ in $(seq 1 30); do curl -sf localhost:8765/index.html >/dev/null && break; sleep 0.5; done
sleep 2
"/mnt/c/Program Files/nodejs/node.exe" "$(wslpath -w "$HERE/$FILE")"
CODE=$?
exit $CODE
