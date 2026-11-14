// เวทีหมอลำ: โครงทรัส ฉากลายกนกเรืองแสง ไฟวิ่ง ลำแสง ลำโพง ป้ายชื่อคณะ
import * as THREE from 'three';

import { Character } from './character.js';

export const STAGE_Y = 2.9; // ความสูงพื้นเวที (สูงกว่าหัวคนลานล่าง)
const Z_FRONT = -1;
const TAN_H = 0.262; // tan(ครึ่งมุมมองแนวนอน) ของจอ 9:16

// ---------- ธีมฉากเวที ----------
export const THEMES = {
  kanok: {
    label: 'กนกชมพู-ทอง', wall: 0x0c0618, floor: 0x4a2a7a, riser: 0xff2d95, shape: 'kanok', center: 'curtain',
    tri: [0xffd21f, 0xd4145a, 0xffd21f, 0xff2d95, 0xff7a1a], arch: [0xffd21f, 0xff2d95, 0xffd21f], curtain: ['#8e0f5c', '#c2187e'],
    side: [[0xffd21f, 0xff2d95, 0xffd21f], [0xffd21f, 0x21c8ff, 0xffffff], [0xffd21f, 0xff7a1a, 0xffd21f]], crest: [0xffd21f, 0x37e36b, 0xffd21f],
    sign: ['#b3005c', '#ff2d95'],
  },
  naga: {
    label: 'พญานาคน้ำเงิน-ทอง', wall: 0x081650, floor: 0x1a2f8a, riser: 0x21c8ff, shape: 'kanok', center: 'curtain',
    tri: [0xffd21f, 0x1238b8, 0x21c8ff, 0x0d2a8a, 0xffd21f], arch: [0xffd21f, 0x1e6bff, 0xffd21f], curtain: ['#0b2a9a', '#1f55d8'],
    side: [[0xffd21f, 0x16b8a6, 0xffd21f], [0xffd21f, 0x1e6bff, 0xffffff], [0xffd21f, 0x37e36b, 0xffd21f]], crest: [0xffd21f, 0x16b8a6, 0xffd21f],
    sign: ['#0b2a9a', '#21c8ff'],
  },
  diamond: {
    label: 'เพชรทอง ม่านแดง', wall: 0x12060a, floor: 0x7a2a4a, riser: 0xffd21f, shape: 'diamond', center: 'curtain',
    tri: [0xffd21f, 0x3a0a1a, 0xff8fc0, 0x3a0a1a], arch: [0xffd21f, 0xfff1a8, 0xffd21f], curtain: ['#7a0a16', '#b3121f'],
    side: [[0xffd21f, 0xff8fc0, 0xffd21f], [0xffd21f, 0xb14dff, 0xffffff], [0xffd21f, 0xff8fc0, 0xffd21f]], crest: [0xffd21f, 0xff8fc0, 0xffffff],
    sign: ['#7a0a16', '#ffb300'],
  },
  moon: {
    label: 'จันทร์แดง', wall: 0x1a0508, floor: 0x5a1420, riser: 0xff3b30, shape: 'kanok', center: 'moon',
    tri: [0xffd21f, 0xb3121f, 0xffd21f, 0x7a0a16, 0xff7a1a], arch: [0xffd21f, 0xff3b30, 0xffd21f], curtain: ['#3a0508', '#5a0a10'],
    side: [[0xffd21f, 0xff3b30, 0xffd21f], [0xffd21f, 0xb14dff, 0xffd21f], [0xffd21f, 0xff7a1a, 0xffffff]], crest: [0xffd21f, 0xff3b30, 0xffd21f],
    sign: ['#7a0a16', '#ff3b30'],
  },
};
export const FOOD = ['🥗', '🍗', '🍢', '🍧', '🍙', '🧋'];

const NEON = [0xff2d95, 0xffd21f, 0x21c8ff, 0x37e36b, 0xff7a1a, 0xb14dff];

const basic = (color, extra) => new THREE.MeshBasicMaterial({ color, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- ลายกนก (เปลวไฟ) ----------
function kanokShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.9, 0.1, 1.0, 1.0, 0.35, 1.5);
  s.bezierCurveTo(0.2, 1.65, 0.25, 1.9, 0.5, 2.1);
  s.bezierCurveTo(0.0, 2.0, -0.25, 1.6, -0.05, 1.2);
  s.bezierCurveTo(0.15, 0.8, -0.1, 0.4, -0.5, 0.3);
  s.bezierCurveTo(-0.3, 0.2, -0.1, 0.1, 0, 0);
  return s;
}
function diamondShape() {
  const s = new THREE.Shape();
  s.moveTo(0.1, 0);
  s.lineTo(0.8, 1.35);
  s.lineTo(0.45, 1.9);
  s.lineTo(-0.25, 1.9);
  s.lineTo(-0.6, 1.35);
  s.closePath();
  return s;
}
function archShape(w, h) {
  // ซุ้มโค้ง: สี่เหลี่ยม + ครึ่งวงกลมด้านบน
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}
function triShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(w / 2, 0);
  s.closePath();
  return s;
}

export function stageRowSize(width) {
  return Math.max(3, Math.floor((width - 2) / 1.7) + 1);
}

