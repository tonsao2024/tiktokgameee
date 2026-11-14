import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildStage, THEMES } from './stage.js';
import { Character, updateEffects } from './character.js';

const params = new URLSearchParams(location.search);
let BPM = Number(params.get('bpm')) || 128;
let picSize = 34;
const USE_BLOOM = params.get('bloom') !== '0';
if (params.get('clean') === '1') document.body.classList.add('clean');

// ---------- ฉาก 3 มิติ ----------
const canvas = document.getElementById('scene');
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);
let stageOpts = { width: 13, theme: 'kanok', shops: [] };
let stage = buildStage(scene, stageOpts);

let composer = null;
if (USE_BLOOM) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.5, 0.82));
  composer.addPass(new OutputPass());
}

// ---------- กล้อง ----------
// ลากเมาส์/นิ้ว = หมุน, ล้อเมาส์/ถ่างนิ้ว = ซูม, คลิกขวาลาก/สองนิ้วลาก = เลื่อน
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 4;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI / 2 - 0.03; // ไม่ให้มุดลงใต้พื้น
controls.screenSpacePanning = true;
let customCam = false; // false = มุมอัตโนมัติตามขนาดจอ
let camRev = -1;
let interacting = false;
let lastLocalCam = 0;

function autoCamera() {
  // ถอยกล้องให้เห็นเวทีเต็มความกว้าง (ออกแบบสำหรับจอแนวตั้ง 9:16 ของ TikTok)
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const dist = Math.max(stage.viewHalfWidth / tanH, 24);
  const portrait = camera.aspect < 1;
  camera.position.set(0, 9, -1 + dist);
  controls.target.set(0, portrait ? 5 : 3.5, 1);
  controls.update();
}
function resize() {
  const w = view.clientWidth || innerWidth, h = view.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!customCam) autoCamera();
}
addEventListener('resize', resize);
new ResizeObserver(() => resize()).observe(view);
resize();

let camTimer = null;
function sendCamera(reset = false) {
  lastLocalCam = performance.now();
  clearTimeout(camTimer);
  camTimer = setTimeout(async () => {
    const r3 = (v) => v.toArray().map((n) => Math.round(n * 1000) / 1000);
    const out = await api('/api/camera', { cam: reset ? null : { p: r3(camera.position), t: r3(controls.target) } }, true);
    if (out && out.camRev != null) camRev = out.camRev;
  }, 200);
}
function applyRemoteCamera(cam, rev) {
  if (rev === camRev) return;
  if (interacting || performance.now() - lastLocalCam < 1500) return;
  camRev = rev;
  customCam = !!cam;
  if (cam) {
    camera.position.fromArray(cam.p);
    controls.target.fromArray(cam.t);
    controls.update();
  } else autoCamera();
}
controls.addEventListener('start', () => {
  interacting = true;
  customCam = true;
});
controls.addEventListener('end', () => {
  interacting = false;
  sendCamera();
});

