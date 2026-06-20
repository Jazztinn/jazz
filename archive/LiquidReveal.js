"use client";

import { useEffect, useRef } from "react";
import { Renderer, Triangle, Program, Mesh, Texture, Flowmap, Vec2 } from "ogl";

// same liquid blob as the hero reveal (HeroLiquid), but without the rasterized
// title: it reveals a full-color image inside a wobbling, pointer-warped blob
// and stays transparent everywhere else, so a duotone copy shows through
// underneath. Mounted only while the photo is hovered.

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
  uniform sampler2D tImg;
  uniform sampler2D tFlow;
  uniform float uDisp;
  uniform float uChroma;
  uniform float uEdgeChroma;
  uniform float uAspect;
  uniform float uImgAspect;
  uniform vec2  uMouse;
  uniform float uRadius;
  uniform float uTime;
  varying vec2 vUv;

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

  vec4 chroma(sampler2D t, vec2 uv, vec2 ch) {
    vec4 cr = texture2D(t, uv + ch);
    vec4 cg = texture2D(t, uv);
    vec4 cb = texture2D(t, uv - ch);
    return vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }

  // object-fit: cover mapping of the image into the element box
  vec2 coverUV(vec2 uv){
    vec2 s = vec2(uAspect, 1.0);
    vec2 i = vec2(uImgAspect, 1.0);
    vec2 nw = (uAspect < uImgAspect) ? vec2(i.x * s.y / i.y, s.y)
                                     : vec2(s.x, i.y * s.x / i.x);
    vec2 off = ((uAspect < uImgAspect) ? vec2((nw.x - s.x) * 0.5, 0.0)
                                       : vec2(0.0, (nw.y - s.y) * 0.5)) / nw;
    return uv * s / nw + off;
  }

  void main() {
    vec3 flow = texture2D(tFlow, vUv).rgb;
    float m = length(flow.xy);

    vec2 p = (vUv - uMouse) * vec2(uAspect, 1.0);
    float d = length(p);
    vec2 dir = d > 1e-4 ? p / d : vec2(0.0);
    float edge = snoise(dir * 1.7 + uTime * 0.35);
    float ripple = snoise(p * 4.0 + uTime * 0.5);

    float revealR = uRadius * (0.74 + 0.26 * edge) + 0.05 * ripple;
    float blob = 1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d);

    float warpR = uRadius * 1.32 * (0.74 + 0.26 * edge) + 0.05 * ripple;
    float warpMask = 1.0 - smoothstep(warpR - 0.04, warpR + 0.04, d);

    vec2 disp = flow.xy * uDisp * warpMask;
    vec2 ch = flow.xy * uChroma * (0.6 + m * 6.0) * warpMask;

    vec2 iuv = coverUV(vUv) - disp;
    vec4 img = chroma(tImg, iuv, ch);
    if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) img.a = 0.0;

    // per-channel blob coverage -> chromatic fringe at the liquid edge
    float eb = uEdgeChroma;
    float aR = img.a * (1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d - eb));
    float aG = img.a * blob;
    float aB = img.a * (1.0 - smoothstep(revealR - 0.004, revealR + 0.004, d + eb));
    float a = max(max(aR, aG), aB);

    gl_FragColor = vec4(img.rgb, a);
  }
`;

export default function LiquidReveal({ className = "", image }) {
  const mountRef = useRef(null);

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

    const flowmap = new Flowmap(gl, { falloff: 0.6, dissipation: 0.92, alpha: 1 });

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        tImg: { value: imgTexture },
        tFlow: flowmap.uniform,
        uDisp: { value: 0.012 },
        uChroma: { value: 0.002 },
        uEdgeChroma: { value: 0.0015 },
        uAspect: { value: 1 },
        uImgAspect: { value: 1 },
        uMouse: { value: new Vec2(0.5, 0.5) },
        uRadius: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
    });
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      program.uniforms.uAspect.value = renderer.width / renderer.height;
    }

    const REVEAL_RADIUS = 0.5; // smaller than the hero — these photos are small
    const mouse = new Vec2(0.5, 0.5);
    const velocity = new Vec2();
    let lastTime = 0;
    let movedAt = 0;
    const lastMouse = new Vec2();
    let targetRadius = REVEAL_RADIUS; // grow in as soon as it mounts (on hover)

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
      const r = program.uniforms.uRadius;
      r.value += (targetRadius - r.value) * 0.12;

      if (performance.now() - movedAt > 90) velocity.set(0, 0);

      flowmap.aspect = renderer.width / renderer.height;
      flowmap.mouse.copy(mouse);
      flowmap.velocity.lerp(velocity, velocity.len() ? 0.4 : 0.1);
      velocity.needsUpdate = false;
      flowmap.update();

      renderer.render({ scene: mesh });
    }

    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    // the canvas has pointer-events:none, so track pointer on the window
    window.addEventListener("pointermove", updateMouse);

    resize();
    update();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", updateMouse);
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    };
  }, [image]);

  return <div className={`liquid-reveal-gl ${className}`} ref={mountRef} aria-hidden />;
}
