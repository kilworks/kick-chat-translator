#!/bin/sh
# RETIRED 2026-11-22 (no PC in the loop): the collection runs on Oracle, oracle_collect.sh and
# lid_scan.py; the scheduled task LidCollect is disabled. Kept for the record.
# Whole chat collection, autonomous: run by the scheduled task LidCollect (at logon, and by hand with
# schtasks /Run /TN LidCollect). Each part starts only if it is not already running, then loops.
#   remote  Oracle + the 5 InstaBox VMs (collect_loop.sh), each VM only when no job holds it
#   twitch  PC IRC reader, 2 h runs appended to twitch-1.jsonl
#   kick    PC Kick capture (headed browser), one file per batch, backs off on refusals itself
#   scan    rescan of the public Twitch directory every 2 h (twitch_dir.mjs), lists read by the next runs
#   dash    the console dashboard window
# Stop everything: create <data>/lid/raw-chat/collect.STOP (remove it before restarting).
HERE=$(cd "$(dirname "$0")" && pwd)
RAW=${RAW:?set RAW to <data>/lid/raw-chat}
PARTS=${*:-scan remote twitch kick dash}
export PYTHONIOENCODING=utf-8

running() {  # a process whose command line matches $1 already runs
  powershell.exe -NoProfile -c "if (Get-CimInstance Win32_Process | ? { \$_.CommandLine -match '$1' -and \$_.CommandLine -notmatch 'collect_all|Get-CimInstance' }) { exit 0 } else { exit 1 }"
}

twitch() {
  while [ ! -f "$RAW/collect.STOP" ]; do
    echo "--- $(date '+%H:%M') lecteur PC relance" >> "$RAW/twitch-log.txt"
    python -u "$HERE/twitch_irc.py" --channels "$RAW/twitch-channels.json" --out "$RAW/twitch-1.jsonl" --hours 2 >> "$RAW/twitch-log.txt" 2>&1
    sleep 30
  done
}

scan() {
  cd "$HERE/../.." || exit 1
  while [ ! -f "$RAW/collect.STOP" ]; do
    echo "--- $(date '+%H:%M') rescan" >> "$RAW/scan-log.txt"
    node "$HERE/twitch_dir.mjs" --out "$RAW/twitch-channels-2.json" --pc-out "$RAW/twitch-channels.json" >> "$RAW/scan-log.txt" 2>&1
    sleep 7200
  done
}

kick() {
  cd "$HERE/../.." || exit 1
  while [ ! -f "$RAW/collect.STOP" ]; do
    echo "--- $(date '+%H:%M') lot autonome" >> "$RAW/kick-log.txt"
    node "$HERE/kick_capture.mjs" --out "$RAW/kick-$(date +%m%d%H%M).jsonl" --rounds 27 --per-lang 40 --interval 60 >> "$RAW/kick-log.txt" 2>&1
    sleep 120
  done
}

for p in $PARTS; do
  case $p in
    scan)   running 'twitch_dir.mjs' || scan & ;;
    remote) running 'collect_loop.sh|remote_collect.py' || sh "$HERE/collect_loop.sh" & ;;
    twitch) running 'twitch_irc.py --channels .*twitch-channels.json' || twitch & ;;
    kick)   running 'kick_capture.mjs' || kick & ;;
    dash)   running 'watch_collect.py' || cmd.exe //c start "Collecte LID" python "$(cygpath -w "$HERE/watch_collect.py")" ;;
  esac
done
wait
