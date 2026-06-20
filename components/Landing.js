"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

const EMPTY_CLIP = "polygon(0 0, 0 0, 0 0)";
const SCROLL_EPSILON = 0.001;
const SMOOTH_SCROLL_EASE = 0.14;
const MOUSE_WHEEL_MULTIPLIER = 1.05;

const loadShaders = () => import("@paper-design/shaders-react");

const LiquidMetal = dynamic(() => loadShaders().then((mod) => mod.LiquidMetal), { ssr: false });
const SmokeRing = dynamic(() => loadShaders().then((mod) => mod.SmokeRing), { ssr: false });
const Dithering = dynamic(() => loadShaders().then((mod) => mod.Dithering), { ssr: false });

// Grayscale fog for every icon — black/gray/white, no brand colors.
const BW_FOG = { colors: ["#111111", "#888888", "#f2f2f2"], colorBack: "#00000000" };

const SOCIALS = [
  { id: "linkedin", href: "https://www.linkedin.com/in/jazztinn/", label: "LinkedIn", shader: BW_FOG },
  { id: "github", href: "https://github.com/Jazztinn", label: "GitHub", shader: BW_FOG },
  { id: "facebook", href: "https://www.facebook.com/orangelupin", label: "Facebook", shader: BW_FOG },
  { id: "instagram", href: "https://www.instagram.com/kiragenome/?hl=en", label: "Instagram", shader: BW_FOG },
];

const SOCIAL_SHADER = {
  speed: 2.4,
  scale: 1.6,
  noiseScale: 3.2,
  thickness: 0.7,
  radius: 0.35,
  innerShape: 0.4,
  maxPixelCount: 4096,
  minPixelRatio: 1,
  style: { width: "100%", height: "100%" },
};

// Beige dithering drifting over the orange flood — duotone, contrasting.
const OUTRO_FOG = {
  shape: "warp",
  type: "4x4",
  pxSize: 2.5,
  speed: 0.4,
  scale: 1.1,
  colorBack: "#00000000",
  colorFront: "#efe4cb",
  style: { width: "100%", height: "100%" },
};

const MENU_FOG = {
  ...OUTRO_FOG,
  colorFront: "#ffffff",
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
  return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
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
  return event.deltaY !== 0 && !event.target?.closest?.("input, textarea, select, [contenteditable]");
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
    label: "COLLEGE MONTH BOOTH, 2025",
    size: "tall",
    src: "/work/datalink-booth.jpg",
    alt: "Datalink booth presentation with printed materials and neon display",
    position: "center",
    width: 1800,
    height: 1200,
  },
  {
    id: "live drawing",
    label: "CANDID MOMENT, #1",
    size: "small",
    src: "/work/live-drawing.jpg",
    alt: "Close-up of live marker drawing on a display board",
    position: "center",
    width: 1600,
    height: 1200,
    quote: "To strive, to seek, to find, and not to yield.",
    quoteBy: "Ulysses",
    wipeQuote: true,
    vertical: "lower",
    tone: "warm-duotone",
  },
  {
    id: "group portrait",
    label: "WITH THE TEAM, 2026",
    size: "small",
    src: "/work/group-portrait.jpg",
    alt: "Group portrait outdoors beneath flowering trees",
    position: "center",
    width: 1600,
    height: 1200,
    layout: "team",
    placeholderQuote: "A reader lives a thousand lives before he dies. The man who never reads lives only one.",
    placeholderQuoteBy: "George R. R. Martin",
  },
  {
    id: "transcend group",
    label: "TRANSCEND",
    size: "wide",
    src: "/work/transcend-group.jpg",
    alt: "Students at the Transcend event",
    position: "center",
    width: 1600,
    height: 1200,
    quote: "Still round the corner there may wait a new road or a secret gate.",
    quoteBy: "J.R.R. Tolkien",
    quotePosition: "after",
    wipeQuote2: true,
    layout: "transcend",
  },
  {
    id: "candid drink",
    label: "OFF THE CLOCK, 2024",
    size: "tall",
    src: "/work/candid-drink.jpg",
    alt: "Candid outdoor portrait holding a drink",
    position: "center",
    width: 1600,
    height: 1060,
  },
  {
    id: "helmet walk",
    label: "OUT & ABOUT, 2026",
    size: "wide",
    src: "/work/helmet-walk.jpg",
    alt: "Person walking outside wearing a stylized helmet",
    position: "center",
    width: 1200,
    height: 1600,
    quote: "Not all those who wander are lost.",
    quoteBy: "J.R.R. Tolkien",
    wipeQuote3: true,
  },
  {
    id: "techfest team",
    label: "TECHFEST",
    size: "wide",
    src: "/work/techfest-team.jpg",
    alt: "Students representing Tech Fest with laptops",
    position: "center",
    width: 1200,
    height: 628,
    layout: "techfest",
  },
  {
    id: "campus huddle",
    label: "CAMPUS HUDDLE",
    size: "wide",
    src: "/work/campus-huddle.jpg",
    alt: "Students gathering around a table in a campus hall",
    position: "center",
    width: 1600,
    height: 1200,
    layout: "campus",
  },
];
const WORK_PLACEHOLDER_ITEMS = [
  { id: "water drive", label: "COMMUNITY DRIVE", size: "tall", src: "/work/water-drive.jpg", position: "center", width: 1200, height: 900 },
];

