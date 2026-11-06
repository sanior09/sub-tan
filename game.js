/* ผีตาลหลอน — endless runner (Three.js r149)
 * Main view : behind the runner (Subway style)
 * PiP view  : front camera, shows runner's face + Ghost Tan chasing behind
 */
(() => {
'use strict';

// ============================================================ constants
const LANE_W = 2.4;
const GHOST_START_GAP = 5.4;
const GHOST_MAX_GAP = 7.6;
const CATCH_GAP = 1.6;
const SPAWN_Z = -100;
const JUMP_V = 10, GRAVITY = 30;

// ============================================================ renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setScissorTest(true);

const scene = new THREE.Scene();
const FOG_COLOR = 0x070914;
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, 22, 90);

const mainCam = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
const pipCam = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 200);

scene.add(new THREE.HemisphereLight(0x7080c0, 0x20121a, 0.95));
const moon = new THREE.DirectionalLight(0xa0b4ff, 0.55);
moon.position.set(-6, 14, 8);
scene.add(moon);
const lantern = new THREE.PointLight(0xffa860, 1.3, 15);   // light the runner carries
scene.add(lantern);
const ghostLight = new THREE.PointLight(0xff2a4a, 0, 16);   // eerie red glow around the ghost
scene.add(ghostLight);

// ============================================================ shared geometry / materials
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 8),
  pyr: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  sph: new THREE.SphereGeometry(1, 14, 10),
  garland: new THREE.TorusGeometry(0.3, 0.1, 8, 18),
  garlandPlane: new THREE.PlaneGeometry(0.95, 0.95),
};
const garlandTex = (() => {
  const t = new THREE.Texture();
  if (window.GARLAND_PNG) {
    const im = new Image();
    im.onload = () => { t.image = im; t.needsUpdate = true; };
    im.src = window.GARLAND_PNG;
    const icon = document.getElementById('garlandIcon');
    if (icon) icon.src = window.GARLAND_PNG;
  }
  return t;
})();
const MAT = {
  wood: new THREE.MeshLambertMaterial({ color: 0x4a3326 }),
  darkwood: new THREE.MeshLambertMaterial({ color: 0x2a1c14 }),
  red: new THREE.MeshLambertMaterial({ color: 0xb02222 }),
  gold: new THREE.MeshLambertMaterial({ color: 0xffc43a, emissive: 0x6a4300 }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x0f2c1e }),
  stone: new THREE.MeshLambertMaterial({ color: 0x3a3d4a }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xff4a2a }),
  garland: new THREE.MeshBasicMaterial({ color: 0xffb81f }),
  garlandB: new THREE.MeshBasicMaterial({ color: 0xff6a1a }),
  garlandPic: new THREE.MeshBasicMaterial({
    map: garlandTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, fog: false }),
};

function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2f2f2' : '#c42020'; x.fillRect(i * 16, 0, 16, 32); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
MAT.stripe = new THREE.MeshLambertMaterial({ map: stripeTexture() });

function mk(geo, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0);
  return m;
}

// ============================================================ player + ghost (see character.js)
const C = window.TanChars;
const player = C.makeRunner();        // generic cartoon robot (NOT Tan) — only the ghost wears Tan's face
const playerRoot = new THREE.Group();
player.group.scale.setScalar(0.92);
player.group.rotation.order = 'YXZ';     // Y (turn) first, then X (pitch/bow forward in character's facing direction!)
playerRoot.add(player.group);
player.group.rotation.y = Math.PI;       // runs toward -Z, back to the main camera
scene.add(playerRoot);

const ghost = C.makeGhost();             // male humanoid model + Tan's face
const ghostRoot = new THREE.Group();
ghost.group.scale.setScalar(0.98);
ghostRoot.add(ghost.group);
ghost.group.rotation.y = Math.PI;        // faces the runner (-Z)
ghost.group.rotation.x = -0.14;          // lunging forward
// aura + trailing mist so it is visible in the dark
(function () {
  const mkGlow = (inner, mid, w, h, y, add) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, inner); g.addColorStop(.5, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false, fog: false, transparent: true }));
    s.scale.set(w, h, 1); s.position.set(0, y, 0);
    return s;
  };
  ghostRoot.add(mkGlow('rgba(170,200,255,.55)', 'rgba(110,140,255,.18)', 6, 7, 1.7, true));
  const mist = mkGlow('rgba(150,170,220,.38)', 'rgba(90,110,170,.14)', 4.5, 2.2, 0.15, false);
  mist.position.z = 0.8; ghostRoot.add(mist);       // trails behind (+Z = behind it)
})();
ghostRoot.scale.setScalar(1.3);
scene.add(ghostRoot);

// ============================================================ ground
const groundTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1a22'; x.fillRect(0, 0, 256, 256);
  // planks
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#201e28' : '#17161e'; x.fillRect(0, i * 32, 256, 30);
  }
  // lane dividers (3 lanes over 256px)
  x.fillStyle = 'rgba(200,190,255,.22)';
  x.fillRect(256 / 3 - 2, 0, 4, 256); x.fillRect(512 / 3 - 2, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const GROUND_LEN = 190, CELL = 8;
groundTex.repeat.set(1, GROUND_LEN / CELL);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3, GROUND_LEN),
  new THREE.MeshLambertMaterial({ map: groundTex }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -GROUND_LEN / 2 + 12);
scene.add(ground);
[-1, 1].forEach((s) => {
  const side = new THREE.Mesh(new THREE.PlaneGeometry(40, GROUND_LEN),
    new THREE.MeshLambertMaterial({ color: 0x0b1410 }));
  side.rotation.x = -Math.PI / 2; side.position.set(s * (LANE_W * 1.5 + 20), -0.02, -GROUND_LEN / 2 + 12);
  scene.add(side);
});

// ============================================================ scenery
const SCENERY_MAT = (function () {
  const src = window.SCENERY_PNG || {};
  function loadPair(b64, colFront, emFront, colBack, emBack) {
    const tex = new THREE.Texture();
    if (b64) {
      const img = new Image();
      img.onload = () => { tex.image = img; tex.needsUpdate = true; };
      img.src = b64.indexOf('data:') === 0 ? b64 : 'data:image/png;base64,' + b64;
    }
    const front = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex, color: colFront, emissive: emFront,
      transparent: true, alphaTest: 0.14, side: THREE.DoubleSide
    });
    const back = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex, color: colBack, emissive: emBack,
      transparent: true, alphaTest: 0.18, side: THREE.DoubleSide
    });
    return { front, back };
  }
  // Soft radial ground shadow texture
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx = sc.getContext('2d');
  const sg = sx.createRadialGradient(64, 64, 6, 64, 64, 62);
  sg.addColorStop(0, 'rgba(0,0,0,0.78)');
  sg.addColorStop(0.55, 'rgba(0,0,0,0.38)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false
  });
  // Warm candle glow halo texture for spirit houses
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gx = gc.getContext('2d');
  const gg = gx.createRadialGradient(64, 64, 3, 64, 64, 62);
  gg.addColorStop(0, 'rgba(255,195,95,0.65)');
  gg.addColorStop(0.4, 'rgba(255,120,40,0.22)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const candleHaloMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false
  });

  return {
    shadowMat,
    candleHaloMat,
    shrines: [
      loadPair(src.shrine1, 0xe8ddd2, 0x726458, 0x605246, 0x261e18), // ศาลพระภูมิไม้สักสีเข้ม
      loadPair(src.shrine2, 0xded4c8, 0x5e5244, 0x584432, 0x241a10), // ศาลพระภูมิสีทองแดงทรงสูง
      loadPair(src.shrine3, 0xded4c8, 0x5e5244, 0x584432, 0x241a10)  // ศาลตายายสีทองแดง
    ],
    trees: [
      loadPair(src.tree1, 0xb8ccb8, 0x465646, 0x506450, 0x1e281e),   // ต้นไม้ใบเขียวพุ่มใหญ่
      loadPair(src.tree2, 0xb8ccb8, 0x485846, 0x506450, 0x1e281e)    // ต้นมะม่วงมีลูกมะม่วงห้อย
    ]
  };
})();
let treeSeq = 0;
let shrineSeq = 0;
let decorSeq = 0;

