'use strict';

/**
 * การตั้งค่าทั้งหมดของเกมส์ — ปรับได้จากหน้า Admin Panel (/admin) โดยไม่ต้องรีสตาร์ต
 */

const config = {
  // ---------- TikTok ----------
  tiktokUsername: process.env.TIKTOK_USERNAME || '',

  // ---------- เกมส์ ----------
  stageSlots: 12,          // จำนวนช slot บนเวที
  queueSlots: 12,          // จำนวนคนที่แสดงด้านล่าง (คนที่รอขึ้นเวที)
  watchToStageSeconds: 10, // ดูครบกี่วินาที = มีสิทธิขึ้นเวที
  giftInstantStage: true,  // ของขวัญ = เด้งขึ้นเวทีทันที
  likeBoost: 0.05,         // 1 ไลก์ = ช่วยลดเวลารอ (วินาที)
  chatBoost: 0.5,          // คอมเมนต์ 1 ครั้ง = ช่วยลดเวลารอ (วินาที)
  leaveInactiveSeconds: 45, // อยู่บนเวทีแล้วไม่พูด/ไม่กดไลก์/ไม่แชร์ = ถือว่าว้าจากไป
  roomUserKick: true,      // จำนวนผู้ชมลดลง = ไล่คนออกตาม
  maxTrackedViewers: 400,  // จำกัดจำนวน viewer ที่ track (กัน memory)
  tickMs: 500,             // กลไกเกมส์คิดทุกกี่มิลลิวินาที

  // ---------- ตัวแทนทดสอบ (Simulator) ----------
  simEnabled: true,        // เปิด simulator ตอนเริ่มต้น (กัน TikTok ต่อไม่ได้ตอนสาธิต)
  simJoinPerMin: 18,       // เฉลี่ยคนใหม่เข้าต่อนาที
  simLeavePerMin: 7,       // เฉลี่ยคนออกต่อนาที
  simLikePerMin: 30,
  simChatPerMin: 12,
  simGiftPerMin: 2,

  // ---------- อื่นๆ ----------
  hostName: process.env.HOST_NAME || 'tiktokgameee',
  hostAvatar: process.env.HOST_AVATAR || '/assets/host-avatar.svg',
  roomTitle: '',
};

module.exports = { config };
