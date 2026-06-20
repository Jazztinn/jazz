"use client";

import { useEffect, useRef } from "react";
import { Renderer, Triangle, Program, Mesh, Texture, Flowmap, Vec2 } from "ogl";

// buttermax-style liquid text: the hero title is rasterized to a texture, then
// distorted by a pointer-velocity flowmap (a decaying trail of mouse motion)
// with a per-channel RGB shift for chromatic aberration. All WebGL.

const VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;    // rasterized title
  uniform sampler2D tImg;    // reveal image
  uniform sampler2D tFlow;   // pointer-velocity flowmap
  uniform float uDisp;
  uniform float uChroma;
  uniform float uImgScale;
  uniform float uAspect;     // canvas w/h
  uniform float uImgAspect;  // image w/h
  uniform vec2  uMouse;      // cursor in uv (y up)
  uniform float uRadius;     // reveal blob radius (uv)
  uniform float uTime;
  uniform vec3  uPageBg;     // approx page background for the contrast blend
  uniform float uEdgeChroma; // RGB split width at the reveal blob edge
  varying vec2 vUv;

  // --- 2D simplex noise (Ashima / Stefan Gustavson) ---
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
           + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // sample a texture with a per-channel RGB shift (chromatic aberration)
  vec4 chroma(sampler2D t, vec2 uv, vec2 ch) {
    vec4 cr = texture2D(t, uv + ch);
    vec4 cg = texture2D(t, uv);
    vec4 cb = texture2D(t, uv - ch);
    return vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }

  void main() {
    vec3 flow = texture2D(tFlow, vUv).rgb;
    float m = length(flow.xy);

    // wobbling water blob around the cursor (noise-warped radius, solid edge)
    vec2 p = (vUv - uMouse) * vec2(uAspect, 1.0);
    float d = length(p);
    vec2 dir = d > 1e-4 ? p / d : vec2(0.0);
    float edge = snoise(dir * 1.7 + uTime * 0.35);     // lobes around the rim
    float ripple = snoise(p * 4.0 + uTime * 0.5);       // small surface ripples

    float revealR = uRadius * (0.74 + 0.26 * edge) + 0.05 * ripple;
    float blob = 1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d);

    // distortion confined to a slightly larger wobbly blob, so the warp is
    // non-circular and tied to the same liquid shape (not a separate disc)
    float warpR = uRadius * 1.32 * (0.74 + 0.26 * edge) + 0.05 * ripple;
    float warpMask = 1.0 - smoothstep(warpR - 0.04, warpR + 0.04, d);

    vec2 disp = flow.xy * uDisp * warpMask;
    vec2 ch = flow.xy * uChroma * (0.6 + m * 6.0) * warpMask;

    // text coverage (rasterized white -> use alpha only; recolored below)
    vec4 text = chroma(tMap, vUv - disp, ch);

    // image, mapped to a centered aspect-correct box, displaced by the flow
    vec2 size = vec2(uImgScale * uImgAspect / uAspect, uImgScale);
    vec2 iuv = (vUv - 0.5) / size + 0.5 - disp;
    vec4 img = chroma(tImg, iuv, ch);
    if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) img.a = 0.0;

    // per-channel blob coverage -> chromatic aberration along the blob edge
    float eb = uEdgeChroma;
    float aR = img.a * (1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d - eb));
    float aG = img.a * blob;
    float aB = img.a * (1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d + eb));

    // wordmark-style contrast: white text in a difference blend against
    // whatever sits behind it (page bg, or the revealed orange w/ edge fringe)
    vec3 behind;
    behind.r = mix(uPageBg.r, img.r, aR);
    behind.g = mix(uPageBg.g, img.g, aG);
    behind.b = mix(uPageBg.b, img.b, aB);
    vec3 tcol = abs(vec3(1.0) - behind);
    float a = max(max(aR, aG), max(aB, text.a));
    vec3 col = mix(behind, tcol, text.a);
    gl_FragColor = vec4(col, a);
  }
