#!/usr/bin/env bash
# Cloud Agent `start`: keep Blender MCP listening on 127.0.0.1:9876.
# Returns after the socket is up (or already was). Safe to rerun.
set -euo pipefail

export PATH="/usr/local/bin:${HOME}/.local/bin:${PATH}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-${UID}}"
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"
export BLENDERMCP_NO_UPDATE_CHECK=1
export DISABLE_TELEMETRY=true

port_open() {
  python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.4); c=s.connect_ex(("127.0.0.1",9876)); s.close(); sys.exit(0 if c==0 else 1)'
}

if port_open; then
  echo "Blender MCP already on 127.0.0.1:9876"
  exit 0
fi

if ! command -v blender >/dev/null 2>&1; then
  echo "blender not on PATH; run bash scripts/install-blender-mcp.sh" >&2
  exit 1
fi

SESSION="blender-mcp"
if command -v tmux >/dev/null 2>&1; then
  tmux has-session -t "=$SESSION" 2>/dev/null || \
    tmux new-session -d -s "$SESSION" -c /workspace -- bash -lc \
      'export BLENDERMCP_NO_UPDATE_CHECK=1 DISABLE_TELEMETRY=true XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$UID}"; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"; exec xvfb-run -a blender'
else
  nohup xvfb-run -a blender >/tmp/blender-mcp.log 2>&1 &
fi

for _ in $(seq 1 60); do
  if port_open; then
    echo "Blender MCP listening on 127.0.0.1:9876"
    exit 0
  fi
  sleep 0.5
done

echo "Blender MCP failed to open 127.0.0.1:9876" >&2
exit 1
