/* Character factory: Subway-style runner + male "Ghost Tan".
 * The face is NOT a flat sticker: the photo is chroma-keyed and projected onto a sculpted 3D head
 * (nose, brows, eye sockets, lips, chin are displaced so lighting follows the real facial relief).
 * The jacket/tie/crest are cut from the same photo and mapped on the torso.
 */
window.TanChars = (function () {
'use strict';

// ------------------------------------------------------------ photo -> keyed textures
const FACE_PX = 1024;                      // Full HD face texture resolution for crisp details
const CHEST_W = 540, CHEST_H = 300;        // chest texture (1:1 source pixels)
const canvases = {
  face: mkCanvas(FACE_PX, FACE_PX), ghostFace: mkCanvas(FACE_PX, FACE_PX),
  chest: mkCanvas(CHEST_W, CHEST_H), ghostChest: mkCanvas(CHEST_W, CHEST_H),
};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const tex = {};
Object.keys(canvases).forEach((k) => { tex[k] = new THREE.CanvasTexture(canvases[k]); tex[k].anisotropy = 8; });

// Remove the bright cream/white classroom wall backdrop via border flood-fill.
// Preserves the white shirt collar and rolled-up white eyes inside the silhouette.
function keyBackground(ctx, w, h, maskFn, isChest) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data, n = w * h;
  const bg = new Uint8Array(n), st = [];
  const isWall = (p) => {
    const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (r + g + b) / 3;
    // bright neutral/warm wall vs dark hair/blazer or warm saturated skin
    return l > 182 && (max - min) < 38 && (r - b) < 28;
  };
  const push = (p) => { if (!bg[p] && isWall(p)) { bg[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) {
    push(x);
    if (!isChest) push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) {
    const p = st.pop(), x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    if (bg[p]) { d[i + 3] = 0; continue; }
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && bg[yy * w + xx]) { near = true; break; }
    }
    if (near) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (215 - l) / 55)));
    }
    if (maskFn) d[i + 3] = Math.round(d[i + 3] * maskFn(x, y));
  }
  ctx.putImageData(id, 0, 0);
}

// Sharp, high-clarity ghost face: preserves skin/hair/rolled-eye contrast so the face is unmistakably clear.
function ghostify(src, dst, decorate) {
  const w = src.width, h = src.height, ctx = dst.getContext('2d');
  ctx.clearRect(0, 0, w, h); ctx.drawImage(src, 0, 0);
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const c = Math.max(0, Math.min(255, (l - 118) * 1.25 + 128));
    // blend 45% original color + 55% cold pale contrast so facial features stay super sharp
    d[i]     = Math.max(0, Math.min(255, r * 0.45 + c * 0.50));
    d[i + 1] = Math.max(0, Math.min(255, g * 0.45 + c * 0.56));
    d[i + 2] = Math.max(0, Math.min(255, b * 0.45 + c * 0.65 + 10));
  }
  ctx.putImageData(id, 0, 0);
  if (decorate) { ctx.globalCompositeOperation = 'source-atop'; decorate(ctx); ctx.globalCompositeOperation = 'source-over'; }
  return dst;
}

// photo geometry (px in the 771x1024 eye-rolling portrait)
const FACE_CX = 332, FACE_CY = 532, FACE_HALF = 255;       // square crop around the head
const FS = FACE_PX / (FACE_HALF * 2);                      // photo px -> face-texture px
const toTex = (px, py) => [(px - (FACE_CX - FACE_HALF)) * FS, (py - (FACE_CY - FACE_HALF)) * FS];

