// ============================================================
//  Hustle Hustle TW — 後台管理程式
// ============================================================

let db = null;
let allRegistrations = [];
let currentDocId = null;

// ── 初始化 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // 防止滑鼠滾輪誤改數字欄位（如價格）的值
  document.addEventListener('wheel', () => {
    if (document.activeElement?.type === 'number') document.activeElement.blur();
  }, { passive: true });

  // 密碼輸入框 Enter 鍵登入
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

// ── 登入 ─────────────────────────────────────────────────────
function doLogin() {
  const pw = document.getElementById('password-input').value;
  const savedPw = localStorage.getItem('hhtw_admin_pw') || SITE_CONFIG.adminPassword;
  if (pw === savedPw) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'flex';
    initFirebase();
    loadRegistrations();
  } else {
    document.getElementById('login-err').textContent = '密碼錯誤';
  }
}

function doLogout() {
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('password-input').value = '';
}

// ── Firebase ─────────────────────────────────────────────────
function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(SITE_CONFIG.firebase);
    }
    db = firebase.firestore();
  } catch (e) {
    console.warn('Firebase 尚未設定');
    showDemoData();
  }
}

// ── 載入報名資料 ──────────────────────────────────────────────
async function loadRegistrations() {
  const tbody = document.getElementById('reg-tbody');
  tbody.innerHTML = '<tr><td colspan="16" class="loading-cell">載入中...</td></tr>';

  if (!db) { showDemoData(); return; }

  try {
    await loadCourseCaps();
    const snap = await db.collection('registrations').orderBy('createdAt', 'desc').get();
    allRegistrations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    assignSeq();
    populateCourseFilter();
    applyFilters();
    renderTrash();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="16" class="loading-cell">載入失敗：${e.message}</td></tr>`;
  }
}

// ── 課程招生名額（給招生狀態計算用） ─────────────────────────
let courseCaps = {};   // key: courseId 或 'name:課程名' → { capL, capF, name }
async function loadCourseCaps() {
  courseCaps = {};
  if (!db) return;
  try {
    const snap = await db.collection('courses').get();
    snap.docs.forEach(doc => {
      const c = doc.data();
      const entry = { capL: c.leaderCap ?? null, capF: c.followerCap ?? null, name: c.name };
      courseCaps[doc.id] = entry;
      if (c.name) courseCaps['name:' + c.name] = entry;
    });
  } catch (e) { /* 名額載入失敗不影響報名列表，當作不限 */ }
}

// 取得某筆報名所屬課程的名額（courseId 優先，課名備援）
function getCaps(r) {
  return courseCaps[r.courseId]
      || courseCaps['name:' + r.courseName]
      || { capL: null, capF: null, name: r.courseName };
}

// ── Demo 資料（Firebase 未設定時顯示） ───────────────────────
function showDemoData() {
  allRegistrations = [
    { id: 'demo1', createdAt: new Date().toISOString(), courseName: '進階班', planName: '單人', name: '王小明', phone: '0912345678', email: 'test@example.com', role: 'Leader', total: 1900, transferCode: '12345', referral: '李教練', status: 'pending' },
    { id: 'demo2', createdAt: new Date().toISOString(), courseName: '寶寶班', planName: '雙人', leaderName: '張三', leaderPhone: '0987654321', leaderEmail: 'a@a.com', followerName: '李四', followerPhone: '0911111111', followerEmail: 'b@b.com', payerEmail: 'a@a.com', total: 3400, transferCode: '67890', referral: '', status: 'approved' },
  ];
  assignSeq();
  populateCourseFilter();
  applyFilters();
  renderTrash();
}

// 顯示順序：desc = 新到舊（預設）, asc = 舊到新
let sortOrder = 'desc';
function toggleSort() {
  sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
  document.getElementById('btn-sort').textContent = sortOrder === 'desc' ? '↓ 新到舊' : '↑ 舊到新';
  applyFilters();
}

// 依報名先後順序編流水號（最早報名 = 1）
function assignSeq() {
  [...allRegistrations]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((r, i) => { r.seq = i + 1; });
}

// ── 招生狀態計算（錄取 / 候補 / 待定） ───────────────────────
// 依報名先後（seq 由小到大），每課程的 Leader / Follower 各自累加佔名額；
// 雙人一筆同時佔 1 Leader + 1 Follower。手動覆寫（r.admission）優先。
let admissionStats = {};   // courseKey → { name, capL, capF, lAdmit, fAdmit, lWait, fWait, hold }
function computeAdmission() {
  admissionStats = {};
  const used = {};   // courseKey → { l, f }
  const keyOf = r => r.courseId || ('name:' + r.courseName);

  // 先清空，沒被計入（已拒絕/已刪除）的列招生欄會顯示「—」
  allRegistrations.forEach(r => { r._admit = ''; r._admitAuto = ''; });

  // 已拒絕 / 已刪除不佔名額（被拒絕者表格內招生欄會顯示「—」）
  const ordered = allRegistrations
    .filter(r => !r.deleted && r.status !== 'rejected')
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  for (const r of ordered) {
    const key  = keyOf(r);
    const caps = getCaps(r);
    if (!used[key]) used[key] = { l: 0, f: 0 };
    if (!admissionStats[key]) {
      admissionStats[key] = { name: caps.name || r.courseName, capL: caps.capL, capF: caps.capF,
                              lAdmit: 0, fAdmit: 0, lWait: 0, fWait: 0, hold: 0 };
    }
    const st = admissionStats[key];
    const u  = used[key];
    const isDuo    = !!r.leaderName;
    const isLeader = r.role === 'Leader';
    const roomL = caps.capL == null || u.l < caps.capL;
    const roomF = caps.capF == null || u.f < caps.capF;
    const override = ['admit', 'wait', 'hold'].includes(r.admission) ? r.admission : null;

    // 自動判定
    let auto;
    if (isDuo) {
      auto = (roomL && roomF) ? 'admit' : (!roomL && !roomF) ? 'wait' : 'hold';
    } else {
      auto = (isLeader ? roomL : roomF) ? 'admit' : 'wait';
    }
    const effective = override || auto;

    // 佔用名額（依最終結果）
    if (effective === 'admit') {
      if (isDuo) { u.l++; u.f++; }
      else if (isLeader) u.l++; else u.f++;
    }

    // 課程統計
    if (isDuo) {
      if (effective === 'admit')      { st.lAdmit++; st.fAdmit++; }
      else if (effective === 'wait')  { st.lWait++;  st.fWait++;  }
      else                            { st.hold++; }
    } else {
      if (effective === 'admit')      { isLeader ? st.lAdmit++ : st.fAdmit++; }
      else if (effective === 'wait')  { isLeader ? st.lWait++  : st.fWait++;  }
    }

    const noCaps = caps.capL == null && caps.capF == null;
    r._admitAuto = noCaps ? 'none' : auto;
    r._admit     = (noCaps && !override) ? 'none' : effective;
  }
}

function admitLabel(a) {
  return { admit: '錄取', wait: '候補', hold: '待定', none: '不限' }[a] || '—';
}

function admitBadge(a) {
  if (!a || a === 'none') return '<span class="admit-none">—</span>';
  return `<span class="badge badge-${a}">${admitLabel(a)}</span>`;
}

// ── 過濾 & 渲染表格 ───────────────────────────────────────────
function applyFilters() {
  computeAdmission();

  const statusF = document.getElementById('filter-status').value;
  const courseF = document.getElementById('filter-course').value;
  const roleF   = document.getElementById('filter-role').value;
  const admitF  = document.getElementById('filter-admit').value;

  const filtered = allRegistrations.filter(r => {
    if (r.deleted) return false;
    if (statusF && r.status !== statusF) return false;
    if (courseF && r.courseName !== courseF) return false;
    if (admitF && r._admit !== admitF) return false;
    if (roleF) {
      const isDuo = !!r.leaderName;
      // 雙人含 leader + follower，兩種角色都算；單人看本人 role
      const matchRole = isDuo ? true : r.role === roleF;
      if (!matchRole) return false;
    }
    return true;
  });

  filtered.sort((a, b) => sortOrder === 'desc'
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : new Date(a.createdAt) - new Date(b.createdAt));

  renderTable(filtered, roleF);
  renderStats();
  renderCapacitySummary();
  const master = document.getElementById('select-all');
  if (master) { master.checked = false; }
  updateBulkBar();
}

// ── 招生額度摘要（每課程目前 Leader / Follower 報名人數） ─────
function renderCapacitySummary() {
  const wrap = document.getElementById('capacity-summary');
  if (!wrap) return;
  const cards = Object.values(admissionStats)
    .filter(s => s.capL != null || s.capF != null)
    .map(s => {
      const line = (label, admit, cap, wait) => {
        if (cap == null) return `<div class="cap-line">${label}：${admit} 人（不限）</div>`;
        const full = admit >= cap;
        return `<div class="cap-line ${full ? 'cap-full' : ''}">${label}：<b>${admit}/${cap}</b>${wait ? ` ・候補 ${wait}` : ''}</div>`;
      };
      return `<div class="cap-card">
        <div class="cap-name">${s.name}</div>
        ${line('Leader', s.lAdmit, s.capL, s.lWait)}
        ${line('Follower', s.fAdmit, s.capF, s.fWait)}
        ${s.hold ? `<div class="cap-line cap-hold">待定 ${s.hold} 組（雙人卡名額，待人工判斷）</div>` : ''}
      </div>`;
    });
  wrap.innerHTML = cards.length
    ? `<div class="cap-title">招生額度</div><div class="cap-grid">${cards.join('')}</div>`
    : '';
}

function renderTable(rows, roleF = '') {
  const tbody = document.getElementById('reg-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="16" class="loading-cell">沒有資料</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const isDuo = !!r.leaderName;
    // 雙人：有篩角色時只顯示對應那一人；否則兩人都列
    const showL = !roleF || roleF === 'Leader';
    const showF = !roleF || roleF === 'Follower';
    const lLine = (col) => `<div class="duo-line"><span class="duo-tag">L</span>${col}</div>`;
    const fLine = (col) => `<div class="duo-line"><span class="duo-tag">F</span>${col}</div>`;
    const roleCol = isDuo
      ? `${showL ? '<div class="duo-line">Leader</div>' : ''}${showF ? '<div class="duo-line">Follower</div>' : ''}`
      : (r.role || '—');
    const name  = isDuo
      ? `${showL ? lLine(r.leaderName) : ''}${showF ? fLine(r.followerName) : ''}`
      : r.name;
    const phone = isDuo
      ? `${showL ? lLine(r.leaderPhone) : ''}${showF ? fLine(r.followerPhone) : ''}`
      : r.phone;
    const email = isDuo ? r.payerEmail  : r.email;
    const date  = new Date(r.createdAt).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `<tr>
      <td><input type="checkbox" class="row-check" data-id="${r.id}" onchange="updateBulkBar()"></td>
      <td>${r.seq || ''}</td>
      <td>${date}</td>
      <td>${r.courseName}</td>
      <td>${r.planName}</td>
      <td>${roleCol}</td>
      <td>${name}</td>
      <td>${phone}</td>
      <td>${email}</td>
      <td>NT$${Number(r.total).toLocaleString()}</td>
      <td>${r.transferCode}</td>
      <td>${r.referral || '—'}</td>
      <td>${admitBadge(r._admit)}</td>
      <td><span class="badge badge-${r.status}">${statusLabel(r.status)}</span></td>
      <td>${r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openModal('${r.id}')">查看</button>
      </td>
    </tr>`;
  }).join('');
}

function statusLabel(s) {
  return { pending: '待審核', approved: '已通過', rejected: '已拒絕' }[s] || s;
}

function renderStats() {
  const active   = allRegistrations.filter(r => !r.deleted);
  const total    = active.length;
  const pending  = active.filter(r => r.status === 'pending').length;
  const approved = active.filter(r => r.status === 'approved').length;
  const rejected = active.filter(r => r.status === 'rejected').length;
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">總報名數</div></div>
    <div class="stat-card stat-pending"><div class="stat-num">${pending}</div><div class="stat-label">待審核</div></div>
    <div class="stat-card stat-approved"><div class="stat-num">${approved}</div><div class="stat-label">已通過</div></div>
    <div class="stat-card stat-rejected"><div class="stat-num">${rejected}</div><div class="stat-label">已拒絕</div></div>
  `;
}

function populateCourseFilter() {
  const sel = document.getElementById('filter-course');
  const current = sel.value;

  // 從實際報名資料抓出所有課程/活動名稱（包含已刪除的課程，舊資料仍可篩選）
  const names = [...new Set(allRegistrations.map(r => r.courseName).filter(Boolean))];

  sel.innerHTML = '<option value="">全部課程／活動</option>' +
    names.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');

  // 重新整理後保留原本選的篩選
  if (names.includes(current)) sel.value = current;
}

// ── 查看 / 審核 Modal ─────────────────────────────────────────
function openModal(docId) {
  currentDocId = docId;
  const r = allRegistrations.find(x => x.id === docId);
  if (!r) return;

  const isDuo = !!r.leaderName;
  document.getElementById('modal-title').textContent = `${r.courseName} — ${r.planName}`;

  const rows = isDuo ? [
    ['課程', r.courseName], ['方案', r.planName],
    ['Leader', `${r.leaderName} / ${r.leaderPhone}`],
    ...(r.leaderEmail ? [['Leader Email', r.leaderEmail]] : []),
    ['Follower', `${r.followerName} / ${r.followerPhone}`],
    ...(r.followerEmail ? [['Follower Email', r.followerEmail]] : []),
    ['匯款人 Email', r.payerEmail],
    ['金額', `NT$${Number(r.total).toLocaleString()}`],
    ['後五碼', r.transferCode],
    ['推薦人', r.referral || '—'],
    ['狀態', statusLabel(r.status)],
    ['報名時間', new Date(r.createdAt).toLocaleString('zh-TW')],
    ...(r.reviewedAt ? [['審核時間', new Date(r.reviewedAt).toLocaleString('zh-TW')]] : []),
  ] : [
    ['課程', r.courseName], ['方案', r.planName],
    ['姓名', r.name], ['電話', r.phone], ['Email', r.email], ['角色', r.role],
    ['金額', `NT$${Number(r.total).toLocaleString()}`],
    ['後五碼', r.transferCode],
    ['推薦人', r.referral || '—'],
    ['狀態', statusLabel(r.status)],
    ['報名時間', new Date(r.createdAt).toLocaleString('zh-TW')],
    ...(r.reviewedAt ? [['審核時間', new Date(r.reviewedAt).toLocaleString('zh-TW')]] : []),
  ];

  document.getElementById('modal-body').innerHTML = `
    <table class="modal-table">
      ${rows.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>`;

  const isPending = r.status === 'pending';
  document.getElementById('btn-approve').style.display = isPending ? '' : 'none';
  document.getElementById('btn-reject').style.display  = isPending ? '' : 'none';

  // 招生狀態手動覆寫（只有設定過名額的課程才顯示）
  const caps = getCaps(r);
  const hasCap = caps.capL != null || caps.capF != null;
  document.getElementById('admit-control').style.display = hasCap ? '' : 'none';
  if (hasCap) {
    document.getElementById('admit-select').value =
      ['admit', 'wait', 'hold'].includes(r.admission) ? r.admission : '';
    document.getElementById('admit-auto-hint').textContent =
      r.admission ? `（手動指定，自動判定為「${admitLabel(r._admitAuto)}」）` : '（依報名順序自動判定）';
  }

  document.getElementById('modal-overlay').style.display = 'flex';
}

// 手動覆寫招生狀態（''＝恢復自動）
async function setAdmission(value) {
  if (!currentDocId) return;
  const r = allRegistrations.find(x => x.id === currentDocId);
  if (!r) return;
  const val = ['admit', 'wait', 'hold'].includes(value) ? value : null;

  if (db && !currentDocId.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(currentDocId).update({
        admission: val === null ? firebase.firestore.FieldValue.delete() : val,
      });
    } catch (e) { alert('更新失敗：' + e.message); return; }
  }
  if (val === null) delete r.admission; else r.admission = val;

  applyFilters();   // 重算所有人的招生狀態並重繪
  document.getElementById('admit-auto-hint').textContent =
    r.admission ? `（手動指定，自動判定為「${admitLabel(r._admitAuto)}」）` : '（依報名順序自動判定）';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  currentDocId = null;
}

async function updateStatus(newStatus) {
  if (!currentDocId) return;
  const r = allRegistrations.find(x => x.id === currentDocId);
  if (!r) return;

  const reviewedAt = new Date().toISOString();
  if (db && !currentDocId.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(currentDocId).update({ status: newStatus, reviewedAt });
    } catch (e) {
      alert('更新失敗：' + e.message); return;
    }
  }

  r.status = newStatus;
  r.reviewedAt = reviewedAt;
  closeModal();
  applyFilters();

  // 寄送 Email 通知
  const email = r.payerEmail || r.email || r.leaderEmail;
  if (email) {
    sendStatusEmail(email, r.name || r.leaderName, r.courseName, newStatus);
  }
}

