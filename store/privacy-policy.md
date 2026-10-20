# Scrollout privacy policy

Updated 2026-10-19. Publisher: FarFlash Group Ltd..

## What Scrollout does

Scrollout is a free Chrome extension that captures a page you choose, lets you edit the screenshot locally, and exports the result. It has no account system, subscription, analytics, advertising, or screenshot upload service.

## Information processed on your device

When you invoke Scrollout, it processes the visible pixels of the selected page, the page title and hostname, screenshot dimensions, capture timestamps and identifiers, source-tab and window identifiers, editor ownership, and the edits and filename you enter. Screenshot pixels may include personal or sensitive information already displayed on the selected page. Scrollout does not separately extract passwords, cookies, payment details, form fields, or background browsing history. It does not read your clipboard.

## How the information is used

This information is used only to capture and stitch the page, show and edit the screenshot, restore a temporary editor after reload, coordinate cancellation and cleanup, and create the export or clipboard image you request. Screenshots, annotations, and capture metadata are not automatically transmitted to FarFlash Group Ltd. or to third parties.

## Temporary storage and deletion

Screenshot tiles and edits are stored locally in the extension’s IndexedDB. Browser-session storage tracks capture coordination and ownership. Reloading an open editor preserves its latest saved edits. Closing or navigating away from the last editor for a capture deletes its temporary screenshot and edits. A browser restart or extension reload expires temporary sessions; orphaned data is removed when the extension next initializes. Uninstalling the extension removes its extension storage through Chrome. These are logical deletions, not a promise of forensic erasure from device backups or storage media.

## Exports, clipboard, and redaction

Files you download and images you copy are outside Scrollout’s temporary storage. They remain wherever you save, paste, or sync them until you remove or replace them using those services. Clipboard history or operating-system clipboard sync may retain copied images according to your settings. Black redaction is flattened into exported pixels; original screenshot pixels remain available for undo while the temporary editor exists. Cover the complete sensitive area before exporting.

## Permissions

activeTab provides temporary access to the page you select by invoking the extension. scripting runs the bundled capture script to measure and scroll that page and restore its styles. storage coordinates temporary capture/editor ownership. clipboardWrite writes an image only when you choose Copy image. Scrollout does not request permanent access to all sites.

## Sharing, sale, and limited use

Scrollout does not sell, rent, or share captured content for advertising, profiling, creditworthiness, or unrelated purposes. FarFlash Group Ltd. does not receive or review your screenshots through the extension. Scrollout’s use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Security

Capture and editing happen in the browser on your device using locally bundled code. Temporary storage relies on Chrome and your device’s security protections. Scrollout does not add its own encryption to locally stored screenshot tiles or edits. Anyone with access to your device or browser profile may be able to access local data; downloaded files and clipboard images are subject to the protections of their destinations.

## This website and support

The Scrollout website is hosted by Vercel, which may process ordinary request information such as IP address, browser information, and request time to deliver and secure the site. This website has no added analytics, tracking scripts, or account system. If you email support, your email provider and ours process the message and anything you voluntarily attach. We use support messages to respond and investigate the issue and retain them only as needed for support, security, or legal obligations. You can ask us to delete support correspondence using the contact below. Do not send screenshots or information you do not want to share. We do not automatically attach captures to support messages.

## Changes and contact

This policy may be updated when Scrollout’s behavior changes. The current version is published on this page with its update date. For privacy questions or requests concerning information you voluntarily send to support, contact scrollout@farflash.com. Publisher: FarFlash Group Ltd..
