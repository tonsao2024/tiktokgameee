'use strict';

/**
 * ตัวเชื่อม TikTok LIVE → เกมส์
 * ใช้ไลบรารี่ tiktok-live-connector (ต้องการ SIGN_API_KEY ฟรีจาก eulerstream.com)
 * เหตุการณ์: คนเข้า / แชท / ไลก์ / แชร์ / ติดตาม / ของขวัญ / จำนวนผู้ชม / จบ LIVE
 */

const { state, addViewer, pushChat, pushFeed } = require('./state');
const { config } = require('./config');
const { roomUserChanged } = require('./engine');

let lib = null;
try {
  // Node >= 22 รองรับ require() กับ ESM ได้
  lib = require('tiktok-live-connector');
} catch (err) {
  lib = null;
}

const WebcastEvent = lib ? lib.WebcastEvent : null;
const ControlEvent = lib ? lib.ControlEvent : null;
let connection = null;
let reconnectTimer = null;
let shouldRun = false;
let currentUsername = '';

function avatarOf(user) {
  return (
    user?.avatarThumb?.urlList?.[0] ||
    user?.avatarMedium?.urlList?.[0] ||
    user?.avatarLarge?.urlList?.[0] ||
    ''
  );
}

function userPayload(user) {
  return {
    uniqueId: user?.displayId || user?.id || '',
    nickname: user?.nickname || 'ผู้ชม',
    avatar: avatarOf(user),
    profileUrl: user?.displayId ? `https://www.tiktok.com/@${user.displayId}` : '',
  };
}

function setSource(patch) {
  Object.assign(state.source, patch);
}

function bindEvents(conn) {
  conn.on(ControlEvent.CONNECTED, (roomInfo) => {
    const owner = roomInfo?.data?.owner || roomInfo?.owner || {};
    state.host = {
      name: owner.nickname || owner.display_id || currentUsername,
      avatar: (owner.avatar_thumb?.url_list || owner.avatarThumb?.urlList || [])[0] || state.host.avatar,
    };
    state.roomTitle = roomInfo?.data?.title || state.roomTitle;
    setSource({ mode: 'tiktok', connected: true, lastError: '' });
    pushFeed(`เชื่อมต่อ LIVE ของ @${currentUsername} แล้ว 🎉`, '🔴');
  });

  conn.on(ControlEvent.DISCONNECTED, () => {
    setSource({ connected: false, lastError: 'ขาดการเชื่อมต่อ กำลัง reconnect...' });
    scheduleReconnect();
  });

  conn.on(ControlEvent.ERROR, (err) => {
    setSource({ connected: false, lastError: String(err?.message || err) });
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    setSource({ connected: false, lastError: 'LIVE จบแล้ว' });
    pushFeed('LIVE จบแล้ว 🎬', '🎬');
    stop();
  });

  // ---------- คนเข้ามาใน LIVE ----------
  conn.on(WebcastEvent.MEMBER, (data) => {
    // action 1 = JOINED
    if (typeof data.action === 'number' && data.action !== 1) return;
    const v = addViewer(userPayload(data.user));
    v.lastSeenAt = Date.now();
  });

  // ---------- แชท ----------
  conn.on(WebcastEvent.CHAT, (data) => {
    const p = userPayload(data.user);
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    v.chatCount += 1;
    pushChat({ ...p, message: data.content });
  });

  // ---------- ไลก์ ----------
  conn.on(WebcastEvent.LIKE, (data) => {
    const p = userPayload(data.user);
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    const n = Number(data.count) || 1;
    v.likes += n;
    state.stats.totalLikes += n;
  });

  // ---------- แชร์ LIVE ----------
  conn.on(WebcastEvent.SHARE, (data) => {
    const p = userPayload(data.user);
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    v.shares += 1;
    state.stats.totalShares += 1;
    pushFeed(`${p.nickname} แชร์ LIVE`, '📣');
  });

  conn.on(WebcastEvent.SOCIAL, (data) => {
    // เผื่อว่าแชร์ไม่มา ให้ใช้ social event จับ follow/share แทน
    const p = userPayload(data.user);
    if (!p.uniqueId && !p.nickname) return;
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    if (Number(data.followCount) > 0 || String(data.action || '').includes('follow')) {
      v.follows = true;
      pushFeed(`${p.nickname} กดติดตาม`, '💖');
    }
  });

  conn.on(WebcastEvent.FOLLOW, (data) => {
    const p = userPayload(data.user);
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    v.follows = true;
    pushFeed(`${p.nickname} กดติดตาม`, '💖');
  });

  // ---------- ของขวัญ ----------
  conn.on(WebcastEvent.GIFT, (data) => {
    const p = userPayload(data.user);
    const v = addViewer(p);
    v.lastSeenAt = Date.now();
    const repeat = Number(data.repeatCount) || Number(data.comboCount) || 1;
    const each = Number(data.gift?.diamondCount ?? data.fanTicketCount) || 0;
    const diamonds = each * repeat;
    const giftName = data.gift?.name || 'ของขวัญ';
    if (!v.giftDiamonds) {
      v.giftCount += 1;
      state.stats.totalGifts += 1;
    }
    v.giftDiamonds += diamonds;
    v.giftCount = Math.max(v.giftCount, 1);
    state.stats.giftDiamonds += diamonds;
    if (diamonds > 0) pushFeed(`${p.nickname} ส่ง ${giftName} ×${repeat} (${diamonds}💎)`, '🎁');
  });

  // ---------- จำนวนผู้ชม ----------
  conn.on(WebcastEvent.ROOM_USER, (data) => {
    const n = parseInt(data.totalUser || data.total || data.popularity || '0', 10);
    if (Number.isFinite(n) && n > 0) roomUserChanged(n);
  });
}

