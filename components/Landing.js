"use client";

import { useEffect, useRef, useState } from "react";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

export default function Landing() {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);
  const [p, setP] = useState(0); // intro reveal progress 0..1
  const [q, setQ] = useState(0); // second-screen progress 0..1 (logo trace)
  const [heroClip, setHeroClip] = useState("none");
  const [heroOpacity, setHeroOpacity] = useState(1);
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
    function onScroll() {
      const vh = window.innerHeight;
      setP(Math.min(1, Math.max(0, window.scrollY / vh)));
      // Logo traces in only AFTER the greeting is fully wiped and the merged
      // JL has scrolled away: start at 1.15 viewports, finish by ~1.65.
      setQ(Math.min(1, Math.max(0, (window.scrollY - vh * 1.15) / (vh * 0.5))));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // J + L slide inward to their exact positions within the full JL, then the
  // merged JL cross-fades in over them (aligned, so no ghosting/doubling).
  const meet = Math.min(1, p / 0.85);
  // pieces stay fully opaque the whole slide (so they always ERASE the text
  // they cover). Once they reach their slots they form the JL exactly, so we
  // hard-swap to the merged SVG — no opacity fade, no see-through window.
  const merged = p >= 0.85;
  const pieceOpacity = merged ? 0 : 1;
  const fullOpacity = merged ? 1 : 0;

  // Permanent erase: clip the hero to the band BETWEEN the J and the L. Each
  // clip edge is the actual bbox DIAGONAL of its glyph (J: top-right→bottom-left
  // right edge; L: top-right→bottom-left left edge), so both edges run exactly
  // parallel to the "/" strokes and hug the real shapes. Computed in pixels and
  // mapped into the hero's local box. Band closes as the pieces meet.
  useEffect(() => {
    const j = jRef.current, l = lRef.current, h = heroRef.current;
    if (!j || !l || !h) return;
    if (merged) { setHeroClip("polygon(0 0, 0 0, 0 0)"); return; } // fully wiped
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
    setHeroOpacity(Math.max(0, Math.min(1, gap / (0.28 * vw))));
    if (gap <= 0.03 * vw) {
      setHeroClip("polygon(0 0, 0 0, 0 0)");
      return;
    }
    const px = (x, y) => `${(x - hr.left).toFixed(1)}px ${(y - hr.top).toFixed(1)}px`;
    setHeroClip(
      `polygon(${px(xL(yTop), yTop)}, ${px(xR(yTop), yTop)}, ` +
        `${px(xR(yBot), yBot)}, ${px(xL(yBot), yBot)})`
    );
  }, [p]);
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
        {[
          "M 198 509 L 0 509 L 56 398.5 L 153 398.5 C 184 398.5, 214 381, 232 349 L 348.5 111 L 205.5 109 L 264.5 0 L 515 0 L 301.5 441 C 287 466, 246 498, 198 509 Z",
          "M 406 509 L 7 509 C 1 508, -1 504, 0 498 C 2 488, 5 479, 11 469 L 222.5 32 C 231 16, 241 6, 256 0 L 384.5 0 L 254.5 244 L 188.5 387 C 188.5 394, 193 398, 200 398 L 489 398 L 406 509 Z",
        ].map((d, i) => (
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
            <img
              ref={jRef}
              className="mono-img mono-piece"
              src="/monogram/J_refined_geometric.svg"
              alt=""
              style={{ transform: `translate(${leftX}%, ${Y}%)`, opacity: pieceOpacity }}
            />
            <img
              ref={lRef}
              className="mono-img mono-piece"
              src="/monogram/L_refined_geometric.svg"
              alt=""
              style={{ transform: `translate(${rightX}%, ${Y}%)`, opacity: pieceOpacity }}
            />
            <img
              className="mono-img mono-full"
              src="/monogram/JL_refined_geometric.svg"
              alt=""
              style={{ transform: `translate(-50%, ${Y}%)`, opacity: fullOpacity }}
            />
          </div>

          <div className="hero" ref={heroRef} style={{ clipPath: heroClip, opacity: heroOpacity }}>
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
