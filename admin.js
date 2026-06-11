// ============================================================
//  Hustle Hustle TW — 後台管理程式
// ============================================================

let db = null;
let allRegistrations = [];
let currentDocId = null;

// ── 初始化 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

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
    populateCourseFilter();
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
  tbody.innerHTML = '<tr><td colspan="11" class="loading-cell">載入中...</td></tr>';

  if (!db) { showDemoData(); return; }

  try {
    const snap = await db.collection('registrations').orderBy('createdAt', 'desc').get();
    allRegistrations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    applyFilters();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="11" class="loading-cell">載入失敗：${e.message}</td></tr>`;
  }
}

// ── Demo 資料（Firebase 未設定時顯示） ───────────────────────
function showDemoData() {
  allRegistrations = [
    { id: 'demo1', createdAt: new Date().toISOString(), courseName: '進階班', planName: '單人', name: '王小明', phone: '0912345678', email: 'test@example.com', role: 'Leader', total: 1900, transferCode: '12345', referral: '李教練', status: 'pending' },
    { id: 'demo2', createdAt: new Date().toISOString(), courseName: '寶寶班', planName: '雙人', leaderName: '張三', leaderPhone: '0987654321', leaderEmail: 'a@a.com', followerName: '李四', followerPhone: '0911111111', followerEmail: 'b@b.com', payerEmail: 'a@a.com', total: 3400, transferCode: '67890', referral: '', status: 'approved' },
  ];
  applyFilters();
}

// ── 過濾 & 渲染表格 ───────────────────────────────────────────
function applyFilters() {
  const statusF = document.getElementById('filter-status').value;
  const courseF = document.getElementById('filter-course').value;

  const filtered = allRegistrations.filter(r => {
    if (statusF && r.status !== statusF) return false;
    if (courseF && r.courseName !== courseF) return false;
    return true;
  });

  renderTable(filtered);
  renderStats();
}

function renderTable(rows) {
  const tbody = document.getElementById('reg-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="loading-cell">沒有資料</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const isDuo = !!r.leaderName;
    const name  = isDuo ? `${r.leaderName} / ${r.followerName}` : r.name;
    const phone = isDuo ? r.leaderPhone : r.phone;
    const email = isDuo ? r.payerEmail  : r.email;
    const date  = new Date(r.createdAt).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `<tr>
      <td>${date}</td>
      <td>${r.courseName}</td>
      <td>${r.planName}</td>
      <td>${name}</td>
      <td>${phone}</td>
      <td>${email}</td>
      <td>NT$${Number(r.total).toLocaleString()}</td>
      <td>${r.transferCode}</td>
      <td>${r.referral || '—'}</td>
      <td><span class="badge badge-${r.status}">${statusLabel(r.status)}</span></td>
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
  const total    = allRegistrations.length;
  const pending  = allRegistrations.filter(r => r.status === 'pending').length;
  const approved = allRegistrations.filter(r => r.status === 'approved').length;
  const rejected = allRegistrations.filter(r => r.status === 'rejected').length;
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">總報名數</div></div>
    <div class="stat-card stat-pending"><div class="stat-num">${pending}</div><div class="stat-label">待審核</div></div>
    <div class="stat-card stat-approved"><div class="stat-num">${approved}</div><div class="stat-label">已通過</div></div>
    <div class="stat-card stat-rejected"><div class="stat-num">${rejected}</div><div class="stat-label">已拒絕</div></div>
  `;
}

function populateCourseFilter() {
  const sel = document.getElementById('filter-course');
  SITE_CONFIG.courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.emoji} ${c.name}`;
    sel.appendChild(opt);
  });
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
    ['Leader Email', r.leaderEmail],
    ['Follower', `${r.followerName} / ${r.followerPhone}`],
    ['Follower Email', r.followerEmail],
    ['匯款人 Email', r.payerEmail],
    ['金額', `NT$${Number(r.total).toLocaleString()}`],
    ['後五碼', r.transferCode],
    ['推薦人', r.referral || '—'],
    ['狀態', statusLabel(r.status)],
    ['報名時間', new Date(r.createdAt).toLocaleString('zh-TW')],
  ] : [
    ['課程', r.courseName], ['方案', r.planName],
    ['姓名', r.name], ['電話', r.phone], ['Email', r.email], ['角色', r.role],
    ['金額', `NT$${Number(r.total).toLocaleString()}`],
    ['後五碼', r.transferCode],
    ['推薦人', r.referral || '—'],
    ['狀態', statusLabel(r.status)],
    ['報名時間', new Date(r.createdAt).toLocaleString('zh-TW')],
  ];

  document.getElementById('modal-body').innerHTML = `
    <table class="modal-table">
      ${rows.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>`;

  const isPending = r.status === 'pending';
  document.getElementById('btn-approve').style.display = isPending ? '' : 'none';
  document.getElementById('btn-reject').style.display  = isPending ? '' : 'none';

  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  currentDocId = null;
}

async function updateStatus(newStatus) {
  if (!currentDocId) return;
  const r = allRegistrations.find(x => x.id === currentDocId);
  if (!r) return;

  if (db && !currentDocId.startsWith('demo')) {
    try {
      await db.collection('registrations').doc(currentDocId).update({ status: newStatus });
    } catch (e) {
      alert('更新失敗：' + e.message); return;
    }
  }

  r.status = newStatus;
  closeModal();
  applyFilters();

  // 寄送 Email 通知
  const email = r.payerEmail || r.email || r.leaderEmail;
  if (email) {
    sendStatusEmail(email, r.name || r.leaderName, r.courseName, newStatus);
  }
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
  const headers = ['報名時間','課程','方案','姓名/Leader','電話','Email','角色','Follower','Follower電話','Follower Email','匯款人Email','金額','後五碼','推薦人','狀態'];
  const rows = allRegistrations.map(r => {
    const isDuo = !!r.leaderName;
    return [
      new Date(r.createdAt).toLocaleString('zh-TW'),
      r.courseName, r.planName,
      isDuo ? r.leaderName  : r.name,
      isDuo ? r.leaderPhone : r.phone,
      isDuo ? r.leaderEmail : r.email,
      isDuo ? '' : r.role,
      isDuo ? r.followerName  : '',
      isDuo ? r.followerPhone : '',
      isDuo ? r.followerEmail : '',
      isDuo ? r.payerEmail    : '',
      r.total, r.transferCode, r.referral || '', statusLabel(r.status),
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
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
