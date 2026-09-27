# ARIA AI — Mobile Optimization Guide

Complete mobile-responsive layer for the ARIA post-discharge platform. Desktop is
untouched; phones and tablets get a purpose-built 2D experience.

---

## 1. What was built

| File | Role |
|---|---|
| `public/mobile-responsive.css` | All breakpoints, 2D fallback layout, bottom nav/drawer/sheet styles, touch targets, safe areas |
| `public/js/mobile.js` | Device detection, force-2D on mobile, bottom nav + step chip, hamburger drawer, swipe navigation, dashboard accordion, long-press copy, password toggle, camera triggers, system theme |
| `public/service-worker.js` | Offline shell + runtime caching (network-first HTML/API, cache-first statics) |
| `public/manifest.webmanifest` + `public/icons/*` | PWA install support |
| `public/index.html` | Mobile chrome markup, camera-capture inputs, upload progress UI, conditional three.js, async fonts |
| `public/app.js` | XHR upload with real progress + retry, image thumbnail preview, SW registration |
| `server/src/app.js` | Dependency-free gzip (zlib) + static cache headers |

### Breakpoints (mobile-responsive.css)

| Range | Target | Behavior |
|---|---|---|
| ≤767px (base) | phones | 2D story, bottom nav, full-bleed sheets, 44px+ targets |
| ≤479px | small phones | tighter type, single-column vitals |
| 480–767px | standard phones | 2-col vitals/cards |
| 768–1023px | tablets | 3D allowed, touch-tuned panels |
| 1024–1439px | desktop | unchanged (touch refinements only) |
| ≥1440px | large desktop | readability caps |

### How mobile mode activates

1. **JS detection** (`index.html` head + `mobile.js`): mobile UA, iPadOS
   (Mac + multi-touch), screen ≤480px, or viewport ≤480px at load →
   `body.mobile` + the WebGL stage stays hidden and three.js is never downloaded.
2. **CSS safety net** (`@media max-width:767px`): `#gl`, vignette, scan, grain
   get `display:none` even without JS detection.
3. Phones always open the **2D flat home** (the existing scroll story) via the
   same `dimensionToggle` pathway the desktop 2D button uses — no duplicated logic.

Deliberate perf decisions on phones:
- `three.js` (~300KB) is **not loaded at all** (`document.write` gate in index.html).
  The inline scene script now guards its two top-level `new THREE.*` uses, so it
  boots cleanly without the library.
- The 3.6MB intro video and 5.9MB theme music are `preload="none"`; mobile skips
  the video entirely (CSS ECG splash, ~1.6s).
- `backdrop-filter`/heavy blurs are stripped on `body.mobile`.
- DOM nodes for 3D decorations are hidden with CSS `display:none`, never removed.

### Mobile UI map

- **Bottom nav (5 sections)**: Intake · Report · Calendar · Loop · Account —
  48px targets, active state follows scroll via IntersectionObserver.
- **Step chip**: `1/5 · INTAKE` floats above the nav and updates while scrolling.
- **Hamburger drawer**: Doctors, Hospital, Ask ARIA, theme, music (3D entry only
  on tablets ≥768px).
- **Gestures**: swipe ←/→ between the 5 sections; swipe on the calendar grid
  changes month; long-press a patient name/contact to copy it.
- **Dashboard**: cards become an accordion (Patient details / Risk factors /
  Care plan open by default; activity, medicines, extracted text fold away).
  Print and Clear history still work.
- **Sheets**: popped cards and the calendar become full-screen sheets
  (`100dvh`, safe-area aware).
- **Upload**: `📷 Take a photo` (`capture="environment"`) + `🖼 Photo library`
  buttons feed the same `#documentInput`, so analyze/drag/preview flows are
  unchanged. Uploads show a real progress bar (bytes, %, ETA) with a one-tap
  **retry** on failure; 15MB client cap mirrors the server's `MAX_FILE_BYTES`.
- **Forms**: 16px inputs (no iOS zoom), 44/48px targets, password visibility
  toggle, `aria-expanded`/`role` on all custom controls.

