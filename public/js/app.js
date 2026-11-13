/* tiktokgameee — client: วาดเวที ตัวละคร คิว แชท แบนเนอร์ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    hostAvatar: $('host-avatar'), hostName: $('host-name'), hostSub: $('host-sub'),
    viewerCount: $('viewer-count'),
    rankList: $('rank-list'), chatList: $('chat-list'),
    goalFill: $('goal-fill'), goalCount: $('goal-count'),
    goal1: $('goal-1'), goal2: $('goal-2'), goal3: $('goal-3'),
    stComments: $('st-comments'), stLikes: $('st-likes'), stPromoted: $('st-promoted'),
    stage: $('stage'), queueChips: $('queue-chips'), queueCount: $('queue-count'),
    ebIcon: $('eb-icon'), ebText: $('eb-text'), eventBanner: $('event-banner'),
    toastLayer: $('toast-layer'),
    likeBtn: $('like-btn'), shareCount: $('share-count'),
    commentInput: $('comment-input'),
    adminFab: $('admin-fab'), followBtn: $('follow-btn'),
    sparkles: $('sparkles'), modeBadge: $('mode-badge'),
  };

  let snap = null;
  const stageRender = new Map();  // viewerId -> { el, seat }
  const queueRender = new Map();  // viewerId -> el
  const chatRender = new Set();   // chatId ที่วาดแล้ว
  let lastFeedId = null;
  let lastFeedAt = 0;
  let followed = false;

  /* ---------- ช่องทางเลขไทยสั้น ๆ ---------- */
  const fmt = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };

  /* ---------- ตำแหน่งช่องบนเวที ---------- */
  function slotPositions(n) {
    const rows = n <= 6 ? 2 : n <= 12 ? 3 : 4;
    const cols = Math.ceil(n / rows);
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colsInRow = Math.min(cols, n - row * cols);
      // เว้นขอบซ้าย/ขวาไว้ให้ panel อันดับ/Goal ไม่ทับ
      const x = 16 + ((col + 0.5) / colsInRow) * 68 + (row % 2 ? 2 : 0);
      const y = 14 + row * 32;
      const scale = 0.66 + row * 0.17;
      const size = Math.round(74 * scale);
      out.push({ x: Math.min(x, 86), y: Math.min(y, 82), size, scale });
    }
    return out;
  }

  /* ---------- สร้าง/อัปเดตตัวละคร ---------- */
  function createChar(v) {
    const seat = document.createElement('div');
    seat.className = 'seat pop-in';
    seat.dataset.id = v.id;
    seat.innerHTML = `
      <div class="char">
        <div class="avatar-wrap"><img alt="" /></div>
        <div class="name-pill"></div>
      </div>`;
    return seat;
  }

  function updateChar(seatEl, v, pos) {
    seatEl.style.left = pos.x + '%';
    seatEl.style.top = pos.y + '%';
    const img = seatEl.querySelector('img');
    const name = seatEl.querySelector('.name-pill');
    const charEl = seatEl.querySelector('.char');
    if (v.avatar && img.getAttribute('src') !== v.avatar) img.src = v.avatar;
    if (name.textContent !== v.nickname) name.textContent = v.nickname;
    const size = pos.size;
    if (img.style.width !== size + 'px') {
      img.style.width = size + 'px';
      img.style.height = size + 'px';
    }
    // เครื่องราช / ของขวัญ
    charEl.classList.toggle('crown', (v.giftDiamonds || 0) >= 50);
    charEl.classList.toggle('gifted', (v.giftDiamonds || 0) > 0);
    // ป้ายเวลาดู (บนเวที)
    let tag = charEl.querySelector('.watch-tag');
    const secs = Math.floor((v.watchMs || 0) / 1000);
    if (v.seat >= 0 && secs >= 5) {
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'watch-tag';
        charEl.appendChild(tag);
      }
      tag.textContent = `👀 ${secs}s`;
    } else if (tag) tag.remove();
  }

  function popOut(seatEl, x, y) {
    // ว๊اپหาย: เด้งขึ้นแล้วบูด
    seatEl.style.left = x + '%';
    seatEl.style.top = y + '%';
    seatEl.classList.remove('pop-in');
    seatEl.classList.add('pop-out');
    const puff = document.createElement('div');
    puff.className = 'puff';
    puff.textContent = 'ว๊اپ!';
    const rect = els.stage.getBoundingClientRect();
    puff.style.left = (rect.left + (x / 100) * rect.width) + 'px';
    puff.style.top = (rect.top + (y / 100) * rect.height) + 'px';
    document.body.appendChild(puff);
    setTimeout(() => puff.remove(), 1000);
    setTimeout(() => seatEl.remove(), 1000);
  }

  function renderStage(stage) {
    const positions = slotPositions(stage.length);
    const desired = new Set();
    stage.forEach((v, i) => {
      if (!v) return;
      desired.add(v.id);
      const pos = positions[i];
      let entry = stageRender.get(v.id);
      if (!entry) {
        const el = createChar(v);
        els.stage.appendChild(el);
        entry = { el, seat: i };
        stageRender.set(v.id, entry);
        if (v.justPromoted) celebrate(el, pos, v);
      }
      // ย้ายช่อง
      if (entry.seat !== i) entry.seat = i;
      updateChar(entry.el, v, pos);
    });
    // ใครไม่อยู่ในเวทีแล้ว = ออกไป
    for (const [id, entry] of [...stageRender]) {
      if (desired.has(id)) continue;
      const pos = positions[entry.seat] || { x: 50, y: 50 };
      popOut(entry.el, pos.x, pos.y);
      stageRender.delete(id);
    }
  }

  /* ---------- ฉลองการขึ้นเวที ---------- */
  function celebrate(seatEl, pos, v) {
    const rect = els.stage.getBoundingClientRect();
    const cx = rect.left + (pos.x / 100) * rect.width;
    const cy = rect.top + (pos.y / 100) * rect.height - pos.size / 2;
    const colors = ['#ff2e88', '#25f4ee', '#ffd45e', '#8affc1', '#a3a1ff'];
    for (let i = 0; i < 18; i += 1) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = cx + 'px';
      c.style.top = cy + 'px';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 260 - 130) + 'px');
      c.style.setProperty('--dy', (Math.random() * -180 - 40) + 'px');
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 1200);
    }
    showToast(v);
  }

  function showToast(v) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<img src="${v.avatar || ''}" alt="" /><span>🎉 ${escapeHtml(v.nickname)} ขึ้นเวที!</span>`;
    els.toastLayer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- คิวคนรอขึ้นเวที ---------- */
  const RING_LEN = 2 * Math.PI * 24;
  function createChip(v) {
    const chip = document.createElement('div');
    chip.className = 'qchip';
    chip.innerHTML = `
      <img alt="" />
      <svg class="ring" viewBox="0 0 54 54">
        <circle class="bg" cx="27" cy="27" r="24" fill="none" stroke-width="3"></circle>
        <circle class="fg" cx="27" cy="27" r="24" fill="none" stroke-width="3"
          stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"></circle>
      </svg>
      <div class="qname"></div>`;
    return chip;
  }

  function renderQueue(queue, cfg, total) {
    const desired = new Set();
    queue.forEach((v) => {
      if (!v) return;
      desired.add(v.id);
      let el = queueRender.get(v.id);
      if (!el) {
        el = createChip(v);
        els.queueChips.appendChild(el);
        queueRender.set(v.id, el);
      }
      const img = el.querySelector('img');
      if (v.avatar && img.getAttribute('src') !== v.avatar) img.src = v.avatar;
      el.querySelector('.qname').textContent = v.nickname;
      const need = Math.max(1, cfg.watchToStageSeconds * 1000);
      const ratio = Math.min(1, (v.watchMs || 0) / need);
      const fg = el.querySelector('.fg');
      fg.style.strokeDashoffset = String(RING_LEN * (1 - ratio));
      el.classList.toggle('ready', ratio >= 1 || (v.giftDiamonds || 0) > 0);
    });
    for (const [id, el] of [...queueRender]) {
      if (desired.has(id)) continue;
      el.classList.add('out');
      queueRender.delete(id);
      setTimeout(() => el.remove(), 500);
    }
    els.queueCount.textContent = total > queue.length ? `${queue.length}/${total}` : String(total);
  }

  /* ---------- อันดับ ---------- */
  const MEDALS = ['🥇', '🥈', '🥉', '4', '5', '6'];
  let rankSig = '';
  function renderRank(stage, queue) {
    const all = [...stage, ...queue].filter(Boolean)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 6);
    // วาดใหม่เฉพาะเวลาอันดับ/คะแนนเปลี่ยน (กัน reflow รัว ๆ)
    const sig = all.map((v) => `${v.id}:${v.score}`).join('|');
    if (sig === rankSig) return;
    rankSig = sig;
    els.rankList.innerHTML = '';
    all.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row' + (i === 0 ? ' top1' : '');
      row.innerHTML = `
        <span class="medal">${MEDALS[i] || i + 1}</span>
        <img src="${v.avatar || ''}" alt="" />
        <span class="r-name">${escapeHtml(v.nickname)}</span>
        <span class="r-score">${fmt(v.score)}</span>`;
      els.rankList.appendChild(row);
    });
    if (!all.length) {
      els.rankList.innerHTML = '<div class="rank-row"><span class="r-name" style="color:rgba(255,255,255,.5)">รอผู้ชมเข้ามา...</span></div>';
    }
  }

  /* ---------- แชท ---------- */
  function renderChat(chat) {
    chat.forEach((c) => {
      if (chatRender.has(c.id)) return;
      chatRender.add(c.id);
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.dataset.cid = c.id;
      item.innerHTML = `
        <img src="${c.avatar || ''}" alt="" />
        <div class="c-body"><span class="c-name">${escapeHtml(c.nickname)}</span>${escapeHtml(c.message)}</div>`;
      els.chatList.appendChild(item);
      while (els.chatList.children.length > 12) {
        const gone = els.chatList.firstElementChild;
        if (gone && gone.dataset.cid) chatRender.delete(gone.dataset.cid);
        gone.remove();
      }
    });
  }

  /* ---------- แบนเนอร์ ---------- */
  function renderFeed(feed) {
    if (!feed || !feed.length) return;
    const latest = feed[0];
    if (latest.id === lastFeedId) return;
    lastFeedId = latest.id;
    const now = Date.now();
    if (now - lastFeedAt < 900) return; // กันแบนเนอร์กระพริบ
    lastFeedAt = now;
    els.ebIcon.textContent = latest.icon || '✨';
    els.ebText.textContent = latest.text || '';
    els.eventBanner.classList.add('show');
    clearTimeout(renderFeed._t);
    renderFeed._t = setTimeout(() => els.eventBanner.classList.remove('show'), 4500);
  }

  /* ---------- สถิติ / Goal ---------- */
  function renderStats(s, cfg) {
    els.viewerCount.textContent = fmt(s.roomUserCount || s.onlineCount || 0);
    const diamonds = s.stats.giftDiamonds || 0;
    const goal = 1000;
    els.goalFill.style.width = Math.min(100, (diamonds / goal) * 100) + '%';
    els.goalCount.textContent = `(${Math.min(s.stats.totalGifts || 0, 6)}/6)`;
    els.goal1.textContent = fmt(s.stats.totalGifts || 0);
    els.goal2.textContent = fmt(diamonds);
    els.goal3.textContent = fmt(s.stats.totalShares || 0);
    els.stComments.textContent = fmt(s.stats.totalComments || 0);
    els.stLikes.textContent = fmt(s.stats.totalLikes || 0);
    els.stPromoted.textContent = fmt(s.stats.totalPromoted || 0);
    els.shareCount.textContent = fmt(s.stats.totalShares || 0);
    if (s.host) {
      if (s.host.name && els.hostName.textContent !== s.host.name) els.hostName.textContent = s.host.name;
      if (s.host.avatar && els.hostAvatar.getAttribute('src') !== s.host.avatar) els.hostAvatar.src = s.host.avatar;
      els.hostSub.textContent = `♥ ${fmt(s.roomUserCount || s.onlineCount || 0)} · @${s.host.name || 'host'}`;
    }
    void cfg;
  }

  /* ---------- วนรับ snapshot ---------- */
  function applySnapshot(s) {
    snap = s;
    renderStage(s.stage || []);
    renderQueue(s.queue || [], s.config || { watchToStageSeconds: 12 }, s.queueTotal || 0);
    renderRank(s.stage || [], s.queue || []);
    renderChat(s.chat || []);
    renderFeed(s.feed || []);
    renderStats(s, s.config || {});
    renderModeBadge(s.source || {});
  }

  function renderModeBadge(src) {
    if (src.mode === 'sim') {
      els.modeBadge.textContent = '🧪 โหมดทดสอบ (Simulator) — ไปที่ /admin เพื่อเชื่อม TikTok LIVE จริง';
      els.modeBadge.classList.remove('hidden');
    } else if (src.mode === 'tiktok' && !src.connected) {
      els.modeBadge.textContent = `⚠️ ${src.lastError || 'ไม่ได้เชื่อมต่อ LIVE'}`;
      els.modeBadge.classList.remove('hidden');
    } else if (src.mode === 'tiktok') {
      els.modeBadge.textContent = `🔴 LIVE: ${snap && snap.host ? '@' + snap.host.name : ''}`;
      els.modeBadge.classList.remove('hidden');
    } else {
      els.modeBadge.classList.add('hidden');
    }
  }

  /* ---------- รับสถานะ: WebSocket ก่อน ถ้าไม่ได้ก็ poll HTTP ---------- */
  let ws = null;
  let pollTimer = null;

  async function fetchState() {
    try {
      const res = await fetch('/api/state');
      const json = await res.json();
      if (json && json.data) applySnapshot(json.data);
    } catch (_) { /* ยังต่อไม่ได้ รอบหน้าใหม่ */ }
  }

  function startPolling() {
    if (pollTimer) return;
    fetchState();
    pollTimer = setInterval(fetchState, 1000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function connect() {
    let sock = null;
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      sock = new WebSocket(`${proto}://${location.host}/ws`);
    } catch (_) {
      startPolling();
      setTimeout(connect, 3000);
      return;
    }
    ws = sock;
    sock.onopen = () => stopPolling();
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'snapshot') applySnapshot(msg.data);
      } catch (_) { /* ignore */ }
    };
    sock.onerror = () => { try { sock.close(); } catch (_) { /* ignore */ } };
    sock.onclose = () => {
      startPolling();
      setTimeout(connect, 3000);
    };
  }

  /* ---------- ปุ่มกดเล่น ---------- */
  els.likeBtn.addEventListener('click', () => {
    els.likeBtn.classList.remove('beat');
    void els.likeBtn.offsetWidth;
    els.likeBtn.classList.add('beat');
    for (let i = 0; i < 3; i += 1) spawnHeart();
  });

  function spawnHeart() {
    const h = document.createElement('div');
    h.className = 'float-heart';
    h.textContent = ['❤️', '💖', '💗', '✨'][Math.floor(Math.random() * 4)];
    h.style.right = 90 + Math.random() * 30 + 'px';
    h.style.setProperty('--hx', (Math.random() * 120 - 60) + 'px');
    h.style.setProperty('--hr', (Math.random() * 90 - 45) + 'deg');
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1500);
  }

  els.followBtn.addEventListener('click', () => {
    followed = !followed;
    els.followBtn.classList.toggle('followed', followed);
    els.followBtn.textContent = followed ? '✓ ติดตามแล้ว' : '+ Follow';
  });

  // พิมพ์คอมเมนต์ = เข้าเกมส์ด้วยชื่อนี้ (เก็บไว้ในเครื่อง)
  let myName = localStorage.getItem('ttg_name') || '';
  els.commentInput.addEventListener('keydown', async (ev) => {
    if (ev.key !== 'Enter') return;
    const text = els.commentInput.value.trim();
    if (!text) return;
    if (text.startsWith('!ชื่อ ')) {
      myName = text.slice(5).trim();
      localStorage.setItem('ttg_name', myName);
      els.commentInput.value = '';
      return;
    }
    const name = myName || 'ผู้ชมคนนี้';
    els.commentInput.value = '';
    try {
      await fetch('/api/add-viewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: name }),
      });
    } catch (_) { /* ignore */ }
  });

  els.adminFab.addEventListener('click', () => { window.location.href = '/admin'; });

  /* ---------- ประกายไฟพื้นหลัง ---------- */
  for (let i = 0; i < 26; i += 1) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top = 55 + Math.random() * 45 + 'vh';
    s.style.animationDuration = 5 + Math.random() * 7 + 's';
    s.style.animationDelay = Math.random() * 6 + 's';
    if (Math.random() < 0.4) s.style.background = 'var(--cyan)';
    els.sparkles.appendChild(s);
  }

  connect();
})();
