#!/usr/bin/env bash
set -euo pipefail

: "${EC2_HOST:?Set EC2_HOST to your EC2 hostname or IP address.}"

EC2_USER="${EC2_USER:-ec2-user}"
EC2_APP_PATH="${EC2_APP_PATH:-/opt/mobile/mobile-web-application}"
SSH_PORT="${SSH_PORT:-22}"

rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'ios/Pods/' \
  --exclude 'android/app/build/' \
  --exclude 'android/app/.cxx/' \
  --exclude 'vendor/' \
  --exclude '.DS_Store' \
  -e "ssh -p $SSH_PORT" \
  ./ "$EC2_USER@$EC2_HOST:$EC2_APP_PATH/"