---

## 2. Testing checklist

### Emulated (done during development — all passing)

- [x] 390×844 (iPhone 12): 2D home, bottom nav, step chip, drawer, accordion,
      demo-patient analysis (HIGH 82/100), report sheet, calendar sheet
- [x] Desktop 1440×900: 3D strip renders, no mobile chrome, no layout drift
- [x] No horizontal overflow at 390px on `/`, `/doctors.html`, `/hospital.html`
- [x] gzip verified (`/api/demo-patients` 2856→595 B; HTML/CSS compressed;
      MP3/MP4 pass through untouched; HEAD requests report true sizes)
- [x] Cache headers verified (media 1y immutable, css 7d, js 1d, json 1h, html no-cache)

### Real devices (before release)

- [ ] iPhone SE (375×667) — intake → analyze → report → calendar
- [ ] iPhone 12/13 (390×844) — camera capture button opens rear camera
- [ ] iPad / Android tablet (768–1024) — 3D allowed; drawer shows "City version (3D)"
- [ ] Pixel 4/5 (412×915) — swipe between sections; long-press copies phone
- [ ] Android tablet (1024) — dashboard two-column behavior
- [ ] Desktop 1920 — visual parity with the pre-mobile design
- [ ] iOS Safari 12+/Chrome Android 90+/Samsung Internet 14: login, upload, calendar
- [ ] Offline: load home once, go airplane-mode, reload → shell renders from SW
- [ ] Install prompt: Android Chrome → "Add to Home Screen" works with manifest icons

### Lighthouse audit

```bash
npx lighthouse http://localhost:5000 --preset=perf --form-factor=mobile \
  --screenEmulation.mobile --chrome-flags="--headless" --output=html --output-path=./lighthouse-mobile.html
```

Targets: LCP < 2.5s · FCP < 1.5s · CLS < 0.1 · TTI < 3.5s · JS < 100KB gzipped.
(Phones now skip ~300KB of three.js and ~9.5MB of media preload, which is what
makes the mobile budget reachable.)

---

## 3. Deployment notes

- **No new dependencies.** Gzip uses Node's built-in `zlib`. `package.json` unchanged.
- **Render**: nothing to change — `npm start` serves everything as before. Gzip +
  cache headers apply automatically on the same port.
- **Service worker versioning**: bump `VERSION` in `public/service-worker.js`
  whenever you change cached assets, then deploy. HTML is network-first, so
  normal deploys propagate without a version bump; the bump is for shell assets.
- **HTTPS requirement**: the SW registers only on `https:` or `localhost`.
- **Database**: unchanged (MongoDB Atlas, non-SRV URI on this machine).

### Rollout / monitoring

- Watch Core Web Vitals in the field: PageSpeed Insights API or `web-vitals`
  snippet (add `npm i web-vitals` later if you want analytics — deliberately not
  added now to keep zero new deps).
- Server: log `Content-Encoding` hits if you want compression adoption stats.
- Client errors: the mobile layer is fully try/catch-guarded — a mobile.js
  failure degrades to the desktop layout rather than a blank page.

---

## 4. Maintenance gotchas

1. **Three.js is desktop-only now.** Any new top-level `new THREE.*` in the
   index.html inline script must be guarded (`typeof THREE !== "undefined"`),
   or phones will throw before `window.ariaStation` is created (this exact bug
   was found and fixed in the camera-state + raycaster initializers).
2. **`styles.css` is dead legacy** — nothing links it. Safe to delete later.
3. **Bottom-nav section targets** are wired to flat-story slot IDs
   (`flatIntakeSlot`, `flatGrow`, `flatCalSlot`, `flatLoopSlot`). If you rename
   those IDs, update `SECTIONS` in `mobile.js`.
4. **Cache headers vs dev iteration**: JS is cached 1 day by the browser —
   hard-reload (Ctrl+Shift+R) while developing, or bump `?v=` in the script src.
5. The copilot SSE proxy sits **before** the gzip middleware — keep that order
   or the chat stream will buffer.
