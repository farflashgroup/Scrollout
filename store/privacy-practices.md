# Privacy practices: paste-ready answers

## Single purpose

Capture the user-selected web page as a full-page screenshot, edit it locally, and export the finished image or PDF.

## activeTab

Used only after the user invokes Scrollout on the active tab. It allows the extension to capture visible page tiles and read the selected page title and hostname to label the temporary capture. It does not grant persistent access to all websites.

## scripting

Injects a bundled, temporary capture script into the selected page. It measures the document, scrolls through the initial page area, handles fixed/sticky elements, and restores page styles and the original scroll position after capture or cancellation.

## storage

Uses chrome.storage.session for capture coordination, browser-session identity, and editor ownership. Screenshot tiles, document metadata, and edits are held temporarily in the extension's local IndexedDB so the editor can reload and export. Data is not synced or sent to a server.

## clipboardWrite

Writes a flattened PNG to the clipboard only when the user clicks Copy image in the editor. Scrollout does not read clipboard contents.

## Remote code

Choose **No, I am not using remote code.** All executable code, fonts, icons, and dependencies used by the extension are bundled.

## Data usage

Disclose **Website content** (screenshot pixels and annotations) and **Web history** to the extent the current form includes the captured page's title/hostname. This is on-demand capture metadata, not background history collection. Local-only handling still requires disclosure under Google's policy.

Screenshots can contain information already visible on the page, including personal communications or sensitive information. Scrollout does not separately extract credentials, identity, payments, health records, browsing history, form fields, cookies, or keystrokes. Match any more specific current form questions to this behavior; do not claim no user data is handled merely because the data stays local.

Suggested explanation:

> Scrollout locally processes screenshot pixels, the captured page title and hostname, temporary capture identifiers, and user edits only to provide the requested full-page capture, editor, and export. It does not upload screenshots, collect background browsing activity, read the clipboard, or run analytics. Temporary captures expire when their last editor closes or leaves the capture, and after a browser restart. User-exported files and clipboard images remain under the user's control.

The three limited-use certifications are supported by the current implementation: no sale or transfer for unrelated purposes; no use beyond the single purpose; no creditworthiness or lending use. Review the exact declarations before certifying them as the publisher.

Privacy URL: https://scrollout.farflash.com/privacy/

The landing page and support/privacy pages are separate websites hosted by Vercel. Hosting providers may process ordinary web request logs. The extension itself does not contact this website to process captures.
