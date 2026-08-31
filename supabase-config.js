/* أعراف للأعمال — الربط العام الآمن مع Supabase */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://yuoforvbxpwislmdrvvb.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tyyiEKXaSDaUKN_HCLkBGg_vZTYMwki';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('تعذر تحميل مكتبة Supabase');
  }

  window.ARAF_SUPABASE = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'araf-business-auth'
      }
    }
  );

  window.ARAF_BUSINESS_API_BASE = 'https://araf-site.vercel.app/api';

  window.ARAF_AUTH_EMAIL = function (code) {
    var normalized = String(code || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{4,30}$/.test(normalized)) return '';
    return normalized + '@business.araf.online';
  };
})();