async function deleteRegistration() {
  if (!currentDocId) return;
  const r = allRegistrations.find(x => x.id === currentDocId);
  if (!r) return;

  const who = r.name || `${r.leaderName} / ${r.followerName}`;
  if (!confirm(`確定要刪除「${who} — ${r.courseName} ${r.planName}」這筆報名嗎？\n會移到回收桶，之後可在「🗑 回收桶」還原。`)) return;

  const deletedAt = new Date().toISOString();
  if (db && !currentDocId.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(currentDocId).update({ deleted: true, deletedAt });
    } catch (e) {
      alert('刪除失敗：' + e.message); return;
    }
  }

  r.deleted = true;
  r.deletedAt = deletedAt;
  closeModal();
  applyFilters();
  renderTrash();
}

// ── 批次勾選刪除 ─────────────────────────────────────────────
function toggleSelectAll(master) {
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = master.checked);
  updateBulkBar();
}

function updateBulkBar() {
  const n = document.querySelectorAll('.row-check:checked').length;
  const btn = document.getElementById('btn-bulk-delete');
  btn.style.display = n ? '' : 'none';
  btn.textContent = `🗑 刪除勾選（${n}）`;
}

async function bulkDelete() {
  const ids = [...document.querySelectorAll('.row-check:checked')].map(cb => cb.dataset.id);
  if (!ids.length) return;
  if (!confirm(`確定要刪除勾選的 ${ids.length} 筆報名資料嗎？\n會移到回收桶，之後可在「🗑 回收桶」還原。`)) return;

  const deletedAt = new Date().toISOString();
  if (db) {
    try {
      const batch = db.batch();
      ids.filter(id => !id.startsWith('demo'))
         .forEach(id => batch.update(db.collection('registrations').doc(id), { deleted: true, deletedAt }));
      await batch.commit();
    } catch (e) {
      alert('刪除失敗：' + e.message); return;
    }
  }

  allRegistrations.forEach(r => { if (ids.includes(r.id)) { r.deleted = true; r.deletedAt = deletedAt; } });
  document.getElementById('select-all').checked = false;
  applyFilters();
  renderTrash();
  updateBulkBar();
}

