// BC TCG hero: one locked-camera shot, driven entirely by frame number so every frame is reproducible.
// The Node renderer calls window.renderFrame(n) and stores the returned WebP data URL.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FPS, FORMATS } from "./config.mjs";

const FORMAT = FORMATS[new URLSearchParams(location.search).get("format") ?? "desktop"];
const { width: W, height: H } = FORMAT;

const GOLD = new THREE.Color("#FFB800");

// ---------- timing helpers ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (f, a, b) => clamp01((f - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const inCubic = (x) => x * x * x;
const lerp = (a, b, t) => a + (b - a) * t;
const pulse = (f, at, width) => Math.exp(-((f - at) ** 2) / (2 * width * width));

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(FORMAT.fov, W / H, 0.1, 60);
camera.position.set(0, 0, 10);

scene.add(new THREE.AmbientLight(0xffffff, 0.05));
const key = new THREE.DirectionalLight(0xffe2a8, 0.35);
key.position.set(-3, 4, 6);
scene.add(key);
for (const x of [-6, 6]) {
  const rim = new THREE.DirectionalLight(0xffc23a, 2.2);
  rim.position.set(x, 2, -5);
  scene.add(rim);
}

// Everything that belongs to the subject lives in the stage, so desktop and mobile only move the anchor.
const stage = new THREE.Group();
stage.position.fromArray(FORMAT.anchor);
scene.add(stage);

// ---------- canvas textures ----------
function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const roundedMask = (aspect, radius) =>
  canvasTexture(512, Math.round(512 / aspect), (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(1, 1, w - 2, h - 2, radius * w);
    g.fill();
  }, false);

// Soft gold halo that peeks out around an object's outline; the object's faces hide its middle.
const glowTexture = (aspect, pad) =>
  canvasTexture(512, Math.round(512 / aspect), (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const inset = (pad / (1 + pad)) * w * 0.5;
    g.filter = `blur(${inset * 0.45}px)`;
    g.strokeStyle = "#fff";
    g.lineWidth = inset * 0.7;
    g.beginPath();
    g.roundRect(inset, inset, w - inset * 2, h - inset * 2, w * 0.06);
    g.stroke();
  }, false);

const flareTexture = canvasTexture(256, 256, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, "rgba(255,248,220,1)");
  r.addColorStop(0.15, "rgba(255,210,90,0.85)");
  r.addColorStop(0.45, "rgba(255,170,20,0.25)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
});

function glowPlane(w, h, pad = 0.18) {
  const mat = new THREE.MeshBasicMaterial({
    color: GOLD.clone().multiplyScalar(0.42),
    alphaMap: glowTexture(w / h, pad),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * (1 + pad), h * (1 + pad * (w / h))), mat);
  m.renderOrder = -1;
  return m;
}

function faceMaterial(map, alphaMap, glow = 0.85) {
  return new THREE.MeshStandardMaterial({
    map,
    color: 0x3a3a3a,
    emissiveMap: map,
    emissive: 0xffffff,
    emissiveIntensity: glow,
    roughness: 0.42,
    metalness: 0.05,
    envMapIntensity: 0.15,
    alphaMap,
    alphaTest: alphaMap ? 0.5 : 0,
    transparent: false,
  });
}

// ---------- load textures ----------
const loader = new THREE.TextureLoader();
const load = (p) =>
  new Promise((res, rej) =>
    loader.load(p, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      res(t);
    }, undefined, rej),
  );

const [packTex, cardBackTex, slabFrontTex] = await Promise.all(
  ["pack-front.png", "card-back.png", "slab-front.png"].map((f) => load(`/assets/hero/${f}`)),
);
// Trim the faint dark sliver the perspective crop leaves on the card edges.
cardBackTex.repeat.set(0.985, 0.985);
cardBackTex.offset.set(0.0075, 0.0075);

// ---------- pack ----------
const PACK_W = 1.9, PACK_H = 3.56, STRIP = 0.12;
const BODY_TOP = PACK_H / 2 - PACK_H * STRIP;

function pillow(w, h, segX, segY, vFrom, vTo, depth) {
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2), ny = uv.getY(i);
    const globalV = lerp(vFrom, vTo, ny);
    const gy = (globalV - 0.5) * 2;
    pos.setZ(i, depth * (1 - nx * nx) * (1 - Math.pow(Math.abs(gy), 6)));
    uv.setY(i, globalV);
  }
  geo.computeVertexNormals();
  return geo;
}

