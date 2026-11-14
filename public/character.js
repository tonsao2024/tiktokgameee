// ตัวละคร 3 มิติสร้างจากรูปทรงพื้นฐาน สุ่มหน้าตา/ทรงผม/ชุดจาก id ของผู้ชม
// (สุ่มแบบมี seed: คนเดิมเข้ามากี่ครั้งก็ได้ตัวละครเดิม ผู้เล่นเลือกเองไม่ได้)
import * as THREE from 'three';

export const CHAR_SCALE = 1.3;

// ---------- สุ่มแบบมี seed ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---------- รูปทรงที่ใช้ร่วมกัน ----------
const G = {
  torso: new THREE.CylinderGeometry(0.175, 0.2, 0.46, 12).translate(0, 0.23, 0),
  hip: new THREE.CylinderGeometry(0.2, 0.19, 0.16, 12).translate(0, -0.05, 0),
  limb: new THREE.CylinderGeometry(0.06, 0.05, 1, 8).translate(0, -0.5, 0),
  leg: new THREE.CylinderGeometry(0.085, 0.065, 1, 8).translate(0, -0.5, 0),
  shoe: new THREE.BoxGeometry(0.12, 0.07, 0.2),
  ball: new THREE.SphereGeometry(1, 16, 12),
  hairCap: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
  sin: new THREE.CylinderGeometry(0.2, 0.25, 0.54, 14).translate(0, -0.3, 0),
  skirt: new THREE.CylinderGeometry(0.19, 0.4, 0.3, 14, 1, true).translate(0, -0.17, 0),
  ruffle: new THREE.CylinderGeometry(0.24, 0.46, 0.16, 14, 1, true).translate(0, -0.3, 0),
  sash: new THREE.TorusGeometry(0.2, 0.045, 6, 16),
  band: new THREE.CylinderGeometry(0.21, 0.21, 0.09, 12),
  garland: new THREE.TorusGeometry(0.15, 0.04, 6, 14),
  cone: new THREE.ConeGeometry(1, 1, 10),
  brim: new THREE.CylinderGeometry(0.46, 0.5, 0.03, 16),
  feather: new THREE.ConeGeometry(0.07, 0.6, 5).translate(0, 0.3, 0),
  beam: new THREE.CylinderGeometry(0.55, 0.55, 7, 16, 1, true).translate(0, 3.5, 0),
};

// ---------- ลายผ้า (วาดบน canvas) ----------
const texCache = new Map();
function tex(key, draw, repeatX = 3, repeatY = 1) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  texCache.set(key, t);
  return t;
}
const floral = (bg, fl) =>
  tex(`fl${bg}${fl}`, (x) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, 64, 64);
    for (const [cx, cy] of [[16, 16], [48, 44], [44, 8], [10, 50]]) {
      x.fillStyle = fl;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        x.beginPath();
        x.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5, 0, 7);
        x.fill();
      }
      x.fillStyle = '#ffe14d';
      x.beginPath();
      x.arc(cx, cy, 3.5, 0, 7);
      x.fill();
    }
  }, 3, 2);
const checker = (a, b) =>
  tex(`ck${a}${b}`, (x) => {
    x.fillStyle = a;
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = b;
    x.globalAlpha = 0.75;
    x.fillRect(0, 0, 32, 64);
    x.fillRect(0, 0, 64, 32);
    x.globalAlpha = 1;
    x.fillStyle = '#fff';
    x.fillRect(30, 0, 3, 64);
    x.fillRect(0, 30, 64, 3);
  }, 6, 1);
const sinCloth = (a, b) =>
  tex(`sn${a}${b}`, (x) => {
    x.fillStyle = a;
    x.fillRect(0, 0, 64, 64);
    x.strokeStyle = b;
    x.lineWidth = 3;
    for (let y = 6; y < 44; y += 10) {
      x.beginPath();
      for (let i = 0; i <= 8; i++) x.lineTo(i * 8, y + (i % 2 ? 5 : 0));
      x.stroke();
    }
    x.fillStyle = '#e8b530';
    x.fillRect(0, 46, 64, 12);
    x.fillStyle = a;
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 2, 50, 4, 4);
  }, 4, 1);
