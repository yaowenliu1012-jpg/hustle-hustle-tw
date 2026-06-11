// ============================================================
// app.js — 主程式邏輯（不需要修改）
// ============================================================

let lang = 'zh';
let selCourse = null, selPlan = null, schedOpen = false, formData = {};

function t(key) { return I18N[lang][key]; }

function setLang(l) {
  lang = l;
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === (l === 'zh' ? '中文' : 'EN'))
  );
  applyLang();
}

function applyLang() {
  const l = I18N[lang];
  document.getElementById('hero-title').textContent = l.heroTitle;
  document.getElementById('hero-sub').textContent = l.heroSub;
  ['1','2','3','4'].forEach((i, idx) => { document.getElementById('sl' + i).textContent = l.steps[idx]; });
  document.getElementById('p1-title').textContent = l.p1Title;
  document.getElementById('sched-toggle-label').textContent = l.schedToggle;
  document.getElementById('p2-title').textContent = l.p2Title;
  document.getElementById('btn-p1-next').textContent = l.btnNext;
  document.getElementById('btn-p2-back').textContent = l.btnBack;
  document.getElementById('btn-p2-next').textContent = l.btnFill;
  document.getElementById('btn-p3-back').textContent = l.btnBack;
  document.getElementById('btn-p3-next').textContent = l.btnPay;
  document.getElementById('btn-p4-back').textContent = l.btnBackData;
  document.getElementById('btn-submit').textContent = l.btnSubmit;
  document.getElementById('referral-card-title').textContent = l.referralCardTitle;
  document.getElementById('referral-label').textContent = l.referralLabel;
  document.getElementById('referral-note').textContent = l.referralNote;
  document.getElementById('checklist-title').textContent = l.checklistTitle;
  document.getElementById('bd-base-label').textContent = l.bdBaseLabel;
  document.getElementById('bd-total-label').textContent = l.bdTotalLabel;
  document.getElementById('payment-label').textContent = l.paymentLabel;
  document.getElementById('payment-sub').textContent = l.paymentSub;
  document.getElementById('bank-title').textContent = l.bankTitle;
  document.getElementById('bank-label-bank').textContent = l.bankBank;
  document.getElementById('bank-val-bank').textContent = SITE_CONFIG.bank.name;
  document.getElementById('bank-label-acct').textContent = l.bankAcct;
  document.getElementById('bank-val-acct').textContent = SITE_CONFIG.bank.account;
  document.getElementById('bank-label-name').textContent = l.bankName;
  document.getElementById('bank-val-name').textContent = SITE_CONFIG.bank.holder;
  document.getElementById('bank-label-memo').textContent = l.bankMemo;
  document.getElementById('copy-btn').textContent = l.copyBtn;
  document.getElementById('transfer-card-title').textContent = l.transferCardTitle;
  document.getElementById('payer-email-label').textContent = l.payerEmailLabel;
  document.getElementById('payer-email-note').textContent = l.payerEmailNote;
  document.getElementById('transfer5-label').textContent = l.transfer5Label;
  document.getElementById('transfer5-note').textContent = l.transfer5Note;
  const t5 = document.getElementById('transfer5');
  if (t5) t5.placeholder = l.transfer5Placeholder;
  document.getElementById('success-title').textContent = l.successTitle;
  document.getElementById('success-body').innerHTML = l.successBody;
  renderCourses();
  if (selCourse !== null) renderPlans();
}

function updateSteps(active) {
  [1,2,3,4].forEach(i => {
    const n = document.getElementById('sn' + i), lb = document.getElementById('sl' + i);
    if (i < active) { n.className = 'step-num done'; n.innerHTML = '<i class="ti ti-check" style="font-size:11px"></i>'; lb.className = 'step-label done'; }
    else if (i === active) { n.className = 'step-num active'; n.textContent = i; lb.className = 'step-label active'; }
    else { n.className = 'step-num'; n.textContent = i; lb.className = 'step-label'; }
  });
}