const pack = new THREE.Group();
stage.add(pack);
const packFrontMat = faceMaterial(packTex, null, 0.82);
packFrontMat.metalness = 0.25;
packFrontMat.roughness = 0.3;
const packBackMat = new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.8, roughness: 0.35, side: THREE.BackSide });

const bodyGeo = pillow(PACK_W, PACK_H * (1 - STRIP), 32, 40, 0, 1 - STRIP, 0.1);
const body = new THREE.Group();
body.position.y = -(PACK_H * STRIP) / 2;
body.add(new THREE.Mesh(bodyGeo, packFrontMat), new THREE.Mesh(bodyGeo, packBackMat));
pack.add(body);

// The top crimp hinges on its right end so the tear runs left to right.
const stripPivot = new THREE.Group();
stripPivot.position.set(PACK_W / 2, BODY_TOP, 0);
const stripGeo = pillow(PACK_W, PACK_H * STRIP, 32, 6, 1 - STRIP, 1, 0.1);
const stripFrontMat = packFrontMat.clone();
stripFrontMat.transparent = true;
const stripMesh = new THREE.Group();
stripMesh.position.set(-PACK_W / 2, (PACK_H * STRIP) / 2, 0);
stripMesh.add(new THREE.Mesh(stripGeo, stripFrontMat), new THREE.Mesh(stripGeo, packBackMat));
stripPivot.add(stripMesh);
pack.add(stripPivot);

const packGlow = glowPlane(PACK_W, PACK_H, 0.14);
pack.add(packGlow);

// ---------- card (only its back is ever shown) ----------
const CARD_W = 1.65, CARD_H = 2.3;
const card = new THREE.Group();
stage.add(card);
const cardMask = roundedMask(CARD_W / CARD_H, 0.05);
const cardFront = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), faceMaterial(cardBackTex, cardMask, 0.88));
cardFront.position.z = 0.006;
const cardRear = new THREE.Mesh(
  new THREE.PlaneGeometry(CARD_W, CARD_H),
  new THREE.MeshStandardMaterial({ color: 0x1d2a55, roughness: 0.5, alphaMap: cardMask, alphaTest: 0.5 }),
);
cardRear.rotation.y = Math.PI;
cardRear.position.z = -0.006;
const cardGlow = glowPlane(CARD_W, CARD_H, 0.16);
card.add(cardFront, cardRear, cardGlow);

// Afterimages behind the card as it is sent into the void.
const ghosts = Array.from({ length: 7 }, () => {
  const g = glowPlane(CARD_W, CARD_H, 0.05);
  g.material = g.material.clone();
  g.material.alphaMap = cardMask;
  stage.add(g);
  return g;
});

// ---------- slab ----------
const SLAB_W = 1.44, SLAB_H = 2.37, SLAB_D = 0.12;
const slab = new THREE.Group();
stage.add(slab);
const slabMask = roundedMask(SLAB_W / SLAB_H, 0.035);

const slabBackTex = canvasTexture(812, 1335, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#2a2a30");
  bg.addColorStop(1, "#0d0d10");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(255,214,120,0.55)";
  g.lineWidth = 10;
  g.strokeRect(22, 22, w - 44, h - 44);
  g.strokeStyle = "rgba(255,255,255,0.15)";
  g.lineWidth = 4;
  g.strokeRect(46, 300, w - 92, h - 346);
  // Back label: mirrored layout of the front one.
  g.fillStyle = "#1a1530";
  g.fillRect(62, 54, 688, 204);
  g.strokeStyle = "#c0262f";
  g.lineWidth = 8;
  g.strokeRect(66, 58, 680, 196);
  g.fillStyle = "#d9b45a";
  g.font = "bold 92px Arial";
  g.fillText("PSA", 110, 175);
  g.fillStyle = "#e8e8ee";
  for (let i = 0; i < 46; i++) g.fillRect(110 + i * 7, 200, i % 3 === 0 ? 4 : 2, 34);
  g.fillStyle = "#9aa4c8";
  g.fillRect(560, 92, 150, 132);
  g.fillStyle = "#1a1530";
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x * 7 + y * 3) % 4 < 2) g.fillRect(572 + x * 21, 104 + y * 18, 18, 15);
});

