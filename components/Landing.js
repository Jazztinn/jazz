"use client";

import { useEffect, useRef, useState } from "react";
import { LiquidMetal, SmokeRing } from "@paper-design/shaders-react";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

const EMPTY_CLIP = "polygon(0 0, 0 0, 0 0)";
const SCROLL_EPSILON = 0.001;
const SMOOTH_SCROLL_EASE = 0.075;
const MOUSE_WHEEL_MULTIPLIER = 1.15;

// social links — icons are SmokeRing ("fog") shaders masked to each brand glyph
const SOCIALS = [
  { id: "linkedin", href: "https://www.linkedin.com/in/jazztinn/", label: "LinkedIn" },
  { id: "github", href: "https://github.com/Jazztinn", label: "GitHub" },
  { id: "facebook", href: "https://www.facebook.com/orangelupin", label: "Facebook" },
  { id: "instagram", href: "https://www.instagram.com/kiragenome/?hl=en", label: "Instagram" },
];

// fog look for the icons
const FOG = {
  colorBack: "#00000000",
  colors: ["#2a2a2a", "#8a8a8a"],
  speed: 0.4,
  scale: 1.1,
  noiseScale: 2,
  thickness: 0.9,
  radius: 0.1,
  innerShape: 0.2,
  style: { width: "100%", height: "100%" },
};

const NAV_LOGO_PATHS = [
  "M 198 509 L 0 509 L 56 398.5 L 153 398.5 C 184 398.5, 214 381, 232 349 L 348.5 111 L 205.5 109 L 264.5 0 L 515 0 L 301.5 441 C 287 466, 246 498, 198 509 Z",
  "M 406 509 L 7 509 C 1 508, -1 504, 0 498 C 2 488, 5 479, 11 469 L 222.5 32 C 231 16, 241 6, 256 0 L 384.5 0 L 254.5 244 L 188.5 387 C 188.5 394, 193 398, 200 398 L 489 398 L 406 509 Z",
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isScrollableElement(element) {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
  return canScrollY && element.scrollHeight > element.clientHeight;
}

function closestScrollableElement(target) {
  let element = target instanceof Element ? target : target?.parentElement;
  while (element && element !== document.body && element !== document.documentElement) {
    if (isScrollableElement(element)) return element;
    element = element.parentElement;
  }
  return null;
}

function shouldSmoothWheel(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) return false;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return false;
  if (event.target?.closest?.("input, textarea, select, [contenteditable]")) return false;

  return event.deltaY !== 0;
}

function normalizeWheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 18 * MOUSE_WHEEL_MULTIPLIER;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight * MOUSE_WHEEL_MULTIPLIER;
  return event.deltaY * MOUSE_WHEEL_MULTIPLIER;
}

// work gallery items (staggered sizes/positions, like the reference)
const WORK_ITEMS = [
  {
    id: "datalink booth",
    label: "EXPLAINING THE BOOTH, 2024",
    size: "tall",
    src: "/work/datalink-booth.jpg",
    alt: "Datalink booth presentation with printed materials and neon display",
    position: "center",
  },
  {
    id: "live drawing",
    label: "DRAWING, 2024",
    size: "wide",
    src: "/work/live-drawing.jpg",
    alt: "Close-up of live marker drawing on a display board",
    position: "center",
  },
  {
    id: "group portrait",
    label: "WITH THE TEAM, 2023",
    size: "small",
    src: "/work/group-portrait.jpg",
    alt: "Group portrait outdoors beneath flowering trees",
    position: "center",
  },
  {
    id: "candid drink",
    label: "OFF THE CLOCK, 2025",
    size: "tall",
    src: "/work/candid-drink.jpg",
    alt: "Candid outdoor portrait holding a drink",
    position: "center",
  },
  {
    id: "helmet walk",
    label: "OUT & ABOUT, 2025",
    size: "wide",
    src: "/work/helmet-walk.jpg",
    alt: "Person walking outside wearing a stylized helmet",
    position: "center",
  },
];

function sameMask(a, b) {
  return a.clipPath === b.clipPath && Math.abs(a.opacity - b.opacity) < SCROLL_EPSILON;
}

// silver / chrome liquid metal, masked to each glyph SVG
const METAL = {
  colorBack: "#00000000",
  colorTint: "#cfcfcf",
  repetition: 4,
  softness: 0.3,
  shiftRed: 0,      // no chromatic dispersion (was the "glitchy" rainbow)
  shiftBlue: 0,
  distortion: 0.12,
  contour: 0.8,
  speed: 0.5,
  fit: "contain",
  scale: 1,
  style: { width: "100%", height: "100%" },
};

