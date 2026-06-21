// ARCHIVED — pearlescent iridescent rim for the fluid cursor blob.
// Removed from components/FluidCursor.js. Kept for reference only; not built.
//
// Idea: a thin pearlescent (thin-film) band riding the blob silhouette, shown
// ONLY where the backdrop under that edge has contrast (image detail). It read
// the .work-photo pixels as the "contrast" source (DOM text/page can't be
// sampled from canvas, so it only triggered over photos).
//
// Verdict: gating felt unreliable and the low-res sampling looked pixelated;
// scrapped in favour of just the contrast + reveal layers.
//
// To restore: re-add an `iris` canvas (class "blob-iris", z 10000,
// mix-blend-mode: screen) next to contrast/reveal, size it in resizeCanvas,
// toggle it in syncActive, remove it in cleanup, and call buildIris(W,H,floodTop)
// at the end of composite(). Needs offscreen buffers irisBack/irisMask/irisOut
// and the existing cards/coverSrc helpers from FluidCursor.js.

const IRIS_STRENGTH = 0.95;  // rim opacity
const IRIS_WIDTH = 5;        // rim THICKNESS in screen px (crisp, not feather)
const IRIS_LO = 0.07, IRIS_HI = 0.93; // band = where the silhouette ramp lives
const IRIS_C0 = 26, IRIS_C1 = 120;    // backdrop contrast gate (sobel low/high)
// pearlescent thin-film ramp across the rim, orange family.
const PEARL = [
  [0.0, 255, 86, 24],
  [0.22, 255, 122, 24],
  [0.55, 255, 196, 96],
  [1.0, 255, 246, 224],
];
function pearlColor(t) {
  for (let i = 0; i < PEARL.length - 1; i++) {
    const s = PEARL[i], e = PEARL[i + 1];
    if (t <= e[0]) {
      const f = (t - s[0]) / (e[0] - s[0]);
      return [s[1] + (e[1] - s[1]) * f, s[2] + (e[2] - s[2]) * f, s[3] + (e[3] - s[3]) * f];
    }
  }
  const e = PEARL[PEARL.length - 1];
  return [e[1], e[2], e[3]];
}
function buildIris(W, H, floodTop) {
  ictx.setTransform(1, 0, 0, 1, 0, 0);
  ictx.clearRect(0, 0, iris.width, iris.height);
  if (floodTop <= 0) return;

  // visible photos behind the blob (the contrast it can actually read)
  const visible = [];
  for (const img of cards) {
    const r = img.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    if (r.top >= floodTop || !img.complete || !img.naturalWidth) continue;
    visible.push([img, r]);
  }
  if (!visible.length) return;

  // higher working resolution kills the blocky look from before
  const SW = Math.min(1440, Math.max(1, Math.round(W * 0.95)));
  const sc = SW / W;
  const SH = Math.max(1, Math.round(H * sc));
  for (const c of [irisBack, irisMask, irisOut]) {
    if (c.width !== SW || c.height !== SH) { c.width = SW; c.height = SH; }
  }

  // backdrop: photos (unmasked) so we can measure real contrast under the rim
  ibctx.setTransform(1, 0, 0, 1, 0, 0);
  ibctx.clearRect(0, 0, SW, SH);
  ibctx.save();
  ibctx.beginPath();
  ibctx.rect(0, 0, SW, Math.min(H, floodTop) * sc);
  ibctx.clip();
  ibctx.filter = "blur(1px)"; // smooth photo noise -> a smoother contrast gate
  for (const [img, r] of visible) {
    const { sx, sy, sw, sh } = coverSrc(img, r.width, r.height);
    ibctx.drawImage(img, sx, sy, sw, sh, r.left * sc, r.top * sc, r.width * sc, r.height * sc);
  }
  ibctx.filter = "none";
  ibctx.restore();

  // blob alpha, blurred ONLY to turn the hard silhouette into a distance
  // ramp (sets rim width). The color/alpha below stay crisp.
  imctx.setTransform(1, 0, 0, 1, 0, 0);
  imctx.clearRect(0, 0, SW, SH);
  imctx.filter = `blur(${Math.max(0.6, IRIS_WIDTH * sc).toFixed(2)}px)`;
  imctx.drawImage(canvas, 0, 0, SW, SH);
  imctx.filter = "none";

  const bd = ibctx.getImageData(0, 0, SW, SH).data;
  const mk = imctx.getImageData(0, 0, SW, SH).data;
  const out = ioctx.createImageData(SW, SH);
  const o = out.data;
  const lum = (q) => {
    const j = q * 4;
    return bd[j + 3] ? bd[j] * 0.299 + bd[j + 1] * 0.587 + bd[j + 2] * 0.114 : 0;
  };
  const phase = performance.now() * 0.0008;
  const span = IRIS_HI - IRIS_LO;
  for (let y = 1; y < SH - 1; y++) {
    for (let x = 1; x < SW - 1; x++) {
      const p = y * SW + x;
      const a = mk[p * 4 + 3] / 255;
      if (a <= IRIS_LO || a >= IRIS_HI) continue; // only the contour band
      // gate: pearlescence ONLY where the backdrop under the rim has contrast
      const edge = Math.abs(lum(p + 1) - lum(p - 1)) + Math.abs(lum(p + SW) - lum(p - SW));
      if (edge <= IRIS_C0) continue;
      const gate = Math.min(1, (edge - IRIS_C0) / (IRIS_C1 - IRIS_C0));
      // t: 0 outer edge, 1 toward interior; small shimmer along the band
      let t = (a - IRIS_LO) / span + 0.05 * Math.sin(phase + (x + y) * 0.05);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const c = pearlColor(t);
      const aa = Math.min(1, (a - IRIS_LO) / 0.03, (IRIS_HI - a) / 0.03);
      const j = p * 4;
      o[j] = c[0];
      o[j + 1] = c[1];
      o[j + 2] = c[2];
      o[j + 3] = aa * gate * IRIS_STRENGTH * 255;
    }
  }
  ioctx.putImageData(out, 0, 0);

  // upscale to device pixels; a blur ~half the upscale factor removes the
  // blocky stairstep without washing the band out. Above the flood only.
  ictx.imageSmoothingEnabled = true;
  const scaleUp = iris.width / SW;
  ictx.save();
  if (floodTop < H) {
    ictx.beginPath();
    ictx.rect(0, 0, iris.width, Math.min(H, floodTop) * dpr);
    ictx.clip();
  }
  ictx.filter = `blur(${Math.max(0.6, scaleUp * 0.6).toFixed(2)}px)`;
  ictx.drawImage(irisOut, 0, 0, SW, SH, 0, 0, iris.width, iris.height);
  ictx.filter = "none";
  ictx.restore();
}
