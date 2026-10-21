# Website and launch validation - October 20, 2026

- Production deployment `db9f926` reached READY on Vercel; subsequent ownership-verification deployment adds one static Google verification file.
- All 13 public content routes passed at widths 320, 390, 768, 1024, 1440, and 1920 in Chromium 153.0.8010.12: 78 live page/viewport combinations. Local checks passed the same layouts before deployment.
- Checked one H1 per page, canonical and description metadata, JSON-LD parsing and exact CSP hashes, loaded images with preserved aspect ratios, internal links and anchors, download links, and absence of middle-dot text. No page or console errors.
- Checked keyboard skip navigation, guide-to-article links, table of contents, installation CTA, all four home preview controls, and responsive 2x image selection.
- Inspected the mobile guide hub, desktop article, and all three launch artwork sizes. Fixed the decorative symbol's small-screen aspect ratio.
- Public extension download is 604,463 bytes with SHA-256 `5ab3aae82a8eb2e29f88e44ef06044e777c288d5ab8816ec227b218dc927d580`. It is the previously tested 1.0.2 ZIP; no extension runtime changes were made for marketing.
- Press ZIP downloaded successfully and contains 34 entries, including logos, screenshots, three SVG/PNG artwork sizes, license, and usage notes.
- Sitemap has 13 content routes. Google Search Console ownership verified by its static HTML file; submitted sitemap returned Success and 13 discovered pages. Discovery is not a guarantee that each page is indexed or ranked.
- Public `/store/START-HERE.html`, `/site-config.json`, `/privacy/content.json`, and `/.git/config` return 404.
- `scrollout-five.vercel.app` still returns 308 to the custom domain, preserving the path and query. The immutable production deployment still redirects to Vercel authentication.
- Fresh Chrome 120 website rerun could not launch: both saved 120 executable attempts returned `spawn UNKNOWN`. It is **not** included in today's passing browser count. The previously completed Chrome 120 extension validation remains documented in the main README; this is a separate website check limitation.

Detailed screenshots and the Playwright report are retained outside the public source in the task's `marketing-2026-10-20` evidence folder. The Browser plugin is unavailable in this session, so existing Playwright was used for website QA. Authenticated third-party submission UI was handled through CUA.

To rebuild public content and launch assets:

```sh
node scripts/marketing-assets.mjs
node scripts/website.mjs
node scripts/package-store.mjs
```

Keep `website/google41361d58f7a08956.html` in place. Google uses it to verify the FarFlash publisher account's ownership. Its contents are intentionally public and contain no login credential. Maintain the Vercel project's root directory as `website`, so internal submission helpers and marketing tracking documents are never deployed.
