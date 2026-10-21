# Why screenshot redaction needs to happen before resampling

Draft for a substantive developer article on a community that permits AI-assisted writing. Publisher: FarFlash Group Ltd., maker of Scrollout. This is about our implementation and tests, not an independent assessment of the product.

Drawing a black rectangle over a screenshot sounds straightforward. The tricky part is exporting a very long image at a different scale without letting covered source pixels affect the result.

We ran into this in Scrollout, a Manifest V3 Chrome extension with a local screenshot editor. The editor keeps geometry in original screenshot pixels. It renders only the visible region onto a viewport-sized canvas, while exports reuse the same composition logic for PNG, JPEG, clipboard images, and A4 PDF.

## The failure mode

Suppose an annotation covers a sensitive line of text. An export first downsamples the original screenshot and then draws a black rectangle in output coordinates. At a fractional scale, the resampling filter can use nearby source pixels to compute output pixels around the rectangle’s edge. A later cover can leave a boundary where values depend on the supposedly hidden source content.

This matters even if a normal visual check makes the exported rectangle look solid. The useful question is not just “Is the rectangle black?” It is “Can changing the hidden image change the exported result?”

## Mask source pixels before scaling

Scrollout’s renderer masks covered source pixels before resampling. It uses bounded temporary canvases for the relevant tile region, applies the opaque mask in source space, draws that region at the export scale, and reapplies the opaque output mask.

The original stored tile is not mutated. That allows undo inside the temporary editor, so the editable session must not be confused with a permanently redacted archive. The file the user shares is the flattened export.

The implementation lives in `src/editor/renderer.ts` and the export workflow in `src/editor/export.ts` in the public repository. Check the actual source paths before republishing this draft if files are reorganized.

## Test dependence on the hidden content

A meaningful regression test can render two source images that differ inside the covered area but are identical elsewhere. Apply the same redaction and export settings to both. The outputs should be identical wherever the hidden content could otherwise influence the result.

We exercise fractional crops, small export scales, tile boundaries, and source offsets. We also compare redacted PNG, JPEG, clipboard, and PDF image output, and check that removing the redaction still shows the original image inside the temporary editor.

That last check catches an easy alternative mistake: changing the original tile to make the export safe would break undo. Keeping source storage immutable lets the editor retain its behavior while the export renderer controls the pixels that leave the session.

## Bound the memory cost

A full-page image can be much larger than a normal screen. Scrollout limits individual image-export canvases to 16,384 pixels on an edge and 32 megapixels. Larger PNG and JPEG exports become numbered parts in a ZIP; PDF is paginated. Temporary masking work is bounded too, so redaction does not require allocating another full document-sized canvas.

The same principle applies to capture geometry: use actual scroll positions and bitmap scale, rather than assuming every tile moved by exactly one CSS viewport. Fractional browser zoom and a short final tile are useful test cases.

## Keep the user-facing promise precise

Scrollout processes captures locally and does not upload them to FarFlash. Exported files, clipboard history, operating-system sync, and later uploads are outside the temporary extension session. Closing the last editor deletes the temporary capture; that is logical cleanup, not forensic erasure from storage media or backups.

For a user sharing an image, the practical workflow is still simple: cover the whole sensitive area, export, open the saved result outside the editor, and inspect it before attaching it. For an implementer, the stronger test is to prove that the hidden source content cannot influence those exported pixels under the transformations the product supports.

Source: https://github.com/farflashgroup/Scrollout

User guide: https://scrollout.farflash.com/guides/redact-screenshots/

Disclosure: This draft was prepared with AI assistance and requires a human technical review before publication. The publisher makes Scrollout. No independent audit or universal security guarantee is claimed. DEV requires substantive on-site content and AI-assistance disclosure; do not publish this as a teaser for backlinks. Hacker News and r/opensource prohibit generated posts, so do not submit this draft there.
