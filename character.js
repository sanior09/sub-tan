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
function loadWrapTex(b64, rx, ry, ox) {
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  if (ox) t.offset.x = ox;
  if (b64) {
    const im = new Image();
    im.onload = () => { t.image = im; t.needsUpdate = true; };
    im.src = b64;
  }
  return t;
}
tex.shirt = loadWrapTex(window.SHIRT_TEX, 2, 1, 0.5);
tex.chong = loadWrapTex(window.CHONG_TEX, 2, 1, 0);

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

  // back/top of the head: dark hair volume centered behind the face so it never sticks out to the side
  const hairMat = new THREE.MeshLambertMaterial({ color: ghost ? 0x15161e : 0x141419 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18, 0, Math.PI * 2, 0, 2.0), hairMat);
  hair.scale.set(RX * 0.76, RY * 0.82, RZ * 0.82); hair.position.set(fx(332), 0.04, -0.065);
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
    return new THREE.MeshLambertMaterial({ color: cG, emissive: 0x182030, fog: false });
  };
  // Ghost wears: white long-sleeve button-up shirt + royal blue Chong Kraben + bare calves + grey sneakers
  const jacket = M(0x1b2823, 0xf0f3fa), pants = M(0x262b36, 0x1034c8), skin = M(0xdba982, 0xd8a882);
  const shoe = M(0xf4f4f4, 0x6e736b), sole = M(0x9a9aa6, 0x555952), bag = M(0xd13a32, 0x000000);
  const mesh = (geo, mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (sx !== undefined) m.scale.set(sx, sy, sz); return m;
  };

  // pelvis + torso
  g.add(mesh(boxG, pants, 0, 1.08, 0, 0.92, 0.28, 0.52));
  g.add(mesh(boxG, jacket, 0, 1.52, 0, 0.88, 1.0, 0.48));
  [-1, 1].forEach((s) => g.add(mesh(sphG, jacket, s * 0.5, 1.94, 0, 0.17, 0.17, 0.2)));   // rounded shoulders
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
    f.add(mesh(boxG, M(0xffffff, 0xffffff), 0, -0.4, 0, 0.17, 0.05, 0.17));    // shirt cuff
    f.add(mesh(sphG, skin, 0, -0.5, 0, 0.1, 0.11, 0.1));
    p.add(f); g.add(p); return { p, f };
  };
  // legs (puffed blue Chong Kraben down past the knees + bare lower calves + bare feet, NO shoes!)
  const mkLeg = (s) => {
    const t = new THREE.Group(); t.position.set(s * 0.21, 1.05, 0);
    t.add(mesh(cap(0.18, 0.26), pants, 0, -0.24, 0, 1.15, 1.0, 1.15));
    const sh = new THREE.Group(); sh.position.set(0, -0.46, 0);
    sh.add(mesh(cap(0.14, 0.10), pants, 0, -0.08, 0));
    sh.add(mesh(cap(0.085, 0.24), skin, 0, -0.27, 0));
    sh.add(mesh(sphG, ghost ? skin : shoe, 0, -0.50, 0.08, 0.11, 0.07, 0.24));   // bare foot for ghost
    if (!ghost) sh.add(mesh(boxG, sole, 0, -0.575, 0.09, 0.22, 0.035, 0.42));
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
    const bow = (Math.sin(t * 4.5) + 1) * 0.5;                 // 0..1 rhythmic Wai bow forward
    incense.visible = true;
    incense.position.set(0, 0.92 + bow * 0.16, 0.56 + bow * 0.08);
    incense.rotation.set(0.25 + bow * 0.45, 0, 0);
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
      if (!o.isMesh || !o.geometry) return;
      o.frustumCulled = false;
      const isJoints = /joint/i.test(o.material.name || o.name || '');
      const geo = o.geometry;
      const pos = geo.attributes.position;
      if (pos) {
        const count = pos.count;
        const colors = new Float32Array(count * 3);
        const keepVert = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
          let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const ax = Math.abs(x);
          let r = 0.80, g = 0.62, b = 0.48;

          if (ax > 0.68) {
            // Keep ONLY realistic 5-fingered human hands; delete Xbot's boot-shaped feet completely!
            keepVert[i] = 1;
          }
          pos.setXYZ(i, x, y, z);
          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
        }
        // Strip all robotic armor & mechanical ball-joint triangles from the index buffer
        if (geo.index) {
          const idx = geo.index.array;
          const kept = [];
          for (let i = 0; i < idx.length; i += 3) {
            const a = idx[i], b = idx[i + 1], c = idx[i + 2];
            if (keepVert[a] && keepVert[b] && keepVert[c]) {
              kept.push(a, b, c);
            }
          }
          geo.setIndex(kept);
        }
        pos.needsUpdate = true;
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
      }
      o.material = new THREE.MeshLambertMaterial({
        vertexColors: true, emissive: 0x1e1612, fog: false });
    });
    root.add(model);
    root.updateMatrixWorld(true);

    // Helper: create a local mount on any Mixamo bone where 1 unit = 1 scaled model meter
    // (100% immune to world rotation/scale of ghost.group or ghostRoot!)
    const getBone = (n) => model.getObjectByName('mixamorig' + n) || model.getObjectByName('mixamorig:' + n);
    const makeMount = (bone) => {
      const m = new THREE.Group();
      m.scale.setScalar(100 / k);
      bone.add(m);
      return m;
    };
    const shirtMat = new THREE.MeshLambertMaterial({
      map: tex.shirt, emissiveMap: tex.shirt, emissive: 0x484c56, color: 0xf4f6fc, fog: false });
    const sleeveMat = new THREE.MeshLambertMaterial({
      color: 0xeef1f8, emissive: 0x2c303a, fog: false });
    const chongMat = new THREE.MeshPhongMaterial({
      map: tex.chong, emissiveMap: tex.chong, emissive: 0x0b1855, color: 0x2652ff,
      specular: 0x5588ff, shininess: 62, fog: false });
    const skinMat = new THREE.MeshLambertMaterial({
      color: 0xcc9e7a, emissive: 0x1e1612, fog: false });

    // Helper: span a cylinder directly in bA's local space from (0,0,0) to child bone bB.position
    const spanLimb = (bA, bB, rTop, rBot, mat, padTop, padBot, sx, sz) => {
      if (!bA || !bB) return null;
      const dir = bB.position.clone().multiplyScalar(k / 100);
      const len = dir.length();
      if (len < 1e-4) return null;
      const u = dir.clone().normalize();
      const start = u.clone().multiplyScalar(-(padTop || 0));
      const end = u.clone().multiplyScalar(len + (padBot || 0));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const totalLen = end.distanceTo(start);
      const geo = new THREE.CylinderGeometry(rTop, rBot, totalLen, 24, 8);
      geo.rotateY(Math.PI); // face front (+Z) for texture UVs
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(sx || 1, 1, sz || 1);
      const holder = new THREE.Group();
      holder.position.copy(mid);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u.clone().negate());
      holder.add(mesh);
      const mount = makeMount(bA);
      mount.add(holder);
      return { mount, mesh, len };
    };

    // 1. Smooth Human Torso in Real Photo White Button-Up Shirt (Spine1)
    const bSpine1 = getBone('Spine1'), bHips = getBone('Hips'), bNeck = getBone('Neck'), bHead = getBone('Head');
    if (bSpine1) {
      const mSpine = makeMount(bSpine1);
      const torsoGeo = new THREE.CylinderGeometry(0.24, 0.215, 0.72, 32, 16);
      torsoGeo.rotateY(Math.PI);
      const tp = torsoGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        let tx = tp.getX(i), ty = tp.getY(i), tz = tp.getZ(i);
        // Taper top smoothly into the neck/shoulders so no flat edge sticks out under the chin
        let shoulder = 1.0;
        if (ty > 0.26) {
          shoulder = 1.14 - 0.55 * ((ty - 0.26) / 0.10);
        } else if (ty > 0.10) {
          shoulder = 1.0 + 0.14 * ((ty - 0.10) / 0.16);
        }
        const hem = ty < -0.22 ? 1.05 : 1.0;
        tx *= shoulder * hem * 1.12;
        tz *= 0.70 * shoulder * hem;
        tp.setXYZ(i, tx, ty, tz);
      }
      torsoGeo.computeVertexNormals();
      const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
      torsoMesh.position.set(0, 0.03, -0.015);
      mSpine.add(torsoMesh);
    }
    if (bNeck && bHead) {
      spanLimb(bNeck, bHead, 0.092, 0.084, skinMat, 0.04, 0.03, 1, 1);
      const mNeck = makeMount(bNeck);
      const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.115, 0.055, 20), sleeveMat);
      collarMesh.position.set(0, 0.01, -0.005);
      mNeck.add(collarMesh);
    }

    // 2. Smooth Long White Shirt Sleeves (bridging Shoulder -> UpperArm -> ForeArm -> Hand seamlessly!)
    [
      ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
      ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
    ].forEach(([sName, uName, fName, hName]) => {
      const bS = getBone(sName), bU = getBone(uName), bF = getBone(fName), bH = getBone(hName);
      if (bS && bU) {
        spanLimb(bS, bU, 0.135, 0.114, sleeveMat, 0.05, 0.02, 1, 0.90);
      }
      if (bU) {
        const mU = makeMount(bU);
        mU.add(new THREE.Mesh(new THREE.SphereGeometry(0.114, 16, 12), sleeveMat));
      }
      if (bF) {
        const mF = makeMount(bF);
        mF.add(new THREE.Mesh(new THREE.SphereGeometry(0.096, 16, 12), sleeveMat));
      }
      spanLimb(bU, bF, 0.112, 0.095, sleeveMat, 0.01, 0.01, 1, 0.94);
      spanLimb(bF, bH, 0.094, 0.072, sleeveMat, 0.01, 0.0, 1, 0.94);
    });

    // 3. Smooth Draped Royal-Blue Silk Chong Kraben (Hips + LeftUpLeg + RightUpLeg down past knees!)
    if (bHips) {
      const mHips = makeMount(bHips);
      const hipGeo = new THREE.CylinderGeometry(0.225, 0.275, 0.36, 28, 8);
      hipGeo.rotateY(Math.PI);
      const hipMesh = new THREE.Mesh(hipGeo, chongMat);
      hipMesh.scale.set(1.12, 1, 0.82);
      hipMesh.position.set(0, -0.02, 0.0);
      mHips.add(hipMesh);
    }
    [['LeftUpLeg', 'LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg', 'RightFoot']].forEach(([uLeg, lLeg, foot]) => {
      const bUL = getBone(uLeg), bLL = getBone(lLeg), bFt = getBone(foot);
      if (bUL && bLL) {
        // Billowy Chong Kraben leg extending past the knee joint in local bone units
        const legLen = bLL.position.clone().multiplyScalar(k / 100).length();
        const len = legLen + 0.18;
        const cGeo = new THREE.CylinderGeometry(0.165, 0.108, len, 28, 14);
        cGeo.rotateY(Math.PI);
        const cp = cGeo.attributes.position;
        for (let i = 0; i < cp.count; i++) {
          let cx = cp.getX(i), cy = cp.getY(i), cz = cp.getZ(i);
          const nt = (cy + len / 2) / len; // 0 at bottom (below knee), 1 at top (hip)
          const ang = Math.atan2(cz, cx);
          const pleat = 1.0 + 0.08 * Math.sin(ang * 6 + nt * 8);
          const puff = (0.76 + 0.62 * Math.sin(Math.pow(nt, 0.65) * Math.PI)) * pleat;
          cx *= puff * 1.08;
          cz *= puff * 1.02;
          cp.setXYZ(i, cx, cy, cz);
        }
        cGeo.computeVertexNormals();
        const cMesh = new THREE.Mesh(cGeo, chongMat);
        cMesh.position.set(0, -len / 2 + 0.04, 0.0);
        const mUL = makeMount(bUL);
        mUL.add(cMesh);
        // Knee puff sphere so the knee bend stays covered in blue silk
        const mLL = makeMount(bLL);
        const kneePuff = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), chongMat);
        kneePuff.position.set(0, 0.02, 0);
        mLL.add(kneePuff);
      }
      // Smooth bare human lower calf & ankle (from inside the Chong Kraben cuff down to the exact ankle bFt)
      spanLimb(bLL, bFt, 0.082, 0.050, skinMat, -0.10, 0.0, 1, 1);
      // Real sculpted bare human foot aligned to LeftFoot -> LeftToeBase (sole at y = -0.128, toes at z = +0.16..+0.23)
      if (bFt) {
        const mFoot = makeMount(bFt);
        const isLeft = /Left/i.test(foot);
        const inSign = isLeft ? -1 : 1; // inner side where the big toe sits
        // Ankle & heel sphere
        const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.050, 14, 10), skinMat);
        mFoot.add(ankle);
        const heel = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), skinMat);
        heel.position.set(0, -0.092, -0.022);
        heel.scale.set(0.95, 0.75, 1.18);
        mFoot.add(heel);
        // Sloped human instep/arch from ankle/heel (0, -0.075, -0.01) to ball of foot (0, -0.112, +0.155)
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.185, 18), skinMat);
        arch.rotation.x = Math.PI / 2 + 0.22;
        arch.scale.set(1.22, 1, 0.62);
        arch.position.set(0, -0.094, 0.072);
        mFoot.add(arch);
        // Wide ball of the foot pad
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 10), skinMat);
        ball.scale.set(1.28, 0.46, 0.85);
        ball.position.set(0, -0.112, 0.155);
        mFoot.add(ball);
        // 5 bare toes extending forward from the ball of the foot (NO shoes!)
        const nailMat = new THREE.MeshLambertMaterial({ color: 0xe6bfb0, emissive: 0x1e1612, fog: false });
        for (let t = 0; t < 5; t++) {
          const rToe = t === 0 ? 0.018 : 0.0145 - t * 0.0012;
          const lenToe = t === 0 ? 0.050 : 0.040 - t * 0.003;
          const tx = inSign * (0.042 - t * 0.021);
          const tz = 0.195 - t * 0.008;
          const toeMesh = new THREE.Mesh(cap(rToe, lenToe), skinMat);
          toeMesh.rotation.x = Math.PI / 2;
          toeMesh.position.set(tx, -0.114, tz);
          mFoot.add(toeMesh);
          const nail = new THREE.Mesh(new THREE.SphereGeometry(rToe * 0.75, 8, 6), nailMat);
          nail.scale.set(1, 0.35, 1.1);
          nail.position.set(tx, -0.114 + rToe * 0.72, tz + lenToe * 0.45);
          mFoot.add(nail);
        }
      }
    });

    // 4. Mount Ghost Tan's head with natural human proportions (HS = 1.22)
    const bone = getBone('Head');
    if (bone) {
      const mHead = makeMount(bone);
      const HS = 1.22;
      const hd = buildHead(true);
      const wobble = new THREE.Group();
      wobble.position.set(0.035, 0.14, 0.075);
      wobble.scale.setScalar(HS);
      hd.group.scale.setScalar(1);
      wobble.add(hd.group);
      mHead.add(wobble);
      gh.head = wobble; gh.mats = [shirtMat, sleeveMat, chongMat, ...hd.mats];
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
