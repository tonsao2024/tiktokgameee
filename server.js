/**
 * เวทีหมอลำ 3 มิติ สำหรับ TikTok LIVE
 * - เซิร์ฟเวอร์รับเหตุการณ์จากไลฟ์ (คนเข้า / กดใจ / คอมเมนต์ / ของขวัญ) ผ่าน tiktok-live-connector
 * - คำนวณคะแนน จัดอันดับ ใครอยู่บนเวที ใครอยู่ลานด้านล่าง ใครหายไป
 * - ส่งสถานะให้หน้าเว็บ (public/) ผ่าน WebSocket
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// ---------- ค่าที่ปรับได้ (ปรับจากแผงตั้งค่าในหน้าเว็บได้ด้วย) ----------
const cfg = {
  title: process.env.STAGE_TITLE || 'หมอลำออนไลน์',
  stageSize: clamp(Number(process.env.STAGE_SIZE) || 10, 1, 24), // จำนวนคนบนเวที
  stageWidth: 13, // ความกว้างเวที (8–22)
  theme: 'kanok', // ฉากเวที: kanok | naga | diamond | moon
  shops: ['ส้มตำแซ่บนัว', 'ไก่ย่างเขาสวนกวาง', 'ลูกชิ้นปิ้ง', 'น้ำแข็งใส', 'ข้าวเหนียวหมูปิ้ง', 'ชานมไข่มุก'], // ชื่อร้าน 6 บูท
  shopMode: 'manual', // manual = ใช้ชื่อที่พิมพ์ | gift = ผู้ส่งของขวัญสูงสุดได้เป็นชื่อร้าน
  groundSize: clamp(Number(process.env.GROUND_SIZE) || 30, 4, 33), // จำนวนคนลานด้านล่าง
  idleTimeout: Number(process.env.IDLE_TIMEOUT) || 180, // วินาทีที่เงียบแล้วถือว่า "ไม่ดูต่อ"
  minStageSeconds: Number(process.env.MIN_STAGE_SECONDS) || 30, // ต้องดูนานเท่านี้ก่อนถึงมีสิทธิ์ขึ้นเวที
  ptsPerSecond: 1, // คะแนนจากการดู (ต่อวินาที)
  ptsLike: 0.5,
  ptsChat: 3,
  ptsFollow: 20,
  ptsShare: 15,
  ptsDiamond: 10, // คะแนนต่อ 1 เหรียญของขวัญ
  picSize: 34, // ขนาดกรอบรูปโปรไฟล์ (% ของความสูงตัวละคร)
  bpm: 128, // ความเร็วจังหวะเต้น
};

// มุมกล้อง (null = อัตโนมัติ) ใช้ร่วมกันทุกหน้าจอ เพื่อปรับจากเครื่องอื่นแล้วจอไลฟ์เปลี่ยนตาม
let cam = null;
let eulerKey = process.env.EULER_API_KEY || ''; // คีย์ Euler Stream (ถ้ามี)
let lastUser = ''; // ชื่อผู้ใช้ TikTok ที่เชื่อมต่อล่าสุด (จำไว้เติมให้ในแผง)
let camRev = 0;

// ---------- จำค่าที่ตั้งไว้ลงไฟล์ (เปิดใหม่ค่าไม่หาย) ----------
const SAVE_FILE = path.join(__dirname, 'settings.json');
const SAVE_KEYS = ['title', 'stageSize', 'idleTimeout', 'minStageSeconds', 'picSize', 'bpm', 'stageWidth', 'theme', 'shops', 'shopMode'];
try {
  const saved = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
  for (const k of SAVE_KEYS) if (saved[k] != null) cfg[k] = saved[k];
  if (validCam(saved.cam)) cam = saved.cam;
  if (typeof saved.username === 'string') lastUser = saved.username;
  if (typeof saved.eulerKey === 'string' && saved.eulerKey) eulerKey = saved.eulerKey;
} catch {}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out = { cam, username: lastUser, eulerKey };
    for (const k of SAVE_KEYS) out[k] = cfg[k];
    fs.writeFile(SAVE_FILE, JSON.stringify(out, null, 2), () => {});
  }, 500);
}
function validCam(c) {
  const ok = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => Number.isFinite(n) && Math.abs(n) < 500);
  return !!c && ok(c.p) && ok(c.t);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// จำนวนคนบนเวทีสูงสุดตามความกว้างเวที (2 แถว) — สูตรเดียวกับ public/stage.js
const maxStage = () => Math.max(3, Math.floor((cfg.stageWidth - 2) / 1.7) + 1) * 2;
cfg.stageSize = clamp(cfg.stageSize, 1, maxStage());
const MAX_SHOPS = 10; // เพิ่ม/ลดจำนวนร้านได้ 0–10
if (!Array.isArray(cfg.shops)) cfg.shops = ['', '', '', '', '', ''];
cfg.shops = cfg.shops.slice(0, MAX_SHOPS).map((x) => String(x || ''));

// ยอดของขวัญสะสมของแต่ละบัญชี (ใช้จัดชื่อร้านอัตโนมัติ)
/** @type {Map<string, {name: string, diamonds: number}>} */
const gifters = new Map();
function shopNames() {
  if (cfg.shopMode !== 'gift') return cfg.shops;
  const top = [...gifters.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, cfg.shops.length);
  return cfg.shops.map((name, i) => (top[i] ? `ร้าน ${top[i].name}` : name));
}