(function loadPhoto() {
  const img = new Image();
  img.onload = () => {
    // ---- face crop
    const fctx = canvases.face.getContext('2d');
    fctx.drawImage(img, FACE_CX - FACE_HALF, FACE_CY - FACE_HALF, FACE_HALF * 2, FACE_HALF * 2, 0, 0, FACE_PX, FACE_PX);
    const RXM = 408, RYM = 468, c = FACE_PX / 2;
    keyBackground(fctx, FACE_PX, FACE_PX, (x, y) => {      // oval soft mask around hair + chin
      const dy = y - (c - 10);
      const ry = dy > 0 ? RYM * 0.90 : RYM;                // trim collar below chin cleanly
      const dd = Math.hypot((x - c) / RXM, dy / ry);
      return Math.max(0, Math.min(1, (1.0 - dd) / 0.08));
    }, false);
    ghostify(canvases.face, canvases.ghostFace, (ctx) => {
      // subtle blood streaks below the lower eyelids without covering the rolled-up eyes!
      const [lx, ly] = toTex(258, 516), [rx, ry] = toTex(396, 528);
      [[lx, ly], [rx, ry]].forEach(([x, y]) => {
        ctx.strokeStyle = 'rgba(165,0,20,.82)'; ctx.lineCap = 'round';
        ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - 6, y + 32); ctx.bezierCurveTo(x - 12, y + 85, x + 4, y + 135, x - 4, y + 195); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 18, y + 36); ctx.bezierCurveTo(x + 22, y + 75, x + 12, y + 110, x + 18, y + 145); ctx.stroke();
      });
    });
    tex.face.needsUpdate = tex.ghostFace.needsUpdate = true;

    // ---- chest crop (blazer, white shirt, red VBAC tie, pink lanyard)
    const cctx = canvases.chest.getContext('2d');
    cctx.drawImage(img, 70, 724, CHEST_W, CHEST_H, 0, 0, CHEST_W, CHEST_H);
    keyBackground(cctx, CHEST_W, CHEST_H, null, true);
    ghostify(canvases.chest, canvases.ghostChest, null);
    tex.chest.needsUpdate = tex.ghostChest.needsUpdate = true;
    const av = document.getElementById('avatar');
    if (av) { const t = mkCanvas(260, 260); t.getContext('2d').drawImage(canvases.ghostFace, 0, 0, 260, 260); av.src = t.toDataURL(); }
  };
  img.src = window.TAN_PHOTO;
})();

// ------------------------------------------------------------ sculpted head
function buildHead(ghost, noFace) {
  const head = new THREE.Group();
  if (noFace) {                                  // generic head (fallback runner, no Tan face)
    head.add(new THREE.Mesh(sphG, new THREE.MeshLambertMaterial({ color: 0xd9b08c })));
    head.children[0].scale.set(0.3, 0.33, 0.3);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, 1.5), new THREE.MeshLambertMaterial({ color: 0x3a2a1c }));
    cap.scale.set(0.32, 0.35, 0.32); cap.position.y = 0.02; head.add(cap);
    return { group: head, mats: [] };
  }
  const RX = 0.32, RY = 0.33, RZ = 0.28, P = 0.72, S = P / (FACE_HALF * 2);
  const geo = new THREE.PlaneGeometry(P, P, 64, 64);
  const pos = geo.attributes.position;
  const bump = (x, y, cx, cy, sx, sy, a) => a * Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  const fx = (px) => (px - FACE_CX) * S, fy = (py) => -(py - FACE_CY) * S;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const ryz = y < 0 ? 0.45 : RY;                          // lower face stays full-depth (chin sticks out)
    const q = 1 - (x / RX) ** 2 - (y / ryz) ** 2;
    let z = 0;
    if (q > 0) {
      z = RZ * Math.sqrt(q);
      const f = Math.min(1, q * 4);                         // relief fades toward the silhouette
      z += f * (
        bump(x, y, fx(334), fy(545), 0.028, 0.065, 0.028) +  // nose bridge
        bump(x, y, fx(332), fy(588), 0.055, 0.038, 0.042) +  // nose tip / ball
        bump(x, y, fx(296), fy(596), 0.028, 0.024, 0.016) +  // nostril wings
        bump(x, y, fx(366), fy(598), 0.028, 0.024, 0.016) +
        bump(x, y, fx(330), fy(485), 0.16, 0.024, 0.014) +   // brow ridge
        bump(x, y, fx(258), fy(516), 0.045, 0.028, -0.010) + // left rolled eye
        bump(x, y, fx(396), fy(528), 0.045, 0.028, -0.010) + // right rolled eye
        bump(x, y, fx(330), fy(680), 0.062, 0.025, 0.018) +  // lips
        bump(x, y, fx(330), fy(745), 0.075, 0.042, 0.018) +  // chin
        bump(x, y, fx(215), fy(610), 0.075, 0.085, 0.012) +  // full cheeks
        bump(x, y, fx(435), fy(615), 0.075, 0.085, 0.012));
    }
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  const map = ghost ? tex.ghostFace : tex.face;
  const faceMat = ghost
    ? new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x707c92, color: 0x808898, transparent: true, alphaTest: 0.03, fog: false })
    : new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x555555, color: 0x8a8a8a, transparent: true, alphaTest: 0.03 });
  head.add(new THREE.Mesh(geo, faceMat));

  // back/top of the head: dark hair volume (kept above the jaw so it never shows behind the chin)
  const hairMat = new THREE.MeshLambertMaterial({ color: ghost ? 0x15161e : 0x141419 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20, 0, Math.PI * 2, 0, 2.15), hairMat);
  hair.scale.set(RX * 0.94, RY * 0.92, RZ * 0.92); hair.position.set(0, 0.02, -0.055);
  head.add(hair);
  return { group: head, mats: [faceMat] };
}