// The card back seen through the rear window of the slab.
const slabBackCard = cardBackTex.image;
const slabBackCtx = slabBackTex.image.getContext("2d");
slabBackCtx.globalAlpha = 0.92;
slabBackCtx.drawImage(slabBackCard, 88, 366, 636, 862);
slabBackTex.needsUpdate = true;

const slabFront = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W, SLAB_H), faceMaterial(slabFrontTex, slabMask, 0.8));
slabFront.position.z = SLAB_D / 2;
const slabBack = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W, SLAB_H), faceMaterial(slabBackTex, slabMask, 0.7));
slabBack.rotation.y = Math.PI;
slabBack.position.z = -SLAB_D / 2;

const edgeShape = new THREE.Shape();
edgeShape.roundRect?.(-SLAB_W / 2, -SLAB_H / 2, SLAB_W, SLAB_H, 0.05);
if (!edgeShape.curves.length) {
  const r = 0.05, x = -SLAB_W / 2, y = -SLAB_H / 2;
  edgeShape.moveTo(x + r, y);
  edgeShape.lineTo(x + SLAB_W - r, y);
  edgeShape.quadraticCurveTo(x + SLAB_W, y, x + SLAB_W, y + r);
  edgeShape.lineTo(x + SLAB_W, y + SLAB_H - r);
  edgeShape.quadraticCurveTo(x + SLAB_W, y + SLAB_H, x + SLAB_W - r, y + SLAB_H);
  edgeShape.lineTo(x + r, y + SLAB_H);
  edgeShape.quadraticCurveTo(x, y + SLAB_H, x, y + SLAB_H - r);
  edgeShape.lineTo(x, y + r);
  edgeShape.quadraticCurveTo(x, y, x + r, y);
}
const edgeGeo = new THREE.ExtrudeGeometry(edgeShape, { depth: SLAB_D * 0.98, bevelEnabled: false, curveSegments: 8 });
edgeGeo.translate(0, 0, -SLAB_D * 0.49);
const edgeMat = new THREE.MeshPhysicalMaterial({
  color: 0xd8c8a0,
  metalness: 0.1,
  roughness: 0.08,
  clearcoat: 1,
  envMapIntensity: 1.6,
  emissive: 0x6a4a10,
  emissiveIntensity: 0.6,
});
// Group 0 is the caps (hidden behind the faces), group 1 the sides.
const slabEdge = new THREE.Mesh(edgeGeo, [new THREE.MeshBasicMaterial({ color: 0x000000 }), edgeMat]);
slabEdge.scale.set(0.995, 0.995, 1);

const holoMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uProg: { value: -1 }, uShimmer: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uProg, uShimmer, uTime;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      float diag = (vUv.x + (1.0 - vUv.y)) * 0.5;
      float d = diag - (uProg * 1.5 - 0.25);
      float band = exp(-d * d / 0.0045);
      float glint = exp(-d * d / 0.0004);
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vUv.x * 1.6 + vUv.y * 0.8 + vec3(0.0, 0.33, 0.67)));
      vec3 gold = vec3(1.0, 0.78, 0.3);
      float inCard = step(0.11, vUv.x) * step(vUv.x, 0.89) * step(0.08, vUv.y) * step(vUv.y, 0.725);
      float sparkle = step(0.985, hash(floor(vUv * vec2(90.0, 150.0)) + floor(uTime * 8.0))) * inCard;
      vec3 col = mix(gold, rainbow, 0.55) * band * (0.25 + 0.75 * inCard) * 0.3;
      col += vec3(1.0, 0.95, 0.85) * glint * 0.1;
      col += (mix(gold, rainbow, 0.5) * 0.05 * inCard + sparkle * 0.2) * uShimmer;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const holo = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W, SLAB_H), holoMat);
holo.position.z = SLAB_D / 2 + 0.002;

const slabGlow = glowPlane(SLAB_W, SLAB_H, 0.16);
slab.add(slabFront, slabBack, slabEdge, holo, slabGlow);

