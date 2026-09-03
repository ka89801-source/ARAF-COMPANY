'use strict';

const crypto = require('crypto');
const {
  clean,
  selectRows
} = require('./business-api');

const PLAN_NAMES = {
  asas: 'أعراف أساس',
  numu: 'أعراف نمو',
  plus: 'أعراف بلس'
};

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(clean(value, 80));
}

function normalizePlan(value) {
  const key = clean(value, 30).toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLAN_NAMES, key) ? key : '';
}

function normalizeEntityType(value) {
  const input = clean(value, 80);
  if (input === 'شركة') return 'شركة';
  if (input === 'مؤسسة') return 'مؤسسة';
  if (input === 'جمعية' || input === 'جمعية / كيان غير ربحي') return 'جمعية';
  if (input === 'كيان غير ربحي') return 'كيان غير ربحي';
  return 'أخرى';
}

function metadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.assign({}, value)
    : {};
}

function splitContact(row) {
  const details = clean(row && row.contact_details, 300);
  const parts = details.split(/\s+[—–-]\s+/);
  return {
    name: clean(row && row.contact_name, 120) || clean(parts[0], 120),
    phone: clean(row && row.contact_phone, 30) || clean(parts.slice(1).join(' — '), 30)
  };
}

function publicActivation(row) {
  const contact = splitContact(row || {});
  return {
    id: row.id,
    request_kind: row.request_kind,
    entity_name: row.entity_name,
    entity_type: row.entity_type,
    entity_code: row.entity_code,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_details: row.contact_details,
    current_plan: row.current_plan,
    requested_plan: row.requested_plan,
    status: row.status,
    source: row.source,
    metadata: metadata(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getActivationRequest(id) {
  if (!isUuid(id)) return null;
  const rows = await selectRows('business_activation_requests', {
    select: '*',
    id: 'eq.' + id,
    limit: '1'
  });
  return rows[0] || null;
}

function generatePin() {
  return String(crypto.randomInt(0, 100000000)).padStart(8, '0');
}

function isoDate(value) {
  const date = value ? new Date(value + 'T00:00:00Z') : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function cycleEnd(startDate) {
  const date = new Date(startDate + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function nextEntityCode() {
  const rows = await selectRows('business_entities', {
    select: 'code',
    order: 'created_at.desc',
    limit: '1000'
  });
  let highest = 1000;
  rows.forEach(row => {
    const match = clean(row.code, 40).toUpperCase().match(/^ARF-(\d{4,8})$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return 'ARF-' + String(highest + 1).padStart(4, '0');
}

function opsErrorResponse(error) {
  if (error && error.status === 401) {
    return { status: 401, body: { error: 'انتهت جلسة الإدارة. يرجى تسجيل الدخول مجددًا.' } };
  }
  if (error && error.status === 403) {
    return { status: 403, body: { error: 'هذا الحساب غير مخول بإدارة تفعيل المنشآت.' } };
  }
  if (error && error.status === 404) {
    return { status: 404, body: { error: 'طلب التفعيل غير موجود.' } };
  }
  if (error && error.status === 409) {
    return { status: 409, body: { error: error.publicMessage || 'سبق اتخاذ قرار بشأن هذا الطلب.' } };
  }
  console.error('ops-business-api', error && (error.details || error));
  return { status: 500, body: { error: 'تعذر إتمام الإجراء الآن. يرجى المحاولة مرة أخرى.' } };
}

module.exports = {
  PLAN_NAMES,
  isUuid,
  normalizePlan,
  normalizeEntityType,
  metadata,
  publicActivation,
  getActivationRequest,
  generatePin,
  isoDate,
  cycleEnd,
  nextEntityCode,
  opsErrorResponse
};
