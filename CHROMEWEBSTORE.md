# Chrome Web Store listing - Scrollout

Last updated: October 28, 2026 (America/Toronto).

## Release and submission status

Source/ZIP version: **1.0.6**, also uploaded and submitted for Chrome Web Store review on October 28, 2026. The dashboard confirms **Pending review**, package revision **00004**, with **automatic publication enabled**. This replaces the cancelled 1.0.4 review. The last verified publicly installable store version is 1.0.2. See [submission-state.json](store/submission-state.json) for saved status and archive hashes; preparing a ZIP does not change review or publication status.

## Store listing

- Name: Scrollout
- Short description: Capture the whole page. Draw, crop, highlight, redact, and export — free and on your device.
- Category: Productivity / Tools
- Primary language: English
- Price: Free
- Single purpose: Capture the user-selected web page as a full-page screenshot, edit it locally, and export the finished image or PDF.

Detailed description:

Capture the whole page. Make it yours.

Scrollout takes a full-page screenshot of the tab you choose, then opens a simple editor. Every editing tool and export format is free. There is no account, subscription, or paywall. Scrollout is open source under the MIT license: https://github.com/farflashgroup/Scrollout

CAPTURE THE WHOLE PAGE
Click the Scrollout toolbar icon and keep the page active while it scrolls. Capture includes horizontal overflow and stops at the page dimensions measured at the start. Click the icon again or press Escape on the source page to cancel.

MAKE YOUR EDITS
Draw, highlight, add arrows, rectangles, ellipses, and text. Move, resize, or delete annotations. Crop to the area you need, adjust color and line width, and undo or redo edits. Use solid black redaction to cover sensitive areas before export.

EXPORT WITHOUT A PAYWALL
Save PNG, JPEG, or a paginated A4 PDF. Copy the full edited screenshot from the toolbar or right-click menu. Very large PNG and JPEG exports are delivered as numbered parts in one ZIP; oversized images must be exported instead of copied.

LOCAL AND TEMPORARY
Screenshots and edits are processed on your device. Scrollout has no analytics or screenshot upload service. Temporary captures survive editor reloads, but closing or leaving the last editor for a capture deletes its temporary screenshot and edits. Restarting Chrome expires temporary sessions. Download anything you want to keep. Downloaded files and clipboard copies remain under your control.

GOOD TO KNOW
Desktop Chrome 120 or newer. Chrome-owned pages and other protected pages can restrict capture. On app pages where the document does not scroll, Scrollout captures a large, fully visible main scrolling panel. Small widgets, other panels, and embedded frames keep their visible contents. Infinite feeds stop at their initial length. Switching tabs, scrolling manually, navigating, or changing the viewport interrupts capture.

Support: scrollout@farflash.com
Privacy: https://scrollout.farflash.com/privacy/

The generated dashboard copy is also available in [listing.json](store/listing.json) and [listing.md](store/listing.md).

## Graphics and assets

| Asset | Dimensions | Status |
|---|---|---|
| [assets/01-full-page-editor-1280x800.png](store/assets/01-full-page-editor-1280x800.png) | 1280 x 800 PNG | Ready |
| [assets/02-annotate-1280x800.png](store/assets/02-annotate-1280x800.png) | 1280 x 800 PNG | Ready |
| [assets/03-crop-1280x800.png](store/assets/03-crop-1280x800.png) | 1280 x 800 PNG | Ready |
| [assets/04-redact-1280x800.png](store/assets/04-redact-1280x800.png) | 1280 x 800 PNG | Ready |
| [assets/05-export-1280x800.png](store/assets/05-export-1280x800.png) | 1280 x 800 PNG | Ready |
| [assets/promo-marquee-1400x560.png](store/assets/promo-marquee-1400x560.png) | 1400 x 560 PNG | Ready |
| [assets/promo-small-440x280.png](store/assets/promo-small-440x280.png) | 440 x 280 PNG | Ready |
| [assets/store-icon-128.png](store/assets/store-icon-128.png) | 128 x 128 PNG | Ready |