// ── 刪除資料（報名管理頁內可展開區塊） ──────────────────────
function toggleTrash() {
  const panel = document.getElementById('trash-panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
  renderTrash();
}

function updateTrashButton() {
  const btn = document.getElementById('btn-toggle-trash');
  if (!btn) return;
  const n = allRegistrations.filter(r => r.deleted).length;
  const open = document.getElementById('trash-panel')?.style.display !== 'none';
  btn.textContent = open ? `🗑 收合刪除資料（${n}）` : `🗑 刪除資料${n ? `（${n}）` : ''}`;
}

function renderTrash() {
  updateTrashButton();
  const tbody = document.getElementById('trash-tbody');
  if (!tbody) return;
  const rows = allRegistrations
    .filter(r => r.deleted)
    .sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">回收桶是空的</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const isDuo = !!r.leaderName;
    const name  = isDuo ? `${r.leaderName} / ${r.followerName}` : (r.name || '');
    const phone = isDuo ? `${r.leaderPhone} / ${r.followerPhone}` : (r.phone || '');
    const del   = r.deletedAt
      ? new Date(r.deletedAt).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
      : '—';
    return `<tr>
      <td>${r.seq || ''}</td>
      <td>${del}</td>
      <td>${r.courseName}</td>
      <td>${r.planName}</td>
      <td>${name}</td>
      <td>${phone}</td>
      <td><span class="badge badge-${r.status}">${statusLabel(r.status)}</span></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="restoreRegistration('${r.id}')">還原</button>
        <button class="btn btn-danger btn-sm" onclick="permanentDelete('${r.id}')">永久刪除</button>
      </td>
    </tr>`;
  }).join('');
}

