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
- Verified routing deployment: `dpl_49kYGxXSKRRoBNxsyXhmoEmEWtEd`, commit `7f635df5ab99af1593d423c7ec5935388aeada6c` — READY
- Default Vercel alias: `scrollout-five.vercel.app`; it redirects to the custom domain after the routing update.
- Live public address: https://scrollout.farflash.com
- Privacy policy: https://scrollout.farflash.com/privacy/
- Support: https://scrollout.farflash.com/support/

## Custom domain completed

The domain is attached to the Vercel project and ownership is verified. The following CNAME was saved in GoDaddy, the authoritative DNS provider, and verified against its authoritative nameserver:

| Field | Value |
| --- | --- |
| Type | CNAME |
| Name / Host | `scrollout` |
| Value / Points to | `2ae4dcf2dc674b9e.vercel-dns-016.com` |
| TTL | 1 hour (saved provider value) |

This is the project-specific target returned by Vercel. Vercel reports a matching CNAME, no conflicts, and `misconfigured: false`. The homepage, privacy policy, support page, and extension download load publicly over HTTPS. Other DNS records were left unchanged. No further DNS entry is needed for this deployment.

The deployed site returns HTTP 404 for `/store/START-HERE.html`, `/site-config.json`, `/privacy/content.json`, and `/.git/config`. Submission helpers and generator inputs remain outside the website directory; they are development files, not public website pages.

## Website validation

Landing, privacy, and support pages passed at widths 320, 390, 768, 1024, 1280, 1440, and 1920, plus a 1440px viewport at 2× display scaling, in Chromium 153.0.8010.12 and Chrome 120.0.6099.109.

The same responsive checks subsequently passed against the live custom domain in Chrome 120. Checks covered page identity/content, no horizontal overflow, loaded images and preserved aspect ratios, every tool-preview control, high-DPI image selection, keyboard FAQ interaction, privacy navigation, restrictive response headers, no console/page errors, and no third-party requests during page use. The extension download matched the tested distribution ZIP byte for byte.

The website uses responsive screenshots rendered at 640×400, 1280×800, and 2560×1600. Store screenshots remain exactly 1280×800. The two requested FAQ entries and all eyebrow labels were removed; divider lines remain. The landing page explicitly states that screenshots are never uploaded to FarFlash and cannot be accessed by FarFlash through the extension.

The website work did not change the 41 tested runtime files. The distribution was subsequently repackaged to include the project's MIT license; consult `asset-provenance.json` for the current ZIP checksum. Bundled fonts and dependencies retain their own licenses.

Browser plugin was unavailable, so validation used the existing Playwright test runtime. Local evidence is outside the repository under the task's `store-2026-10-19` visualization folder. This is internal QA, not an independent security certification.

## After Chrome Web Store approval

Set `storeUrl` in `store/publisher.json` to the real listing URL, regenerate the store/site files, verify the CTA, and push the reviewed changes to `main`. Never invent a store item ID or use an unrelated listing.

## Vercel hostname restriction

`website/vercel.json` permanently redirects requests on `*.vercel.app` to the matching path on `https://scrollout.farflash.com`, preserving query strings. This prevents Vercel aliases from serving a second public copy of the website. Project deployment protection remains enabled for non-custom deployment addresses. The redirect takes effect on each new deployment; previously created immutable deployments are subject to project deployment protection.

Verified on the production alias after deployment: `/`, `/privacy/?check=keep`, `/support/`, a screenshot asset, and the extension ZIP all return HTTP 308 to the corresponding custom-domain URL. The previous immutable deployment URL and the project/branch deployment aliases return a Vercel sign-in redirect rather than website content.
