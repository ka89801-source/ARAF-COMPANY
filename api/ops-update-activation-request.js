'use strict';

const {
  handleOpsOptions,
  sendJson,
  clean,
  readBody,
  authenticatedOpsAdmin,
  patchRows
} = require('../server/business-api');
const {
  isUuid,
  metadata,
  publicActivation,
  getActivationRequest,
  opsErrorResponse
} = require('../server/ops-activation');

module.exports = async function handler(req, res) {
  try {
    if (handleOpsOptions(req, res)) return;
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
    }

    const context = await authenticatedOpsAdmin(req, ['admin', 'manager']);
    const body = readBody(req);
    const id = clean(body.id, 80);
    const action = clean(body.action, 30);
    const note = clean(body.note, 500);

    if (!isUuid(id) || !['contacted', 'closed'].includes(action)) {
      return sendJson(res, 400, { error: 'بيانات الإجراء غير صحيحة.' });
    }

    const request = await getActivationRequest(id);
    if (!request) {
      const error = new Error('NOT_FOUND');
      error.status = 404;
      throw error;
    }
    if (request.status === 'activated') {
      const error = new Error('ALREADY_ACTIVATED');
      error.status = 409;
      error.publicMessage = 'تم تفعيل هذا الطلب سابقًا ولا يمكن تغيير قراره.';
      throw error;
    }

    const allowed = action === 'contacted'
      ? ['new', 'contacted']
      : ['new', 'contacted', 'closed'];
    if (!allowed.includes(request.status)) {
      const error = new Error('INVALID_STATUS_TRANSITION');
      error.status = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const nextMetadata = metadata(request.metadata);
    nextMetadata[action + '_at'] = now;
    nextMetadata[action + '_by_user_id'] = context.user.id;
    nextMetadata[action + '_by_name'] = context.admin.display_name;
    if (note) nextMetadata[action + '_note'] = note;

    const rows = await patchRows(
      'business_activation_requests',
      { id: 'eq.' + id, status: 'eq.' + request.status },
      {
        status: action,
        metadata: nextMetadata,
        updated_at: now
      }
    );
    if (!rows.length) {
      const error = new Error('CONCURRENT_UPDATE');
      error.status = 409;
      error.publicMessage = 'تم تحديث الطلب من جلسة أخرى. حدّث الصفحة ثم حاول مجددًا.';
      throw error;
    }

    return sendJson(res, 200, {
      ok: true,
      request: publicActivation(rows[0])
    });
  } catch (error) {
    const response = opsErrorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
