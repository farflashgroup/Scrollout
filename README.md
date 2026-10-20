# Scrollout

**Capture the whole page. Make it yours.**

Scrollout is a free Chrome extension for full-page screenshots and local editing. Draw, crop, highlight, add arrows, shapes or text, cover sensitive areas, and export without a paywall. It has no account, backend, analytics, or upload service.

## Install the ready-to-use extension

1. Open `chrome://extensions` in desktop Chrome 120 or newer.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `dist` folder inside this project.
4. Open Chrome's extensions menu and pin **Scrollout**.

The distribution archive is `release/Scrollout-1.0.2.zip`. Extract it first, then load the extracted folder. Chrome does not install an unpacked extension directly from a ZIP.

The archive includes `INSTALL.md` with loading instructions and a short usage guide, along with the brand guide and third-party notices.
The separate `release/Scrollout-1.0.2-source.zip` contains the source, tests, and build scripts, without dependencies or generated test reports.

For an existing unpacked installation, click **Reload** on Scrollout's card in `chrome://extensions`, then capture again. Reloading the extension expires temporary captures, so export any open work first.

## Capture and edit

Open a website and click Scrollout. Keep the source tab active while it scrolls. The icon shows progress; when capture completes, the editor opens automatically. Click the icon again or press Escape on the source page to cancel.
If the icon shows **!**, hover over it for the failure details.

- **Select:** click an annotation, drag to move it, or drag its bottom-right handle to resize. Double-click text to edit it. Delete removes the selection.
- **Crop:** drag a rectangle, then choose **Apply crop** or press Enter.
- **Draw / Highlight / Arrow:** drag on the screenshot. Use the property bar to change color, width, and opacity.
- **Shapes:** choose a rectangle or ellipse in the property bar and drag.
- **Text:** click, type, and press Enter to finish; Shift+Enter adds a line.
- **Redact:** drag an opaque black rectangle. Exported pixels are flattened; covered image data is not embedded in exported files. The original remains available for undo only while the editor session is open.

PNG preserves full quality. JPEG uses 92% quality. PDF fits the screenshot to A4 pages at up to 144 DPI. Very large PNG/JPEG images are split into numbered parts inside one ZIP, with `parts.json` describing their arrangement. Copy image writes a flattened PNG to the clipboard; oversized images need to be exported instead.

| Shortcut | Action |
| --- | --- |
| V / C / D / H | Select / Crop / Draw / Highlight |
| A / S / T / R | Arrow / Shapes / Text / Redact |
| Ctrl/⌘ Z | Undo |
| Ctrl/⌘ Shift Z | Redo |
| Delete | Delete the selected annotation |
| Escape | Cancel crop or selection; cancel capture on the source page |

## Privacy and temporary sessions

All processing happens locally. The extension requests `activeTab`, `scripting`, `storage`, and `clipboardWrite`; it does not request persistent access to all websites.

Image tiles and edits are temporarily held in the extension's IndexedDB. A reload of an open editor preserves its latest saved edits. Closing or navigating away from the last editor for a capture deletes that capture. A browser restart expires temporary sessions; restored editor tabs will ask you to capture again. Export anything you want to keep. Chrome extension reloads also expire sessions.

## Capture boundaries

- Capture covers the document length present when you start. Lazy images within that region can load; an infinite feed is not extended indefinitely.
- Independent scrolling panels and frames retain the contents currently visible inside them.
- Chrome-owned pages, the Chrome Web Store, some PDF viewers, and other protected pages may disallow full-page capture. Local files require Chrome's **Allow access to file URLs** setting.
- Changing tabs, manually scrolling, resizing the viewport, or navigating cancels an active capture and restores the source page.
- Fixed overlays appear once; sticky elements are temporarily returned to their normal flow. Responsive or continuously changing pages may need another capture after they settle.

## Development

Use Node.js 22.12+ or 24+ and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Open `http://127.0.0.1:4173/editor.html?demo=1` for the development-only sample editor. The sample is never loaded in the extension. Build regenerates the branded icons, bundles the editor and capture scripts, and writes both `dist/` and the distribution ZIP.

The unit tests check source-pixel geometry, hit testing, export splitting, message validation, and permission/CSP contracts. Browser tests verify editing, actual exported image pixels, PDF downloads, narrow layouts, and the MV3 capture pipeline. The fault-injection tests use an isolated test copy with host permissions and a test-only worker entrypoint. The production security tests load the unmodified distribution. On recent Chrome releases, action tests use `Extensions.triggerAction` to grant `activeTab` through the real extension action; Chrome 120 uses native input as described below. The distributed manifest remains minimal. Test profiles never use your normal browser profile.

Playwright Chromium is the default for repeatable browser tests. Set `SCROLLOUT_QA_CHROME` to a Chrome executable's full path to run **all** editor, capture, and security contexts in that browser. Every extension test creates and removes its own temporary profile. Capture tests use the native browser window and native display scaling: Chrome 120's screenshot API does not honor a CDP-emulated viewport. The editor and both extension scripts explicitly target Chrome 120 in the production build.