// ------------------------------------------------------------ body (Subway-style proportions)
const capGeo = {};
function cap(r, len) { const k = r + '_' + len; return capGeo[k] || (capGeo[k] = new THREE.CapsuleGeometry(r, len, 4, 12)); }
const boxG = new THREE.BoxGeometry(1, 1, 1), sphG = new THREE.SphereGeometry(1, 16, 12);

function makeHuman(ghost, noFace) {
  const g = new THREE.Group(), mats = [];
  const M = (cN, cG) => {
    if (!ghost) return new THREE.MeshLambertMaterial({ color: cN });
    return new THREE.MeshLambertMaterial({ color: cG, emissive: 0x2a3550, fog: false });
  };
  const jacket = M(0x1b2823, 0x9db0c9), pants = M(0x262b36, 0x7f90ad), skin = M(0xdba982, 0xcdd9ee);
  const shoe = M(0xf4f4f4, 0xe3eaff), sole = M(0x9a9aa6, 0x8f9fc5), bag = M(0xd13a32, 0x000000);
  const mesh = (geo, mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (sx !== undefined) m.scale.set(sx, sy, sz); return m;
  };

  // pelvis + torso
  g.add(mesh(boxG, pants, 0, 1.08, 0, 0.84, 0.24, 0.46));
  g.add(mesh(boxG, jacket, 0, 1.52, 0, 0.9, 1.0, 0.5));
  [-1, 1].forEach((s) => g.add(mesh(sphG, jacket, s * 0.5, 1.94, 0, 0.17, 0.17, 0.2)));   // rounded shoulders
  const chestTex = ghost ? tex.ghostChest : tex.chest;
  const chestMat = ghost
    ? new THREE.MeshLambertMaterial({ map: chestTex, emissiveMap: chestTex, emissive: 0x6a7a90, color: 0x9aa8c0, transparent: true, alphaTest: 0.03, fog: false })
    : new THREE.MeshLambertMaterial({ map: chestTex, emissiveMap: chestTex, emissive: 0x555555, color: 0x8a8a8a, transparent: true, alphaTest: 0.03 });
  if (ghost) mats.push(chestMat);
  if (!noFace) g.add(mesh(new THREE.PlaneGeometry(0.9, 1.0), chestMat, 0, 1.52, 0.252));
  g.add(mesh(cap(0.13, 0.14), skin, 0, 2.16, 0));                      // neck

  // head
  const hd = buildHead(ghost, noFace); hd.group.position.set(0, 2.55, 0.07); g.add(hd.group);
  hd.mats.forEach((m) => ghost && mats.push(m));

  // backpack (Subway signature) — runner only
  if (!ghost) {
    g.add(mesh(cap(0.22, 0.36), bag, 0, 1.52, -0.43, 1.5, 1, 0.9));
    g.add(mesh(cap(0.13, 0.2), bag, 0, 1.16, -0.62, 1.7, 1, 0.8));
    g.add(mesh(boxG, M(0xf1c40f), 0, 1.7, -0.62, 0.34, 0.07, 0.05));
    [-1, 1].forEach((s) => g.add(mesh(boxG, M(0x9b2a26), s * 0.33, 1.58, 0.27, 0.055, 0.82, 0.04)));
  }

  // arms
  const mkArm = (s) => {
    const p = new THREE.Group(); p.position.set(s * 0.56, 1.9, 0);
    p.add(mesh(cap(0.1, 0.26), jacket, 0, -0.23, 0));
    const f = new THREE.Group(); f.position.set(0, -0.46, 0);
    f.add(mesh(cap(0.09, 0.24), jacket, 0, -0.21, 0));
    f.add(mesh(boxG, M(0xffffff, 0xf0f4ff), 0, -0.4, 0, 0.17, 0.05, 0.17));    // shirt cuff
    f.add(mesh(sphG, skin, 0, -0.5, 0, 0.1, 0.11, 0.1));
    p.add(f); g.add(p); return { p, f };
  };
  // legs
  const mkLeg = (s) => {
    const t = new THREE.Group(); t.position.set(s * 0.21, 1.05, 0);
    t.add(mesh(cap(0.13, 0.22), pants, 0, -0.23, 0));
    const sh = new THREE.Group(); sh.position.set(0, -0.46, 0);
    sh.add(mesh(cap(0.105, 0.26), pants, 0, -0.235, 0));
    sh.add(mesh(sphG, shoe, 0, -0.49, 0.09, 0.14, 0.1, 0.27));               // sneaker
    sh.add(mesh(boxG, sole, 0, -0.575, 0.09, 0.22, 0.035, 0.42));
    t.add(sh); g.add(t); return { t, s: sh };
  };
  const armL = mkArm(-1), armR = mkArm(1), legL = mkLeg(-1), legR = mkLeg(1);
  return { group: g, head: hd.group, armL, armR, legL, legR, mats };
}

