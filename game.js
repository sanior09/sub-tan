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
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 768);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio || 1, 1.35) : Math.min(window.devicePixelRatio || 1, 2));
renderer.setScissorTest(true);

const scene = new THREE.Scene();
const FOG_COLOR = 0x070914;
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, 22, 90);

const mainCam = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
const pipCam = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 200);

const hemiLight = new THREE.HemisphereLight(0x7080c0, 0x20121a, 0.95);
scene.add(hemiLight);
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
  fantaPlane: new THREE.PlaneGeometry(0.75, 1.45),
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
const fantaTex = (() => {
  const t = new THREE.Texture();
  const im = new Image();
  im.onload = () => { t.image = im; t.needsUpdate = true; };
  im.src = (window.FANTA_PNG || 'Image/fanta.png');
  const icon = document.getElementById('fantaHudIcon');
  if (icon) icon.src = (window.FANTA_PNG || 'Image/fanta.png');
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
  bamboo: new THREE.MeshLambertMaterial({ color: 0x246638 }),
  bambooLeaf: new THREE.MeshLambertMaterial({ color: 0x154724 }),
  ghostOrb: new THREE.MeshBasicMaterial({ color: 0x34d399, fog: false }),
  shackWall: new THREE.MeshLambertMaterial({ color: 0x3d2a22 }),
  rust: new THREE.MeshLambertMaterial({ color: 0x542c20 }),
  dimGlow: new THREE.MeshBasicMaterial({ color: 0xff4520 }),
  templeWall: new THREE.MeshLambertMaterial({ color: 0xc8bfa8 }),
  templeRoof: new THREE.MeshLambertMaterial({ color: 0x9e2a1c }),
  whiteCloth: new THREE.MeshLambertMaterial({ color: 0xdadcd8 }),
  garlandPic: new THREE.MeshBasicMaterial({
    map: garlandTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, fog: false }),
  fantaPic: new THREE.MeshBasicMaterial({
    map: fantaTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, fog: false }),
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

// ============================================================ biomes & ground
const GROUND_LEN = 190, BRANCH_LEN = 115, CELL = 8;

function makeBiomeTextures(id) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  if (id === 'forest') {
    x.fillStyle = '#141e14'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? '#182617' : '#101a11'; x.fillRect(0, i * 32, 256, 30);
    }
    // mossy green borders & dirt path speckles
    x.fillStyle = 'rgba(34,139,74,.28)';
    x.fillRect(0, 0, 14, 256); x.fillRect(242, 0, 14, 256);
    x.fillStyle = 'rgba(110,231,183,.22)';
    x.fillRect(256 / 3 - 2, 0, 4, 256); x.fillRect(512 / 3 - 2, 0, 4, 256);
  } else if (id === 'abandoned') {
    x.fillStyle = '#201b1e'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? '#272023' : '#1a1518'; x.fillRect(0, i * 32, 256, 30);
    }
    // dark cracks & faded hazard strips
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(24, 18); x.lineTo(75, 86); x.lineTo(48, 170); x.stroke();
    x.beginPath(); x.moveTo(210, 40); x.lineTo(175, 130); x.lineTo(222, 220); x.stroke();
    x.fillStyle = 'rgba(248,113,113,.22)';
    for (let i = 0; i < 4; i++) {
      x.fillRect(256 / 3 - 2, i * 64 + 8, 4, 34);
      x.fillRect(512 / 3 - 2, i * 64 + 8, 4, 34);
    }
  } else if (id === 'temple') {
    x.fillStyle = '#251a10'; x.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        x.fillStyle = (row + col) % 2 ? '#2e2115' : '#21170d';
        x.fillRect(col * 42.6 + 1, row * 32 + 1, 40.6, 30);
      }
    }
    x.fillStyle = 'rgba(253,224,71,.28)';
    x.fillRect(256 / 3 - 2, 0, 4, 256); x.fillRect(512 / 3 - 2, 0, 4, 256);
  } else {
    // default shrine alley
    x.fillStyle = '#1b1a22'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? '#201e28' : '#17161e'; x.fillRect(0, i * 32, 256, 30);
    }
    x.fillStyle = 'rgba(200,190,255,.22)';
    x.fillRect(256 / 3 - 2, 0, 4, 256); x.fillRect(512 / 3 - 2, 0, 4, 256);
  }

  const roadTex = new THREE.CanvasTexture(c);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.anisotropy = 4;
  roadTex.repeat.set(1, GROUND_LEN / CELL);

  const branchTex = new THREE.CanvasTexture(c);
  branchTex.wrapS = branchTex.wrapT = THREE.RepeatWrapping;
  branchTex.anisotropy = 4;
  branchTex.repeat.set(1, BRANCH_LEN / CELL);

  return { roadTex, branchMat: new THREE.MeshLambertMaterial({ map: branchTex }) };
}

const BIOMES = {
  shrine: {
    id: 'shrine', name: 'ซอยศาลเจ้าพ่อ', icon: '🏮', accent: '#c4b5fd',
    fog: 0x070914, hemiSky: 0x7080c0, hemiGnd: 0x20121a, moon: 0xa0b4ff, sideCol: 0x0b1410,
    ...makeBiomeTextures('shrine')
  },
  forest: {
    id: 'forest', name: 'ป่าช้าหลอน', icon: '🌲', accent: '#4ade80',
    fog: 0x05140c, hemiSky: 0x4ca870, hemiGnd: 0x0e2014, moon: 0x76f5aa, sideCol: 0x06190d,
    ...makeBiomeTextures('forest')
  },
  abandoned: {
    id: 'abandoned', name: 'ซอยบ้านร้าง', icon: '🏚️', accent: '#f87171',
    fog: 0x16090c, hemiSky: 0xb06870, hemiGnd: 0x1e0e10, moon: 0xffa090, sideCol: 0x150a0c,
    ...makeBiomeTextures('abandoned')
  },
  temple: {
    id: 'temple', name: 'ลานวัดเก่า', icon: '⛩️', accent: '#facc15',
    fog: 0x140e04, hemiSky: 0xc89a4a, hemiGnd: 0x241808, moon: 0xffe28a, sideCol: 0x181106,
    ...makeBiomeTextures('temple')
  }
};
const BIOME_LIST = [BIOMES.shrine, BIOMES.forest, BIOMES.abandoned, BIOMES.temple];
let currentBiome = BIOMES.shrine;
const biomeClr = {
  fog: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGnd: new THREE.Color(),
  moon: new THREE.Color(),
  sideCol: new THREE.Color(),
};

const groundMat = new THREE.MeshLambertMaterial({ map: BIOMES.shrine.roadTex });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3, GROUND_LEN), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -GROUND_LEN / 2 + 12);
scene.add(ground);

const sideGroundMat = new THREE.MeshLambertMaterial({ color: BIOMES.shrine.sideCol });
const sideGround = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), sideGroundMat);
sideGround.rotation.x = -Math.PI / 2; sideGround.position.set(0, -0.02, -65);
scene.add(sideGround);

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
function makeBambooClump() {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; g.add(sh);
  const stalks = [
    { x: -0.35, z: 0.1, h: 5.2, rx: 0.06, rz: 0.09 },
    { x: 0.25, z: -0.15, h: 5.8, rx: -0.05, rz: -0.07 },
    { x: 0.0, z: 0.3, h: 4.4, rx: 0.08, rz: -0.04 },
    { x: -0.2, z: -0.3, h: 4.9, rx: -0.04, rz: 0.06 },
  ];
  stalks.forEach((s) => {
    const p = mk(GEO.cyl, MAT.bamboo, 0.08, s.h, 0.08, s.x, s.h * 0.5, s.z);
    p.rotation.set(s.rx, 0, s.rz);
    g.add(p);
    const lf = mk(GEO.cone, MAT.bambooLeaf, 0.55, 1.3, 0.55, s.x - s.rz * s.h * 0.4, s.h - 0.5, s.z + s.rx * s.h * 0.4);
    g.add(lf);
  });
  return g;
}

function makeTombstone() {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; g.add(sh);
  g.add(mk(GEO.cyl, MAT.leaf, 0.95, 0.28, 1.15, 0, 0.14, 0));
  const post = mk(GEO.box, MAT.stone, 0.48, 1.25, 0.22, 0, 0.72, -0.15);
  post.rotation.z = (Math.random() - 0.5) * 0.14;
  g.add(post);
  g.add(mk(GEO.box, MAT.whiteCloth, 0.54, 0.16, 0.26, 0, 0.86, -0.15));
  g.add(mk(GEO.pyr, MAT.stone, 0.35, 0.45, 0.35, 0, 1.48, -0.15));
  return g;
}

function makeGhostOrbPost() {
  const g = new THREE.Group();
  g.add(mk(GEO.cyl, MAT.bamboo, 0.05, 1.9, 0.05, 0, 0.95, 0));
  const orb = mk(GEO.sph, MAT.ghostOrb, 0.22, 0.22, 0.22, 0, 2.25, 0);
  g.add(orb);
  const halo = new THREE.Sprite(SCENERY_MAT.candleHaloMat);
  halo.scale.set(1.8, 1.8, 1);
  halo.position.set(0, 2.25, 0);
  g.add(halo);
  return g;
}

