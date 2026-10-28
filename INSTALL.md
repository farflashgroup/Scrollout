# Install Scrollout

**Capture the whole page. Make it yours.**

Keep Chrome up to date to receive browser security fixes. Chrome 120 is the minimum compatibility version.

1. Extract `Scrollout-1.0.4.zip` into a folder you will keep.
2. Open `chrome://extensions` in desktop Chrome 120 or newer.
3. Turn on **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Pin Scrollout from Chrome's extensions menu.

If you are using the source project, load its `dist` folder instead.

## Updates

Chrome Web Store installs update automatically through Chrome. Export your work and close all Scrollout editors to allow a ready update to install. Organization-managed installs follow administrator policy.

For an unpacked installation, open **Help → Updates** to see the installed version, check for a release, and download the ZIP. Export your open screenshots and close the editors. Extract the ZIP and replace the files in the **same folder you originally loaded**, then click **Reload** on Scrollout's card in `chrome://extensions`. Reload alone does not fetch new files. Source builds require pulling the latest source, running `npm ci` and `npm run build`, then Reload.

Versions 1.0.2 and earlier need this one-time manual replacement to receive the checker. Chrome does not permit extensions to overwrite their own unpacked files. Installing the [Chrome Web Store edition](https://chromewebstore.google.com/detail/scrollout/ajlhmigmaeodaedpgjmngkchnjoenmkm) provides Chrome-managed updates; export and close your work before removing the unpacked copy to avoid duplicate icons.

Starting in 1.0.3, release checks run at most every 12 hours while an editor is open, with an opt-out in Help. They fetch a fixed public version file; screenshots, edits, page URLs, and filenames are never sent. Offline checks fail quietly and editing still works. No remote executable code is fetched. Reloading the extension expires temporary captures, so export anything you want to keep first.

## Use it

Open a regular webpage and click Scrollout. Keep that tab active while the icon shows capture progress. The editor opens when the capture is complete. Click the icon again or press Escape on the webpage to cancel.
If the icon shows **!**, hover over it for the failure details.

Choose a tool from the left rail. Drag to draw, highlight, add arrows or shapes, redact, or crop. Choose **Apply crop** to finish cropping. With **Select**, drag an annotation to move it or its bottom-right handle to resize it. Delete removes the selected annotation. Click with **Text**, type, and press Enter to finish; Shift+Enter adds a new line. Double-click existing text to edit it.

Use **Undo / Redo**, the color and size controls, and **Fit** to adjust your work. **Copy image** copies a flattened PNG. **Export** saves PNG, JPEG, or A4 PDF. Very large image exports arrive as a ZIP of numbered parts, with a layout file. Oversized captures cannot be copied to the clipboard.

## Temporary and local

All capture and editing happens on your device, with no account, uploads, analytics, or paywall. Reloading an editor preserves its latest saved edits. Closing or navigating away from the last editor for a capture deletes that capture. Browser restarts and extension reloads expire temporary sessions. Export anything you want to keep.

Protected pages may disallow capture. Navigating, switching tabs, manually scrolling, or changing the viewport cancels capture. On app pages where the document does not scroll, Scrollout captures a large, fully visible main scrolling panel automatically. Small widgets, additional panels, and embedded frames keep their visible contents. Infinite feeds stop at their initial length.

## Quick check after installation

Click the pinned toolbar icon on a long regular webpage. Check that it scrolls, finishes in the editor, and restores your original position. Try drawing, cropping, and exporting. Start another capture and click the toolbar icon again to verify cancellation.

See `BRAND.md` for the supplied SVG/PNG artwork and icon usage. Third-party licenses are included in `licenses/` and `brand/Inter-LICENSE.txt`.
