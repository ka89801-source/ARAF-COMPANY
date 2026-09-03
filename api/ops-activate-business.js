'use strict';

const {
  handleOpsOptions,
  sendJson,
  clean,
  readBody,
  authenticatedOpsAdmin,
  selectRows,
  callServiceRpc,
  adminSupabase
} = require('../server/business-api');
const {
  PLAN_NAMES,
  isUuid,
  normalizePlan,
  normalizeEntityType,
  publicActivation,
  getActivationRequest,
  generatePin,
  isoDate,
  cycleEnd,
  nextEntityCode,
  opsErrorResponse
} = require('../server/ops-activation');

async function removeAuthUser(client, userId) {
  if (!client || !userId) return;
  try {
    await client.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error('activation-auth-rollback', error);
  }
}

module.exports = async function handler(req, res) {
  let createdUserId = null;
  let adminClient = null;
  let databaseCommitted = false;

  try {
    if (handleOpsOptions(req, res)) return;
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return sendJson(res, 405, { error: 'الطريقة غير مسموحة.' });
    }

    const context = await authenticatedOpsAdmin(req, ['admin', 'manager']);
    const body = readBody(req);
    const requestId = clean(body.id, 80);
    const planKey = normalizePlan(body.plan_key);
    const requestedCode = clean(body.entity_code, 40).toUpperCase();

    if (!isUuid(requestId) || !planKey) {
      return sendJson(res, 400, { error: 'يرجى اختيار طلب وباقة صحيحين.' });
    }
    if (requestedCode && !/^ARF-\d{4,8}$/.test(requestedCode)) {
      return sendJson(res, 400, { error: 'رمز المنشأة يجب أن يكون مثل ARF-1002.' });
    }

    const request = await getActivationRequest(requestId);
    if (!request) {
      const error = new Error('NOT_FOUND');
      error.status = 404;
      throw error;
    }
    if (request.request_kind !== 'activation') {
      return sendJson(res, 400, { error: 'هذا طلب ترقية وليس طلب تفعيل منشأة جديدة.' });
    }
    if (!['new', 'contacted'].includes(request.status)) {
      const error = new Error('INVALID_STATUS_TRANSITION');
      error.status = 409;
      error.publicMessage = request.status === 'activated'
        ? 'تم تفعيل هذه المنشأة سابقًا.'
        : 'هذا الطلب مغلق ولا يمكن تفعيله.';
      throw error;
    }

    const plans = await selectRows('business_plans', {
      select: 'plan_key,name,active',
      plan_key: 'eq.' + planKey,
      limit: '1'
    });
    if (!plans[0] || plans[0].active === false) {
      return sendJson(res, 400, { error: 'الباقة المختارة غير متاحة حاليًا.' });
    }

    const entityCode = requestedCode || await nextEntityCode();
    const existingEntities = await selectRows('business_entities', {
      select: 'id,code',
      code: 'eq.' + entityCode,
      limit: '1'
    });
    if (existingEntities.length) {
      return sendJson(res, 409, { error: 'رمز المنشأة مستخدم بالفعل. حدّث الطلب وحاول مجددًا.' });
    }

    const pin = generatePin();
    const authEmail = entityCode.toLowerCase() + '@business.araf.online';
    const startDate = isoDate(clean(body.subscription_start, 20)) || isoDate('');
    const endDate = cycleEnd(startDate);

    adminClient = adminSupabase();
    const authResult = await adminClient.auth.admin.createUser({
      email: authEmail,
      password: pin,
      email_confirm: true,
      user_metadata: {
        account_type: 'business_entity',
        entity_code: entityCode,
        entity_name: clean(request.entity_name, 160)
      }
    });
    if (authResult.error || !authResult.data || !authResult.data.user) {
      const error = new Error('AUTH_USER_CREATE_FAILED');
      error.details = authResult.error;
      throw error;
    }
    createdUserId = authResult.data.user.id;

    const commitResult = await callServiceRpc('business_commit_activation', {
      p_request_id: requestId,
      p_auth_user_id: createdUserId,
      p_entity_code: entityCode,
      p_plan_key: planKey,
      p_entity_type: normalizeEntityType(request.entity_type),
      p_subscription_start: startDate,
      p_cycle_end: endDate,
      p_actor_user_id: context.user.id,
      p_actor_name: context.admin.display_name
    });
    const committed = Array.isArray(commitResult) ? commitResult[0] : commitResult;
    if (!committed || !committed.entity || !committed.request) {
      throw new Error('INVALID_ACTIVATION_COMMIT_RESPONSE');
    }
    databaseCommitted = true;
    const entity = committed.entity;
    const updatedRequest = committed.request;

    return sendJson(res, 201, {
      ok: true,
      request: publicActivation(updatedRequest),
      entity: {
        id: entity.id,
        code: entityCode,
        name: entity.name,
        plan_key: planKey,
        plan_name: plans[0].name || PLAN_NAMES[planKey],
        subscription_status: 'active',
        current_cycle_start: startDate,
        current_cycle_end: endDate
      },
      credentials: {
        code: entityCode,
        pin
      }
    });
  } catch (error) {
    if (createdUserId && !databaseCommitted) {
      await removeAuthUser(adminClient, createdUserId);
    }

    const response = opsErrorResponse(error);
    return sendJson(res, response.status, response.body);
  }
};