const sequin = (bg) =>
  tex(`sq${bg}`, (x) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = ['#fff', '#ffe14d', '#ffd0f0'][i % 3];
      x.fillRect((i * 37) % 64, (i * 53) % 64, 3, 3);
    }
  }, 3, 2);

// ---------- วัสดุ (แคชไว้ใช้ซ้ำ) ----------
const matCache = new Map();
function mat(color, map = null, extra = null) {
  const key = `${color}|${map ? map.uuid : ''}|${extra ? JSON.stringify(extra) : ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: map ? 0xffffff : color, map, ...extra });
    matCache.set(key, m);
  }
  return m;
}
const beamMat = (color) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

const SKIN = ['#ffd9b8', '#f6c49c', '#e9b184', '#d9a070', '#c68a5a'];
const HAIR = ['#141012', '#2a1a12', '#3b2416', '#5a3420', '#7a4a22', '#b0562a'];
const BRIGHT = ['#e91e63', '#ff5fa2', '#ff9800', '#ffd21f', '#22b573', '#16a3d8', '#3f51d1', '#8e44d6', '#e53935', '#00bfa5'];
const SILK = ['#c2185b', '#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f', '#ad1457', '#b71c1c'];
const DENIM = ['#2f4f9a', '#3d63b8', '#24386e', '#5b7fc7'];
const DARK = ['#1d1d28', '#2b2330', '#3a2a1a', '#18304a'];
const OUTFITS = ['thai', 'thai', 'floral', 'floral', 'mohom', 'dress', 'hangkreng', 'suit'];
const DANCES = 12;

function mesh(geo, material, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const POSE_KEYS = ['lo', 'lf', 'le', 'ro', 'rf', 're', 'twist', 'sway', 'bounce', 'lean', 'legL', 'legR', 'legLz', 'legRz', 'sx', 'nod'];

// ---------- เอฟเฟกต์ประกายแสง (ใช้ตอนได้ขึ้นเวที) ----------
const effects = [];
const ringGeo = new THREE.RingGeometry(0.8, 1.0, 40).rotateX(-Math.PI / 2);
export function burst(scene, pos, color = 0xffd54a, n = 46) {
  const dirs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 1.2, r = 0.5 + Math.random();
    dirs.set([Math.cos(a) * r, up, Math.sin(a) * r], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.28, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.position.copy(pos);
  pts.position.y += 0.8;
  pts.frustumCulled = false;
  const ring = new THREE.Mesh(ringGeo, beamMat(color));
  ring.position.copy(pos);
  ring.position.y += 0.06;
  scene.add(pts, ring);
  effects.push({ pts, ring, dirs, t: 0 });
}
export function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = e.t / 1.1;
    if (k >= 1) {
      e.pts.removeFromParent();
      e.ring.removeFromParent();
      e.pts.geometry.dispose();
      e.pts.material.dispose();
      e.ring.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    const arr = e.pts.geometry.attributes.position.array;
    const d = (1 - Math.exp(-4 * e.t)) * 2.6;
    for (let j = 0; j < arr.length; j += 3) {
      arr[j] = e.dirs[j] * d;
      arr[j + 1] = e.dirs[j + 1] * d - e.t * e.t * 2.2;
      arr[j + 2] = e.dirs[j + 2] * d;
    }
    e.pts.geometry.attributes.position.needsUpdate = true;
    e.pts.material.opacity = 1 - k;
    e.ring.scale.setScalar(1 + k * 4);
    e.ring.material.opacity = 0.7 * (1 - k);
  }
}

export class Character {
  constructor(id) {
    const r = (this.rand = rng(hash(String(id))));
    this.root = new THREE.Group();
    this.size = CHAR_SCALE * (0.92 + r() * 0.16);
    this.yaw = (r() - 0.5) * 0.5;
    this.phase = Math.floor(r() * 4) / 2;
    this.dance = Math.floor(r() * DANCES);
    this.danceSeed = Math.floor(r() * 1000);
    this.energy = 0.9 + r() * 0.35; // บางคนเต้นแรงกว่าคนอื่น
    this.faceYaw = this.yaw;
    this.danceYaw = 0;
    this.dur = 1;
    this.eating = false; // กำลังกินของหน้าร้าน
    this.calm = false; // คนขาย: โยกเบา ๆ
    this.lookYaw = null; // หันหน้าไปทางนี้ (เช่น หันเข้าร้าน)
    this.pose = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
    this.target = { ...this.pose };
    this.state = 'spawn';
    this.t = 0;
    this.home = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.spinT = -1;
    this.jumpT = -1;
    this.fxMesh = null;
    this.dead = false;
    this.build(r);
    this.root.scale.setScalar(0.001);
  }

  build(r) {
    const skin = mat(pick(r, SKIN));
    const hairM = mat(pick(r, HAIR));
    const outfit = pick(r, OUTFITS);
    const femme = outfit === 'thai' || outfit === 'dress' || outfit === 'hangkreng' ? true : r() < 0.4;
    const c1 = pick(r, BRIGHT);
    const c2 = pick(r, BRIGHT);
    const silk = pick(r, SILK);

    let top, sleeve, bottom = null, skirt = null, legM = skin, longSleeve = false;
    switch (outfit) {
      case 'thai':
        top = mat(silk);
        sleeve = skin;
        skirt = { geo: G.sin, m: mat(0, sinCloth(pick(r, SILK), '#ffe7a0')) };
        break;
      case 'floral':
        top = mat(0, floral(c1, r() < 0.5 ? '#ffffff' : c2));
        sleeve = top;
        if (femme && r() < 0.5) skirt = { geo: G.sin, m: mat(0, sinCloth(pick(r, SILK), '#ffe7a0')) };
        else bottom = legM = mat(pick(r, DENIM));
        break;
      case 'mohom':
        top = mat('#27408b');
        sleeve = top;
        longSleeve = r() < 0.5;
        bottom = legM = mat(pick(r, DARK));
        break;
      case 'dress':
        top = mat(c1);
        sleeve = skin;
        skirt = { geo: G.skirt, m: mat(c1, null, { side: THREE.DoubleSide }), ruffle: mat(c2, null, { side: THREE.DoubleSide }) };
        break;
      case 'hangkreng':
        top = mat(0, sequin(c1));
        sleeve = skin;
        skirt = { geo: G.skirt, m: mat(0, sequin(c1), { side: THREE.DoubleSide }) };
        break;
      default: // suit ลูกทุ่ง
        top = mat(0, sequin(silk));
        sleeve = top;
        longSleeve = true;
        bottom = legM = mat(pick(r, ['#f5f5f5', '#1d1d28', silk]));
    }

    const body = (this.body = group(this.root));
    const hips = (this.hips = group(body, 0, 0.62, 0));
    const shoeM = mat(pick(r, ['#111111', '#ffffff', '#b71c1c', '#e8b530']));

    // ขา
    this.legs = [-1, 1].map((s) => {
      const leg = group(hips, s * 0.1, 0, 0);
      mesh(G.leg, legM, leg, 0, 0, 0, 1, 0.58, 1);
      mesh(G.shoe, shoeM, leg, 0, -0.585, 0.04);
      return leg;
    });
    if (skirt) {
      mesh(skirt.geo, skirt.m, hips);
      if (skirt.ruffle) mesh(G.ruffle, skirt.ruffle, hips);
    } else {
      mesh(G.hip, bottom, hips);
    }

    // ลำตัว
    const torso = (this.torso = group(hips));
    mesh(G.torso, top, torso);
    if (outfit === 'thai') {
      const sash = mesh(G.sash, mat(pick(r, ['#ffd21f', '#ff8fc0', '#fff1c0', '#7fe0ff'])), torso, 0, 0.27, 0);
      sash.rotation.set(Math.PI / 2, 0.75, 0);
      sash.scale.set(1.05, 1.05, 1.6);
      mesh(G.band, mat('#e8b530'), torso, 0, 0.03, 0, 1, 0.7, 1);
    }
    if (outfit === 'mohom' || (outfit === 'floral' && r() < 0.35)) {
      mesh(G.band, mat(0, checker(pick(r, ['#c62828', '#1565c0', '#2e7d32', '#6a1b9a']), '#ffffff')), torso, 0, 0.04, 0, 1.02, 1.3, 1.02);
    }
    if (r() < 0.3 || outfit === 'suit') {
      const g = mesh(G.garland, mat(pick(r, ['#ffd21f', '#ff9800', '#ffffff'])), torso, 0, 0.42, 0.03);
      g.rotation.x = Math.PI / 2 - 0.35;
      g.scale.set(1.15, 1.5, 1);
    }
    if (outfit === 'hangkreng') {
      // พู่ขนนกด้านหลังแบบหางเครื่อง
      const fm = mat(c2, null, { emissive: c2, emissiveIntensity: 0.35 });
      for (let i = -2; i <= 2; i++) {
        const f = mesh(G.feather, fm, torso, i * 0.06, 0.3, -0.16, 1.3);
        f.rotation.set(-0.35, 0, -i * 0.38);
      }
    }

    // แขน
    this.arms = [-1, 1].map((s) => {
      const arm = group(torso, s * 0.245, 0.4, 0);
      mesh(G.limb, sleeve, arm, 0, 0, 0, sleeve === skin ? 1 : 1.25, 0.24, sleeve === skin ? 1 : 1.25);
      const fore = group(arm, 0, -0.24, 0);
      mesh(G.limb, longSleeve ? sleeve : skin, fore, 0, 0, 0, 0.95, 0.22, 0.95);
      mesh(G.ball, skin, fore, 0, -0.25, 0, 0.06);
      return { arm, fore, s };
    });

    // หัว
    const head = (this.head = group(torso, 0, 0.74, 0));
    mesh(G.ball, skin, head, 0, 0, 0, 0.3, 0.29, 0.29);
    const eyeM = mat('#1a1012');
    mesh(G.ball, eyeM, head, -0.1, 0.0, 0.265, 0.035, 0.05, 0.02);
    mesh(G.ball, eyeM, head, 0.1, 0.0, 0.265, 0.035, 0.05, 0.02);
    mesh(G.ball, mat('#d8414f'), head, 0, -0.11, 0.262, 0.05, 0.022, 0.02);
    const blush = mat('#ff9aa8');
    mesh(G.ball, blush, head, -0.17, -0.07, 0.225, 0.04, 0.025, 0.02);
    mesh(G.ball, blush, head, 0.17, -0.07, 0.225, 0.04, 0.025, 0.02);

    // ทรงผม
    const cap = mesh(G.hairCap, hairM, head, 0, 0.01, -0.015, 0.315, 0.32, 0.315);
    cap.rotation.x = -0.28;
    const style = femme ? pick(r, ['bun', 'long', 'tails', 'long', 'bun']) : pick(r, ['short', 'pomp', 'short', 'hat']);
    if (style === 'bun') mesh(G.ball, hairM, head, 0, 0.3, -0.06, 0.13);
    if (style === 'long') mesh(G.ball, hairM, head, 0, -0.14, -0.14, 0.27, 0.36, 0.2);
    if (style === 'tails') {
      mesh(G.ball, hairM, head, -0.3, -0.02, -0.05, 0.11, 0.17, 0.11);
      mesh(G.ball, hairM, head, 0.3, -0.02, -0.05, 0.11, 0.17, 0.11);
    }
    if (style === 'pomp') mesh(G.ball, hairM, head, 0, 0.24, 0.14, 0.2, 0.11, 0.15);
    if (style === 'hat') {
      const straw = mat('#e3c27a');
      mesh(G.brim, straw, head, 0, 0.2, 0);
      mesh(G.cone, straw, head, 0, 0.3, 0, 0.3, 0.22, 0.3);
    }
    // เครื่องประดับ
    if (outfit === 'thai' && r() < 0.45) {
      const gold = mat('#f2c230', null, { emissive: '#8a5a00' });
      mesh(G.band, gold, head, 0, 0.27, -0.03, 0.75, 0.8, 0.75);
      mesh(G.cone, gold, head, 0, 0.47, -0.03, 0.09, 0.36, 0.09);
    } else if (outfit === 'hangkreng') {
      const fm = mat(c2, null, { emissive: c2, emissiveIntensity: 0.35 });
      for (let i = -1; i <= 1; i++) {
        const f = mesh(G.feather, fm, head, i * 0.07, 0.24, -0.05, 0.9);
        f.rotation.z = -i * 0.4;
      }
    } else if (femme && r() < 0.6) {
      mesh(G.ball, mat(pick(r, ['#ff4f8b', '#ffd21f', '#ffffff', '#ff7043'])), head, 0.25, 0.14, 0.1, 0.07);
    }
  }

  // ---------- คำสั่งจากภายนอก ----------
  spawnAt(pos, scene) {
    this.home.copy(pos);
    this.root.position.copy(pos);
    this.state = 'spawn';
    this.t = 0;
    if (scene) this.flash(scene, 0x7fe9ff);
  }
  // promote = true: เด้งตัวลอยขึ้นกลางแสงสปอตไลต์ก่อน แล้วพุ่งขึ้นเวที
  moveTo(pos, scene, promote = false) {
    this.from.copy(this.root.position);
    this.from.y = this.home.y;
    this.home.copy(pos);
    this.eating = false;
    this.lookYaw = null;
    this.state = promote ? 'promote' : 'move';
    this.t = 0;
    if (promote) {
      this.flash(scene, 0xffe27a, this.from, 2.4, true);
      burst(scene, this.from, 0xffd54a);
    } else this.flash(scene, 0xffd54a, pos);
  }
  // เดินไปตำแหน่งใหม่ (สลับที่กัน)
  walkTo(pos) {
    if (this.state !== 'idle') return false;
    this.from.copy(this.root.position);
    this.from.y = this.home.y;
    this.home.copy(pos);
    this.dur = Math.max(0.8, this.from.distanceTo(pos) / 1.9);
    this.state = 'walk';
    this.t = 0;
    return true;
  }
  leave(scene) {
    if (this.state === 'leave') return;
    this.state = 'leave';
    this.t = 0;
    this.flash(scene, 0xff7ad9);
  }
  spin() {
    this.spinT = 0;
  }
  jump() {
    if (this.jumpT < 0) this.jumpT = 0;
  }
  flash(scene, color, pos = this.root.position, dur = 0.8, follow = false) {
    this.clearFx();
    const m = new THREE.Mesh(G.beam, beamMat(color));
    m.position.copy(pos);
    scene.add(m);
    this.fxMesh = m;
    this.fxT = 0;
    this.fxDur = dur;
    this.fxFollow = follow;
  }
  clearFx() {
    if (!this.fxMesh) return;
    this.fxMesh.removeFromParent();
    this.fxMesh.material.dispose();
    this.fxMesh = null;
  }
  dispose() {
    this.clearFx();
    this.root.removeFromParent();
  }

  // ---------- ท่าเต้น ----------
  computeDance(b) {
    const T = this.target;
    const PI = Math.PI;
    const E = this.energy;
    const s1 = Math.sin(PI * b); // 1 รอบ / 2 จังหวะ
    const s2 = Math.sin(PI * b * 0.5); // 1 รอบ / 4 จังหวะ
    const s4 = Math.sin(PI * b * 2); // 1 รอบ / จังหวะ
    const hit = Math.abs(s1); // กระแทกทุกจังหวะ
    const even = Math.floor(b) % 2 === 0;
    // เปลี่ยนท่าทุก 8 จังหวะ แต่ละคนไล่ท่าไม่เหมือนกัน
    const dance = (this.dance + Math.floor((b + this.danceSeed) / 8) * (1 + (this.danceSeed % 5))) % DANCES;
    T.twist = 0; T.lean = 0; T.sx = 0; T.legLz = 0; T.legRz = 0;
    T.nod = s1 * 0.12;
    T.bounce = hit * 0.09;
    T.sway = s2 * 0.14;
    T.legL = Math.max(0, s1) * 0.5;
    T.legR = Math.max(0, -s1) * 0.5;
    this.danceYaw = 0;
    switch (dance) {
      case 0: { // รำวง: ตั้งวง-จีบ สลับมือสูงต่ำ
        const k = (s2 + 1) / 2;
        T.lf = 0.7 + k * 0.9; T.le = 1.1 - k * 0.5; T.lo = 0.5;
        T.rf = 1.6 - k * 0.9; T.re = 0.6 + k * 0.5; T.ro = 0.5;
        T.sway = s2 * 0.24; T.twist = s2 * 0.25; T.bounce = hit * 0.06;
        break;
      }
      case 1: // ชูมือโบกสุดแขน
        T.lo = 2.6 + s1 * 0.45; T.ro = 2.6 - s1 * 0.45;
        T.lf = T.rf = 0.1; T.le = T.re = 0.3 + hit * 0.3;
        T.bounce = hit * 0.2; T.sway = s1 * 0.22;
        break;
      case 2: // ทวิสต์
        T.twist = s1 * 0.85;
        T.lo = T.ro = 0.4;
        T.lf = 0.6 + s1 * 0.7; T.rf = 0.6 - s1 * 0.7;
        T.le = T.re = 1.5;
        T.lean = 0.16; T.bounce = hit * 0.1; T.sway = -s1 * 0.2;
        T.legLz = T.legRz = 0.15;
        break;
      case 3: { // ดิสโก้ ชี้ฟ้าสลับข้าง มืออีกข้างเท้าเอว
        const left = Math.floor(b / 2) % 2 === 0;
        const up = 2.25 + hit * 0.4;
        T.lo = left ? up : 0.8; T.ro = left ? 0.8 : up;
        T.lf = left ? 0.3 : 0; T.rf = left ? 0 : 0.3;
        T.le = left ? 0.1 : 1.9; T.re = left ? 1.9 : 0.1;
        T.sway = (left ? 1 : -1) * 0.26; T.twist = (left ? -1 : 1) * 0.3; T.bounce = hit * 0.13;
        break;
      }
      case 4: { // ก้าวซ้ายขวา + ปรบมือ
        const clap = (Math.cos(PI * 2 * b) + 1) / 2;
        T.lo = T.ro = 0.6 - clap * 0.8;
        T.lf = T.rf = 1.3; T.le = T.re = 0.7;
        T.sx = s2 * 0.38; T.sway = -s2 * 0.18; T.bounce = hit * 0.12;
        T.legLz = Math.max(0, s2) * 0.4; T.legRz = Math.max(0, -s2) * 0.4;
        break;
      }
      case 5: // ฟ้อนกางแขน พลิ้วมือ
        T.lo = 1.4 + s2 * 0.45; T.ro = 1.4 - s2 * 0.45;
        T.lf = T.rf = 0.3;
        T.le = 0.8 + s1 * 0.7; T.re = 0.8 - s1 * 0.7;
        T.sway = s2 * 0.28; T.bounce = hit * 0.07;
        break;
      case 6: // กระโดดชูกำปั้นสลับ
        T.lo = T.ro = 0.35;
        T.lf = even ? 2.8 : 1.2; T.rf = even ? 1.2 : 2.8;
        T.le = even ? 0.2 : 1.7; T.re = even ? 1.7 : 0.2;
        T.bounce = hit * 0.3; T.legL = T.legR = hit * 0.25; T.nod = s4 * 0.15;
        break;
      case 7: // เตะขาสลับ
        T.legL = even ? hit * 1.1 : 0; T.legR = even ? 0 : hit * 1.1;
        T.lo = T.ro = 0.9;
        T.lf = even ? -0.5 : 0.9; T.rf = even ? 0.9 : -0.5;
        T.le = T.re = 0.9;
        T.lean = -0.12; T.bounce = hit * 0.16;
        break;
      case 8: { // กระโดดตบ
        const open = even ? 1 : 0;
        T.legLz = T.legRz = open * 0.5; T.legL = T.legR = 0;
        T.lo = T.ro = 0.4 + open * 2.3;
        T.lf = T.rf = 0; T.le = T.re = 0.2;
        T.bounce = hit * 0.26;
        break;
      }
      case 9: { // หมุนตัวกางแขน
        const ph = (b % 8) / 8;
        const e = ph < 0.5 ? 0 : (ph - 0.5) * 2;
        this.danceYaw = e * e * (3 - 2 * e) * PI * 2;
        T.lo = T.ro = 1.5 + s1 * 0.3;
        T.lf = T.rf = 0.2; T.le = T.re = 0.5 + hit * 0.5;
        T.sway = s1 * 0.25; T.bounce = hit * 0.14;
        break;
      }
      case 10: // เขย่าไหล่ ย่อโยก
        T.twist = s4 * 0.38;
        T.lo = T.ro = 1.15; T.lf = T.rf = 0.5;
        T.le = T.re = 1.8;
        T.lean = 0.28; T.sway = s1 * 0.2; T.bounce = hit * 0.1;
        T.legLz = T.legRz = 0.28; T.legL = T.legR = 0;
        break;
      default: { // โบกแขนเป็นคลื่น ซ้าย-ขวา
        T.lo = 1.6 + s1 * 0.9; T.ro = 1.6 - s1 * 0.9;
        T.lf = T.rf = 0.15;
        T.le = 0.4 + Math.max(0, -s1) * 0.9; T.re = 0.4 + Math.max(0, s1) * 0.9;
        T.sway = s1 * 0.3; T.sx = s1 * 0.2; T.bounce = hit * 0.12;
      }
    }
    // ความแรงเฉพาะตัว
    T.bounce *= E; T.sway *= E; T.twist *= E; T.sx *= E;
    if (this.calm) {
      T.bounce *= 0.3; T.sx = 0; T.legL = T.legR = T.legLz = T.legRz = 0; T.twist *= 0.4;
      this.danceYaw = 0;
      T.lo = 0.35; T.ro = 0.35; T.lf = 0.9 + s2 * 0.3; T.rf = 0.9 - s2 * 0.3; T.le = T.re = 1.2;
    }
    if (this.eating && this.state === 'idle') {
      // ยืนกิน: มือขวาป้อนเข้าปาก มือซ้ายถือของ
      const bite = (Math.sin(this.t * 5) + 1) / 2;
      T.twist = 0; T.sx = 0; T.lean = 0.05; T.sway = s2 * 0.05; T.bounce = 0;
      T.legL = T.legR = T.legLz = T.legRz = 0;
      T.ro = 0.25; T.rf = 0.9 + bite * 0.5; T.re = 1.5 + bite * 0.8;
      T.lo = 0.3; T.lf = 0.7; T.le = 1.3;
      T.nod = 0; this.danceYaw = 0;
    }
    if (this.state === 'walk') {
      // กำลังเดิน: ก้าวขาตามจังหวะเดิน แขนแกว่ง
      const w = Math.sin(this.t * 9);
      T.legL = Math.max(0, w) * 0.9 - Math.max(0, -w) * 0.5;
      T.legR = Math.max(0, -w) * 0.9 - Math.max(0, w) * 0.5;
      T.legLz = T.legRz = 0; T.sx = 0; T.twist = 0;
      T.bounce = Math.abs(w) * 0.07;
      this.danceYaw = 0;
    }
  }

  update(dt, beat, scene) {
    const b = beat + this.phase;
    this.computeDance(b);
    const k = 1 - Math.exp(-dt * 18);
    const P = this.pose;
    for (const key of POSE_KEYS) P[key] += (this.target[key] - P[key]) * k;

    const [R, L] = this.arms;
    L.arm.rotation.set(-P.lf, 0, P.lo);
    L.fore.rotation.set(-P.le, 0, 0);
    R.arm.rotation.set(-P.rf, 0, -P.ro);
    R.fore.rotation.set(-P.re, 0, 0);
    this.torso.rotation.set(P.lean, P.twist, -P.sway * 0.6);
    this.hips.rotation.z = P.sway;
    this.head.rotation.set(0, -P.twist * 0.6, P.nod);
    this.legs[0].rotation.set(-P.legR, 0, -P.legRz);
    this.legs[1].rotation.set(-P.legL, 0, P.legLz);
    this.body.position.set(P.sx, P.bounce, 0);

    // ---------- สถานะ: โผล่ / ย้ายขึ้น-ลงเวที / วาร์ปหาย ----------
    const root = this.root;
    let sx = 1, sy = 1, lift = 0, boost = 1, promoYaw = 0, want = this.lookYaw ?? this.yaw;
    this.t += dt;
    if (this.state === 'walk') {
      const t = Math.min(1, this.t / this.dur);
      const e = t * t * (3 - 2 * t);
      root.position.lerpVectors(this.from, this.home, e);
      want = Math.atan2(this.home.x - this.from.x, this.home.z - this.from.z);
      if (t >= 1) this.state = 'idle';
    }
    // หันหน้าแบบนุ่ม ๆ (หันตามทางเดิน แล้วหันกลับมาหากล้อง)
    let dy = want - this.faceYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.faceYaw += dy * (1 - Math.exp(-dt * 8));
    let yaw = this.faceYaw + this.danceYaw;
    if (this.state === 'spawn') {
      const t = Math.min(1, this.t / 0.6);
      const e = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); // easeOutBack
      sx = sy = Math.max(0.001, e);
      if (t >= 1) this.state = 'idle';
    } else if (this.state === 'move') {
      const t = Math.min(1, this.t / 1.3);
      const e = t * t * (3 - 2 * t);
      root.position.lerpVectors(this.from, this.home, e);
      lift = Math.sin(Math.PI * t) * 3.2;
      yaw += e * Math.PI * 4;
      if (t >= 1) this.state = 'idle';
    } else if (this.state === 'promote') {
      const A = 0.9, B = 1.4;
      if (this.t < A) {
        // เด้งตัวลอยขึ้น ตัวขยาย หมุนโชว์
        const u = this.t / A;
        const e = 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
        root.position.copy(this.from);
        lift = e * 3.4;
        boost = 1 + 0.75 * e;
        promoYaw = u * Math.PI * 4;
      } else {
        // พุ่งโค้งขึ้นเวที
        const u = Math.min(1, (this.t - A) / B);
        const e = u * u * (3 - 2 * u);
        root.position.lerpVectors(this.from, this.home, e);
        lift = (1 - e) * 3.4 + Math.sin(Math.PI * u) * 2.4;
        boost = 1.75 - 0.75 * e;
        promoYaw = e * Math.PI * 4;
        if (u >= 1) {
          this.state = 'idle';
          burst(scene, this.home, 0xff7ad9);
          this.jumpT = 0;
        }
      }
    } else if (this.state === 'leave') {
      const t = Math.min(1, this.t / 0.6);
      sx = Math.max(0.001, 1 - t * t);
      sy = 1 + t * 2.5;
      lift = t * t * 2;
      yaw += t * 10;
      if (t >= 1) this.dead = true;
    }
    if (this.state === 'idle') root.position.copy(this.home);

    if (this.spinT >= 0) {
      this.spinT += dt;
      const t = Math.min(1, this.spinT / 1.2);
      yaw += (1 - Math.pow(1 - t, 3)) * Math.PI * 4;
      lift += Math.sin(Math.PI * t) * 0.5;
      if (t >= 1) this.spinT = -1;
    }
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const t = Math.min(1, this.jumpT / 0.45);
      lift += Math.sin(Math.PI * t) * 0.45;
      if (t >= 1) this.jumpT = -1;
    }
    if (this.state !== 'move' && this.state !== 'walk' && this.state !== 'promote') root.position.y = this.home.y;
    root.position.y += lift;
    root.rotation.y = yaw + promoYaw;
    root.scale.set(this.size * sx * boost, this.size * sy * boost, this.size * sx * boost);

    if (this.fxMesh) {
      this.fxT += dt;
      const t = this.fxT / this.fxDur;
      if (t >= 1) this.clearFx();
      else if (this.fxFollow) {
        // สปอตไลต์ตามตัว
        this.fxMesh.position.set(root.position.x, root.position.y - 1.5, root.position.z);
        this.fxMesh.material.opacity = 0.55 * Math.min(1, (1 - t) * 3) * (0.8 + 0.2 * Math.sin(this.fxT * 30));
        this.fxMesh.scale.set(1.5, 2, 1.5);
      } else {
        this.fxMesh.material.opacity = 0.4 * (1 - t);
        this.fxMesh.scale.set(1 - t * 0.6, 1 + t, 1 - t * 0.6);
      }
    }
  }
}
