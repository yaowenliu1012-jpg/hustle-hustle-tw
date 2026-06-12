// ============================================================
//  Hustle Hustle TW — 報名系統主程式
//  不需要修改這個檔案
// ============================================================

// Firebase SDK (loaded via CDN in index.html)
let db = null;
let lang = 'zh';
let state = {
  step: 1,
  courseId: null,
  planId: null,
  formData: {},
};

// 課程清單：優先用 Firestore 後台管理的課程，沒有才用 config.js 的預設值
let COURSES = SITE_CONFIG.courses;

// ── 初始化 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  await loadCourses();
  renderStep1();
  document.getElementById('lang-toggle').addEventListener('click', toggleLang);
});

function initFirebase() {
  try {
    firebase.initializeApp(SITE_CONFIG.firebase);
    db = firebase.firestore();
  } catch (e) {
    console.warn('Firebase 尚未設定，報名資料不會儲存到資料庫。');
  }
}

async function loadCourses() {
  if (!db) return;
  try {
    const snap = await db.collection('courses').orderBy('order').get();
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(c => c.active !== false);
    if (list.length) COURSES = list;
  } catch (e) {
    console.warn('讀取課程失敗，使用預設課程', e);
  }
}

// ── 語言切換 ─────────────────────────────────────────────────
function toggleLang() {
  lang = lang === 'zh' ? 'en' : 'zh';
  document.getElementById('lang-toggle').textContent = t('langToggle');
  refreshCurrentStep();
}

function t(key) {
  return I18N[lang][key] || key;
}

function refreshCurrentStep() {
  switch (state.step) {
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
  }
}

// ── Step 1：選課程 ───────────────────────────────────────────
function renderStep1() {
  state.step = 1;
  updateStepIndicator();
  const main = document.getElementById('main');
  const courseList = COURSES.filter(c => c.type !== 'event');
  const eventList  = COURSES.filter(c => c.type === 'event');

  main.innerHTML = `<h2 class="step-title">${t('selectCourse')}</h2>
    ${renderCourseGroup(courseList, eventList.length ? (lang === 'zh' ? '課程' : 'Courses') : '')}
    ${renderCourseGroup(eventList, lang === 'zh' ? '活動' : 'Events')}
    <div class="btn-row">
      <button class="btn btn-primary" id="step1-next" ${!state.courseId ? 'disabled' : ''} onclick="goStep2()">${t('next')}</button>
    </div>`;

  bindCourseCards(main);
}

function renderCourseGroup(list, heading) {
  if (!list.length) return '';
  return `${heading ? `<h3 class="group-title">${heading}</h3>` : ''}
    <div class="course-grid">
      ${list.map(c => {
        const hasDetail = c.photo || c.description || c.teacher || c.location;
        return `
        <div class="course-card ${state.courseId === c.id ? 'selected' : ''}" data-id="${c.id}">
          ${hasDetail ? `<button class="info-btn" data-info="${c.id}" aria-label="課程詳情">ⓘ</button>` : ''}
          <div class="course-emoji">${c.emoji || '💃'}</div>
          <div class="course-name">${lang === 'zh' ? c.name : (c.nameEn || c.name)}</div>
          <div class="course-sessions">
            <strong>${t('sessions')}：</strong>
            ${((lang === 'zh' ? c.sessions : c.sessionsEn) || c.sessions || []).map(s => `<div>${s}</div>`).join('')}
          </div>
          <div class="course-prices">
            ${c.plans.map(p => `<span class="price-tag">${lang === 'zh' ? p.label : p.labelEn} NT$${p.price.toLocaleString()}</span>`).join('')}
          </div>
          ${hasDetail ? `
          <div class="course-hover">
            ${c.photo ? `<img class="course-hover-photo" src="${c.photo}" alt="">` : ''}
            <div class="course-hover-body">
              ${c.description ? `<p class="course-hover-desc">${lang === 'zh' ? c.description : (c.descriptionEn || c.description)}</p>` : ''}
              ${c.teacher ? `<p class="course-hover-meta">🧑‍🏫 <strong>${lang === 'zh' ? c.teacher : (c.teacherEn || c.teacher)}</strong></p>` : ''}
              ${c.teacherDesc ? `<p class="course-hover-teacher">${lang === 'zh' ? c.teacherDesc : (c.teacherDescEn || c.teacherDesc)}</p>` : ''}
              ${c.location ? `<p class="course-hover-meta">📍 ${lang === 'zh' ? c.location : (c.locationEn || c.location)}</p>` : ''}
            </div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

function bindCourseCards(main) {
  main.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      state.courseId = card.dataset.id;
      state.planId = null;
      main.querySelectorAll('.course-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('step1-next').disabled = false;
    });
  });

  // ⓘ 按鈕：手機沒有 hover，點擊切換詳情
  main.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.course-card');
      const wasOpen = card.classList.contains('show-info');
      main.querySelectorAll('.course-card').forEach(c => c.classList.remove('show-info'));
      if (!wasOpen) card.classList.add('show-info');
    });
  });
}

function goStep2() {
  if (!state.courseId) return;
  renderStep2();
}

// 目前報名中的課程標示（顯示在步驟 2、3 的標題下方）
function courseBanner() {
  const c = COURSES.find(x => x.id === state.courseId);
  if (!c) return '';
  return `<div class="course-banner">${c.emoji || ''} ${lang === 'zh' ? c.name : (c.nameEn || c.name)}</div>`;
}

// ── Step 2：選方案 ───────────────────────────────────────────
function renderStep2() {
  state.step = 2;
  updateStepIndicator();
  const course = COURSES.find(c => c.id === state.courseId);
  const main = document.getElementById('main');
  main.innerHTML = `<h2 class="step-title">${t('selectPlan')}</h2>
    ${courseBanner()}
    <div class="plan-grid">
      ${course.plans.map(p => `
        <div class="plan-card ${state.planId === p.id ? 'selected' : ''}" data-id="${p.id}">
          <div class="plan-label">${lang === 'zh' ? p.label : p.labelEn}</div>
          <div class="plan-price">NT$${p.price.toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="renderStep1()">${t('back')}</button>
      <button class="btn btn-primary" id="step2-next" ${!state.planId ? 'disabled' : ''} onclick="goStep3()">${t('next')}</button>
    </div>`;

  main.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      state.planId = card.dataset.id;
      main.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('step2-next').disabled = false;
    });
  });
}

