"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SunIcon, MoonIcon, SoundIcon } from "@/components/Icons";

const EMPTY_CLIP = "polygon(0 0, 0 0, 0 0)";
const SCROLL_EPSILON = 0.001;
const SMOOTH_SCROLL_EASE = 0.075;
const MOUSE_WHEEL_MULTIPLIER = 1.15;

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
  },
];
const WORK_PLACEHOLDER_ITEMS = WORK_ITEMS.slice(0, 3);

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
  const progressRef = useRef({ p: -1, q: -1, f: -1, wx: -1 });
  const floodShaderActiveRef = useRef(false);
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

    function updateScrollProgress() {
      rafRef.current = 0;
      const frame = frameRef.current;
      if (!frame) return;

      const vh = window.innerHeight;
      // work gallery: vertical scroll through the section drives a horizontal
      // translate of the track (cards move left). Lando-style scroll carousel.
      let wx = 0;
      let workProg = 0;
      let workRawProg = 0;
      const sec = workRef.current, track = trackRef.current;
      if (sec && track) {
        // Tie carousel progress to the section's own sticky range so it finishes
        // exactly when the pin releases — no dead scroll, normal scroll resumes.
        // `lead` lets it start moving ~1 viewport before the section pins.
        const rect = sec.getBoundingClientRect();
        const lead = vh * 1.0;
        const span = sec.offsetHeight - vh + lead;
        workRawProg = span > 0 ? (lead - rect.top) / span : 0; // unclamped, grows past 1
        workProg = clamp01(workRawProg);
        wx = workProg * Math.max(0, track.scrollWidth - window.innerWidth);
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
      if (sl.settle) clearTimeout(sl.settle);
      sl.settle = setTimeout(() => setCssVar(frame, "--slosh", "0deg"), 110);
      // top UI turns white once the waterline rises above the top bar; bottom
      // toggles turn white once it rises above the bottom toggles.
      const fl = floodRef.current;
      if (fl) {
        const top = fl.getBoundingClientRect().top;
        const floodShouldBeActive = top <= vh * 2;
        if (floodShouldBeActive !== floodShaderActiveRef.current) {
          floodShaderActiveRef.current = floodShouldBeActive;
          setFloodShaderActive(floodShouldBeActive);
        }
        const overTop = top <= 90;
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

      const meet = Math.min(1, next.p / 0.85);
      const sw = clamp01((next.p - 0.85) / 0.12);
      // No full-logo crossfade: the J/L pieces slide in and freeze at the merged
      // position. They stay visible (full logo is never shown) and fade out
      // bottom-up with --f on the way down.
      setCssVar(frame, "--p", String(next.p));
      setCssVar(frame, "--q", String(next.q));
      setCssVar(frame, "--f", String(next.f));
      setCssVar(frame, "--nav-opacity", next.q > 0 ? "1" : "0");
      setCssVar(frame, "--nav-fill", String(clamp01((next.q - 0.7) / 0.3)));
      setCssVar(frame, "--work-x", `${(-wx).toFixed(2)}px`);
      setCssVar(frame, "--j-x", `${(-185 + meet * 105).toFixed(3)}%`);
      setCssVar(frame, "--l-x", `${(85 - meet * 100).toFixed(3)}%`);
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

  return (
    <div className="frame" ref={frameRef}>
      <div className="grid-page" />

      {/* Flood: anchored in the document (scrolls with the page, doesn't stick
          to the screen). Back = opaque fill behind the photos; front = a
          translucent sheet over them so the lower photos look submerged. */}
      <div className="flood flood--back" aria-hidden ref={floodRef}>
        <div className="liquid-inner">
          <div className="liquid-wave one" />
          <div className="liquid-wave two" />
          <div className="liquid-body" />
        </div>
      </div>
      <div className="flood flood--front" aria-hidden>
        <div className="liquid-inner">
          <div className="liquid-wave one" />
          <div className="liquid-wave two" />
          <div className="liquid-body" />
        </div>
      </div>
      {/* beige halftone over the whole orange flood */}
      <div className="flood-fog" aria-hidden>
        {ready && floodShaderActive && <Dithering {...OUTRO_FOG} />}
      </div>

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
      <section className="intro">
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
              {ready && <LiquidMetal image="/monogram/J_refined_geometric.svg" {...METAL} />}
            </div>
            <div
              ref={lRef}
              className="mono-img mono-piece mono-l"
              style={{ aspectRatio: "490 / 509" }}
            >
              {ready && <LiquidMetal image="/monogram/L_refined_geometric.svg" {...METAL} />}
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
                    {ready && (
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
                  </figure>
                ))}
              </div>
              <h2>day in my life</h2>
              <p className="muted">
                candid moments, friends,
                <br />
                orgs, hobbies, and in-between
              </p>
            </div>
            {WORK_ITEMS.map((it) => (
              <figure key={it.id} className={`work-item work-item--${it.size}`}>
                {it.quote && (
                  <blockquote className="work-quote">
                    {it.quote}
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
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* trailing space: lets the carousel finish, then the liquid floods in */}
      <section className="outro" aria-hidden />
    </div>
  );
}