// ปุ่มควบคุมกล้องในแผงตั้งค่า (กดค้างได้)
const _off = new THREE.Vector3(), _sph = new THREE.Spherical(), _dir = new THREE.Vector3(), _right = new THREE.Vector3();
function camAction(act) {
  if (act === 'reset') {
    customCam = false;
    autoCamera();
    return sendCamera(true);
  }
  customCam = true;
  _off.subVectors(camera.position, controls.target);
  _sph.setFromVector3(_off);
  camera.getWorldDirection(_dir);
  _dir.y = 0;
  _dir.normalize();
  _right.set(-_dir.z, 0, _dir.x);
  const step = Math.max(0.15, _sph.radius * 0.01);
  const shift = (v, k) => {
    camera.position.addScaledVector(v, k);
    controls.target.addScaledVector(v, k);
  };
  switch (act) {
    case 'in': _sph.radius = Math.max(controls.minDistance, _sph.radius * 0.98); break;
    case 'out': _sph.radius = Math.min(controls.maxDistance, _sph.radius * 1.02); break;
    case 'rotL': _sph.theta -= 0.015; break;
    case 'rotR': _sph.theta += 0.015; break;
    case 'rotU': _sph.phi = Math.max(0.05, _sph.phi - 0.012); break;
    case 'rotD': _sph.phi = Math.min(controls.maxPolarAngle, _sph.phi + 0.012); break;
  }
  if (['in', 'out', 'rotL', 'rotR', 'rotU', 'rotD'].includes(act)) {
    camera.position.copy(controls.target).add(_off.setFromSpherical(_sph));
  }
  switch (act) {
    case 'left': shift(_right, -step); break;
    case 'right': shift(_right, step); break;
    case 'fwd': shift(_dir, step); break;
    case 'back': shift(_dir, -step); break;
    case 'up': camera.position.y += step; controls.target.y += step; break;
    case 'down':
      if (controls.target.y - step > -1) { camera.position.y -= step; controls.target.y -= step; }
      break;
  }
  controls.update();
  sendCamera();
}
for (const btn of document.querySelectorAll('[data-cam]')) {
  let timer = null;
  const stop = () => clearInterval(timer);
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    camAction(btn.dataset.cam);
    stop();
    if (btn.dataset.cam !== 'reset') timer = setInterval(() => camAction(btn.dataset.cam), 40);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}

// ---------- ผู้ชม -> ตัวละคร ----------
const labels = document.getElementById('labels');
const toasts = document.getElementById('toasts');
/** @type {Map<string, any>} */
const actors = new Map();
const leaving = [];
let free = { stage: stage.stageSlots.map((_, i) => i), ground: stage.groundSlots.map((_, i) => i) };
let lastTitle = '';

// สร้างเวทีใหม่เมื่อเปลี่ยนความกว้าง/ฉาก แล้วจัดทุกคนลงตำแหน่งใหม่
function rebuildStage(opts) {
  stage.dispose();
  stageOpts = opts;
  stage = buildStage(scene, opts);
  stage.setTitle(lastTitle);
  free = { stage: stage.stageSlots.map((_, i) => i), ground: stage.groundSlots.map((_, i) => i) };
  for (const a of actors.values()) {
    a.trip = null;
    a.char.eating = false;
    a.char.lookYaw = null;
    a.slot = takeSlot(a.slot ? a.slot.kind : 'ground');
    a.char.home.copy(a.slot.pos);
    a.char.root.position.copy(a.slot.pos);
    if (a.char.state !== 'spawn') a.char.state = 'idle';
  }
  if (!customCam) autoCamera();
}


function takeSlot(kind) {
  const list = free[kind];
  const slots = kind === 'stage' ? stage.stageSlots : stage.groundSlots;
  if (!list.length) {
    // ที่เต็ม (ไม่ควรเกิด): ยืนแทรกแบบสุ่ม
    const p = slots[Math.floor(Math.random() * slots.length)].clone();
    p.x += (Math.random() - 0.5) * 0.8;
    return { kind, index: -1, pos: p };
  }
  // เวที: เอาตำแหน่งกลางก่อน / ลานล่าง: สุ่ม
  const i = kind === 'stage' ? 0 : Math.floor(Math.random() * list.length);
  const index = list.splice(i, 1)[0];
  return { kind, index, pos: slots[index] };
}
function freeSlot(slot) {
  if (!slot || slot.index < 0) return;
  free[slot.kind].push(slot.index);
  free[slot.kind].sort((a, b) => a - b);
}