// ---------- สถานะผู้ชม ----------
/** @type {Map<string, any>} */
const viewers = new Map();
let source = { mode: 'idle', username: '', status: 'ยังไม่ได้เชื่อมต่อ' };

// จำยอดใจ/ของขวัญของคนที่หายไปจากฉาก กลับมาในไลฟ์เดียวกันได้ยอดเดิม
const memory = new Map();
let connected = false; // ต่อกับห้องไลฟ์อยู่จริงหรือไม่
function drop(v) {
  viewers.delete(v.id);
  if (v.likes || v.gifts) {
    if (memory.size >= 5000) memory.delete(memory.keys().next().value);
    memory.set(v.id, { likes: v.likes, gifts: v.gifts });
  }
}
function clearRoom() {
  viewers.clear();
  gifters.clear();
  memory.clear();
}

function touch(u, pts = 0, strong = false) {
  if (!u || !u.id) return null;
  const now = Date.now();
  let v = viewers.get(u.id);
  if (!v) {
    if (!makeRoom(strong || memory.has(u.id))) return null; // ฉากเต็มและทุกคนมีส่วนร่วมแล้ว: รอให้กดใจก่อน
    v = {
      id: u.id,
      name: u.name || u.id,
      avatar: u.avatar || '',
      score: 0,
      likes: 0, // จำนวนใจที่กด
      gifts: 0, // เหรียญของขวัญที่ส่ง
      via: '', // ขึ้นเวทีด้วยโควต้าไหน: gift | like | watch
      joinedAt: now,
      lastActive: now,
      onStage: false,
    };
    const old = memory.get(v.id);
    if (old) {
      v.likes = old.likes;
      v.gifts = old.gifts;
      memory.delete(v.id);
    }
    viewers.set(v.id, v);
  } else {
    if (u.name) v.name = u.name;
    if (u.avatar) v.avatar = u.avatar;
    v.lastActive = now;
  }
  v.score += pts;
  return v;
}

// ถ้าฉากเต็ม: ให้คนในลานล่างที่ "ยังไม่เคยกดใจ/ส่งของขวัญ" และเงียบนานสุดหายไปก่อน
// คนใหม่ที่แค่เข้ามาดู (strong = false) จะไม่ไล่คนที่กดใจ/ส่งของขวัญแล้วออก
function makeRoom(strong) {
  const max = cfg.stageSize + cfg.groundSize;
  if (viewers.size < max) return true;
  let worst = null;
  const rank = (v) => (v.gifts > 0 ? 2 : v.likes > 0 ? 1 : 0);
  for (const v of viewers.values()) {
    if (v.onStage) continue;
    if (!worst || rank(v) < rank(worst) || (rank(v) === rank(worst) && (rank(v) === 1 ? v.likes < worst.likes : v.lastActive < worst.lastActive))) worst = v;
  }
  if (!worst) return false;
  if (!strong && rank(worst) > 0) return false;
  drop(worst);
  return true;
}

