# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

The **portfolio website of Jazztinn Legaspi** (developer / illustrator / writer).
A single, scroll-driven landing page. Top to bottom the scroll moves through:

1. **Hero** — grid-paper page, "jazztinn legaspi" wordmark top-left, hero
   "hi. i'm jazz." with the "developer / illustrator / writer" subtitle. Two
   faint split letter shapes (J left, L right) bleed in from the edges.
2. **JL monogram** — the split halves fade out as the full faded JL monogram
   fades/scales into the center behind the hero text.
3. **Work gallery** — a horizontal carousel of photos with literary pull-quotes.
   Quotes highlight on scroll (per-phrase orange wipe) and are revealed in
   contrast by the fluid blob.
4. **Orange flood** — a liquid waterline rises over the gallery into the outro.
5. **Reach Out** — closing contact section with an animated signature + waves.

A liquid **loader** (`components/Loader.js`) traces the JL outline then floods it
solid (bottom-up waves) before fading the page in.

The previous OS-style "desktop" UI is preserved under `archive/` for reference
and is **not** part of the build.

## Stack

- Next.js 14 (App Router), React 18, plain JavaScript (no TypeScript).
- No Tailwind / CSS framework — one global stylesheet, plain CSS variables.
- WebGL: `ogl` (fluid cursor) + `@paper-design/shaders-react` (dithering/fog).
- Static-export-friendly; all routes prerender.

## Fonts

- **Hangyaboly** (hero "hi. i'm jazz.") and **Bodoni FLF** (subtitle + quotes)
  loaded via `@font-face` in `globals.css` from `/public/fonts/`.
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
  page.js        # <Loader/> + <Landing/>
  globals.css    # ALL styling (theme vars, grid bg, @font-face, hero, monogram,
                 #   gallery, quote wipes, loader, swoop, flood, reach-out, chrome)
  work/ experience/ projects/ contact/ faq/   # empty dot-grid placeholder routes
components/
  Landing.js     # main client component: scroll progress, theme/sound/music/blob
                 #   toggles, menu modal, monogram + gallery + flood + reach-out
  Loader.js      # liquid-flood JL loader
  FluidCursor.js # WebGL fluid-cursor blob (quote reveal + contrast)
  Icons.js       # sun/moon/sound toolbar SVG icons
assets/          # source fonts + monogram SVGs (not served directly)
public/
  fonts/         # served font files (@font-face targets)
  monogram/      # served monogram SVGs
  work/          # gallery + placeholder photos
  handwriting/   # signature SVG
  icons/         # social icons
  audio/         # background music — drop music.mp3 here (not committed yet)
archive/         # previous OS-desktop site — reference only, not built
```

## Behavior

- Scroll progress is computed in `Landing.js` from `window.scrollY` (in viewport
  units) and drives everything via CSS vars set on the `.frame` element: monogram
  cross-fade (`--p/--q/--f`), gallery track x, quote wipes (`--quote-wipeN`),
  the swoop line (`--swoop`), the flood (`--reach-y`, slosh/warp), etc.
- **Wordmark** (top-left): click toggles the fluid **blob** active in every scroll
  state (`blobForced` → `FluidCursor`'s `forced` prop, which bypasses its scroll
  gate). Otherwise the blob auto-activates only across the gallery window.
- **Menu** (top-right button): full-screen panel. Nav links are `next/link`s to
  `/work /experience /projects /contact /faq` (empty dot-grid pages for now).
  Card rail shows carousel photos.
- **Toolbar** (bottom-right): light/dark theme toggle + sound mute toggle. Theme
  set via `document.documentElement.dataset.theme`. `dark` defaults off and is
  not persisted, so the loader always renders in light mode.
- **Music** (bottom-left, orange button): toggles an `<audio loop>` at
  `/audio/music.mp3` (file not present yet).
- Sound feedback is a WebAudio sine blip (`blip()`), suppressed when muted.

## Styling conventions

- Theme via CSS vars on `:root` and `[data-theme="dark"]`. Dark is a **neutral
  black** scheme matching the menu panel (page `#111`, ink `#f2f2f2`).
- Page chrome (wordmark, nav-logo, toolbar, scrollbar) uses
  `mix-blend-mode: difference` so it auto-adapts to any background/theme.
- Surfaces that should follow the theme must use the vars
  (`--page`, `--ink`, `--muted`, `--grid`, `--frame`) — avoid hardcoded
  `#fff` / `#111` on content.

## Editing notes

- Hero copy / labels / gallery items / quotes live in `components/Landing.js`
  (`WORK_ITEMS`, `MENU_PLACEHOLDERS`, etc.).
- Quote highlight wipes: each phrase is a `work-quote__hi--N` span masked by a
  `--quote-wipeN` var set per-frame in `Landing.js`. Add a new pair to add a wipe.
  Blob-contrast clones of quotes are generated automatically.
- Swap monogram art by replacing the SVGs in `public/monogram/` (and mirror in
  `assets/monogram/`).
- After any change, run `npm run build` to confirm it compiles.
