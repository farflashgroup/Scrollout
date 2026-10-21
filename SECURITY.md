# Security reports

Report suspected vulnerabilities privately to **scrollout@farflash.com**. Include the affected version, Chrome version, reproduction steps, and expected impact. Use synthetic example content and omit real private screenshots, credentials, or personal information.

Do not post exploitable security details in a public issue before the report has been assessed. We will use the contact information you provide to follow up. No response-time or bug-bounty commitment is made.

Security fixes target the current release on desktop Chrome 120 and newer. Use a supported, up-to-date Chrome version for everyday browsing; Chrome 120 is tested separately for compatibility.

## Assessment on October 21, 2026

The public site consists of static HTML, CSS, JavaScript, images and downloads on Vercel. Capture and editing run in Chrome. PHP, GitLab, a Node.js application server, user accounts, a database and a screenshot-upload API are absent from the deployed application. Vercel manages the underlying CDN and TLS infrastructure; the provider's internal library versions cannot be independently attested from this repository.

The maintainer tooling used Vite 8.3.2 and Node.js 24.22.0. Vite was upgraded to 8.3.5, including its patched transitive build dependencies, and dependency installation now requires Node.js 24.22.1+ or 26.12.1+ within those major lines. Validation uses a checksummed, OpenJS-signed Node.js 24.22.1 runtime. These tools are used for development and builds and are absent from the distributed extension. Existing release ZIPs are preserved; a build-tool fix does not require users to install Node.js or run a local server.

Live TLS probes confirmed certificate validation, TLS 1.2/1.3 support, and server rejection of TLS 1.0/1.1. HTTP redirects to HTTPS. HSTS, strict script/network restrictions, `nosniff`, and framing restrictions are checked by `npm run security:site`. The checks also cover private-file exposure, public download integrity, desktop/mobile rendering and attempted inline-script/remote-resource execution. Hostname-specific TLS probes do not establish the security of every cipher, hosting component or client browser.

GitHub dependency alerts and automatic security-fix PRs, CodeQL, secret scanning and push protection are enabled for this public repository. A read-only, SHA-pinned Actions workflow runs dependency/artifact checks and browser security regressions on pushes, pull requests and a weekly schedule. Dependency updates are proposed for review; they are not automatically merged. `npm run build:check` protects existing release archives from accidental replacement during validation.

Advisory sources: [Node.js October 2026 security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), [Vite filesystem advisory](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22), [launch-editor Windows advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm). A passing audit means no known advisories were reported for the checked dependency tree at that time. This assessment is internal testing, not an independent security certification.

## Release checks

Starting in 1.0.3, an editor may fetch `https://scrollout.farflash.com/releases.json`, with automatic checks limited to every 12 hours and an opt-out in Help. The request has no body, query, credentials, cookies, or referrer. No screenshot or page information is passed to the checker. The ordinary network request still exposes request information to the host as described in the privacy policy.

This is metadata, never remote executable code. The checker bounds requests to ten seconds and responses to 8 KiB, validates Chrome-style versions and SHA-256 hashes, rejects redirects and unexpected store URLs, and derives ZIP URLs from validated versions on the fixed official domain. HTTPS and the publisher's release/hosting security protect the metadata; a hash delivered by that same host is a consistency check, not an independent signature. Chrome validates signed store updates itself. Unpacked updates require manual file replacement and Reload; no native helper or filesystem permission is introduced.

A pending Chrome update is applied only after the capture mutation queue, active-capture check, and browser extension-context check permit it. Failed checks defer installation. The checker never triggers a reload from an editor or interrupts an export. Managed installations remain subject to administrator policy.