Existing store images remain representative of the editor. A refreshed menu screenshot can illustrate the new right-click operation; this change does not require new icons or branding.

## Permissions justification

| Permission | Justification |
|---|---|
| activeTab | Used only after the user invokes Scrollout on the active tab. It allows the extension to capture visible page tiles and read the selected page title and hostname to label the temporary capture. It does not grant persistent access to all websites. |
| scripting | Injects a bundled, temporary capture script into the selected page. It measures the document, scrolls through the initial page area, handles fixed/sticky elements, and restores page styles and the original scroll position after capture or cancellation. |
| storage | Uses chrome.storage.session for capture coordination, browser-session identity, and editor ownership. Screenshot tiles, document metadata, and edits are held temporarily in the extension's local IndexedDB so the editor can reload and export. Data is not synced or sent to a server. Local storage also keeps the update-check preference, last release metadata, and a pending Chrome update version; these contain no capture data. |
| clipboardWrite | Writes a flattened PNG to the clipboard only when the user clicks Copy image in the editor. Scrollout does not read clipboard contents. |

The four permissions are unchanged. No persistent website access or clipboard-read permission is requested. The right-click menu is part of the local editor.

## Privacy and data use

Website content (screenshot pixels and annotations) and the selected page's title and hostname are processed locally to provide capture, editing, temporary restoration, and export. Closing or leaving the last owning editor deletes that capture; browser restart/extension reload expires temporary sessions. Downloaded exports and clipboard data remain under the user's control.

Screenshots, edits, filenames, page URLs, and capture metadata are never uploaded. Optional release checks request one public version file without credentials, cookies, referrers, a body, or capture data. Ordinary hosting request information may be processed. No backend, analytics, advertising, accounts, sale of data, or remote executable code is used.

The previously authorized limited-use certifications remain unchanged: no sale or unrelated transfers, no unrelated purposes, and no creditworthiness/lending use. The publisher must authorize any new legal declaration; this release does not submit one.

Privacy policy: https://scrollout.farflash.com/privacy/

## Distribution and developer

- Publisher: FarFlash Group Ltd.
- Contact/support: scrollout@farflash.com
- Homepage: https://scrollout.farflash.com/
- Support page: https://scrollout.farflash.com/support/
- Visibility: Public
- Regions: All regions
- Source/license: https://github.com/farflashgroup/Scrollout - MIT
- Store: https://chromewebstore.google.com/detail/scrollout/ajlhmigmaeodaedpgjmngkchnjoenmkm

## Version history

| Version | Date | Changes | Recorded status |
|---|---|---|---|
| 1.0.6 | October 28, 2026 | Right-click Copy image copies the entire edited crop; keyboard and narrow-window support | Submitted; pending review; automatic publication |
| 1.0.5 | October 28, 2026 | Faster capture and editor loading | ZIP/source released; not submitted |
| 1.0.4 | October 28, 2026 | Main scrolling panel capture and stable editor sizing | Review cancelled; superseded by 1.0.6 |
| 1.0.2 | Previously verified | Initial published release with redaction hardening | Publicly installable at last verification |

## Review notes and validation

The clipboard regression is verified by right-clicking the screenshot, choosing Copy image, and actually pasting into a separate page. Tests check the entire cropped image at native resolution, offscreen pixels, annotations, opaque fractional redactions, and equality with PNG export. The unmodified production build passes using its original permissions.

On Windows with Chromium 153.0.8010.12, all 31 unit and 49 browser tests pass. The dependency audit reports zero known vulnerabilities. Chrome 120 remains the build target; these new clipboard/menu flows have not been runtime-tested on Chrome 120. This is internal QA, not independent security certification.

Known limits: protected Chrome pages can reject capture; independent small widgets/frames retain visible contents; infinite feeds stop at their initial dimensions. Very large images exceed clipboard limits and require PNG parts or PDF export. Export work before reloading the extension.

This internal submission document stays outside the public website and extension package. Full reviewer instructions and saved privacy answers remain in [store/](store/).
