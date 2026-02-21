# Contributing to qr-kit

Thanks for your interest in contributing! 🎉 This document covers everything you need to get started.

---

## 🎯 Project Philosophy

**Core principles that make qr-kit different:**

- **Zero runtime dependencies.** Never add a package to `dependencies`. The whole point of this library is that it ships no third-party code. Zero supply chain risk.
- **Browser-only utilities are opt-in.** Anything that requires `document`, `canvas`, or `fetch` lives under `utils/` and is imported via deep paths — not from the root entry point. Core stays universal.
- **No build step.** Source files are plain ES modules (`.js`) and ship directly. TypeScript declarations are handwritten in `types/index.d.ts`. What you write is what ships.
- **Tests run with `node` out of the box.** No test framework, no bundler. If your change needs browser APIs, mock them or skip in Node.

---

## 🚀 Getting Started

```bash
git clone https://github.com/Yaroslav3991/qr-kit.git
cd qr-kit
npm test       # runs all 109 tests with plain Node.js — no install needed
```

There are no dev dependencies to install. `npm test` should work immediately after cloning.

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (Node 18+)
npm run test:watch

# Check bundle sizes
npm run size
```

The test runner exits with code `1` if any test fails (CI-friendly).

**Test coverage:**
- 109 tests total
- Unit tests (qr-core, layout, svg, url, link, logo)
- Property-based tests (500-10K random inputs)
- Golden file tests (regression testing)

---

## 🛠️ Making Changes

### Adding a Feature

1. **Write the code** in the appropriate file:
   - Core QR logic → `qr/qr-core.js`
   - Utilities → `utils/` (logo, link, pdf, poster, etc.)
   - React components → `components/`
   - Renderers → `renderers/` (svg, canvas)

2. **Add JSDoc** documentation in the source file.

3. **Add TypeScript declaration** in `types/index.d.ts`.

4. **Export it:**
   - Core utils → add to `index.js`
   - Deep imports → add to `package.json` exports

5. **Write tests** if the logic is testable in Node.js (no DOM required).

6. **Update README.md** with a usage example.

7. **Add entry to CHANGELOG.md** under a new `[Unreleased]` section.

8. **Test in playground** (optional but recommended):
   ```bash
   # Open playground/index.html in browser
   # Verify your feature works end-to-end
   ```

### Fixing a Bug

1. **Add a failing test** that reproduces the bug (if possible).
2. **Fix the bug.**
3. **Confirm the test passes.**
4. **Note the fix in CHANGELOG.md.**

---

## 💡 Contribution Ideas

Not sure where to start? Here are some ideas:

### Easy (good first issues)
- Add more QR URL examples to README
- Improve JSDoc comments
- Add tests for edge cases
- Fix typos in documentation
- Add code examples to playground

### Medium
- Add ECC level Q and H support (currently only L and M)
- Implement QR morphing animation
- Add more color themes to playground
- Optimize bundle size further
- Add React Native renderer

### Hard
- Implement micro QR codes
- Add structured append mode (multi-QR)
- Implement FNC1 mode for GS1
- Add QR detection/scanning

**Before starting on medium/hard tasks, open an issue to discuss the approach!**

---

## 📝 Code Style

- **Indentation:** 2 spaces
- **Quotes:** single quotes for strings
- **Semicolons:** yes
- **ESM imports:** always include `.js` extension (required for strict ESM)
- **Comments:** explain *why*, not *what*. Cite QR standard where relevant.
- **No `console.log`** in library code. `console.warn` is acceptable for deprecation.
- **Variables:** use `const` by default, `let` when needed, never `var`
- **Functions:** arrow functions for callbacks, regular functions for public APIs

**Example:**
```javascript
// Good
export function makeQr(text, { eccLevel = 'L', maxVersion = 6 } = {}) {
  const bytes = utf8Encode(text);
  // ... implementation
  return model;
}

// Avoid
export const makeQr = (text, opts) => {
  var bytes = utf8Encode(text);  // ← use const
  return model;                  // ← missing JSDoc
};
```

---

## ✅ Pull Request Checklist

Before submitting your PR, make sure:

- [ ] `npm test` passes (109 tests, exit code 0)
- [ ] New public APIs have JSDoc and a `types/index.d.ts` entry
- [ ] README.md updated if behavior or API changed
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] No new entries in `dependencies` in `package.json`
- [ ] Code follows the style guide above
- [ ] Tested in browser (if applicable)
- [ ] Bundle size impact checked (`npm run size`)

**PR title format:**
- `feat: add QR morphing animation`
- `fix: correct ECC calculation for v10`
- `docs: update logo overlay examples`
- `test: add property-based tests for masks`

---

## 🐛 Reporting Issues

Please include:

- **Minimal reproduction** — ideally a playground link or code snippet
- **Environment** — Browser/Node version, OS
- **Expected behavior** vs **actual behavior**
- **Screenshots** (if visual issue)

**Before opening an issue:**
1. Check [existing issues](https://github.com/Yaroslav3991/qr-kit/issues)
2. Try the latest version: `npm install qr-kit@latest`
3. Verify it's not a usage error (check [docs](https://github.com/Yaroslav3991/qr-kit#readme))

Open an issue at: https://github.com/Yaroslav3991/qr-kit/issues

---

## 🎨 Playground Development

The playground (`playground/index.html`) is a standalone HTML file with inlined code.

**To test playground changes:**
1. Edit `playground/index.html`
2. Open in browser (double-click or `file://` URL)
3. Test all features (QR Generator, Logo, Link Builder, PDF)
4. Verify exports work (SVG, PNG, JPEG)

**Playground uses esm.sh CDN:**
```html
<script type="importmap">
{
  "imports": {
    "qr-kit": "https://esm.sh/qr-kit@2.2.3",
    "qr-kit/": "https://esm.sh/qr-kit@2.2.3/"
  }
}
</script>
```

After npm publish, update version in importmap.

---

## 🚢 Release Process

(For maintainers)

1. Update `CHANGELOG.md` — move `[Unreleased]` to `[2.x.x] - YYYY-MM-DD`
2. Bump version: `npm version patch|minor|major`
3. Push: `git push && git push --tags`
4. Publish: `npm publish`
5. Create GitHub Release from tag
6. Update playground version on GitHub Pages

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You!

Every contribution makes qr-kit better. Whether it's a typo fix, a new feature, or a bug report — thank you for helping! 💚

**Questions?** Open a [discussion](https://github.com/Yaroslav3991/qr-kit/discussions) or reach out in an issue.