function tick() {
  const now = Date.now();
  // 1) คะแนนจากเวลาดู + ลบคนที่ไม่ดูต่อ
  // ระหว่างที่การเชื่อมต่อไลฟ์หลุด ไม่มีข้อมูลเข้ามา จึงยังไม่ตัดใครออก
  const paused = source.mode === 'tiktok' && !connected;
  for (const v of viewers.values()) {
    if (!paused && now - v.lastActive > cfg.idleTimeout * 1000) drop(v);
    else v.score += cfg.ptsPerSecond;
  }
  // 2) จัดคนขึ้นเวที — แบ่งโควต้าครึ่ง ๆ: สายของขวัญครึ่งหนึ่ง สายกดใจครึ่งหนึ่ง
  const all = [...viewers.values()];
  const giftQuota = Math.floor(cfg.stageSize / 2);
  const likeQuota = cfg.stageSize - giftQuota;
  const waited = (v) => now - v.joinedAt >= cfg.minStageSeconds * 1000;
  // คนที่อยู่บนเวทีอยู่แล้วได้แต้มต่อเล็กน้อย กันสลับขึ้นลงถี่เกินไป
  const giftKey = (v) => v.gifts + (v.onStage && v.via === 'gift' ? 0.5 : 0);
  const likeKey = (v) => v.likes + (v.onStage && v.via === 'like' ? 5 : 0);
  const chosen = new Map();
  const take = (list, n, via) => {
    for (const v of list) {
      if (n <= 0) break;
      if (chosen.has(v.id)) continue;
      chosen.set(v.id, via);
      n--;
    }
  };
  const byGift = all.filter((v) => v.gifts > 0).sort((a, b) => giftKey(b) - giftKey(a));
  const byLike = all.filter((v) => v.likes > 0 && waited(v)).sort((a, b) => likeKey(b) - likeKey(a));
  take(byGift, giftQuota, 'gift');
  take(byLike, likeQuota, 'like');
  // โควต้าฝั่งไหนคนไม่พอ ให้อีกฝั่งใช้แทน เวทีจะได้ไม่โล่ง แล้วค่อยเติมด้วยคนที่ดูนานสุด
  take(byLike, cfg.stageSize - chosen.size, 'like');
  take(byGift, cfg.stageSize - chosen.size, 'gift');
  take(all.filter(waited).sort((a, b) => b.score - a.score), cfg.stageSize - chosen.size, 'watch');
  for (const v of all) {
    v.onStage = chosen.has(v.id);
    v.via = chosen.get(v.id) || '';
  }
  broadcast(snapshot());
}

function snapshot() {
  // เรียง: บนเวที (สายของขวัญ → สายใจ) แล้วตามด้วยลานล่างเรียงตามจำนวนใจ (มากสุด = แถวหน้าสุด)
  const viaRank = { gift: 0, like: 1, watch: 2, '': 3 };
  const list = [...viewers.values()]
    .sort(
      (a, b) =>
        b.onStage - a.onStage ||
        viaRank[a.via] - viaRank[b.via] ||
        (a.via === 'gift' ? b.gifts - a.gifts : 0) ||
        b.likes - a.likes ||
        b.score - a.score
    )
    .map((v) => ({
      id: v.id,
      name: v.name,
      avatar: v.avatar,
      score: Math.round(v.score),
      likes: v.likes,
      gifts: v.gifts,
      onStage: v.onStage,
      via: v.via,
    }));
  return { t: 'state', viewers: list, cfg: { title: cfg.title, stageSize: cfg.stageSize, picSize: cfg.picSize, bpm: cfg.bpm, stageWidth: cfg.stageWidth, theme: cfg.theme, shops: shopNames() }, source, cam, camRev };
}

