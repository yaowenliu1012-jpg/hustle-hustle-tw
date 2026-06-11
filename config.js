// ============================================================
//  ⭐ 每季只需要修改這個檔案
// ============================================================

const SITE_CONFIG = {
  // 銀行帳號資訊
  bank: {
    name: '玉山銀行（808）',
    account: '0988-940-123456',
    accountRaw: '0988940123456',
    holder: '陳○○',
  },

  // WhatsApp 通知號碼（CallMeBot，有新報名時通知管理員）
  whatsappNumber: '886922800756',

  // 推薦人折扣
  referralDiscount: 100,

  // 課程資料
  courses: [
    {
      id: 'baby',
      name: '寶寶班',
      emoji: '🐣',
      nameEn: 'Beginner Class',
      sessions: ['每週四 19:00–20:30', '每週六 14:00–15:30'],
      sessionsEn: ['Every Thu 19:00–20:30', 'Every Sat 14:00–15:30'],
      plans: [
        { id: 'solo',  label: '單人',  labelEn: 'Solo',  price: 1800 },
        { id: 'duo',   label: '雙人',  labelEn: 'Duo',   price: 3400 },
      ],
    },
    {
      id: 'advanced',
      name: '進階班',
      emoji: '🔥',
      nameEn: 'Advanced Class',
      sessions: ['每週二 20:00–21:30', '每週六 16:00–17:30'],
      sessionsEn: ['Every Tue 20:00–21:30', 'Every Sat 16:00–17:30'],
      plans: [
        { id: 'solo',     label: '單人',       labelEn: 'Solo',            price: 2000 },
        { id: 'duo',      label: '雙人',       labelEn: 'Duo',             price: 3800 },
        { id: 'alumni',   label: '哈友回娘家', labelEn: 'Alumni Return',   price: 1000 },
      ],
    },
    {
      id: 'advanced2',
      name: '進階班 2',
      emoji: '⚡',
      nameEn: 'Advanced Class 2',
      sessions: ['每週三 20:00–21:30', '每週日 15:00–16:30'],
      sessionsEn: ['Every Wed 20:00–21:30', 'Every Sun 15:00–16:30'],
      plans: [
        { id: 'solo',     label: '單人',       labelEn: 'Solo',            price: 2000 },
        { id: 'duo',      label: '雙人',       labelEn: 'Duo',             price: 3800 },
        { id: 'alumni',   label: '哈友回娘家', labelEn: 'Alumni Return',   price: 1000 },
      ],
    },
    {
      id: 'choreo',
      name: '排舞班',
      emoji: '🎶',
      nameEn: 'Choreography Class',
      sessions: ['每週五 19:30–21:00'],
      sessionsEn: ['Every Fri 19:30–21:00'],
      plans: [
        { id: 'solo', label: '單人', labelEn: 'Solo', price: 2000 },
        { id: 'duo',  label: '雙人', labelEn: 'Duo',  price: 3800 },
      ],
    },
  ],

  // Firebase 設定（到 firebase.google.com 建立專案後填入）
  firebase: {
    apiKey:            'AIzaSyB_eSRQj7Jo3YvoC5sG5Xs8X7kn2T363Iw',
    authDomain:        'hustle-hustle-tw.firebaseapp.com',
    projectId:         'hustle-hustle-tw',
    storageBucket:     'hustle-hustle-tw.firebasestorage.app',
    messagingSenderId: '673527108026',
    appId:             '1:673527108026:web:3e8eb4839e1901b6558d83',
  },

  // Resend API Key（到 resend.com 申請後填入）
  resendApiKey: 'YOUR_RESEND_API_KEY',

  // 寄件人 Email（需在 Resend 驗證網域）
  senderEmail: 'noreply@hustle-hustle-tw.com',

  // 後台管理密碼
  adminPassword: 'hustle2025',
};