function goStep3() {
  if (!state.planId) return;
  renderStep3();
}

// ── Step 3：填資料 ───────────────────────────────────────────
function renderStep3() {
  state.step = 3;
  updateStepIndicator();
  const isDuo = state.planId === 'duo';
  const fd = state.formData;
  const main = document.getElementById('main');
  const course = COURSES.find(c => c.id === state.courseId);
  const referralOn = course?.referralEnabled !== false;

  main.innerHTML = `<h2 class="step-title">${t('fillInfo')}</h2>
    ${courseBanner()}
    <form id="reg-form" novalidate>
      ${isDuo ? `
        <fieldset><legend>${t('leaderInfo')}</legend>
          ${field('leader_name',  t('name'),    fd.leader_name,  'text')}
          ${field('leader_phone', t('phone'),   fd.leader_phone, 'tel')}
        </fieldset>
        <fieldset><legend>${t('followerInfo')}</legend>
          ${field('follower_name',  t('name'),  fd.follower_name,  'text')}
          ${field('follower_phone', t('phone'), fd.follower_phone, 'tel')}
        </fieldset>
        ${referralOn ? `<fieldset>
          ${field('referral', t('referral'), fd.referral, 'text', false)}
        </fieldset>` : ''}
      ` : `
        <fieldset>
          ${field('solo_name',  t('name'),  fd.solo_name,  'text')}
          ${field('solo_phone', t('phone'), fd.solo_phone, 'tel')}
          <div class="form-group">
            <label>${t('role')}</label>
            <div class="radio-row">
              <label><input type="radio" name="solo_role" value="Leader" ${fd.solo_role === 'Leader' ? 'checked' : ''}> ${t('leader')}</label>
              <label><input type="radio" name="solo_role" value="Follower" ${fd.solo_role === 'Follower' ? 'checked' : ''}> ${t('follower')}</label>
            </div>
            <span class="error-msg" id="err-solo_role"></span>
          </div>
          ${referralOn ? field('referral', t('referral'), fd.referral, 'text', false) : ''}
        </fieldset>
      `}
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" onclick="renderStep2()">${t('back')}</button>
        <button type="button" class="btn btn-primary" onclick="validateStep3()">${t('next')}</button>
      </div>
    </form>`;
}

function field(id, label, value = '', type = 'text', required = true) {
  return `<div class="form-group">
    <label for="${id}">${label}${required ? ' <span class="req">*</span>' : ''}</label>
    <input id="${id}" name="${id}" type="${type}" value="${escHtml(value)}" autocomplete="off">
    <span class="error-msg" id="err-${id}"></span>
  </div>`;
}