function makeAbandonedHouse(side) {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; g.add(sh);
  // wooden stilts
  [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].forEach(([px, pz]) => {
    g.add(mk(GEO.box, MAT.darkwood, 0.18, 1.1, 0.18, px, 0.55, pz));
  });
  // shack cabin tilted slightly for creepy ruined feel
  const cabin = new THREE.Group();
  cabin.rotation.z = (side || 1) * -0.035;
  cabin.add(mk(GEO.box, MAT.shackWall, 3.0, 2.1, 2.6, 0, 2.05, 0));
  // rusty corrugated tin gable roof
  const roofL = mk(GEO.box, MAT.rust, 1.9, 0.1, 3.1, -0.78, 3.38, 0);
  roofL.rotation.z = 0.38; cabin.add(roofL);
  const roofR = mk(GEO.box, MAT.rust, 1.9, 0.1, 3.1, 0.78, 3.38, 0);
  roofR.rotation.z = -0.38; cabin.add(roofR);
  // crooked dim glowing window facing the road
  const wx = side > 0 ? -1.52 : 1.52;
  const win = mk(GEO.box, MAT.dimGlow, 0.08, 0.58, 0.58, wx, 2.15, 0.35);
  win.rotation.x = 0.09;
  cabin.add(win);
  g.add(cabin);
  return g;
}

function makeBrokenFence() {
  const g = new THREE.Group();
  [-0.9, 0, 0.9].forEach((pz, i) => {
    const p = mk(GEO.box, MAT.darkwood, 0.14, 1.35, 0.14, 0, 0.65, pz);
    p.rotation.z = (i % 2 ? 0.15 : -0.12);
    g.add(p);
  });
  const plank = mk(GEO.box, MAT.wood, 0.08, 0.22, 2.3, 0.05, 0.9, 0);
  plank.rotation.x = 0.18;
  g.add(plank);
  return g;
}

function makeRustyLamp() {
  const g = new THREE.Group();
  const pole = mk(GEO.cyl, MAT.rust, 0.07, 3.8, 0.07, 0, 1.9, 0);
  pole.rotation.z = 0.08;
  g.add(pole);
  g.add(mk(GEO.sph, MAT.dimGlow, 0.24, 0.28, 0.24, -0.16, 3.78, 0));
  return g;
}

function makeChedi() {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), SCENERY_MAT.shadowMat);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; g.add(sh);
  g.add(mk(GEO.box, MAT.stone, 2.5, 0.35, 2.5, 0, 0.18, 0));
  g.add(mk(GEO.box, MAT.stone, 2.0, 0.35, 2.0, 0, 0.52, 0));
  g.add(mk(GEO.cyl, MAT.gold, 0.85, 0.55, 0.85, 0, 0.95, 0));
  g.add(mk(GEO.sph, MAT.gold, 0.82, 0.95, 0.82, 0, 1.62, 0));
  g.add(mk(GEO.cone, MAT.gold, 0.42, 2.2, 0.42, 0, 3.1, 0));
  return g;
}

function makeTemplePillar() {
  const g = new THREE.Group();
  g.add(mk(GEO.box, MAT.templeWall, 0.45, 2.1, 2.2, 0, 1.05, 0));
  g.add(mk(GEO.box, MAT.templeRoof, 0.62, 0.24, 2.35, 0, 2.2, 0));
  g.add(mk(GEO.box, MAT.templeWall, 0.65, 2.8, 0.65, 0, 1.4, -1.1));
  g.add(mk(GEO.pyr, MAT.gold, 0.55, 0.85, 0.55, 0, 3.2, -1.1));
  const halo = new THREE.Sprite(SCENERY_MAT.candleHaloMat);
  halo.scale.set(1.8, 1.8, 1); halo.position.set(0, 3.3, -1.1); g.add(halo);
  return g;
}

function makeDecorForBiome(biomeId, side, step) {
  if (biomeId === 'forest') {
    if (step === 0 || step === 2) return { m: makeBambooClump(), off: LANE_W * 1.5 + 2.2 + Math.random() * 2.8 };
    if (step === 1) return { m: makeTree(side), off: LANE_W * 1.5 + 2.5 + Math.random() * 3.0 };
    if (step === 3) return { m: makeTombstone(), off: LANE_W * 1.5 + 1.8 + Math.random() * 1.8 };
    return { m: makeGhostOrbPost(), off: LANE_W * 1.5 + 1.3 };
  }
  if (biomeId === 'abandoned') {
    if (step === 0 || step === 3) return { m: makeAbandonedHouse(side), off: LANE_W * 1.5 + 3.4 + Math.random() * 1.8 };
    if (step === 1 || step === 2) return { m: makeBrokenFence(), off: LANE_W * 1.5 + 1.5 + Math.random() * 1.0 };
    return { m: makeRustyLamp(), off: LANE_W * 1.5 + 1.2 };
  }
  if (biomeId === 'temple') {
    if (step === 0 || step === 3) return { m: makeChedi(), off: LANE_W * 1.5 + 2.8 + Math.random() * 2.2 };
    if (step === 1) return { m: makeTemplePillar(), off: LANE_W * 1.5 + 1.7 + Math.random() * 0.8 };
    if (step === 2) return { m: makeTree(side), off: LANE_W * 1.5 + 2.6 + Math.random() * 2.8 };
    return { m: makeSpiritHouse(side), off: LANE_W * 1.5 + 1.8 + Math.random() * 1.5 };
  }
  // default shrine
  if (step === 0 || step === 2) return { m: makeTree(side), off: LANE_W * 1.5 + 2.4 + Math.random() * 3.2 };
  if (step === 1 || step === 3) return { m: makeSpiritHouse(side), off: LANE_W * 1.5 + 1.8 + Math.random() * 2.2 };
  return { m: makeLanternPost(), off: LANE_W * 1.5 + 1.2 };
}

