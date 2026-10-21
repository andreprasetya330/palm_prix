#!/usr/bin/env bash
# stdio MCP server. It talks to the Blender addon socket; it does not launch Blender.
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
export DISABLE_TELEMETRY=true
export BLENDER_HOST="${BLENDER_HOST:-localhost}"
export BLENDER_PORT="${BLENDER_PORT:-9876}"
exec uvx mcp-for-blender "$@"