function makeCurvedPlane(w, h, curveZ) {
  const geo = new THREE.PlaneGeometry(w, h, 9, 6);
  const pos = geo.attributes.position;
  const halfW = w * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const nx = x / halfW;
    // Gentle 3D cylindrical dome curve across X and upper canopy Y
    const dome = (1 - nx * nx) * curveZ;
    pos.setZ(i, dome);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeLanternPost() {
  const g = new THREE.Group();
  g.add(mk(GEO.cyl, MAT.darkwood, 0.08, 3.6, 0.08, 0, 1.8, 0));
  g.add(mk(GEO.sph, MAT.lamp, 0.34, 0.42, 0.34, 0, 3.7, 0));
  g.add(mk(GEO.cyl, MAT.darkwood, 0.2, 0.08, 0.2, 0, 4.08, 0));
  return g;
}
function makeTree(side) {
  const g = new THREE.Group();
  const idx = (treeSeq++) % SCENERY_MAT.trees.length;
  const pair = SCENERY_MAT.trees[idx];
  const scale = 0.94 + Math.random() * 0.22;
  const w = (idx === 1 ? 4.6 : 4.5) * scale;
  const h = (idx === 1 ? 5.2 : 5.3) * scale;

  // 1. Soft dark ground contact shadow + 3D grassy earth mound at the base
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, w * 0.85), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015;
  g.add(sh);
  g.add(mk(GEO.cyl, MAT.leaf, 0.65 * scale, 0.12, 0.65 * scale, 0, 0.05, 0));
  // 2. Solid 3D cylindrical tree trunk at the base so there is NEVER a flat or double trunk
  g.add(mk(GEO.cyl, MAT.darkwood, 0.17 * scale, 1.45 * scale, 0.22 * scale, 0, 0.72 * scale, -0.05));

  // 3. Curved 3D front canopy + darker volumetric back canopy layer (aligned on a single trunk!)
  const body = new THREE.Group();
  body.rotation.y = (side || 1) * -0.16;
  const frontGeo = makeCurvedPlane(w, h, 0.38);
  const pFront = new THREE.Mesh(frontGeo, pair.front);
  pFront.position.set(0, h * 0.48, 0.06);
  body.add(pFront);

  const backGeo = makeCurvedPlane(w * 0.96, h * 0.96, -0.28);
  const pBack = new THREE.Mesh(backGeo, pair.back);
  pBack.position.set((side || 1) * 0.08, h * 0.49, -0.24);
  body.add(pBack);

  g.add(body);
  return g;
}
function makeSpiritHouse(side) {     // ศาลพระภูมิข้างทาง (3D Volumetric + ฐานปูน + แสงเทียนยามค่ำคืน)
  const g = new THREE.Group();
  const idx = (shrineSeq++) % SCENERY_MAT.shrines.length;
  const pair = SCENERY_MAT.shrines[idx];
  const w = idx === 0 ? 2.45 : idx === 1 ? 2.15 : 2.45;
  const h = idx === 0 ? 3.75 : idx === 1 ? 3.85 : 3.45;

  // 1. Ground contact shadow + 3D stepped concrete plinth (ฐานปูนวางศาล 3 มิติ)
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015;
  g.add(sh);
  g.add(mk(GEO.box, MAT.stone, 1.55, 0.12, 1.45, 0, 0.06, 0));
  g.add(mk(GEO.box, idx === 0 ? MAT.darkwood : MAT.gold, 1.25, 0.08, 1.18, 0, 0.15, 0));

  // 2. Multi-layer 3D extruded spirit house body (gives real 3D thickness to the roof, cabin & pillar)
  const body = new THREE.Group();
  body.rotation.y = (side || 1) * -0.24;
  const geo = makeCurvedPlane(w, h, 0.14);
  const pFront = new THREE.Mesh(geo, pair.front);
  pFront.position.set(0, h * 0.49 + 0.10, 0.08);
  body.add(pFront);

  [-0.04, -0.14, -0.24].forEach((dz) => {
    const pSlice = new THREE.Mesh(geo, pair.back);
    pSlice.position.set(0, h * 0.49 + 0.10, dz);
    body.add(pSlice);
  });

  // 3. Warm candle flame + soft radial candlelight halo illuminating the shrine at night
  const flameY = h * 0.56 + 0.10;
  const glow = mk(GEO.sph, MAT.lamp, 0.055, 0.075, 0.055, 0, flameY, 0.26);
  body.add(glow);
  const halo = new THREE.Sprite(SCENERY_MAT.candleHaloMat);
  halo.scale.set(1.65, 1.65, 1);
  halo.position.set(0, flameY + 0.12, 0.28);
  body.add(halo);

  g.add(body);
  return g;
}

// Grand "ศาลเจ้าพ่อตาล" at the starting line (built from the real golden-red Thai spirit house!)
const shrineGroup = (function makeTanShrine() {
  const g = new THREE.Group();
  const pair = SCENERY_MAT.shrines[2]; // ศาลเจ้าพ่อสีทอง-แดงทรงเรือนไทยพร้อมโต๊ะวางเครื่องเซ่น
  const w = 2.65, h = 3.50;

  // 1. Soft radial ground shadow directly under the real golden pedestal
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015;
  g.add(sh);

  // 2. Multi-layer 3D volumetric real spirit house body sitting flush on the ground
  const geo = makeCurvedPlane(w, h, 0.12);
  const pFront = new THREE.Mesh(geo, pair.front);
  pFront.position.set(0.08, h * 0.49, 0.08);
  g.add(pFront);
  [-0.04, -0.14, -0.24].forEach((dz) => {
    const pSlice = new THREE.Mesh(geo, pair.back);
    pSlice.position.set(0.08, h * 0.49, dz);
    g.add(pSlice);
  });

  // 3. Signboard "ศาลเจ้าพ่อตาล" mounted on the front gable eave
  const cx = -0.10;
  const sc = document.createElement('canvas'); sc.width = 320; sc.height = 72;
  const sx = sc.getContext('2d');
  sx.fillStyle = '#3a140c'; sx.fillRect(0, 0, 320, 72);
  sx.strokeStyle = '#ffcc33'; sx.lineWidth = 6; sx.strokeRect(3, 3, 314, 66);
  sx.fillStyle = '#ffdd55'; sx.font = 'bold 34px Sarabun, Tahoma, sans-serif';
  sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText('ศาลเจ้าพ่อตาล', 160, 38);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.25),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), fog: false }));
  sign.position.set(cx + 0.04, 2.58, 0.26);
  g.add(sign);

  // 5. Offerings arranged on the real shrine's golden front offering table (y ~ 1.52)
  const tableY = 1.52, tableZ = 0.28;
  const redDrink = new THREE.MeshBasicMaterial({ color: 0xff1e27 });
  const greenStraw = new THREE.MeshBasicMaterial({ color: 0x32ff6a });
  g.add(mk(GEO.cyl, redDrink, 0.062, 0.25, 0.062, -0.32, tableY + 0.12, tableZ));
  g.add(mk(GEO.cyl, greenStraw, 0.012, 0.19, 0.012, -0.30, tableY + 0.28, tableZ));
  g.add(mk(GEO.cyl, MAT.gold, 0.082, 0.12, 0.082, 0.06, tableY + 0.06, tableZ));  // incense pot
  [-0.03, 0, 0.03].forEach((dx) => {
    g.add(mk(GEO.cyl, MAT.red, 0.009, 0.19, 0.009, 0.06 + dx, tableY + 0.19, tableZ));
    g.add(mk(GEO.sph, MAT.lamp, 0.02, 0.02, 0.02, 0.06 + dx, tableY + 0.30, tableZ));
  });
  [-0.14, 0.26].forEach((xPos) => {                                                 // candles
    g.add(mk(GEO.cyl, MAT.gold, 0.022, 0.16, 0.022, xPos, tableY + 0.08, tableZ));
    g.add(mk(GEO.sph, MAT.lamp, 0.032, 0.048, 0.032, xPos, tableY + 0.18, tableZ));
  });
  const gar = new THREE.Mesh(GEO.garlandPlane, MAT.garlandPic);
  gar.scale.setScalar(0.52);
  gar.position.set(0.46, tableY + 0.13, tableZ + 0.04);
  g.add(gar);

  const halo = new THREE.Sprite(SCENERY_MAT.candleHaloMat);
  halo.scale.set(2.1, 2.1, 1);
  halo.position.set(0.06, tableY + 0.26, tableZ + 0.08);
  g.add(halo);

  const sLight = new THREE.PointLight(0xffb85c, 1.6, 9);
  sLight.position.set(0, 2.2, 1.2);
  g.add(sLight);
  g.scale.setScalar(1.06);
  scene.add(g);
  return g;
})();
const decor = [];
let sinceDecor = 0;
function spawnDecor(z) {
  [-1, 1].forEach((side) => {
    if (Math.random() < 0.18) return;
    const step = (decorSeq++) % 5;
    let m, off;
    if (step === 0 || step === 2) {
      m = makeTree(side);
      off = LANE_W * 1.5 + 2.4 + Math.random() * 3.2;
    } else if (step === 1 || step === 3) {
      m = makeSpiritHouse(side);
      off = LANE_W * 1.5 + 1.8 + Math.random() * 2.2;
    } else {
      m = makeLanternPost();
      off = LANE_W * 1.5 + 1.2;
    }
    m.position.set(side * off, 0, z + (Math.random() - 0.5) * 3.5);
    scene.add(m); decor.push(m);

    // Occasional spooky roadside spirit watcher standing beside the shrine or tree
    if ((step === 1 || step === 3) && Math.random() < 0.24) {
      const watcher = makeStandingGhost(true);
      watcher.group.position.set(side * (off + 1.05), 0, z + (Math.random() - 0.5) * 1.6);
      watcher.group.rotation.y = side > 0 ? -Math.PI / 2 - 0.25 : Math.PI / 2 + 0.25;
      scene.add(watcher.group);
      decor.push(watcher.group);
    }
  });
}

