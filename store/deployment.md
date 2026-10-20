# Scrollout website deployment

Publisher: **FarFlash Group Ltd.**  
Support: **scrollout@farflash.com**

- Public MIT-licensed source repository: https://github.com/farflashgroup/Scrollout
- Vercel team: `farflashs-projects`
- Vercel project: `scrollout` (`prj_voKo7vqgD3tYzAYpdybAUxImgQeh`)
- Static site source: `website/`
- Production branch: `main`
- Initial deployed commit: `bee6e9a542439071fcb5e0720d560811be90f7fe`
- Initial production deployment: `dpl_2KRKz5reZzPqB7Dw4T5Z6HZa534M` — READY
- Default Vercel alias: `scrollout-five.vercel.app`; it redirects to the custom domain after the routing update.
- Intended public address: https://scrollout.farflash.com
- Privacy policy: https://scrollout.farflash.com/privacy/
- Support: https://scrollout.farflash.com/support/

## Complete the custom domain

The domain is attached to the Vercel project and ownership is verified. GoDaddy is the authoritative DNS provider. The `scrollout` record was absent when checked on October 19, 2026.

Open https://dcc.godaddy.com/control/dns?domainName=farflash.com and add:

| Field | Value |
| --- | --- |
| Type | CNAME |
| Name / Host | `scrollout` |
| Value / Points to | `2ae4dcf2dc674b9e.vercel-dns-016.com` |
| TTL | Provider default |

This is the project-specific target returned by Vercel. Keep unrelated DNS records, including email records, unchanged. Wait for DNS propagation and Vercel's HTTPS certificate, then verify the homepage, privacy, and support URLs load without login before entering them in the store listing.

DNS editing requires access to the GoDaddy account; it has not been performed by the preparation scripts.

## Website validation

Landing, privacy, and support pages passed at widths 320, 390, 768, 1024, 1280, 1440, and 1920, plus a 1440px viewport at 2× display scaling, in Chromium 153.0.8010.12 and Chrome 120.0.6099.109.

Checks covered page identity/content, no horizontal overflow, loaded images and preserved aspect ratios, every tool-preview control, high-DPI image selection, keyboard FAQ interaction, privacy navigation, restrictive response headers, no console/page errors, and no third-party requests during local page use. The extension download matched the tested distribution ZIP byte for byte.

The website uses responsive screenshots rendered at 640×400, 1280×800, and 2560×1600. Store screenshots remain exactly 1280×800. The two requested FAQ entries and all eyebrow labels were removed; divider lines remain. The landing page explicitly states that screenshots are never uploaded to FarFlash and cannot be accessed by FarFlash through the extension.

The website work did not change the 41 tested runtime files. The distribution was subsequently repackaged to include the project's MIT license; consult `asset-provenance.json` for the current ZIP checksum. Bundled fonts and dependencies retain their own licenses.

Browser plugin was unavailable, so validation used the existing Playwright test runtime. Local evidence is outside the repository under the task's `store-2026-10-19` visualization folder. This is internal QA, not an independent security certification.

## After Chrome Web Store approval

Set `storeUrl` in `store/publisher.json` to the real listing URL, regenerate the store/site files, verify the CTA, and push the reviewed changes to `main`. Never invent a store item ID or use an unrelated listing.

## Vercel hostname restriction

`website/vercel.json` permanently redirects requests on `*.vercel.app` to the matching path on `https://scrollout.farflash.com`, preserving query strings. This prevents Vercel aliases from serving a second public copy of the website. Project deployment protection remains enabled for non-custom deployment addresses. The redirect takes effect on each new deployment; previously created immutable deployments are subject to project deployment protection.