// ---------- WebSocket ----------
const server = http.createServer(handleHttp);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => ws.send(JSON.stringify(snapshot())));

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
// เอฟเฟกต์บนจอ: จำกัดไม่เกิน 40 ครั้งต่อวินาที กันเบราว์เซอร์ค้างเมื่อห้องคนเยอะมาก (ยอดยังนับครบ)
let fxCount = 0;
setInterval(() => (fxCount = 0), 1000);
function fx(id, kind, n) {
  if (kind !== 'gift' && ++fxCount > 40) return;
  if (!viewers.has(id)) return;
  broadcast({ t: 'fx', id, kind, n });
}

// ---------- เหตุการณ์จากไลฟ์ (ใช้ร่วมกันทั้งของจริงและโหมดทดลอง) ----------
const on = {
  join: (u) => touch(u),
  like: (u, n = 1) => {
    const v = touch(u, Math.min(n, 30) * cfg.ptsLike, true);
    if (!v) return;
    v.likes += n;
    fx(u.id, 'like', n);
  },
  chat: (u) => {
    if (touch(u, cfg.ptsChat)) fx(u.id, 'chat');
  },
  follow: (u) => {
    if (touch(u, cfg.ptsFollow)) fx(u.id, 'follow');
  },
  share: (u) => {
    if (touch(u, cfg.ptsShare)) fx(u.id, 'share');
  },
  gift: (u, diamonds = 1) => {
    const v = touch(u, diamonds * cfg.ptsDiamond, true);
    if (!v) return;
    const g = gifters.get(v.id) || { name: v.name, diamonds: 0 };
    g.name = v.name;
    g.diamonds += diamonds;
    v.gifts += diamonds;
    gifters.set(v.id, g);
    fx(u.id, 'gift', diamonds);
  },
};

// ---------- เชื่อมต่อ TikTok LIVE ----------
let conn = null;
let reconnectTimer = null;

// ข้อมูลผู้ใช้จาก TikTok (รองรับทั้งรูปแบบใหม่ v3: id/displayId/avatarThumb และรูปแบบเก่า: userId/uniqueId/profilePicture)
function pickUser(data) {
  const u = (data && data.user) || data || {};
  const id = u.id || u.userId || u.uniqueId || u.displayId;
  if (!id || String(id) === '0') return null;
  const pic = u.avatarThumb || u.avatarMedium || u.avatarLarge || u.profilePicture || u.profilePictureMedium || {};
  const list = pic.urlList || pic.urls || pic.url || [];
  const avatar =
    (Array.isArray(list) ? list.find((x) => /\.(webp|jpe?g|png)/i.test(x)) || list[0] : list) ||
    u.profilePictureUrl ||
    '';
  return { id: String(id), name: u.nickname || u.displayId || u.uniqueId || String(id), avatar: String(avatar || '') };
}
// จำนวนใจในข้อความกดใจ 1 ชุด (v3 ใช้ count, รุ่นเก่าใช้ likeCount)
function likeCount(d) {
  return clamp(Math.round(Number(d.count ?? d.likeCount)) || 1, 1, 500);
}
// เหรียญของของขวัญ: คืน 0 ถ้าเป็นคอมโบที่ยังกดไม่จบ (รอนับครั้งเดียวตอนจบ)
function giftDiamonds(d) {
  const g = d.gift || d.giftDetails || d.extendedGiftInfo || {};
  const type = g.type ?? g.giftType ?? d.giftType;
  const combo = type === 1 || g.combo === true;
  if (combo && !Number(d.repeatEnd)) return 0;
  const each = Number(g.diamondCount ?? d.diamondCount) || 1;
  return each * (Number(d.repeatCount) || 1);
}

function disconnectTikTok() {
  clearTimeout(reconnectTimer);
  connected = false;
  if (conn) {
    try {
      conn.removeAllListeners();
      conn.disconnect();
    } catch {}
    conn = null;
  }
}

