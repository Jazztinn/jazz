"use client";

import { useEffect, useState } from "react";

// JL outline (same paths as the nav logo) traced on load, then filled.
const PATHS = [
  "M 198 509 L 0 509 L 56 398.5 L 153 398.5 C 184 398.5, 214 381, 232 349 L 348.5 111 L 205.5 109 L 264.5 0 L 515 0 L 301.5 441 C 287 466, 246 498, 198 509 Z",
  "M 406 509 L 7 509 C 1 508, -1 504, 0 498 C 2 488, 5 479, 11 469 L 222.5 32 C 231 16, 241 6, 256 0 L 384.5 0 L 254.5 244 L 188.5 387 C 188.5 394, 193 398, 200 398 L 489 398 L 406 509 Z",
];

const TRACE_MIN = 1400; // keep the trace visible at least this long
const MAX_WAIT = 8000;  // safety cap so we never hang on a stuck asset
const FILL_DUR = 2600;  // flood (~1.7s) + a hold on the full logo before fading

// Two sine crests (8 half-waves over 1662 = 2x the 831 viewBox, so a -831px
// horizontal drift loops seamlessly). Filled down to y=620 so the body stays
// solid as the whole group translates up from below the letters.
const WAVE_FRONT =
  "M 0 34 q 103.875 -52 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 L 1662 620 L 0 620 Z";
const WAVE_BACK =
  "M 0 54 q 103.875 -36 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 t 207.75 0 L 1662 620 L 0 620 Z";

// The monogram art is fed to the WebGL shaders as textures, not as page <img>,
// so window.load never waits for it. Preload here so we don't reveal the page
// before the JL logo can actually render.
const MONO_SVGS = [
  "/monogram/J_refined_geometric.svg",
  "/monogram/L_refined_geometric.svg",
  "/monogram/JL_refined_geometric.svg",
];

function preloadImages(srcs) {
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = src;
        })
    )
  );
}

export default function Loader() {
  const [filled, setFilled] = useState(false); // flood JL solid once loaded
  const [done, setDone] = useState(false);   // start fade-out
  const [gone, setGone] = useState(false);    // remove from DOM

  useEffect(() => {
    let alive = true;
    const timers = [];
    const start = performance.now();

    // Real load gate: wait for all page assets (images, fonts), keep the trace
    // up for a minimum, THEN signal the shaders to mount and give them a beat
    // to process before fading out — so nothing pops in after the loader.
    function finish() {
      if (!alive) return;
      // Wait for the monogram textures, keep the trace up a minimum, mount the
      // shaders, give them a beat to actually paint, THEN fade out — so the
      // page is never revealed before the JL logo can render.
      preloadImages(MONO_SVGS).then(() => {
        if (!alive) return;
        // Mount the shaders NOW so their heavy WebGL init paints during the
        // trace — not at the instant the liquid wave animates (that collision
        // was the jank). They get the rest of the trace to warm up.
        window.dispatchEvent(new Event("jl:loaded"));
        const wait = Math.max(0, TRACE_MIN - (performance.now() - start));
        timers.push(setTimeout(() => {
          if (!alive) return;
          setFilled(true); // stop the trace, flood the JL logo solid
          timers.push(setTimeout(() => {
            if (!alive) return;
            setDone(true); // fade after the flood + a hold on the full logo
            timers.push(setTimeout(() => alive && setGone(true), 750));
          }, FILL_DUR));
        }, wait));
      });
    }

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    timers.push(setTimeout(finish, MAX_WAIT)); // safety cap

    return () => {
      alive = false;
      window.removeEventListener("load", finish);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`loader${filled ? " loader--filled" : ""}${done ? " loader--done" : ""}`}
      aria-hidden
    >
      <svg className="loader-logo" viewBox="-18 -18 867 545">
        {/* clip the liquid to the JL letterforms */}
        <defs>
          <clipPath id="jl-clip">
            {PATHS.map((d, i) => (
              <path
                key={`clip-${i}`}
                d={d}
                transform={i === 1 ? "translate(341,0)" : undefined}
              />
            ))}
          </clipPath>
        </defs>
        {/* faint full-outline track so the moving segment leaves a trail */}
        {PATHS.map((d, i) => (
          <path
            key={`track-${i}`}
            className="loader-track"
            d={d}
            transform={i === 1 ? "translate(341,0)" : undefined}
          />
        ))}
        {/* liquid flood — rises from below the letters, two drifting wave crests */}
        <g clipPath="url(#jl-clip)">
          <g className="loader-water">
            <path className="loader-wave loader-wave--back" d={WAVE_BACK} />
            <path className="loader-wave loader-wave--front" d={WAVE_FRONT} />
          </g>
        </g>
        {/* crisp outline on top of the liquid */}
        {PATHS.map((d, i) => (
          <path
            key={i}
            className={i === 1 ? "loader-l" : undefined}
            d={d}
            transform={i === 1 ? "translate(341,0)" : undefined}
            pathLength="1"
          />
        ))}
      </svg>
    </div>
  );
}