// ---------- void ----------
const VOID_Z = -1.5;
const voidMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uCore: { value: 0 }, uRadius: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uTime, uAmount, uCore, uRadius;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
    void main(){
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p) / max(uRadius, 0.001);
      float a = atan(p.y, p.x);
      float twist = a + 2.4 * log(r + 0.04) - uTime * 0.55;
      vec2 q = vec2(cos(twist), sin(twist)) * (0.6 + r);
      float n = fbm(q * 2.6 + vec2(0.0, uTime * 0.03));
      float streaks = fbm(q * 4.5 + vec2(r * 3.0 - uTime * 0.4));
      float ring = smoothstep(1.0, 0.45, r) * smoothstep(0.08, 0.32, r);
      float arms = smoothstep(0.55, 0.95, n * 0.6 + streaks * 0.6) * ring;
      float dust = step(0.993, hash(floor(q * 140.0))) * ring;
      vec3 gold = vec3(1.0, 0.7, 0.16);
      vec3 smoke = vec3(0.28, 0.29, 0.42);
      vec3 col = smoke * fbm(q * 1.7 - uTime * 0.05) * ring * 0.45;
      col += gold * arms * 1.15 + gold * dust * 1.4;
      col += vec3(1.0, 0.82, 0.45) * pow(max(0.0, 1.0 - r / 0.3), 2.5) * uCore * 1.2;
      gl_FragColor = vec4(col * uAmount * 0.45, 1.0);
    }`,
});
const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), voidMat);
voidMesh.position.z = VOID_Z;
voidMesh.renderOrder = -2;
stage.add(voidMesh);

const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
stage.add(flare);

// ---------- particles ----------
const seeded = (() => {
  let s = 20261103;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
})();

function pointsMaterial(vertexBody) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: H / 1080 },
      uSpiral: { value: 0 },
      uDensity: { value: 0.5 },
      uAge: { value: -1 },
      uOrigin: { value: new THREE.Vector3() },
      uAxis: { value: new THREE.Vector3(1, 0, 0) },
      uCenter: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime, uPixel, uSpiral, uDensity, uAge;
      uniform vec3 uOrigin, uAxis, uCenter;
      varying float vAlpha;
      void main(){
        vec3 pos; float size; float alpha;
        ${vertexBody}
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * uPixel * 300.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.76, 0.25) * a * vAlpha, 1.0);
      }`,
  });
}

function makePoints(count, material) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = seeded();
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}

const dust = makePoints(1800, pointsMaterial(/* glsl */ `
  vec3 box = vec3(16.0, 10.0, 7.0);
  vec3 drift = (aSeed - 0.5) * box + vec3(0.06, 0.14, 0.0) * uTime * (0.4 + aSeed.z);
  drift = mod(drift + box * 0.5, box) - box * 0.5;
  drift.z -= 1.5;
  drift += vec3(sin(uTime * 0.7 + aSeed.x * 40.0), cos(uTime * 0.5 + aSeed.y * 40.0), 0.0) * 0.06;
  float phase = fract(aSeed.y + uTime * 0.11 * (0.6 + aSeed.z));
  float r = (0.35 + aSeed.x * 2.6) * (1.0 - phase);
  float ang = aSeed.z * 6.2831 + phase * 7.0 + uTime * 0.2;
  vec3 spiral = uCenter + vec3(cos(ang) * r, sin(ang) * r * 0.92, -0.2 + phase * 0.3);
  float joins = step(aSeed.x, 0.75);
  pos = mix(drift, spiral, uSpiral * joins);
  size = 0.012 + 0.03 * aSeed.z * aSeed.z;
  float spiralFade = mix(1.0, smoothstep(0.0, 0.25, phase) * smoothstep(1.0, 0.8, phase), uSpiral * joins);
  alpha = step(aSeed.y, uDensity) * (0.35 + 0.65 * aSeed.x) * spiralFade;
`));

const sparks = makePoints(260, pointsMaterial(/* glsl */ `
  vec3 dir = normalize(aSeed - 0.5 + vec3(0.0, 0.55, 0.25));
  float t = max(uAge, 0.0) * (0.6 + aSeed.x * 0.8);
  pos = uOrigin + uAxis * (aSeed.z - 0.5) * 1.8 + dir * t * (1.4 + aSeed.y * 1.6) + vec3(0.0, -1.1, 0.0) * t * t;
  size = 0.015 + 0.03 * aSeed.y;
  alpha = step(0.0, uAge) * clamp(1.0 - t / 0.9, 0.0, 1.0) * 1.6;
`));

const burst = makePoints(320, pointsMaterial(/* glsl */ `
  vec3 dir = normalize(aSeed - 0.5);
  float t = max(uAge, 0.0) * (0.5 + aSeed.x);
  pos = uOrigin + dir * t * (2.2 + aSeed.y * 2.0);
  size = 0.012 + 0.03 * aSeed.z;
  alpha = step(0.0, uAge) * clamp(1.0 - t / 0.8, 0.0, 1.0) * 1.4;
`));

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.3, 0.95));
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSeed; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // Multiplicative grain keeps pure black pure black.
      c.rgb *= 1.0 + (hash(vUv * uRes + uSeed) - 0.5) * 0.09;
      vec2 v = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      c.rgb *= mix(0.62, 1.0, smoothstep(1.15, 0.35, length(v)));
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