function goPage(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page' + n).classList.add('active');
  updateSteps(n > 4 ? 4 : n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCourses() {
  const l = I18N[lang];
  document.getElementById('courses-grid').innerHTML = COURSES_DATA.map((c, i) => `
    <div class="course-card${selCourse === i ? ' selected' : ''}" onclick="pickCourse(this,${i})">
      <span class="course-icon">${c.icon}</span>
      <div class="course-name">${l.courses[i].name}</div>
      <span class="course-badge ${c.badgeClass}">${l.courses[i].badge}</span>
    </div>`).join('');
}

function renderPlans() {
  if (selCourse === null) return;
  const l = I18N[lang]; const c = COURSES_DATA[selCourse];
  document.getElementById('plans-grid').innerHTML = c.plans.map((p, i) => `
    <div class="plan-card${selPlan === i ? ' selected' : ''}" onclick="pickPlan(this,${i})">
      <div class="plan-name">${l.courses[selCourse].planNames[i]}</div>
      <div class="plan-price">NT$ ${p.price.toLocaleString()}</div>
      <div class="plan-desc">${l.courses[selCourse].planDescs[i]}</div>
    </div>`).join('');
  document.getElementById('p2-icon').textContent = COURSES_DATA[selCourse].icon;
  document.getElementById('p2-course').textContent = l.courses[selCourse].name;
  document.getElementById('btn-p2-next').style.display = selPlan !== null ? 'block' : 'none';
}

function pickCourse(el, idx) {
  selCourse = idx; selPlan = null;
  renderCourses();
  const c = COURSES_DATA[idx];
  const sl = document.getElementById('sched-list');
  sl.innerHTML = c.schedules.map((s, i) =>
    `<div class="schedule-item"><span class="s-num">${i + 1}</span>${s}</div>`
  ).join('');
  sl.classList.remove('open'); schedOpen = false;
  document.getElementById('sched-arrow').style.transform = '';
  document.getElementById('schedule-section').style.display = 'block';
}

function toggleSchedule() {
  schedOpen = !schedOpen;
  document.getElementById('sched-list').classList.toggle('open', schedOpen);
  document.getElementById('sched-arrow').style.transform = schedOpen ? 'rotate(180deg)' : '';
}

function pickPlan(el, idx) {
  selPlan = idx; renderPlans();
  document.getElementById('btn-p2-next').style.display = 'block';
}

function buildForm() {
  const l = I18N[lang]; const cd = COURSES_DATA[selCourse]; const p = cd.plans[selPlan];
  document.getElementById('p3-icon').textContent = cd.icon;
  document.getElementById('p3-course').textContent = l.courses[selCourse].name;
  document.getElementById('p3-plan').textContent = l.courses[selCourse].planNames[selPlan];
  let html = '';
  if (p.type === 'single') {
    html = `<div class="form-card">
      <div class="form-card-title"><i class="ti ti-user" aria-hidden="true"></i> ${l.formPersonTitle}</div>
      <div class="form-grid">
        <div class="fg"><label>${l.nameLabel}</label><input type="text" id="f-name" placeholder="${l.namePh}"/><div class="err-msg" id="err-name">${l.errName}</div></div>
        <div class="fg"><label>${l.phoneLabel}</label><input type="tel" id="f-phone" placeholder="${l.phonePh}"/><div class="err-msg" id="err-phone">${l.errPhone}</div></div>
        <div class="fg full"><label>${l.emailLabel}</label><input type="email" id="f-email" placeholder="your@email.com"/><div class="err-msg" id="err-email">${l.errEmail}</div></div>
        <div class="fg full"><label>${l.roleLabel}</label>
          <div class="role-row" id="role-wrap">
            <div class="role-btn" onclick="pickRole(this,'role-wrap')">🕺 Leader</div>
            <div class="role-btn" onclick="pickRole(this,'role-wrap')">💃 Follower</div>
          </div>
          <div class="err-msg" id="err-role">${l.errRole}</div>
        </div>
      </div></div>`;
  } else {
    html = `<div class="form-card">
      <div class="form-card-title"><span class="role-label role-leader">🕺 Leader</span></div>
      <div class="form-grid">
        <div class="fg"><label>${l.nameLabel}</label><input type="text" id="f-l-name" placeholder="Leader"/><div class="err-msg" id="err-l-name">${l.errLeaderName}</div></div>
        <div class="fg"><label>${l.phoneLabel}</label><input type="tel" id="f-l-phone" placeholder="${l.phonePh}"/><div class="err-msg" id="err-l-phone">${l.errLeaderPhone}</div></div>
        <div class="fg full"><label>${l.emailLabel}</label><input type="email" id="f-l-email" placeholder="leader@email.com"/><div class="err-msg" id="err-l-email">${l.errLeaderEmail}</div></div>
      </div></div>
    <div class="form-card">
      <div class="form-card-title"><span class="role-label role-follower">💃 Follower</span></div>
      <div class="form-grid">
        <div class="fg"><label>${l.nameLabel}</label><input type="text" id="f-f-name" placeholder="Follower"/><div class="err-msg" id="err-f-name">${l.errFollowerName}</div></div>
        <div class="fg"><label>${l.phoneLabel}</label><input type="tel" id="f-f-phone" placeholder="${l.phonePh}"/><div class="err-msg" id="err-f-phone">${l.errFollowerPhone}</div></div>
        <div class="fg full"><label>${l.emailLabel}</label><input type="email" id="f-f-email" placeholder="follower@email.com"/><div class="err-msg" id="err-f-email">${l.errFollowerEmail}</div></div>
      </div></div>`;
  }
  document.getElementById('form-fields').innerHTML = html;
  document.getElementById('f-referral').value = '';
  document.getElementById('referral-tag').classList.remove('show');
}

function onReferralInput(el) {
  const tag = document.getElementById('referral-tag');
  const tagText = document.getElementById('referral-tag-text');
  if (el.value.trim()) { tag.classList.add('show'); tagText.textContent = I18N[lang].referralTagTpl(el.value.trim()); }
  else tag.classList.remove('show');
}

function pickRole(el, wrapId) {
  document.getElementById(wrapId).querySelectorAll('.role-btn').forEach(b => { b.classList.remove('active'); b.classList.remove('err-role'); });
  el.classList.add('active');
  const em = document.getElementById('err-role'); if (em) em.classList.remove('show');
}

function validatePage3() {
  const p = COURSES_DATA[selCourse].plans[selPlan]; let ok = true;
  function chk(id, errId) {
    const el = document.getElementById(id), em = document.getElementById(errId);
    if (!el || !em) return;
    if (!el.value.trim()) { el.classList.add('err'); em.classList.add('show'); ok = false; }
    else { el.classList.remove('err'); em.classList.remove('show'); }
  }
  if (p.type === 'single') {
    chk('f-name','err-name'); chk('f-phone','err-phone'); chk('f-email','err-email');
    const rw = document.getElementById('role-wrap');
    if (!rw.querySelector('.role-btn.active')) {
      rw.querySelectorAll('.role-btn').forEach(b => b.classList.add('err-role'));
      document.getElementById('err-role').classList.add('show'); ok = false;
    }
  } else {
    chk('f-l-name','err-l-name'); chk('f-l-phone','err-l-phone'); chk('f-l-email','err-l-email');
    chk('f-f-name','err-f-name'); chk('f-f-phone','err-f-phone'); chk('f-f-email','err-f-email');
  }
  return ok;
}

function collectFormData() {
  const p = COURSES_DATA[selCourse].plans[selPlan];
  formData = { referral: document.getElementById('f-referral').value.trim() };
  if (p.type === 'single') {
    formData.name = document.getElementById('f-name').value;
    formData.phone = document.getElementById('f-phone').value;
    formData.email = document.getElementById('f-email').value;
    formData.role = document.getElementById('role-wrap').querySelector('.role-btn.active')?.textContent.trim() || '';
  } else {
    formData.leaderName = document.getElementById('f-l-name').value;
    formData.leaderPhone = document.getElementById('f-l-phone').value;
    formData.leaderEmail = document.getElementById('f-l-email').value;
    formData.followerName = document.getElementById('f-f-name').value;
    formData.followerPhone = document.getElementById('f-f-phone').value;
    formData.followerEmail = document.getElementById('f-f-email').value;
  }
}

function buildPaymentPage() {
  const l = I18N[lang]; const cd = COURSES_DATA[selCourse]; const p = cd.plans[selPlan];
  const hasRef = !!formData.referral;
  const discount = hasRef ? SITE_CONFIG.referralDiscount : 0;
  const finalPrice = p.price - discount;
  document.getElementById('p4-icon').textContent = cd.icon;
  document.getElementById('p4-course').textContent = l.courses[selCourse].name;
  document.getElementById('p4-plan').textContent = l.courses[selCourse].planNames[selPlan];
  document.getElementById('pay-amount').textContent = 'NT$ ' + finalPrice.toLocaleString();
  document.getElementById('bank-memo').textContent = (formData.name || formData.leaderName || '') + ' · ' + l.courses[selCourse].name;
  document.getElementById('bd-base').textContent = 'NT$ ' + p.price.toLocaleString();
  const refRow = document.getElementById('bd-referral-row');
  if (hasRef) { refRow.style.display = 'flex'; document.getElementById('bd-referral-label').textContent = l.bdRefLabel(formData.referral); }
  else refRow.style.display = 'none';
  document.getElementById('bd-total').textContent = 'NT$ ' + finalPrice.toLocaleString();
  let items = '';
  if (p.type === 'single') {
    items += `<div class="check-item"><span class="check-dot"></span>${formData.name}・${formData.role}</div>`;
    items += `<div class="check-item"><span class="check-dot"></span>${formData.phone}・${formData.email}</div>`;
  } else {
    items += `<div class="check-item"><span class="check-dot"></span>🕺 ${formData.leaderName}・${formData.leaderPhone}</div>`;
    items += `<div class="check-item"><span class="check-dot"></span>💃 ${formData.followerName}・${formData.followerPhone}</div>`;
  }
  if (hasRef) items += `<div class="check-item"><span class="check-dot" style="background:#534AB7"></span>${l.referralTagTpl(formData.referral)}</div>`;
  document.getElementById('checklist-items').innerHTML = items;
  document.getElementById('payer-email-wrap').style.display = p.type === 'couple' ? 'flex' : 'none';
  document.getElementById('transfer5').value = '';
  document.getElementById('transfer5').placeholder = l.transfer5Placeholder;
  const pe = document.getElementById('payer-email'); if (pe) pe.value = '';
}

function copyAcct() {
  navigator.clipboard && navigator.clipboard.writeText(SITE_CONFIG.bank.accountRaw);
  const btn = document.getElementById('copy-btn');
  btn.textContent = I18N[lang].copiedBtn;
  setTimeout(() => btn.textContent = I18N[lang].copyBtn, 1500);
}

function validatePage4() {
  const l = I18N[lang]; const p = COURSES_DATA[selCourse].plans[selPlan]; let ok = true;
  if (p.type === 'couple') {
    const pe = document.getElementById('payer-email'), pee = document.getElementById('err-payer-email');
    pee.textContent = l.errPayerEmail;
    if (!pe.value.trim()) { pe.classList.add('err'); pee.classList.add('show'); ok = false; }
    else { pe.classList.remove('err'); pee.classList.remove('show'); }
  }
  const t5 = document.getElementById('transfer5'), t5e = document.getElementById('err-transfer5');
  t5e.textContent = l.errTransfer5;
  if (t5.value.trim().length < 5) { t5.classList.add('err'); t5e.classList.add('show'); ok = false; }
  else { t5.classList.remove('err'); t5e.classList.remove('show'); }
  return ok;
}

function submitForm() {
  if (!validatePage4()) return;
  // TODO: 串接 Firebase 儲存報名資料
  goPage(5);
}

// 按鈕事件綁定
document.getElementById('btn-p1-next').onclick = function () {
  if (selCourse === null) return;
  renderPlans(); selPlan = null;
  document.getElementById('btn-p2-next').style.display = 'none';
  goPage(2);
};
document.getElementById('btn-p2-next').onclick = function () {
  if (selPlan === null) return; buildForm(); goPage(3);
};
document.getElementById('btn-p3-next').onclick = function () {
  if (!validatePage3()) return; collectFormData(); buildPaymentPage(); goPage(4);
};

// 初始化
renderCourses();
applyLang();
