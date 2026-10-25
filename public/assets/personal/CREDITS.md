# Optional personal, noncommercial models

These local assets are game extracts, **not CC0** and not cleared for commercial use. Original Mario Kart 8 artwork and designs are copyright Nintendo. This optional asset set is used for the owner's personal, noncommercial project following their explicit request.

- **Teddy Buggy** — Mario Kart 8 (Wii U), uploaded by **BillyGaming964**. https://models.spriters-resource.com/wii_u/mariokart8/asset/353826/
- **Hot Air Balloon (Sweet Sweet)** — Mario Kart 8 (Wii U), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/wii_u/mariokart8/asset/314945/
- **Aqua Cup Ride** — Mario Kart 8 (Wii U), uploaded by **Centrixe the Dodo**. https://models.spriters-resource.com/wii_u/mariokart8/asset/316567/

Source-site usage terms: https://www.spriters-resource.com/page/tou/. Contributor credit is not a transfer of Nintendo's rights. These models must not be represented as original Palm Prix artwork or commercially reusable assets.

The original downloads in `assets/source/personal/`, converted GLBs in this directory, and the local manifest are excluded from Git. The public source checkout keeps the original/CC0 fallback art. Local conversion scripts are versioned for reproducibility.

Changes: FBX to embedded-texture GLB conversion, removal of overlapping LODs, smooth material setup and world-scale normalization. The personal player kart combines Teddy Buggy's textured body with Kenney Car Kit CC0 wheels and seated racer; Kenney source and license are documented in `../racers/CREDITS.md` and `../racers/LICENSE.txt`. The teacup platform and ride animation are original Palm Prix integration.

To restore a personal setup, download each archive through its source page, extract under `assets/source/personal/sweet-balloon`, `aqua-cups`, and `teddy-buggy`, then run the preparation scripts with Blender. Create `manifest.json` with the balloon/cups/kart paths and set `VITE_PERSONAL_ASSETS=true` in `.env.local`; restart or rebuild Vite. See the repository README for details.
