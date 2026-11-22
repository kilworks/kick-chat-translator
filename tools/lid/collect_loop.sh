#!/bin/sh
# RETIRED 2026-11-22 (kil: no PC in the loop): the collection runs on Oracle, oracle_collect.sh and
# lid_scan.py; the scheduled task LidCollect is disabled. Kept for the record.
# Endless remote collection, detached from any Claude session: 110 min cycles (InstaBox run limit), new tag each cycle.
# sh tools/lid/collect_loop.sh [ibx-w1,ibx-w2]   (all five VMs by default, 16 readers on Oracle; stop: create <data>/lid/raw-chat/collect.STOP)
VMS=${1:-ibx-w1,ibx-w2,ibx-w3,ibx-w4,ibx-w5}
RAW=/c/Users/kil/kct-data/lid/raw-chat
cd "$(dirname "$0")"
while [ ! -f "$RAW/collect.STOP" ]; do
  PYTHONIOENCODING=utf-8 python -u remote_collect.py --channels "$RAW/twitch-channels-2.json" --minutes 110 \
    --tag "c$(date +%m%d%H%M)-" --vms "$VMS" --oracle 16 >> "$RAW/remote-log.txt" 2>&1
  sleep 20
done