const decor = [];
let sinceDecor = 0;
function spawnDecor(z) {
  [-1, 1].forEach((side) => {
    if (Math.random() < 0.16) return;
    const step = (decorSeq++) % 5;
    const { m, off } = makeDecorForBiome(currentBiome.id, side, step);
    m.position.set(side * off, 0, z + (Math.random() - 0.5) * 3.5);
    scene.add(m); decor.push(m);

    // Occasional spooky roadside spirit watcher
    if ((step === 1 || step === 3) && Math.random() < 0.22) {
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
  if (fork.active || flyT > 0 || isGlidingDown) {
    // Do not spawn ground obstacles during flight, descent, or crossroads junctions
    rowSpacing = speed * 1.4;
    return;
  }
  if (sinceFork >= nextForkDist && dist > 65 && landingGrace <= 0) {
    spawnFork();
    rowSpacing = speed * 1.0;
    return;
  }
  const z = SPAWN_Z;
  const isPowerupRow = sincePowerup >= nextPowerupDist && dist > 35 && flyT <= 0 && !isGlidingDown;
  if (isPowerupRow) {
    const pType = drawNextPowerupType();
    if (pType) {
      sincePowerup = 0;
      nextPowerupDist = 60 + Math.random() * 65; // 60m - 125m randomized spacing
      spawnPowerupRow(pType, z);
      rowSpacing = speed * (0.9 + Math.random() * 0.35);
      return;
    }
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
  fantaPickup: () => {
    noise(0.12, 0.28, 2200);
    tone(523.25, 0.12, 'sine', 0.25, 80);
    setTimeout(() => tone(659.25, 0.12, 'sine', 0.28, 100), 70);
    setTimeout(() => tone(783.99, 0.14, 'sine', 0.30, 120), 140);
    setTimeout(() => tone(1046.5, 0.22, 'triangle', 0.32, 160), 210);
  },
  fantaSmash: () => {
    noise(0.35, 0.40, 1200);
    tone(180, 0.25, 'triangle', 0.35, -120);
    tone(90, 0.30, 'sawtooth', 0.28, -60);
  },
  fantaExpire: () => {
    tone(587.33, 0.18, 'sine', 0.18, -140);
    setTimeout(() => tone(392.00, 0.24, 'sine', 0.14, -100), 90);
  },
  saiSinExpire: () => {
    tone(440, 0.20, 'sine', 0.15, -160);
    setTimeout(() => tone(293.66, 0.24, 'sine', 0.12, -80), 80);
  },
  turn: () => {
    noise(0.18, 0.22, 950);
    tone(360, 0.14, 'triangle', 0.18, 260);
  },
};

// ============================================================ game state
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), hudBest: $('hudBest'), offerN: $('offerN'), bar: $('barfill'), hint: $('hint'),
  pip: $('pip'), vig: $('vig'), flash: $('flash'), menu: $('menu'), over: $('over'),
  pauseOverlay: $('pauseOverlay'), pauseBtn: $('pauseBtn'),
  powerupTray: $('powerupTray'),
  krahangBadge: $('krahangBadge'), krahangBarFill: $('krahangBarFill'), krahangTimerText: $('krahangTimerText'),
  saiSinBadge: $('saiSinBadge'), saiSinBarFill: $('saiSinBarFill'), saiSinTimerText: $('saiSinTimerText'),
  fantaBadge: $('fantaBadge'), fantaBarFill: $('fantaBarFill'), fantaTimerText: $('fantaTimerText'),
  forkBanner: $('forkBanner'), forkLeftCard: $('forkLeftCard'), forkRightCard: $('forkRightCard'), biomeToast: $('biomeToast'),
  fScore: $('fScore'), fOffer: $('fOffer'), fBest: $('fBest'),
  menuLbBtn: $('menuLbBtn'), overLbBtn: $('overLbBtn'),
  lbModal: $('lbModal'), lbCloseBtn: $('lbCloseBtn'), lbRefreshBtn: $('lbRefreshBtn'),
  lbStatus: $('lbStatus'), lbList: $('lbList'), lbMyRank: $('lbMyRank'),
  menuNickBox: $('menuNickBox'), menuNickSaved: $('menuNickSaved'), menuNickDisplay: $('menuNickDisplay'),
  menuNickEditBtn: $('menuNickEditBtn'), menuNickForm: $('menuNickForm'),
  menuNickInput: $('menuNickInput'), menuNickSaveBtn: $('menuNickSaveBtn'), menuNickHint: $('menuNickHint'),
  lbAutoStatus: $('lbAutoStatus'),
};

// ============================================================ collectibles (🪽 กระด้ง & 🧵 สายสิญจน์มงคล & 🥤 น้ำแดง)
const collectibles = [];
const MAX_SAISIN_T = 10.0;
let hasSaiSin = false;
let saiSinT = 0;

const MAX_FANTA_T = 7.5;
let hasFanta = false;
let fantaT = 0;

let sincePowerup = 0, nextPowerupDist = 50 + Math.random() * 55;
let powerupBag = [];
let lastPowerupType = null;

function refillPowerupBag() {
  powerupBag = ['saiSin', 'fanta', 'krahang'];
  for (let i = powerupBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [powerupBag[i], powerupBag[j]] = [powerupBag[j], powerupBag[i]];
  }
  // Prevent consecutive repeat across shuffle-bag boundaries
  if (lastPowerupType && powerupBag[0] === lastPowerupType && powerupBag.length > 1) {
    const swapIdx = 1 + Math.floor(Math.random() * (powerupBag.length - 1));
    [powerupBag[0], powerupBag[swapIdx]] = [powerupBag[swapIdx], powerupBag[0]];
  }
}

function drawNextPowerupType() {
  if (!powerupBag.length) refillPowerupBag();
  const isEligible = (t) => (
    t === 'krahang' ||
    (t === 'saiSin' && !hasSaiSin) ||
    (t === 'fanta' && !hasFanta)
  );
  let idx = powerupBag.findIndex(isEligible);
  if (idx === -1) {
    refillPowerupBag();
    idx = powerupBag.findIndex(isEligible);
    if (idx === -1) return null;
  }
  const [picked] = powerupBag.splice(idx, 1);
  lastPowerupType = picked;
  return picked;
}

function spawnPowerupRow(type, z) {
  const spawners = {
    krahang: spawnKrahangItem,
    saiSin: spawnSaiSinItem,
    fanta: spawnFantaItem,
  };
  const spawnFn = spawners[type];
  if (!spawnFn) return;

  const itemLane = Math.floor(Math.random() * 3);
  const itemZ = z + (Math.random() - 0.5) * 3.0;
  spawnFn(itemLane, itemZ);

  // Randomize surrounding obstacle layout so power-ups don't share one repetitive pattern
  const otherLanes = [0, 1, 2].filter((l) => l !== itemLane);
  const guardStyle = Math.floor(Math.random() * 4);
  if (guardStyle === 0) {
    otherLanes.forEach((l) => {
      if (Math.random() < 0.65) spawnObstacle(l, pick(TYPES), z);
    });
  } else if (guardStyle === 1) {
    const l0 = otherLanes[Math.floor(Math.random() * 2)];
    spawnObstacle(l0, Math.random() < 0.5 ? 'block' : 'high', z);
  } else if (guardStyle === 2) {
    const l0 = otherLanes[Math.floor(Math.random() * 2)];
    spawnObstacle(l0, pick(TYPES), z + (Math.random() < 0.5 ? -3.2 : 3.2));
  }

  // Randomize garland trail pattern accompanying the power-up
  const zc = z + rowSpacing * 0.5;
  const trailStyle = Math.floor(Math.random() * 4);
  if (trailStyle === 0) {
    const half = 1 + Math.floor(Math.random() * 2);
    for (let i = -half; i <= half; i++) spawnOffering(itemLane, zc + i * 1.8, 1.0);
  } else if (trailStyle === 1) {
    const nextLane = itemLane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
    [-2, -1, 0, 1, 2].forEach((i, idx) => {
      spawnOffering(idx < 2 ? itemLane : nextLane, zc + i * 1.8, 1.0);
    });
  } else if (trailStyle === 2) {
    [-2, -1, 0, 1, 2].forEach((i) => {
      const arcY = 1.0 + Math.max(0, 1.2 - Math.abs(i) * 0.5);
      spawnOffering(itemLane, zc + i * 1.8, arcY);
    });
  } else {
    const altLane = otherLanes[Math.floor(Math.random() * 2)];
    for (let i = -1; i <= 2; i++) spawnOffering(altLane, zc + i * 1.8, 1.0);
  }
}

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

// 🥤 Fanta Red Nitro Dash: Pure Orange Speed Streaks (เส้นสปีดไลน์สีส้มล้วนๆ)
const fantaAuraGroup = new THREE.Group();

const fantaStreakMat = new THREE.MeshBasicMaterial({
  color: 0xff8800,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide
});
const fantaStreakBrightMat = new THREE.MeshBasicMaterial({
  color: 0xffaa22,
  transparent: true,
  opacity: 0.92,
  side: THREE.DoubleSide
});

// 6 razor-sharp orange speed lines streaming backwards along flanks
const streakConfigs = [
  { x: -0.32, y: 0.85, z: 1.4, len: 2.8, w: 0.045, mat: fantaStreakBrightMat },
  { x:  0.32, y: 0.85, z: 1.4, len: 2.8, w: 0.045, mat: fantaStreakBrightMat },
  { x: -0.22, y: 0.40, z: 1.2, len: 2.4, w: 0.040, mat: fantaStreakMat },
  { x:  0.22, y: 0.40, z: 1.2, len: 2.4, w: 0.040, mat: fantaStreakMat },
  { x: -0.42, y: 0.65, z: 1.6, len: 3.0, w: 0.035, mat: fantaStreakMat },
  { x:  0.42, y: 0.65, z: 1.6, len: 3.0, w: 0.035, mat: fantaStreakMat },
];

const fantaStreaks = streakConfigs.map((cfg) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.len), cfg.mat);
  m.rotation.x = -Math.PI * 0.5;
  m.position.set(cfg.x, cfg.y, cfg.z);
  fantaAuraGroup.add(m);
  return { mesh: m, baseZ: cfg.z, len: cfg.len };
});

fantaAuraGroup.position.set(0, 0, 0);
fantaAuraGroup.visible = false;
playerRoot.add(fantaAuraGroup);

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

  // Emissive pearl and glow ring provide lighting with zero shader churn

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

function spawnFantaItem(lane, z) {
  const g = new THREE.Group();

  // Authentic Real-world Fanta Red Bottle (Dual Cross-Quads for true 3D appearance from all viewing angles!)
  const bottleA = new THREE.Mesh(GEO.fantaPlane, MAT.fantaPic);
  bottleA.position.y = 0.08;
  g.add(bottleA);

  const bottleB = new THREE.Mesh(GEO.fantaPlane, MAT.fantaPic);
  bottleB.rotation.y = Math.PI * 0.5;
  bottleB.position.y = 0.08;
  g.add(bottleB);

  // Ground crimson pulse ring
  const ringGeo = new THREE.RingGeometry(0.42, 0.65, 28);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = -0.55;
  g.add(groundRing);

  // Sprite and glow ring provide lighting with zero shader churn

  g.position.set((lane - 1) * LANE_W, 1.05, z);
  scene.add(g);
  collectibles.push({
    mesh: g,
    lane,
    type: 'fanta',
    got: false,
    update: (dt, clk) => {
      g.rotation.y += dt * 3.2;
      g.position.y = 1.05 + Math.sin(clk * 4.8) * 0.15;
      groundRing.scale.setScalar(0.92 + Math.sin(clk * 5.2) * 0.12);
    }
  });
}

function activateFantaBoost() {
  hasFanta = true;
  fantaT = MAX_FANTA_T;
  fantaAuraGroup.visible = true;
  sincePowerup = 0;
  sfx.fantaPickup();
  if (ui.fantaBadge) {
    ui.fantaBadge.style.display = 'flex';
    if (ui.fantaBarFill) ui.fantaBarFill.style.width = '100%';
    if (ui.fantaTimerText) ui.fantaTimerText.textContent = `${Math.ceil(MAX_FANTA_T)}s`;
    ui.fantaBadge.classList.remove('warning');
  }
  // Intense fiery red screen flash
  ui.flash.style.transition = 'none';
  ui.flash.style.backgroundColor = 'rgba(239, 68, 68, 0.45)';
  ui.flash.style.opacity = 0.55;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .5s';
    ui.flash.style.opacity = 0;
    ui.flash.style.backgroundColor = '';
  });
}

function expireFantaBoost() {
  hasFanta = false;
  fantaT = 0;
  fantaAuraGroup.visible = false;
  if (ui.fantaBadge) { ui.fantaBadge.style.display = 'none'; ui.fantaBadge.classList.remove('warning'); }
  sfx.fantaExpire();
}

function ramObstacleWithFanta(o) {
  o.hit = true;
  sfx.fantaSmash();
  shake = Math.max(shake, 0.50);
  offerCount += 2;
  ui.offerN.textContent = offerCount;
  ui.flash.style.transition = 'none';
  ui.flash.style.backgroundColor = 'rgba(239, 68, 68, 0.42)';
  ui.flash.style.opacity = 0.48;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .35s';
    ui.flash.style.opacity = 0;
    ui.flash.style.backgroundColor = '';
  });
  scene.remove(o.mesh);
}