const AV_COLORS = ['#e91e63', '#ff9800', '#22b573', '#16a3d8', '#8e44d6', '#e53935', '#00bfa5', '#3f51d1'];
function initials(name) {
  const ch = Array.from(String(name || '?').trim());
  if (!ch.length) return '?';
  return /[เแโใไ]/.test(ch[0]) && ch[1] ? ch[0] + ch[1] : ch[0].toUpperCase();
}
function makeTag(v) {
  const el = document.createElement('div');
  el.className = 'tag';
  const pic = document.createElement('div');
  pic.className = 'pic';
  const crown = document.createElement('div');
  crown.className = 'crown';
  const name = document.createElement('div');
  name.className = 'name';
  const badge = document.createElement('div');
  badge.className = 'badge';
  el.append(crown, pic, badge);
  labels.append(el);
  const tag = { el, pic, crown, badge, name, avatar: null, text: null };
  // ป้ายชื่ออยู่ที่เท้า แยก element เพื่อให้ตามตำแหน่งเท้าได้
  const nameWrap = document.createElement('div');
  nameWrap.className = 'tag';
  nameWrap.append(name);
  labels.append(nameWrap);
  tag.nameWrap = nameWrap;
  setTagInfo(tag, v);
  return tag;
}
function setTagInfo(tag, v) {
  if (tag.text !== v.name) {
    tag.text = v.name;
    tag.name.textContent = v.name;
  }
  if (tag.avatar !== v.avatar) {
    tag.avatar = v.avatar;
    tag.pic.textContent = initials(v.name);
    let h = 0;
    for (const c of v.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    tag.pic.style.background = AV_COLORS[h % AV_COLORS.length];
    if (v.avatar) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => tag.pic.append(img);
      img.src = v.avatar;
    }
  }
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toasts.append(el);
  while (toasts.children.length > 2) toasts.firstChild.remove();
  setTimeout(() => el.remove(), 3300);
}

// ลานล่างเรียงตามจำนวนใจ: อันดับดีสุดอยู่แถวหน้าสุดติดเวที (รอขึ้นเวที) คนมาใหม่อยู่แถวหลัง
// ย้ายเฉพาะเมื่อ "แถว" เปลี่ยน จะได้ไม่เดินวุ่นตลอดเวลา
function arrangeGround(list) {
  const slots = stage.groundSlots, rows = stage.groundRows;
  const used = new Set();
  const need = [];
  list.forEach((a, rank) => {
    const wantRow = rows[Math.min(rank, slots.length - 1)];
    const s = a.slot;
    if (rank < slots.length && s && s.kind === 'ground' && s.index >= 0 && rows[s.index] === wantRow && !used.has(s.index)) used.add(s.index);
    else need.push([a, wantRow, rank]);
  });
  for (const [a, wantRow, rank] of need) {
    let best = -1;
    if (rank < slots.length) {
      const cand = [];
      for (let i = 0; i < slots.length; i++) if (!used.has(i) && rows[i] === wantRow) cand.push(i);
      if (cand.length) best = cand[Math.floor(Math.random() * cand.length)];
      else for (let i = 0; i < slots.length && best < 0; i++) if (!used.has(i)) best = i;
    }
    if (best >= 0) {
      used.add(best);
      a.slot = { kind: 'ground', index: best, pos: slots[best] };
    } else {
      const p = slots[slots.length - 1 - Math.floor(Math.random() * 3)].clone();
      p.x += (Math.random() - 0.5) * 1.2;
      a.slot = { kind: 'ground', index: -1, pos: p };
    }
  }
  free.ground = slots.map((_, i) => i).filter((i) => !used.has(i));
}

