/* ============================================================
   أعراف للأعمال — إدارة الحسابات والباقات (يدوي)
   ============================================================
   لإضافة شركة جديدة:
   1) انسخ أحد الكائنات في ARAF_BIZ_ACCOUNTS وعدّل بياناته
   2) code  : رمز المنشأة (تسلّمه للعميل) — مثال ARF-2101
   3) pin   : الرقم السري (6 أرقام)
   4) name  : اسم الكيان كما سيظهر في الترحيب
   5) type  : "شركة" أو "مؤسسة" أو "جمعية" ...
   6) plan  : sanad | imad | diwan
   7) start : تاريخ بداية الاشتراك (لعرض دورة الفوترة)
   8) used  : الاستهلاك الحالي — حدّثه يدوياً بعد تنفيذ كل خدمة
   ============================================================ */

window.ARAF_PLANS = {
  sanad: {
    key: 'sanad',
    name: 'باقة سند',
    tagline: 'الغطاء القانوني الأساسي لمنشأتك',
    price: 500,
    color: '#3D7B8A',
    quotas: {
      consult:     { label: 'استشارات قانونية',                 limit: 3 },
      contracts:   { label: 'صياغة أو مراجعة عقود',             limit: 2 },
      letters:     { label: 'صياغة أو مراجعة خطابات أو إنذارات', limit: 2 },
      najiz:       { label: 'طلبات عبر ناجز',                    limit: 2 },
      violations:  { label: 'اعتراضات على مخالفات حكومية',       limit: 1 },
      governance:  { label: 'أعمال حوكمة',                       limit: 0 },
      memos:       { label: 'مذكرات قانونية',                    limit: 0 },
      risk_review: { label: 'مراجعة المخاطر والالتزامات',         limit: 0 },
      negotiation: { label: 'اجتماعات تفاوضية عن بُعد',          limit: 0 }
    },
    perks: [
      'الاستشارات هاتفية أو مرئية أو مكتوبة حسب رغبة المنشأة',
      'خصم 10% على أتعاب القضايا والترافع'
    ]
  },
  imad: {
    key: 'imad',
    name: 'باقة عماد',
    tagline: 'الأنسب للشركات النامية',
    price: 2500,
    color: '#C9A96E',
    featured: true,
    quotas: {
      consult:     { label: 'استشارات قانونية',                 limit: 10 },
      contracts:   { label: 'صياغة أو مراجعة عقود',             limit: 5 },
      letters:     { label: 'صياغة أو مراجعة خطابات أو إنذارات', limit: 5 },
      najiz:       { label: 'طلبات عبر ناجز',                    limit: 5 },
      violations:  { label: 'اعتراضات على مخالفات حكومية',       limit: 3 },
      governance:  { label: 'أعمال حوكمة',                       limit: 3 },
      memos:       { label: 'مذكرات قانونية',                    limit: 0 },
      risk_review: { label: 'مراجعة المخاطر والالتزامات',         limit: 0 },
      negotiation: { label: 'اجتماعات تفاوضية عن بُعد',          limit: 0 }
    },
    perks: [
      'مدير حساب قانوني لمتابعة طلبات المنشأة',
      'خصم 15% على أتعاب القضايا والترافع'
    ]
  },
  diwan: {
    key: 'diwan',
    name: 'باقة ديوان',
    tagline: 'إدارة قانونية متكاملة لمنشأتك',
    price: 5000,
    color: '#1B3A4B',
    quotas: {
      consult:     { label: 'استشارات قانونية',                 limit: -1 },
      contracts:   { label: 'صياغة أو مراجعة عقود',             limit: 10 },
      letters:     { label: 'صياغة أو مراجعة خطابات أو إنذارات', limit: 10 },
      najiz:       { label: 'طلبات عبر ناجز',                    limit: 10 },
      violations:  { label: 'اعتراضات على مخالفات حكومية',       limit: 6 },
      governance:  { label: 'أعمال حوكمة',                       limit: 6 },
      memos:       { label: 'مذكرات قانونية',                    limit: 3 },
      risk_review: { label: 'مراجعة المخاطر والالتزامات',         limit: 1 },
      negotiation: { label: 'اجتماعات تفاوضية عن بُعد',          limit: 1 }
    },
    perks: [
      'مراجعة قانونية شهرية للمخاطر والالتزامات القائمة',
      'حضور اجتماع تفاوضي واحد عن بُعد شهريًا',
      'مستشار قانوني مخصص للمنشأة',
      'خصم 20% على أتعاب القضايا والترافع'
    ]
  }
};

/* ======================= الحسابات المفعّلة =======================
   manager: الموظف الموكّل من أعراف لهذه المنشأة —
   name / title / phone (بصيغة دولية بدون + لواتساب) / hours          */
window.ARAF_BIZ_ACCOUNTS = [
  {
    code: 'ARF-1001',
    pin: '112233',
    name: 'شركة المثال للتجارة',
    type: 'شركة',
    plan: 'imad',
    start: '2026-08-01',
    used: { consult: 4, contracts: 2, letters: 1, najiz: 0, violations: 0, governance: 0, memos: 0, risk_review: 0, negotiation: 0 },
    manager: {
      name: 'أ. عبدالله الحربي',
      title: 'محامٍ مرخص — مدير حساب منشأتكم',
      phone: '9665XXXXXXXX',
      hours: 'الأحد – الخميس، 9ص – 5م'
    }
  },
  {
    code: 'ARF-1002',
    pin: '445566',
    name: 'مؤسسة الأفق للمقاولات',
    type: 'مؤسسة',
    plan: 'sanad',
    start: '2026-07-15',
    used: { consult: 1, contracts: 0, letters: 0, najiz: 1, violations: 0, governance: 0, memos: 0, risk_review: 0, negotiation: 0 },
    manager: {
      name: 'أ. سارة القحطاني',
      title: 'مستشارة قانونية — مسؤولة حساب منشأتكم',
      phone: '9665XXXXXXXX',
      hours: 'الأحد – الخميس، 9ص – 5م'
    }
  },
  {
    code: 'ARF-1003',
    pin: '778899',
    name: 'شركة نماء القابضة',
    type: 'شركة',
    plan: 'diwan',
    start: '2026-06-01',
    used: { consult: 9, contracts: 6, letters: 3, najiz: 2, violations: 0, governance: 0, memos: 1, risk_review: 0, negotiation: 0 },
    manager: {
      name: 'أ. خالد العتيبي',
      title: 'محامٍ مرخص — المحامي المخصص لمنشأتكم',
      phone: '9665XXXXXXXX',
      hours: 'متاح طوال أيام الأسبوع'
    }
  }
];

/* رقم واتساب فريق أعراف للاستشارات وطلبات الانضمام (بدون +) */
window.ARAF_BIZ_WHATSAPP = '966506472325';

/*
   رابط استقبال طلبات البوابة في الداش بورد.
   عند إنشاء Supabase Edge Function أو API للداش بورد، ضع الرابط هنا.
   لا تضع مفتاح service_role أو أي سر داخل ملفات الواجهة العامة.
*/
window.ARAF_BIZ_REQUESTS_ENDPOINT = '';
