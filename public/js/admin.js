/* tiktokgameee — admin panel */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const fields = [
    'stageSlots', 'queueSlots', 'watchToStageSeconds', 'leaveInactiveSeconds',
    'likeBoost', 'chatBoost', 'simJoinPerMin', 'simLeavePerMin', 'simLikePerMin',
    'simChatPerMin', 'simGiftPerMin',
  ];

  async function refresh() {
    try {
      const res = await fetch('/api/state');
      const json = await res.json();
      const s = json.data;
      const src = s.source || {};
      const mode = src.mode === 'tiktok' ? 'TikTok LIVE' : src.mode === 'sim' ? 'Simulator (ทดสอบ)' : 'ยังไม่เริ่ม';
      const state = src.connected ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่ได้เชื่อมต่อ';
      $('status-box').innerHTML =
        `${state} · โหมด: <b>${mode}</b>` +
        (src.lastError ? ` · <span class="err">${src.lastError}</span>` : '') +
        ` · ผู้ชมในห้อง <b>${s.roomUserCount || 0}</b> · บนเวที <b>${(s.stage || []).filter(Boolean).length}</b> · รอขึ้นเวที <b>${s.queueTotal || 0}</b>`;
      $('sim-toggle').checked = !!json.simRunning;

      const cfg = s.config || {};
      fields.forEach((f) => { if (cfg[f] !== undefined) $('c-' + f).value = cfg[f]; });
      $('c-giftInstantStage').checked = !!cfg.giftInstantStage;
      $('c-roomUserKick').checked = !!cfg.roomUserKick;
      if (cfg.tiktokUsername) $('username').value = cfg.tiktokUsername;

      const st = s.stats || {};
      $('stats-box').innerHTML = `
        <div>เข้าตลอด LIVE<b>${st.totalJoined || 0}</b></div>
        <div>ออกไปแล้ว<b>${st.totalLeft || 0}</b></div>
        <div>ขึ้นเวทีแล้ว<b>${st.totalPromoted || 0}</b></div>
        <div>ของขวัญ<b>${st.totalGifts || 0}</b></div>
        <div>💎 รวม<b>${st.giftDiamonds || 0}</b></div>
        <div>ไลก์รวม<b>${st.totalLikes || 0}</b></div>
        <div>คอมเมนต์<b>${st.totalComments || 0}</b></div>
        <div>แชร์<b>${st.totalShares || 0}</b></div>`;
    } catch (err) {
      $('status-box').innerHTML = `<span class="err">โหลดสถานะไม่สำเร็จ: ${err.message}</span>`;
    }
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  $('btn-connect').addEventListener('click', async () => {
    const username = $('username').value.trim();
    $('btn-connect').disabled = true;
    $('btn-connect').textContent = 'กำลังเชื่อมต่อ...';
    const json = await post('/api/connect', { username });
    $('btn-connect').disabled = false;
    $('btn-connect').textContent = '🔴 เชื่อมต่อ LIVE';
    if (!json.ok) alert('เชื่อมต่อไม่สำเร็จ: ' + (json.error || 'unknown'));
    refresh();
  });

  $('btn-disconnect').addEventListener('click', async () => {
    await post('/api/disconnect');
    refresh();
  });

  $('sim-toggle').addEventListener('change', async (ev) => {
    const json = await post('/api/sim', { on: ev.target.checked });
    if (!json.ok) { alert(json.error || 'เปิด Simulator ไม่ได้'); ev.target.checked = false; }
    refresh();
  });

  function collectConfig() {
    const out = {};
    fields.forEach((f) => {
      const v = $('c-' + f).value;
      out[f] = isNaN(Number(v)) ? v : Number(v);
    });
    out.giftInstantStage = $('c-giftInstantStage').checked;
    out.roomUserKick = $('c-roomUserKick').checked;
    return out;
  }

  $('btn-save-config').addEventListener('click', async () => {
    const json = await post('/api/config', collectConfig());
    $('config-msg').textContent = json.ok ? '✅ บันทึกแล้ว' : '❌ ' + (json.error || 'ผิดพลาด');
    setTimeout(() => { $('config-msg').textContent = ''; }, 2500);
    refresh();
  });

  $('btn-save-sim').addEventListener('click', async () => {
    const json = await post('/api/config', collectConfig());
    $('config-msg').textContent = json.ok ? '✅ บันทึกแล้ว (Simulator รีสตาร์ท)' : '❌ ' + (json.error || 'ผิดพลาด');
    setTimeout(() => { $('config-msg').textContent = ''; }, 2500);
    refresh();
  });

  $('btn-add').addEventListener('click', async () => {
    const nickname = $('manual-name').value.trim();
    if (!nickname) return alert('กรอกชื่อก่อน');
    await post('/api/add-viewer', { nickname });
    $('manual-name').value = '';
    refresh();
  });

  $('btn-clear').addEventListener('click', async () => {
    await post('/api/clear');
    refresh();
  });

  refresh();
  setInterval(refresh, 2000);
})();
