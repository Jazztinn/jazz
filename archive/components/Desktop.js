"use client";

import { useEffect, useRef, useState } from "react";
import { SITE, ICONS, SOCIALS } from "@/app/content";
import { PANELS } from "@/components/WindowContent";
import {
  NavIcon, SocialIcon, SunIcon, MoonIcon, SoundIcon,
} from "@/components/Placeholder";

let zCounter = 10;

export default function Desktop() {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);

  // open windows: [{ id, title, x, y, z }]
  const [wins, setWins] = useState([]);
  const drag = useRef(null);
  const audioCtx = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

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

  function focusWin(id) {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: ++zCounter } : w)));
  }

  function openWin(id, title) {
    blip();
    setWins((ws) => {
      const existing = ws.find((w) => w.id === id);
      if (existing) return ws.map((w) => (w.id === id ? { ...w, z: ++zCounter } : w));
      const n = ws.length;
      return [
        ...ws,
        { id, title, x: 60 + n * 34, y: 40 + n * 34, z: ++zCounter },
      ];
    });
  }

  function closeWin(id) {
    blip();
    setWins((ws) => ws.filter((w) => w.id !== id));
  }

  // drag
  function onDown(e, id) {
    focusWin(id);
    const p = e.touches ? e.touches[0] : e;
    const w = wins.find((x) => x.id === id);
    drag.current = { id, sx: p.clientX, sy: p.clientY, ox: w.x, oy: w.y };
  }
  useEffect(() => {
    function move(e) {
      if (!drag.current) return;
      const p = e.touches ? e.touches[0] : e;
      const { id, sx, sy, ox, oy } = drag.current;
      setWins((ws) =>
        ws.map((w) =>
          w.id === id ? { ...w, x: ox + (p.clientX - sx), y: oy + (p.clientY - sy) } : w
        )
      );
    }
    function up() { drag.current = null; }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, []);

  return (
    <main className="desktop">
      <div className="toolbar">
        <button className="icon-btn lg-glass lg-press" onClick={() => { blip(); setDark((d) => !d); }} aria-label="toggle theme">
          {dark ? <MoonIcon /> : <SunIcon />}
        </button>
        <button className="icon-btn lg-glass lg-press" onClick={() => setMuted((m) => !m)} aria-label="toggle sound">
          <SoundIcon muted={muted} />
        </button>
      </div>

      <div className="stage">
        {/* base home window */}
        <section className="window home-window lg-glass">
          <header className="title-bar lg-glass-primary"><span className="title-label">home</span></header>
          <div className="window-body">
            <div className="home">
              <h1 className="hello">hi! <span className="accent">i'm {SITE.name}</span></h1>
              <p className="tagline">{SITE.tagline}</p>
              <nav className="icon-nav">
                {ICONS.map((it) => (
                  <button key={it.id} className="nav-item lg-glass lg-press" onClick={() => openWin(it.id, it.label)}>
                    <NavIcon type={it.icon} />
                    <span>{it.label}</span>
                  </button>
                ))}
              </nav>
              <button className="extra-link" onClick={() => openWin("downloads", "downloads")}>+ downloads</button>
            </div>
          </div>
        </section>

        {/* stacked floating windows */}
        {wins.map((w) => (
          <section
            key={w.id}
            className="window float-window lg-glass"
            style={{ left: w.x, top: w.y, zIndex: w.z }}
            onMouseDown={() => focusWin(w.id)}
          >
            <header
              className="title-bar lg-glass-primary"
              onMouseDown={(e) => onDown(e, w.id)}
              onTouchStart={(e) => onDown(e, w.id)}
            >
              <span className="title-label">{w.title}</span>
              <button className="win-close" onClick={() => closeWin(w.id)} aria-label="close">×</button>
            </header>
            <div className="window-body">{PANELS[w.id]?.node}</div>
          </section>
        ))}
      </div>

      <footer className="site-footer">
        <div className="socials">
          {SOCIALS.map((s) => (
            <a key={s.id} className="social lg-glass lg-press" href={s.href} aria-label={s.label} target="_blank" rel="noreferrer">
              <SocialIcon />
            </a>
          ))}
        </div>
        <p className="copyright">{SITE.copyright}</p>
      </footer>
    </main>
  );
}
