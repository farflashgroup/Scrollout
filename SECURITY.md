# Security reports

Report suspected vulnerabilities privately to **scrollout@farflash.com**. Include the affected version, Chrome version, reproduction steps, and expected impact. Use synthetic example content and omit real private screenshots, credentials, or personal information.

Do not post exploitable security details in a public issue before the report has been assessed. We will use the contact information you provide to follow up. No response-time or bug-bounty commitment is made.

Security fixes target the current release on desktop Chrome 120 and newer. Use a supported, up-to-date Chrome version for everyday browsing; Chrome 120 is tested separately for compatibility.

## Release checks

Starting in 1.0.3, an editor may fetch `https://scrollout.farflash.com/releases.json`, with automatic checks limited to every 12 hours and an opt-out in Help. The request has no body, query, credentials, cookies, or referrer. No screenshot or page information is passed to the checker. The ordinary network request still exposes request information to the host as described in the privacy policy.

This is metadata, never remote executable code. The checker bounds requests to ten seconds and responses to 8 KiB, validates Chrome-style versions and SHA-256 hashes, rejects redirects and unexpected store URLs, and derives ZIP URLs from validated versions on the fixed official domain. HTTPS and the publisher's release/hosting security protect the metadata; a hash delivered by that same host is a consistency check, not an independent signature. Chrome validates signed store updates itself. Unpacked updates require manual file replacement and Reload; no native helper or filesystem permission is introduced.

A pending Chrome update is applied only after the capture mutation queue, active-capture check, and browser extension-context check permit it. Failed checks defer installation. The checker never triggers a reload from an editor or interrupts an export. Managed installations remain subject to administrator policy.