function escHtml(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function validateStep3() {
  const isDuo = state.planId === 'duo';
  const form = document.getElementById('reg-form');
  let ok = true;

  function check(id, validator) {
    const el = document.getElementById(id);
    const err = document.getElementById('err-' + id);
    if (!el || !err) return;
    const msg = validator(el.value.trim());
    err.textContent = msg;
    if (msg) { ok = false; el.focus(); }
  }

  const notEmpty = v => v ? '' : t('required');
  const validEmail = v => !v ? t('required') : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : t('invalidEmail');
  const validPhone = v => !v ? t('required') : /^[0-9+\-\s]{7,15}$/.test(v) ? '' : t('invalidPhone');

  if (isDuo) {
    check('leader_name',    notEmpty);
    check('leader_phone',   validPhone);
    check('follower_name',  notEmpty);
    check('follower_phone', validPhone);
  } else {
    check('solo_name',  notEmpty);
    check('solo_phone', validPhone);
    // radio
    const roleVal = form.querySelector('input[name="solo_role"]:checked')?.value || '';
    const roleErr = document.getElementById('err-solo_role');
    if (!roleVal) { roleErr.textContent = t('required'); ok = false; }
    else roleErr.textContent = '';
  }

  if (!ok) return;

  // 儲存資料
  if (isDuo) {
    ['leader_name','leader_phone','follower_name','follower_phone','referral'].forEach(id => {
      state.formData[id] = document.getElementById(id)?.value.trim() || '';
    });
  } else {
    ['solo_name','solo_phone','referral'].forEach(id => {
      state.formData[id] = document.getElementById(id)?.value.trim() || '';
    });
    state.formData.solo_role = form.querySelector('input[name="solo_role"]:checked')?.value || '';
  }

  renderStep4();
}

// ── Step 4：匯款 ─────────────────────────────────────────────
function renderStep4() {
  state.step = 4;
  updateStepIndicator();
  const course = COURSES.find(c => c.id === state.courseId);
  const plan   = course.plans.find(p => p.id === state.planId);
  const fd     = state.formData;
  const isDuo  = state.planId === 'duo';
  const hasRef = fd.referral && fd.referral.trim() && course.referralEnabled !== false;
  const discount = hasRef ? SITE_CONFIG.referralDiscount : 0;
  const total  = plan.price - discount;

  const main = document.getElementById('main');
  main.innerHTML = `<h2 class="step-title">${t('payment')}</h2>
    <div class="confirm-box">
      <h3>${t('confirmInfo')}</h3>
      <table class="confirm-table">
        <tr><td>${t('course')}</td><td>${course.emoji} ${lang === 'zh' ? course.name : course.nameEn}</td></tr>
        <tr><td>${t('plan')}</td><td>${lang === 'zh' ? plan.label : plan.labelEn}</td></tr>
        ${isDuo ? `
          <tr><td>Leader</td><td>${fd.leader_name} / ${fd.leader_phone}</td></tr>
          <tr><td>Follower</td><td>${fd.follower_name} / ${fd.follower_phone}</td></tr>
        ` : `
          <tr><td>${t('name')}</td><td>${fd.solo_name}</td></tr>
          <tr><td>${t('phone')}</td><td>${fd.solo_phone}</td></tr>
          <tr><td>${t('role')}</td><td>${fd.solo_role}</td></tr>
        `}
        ${hasRef ? `<tr><td>${t('discount')}</td><td>- NT$${discount} （${fd.referral}）</td></tr>` : ''}
        <tr class="total-row"><td>${t('totalAmount')}</td><td>NT$${total.toLocaleString()}</td></tr>
      </table>
    </div>

    <div class="bank-box">
      <div><strong>${t('bankName')}：</strong>${SITE_CONFIG.bank.name}</div>
      <div class="account-row">
        <strong>${t('bankAccount')}：</strong>
        <span id="bank-account">${SITE_CONFIG.bank.account}</span>
        <button class="btn btn-copy" onclick="copyAccount()">${t('copy')}</button>
      </div>
      <div><strong>${t('bankHolder')}：</strong>${SITE_CONFIG.bank.holder}</div>
    </div>

    <div class="form-group" style="margin-top:1.5rem">
      <label for="payer-email">${isDuo ? t('payerEmail') : t('email')} <span class="req">*</span></label>
      <input id="payer-email" type="email" value="${escHtml(isDuo ? fd.payer_email : fd.solo_email)}" autocomplete="off">
      <span class="error-msg" id="err-payer-email"></span>
    </div>

    <div class="form-group">
      <label for="transfer-code">${t('transferCode')} <span class="req">*</span></label>
      <input id="transfer-code" type="text" inputmode="numeric" maxlength="5" placeholder="12345">
      <span class="error-msg" id="err-transfer-code"></span>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" onclick="renderStep3()">${t('back')}</button>
      <button class="btn btn-primary" onclick="submitForm()">${t('submit')}</button>
    </div>`;
}

function copyAccount() {
  navigator.clipboard.writeText(SITE_CONFIG.bank.accountRaw).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = t('copied');
    setTimeout(() => btn.textContent = t('copy'), 2000);
  });
}

