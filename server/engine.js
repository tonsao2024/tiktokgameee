'use strict';

/**
 * เกมส์ engine — "วงล้อชีวิต" ของตัวละคร:
 *   1. คนเข้ามา → นั่งรอด้านล่าง เริ่มสะสมเวลาดู
 *   2. ดูครบเกณฑ์ (หรือมีสิทธิพิเศษจากไลก์/คอมเมนต์/ของขวัญ) → ขึ้นเวที
 *   3. ไม่ดูต่อ / ออกจาก LIVE → ว๊าปหาย มีคนใหม่ที่ถึงอันดับขึ้นแทน
 */

const { state, hardRemove, markLeaving, pushFeed } = require('./state');
const { config } = require('./config');

let tickCount = 0;

/** คะแนนรวม = เวลาดู + ปฏิสัมพันธ์ (ยิ่งนิ่งกับ LIVE ยิ่งขึ้นเร็ว) */
function computeScore(v) {
  const seconds = v.watchMs / 1000;
  return (
    seconds +
    v.likes * config.likeBoost +
    v.chatCount * config.chatBoost +
    v.giftDiamonds * 5
  );
}

/** เงื่อนไข "พร้อมขึ้นเวที" */
function isReadyForStage(v) {
  const seconds = v.watchMs / 1000;
  if (config.giftInstantStage && v.giftDiamonds > 0) return true;
  return seconds >= config.watchToStageSeconds;
}

/** จัดลำดับคิว: คะแนนมากก่อน เท่า ๆ กันคิ้อยาวก่อน */
function sortQueue() {
  state.queue.sort((a, b) => {
    const va = state.viewers.get(a);
    const vb = state.viewers.get(b);
    if (!va || !vb) return 0;
    return computeScore(vb) - computeScore(va) || va.joinedAt - vb.joinedAt;
  });
}

/** ย้ายคนที่ครบเกณฑ์ขึ้นเวที (คนใหม่อยู่ด้านล่างก่อน ต้องผ่านเกณฑ์) */
function promoteToStage() {
  const empties = [];
  state.stage.forEach((id, i) => { if (!id) empties.push(i); });
  if (!empties.length) return;

  const candidates = state.queue
    .map((id) => state.viewers.get(id))
    .filter((v) => v && !v.leaving)
    .sort((a, b) => computeScore(b) - computeScore(a) || a.joinedAt - b.joinedAt);
  if (!candidates.length) return;

  let pool = candidates.filter(isReadyForStage);

  // เวทียังว่างหมดและยังไม่มีใครถึงเกณฑ์ → ดึงคนที่รอนานสุดขึ้นก่อน (กันหน้าจอโล่ง)
  // แต่ต้องดูไปเกินครึ่งเกณฑ์แล้ว จึงไม่ให้คนเพิ่งเข้ามากระโดดขึ้นทันที
  if (!pool.length && empties.length === state.stage.length) {
    const top = candidates[0];
    if (top && top.watchMs >= (config.watchToStageSeconds * 1000) / 2) pool = [top];
  }
  if (!pool.length) return;

  for (const seat of empties) {
    const v = pool.shift();
    if (!v) break;
    v.seat = seat;
    state.stage[seat] = v.id;
    v.promotedAt = Date.now();
    const qi = state.queue.indexOf(v.id);
    if (qi >= 0) state.queue.splice(qi, 1);
    state.stats.totalPromoted += 1;
    if (v.giftDiamonds > 0 && v.promotedAt - v.joinedAt < 10000) {
      pushFeed(`${v.nickname} ส่งของขวัญ เด้งขึ้นเวที!`, '🎁');
    } else {
      pushFeed(`${v.nickname} ขึ้นเวที!`, '🌟');
    }
  }
}

/** ตรวจคนที่ "ไม่ดูต่อ": ไม่มีการตอบสนองนานเกินไป = ถือว่าว้างไป */
function detectDepartures() {
  const now = Date.now();
  const stageTimeout = config.leaveInactiveSeconds * 1000;
  const queueTimeout = stageTimeout * 2;

  for (const v of state.viewers.values()) {
    if (v.leaving) continue;
    const idle = now - v.lastSeenAt;
    if (v.seat >= 0 && idle > stageTimeout) {
      markLeaving(v.id);
      pushFeed(`${v.nickname} ออกจากไป...`, '👋');
    } else if (v.seat < 0 && idle > queueTimeout) {
      markLeaving(v.id);
      pushFeed(`${v.nickname} เลิกดูแล้ว`, '💤');
    }
  }
}

/** ผู้ชมรวมลดลง = ไล่คนออกตามจำนวนที่ลด */
function applyRoomUserDelta(prev, next) {
  const drop = prev - next;
  if (drop <= 0 || !config.roomUserKick) return;
  // ไล่คนที่คะแนนต่ำสุด/ไม่ปฏิสัมพันธ์ออกก่อน
  const candidates = [...state.viewers.values()]
    .filter((v) => !v.leaving)
    .sort((a, b) => {
      const activity = (x) => x.likes + x.chatCount * 2 + x.giftDiamonds * 3;
      return activity(a) - activity(b) || a.joinedAt - b.joinedAt;
    });
  const n = Math.min(drop, candidates.length);
  for (let i = 0; i < n; i += 1) markLeaving(candidates[i].id);
}

/** ลบคนที่เล่นอนิเมชันหายไปจบแล้ว */
function cleanupLeaving() {
  const now = Date.now();
  for (const v of [...state.viewers.values()]) {
    if (v.leaving && now - v.leavingAt > 1400) hardRemove(v.id);
  }
}

/** จุดหลัก: ถูกเรียกทุก tick */
function tick(deltaMs) {
  tickCount += 1;

  // 1) สะสมเวลาดู + คะแนน
  for (const v of state.viewers.values()) {
    if (v.leaving) continue;
    v.watchMs += deltaMs;
    v.score = computeScore(v);
  }

  // 2) จัดคิวใหม่ + เลื่อนขึ้นเวที
  sortQueue();
  promoteToStage();

  // 3) คนออก / ไม่ดูต่อ
  detectDepartures();

  // 4) ลบคนที่หายไปแล้ว
  cleanupLeaving();

  // 5) sync ตัวเลขผู้ชมห้อง ถ้าไม่มีแหล่งข้อมูล
  if (state.roomUserCount < state.viewers.size) state.roomUserCount = state.viewers.size;
  void tickCount;
}

function roomUserChanged(next) {
  const prev = state.roomUserCount;
  state.roomUserCount = next;
  applyRoomUserDelta(prev, next);
}

module.exports = { tick, roomUserChanged, sortQueue, promoteToStage, computeScore, isReadyForStage };
