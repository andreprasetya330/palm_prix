#!/usr/bin/env bash
# Start Blender with the MCP addon socket on 127.0.0.1:9876.
# The addon refuses `blender --background` because its command queue is a
# Blender timer. xvfb-run gives Blender a display so that timer runs.
set -euo pipefail

export PATH="/usr/local/bin:${HOME}/.local/bin:${PATH}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-${UID}}"
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"
export BLENDERMCP_NO_UPDATE_CHECK=1
export DISABLE_TELEMETRY=true

if python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.4); c=s.connect_ex(("127.0.0.1",9876)); s.close(); sys.exit(0 if c==0 else 1)'; then
  echo "Blender MCP socket already listening on 127.0.0.1:9876"
  exit 0
fi

exec xvfb-run -a blender