`;

export default function HeroLiquid({ dark = false, className = "", image = "/orange.webp" }) {
  const mountRef = useRef(null);
  const redrawRef = useRef(null);
  const uniformsRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let raf = 0;
    let destroyed = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const renderer = new Renderer({ alpha: true, dpr, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    mount.appendChild(canvas);

    // offscreen 2D canvas that holds the rasterized title
    const textCanvas = document.createElement("canvas");
    const tctx = textCanvas.getContext("2d");
    const texture = new Texture(gl, { image: textCanvas, generateMipmaps: false });

    // reveal image texture (loaded async)
    const imgTexture = new Texture(gl, { generateMipmaps: false });
    const revealImg = new Image();
    revealImg.crossOrigin = "anonymous";
    revealImg.onload = () => {
      if (destroyed) return;
      imgTexture.image = revealImg;
      imgTexture.needsUpdate = true;
      program.uniforms.uImgAspect.value = revealImg.naturalWidth / revealImg.naturalHeight;
    };
    revealImg.src = image;

    const flowmap = new Flowmap(gl, {
      falloff: 0.6,        // distortion stamp radius around the cursor (larger)
      dissipation: 0.92,   // how fast the trail fades (higher = longer tail)
      alpha: 1,
    });

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        tMap: { value: texture },
        tImg: { value: imgTexture },
        tFlow: flowmap.uniform,
        uDisp: { value: 0.1 },
        uChroma: { value: 0.018 },
        uEdgeChroma: { value: 0.014 },
        uImgScale: { value: 1.6 },
        uAspect: { value: 1 },
        uImgAspect: { value: 1 },
        uMouse: { value: new Vec2(-1, -1) },
        uRadius: { value: 0 },
        uTime: { value: 0 },
        uPageBg: { value: dark ? [0.1, 0.1, 0.1] : [0.96, 0.96, 0.94] },
      },
      transparent: true,
    });
    const mesh = new Mesh(gl, { geometry, program });
    uniformsRef.current = program.uniforms;

    function drawText() {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));

      textCanvas.width = w * dpr;
      textCanvas.height = h * dpr;
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.clearRect(0, 0, w, h);

      // mirror the .hero-title typography (Quicksand, tight tracking, like the
      // "jazztinn legaspi" wordmark). Rasterize in solid white — the shader
      // recolors via a difference blend for the contrast effect.
      const titleEl = mount.parentElement && mount.parentElement.querySelector(".hero-title");
      const cs = titleEl ? getComputedStyle(titleEl) : null;
      const fs = cs ? parseFloat(cs.fontSize) : h * 0.5;
      const fam = cs ? cs.fontFamily : '"Quicksand", sans-serif';
      const ls = cs ? parseFloat(cs.letterSpacing) || 0 : 0;
      const weight = cs ? cs.fontWeight : "400";

      tctx.save();
      tctx.translate(w / 2, h / 2);
      tctx.font = `${weight} ${fs}px ${fam}`;
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      if ("letterSpacing" in tctx) tctx.letterSpacing = `${ls.toFixed(2)}px`;
      tctx.fillStyle = "#ffffff";
      tctx.fillText("hi. i’m jazz.", 0, 0);
      tctx.restore();

      texture.image = textCanvas;
      texture.needsUpdate = true;
    }
    redrawRef.current = drawText;

    function resize() {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      program.uniforms.uAspect.value = renderer.width / renderer.height;
      drawText();
    }

    // pointer -> flowmap velocity + persistent reveal blob
    const REVEAL_RADIUS = 0.84;
    const mouse = new Vec2(-1);     // uv pos fed to the flowmap stamp
    const velocity = new Vec2();
    let lastTime = 0;
    let movedAt = 0;
    const lastMouse = new Vec2();
    let hovering = false;
    let targetRadius = 0;

    function updateMouse(e) {
      const rect = mount.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mouse.set(x, y);
      program.uniforms.uMouse.value.set(x, y);
      if (!lastTime) {
        lastTime = performance.now();
        lastMouse.set(e.clientX, e.clientY);
      }
      const dt = Math.max(14, performance.now() - lastTime);
      lastTime = performance.now();
      velocity.set((e.clientX - lastMouse.x) / dt, (e.clientY - lastMouse.y) / dt);
      velocity.needsUpdate = true;
      movedAt = performance.now();
      lastMouse.set(e.clientX, e.clientY);
    }

    function update() {
      raf = requestAnimationFrame(update);

      program.uniforms.uTime.value = performance.now() * 0.001;
      // grow/shrink the reveal blob; keep it anchored to the last cursor pos
      const r = program.uniforms.uRadius;
      r.value += (targetRadius - r.value) * 0.12;

      // stop stamping new fluid once the cursor has been still for a moment, so
      // the trail dissipates — but DON'T move the reveal blob.
      const idle = performance.now() - movedAt > 90;
      if (idle) velocity.set(0, 0);

      flowmap.aspect = renderer.width / renderer.height;
      flowmap.mouse.copy(hovering ? mouse : new Vec2(-1));
      flowmap.velocity.lerp(velocity, velocity.len() ? 0.4 : 0.1);
      velocity.needsUpdate = false;
      flowmap.update();

      renderer.render({ scene: mesh });
    }

    function onEnter() {
      hovering = true;
      targetRadius = REVEAL_RADIUS;
    }
    function onLeave() {
      hovering = false;
      targetRadius = 0;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    mount.addEventListener("pointerenter", onEnter);
    mount.addEventListener("pointerleave", onLeave);
    mount.addEventListener("pointermove", updateMouse);
    window.addEventListener("touchmove", (e) => e.touches[0] && updateMouse(e.touches[0]), { passive: true });

    // wait for fonts (Quicksand), otherwise the first raster uses a fallback
    const fontReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    Promise.resolve(fontReady).then(() => {
      if (destroyed) return;
      resize();
      update();
    });

    return () => {
      destroyed = true;
      redrawRef.current = null;
      uniformsRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeEventListener("pointerenter", onEnter);
      mount.removeEventListener("pointerleave", onLeave);
      mount.removeEventListener("pointermove", updateMouse);
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    };
  }, []);

  // redraw text + update the contrast background on theme change
  useEffect(() => {
    if (uniformsRef.current) {
      uniformsRef.current.uPageBg.value = dark ? [0.1, 0.1, 0.1] : [0.96, 0.96, 0.94];
    }
    redrawRef.current && redrawRef.current();
  }, [dark]);

  return <div className={`hero-liquid-gl ${className}`} ref={mountRef} aria-hidden />;
}