export default function Landing() {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);
  // mount the heavy WebGL shaders only AFTER the loading screen is gone, so
  // their (main-thread) init doesn't freeze the loader animation.
  const [ready, setReady] = useState(false);
  const [scrollProgress, setScrollProgress] = useState({ p: 0, q: 0, f: 0, wx: 0 });
  const [heroMask, setHeroMask] = useState({ clipPath: "none", opacity: 1 });
  const { p, q, f, wx } = scrollProgress; // p: intro reveal, q: logo trace, f: JL bottom-up fade, wx: work track offset
  const progressRef = useRef(scrollProgress);
  const rafRef = useRef(0);
  const smoothScrollRef = useRef({ current: 0, target: 0, raf: 0, active: false });
  const audioCtx = useRef(null);
  const workRef = useRef(null);
  const trackRef = useRef(null);
  const jRef = useRef(null);
  const lRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    // Loader fires "jl:loaded" once page assets are in; it then waits a beat
    // before fading, so the shaders are processed by the time they're revealed.
    const onLoaded = () => setReady(true);
    window.addEventListener("jl:loaded", onLoaded, { once: true });
    const t = setTimeout(() => setReady(true), 9000); // fallback
    return () => {
      window.removeEventListener("jl:loaded", onLoaded);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = smoothScrollRef.current;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function stopSmoothScroll() {
      state.active = false;
      if (state.raf) {
        window.cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }

    function tick() {
      const diff = state.target - state.current;
      if (Math.abs(diff) < 0.5) {
        state.current = state.target;
        window.scrollTo(0, state.target);
        stopSmoothScroll();
        return;
      }

      state.current += diff * SMOOTH_SCROLL_EASE;
      window.scrollTo(0, state.current);
      state.raf = window.requestAnimationFrame(tick);
    }

    function startSmoothScroll() {
      if (!state.raf) {
        state.raf = window.requestAnimationFrame(tick);
      }
    }

    function onWheel(event) {
      if (motionQuery.matches || !shouldSmoothWheel(event)) return;

      if (closestScrollableElement(event.target)) return;

      event.preventDefault();
      if (!state.active) {
        state.current = window.scrollY;
        state.target = window.scrollY;
        state.active = true;
      }
      state.target = clamp(state.target + normalizeWheelDelta(event), 0, maxScroll());
      startSmoothScroll();
    }

    function syncNativeScroll() {
      if (state.active) return;
      state.current = window.scrollY;
      state.target = window.scrollY;
    }

    syncNativeScroll();
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", syncNativeScroll, { passive: true });
    window.addEventListener("resize", syncNativeScroll);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", syncNativeScroll);
      window.removeEventListener("resize", syncNativeScroll);
      stopSmoothScroll();
    };
  }, []);

  // WebAudio sine blip (reused from old Desktop.js)
  function blip() {
    if (muted) return;
    try {
      if (!audioCtx.current)
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  // Reveal animation runs over the first viewport of scrolling (while the
  // intro is pinned). p: 0 = split, 1 = merged. Past p=1 the intro unpins and
  // the page scrolls normally to the content below.
  useEffect(() => {
    function updateScrollProgress() {
      rafRef.current = 0;
      const vh = window.innerHeight;
      // work gallery: vertical scroll through the section drives a horizontal
      // translate of the track (cards move left). Lando-style scroll carousel.
      let wx = 0;
      const sec = workRef.current, track = trackRef.current;
      if (sec && track) {
        // carousel starts a bit earlier, before the nav logo forms (1.15 vh).
        const startY = vh * 1.15;
        const dist = sec.offsetHeight - vh;
        const prog = dist > 0 ? clamp01((window.scrollY - startY) / dist) : 0;
        wx = prog * Math.max(0, track.scrollWidth - window.innerWidth);
      }
      const next = {
        p: clamp01(window.scrollY / vh),
        // Logo traces in only AFTER the greeting is fully wiped and the merged
        // JL has scrolled away: start at 1.55 viewports.
        q: clamp01((window.scrollY - vh * 1.55) / (vh * 0.5)),
        // merged JL fades to white from the bottom up (1.0 -> 1.6 viewports).
        f: clamp01((window.scrollY - vh * 1.0) / (vh * 0.6)),
        wx,
      };
      const previous = progressRef.current;
      if (
        Math.abs(next.p - previous.p) < SCROLL_EPSILON &&
        Math.abs(next.q - previous.q) < SCROLL_EPSILON &&
        Math.abs(next.f - previous.f) < SCROLL_EPSILON &&
        Math.abs(next.wx - previous.wx) < 0.5
      ) {
        return;
      }
      progressRef.current = next;
      setScrollProgress(next);
    }

    function requestScrollUpdate() {
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(updateScrollProgress);
      }
    }

    updateScrollProgress();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
    return () => {
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // J + L slide inward to their exact positions within the full JL, then the
  // merged JL cross-fades in over them (aligned, so no ghosting/doubling).
  const meet = Math.min(1, p / 0.85);
  // Pieces stay fully opaque while they slide (so they always ERASE the text
  // they cover). Once they reach their slots they form the JL exactly, so we
  // CROSS-FADE pieces -> merged JL over a window (aligned, so it reads as a
  // smooth dissolve rather than a hard swap).
  const merged = p >= 0.97; // clip fully closed by here
  const sw = clamp01((p - 0.85) / 0.12); // 0.85 (pieces aligned) -> 0.97 dissolve
  const pieceOpacity = 1 - sw;
  const fullOpacity = sw;

  // Permanent erase: clip the hero to the band BETWEEN the J and the L. Each
  // clip edge is the actual bbox DIAGONAL of its glyph (J: top-right→bottom-left
  // right edge; L: top-right→bottom-left left edge), so both edges run exactly
  // parallel to the "/" strokes and hug the real shapes. Computed in pixels and
  // mapped into the hero's local box. Band closes as the pieces meet.
  useEffect(() => {
    function commitHeroMask(next) {
      setHeroMask((current) => (sameMask(current, next) ? current : next));
    }

    const j = jRef.current, l = lRef.current, h = heroRef.current;
    if (!j || !l || !h) return;
    if (merged) {
      commitHeroMask({ clipPath: EMPTY_CLIP, opacity: 0 });
      return;
    } // fully wiped
    const vh = window.innerHeight;
    const hr = h.getBoundingClientRect();
    const jr = j.getBoundingClientRect();
    const lr = l.getBoundingClientRect();
    const yTop = -0.4 * vh, yBot = 1.4 * vh; // extend past the hero box
    // Slope of the glyph's slanted stroke, measured from the SVG paths
    // (J right edge (515,0)->(246,498); L left edge (256,0)->(0,498)):
    // dx/dy ~= -0.52. Both glyphs share it, so the edges stay parallel (//).
    const slope = -0.52;
    // left edge = J's right stroke, through its top-right corner (515,0)
    const xL = (y) => jr.right + slope * (y - jr.top);
    // right edge = L's left stroke, through its bottom-left corner (0,498)
    const xR = (y) => lr.left + slope * (y - lr.bottom);
    // Once the two diagonals cross (shapes touch / JL closes), the band would
    // become a self-intersecting bowtie that leaks text through the JL's inner
    // channel. Close the clip to zero as soon as they meet at the text line.
    // Fade the remaining (un-wiped) text out as the gap closes, so it doesn't
    // vanish abruptly when the clip snaps shut. Opacity tracks the gap width.
    const vw = window.innerWidth;
    const yMid = hr.top + hr.height / 2;
    const gap = xR(yMid) - xL(yMid);
    const opacity = clamp01(gap / (0.28 * vw));
    if (gap <= 0.03 * vw) {
      commitHeroMask({ clipPath: EMPTY_CLIP, opacity });
      return;
    }
    const px = (x, y) => `${(x - hr.left).toFixed(1)}px ${(y - hr.top).toFixed(1)}px`;
    commitHeroMask({
      clipPath:
        `polygon(${px(xL(yTop), yTop)}, ${px(xR(yTop), yTop)}, ` +
        `${px(xR(yBot), yBot)}, ${px(xL(yBot), yBot)})`,
      opacity,
    });
  }, [p, merged]);
  const Y = -44; // near-centered, a touch low (matches reference)
  const leftX = -170 + meet * 90;  // J: peek from left edge → its slot in the JL (-80%)
  const rightX = 69 - meet * 84;   // L: peek from right edge → its slot in the JL (-15%)

  return (
    <div className="frame">
      <div className="grid-page" />

      <div className="wordmark">
        jazztinn
        <br />
        legaspi
      </div>

      {/* top-center logo: traces its outline (curves and all) as the second
          screen scrolls in, then fills solid black. */}
      <svg
        className="nav-logo"
        viewBox="0 0 831 509"
        aria-hidden
        style={{ opacity: q > 0 ? 1 : 0 }}
      >
        {NAV_LOGO_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            transform={i === 1 ? "translate(341,0)" : undefined}
            pathLength="1"
            fill="#000"
            fillOpacity={Math.max(0, Math.min(1, (q - 0.7) / 0.3))}
            stroke="#000"
            strokeWidth="14"
            strokeDasharray="1"
            strokeDashoffset={1 - q}
          />
        ))}
      </svg>

      <div className="toolbar">
        <button
          className="icon-btn"
          onClick={() => { blip(); setDark((d) => !d); }}
          aria-label="toggle theme"
        >
          {dark ? <MoonIcon /> : <SunIcon />}
        </button>
        <button
          className="icon-btn"
          onClick={() => setMuted((m) => !m)}
          aria-label="toggle sound"
        >
          <SoundIcon muted={muted} />
        </button>
      </div>

      {/* pinned intro: monogram reveal + hero. Unpins after one viewport. */}
      <section className="intro">
        <div className="pin">
          {/* slanted text marquee that drifts as the J/L converge — top row
              right, bottom row left, tilted opposite to the wipe ("\"). */}
          <div className="intro-text" aria-hidden>
            <div className="intro-text-row" style={{ transform: `translateX(${p * 40}vw)` }}>
              <div className="intro-text-scroll right">
                <span>lorem ipsum dolor sit amet&nbsp;·&nbsp;consectetur adipiscing elit&nbsp;·&nbsp;</span>
                <span>lorem ipsum dolor sit amet&nbsp;·&nbsp;consectetur adipiscing elit&nbsp;·&nbsp;</span>
              </div>
            </div>
            <div className="intro-text-row" style={{ transform: `translateX(${-p * 40}vw)` }}>
              <div className="intro-text-scroll left">
                <span>sed do eiusmod tempor incididunt&nbsp;·&nbsp;ut labore et dolore&nbsp;·&nbsp;</span>
                <span>sed do eiusmod tempor incididunt&nbsp;·&nbsp;ut labore et dolore&nbsp;·&nbsp;</span>
              </div>
            </div>
          </div>

          <div className="mono-layer" aria-hidden>
            <div
              ref={jRef}
              className="mono-img mono-piece"
              style={{ aspectRatio: "516 / 509", transform: `translate(${leftX}%, ${Y}%)`, opacity: pieceOpacity }}
            >
              {ready && <LiquidMetal image="/monogram/J_refined_geometric.svg" {...METAL} />}
            </div>
            <div
              ref={lRef}
              className="mono-img mono-piece"
              style={{ aspectRatio: "490 / 509", transform: `translate(${rightX}%, ${Y}%)`, opacity: pieceOpacity }}
            >
              {ready && <LiquidMetal image="/monogram/L_refined_geometric.svg" {...METAL} />}
            </div>
            <div
              className="mono-img mono-full"
              style={{
                aspectRatio: "831 / 509",
                transform: `translate(-50%, ${Y}%)`,
                opacity: fullOpacity,
                // fade to white from the bottom up as the user scrolls down.
                // f=0 -> fully solid (transparent edge below the shape); f=1 -> gone.
                maskImage: `linear-gradient(to top, transparent ${f * 125 - 25}%, #000 ${f * 125}%)`,
                WebkitMaskImage: `linear-gradient(to top, transparent ${f * 125 - 25}%, #000 ${f * 125}%)`,
              }}
            >
              {ready && <LiquidMetal image="/monogram/JL_refined_geometric.svg" {...METAL} />}
            </div>
          </div>

          <div className="hero" ref={heroRef} style={heroMask}>
            <h1>hi. i&rsquo;m jazz.</h1>
            <p className="sub">developer / illustrator / writer</p>
            <div className="socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.id}
                  className="social"
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                >
                  <span
                    className="social-fog"
                    style={{
                      maskImage: `url(/icons/${s.id}.svg)`,
                      WebkitMaskImage: `url(/icons/${s.id}.svg)`,
                    }}
                  >
                    {ready && <SmokeRing {...FOG} />}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* work: vertical scroll drives a horizontal carousel of staggered cards */}
      <section className="work" ref={workRef}>
        <div className="work-pin">
          <div
            className="work-track"
            ref={trackRef}
            style={{ transform: `translate3d(${-wx}px, 0, 0)` }}
          >
            <div className="work-intro">
              <h2>daily life</h2>
              <p className="muted">
                candid moments — booth talks,
                <br />
                drawing, meetings, and in-between
              </p>
            </div>
            {WORK_ITEMS.map((it) => (
              <figure key={it.id} className={`work-item work-item--${it.size}`}>
                <span className="work-cap">{it.label}</span>
                <img
                  className="work-photo"
                  src={it.src}
                  alt={it.alt}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: it.position }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
