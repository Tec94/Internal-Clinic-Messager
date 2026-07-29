#!/bin/sh
set -eu

freshclam --quiet
install -d -o clamav -g clamav /run/clamav
clamd --config-file=/app/clamd.conf &
exec node /app/server.mjs