// ---------- timeline ----------
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const euler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

function packState(f) {
  const t = f / FPS;
  const turn = inOut(seg(f, 1, 10));
  const away = inOut(seg(f, 34, 46));
  return {
    pos: new THREE.Vector3(0.75 * away, Math.sin(t * 1.6) * 0.035 - 0.7 - 2.9 * away, -0.6 * away),
    quat: euler(0.03 * Math.sin(t * 1.1), lerp(-0.26, -0.08, turn) + 0.25 * away, lerp(0.14, 0.1, turn) - 0.35 * away),
    opacity: 1 - seg(f, 36, 45),
  };
}

const CARD_HOVER = new THREE.Vector3(0, 0, 2.2);

function cardState(f) {
  const t = f / FPS;
  const p = packState(f);
  // Inside the pack: slide up and out.
  const slide = lerp(0.05, 1.35, inOut(seg(f, 19, 30))) + (1.85 - 1.35) * inOut(seg(f, 31, 37));
  const inPack = p.pos.clone().add(tmpV.set(0, slide, 0).applyQuaternion(p.quat));
  const toCenter = inOut(seg(f, 34, 43));
  const bob = Math.sin(t * 1.7) * 0.04 * seg(f, 40, 46);
  const hover = CARD_HOVER.clone().add(new THREE.Vector3(0, bob, 0));
  const pos = inPack.lerp(hover, toCenter);
  const quat = p.quat.clone().slerp(euler(0.02 * Math.sin(t * 1.3), 0.03 * Math.sin(t * 0.9), 0), toCenter);
  // Tip back, then post it into the void.
  const tilt = inOut(seg(f, 53, 60));
  quat.multiply(euler(-1.32 * tilt, 0, 0));
  const shot = inCubic(seg(f, 61, 69));
  pos.lerp(new THREE.Vector3(0, 0.05, VOID_Z + 0.1), shot);
  const scale = lerp(1, 0.25, shot);
  return { pos, quat, scale, visible: f < 69 };
}

function slabState(f) {
  const t = f / FPS;
  const emerge = inOut(seg(f, 111, 140));
  const z = lerp(VOID_Z + 0.05, 2.0, emerge);
  const scale = lerp(0.12, 1, smooth(seg(f, 111, 136)));
  const bobAmp = lerp(0.04, 0.015, seg(f, 186, 195));
  const lift = lerp(0, 0.28, inOut(seg(f, 151, 190)));
  const spin = inOut(seg(f, 151, 175));
  const quat = euler(
    0.03 * Math.sin(t * 1.2) * (1 - seg(f, 186, 195) * 0.6),
    Math.PI + Math.PI * spin + 0.05 * Math.sin(t * 0.8) * (1 - spin),
    lerp(0.06, 0.052, spin),
  );
  return { pos: new THREE.Vector3(0, Math.sin(t * 1.5) * bobAmp + lift, z), quat, scale, visible: f >= 111 };
}

