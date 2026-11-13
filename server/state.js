'use strict';

/**
 * เก็บสถานะเกมส์ทั้งหมดในหน่วยความจำ
 * ผู้ใช้แต่ละคน = "ตัวละคร" ที่มี ชื่อ + รูปโปรไฟล์ จาก TikTok
 */

const { config } = require('./config');

const state = {
  host: { name: config.hostName, avatar: config.hostAvatar },
  roomTitle: config.roomTitle,
  roomUserCount: 0,
  viewers: new Map(),   // id -> viewer
  stage: new Array(config.stageSlots).fill(null), // viewerId | null
  queue: [],            // viewerId เรียงตามลำดับความสำคัญ
  chat: [],             // ข้อความล่าสุด
  feed: [],             // เหตุการณ์ล่าสุด (แชร์ LIVE, ของขวัญ, ขึ้นเวที)
  stats: {
    totalJoined: 0,
    totalLeft: 0,
    totalGifts: 0,
    giftDiamonds: 0,
    totalLikes: 0,
    totalShares: 0,
    totalComments: 0,
    totalPromoted: 0,
  },
  source: { mode: 'idle', connected: false, lastError: '' }, // idle | tiktok | sim
};

let seq = 0;
function nextId(prefix = 'v') {
  seq += 1;
  return `${prefix}${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeViewer({ id, uniqueId, nickname, avatar, profileUrl }) {
  const now = Date.now();
  return {
    id: id || nextId(),
    uniqueId: uniqueId || '',
    nickname: nickname || 'ผู้ชม',
    avatar: avatar || '',
    profileUrl: profileUrl || (uniqueId ? `https://www.tiktok.com/@${uniqueId}` : ''),
    joinedAt: now,
    lastSeenAt: now,
    watchMs: 0,
    score: 0,
    likes: 0,
    chatCount: 0,
    giftDiamonds: 0,
    giftCount: 0,
    shares: 0,
    follows: false,
    seat: -1,
    promotedAt: 0,
    leaving: false,
    leavingAt: 0,
  };
}

function addViewer(data) {
  const existing = data.uniqueId && state.viewers.get(`u:${data.uniqueId}`);
  if (existing) {
    existing.lastSeenAt = Date.now();
    if (existing.avatar !== data.avatar && data.avatar) existing.avatar = data.avatar;
    if (existing.nickname !== data.nickname && data.nickname) existing.nickname = data.nickname;
    if (existing.leaving) {
      // กลับเข้ามาอีกครั้ง = วิ่งฮูด ๆ กลับมา
      existing.leaving = false;
      existing.leavingAt = 0;
      state.queue.push(existing.id);
    }
    return existing;
  }

  // จำกัดจำนวน viewer ที่ track
  if (state.viewers.size >= config.maxTrackedViewers) removeOldestInactive();

  const viewer = makeViewer(data);
  viewer.id = `u:${data.uniqueId}` || viewer.id;
  state.viewers.set(viewer.id, viewer);
  state.queue.push(viewer.id);
  state.stats.totalJoined += 1;
  return viewer;
}

function removeOldestInactive() {
  // ไล่คนที่แย่ที่สุดออกเพื่อคืนที่
  const candidates = [...state.viewers.values()]
    .filter((v) => !v.leaving && v.seat < 0)
    .sort((a, b) => a.score - b.score || a.joinedAt - b.joinedAt);
  const victim = candidates[0] || [...state.viewers.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (victim) hardRemove(victim.id);
}

function hardRemove(viewerId) {
  const viewer = state.viewers.get(viewerId);
  if (!viewer) return;
  if (viewer.seat >= 0) state.stage[viewer.seat] = null;
  const qi = state.queue.indexOf(viewerId);
  if (qi >= 0) state.queue.splice(qi, 1);
  state.viewers.delete(viewerId);
  state.stats.totalLeft += 1;
}

function markLeaving(viewerId) {
  const viewer = state.viewers.get(viewerId);
  if (!viewer || viewer.leaving) return;
  viewer.leaving = true;
  viewer.leavingAt = Date.now();
  // ออกจากคิว/เวทีทันที จะได้มีคนใหม่แทนที่
  const qi = state.queue.indexOf(viewerId);
  if (qi >= 0) state.queue.splice(qi, 1);
  if (viewer.seat >= 0) {
    state.stage[viewer.seat] = null;
    viewer.seat = -1;
  }
}

function pushChat({ userId, uniqueId, nickname, avatar, message }) {
  const item = {
    id: nextId('c'),
    userId: userId || `u:${uniqueId || 'anon'}`,
    uniqueId: uniqueId || '',
    nickname: nickname || 'ผู้ชม',
    avatar: avatar || '',
    message: String(message || '').slice(0, 200),
    at: Date.now(),
  };
  state.chat.push(item);
  if (state.chat.length > 60) state.chat.splice(0, state.chat.length - 60);
  state.stats.totalComments += 1;
  return item;
}

function pushFeed(text, icon) {
  const item = { id: nextId('f'), text, icon: icon || '✨', at: Date.now() };
  state.feed.unshift(item);
  if (state.feed.length > 12) state.feed.pop();
  return item;
}

/** summary ที่ client ใช้วาดตัวละคร */
function brief(viewerId) {
  const v = viewerId ? state.viewers.get(viewerId) : null;
  if (!v) return null;
  const now = Date.now();
  return {
    id: v.id,
    nickname: v.nickname,
    avatar: v.avatar,
    profileUrl: v.profileUrl,
    watchMs: v.watchMs,
    score: Math.floor(v.score),
    likes: v.likes,
    chatCount: v.chatCount,
    giftDiamonds: v.giftDiamonds,
    seat: v.seat,
    leaving: v.leaving,
    leavingAt: v.leavingAt,
    joinedAt: v.joinedAt,
    promotedAt: v.promotedAt,
    justPromoted: v.promotedAt > 0 && now - v.promotedAt < 4000,
    isNew: now - v.joinedAt < 6000,
  };
}

/** snapshot ส่งไปให้ browser วาด — เฉพาะ field ที่ client ต้องใช้ */
function snapshot() {
  return {
    t: Date.now(),
    host: state.host,
    roomTitle: state.roomTitle,
    roomUserCount: state.roomUserCount,
    onlineCount: state.viewers.size,
    stage: state.stage.map((id) => brief(id)),
    queue: state.queue.slice(0, config.queueSlots).map((id) => brief(id)),
    queueTotal: state.queue.length,
    chat: state.chat.slice(-30),
    feed: state.feed,
    stats: state.stats,
    source: state.source,
    config: { ...config },
  };
}

module.exports = {
  state,
  nextId,
  makeViewer,
  addViewer,
  hardRemove,
  markLeaving,
  pushChat,
  pushFeed,
  brief,
  snapshot,
};