// ============================================================ obstacles & offerings
const obstacles = [];
const offerings = [];
const OB_DEPTH = { low: 0.6, high: 0.7, block: 2.7, ghost: 1.2 };

function makeStandingGhost(isRoadside) {
  const g = new THREE.Group();
  const human = C.makeHuman(true);
  human.group.scale.setScalar(isRoadside ? 0.72 : 0.82);
  human.group.rotation.y = 0; // faces +Z toward oncoming runner
  human.group.position.y = 0.12;
  g.add(human.group);

  // Piercing glowing red ghostly eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0024, fog: false });
  const eyeL = new THREE.Mesh(GEO.sph, eyeMat);
  eyeL.scale.set(0.048, 0.048, 0.048);
  eyeL.position.set(-0.11, 0.045, 0.30);
  human.head.add(eyeL);

  const eyeR = new THREE.Mesh(GEO.sph, eyeMat);
  eyeR.scale.set(0.048, 0.048, 0.048);
  eyeR.position.set(0.10, 0.035, 0.30);
  human.head.add(eyeR);

  // Eerie blood-red ground spectral aura ring
  const ringGeo = new THREE.RingGeometry(0.25, 1.15, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff1226,
    transparent: true,
    opacity: isRoadside ? 0.36 : 0.62,
    side: THREE.DoubleSide,
    fog: false
  });
  const mistRing = new THREE.Mesh(ringGeo, ringMat);
  mistRing.rotation.x = Math.PI / 2;
  mistRing.position.y = 0.03;
  g.add(mistRing);

  // Floating red spirit light for in-lane ghosts
  let wisp = null;
  if (!isRoadside) {
    wisp = new THREE.PointLight(0xff2244, 1.4, 8.0);
    wisp.position.set(0, 1.35, 0.25);
    g.add(wisp);
  }

  const phase = Math.random() * Math.PI * 2;
  const update = (dt, t) => {
    // Eerie floating bob
    human.group.position.y = 0.12 + Math.sin(t * 3.6 + phase) * 0.10;
    // Grasping outstretched arms & swaying head
    C.poseGhost(human, t + phase);
    // Pulsing spectral ground mist
    mistRing.scale.setScalar(1 + Math.sin(t * 4.2 + phase) * 0.16);
    if (wisp) wisp.intensity = 0.75 + Math.sin(t * 7 + phase) * 0.25;
  };

  g.userData = { update };
  return { group: g, human, mistRing, wisp, phase, update };
}

function makeObstacle(type) {
  const g = new THREE.Group();
  if (type === 'low') {
    g.add(mk(GEO.box, MAT.darkwood, 0.16, 0.85, 0.16, -0.95, 0.42, 0));
    g.add(mk(GEO.box, MAT.darkwood, 0.16, 0.85, 0.16, 0.95, 0.42, 0));
    g.add(mk(GEO.box, MAT.stripe, 2.15, 0.34, 0.2, 0, 0.7, 0));
  } else if (type === 'high') {
    g.add(mk(GEO.box, MAT.darkwood, 0.2, 2.6, 0.2, -1.1, 1.3, 0));
    g.add(mk(GEO.box, MAT.darkwood, 0.2, 2.6, 0.2, 1.1, 1.3, 0));
    g.add(mk(GEO.box, MAT.stripe, 2.3, 0.7, 0.3, 0, 1.68, 0));
    g.add(mk(GEO.sph, MAT.lamp, 0.2, 0.26, 0.2, 0, 1.15, 0.0));
  } else {
    g.add(mk(GEO.box, MAT.wood, 2.0, 1.75, 2.6, 0, 0.88, 0));
    g.add(mk(GEO.box, MAT.red, 2.1, 0.22, 2.7, 0, 1.85, 0));
    g.add(mk(GEO.cyl, MAT.darkwood, 0.45, 0.2, 0.45, -0.95, 0.3, 1.0).rotateZ(Math.PI / 2));
    g.add(mk(GEO.cyl, MAT.darkwood, 0.45, 0.2, 0.45, 0.95, 0.3, 1.0).rotateZ(Math.PI / 2));
  }
  return g;
}
function spawnObstacle(lane, type, z) {
  let m, ghostObj = null, update = null;
  if (type === 'ghost') {
    ghostObj = makeStandingGhost(false);
    m = ghostObj.group;
    update = ghostObj.update;
  } else {
    m = makeObstacle(type);
  }
  m.position.set((lane - 1) * LANE_W, 0, z);
  scene.add(m);
  obstacles.push({
    mesh: m,
    lane,
    type,
    depth: OB_DEPTH[type],
    hit: false,
    ghostObj,
    update,
    passed: false
  });
}
function spawnOffering(lane, z, y) {
  const m = new THREE.Group();
  const pic = new THREE.Mesh(GEO.garlandPlane, MAT.garlandPic);
  m.add(pic);
  m.position.set((lane - 1) * LANE_W, y, z);
  scene.add(m);
  offerings.push({ mesh: m, lane, got: false });
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TYPES = ['low', 'high', 'block'];
let sinceRow = 0, rowSpacing = 20;
let sinceGhost = 0, nextGhostDist = 45 + Math.random() * 30;

function spawnRow() {
  if (flyT > 0 || isGlidingDown) {
    // While soaring through the sky or descending, do not spawn ground obstacles under the player!
    rowSpacing = speed * 1.5;
    return;
  }
  const z = SPAWN_Z;
  const isKrahangRow = sinceKrahang >= nextKrahangDist && dist > 55 && flyT <= 0 && !isGlidingDown;
  if (isKrahangRow) {
    sinceKrahang = 0;
    nextKrahangDist = 220 + Math.random() * 120; // 220m - 340m spacing between flight power-ups
    const kLane = Math.floor(Math.random() * 3);
    spawnKrahangItem(kLane, z);
    for (let l = 0; l < 3; l++) {
      if (l !== kLane && Math.random() < 0.35) spawnObstacle(l, 'low', z);
    }
    const zc = z + rowSpacing * 0.5;
    for (let i = -2; i <= 2; i++) spawnOffering(kLane, zc + i * 1.8, 1.0);
    rowSpacing = speed * 1.0;
    return;
  }

  const isSaiSinRow = sinceSaiSin >= nextSaiSinDist && dist > 35 && flyT <= 0 && !isGlidingDown && !hasSaiSin;
  if (isSaiSinRow) {
    sinceSaiSin = 0;
    nextSaiSinDist = 160 + Math.random() * 90;
    const sLane = Math.floor(Math.random() * 3);
    spawnSaiSinItem(sLane, z);
    for (let l = 0; l < 3; l++) {
      if (l !== sLane && Math.random() < 0.35) spawnObstacle(l, 'low', z);
    }
    const zc = z + rowSpacing * 0.5;
    for (let i = -2; i <= 2; i++) spawnOffering(sLane, zc + i * 1.8, 1.0);
    rowSpacing = speed * 1.0;
    return;
  }

  const isGhostRow = sinceGhost >= nextGhostDist && dist > 30;

  if (isGhostRow) {
    sinceGhost = 0;
    nextGhostDist = 55 + Math.random() * 45; // 55m to 100m spacing so player has plenty of reaction time!

    // 1. Pick lane for the standing ghost
    const gLane = Math.floor(Math.random() * 3);
    spawnObstacle(gLane, 'ghost', z);

    // 2. Guarantee a 100% CLEAR escape lane
    const freeLane = (gLane + 1 + Math.floor(Math.random() * 2)) % 3;
    const otherLane = 3 - gLane - freeLane;

    // 3. 35% chance otherLane has low jumpable hurdle, otherwise completely clear!
    if (Math.random() < 0.35) {
      spawnObstacle(otherLane, 'low', z);
    }

    // 4. Reward garlands in the freeLane halfway to next row
    const zc = z + rowSpacing * 0.5;
    for (let i = -2; i <= 2; i++) spawnOffering(freeLane, zc + i * 1.8, 1.0);

    // 5. Generous breathing room after dodging the ghost
    rowSpacing = Math.max(rowSpacing, speed * 1.25);
    return;
  }

  const r = Math.random();
  let freeLane = Math.floor(Math.random() * 3);
  if (r < 0.28) {
    spawnObstacle(Math.floor(Math.random() * 3), pick(TYPES), z);
  } else if (r < 0.53) {
    for (let l = 0; l < 3; l++) if (l !== freeLane) spawnObstacle(l, 'block', z);
  } else if (r < 0.73) {
    for (let l = 0; l < 3; l++) spawnObstacle(l, 'low', z);
    freeLane = Math.floor(Math.random() * 3);
  } else if (r < 0.85) {
    for (let l = 0; l < 3; l++) spawnObstacle(l, 'high', z);
  } else {
    for (let l = 0; l < 3; l++) {
      if (l === freeLane) { if (Math.random() < 0.5) spawnObstacle(l, 'low', z); }
      else spawnObstacle(l, pick(TYPES), z);
    }
  }
  // offering strip halfway between this row and the next
  const lane = Math.random() < 0.6 ? freeLane : Math.floor(Math.random() * 3);
  const zc = z + rowSpacing * 0.5;
  for (let i = -2; i <= 2; i++) spawnOffering(lane, zc + i * 1.8, 1.0);
  rowSpacing = speed * 0.9 + Math.random() * speed * 0.5;
}

// ============================================================ audio (tiny WebAudio synth)
let ac = null;
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
}
function tone(f, dur, type, vol, slide) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, f + slide), t + dur);
  g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol, lp) {
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
  const g = ac.createGain(); g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
}
const sfx = {
  coin: () => { tone(880, 0.09, 'triangle', 0.12); setTimeout(() => tone(1320, 0.12, 'triangle', 0.12), 60); },
  jump: () => tone(300, 0.18, 'square', 0.05, 260),
  hit: () => { noise(0.3, 0.5, 700); tone(110, 0.3, 'sawtooth', 0.2, -70); },
  beat: () => { tone(60, 0.16, 'sine', 0.5, -20); setTimeout(() => tone(52, 0.18, 'sine', 0.4, -15), 150); },
  scream: () => { noise(1.3, 0.6, 3000); tone(1000, 1.1, 'sawtooth', 0.22, -650); tone(1500, 0.9, 'square', 0.1, -1000); },
  ghostScare: () => { noise(0.65, 0.65, 2400); tone(850, 0.7, 'sawtooth', 0.28, -550); tone(140, 0.5, 'square', 0.22, -60); },
  ghostPass: () => { noise(0.4, 0.22, 600); tone(220, 0.35, 'sine', 0.14, -50); },
  krahangPickup: () => {
    tone(440, 0.12, 'triangle', 0.18, 180);
    setTimeout(() => tone(660, 0.14, 'triangle', 0.20, 220), 80);
    setTimeout(() => tone(880, 0.16, 'triangle', 0.22, 330), 160);
    setTimeout(() => tone(1320, 0.25, 'sine', 0.25, 100), 240);
  },
  flap: () => { noise(0.12, 0.14, 450); tone(180, 0.14, 'sine', 0.10, -50); },
  land: () => { noise(0.18, 0.25, 300); tone(95, 0.20, 'sine', 0.28, -35); },
  saiSinPickup: () => {
    tone(587.33, 0.16, 'sine', 0.24, 120);
    setTimeout(() => tone(880, 0.20, 'triangle', 0.26, 160), 80);
    setTimeout(() => tone(1174.66, 0.32, 'sine', 0.30, 60), 160);
  },
  saiSinBreak: () => {
    noise(0.25, 0.45, 1800);
    tone(1046.5, 0.18, 'triangle', 0.30, -250);
    tone(523.25, 0.22, 'sine', 0.24, -100);
  },
  saiSinExpire: () => {
    tone(440, 0.20, 'sine', 0.15, -160);
    setTimeout(() => tone(293.66, 0.24, 'sine', 0.12, -80), 80);
  },
};

