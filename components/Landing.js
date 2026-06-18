"use client";

import { useEffect, useRef, useState } from "react";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

export default function Landing() {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);
  const [p, setP] = useState(0); // scroll progress 0..1
  const audioCtx = useRef(null);

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

  // map scrollY -> progress over ~70vh of scrolling
  useEffect(() => {
    function onScroll() {
      const span = window.innerHeight * 0.7;
      setP(Math.min(1, Math.max(0, window.scrollY / span)));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // state 1: split halves visible at edges. state 2: full monogram centered.
  const halfOpacity = 0.5 * (1 - p);
  const fullOpacity = 0.5 * p;
  // halves drift further out as they fade; full scales up into place
  const leftX = -118 - p * 14;
  const rightX = 18 + p * 14;
  const fullScale = 0.92 + p * 0.08;

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

      {/* background monogram */}
      <div className="mono-layer" aria-hidden>
        <img
          className="mono-img mono-half left"
          src="/monogram/J_separated_from_JL_monogram.svg"
          alt=""
          style={{ transform: `translate(${leftX}%, -50%)`, opacity: halfOpacity }}
        />
        <img
          className="mono-img mono-half right"
          src="/monogram/L_separated_from_JL_monogram.svg"
          alt=""
          style={{ transform: `translate(${rightX}%, -50%)`, opacity: halfOpacity }}
        />
        <img
          className="mono-img mono-full"
          src="/monogram/JL_monogram_vector_high_fidelity.svg"
          alt=""
          style={{ transform: `translate(-50%, -50%) scale(${fullScale})`, opacity: fullOpacity }}
        />
      </div>

      <section className="hero">
        <h1>hi. i&rsquo;m jazz.</h1>
        <p className="sub">developer / illustrator / writer</p>
      </section>

      <div className="scroll-zone" />
    </div>
  );
}