function activateSaiSinShield() {
  hasSaiSin = true;
  saiSinShieldGroup.visible = true;
  sincePowerup = 0;
  sfx.saiSinPickup();
  saiSinT = MAX_SAISIN_T;
  if (ui.saiSinBadge) {
    ui.saiSinBadge.style.display = 'flex';
    if (ui.saiSinBarFill) ui.saiSinBarFill.style.width = '100%';
    if (ui.saiSinTimerText) ui.saiSinTimerText.textContent = `${Math.ceil(MAX_SAISIN_T)}s`;
    ui.saiSinBadge.classList.remove('warning');
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
  if (ui.saiSinBadge) { ui.saiSinBadge.style.display = 'none'; ui.saiSinBadge.classList.remove('warning'); }
  sfx.saiSinExpire();
}

function consumeSaiSinShield(o) {
  saiSinT = 0;
  hasSaiSin = false;
  saiSinShieldGroup.visible = false;
  if (ui.saiSinBadge) { ui.saiSinBadge.style.display = 'none'; ui.saiSinBadge.classList.remove('warning'); }
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

  // Emissive gold ring provides lighting with zero shader churn

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
  if (fork.active && fork.state === 'approaching') clearFork();
  flyT = MAX_FLY_T;
  isGlidingDown = false;
  landingGrace = 0;
  invuln = MAX_FLY_T + 4.0;
  gap = GHOST_MAX_GAP;
  gz = GHOST_MAX_GAP;
  sincePowerup = 0;
  sfx.krahangPickup();
  if (player.setKrahangVisible) player.setKrahangVisible(true);
  if (ui.krahangBadge) {
    ui.krahangBadge.style.display = 'flex';
    if (ui.krahangBarFill) ui.krahangBarFill.style.width = '100%';
    if (ui.krahangTimerText) ui.krahangTimerText.textContent = `${Math.ceil(MAX_FLY_T)}s`;
    ui.krahangBadge.classList.remove('warning');
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
const NICK_STORAGE_KEY = 'tanNickname';
const BEST_MAP_STORAGE_KEY = 'tanBestByNick';
const LEGACY_BEST_KEY = 'tanGhostBest';

function normalizeNickKey(raw) {
  return String(raw || '').trim().toLowerCase();
}

function sanitizeNickname(raw) {
  return String(raw || '')
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(fuck|shit|bitch|asshole|cunt|dick)\b|เหี้ย|สัส|ควย|เย็ด|หี|แตด/gi, '***')
    .slice(0, 16)
    .trim();
}

function cleanNickname(raw) {
  return sanitizeNickname(raw) || 'ผู้แก้บนนิรนาม';
}

function getActiveNickname() {
  return sanitizeNickname(localStorage.getItem(NICK_STORAGE_KEY) || '');
}

function loadBestMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_MAP_STORAGE_KEY) || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

function loadNickBest(nick) {
  const key = normalizeNickKey(nick);
  if (!key) return +(localStorage.getItem(LEGACY_BEST_KEY) || 0);
  const map = loadBestMap();
  if (map[key] !== undefined) return Number(map[key]) || 0;
  return Object.keys(map).length === 0 ? +(localStorage.getItem(LEGACY_BEST_KEY) || 0) : 0;
}

function saveBestForActiveNick(val) {
  const n = Math.max(0, Math.floor(Number(val) || 0));
  const key = normalizeNickKey(getActiveNickname());
  if (key) {
    const map = loadBestMap();
    map[key] = Math.max(Number(map[key]) || 0, n);
    localStorage.setItem(BEST_MAP_STORAGE_KEY, JSON.stringify(map));
  }
  const legacy = +(localStorage.getItem(LEGACY_BEST_KEY) || 0);
  if (n > legacy) localStorage.setItem(LEGACY_BEST_KEY, n);
}

let best = loadNickBest(getActiveNickname());

// ============================================================ crossroads fork & biome transitions
let sinceFork = 0, nextForkDist = 115 + Math.random() * 45;
let biomeToastTimer = null;

const forkSignCanvas = document.createElement('canvas');
forkSignCanvas.width = 256; forkSignCanvas.height = 128;
const forkSignTex = new THREE.CanvasTexture(forkSignCanvas);
const forkSignMat = new THREE.MeshBasicMaterial({ map: forkSignTex, fog: false, side: THREE.DoubleSide });

function updateForkSignTexture(leftB, rightB) {
  const ctx = forkSignCanvas.getContext('2d');
  ctx.fillStyle = '#241812';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);

  // Top half: Left direction
  ctx.fillStyle = '#141928';
  ctx.fillRect(8, 8, 240, 52);
  ctx.strokeStyle = leftB.accent;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(8, 8, 240, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 21px Sarabun, Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`⬅ ${leftB.icon} ${leftB.name}`, 128, 34);

  // Bottom half: Right direction
  ctx.fillStyle = '#141928';
  ctx.fillRect(8, 68, 240, 52);
  ctx.strokeStyle = rightB.accent;
  ctx.strokeRect(8, 68, 240, 52);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${rightB.icon} ${rightB.name} ➡`, 128, 94);

  forkSignTex.needsUpdate = true;
}

const fork = {
  active: false,
  state: 'idle', // 'idle' | 'approaching' | 'turning'
  z: 0,
  leftBiome: null,
  rightBiome: null,
  chosenDir: 0, // -1 left, +1 right, 0 undecided
  turnT: 0,
  turnDur: 0.40,
  playerX: 0,
  playerZ: 0,
  turnYaw: 0,
  group: null,
  branchProps: [],
  branchOfferings: [],
};

function applyBiomeInstant(b) {
  currentBiome = b;
  scene.background.setHex(b.fog);
  scene.fog.color.setHex(b.fog);
  hemiLight.color.setHex(b.hemiSky);
  hemiLight.groundColor.setHex(b.hemiGnd);
  moon.color.setHex(b.moon);
  sideGroundMat.color.setHex(b.sideCol);
  groundMat.map = b.roadTex;
  groundMat.needsUpdate = true;
}

function showBiomeToast(b) {
  if (!ui.biomeToast) return;
  if (biomeToastTimer) { clearTimeout(biomeToastTimer); biomeToastTimer = null; }
  ui.biomeToast.textContent = `${b.icon} เข้าสู่โซน: ${b.name}`;
  ui.biomeToast.style.borderColor = b.accent;
  ui.biomeToast.style.color = b.accent;
  ui.biomeToast.style.display = 'flex';
  requestAnimationFrame(() => ui.biomeToast.classList.add('show'));
  biomeToastTimer = setTimeout(() => {
    ui.biomeToast.classList.remove('show');
    setTimeout(() => { if (!ui.biomeToast.classList.contains('show')) ui.biomeToast.style.display = 'none'; }, 320);
  }, 2400);
}

function clearFork() {
  if (fork.group) { scene.remove(fork.group); fork.group = null; }
  fork.active = false;
  fork.state = 'idle';
  fork.z = 0;
  fork.chosenDir = 0;
  fork.turnT = 0;
  fork.turnYaw = 0;
  fork.playerX = 0;
  fork.playerZ = 0;
  fork.branchProps = [];
  fork.branchOfferings = [];
  if (ui.forkBanner) ui.forkBanner.style.display = 'none';
  if (ui.forkLeftCard) ui.forkLeftCard.classList.remove('selected', 'dimmed');
  if (ui.forkRightCard) ui.forkRightCard.classList.remove('selected', 'dimmed');
}

function spawnFork() {
  if (fork.active) return;
  const pool = BIOME_LIST.filter((b) => b.id !== currentBiome.id);
  const leftBiome = pool[Math.floor(Math.random() * pool.length)];
  const pool2 = pool.filter((b) => b.id !== leftBiome.id);
  const rightBiome = pool2[Math.floor(Math.random() * pool2.length)];

  fork.active = true;
  fork.state = 'approaching';
  fork.z = SPAWN_Z;
  fork.leftBiome = leftBiome;
  fork.rightBiome = rightBiome;
  fork.chosenDir = 0;
  fork.turnT = 0;
  fork.turnYaw = 0;
  fork.playerX = 0;
  fork.playerZ = 0;
  fork.branchProps = [];
  fork.branchOfferings = [];

  sinceFork = 0;
  nextForkDist = 130 + Math.random() * 50;

  const g = new THREE.Group();
  const roadW = LANE_W * 3; // 7.2

  // 1. Center junction plaza tile + far ground mask behind dead-end
  const centerTile = new THREE.Mesh(new THREE.PlaneGeometry(roadW, roadW), currentBiome.branchMat);
  centerTile.rotation.x = -Math.PI / 2;
  centerTile.position.set(0, 0.005, 0);
  g.add(centerTile);

  const farMask = new THREE.Mesh(new THREE.PlaneGeometry(roadW + 1.2, 160), sideGroundMat);
  farMask.rotation.x = -Math.PI / 2;
  farMask.position.set(0, 0.006, -(roadW * 0.5 + 80));
  g.add(farMask);

  // 2. Left (-X) and Right (+X) branch roads with distinct biome textures
  [-1, 1].forEach((dir) => {
    const b = dir === -1 ? leftBiome : rightBiome;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, BRANCH_LEN), b.branchMat);
    road.rotation.order = 'YXZ';
    road.rotation.x = -Math.PI / 2;
    road.rotation.y = dir === -1 ? Math.PI / 2 : -Math.PI / 2;
    road.position.set(dir * (roadW * 0.5 + BRANCH_LEN * 0.5), 0.006, 0);
    g.add(road);

    // Populate branch roadside props from 11m to 101m along the branch
    for (let d = 11; d <= 101; d += 9) {
      [-1, 1].forEach((side) => {
        if (Math.random() < 0.14) return;
        const step = (decorSeq++) % 5;
        const { m, off } = makeDecorForBiome(b.id, side, step);
        m.position.set(dir * (d + (Math.random() - 0.5) * 2.5), 0, side * off);
        m.rotation.y = dir === -1 ? Math.PI / 2 : -Math.PI / 2;
        g.add(m);
        fork.branchProps.push({ mesh: m, branchDir: dir });
      });
    }

    // Reward garland strip leading down each branch
    for (let d = 12; d <= 24; d += 3) {
      const m = new THREE.Group();
      m.add(new THREE.Mesh(GEO.garlandPlane, MAT.garlandPic));
      m.position.set(dir * d, 1.0, 0);
      m.rotation.y = Math.PI / 2;
      g.add(m);
      fork.branchOfferings.push({ mesh: m, branchDir: dir, got: false });
    }
  });

  // 3. Dead-End Striped Barricade & Dual Directional Thai Signpost at z = -3.8
  g.add(mk(GEO.box, MAT.darkwood, 0.24, 1.4, 0.24, -2.9, 0.7, -3.7));
  g.add(mk(GEO.box, MAT.darkwood, 0.24, 1.4, 0.24,  2.9, 0.7, -3.7));
  g.add(mk(GEO.box, MAT.stripe, 6.4, 0.65, 0.24, 0, 1.05, -3.7));
  g.add(mk(GEO.sph, MAT.lamp, 0.22, 0.22, 0.22, -2.9, 1.52, -3.7));
  g.add(mk(GEO.sph, MAT.lamp, 0.22, 0.22, 0.22,  2.9, 1.52, -3.7));

  g.add(mk(GEO.cyl, MAT.darkwood, 0.14, 3.3, 0.14, 0, 1.65, -3.95));
  updateForkSignTexture(leftBiome, rightBiome);
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), forkSignMat);
  signBoard.position.set(0, 2.75, -3.82);
  g.add(signBoard);

  g.position.set(0, 0, fork.z);
  scene.add(g);
  fork.group = g;

  if (ui.forkLeftCard) ui.forkLeftCard.textContent = `⬅️ ${leftBiome.icon} ${leftBiome.name}`;
  if (ui.forkRightCard) ui.forkRightCard.textContent = `${rightBiome.icon} ${rightBiome.name} ➡️`;
  if (ui.forkLeftCard) ui.forkLeftCard.classList.remove('selected', 'dimmed');
  if (ui.forkRightCard) ui.forkRightCard.classList.remove('selected', 'dimmed');
}

function chooseFork(dir) {
  if (!fork.active || fork.state !== 'approaching') return;
  if (fork.z < -50) return;
  fork.chosenDir = dir;
  lane = dir < 0 ? 0 : 2;
  sfx.coin();
  if (ui.forkLeftCard && ui.forkRightCard) {
    ui.forkLeftCard.classList.toggle('selected', dir < 0);
    ui.forkLeftCard.classList.toggle('dimmed', dir > 0);
    ui.forkRightCard.classList.toggle('selected', dir > 0);
    ui.forkRightCard.classList.toggle('dimmed', dir < 0);
  }
  if (fork.z >= -6.0) {
    beginForkTurn(dir, false);
  }
}

function beginForkTurn(dir, crashed) {
  if (!fork.active || fork.state !== 'approaching') return;
  fork.state = 'turning';
  fork.chosenDir = dir;
  fork.turnT = 0;
  fork.playerX = px;
  fork.playerZ = 0;
  const chosenBiome = dir < 0 ? fork.leftBiome : fork.rightBiome;
  currentBiome = chosenBiome;
  if (ui.forkBanner) ui.forkBanner.style.display = 'none';
  if (!crashed) {
    sfx.turn();
    offerCount += 3;
    ui.offerN.textContent = offerCount;
    gap = Math.min(GHOST_MAX_GAP, gap + 0.5);
  }
}

function finishForkTurn() {
  if (!fork.active) return;
  const dir = fork.chosenDir;
  const refX = fork.playerX;
  const g = fork.group;

  // Swap road texture seamlessly
  groundMat.map = currentBiome.roadTex;
  groundMat.needsUpdate = true;
  currentBiome.roadTex.offset.y = -((Math.abs(refX) - LANE_W * 1.5) / CELL);

  // Clear old straight-road decor from previous biome
  decor.forEach((m) => scene.remove(m));
  decor.length = 0;

  // Rebase props on chosen branch into -Z straight world
  for (const bp of fork.branchProps) {
    if (bp.branchDir !== dir) continue;
    const rx = bp.mesh.position.x - refX;
    const rz = bp.mesh.position.z;
    const newZ = dir === -1 ? rx : -rx;
    const newX = dir === -1 ? -rz : rz;
    if (newZ > 10) continue;
    g.remove(bp.mesh);
    bp.mesh.position.set(newX, bp.mesh.position.y, newZ);
    bp.mesh.rotation.y += (dir === -1 ? -Math.PI / 2 : Math.PI / 2);
    scene.add(bp.mesh);
    decor.push(bp.mesh);
  }

  // Rebase uncollected branch garlands into -Z offerings
  for (const bo of fork.branchOfferings) {
    if (bo.branchDir !== dir || bo.got) continue;
    const rx = bo.mesh.position.x - refX;
    const rz = bo.mesh.position.z;
    const newZ = dir === -1 ? rx : -rx;
    const newX = dir === -1 ? -rz : rz;
    if (newZ > 8) continue;
    g.remove(bo.mesh);
    bo.mesh.position.set(newX, bo.mesh.position.y, newZ);
    scene.add(bo.mesh);
    offerings.push({ mesh: bo.mesh, lane: 1, got: false });
  }

  scene.remove(g);
  fork.group = null;
  fork.active = false;
  fork.state = 'idle';
  fork.turnYaw = 0;

  lane = 1;
  px = 0;
  playerRoot.rotation.set(0, 0, 0);
  playerRoot.position.set(0, py, 0);

  sinceFork = 0;
  sinceRow = 0;
  rowSpacing = speed * 1.0;
  sinceDecor = 0;

  showBiomeToast(currentBiome);
}

function clearWorld() {
  clearFork();
  [obstacles, offerings, collectibles].forEach((arr) => { arr.forEach((o) => scene.remove(o.mesh)); arr.length = 0; });
  decor.forEach((m) => scene.remove(m)); decor.length = 0;
}
function seedDecor() { for (let z = 8; z > SPAWN_Z; z -= 9) spawnDecor(z); }

function reset() {
  clearWorld();
  applyBiomeInstant(BIOMES.shrine);
  if (ui.biomeToast) { ui.biomeToast.classList.remove('show'); ui.biomeToast.style.display = 'none'; }
  sinceFork = 0; nextForkDist = 115 + Math.random() * 45;
  speed = 16; speedMul = 1; dist = 0; offerCount = 0; tPlay = 0;
  gap = gz = GHOST_START_GAP; gx = 0;
  lane = 1; px = 0; py = 0; vy = 0; slideT = 0; invuln = 0; stumble = 0; shake = 0; landingGrace = 0;
  flyT = 0; isGlidingDown = false;
  sincePowerup = 0; nextPowerupDist = 50 + Math.random() * 55; lastPowerupType = null; refillPowerupBag();
  hasSaiSin = false; saiSinT = 0; if (saiSinShieldGroup) saiSinShieldGroup.visible = false; if (ui.saiSinBadge) ui.saiSinBadge.style.display = 'none';
  hasFanta = false; fantaT = 0; if (fantaAuraGroup) fantaAuraGroup.visible = false; if (ui.fantaBadge) ui.fantaBadge.style.display = 'none';
  if (player && player.setKrahangVisible) player.setKrahangVisible(false);
  if (ui.krahangBadge) { ui.krahangBadge.style.display = 'none'; ui.krahangBadge.classList.remove('warning'); }
  if (ui.saiSinBadge) { ui.saiSinBadge.style.display = 'none'; ui.saiSinBadge.classList.remove('warning'); }
  if (ui.fantaBadge) { ui.fantaBadge.style.display = 'none'; ui.fantaBadge.classList.remove('warning'); }
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
  syncMenuNickUI(false);
}
window.triggerStart = () => {
  if (!getActiveNickname()) localStorage.setItem(NICK_STORAGE_KEY, 'ผู้ทดสอบ');
  best = loadNickBest(getActiveNickname());
  start();
};
window.triggerDie = die;
window.triggerSpawnGhost = (l, z) => spawnObstacle(l, 'ghost', z);
window.triggerSpawnKrahang = (l, z) => spawnKrahangItem(l, z);
window.triggerSpawnSaiSin = (l, z) => spawnSaiSinItem(l, z);
window.triggerSaiSin = () => activateSaiSinShield();
window.triggerSpawnFanta = (l, z) => spawnFantaItem(l, z);
window.triggerFanta = () => activateFantaBoost();
window.triggerFly = () => activateKrahangFlight();
window.triggerFork = () => spawnFork();
window.chooseFork = (d) => chooseFork(d);
window.debugPowerups = {
  draw: () => drawNextPowerupType(),
  spawnRow: (t, z) => spawnPowerupRow(t, z),
  reset: () => reset(),
  counts: () => ({ collectibles: collectibles.length, obstacles: obstacles.length, offerings: offerings.length })
};
window.getGameState = () => ({
  flyT, py, offerCount, state, gap, dist, deadT,
  hasSaiSin, saiSinT, hasFanta, fantaT,
  biome: currentBiome.id,
  forkActive: fork.active, forkState: fork.state, forkZ: fork.z
});
let deathTimer = null;
let lastRunDist = 0;
let lastRunOffers = 0;

// ============================================================ Global Leaderboard & Player Profile (Supabase REST + RPC)
function setMenuHint(text, color = '') {
  if (!ui.menuNickHint) return;
  ui.menuNickHint.textContent = text;
  ui.menuNickHint.style.color = color;
}

function setMenuNickMode(editing, prefill = '') {
  const saved = getActiveNickname();
  const showForm = editing || !saved;
  if (ui.menuNickSaved) ui.menuNickSaved.style.display = showForm ? 'none' : 'flex';
  if (ui.menuNickForm) ui.menuNickForm.style.display = showForm ? 'flex' : 'none';
  if (ui.menuNickDisplay && saved) ui.menuNickDisplay.textContent = saved;
  if (ui.menuNickInput && showForm) {
    ui.menuNickInput.value = prefill || saved || '';
    if (editing) {
      ui.menuNickInput.focus();
      ui.menuNickInput.select();
    }
  }
}

async function syncNickFromServer(nick) {
  const clean = sanitizeNickname(nick);
  if (!clean) return;
  const reqKey = normalizeNickKey(clean);
  if (ui.hudBest) ui.hudBest.textContent = best;
  if (!getLbConfig().ready) {
    setMenuHint(`✅ จำชื่อ "${clean}" บนเครื่องนี้แล้ว · สถิติบนเครื่อง ${best} ม.`, '#cfe8ff');
    return;
  }
  setMenuHint(`⏳ กำลังเช็กสถิติเดิมของ "${clean}"...`, '#ffe8a3');
  try {
    const res = await sbFetch('/rest/v1/rpc/get_player_rank', {
      method: 'POST',
      body: JSON.stringify({ p_nickname: clean }),
    });
    if (normalizeNickKey(getActiveNickname()) !== reqKey) return;
    if (res && res.found) {
      const remoteDist = Math.max(0, Math.floor(Number(res.distance) || 0));
      if (remoteDist > best) {
        best = remoteDist;
        saveBestForActiveNick(best);
      }
      if (ui.hudBest) ui.hudBest.textContent = best;
      const shownNick = cleanNickname(res.nickname || clean);
      setMenuHint(`🟢 พบสถิติเดิม "${shownNick}" · อันดับ #${res.rank} (สูงสุด ${Math.max(best, remoteDist)} ม.)`, '#9effc3');
    } else {
      setMenuHint(`✨ พร้อมวิ่งในนาม "${clean}" · เล่นจบระบบบันทึกอัตโนมัติ`, '#cfe8ff');
    }
  } catch (_) {
    if (normalizeNickKey(getActiveNickname()) !== reqKey) return;
    setMenuHint(`✅ จำชื่อ "${clean}" บนเครื่องนี้แล้ว (ซิงก์ออนไลน์ชั่วคราวไม่สำเร็จ)`, '#ffe8a3');
  }
}

