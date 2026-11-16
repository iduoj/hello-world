#!/usr/bin/env bash
# Print the paper every morning on macOS (launchd).
#
#   scripts/schedule-macos.sh 06:30     install, or change the time
#   scripts/schedule-macos.sh --remove  stop printing
#
# If the Mac is asleep at that time, launchd runs the job as soon as it wakes.
# To have it wake itself a few minutes early:  sudo pmset repeat wakeorpoweron MTWRFSU 06:25:00
set -euo pipefail

LABEL="com.morningpaper.daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PY="$REPO/.venv/bin/python"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "--remove" ]]; then
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the daily print job."
  exit 0
fi

TIME="${1:-06:30}"
if [[ ! "$TIME" =~ ^([01]?[0-9]|2[0-3]):([0-5][0-9])$ ]]; then
  echo "Usage: $0 HH:MM   (24-hour time, e.g. 06:30)" >&2
  exit 1
fi
HOUR=$((10#${BASH_REMATCH[1]}))
MINUTE=$((10#${BASH_REMATCH[2]}))

[[ -x "$PY" ]] || { echo "Missing $PY - set up the virtualenv first (see README)." >&2; exit 1; }
[[ -f "$REPO/config.toml" ]] || { echo "Missing $REPO/config.toml - copy config.example.toml first." >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$REPO/out"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PY</string><string>-m</string><string>paper</string><string>--print</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>$MINUTE</integer></dict>
  <key>StandardOutPath</key><string>$REPO/out/schedule.log</string>
  <key>StandardErrorPath</key><string>$REPO/out/schedule.log</string>
</dict>
</plist>
EOF

launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
printf 'Scheduled: %s prints every day at %02d:%02d.\n' "$LABEL" "$HOUR" "$MINUTE"
echo "Print one right now to test:  launchctl kickstart $DOMAIN/$LABEL"
echo "Log: $REPO/out/schedule.log"