export function buildStage(scene, opts = {}) {
  const W = Math.max(8, Math.min(22, Number(opts.width) || 13)); // ความกว้างเวที
  const theme = THEMES[opts.theme] || THEMES.kanok;
  const HALF_W = W / 2;
  const TOWER_X = HALF_W + 0.7;
  const S = Math.max(1, Math.min(1.7, W / 9.2)); // สัดส่วนฉากหลังตามความกว้าง
  const Z_BACK = -1 - (6.2 + (S - 1) * 2.4);
  const MID_Z = (Z_FRONT + Z_BACK) / 2;
  const TRUSS_Y = STAGE_Y + 6.4 * S;
  const VIEW = TOWER_X + 3.5; // ครึ่งความกว้างที่กล้องต้องเห็นครบ
  const CAM_Z = -1 + VIEW / TAN_H; // ตำแหน่งกล้องอัตโนมัติ (จอแนวตั้ง)
  const root = new THREE.Group();
  scene.add(root);
  const add = (geo, material, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- ท้องฟ้า / พื้นลานวัด ----------
  scene.background = new THREE.Color(0x070312);
  scene.fog = new THREE.Fog(0x070312, 45, 110);
  {
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = 4 + Math.random() * 60;
      pos[i * 3 + 2] = -45 - Math.random() * 20;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff3c4, size: 0.25, fog: false })));
  }
  const groundTex = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#a8683a');
    g.addColorStop(0.55, '#6b3d22');
    g.addColorStop(1, '#1a2414');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 220 : 0},${i % 2 ? 170 : 0},0.06)`;
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  const ground = add(new THREE.PlaneGeometry(70, 70), new THREE.MeshLambertMaterial({ map: groundTex }), 0, 0, 4);
  ground.rotation.x = -Math.PI / 2;
  const far = add(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x1a2414 }), 0, -0.02, 0);
  far.rotation.x = -Math.PI / 2;

  // ---------- ตัวเวที ----------
  const skirtTex = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#1a0d3a';
    x.fillRect(0, 0, w, h);
    const cols = ['#ff2d95', '#ffd21f', '#21c8ff'];
    for (let i = 0; i < 16; i++) {
      x.fillStyle = cols[i % 3];
      x.fillRect(i * 16 + 3, 8, 10, h - 16);
    }
    x.fillStyle = '#ffd21f';
    x.fillRect(0, 0, w, 5);
    x.fillRect(0, h - 5, w, 5);
  });
  const floorM = new THREE.MeshLambertMaterial({ color: theme.floor });
  const sideM = new THREE.MeshLambertMaterial({ color: 0x1a0d3a });
  const skirtM = basic(0xb0b0b0, { map: skirtTex });
  const D = Z_FRONT - Z_BACK;
  add(new THREE.BoxGeometry(HALF_W * 2, STAGE_Y, D), [sideM, sideM, floorM, sideM, skirtM, sideM], 0, STAGE_Y / 2, (Z_FRONT + Z_BACK) / 2);
  // ยกพื้นแถวหลัง
  const RISER = 0.45;
  add(new THREE.BoxGeometry(HALF_W * 2 - 0.6, RISER, 2.6), [sideM, sideM, new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.floor).multiplyScalar(1.35) }), sideM, basic(theme.riser), sideM], 0, STAGE_Y + RISER / 2, Z_BACK + 2.1);
  // บันไดกลาง
  for (let i = 0; i < 7; i++) {
    const hgt = STAGE_Y * (1 - (i + 1) / 8);
    add(
      new THREE.BoxGeometry(3, hgt, 0.36),
      [sideM, sideM, new THREE.MeshLambertMaterial({ color: 0xd9a21e }), sideM, basic(i % 2 ? 0x9a6a10 : 0xb98414), sideM],
      0, hgt / 2, Z_FRONT + 0.18 + i * 0.36
    );
  }

  // ---------- ฉากหลังลายไทย ----------
  const back = new THREE.Group();
  back.position.set(0, STAGE_Y, Z_BACK + 0.5);
  back.scale.set(S, S, 1);
  root.add(back);
  const flat = (shape, color, x, y, z, sx = 1, sy = sx) => {
    const m = add(new THREE.ShapeGeometry(shape, 10), basic(color, { side: THREE.DoubleSide }), x, y, z, back);
    m.scale.set(sx, sy, 1);
    return m;
  };
  // ผนังดำด้านหลัง กันมองทะลุ
  add(new THREE.PlaneGeometry((TOWER_X * 2) / S, 6.4), basic(theme.wall), 0, 3.2, -0.3, back);
  // สามเหลี่ยมซ้อนชั้น (หน้าบัน)
  const triSize = [[9.6, 5.9], [9.0, 5.5], [7.6, 4.7], [7.0, 4.3], [5.6, 3.5]];
  theme.tri.forEach((c, i) => flat(triShape(...triSize[i]), c, 0, 0, -0.2 + i * 0.02));
  // ซุ้มประตูกลาง + ม่าน
  const curtainTex = canvasTex(128, 128, (x, w, h) => {
    for (let i = 0; i < 16; i++) {
      x.fillStyle = theme.curtain[i % 2];
      x.fillRect(i * 8, 0, 8, h);
    }
    x.fillStyle = '#ffd21f';
    for (let i = 0; i < 40; i++) x.fillRect((i * 29) % w, (i * 47) % h, 2, 2);
  });
  flat(archShape(3.9, 4.25), theme.arch[0], 0, 0, 0);
  flat(archShape(3.5, 4.05), theme.arch[1], 0, 0, 0.02);
  flat(archShape(3.1, 3.85), theme.arch[2], 0, 0, 0.04);
  {
    const geo = new THREE.ShapeGeometry(archShape(2.8, 3.7), 12);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.8 + 0.5, uv.getY(i) / 3.7);
    add(geo, basic(0xffffff, { map: curtainTex }), 0, 0, 0.06, back);
  }
  if (theme.center === 'moon') {
    // พระจันทร์แดงดวงใหญ่กลางฉาก
    const moonTex = canvasTex(128, 128, (x) => {
      const g = x.createRadialGradient(52, 50, 6, 64, 64, 64);
      g.addColorStop(0, '#ff6a4a');
      g.addColorStop(0.7, '#d2141f');
      g.addColorStop(1, '#8a0a12');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      x.fillStyle = 'rgba(90,0,10,0.35)';
      for (const [cx, cy, r] of [[40, 44, 12], [78, 36, 8], [84, 78, 15], [50, 86, 9], [66, 60, 6]]) {
        x.beginPath();
        x.arc(cx, cy, r, 0, 7);
        x.fill();
      }
    });
    add(new THREE.CircleGeometry(1.25, 40), basic(0xffffff, { map: moonTex }), 0, 2.2, 0.08, back);
  }
  // กนกเปลวซ้าย-ขวา ไล่ระดับ
  const kanok = theme.shape === 'diamond' ? diamondShape() : kanokShape();
  const flame = (x, y, z, size, cOut, cIn, cCore, mirror, parent = back) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.set(mirror ? -size : size, size, 1);
    parent.add(g);
    [[1, cOut, 0, 0], [0.8, cIn, 0.01, 0.16], [0.45, cCore, 0.02, 0.5]].forEach(([s, c, dz, dy]) => {
      const m = add(new THREE.ShapeGeometry(kanok, 10), basic(c, { side: THREE.DoubleSide }), 0.02, dy, dz, g);
      m.scale.set(s, s, 1);
    });
    return g;
  };
  const flames = [];
  const sets = [
    [2.45, 0, 0.1, 1.75, ...theme.side[0]],
    [3.45, 0, 0.14, 1.35, ...theme.side[1]],
    [4.3, 0, 0.18, 1.0, ...theme.side[2]],
    [1.2, 4.0, 0.08, 0.8, ...theme.side[0]],
  ];
  for (const [x, y, z, s, a, b, c] of sets) {
    flames.push(flame(x, y, z, s, a, b, c, false), flame(-x, y, z, s, a, b, c, true));
  }
  // ยอดกลาง
  flat(triShape(1.5, 2.0), theme.crest[0], 0, 4.15, 0.07);
  flat(triShape(1.05, 1.5), theme.crest[1], 0, 4.25, 0.09);
  flat(triShape(0.55, 0.9), theme.crest[2], 0, 4.35, 0.11);

  // ---------- โครงทรัส ----------
  const trussTex = canvasTex(64, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#c9ccd6';
    x.lineWidth = 7;
    x.strokeRect(0, 3, w, h - 6);
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(0, 4);
    x.lineTo(w, h - 4);
    x.moveTo(w, 4);
    x.lineTo(0, h - 4);
    x.stroke();
  });
  trussTex.wrapS = THREE.RepeatWrapping;
  const trussM = basic(0x8d93a6, { map: trussTex, alphaTest: 0.4, side: THREE.DoubleSide });
  const truss = (len, thick, x, y, z, axis) => {
    const geo = new THREE.BoxGeometry(len, thick, thick);
    const uv = geo.attributes.uv;
    for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * Math.round(len / thick));
    const m = add(geo, trussM, x, y, z);
    if (axis === 'y') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.y = Math.PI / 2;
    return m;
  };
  const TH = 0.5;
  for (const x of [-TOWER_X, TOWER_X]) {
    for (const z of [Z_FRONT, Z_BACK + 0.3]) truss(TRUSS_Y + 0.6, TH, x, (TRUSS_Y + 0.6) / 2, z, 'y');
    truss(D - 0.3, TH, x, TRUSS_Y, (Z_FRONT + Z_BACK + 0.3) / 2, 'z');
  }
  truss(TOWER_X * 2, TH, 0, TRUSS_Y, Z_FRONT, 'x');
  truss(TOWER_X * 2, TH, 0, TRUSS_Y, Z_BACK + 0.3, 'x');
  truss(TOWER_X * 2, TH * 0.8, 0, TRUSS_Y - 0.1, MID_Z, 'x');
  truss(TOWER_X * 2, TH * 0.7, 0, TRUSS_Y - 1.5, Z_BACK + 0.3, 'x');

  // ---------- ลำโพง ----------
  // ---------- ระบบเสียงชุดใหญ่: กำแพงซับวูฟเฟอร์ + ไลน์อาร์เรย์แขวน ----------
  const cone = (x, cx, cy, r) => {
    const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#05050a');
    g.addColorStop(0.3, '#2c2c3a');
    g.addColorStop(0.8, '#15151e');
    g.addColorStop(1, '#4a4a5c');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, 7);
    x.fill();
    x.fillStyle = '#3a3a48';
    x.beginPath();
    x.arc(cx, cy, r * 0.28, 0, 7);
    x.fill();
  };
  const subTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#0a0a10';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#34343f';
    x.lineWidth = 5;
    x.strokeRect(3, 3, w - 6, h - 6);
    cone(x, 64, 64, 50);
    x.fillStyle = '#6a6a7a';
    for (const [px, py] of [[12, 12], [116, 12], [12, 116], [116, 116]]) x.fillRect(px - 3, py - 3, 6, 6);
  });
  const arrTex = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#0c0c12';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3a3a46';
    x.lineWidth = 4;
    x.strokeRect(2, 2, w - 4, h - 4);
    cone(x, 44, 32, 24);
    cone(x, 212, 32, 24);
    x.fillStyle = '#20202a';
    x.fillRect(84, 10, 88, 44);
    x.strokeStyle = '#3c3c4a';
    x.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.moveTo(88 + i * 10, 12);
      x.lineTo(88 + i * 10, 52);
      x.stroke();
    }
  });
  const boxSide = new THREE.MeshLambertMaterial({ color: 0x111118 });
  const faceMats = (tex) => [boxSide, boxSide, boxSide, boxSide, new THREE.MeshBasicMaterial({ map: tex }), boxSide];
  const SUB = 1.3; // ขนาดตู้ซับ
  const SPK_X = TOWER_X + 1.75;
  const SUB_ROWS = 3;
  const subGeo = new THREE.BoxGeometry(SUB, SUB, 1.4);
  const ringGeo = new THREE.TorusGeometry(SUB * 0.4, 0.035, 6, 28);
  const arrGeo = new THREE.BoxGeometry(2.5, 0.56, 1.0);
  const subMats = faceMats(subTex);
  const arrMats = faceMats(arrTex);
  const speakers = []; // ตู้ที่เต้นตามจังหวะ
  const spkRings = []; // วงไฟรอบดอกลำโพง
  for (const side of [-1, 1]) {
    const cx = side * SPK_X;
    // กำแพงซับ 2 x 3 ตู้
    for (let r = 0; r < SUB_ROWS; r++) for (let c = 0; c < 2; c++) {
      const m = add(subGeo, subMats, cx + (c - 0.5) * SUB, SUB / 2 + r * SUB, Z_FRONT + 0.9);
      speakers.push(m);
      const ring = add(ringGeo, basic(NEON[(r + c) % NEON.length]), m.position.x, m.position.y, Z_FRONT + 1.62);
      spkRings.push(ring);
    }
    // เสาทรัสปีกนอก + คานแขวน
    truss(TRUSS_Y + 0.6, TH, side * (TOWER_X + 3.0), (TRUSS_Y + 0.6) / 2, Z_FRONT, 'y');
    truss(3.0, TH, side * (TOWER_X + 1.5), TRUSS_Y, Z_FRONT, 'x');
    // ไลน์อาร์เรย์แขวน โค้งเข้าหาคนดู
    const top = TRUSS_Y - 0.75;
    const n = Math.max(4, Math.min(12, Math.floor((top - SUB_ROWS * SUB - 0.6) / 0.58)));
    let y = top, z = Z_FRONT + 0.75, tilt = 0;
    add(new THREE.BoxGeometry(0.08, 0.5, 0.08), boxSide, cx - 0.9, TRUSS_Y - 0.45, z);
    add(new THREE.BoxGeometry(0.08, 0.5, 0.08), boxSide, cx + 0.9, TRUSS_Y - 0.45, z);
    for (let i = 0; i < n; i++) {
      const m = add(arrGeo, arrMats, cx, y, z);
      m.rotation.x = tilt;
      speakers.push(m);
      tilt += 0.045;
      y -= 0.58 * Math.cos(tilt);
      z -= 0.58 * Math.sin(tilt) * 0.6;
    }
    // แถบไฟขอบกำแพงลำโพง
    add(new THREE.BoxGeometry(SUB * 2 + 0.16, 0.08, 0.08), basic(0xffd21f), cx, SUB_ROWS * SUB + 0.05, Z_FRONT + 1.6);
  }

  // ---------- ป้ายชื่อคณะ ----------
  const SIGN_W = Math.min(W * 0.82, 13);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = add(
    new THREE.PlaneGeometry(SIGN_W, SIGN_W / 4),
    basic(0xffffff, { map: signTex, transparent: true, depthWrite: false }),
    0, TRUSS_Y + SIGN_W / 8 + 0.2, Z_FRONT + 0.05
  );
  sign.renderOrder = 2;
  let signTitle = null;
  function setTitle(title) {
    if (title === signTitle) return;
    signTitle = title;
    const x = signCanvas.getContext('2d');
    x.clearRect(0, 0, 1024, 256);
    let size = 170;
    const font = (s) => `900 ${s}px "Sarabun","Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif`;
    x.font = font(size);
    while (x.measureText(title).width > 960 && size > 40) x.font = font((size -= 8));
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.shadowColor = theme.sign[1];
    x.shadowBlur = 28;
    x.strokeStyle = theme.sign[0];
    x.lineWidth = 18;
    x.strokeText(title, 512, 138);
    x.shadowBlur = 0;
    const g = x.createLinearGradient(0, 40, 0, 220);
    g.addColorStop(0, '#fff7c2');
    g.addColorStop(0.5, '#ffd21f');
    g.addColorStop(1, '#ff9a1a');
    x.fillStyle = g;
    x.fillText(title, 512, 138);
    signTex.needsUpdate = true;
  }

  // ---------- หลอดไฟวิ่ง ----------
  const bulbPos = [];
  const line = (x1, y1, z1, x2, y2, z2, n, sag = 0) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      bulbPos.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * sag, z1 + (z2 - z1) * t]);
    }
  };
  const zb = Z_BACK + 0.62;
  // รอบซุ้มโค้ง
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI - (i / 18) * Math.PI;
    bulbPos.push([Math.cos(a) * 1.95 * S, STAGE_Y + (2.3 + Math.sin(a) * 1.95) * S, zb]);
  }
  line(-1.95 * S, STAGE_Y + 0.2, zb, -1.95 * S, STAGE_Y + 2.1 * S, zb, 5);
  line(1.95 * S, STAGE_Y + 0.2, zb, 1.95 * S, STAGE_Y + 2.1 * S, zb, 5);
  // ขอบหน้าบัน
  line(-4.7 * S, STAGE_Y + 0.15, zb - 0.3, 0, STAGE_Y + 5.85 * S, zb - 0.3, 20);
  line(4.7 * S, STAGE_Y + 0.15, zb - 0.3, 0, STAGE_Y + 5.85 * S, zb - 0.3, 20);
  // ไฟพาร์บนทรัส
  line(-TOWER_X + 0.4, TRUSS_Y - 0.35, Z_FRONT, TOWER_X - 0.4, TRUSS_Y - 0.35, Z_FRONT, 16);
  line(-TOWER_X + 0.4, TRUSS_Y - 0.4, MID_Z, TOWER_X - 0.4, TRUSS_Y - 0.4, MID_Z, 14);
  // ขอบหน้าเวที
  line(-HALF_W, STAGE_Y + 0.02, Z_FRONT + 0.03, HALF_W, STAGE_Y + 0.02, Z_FRONT + 0.03, Math.round(W * 2.8));
  // ไฟราวงานวัดเหนือลานคนดู
  const POLE_X = VIEW + 2.2, POLE_Z = CAM_Z - 6;
  line(-TOWER_X, TRUSS_Y + 0.3, Z_FRONT, -POLE_X, 4.5, POLE_Z, 30, 1.2);
  line(TOWER_X, TRUSS_Y + 0.3, Z_FRONT, POLE_X, 4.5, POLE_Z, 30, 1.2);

  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), basic(0xffffff), bulbPos.length);
  const dummy = new THREE.Object3D();
  bulbPos.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
    bulbs.setColorAt(i, new THREE.Color(NEON[i % NEON.length]));
  });
  bulbs.frustumCulled = false;
  root.add(bulbs);
  const neonColors = NEON.map((c) => new THREE.Color(c));
  const dim = new THREE.Color();

  // ---------- ลำแสง ----------
  const BEAM_L = TRUSS_Y + 3.5;
  const beamGeo = new THREE.ConeGeometry(0.85 * S, BEAM_L, 14, 1, true).translate(0, -BEAM_L / 2, 0);
  const beams = [];
  const makeBeam = (x, y, z, up) => {
    const m = add(
      beamGeo,
      basic(NEON[beams.length % NEON.length], {
        transparent: true,
        opacity: up ? 0.1 : 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
      x, y, z
    );
    m.userData = { up, seed: beams.length * 1.7 };
    beams.push(m);
  };
  const beamX = [0, 1, 2, 3, 4].map((i) => (i / 4 - 0.5) * W * 0.85);
  for (const x of beamX) makeBeam(x, TRUSS_Y - 0.3, Z_FRONT - 0.3, false);
  for (let i = 0; i < 6; i++) makeBeam((i / 5 - 0.5) * W * 1.05, TRUSS_Y + 0.2, Z_BACK + 0.3, true);

  // ---------- รายละเอียดเวทีเพิ่มเติม ----------
  // ลายกนกหน้าเวที สองข้างบันได
  const FS = STAGE_Y / 2.25; // ขนาดกนกหน้าเวทีตามความสูงเวที
  for (let x = 2.3, i = 0; x < HALF_W - 0.6; x += 1.7 * FS, i++) {
    const c = theme.side[i % 3][1];
    flame(x, 0.05, Z_FRONT + 0.06, FS, 0xffd21f, c, 0xffffff, false, root);
    flame(-x, 0.05, Z_FRONT + 0.06, FS, 0xffd21f, c, 0xffffff, true, root);
  }
  // กนกขนาบป้ายบนทรัส
  flames.push(
    flame(SIGN_W / 2 + 0.5, TRUSS_Y + 0.25, Z_FRONT + 0.02, 0.8, ...theme.side[0], false, root),
    flame(-SIGN_W / 2 - 0.5, TRUSS_Y + 0.25, Z_FRONT + 0.02, 0.8, ...theme.side[0], true, root)
  );
  // จอ LED ข้างเวที
  const ledPanels = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const m = add(new THREE.BoxGeometry(1.0, 0.72, 0.08), basic(0xffffff), sx * TOWER_X, STAGE_Y + 3.6 + i * 0.8, Z_FRONT + 0.32);
      ledPanels.push(m);
    }
  }
  // ลำโพงมอนิเตอร์ + โคมไฟบนเวที
  const blackM = new THREE.MeshLambertMaterial({ color: 0x15151c });
  for (const x of [-HALF_W * 0.75, HALF_W * 0.75]) {
    const m = add(new THREE.BoxGeometry(0.75, 0.32, 0.45), blackM, x, STAGE_Y + 0.16, Z_FRONT - 0.35);
    m.rotation.x = 0.35;
  }
  const headGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.35, 10);
  for (const x of beamX) add(headGeo, blackM, x, TRUSS_Y - 0.4, Z_FRONT - 0.3);
  // ไฟพื้นส่องฉากหลัง
  const upGeo = new THREE.ConeGeometry(0.5, 3.2, 10, 1, true).translate(0, 1.6, 0);
  const uplights = [-0.85, -0.5, 0.5, 0.85].map((k, i) => [k * HALF_W, i]).map(([x, i]) =>
    add(upGeo, basic(NEON[i], { transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), x, STAGE_Y + RISER, Z_BACK + 1.1)
  );
  uplights.forEach((u) => (u.rotation.z = Math.PI)); // ปลายกรวยอยู่ที่พื้น บานขึ้นด้านบน
  uplights.forEach((u) => (u.position.y += 3.2));
  // ธงเล็กบนยอดทรัส
  {
    const fg = new THREE.PlaneGeometry(0.45, 0.28).translate(0.22, 0, 0);
    for (let i = 0; i < 9; i++) {
      const x = -TOWER_X + (i * TOWER_X * 2) / 8;
      if (Math.abs(x) < SIGN_W / 2 + 1.3) continue;
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.7), blackM, x, TRUSS_Y + 0.6, Z_FRONT);
      add(fg, basic([0xe53935, 0xffffff, 0x1e40af][i % 3], { side: THREE.DoubleSide }), x, TRUSS_Y + 0.8, Z_FRONT);
    }
  }

  // ---------- บรรยากาศงานวัดรอบเวที ----------
  const lam = (c, extra) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const stripe = (a, b) => {
    const t = canvasTex(64, 64, (x) => {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = i % 2 ? a : b;
        x.fillRect(i * 8, 0, 8, 64);
      }
    });
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
  };
  // ---------- บูทขายของกิน สองข้างลานคนดู ----------
  // วางชิดขอบจอ (จอแนวตั้ง) หันเฉียงเข้าหากล้อง ให้อ่านป้ายชื่อร้านได้
  const edge = (z) => (CAM_Z - z) * 0.283; // ครึ่งความกว้างที่กล้องเห็น ณ ระยะ z
  const roofGeo = new THREE.ConeGeometry(1.75, 0.95, 4, 1).rotateY(Math.PI / 4);
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.1, 6);
  const counterGeo = new THREE.BoxGeometry(2.3, 0.9, 0.6);
  const goodsGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5);
  const cupGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.24, 8);
  const balloonGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const signGeo = new THREE.PlaneGeometry(2.7, 0.68);
  const woodM = lam(0x8a5a2a);
  const poleM = lam(0xd8d8e0);
  const stallCols = [['#e53935', '#ffffff'], ['#1e88e5', '#ffffff'], ['#ffb300', '#d81b60'], ['#2e9e4f', '#fff3b0'], ['#8e44d6', '#ffd21f'], ['#ff7043', '#ffffff']];
  const balloons = [];
  const vendors = [];
  const booths = [];
  const BOOTH_Z0 = 4.6, BOOTH_Z1 = Math.max(9, CAM_Z - 16.5);
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const z = BOOTH_Z0 + ((BOOTH_Z1 - BOOTH_Z0) * Math.floor(i / 2)) / 2;
    const x = side * (edge(z) - 1.8);
    const rot = -side * 0.95;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    root.add(g);
    const [a, b] = stallCols[i];
    add(roofGeo, basic(0xc8c8c8, { map: stripe(a, b) }), 0, 2.55, 0, g);
    for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) add(poleGeo, poleM, px, 1.05, pz, g);
    add(counterGeo, woodM, 0, 0.45, 0.85, g);
    add(new THREE.BoxGeometry(2.34, 0.22, 0.05), basic(new THREE.Color(a).multiplyScalar(0.85)), 0, 0.7, 1.16, g);
    // ของกินบนเคาน์เตอร์ แต่ละร้านไม่เหมือนกัน
    for (let k = 0; k < 6; k++) {
      const px = -0.9 + k * 0.36;
      if (i % 3 === 0) add(goodsGeo, lam([0x7ac74f, 0xff7043, 0xffd21f][k % 3]), px, 1.0, 0.85, g).scale.set(1.2, 0.6, 1.2);
      else if (i % 3 === 1) {
        add(stickGeo, lam(0xe8d2a0), px, 1.1, 0.85, g).rotation.x = 0.5;
        add(goodsGeo, lam(k % 2 ? 0xb5651d : 0xd98b3a), px, 1.2, 0.9, g).scale.setScalar(0.8);
      } else add(cupGeo, lam(NEON[(k + i) % NEON.length]), px, 1.02, 0.85, g);
    }
    for (let k = 0; k < 6; k++) add(goodsGeo, basic(k % 2 ? 0xffe9a0 : 0xffb347), -1.0 + k * 0.4, 1.95, 1.14, g).scale.setScalar(0.55);
    for (let k = 0; k < 3; k++) {
      const col = NEON[(k * 2 + i) % NEON.length];
      const bl = add(balloonGeo, lam(col, { emissive: col, emissiveIntensity: 0.25 }), 1.2 + k * 0.12, 2.5 + k * 0.28, 1.15, g);
      bl.scale.y = 1.2;
      balloons.push(bl);
    }
    // ป้ายชื่อร้าน
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = add(signGeo, basic(0xffffff, { map: tex }), 0, 2.42, 1.3, g);
    sign.rotation.x = -0.12;
    // คนขาย
    const v = new Character(`vendor-${i}`);
    v.spawnAt(new THREE.Vector3(0, 0, 0.05), null);
    v.calm = true;
    g.add(v.root);
    vendors.push(v);
    // จุดยืนซื้อของหน้าร้าน
    g.updateMatrixWorld(true);
    const spots = [-0.65, 0.65].map((sx) => ({ pos: g.localToWorld(new THREE.Vector3(sx, 0, 1.75)), busy: false }));
    booths.push({ index: i, emoji: FOOD[i], canvas: c, tex, colors: [a, b], name: null, spots, face: rot + Math.PI });
  }
  function setShops(names = []) {
    booths.forEach((bt, i) => {
      const name = String(names[i] || '').trim() || 'ร้านว่าง ให้เช่า';
      if (name === bt.name) return;
      bt.name = name;
      const x = bt.canvas.getContext('2d');
      x.fillStyle = bt.colors[0];
      x.fillRect(0, 0, 512, 128);
      x.strokeStyle = '#ffd21f';
      x.lineWidth = 10;
      x.strokeRect(5, 5, 502, 118);
      const text = `${bt.emoji} ${name}`;
      let size = 76;
      const font = (s) => `900 ${s}px "Sarabun","Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif`;
      x.font = font(size);
      while (x.measureText(text).width > 470 && size > 24) x.font = font((size -= 4));
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      x.strokeStyle = 'rgba(0,0,0,.55)';
      x.lineWidth = 8;
      x.strokeText(text, 256, 68);
      x.fillStyle = '#fff';
      x.fillText(text, 256, 68);
      bt.tex.needsUpdate = true;
    });
  }
  setShops(opts.shops);

  // ชิงช้าสวรรค์
  const wheel = new THREE.Group();
  const WHEEL_R = 6.2;
  const cabins = [];
  {
    const base = new THREE.Group();
    base.position.set(-(HALF_W + 9), 0, Z_BACK - 10);
    base.rotation.y = 0.35;
    root.add(base);
    const legM = lam(0x9aa0b4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = add(new THREE.BoxGeometry(0.28, 8.6, 0.28), legM, sx * 1.9, 3.85, sz * 0.9, base);
      leg.rotation.z = sx * 0.45;
    }
    wheel.position.set(0, 7.6, 0);
    base.add(wheel);
    for (const z of [-0.6, 0.6]) {
      add(new THREE.TorusGeometry(WHEEL_R, 0.09, 6, 48), basic(0xff2d95), 0, 0, z, wheel);
      add(new THREE.TorusGeometry(WHEEL_R * 0.55, 0.06, 6, 36), basic(0x21c8ff), 0, 0, z, wheel);
    }
    const spokeGeo = new THREE.BoxGeometry(WHEEL_R * 2, 0.07, 0.07);
    const cabGeo = new THREE.BoxGeometry(0.95, 0.85, 0.95);
    const cabRoof = new THREE.ConeGeometry(0.75, 0.4, 4).rotateY(Math.PI / 4);
    for (let i = 0; i < 6; i++) {
      const sp = add(spokeGeo, basic(i % 2 ? 0xffd21f : 0xffffff), 0, 0, 0, wheel);
      sp.rotation.z = (i / 6) * Math.PI;
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const c = new THREE.Group();
      c.position.set(Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, 0);
      wheel.add(c);
      add(cabGeo, lam(NEON[i % NEON.length], { emissive: NEON[i % NEON.length], emissiveIntensity: 0.45 }), 0, -0.65, 0, c);
      add(cabRoof, basic(0xffd21f), 0, -0.05, 0, c);
      cabins.push(c);
    }
    add(new THREE.SphereGeometry(0.5, 12, 8), basic(0xffd21f), 0, 0, 0, wheel);
  }
  // ต้นไม้
  {
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6);
    const leaf = new THREE.SphereGeometry(1, 8, 6);
    const trunkM = lam(0x3a2616), leafM = lam(0x1f4a2a), leafM2 = lam(0x2a5c30);
    const o = HALF_W - 4.6, zb2 = Z_BACK + 7.2;
    const spots = [[-9 - o, -12 + zb2], [9.5 + o, -12.5 + zb2], [14 + o, -8 + zb2], [-16 - o, -6], [17 + o, 2], [-15 - o, 6], [15 + o, 10], [-13.5 - o, 14], [12.5 + o, 17], [5, -20 + zb2], [-4, -21 + zb2], [19 + o, -16 + zb2], [-21 - o, -12 + zb2], [0, -24 + zb2]];
    spots.forEach(([x, z], i) => {
      const k = 1 + (i % 3) * 0.3;
      add(trunk, trunkM, x, 1.2 * k, z).scale.setScalar(k);
      add(leaf, i % 2 ? leafM : leafM2, x, 3.3 * k, z).scale.set(1.9 * k, 1.6 * k, 1.9 * k);
      add(leaf, i % 2 ? leafM2 : leafM, x + 0.7 * k, 4.3 * k, z - 0.3).scale.setScalar(1.2 * k);
    });
  }
  // เสาไฟ + ธงราวสามเหลี่ยม
  {
    const poleG = new THREE.CylinderGeometry(0.07, 0.09, 4.7, 6);
    for (const x of [-POLE_X, POLE_X]) add(poleG, poleM, x, 2.35, POLE_Z);
    const pos = [], col = [];
    const c = new THREE.Color();
    const bunting = (x1, y1, z1, x2, y2, z2, n, sag) => {
      const dx = (x2 - x1) / n, dz = (z2 - z1) / n;
      for (let i = 0; i < n; i++) {
        const P = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * sag, z1 + (z2 - z1) * t];
        const a = P(i / n), b = P((i + 0.8) / n), m = P((i + 0.4) / n);
        pos.push(...a, ...b, m[0], m[1] - 0.45, m[2]);
        c.set([0xe53935, 0xffd21f, 0x1e88e5, 0x37e36b, 0xff2d95, 0xffffff][i % 6]);
        for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
      }
    };
    bunting(-TOWER_X, TRUSS_Y - 0.3, Z_FRONT, -POLE_X, 4.4, POLE_Z, 34, 1.3);
    bunting(TOWER_X, TRUSS_Y - 0.3, Z_FRONT, POLE_X, 4.4, POLE_Z, 34, 1.3);
    bunting(-TOWER_X, TRUSS_Y - 1, Z_BACK, -(HALF_W + 9), 7.6, Z_BACK - 10, 16, 0.8);
    bunting(TOWER_X, TRUSS_Y - 1, Z_BACK, HALF_W + 9, 5, Z_BACK - 4, 14, 0.8);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    root.add(m);
  }
  // พลุ
  const FW_N = 70;
  const fireworks = [0, 1, 2, 3].map((i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FW_N * 3), 3));
    const dirs = new Float32Array(FW_N * 3);
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pts.frustumCulled = false;
    root.add(pts);
    return { pts, dirs, t: 99, wait: 1 + i * 1.3, R: 4 };
  });
  function launch(f) {
    for (let i = 0; i < FW_N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), k = 0.75 + Math.random() * 0.25;
      f.dirs[i * 3] = r * Math.cos(a) * k;
      f.dirs[i * 3 + 1] = u * k;
      f.dirs[i * 3 + 2] = r * Math.sin(a) * k;
    }
    const side = Math.random() < 0.5 ? -1 : 1;
    f.pts.position.set(side * (7 + Math.random() * 12), 10 + Math.random() * 9, -30 - Math.random() * 8);
    f.pts.material.color.set(NEON[Math.floor(Math.random() * NEON.length)]);
    f.R = 3 + Math.random() * 3;
    f.t = 0;
  }

  // ---------- แสง ----------
  root.add(new THREE.HemisphereLight(0xffffff, 0x6a4a7a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1e0, 1.7);
  sun.position.set(3, 10, 14);
  root.add(sun);
  const colorLights = [-3, 3].map((x) => {
    const l = new THREE.PointLight(0xff2d95, 40, 16, 1.6);
    l.position.set(x * (HALF_W / 4.6), STAGE_Y + 4.2, -2.5);
    root.add(l);
    return l;
  });

  // ---------- ตำแหน่งยืน ----------
  // บนเวที 2 แถว (แถวหลังยกพื้น) เรียงจากกลางออกไป
  const perRow = stageRowSize(W);
  const gap = Math.min(2.1, (W - 2) / (perRow - 1));
  const order = [...Array(perRow).keys()].map((i) => i - (perRow - 1) / 2).sort((a, b) => Math.abs(a) - Math.abs(b));
  const stageSlots = [
    ...order.map((i) => new THREE.Vector3(i * gap, STAGE_Y, -2.35)),
    ...order.map((i) => new THREE.Vector3(i * gap, STAGE_Y + RISER, Z_BACK + 2.25)),
  ];
  // ลานด้านล่าง: อยู่ระหว่างบูทสองข้าง แถวใกล้กล้องแคบลงตามมุมกล้อง
  const groundSlots = [];
  const rowStep = Math.max(1.65, (CAM_Z - 15.5 - 2.9) / 7); // กระจายแถวให้เต็มลาน
  const groundRows = []; // แถวของแต่ละตำแหน่ง (0 = หน้าสุดติดเวที)
  for (let z = 2.9, row = 0; groundSlots.length < 33 && row < 9; z += rowStep, row++) {
    const half = edge(z) - 3.7;
    const n = Math.min(7, Math.max(2, Math.floor((half * 2) / 1.55) + 1));
    for (let i = 0; i < n && groundSlots.length < 33; i++) {
      const x = (i - (n - 1) / 2) * 1.55 + (row % 2 ? 0.3 : -0.3);
      groundSlots.push(new THREE.Vector3(x + (Math.random() - 0.5) * 0.3, 0, z + (Math.random() - 0.5) * 0.4));
      groundRows.push(row);
    }
  }

  // ---------- อนิเมชันเวที ----------
  let lastStep = -1;
  let lastTime = 0;
  function update(time, beat) {
    const dt = Math.min(0.1, time - lastTime);
    lastTime = time;
    const step = Math.floor(beat * 2);
    if (step !== lastStep) {
      lastStep = step;
      for (let i = 0; i < bulbPos.length; i++) {
        const c = neonColors[(i + step) % neonColors.length];
        const on = (i + step) % 3 !== 0;
        bulbs.setColorAt(i, on ? c : dim.copy(c).multiplyScalar(0.18));
      }
      bulbs.instanceColor.needsUpdate = true;
      if (step % 4 === 0) {
        colorLights.forEach((l, i) => l.color.set(NEON[(step / 4 + i * 2) % NEON.length | 0]));
        beams.forEach((b, i) => b.material.color.set(NEON[(step / 4 + i) % NEON.length | 0]));
        uplights.forEach((b, i) => b.material.color.set(NEON[(step / 4 + i * 2 + 1) % NEON.length | 0]));
      }
      if (step % 2 === 0) {
        ledPanels.forEach((m, i) => m.material.color.set(NEON[(step / 2 + (i % 3)) % NEON.length | 0]));
      }
    }
    for (const b of beams) {
      const { up, seed } = b.userData;
      if (up) b.rotation.set(-0.5 + Math.sin(time * 0.5 + seed) * 0.25, 0, Math.PI + Math.sin(time * 0.7 + seed) * 0.7);
      else b.rotation.set(0.25 + Math.sin(time * 0.9 + seed) * 0.35, 0, Math.sin(time * 0.6 + seed * 2) * 0.55);
    }
    const pulse = 1 + Math.pow(1 - (beat % 1), 3) * 0.05;
    speakers.forEach((s) => s.scale.set(pulse, pulse, 1));
    const kick = 1 + Math.pow(1 - (beat % 1), 3) * 0.22;
    const bi = Math.floor(beat);
    spkRings.forEach((r, i) => {
      r.scale.setScalar(kick);
      r.material.color.set(NEON[(bi + i) % NEON.length]);
    });
    for (const v of vendors) v.update(dt, beat, scene);
    wheel.rotation.z = time * 0.18;
    for (const c of cabins) c.rotation.z = -wheel.rotation.z;
    balloons.forEach((b, i) => (b.position.x += Math.sin(time * 1.3 + i) * 0.0015));
    for (const f of fireworks) {
      f.t += dt;
      if (f.t > 1.8) {
        f.pts.material.opacity = 0;
        f.wait -= dt;
        if (f.wait <= 0) {
          launch(f);
          f.wait = 1.5 + Math.random() * 4;
        }
        continue;
      }
      const e = (1 - Math.exp(-3.2 * f.t)) * f.R;
      const arr = f.pts.geometry.attributes.position.array;
      for (let i = 0; i < FW_N * 3; i += 3) {
        arr[i] = f.dirs[i] * e;
        arr[i + 1] = f.dirs[i + 1] * e - f.t * f.t * 0.9;
        arr[i + 2] = f.dirs[i + 2] * e;
      }
      f.pts.geometry.attributes.position.needsUpdate = true;
      f.pts.material.opacity = Math.max(0, 1 - f.t / 1.8);
    }
    flames.forEach((f, i) => {
      f.rotation.z = Math.sin(time * 1.5 + i) * 0.03;
    });
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    root.removeFromParent();
  }

  return { stageSlots, groundSlots, groundRows, booths, update, setTitle, setShops, dispose, viewHalfWidth: VIEW, width: W };
}