function connectTikTok(username, keep = false) {
  username = String(username || '').trim().replace(/^@/, '');
  const same = source.mode === 'tiktok' && source.username === username;
  disconnectTikTok();
  stopDemo();
  if (!username) return;
  // ต่อใหม่กับห้องเดิม (เน็ตหลุด/กดเชื่อมต่อซ้ำ) = เก็บผู้ชมและยอดเดิมไว้
  if (!(keep || same)) clearRoom();
  connected = false;
  source = { mode: 'tiktok', username, status: 'กำลังเชื่อมต่อ…' };
  lastUser = username;
  save();

  let lib;
  try {
    lib = require('tiktok-live-connector');
  } catch (e) {
    source.status = 'ไม่พบแพ็กเกจ tiktok-live-connector (รัน npm install ก่อน)';
    return;
  }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  const opts = {};
  if (eulerKey) opts.signApiKey = eulerKey;
  const c = (conn = new TikTokLiveConnection(username, opts));
  const safe = (fn) => (data) => {
    try {
      const u = pickUser(data);
      if (u) fn(u, data);
    } catch (e) {
      console.error('event error', e);
    }
  };
  const retry = (why) => {
    if (conn !== c) return;
    connected = false;
    source.status = `${why} — จะลองใหม่ใน 15 วินาที`;
    console.log('[tiktok]', source.status);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => conn === c && connectTikTok(username, true), 15000);
  };

  c.on(WebcastEvent.MEMBER, safe((u) => on.join(u)));
  c.on(WebcastEvent.CHAT, safe((u) => on.chat(u)));
  c.on(WebcastEvent.LIKE, safe((u, d) => on.like(u, likeCount(d))));
  c.on(WebcastEvent.FOLLOW, safe((u) => on.follow(u)));
  c.on(WebcastEvent.SHARE, safe((u) => on.share(u)));
  c.on(
    WebcastEvent.GIFT,
    safe((u, d) => {
      const diamonds = giftDiamonds(d);
      if (diamonds > 0) on.gift(u, diamonds);
      else on.join(u); // คอมโบยังไม่จบ รอให้จบก่อนค่อยนับ
    })
  );
  c.on(WebcastEvent.STREAM_END, () => retry('ไลฟ์จบแล้ว'));
  c.on(ControlEvent.DISCONNECTED, () => retry('หลุดการเชื่อมต่อ'));
  c.on(ControlEvent.ERROR, (e) => console.error('[tiktok] error', e && (e.info || e.message || e)));

  c.connect()
    .then((state) => {
      if (conn !== c) return;
      connected = true;
      const now = Date.now();
      for (const v of viewers.values()) v.lastActive = now; // เริ่มนับเวลาเงียบใหม่หลังต่อกลับมา
      source.status = `เชื่อมต่อแล้ว (ห้อง ${state.roomId})`;
      console.log('[tiktok] connected', username, state.roomId);
    })
    .catch((err) => retry(`เชื่อมต่อไม่ได้: ${(err && err.message) || err}`));
}

// ---------- โหมดทดลอง (ผู้ชมจำลอง) ----------
const DEMO_NAMES = [
  'น้องฟ้า', 'พี่ต้น', 'ส้มตำ', 'บักหำ', 'มะลิ', 'ใบเตย', 'Midnight', 'rocket', 'PPoppy', 'ตุ๊กตา',
  'แม่บุญมา', 'พ่อใหญ่สี', 'อีหล่า', 'ข้าวเหนียว', 'ปลาร้า', 'น้ำฝน', 'MILKY', 'กิ๊ฟ', 'สายรำ', 'ลำซิ่ง',
  'เจ้าหญิงอีสาน', 'หนุ่มนาข้าว', 'สาวกันตรึม', 'ไก่ชน', 'แคทกะเซีย', 'มายด์', 'โอ๊ต', 'เบียร์', 'จ๋า', 'นุ่น',
  'Georgia', 'Sunisa', 'Piyawat', 'ต้นข้าว', 'ดาวเรือง', 'บัวลอย', 'ขนุน', 'ลำไย', 'เพชร', 'ทองดี',
  'แก้วตา', 'ภูผา', 'สายลม', 'ดอกคูน', 'หมอลำน้อย', 'กระแต', 'เต้ย', 'ก้อง', 'แอน', 'ปุยฝ้าย',
];
let demoTimer = null;
let demoSeq = 0;
const demoBots = new Map(); // id -> เวลาที่จะเลิกดู

