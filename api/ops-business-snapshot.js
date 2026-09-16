'use strict';

const {
  handleOpsOptions,
  sendJson,
  authenticatedOpsAdmin,
  selectRows
} = require('../server/business-api');
const { opsErrorResponse } = require('../server/ops-activation');

async function safeSelect(table, params) {
  try {
    return await selectRows(table, params);
  } catch (error) {
    console.warn('ops-business-snapshot optional read failed:', table, error && (error.details || error.message || error));
    return [];
  }
}

module.exports = async function handler(req, res) {
  try {
    if (handleOpsOptions(req, res)) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
    }

    const context = await authenticatedOpsAdmin(req, ['admin', 'manager', 'employee']);

    const [entities, requests, usage, history, employees] = await Promise.all([
      selectRows('business_entities', {
        select: '*',
        order: 'created_at.desc'
      }),
      selectRows('business_requests', {
        select: '*',
        archived_at: 'is.null',
        order: 'created_at.desc'
      }),
      safeSelect('business_usage', {
        select: '*',
        reversed_at: 'is.null',
        order: 'counted_at.desc'
      }),
      safeSelect('business_request_history', {
        select: '*',
        order: 'created_at.desc'
      }),
      safeSelect('employees', {
        select: 'id,full_name,role,status',
        status: 'eq.active',
        order: 'full_name.asc'
      })
    ]);

    return sendJson(res, 200, {
      ok: true,
      generated_at: new Date().toISOString(),
      viewer: {
        id: context.user.id,
        email: context.user.email || '',
        role: context.admin.admin_role
      },
      entities,
      requests,
      usage,
      history,
      employees
    });
  } catch (error) {
    const response = opsErrorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
