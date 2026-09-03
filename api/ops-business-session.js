'use strict';

const {
  handleOpsOptions,
  sendJson,
  authenticatedOpsAdmin,
  selectRows
} = require('../server/business-api');
const { opsErrorResponse } = require('../server/ops-activation');

module.exports = async function handler(req, res) {
  try {
    if (handleOpsOptions(req, res)) return;
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
    }

    const context = await authenticatedOpsAdmin(req, ['admin', 'manager', 'employee']);
    let employee = null;
    if (context.admin.employee_external_id) {
      const rows = await selectRows('employees', {
        select: 'id,full_name,email,phone,role,status',
        id: 'eq.' + context.admin.employee_external_id,
        limit: '1'
      });
      employee = rows[0] || null;
    }
    if (!employee && context.user.email) {
      const rows = await selectRows('employees', {
        select: 'id,full_name,email,phone,role,status',
        email: 'ilike.' + context.user.email,
        status: 'eq.active',
        limit: '1'
      });
      employee = rows[0] || null;
    }

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: context.user.id,
        email: context.user.email || ''
      },
      admin: {
        employee_id: context.admin.employee_external_id || (employee && employee.id) || null,
        display_name: context.admin.display_name || (employee && employee.full_name) || context.user.email,
        phone: employee && employee.phone || '',
        role: context.admin.admin_role,
        active: true
      }
    });
  } catch (error) {
    const response = opsErrorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
