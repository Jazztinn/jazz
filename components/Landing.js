"use client";

import { useEffect, useRef, useState } from "react";
import { LiquidMetal } from "@paper-design/shaders-react";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

const EMPTY_CLIP = "polygon(0 0, 0 0, 0 0)";
const SCROLL_EPSILON = 0.001;

const NAV_LOGO_PATHS = [
  "M 198 509 L 0 509 L 56 398.5 L 153 398.5 C 184 398.5, 214 381, 232 349 L 348.5 111 L 205.5 109 L 264.5 0 L 515 0 L 301.5 441 C 287 466, 246 498, 198 509 Z",
  "M 406 509 L 7 509 C 1 508, -1 504, 0 498 C 2 488, 5 479, 11 469 L 222.5 32 C 231 16, 241 6, 256 0 L 384.5 0 L 254.5 244 L 188.5 387 C 188.5 394, 193 398, 200 398 L 489 398 L 406 509 Z",
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

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
  const [scrollProgress, setScrollProgress] = useState({ p: 0, q: 0 });
  const [heroMask, setHeroMask] = useState({ clipPath: "none", opacity: 1 });
  const { p, q } = scrollProgress; // p: intro reveal, q: second-screen logo trace
  const progressRef = useRef(scrollProgress);
  const rafRef = useRef(0);
  const audioCtx = useRef(null);
  const jRef = useRef(null);
  const lRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

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
      const next = {
        p: clamp01(window.scrollY / vh),
        // Logo traces in only AFTER the greeting is fully wiped and the merged
        // JL has scrolled away: start at 1.15 viewports, finish by ~1.65.
        q: clamp01((window.scrollY - vh * 1.15) / (vh * 0.5)),
      };
      const previous = progressRef.current;
      if (
        Math.abs(next.p - previous.p) < SCROLL_EPSILON &&
        Math.abs(next.q - previous.q) < SCROLL_EPSILON
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
          <div className="mono-layer" aria-hidden>
            <div
              ref={jRef}
              className="mono-img mono-piece"
              style={{ aspectRatio: "516 / 509", transform: `translate(${leftX}%, ${Y}%)`, opacity: pieceOpacity }}
            >
              <LiquidMetal image="/monogram/J_refined_geometric.svg" {...METAL} />
            </div>
            <div
              ref={lRef}
              className="mono-img mono-piece"
              style={{ aspectRatio: "490 / 509", transform: `translate(${rightX}%, ${Y}%)`, opacity: pieceOpacity }}
            >
              <LiquidMetal image="/monogram/L_refined_geometric.svg" {...METAL} />
            </div>
            <div
              className="mono-img mono-full"
              style={{ aspectRatio: "831 / 509", transform: `translate(-50%, ${Y}%)`, opacity: fullOpacity }}
            >
              <LiquidMetal image="/monogram/JL_refined_geometric.svg" {...METAL} />
            </div>
          </div>

          <div className="hero" ref={heroRef} style={heroMask}>
            <h1>hi. i&rsquo;m jazz.</h1>
            <p className="sub">developer / illustrator / writer</p>
          </div>
        </div>
      </section>

      {/* content revealed after the intro unpins */}
      <section className="content">
        <h2>work</h2>
        <p className="muted">[ placeholder — projects, case studies, and writing go here ]</p>
        <div className="cards">
          <div className="card">[ project one ]</div>
          <div className="card">[ project two ]</div>
          <div className="card">[ project three ]</div>
          <div className="card">[ project four ]</div>
        </div>
      </section>
    </div>
  );
}