function syncMenuNickUI(editing = false) {
  const saved = getActiveNickname();
  best = loadNickBest(saved);
  if (ui.hudBest) ui.hudBest.textContent = best;
  setMenuNickMode(editing);
  if (!saved) {
    setMenuHint('💡 ตั้งชื่อครั้งเดียว เครื่องนี้จะจำให้ตลอด และใช้ชื่อเดิมเล่นต่อข้ามเครื่องได้ครับ');
  } else if (!editing) {
    setMenuHint(`✅ จำชื่อ "${saved}" ไว้แล้ว · สถิติสูงสุด ${best} ม.`, '#9effc3');
  }
}

function saveNicknameFromInput(shouldSync = true) {
  const nick = sanitizeNickname(ui.menuNickInput ? ui.menuNickInput.value : '');
  if (!nick) {
    setMenuNickMode(true, '');
    setMenuHint('⚠️ กรุณาใส่ชื่อเล่นก่อนเริ่มวิ่ง (เช่น ตาล หรือ ชื่อเดิมจากอีกเครื่อง)', '#ff9ea9');
    if (ui.menuNickInput) ui.menuNickInput.focus();
    return '';
  }
  localStorage.setItem(NICK_STORAGE_KEY, nick);
  const loadedBest = loadNickBest(nick);
  const map = loadBestMap();
  const key = normalizeNickKey(nick);
  if (map[key] === undefined) {
    map[key] = loadedBest;
    localStorage.setItem(BEST_MAP_STORAGE_KEY, JSON.stringify(map));
  }
  best = loadedBest;
  if (ui.hudBest) ui.hudBest.textContent = best;
  setMenuNickMode(false);
  if (shouldSync) syncNickFromServer(nick);
  else setMenuHint(`✅ จำชื่อ "${nick}" ไว้แล้ว · เล่นจบระบบจะบันทึกให้ทันที`, '#9effc3');
  return nick;
}