let firstState = true;
function applyState(msg) {
  const c = msg.cfg;
  if (c.stageWidth && (c.stageWidth !== stageOpts.width || c.theme !== stageOpts.theme)) {
    rebuildStage({ width: c.stageWidth, theme: c.theme, shops: c.shops });
  }
  stage.setShops(c.shops);
  lastTitle = c.title;
  stage.setTitle(c.title);
  picSize = c.picSize || 34;
  if (!params.get('bpm') && c.bpm) BPM = c.bpm;
  applyRemoteCamera(msg.cam, msg.camRev);
  updatePanelStatus(msg.source);
  const seen = new Set();
  const ground = [];
  const spawn = [];
  const moved = [];
  const first = { gift: true, like: true };
  for (const v of msg.viewers) {
    seen.add(v.id);
    let a = actors.get(v.id);
    const kind = v.onStage ? 'stage' : 'ground';
    if (!a) {
      a = { id: v.id, char: new Character(v.id), slot: null, tag: makeTag(v), trip: null };
      scene.add(a.char.root);
      actors.set(v.id, a);
      if (v.onStage) a.slot = takeSlot('stage');
      spawn.push(a);
    } else if (a.slot.kind !== kind) {
      endTrip(a);
      if (v.onStage) {
        a.slot = takeSlot('stage');
        if (!firstState) {
          toast(v.via === 'gift' ? `🎁 ${v.name} ขึ้นเวทีสายของขวัญ!` : `❤️ ${v.name} ได้ขึ้นเวที!`);
          a.tag.el.classList.add('hero');
          setTimeout(() => a.tag.el.classList.remove('hero'), 2600);
        }
      } else {
        freeSlot(a.slot);
        a.slot = { kind: 'ground', index: -1, pos: null };
      }
      moved.push([a, v.onStage]);
    }
    if (!v.onStage) ground.push(a);
    setTagInfo(a.tag, v);
    a.tag.el.classList.toggle('stage', v.onStage);
    a.tag.nameWrap.classList.toggle('stage', v.onStage);
    // ป้ายเล็ก: จำนวนใจ หรือของขวัญ
    const badge = v.via === 'gift' ? `🎁${v.gifts}` : v.likes > 0 ? `❤️${v.likes}` : '';
    if (a.tag.badgeText !== badge) a.tag.badge.textContent = a.tag.badgeText = badge;
    a.tag.badge.classList.toggle('gift', v.via === 'gift');
    // มงกุฎ: ที่ 1 ของสายของขวัญ และที่ 1 ของสายใจ
    let crown = '';
    if (v.onStage && first[v.via]) {
      first[v.via] = false;
      crown = '👑';
    }
    if (a.tag.crownText !== crown) a.tag.crown.textContent = a.tag.crownText = crown;
  }
  arrangeGround(ground);
  for (const a of spawn) a.char.spawnAt(a.slot.pos, firstState ? null : scene);
  for (const [a, up] of moved) a.char.moveTo(a.slot.pos, scene, up && !firstState);
  if (!panel.hidden) $('viewerNames').replaceChildren(...msg.viewers.slice(0, 40).map((v) => new Option(`ร้าน ${v.name}`)));
  // คนที่ไม่ดูต่อ -> วาร์ปหายไป
  for (const [id, a] of actors) {
    if (seen.has(id)) continue;
    actors.delete(id);
    endTrip(a);
    freeSlot(a.slot);
    a.char.leave(scene);
    a.tag.el.style.opacity = a.tag.nameWrap.style.opacity = '0';
    leaving.push(a);
  }
  firstState = false;
}

function applyFx(msg) {
  const a = actors.get(msg.id);
  if (!a) return;
  switch (msg.kind) {
    case 'like':
      a.char.jump();
      pop(a, msg.n >= 10 ? `❤️×${msg.n}` : '❤️');
      break;
    case 'gift':
      a.char.spin();
      pop(a, `🎁×${msg.n}`);
      toast(`🎁 ${a.tag.text} ส่งของขวัญ!`);
      break;
    case 'chat':
      pop(a, '💬');
      break;
    case 'follow':
      a.char.spin();
      pop(a, '💖 ติดตาม');
      break;
    case 'share':
      a.char.jump();
      pop(a, '🔁 แชร์');
      break;
  }
}
function pop(a, text) {
  if (labels.querySelectorAll('.pop').length > 14) return;
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.transform = `translate(${a.sx + (Math.random() - 0.5) * 40}px, ${a.sy - 60 * (a.k || 1)}px) translate(-50%, -100%)`;
  el.style.zIndex = 5000;
  labels.append(el);
  setTimeout(() => el.remove(), 1400);
}

// ---------- WebSocket ----------
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.t === 'state') applyState(msg);
    else if (msg.t === 'fx') applyFx(msg);
    else if (msg.t === 'cam') applyRemoteCamera(msg.cam, msg.camRev);
  };
  ws.onclose = () => setTimeout(connect, 2000);
  ws.onerror = () => ws.close();
}
connect();