Recent Chrome releases support `Extensions.loadUnpacked` and `Extensions.triggerAction`, so the complete suite runs from the command line. For Chrome 120, the production ownership/CSP tests load the same unmodified `dist` through Chrome's startup flag. The two production action tests require native input because Chrome 120 has no action-invocation CDP command. Set `SCROLLOUT_QA_ACTION_FILE` to a temporary JSON filename to enable the native-input bridge and visible isolated windows. Each request identifies a unique window title and request ID; a native controller activates Scrollout in that window, then marks that matching request `done: true`. Chrome's existing `_execute_action` shortcut is assigned Ctrl+Shift+Y only in the temporary test profile. No production manifest changes or host permissions are used. Without a native controller, run the other 28 browser checks with `npx playwright test -g "^(?!.*(?:initial storage failure|native Chrome action))"`.

Chrome 120.0.6099.109 is available from Google's [Chrome for Testing archive](https://googlechromelabs.github.io/chrome-for-testing/). Use a separate browser folder and profile rather than replacing your installed Chrome.

## Security checks

Redaction removes covered source pixels before resampling and covers every touched output pixel. Regression tests change the hidden source image and verify identical redacted PNG, JPEG, clipboard, and PDF image data. Temporary-session tests cover reload, duplicate editors, navigation, closing the last editor, and browser-session expiry. Worker interruption and orphan cleanup stop capture and restore the source page. Initial storage failures show an action error before any source-page changes. Worker messages require valid payloads and the appropriate sender, top frame, document, and capture ID. The extension CSP restricts remote resources, frames, embedded objects, scripts, forms, and base URLs.

These checks cover the extension's local trust boundaries and exports. They do not constitute an independent penetration test or verification of every supported Chrome version.

## Chrome 120 compatibility in 1.0.2

Chrome 120's PDF downsampling could blend covered source pixels past an output-space redaction edge. Version 1.0.2 masks the original image pixels before resampling, using bounded temporary canvases, then reapplies the opaque output mask. Regression checks compare exports from different hidden source colors and exercise fractional crops, tile boundaries, source offsets, small scales, and unchanged original tiles after removing a redaction.

Capture also retains fractional visual-viewport dimensions and reconciles the native bitmap with the browser's pixel ratio within CSS rounding limits. This avoids accumulated size distortion at fractional browser zoom while preserving the bitmap-derived fallback for emulated displays.

Loading-status events are checked against the original running document, so resource loads and delayed initial-load events do not incorrectly cancel a capture. Actual navigation, including reloading the same URL, still cancels. Capture commands are bound to the injected document ID as well as the source tab and frame.

On October 19, 2026, all 30 browser checks were verified on Windows with Chrome for Testing 120.0.6099.109 and installed Chrome 155.0.8059.79, including native extension-action invocation with the unmodified production permissions. All 13 unit tests passed, and npm audit reported zero known dependency vulnerabilities. Checks cover both-axis stitching, final tiles, lazy images, page restoration, cancellation, worker interruption, storage failures, zoom, native 2× display scaling, all editing tools, crop/undo coordinates, large ZIP exports, clipboard/PDF/image output, opaque redaction pixels, CSP, sender validation, and temporary ownership. The editor build target is pinned to Chrome 120 to preserve the declared minimum when build-tool defaults change.

## Project structure

- `src/extension`: capture orchestration, page scrolling, cancellation, and cleanup.
- `src/editor`: React interface, viewport rendering, tools, history, and exports.
- `src/shared`: typed documents, tile geometry, and temporary storage.
- `public/brand`: SVG/PNG branding and Chrome toolbar icons.
- `scripts`: deterministic brand generation and packaging.
- `tests`: unit tests, editor tests, and isolated extension integration tests.

See [the brand guide](BRAND.md) for logo usage and design tokens. Bundled Inter fonts retain their SIL Open Font License in the brand assets.

## Chrome Web Store preparation and website

The submission materials are in `store/`. Open `store/START-HERE.html` for copyable listing text, permission explanations, reviewer instructions, and previews of all store graphics. `store/submission-checklist.md` lists account steps and the exact extension ZIP to upload. The store-kit ZIP is a preparation bundle, not an extension upload.

The public landing page, privacy policy, and support page are in `website/`, prepared for `https://scrollout.farflash.com`. The site has no account system, added analytics, or remote fonts/scripts. It offers the tested extension ZIP until `store/publisher.json` contains the live Chrome Web Store URL. Hosting request logs are disclosed separately from the extension's local-only screenshot processing.

```sh
node scripts/store-kit.mjs
# With npm run dev already serving on port 4173:
node scripts/store-screenshots.mjs
node scripts/website.mjs
node scripts/package-store.mjs
# Optional local website preview on port 4174:
node scripts/serve-website.mjs
```

Publisher identity and contact values are in `store/publisher.json`. Regenerate and verify the pages and listing files after changing them. Current website deployment and DNS status are recorded in `store/deployment.md`.

## Open source

Scrollout is licensed under the [MIT License](LICENSE), copyright 2026 FarFlash Group Ltd. The public repository is [farflashgroup/Scrollout](https://github.com/farflashgroup/Scrollout). Bundled fonts and third-party dependencies retain the licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance and [SECURITY.md](SECURITY.md) for private vulnerability reports.