function applyFrame(f) {
  const t = f / FPS;
  camera.position.z = lerp(10, 9.6, smooth((f - 1) / 199));

  // Pack and torn crimp.
  const ps = packState(f);
  pack.position.copy(ps.pos);
  pack.quaternion.copy(ps.quat);
  pack.visible = ps.opacity > 0.001;
  packFrontMat.transparent = ps.opacity < 1;
  packFrontMat.opacity = ps.opacity;
  packBackMat.transparent = ps.opacity < 1;
  packBackMat.opacity = ps.opacity;
  const tear = inOut(seg(f, 11, 18));
  const flyOff = inOut(seg(f, 16, 26));
  stripPivot.rotation.z = -1.0 * tear - 0.6 * flyOff;
  stripPivot.position.set(PACK_W / 2 + 0.9 * flyOff, BODY_TOP + 1.4 * flyOff, 0.4 * flyOff);
  stripFrontMat.opacity = 1 - seg(f, 19, 26);
  stripPivot.visible = f < 26;
  packGlow.material.opacity = lerp(0.55, 1, smooth(seg(f, 1, 10))) * ps.opacity;

  // Card plus afterimages.
  const cs = cardState(f);
  card.visible = cs.visible;
  card.position.copy(cs.pos);
  card.quaternion.copy(cs.quat);
  card.scale.setScalar(cs.scale);
  cardGlow.material.opacity = smooth(seg(f, 22, 34)) * (1 + seg(f, 58, 66));
  ghosts.forEach((g, i) => {
    const gf = f - (i + 1) * 0.55;
    const on = f > 61 && f < 71 && gf > 60;
    g.visible = on;
    if (!on) return;
    const gs = cardState(gf);
    g.position.copy(gs.pos);
    g.quaternion.copy(gs.quat);
    g.scale.setScalar(gs.scale);
    g.material.opacity = 0.5 * (1 - i / ghosts.length) * (1 - seg(f, 68, 71));
  });

  // Void.
  const form = smooth(seg(f, 43, 52));
  const recede = seg(f, 119, 165);
  voidMat.uniforms.uTime.value = t;
  voidMat.uniforms.uAmount.value = form * lerp(1, 0, smooth(recede)) + 0.12 * form * (1 - seg(f, 150, 168));
  voidMat.uniforms.uRadius.value = lerp(0.35, 1, form) * lerp(1, 0.7, recede);
  voidMat.uniforms.uCore.value =
    0.2 * form + 0.5 * pulse(f, 85, 2.5) + 0.8 * pulse(f, 95, 2.5) + 1.2 * pulse(f, 105, 2.5) + 0.9 * smooth(seg(f, 100, 111)) * (1 - seg(f, 116, 126)) + 0.8 * pulse(f, 68, 1.5);

  // Flash when the card lands, and the flare that releases the slab.
  const flash = 0.9 * pulse(f, 69, 1.4) + 2.2 * pulse(f, 113, 2.2);
  flare.position.set(0, 0.05, VOID_Z + 0.2);
  flare.scale.setScalar(0.6 + 2.6 * flash);
  flare.material.opacity = Math.min(1, flash);
  flare.visible = flash > 0.01;

  // Slab.
  const ss = slabState(f);
  slab.visible = ss.visible;
  slab.position.copy(ss.pos);
  slab.quaternion.copy(ss.quat);
  slab.scale.setScalar(ss.scale);
  slabGlow.material.opacity = smooth(seg(f, 114, 126)) * lerp(1, 0.75, seg(f, 186, 200));
  holoMat.uniforms.uProg.value = seg(f, 172, 185);
  holoMat.uniforms.uShimmer.value = smooth(seg(f, 183, 192));
  holoMat.uniforms.uTime.value = t;
  holo.visible = f >= 170;

  // Particles.
  const center = stage.position.clone().add(new THREE.Vector3(0, 0.05, VOID_Z));
  const dm = dust.material.uniforms;
  dm.uTime.value = t * lerp(1, 0.55, seg(f, 186, 200));
  dm.uCenter.value.copy(center);
  dm.uSpiral.value = smooth(seg(f, 56, 82)) * (1 - 0.75 * smooth(seg(f, 124, 150)));
  dm.uDensity.value = 0.5 + 0.5 * smooth(seg(f, 68, 90)) - 0.35 * smooth(seg(f, 145, 175));

  stage.updateMatrixWorld(true);
  const sm = sparks.material.uniforms;
  sm.uAge.value = f >= 11 ? (f - 11) / FPS : -1;
  sm.uOrigin.value.copy(pack.localToWorld(new THREE.Vector3(0, BODY_TOP, 0.06)));
  sm.uAxis.value.set(1, 0, 0).applyQuaternion(tmpQ.copy(stage.quaternion).multiply(pack.quaternion));
  sparks.visible = f >= 11 && f <= 34;

  const bm = burst.material.uniforms;
  bm.uAge.value = f >= 111 ? (f - 111) / FPS : -1;
  bm.uOrigin.value.copy(center).add(tmpV.set(0, 0, 0.2));
  burst.visible = f >= 111 && f <= 140;

  grade.uniforms.uSeed.value = f * 17.13;
}

window.renderFrame = (f) => {
  stage.updateMatrixWorld(true);
  applyFrame(f);
  scene.updateMatrixWorld(true);
  // Particle uniforms read world transforms, so settle them after the first pass.
  applyFrame(f);
  composer.render();
  return renderer.domElement.toDataURL("image/webp", 0.8);
};
window.heroReady = true;