// ---------- วนลูปวาดภาพ ----------
const clock = new THREE.Clock();
const v3 = new THREE.Vector3();
// ---------- เต้นเหนื่อยแล้วเดินไปหาของกินที่บูท ----------
let snackIn = 4;
function endTrip(a) {
  if (!a.trip) return;
  a.trip.spot.busy = false;
  a.trip = null;
  a.char.eating = false;
  a.char.lookYaw = null;
}
function startSnack() {
  const idle = [...actors.values()].filter((a) => a.char.state === 'idle' && !a.trip && a.slot.index >= 0);
  if (!idle.length) return;
  const a = idle[Math.floor(Math.random() * idle.length)];
  const open = [];
  for (const b of stage.booths) for (const spot of b.spots) if (!spot.busy) open.push({ b, spot });
  if (!open.length) return;
  // เลือกร้านใกล้ ๆ ตัวก่อน
  open.sort((x, y) => x.spot.pos.distanceTo(a.slot.pos) - y.spot.pos.distanceTo(a.slot.pos));
  const { b, spot } = open[Math.floor(Math.random() * Math.min(3, open.length))];
  spot.busy = true;
  a.trip = { booth: b, spot, phase: 'going', t: 0 };
  pop(a, '😮‍💨 หิว');
  // คนบนเวทีกระโดดลงไป คนลานล่างเดินไป
  if (a.slot.kind === 'stage') a.char.moveTo(spot.pos, scene);
  else a.char.walkTo(spot.pos);
}
function updateTrip(a, dt) {
  const trip = a.trip;
  if (!trip || a.char.state !== 'idle') return;
  if (trip.phase === 'going') {
    trip.phase = 'eating';
    trip.t = 5 + Math.random() * 5;
    trip.next = 0;
    a.char.eating = true;
    a.char.lookYaw = trip.booth.face;
  } else if (trip.phase === 'eating') {
    trip.t -= dt;
    trip.next -= dt;
    if (trip.next <= 0) {
      pop(a, trip.booth.emoji);
      trip.next = 1.6;
    }
    if (trip.t <= 0) {
      trip.phase = 'returning';
      trip.spot.busy = false;
      a.char.eating = false;
      a.char.lookYaw = null;
      if (a.slot.kind === 'stage') a.char.moveTo(a.slot.pos, scene);
      else a.char.walkTo(a.slot.pos);
    }
  } else {
    a.trip = null; // กลับถึงที่แล้ว เต้นต่อ
  }
}

let time = 0;
let beat = 0;
let wanderIn = 3;

// สุ่มให้ตัวละครเดินสลับที่กัน (เฉพาะโซนเดียวกัน: บนเวทีสลับกับบนเวที, ลานล่างสลับกับลานล่าง)
function wander() {
  const idle = [...actors.values()].filter((a) => a.char.state === 'idle' && a.slot.index >= 0 && !a.trip);
  if (idle.length < 2) return;
  const a = idle[Math.floor(Math.random() * idle.length)];
  // ลานล่างสลับได้เฉพาะในแถวเดียวกัน (ลำดับแถวมาจากจำนวนใจ)
  const sameZone = (b) =>
    b !== a && b.slot.kind === a.slot.kind && (a.slot.kind === 'stage' || stage.groundRows[b.slot.index] === stage.groundRows[a.slot.index]);
  const others = idle.filter(sameZone);
  if (!others.length) return;
  const b = others[Math.floor(Math.random() * others.length)];
  [a.slot, b.slot] = [b.slot, a.slot]; // ตัวละครจะเดินไปตำแหน่งใหม่เอง (ดู settle)
}
// เดินไปยังตำแหน่งที่ถูกจัดให้ ถ้ายังไม่ได้ยืนอยู่ตรงนั้น
function settle(a) {
  const ch = a.char;
  if (ch.state !== 'idle' || a.trip || !a.slot.pos) return;
  if (ch.home.distanceToSquared(a.slot.pos) > 0.01) ch.walkTo(a.slot.pos);
}