function addBot() {
  const name = DEMO_NAMES[demoSeq % DEMO_NAMES.length];
  const id = `demo_${demoSeq++}`;
  demoBots.set(id, Date.now() + (40 + Math.random() * 400) * 1000);
  on.join({ id, name, avatar: '' });
}
// เปิด/ปิดผู้ชมจำลองอัตโนมัติ (ใช้ได้เฉพาะโหมดทดสอบ)
function setAuto(flag) {
  clearInterval(demoTimer);
  demoTimer = null;
  source.auto = !!flag;
  source.status = flag ? 'โหมดทดสอบ (จำลองผู้ชมอัตโนมัติ)' : 'โหมดทดสอบ (กดจำลองเองทีละคน)';
  if (!flag) return demoBots.clear(); // บอตที่อยู่ในฉากจะเงียบแล้วหายไปเองตามเวลา
  if (viewers.size < 6) {
    for (let i = 0; i < 14; i++) addBot();
    // ให้เห็นเวทีทันที
    let i = 0;
    for (const v of viewers.values()) {
      if (!demoBots.has(v.id)) continue;
      v.joinedAt -= 600000;
      v.likes = 200 - i * 12;
      if (i % 4 === 0) v.gifts = 30 - i;
      v.score = 300 - i++ * 12;
    }
  }
  demoTimer = setInterval(() => {
    const now = Date.now();
    if (Math.random() < 0.5 && demoBots.size < 40) addBot();
    for (const [id, until] of demoBots) {
      const v = viewers.get(id);
      if (!v) {
        demoBots.delete(id);
        continue;
      }
      if (now > until) continue; // เลิกดูแล้ว: เงียบ รอหมดเวลาแล้วหายไปเอง
      const r = Math.random();
      const u = { id };
      if (r < 0.3) on.like(u, 1 + Math.floor(Math.random() * 15));
      else if (r < 0.36) on.chat(u);
      else if (r < 0.375) on.gift(u, [1, 1, 5, 10, 30][Math.floor(Math.random() * 5)]);
      else if (r < 0.38) on.follow(u);
      else if (r < 0.5) on.join(u);
    }
  }, 1000);
}
// โหมดทดสอบ: ไม่ต่อ TikTok ใช้ผู้ชมจำลองทั้งหมด
function startTest(auto = true) {
  disconnectTikTok();
  stopDemo();
  clearRoom();
  source = { mode: 'test', username: '', auto: false, status: '' };
  setAuto(auto);
}
// โหมดรันจริง: ล้างผู้ชมจำลองออก รอเชื่อมต่อไลฟ์
function goLive() {
  disconnectTikTok();
  stopDemo();
  clearRoom();
  source = { mode: 'idle', username: '', status: 'โหมดรันจริง: ยังไม่ได้เชื่อมต่อ' };
}
// จำลองเหตุการณ์ทีละคนจากแท็บทดสอบ
function testAction(data) {
  const name = String(data.name || '').replace(/\s+/g, ' ').trim().slice(0, 30) || 'ผู้ชมทดสอบ';
  const u = { id: `test_${name}`, name, avatar: '' };
  const n = clamp(Math.round(+data.n) || 1, 1, 9999);
  switch (data.action) {
    case 'join': on.join(u); break;
    case 'like': on.like(u, n); break;
    case 'chat': on.chat(u); break;
    case 'follow': on.follow(u); break;
    case 'share': on.share(u); break;
    case 'gift': on.gift(u, clamp(Math.round(+data.diamonds) || 1, 1, 50000) * n); break;
    case 'leave': { const v = viewers.get(u.id); if (v) drop(v); break; }
    default: return false;
  }
  return true;
}
function stopDemo() {
  clearInterval(demoTimer);
  demoTimer = null;
  demoBots.clear();
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const ROOTS = [
  ['/vendor/three/', path.join(__dirname, 'node_modules/three/')],
  ['/', path.join(__dirname, 'public/')],
];

function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);

  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  for (const [prefix, dir] of ROOTS) {
    if (!p.startsWith(prefix)) continue;
    const file = path.join(dir, p.slice(prefix.length));
    if (!file.startsWith(dir)) break;
    return fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': prefix === '/' ? 'no-cache' : 'public, max-age=86400',
      });
      res.end(buf);
    });
  }
  res.writeHead(404);
  res.end('not found');
}

