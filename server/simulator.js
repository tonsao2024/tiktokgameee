'use strict';

/**
 * Simulator — ปลอมผู้ชมเข้า LIVE สำหรับทดสอบเกมส์โดยไม่ต้องต่อ TikTok จริง
 * มีทั้ง คนเข้า / แชท / ไลก์ / แชร์ / ของขวัญ / ออกจากไป
 */

const { state, addViewer, pushChat, pushFeed, markLeaving } = require('./state');
const { config } = require('./config');

const THAI_NAMES = [
  'น้องแนน', 'ก้อง สะใสน้', 'ปลาบ๊วย', 'คุณชายฟู', 'มิ้นต์ มินต์', 'ปายตัวน้อย',
  'ชานนท์ อดีตหมอ', 'โบว์มาก', 'ต้นหนู', 'เจเจจัง', 'เบนซ์คลั่งรัก', 'แพรว здесь',
  'คิม หัวใจบ้าน', 'แองเจิ้ล', 'ตั้มกำไร', 'โจ้13579', 'นาคา อินดา', 'ฝน любовь',
  'บี ทองคู่', 'เอิร์น ชวนนอน', 'โอ๊ต ปรุงดี', 'แนน ว้าวุ่น', 'กิ้ม กดดี้',
  'แมวส้ม', 'แอมป์การ์ด', 'โบ๊ตที่รัก', 'ชิบะ', 'เจมส์ เด้งม้า', 'เปี้ยวปัง',
  'ลูกชิ้น_sub', 'น้ำหวาน', 'ตาหวาน', 'พีคน้อย', 'จ๋าโมเน', 'ข้าวหอม',
  'ซอส อร่อย', 'เดียร์ะ', 'ฟิล์มดี', 'หยก คนสนิท', 'โอ護卫', 'กันต์มาดมา',
];

const CHATS = [
  'สวัสดีครับ', 'มาแล้วครับ', 'HI', 'เล่นเกมส์อะไรครับ', 'สวยมากครับ',
  'ครบ 6 รายการยังครับ', 'เล่นกันได้ไหม', 'ไหวมั้ย', 'เชียร์เลย', 'อย่าหายไปสิ',
  'โคตรดี', 'เกมส์นี้สนุกมาก', 'มีคนไทยไหม', 'หวัดดี', 'ซัพพอร์ตครับ',
  'ขึ้นเวทีแล้ว', 'ฟังเพลงสนุก', 'ทำไมดีจัง', 'ส่งวิไปแล้ว', 'ยอดเลย',
];

const GIFTS = ['Rose', 'Finger Heart', 'Perfume', 'Doughnut', 'Rainbow', 'Corgi', 'Lion', 'TikTok Universe'];
const EMOJI_FACES = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐰', '🐱', '🐶', '🦁', '🐨', '🐷', '🐮'];

