'use strict';

/**
 * tiktokgameee — server หลัก
 *   - เสิร์ฟหน้าเว็บ (public/) ให้เปิดจาก browser ตัวเดียวก็ได้ (แคสต์ใส่ TikTok LIVE Studio)
 *   - WebSocket /ws ดันสถานะเกมส์ให้ browser ทุกตัวพร้อมกัน
 *   - Admin API (/api/*) สำหรับหน้า /admin: ตั้งค่า ต่อ TikTok เปิด/ปิด simulator
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const { config } = require('./config');
const { state, addViewer, hardRemove, markLeaving, pushFeed, snapshot } = require('./state');
const engine = require('./engine');
const tiktok = require('./tiktok');
const simulator = require('./simulator');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------- WebSocket: ดันสถานะเกมส์ ----------------
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', data: snapshot() }));
});

let lastBroadcast = 0;
function broadcast() {
  const now = Date.now();
  if (now - lastBroadcast < 200) return; // สูงสุด 5 ครั้ง/วิ
  lastBroadcast = now;
  const payload = JSON.stringify({ type: 'snapshot', data: snapshot() });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

// ---------------- กลไกเกมส์ ----------------
setInterval(() => {
  engine.tick(config.tickMs);
}, config.tickMs);
setInterval(broadcast, 250);

// ---------------- Admin API ----------------
const api = express.Router();

api.get('/state', (req, res) => {
  res.json({ ok: true, data: snapshot(), simRunning: simulator.isRunning() });
});

api.post('/connect', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) return res.status(400).json({ ok: false, error: 'กรอก @username ก่อน' });
  if (simulator.isRunning()) simulator.stop();
  try {
    await tiktok.start(username);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: tiktok.friendlyError(err) });
  }
});

api.post('/disconnect', async (req, res) => {
  await tiktok.stop();
  res.json({ ok: true });
});

api.post('/sim', (req, res) => {
  const on = !!req.body?.on;
  if (on) {
    if (state.source.mode === 'tiktok') {
      return res.status(400).json({ ok: false, error: 'กำลังเชื่อม TikTok อยู่ — กดตัดการเชื่อมต่อก่อน' });
    }
    simulator.start();
  } else {
    simulator.stop();
  }
  res.json({ ok: true, running: simulator.isRunning() });
});

api.post('/config', (req, res) => {
  const patch = req.body || {};
  const allowed = [
    'stageSlots', 'queueSlots', 'watchToStageSeconds', 'giftInstantStage',
    'likeBoost', 'chatBoost', 'leaveInactiveSeconds', 'roomUserKick',
    'simJoinPerMin', 'simLeavePerMin', 'simLikePerMin', 'simChatPerMin', 'simGiftPerMin',
    'hostName', 'hostAvatar', 'roomTitle',
  ];
  let stageChanged = false;
  for (const key of allowed) {
    if (!(key in patch)) continue;
    let value = patch[key];
    if (typeof config[key] === 'number') value = Number(value);
    if (typeof config[key] === 'boolean') value = !!value;
    if (config[key] === value) continue;
    config[key] = value;
    if (key === 'stageSlots') stageChanged = true;
  }
  if (stageChanged) resizeStage();
  // รีสตาร์ท simulator ให้ค่าที่ปรับมีผล
  if (simulator.isRunning()) { simulator.stop(); simulator.start(); }
  res.json({ ok: true, config: { ...config } });
});

function resizeStage() {
  const next = config.stageSlots;
  const cur = state.stage.length;
  if (next === cur) return;
  if (next < cur) {
    for (let i = cur - 1; i >= next; i -= 1) {
      const id = state.stage[i];
      if (id) {
        const v = state.viewers.get(id);
        if (v) { v.seat = -1; state.queue.push(id); }
        state.stage[i] = null;
      }
    }
    state.stage.length = next;
  } else {
    for (let i = cur; i < next; i += 1) state.stage.push(null);
  }
}

api.post('/add-viewer', (req, res) => {
  // เพิ่มผู้ชมมือ (= เทสต์เกมส์โดยไม่ต้องรอ simulator)
  const name = String(req.body?.nickname || '').trim();
  if (!name) return res.status(400).json({ ok: false, error: 'กรอกชื่อก่อน' });
  const v = addViewer({
    uniqueId: `manual_${Date.now().toString(36)}`,
    nickname: name,
    avatar: String(req.body?.avatar || ''),
  });
  v.lastSeenAt = Date.now();
  res.json({ ok: true, id: v.id });
});

api.post('/kick', (req, res) => {
  const id = String(req.body?.id || '');
  if (!id) return res.status(400).json({ ok: false, error: ' missing id' });
  markLeaving(id);
  res.json({ ok: true });
});

api.post('/clear', (req, res) => {
  for (const id of [...state.viewers.keys()]) hardRemove(id);
  res.json({ ok: true });
});

app.use('/api', api);

// ---------------- เริ่มงาน ----------------
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  🎪 tiktokgameee พร้อมแคสต์แล้ว!');
  console.log(`  เปิดเกมส์ : ${url}/`);
  console.log(`  แผงควบคุม : ${url}/admin`);
  if (!process.env.SIGN_API_KEY) {
    console.log('  ⚠️  ยังไม่ได้ตั้ง SIGN_API_KEY (ต่อ TikTok จริงต้องใช้ — ฟรีจาก eulerstream.com)');
    console.log('     ตอนนี้เปิดโหมดทดสอบ Simulator ให้ก่อน');
  }
  console.log('');
  if (config.simEnabled) simulator.start();
});
