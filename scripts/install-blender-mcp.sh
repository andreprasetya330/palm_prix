#!/usr/bin/env bash
# Install Blender 4.5 LTS and the MCP for Blender addon (ahujasid/blender-mcp).
# Idempotent. Does not remove other packages. Needs sudo for /opt and apt.
set -euo pipefail

BLENDER_VERSION="4.5.14"
TARBALL="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
MIRROR="https://ftp.nluug.nl/pub/graphics/blender/release/Blender4.5/${TARBALL}"
PREFIX="/opt/blender-${BLENDER_VERSION}-linux-x64"

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq \
  ca-certificates curl xz-utils xvfb xauth \
  libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libsm6 \
  libxkbcommon0 libglib2.0-0 libx11-6 libxext6

if [[ ! -x "${PREFIX}/blender" ]]; then
  tmp="$(mktemp -d)"
  curl -fL --retry 3 -o "${tmp}/${TARBALL}" "${MIRROR}"
  sudo tar -C /opt -xf "${tmp}/${TARBALL}"
  rm -rf "${tmp}"
fi
sudo ln -sfn "${PREFIX}/blender" /usr/local/bin/blender

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="${HOME}/.local/bin:${PATH}"

ADDONS="${HOME}/.config/blender/4.5/scripts/addons"
mkdir -p "${ADDONS}"
BLENDERMCP_ADDONS_DIR="${ADDONS}" uvx mcp-for-blender install-addon

# Enable the addon and save user preferences. Background mode is enough for this
# step; the socket itself needs a display (see scripts/start-blender-mcp.sh).
BLENDERMCP_NO_UPDATE_CHECK=1 blender --background --python-expr '
import addon_utils, bpy
addon_utils.enable("blender_mcp", default_set=True)
bpy.ops.wm.save_userpref()
print("blender_mcp enabled")
'

echo "Installed. Start the socket with: bash scripts/start-blender-mcp.sh"
blender --background --version