// ============================================================ game state
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), hudBest: $('hudBest'), offerN: $('offerN'), bar: $('barfill'), hint: $('hint'),
  pip: $('pip'), vig: $('vig'), flash: $('flash'), menu: $('menu'), over: $('over'),
  pauseOverlay: $('pauseOverlay'), pauseBtn: $('pauseBtn'),
  krahangBadge: $('krahangBadge'), krahangBarFill: $('krahangBarFill'),
  saiSinBadge: $('saiSinBadge'), saiSinBarFill: $('saiSinBarFill'), saiSinTimerText: $('saiSinTimerText'),
  fScore: $('fScore'), fOffer: $('fOffer'), fBest: $('fBest'),
};

// ============================================================ collectibles (🪽 กระด้ง & 🧵 สายสิญจน์มงคล)
const collectibles = [];
const MAX_SAISIN_T = 20.0;
let hasSaiSin = false;
let saiSinT = 0;
let sinceSaiSin = 0, nextSaiSinDist = 95 + Math.random() * 45;

// 🧵 Sacred Sai Sin Shield Group attached to playerRoot
const saiSinShieldGroup = new THREE.Group();
const shieldDomeGeo = new THREE.SphereGeometry(1.08, 22, 16);
const shieldDomeMat = new THREE.MeshBasicMaterial({
  color: 0x67e8f9,
  transparent: true,
  opacity: 0.24,
  wireframe: false,
  side: THREE.DoubleSide
});
const shieldDome = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
saiSinShieldGroup.add(shieldDome);

// Sacred Braided Holy Thread Torus Rings
const threadMatA = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.10, 0.038, 10, 32), threadMatA);
ringA.rotation.x = Math.PI * 0.35;
saiSinShieldGroup.add(ringA);

const threadMatB = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.10, 0.038, 10, 32), threadMatB);
ringB.rotation.y = Math.PI * 0.40;
saiSinShieldGroup.add(ringB);

saiSinShieldGroup.position.set(0, 0.95, 0);
saiSinShieldGroup.visible = false;
playerRoot.add(saiSinShieldGroup);

function spawnSaiSinItem(lane, z) {
  const g = new THREE.Group();
  
  // Floating crystal pearl
  const pearlGeo = new THREE.SphereGeometry(0.34, 18, 18);
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.1
  });
  const pearl = new THREE.Mesh(pearlGeo, pearlMat);
  g.add(pearl);

  // Twin Holy Thread loops
  const torusA = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.042, 10, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  torusA.rotation.x = 0.55;
  g.add(torusA);

  const torusB = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.042, 10, 28), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.4 }));
  torusB.rotation.y = 0.65;
  g.add(torusB);

  // Ground prayer ring
  const ringGeo = new THREE.RingGeometry(0.50, 0.68, 30);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.rotation.x = -Math.PI / 2; groundRing.position.y = -0.42;
  g.add(groundRing);

  const pLight = new THREE.PointLight(0x67e8f9, 1.8, 5.0);
  pLight.position.set(0, 0.25, 0);
  g.add(pLight);

  g.position.set((lane - 1) * LANE_W, 0.95, z);
  scene.add(g);
  collectibles.push({
    mesh: g,
    lane,
    type: 'saiSin',
    got: false,
    update: (dt, clk) => {
      g.rotation.y += dt * 3.0;
      torusA.rotation.z += dt * 2.5;
      torusB.rotation.x += dt * 2.8;
      g.position.y = 0.95 + Math.sin(clk * 4.5) * 0.15;
      groundRing.scale.setScalar(0.92 + Math.sin(clk * 5.0) * 0.12);
    }
  });
}

function activateSaiSinShield() {
  hasSaiSin = true;
  saiSinShieldGroup.visible = true;
  sinceSaiSin = 0;
  sfx.saiSinPickup();
  saiSinT = MAX_SAISIN_T;
  if (ui.saiSinBadge) {
    ui.saiSinBadge.style.display = 'block';
    if (ui.saiSinBarFill) ui.saiSinBarFill.style.width = '100%';
    if (ui.saiSinTimerText) ui.saiSinTimerText.textContent = `${Math.ceil(MAX_SAISIN_T)}s`;
  }
  ui.flash.style.transition = 'none';
  ui.flash.style.backgroundColor = 'rgba(103, 232, 249, 0.38)';
  ui.flash.style.opacity = 0.45;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .5s';
    ui.flash.style.opacity = 0;
    ui.flash.style.backgroundColor = '';
  });
}

