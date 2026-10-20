# Scrollout brand guide

## Identity

Scrollout is a calm, practical tool for capturing the whole page and making it yours. The scrolling **S** is a single continuous strip with two bends: a reference to a long screenshot and the name's initial.

Use `public/brand/mark.svg` for the symbol and `public/brand/lockup.svg` for the symbol with the wordmark. The production mark has one uniform fill; the generated concept is a shape reference, not a production asset.

The optional tagline is **Capture the whole page. Make it yours.** Keep product copy direct: “Copy image,” “Apply crop,” and “Export.” Explain technical limitations only when they affect an action.

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| Teal | `#0B8F78` | Logo and primary actions |
| Ink | `#17212B` | Wordmark and primary text |
| White | `#FFFFFF` | Header, tools, dialogs, and screenshot paper |
| Workspace | `#EDF2F5` | Canvas surround |
| Coral | `#FF6359` | Default drawing color |
| Border | `#DCE3E9` | Quiet separators and control borders |
| Muted | `#687686` | Supporting text |

Use white or ink monochrome logo variants where the primary mark lacks contrast. Do not add gradients, shadows, outlines, textures, or a box around the mark.

## Typography and interface

Use locally bundled Inter. The wordmark uses weight 700 with slightly tight tracking. Product text uses 400, controls and labels 500, and important actions/headings 600–700. Use clear focus indicators, generous tool hit areas, subtle one-pixel borders, and 5–8 pixel control corners.

## Logo spacing and sizes

Keep empty space around the logo equal to at least one-quarter of the symbol width. The SVG artboards include this space. Keep the symbol's proportions; do not stretch or rotate it. Place the symbol to the left of “Scrollout” in horizontal lockups.

Toolbar exports are supplied at 16, 32, 48, and 128 pixels. Inspect the 16-pixel version at actual size rather than enlarging it. For UI headers, use the standalone symbol with native Inter text so the wordmark remains crisp and accessible.

## Files and regeneration

- `mark.svg`, `mark-white.svg`, `mark-black.svg`: scalable primary and monochrome symbols.
- Matching `mark*.png`: transparent 512-pixel raster exports.
- `lockup*.svg`: outlined horizontal primary and monochrome wordmarks, with matching transparent PNG exports.
- `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`: standard toolbar assets.
- `icon-dark-*.png`: white-symbol assets for dark backgrounds.
- `Inter-LICENSE.txt`: license for the locally bundled typeface.

Run `npm run assets` to regenerate the artwork. `npm run build` also regenerates it before packaging.
