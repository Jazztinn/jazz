"use client";

import { useEffect } from "react";

// buttermax-style gooey liquid cursor, done with Canvas2D metaballs.
//
// The head springs toward the pointer; its positions feed a short history ring.
// Each sample is a white circle whose radius tapers with age. We draw the
// circles to an offscreen canvas, then blit it to screen through a
// `blur() + contrast()` filter: the blur fuses overlapping circles and the
// contrast hard-thresholds the result, so the whole chain merges into ONE
// smooth body that:
//   - idle: collapses onto the head -> round ball.
//   - moving: spreads along the path -> round head + thin curling tapered tail.
// The goo silhouette is then used as a mask (destination-in) over the TRUE-color
// work-card photos drawn straight from their <img> elements (canvas drawImage
// ignores the CSS duotone filter), so the blob acts as a color-reveal lens that
// only appears where it overlaps an image card — nothing is drawn elsewhere.
// Active only after scrolling past 1.00 vh.

const N = 28; // history length
const HEAD_R = 52; // head radius (css px)
const HEAD_HOLD = 4; // newest samples at full radius => round head
const TAIL_MIN = 0.2; // smallest tail radius fraction (kept above blur so it survives threshold)
const STIFFNESS = 0.06; // slo-mo: weak spring => head drifts lazily to pointer
const DAMPING = 0.86;
const BLUR = 7; // goo blur (css px) -> fuses circles before the alpha threshold

const radiusAt = (k) => {
  if (k < HEAD_HOLD) return HEAD_R;
  const t = (k - HEAD_HOLD) / (N - 1 - HEAD_HOLD);
  return HEAD_R * (TAIL_MIN + (1 - TAIL_MIN) * Math.pow(1 - t, 1.7));
};

export default function BlobCursor() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.className = "blob-cursor";
    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    document.body.appendChild(canvas);

    // goo filter: blur fuses overlapping circles, the alpha matrix hard-
    // thresholds the blurred alpha -> crisp merged metaball silhouette.
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "blob-cursor-defs");
    svg.innerHTML =
      `<filter id="blob-goo" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${BLUR * dpr}" result="b"/>` +
      `<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12"/>` +
      `</filter>`;
    document.body.appendChild(svg);

    let W = 0, H = 0;
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      for (const c of [canvas, off]) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      canvas.style.width = off.style.width = W + "px";
      canvas.style.height = off.style.height = H + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    const target = { x: W / 2, y: H / 2 };
    const head = { x: target.x, y: target.y, vx: 0, vy: 0 };
    const hist = Array.from({ length: N }, () => ({ x: head.x, y: head.y }));
    let presence = 0;
    let active = false;
    let raf = 0;

    function syncActive() {
      const next = window.scrollY >= window.innerHeight; // 1.00 vh
      if (next === active) return;
      active = next;
      canvas.style.display = active ? "" : "none";
      document.documentElement.classList.toggle("blob-on", active);
    }
    window.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", syncActive);
    syncActive();

    function onMove(e) {
      target.x = e.clientX;
      target.y = e.clientY;
    }
    window.addEventListener("pointermove", onMove);

    // cards whose true-color pixels the blob reveals. Re-queried on resize since
    // the DOM is static otherwise; positions are read per-frame.
    let cards = [];
    function refreshCards() {
      cards = Array.from(document.querySelectorAll(".work-photo"));
    }
    refreshCards();
    window.addEventListener("resize", refreshCards);

    // object-fit: cover crop -> source rect into the natural image.
    function coverSrc(img, dw, dh) {
      const iw = img.naturalWidth || dw;
      const ih = img.naturalHeight || dh;
      const scale = Math.max(dw / iw, dh / ih);
      const sw = dw / scale;
      const sh = dh / scale;
      return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
    }
    function roundRect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      if (!active) return;

      head.vx = (head.vx + (target.x - head.x) * STIFFNESS) * DAMPING;
      head.vy = (head.vy + (target.y - head.y) * STIFFNESS) * DAMPING;
      head.x += head.vx;
      head.y += head.vy;

      hist.pop();
      hist.unshift({ x: head.x, y: head.y });

      const speed = Math.hypot(head.vx, head.vy);
      const moving = speed > 0.2 ? 1 : 0;
      presence += (moving - presence) * (moving ? 0.12 : 0.03);

      // draw raw circles to offscreen
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, W, H);
      octx.fillStyle = "#fff";
      for (let k = 0; k < N; k++) {
        const h = hist[k];
        // interpolate from the previous sample so fast motion stays continuous
        if (k > 0) {
          const p = hist[k - 1];
          const steps = 2;
          for (let s = 1; s < steps; s++) {
            const f = s / steps;
            octx.beginPath();
            octx.arc(p.x + (h.x - p.x) * f, p.y + (h.y - p.y) * f,
              radiusAt(k - 1 + f) * 0.9, 0, Math.PI * 2);
            octx.fill();
          }
        }
        octx.beginPath();
        octx.arc(h.x, h.y, radiusAt(k), 0, Math.PI * 2);
        octx.fill();
      }

      // blob bounding box (css px) — skip cards that can't intersect it.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const h of hist) {
        if (h.x - HEAD_R < bx0) bx0 = h.x - HEAD_R;
        if (h.y - HEAD_R < by0) by0 = h.y - HEAD_R;
        if (h.x + HEAD_R > bx1) bx1 = h.x + HEAD_R;
        if (h.y + HEAD_R > by1) by1 = h.y + HEAD_R;
      }

      // 1) draw true-color card pixels (straight from <img>, no CSS filter),
      //    each clipped to its rounded rect, only where they meet the blob.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const img of cards) {
        const r = img.getBoundingClientRect();
        if (r.right < bx0 || r.left > bx1 || r.bottom < by0 || r.top > by1) continue;
        if (!img.complete || !img.naturalWidth) continue;
        const { sx, sy, sw, sh } = coverSrc(img, r.width, r.height);
        ctx.save();
        roundRect(ctx, r.left, r.top, r.width, r.height, 6);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, r.left, r.top, r.width, r.height);
        ctx.restore();
      }

      // 2) keep those pixels only inside the goo silhouette (blur + alpha
      //    threshold => crisp metaball). presence fades the whole reveal.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-in";
      ctx.globalAlpha = presence;
      ctx.filter = "url(#blob-goo)";
      ctx.drawImage(off, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", refreshCards);
      window.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", syncActive);
      document.documentElement.classList.remove("blob-on");
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (svg.parentNode) svg.parentNode.removeChild(svg);
    };
  }, []);

  return null;
}
