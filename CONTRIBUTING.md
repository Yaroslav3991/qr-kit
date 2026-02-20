# Contributing

Thanks for your interest in contributing! This document covers everything you need to get started.

---

## Project philosophy

- **Zero runtime dependencies.** Never add a package to `dependencies`. The whole point of this library is that it ships no third-party code.
- **Browser-only utilities are opt-in.** Anything that requires `document`, `canvas`, or `fetch` lives under `utils/` and is imported via deep paths — not from the root entry point.
- **No build step.** Source files are plain ES modules (`.js`) and ship directly. TypeScript declarations are handwritten in `types/index.d.ts`.
- **Tests run with `node` out of the box.** No test framework, no bundler. If your change needs browser APIs, mock them or skip in Node.

---

## Getting started

```bash
git clone https://github.com/your-org/qr-code.git
cd qr-code
npm test       # runs all 47 tests with plain Node.js — no install needed
```

There are no dev dependencies to install. `npm test` should work immediately after cloning.

---

## Running tests

```bash
node tests/run.js
```

The test runner exits with code `1` if any test fails (CI-friendly).

---

## Making changes

### Adding a feature

1. Write the code in the appropriate file under `utils/`, `qr/`, or `components/`.
2. Add or update the JSDoc in the source file.
3. Add the TypeScript declaration in `types/index.d.ts`.
4. If it's a new public export, add it to `index.js` (core utils) or to `package.json` exports (deep-import utils).
5. Write tests if the logic is testable in Node.js (no DOM required).
6. Update `README.md` with a usage example.
7. Add an entry to `CHANGELOG.md` under a new `[Unreleased]` section.

### Fixing a bug

1. Add a failing test that reproduces the bug (if possible).
2. Fix the bug.
3. Confirm the test passes.
4. Note the fix in `CHANGELOG.md`.

---

## Code style

- **Indentation:** 2 spaces.
- **Quotes:** single quotes for strings.
- **Semicolons:** yes.
- **ESM imports:** always include `.js` extension (required for strict ESM without a bundler).
- **Comments:** prefer explaining *why*, not *what*. The QR standard is cited where relevant.
- **No `console.log`** in library code. `console.warn` is acceptable for deprecation notices.

---

## Pull request checklist

- [ ] `npm test` passes (47+ tests, exit code 0)
- [ ] New public APIs have JSDoc and a `types/index.d.ts` entry
- [ ] README updated if behaviour or API changed
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] No new entries in `dependencies` in `package.json`

---

## Reporting issues

Please include:
- A minimal reproduction (URL or code snippet)
- Browser/Node version
- What you expected vs what happened

Open an issue at: https://github.com/your-org/qr-code/issues
