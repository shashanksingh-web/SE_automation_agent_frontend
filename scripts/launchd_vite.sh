#!/bin/bash
# launchd entrypoint for a persistent Vite dev server -- see
# ~/Library/LaunchAgents/com.dehaat.se-frontend.plist. Mirrors the backend's
# scripts/launchd_runserver.sh (SE_automation_server): KeepAlive restarts this if Vite
# ever exits, so the app on :5173 doesn't depend on the desktop app's own preview
# management keeping it alive. --strictPort so a second copy fails fast instead of
# silently coming up on :5174 while :5173 belongs to someone else.
#
# node is called by absolute path on purpose: launchd's PATH is /usr/bin:/bin:/usr/sbin:
# /sbin, and macOS privacy protection (TCC) attributes file access to the running
# executable -- this project lives under ~/Desktop, a protected folder, so
# /usr/local/bin/node must be granted Full Disk Access once (System Settings ->
# Privacy & Security -> Full Disk Access) or every start dies with EPERM, exactly as
# the backend agent did for weeks before anyone noticed (45k failed starts logged).
set -euo pipefail
cd "$(dirname "$0")/.."
exec /usr/local/bin/node node_modules/vite/bin/vite.js --strictPort