// ── 送出報名 ─────────────────────────────────────────────────
async function submitForm() {
  // 驗證 Email（雙人＝匯款人 Email；單人＝本人 Email）
  const payerInput = document.getElementById('payer-email');
  {
    const payerErr = document.getElementById('err-payer-email');
    const v = payerInput.value.trim();
    if (!v) { payerErr.textContent = t('required'); payerInput.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { payerErr.textContent = t('invalidEmail'); payerInput.focus(); return; }
    payerErr.textContent = '';
    if (state.planId === 'duo') state.formData.payer_email = v;
    else state.formData.solo_email = v;
  }

  const code = document.getElementById('transfer-code').value.trim();
  const err  = document.getElementById('err-transfer-code');
  if (!/^\d{5}$/.test(code)) { err.textContent = t('invalidCode'); return; }
  err.textContent = '';

  const course = COURSES.find(c => c.id === state.courseId);
  const plan   = course.plans.find(p => p.id === state.planId);
  const isDuo  = state.planId === 'duo';
  const fd     = state.formData;
  const hasRef = fd.referral && fd.referral.trim() && course.referralEnabled !== false;
  const discount = hasRef ? SITE_CONFIG.referralDiscount : 0;

  const payload = {
    courseId:   state.courseId,
    courseName: course.name,
    planId:     state.planId,
    planName:   plan.label,
    price:      plan.price,
    discount,
    total:      plan.price - discount,
    transferCode: code,
    referral:   fd.referral || '',
    status:     'pending',
    createdAt:  new Date().toISOString(),
    ...(isDuo ? {
      leaderName:  fd.leader_name,
      leaderPhone: fd.leader_phone,
      followerName:  fd.follower_name,
      followerPhone: fd.follower_phone,
      payerEmail:  fd.payer_email,
    } : {
      name:  fd.solo_name,
      phone: fd.solo_phone,
      email: fd.solo_email,
      role:  fd.solo_role,
    }),
  };

  const submitBtn = document.querySelector('.btn-primary[onclick="submitForm()"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '送出中...';

  try {
    // 1. 寫入 Firebase
    if (db) {
      await db.collection('registrations').add(payload);
    }

    // 2. WhatsApp 通知
    sendWhatsApp(payload);

    // 3. 顯示成功
    showSuccess();
  } catch (e) {
    console.error(e);
    submitBtn.disabled = false;
    submitBtn.textContent = t('submit');
    alert('送出失敗，請稍後再試。');
  }
}

function showSuccess() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="success-box">
    <div class="success-icon">✅</div>
    <h2>${t('submitSuccess')}</h2>
    <p>請等候我們的 Email 通知（審核通過或拒絕）。</p>
    <button class="btn btn-primary" onclick="location.reload()">再次報名</button>
  </div>`;
  updateStepIndicator(true);
}

// ── WhatsApp 通知（CallMeBot） ────────────────────────────────
function sendWhatsApp(payload) {
  const msg = encodeURIComponent(
    `【新報名】${payload.courseName} ${payload.planName}\n` +
    `姓名：${payload.name || payload.leaderName + ' / ' + payload.followerName}\n` +
    `金額：NT$${payload.total}\n` +
    `後五碼：${payload.transferCode}`
  );
  const url = `https://api.callmebot.com/whatsapp.php?phone=${SITE_CONFIG.whatsappNumber}&text=${msg}&apikey=YOUR_CALLMEBOT_APIKEY`;
  fetch(url).catch(() => {});
}

// ── 步驟指示器 ───────────────────────────────────────────────
function updateStepIndicator(done = false) {
  const steps = document.querySelectorAll('.step-item');
  steps.forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (done) { el.classList.add('done'); return; }
    if (i + 1 < state.step) el.classList.add('done');
    if (i + 1 === state.step) el.classList.add('active');
  });

  const labels = [t('step1'), t('step2'), t('step3'), t('step4')];
  steps.forEach((el, i) => {
    el.querySelector('.step-label').textContent = labels[i];
  });
}