function expireSaiSinShield() {
  hasSaiSin = false;
  saiSinT = 0;
  saiSinShieldGroup.visible = false;
  if (ui.saiSinBadge) ui.saiSinBadge.style.display = 'none';
  sfx.saiSinExpire();
}

function consumeSaiSinShield(o) {
  saiSinT = 0;
  hasSaiSin = false;
  saiSinShieldGroup.visible = false;
  if (ui.saiSinBadge) ui.saiSinBadge.style.display = 'none';
  sfx.saiSinBreak();
  invuln = 1.8;
  o.hit = true;
  scene.remove(o.mesh);
  // Blessed holy burst flash (No stumble, no speed loss, no ghost gap loss!)
  ui.flash.style.transition = 'none';
  ui.flash.style.backgroundColor = 'rgba(103, 232, 249, 0.55)';
  ui.flash.style.opacity = 0.65;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .45s';
    ui.flash.style.opacity = 0;
    ui.flash.style.backgroundColor = '';
  });
}
const SKY_Y = 14.0;
const MAX_FLY_T = 7.5;
let flyT = 0, isGlidingDown = false, flapTimer = 0, skyOfferTimer = 0;
let sinceKrahang = 0, nextKrahangDist = 75 + Math.random() * 45;

function spawnKrahangItem(lane, z) {
  const g = new THREE.Group();
  const tL = C.makeKrahangTray ? C.makeKrahangTray(0.44) : new THREE.Group();
  const tR = C.makeKrahangTray ? C.makeKrahangTray(0.44) : new THREE.Group();
  tL.position.set(-0.35, 0, 0); tL.rotation.set(0.15, 0.15, 0.30);
  tR.position.set(0.35, 0, 0); tR.rotation.set(0.15, -0.15, -0.30);
  g.add(tL); g.add(tR);

  const ringGeo = new THREE.RingGeometry(0.52, 0.70, 30);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.42;
  g.add(ring);

  const pLight = new THREE.PointLight(0xffd23a, 1.5, 4.5);
  pLight.position.set(0, 0.25, 0);
  g.add(pLight);

  g.position.set((lane - 1) * LANE_W, 0.95, z);
  scene.add(g);
  collectibles.push({
    mesh: g,
    ring,
    lane,
    type: 'krahang',
    got: false,
    update: (dt, clk) => {
      g.rotation.y += dt * 2.8;
      g.position.y = 0.95 + Math.sin(clk * 4.2) * 0.16;
      ring.scale.setScalar(0.92 + Math.sin(clk * 5.0) * 0.12);
    }
  });
}

function activateKrahangFlight() {
  flyT = MAX_FLY_T;
  isGlidingDown = false;
  landingGrace = 0;
  invuln = MAX_FLY_T + 4.0;
  gap = GHOST_MAX_GAP;
  gz = GHOST_MAX_GAP;
  sinceKrahang = 0;
  sfx.krahangPickup();
  if (player.setKrahangVisible) player.setKrahangVisible(true);
  if (ui.krahangBadge) {
    ui.krahangBadge.style.display = 'block';
    if (ui.krahangBarFill) ui.krahangBarFill.style.width = '100%';
  }
  // Clear any existing sky offerings
  for (let i = offerings.length - 1; i >= 0; i--) {
    if (offerings[i].mesh.position.y > 3.0) {
      scene.remove(offerings[i].mesh);
      offerings.splice(i, 1);
    }
  }
  // 1. Ascending ramp of garlands during takeoff from current lane into the clouds!
  spawnOffering(lane, -7, 4.0);
  spawnOffering(lane, -10, 7.5);
  spawnOffering(lane, -13, 11.0);
  spawnOffering(lane, -16, SKY_Y);

  // 2. Full soaring serpentine ribbon of garlands across lanes at SKY_Y (14m)
  for (let z = -19; z >= SPAWN_Z; z -= 2.6) {
    const wave = Math.sin((z + 19) * 0.11);
    const skyLane = wave < -0.30 ? 0 : wave > 0.30 ? 2 : 1;
    spawnOffering(skyLane, z, SKY_Y);
  }
  ui.flash.style.transition = 'none';
  ui.flash.style.opacity = 0.4;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .5s';
    ui.flash.style.opacity = 0;
  });
}
let state = 'menu', paused = false;
let speed = 16, speedMul = 1, dist = 0, offerCount = 0, tPlay = 0, gap = GHOST_START_GAP, gz = GHOST_START_GAP, gx = 0;
let lane = 1, px = 0, py = 0, vy = 0, slideT = 0, invuln = 0, stumble = 0, shake = 0, runPhase = 0, landingGrace = 0;
let hbTimer = 0, deadT = 0, clock = 0;
let best = +(localStorage.getItem('tanGhostBest') || 0);

function clearWorld() {
  [obstacles, offerings, collectibles].forEach((arr) => { arr.forEach((o) => scene.remove(o.mesh)); arr.length = 0; });
  decor.forEach((m) => scene.remove(m)); decor.length = 0;
}
function seedDecor() { for (let z = 8; z > SPAWN_Z; z -= 9) spawnDecor(z); }

function reset() {
  clearWorld();
  speed = 16; speedMul = 1; dist = 0; offerCount = 0; tPlay = 0;
  gap = gz = GHOST_START_GAP; gx = 0;
  lane = 1; px = 0; py = 0; vy = 0; slideT = 0; invuln = 0; stumble = 0; shake = 0; landingGrace = 0;
  flyT = 0; isGlidingDown = false; sinceKrahang = 0; nextKrahangDist = 180 + Math.random() * 80; hasSaiSin = false; saiSinT = 0; sinceSaiSin = 0; nextSaiSinDist = 95 + Math.random() * 45; if (saiSinShieldGroup) saiSinShieldGroup.visible = false; if (ui.saiSinBadge) ui.saiSinBadge.style.display = 'none';
  if (player && player.setKrahangVisible) player.setKrahangVisible(false);
  if (ui.krahangBadge) ui.krahangBadge.style.display = 'none';
  sinceRow = 0; rowSpacing = 26; sinceDecor = 0; sinceGhost = 0; nextGhostDist = 45 + Math.random() * 30; hbTimer = 0; deadT = 0;
  playerRoot.rotation.set(0, 0, 0); playerRoot.visible = true;
  shrineGroup.position.set(-1.50, 0, -0.55);
  shrineGroup.rotation.y = 0.82;
  shrineGroup.visible = true;
  ghost.group.rotation.set(-0.14, Math.PI, 0); ghostRoot.scale.setScalar(1.3);
  seedDecor();
  // first safe offering strip
  for (let i = -2; i <= 2; i++) spawnOffering(1, -34 + i * 1.8, 1.0);
}

function start() {
  initAudio();
  reset();
  paused = false;
  ui.pauseBtn.textContent = '⏸ พักเกม';
  state = 'play';
  sfx.hit();
  shake = 0.45;
  if (deathTimer) { clearTimeout(deathTimer); deathTimer = null; } ui.menu.style.display = 'none'; ui.over.style.display = 'none'; ui.over.classList.remove('scaring', 'ready'); ui.pauseOverlay.style.display = 'none';
  ui.hud.style.display = 'block'; ui.pip.style.display = 'block'; ui.hint.style.display = 'block';
  setTimeout(() => (ui.hint.style.display = state === 'play' ? 'none' : ui.hint.style.display), 7000);
}
function togglePause(force) {
  if (state !== 'play') return;
  paused = typeof force === 'boolean' ? force : !paused;
  touch = null;
  ui.pauseOverlay.style.display = paused ? 'flex' : 'none';
  ui.pauseBtn.textContent = paused ? '▶ เล่นต่อ' : '⏸ พักเกม';
}
function goToMenu() {
  reset();
  paused = false;
  touch = null;
  state = 'menu';
  ui.flash.style.opacity = 0;
  if (deathTimer) { clearTimeout(deathTimer); deathTimer = null; } ui.over.style.display = 'none';
  ui.over.classList.remove('scaring', 'ready');
  ui.pauseOverlay.style.display = 'none';
  ui.hud.style.display = 'none';
  ui.pip.style.display = 'none';
  ui.hint.style.display = 'none';
  ui.menu.style.display = 'flex';
}
window.triggerStart = start;
window.triggerDie = die;
window.triggerSpawnGhost = (l, z) => spawnObstacle(l, 'ghost', z);
window.triggerSpawnKrahang = (l, z) => spawnKrahangItem(l, z);
window.triggerSpawnSaiSin = (l, z) => spawnSaiSinItem(l, z);
window.triggerSaiSin = () => activateSaiSinShield();
window.triggerFly = () => activateKrahangFlight();
window.getGameState = () => ({ flyT, py, offerCount, state, gap, dist, deadT, hasSaiSin, saiSinT });
let deathTimer = null;
function showDeathButtons() {
  if (!ui.over) return;
  if (deathTimer) { clearTimeout(deathTimer); deathTimer = null; }
  ui.over.classList.remove('scaring');
  ui.over.classList.add('ready');
}
function die() {
  paused = false;
  ui.pauseOverlay.style.display = 'none';
  state = 'dead'; deadT = 0;
  sfx.scream();
  ui.flash.style.opacity = 1;
  const m = Math.floor(dist);
  if (m > best) { best = m; localStorage.setItem('tanGhostBest', best); }
  ui.fScore.textContent = m; ui.fOffer.textContent = offerCount; ui.fBest.textContent = best;
  ui.hint.style.display = 'none';
  ui.pip.style.display = 'none';
  ui.hud.style.display = 'none';
  shake = 2.4;
  // Show Tan's face full screen first!
  ui.over.style.display = 'flex';
  ui.over.classList.remove('ready');
  ui.over.classList.add('scaring');
  if (deathTimer) clearTimeout(deathTimer);
  deathTimer = setTimeout(() => {
    if (state === 'dead') showDeathButtons();
  }, 1600);
}

