"use client";

import { useEffect, useState } from "react";

// JL outline (same paths as the nav logo) traced on load, then filled.
const PATHS = [
  "M 198 509 L 0 509 L 56 398.5 L 153 398.5 C 184 398.5, 214 381, 232 349 L 348.5 111 L 205.5 109 L 264.5 0 L 515 0 L 301.5 441 C 287 466, 246 498, 198 509 Z",
  "M 406 509 L 7 509 C 1 508, -1 504, 0 498 C 2 488, 5 479, 11 469 L 222.5 32 C 231 16, 241 6, 256 0 L 384.5 0 L 254.5 244 L 188.5 387 C 188.5 394, 193 398, 200 398 L 489 398 L 406 509 Z",
];

export default function Loader() {
  const [done, setDone] = useState(false);   // start fade-out
  const [gone, setGone] = useState(false);    // remove from DOM

  useEffect(() => {
    const t1 = setTimeout(() => setDone(true), 1300);  // after trace + fill
    const t2 = setTimeout(() => setGone(true), 1900);  // after fade-out
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <div className={`loader${done ? " loader--done" : ""}`} aria-hidden>
      <svg className="loader-logo" viewBox="0 0 831 509">
        {PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            transform={i === 1 ? "translate(341,0)" : undefined}
            pathLength="1"
          />
        ))}
      </svg>
    </div>
  );
}
