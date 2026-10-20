# Contributing to Scrollout

Use Node.js 24+ (or 22.12+) and npm. Run `npm ci`, then `npm run dev` for the development editor at `http://127.0.0.1:4173/editor.html?demo=1`.

Before submitting a change, run the checks that cover it:

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

See README.md for extension test profiles and the optional Chrome 120 native-input bridge. Run browser tests using isolated profiles, never your everyday browser profile. Do not commit browser profiles, screenshots containing personal information, credentials, or generated QA artifacts.

Keep captures local and temporary. New features must not add telemetry, remote executable code, paid tools, persistent browsing access, or a screenshot upload service. Explain changes to permissions, capture correctness, temporary-session ownership, and export pixels in the pull request. Add meaningful regression coverage for behavior changes.

The public landing, privacy, and support pages are in `website/`. Store listing files and artwork are in `store/`; generation commands are in README.md. Use the approved logo and Inter font assets. Preserve third-party license notices.

Open an issue with reproduction steps for ordinary bugs. For a suspected security issue, follow SECURITY.md instead of posting sensitive details publicly.

Contributions are provided under the project's MIT license. Bundled fonts and dependencies retain their respective licenses.