// ------------------------------------------------------------ the runner: a ready-made cartoon robot (glTF)
// Model: "RobotExpressive" by Tomás Laulhé (CC0), shipped with the three.js examples.
function makeRunner() {
  const root = new THREE.Group();
  // Incense sticks + marigold garland held while praying at the shrine in the menu screen
  const incense = new THREE.Group();
  const stickMat = new THREE.MeshLambertMaterial({ color: 0xb8332a });
  const ashMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  [-0.04, 0, 0.04].forEach((dx, i) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6), stickMat);
    st.position.set(dx, 0.22, 0); st.rotation.z = (i - 1) * 0.06; incense.add(st);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), ashMat);
    tip.position.set(dx * 1.3, 0.48, 0); incense.add(tip);
  });
  const malai = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.038, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0xffb81f })
  );
  malai.position.set(0, 0.06, 0.04); malai.rotation.x = Math.PI / 2; incense.add(malai);
  incense.position.set(0, 1.05, 0.62);
  root.add(incense);

  const r = { group: root, mixer: null, actions: {}, current: null, fallback: null, incense, bones: {} };
  const useFallback = () => { r.fallback = makeHuman(false, true); root.add(r.fallback.group); };
  r.play = (name, fade) => {
    const a = r.actions[name]; if (!a || r.current === name) return;
    const prev = r.actions[r.current];
    a.reset().setEffectiveWeight(1).fadeIn(fade || 0.15).play();
    if (prev) prev.fadeOut(fade || 0.15);
    r.current = name;
  };
  r.posePray = (t) => {
    const bow = (Math.sin(t * 4.2) + 1) * 0.5;                 // 0..1 rhythmic Wai bow
    incense.visible = true;
    incense.position.set(0, 1.02 - bow * 0.22, 0.58 + bow * 0.12);
    incense.rotation.set(0.35 + bow * 0.45, 0, 0);
    if (r.bones.head) r.bones.head.rotation.x -= bow * 0.35;
    if (r.bones.armL) { r.bones.armL.rotation.z += 0.45; r.bones.armL.rotation.x += 0.35; }
    if (r.bones.armR) { r.bones.armR.rotation.z -= 0.45; r.bones.armR.rotation.x += 0.35; }
    return bow;
  };
  try {
    const bin = atob(window.ROBOT_GLB), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y;
      const k = 2.6 / h;                                        // ~Subway-sized hero
      model.scale.setScalar(k); model.position.y = -box.min.y * k;
      model.traverse((o) => {
        if (o.isMesh && o.material) { o.material.fog = true; }
        if (o.name === 'Head') r.bones.head = o;
        if (o.name === 'UpperArm.L') r.bones.armL = o;
        if (o.name === 'UpperArm.R') r.bones.armR = o;
      });
      root.add(model);
      r.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((c) => { r.actions[c.name] = r.mixer.clipAction(c); });
      ['Jump', 'Death', 'Sitting'].forEach((n) => {
        const a = r.actions[n]; if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      });
      if (r.actions.Jump) r.actions.Jump.timeScale = 1.35;
      if (r.actions.Sitting) r.actions.Sitting.timeScale = 2.2;
      r.play('Sitting', 0);
    }, () => useFallback());
  } catch (e) { useFallback(); }
  return r;
}
// ------------------------------------------------------------ the ghost: ready-made male humanoid (Mixamo "X Bot", glTF)
// wearing Tan's sculpted face. The model is recoloured into a pale spirit and its head is covered by Tan's head.
function decodeGLB(b64, ok, fail) {
  try {
    const bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', ok, fail);
  } catch (e) { fail(e); }
}
function makeGhost() {
  const root = new THREE.Group();
  const gh = { group: root, mixer: null, mats: [], head: null, fallback: null, actions: {} };
  const useFallback = () => { gh.fallback = makeHuman(true); root.add(gh.fallback.group); gh.mats = gh.fallback.mats; };
  gh.update = (dt, t) => {
    if (gh.mixer) {
      gh.mixer.update(dt);
      if (gh.head) { gh.head.rotation.z = Math.sin(t * 3.1) * 0.14; gh.head.rotation.x = 0.1 + Math.sin(t * 1.7) * 0.05; }
    } else if (gh.fallback) poseGhost(gh.fallback, t);
  };
  decodeGLB(window.XBOT_GLB, (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const headEnd = model.getObjectByName('mixamorigHeadTop_End') || model.getObjectByName('mixamorig:HeadTop_End');
    let h = 1.8;
    if (headEnd) {
      const pTop = new THREE.Vector3(), pRoot = new THREE.Vector3();
      headEnd.getWorldPosition(pTop); model.getWorldPosition(pRoot);
      h = Math.max(0.5, pTop.y - pRoot.y);
    }
    const k = 2.65 / h;
    model.scale.setScalar(k); model.position.y = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const joints = /joint/i.test(o.material.name || '');
      o.material = new THREE.MeshLambertMaterial({
        color: joints ? 0x222938 : 0x2c3648, emissive: joints ? 0x0a0f18 : 0x121926, fog: false });
    });
    root.add(model);
    root.updateMatrixWorld(true);
    // mount Tan's head on the model's head bone (rest pose -> head faces +Z, up +Y)
    const bone = model.getObjectByName('mixamorigHead') || model.getObjectByName('mixamorig:Head');
    if (bone) {
      const qBone = new THREE.Quaternion(), qModel = new THREE.Quaternion();
      bone.getWorldQuaternion(qBone); model.getWorldQuaternion(qModel);
      const offset = qModel.clone().invert().multiply(qBone).invert();      // bone-local -> model-aligned
      const sb = new THREE.Vector3(); bone.getWorldScale(sb);
      const ws = sb.x;                                                      // total world scale of bone
      const HS = 1.48;                                                      // Tan's head size in world units
      const hd = buildHead(true);
      const mount = new THREE.Group(), wobble = new THREE.Group();
      mount.quaternion.copy(offset);
      mount.position.copy(new THREE.Vector3(0, 0.21, 0.08).applyQuaternion(offset).divideScalar(ws));
      mount.scale.setScalar(HS / ws);
      hd.group.scale.setScalar(1);
      wobble.add(hd.group); mount.add(wobble); bone.add(mount);
      gh.head = wobble; gh.mats = hd.mats;
      // mount Tan's VBAC blazer/tie/lanyard on Spine2 so he wears his school uniform
      const spine = model.getObjectByName('mixamorigSpine2') || model.getObjectByName('mixamorig:Spine2');
      if (spine) {
        const qSpine = new THREE.Quaternion(); spine.getWorldQuaternion(qSpine);
        const sOffset = qModel.clone().invert().multiply(qSpine).invert();
        const ss = new THREE.Vector3(); spine.getWorldScale(ss);
        const sws = ss.x;
        const chestMat = new THREE.MeshLambertMaterial({
          map: tex.ghostChest, emissiveMap: tex.ghostChest, emissive: 0x6a7488,
          color: 0x808898, transparent: true, alphaTest: 0.03, fog: false, side: THREE.DoubleSide });
        const chestGeo = new THREE.PlaneGeometry(0.76, 0.78, 16, 12);
        const cp = chestGeo.attributes.position;
        for (let i = 0; i < cp.count; i++) {
          const cx = cp.getX(i), cy = cp.getY(i);
          cp.setZ(i, 0.06 * Math.cos(cx * 2.4) + 0.02 * Math.cos(cy * 2.0));
        }
        chestGeo.computeVertexNormals();
        const chestMesh = new THREE.Mesh(chestGeo, chestMat);
        const smount = new THREE.Group();
        smount.quaternion.copy(sOffset);
        smount.position.copy(new THREE.Vector3(0, -0.02, 0.24).applyQuaternion(sOffset).divideScalar(sws));
        smount.scale.setScalar(1 / sws);
        smount.add(chestMesh); spine.add(smount);
        gh.mats.push(chestMat);
      }
    }
    gh.mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find((c) => c.name === 'run') || gltf.animations[0];
    const a = gh.mixer.clipAction(clip); a.timeScale = 1.85; a.play();
  }, () => useFallback());
  return gh;
}
// ------------------------------------------------------------ poses
function poseRun(h, ph, air) {
  if (air) {                                   // Subway jump: stride-leap, one arm punching up
    h.legL.t.rotation.x = -1.05; h.legL.s.rotation.x = 1.3;
    h.legR.t.rotation.x = 0.7; h.legR.s.rotation.x = 1.0;
    h.armL.p.rotation.x = -2.5; h.armL.f.rotation.x = -0.3;
    h.armR.p.rotation.x = 0.7; h.armR.f.rotation.x = -0.6;
    return 0;
  }
  const s = Math.sin(ph), c = Math.cos(ph);
  h.legL.t.rotation.x = s * 0.95; h.legR.t.rotation.x = -s * 0.95;
  h.legL.s.rotation.x = 0.25 + 1.25 * Math.max(0, -c);
  h.legR.s.rotation.x = 0.25 + 1.25 * Math.max(0, c);
  h.armL.p.rotation.x = -s * 0.95; h.armR.p.rotation.x = s * 0.95;
  h.armL.f.rotation.x = -1.25; h.armR.f.rotation.x = -1.25;
  h.armL.p.rotation.z = 0.08; h.armR.p.rotation.z = -0.08;
  return 1 - Math.abs(s);                      // body bob (highest when legs pass under)
}
function poseSlide(h) {
  h.legL.t.rotation.x = -0.35; h.legL.s.rotation.x = 0.35;
  h.legR.t.rotation.x = -0.15; h.legR.s.rotation.x = 0.2;
  h.armL.p.rotation.x = -0.6; h.armR.p.rotation.x = -0.6;
  h.armL.f.rotation.x = -0.3; h.armR.f.rotation.x = -0.3;
}
function poseGhost(h, t) {                     // floating lunge, arms grasping toward the runner
  h.armL.p.rotation.x = -1.5 + Math.sin(t * 6) * 0.18; h.armR.p.rotation.x = -1.5 + Math.sin(t * 6 + 1.6) * 0.18;
  h.armL.f.rotation.x = -0.15; h.armR.f.rotation.x = -0.15;
  h.armL.p.rotation.z = 0.12; h.armR.p.rotation.z = -0.12;
  h.legL.t.rotation.x = 0.7 + Math.sin(t * 5) * 0.35; h.legR.t.rotation.x = 0.7 - Math.sin(t * 5) * 0.35;
  h.legL.s.rotation.x = 1.1; h.legR.s.rotation.x = 1.1;
  h.head.rotation.z = Math.sin(t * 3.1) * 0.12; h.head.rotation.x = 0.1;
}

return { tex, makeHuman, makeRunner, makeGhost, poseRun, poseSlide, poseGhost };
})();