// silver / chrome liquid metal, masked to each glyph SVG
const METAL = {
  colorBack: "#00000000",
  colorTint: "#fbfcff",   // near-white cool = bright polished silver
  repetition: 6,          // more chrome bands = chromier
  softness: 0.22,
  shiftRed: 0,      // no chromatic dispersion (was the "glitchy" rainbow)
  shiftBlue: 0,
  distortion: 0.09,
  contour: 0.55,          // less dark valleys = brighter overall
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [floodShaderActive, setFloodShaderActive] = useState(false);
  const [introShadersActive, setIntroShadersActive] = useState(true);
  const progressRef = useRef({ p: -1, q: -1, f: -1, wx: -1 });
  const floodShaderActiveRef = useRef(false);
  const introShadersActiveRef = useRef(true);
  const handwritingProgressRef = useRef(-1);
  const layoutMetricsRef = useRef({ vh: 0, docHeight: 0, maxScroll: 0, workHeight: 0, workStart: 0, maxWorkX: 0 });
  const rafRef = useRef(0);
  const sloshRef = useRef({ y: 0, t: 0 });
  const floodRef = useRef(null);
  const overFloodRef = useRef({ top: false, bottom: false });
  const smoothScrollRef = useRef({ current: 0, target: 0, raf: 0, active: false });
  const audioCtx = useRef(null);
  const frameRef = useRef(null);
  const workRef = useRef(null);
  const trackRef = useRef(null);
  const introTextLeftRef = useRef(null);
  const introTextRightRef = useRef(null);
  const jRef = useRef(null);
  const lRef = useRef(null);
  const heroRef = useRef(null);
  const writeCanvasRef = useRef(null);     // canvas for handwriting nib replay
  const writeDataRef = useRef(null);       // parsed capture JSON
  const requestScrollUpdateRef = useRef(null);
  const vhDevRef = useRef(null);

  function openMenu() {
    setMenuClosing(false);
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
    setMenuClosing(true);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    handwritingProgressRef.current = -1;
    requestScrollUpdateRef.current && requestScrollUpdateRef.current();
  }, [dark]);

  useEffect(() => {
    const preload = () => {
      loadShaders().catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 0);
    return () => window.clearTimeout(id);
  }, []);

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

  // load the captured handwriting JSON (centerline points + pressure + per-
  // stroke timing + nib params). Replayed on a canvas with a parallelogram nib.
  useEffect(() => {
    let alive = true;
    fetch("/handwriting/day-in-my-life.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data || !data.strokes) return;
        // fall back to even time slices if the capture had no timing
        const allFlat = data.strokes.every((s) => s.tStart === 0 && s.tEnd === 1);
        if (allFlat) {
          const n = data.strokes.length;
          data.strokes.forEach((s, i) => {
            s.tStart = i / n;
            s.tEnd = (i + 1) / n;
          });
        }
        writeDataRef.current = data;
        requestScrollUpdateRef.current && requestScrollUpdateRef.current();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = smoothScrollRef.current;

    function stop() {
      state.active = false;
      if (state.raf) window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }

    function tick() {
      const difference = state.target - state.current;
      if (Math.abs(difference) < 0.35) {
        state.current = state.target;
        window.scrollTo(0, state.target);
        stop();
        return;
      }
      state.current += difference * SMOOTH_SCROLL_EASE;
      window.scrollTo(0, state.current);
      state.raf = window.requestAnimationFrame(tick);
    }

    function onWheel(event) {
      if (motionQuery.matches || !shouldSmoothWheel(event) || closestScrollableElement(event.target)) return;
      event.preventDefault();
      if (!state.active) {
        state.current = window.scrollY;
        state.target = window.scrollY;
        state.active = true;
      }
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      state.target = clamp(state.target + normalizeWheelDelta(event), 0, maxScroll);
      if (!state.raf) state.raf = window.requestAnimationFrame(tick);
    }

    function syncNativeScroll() {
      if (!state.active) {
        state.current = window.scrollY;
        state.target = window.scrollY;
      }
    }

    syncNativeScroll();
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", syncNativeScroll, { passive: true });
    window.addEventListener("resize", syncNativeScroll);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", syncNativeScroll);
      window.removeEventListener("resize", syncNativeScroll);
      stop();
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
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setStyleIfChanged(element, property, value) {
      if (element && element.style[property] !== value) {
        element.style[property] = value;
      }
    }

    function setCssVar(element, property, value) {
      if (element && element.style.getPropertyValue(property) !== value) {
        element.style.setProperty(property, value);
      }
    }

    // ---- handwriting nib replay (mirrors tools/handwriting-capture.html) ----
    function nibCorners(nib, p) {
      const a = (nib.angle * Math.PI) / 180;
      const w = nib.weight * (0.65 + 0.7 * p);
      const hux = (Math.cos(a) * w) / 2, huy = (Math.sin(a) * w) / 2;
      const hvx = (Math.cos(a + Math.PI / 2) * w * nib.thick) / 2;
      const hvy = (Math.sin(a + Math.PI / 2) * w * nib.thick) / 2;
      return [
        [-hux - hvx, -huy - hvy],
        [hux - hvx, huy - hvy],
        [hux + hvx, huy + hvy],
        [-hux + hvx, -huy + hvy],
      ];
    }
    function hull(pts) {
      pts = pts.slice().sort((A, B) => A[0] - B[0] || A[1] - B[1]);
      const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
      const lo = [], hi = [];
      for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
      lo.pop(); hi.pop();
      return lo.concat(hi);
    }
    function sweep(cx, nib, a, pa, b, pb) {
      const ca = nibCorners(nib, pa), cb = nibCorners(nib, pb);
      const band = [
        ...ca.map((c) => [a[0] + c[0], a[1] + c[1]]),
        ...cb.map((c) => [b[0] + c[0], b[1] + c[1]]),
      ];
      const poly = hull(band);
      cx.beginPath();
      cx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) cx.lineTo(poly[i][0], poly[i][1]);
      cx.closePath();
      cx.fill();
    }
    function drawHandwriting(write) {
      const cv = writeCanvasRef.current;
      const data = writeDataRef.current;
      if (!cv || !data) return;
      const VW = data.viewBox[2], VH = data.viewBox[3];
      if (cv.width !== VW || cv.height !== VH) { cv.width = VW; cv.height = VH; }
      const cx = cv.getContext("2d");
      cx.clearRect(0, 0, VW, VH);
      cx.fillStyle =
        document.documentElement.dataset.theme === "dark" ? "#f0f0f0" : "#1a1a1a";
      const nib = data.nib || { weight: 12, angle: 40, thick: 0.35 };
      for (const s of data.strokes) {
        const span = Math.max(1e-4, s.tEnd - s.tStart);
        const local = clamp01((write - s.tStart) / span);
        if (local <= 0) continue;
        const pts = s.pts, pr = s.pressure || [];
        const N = pts.length;
        if (N === 1) { sweep(cx, nib, pts[0], pr[0] ?? 0.5, pts[0], pr[0] ?? 0.5); continue; }
        const fpos = local * (N - 1);
        const last = Math.floor(fpos);
        for (let i = 1; i <= last; i++) sweep(cx, nib, pts[i - 1], pr[i - 1] ?? 0.5, pts[i], pr[i] ?? 0.5);
        const frac = fpos - last;
        if (last < N - 1 && frac > 0) {
          const a = pts[last], b = pts[last + 1];
          const bx = a[0] + (b[0] - a[0]) * frac, by = a[1] + (b[1] - a[1]) * frac;
          sweep(cx, nib, a, pr[last] ?? 0.5, [bx, by], pr[last] ?? 0.5);
        }
      }
    }

    function refreshLayoutMetrics() {
      const vh = window.innerHeight;
      const sec = workRef.current;
      const track = trackRef.current;
      const docHeight = document.documentElement.scrollHeight;
      layoutMetricsRef.current = {
        vh,
        docHeight,
        maxScroll: Math.max(0, docHeight - vh),
        workHeight: sec?.offsetHeight || 0,
        workStart: sec ? window.scrollY + sec.getBoundingClientRect().top : 0,
        maxWorkX: track ? Math.max(0, track.scrollWidth - window.innerWidth) : 0,
      };
    }

    function updateScrollProgress() {
      rafRef.current = 0;
      const frame = frameRef.current;
      if (!frame) return;

      const metrics = layoutMetricsRef.current;
      const vh = metrics.vh || window.innerHeight;
      if (vhDevRef.current) {
        vhDevRef.current.textContent = `${(window.scrollY / vh).toFixed(3)} vh`;
      }
      const scrollCueProgress = clamp01(window.scrollY / (vh * 0.2));
      setCssVar(frame, "--scroll-cue", String(1 - scrollCueProgress));
      // work gallery: vertical scroll through the section drives a horizontal
      // translate of the track (cards move left). Lando-style scroll carousel.
      let wx = 0;
      let workProg = 0;
      if (workRef.current && trackRef.current) {
        // Tie carousel progress to the section's own sticky range so it finishes
        // exactly when the pin releases — no dead scroll, normal scroll resumes.
        // `lead` lets it start moving ~1 viewport before the section pins.
        const lead = vh * 1.0;
        const span = metrics.workHeight - vh + lead;
        const workTop = metrics.workStart - window.scrollY;
        const workRawProg = span > 0 ? (lead - workTop) / span : 0;
        workProg = clamp01(workRawProg);
        wx = workProg * metrics.maxWorkX;
      }

      const next = {
        p: clamp01(window.scrollY / vh),
        // Logo traces in only AFTER the greeting is fully wiped and the merged
        // JL has scrolled away: start at 1.55 viewports.
        q: clamp01((window.scrollY - vh * 1.05) / (vh * 0.5)),
        // merged JL fades to white from the bottom up (1.0 -> 1.6 viewports).
        f: clamp01((window.scrollY - vh * 0.5) / (vh * 0.6)),
        wx,
      };
      // These run EVERY frame (before the early-return below), because the flood
      // region is reached long after p/q/f/wx have saturated — otherwise the
      // change-guard would skip all updates while scrolling through the orange.
      // slosh: scroll velocity tilts the surface on scroll.
      const now = performance.now();
      const sl = sloshRef.current;
      const dt = Math.max(16, now - (sl.t || now));
      const vel = (window.scrollY - sl.y) / dt; // px per ms
      sl.y = window.scrollY;
      sl.t = now;
      setCssVar(frame, "--slosh", `${clamp(-vel * 2.5, -3.5, 3.5).toFixed(2)}deg`);
      // Use the rendered scroll velocity for a small elastic response. The
      // page continues to scroll normally; this only distorts content briefly.
      if (!reduceMotionQuery.matches && Math.abs(vel) > 0.01) {
        const warp = clamp(-vel * 0.16, -0.42, 0.42);
        setCssVar(frame, "--page-warp-skew", `${warp.toFixed(3)}deg`);
        setCssVar(frame, "--page-warp-y", `${clamp(-vel * 0.8, -2.5, 2.5).toFixed(2)}px`);
        setCssVar(frame, "--page-warp-scale-y", (1 + Math.abs(warp) * 0.0035).toFixed(4));
        frame.dataset.warping = "1";
      }
      if (sl.settle) clearTimeout(sl.settle);
      sl.settle = setTimeout(() => {
        setCssVar(frame, "--slosh", "0deg");
        setCssVar(frame, "--page-warp-skew", "0deg");
        setCssVar(frame, "--page-warp-y", "0px");
        setCssVar(frame, "--page-warp-scale-y", "1");
        delete frame.dataset.warping;
      }, 110);
      // top UI turns white once the waterline rises above the top bar; bottom
      // toggles turn white once it rises above the bottom toggles.
      const fl = floodRef.current;
      if (fl) {
        const top = fl.getBoundingClientRect().top;
        // Start at a deliberate document position so the dither is fully ready
        // when the flood reaches the gallery's closing sequence.
        const floodShouldBeActive = window.scrollY >= vh * 2.8;
        if (floodShouldBeActive !== floodShaderActiveRef.current) {
          floodShaderActiveRef.current = floodShouldBeActive;
          setFloodShaderActive(floodShouldBeActive);
        }
        const overTop = top <= 90;
        // viewport-driven wipe highlight on the "To strive" quote: starts at
        // 1.625vh, freezes complete at 1.75vh. Set every frame (before the
        // change-guard) so it persists past the intro early-returns.
        const quoteWipe = clamp01((window.scrollY - vh * 1.625) / (vh * 0.125));
        setCssVar(frame, "--quote-wipe", quoteWipe.toFixed(4));
        const quoteWipe2 = clamp01((window.scrollY - vh * 1.68) / (vh * 0.12));
        setCssVar(frame, "--quote-wipe2", quoteWipe2.toFixed(4));
        const quoteWipe3 = clamp01((window.scrollY - vh * 1.8) / (vh * 0.05));
        setCssVar(frame, "--quote-wipe3", quoteWipe3.toFixed(4));
        const quoteWipe4 = clamp01((window.scrollY - vh * 1.85) / (vh * 0.1));
        setCssVar(frame, "--quote-wipe4", quoteWipe4.toFixed(4));
        const quoteWipe5 = clamp01((window.scrollY - vh * 2.1) / (vh * 0.15));
        setCssVar(frame, "--quote-wipe5", quoteWipe5.toFixed(4));
        const quoteWipe6 = clamp01((window.scrollY - vh * 2.25) / (vh * 0.17));
        setCssVar(frame, "--quote-wipe6", quoteWipe6.toFixed(4));
        const quoteWipe7 = clamp01((window.scrollY - vh * 2.9) / (vh * 0.2));
        setCssVar(frame, "--quote-wipe7", quoteWipe7.toFixed(4));
        const quoteWipe8 = clamp01((window.scrollY - vh * 3.1) / (vh * 0.15));
        setCssVar(frame, "--quote-wipe8", quoteWipe8.toFixed(4));
        const quoteWipe9 = clamp01((window.scrollY - vh * 1.225) / (vh * 0.105));
        setCssVar(frame, "--quote-wipe9", quoteWipe9.toFixed(4));
        const quoteWipe10 = clamp01((window.scrollY - vh * 1.33) / (vh * 0.12));
        setCssVar(frame, "--quote-wipe10", quoteWipe10.toFixed(4));
        const overBottom = top <= vh - 60;
        if (overTop !== overFloodRef.current.top) {
          overFloodRef.current.top = overTop;
          frame.dataset.flood = overTop ? "1" : "0";
        }
        if (overBottom !== overFloodRef.current.bottom) {
          overFloodRef.current.bottom = overBottom;
          frame.dataset.floodB = overBottom ? "1" : "0";
        }
      }

      // The intro's WebGL layers are visually gone after this point, but each
      // instance continues to render unless it is explicitly unmounted.
      const introShouldBeActive = window.scrollY < vh * 1.4;
      if (introShouldBeActive !== introShadersActiveRef.current) {
        introShadersActiveRef.current = introShouldBeActive;
        setIntroShadersActive(introShouldBeActive);
      }

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

      // By 1.4 viewports the hero and handwriting sequences are complete. The
      // carousel only needs its track position and the scrollbar from here;
      // skip the intro's masks and geometry reads. The nav logo still needs to
      // finish its trace and fill during the first part of this range.
      if (window.scrollY >= vh * 1.4) {
        setCssVar(frame, "--work-x", `${(-wx).toFixed(2)}px`);
        setCssVar(frame, "--scroll-frac", String(metrics.maxScroll > 0 ? clamp01(window.scrollY / metrics.maxScroll) : 0));
        setCssVar(frame, "--scroll-vis", String(metrics.docHeight > 0 ? Math.min(1, vh / metrics.docHeight) : 1));
        setCssVar(frame, "--q", String(next.q));
        setCssVar(frame, "--nav-opacity", next.q > 0 ? "1" : "0");
        setCssVar(frame, "--nav-fill", String(clamp01((next.q - 0.7) / 0.3)));
        return;
      }

      const meet = Math.min(1, next.p / 0.425);
      const sw = clamp01((next.p - 0.46) / 0.2);
      // No full-logo crossfade: the J/L pieces slide in and freeze at the merged
      // position. They stay visible (full logo is never shown) and fade out
      // bottom-up with --f on the way down.
      setCssVar(frame, "--p", String(next.p));
      setCssVar(frame, "--q", String(next.q));
      setCssVar(frame, "--f", String(next.f));
      setCssVar(frame, "--nav-opacity", next.q > 0 ? "1" : "0");
      setCssVar(frame, "--nav-fill", String(clamp01((next.q - 0.7) / 0.3)));
      setCssVar(frame, "--work-x", `${(-wx).toFixed(2)}px`);

      // handwriting draw-on: begins as the merged JL fade (--f) passes ~0.8 and
      // the center clears, then "writes" over the next ~0.85 viewport of scroll.
      const writeStart = vh * 0.85; // earlier — as the JL fade gets going
      const write = clamp01((window.scrollY - writeStart) / (vh * 0.278));
      setCssVar(frame, "--write", String(write));
      const previousWrite = handwritingProgressRef.current;
      if (
        previousWrite < 0 ||
        Math.abs(write - previousWrite) >= 0.005 ||
        (write === 1 && previousWrite !== 1)
      ) {
        handwritingProgressRef.current = write;
        drawHandwriting(write);
      }

      // fade the handwriting out with the SAME bottom-up wipe as the marquees,
      // starting at 1.78vh.
      const wipe = clamp01((window.scrollY - vh * 1.16) / (vh * 0.2));
      const writeWipe = `linear-gradient(to left, transparent ${(wipe * 125 - 25).toFixed(2)}%, #000 ${(wipe * 125).toFixed(2)}%)`;
      setStyleIfChanged(writeCanvasRef.current, "maskImage", writeWipe);
      setStyleIfChanged(writeCanvasRef.current, "webkitMaskImage", writeWipe);

      setCssVar(frame, "--scroll-frac", String(metrics.maxScroll > 0 ? clamp01(window.scrollY / metrics.maxScroll) : 0));
      setCssVar(frame, "--scroll-vis", String(metrics.docHeight > 0 ? Math.min(1, vh / metrics.docHeight) : 1));
      setCssVar(frame, "--j-x", `${(-385 + meet * 305).toFixed(3)}%`);
      setCssVar(frame, "--l-x", `${(300 - meet * 315).toFixed(3)}%`);
      setCssVar(frame, "--intro-right-x", `${(next.p * 60).toFixed(3)}vw`);
      setCssVar(frame, "--intro-left-x", `${(-next.p * 60).toFixed(3)}vw`);
      setCssVar(frame, "--mono-mask-start", `${(next.f * 125 - 25).toFixed(3)}%`);
      setCssVar(frame, "--mono-mask-end", `${(next.f * 125).toFixed(3)}%`);

      // marquee fades out bottom-up with the SAME wipe as the JL logo (--f).
      // Set this BEFORE any early return so it keeps updating past the merge.
      const marqueeWipe = `linear-gradient(to top, transparent ${(next.f * 125 - 25).toFixed(2)}%, #000 ${(next.f * 125).toFixed(2)}%)`;
      setStyleIfChanged(introTextLeftRef.current, "maskImage", marqueeWipe);
      setStyleIfChanged(introTextLeftRef.current, "webkitMaskImage", marqueeWipe);
      setStyleIfChanged(introTextRightRef.current, "maskImage", marqueeWipe);
      setStyleIfChanged(introTextRightRef.current, "webkitMaskImage", marqueeWipe);

      const j = jRef.current;
      const l = lRef.current;
      const h = heroRef.current;
      if (!j || !l || !h) return;

      const merged = next.p >= 0.97;
      const hr = h.getBoundingClientRect();
      if (merged) {
        setStyleIfChanged(h, "clipPath", EMPTY_CLIP);
        setStyleIfChanged(h, "webkitClipPath", EMPTY_CLIP);
        setStyleIfChanged(h, "opacity", "0");
        return;
      }

      const jr = j.getBoundingClientRect();
      const lr = l.getBoundingClientRect();
      const yTop = -0.4 * vh;
      const yBot = 1.4 * vh;
      const slope = -0.52;
      const xL = (y) => jr.right + slope * (y - jr.top);
      const xR = (y) => lr.left + slope * (y - lr.bottom);
      const vw = window.innerWidth;
      const yMid = hr.top + hr.height / 2;
      const gap = xR(yMid) - xL(yMid);
      const opacity = String(1 - sw);
      const px = (x, y) => `${(x - hr.left).toFixed(1)}px ${(y - hr.top).toFixed(1)}px`;

      if (next.p < 0.85) {
        const leftEdge = -40 - hr.left;
        const rightEdge = hr.width + 40;
        const leftClip =
          `polygon(${leftEdge}px ${(yTop - hr.top).toFixed(1)}px, ${px(xL(yTop), yTop)}, ` +
          `${px(xL(yBot), yBot)}, ${leftEdge}px ${(yBot - hr.top).toFixed(1)}px)`;
        const rightClip =
          `polygon(${px(xR(yTop), yTop)}, ${rightEdge}px ${(yTop - hr.top).toFixed(1)}px, ` +
          `${rightEdge}px ${(yBot - hr.top).toFixed(1)}px, ${px(xR(yBot), yBot)})`;

        setStyleIfChanged(introTextLeftRef.current, "clipPath", leftClip);
        setStyleIfChanged(introTextLeftRef.current, "webkitClipPath", leftClip);
        setStyleIfChanged(introTextRightRef.current, "clipPath", rightClip);
        setStyleIfChanged(introTextRightRef.current, "webkitClipPath", rightClip);
      }

      if (gap <= 0.01 * vw) {
        setStyleIfChanged(h, "clipPath", EMPTY_CLIP);
        setStyleIfChanged(h, "webkitClipPath", EMPTY_CLIP);
        setStyleIfChanged(h, "opacity", "0");
        return;
      }

      const heroClip =
        `polygon(${px(xL(yTop), yTop)}, ${px(xR(yTop), yTop)}, ` +
        `${px(xR(yBot), yBot)}, ${px(xL(yBot), yBot)})`;
      setStyleIfChanged(h, "clipPath", heroClip);
      setStyleIfChanged(h, "webkitClipPath", heroClip);
      setStyleIfChanged(h, "opacity", opacity);
    }

    function requestScrollUpdate() {
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(updateScrollProgress);
      }
    }
    requestScrollUpdateRef.current = requestScrollUpdate;

    refreshLayoutMetrics();
    updateScrollProgress();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", refreshLayoutMetrics);
    window.addEventListener("resize", requestScrollUpdate);
    window.addEventListener("load", refreshLayoutMetrics, { once: true });
    return () => {
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", refreshLayoutMetrics);
      window.removeEventListener("resize", requestScrollUpdate);
      window.removeEventListener("load", refreshLayoutMetrics);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="frame" ref={frameRef}>
      {/* duotone filter: shadows -> black, highlights -> orange (#ff7a18) */}
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <filter id="duotone" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.24 0.86 1" />
            <feFuncG type="table" tableValues="0.12 0.54 0.72" />
            <feFuncB type="table" tableValues="0.03 0.2 0.32" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="grid-page" />

      {/* custom right-edge scrollbar */}
      <div className="scrollbar-track" aria-hidden />
      <div className="scrollbar-thumb" aria-hidden />
      <div className="scroll-cue" aria-hidden>
        <span className="scroll-cue__stem" />
        <span className="scroll-cue__head">
          <span className="scroll-cue__arm scroll-cue__arm--left" />
          <span className="scroll-cue__arm scroll-cue__arm--right" />
        </span>
      </div>

      {/* handwriting "a day in my life" — draws on with scroll into the empty
          space once the JL shader has faded. Markup injected from captured SVG. */}
      <canvas className="handwriting" ref={writeCanvasRef} aria-hidden />
      <div className="vh-dev" ref={vhDevRef} aria-hidden>0.000 vh</div>

      {/* Flood: anchored in the document (scrolls with the page, doesn't stick
          to the screen). Back = opaque fill behind the photos; front = a
          translucent sheet over them so the lower photos look submerged. */}
      <div className="flood flood--back content-warp" aria-hidden ref={floodRef}>
        <div className="liquid-inner">
          <div className="liquid-wave one" />
          <div className="liquid-wave two" />
          <div className="liquid-body" />
        </div>
      </div>
      <div className="flood flood--front content-warp" aria-hidden>
        <div className="liquid-inner">
          <div className="liquid-wave one" />
          <div className="liquid-wave two" />
          <div className="liquid-body" />
        </div>
      </div>
      {/* beige halftone over the whole orange flood */}
      <div className="flood-fog content-warp" aria-hidden>
        {ready && floodShaderActive && <Dithering {...OUTRO_FOG} />}
      </div>

      <div className="wordmark">
        jazztinn
        <br />
        {"\u00A0"}legaspi
      </div>

      {/* top-center logo: traces its outline (curves and all) as the second
          screen scrolls in, then fills solid black. */}
      <svg
        className="nav-logo"
        viewBox="0 0 831 509"
        aria-hidden
      >
        {NAV_LOGO_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            transform={i === 1 ? "translate(341,0)" : undefined}
            pathLength="1"
            strokeWidth="14"
          />
        ))}
      </svg>

      {/* top-right: menu button */}
      <div className="topbar">
        <button
          className={`menu-btn${menuOpen ? " menu-btn--open" : ""}`}
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => (menuOpen ? closeMenu() : openMenu())}
        >
          <span />
          <span />
        </button>
      </div>

      {/* menu modal: split editorial panel */}
      <div
        className={`menu-modal${menuOpen ? " menu-modal--open" : ""}${menuClosing ? " menu-modal--closing" : ""}`}
        aria-hidden={!menuOpen}
        onAnimationEnd={(event) => {
          if (event.animationName === "menu-eat-out") setMenuClosing(false);
        }}
      >
        <div className="menu-modal-fog" aria-hidden>
          {ready && (menuOpen || menuClosing) && <Dithering {...MENU_FOG} />}
        </div>
        <div className="menu-modal-info">
          <div>
            <img
              className="menu-preview"
              src="/work/datalink-booth.jpg"
              alt=""
              width="1800"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <div className="menu-meta">
              <div>
                <span>Recent Project</span>
                <strong>Datalink Booth</strong>
              </div>
              <div>
                <span>Scope</span>
                <strong>Web Development</strong>
                <strong>Visual Design</strong>
                <strong>Creative Direction</strong>
              </div>
            </div>
          </div>
          <div className="menu-footer">
            <div className="menu-socials">
              {["github", "linkedin", "facebook", "instagram"].map((id) => {
                const social = SOCIALS.find((item) => item.id === id);
                if (!social) return null;
                return (
                  <a
                    key={social.id}
                    className="menu-social"
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                  >
                    <span
                      className="menu-social-fog"
                      style={{
                        maskImage: `url(/icons/${social.id}.svg)`,
                        WebkitMaskImage: `url(/icons/${social.id}.svg)`,
                      }}
                    >
                      {ready && (
                        <SmokeRing
                          {...SOCIAL_SHADER}
                          colorBack={social.shader.colorBack}
                          colors={social.shader.colors}
                        />
                      )}
                    </span>
                  </a>
                );
              })}
            </div>
            <p>Building strange, useful interfaces.</p>
            <p>© 2026 · Jazz Legaspi</p>
          </div>
        </div>
        <nav className="menu-modal-nav">
          <a href="#" onClick={closeMenu}>Work</a>
          <a href="#" onClick={closeMenu}>Services</a>
          <a href="#" onClick={closeMenu}>Pricing</a>
          <a href="#" onClick={closeMenu}>About</a>
          <a href="#" onClick={closeMenu}>Contact</a>
        </nav>
      </div>
      <div
        className={`menu-scrim${menuOpen || menuClosing ? " menu-scrim--open" : ""}`}
        onClick={closeMenu}
        aria-hidden
      />

      {/* bottom-center: theme + sound toggles */}
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
      <section className="intro content-warp">
        <div className="pin">
          {/* slanted text marquee that drifts as the J/L converge — top row
              right, bottom row left, tilted opposite to the wipe ("\"). */}
          {[introTextLeftRef, introTextRightRef].map((ref, side) => (
            <div
              key={side}
              ref={ref}
              className="intro-text"
              aria-hidden
            >
              <div className={`intro-text-row${side === 0 ? " intro-text-row--naked" : ""}`}>
                <div className="intro-text-drift intro-text-drift--right">
                  <div className="intro-text-scroll right">
                    <span>We are dreaming of a new day when the new day&rsquo;s here already. We are running from the battle when it&rsquo;s one that must be fought.&nbsp;&nbsp;&nbsp;We are dreaming of a new day when the new day&rsquo;s here already. We are running from the battle when it&rsquo;s one that must be fought.&nbsp;&nbsp;&nbsp;</span>
                    <span>We are dreaming of a new day when the new day&rsquo;s here already. We are running from the battle when it&rsquo;s one that must be fought.&nbsp;&nbsp;&nbsp;We are dreaming of a new day when the new day&rsquo;s here already. We are running from the battle when it&rsquo;s one that must be fought.&nbsp;&nbsp;&nbsp;</span>
                  </div>
                </div>
              </div>
              <div className={`intro-text-row${side === 1 ? " intro-text-row--naked" : ""}`}>
                <div className="intro-text-drift intro-text-drift--left">
                  <div className="intro-text-scroll left">
                    <span>We are dreaming of tomorrow, and tomorrow isn&rsquo;t coming. We are dreaming of a glory that we don&rsquo;t really want.&nbsp;&nbsp;&nbsp;We are dreaming of tomorrow, and tomorrow isn&rsquo;t coming. We are dreaming of a glory that we don&rsquo;t really want.&nbsp;&nbsp;&nbsp;</span>
                    <span>We are dreaming of tomorrow, and tomorrow isn&rsquo;t coming. We are dreaming of a glory that we don&rsquo;t really want.&nbsp;&nbsp;&nbsp;We are dreaming of tomorrow, and tomorrow isn&rsquo;t coming. We are dreaming of a glory that we don&rsquo;t really want.&nbsp;&nbsp;&nbsp;</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="mono-layer" aria-hidden>
            <div
              ref={jRef}
              className="mono-img mono-piece mono-j"
              style={{ aspectRatio: "516 / 509" }}
            >
              {ready && introShadersActive && <LiquidMetal image="/monogram/J_refined_geometric.svg" {...METAL} />}
            </div>
            <div
              ref={lRef}
              className="mono-img mono-piece mono-l"
              style={{ aspectRatio: "490 / 509" }}
            >
              {ready && introShadersActive && <LiquidMetal image="/monogram/L_refined_geometric.svg" {...METAL} />}
            </div>
            <div
              className="mono-img mono-full"
              style={{ aspectRatio: "831 / 509" }}
            />
          </div>

          <div className="hero" ref={heroRef}>
            <h1>hi. i&rsquo;m <span>jazz.</span></h1>
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
                    {ready && introShadersActive && (
                      <SmokeRing
                        {...SOCIAL_SHADER}
                        colorBack={s.shader.colorBack}
                        colors={s.shader.colors}
                      />
                    )}
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
          >
            <div className="work-intro">
              <div className="work-placeholders" aria-hidden>
                {WORK_PLACEHOLDER_ITEMS.map((it) => (
                  <figure
                    key={`placeholder-${it.id}`}
                    className={`work-item work-item--${it.size} work-placeholder-card`}
                  >
                    <span className="work-cap">{it.label}</span>
                    <img
                      className={`work-photo${it.tone ? ` work-photo--${it.tone}` : ""}`}
                      src={it.src}
                      alt=""
                      width={it.width}
                      height={it.height}
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: it.position }}
                    />
                    {it.placeholderQuote && (
                      <blockquote className="work-quote">
                        {it.placeholderQuote}
                        <cite>— {it.placeholderQuoteBy}</cite>
                      </blockquote>
                    )}
                  </figure>
                ))}
              </div>
              <figure className="work-item work-item--tall work-intro-photo work-intro-photo--orbit">
                <span className="work-cap">THE ORBIT</span>
                <img
                  className="work-photo"
                  src="/work/orbit-talk.jpg"
                  alt="Students receiving recognition on an event stage"
                  width={1600}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: "center" }}
                />
                <blockquote className="work-quote">
                  <span className="work-quote__text">
                    <span>Monsters</span>
                    <span className="work-quote__hi work-quote__hi--9" aria-hidden>Monsters</span>
                  </span>{" "}are the patron saints of{" "}
                  <span className="work-quote__text">
                    <span>imperfection</span>
                    <span className="work-quote__hi work-quote__hi--10" aria-hidden>imperfection</span>
                  </span>.
                  <cite>— Guillermo del Toro</cite>
                </blockquote>
              </figure>
            </div>
            {WORK_ITEMS.map((it) => (
              <figure key={it.id} className={`work-item work-item--${it.size}${it.vertical ? ` work-item--${it.vertical}` : ""}${it.layout ? ` work-item--${it.layout}` : ""}`}>
                {it.quote && it.quotePosition !== "after" && (
                  <blockquote className="work-quote">
                    {it.wipeQuote ? (
                      <>
                        <span className="work-quote__text">
                          <span>To strive</span>
                          <span className="work-quote__hi" aria-hidden>To strive</span>
                        </span>
                        , <span className="work-quote__text">
                          <span>to seek</span>
                          <span className="work-quote__hi work-quote__hi--2" aria-hidden>to seek</span>
                        </span>, <span className="work-quote__text">
                          <span>to find</span>
                          <span className="work-quote__hi work-quote__hi--3" aria-hidden>to find</span>
                        </span>, and <span className="work-quote__text">
                          <span>not to yield</span>
                          <span className="work-quote__hi work-quote__hi--4" aria-hidden>not to yield</span>
                        </span>.
                      </>
                    ) : it.wipeQuote3 ? (
                      <>
                        <span className="work-quote__text">
                          <span>Not all those who</span>
                          <span className="work-quote__hi work-quote__hi--7" aria-hidden>Not all those who</span>
                        </span>{" "}
                        <span className="work-quote__text">
                          <span>wander are lost</span>
                          <span className="work-quote__hi work-quote__hi--8" aria-hidden>wander are lost</span>
                        </span>.
                      </>
                    ) : (
                      it.quote
                    )}
                    <cite>— {it.quoteBy}</cite>
                  </blockquote>
                )}
                <span className="work-cap">{it.label}</span>
                <img
                  className={`work-photo${it.tone ? ` work-photo--${it.tone}` : ""}`}
                  src={it.src}
                  alt={it.alt}
                  width={it.width}
                  height={it.height}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: it.position }}
                />
                {it.quote && it.quotePosition === "after" && (
                  <blockquote className="work-quote">
                    {it.wipeQuote2 ? (
                      <>
                        Still round the corner there may wait{" "}
                        <span className="work-quote__text">
                          <span>a new road</span>
                          <span className="work-quote__hi work-quote__hi--5" aria-hidden>a new road</span>
                        </span>{" "}or{" "}
                        <span className="work-quote__text">
                          <span>a secret gate</span>
                          <span className="work-quote__hi work-quote__hi--6" aria-hidden>a secret gate</span>
                        </span>.
                      </>
                    ) : (
                      it.quote
                    )}
                    <cite>— {it.quoteBy}</cite>
                  </blockquote>
                )}
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* trailing space: lets the carousel finish, then the liquid floods in */}
      <section className="outro content-warp" aria-hidden />
    </div>
  );
}
