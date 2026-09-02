'use strict';

const DEFAULT_SUPABASE_URL = 'https://yuoforvbxpwislmdrvvb.supabase.co';
const DEFAULT_ALERT_EMAIL = 'ka89801@gmail.com';
const DEFAULT_ALERT_FROM = 'Araf Business <notifications@araf.company>';

function applyCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function handleOptions(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function clean(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function alertRecipient() {
  return clean(process.env.BUSINESS_ALERT_EMAIL || DEFAULT_ALERT_EMAIL, 320).toLowerCase();
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.body) return {};
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

function config() {
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serverSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverSecretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not configured');
  }
  return { supabaseUrl, serverSecretKey };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = { message: raw };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

function serviceHeaders(extra) {
  const { serverSecretKey } = config();
  const headers = {
    apikey: serverSecretKey,
    'Content-Type': 'application/json'
  };
  if (!serverSecretKey.startsWith('sb_secret_')) {
    headers.Authorization = 'Bearer ' + serverSecretKey;
  }
  return Object.assign(headers, extra || {});
}

function bearerToken(req) {
  const value = clean(req.headers.authorization, 5000);
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function authenticatedBusiness(req) {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error('AUTH_REQUIRED');
    error.status = 401;
    throw error;
  }

  const { supabaseUrl, serverSecretKey } = config();
  const auth = await fetchJson(supabaseUrl + '/auth/v1/user', {
    headers: {
      apikey: serverSecretKey,
      Authorization: 'Bearer ' + token
    }
  });
  if (!auth.ok || !auth.data || !auth.data.id) {
    const error = new Error('INVALID_SESSION');
    error.status = 401;
    throw error;
  }

  const query = new URLSearchParams({
    select: 'id,code,name,entity_type,plan_key,subscription_status',
    auth_user_id: 'eq.' + auth.data.id,
    limit: '1'
  });
  const entityResult = await fetchJson(
    supabaseUrl + '/rest/v1/business_entities?' + query.toString(),
    { headers: serviceHeaders() }
  );
  const entity = Array.isArray(entityResult.data) ? entityResult.data[0] : null;
  if (!entityResult.ok || !entity || entity.subscription_status !== 'active') {
    const error = new Error('BUSINESS_ACCESS_DENIED');
    error.status = 403;
    throw error;
  }

  return { token, user: auth.data, entity };
}

async function callBusinessRpc(name, payload, userToken) {
  const { supabaseUrl, serverSecretKey } = config();
  return fetchJson(supabaseUrl + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      apikey: serverSecretKey,
      Authorization: 'Bearer ' + userToken,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
}

async function insertRow(table, row) {
  const { supabaseUrl } = config();
  const result = await fetchJson(supabaseUrl + '/rest/v1/' + table, {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row)
  });
  if (!result.ok) {
    const error = new Error('DATABASE_WRITE_FAILED');
    error.details = result.data;
    throw error;
  }
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function updateRow(table, id, patch) {
  const { supabaseUrl } = config();
  const query = new URLSearchParams({ id: 'eq.' + id });
  const result = await fetchJson(supabaseUrl + '/rest/v1/' + table + '?' + query.toString(), {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch)
  });
  if (!result.ok) throw new Error('DATABASE_UPDATE_FAILED');
}

async function createNotification(eventType, referenceId, subject, payload) {
  try {
    return await insertRow('business_email_notifications', {
      event_type: eventType,
      reference_id: referenceId || null,
      recipient: alertRecipient(),
      subject,
      status: 'pending',
      payload
    });
  } catch (error) {
    console.error('notification-audit-create', error.details || error);
    return null;
  }
}

async function finishNotification(notification, status, providerId, errorMessage) {
  if (!notification || !notification.id) return;
  try {
    await updateRow('business_email_notifications', notification.id, {
      status,
      provider_id: providerId || null,
      error_message: errorMessage ? clean(errorMessage, 1000) : null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('notification-audit-update', error);
  }
}

async function sendAlert(subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const response = await fetchJson('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.BUSINESS_ALERT_FROM || DEFAULT_ALERT_FROM,
      to: [alertRecipient()],
      subject,
      html
    })
  });
  if (!response.ok) {
    const error = new Error(
      response.data && (response.data.message || response.data.error) || 'EMAIL_SEND_FAILED'
    );
    error.details = response.data;
    throw error;
  }
  return response.data && response.data.id;
}

function errorResponse(error) {
  if (error && error.status === 401) {
    return { status: 401, body: { error: 'انتهت جلسة المنشأة. يرجى تسجيل الدخول مجددًا.' } };
  }
  if (error && error.status === 403) {
    return { status: 403, body: { error: 'لا يملك هذا الحساب صلاحية الوصول إلى منشأة نشطة.' } };
  }
  return { status: 500, body: { error: 'تعذر إتمام الطلب الآن. يرجى المحاولة مرة أخرى.' } };
}

module.exports = {
  applyCors,
  handleOptions,
  sendJson,
  clean,
  escapeHtml,
  readBody,
  authenticatedBusiness,
  callBusinessRpc,
  insertRow,
  createNotification,
  finishNotification,
  sendAlert,
  errorResponse
};
