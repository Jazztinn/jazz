# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

The **portfolio website of Jazztinn Legaspi** (developer / illustrator / writer).
The live site is a minimal, single-page landing built around a scroll-reveal
**JL monogram**:

- **State 1 (top):** grid-paper page, "jazztinn legaspi" wordmark top-left,
  theme + sound toggles top-right, centered hero "hi. i'm jazz." with the
  "developer / illustrator / writer" subtitle. Two faint split letter shapes
  (J left, L right) bleed in from the edges.
- **State 2 (after scrolling):** the split halves fade out as the full faded
  **JL monogram** fades/scales into the center behind the hero text.

The previous OS-style "desktop" UI is preserved under `archive/` for reference
and is **not** part of the build.

## Stack

- Next.js 14 (App Router), React 18, plain JavaScript (no TypeScript).
- No Tailwind / CSS framework — one global stylesheet, plain CSS variables.
- Static export-friendly; all pages prerender.

## Fonts

- **Hangyaboly** (hero "hi. i'm jazz.") and **Bodoni FLF** (subtitle) loaded via
  `@font-face` in `globals.css` from `/public/fonts/`.
- **Quicksand** (wordmark) loaded via `next/font/google` in `app/layout.js`.
- Source font/SVG files live in `assets/` (source of truth); browser-served
  copies live in `public/fonts/` and `public/monogram/`. Keep the two in sync.

## Commands

```bash
npm install
npm run dev      # local dev server
npm run build    # production build — run this to verify changes
```

## Layout

```
app/
  layout.js      # root layout, metadata, Quicksand font
  page.js        # renders <Landing/>
  globals.css    # ALL styling (theme vars, grid bg, @font-face, hero, monogram)
components/
  Landing.js     # client component: scroll progress, theme/sound toggles, monogram layers
  Icons.js       # sun/moon/sound toolbar SVG icons
assets/          # source fonts + all 5 monogram SVGs (not served directly)
public/
  fonts/         # served font files (@font-face targets)
  monogram/      # served SVGs used by Landing.js
archive/         # previous OS-desktop site — reference only, not built
```

## Behavior

- Single page. Scroll progress `p` (0→1) is computed in `Landing.js` from
  `window.scrollY` over ~70vh and drives the monogram cross-fade: split halves
  fade/drift out, full monogram fades + scales in.
- Top-left: "jazztinn legaspi" wordmark. Top-right toolbar: light/dark theme
  toggle + sound toggle. Theme set via `document.documentElement.dataset.theme`.
- Toggle sound is a WebAudio sine blip (`blip()`), suppressed when muted.

## Styling conventions

- Theme via CSS vars on `:root` and `[data-theme="dark"]`.
- Flat look: grid-paper page inside a light frame, no gradients, faint
  grayscale monogram tinted via `filter: grayscale(1) opacity(...)` + per-layer
  opacity so it stays subtle in both themes.

## Editing notes

- Hero copy / labels live in `components/Landing.js`.
- Swap monogram art by replacing the SVGs in `public/monogram/` (and mirror in
  `assets/monogram/`).
- After any change, run `npm run build` to confirm it compiles.