function placeTag(a) {
  const root = a.char.root;
  const hw = view.clientWidth / 2, hh = view.clientHeight / 2;
  // เท้า
  v3.set(root.position.x, root.position.y, root.position.z).project(camera);
  const fx = v3.x * hw + hw, fy = -v3.y * hh + hh, depth = v3.z;
  // อยู่หลังกล้อง (หลังหมุน/ซูมกล้อง) -> ซ่อนป้าย
  const hidden = depth > 1 || depth < -1;
  a.tag.el.style.display = a.tag.nameWrap.style.display = hidden ? 'none' : '';
  if (hidden) return;
  // เหนือหัว
  v3.set(root.position.x, root.position.y + 1.78 * root.scale.y, root.position.z).project(camera);
  const hx = v3.x * hw + hw, hy = -v3.y * hh + hh;
  // ขนาดกรอบรูปตามระยะ (ตั้งค่าได้ เป็น % ของความสูงตัวละคร)
  const charPx = Math.abs(fy - hy) * (a.char.size / Math.max(0.2, root.scale.y));
  const k = Math.max(0.2, (charPx * picSize) / 100 / 56);
  const z = Math.round((1 - depth) * 100000);
  a.sx = hx; a.sy = hy; a.k = k;
  a.tag.el.style.transform = `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px) scale(${k.toFixed(3)})`;
  a.tag.el.style.zIndex = z;
  a.tag.nameWrap.style.transform = `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px) scale(${Math.max(0.5, k * 1.1).toFixed(3)})`;
  a.tag.nameWrap.style.zIndex = z;
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  time += dt;
  beat += (dt * BPM) / 60;
  wanderIn -= dt;
  if (wanderIn <= 0) {
    wander();
    wanderIn = 0.8 + Math.random() * 2.2;
  }
  snackIn -= dt;
  if (snackIn <= 0) {
    startSnack();
    snackIn = 2 + Math.random() * 4;
  }
  controls.update();
  updateEffects(dt);
  stage.update(time, beat);
  for (const a of actors.values()) {
    a.char.update(dt, beat, scene);
    updateTrip(a, dt);
    settle(a);
    placeTag(a);
  }
  for (let i = leaving.length - 1; i >= 0; i--) {
    const a = leaving[i];
    a.char.update(dt, beat, scene);
    if (a.char.dead) {
      a.char.dispose();
      a.tag.el.remove();
      a.tag.nameWrap.remove();
      leaving.splice(i, 1);
    }
  }
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
frame();

// ---------- แผงตั้งค่า ----------
const $ = (id) => document.getElementById(id);
const panel = $('panel');
let panelLoaded = false;
function updatePanelStatus(source) {
  if (!source) return;
  const who = source.username ? ` @${source.username}` : '';
  $('status').textContent = `สถานะ:${who} ${source.status}`;
  const test = source.mode === 'test';
  $('modeTest').classList.toggle('on', test);
  $('modeLive').classList.toggle('on', !test);
  $('liveBox').hidden = test;
  $('testBox').hidden = !test;
  $('testSet').disabled = !test;
  $('testOff').hidden = test;
  $('tAuto').checked = !!source.auto;
  const badge = $('modeBadge');
  badge.textContent = test ? 'ทดสอบ' : 'รันจริง';
  badge.className = `badge-mode ${test ? 'test' : 'live'}`;
}
async function api(path, data, quiet = false) {
  const res = await fetch(path, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify({ ...data, key: $('key').value }) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!quiet || !res.ok) {
    $('msg').textContent = res.ok ? 'เรียบร้อย ✔' : `⚠ ${out.error || 'ผิดพลาด'}`;
    clearTimeout(api.t);
    api.t = setTimeout(() => ($('msg').textContent = ''), 2500);
  }
  return out;
}
async function openPanel(open) {
  panel.hidden = !open;
  document.body.classList.toggle('panel-open', open);
  if (!open) return;
  const s = await api('/api/status');
  $('msg').textContent = '';
  $('keyRow').hidden = !s.needKey;
  $('username').value = s.source.username || s.username || '';
  for (const k of ['title', 'stageSize', 'idleTimeout', 'minStageSeconds', 'picSize', 'bpm', 'stageWidth', 'theme', 'shopMode']) $(k).value = s.cfg[k];
  $('widthVal').textContent = s.cfg.stageWidth;
  $('stageSize').max = s.maxStage;
  $('maxStage').textContent = s.maxStage;
  shopInputs.forEach((el, i) => (el.value = s.cfg.shops[i] || ''));
  $('picVal').textContent = s.cfg.picSize;
  updatePanelStatus(s.source);
}
$('gear').onclick = () => openPanel(panel.hidden);
$('btnClose').onclick = () => openPanel(false);
// แท็บด้านข้าง
function showTab(name) {
  for (const b of panel.querySelectorAll('.side [data-tab]')) b.classList.toggle('on', b.dataset.tab === name);
  for (const sec of panel.querySelectorAll('section[data-tab]')) sec.hidden = sec.dataset.tab !== name;
}
for (const b of panel.querySelectorAll('.side [data-tab]')) b.onclick = () => showTab(b.dataset.tab);
$('goTest').onclick = () => showTab('test');
// โหมดทดสอบ / โหมดรันจริง
$('modeTest').onclick = () => {
  if ($('modeTest').classList.contains('on')) return;
  api('/api/mode', { mode: 'test' }).then((r) => updatePanelStatus(r.source));
};
$('modeLive').onclick = () => {
  if ($('modeLive').classList.contains('on')) return;
  api('/api/mode', { mode: 'live' }).then((r) => updatePanelStatus(r.source));
};
for (const b of panel.querySelectorAll('[data-test]')) {
  b.onclick = () =>
    api('/api/test', {
      action: b.dataset.test,
      name: $('tName').value,
      n: b.dataset.test === 'gift' ? $('tCount').value : b.dataset.n || 1,
      diamonds: $('tGift').value,
    });
}
$('tAuto').onchange = () => api('/api/test', { action: 'auto', on: $('tAuto').checked });
$('btnConnect').onclick = () => api('/api/connect', { username: $('username').value });
$('btnStop').onclick = () => api('/api/stop', {});
panel.onsubmit = (e) => e.preventDefault();
// ช่องตัวเลข: แก้แล้วบันทึกอัตโนมัติ
for (const k of ['stageSize', 'idleTimeout', 'minStageSeconds', 'bpm']) {
  $(k).onchange = () => api('/api/config', { [k]: $(k).value });
}
// ฉากเวที / ความกว้าง / ร้านค้า
for (const [id, t] of Object.entries(THEMES)) $('theme').add(new Option(t.label, id));
$('theme').onchange = () => api('/api/config', { theme: $('theme').value });
$('stageWidth').oninput = () => ($('widthVal').textContent = $('stageWidth').value);
$('stageWidth').onchange = async () => {
  await api('/api/config', { stageWidth: $('stageWidth').value });
  const s = await (await fetch('/api/status')).json();
  $('stageSize').max = s.maxStage;
  $('stageSize').value = s.cfg.stageSize;
  $('maxStage').textContent = s.maxStage;
};
const shopInputs = [...document.querySelectorAll('.shop')];
const saveShops = () => api('/api/config', { shops: shopInputs.map((el) => el.value) });
shopInputs.forEach((el) => (el.onchange = saveShops));
$('shopMode').onchange = () => api('/api/config', { shopMode: $('shopMode').value });

// เปลี่ยนชื่อป้าย / ขนาดรูป แล้วเห็นผลทันที
let liveTimer = null;
function liveConfig(data) {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => api('/api/config', data, true), 250);
}
$('title').oninput = () => {
  stage.setTitle($('title').value.trim());
  liveConfig({ title: $('title').value });
};
$('title').onchange = () => api('/api/config', { title: $('title').value });
$('picSize').oninput = () => {
  picSize = Number($('picSize').value);
  $('picVal').textContent = picSize;
  liveConfig({ picSize });
};

// จอกว้าง (คอม): เปิดแผงด้านซ้ายไว้เลย ยกเว้นหน้า ?clean=1 ที่ใช้ออกไลฟ์
if (!document.body.classList.contains('clean') && innerWidth > 820) openPanel(true);
