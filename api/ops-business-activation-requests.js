'use strict';

const {
  handleOpsOptions,
  sendJson,
  authenticatedOpsAdmin,
  selectRows
} = require('../server/business-api');
const {
  publicActivation,
  opsErrorResponse
} = require('../server/ops-activation');

module.exports = async function handler(req, res) {
  try {
    if (handleOpsOptions(req, res)) return;
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
    }

    const context = await authenticatedOpsAdmin(req, ['admin', 'manager', 'employee']);
    const rows = await selectRows('business_activation_requests', {
      select: '*',
      order: 'created_at.desc',
      limit: '250'
    });

    return sendJson(res, 200, {
      ok: true,
      can_decide: ['admin', 'manager'].includes(context.admin.admin_role),
      requests: rows.map(publicActivation)
    });
  } catch (error) {
    const response = opsErrorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