function tryStartFromMenu() {
  if (state !== 'menu') {
    start();
    return;
  }
  const formOpen = ui.menuNickForm && ui.menuNickForm.style.display !== 'none';
  let nick = getActiveNickname();
  if (formOpen || !nick) {
    nick = saveNicknameFromInput(false);
    if (!nick) return;
  }
  start();
}

function getLbConfig() {
  const cfg = window.SUBTAN_LB_CONFIG || {};
  const url = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = String(cfg.supabaseAnonKey || '').trim();
  const table = String(cfg.table || 'leaderboard').trim() || 'leaderboard';
  return { url, key, table, ready: Boolean(url && key) };
}

async function sbFetch(path, opts = {}) {
  const cfg = getLbConfig();
  if (!cfg.ready) throw new Error('SUPABASE_NOT_CONFIGURED');
  const headers = {
    apikey: cfg.key,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (cfg.key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${cfg.key}`;
  }
  const res = await fetch(`${cfg.url}${path}`, {
    ...opts,
    headers,
  });
  const txt = await res.text();
  let data = null;
  if (txt) {
    try { data = JSON.parse(txt); } catch (_) { data = txt; }
  }
  if (!res.ok) {
    const msg = (data && data.message) ? data.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function renderLeaderboardRows(rows, myRankData) {
  if (!ui.lbList || !ui.lbMyRank) return;
  const activeNick = getActiveNickname();
  const activeKey = normalizeNickKey(activeNick);
  ui.lbList.innerHTML = '';

  if (!rows || rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'lb-empty';
    empty.textContent = 'ยังไม่มีผู้กล้าบันทึกสถิติบนกระดานโลก ลองวิ่งให้จบสักรอบดูครับ!';
    ui.lbList.appendChild(empty);
  } else {
    rows.forEach((row, idx) => {
      const rankNum = idx + 1;
      const el = document.createElement('div');
      el.className = 'lb-row';
      if (rankNum <= 3) el.classList.add(`rank-${rankNum}`);
      const rowKey = normalizeNickKey(row.nickname_key || sanitizeNickname(row.nickname));
      if (activeKey && rowKey === activeKey) el.classList.add('me');

      const rEl = document.createElement('div');
      rEl.className = 'lb-rank';
      rEl.textContent = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;

      const nEl = document.createElement('div');
      nEl.className = 'lb-name';
      nEl.textContent = cleanNickname(row.nickname);

      const gEl = document.createElement('div');
      gEl.className = 'lb-gar';
      gEl.textContent = `🌼 ${Number(row.garlands) || 0}`;

      const dEl = document.createElement('div');
      dEl.className = 'lb-dist';
      dEl.textContent = `${Number(row.distance) || 0} ม.`;

      el.append(rEl, nEl, gEl, dEl);
      ui.lbList.appendChild(el);
    });
  }

  if (myRankData && myRankData.found) {
    const totalTxt = myRankData.total ? ` / ${myRankData.total} คน` : '';
    ui.lbMyRank.textContent = `อันดับของคุณ: #${myRankData.rank}${totalTxt} · ${cleanNickname(myRankData.nickname)} · ${myRankData.distance} ม. · 🌼 ${myRankData.garlands || 0}`;
  } else if (activeNick) {
    ui.lbMyRank.textContent = `อันดับของคุณ (${activeNick}): ยังไม่มีบนกระดานโลก · สถิติบนเครื่อง ${best} ม. (เล่นให้จบรอบเพื่อบันทึกอัตโนมัติ)`;
  } else {
    ui.lbMyRank.textContent = 'กรุณาใส่ชื่อเล่นที่หน้าหลัก เพื่อบันทึกสถิติอัตโนมัติและเล่นต่อข้ามเครื่อง';
  }
}

async function refreshLeaderboard() {
  if (!ui.lbStatus || !ui.lbList) return;
  const cfg = getLbConfig();
  const activeNick = getActiveNickname();
  if (!cfg.ready) {
    ui.lbStatus.textContent = '⚠️ ยังไม่ได้เชื่อมต่อ Supabase (ตั้งค่า URL/Key ใน leaderboard-config.js)';
    const localRows = best > 0 ? [{
      nickname: activeNick || 'สถิติบนเครื่องคุณ',
      distance: best,
      garlands: lastRunOffers || 0,
    }] : [];
    renderLeaderboardRows(localRows, null);
    return;
  }

  ui.lbStatus.textContent = '⏳ กำลังโหลดอันดับโลก...';
  try {
    const [topRows, myRank] = await Promise.all([
      sbFetch(`/rest/v1/${encodeURIComponent(cfg.table)}?select=nickname,distance,garlands,updated_at&order=distance.desc,garlands.desc,updated_at.asc&limit=10`),
      sbFetch('/rest/v1/rpc/get_player_rank', {
        method: 'POST',
        body: JSON.stringify({ p_nickname: activeNick || '' }),
      }).catch(() => null),
    ]);
    const totalTxt = (myRank && myRank.total) ? ` · ผู้เล่นทั้งหมด ${myRank.total} คน` : '';
    ui.lbStatus.textContent = `🟢 ออนไลน์ · Top 10 สูงสุด${totalTxt}`;
    renderLeaderboardRows(Array.isArray(topRows) ? topRows : [], myRank);
  } catch (err) {
    ui.lbStatus.textContent = `❌ โหลดอันดับไม่สำเร็จ (${err.message || 'เครือข่ายขัดข้อง'})`;
  }
}

function openLeaderboard() {
  if (!ui.lbModal) return;
  ui.lbModal.style.display = 'flex';
  refreshLeaderboard();
}

function closeLeaderboard() {
  if (!ui.lbModal) return;
  ui.lbModal.style.display = 'none';
}

async function autoSubmitScore(runDist, runGarlands) {
  if (!ui.lbAutoStatus) return;
  const nick = getActiveNickname();
  if (!nick) {
    ui.lbAutoStatus.style.color = '#ff9ea9';
    ui.lbAutoStatus.textContent = '⚠️ ยังไม่ตั้งชื่อเล่น — กลับหน้าหลักเพื่อตั้งชื่อบันทึกสถิติ';
    return;
  }

  const cfg = getLbConfig();
  if (!cfg.ready) {
    ui.lbAutoStatus.style.color = '#ffe8a3';
    ui.lbAutoStatus.textContent = `💾 บันทึกสถิติของ "${nick}" บนเครื่องแล้ว (${Math.max(best, runDist)} ม.)`;
    return;
  }

  ui.lbAutoStatus.style.color = '#ffe8a3';
  ui.lbAutoStatus.textContent = `⏳ กำลังบันทึกคะแนนให้ "${nick}" อัตโนมัติ...`;
  try {
    const res = await sbFetch('/rest/v1/rpc/submit_score', {
      method: 'POST',
      body: JSON.stringify({
        p_nickname: nick,
        p_distance: Math.floor(runDist),
        p_garlands: Math.floor(runGarlands),
      }),
    });
    const serverBest = (res && res.distance !== undefined) ? Number(res.distance) : Math.max(best, runDist);
    if (serverBest > best) {
      best = serverBest;
      saveBestForActiveNick(best);
      if (ui.fBest) ui.fBest.textContent = best;
    }
    const rankTxt = (res && res.rank) ? `#${res.rank}` : '-';
    const totalTxt = (res && res.total) ? ` / ${res.total} คน` : '';
    if (res && res.is_new_best) {
      ui.lbAutoStatus.style.color = '#9effc3';
      ui.lbAutoStatus.textContent = `🎉 สถิติใหม่! บันทึกให้ "${nick}" แล้ว · อันดับโลก ${rankTxt}${totalTxt} (${serverBest} ม.)`;
    } else {
      ui.lbAutoStatus.style.color = '#cfe8ff';
      ui.lbAutoStatus.textContent = `✅ บันทึกอัตโนมัติให้ "${nick}" แล้ว · อันดับโลก ${rankTxt}${totalTxt} (สูงสุด ${serverBest} ม.)`;
    }
  } catch (err) {
    ui.lbAutoStatus.style.color = '#ff9ea9';
    ui.lbAutoStatus.textContent = `⚠️ บันทึกขึ้นโลกไม่สำเร็จ (${err.message || 'เครือข่ายขัดข้อง'}) · เก็บบนเครื่องไว้แล้ว`;
  }
}

function showDeathButtons() {
  if (!ui.over) return;
  if (deathTimer) { clearTimeout(deathTimer); deathTimer = null; }
  ui.over.classList.remove('scaring');
  ui.over.classList.add('ready');
}
function die() {
  paused = false;
  ui.pauseOverlay.style.display = 'none';
  if (ui.forkBanner) ui.forkBanner.style.display = 'none';
  if (ui.biomeToast) { ui.biomeToast.classList.remove('show'); ui.biomeToast.style.display = 'none'; }
  state = 'dead'; deadT = 0;
  sfx.scream();
  ui.flash.style.opacity = 1;
  const m = Math.floor(dist);
  lastRunDist = m;
  lastRunOffers = offerCount;
  if (m > best) { best = m; }
  saveBestForActiveNick(best);
  ui.fScore.textContent = m; ui.fOffer.textContent = offerCount; ui.fBest.textContent = best;
  ui.hint.style.display = 'none';
  ui.pip.style.display = 'none';
  ui.hud.style.display = 'none';
  shake = 2.4;
  autoSubmitScore(m, offerCount);
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
function moveLane(d) {
  if (state !== 'play' || paused) return;
  if (fork.active && fork.state === 'turning') return;
  if (fork.active && fork.state === 'approaching' && fork.z >= -36) {
    chooseFork(d);
    return;
  }
  lane = Math.max(0, Math.min(2, lane + d));
}
if (ui.forkLeftCard) {
  ['touchstart', 'touchend', 'mousedown', 'click'].forEach((ev) => {
    ui.forkLeftCard.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev === 'touchstart' || ev === 'click') chooseFork(-1);
    });
  });
}
if (ui.forkRightCard) {
  ['touchstart', 'touchend', 'mousedown', 'click'].forEach((ev) => {
    ui.forkRightCard.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev === 'touchstart' || ev === 'click') chooseFork(1);
    });
  });
}
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
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
    if (e.key === 'Enter' && document.activeElement === ui.menuNickInput) {
      e.preventDefault();
      saveNicknameFromInput(true);
    }
    return;
  }
  const k = e.key.toLowerCase();
  if (ui.lbModal && ui.lbModal.style.display === 'flex') {
    if (k === 'escape') { e.preventDefault(); closeLeaderboard(); }
    return;
  }
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (k === 'escape' || k === 'p') { togglePause(); return; }
  if (paused) return;
  if (k === 'arrowleft' || k === 'a') moveLane(-1);
  else if (k === 'arrowright' || k === 'd') moveLane(1);
  else if (k === 'arrowup' || k === 'w' || k === ' ') jump();
  else if (k === 'arrowdown' || k === 's') slide();
  else if (k === 'f') activateKrahangFlight();
  else if (k === 'enter' && state !== 'play') {
    if (state === 'menu') tryStartFromMenu();
    else if (ui.over.style.display === 'flex' && ui.over.classList.contains('ready')) start();
  }
});
window.activateKrahangFlight = activateKrahangFlight;
window.activateSaiSinShield = activateSaiSinShield;
window.activateFantaBoost = activateFantaBoost;
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
$('startBtn').addEventListener('click', (e) => { e.stopPropagation(); tryStartFromMenu(); });
ui.over.addEventListener('click', (e) => {
  if (ui.over.classList.contains('scaring') && deadT > 0.6) {
    showDeathButtons();
  }
});
$('retryBtn').addEventListener('click', (e) => { e.stopPropagation(); start(); });
$('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); goToMenu(); });
if (ui.menuNickSaveBtn) ui.menuNickSaveBtn.addEventListener('click', (e) => { e.stopPropagation(); saveNicknameFromInput(true); });
if (ui.menuNickEditBtn) ui.menuNickEditBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuNickMode(true);
  setMenuHint('✏️ พิมพ์ชื่อเดิมจากอีกเครื่อง หรือเปลี่ยนชื่อใหม่ได้เลยครับ', '#cfe8ff');
});
if (ui.menuNickInput) ui.menuNickInput.addEventListener('click', (e) => e.stopPropagation());
if (ui.menuLbBtn) ui.menuLbBtn.addEventListener('click', (e) => { e.stopPropagation(); openLeaderboard(); });
if (ui.overLbBtn) ui.overLbBtn.addEventListener('click', (e) => { e.stopPropagation(); openLeaderboard(); });
if (ui.lbCloseBtn) ui.lbCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboard(); });
if (ui.lbRefreshBtn) ui.lbRefreshBtn.addEventListener('click', (e) => { e.stopPropagation(); refreshLeaderboard(); });
if (ui.lbModal) {
  ui.lbModal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target === ui.lbModal) closeLeaderboard();
  });
}
syncMenuNickUI(false);
if (getActiveNickname()) syncNickFromServer(getActiveNickname());
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
    const boostSpeed = hasFanta ? 14 : 0;
    const dz = (speed + boostSpeed) * speedMul * dt;
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
      if (ui.krahangTimerText) {
        ui.krahangTimerText.textContent = `${Math.ceil(flyT)}s`;
      }
      if (ui.krahangBadge) {
        ui.krahangBadge.classList.toggle('warning', flyT < 2.5);
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
        if (ui.krahangBadge) { ui.krahangBadge.style.display = 'none'; ui.krahangBadge.classList.remove('warning'); }
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
        sincePowerup = 0;               // Reset ground travel distance upon touchdown
        nextPowerupDist = 65 + Math.random() * 55;
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

    // Fanta Red Nitro Dash timer & countdown HUD
    if (hasFanta) {
      fantaT -= dt;
      if (fantaT <= 0) {
        expireFantaBoost();
      } else {
        if (ui.fantaBarFill) {
          const pct = Math.max(0, Math.min(100, (fantaT / MAX_FANTA_T) * 100));
          ui.fantaBarFill.style.width = pct + '%';
        }
        if (ui.fantaTimerText) {
          ui.fantaTimerText.textContent = `${Math.ceil(fantaT)}s`;
        }
        if (ui.fantaBadge) {
          ui.fantaBadge.classList.toggle('warning', fantaT < 2.5);
        }
        if (fantaT < 2.5) {
          fantaAuraGroup.visible = Math.floor(clock * 14) % 2 === 0;
        } else {
          fantaAuraGroup.visible = true;
        }
      }
    }

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
        if (ui.saiSinBadge) {
          ui.saiSinBadge.classList.toggle('warning', saiSinT < 3.5);
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
      if (hasFanta) {
        gap = GHOST_MAX_GAP;
        gz = Math.max(gz, GHOST_MAX_GAP + 2.5);
      } else if (landingGrace > 0) {
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

    // smooth biome atmosphere & lighting crossfade
    const clrStep = Math.min(1, dt * 4.5);
    biomeClr.fog.setHex(currentBiome.fog);
    biomeClr.hemiSky.setHex(currentBiome.hemiSky);
    biomeClr.hemiGnd.setHex(currentBiome.hemiGnd);
    biomeClr.moon.setHex(currentBiome.moon);
    biomeClr.sideCol.setHex(currentBiome.sideCol);
    scene.background.lerp(biomeClr.fog, clrStep);
    scene.fog.color.lerp(biomeClr.fog, clrStep);
    hemiLight.color.lerp(biomeClr.hemiSky, clrStep);
    hemiLight.groundColor.lerp(biomeClr.hemiGnd, clrStep);
    moon.color.lerp(biomeClr.moon, clrStep);
    sideGroundMat.color.lerp(biomeClr.sideCol, clrStep);

    // world scroll OR 90-degree crossroads turn
    let justFinishedTurn = false;
    if (fork.active && fork.state === 'turning') {
      fork.turnT += dt;
      const u = Math.min(1, fork.turnT / fork.turnDur);
      const ease = u * u * (3 - 2 * u);
      const dir = fork.chosenDir;
      fork.turnYaw = -dir * (Math.PI / 2) * ease;
      fork.playerX += dir * dz * (0.35 + 0.65 * ease);
      fork.playerZ += (fork.z - fork.playerZ) * Math.min(1, dt * 14);
      for (const bo of fork.branchOfferings) {
        if (bo.branchDir !== dir || bo.got) continue;
        if (Math.abs(bo.mesh.position.x - fork.playerX) < 1.3 && Math.abs(bo.mesh.position.z) < 1.6) {
          bo.got = true;
          fork.group.remove(bo.mesh);
          offerCount++;
          gap = Math.min(GHOST_MAX_GAP, gap + 0.65);
          sfx.coin();
        }
      }
      if (u >= 1) {
        finishForkTurn();
        justFinishedTurn = true;
      }
    }

    if (!(fork.active && fork.state === 'turning') && !justFinishedTurn) {
      if (groundMat.map) groundMat.map.offset.y += dz / CELL;
      if (shrineGroup.visible) {
        shrineGroup.position.z += dz;
        if (shrineGroup.position.z > 14) shrineGroup.visible = false;
      }
      sinceDecor += dz; if (sinceDecor > 9) { sinceDecor = 0; if (!fork.active) spawnDecor(SPAWN_Z); }
      sinceGhost += dz;
      if (flyT <= 0 && !isGlidingDown) {
        sincePowerup += dz;
        if (!fork.active) sinceFork += dz;
      }
      sinceRow += dz; if (sinceRow >= rowSpacing) { sinceRow = 0; spawnRow(); }

      if (fork.active && fork.state === 'approaching') {
        fork.z += dz;
        if (fork.group) fork.group.position.z = fork.z;
        if (ui.forkBanner) {
          ui.forkBanner.style.display = (fork.z >= -48 && fork.z < -0.5) ? 'flex' : 'none';
        }
        if (fork.z >= -2.5) {
          if (fork.chosenDir !== 0) {
            beginForkTurn(fork.chosenDir, false);
          } else if (lane === 0) {
            beginForkTurn(-1, false);
          } else if (lane === 2) {
            beginForkTurn(1, false);
          } else {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            if (hasFanta) {
              sfx.fantaSmash();
              shake = Math.max(shake, 0.55);
              offerCount += 2;
              ui.offerN.textContent = offerCount;
              beginForkTurn(randDir, true);
            } else if (hasSaiSin) {
              saiSinT = 0; hasSaiSin = false; saiSinShieldGroup.visible = false;
              if (ui.saiSinBadge) { ui.saiSinBadge.style.display = 'none'; ui.saiSinBadge.classList.remove('warning'); }
              sfx.saiSinBreak();
              invuln = 1.8;
              beginForkTurn(randDir, true);
            } else {
              invuln = 1.4; stumble = 0.95; shake = 0.9;
              gap -= 2.8;
              sfx.hit();
              ui.flash.style.transition = 'none'; ui.flash.style.opacity = 0.45;
              requestAnimationFrame(() => { ui.flash.style.transition = 'opacity .4s'; ui.flash.style.opacity = 0; });
              beginForkTurn(randDir, true);
            }
          }
        }
      }

      // collectibles (🪽 กระด้งผีกระหัง)
      for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i]; c.mesh.position.z += dz;
        if (c.update) c.update(dt, clock);
        const cz = c.mesh.position.z;
        if (cz > 12) { scene.remove(c.mesh); collectibles.splice(i, 1); continue; }
        if (!c.got && c.lane === lane && Math.abs(cz) < 1.15 && py < 2.2) {
          c.got = true; scene.remove(c.mesh); collectibles.splice(i, 1);
          if (c.type === 'fanta') {
            activateFantaBoost();
          } else if (c.type === 'saiSin') {
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
            if (hasFanta) {
              ramObstacleWithFanta(o);
            } else if (hasSaiSin) {
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

  // ----- crossroads world transform helpers
  const isTurning = (state === 'play' && fork.active && fork.state === 'turning');
  const pWorldX = isTurning ? fork.playerX : px;
  const pWorldZ = isTurning ? fork.playerZ : 0;
  const yaw = isTurning ? fork.turnYaw : 0;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);

  // ----- player pose
  if (state === 'menu') {
    playerRoot.position.set(0.68, 0, 0.65);
    playerRoot.rotation.set(0, 0, 0);
  } else {
    playerRoot.position.set(pWorldX, py, pWorldZ);
    playerRoot.rotation.y = yaw;
    if (isTurning) {
      const turnU = Math.min(1, fork.turnT / fork.turnDur);
      playerRoot.rotation.z = -fork.chosenDir * 0.25 * Math.sin(turnU * Math.PI);
    }
  }
  animateRunner(dt, state === 'play');
  if (hasSaiSin) {
    ringA.rotation.z += dt * 3.2;
    ringA.rotation.x += dt * 1.8;
    ringB.rotation.z -= dt * 2.8;
    ringB.rotation.y += dt * 2.2;
    shieldDome.scale.setScalar(1.0 + Math.sin(clock * 5.0) * 0.04);
  }
  if (hasFanta) {
    fantaStreaks.forEach((st, idx) => {
      st.mesh.position.z = st.baseZ + Math.sin(clock * 32 + idx * 1.4) * 0.35;
      st.mesh.scale.y = 0.85 + Math.cos(clock * 28 + idx * 1.8) * 0.30;
      st.mesh.visible = Math.sin(clock * 40 + idx * 2.1) > -0.75;
    });
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
    ghostRoot.rotation.set(0, 0, -0.08 + Math.sin(clock * 1.8) * 0.04);
    ghost.group.rotation.set(-0.04, 0.72, 0);
    ghostRoot.scale.setScalar(1.15);
  } else {
    let targetGz = gap;
    if (state === 'dead') targetGz = 3.4;
    gz += (targetGz - gz) * Math.min(1, dt * (state === 'dead' ? 14 : 6.5));
    gx += (px - gx) * Math.min(1, dt * 6.0);
    const bob = 0.35 + Math.sin(clock * 4.5) * 0.22;
    const latWobble = (isTurning ? 0 : (gx - px)) + Math.sin(clock * 2.0) * 0.45;
    ghostRoot.position.set(
      pWorldX - fx * gz + rx * latWobble,
      bob,
      pWorldZ - fz * gz + rz * latWobble
    );
    ghostRoot.rotation.y = state === 'dead' ? 0 : yaw;
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
  ghostLight.position.set(ghostRoot.position.x + fx, 2, ghostRoot.position.z + fz);
  ghostLight.intensity = 0.8 + Math.min(2.2, Math.max(0, (14 - gz) * 0.2));
  lantern.position.set(pWorldX - fx * 1.5, 3, pWorldZ - fz * 1.5);

  // ----- cameras
  const sh = shake > 0 ? shake : 0;
  const ox = (Math.random() - 0.5) * sh * 0.5, oy = (Math.random() - 0.5) * sh * 0.5;
  shake = Math.max(0, shake - dt * 2.2);
  const cx = isTurning ? pWorldX : px * 0.65;
  const cz = pWorldZ;
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
    const lookDist = isHigh ? 16.0 : 9.0;
    const tx = cx - fx * camZ + ox, ty = camY, tz = cz - fz * camZ;
    const lx = cx + fx * lookDist, ly = lookY, lz = cz + fz * lookDist;
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
  const pipBaseX = isTurning ? pWorldX : px * 0.9;
  const pipLookBaseX = isTurning ? pWorldX : px;
  if (isHigh) {
    const baseFov = (W / H < 0.8 ? 74 : 62);
    const targetFov = baseFov + (hasFanta ? 8 : 0);
    if (Math.abs(mainCam.fov - targetFov) > 0.05) {
      mainCam.fov += (targetFov - mainCam.fov) * Math.min(1, dt * 6);
      mainCam.updateProjectionMatrix();
    }
    pipCam.position.set(pipBaseX * (isTurning ? 1 : 0.8 / 0.9) + fx * 4.2 + rx * 0.85, py + 1.2, pWorldZ + fz * 4.2 + rz * 0.85);
    pipCam.lookAt(pipLookBaseX - fx * 4.0, py + 0.6, pWorldZ - fz * 4.0);
  } else {
    pipCam.position.set(pipBaseX + fx * 3.6 + rx * 1.05 + ox * 0.3, 2.35 + oy * 0.3, pWorldZ + fz * 3.6 + rz * 1.05);
    pipCam.lookAt(pipLookBaseX - fx * 5.2 + rx * 0.15, 2.15, pWorldZ - fz * 5.2 + rz * 0.15);
  }

  // ----- HUD
  if (state === 'play') {
    const curM = Math.floor(dist);
    ui.score.textContent = curM;
    if (curM > best) { best = curM; saveBestForActiveNick(best); }
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
  if (ui.powerupTray) {
    ui.powerupTray.style.top = (pipRect.y + pipRect.h + 8) + 'px';
    ui.powerupTray.style.right = margin + 'px';
  }
  pipCam.aspect = pw / ph; pipCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

let pipFrame = 0;
function render() {
  // show ghost in main camera during the menu shrine intro and on jumpscare; hide while running so its back doesn't block the track
  ghostRoot.visible = (state !== 'play');
  renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
  renderer.render(scene, mainCam);
  ghostRoot.visible = true;
  if (ui.pip.style.display === 'block') {
    pipFrame++;
    // On mobile, throttle PiP rear-view camera to every 2nd frame (30 FPS) to eliminate double-render overhead!
    if (!isMobile || pipFrame % 2 === 0) {
      const b = 2;   // keep inside the CSS border
      const x = pipRect.x + b, w = pipRect.w - b * 2;
      const y = H - pipRect.y - pipRect.h + b, h = pipRect.h - b * 2;   // GL origin is bottom-left
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      renderer.render(scene, pipCam);
    }
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
