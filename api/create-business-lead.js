'use strict';

const {
  applyCors,
  handleOptions,
  sendJson,
  clean,
  escapeHtml,
  readBody,
  authenticatedBusiness,
  insertRow,
  createNotification,
  finishNotification,
  sendAlert,
  errorResponse
} = require('../server/business-api');

const PLAN_NAMES = {
  asas: 'أعراف أساس',
  numu: 'أعراف نمو',
  plus: 'أعراف بلس',
  undecided: 'غير محدد — يرغب باستشارة الفريق'
};

const PLAN_ALIASES = {
  asas: 'asas',
  'أعراف أساس': 'asas',
  numu: 'numu',
  'أعراف نمو': 'numu',
  plus: 'plus',
  'أعراف بلس': 'plus',
  undecided: 'undecided',
  'لست متأكداً — أريد استشارتكم': 'undecided',
  'لست متأكدا — أريد استشارتكم': 'undecided'
};

function normalizePlan(value) {
  return PLAN_ALIASES[clean(value, 100)] || '';
}

function normalizeSaudiMobile(value) {
  const compact = clean(value, 30)
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\s()-]/g, '');
  if (/^05\d{8}$/.test(compact)) return compact;
  if (/^5\d{8}$/.test(compact)) return '0' + compact;
  if (/^9665\d{8}$/.test(compact)) return '+' + compact;
  if (/^\+9665\d{8}$/.test(compact)) return compact;
  return '';
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
  }

  try {
    const body = readBody(req);
    if (clean(body.website, 200)) return sendJson(res, 202, { ok: true });

    const requestKind = body.request_kind === 'upgrade' ? 'upgrade' : 'activation';
    let entityName = clean(body.entity_name, 160);
    let entityType = clean(body.entity_type, 80);
    let entityCode = clean(body.entity_code, 40);
    let contactName = clean(body.contact_name, 120);
    const submittedPhone = clean(body.phone, 30);
    let phone = normalizeSaudiMobile(submittedPhone);
    let contactDetails = clean(body.contact_details, 300);
    let currentPlan = clean(body.current_plan, 80);
    const requestedPlan = normalizePlan(body.requested_plan);
    let context = null;

    if (requestKind === 'upgrade') {
      context = await authenticatedBusiness(req);
      entityName = context.entity.name;
      entityType = context.entity.entity_type || '';
      entityCode = context.entity.code;
      currentPlan = context.entity.plan_key;
      contactDetails = clean(context.user.email, 300);
    } else if (contactName || submittedPhone) {
      contactDetails = contactName && phone ? contactName + ' — ' + phone : '';
    }

    if (entityName.length < 2) {
      return sendJson(res, 400, { error: 'يرجى إدخال اسم المنشأة.', field: 'entity_name' });
    }
    if (!requestedPlan) {
      return sendJson(res, 400, { error: 'يرجى اختيار باقة صحيحة.', field: 'requested_plan' });
    }
    if (requestKind === 'upgrade' && requestedPlan === 'undecided') {
      return sendJson(res, 400, { error: 'يرجى اختيار الباقة المطلوبة للترقية.', field: 'requested_plan' });
    }
    if (requestKind === 'activation' && (contactName || submittedPhone)) {
      if (contactName.length < 2) {
        return sendJson(res, 400, { error: 'يرجى إدخال اسم المسؤول.', field: 'contact_name' });
      }
      if (!phone) {
        return sendJson(res, 400, { error: 'يرجى إدخال رقم جوال سعودي صحيح.', field: 'phone' });
      }
    } else if (requestKind === 'activation' && contactDetails.length < 6) {
      return sendJson(res, 400, { error: 'يرجى إدخال اسم المسؤول ورقم الجوال.', field: 'contact_details' });
    }

    const row = await insertRow('business_activation_requests', {
      request_kind: requestKind,
      entity_name: entityName,
      entity_type: entityType || null,
      entity_code: entityCode || null,
      contact_details: contactDetails || null,
      current_plan: currentPlan || null,
      requested_plan: requestedPlan,
      source: requestKind === 'upgrade' ? 'business_portal' : 'business_site',
      metadata: context ? { auth_user_id: context.user.id } : {}
    });

    const kindLabel = requestKind === 'upgrade' ? 'ترقية باقة' : 'تفعيل منشأة';
    const emailSubject = 'طلب ' + kindLabel + ' — ' + entityName;
    const notification = await createNotification(
      requestKind,
      row && row.id,
      emailSubject,
      { entity_code: entityCode, requested_plan: requestedPlan }
    );

    let emailSent = false;
    try {
      const providerId = await sendAlert(emailSubject,
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#172d3a">' +
        '<h2 style="color:#1b3a4b">طلب ' + escapeHtml(kindLabel) + ' من أعراف للأعمال</h2>' +
        '<p><b>المنشأة:</b> ' + escapeHtml(entityName) + '</p>' +
        '<p><b>نوع الكيان:</b> ' + escapeHtml(entityType || 'غير محدد') + '</p>' +
        (entityCode ? '<p><b>رمز المنشأة:</b> ' + escapeHtml(entityCode) + '</p>' : '') +
        (currentPlan ? '<p><b>الباقة الحالية:</b> ' + escapeHtml(PLAN_NAMES[currentPlan] || currentPlan) + '</p>' : '') +
        '<p><b>الباقة المطلوبة:</b> ' + escapeHtml(PLAN_NAMES[requestedPlan]) + '</p>' +
        '<p><b>بيانات التواصل:</b> ' + escapeHtml(contactDetails || 'من حساب المنشأة') + '</p>' +
        '<p style="color:#647985">تم حفظ الطلب في قاعدة بيانات أعراف للشركات.</p>' +
        '</div>'
      );
      emailSent = true;
      await finishNotification(notification, 'sent', providerId, null);
    } catch (emailError) {
      console.error('business-lead-email', emailError.details || emailError);
      await finishNotification(notification, 'failed', null, emailError.message);
    }

    return sendJson(res, 201, { ok: true, id: row && row.id, email_sent: emailSent });
  } catch (error) {
    console.error('business-lead-api', error);
    const response = errorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
