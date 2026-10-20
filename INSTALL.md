# Install Scrollout

**Capture the whole page. Make it yours.**

1. Extract `Scrollout-1.0.2.zip` into a folder you will keep.
2. Open `chrome://extensions` in desktop Chrome 120 or newer.
3. Turn on **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Pin Scrollout from Chrome's extensions menu.

If you are using the source project, load its `dist` folder instead.

To update an existing unpacked installation, click **Reload** on Scrollout's card in `chrome://extensions`. Export open work first: reloading the extension expires its temporary captures.

## Use it

Open a regular webpage and click Scrollout. Keep that tab active while the icon shows capture progress. The editor opens when the capture is complete. Click the icon again or press Escape on the webpage to cancel.
If the icon shows **!**, hover over it for the failure details.

Choose a tool from the left rail. Drag to draw, highlight, add arrows or shapes, redact, or crop. Choose **Apply crop** to finish cropping. With **Select**, drag an annotation to move it or its bottom-right handle to resize it. Delete removes the selected annotation. Click with **Text**, type, and press Enter to finish; Shift+Enter adds a new line. Double-click existing text to edit it.

Use **Undo / Redo**, the color and size controls, and **Fit** to adjust your work. **Copy image** copies a flattened PNG. **Export** saves PNG, JPEG, or A4 PDF. Very large image exports arrive as a ZIP of numbered parts, with a layout file. Oversized captures cannot be copied to the clipboard.

## Temporary and local

All capture and editing happens on your device, with no account, uploads, analytics, or paywall. Reloading an editor preserves its latest saved edits. Closing or navigating away from the last editor for a capture deletes that capture. Browser restarts and extension reloads expire temporary sessions. Export anything you want to keep.

Protected pages may disallow capture. Navigating, switching tabs, manually scrolling, or changing the viewport cancels capture. Independently scrolling panels and embedded frames keep their visible contents; infinite feeds stop at their initial document length.

## Quick check after installation

Click the pinned toolbar icon on a long regular webpage. Check that it scrolls, finishes in the editor, and restores your original position. Try drawing, cropping, and exporting. Start another capture and click the toolbar icon again to verify cancellation.

See `BRAND.md` for the supplied SVG/PNG artwork and icon usage. Third-party licenses are included in `licenses/` and `brand/Inter-LICENSE.txt`.
