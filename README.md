# Jazztinn Legaspi — Portfolio

The personal portfolio site of **Jazztinn Legaspi** (developer / illustrator / writer).
A single, scroll-driven landing experience built around a reveal of the **JL monogram**,
a WebGL fluid-cursor "blob," an orange liquid flood, and a closing *Reach Out* section.

## Tech stack

- **Next.js 14** (App Router) + **React 18**, plain JavaScript (no TypeScript).
- **No CSS framework** — a single global stylesheet (`app/globals.css`) driven by
  CSS custom properties for theming.
- **WebGL** effects: a fluid-cursor simulation (`ogl`) and dithering/fog shaders
  (`@paper-design/shaders-react`).
- Static-export friendly; every route prerenders.

## Getting started

```bash
npm install
npm run dev      # local dev server at http://localhost:3000
npm run build    # production build — run this to verify any change compiles
npm run start    # serve the production build
```

## The experience

A liquid **loader** traces the JL outline, then floods it solid (bottom-up waves)
before fading into the page. Scrolling then moves through:

1. **Hero** — grid-paper page, "hi. i'm jazz." with split J/L letterforms bleeding
   in from the edges.
2. **JL monogram** — the split halves fade out as the full faded monogram scales in.
3. **Work gallery** — a horizontal carousel of photos with literary pull-quotes that
   highlight on scroll and are revealed in contrast by the fluid blob.
4. **Orange flood** — a liquid waterline rises over the gallery into the outro.
5. **Reach Out** — closing contact section with an animated signature.

### Interactive chrome

- **Wordmark** (top-left) — click to toggle the fluid **blob** on in every scroll state.
- **Menu** (top-right) — full-screen panel; nav links route to `/work`, `/experience`,
  `/projects`, `/contact`, `/faq` (currently empty dot-grid placeholder pages).
- **Toolbar** (bottom-right) — light/dark theme toggle + sound (blip) mute toggle.
- **Music** (bottom-left) — orange button that plays/pauses a background track.

> **Audio:** the music button expects a file at `public/audio/music.mp3`.
> Drop a track there to enable playback.

## Project structure

```
app/
  layout.js          # root layout, metadata, Quicksand font
  page.js            # <Loader/> + <Landing/>
  globals.css        # ALL styling: theme vars, fonts, hero, monogram, gallery, loader…
  work/ experience/  # empty dot-grid placeholder routes
  projects/ contact/ faq/
components/
  Landing.js         # main client component (scroll, theme, menu, blob/music toggles)
  Loader.js          # liquid flood loader
  FluidCursor.js     # WebGL fluid-cursor blob (reveals/contrasts quotes)
  Icons.js           # toolbar SVG icons
assets/              # source fonts + monogram SVGs (source of truth, not served)
public/
  fonts/ monogram/   # served copies of the above
  work/              # gallery + placeholder photos
  handwriting/       # signature SVG
  icons/             # social icons
archive/             # previous OS-desktop site — reference only, not built
```

## Theming

Colors come from CSS variables on `:root` (light) and `[data-theme="dark"]` (dark,
a neutral black scheme matching the menu panel). The theme is applied via
`document.documentElement.dataset.theme` from the toolbar toggle.

## Fonts

- **Hangyaboly** (hero) and **Bodoni FLF** (quotes/subtitle) — `@font-face` in
  `globals.css`, served from `public/fonts/`.
- **Quicksand** (wordmark) — `next/font/google` in `app/layout.js`.

Source font and SVG files live in `assets/`; their browser-served copies live in
`public/`. Keep the two in sync.
