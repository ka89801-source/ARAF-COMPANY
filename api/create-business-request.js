'use strict';

const {
  applyCors,
  handleOptions,
  sendJson,
  clean,
  escapeHtml,
  readBody,
  authenticatedBusiness,
  callBusinessRpc,
  createNotification,
  finishNotification,
  sendAlert,
  errorResponse
} = require('../server/business-api');

const SERVICES = {
  consult: 'استشارة قانونية',
  contracts: 'صياغة أو مراجعة عقد',
  letters: 'صياغة أو مراجعة خطاب أو إنذار',
  najiz: 'رفع طلب عبر ناجز',
  violations: 'اعتراض على مخالفة حكومية',
  governance: 'إعداد أو مراجعة عمل حوكمة',
  memos: 'إعداد مذكرة قانونية',
  risk_review: 'مراجعة قانونية شهرية',
  negotiation: 'حضور اجتماع تفاوضي عن بُعد',
  general: 'طلب قانوني آخر'
};

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
  }

  try {
    const body = readBody(req);
    const serviceKey = clean(body.service_key, 40);
    const subject = clean(body.subject, 180);
    const details = clean(body.details, 8000);
    const priority = ['normal', 'urgent'].includes(body.priority)
      ? body.priority
      : 'normal';
    const idempotencyKey = clean(body.idempotency_key, 80);
    const validIdempotencyKey =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey);

    if (!SERVICES[serviceKey] || subject.length < 3 || !validIdempotencyKey) {
      return sendJson(res, 400, { error: 'بيانات الطلب غير مكتملة.' });
    }

    const context = await authenticatedBusiness(req);
    const rpc = await callBusinessRpc('business_create_request', {
      p_service_key: serviceKey,
      p_subject: subject,
      p_details: details,
      p_priority: priority,
      p_idempotency_key: idempotencyKey
    }, context.token);

    if (!rpc.ok) {
      console.error('business-create-request-rpc', rpc.data);
      const message = clean(
        rpc.data && (rpc.data.message || rpc.data.details),
        300
      );
      return sendJson(res, rpc.status >= 400 && rpc.status < 500 ? 400 : 500, {
        error: message || 'تعذر حفظ الطلب.'
      });
    }

    const created = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const referenceId = created && created.id || null;
    const requestNumber = created && (created.request_number || created.request_no) || 'قيد الترقيم';
    const emailSubject = 'طلب خدمة جديد — ' + context.entity.name;
    const notification = await createNotification(
      'service_request',
      referenceId,
      emailSubject,
      {
        entity_id: context.entity.id,
        entity_code: context.entity.code,
        service_key: serviceKey,
        request_number: requestNumber,
        idempotency_key: idempotencyKey
      }
    );

    let emailSent = false;
    try {
      const providerId = await sendAlert(emailSubject,
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#172d3a">' +
        '<h2 style="color:#1b3a4b">طلب جديد من منصة أعراف للشركات</h2>' +
        '<p><b>المنشأة:</b> ' + escapeHtml(context.entity.name) + '</p>' +
        '<p><b>رمز المنشأة:</b> ' + escapeHtml(context.entity.code) + '</p>' +
        '<p><b>الباقة:</b> ' + escapeHtml(context.entity.plan_key) + '</p>' +
        '<p><b>الخدمة:</b> ' + escapeHtml(SERVICES[serviceKey]) + '</p>' +
        '<p><b>رقم الطلب:</b> ' + escapeHtml(requestNumber) + '</p>' +
        '<p><b>عنوان الطلب:</b> ' + escapeHtml(subject) + '</p>' +
        '<p><b>التفاصيل:</b><br>' + escapeHtml(details || 'لا توجد تفاصيل إضافية').replace(/\n/g, '<br>') + '</p>' +
        '<p style="color:#647985">تم حفظ الطلب في قاعدة بيانات أعراف للشركات.</p>' +
        '</div>'
      );
      emailSent = true;
      await finishNotification(notification, 'sent', providerId, null);
    } catch (emailError) {
      console.error('business-request-email', emailError.details || emailError);
      await finishNotification(notification, 'failed', null, emailError.message);
    }

    return sendJson(res, 201, {
      ok: true,
      request: created,
      email_sent: emailSent
    });
  } catch (error) {
    console.error('business-request-api', error);
    const response = errorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