async function restoreRegistration(id) {
  const r = allRegistrations.find(x => x.id === id);
  if (!r) return;
  if (db && !id.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(id).update({
        deleted:   firebase.firestore.FieldValue.delete(),
        deletedAt: firebase.firestore.FieldValue.delete(),
      });
    } catch (e) { alert('還原失敗：' + e.message); return; }
  }
  delete r.deleted;
  delete r.deletedAt;
  applyFilters();
  renderTrash();
}

async function permanentDelete(id) {
  const r = allRegistrations.find(x => x.id === id);
  if (!r) return;
  const who = r.name || `${r.leaderName} / ${r.followerName}`;
  if (!confirm(`確定要永久刪除「${who} — ${r.courseName}」嗎？\n此動作無法復原！`)) return;
  if (db && !id.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(id).delete();
    } catch (e) { alert('刪除失敗：' + e.message); return; }
  }
  allRegistrations = allRegistrations.filter(x => x.id !== id);
  renderTrash();
}

// ── Email 通知（透過 Resend） ────────────────────────────────
async function sendStatusEmail(toEmail, name, courseName, status) {
  const key = localStorage.getItem('hhtw_resend_key') || SITE_CONFIG.resendApiKey;
  const sender = localStorage.getItem('hhtw_sender_email') || SITE_CONFIG.senderEmail;

  if (!key || key === 'YOUR_RESEND_API_KEY') return;

  const subject = status === 'approved'
    ? `【Hustle Hustle TW】報名成功通知 — ${courseName}`
    : `【Hustle Hustle TW】報名審核結果 — ${courseName}`;

  const html = status === 'approved'
    ? `<p>Hi ${name}，</p><p>恭喜您！您的 <strong>${courseName}</strong> 報名已通過審核。</p><p>期待在課堂上見到您！</p><br><p>— Hustle Hustle TW 團隊</p>`
    : `<p>Hi ${name}，</p><p>很抱歉，您的 <strong>${courseName}</strong> 報名未能通過審核。</p><p>如有疑問請聯繫我們。</p><br><p>— Hustle Hustle TW 團隊</p>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: sender, to: toEmail, subject, html }),
    });
  } catch (e) {
    console.warn('Email 發送失敗', e);
  }
}

// ── 匯出 Excel（CSV） ────────────────────────────────────────
function exportExcel() {
  const headers = ['編號','報名時間','課程','方案','角色','姓名','電話','Email','金額','後五碼','推薦人','狀態','招生','審核時間'];
  // 一般欄位用引號包；電話、後五碼用 ="..." 強制 Excel 當文字，避免 0 開頭消失或變科學記號
  const q    = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const qTxt = v => { const s = String(v ?? ''); return s ? `="${s.replace(/"/g,'""')}"` : '""'; };
  const makeRow = (seq, time, course, plan, role, name, phone, email, total, code, ref, status, admit, reviewed) =>
    [q(seq), q(time), q(course), q(plan), q(role), q(name), qTxt(phone), q(email), q(total), qTxt(code), q(ref), q(status), q(admit), q(reviewed)].join(',');

  const rows = allRegistrations.filter(r => !r.deleted).flatMap(r => {
    const time = new Date(r.createdAt).toLocaleString('zh-TW');
    const reviewed = r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('zh-TW') : '';
    const status = statusLabel(r.status);
    const admit  = (r._admit && r._admit !== 'none') ? admitLabel(r._admit) : '';
    const isDuo = !!r.leaderName;
    if (!isDuo) {
      return [makeRow(r.seq, time, r.courseName, r.planName, r.role || '', r.name, r.phone, r.email, r.total, r.transferCode, r.referral || '', status, admit, reviewed)];
    }
    // 雙人拆兩行：金額/後五碼/Email/推薦人只記在 Leader 行，避免重複計算
    return [
      makeRow(r.seq, time, r.courseName, r.planName, 'Leader',   r.leaderName,   r.leaderPhone,   r.payerEmail, r.total, r.transferCode, r.referral || '', status, admit, reviewed),
      makeRow(r.seq, time, r.courseName, r.planName, 'Follower', r.followerName, r.followerPhone, '',           '',      '',              '',               status, admit, reviewed),
    ];
  });

  const bom = '﻿';
  const csv = bom + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `報名資料_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 分頁切換 ──────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).style.display = '';
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'settings') loadSettingsForm();
  if (tab === 'courses') loadCourseList();
}

// ════════════════════════════════════════════════════════════
//  課程管理
// ════════════════════════════════════════════════════════════
let adminCourses = [];
let editingCourseId = null;
let editingType = 'course';   // 'course' 課程 | 'event' 活動
let uploadedPhoto = null;     // base64，null = 沒動過

async function loadCourseList() {
  const wrap = document.getElementById('course-list');
  wrap.innerHTML = '<p class="settings-note">載入中...</p>';
  if (!db) { wrap.innerHTML = '<p class="settings-note">Firebase 未連線</p>'; return; }

  try {
    const snap = await db.collection('courses').orderBy('order').get();
    adminCourses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    wrap.innerHTML = `<p class="settings-note">載入失敗：${e.message}</p>`;
    return;
  }

  if (!adminCourses.length) {
    wrap.innerHTML = '<p class="settings-note">還沒有課程，按右上角「＋ 新增課程」建立第一筆。</p>';
    return;
  }

  wrap.innerHTML = adminCourses.map((c, i) => {
    const hidden = c.active === false;
    return `
    <div class="course-admin-card ${hidden ? 'course-hidden' : ''}">
      ${c.photo ? `<img src="${c.photo}" class="course-admin-photo">` : `<div class="course-admin-photo course-admin-emoji">${c.emoji || '💃'}</div>`}
      <div class="course-admin-info">
        <div class="course-admin-name">${c.emoji || ''} ${c.name} ${c.type === 'event' ? '<span class="event-tag">活動</span>' : ''} ${hidden ? '<span class="hidden-tag">已隱藏</span>' : ''}</div>
        <div class="course-admin-desc">${c.description || '（無描述）'}</div>
        <div class="course-admin-plans">${c.teacher ? `🧑‍🏫 ${c.teacher}　` : ''}${(c.plans || []).map(p => `${p.label} NT$${p.price}`).join('｜')}</div>
      </div>
      <div class="course-admin-actions">
        <button class="btn btn-secondary btn-sm" onclick="moveCourse(${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-secondary btn-sm" onclick="moveCourse(${i}, 1)" ${i === adminCourses.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-primary btn-sm" onclick="openCourseForm('${c.id}')">編輯</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleCourseActive('${c.id}')">${hidden ? '顯示' : '隱藏'}</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleCourseActive(courseId) {
  const c = adminCourses.find(x => x.id === courseId);
  if (!c) return;
  try {
    await db.collection('courses').doc(courseId).update({ active: c.active === false });
    loadCourseList();
  } catch (e) {
    alert('切換失敗：' + e.message);
  }
}

async function moveCourse(index, dir) {
  const a = adminCourses[index];
  const b = adminCourses[index + dir];
  if (!a || !b) return;
  const batch = db.batch();
  batch.update(db.collection('courses').doc(a.id), { order: index + dir });
  batch.update(db.collection('courses').doc(b.id), { order: index });
  await batch.commit();
  loadCourseList();
}

// ── 新增 / 編輯表單 ──────────────────────────────────────────
function openCourseForm(courseId = null, type = 'course') {
  editingCourseId = courseId;
  uploadedPhoto = null;
  const c = courseId ? adminCourses.find(x => x.id === courseId) : null;
  editingType = c ? (c.type || 'course') : type;

  const typeName = editingType === 'event' ? '活動' : '課程';
  document.getElementById('course-modal-title').textContent = c ? `編輯${typeName}` : `新增${typeName}`;

  // 依類型切換欄位標題（課程 / 活動）
  const isEvent = editingType === 'event';
  document.getElementById('lbl-name').textContent        = `${typeName}名稱 *`;
  document.getElementById('lbl-name-en').textContent     = isEvent ? 'Event Name' : 'Course Name';
  document.getElementById('lbl-desc').textContent        = `${typeName}描述`;
  document.getElementById('lbl-sessions').textContent    = isEvent ? '活動時間（一行一個）' : '上課時段（一行一個）';
  document.getElementById('lbl-sessions-en').textContent = isEvent ? 'Event Times (one per line)' : 'Class Times (one per line)';
  document.getElementById('c-name').value     = c?.name || '';
  document.getElementById('c-emoji').value    = c?.emoji || '';
  document.getElementById('c-desc').value     = c?.description || '';
  document.getElementById('c-sessions').value = (c?.sessions || []).join('\n');
  document.getElementById('c-location').value     = c?.location || '';
  document.getElementById('c-teacher').value      = c?.teacher || '';
  document.getElementById('c-teacher-desc').value = c?.teacherDesc || '';

  // 英文欄位（sessionsEn 跟中文相同時視為未填，留空）
  const enSessions = (c?.sessionsEn || []).join('\n');
  document.getElementById('c-sessions-en').value =
    enSessions === (c?.sessions || []).join('\n') ? '' : enSessions;
  document.getElementById('c-name-en').value         = (c?.nameEn && c.nameEn !== c.name) ? c.nameEn : '';
  document.getElementById('c-desc-en').value         = c?.descriptionEn || '';
  document.getElementById('c-location-en').value     = c?.locationEn || '';
  document.getElementById('c-teacher-en').value      = c?.teacherEn || '';
  document.getElementById('c-teacher-desc-en').value = c?.teacherDescEn || '';
  document.getElementById('c-referral').checked = c ? c.referralEnabled !== false : true;
  document.getElementById('c-leader-cap').value   = (c?.leaderCap   ?? '') === '' ? '' : c.leaderCap;
  document.getElementById('c-follower-cap').value = (c?.followerCap ?? '') === '' ? '' : c.followerCap;
  document.getElementById('c-photo').value    = '';
  document.getElementById('c-photo-preview').innerHTML =
    c?.photo ? `<img src="${c.photo}">` : '';
  document.getElementById('c-err').textContent = '';
  document.getElementById('c-delete').style.display = c ? '' : 'none';

  // 方案列
  const plansWrap = document.getElementById('c-plans');
  plansWrap.innerHTML = '';
  (c?.plans?.length ? c.plans : [{ label: '單人', price: '' }]).forEach(p => addPlanRow(p));

  document.getElementById('course-modal-overlay').style.display = 'flex';
}

function closeCourseForm() {
  document.getElementById('course-modal-overlay').style.display = 'none';
  editingCourseId = null;
}

function addPlanRow(plan = { label: '', labelEn: '', price: '' }) {
  const row = document.createElement('div');
  row.className = 'plan-row';
  // labelEn 跟中文相同時視為未填英文，顯示空白
  const labelEn = (plan.labelEn && plan.labelEn !== plan.label) ? plan.labelEn : '';
  row.innerHTML = `
    <input type="text" class="plan-label-input" placeholder="方案名（如：單人）" value="${plan.label || ''}">
    <input type="text" class="plan-label-en-input" placeholder="English (e.g. Solo)" value="${labelEn}">
    <input type="number" class="plan-price-input" placeholder="價格" min="0" value="${plan.price ?? ''}">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('c-plans').appendChild(row);
}

// ── 照片上傳（壓縮成 base64，存進 Firestore） ─────────────────
function handlePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // 壓縮到最寬 600px、JPEG 70%，約 50–150KB，遠低於 Firestore 1MB 文件上限
    const maxW = 600;
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    uploadedPhoto = canvas.toDataURL('image/jpeg', 0.7);
    document.getElementById('c-photo-preview').innerHTML = `<img src="${uploadedPhoto}">`;
  };
  img.src = URL.createObjectURL(file);
}

// 名額輸入轉換：留空或非數字 = null（不限），其餘取 >=0 整數
function parseCap(v) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ── 儲存課程 ─────────────────────────────────────────────────
async function saveCourse() {
  const err = document.getElementById('c-err');
  const name = document.getElementById('c-name').value.trim();
  if (!name) { err.textContent = '課程名稱為必填'; return; }

  // 收集方案
  const plans = [];
  document.querySelectorAll('#c-plans .plan-row').forEach((row, i) => {
    const label   = row.querySelector('.plan-label-input').value.trim();
    const labelEn = row.querySelector('.plan-label-en-input').value.trim();
    const price = Number(row.querySelector('.plan-price-input').value);
    if (label && price > 0) {
      // 雙人方案要顯示 Leader/Follower 欄位，靠 id 判斷
      const id = label.includes('雙') ? 'duo' : (i === 0 ? 'solo' : 'plan' + i);
      plans.push({ id, label, labelEn: labelEn || label, price });
    }
  });
  if (!plans.length) { err.textContent = '至少要有一個方案（名稱＋價格）'; return; }

  const existing = editingCourseId ? adminCourses.find(x => x.id === editingCourseId) : null;
  const data = {
    name,
    nameEn:        document.getElementById('c-name-en').value.trim() || name,
    emoji:         document.getElementById('c-emoji').value.trim(),
    description:   document.getElementById('c-desc').value.trim(),
    descriptionEn: document.getElementById('c-desc-en').value.trim(),
    sessions:      document.getElementById('c-sessions').value.split('\n').map(s => s.trim()).filter(Boolean),
    location:      document.getElementById('c-location').value.trim(),
    teacher:       document.getElementById('c-teacher').value.trim(),
    teacherDesc:   document.getElementById('c-teacher-desc').value.trim(),
    locationEn:     document.getElementById('c-location-en').value.trim(),
    teacherEn:      document.getElementById('c-teacher-en').value.trim(),
    teacherDescEn:  document.getElementById('c-teacher-desc-en').value.trim(),
    plans,
    photo:  uploadedPhoto !== null ? uploadedPhoto : (existing?.photo || ''),
    referralEnabled: document.getElementById('c-referral').checked,
    leaderCap:   parseCap(document.getElementById('c-leader-cap').value),
    followerCap: parseCap(document.getElementById('c-follower-cap').value),
    type:   editingType,
    order:  existing?.order ?? adminCourses.length,
    active: existing ? existing.active !== false : true,   // 保留原本的顯示/隱藏狀態
  };
  const enSessionsInput = document.getElementById('c-sessions-en').value.split('\n').map(s => s.trim()).filter(Boolean);
  data.sessionsEn = enSessionsInput.length ? enSessionsInput : data.sessions;

  err.textContent = '';
  try {
    if (editingCourseId) {
      await db.collection('courses').doc(editingCourseId).set(data);
    } else {
      await db.collection('courses').add(data);
    }
    closeCourseForm();
    loadCourseList();
  } catch (e) {
    err.textContent = '儲存失敗：' + e.message;
  }
}

async function deleteCourse() {
  if (!editingCourseId) return;
  if (!confirm('確定要刪除這個課程嗎？（已報名的資料不會被刪除）')) return;
  try {
    await db.collection('courses').doc(editingCourseId).delete();
    closeCourseForm();
    loadCourseList();
  } catch (e) {
    document.getElementById('c-err').textContent = '刪除失敗：' + e.message;
  }
}

// ── 設定（localStorage） ──────────────────────────────────────
function loadSettings() {
  // 從 localStorage 覆蓋 config
  const keys = ['bank_name','bank_account','bank_raw','bank_holder','whatsapp','callmebot_key','resend_key','sender_email','discount','admin_pw'];
  // 靜默載入，實際值在 saveSettings / loadSettingsForm 時使用
}

function loadSettingsForm() {
  document.getElementById('s-bank-name').value    = localStorage.getItem('hhtw_bank_name')    || SITE_CONFIG.bank.name;
  document.getElementById('s-bank-account').value = localStorage.getItem('hhtw_bank_account') || SITE_CONFIG.bank.account;
  document.getElementById('s-bank-raw').value     = localStorage.getItem('hhtw_bank_raw')     || SITE_CONFIG.bank.accountRaw;
  document.getElementById('s-bank-holder').value  = localStorage.getItem('hhtw_bank_holder')  || SITE_CONFIG.bank.holder;
  document.getElementById('s-whatsapp').value     = localStorage.getItem('hhtw_whatsapp')     || SITE_CONFIG.whatsappNumber;
  document.getElementById('s-callmebot-key').value= localStorage.getItem('hhtw_callmebot')    || '';
  document.getElementById('s-resend-key').value   = localStorage.getItem('hhtw_resend_key')   || '';
  document.getElementById('s-sender-email').value = localStorage.getItem('hhtw_sender_email') || SITE_CONFIG.senderEmail;
  document.getElementById('s-discount').value     = localStorage.getItem('hhtw_discount')     || SITE_CONFIG.referralDiscount;
}

function saveSettings() {
  localStorage.setItem('hhtw_bank_name',    document.getElementById('s-bank-name').value);
  localStorage.setItem('hhtw_bank_account', document.getElementById('s-bank-account').value);
  localStorage.setItem('hhtw_bank_raw',     document.getElementById('s-bank-raw').value);
  localStorage.setItem('hhtw_bank_holder',  document.getElementById('s-bank-holder').value);
  localStorage.setItem('hhtw_whatsapp',     document.getElementById('s-whatsapp').value);
  localStorage.setItem('hhtw_callmebot',    document.getElementById('s-callmebot-key').value);
  localStorage.setItem('hhtw_resend_key',   document.getElementById('s-resend-key').value);
  localStorage.setItem('hhtw_sender_email', document.getElementById('s-sender-email').value);
  localStorage.setItem('hhtw_discount',     document.getElementById('s-discount').value);

  const newPw = document.getElementById('s-admin-pw').value;
  if (newPw) localStorage.setItem('hhtw_admin_pw', newPw);

  alert('設定已儲存！');
}