// ============================================================ input
function moveLane(d) { if (state !== 'play' || paused) return; lane = Math.max(0, Math.min(2, lane + d)); }
function jump() {
  if (state !== 'play' || paused || flyT > 0) return;
  if (py <= 0.001) { vy = JUMP_V; slideT = 0; sfx.jump(); }
}
function slide() {
  if (state !== 'play' || paused || flyT > 0) return;
  if (py > 0.05) vy = -22;
  slideT = 0.75;
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (k === 'escape' || k === 'p') { togglePause(); return; }
  if (paused) return;
  if (k === 'arrowleft' || k === 'a') moveLane(-1);
  else if (k === 'arrowright' || k === 'd') moveLane(1);
  else if (k === 'arrowup' || k === 'w' || k === ' ') jump();
  else if (k === 'arrowdown' || k === 's') slide();
  else if (k === 'f') activateKrahangFlight();
  else if (k === 'enter' && state !== 'play' && (state === 'menu' || (ui.over.style.display === 'flex' && ui.over.classList.contains('ready')))) start();
});
window.activateKrahangFlight = activateKrahangFlight;
let touch = null;
function swipeStart(x, y) { touch = { x, y, done: false }; }
function swipeMove(x, y) {
  if (!touch || touch.done) return;
  const dx = x - touch.x, dy = y - touch.y;
  if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
  touch.done = true;
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else slide();
}
function swipeEnd(x, y) {
  if (!touch) return;
  const wasDone = touch.done;
  const dx = x - touch.x, dy = y - touch.y;
  touch = null;
  if (wasDone) return;
  if (Math.abs(dx) < 22 && Math.abs(dy) < 22) { jump(); return; }
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else slide();
}
window.addEventListener('touchmove', (e) => {
  if (state === 'play') e.preventDefault();
  if (e.changedTouches && e.changedTouches[0]) {
    const t = e.changedTouches[0];
    swipeMove(t.clientX, t.clientY);
  }
}, { passive: false });
canvas.addEventListener('touchstart', (e) => {
  if (state === 'play') e.preventDefault();
  const t = e.changedTouches[0];
  swipeStart(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  if (state === 'play') e.preventDefault();
  const t = e.changedTouches[0];
  swipeEnd(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener('mousedown', (e) => swipeStart(e.clientX, e.clientY));
window.addEventListener('mouseup', (e) => swipeEnd(e.clientX, e.clientY));
$('startBtn').addEventListener('click', (e) => { e.stopPropagation(); start(); });
ui.menu.addEventListener('click', () => { if (state === 'menu') start(); });
ui.over.addEventListener('click', (e) => {
  if (ui.over.classList.contains('scaring') && deadT > 0.6) {
    showDeathButtons();
  }
});
$('retryBtn').addEventListener('click', (e) => { e.stopPropagation(); start(); });
$('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); goToMenu(); });
ui.pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
ui.pauseBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
$('resumeBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePause(false); });
$('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); start(); });
$('pauseMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); goToMenu(); });

// ============================================================ update
function animateRunner(dt, running) {
  const air = py > 0.02, sl = slideT > 0;
  const k = Math.min(1, dt * 18);
  if (player.mixer) {                                   // 3D Thai Student (Mixamo glTF)
    const anim = state === 'dead' ? 'Death' : state === 'menu' ? 'Sitting' : 'Running';
    player.play(anim, anim === 'Death' ? 0.12 : 0.15);
    if (player.actions.Running) {
      const targetScale = flyT > 0 ? 0.08 : air ? 0.28 : sl ? 0.18 : 1.35 + speed * 0.032;
      player.actions.Running.timeScale += (targetScale - player.actions.Running.timeScale) * Math.min(1, dt * 14);
    }
    player.mixer.update(dt);
    if (state === 'menu') {
      const bow = player.posePray(clock);
      player.group.rotation.set(0.02 + bow * 0.06, Math.PI + 1.12, 0);  // YXZ: student bows waist & Wai hands toward ศาลเจ้าพ่อตาล!
      player.group.position.set(0, 0, 0);
    } else {
      if (player.incense) player.incense.visible = false;
      if (player.poseAction) player.poseAction(air, sl, dt);
      // In YXZ order: negative rotation.x reclines backward on its back (feet forward under the barrier!)
      const lean = sl ? -1.32 : flyT > 0 ? -0.22 : state === 'play' && !air ? 0.12 : 0;
      player.group.rotation.x += (lean - player.group.rotation.x) * k;
      player.group.rotation.y += (Math.PI - player.group.rotation.y) * Math.min(1, dt * 10);
      const targetY = sl ? 0.42 : 0;
      const targetZ = sl ? -0.55 : 0;
      player.group.position.y += (targetY - player.group.position.y) * k;
      player.group.position.z += (targetZ - player.group.position.z) * k;
      if (player.poseKrahang) {
        const tx = (lane - 1) * LANE_W;
        const banking = (px - tx) * 0.45;
        player.poseKrahang(clock, flyT > 0 || isGlidingDown, banking);
      }
    }
    return;
  }
  const pf = player.fallback; if (!pf) return;           // faceless fallback human
  if (running && !air) runPhase += dt * (9 + speed * 0.35);
  let bob = 0;
  if (sl || state === 'menu') C.poseSlide(pf); else bob = C.poseRun(pf, runPhase, air);
  const lean = sl ? -1.32 : air ? 0.08 : 0.16;
  player.group.rotation.x += (lean - player.group.rotation.x) * k;
  const baseY = sl ? 0.38 : (running && !air ? bob * 0.09 : 0);
  player.group.position.y += (baseY - player.group.position.y) * k;
  pf.head.rotation.x = sl ? 0.4 : -0.12;
  if (player.poseKrahang) {
    const tx = (lane - 1) * LANE_W;
    const banking = (px - tx) * 0.45;
    player.poseKrahang(clock, flyT > 0 || isGlidingDown, banking);
  }
}
function update(dt) {
  clock += dt;
  if (state === 'play') {
    tPlay += dt;
    speed = Math.min(34, 16 + tPlay * 0.25);
    const targetMul = stumble > 0 ? 0.6 : 1;
    speedMul += (targetMul - speedMul) * Math.min(1, dt * 4);
    const dz = speed * speedMul * dt;
    dist += dz * 0.5;

    // lane / jump / slide
    const tx = (lane - 1) * LANE_W;
    px += (tx - px) * Math.min(1, dt * 14);
    playerRoot.rotation.z = (px - tx) * 0.12;

    // flight & jumping physics
    if (flyT > 0) {
      flyT -= dt;
      py += (SKY_Y - py) * Math.min(1, dt * 5.2);
      vy = 0; slideT = 0;
      flapTimer -= dt;
      if (flapTimer <= 0) { sfx.flap(); flapTimer = 0.22; }
      if (ui.krahangBarFill) {
        const pct = Math.max(0, Math.min(100, (flyT / MAX_FLY_T) * 100));
        ui.krahangBarFill.style.width = pct + '%';
      }
      skyOfferTimer -= dt;
      if (skyOfferTimer <= 0) {
        skyOfferTimer = 0.12;
        const wave = Math.sin(clock * 1.8);
        const skyLane = wave < -0.32 ? 0 : wave > 0.32 ? 2 : 1;
        spawnOffering(skyLane, SPAWN_Z, SKY_Y);
      }
      if (flyT <= 0) {
        flyT = 0;
        isGlidingDown = true;
        if (ui.krahangBadge) ui.krahangBadge.style.display = 'none';
      }
    } else if (isGlidingDown) {
      py += (0 - py) * Math.min(1, dt * 3.4);
      vy = 0;
      gap = GHOST_MAX_GAP; // Ghost Tan remains safely far behind during descent!
      gz = Math.max(gz, GHOST_MAX_GAP + 4.0);
      if (py < 0.15) {
        py = 0;
        isGlidingDown = false;
        landingGrace = 4.5;             // 4.5s safe runway immunity where ghost cannot catch player!
        if (player.setKrahangVisible) player.setKrahangVisible(false);
        sfx.land();
        invuln = Math.max(invuln, 4.0); // 4.0s landing grace immunity against obstacle stumbles!
        gap = GHOST_MAX_GAP;            // Ghost Tan stays at safe max distance
        gz = GHOST_MAX_GAP + 5.0;       // Ghost visibly starts far behind upon touchdown
        sinceKrahang = 0;               // Reset ground travel distance upon touchdown
        nextKrahangDist = 220 + Math.random() * 120;
        sinceRow = 0; rowSpacing = speed * 2.8; // Clear obstacle runway upon touchdown!
        // Clear any ground obstacles ahead for 75m to guarantee a wide open landing strip
        for (let i = obstacles.length - 1; i >= 0; i--) {
          if (obstacles[i].mesh.position.z > -75) {
            scene.remove(obstacles[i].mesh);
            obstacles.splice(i, 1);
          }
        }
        // Spawn glorious runway of garlands (พวงมาลัย) right in front of the player on landing lane!
        for (let z = -6; z >= -65; z -= 3.2) {
          spawnOffering(lane, z, 1.0);
        }
      }
    } else {
      if (py > 0 || vy > 0) {
        vy -= GRAVITY * dt; py += vy * dt;
        if (py <= 0) { py = 0; vy = 0; }
      }
    }
    if (slideT > 0) slideT -= dt;
    if (invuln > 0) invuln -= dt;
    if (stumble > 0) stumble -= dt;

    // Holy Thread Shield timer & countdown HUD
    if (hasSaiSin) {
      saiSinT -= dt;
      if (saiSinT <= 0) {
        expireSaiSinShield();
      } else {
        if (ui.saiSinBarFill) {
          const pct = Math.max(0, Math.min(100, (saiSinT / MAX_SAISIN_T) * 100));
          ui.saiSinBarFill.style.width = pct + '%';
        }
        if (ui.saiSinTimerText) {
          ui.saiSinTimerText.textContent = `${Math.ceil(saiSinT)}s`;
        }
        // Warning blink during final 3.5 seconds before expiration
        if (saiSinT < 3.5) {
          saiSinShieldGroup.visible = Math.floor(clock * 12) % 2 === 0;
        } else {
          saiSinShieldGroup.visible = true;
        }
      }
    }

    // ghost gap: constantly closing in fast ONLY when running on the ground (paused during landing grace)!
    if (flyT <= 0 && !isGlidingDown) {
      if (landingGrace > 0) {
        landingGrace -= dt;
        gap = GHOST_MAX_GAP;
        gz = Math.max(gz, GHOST_MAX_GAP);
      } else {
        const drain = Math.min(1.85, 0.70 + tPlay * 0.008);
        gap -= drain * dt;
        gap = Math.min(gap, GHOST_MAX_GAP);
      }
    } else {
      gap = GHOST_MAX_GAP;
      gz = Math.max(gz, GHOST_MAX_GAP + 2.0);
    }

    // world scroll
    groundTex.offset.y += dz / CELL;
    if (shrineGroup.visible) {
      shrineGroup.position.z += dz;
      if (shrineGroup.position.z > 14) shrineGroup.visible = false;
    }
    sinceDecor += dz; if (sinceDecor > 9) { sinceDecor = 0; spawnDecor(SPAWN_Z); }
    sinceGhost += dz;
    if (flyT <= 0 && !isGlidingDown) {
      sinceKrahang += dz;
      sinceSaiSin += dz;
    }
    sinceRow += dz; if (sinceRow >= rowSpacing) { sinceRow = 0; spawnRow(); }

    // collectibles (🪽 กระด้งผีกระหัง)
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i]; c.mesh.position.z += dz;
      if (c.update) c.update(dt, clock);
      const cz = c.mesh.position.z;
      if (cz > 12) { scene.remove(c.mesh); collectibles.splice(i, 1); continue; }
      if (!c.got && c.lane === lane && Math.abs(cz) < 1.15 && py < 2.2) {
        c.got = true; scene.remove(c.mesh); collectibles.splice(i, 1);
        if (c.type === 'saiSin') {
          activateSaiSinShield();
        } else {
          activateKrahangFlight();
        }
      }
    }

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i]; o.mesh.position.z += dz;
      if (o.update) o.update(dt, clock);
      const oz = o.mesh.position.z;
      if (oz > 12) { scene.remove(o.mesh); obstacles.splice(i, 1); continue; }
      if (!o.hit && o.lane === lane && Math.abs(oz) < o.depth / 2 + 0.35 && invuln <= 0) {
        let hit = false;
        if (o.type === 'low') hit = py < 0.85;
        else if (o.type === 'high') hit = slideT <= 0 && py < 2.5;
        else if (o.type === 'ghost') hit = py < 2.3;
        else hit = py < 2.3;
        if (hit) {
          if (hasSaiSin) {
            consumeSaiSinShield(o);
          } else {
            o.hit = true; invuln = 1.4; stumble = 0.95; shake = 0.85;
            gap -= 2.8;
          if (o.type === 'ghost') {
            sfx.ghostScare();
            ui.flash.style.transition = 'none'; ui.flash.style.opacity = 0.65;
            if (o.ghostObj) {
              o.ghostObj.human.group.position.z += 0.8;
              o.ghostObj.human.group.scale.multiplyScalar(1.22);
            }
          } else {
            sfx.hit();
            ui.flash.style.transition = 'none'; ui.flash.style.opacity = 0.35;
          }
          requestAnimationFrame(() => { ui.flash.style.transition = 'opacity .4s'; ui.flash.style.opacity = 0; });
          }
        }
      }
      if (o.type === 'ghost' && !o.hit && !o.passed && oz > 1.2) {
        o.passed = true;
        sfx.ghostPass();
        if (o.ghostObj && o.ghostObj.human && o.ghostObj.human.head) {
          o.ghostObj.human.head.rotation.y = (lane - o.lane) * 0.45;
        }
      }
    }
    // offerings
    for (let i = offerings.length - 1; i >= 0; i--) {
      const o = offerings[i]; o.mesh.position.z += dz; o.mesh.rotation.y += dt * 3;
      const oz = o.mesh.position.z;
      if (oz > 12) { scene.remove(o.mesh); offerings.splice(i, 1); continue; }
      const isSky = o.mesh.position.y > 3.0;
      if (isSky && o.lane === lane && Math.abs(oz) < 4.2) {
        o.mesh.position.y += (py - o.mesh.position.y) * Math.min(1, dt * 8.0);
      }
      const yClose = isSky ? Math.abs(py - o.mesh.position.y) < 2.5 : (py < 2.2 && !(slideT > 0 && o.mesh.position.y > 1.2));
      const catchRadius = isSky ? 1.5 : 1.05;
      if (!o.got && o.lane === lane && Math.abs(oz) < catchRadius && yClose) {
        o.got = true; scene.remove(o.mesh); offerings.splice(i, 1);
        offerCount++; gap = Math.min(GHOST_MAX_GAP, gap + 0.65); sfx.coin();
      }
    }
    for (let i = decor.length - 1; i >= 0; i--) {
      decor[i].position.z += dz;
      if (decor[i].userData && decor[i].userData.update) decor[i].userData.update(dt, clock);
      if (decor[i].position.z > 14) { scene.remove(decor[i]); decor.splice(i, 1); }
    }

    // heartbeat
    hbTimer -= dt;
    if (hbTimer <= 0) { sfx.beat(); hbTimer = 0.35 + Math.min(1, Math.max(0, (gap - 2) / 14)) * 0.8; }

    if (gap <= CATCH_GAP && flyT <= 0 && !isGlidingDown && landingGrace <= 0) die();
  } else if (state === 'dead') {
    deadT += dt;
    const k = Math.min(1, deadT / 0.5);
    gap = CATCH_GAP + (1 - k) * 0;           // ghost lunges to the camera
    if (deadT < 1.0) shake = Math.max(shake, 1.4);
    // After 1.6s of fullscreen Tan face, transition to show retry & menu buttons!
    if (deadT >= 1.6 && !ui.over.classList.contains('ready')) {
      showDeathButtons();
    }
    if (deadT > 0.05) ui.flash.style.opacity = Math.max(0, ui.flash.style.opacity - dt * 2);
  } else {
    // menu: Subway Surfers-style shrine prayer intro (world stands still until player taps Start)
    gap = GHOST_START_GAP;
  }

  // ----- player pose
  if (state === 'menu') {
    playerRoot.position.set(0.68, 0, 0.65);
    playerRoot.rotation.set(0, 0, 0);
  } else {
    playerRoot.position.set(px, py, 0);
  }
  animateRunner(dt, state === 'play');
  if (hasSaiSin) {
    ringA.rotation.z += dt * 3.2;
    ringA.rotation.x += dt * 1.8;
    ringB.rotation.z -= dt * 2.8;
    ringB.rotation.y += dt * 2.2;
    shieldDome.scale.setScalar(1.0 + Math.sin(clock * 5.0) * 0.04);
  }
  if (state === 'play') {
    const blink = invuln > 0 && flyT <= 0 && !isGlidingDown && Math.floor(clock * 20) % 2 === 0;
    player.group.visible = !blink;
  } else if (state === 'dead') {
    if (!player.mixer) playerRoot.rotation.x = Math.min(1.4, deadT * 4) * -1;      // fallback collapses forward
    playerRoot.position.y = 0;
    player.group.visible = true;
  } else player.group.visible = true;

  // ----- ghost pose
  const flick = 0.93 + Math.sin(clock * 23) * 0.04 + (Math.random() < 0.04 ? -0.25 : 0);
  ghost.mats.forEach((m) => { m.opacity = flick; });
  if (state === 'menu') {
    // Ghost Tan stands clearly beside the left of ศาลเจ้าพ่อตาล without clipping into the shrine!
    ghostRoot.position.set(-3.45 + Math.sin(clock * 1.4) * 0.08, 0.24 + Math.sin(clock * 2.6) * 0.10, 0.65);
    ghostRoot.rotation.z = -0.08 + Math.sin(clock * 1.8) * 0.04;
    ghost.group.rotation.set(-0.04, 0.72, 0);
    ghostRoot.scale.setScalar(1.15);
  } else {
    let targetGz = gap;
    if (state === 'dead') targetGz = 3.4;
    gz += (targetGz - gz) * Math.min(1, dt * (state === 'dead' ? 14 : 6.5));
    gx += (px - gx) * Math.min(1, dt * 6.0);
    const bob = 0.35 + Math.sin(clock * 4.5) * 0.22;
    ghostRoot.position.set(gx + Math.sin(clock * 2.0) * 0.45, bob, gz);
    ghostRoot.rotation.z = Math.sin(clock * 2.1) * 0.06;
    if (state === 'dead') {
      ghost.group.rotation.y += (0 - ghost.group.rotation.y) * Math.min(1, dt * 14);   // turn to face the player cam
      ghost.group.rotation.x += (-0.02 - ghost.group.rotation.x) * Math.min(1, dt * 10);
      const s = 1.3 + Math.min(1, deadT * 2) * 0.9; ghostRoot.scale.setScalar(s);
      ghostRoot.position.y = 0.8;
    } else {
      ghost.group.rotation.set(-0.14, Math.PI, 0);
      ghostRoot.scale.setScalar(1.3);
    }
  }
  ghost.update(dt, clock);
  ghostLight.position.set(ghostRoot.position.x, 2, ghostRoot.position.z - 1);
  ghostLight.intensity = 0.8 + Math.min(2.2, Math.max(0, (14 - gz) * 0.2));
  lantern.position.set(px, 3, 1.5);

  // ----- cameras
  const sh = shake > 0 ? shake : 0;
  const ox = (Math.random() - 0.5) * sh * 0.5, oy = (Math.random() - 0.5) * sh * 0.5;
  shake = Math.max(0, shake - dt * 2.2);
  const cx = px * 0.65;
  const introPos = { x: 2.15 + Math.sin(clock * 0.8) * 0.08, y: 2.35 + Math.cos(clock * 0.9) * 0.05, z: 3.95 };
  const introLook = { x: -1.05, y: 1.85, z: -0.05 };
  if (state === 'menu') {
    mainCam.position.set(introPos.x, introPos.y, introPos.z);
    mainCam.lookAt(introLook.x, introLook.y, introLook.z);
  } else {
    // smooth Subway Surfers camera swoop from shrine intro to chase view over first 0.65s
    const u = state === 'play' ? Math.min(1, tPlay / 0.65) : 1;
    const e = 1 - Math.pow(1 - u, 3);
    const isHigh = py > 2.0;
    const camY = isHigh ? py + 2.2 : 4.0 + oy + py;
    const camZ = isHigh ? 6.2 : 6.8;
    const lookY = isHigh ? py + 0.8 : 1.5 + py;
    const lookZ = isHigh ? -16.0 : -9.0;
    const tx = cx + ox, ty = camY, tz = camZ;
    const lx = cx, ly = lookY, lz = lookZ;
    mainCam.position.set(
      introPos.x + (tx - introPos.x) * e,
      introPos.y + (ty - introPos.y) * e,
      introPos.z + (tz - introPos.z) * e
    );
    mainCam.lookAt(
      introLook.x + (lx - introLook.x) * e,
      introLook.y + (ly - introLook.y) * e,
      introLook.z + (lz - introLook.z) * e
    );
  }
  const isHigh = py > 2.0;
  if (isHigh) {
    pipCam.position.set(px * 0.8 + 0.85, py + 1.2, -4.2);
    pipCam.lookAt(px, py + 0.6, 4.0);
  } else {
    pipCam.position.set(px * 0.9 + 1.05 + ox * 0.3, 2.35 + oy * 0.3, -3.6);
    pipCam.lookAt(px + 0.15, 2.15, 5.2);
  }

  // ----- HUD
  if (state === 'play') {
    const curM = Math.floor(dist);
    ui.score.textContent = curM;
    if (curM > best) { best = curM; localStorage.setItem('tanGhostBest', best); }
    if (ui.hudBest) ui.hudBest.textContent = best;
    ui.offerN.textContent = offerCount;
    const r = Math.max(0, Math.min(1, (gap - CATCH_GAP) / (GHOST_MAX_GAP - CATCH_GAP)));
    ui.bar.style.width = (r * 100).toFixed(1) + '%';
    ui.bar.style.background = r < 0.3 ? 'linear-gradient(90deg,#ff2b4a,#ff7a3a)'
      : r < 0.6 ? 'linear-gradient(90deg,#ffb52b,#ffdd55)' : 'linear-gradient(90deg,#42e695,#3bb2b8)';
    ui.pip.classList.toggle('danger', gap < 3.8);
  }
  const danger = state === 'dead' ? 1 : state === 'play' ? Math.max(0, Math.min(0.9, (4.8 - gap) / 3.2)) : 0;
  ui.vig.style.opacity = danger.toFixed(2);
}

// ============================================================ render
let W = 0, H = 0, pipRect = { x: 0, y: 0, w: 0, h: 0 };
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H, false);
  mainCam.aspect = W / H; mainCam.fov = W / H < 0.8 ? 74 : 62; mainCam.updateProjectionMatrix();
  const pw = Math.round(Math.max(180, Math.min(410, W * 0.33)));
  const ph = Math.round(pw * 0.75);
  const margin = 14;
  pipRect = { x: W - pw - margin, y: margin, w: pw, h: ph };   // y measured from top
  Object.assign(ui.pip.style, { left: pipRect.x + 'px', top: pipRect.y + 'px', width: pw + 'px', height: ph + 'px' });
  pipCam.aspect = pw / ph; pipCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

function render() {
  // show ghost in main camera during the menu shrine intro and on jumpscare; hide while running so its back doesn't block the track
  ghostRoot.visible = (state !== 'play');
  renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
  renderer.render(scene, mainCam);
  ghostRoot.visible = true;
  if (ui.pip.style.display === 'block') {
    const b = 2;   // keep inside the CSS border
    const x = pipRect.x + b, w = pipRect.w - b * 2;
    const y = H - pipRect.y - pipRect.h + b, h = pipRect.h - b * 2;   // GL origin is bottom-left
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
    renderer.render(scene, pipCam);
  }
}

let last = performance.now();
function loop(now) {
  const dt = paused ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}
reset();
requestAnimationFrame(loop);
})();