let timers = [];
let running = false;
let counter = 0;
let roomUserTarget = 120;

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function avatarFor(name, face) {
  const colors = ['#ff7eb6', '#ff65a3', '#7afcff', '#feff9c', '#fff740', '#8affc1', '#a3a1ff', '#ffb26b'];
  const bg = colors[Math.floor(Math.random() * colors.length)];
  const label = face || (name || 'U').trim().charAt(0);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
    `<rect width="128" height="128" rx="64" fill="${bg}"/>` +
    `<text x="64" y="86" font-size="72" text-anchor="middle" fill="rgba(0,0,0,.55)" font-family="sans-serif">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeFakeViewer() {
  counter += 1;
  const name = `${rand(THAI_NAMES)}${Math.random() < 0.5 ? '' : ' ' + randInt(10, 9999)}`;
  const face = rand(EMOJI_FACES);
  return {
    uniqueId: `sim${counter}`,
    nickname: name,
    avatar: avatarFor(name, face),
    profileUrl: '',
  };
}

function simJoin() {
  const data = makeFakeViewer();
  const v = addViewer(data);
  v.lastSeenAt = Date.now();
  roomUserTarget += randInt(1, 4);
}

function simChat() {
  const active = [...state.viewers.values()].filter((v) => !v.leaving);
  if (!active.length) return;
  const v = rand(active);
  const msg = rand(CHATS);
  v.chatCount += 1;
  v.lastSeenAt = Date.now();
  pushChat({ userId: v.id, uniqueId: v.uniqueId, nickname: v.nickname, avatar: v.avatar, message: msg });
}

function simLike() {
  const active = [...state.viewers.values()].filter((v) => !v.leaving);
  if (!active.length) return;
  const v = rand(active);
  v.likes += randInt(1, 9);
  v.lastSeenAt = Date.now();
  state.stats.totalLikes += randInt(1, 9);
}

function simGift() {
  const active = [...state.viewers.values()].filter((v) => !v.leaving);
  if (!active.length) return;
  const v = rand(active);
  const diamonds = randInt(1, 100);
  v.giftDiamonds += diamonds;
  v.giftCount = 1;
  v.lastSeenAt = Date.now();
  state.stats.totalGifts += 1;
  state.stats.giftDiamonds += diamonds;
  pushFeed(`${v.nickname} ส่ง ${rand(GIFTS)} 💎`, '🎁');
}

function simShare() {
  const active = [...state.viewers.values()].filter((v) => !v.leaving);
  if (!active.length) return;
  const v = rand(active);
  v.shares += 1;
  v.lastSeenAt = Date.now();
  state.stats.totalShares += 1;
  pushFeed(`${v.nickname} แชร์ LIVE`, '📣');
}

/** สุ่มคนออกจาก LIVE — เน้นคนบนเวที (แล้วคนใหม่จากด้านล่างขึ้นแทน) */
function simLeave() {
  const active = [...state.viewers.values()].filter((v) => !v.leaving);
  if (!active.length) return;
  const onStage = active.filter((v) => v.seat >= 0);
  const inQueue = active.filter((v) => v.seat < 0);
  // 70% เอาคนบนเวทีออก (ได้ดูการส่งตั้ด), 30% เอาคนรอด้านล่าง
  let victim;
  if (onStage.length && (Math.random() < 0.7 || !inQueue.length)) victim = rand(onStage);
  else if (inQueue.length) victim = rand(inQueue);
  else victim = rand(active);
  const wasOnStage = victim.seat >= 0;
  markLeaving(victim.id);
  if (wasOnStage) pushFeed(`${victim.nickname} ออกจากไป...`, '👋');
  else pushFeed(`${victim.nickname} เลิกดูแล้ว`, '💤');
}

/** ปรับตัวเลขผู้ชมในห้อง — บางทีก็ตกฮวบเพื่อให้เกมส์ไล่คนออกตาม */
function simRoomUser() {
  const base = state.viewers.size + randInt(30, 120);
  if (Math.random() < 0.25) {
    // ผู้ชมหายไปเป็นก้อน = ไล่หลายคนพร้อมกัน
    roomUserTarget = Math.max(20, base - randInt(5, 18));
  } else {
    roomUserTarget = base;
  }
  state.roomUserCount = roomUserTarget;
}

function schedule() {
  timers = [];
  const every = (ms, fn) => timers.push(setInterval(fn, ms));

  every(60000 / config.simJoinPerMin, simJoin);
  every(60000 / config.simChatPerMin, simChat);
  every(60000 / config.simLikePerMin, simLike);
  every(60000 / config.simGiftPerMin, simGift);
  every(1000 * 45, simShare);
  every(60000 / config.simLeavePerMin, simLeave);
  every(1000 * 20, simRoomUser);
}

function start() {
  if (running) return;
  running = true;
  // เริ่มให้มีคนบ้างก่อน กันหน้าจอโล่ง
  for (let i = 0; i < randInt(6, 10); i += 1) simJoin();
  state.source = { mode: 'sim', connected: true, lastError: '' };
  state.roomUserCount = roomUserTarget;
  pushFeed('โหมดทดสอบ (Simulator) ทำงาน', '🧪');
  schedule();
}

function stop() {
  running = false;
  timers.forEach(clearInterval);
  timers = [];
  if (state.source.mode === 'sim') {
    state.source = { mode: 'idle', connected: false, lastError: '' };
  }
}

module.exports = { start, stop, isRunning: () => running, makeFakeViewer };
