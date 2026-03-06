#!/usr/bin/env bash
set -euo pipefail

: "${EC2_HOST:?Set EC2_HOST to your EC2 hostname or IP address.}"

EC2_USER="${EC2_USER:-ec2-user}"
EC2_APP_PATH="${EC2_APP_PATH:-/opt/mobile/mobile-web-application}"
SSH_PORT="${SSH_PORT:-22}"

if [ "$#" -eq 0 ]; then
  echo "Usage: EC2_HOST=<host> $0 <command ...>" >&2
  exit 1
fi

printf -v remote_cmd '%q ' "$@"
remote_cmd="${remote_cmd% }"

ssh -p "$SSH_PORT" "$EC2_USER@$EC2_HOST" "cd '$EC2_APP_PATH' && $remote_cmd"