function handleApi(req, res, url) {
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'GET' && url.pathname === '/api/status') {
    return json(200, { source, cfg, maxStage: maxStage(), needKey: !!ADMIN_KEY, viewers: viewers.size, username: lastUser, hasKey: !!eulerKey });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let body = '';
  req.on('data', (d) => {
    body += d;
    if (body.length > 1e4) req.destroy();
  });
  req.on('end', () => {
    let data = {};
    try {
      data = JSON.parse(body || '{}');
    } catch {}
    if (ADMIN_KEY && data.key !== ADMIN_KEY) return json(401, { error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
    switch (url.pathname) {
      case '/api/connect':
        if (!String(data.username || '').trim()) return json(400, { error: 'กรุณาใส่ชื่อผู้ใช้ TikTok' });
        connectTikTok(data.username);
        break;
      case '/api/demo':
        startTest(true);
        break;
      case '/api/mode':
        if (data.mode === 'test') startTest(data.auto !== false);
        else if (data.mode === 'live') goLive();
        else return json(400, { error: 'mode' });
        break;
      case '/api/test':
        if (source.mode !== 'test') return json(400, { error: 'ใช้ได้เฉพาะโหมดทดสอบ (สลับโหมดที่แท็บ "เริ่มไลฟ์")' });
        if (data.action === 'reset') startTest(false);
        else if (data.action === 'auto') setAuto(!!data.on);
        else if (!testAction(data)) return json(400, { error: 'action' });
        break;
      case '/api/stop':
        disconnectTikTok();
        stopDemo();
        clearRoom();
        source = { mode: 'idle', username: '', status: 'โหมดรันจริง: หยุดแล้ว' };
        break;
      case '/api/config':
        if (typeof data.eulerKey === 'string') eulerKey = data.eulerKey.trim().slice(0, 200);
        if (typeof data.title === 'string') cfg.title = data.title.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (data.stageWidth) cfg.stageWidth = clamp(Math.round(+data.stageWidth * 2) / 2 || 13, 8, 22);
        if (['kanok', 'naga', 'diamond', 'moon'].includes(data.theme)) cfg.theme = data.theme;
        if (Array.isArray(data.shops)) cfg.shops = data.shops.slice(0, MAX_SHOPS).map((x) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 40));
        if (['manual', 'gift'].includes(data.shopMode)) cfg.shopMode = data.shopMode;
        if (data.stageSize) cfg.stageSize = Math.round(+data.stageSize) || 10;
        cfg.stageSize = clamp(cfg.stageSize, 1, maxStage());
        if (data.idleTimeout) cfg.idleTimeout = clamp(+data.idleTimeout || 180, 15, 3600);
        if (data.minStageSeconds != null) cfg.minStageSeconds = clamp(+data.minStageSeconds || 0, 0, 3600);
        if (data.picSize) cfg.picSize = clamp(+data.picSize || 34, 15, 70);
        if (data.bpm) cfg.bpm = clamp(+data.bpm || 128, 60, 200);
        save();
        broadcast(snapshot());
        break;
      case '/api/camera':
        cam = validCam(data.cam) ? { p: data.cam.p, t: data.cam.t } : null;
        camRev++;
        save();
        broadcast({ t: 'cam', cam, camRev });
        return json(200, { ok: true, camRev });
      default:
        return json(404, { error: 'not found' });
    }
    json(200, { ok: true, source, cfg });
  });
}

// กันโปรแกรมดับกลางไลฟ์เพราะข้อผิดพลาดที่ไม่คาดคิดจากตัวเชื่อมต่อ
process.on('uncaughtException', (e) => console.error('[error]', e));
process.on('unhandledRejection', (e) => console.error('[error]', e));

// ---------- เริ่มทำงาน ----------
setInterval(tick, 1000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`เวทีพร้อมแล้ว: http://localhost:${PORT}`);
  if (process.env.TIKTOK_USERNAME) connectTikTok(process.env.TIKTOK_USERNAME);
  else startTest(true);
});
