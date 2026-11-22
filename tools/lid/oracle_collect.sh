#!/bin/sh
# Twitch chat collection on Oracle, no PC in the loop (service lid-collect, tools/lid/lid-collect.service).
# Readers on Oracle only (0.1 % CPU each): a VM held 110 min would keep it from the video encodes (ordo never
# preempts) and use up its run time. InstaBox serves the 2-hourly rescan alone (lid_scan.py, DAG lid-scan).
# A language with 100 000 lines leaves the list (counts in ~/lid-collect/lid/raw-chat/counts.json).
# Stop: touch ~/lid-collect/lid/raw-chat/collect.STOP, then systemctl stop lid-collect.
H=/home/ubuntu/lid-collect
RAW=$H/lid/raw-chat
. "$H/oracle_env.sh"
cd "$H" || exit 1
while [ ! -f "$RAW/collect.STOP" ]; do
  python3 -u remote_collect.py --here --data "$H" --channels "$RAW/twitch-channels-2.json" --minutes 110 \
    --tag "o$(date +%m%d%H%M)-" --oracle 46 --vms "" --target 100000 >> "$RAW/remote-log.txt" 2>&1
  sleep 20
done
