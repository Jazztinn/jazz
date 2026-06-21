"use client";

import { useEffect } from "react";

// Plain WebGL fluid cursor — Pavel Dobryakov's fluid sim (MIT), ported 1:1 from
// the Inspira-UI FluidCursor (Vue) to a React effect. Renders the dye DIRECTLY
// to a visible full-screen canvas (colored), exactly like the reference. Step 1:
// just get the fluid working + dissolving. Look/mask comes later.

const config = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1440,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 3.5,
  VELOCITY_DISSIPATION: 8, // let a little momentum linger -> faint plume rollup
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 4, // tiny vorticity confinement -> very subtle mushroom curl
  SPLAT_RADIUS: 0.45, // larger liquid body
  SPLAT_FORCE: 2900, // gentler push -> just enough to roll into a soft mushroom
  SHADING: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: true,
};
// slo-mo: scale the sim timestep down so the liquid flows + dissolves slowly.
const SLOWMO = 0.45;

export default function FluidCursor() {
  useEffect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // offscreen WebGL canvas renders the liquid as a WHITE solid mask. Two
    // visible 2D layers use it:
    //   contrast: white liquid w/ mix-blend-mode:difference -> inverts whatever
    //             is behind it (text, page bg, image edges).
    //   reveal:   true-color card pixels masked by the liquid, drawn on top so
    //             cards show real color instead of an inversion.
    const canvas = document.createElement("canvas");
    const contrast = document.createElement("canvas");
    contrast.className = "blob-cursor blob-contrast";
    const reveal = document.createElement("canvas");
    reveal.className = "blob-cursor blob-reveal";
    document.body.appendChild(contrast);
    document.body.appendChild(reveal);
    const cctx = contrast.getContext("2d");
    const rctx = reveal.getContext("2d");
    // offscreen scratch for the liquid-glass body + bevel rims
    const glassTmp = document.createElement("canvas");
    const rimTmp = document.createElement("canvas");
    const gtx = glassTmp.getContext("2d");
    const xtx = rimTmp.getContext("2d");
    let glassSheen = null;
    let glassSheenWidth = 0;
    let glassSheenHeight = 0;

    let pointers = [pointerPrototype()];
    pointers[0].color = HSVtoRGB(Math.random(), 1, 1);

    const { gl, ext } = getWebGLContext(canvas);
    if (!gl) { contrast.remove(); reveal.remove(); return; }
    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
      config.SHADING = false;
    }

    function pointerPrototype() {
      return {
        id: -1, texcoordX: 0, texcoordY: 0, prevTexcoordX: 0, prevTexcoordY: 0,
        deltaX: 0, deltaY: 0, down: false, moved: false, color: { r: 0, g: 0, b: 0 },
      };
    }

    function getWebGLContext(canvas) {
      const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true };
      let gl = canvas.getContext("webgl2", params);
      const isWebGL2 = !!gl;
      if (!gl) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
      if (!gl) return { gl: null, ext: null };

      let halfFloat;
      let supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
      } else {
        halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
      }
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
      let formatRGBA, formatRG, formatR;
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }
      return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };

      function getSupportedFormat(gl, internalFormat, format, type) {
        if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
          switch (internalFormat) {
            case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default: return null;
          }
        }
        return { internalFormat, format };
      }
      function supportRenderTextureFormat(gl, internalFormat, format, type) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      }
    }

    function hashCode(s) {
      if (!s.length) return 0;
      let hash = 0;
      for (let i = 0; i < s.length; i++) { hash = (hash << 5) - hash + s.charCodeAt(i); hash |= 0; }
      return hash;
    }
    function addKeywords(source, keywords) {
      if (!keywords) return source;
      let s = "";
      for (const k of keywords) s += `#define ${k}\n`;
      return s + source;
    }
    function compileShader(type, source, keywords) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, addKeywords(source, keywords));
      gl.compileShader(shader);
      return shader;
    }
    function createProgram(vertexShader, fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      return program;
    }
    function getUniforms(program) {
      const uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return uniforms;
    }
    class Program {
      constructor(vertexShader, fragmentShader) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
      }
      bind() { gl.useProgram(this.program); }
    }
    class Material {
      constructor(vertexShader, fragmentShaderSource) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = {};
        this.activeProgram = null;
        this.uniforms = {};
      }
      setKeywords(keywords) {
        let hash = 0;
        for (const kw of keywords) hash += hashCode(kw);
        let program = this.programs[hash];
        if (program == null) {
          const fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
          program = createProgram(this.vertexShader, fragmentShader);
          this.programs[hash] = program;
        }
        if (program === this.activeProgram) return;
        this.uniforms = getUniforms(program);
        this.activeProgram = program;
      }
      bind() { gl.useProgram(this.activeProgram); }
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }`);
    const copyShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; uniform sampler2D uTexture;
      void main () { gl_FragColor = texture2D(uTexture, vUv); }`);
    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;
      void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`);
    const displayShaderSource = `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform sampler2D uTexture; uniform vec2 texelSize;
      vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        #ifdef SHADING
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;
          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          c *= diffuse;
        #endif
        // solid liquid mask: BINARY threshold -> alpha is exactly 0 or 1, never
        // partial, so there's zero wisp/translucency. The 2D layer colors it.
        float d = max(c.r, max(c.g, c.b));
        float a = step(0.14, d);
        gl_FragColor = vec4(vec3(a), a);
      }`;
    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;
      uniform vec3 color; uniform vec2 point; uniform float radius;
      void main () {
        vec2 p = vUv - point.xy; p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }`);
    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;
      uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
      void main () {
        #ifdef MANUAL_FILTERING
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
          vec4 result = bilerp(uSource, coord, dyeTexelSize);
        #else
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          vec4 result = texture2D(uSource, coord);
        #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }`, ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]);
    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }`);
    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }`);
    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt; velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }`);
    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uPressure; uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }`);
    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uPressure; uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }`);

    const blit = (() => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return (target, doClear = false) => {
        if (!target) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (doClear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    let dye, velocity, divergence, curl, pressure;
    const copyProgram = new Program(baseVertexShader, copyShader);
    const clearProgram = new Program(baseVertexShader, clearShader);
    const splatProgram = new Program(baseVertexShader, splatShader);
    const advectionProgram = new Program(baseVertexShader, advectionShader);
    const divergenceProgram = new Program(baseVertexShader, divergenceShader);
    const curlProgram = new Program(baseVertexShader, curlShader);
    const vorticityProgram = new Program(baseVertexShader, vorticityShader);
    const pressureProgram = new Program(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
    const displayMaterial = new Material(baseVertexShader, displayShaderSource);

    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const texelSizeX = 1 / w, texelSizeY = 1 / h;
      return {
        texture, fbo, width: w, height: h, texelSizeX, texelSizeY,
        attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; },
      };
    }
    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        get read() { return fbo1; }, set read(v) { fbo1 = v; },
        get write() { return fbo2; }, set write(v) { fbo2 = v; },
        swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
      };
    }
    function resizeFBO(target, w, h, internalFormat, format, type, param) {
      const newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }
    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w; target.height = h; target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
      return target;
    }
    function initFramebuffers() {
      const simRes = getResolution(config.SIM_RESOLUTION);
      const dyeRes = getResolution(config.DYE_RESOLUTION);
      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = dye
        ? resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering)
        : createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      velocity = velocity
        ? resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering)
        : createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }
    function updateKeywords() {
      const displayKeywords = [];
      if (config.SHADING) displayKeywords.push("SHADING");
      displayMaterial.setKeywords(displayKeywords);
    }
    function getResolution(resolution) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspectRatio);
      return gl.drawingBufferWidth > gl.drawingBufferHeight
        ? { width: max, height: min } : { width: min, height: max };
    }
    function scaleByPixelRatio(input) {
      return Math.floor(input * (window.devicePixelRatio || 1));
    }

    updateKeywords();
    initFramebuffers();

    let lastUpdateTime = Date.now();
    let colorUpdateTimer = 0.0;
    let raf = 0;
    let resizePending = true;

    function updateFrame() {
      raf = 0;
      if (!active) return;
      const dt = calcDeltaTime();
      if (resizePending) {
        resizePending = false;
        if (resizeCanvas()) initFramebuffers();
      }
      updateColors(dt);
      applyInputs();
      step(dt);
      render(null); // -> offscreen gl canvas: white liquid mask on transparent
      composite();
      raf = requestAnimationFrame(updateFrame);
    }

    function startFrameLoop() {
      if (raf) return;
      // Do not let inactive time create a large simulation delta on re-entry.
      lastUpdateTime = Date.now();
      updateFrame();
    }

    // two layers from the same white liquid mask:
    //   contrast: white liquid, difference-blended -> inverts page/text behind.
    //   reveal:   true-color card pixels masked by the liquid, drawn on top.
    // Both clipped above the orange flood waterline.
    function composite() {
      const W = window.innerWidth, H = window.innerHeight;
      const floodTop = floodEl ? floodEl.getBoundingClientRect().top : Infinity;

      // liquid-glass layer (replaces the old difference inversion). Frosted
      // translucent body + a beveled rim (bright top-left, dark bottom-right) +
      // a soft contact shadow, so the blob reads as a glass blob sitting on the
      // page. Photos still show true colour via the reveal layer on top.
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.clearRect(0, 0, contrast.width, contrast.height);
      if (floodTop > 0) {
        drawGlass(Math.min(H, floodTop) * dpr);
      }

      // reveal layer (true color over cards)
      rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rctx.clearRect(0, 0, W, H);
      for (const img of cards) {
        const r = img.getBoundingClientRect();
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
        if (r.top >= floodTop) continue;
        if (!img.complete || !img.naturalWidth) continue;
        const { sx, sy, sw, sh } = coverSrc(img, r.width, r.height);
        rctx.save();
        roundRect(rctx, r.left, r.top, r.width, r.height, 6);
        rctx.clip();
        if (floodTop < H) { rctx.beginPath(); rctx.rect(0, 0, W, floodTop); rctx.clip(); }
        rctx.drawImage(img, sx, sy, sw, sh, r.left, r.top, r.width, r.height);
        rctx.restore();
      }
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = "destination-in";
      rctx.drawImage(canvas, 0, 0);
      rctx.globalCompositeOperation = "source-over";
    }

    // Build the liquid-glass appearance from the white blob mask (`canvas`) and
    // paint it onto the visible `contrast` canvas, clipped above the flood.
    function drawGlass(clipH) {
      const w = contrast.width, h = contrast.height;
      if (glassTmp.width !== w || glassTmp.height !== h) { glassTmp.width = w; glassTmp.height = h; }
      if (rimTmp.width !== w || rimTmp.height !== h) { rimTmp.width = w; rimTmp.height = h; }
      if (glassSheenWidth !== w || glassSheenHeight !== h) {
        glassSheen = gtx.createLinearGradient(0, 0, 0, h * 0.6);
        glassSheen.addColorStop(0, "rgba(255,255,255,0.22)");
        glassSheen.addColorStop(1, "rgba(255,255,255,0)");
        glassSheenWidth = w;
        glassSheenHeight = h;
      }
      const d = Math.max(2, Math.round(4 * dpr));    // bevel width
      const d2 = Math.max(1, Math.round(1.6 * dpr)); // tight glint width

      // one beveled rim band: keep the slice of the blob NOT overlapped by an
      // offset copy, then tint it. offX/offY point AWAY from the kept edge.
      function rim(offX, offY, color) {
        xtx.setTransform(1, 0, 0, 1, 0, 0);
        xtx.globalCompositeOperation = "source-over";
        xtx.filter = "none";
        xtx.clearRect(0, 0, w, h);
        xtx.drawImage(canvas, 0, 0);
        xtx.globalCompositeOperation = "destination-out";
        xtx.drawImage(canvas, offX, offY);
        xtx.globalCompositeOperation = "source-in";
        xtx.fillStyle = color;
        xtx.fillRect(0, 0, w, h);
      }
      function stamp(alpha, blurPx) {
        gtx.globalCompositeOperation = "source-atop"; // confine to the body
        gtx.globalAlpha = alpha;
        gtx.filter = blurPx ? `blur(${blurPx}px)` : "none";
        gtx.drawImage(rimTmp, 0, 0);
        gtx.globalAlpha = 1;
        gtx.filter = "none";
        gtx.globalCompositeOperation = "source-over";
      }

      // ---- body + rims assembled on scratch (rims stay inside silhouette) ----
      gtx.setTransform(1, 0, 0, 1, 0, 0);
      gtx.globalCompositeOperation = "source-over";
      gtx.filter = "none";
      gtx.clearRect(0, 0, w, h);
      gtx.globalAlpha = 0.16;            // frosted translucent body
      gtx.drawImage(canvas, 0, 0);
      gtx.globalAlpha = 1;

      // top-down sheen (glass catches light at the top)
      gtx.globalCompositeOperation = "source-atop";
      gtx.fillStyle = glassSheen;
      gtx.fillRect(0, 0, w, h);
      gtx.globalCompositeOperation = "source-over";

      // refraction ghost: a faint magnified copy of the body offset along the
      // bevel — reads as the backdrop bending through the thick edge.
      gtx.globalCompositeOperation = "source-atop";
      gtx.globalAlpha = 0.14;
      gtx.drawImage(canvas, -d * 1.6, -d * 1.6, w + d * 3.2, h + d * 3.2);
      gtx.globalAlpha = 1;
      gtx.globalCompositeOperation = "source-over";

      rim(-d, -d, "rgba(16,12,6,1)");        // dark bevel: bottom-right
      stamp(0.55, Math.round(2 * dpr));
      rim(d, d, "rgba(255,255,255,1)");      // soft specular: top-left
      stamp(0.7, Math.round(1.5 * dpr));
      rim(d2, d2, "rgba(255,255,255,1)");    // crisp glint: top-left
      stamp(0.95, 0);

      // ---- paint to screen: contact shadow, then glass ----
      cctx.save();
      cctx.beginPath();
      cctx.rect(0, 0, w, clipH);
      cctx.clip();
      cctx.globalCompositeOperation = "source-over";
      cctx.globalAlpha = 0.2;
      cctx.filter = `blur(${Math.round(6 * dpr)}px)`;
      cctx.drawImage(canvas, 0, Math.round(4 * dpr)); // soft drop shadow below
      cctx.filter = "none";
      cctx.globalAlpha = 1;
      cctx.drawImage(glassTmp, 0, 0);
      cctx.restore();
    }

    let cards = [];
    let floodEl = null;
    function refreshCards() {
      cards = Array.from(document.querySelectorAll(".work-photo"));
      floodEl = document.querySelector(".flood--back");
    }
    function coverSrc(img, dw, dh) {
      const iw = img.naturalWidth || dw, ih = img.naturalHeight || dh;
      const scale = Math.max(dw / iw, dh / ih);
      const sw = dw / scale, sh = dh / scale;
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
    function calcDeltaTime() {
      const now = Date.now();
      let dt = (now - lastUpdateTime) / 1000;
      dt = Math.min(dt, 0.016666);
      lastUpdateTime = now;
      return dt * SLOWMO; // slo-mo
    }
    function resizeCanvas() {
      const width = Math.round(window.innerWidth * dpr);
      const height = Math.round(window.innerHeight * dpr);
      let changed = false;
      for (const c of [canvas, contrast, reveal]) {
        if (c.width !== width || c.height !== height) { c.width = width; c.height = height; changed = true; }
      }
      for (const c of [contrast, reveal]) {
        c.style.width = window.innerWidth + "px";
        c.style.height = window.innerHeight + "px";
      }
      if (changed) refreshCards();
      return changed;
    }
    function onResize() {
      resizePending = true;
      syncActive();
    }
    function updateColors(dt) {
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach((p) => { p.color = generateColor(); });
      }
    }
    function applyInputs() {
      for (const p of pointers) {
        if (p.moved) { p.moved = false; splatPointer(p); }
      }
    }
    function step(dt) {
      gl.disable(gl.BLEND);
      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write); velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write); pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write); pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write); velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      const velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write); velocity.swap();

      if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write); dye.swap();
    }
    function render(target) {
      // preserveDrawingBuffer:true means the buffer is NOT auto-cleared, so
      // clear it ourselves each frame (else the display accumulates).
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.width : gl.drawingBufferWidth, target ? target.height : gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      drawDisplay(target);
    }
    function drawDisplay(target) {
      const width = target ? target.width : gl.drawingBufferWidth;
      const height = target ? target.height : gl.drawingBufferHeight;
      displayMaterial.bind();
      if (config.SHADING) gl.uniform2f(displayMaterial.uniforms.texelSize, 1 / width, 1 / height);
      gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      blit(target, false);
    }
    function splatPointer(pointer) {
      const dx = pointer.deltaX * config.SPLAT_FORCE;
      const dy = pointer.deltaY * config.SPLAT_FORCE;
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }
    function clickSplat(pointer) {
      const color = generateColor();
      color.r *= 10; color.g *= 10; color.b *= 10;
      const dx = 10 * (Math.random() - 0.5);
      const dy = 30 * (Math.random() - 0.5);
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
    }
    function splat(x, y, dx, dy, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100));
      blit(velocity.write); velocity.swap();
      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write); dye.swap();
    }
    function correctRadius(radius) {
      const aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }
    function updatePointerDownData(pointer, id, posX, posY) {
      pointer.id = id; pointer.down = true; pointer.moved = false;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1 - posY / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0; pointer.deltaY = 0;
      pointer.color = generateColor();
    }
    function updatePointerMoveData(pointer, posX, posY, color) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1 - posY / canvas.height;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
      pointer.color = color;
    }
    function correctDeltaX(delta) {
      const aspectRatio = canvas.width / canvas.height;
      if (aspectRatio < 1) delta *= aspectRatio;
      return delta;
    }
    function correctDeltaY(delta) {
      const aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) delta /= aspectRatio;
      return delta;
    }
    function generateColor() {
      const c = HSVtoRGB(Math.random(), 1.0, 1.0);
      c.r *= 0.15; c.g *= 0.15; c.b *= 0.15;
      return c;
    }
    function HSVtoRGB(h, s, v) {
      let r, g, b;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
      }
      return { r, g, b };
    }
    function wrap(value, min, max) {
      const range = max - min;
      if (range === 0) return min;
      return ((value - min) % range) + min;
    }

    function onMouseDown(e) {
      const pointer = pointers[0];
      const posX = scaleByPixelRatio(e.clientX);
      const posY = scaleByPixelRatio(e.clientY);
      updatePointerDownData(pointer, -1, posX, posY);
      clickSplat(pointer);
    }
    function onMouseMove(e) {
      const pointer = pointers[0];
      const posX = scaleByPixelRatio(e.clientX);
      const posY = scaleByPixelRatio(e.clientY);
      updatePointerMoveData(pointer, posX, posY, pointer.color || generateColor());
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);

    // ---- gates: active only after the loader is gone + hero scrolled past ----
    let active = false, loaded = false;
    function syncActive() {
      const vh = window.innerHeight;
      const y = window.scrollY;
      // fade in just after the hero (1.0 -> 1.15vh) and fade out into the flood
      // (3.20 -> 3.45vh) so the blob never snaps on/off.
      const enter = Math.min(1, Math.max(0, (y - vh) / (vh * 0.15)));
      const exit = Math.min(1, Math.max(0, (vh * 3.45 - y) / (vh * 0.25)));
      const op = loaded ? Math.min(enter, exit) : 0;
      const next = op > 0;
      if (active || next) {
        contrast.style.opacity = reveal.style.opacity = String(op);
      }
      if (next === active) return;
      active = next;
      contrast.style.display = reveal.style.display = active ? "" : "none";
      document.documentElement.classList.toggle("blob-on", active);
      if (active) {
        startFrameLoop();
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.clearRect(0, 0, contrast.width, contrast.height);
        rctx.setTransform(1, 0, 0, 1, 0, 0);
        rctx.clearRect(0, 0, reveal.width, reveal.height);
      }
    }
    function onLoaded() { loaded = true; syncActive(); }
    window.addEventListener("jl:loaded", onLoaded, { once: true });
    const loadedFallback = window.setTimeout(onLoaded, 9500);
    window.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", onResize);
    syncActive();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("jl:loaded", onLoaded);
      window.clearTimeout(loadedFallback);
      window.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("blob-on");
      contrast.remove();
      reveal.remove();
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    };
  }, []);

  return null;
}