function scheduleReconnect() {
  if (!shouldRun || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (shouldRun) start(currentUsername).catch(() => {});
  }, 5000);
}

/** เริ่มเชื่อมต่อกับ LIVE ของ @username */
async function start(username) {
  if (!lib) {
    setSource({ mode: 'idle', connected: false, lastError: 'ไม่พบไลบรารี่ tiktok-live-connector (รัน npm install)' });
    throw new Error('missing-library');
  }
  if (!username) throw new Error('missing-username');

  shouldRun = true;
  currentUsername = username.replace(/^@/, '');
  config.tiktokUsername = currentUsername;

  await stop();

  connection = new lib.TikTokLiveConnection(currentUsername, {
    processInitialData: true,
    fetchRoomInfoOnConnect: true,
    enableExtendedGiftInfo: true,
    signApiKey: process.env.SIGN_API_KEY || undefined,
  });

  bindEvents(connection);

  try {
    await connection.connect();
    setSource({ mode: 'tiktok', connected: true, lastError: '' });
    return connection;
  } catch (err) {
    const msg = friendlyError(err);
    setSource({ mode: 'tiktok', connected: false, lastError: msg });
    pushFeed(`เชื่อมต่อไม่สำเร็จ: ${msg}`, '⚠️');
    scheduleReconnect();
    throw err;
  }
}

function friendlyError(err) {
  const name = err?.constructor?.name || err?.name || '';
  const msg = err?.message || String(err);
  if (name === 'UserOfflineError' || /offline/i.test(msg)) return 'คนนี้ยังไม่ได้ LIVE';
  if (name === 'AlreadyConnectedError') return 'เชื่อมต่ออยู่แล้ว';
  if (name === 'SignatureMissingTokensError' || /sign/i.test(msg)) {
    return 'ต้องตั้ง SIGN_API_KEY (ฟรีจาก eulerstream.com)';
  }
  if (/userNotExist|uniqueId/i.test(msg)) return 'ไม่พบ Username นี้';
  return msg;
}

async function stop() {
  shouldRun = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connection) {
    try { await connection.disconnect(); } catch (_) { /* ignore */ }
    connection = null;
  }
}

module.exports = { start, stop, isReady: () => !!lib, friendlyError };
