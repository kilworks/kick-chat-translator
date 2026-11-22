#!/bin/sh
# Dagu DAG lid-scan on Oracle (tools/lid/lid-scan.yaml): rescan of the Twitch directory on a free InstaBox VM.
. /home/ubuntu/lid-collect/oracle_env.sh
cd /home/ubuntu/lid-collect && exec python3 -u lid_scan.py
