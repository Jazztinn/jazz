"use client";

import { useEffect, useRef, useState } from "react";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

export default function Landing() {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);
  const [p, setP] = useState(0); // scroll progress 0..1
  const [heroClip, setHeroClip] = useState("none");
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
      const span = window.innerHeight;
      setP(Math.min(1, Math.max(0, window.scrollY / span)));
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
    // both glyphs share scale -> same slope (dx/dy), giving parallel // edges
    const slopeJ = -jr.width / jr.height;
    const slopeL = -lr.width / lr.height;
    // left edge: J's right diagonal, anchored at its top-right corner
    const xL = (y) => jr.right + slopeJ * (y - jr.top);
    // right edge: L's left diagonal, anchored at its bottom-left corner
    const xR = (y) => lr.left + slopeL * (y - lr.bottom);
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

          <div className="hero" ref={heroRef} style={{ clipPath: heroClip }}>
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
