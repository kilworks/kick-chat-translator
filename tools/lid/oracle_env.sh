# Environment of the LID engine on Oracle (oracle_collect.sh, scan-run.sh): the InstaBox key and the ordo arbiter
# of ~/feed, set as feed-run.sh sets them.
F=/home/ubuntu/feed
set -a; . "$F/env"; set +a  # INSTABOX_API_KEY
export IBX_DIR="$F/instabox-farm" IBX_ARBITER=ordo IBX_DAGU= LOCALAPPDATA="$F/state" ORDO_HOST=claw-ordo \
       ORDO_KEY=/home/ubuntu/.ssh/ordo_oracle_key IBX_POOL=ibx-w1,ibx-w2,ibx-w3,ibx-w4,ibx-w5 PYTHONIOENCODING=utf-8
