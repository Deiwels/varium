// ============================================================
// Vurium SaaS — Multi-Tenant Backend
// Cloud Run: https://vuriumbook-api-431945333485.us-central1.run.app
// Based on Element CRM, adapted for multi-tenant SaaS
// ============================================================
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const http2 = require('http2');
const { z } = require('zod');
const { Firestore } = require('@google-cloud/firestore');

const app = express();
app.set('trust proxy', true);
const db = new Firestore();
const PORT = process.env.PORT || 8080;

// ============================================================
// CONFIG
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_TTL = '24h';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

// ============================================================
// MIDDLEWARE
// ============================================================
const ALLOWED_ORIGINS = [
  'https://vurium.com',
  'https://www.vurium.com',
  'https://vuriumbook.com',
  'https://www.vuriumbook.com',
  'https://varium.vercel.app',
  'https://varium-murex.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token', 'Cookie'],
  maxAge: 86400,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ============================================================
// HELPERS
// ============================================================
function safeStr(x) { return String(x ?? '').trim(); }
function toIso(d) { return new Date(d).toISOString(); }
function parseIso(s) { const d = new Date(String(s || '')); return Number.isNaN(d.getTime()) ? null : d; }
function normPhone(x) { const digits = String(x || '').replace(/[^\d]/g, ''); if (!digits) return ''; return digits.length > 15 ? digits.slice(-15) : digits; }

function sanitizeHtml(str) {
  if (str == null) return str;
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(plain).digest('hex');
  return salt + ':' + hash;
}

function checkPassword(plain, stored) {
  try {
    const [salt, hash] = stored.split(':');
    return crypto.createHmac('sha256', salt).update(plain).digest('hex') === hash;
  } catch { return false; }
}

// ============================================================
// SLUG SYSTEM — human-readable booking URLs
// ============================================================
function slugify(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s]+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 60) || 'business';
}

async function generateUniqueSlug(baseName) {
  const base = slugify(baseName);
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db.collection('slugs').doc(slug).get();
    if (!existing.exists) return slug;
    attempt++;
    slug = `${base}-${attempt + 1}`;
    if (attempt > 100) return `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }
}

async function registerSlug(slug, workspaceId) {
  await db.collection('slugs').doc(slug).set({ workspace_id: workspaceId, created_at: toIso(new Date()) });
}

async function resolveSlug(slugOrId) {
  // Try slug first
  const slugDoc = await db.collection('slugs').doc(slugOrId).get();
  if (slugDoc.exists) return slugDoc.data().workspace_id;
  // Fallback: try as workspace ID directly
  const wsDoc = await db.collection('workspaces').doc(slugOrId).get();
  if (wsDoc.exists) return slugOrId;
  return null;
}

// ============================================================
// PLAN FEATURES — single source of truth
// plan_type: individual | salon | custom
// billing_status: trialing | active | past_due | canceled | inactive
// effective_plan: during trial → purchased plan (minimum salon, 14-day trial)
// ============================================================
const PLAN_FEATURES = {
  individual: {
    member_limit: 1, staff_limit: 0,
    features: ['calendar', 'clients', 'payments', 'settings', 'booking_page', 'analytics_basic'],
  },
  salon: {
    member_limit: 10, staff_limit: 10,
    features: ['calendar', 'clients', 'payments', 'settings', 'booking_page', 'team_mgmt', 'waitlist', 'messages', 'portfolio', 'cash_register', 'membership', 'attendance', 'analytics_advanced'],
  },
  custom: {
    member_limit: null, staff_limit: null, is_unlimited: true,
    features: ['calendar', 'clients', 'payments', 'settings', 'booking_page', 'team_mgmt', 'waitlist', 'messages', 'portfolio', 'cash_register', 'membership', 'attendance', 'analytics_advanced', 'expenses', 'payroll', 'multi_location', 'api_access'],
  },
};

function getEffectivePlan(wsData) {
  const planType = wsData?.plan_type || wsData?.plan || 'individual';
  const billingStatus = wsData?.billing_status || wsData?.subscription_status || 'inactive';

  // During active trial → give access to purchased plan (minimum salon)
  if (billingStatus === 'trialing') {
    const trialEnd = wsData?.trial_ends_at ? new Date(wsData.trial_ends_at) : null;
    if (trialEnd && trialEnd > new Date()) {
      const planRank = { individual: 1, salon: 2, custom: 3 };
      return (planRank[planType] || 0) >= (planRank.salon || 2) ? planType : 'salon';
    }
  }

  // Active subscription → give the plan they paid for
  if (billingStatus === 'active') {
    // Map legacy plan names
    if (planType === 'starter' || planType === 'free' || planType === 'trial') return 'individual';
    if (planType === 'pro') return 'salon';
    if (planType === 'enterprise') return 'custom';
    if (['individual', 'salon', 'custom'].includes(planType)) return planType;
    return 'individual';
  }

  // No active subscription / payment failed / canceled / expired → individual (free tier)
  return 'individual';
}

function getPlanDef(effectivePlan) {
  return PLAN_FEATURES[effectivePlan] || PLAN_FEATURES.individual;
}

function requirePlanFeature(...featureKeys) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const wsDoc = await req.wsDoc().get();
      const wsData = wsDoc.exists ? wsDoc.data() : {};
      const effectivePlan = getEffectivePlan(wsData);
      const planDef = getPlanDef(effectivePlan);
      const missing = featureKeys.filter(f => !planDef.features.includes(f));
      if (missing.length > 0) {
        return res.status(403).json({
          error: 'This feature requires a higher plan. Upgrade to unlock it.',
          code: 'PLAN_UPGRADE_REQUIRED',
          required_features: missing,
          current_plan: wsData.plan_type || 'individual',
          effective_plan: effectivePlan,
        });
      }
      req.effectivePlan = effectivePlan;
      req.planDef = planDef;
      next();
    } catch (e) { next(e); }
  };
}

function getClientIp(req) {
  return safeStr(
    (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.headers['x-real-ip'] || req.ip || 'unknown'
  ) || 'unknown';
}

// ============================================================
// PHONE ENCRYPTION (AES-256-GCM)
// ============================================================
function getPhoneEncryptionKey() {
  const key = process.env.PHONE_ENCRYPTION_KEY || '';
  if (!key) return null;
  return Buffer.from(key, 'hex');
}

function encryptPhone(phone) {
  const key = getPhoneEncryptionKey();
  if (!key || !phone) return phone;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'enc:' + iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + tag.toString('hex');
  } catch { return phone; }
}

function decryptPhone(value) {
  if (!value || !String(value).startsWith('enc:')) return value;
  const key = getPhoneEncryptionKey();
  if (!key) return value;
  try {
    const parts = value.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return '****'; }
}

function phoneForRole(encryptedPhone, role) {
  if (!encryptedPhone) return null;
  if (role === 'owner') return decryptPhone(encryptedPhone);
  if (role === 'admin') return decryptPhone(encryptedPhone);
  const plain = decryptPhone(encryptedPhone);
  if (!plain || plain.length < 4) return '****';
  return '****' + plain.slice(-4);
}

// ============================================================
// TELNYX SMS
// ============================================================
function telnyxCredentials() {
  return {
    apiKey: safeStr(process.env.TELNYX_API_KEY),
    from: safeStr(process.env.TELNYX_FROM),
  };
}

function formatPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return null;
}

function sendSms(to, body) {
  const { apiKey, from } = telnyxCredentials();
  if (!apiKey || !from) { console.warn('Telnyx not configured'); return Promise.resolve(null); }
  const toFormatted = formatPhone(to);
  if (!toFormatted) { console.warn('sendSms: invalid phone', to); return Promise.resolve(null); }
  const payload = JSON.stringify({ from, to: toFormatted, text: body });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telnyx.com',
      path: '/v2/messages',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(payload) },
    }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { console.warn('sendSms error:', e?.message); resolve(null); });
    req.write(payload);
    req.end();
  });
}



// ─── Email via Resend ─────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM_DOMAIN = 'noreply@vurium.com';

function sendEmail(to, subject, html, fromName) {
  if (!RESEND_API_KEY) { console.warn('Resend not configured'); return Promise.resolve(null); }
  if (!to) return Promise.resolve(null);
  const from = `${fromName || 'VuriumBook'} <${EMAIL_FROM_DOMAIN}>`;
  const payload = JSON.stringify({ from, to: [to], subject, html });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Length': Buffer.byteLength(payload) },
    }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', (e) => { console.warn('sendEmail error:', e?.message); resolve(null); });
    req.write(payload);
    req.end();
  });
}

const EMAIL_THEMES = {
  modern:       { bg: '#010101', card: '#0d0d0d', border: 'rgba(255,255,255,.08)', text: '#e8e8ed', muted: 'rgba(255,255,255,.5)', accent: 'rgba(130,150,220,.7)', footer: 'rgba(255,255,255,.15)' },
  classic:      { bg: '#f5f5f5', card: '#ffffff', border: 'rgba(0,0,0,.08)', text: '#1a1a1a', muted: 'rgba(0,0,0,.5)', accent: '#333', footer: 'rgba(0,0,0,.2)' },
  bold:         { bg: '#080808', card: '#111111', border: 'rgba(255,255,255,.1)', text: '#ffffff', muted: 'rgba(255,255,255,.55)', accent: '#fff', footer: 'rgba(255,255,255,.18)' },
  'dark-luxury': { bg: '#0c0a08', card: '#12100e', border: 'rgba(200,170,120,.12)', text: '#e8dcc8', muted: 'rgba(200,170,120,.5)', accent: '#c8a87a', footer: 'rgba(200,170,120,.2)' },
  colorful:     { bg: '#fafafa', card: '#ffffff', border: 'rgba(99,102,241,.12)', text: '#2a2a2a', muted: 'rgba(0,0,0,.45)', accent: '#6366f1', footer: 'rgba(99,102,241,.3)' },
  custom:       { bg: '#000000', card: '#0d0d0d', border: 'rgba(255,255,255,.08)', text: '#e9e9e9', muted: 'rgba(255,255,255,.5)', accent: '#0a84ff', footer: 'rgba(255,255,255,.15)' },
};

function vuriumEmailTemplate(title, bodyHtml, shopName, logoUrl, template) {
  const displayName = shopName || 'VuriumBook';
  const t = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
  const isLight = ['classic', 'colorful'].includes(template);
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" width="40" height="40" style="border-radius:10px;display:block;margin:0 auto;" alt="${displayName}">`
    : `<div style="width:48px;height:48px;margin:0 auto;border-radius:14px;background:${isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'};border:1px solid ${t.border};text-align:center;line-height:48px;font-size:22px;font-weight:700;color:${t.muted};">${(displayName || 'V')[0].toUpperCase()}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${t.bg};font-family:'Inter',Helvetica,Arial,sans-serif;color:${t.text};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:480px;background:${t.card};border:1px solid ${t.border};border-radius:20px;overflow:hidden;">
<tr><td style="padding:32px 28px 24px;text-align:center;">
<div style="margin-bottom:16px;">
${logoHtml}
</div>
<div style="font-size:13px;font-weight:500;color:${t.muted};letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;">${displayName}</div>
<h1 style="margin:0;font-size:22px;font-weight:600;color:${t.text};letter-spacing:-.02em;">${title}</h1>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:14px;line-height:1.7;color:${t.muted};">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${t.border};text-align:center;">
<a href="https://vurium.com" style="font-size:11px;color:${t.footer};text-decoration:none;">Powered by VuriumBook</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function scheduleReminders(wsCol, bookingId, booking, timeZone, shopName) {
  try {
    const startAt = parseIso(booking.start_at);
    if (!startAt) return;
    const phone = booking.client_phone || booking.phone_norm;
    if (!phone) return;
    const clientName = booking.client_name || 'Client';
    const barberName = booking.barber_name || 'your barber';
    const prefix = shopName ? `${shopName}: ` : '';
    const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || 'America/Chicago' });
    const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timeZone || 'America/Chicago' });
    // 24h reminder
    const remind24 = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    if (remind24 > new Date()) {
      await wsCol('sms_reminders').add({ booking_id: bookingId, phone, type: '24h', send_at: toIso(remind24), sent: false, message: `${prefix}Reminder: Your appointment with ${barberName} is tomorrow ${dateStr} at ${timeStr}. Reply STOP to unsubscribe.`, created_at: toIso(new Date()) });
    }
    // 2h reminder
    const remind2 = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
    if (remind2 > new Date()) {
      await wsCol('sms_reminders').add({ booking_id: bookingId, phone, type: '2h', send_at: toIso(remind2), sent: false, message: `${prefix}Reminder: Your appointment with ${barberName} is in 2 hours at ${timeStr}. Reply STOP to unsubscribe.`, created_at: toIso(new Date()) });
    }
  } catch (e) { console.warn('scheduleReminders error:', e?.message); }
}

// ============================================================
// APNs PUSH NOTIFICATIONS
// ============================================================
let _apnsJwt = null;
let _apnsJwtTime = 0;

function getApnsJwt() {
  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  const keyPath = process.env.APNS_KEY_PATH || '';
  if (!keyId || !teamId || !keyPath) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_apnsJwt && now - _apnsJwtTime < 3000) return _apnsJwt;
  try {
    const fs = require('fs');
    const key = fs.readFileSync(keyPath, 'utf8');
    _apnsJwt = jwt.sign({}, key, { algorithm: 'ES256', keyid: keyId, issuer: teamId, expiresIn: '1h' });
    _apnsJwtTime = now;
    return _apnsJwt;
  } catch (e) { console.warn('getApnsJwt error:', e?.message); return null; }
}

function sendApnsPush(deviceToken, title, body, data = {}, bundleId = 'com.vuriumbook.app') {
  const apnsJwt = getApnsJwt();
  if (!apnsJwt || !deviceToken) return Promise.resolve(null);
  const host = (process.env.APNS_ENV || 'production') === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  return new Promise((resolve) => {
    try {
      const client = http2.connect(`https://${host}`);
      const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default', 'mutable-content': 1 }, ...data });
      const headers = { ':method': 'POST', ':path': `/3/device/${deviceToken}`, 'authorization': `bearer ${apnsJwt}`, 'apns-topic': bundleId, 'apns-push-type': 'alert', 'apns-priority': '10' };
      const req = client.request(headers);
      let respData = '';
      req.on('data', c => respData += c);
      req.on('end', () => { client.close(); resolve(respData); });
      req.on('error', () => { client.close(); resolve(null); });
      req.write(payload);
      req.end();
      setTimeout(() => { try { client.close(); } catch {} resolve(null); }, 10000);
    } catch { resolve(null); }
  });
}

async function getCrmDeviceTokens(wsCol, userId) {
  try {
    const snap = await wsCol('crm_push_tokens').where('user_id', '==', userId).get();
    return snap.docs.map(d => d.data().device_token).filter(Boolean);
  } catch { return []; }
}

async function sendCrmPush(wsCol, userId, title, body, data = {}) {
  const tokens = await getCrmDeviceTokens(wsCol, userId);
  for (const t of tokens) sendApnsPush(t, title, body, data).catch(() => {});
}

async function sendCrmPushToRoles(wsCol, roles, title, body, data = {}) {
  try {
    const snap = await wsCol('crm_push_tokens').get();
    for (const d of snap.docs) {
      const td = d.data();
      if (roles.includes(td.role)) sendApnsPush(td.device_token, title, body, data).catch(() => {});
    }
  } catch {}
}

async function sendCrmPushToBarber(wsCol, barberId, title, body, data = {}) {
  try {
    const snap = await wsCol('crm_push_tokens').where('barber_id', '==', barberId).get();
    for (const d of snap.docs) sendApnsPush(d.data().device_token, title, body, data).catch(() => {});
  } catch {}
}

async function sendCrmPushToStaff(wsCol, barberId, title, body, data = {}) {
  sendCrmPushToRoles(wsCol, ['owner', 'admin'], title, body, data).catch(() => {});
  if (barberId) sendCrmPushToBarber(wsCol, barberId, title, body, data).catch(() => {});
}

// ============================================================
// SQUARE PAYMENT HELPERS
// ============================================================
const SQUARE_VERSION = process.env.SQUARE_VERSION || '2026-01-22';
const SQUARE_BASE = (process.env.SQUARE_ENV || 'production').toLowerCase() === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
const SQUARE_TIMEOUT_MS = Number(process.env.SQUARE_TIMEOUT_MS || 15000);
const SQUARE_APP_ID = process.env.SQUARE_APP_ID || '';
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET || '';

async function getSquareToken(wsCol) {
  try {
    const doc = await wsCol('settings').doc('square_oauth').get();
    if (doc.exists) {
      const data = doc.data();
      if (data.access_token) {
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
          const refreshed = await refreshSquareToken(wsCol, data.refresh_token);
          if (refreshed) return refreshed;
        }
        return data.access_token;
      }
    }
  } catch (e) { console.error('getSquareToken error:', e.message); }
  return process.env.SQUARE_TOKEN || '';
}

async function refreshSquareToken(wsCol, refreshToken) {
  if (!refreshToken || !SQUARE_APP_SECRET) return null;
  try {
    const r = await fetch(`${SQUARE_BASE}/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SQUARE_APP_ID, client_secret: SQUARE_APP_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    const data = await r.json();
    if (r.ok && data.access_token) {
      await wsCol('settings').doc('square_oauth').set({
        access_token: data.access_token, refresh_token: data.refresh_token || refreshToken,
        expires_at: data.expires_at || null, token_type: data.token_type || 'bearer', updated_at: toIso(new Date()),
      }, { merge: true });
      return data.access_token;
    }
  } catch (e) { console.error('Square token refresh error:', e.message); }
  return null;
}

async function squareHeaders(wsCol, { hasBody = false } = {}) {
  const token = await getSquareToken(wsCol);
  if (!token) throw new Error('Square not connected');
  return { 'Authorization': `Bearer ${token}`, 'Square-Version': SQUARE_VERSION, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) };
}

async function squareFetch(path, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SQUARE_TIMEOUT_MS);
  try { return await fetch(`${SQUARE_BASE}${path}`, { ...options, signal: controller.signal }); }
  finally { clearTimeout(t); }
}

// ============================================================
// GEOFENCE / HAVERSINE
// ============================================================
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60000); }
function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }

// ============================================================
// PERMISSIONS
// ============================================================
const PERMISSIONS = {
  owner: {
    canViewAll: true, canViewPayroll: true, canViewSettings: true,
    canViewPayments: true, canManageBarbers: true, canManageServices: true,
    canManageClients: true, canViewAllBookings: true, canManageBookings: true,
    canChangePassword: true, canManageUsers: true,
  },
  admin: {
    canViewAll: true, canViewPayroll: false, canViewSettings: false,
    canViewPayments: true, canManageBarbers: false, canManageServices: false,
    canManageClients: true, canViewAllBookings: true, canManageBookings: true,
    canChangePassword: true, canManageUsers: false,
  },
  barber: {
    canViewAll: false, canViewPayroll: false, canViewSettings: false,
    canViewPayments: false, canManageBarbers: false, canManageServices: false,
    canManageClients: false, canViewAllBookings: false, canManageBookings: true,
    canChangePassword: true, canManageUsers: false,
  },
  student: {
    canViewAll: false, canViewPayroll: false, canViewSettings: false,
    canViewPayments: false, canManageBarbers: false, canManageServices: false,
    canManageClients: false, canViewAllBookings: false, canManageBookings: false,
    canChangePassword: true, canManageUsers: false, canViewMentorBookings: true,
  },
};

function hasPermission(session, perm) {
  if (!session?.role) return false;
  return !!PERMISSIONS[session.role]?.[perm];
}

// ============================================================
// ZOD SCHEMAS
// ============================================================
const validate = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { ok: false, error: messages };
  }
  return { ok: true, data: result.data };
};

const SignupSchema = z.object({
  workspace_name: z.string().min(2).max(120).trim(),
  username: z.string().min(2).max(80).trim(),
  password: z.string().min(8).max(200),
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  timezone: z.string().max(60).optional(),
});

const LoginSchema = z.object({
  workspace_id: z.string().min(1, 'required').max(80),
  username: z.string().min(1, 'required').max(80).trim(),
  password: z.string().min(1, 'required').max(200),
});

const BookingCreateSchema = z.object({
  client_name: z.string().min(1).max(120).trim().optional(),
  client_phone: z.string().max(30).optional(),
  client_email: z.string().email().max(254).optional(),
  barber_id: z.string().min(1, 'barber_id required').max(80),
  barber_name: z.string().max(120).optional(),
  service_id: z.string().max(500).optional(),
  service_ids: z.array(z.string().max(100)).max(10).optional(),
  service_name: z.string().max(500).optional(),
  start_at: z.string().min(1, 'start_at required').refine(s => !isNaN(Date.parse(s)), 'invalid ISO date'),
  end_at: z.string().optional().refine(s => !s || !isNaN(Date.parse(s)), 'invalid ISO date'),
  duration_minutes: z.number().int().min(1).max(480).optional(),
  status: z.enum(['booked', 'confirmed', 'arrived', 'cancelled', 'noshow', 'completed', 'done']).optional(),
  source: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  customer_note: z.string().max(1000).optional(),
  paid: z.boolean().optional(),
  customer_id: z.string().max(80).optional(),
  sms_consent: z.boolean().optional(),
});

const BookingPatchSchema = BookingCreateSchema.partial().extend({
  payment_status: z.enum(['paid', 'unpaid']).optional(),
  payment_method: z.string().max(40).optional(),
  payment_id: z.string().max(200).optional(),
  tip: z.number().min(0).optional(),
  tip_amount: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
  service_amount: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  fee_amount: z.number().min(0).optional(),
});

const ClientCreateSchema = z.object({
  name: z.string().min(1, 'name required').max(120).trim(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const ClientPatchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  status: z.string().max(40).optional(),
  preferred_barber: z.string().max(80).optional(),
  tags: z.array(z.string().max(50)).optional(),
  photo_url: z.string().max(5000).optional().or(z.literal('')),
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'required'),
  new_password: z.string().min(8, 'min 8 characters').max(200),
});

const UserCreateSchema = z.object({
  username: z.string().min(2).max(80).trim(),
  password: z.string().min(8).max(200),
  role: z.enum(['owner', 'admin', 'barber', 'student']).optional().default('barber'),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254).optional(),
  barber_id: z.string().max(80).optional(),
  mentor_barber_ids: z.array(z.string().max(80)).optional(),
  phone: z.string().max(30).optional(),
});

const NotificationPrefsSchema = z.object({
  push_booking_confirm: z.boolean().optional(),
  push_reminder_24h: z.boolean().optional(),
  push_reminder_2h: z.boolean().optional(),
  push_reschedule: z.boolean().optional(),
  push_cancel: z.boolean().optional(),
  push_waitlist: z.boolean().optional(),
  push_arrived: z.boolean().optional(),
  push_chat_messages: z.boolean().optional(),
}).optional();

const UserPatchSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  role: z.enum(['owner', 'admin', 'barber', 'student']).optional(),
  active: z.boolean().optional(),
  barber_id: z.string().max(80).optional(),
  password: z.string().min(8).max(200).optional(),
  mentor_barber_ids: z.array(z.string().max(80)).optional(),
  phone: z.string().max(30).optional(),
  photo_url: z.string().max(500000).optional().or(z.literal('')),
  schedule: z.array(z.object({ enabled: z.boolean(), startMin: z.number(), endMin: z.number() })).optional(),
  notification_prefs: NotificationPrefsSchema,
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function getTokenFromReq(req) {
  const cookie = req.cookies?.vuriumbook_token;
  if (cookie) return cookie;
  const auth = safeStr(req.headers['authorization'] || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const xauth = safeStr(req.headers['x-auth-token'] || '');
  if (xauth) return xauth;
  return '';
}

function authenticate(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) { req.user = null; return next(); }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Resolve workspace — sets req.ws as Firestore workspace subcollection helper
function resolveWorkspace(req, res, next) {
  if (!req.user?.workspace_id) return res.status(400).json({ error: 'No workspace context' });
  const wsId = req.user.workspace_id;
  req.wsId = wsId;
  req.ws = (collection) => db.collection('workspaces').doc(wsId).collection(collection);
  req.wsDoc = () => db.collection('workspaces').doc(wsId);
  next();
}

// ============================================================
// SQUARE OAUTH CALLBACK (before auth middleware — no auth needed)
// ============================================================
app.get('/api/square/oauth/callback', async (req, res) => {
  try {
    const code = safeStr(req.query?.code || '');
    const state = safeStr(req.query?.state || '');
    if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });
    // State contains workspace_id
    const wsId = state;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/square/oauth/callback`;
    const r = await fetch(`${SQUARE_BASE}/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SQUARE_APP_ID, client_secret: SQUARE_APP_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token) {
      const errMsg = data?.message || data?.errors?.[0]?.detail || data?.error || 'OAuth failed';
      const frontendUrl = process.env.FRONTEND_URL || 'https://vurium.com';
      return res.redirect(`${frontendUrl}/settings?tab=square&square=error&msg=${encodeURIComponent(errMsg)}`);
    }
    await wsCol('settings').doc('square_oauth').set({
      access_token: data.access_token, refresh_token: data.refresh_token || null,
      expires_at: data.expires_at || null, merchant_id: data.merchant_id || null,
      token_type: data.token_type || 'bearer', connected_at: toIso(new Date()), updated_at: toIso(new Date()),
    });
    const frontendUrl = process.env.FRONTEND_URL || 'https://vurium.com';
    res.redirect(`${frontendUrl}/settings?tab=square&square=connected`);
  } catch (e) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://vurium.com';
    res.redirect(`${frontendUrl}/settings?tab=square&square=error&msg=${encodeURIComponent(e?.message || 'Unknown error')}`);
  }
});

// ============================================================
// SQUARE WEBHOOK (before auth middleware — uses signature verification)
// ============================================================
app.post('/api/webhooks/square', async (req, res) => {
  try {
    const event = req.body;
    if (!event?.type) return res.json({ ok: true });
    // Find workspace by merchant_id
    if (event.type === 'terminal.checkout.updated') {
      const checkout = event.data?.object?.checkout;
      if (!checkout?.id) return res.json({ ok: true });
      // Search all workspaces for this checkout
      const wsSnap = await db.collection('workspaces').get();
      for (const ws of wsSnap.docs) {
        const wsCol = (col) => db.collection('workspaces').doc(ws.id).collection(col);
        const prSnap = await wsCol('payment_requests').where('checkout_id', '==', checkout.id).limit(1).get();
        if (!prSnap.empty) {
          const prDoc = prSnap.docs[0];
          const status = checkout.status || 'PENDING';
          const patch = { status: status.toLowerCase(), updated_at: toIso(new Date()) };
          if (checkout.payment_ids?.length) patch.payment_id = checkout.payment_ids[0];
          if (status === 'COMPLETED') {
            patch.completed_at = toIso(new Date());
            const tipCents = checkout.tip_money?.amount || 0;
            patch.tip_cents = tipCents;
            const totalCents = checkout.amount_money?.amount || 0;
            // Update booking
            const prData = prDoc.data();
            if (prData.booking_id) {
              const bPatch = {
                payment_status: 'paid', paid: true, payment_method: 'terminal',
                tip: tipCents / 100, tip_amount: tipCents / 100,
                amount: totalCents / 100,
                updated_at: toIso(new Date()),
              };
              if (checkout.payment_ids?.length) bPatch.payment_id = checkout.payment_ids[0];
              // Preserve service_amount/tax/fees from original payment request for payroll
              if (prData.service_amount) bPatch.service_amount = prData.service_amount;
              if (prData.tax_amount) bPatch.tax_amount = prData.tax_amount;
              if (prData.fee_amount) bPatch.fee_amount = prData.fee_amount;
              await wsCol('bookings').doc(prData.booking_id).update(bPatch).catch(() => {});
            }
          }
          await prDoc.ref.update(patch);
          break;
        }
      }
    }
    res.json({ ok: true });
  } catch (e) { console.error('Square webhook error:', e); res.json({ ok: true }); }
});

// ─── Password Reset (public — no auth) ────────────────────────────────────────
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const email = safeStr(req.body?.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });
    // Find user across all workspaces by username (owners) or email field (staff)
    let foundUser = null, foundWsId = null, foundUserId = null;
    const wsSnap = await db.collection('workspaces').get();
    for (const ws of wsSnap.docs) {
      // First try username == email (owner accounts)
      const byUsername = await ws.ref.collection('users')
        .where('username', '==', email).where('active', '==', true).limit(1).get();
      if (!byUsername.empty) {
        foundUser = byUsername.docs[0].data();
        foundWsId = ws.id;
        foundUserId = byUsername.docs[0].id;
        break;
      }
      // Then try email field (staff accounts)
      const byEmail = await ws.ref.collection('users')
        .where('email', '==', email).where('active', '==', true).limit(1).get();
      if (!byEmail.empty) {
        foundUser = byEmail.docs[0].data();
        foundWsId = ws.id;
        foundUserId = byEmail.docs[0].id;
        break;
      }
    }
    // Always return success (don't reveal if email exists)
    if (!foundUser) return res.json({ ok: true });
    // Generate reset token (expires in 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('workspaces').doc(foundWsId).collection('users').doc(foundUserId).update({
      reset_token: token,
      reset_token_expires: toIso(new Date(Date.now() + 3600000)),
    });
    const resetUrl = `https://vurium.com/reset-password?token=${token}&ws=${foundWsId}&uid=${foundUserId}`;
    sendEmail(email, 'Reset Your Password', vuriumEmailTemplate('Reset Your Password', `
      <p>We received a request to reset your password.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#e8e8ed;text-decoration:none;font-weight:600;font-size:14px;">Reset Password</a>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,.3);">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `)).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, ws, uid, password } = req.body || {};
    if (!token || !ws || !uid || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain a letter and a number' });
    const userRef = db.collection('workspaces').doc(ws).collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Invalid reset link' });
    const data = userDoc.data();
    if (data.reset_token !== token) return res.status(400).json({ error: 'Invalid or expired token' });
    if (data.reset_token_expires && new Date(data.reset_token_expires) < new Date()) return res.status(400).json({ error: 'Token expired' });
    await userRef.update({
      password_hash: hashPassword(password),
      reset_token: null,
      reset_token_expires: null,
      updated_at: toIso(new Date()),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Apply auth + workspace for all /api/ routes
app.use('/api', authenticate, requireAuth, resolveWorkspace);

// Apply only authenticate for /public/ routes (no auth required)
app.use('/public', authenticate);

// ============================================================
// RATE LIMITING
// ============================================================
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15;
const RATE_LIMIT_BLOCK = 15;

async function checkRateLimit(ip) {
  const key = `ratelimit_login_${String(ip || 'unknown').replace(/[^a-zA-Z0-9._:-]/g, '_')}`;
  const ref = db.collection('rate_limits').doc(key);
  const now = Date.now();
  const winMs = RATE_LIMIT_WINDOW * 60 * 1000;
  const blkMs = RATE_LIMIT_BLOCK * 60 * 1000;
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;
  if (data?.blocked_until && now < data.blocked_until) {
    return { allowed: false, retryAfter: Math.ceil((data.blocked_until - now) / 1000) };
  }
  if (!data || now - (data.first_attempt || 0) > winMs) {
    await ref.set({ ip, attempts: 1, first_attempt: now, last_attempt: now, blocked_until: null });
    return { allowed: true };
  }
  const newAttempts = (data.attempts || 0) + 1;
  if (newAttempts >= RATE_LIMIT_MAX) {
    await ref.set({ ip, attempts: newAttempts, first_attempt: data.first_attempt, last_attempt: now, blocked_until: now + blkMs });
    return { allowed: false, retryAfter: RATE_LIMIT_BLOCK * 60 };
  }
  await ref.update({ attempts: newAttempts, last_attempt: now });
  return { allowed: true };
}

async function resetRateLimit(ip) {
  const key = `ratelimit_login_${String(ip || 'unknown').replace(/[^a-zA-Z0-9._:-]/g, '_')}`;
  await db.collection('rate_limits').doc(key).delete().catch(() => {});
}

// ============================================================
// AUDIT LOG
// ============================================================
async function writeAuditLog(wsId, { action, resource_id, data, req }) {
  try {
    await db.collection('workspaces').doc(wsId).collection('audit_logs').add({
      action: safeStr(action),
      resource_id: safeStr(resource_id || ''),
      actor_uid: safeStr(req?.user?.uid || 'anonymous'),
      actor_name: safeStr(req?.user?.name || req?.user?.username || 'anonymous'),
      actor_role: safeStr(req?.user?.role || 'unknown'),
      ip: getClientIp(req),
      data: data || null,
      created_at: toIso(new Date()),
    });
  } catch (e) {
    console.warn('writeAuditLog error:', e?.message);
  }
}

// ============================================================
// TIMEZONE HELPERS (ported from Element CRM)
// ============================================================
function getTzParts(date, timeZone = 'America/Chicago') {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const out = {};
  for (const p of parts) { if (p.type !== 'literal') out[p.type] = p.value; }
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(out.hour), minute: Number(out.minute), second: Number(out.second), weekday: wdMap[out.weekday] };
}

function getTzDateKey(date, timeZone = 'America/Chicago') {
  const p = getTzParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function getTimeZoneOffsetMinutes(date, timeZone = 'America/Chicago') {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  for (const p of parts) { if (p.type !== 'literal') map[p.type] = p.value; }
  const utcTs = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
  return Math.round((utcTs - date.getTime()) / 60000);
}

function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = 'America/Chicago') {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMin = getTimeZoneOffsetMinutes(approxUtc, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60000);
}

function startOfDayInTz(date, timeZone = 'America/Chicago') {
  const p = getTzParts(date, timeZone);
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, timeZone);
}

function eachTzDay(start, end, timeZone = 'America/Chicago') {
  const days = [];
  let cur = startOfDayInTz(start, timeZone);
  const last = startOfDayInTz(end, timeZone);
  while (cur.getTime() <= last.getTime()) { days.push(new Date(cur)); cur = addMinutes(cur, 24 * 60); }
  return days;
}

// ============================================================
// SCHEDULE HELPERS (ported from Element CRM)
// ============================================================
function defaultSchedule() { return { startMin: 480, endMin: 1200, days: [0, 1, 2, 3, 4, 5, 6] }; }

function normalizeSchedule(sch) {
  const def = defaultSchedule();
  if (!sch || typeof sch !== 'object') return def;
  if (Array.isArray(sch) && sch.length === 7) {
    const days = sch.map((d, i) => (d && d.enabled !== false) ? i : -1).filter(i => i >= 0);
    const allStart = sch.filter(d => d && d.enabled !== false).map(d => Number(d.startMin ?? d.start_min ?? 480));
    const allEnd = sch.filter(d => d && d.enabled !== false).map(d => Number(d.endMin ?? d.end_min ?? 1200));
    return {
      startMin: allStart.length ? Math.min(...allStart) : 480,
      endMin: allEnd.length ? Math.max(...allEnd) : 1200,
      days: days.length ? days : def.days,
      perDay: sch.map(d => ({ enabled: d ? d.enabled !== false : false, startMin: Number(d?.startMin ?? d?.start_min ?? 480), endMin: Number(d?.endMin ?? d?.end_min ?? 1200) })),
    };
  }
  const startMin = Number(sch.startMin ?? sch.start_min ?? def.startMin);
  const endMin = Number(sch.endMin ?? sch.end_min ?? def.endMin);
  const daysRaw = Array.isArray(sch.days) ? sch.days : def.days;
  const days = Array.from(new Set(daysRaw.map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
  const result = { startMin: Math.max(0, Math.min(1440, Math.round(startMin))), endMin: Math.max(0, Math.min(1440, Math.round(endMin))), days: days.length ? days : def.days };
  if (Array.isArray(sch.perDay)) result.perDay = sch.perDay;
  return result;
}

function getScheduleForDate(barberDoc, dateObj, timeZone = 'America/Chicago') {
  const parts = getTzParts(dateObj, timeZone);
  const dow = parts.weekday;
  const dateKey = getTzDateKey(dateObj, timeZone);
  const overrides = barberDoc?.schedule_overrides;
  if (overrides && typeof overrides === 'object' && overrides[dateKey]) {
    const ov = overrides[dateKey];
    return { works: ov.enabled !== false, startMin: Number(ov.startMin || 600), endMin: Number(ov.endMin || 1200), dayKey: dateKey, weekday: dow, isOverride: true };
  }
  const sch = barberDoc?.schedule || null;
  const use = normalizeSchedule(sch);
  if (use.perDay && use.perDay[dow]) {
    const daySchedule = use.perDay[dow];
    return { works: daySchedule.enabled !== false, startMin: Number(daySchedule.startMin || use.startMin), endMin: Number(daySchedule.endMin || use.endMin), dayKey: dateKey, weekday: dow };
  }
  return { works: use.days.includes(dow), startMin: use.startMin, endMin: use.endMin, dayKey: dateKey, weekday: dow };
}

function buildSlotsForDay({ dayDateUTC, schedule, durationMin, stepMin = 30, timeZone = 'America/Chicago' }) {
  const { works, startMin, endMin } = schedule;
  if (!works) return [];
  const parts = getTzParts(dayDateUTC, timeZone);
  const workStart = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(startMin / 60), minute: startMin % 60 }, timeZone);
  const workEnd = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(endMin / 60), minute: endMin % 60 }, timeZone);
  const slots = [];
  for (let t = new Date(workStart); addMinutes(t, durationMin) <= workEnd; t = addMinutes(t, stepMin)) slots.push(new Date(t));
  return slots;
}

function buildSmartSlotsForDay({ dayDateUTC, schedule, durationMin, stepMin = 30, timeZone = 'America/Chicago', busy = [] }) {
  const baseSlots = buildSlotsForDay({ dayDateUTC, schedule, durationMin, stepMin, timeZone });
  if (!baseSlots.length || !busy.length) return baseSlots;
  const { startMin, endMin } = schedule;
  const parts = getTzParts(dayDateUTC, timeZone);
  const workStart = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(startMin / 60), minute: startMin % 60 }, timeZone);
  const workEnd = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(endMin / 60), minute: endMin % 60 }, timeZone);
  const durMs = durationMin * 60000;
  const adjacency = [];
  for (const b of busy) {
    const before = new Date(b.start.getTime() - durMs);
    if (before >= workStart) adjacency.push(before);
    const after = new Date(b.end.getTime());
    if (addMinutes(after, durationMin) <= workEnd) adjacency.push(after);
  }
  const map = new Map();
  for (const s of baseSlots) map.set(s.getTime(), s);
  for (const s of adjacency) map.set(s.getTime(), s);
  return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
}

function filterSlotsAgainstBusy(slots, busy, durationMin) {
  const durMs = durationMin * 60000;
  return slots.filter(s => {
    const e = new Date(s.getTime() + durMs);
    return !busy.some(b => overlaps(s, e, b.start, b.end));
  });
}

function clampDateRange(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (end <= start) return null;
  if (end.getTime() - start.getTime() > 60 * 86400000) return null;
  return { start, end };
}

// ============================================================
// WORKSPACE-SCOPED DATA HELPERS
// ============================================================
async function getBusyIntervalsForBarber(wsCol, barberId, rangeStartIso, rangeEndIso) {
  const rangeStart = parseIso(rangeStartIso);
  const rangeEnd = parseIso(rangeEndIso);
  if (!rangeStart || !rangeEnd) return [];
  const snap = await wsCol('bookings').where('barber_id', '==', String(barberId)).get();
  const out = [];
  for (const doc of snap.docs) {
    const b = doc.data() || {};
    if (String(b.status || 'booked') === 'cancelled') continue;
    const s = parseIso(b.start_at);
    const e = parseIso(b.end_at);
    if (!s || !e) continue;
    if (s < rangeEnd && rangeStart < e) out.push({ start: s, end: e, id: doc.id });
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

async function ensureNoConflictTx(tx, bookingsRef, { barberId, startAt, endAt, excludeBookingId }) {
  const snap = await tx.get(bookingsRef.where('barber_id', '==', String(barberId)));
  for (const doc of snap.docs) {
    if (excludeBookingId && doc.id === excludeBookingId) continue;
    const b = doc.data() || {};
    if (String(b.status || 'booked') === 'cancelled') continue;
    const s = parseIso(b.start_at);
    const e = parseIso(b.end_at);
    if (!s || !e) continue;
    if (overlaps(startAt, endAt, s, e)) {
      const err = new Error('CONFLICT');
      err.code = 'CONFLICT';
      throw err;
    }
  }
}

// Client classification
function classifyClient(clientName, bookings) {
  const now = new Date();
  const clientBookings = bookings.filter(b => String(b.client_name || '') === clientName);
  const totalVisits = clientBookings.length;
  const noShows = clientBookings.filter(b => String(b.status || '') === 'noshow').length;
  const completedVisits = totalVisits - noShows;
  const sorted = [...clientBookings].sort((a, b) => String(a.start_at || '').localeCompare(String(b.start_at || '')));
  let visitsAfterLastNoshow = 0, bigTipsAfterLastNoshow = 0, foundNoshow = false;
  for (const b of sorted) {
    if (String(b.status || '') === 'noshow') { foundNoshow = true; visitsAfterLastNoshow = 0; bigTipsAfterLastNoshow = 0; }
    else { visitsAfterLastNoshow++; if (Number(b.tip || 0) >= 30) bigTipsAfterLastNoshow++; }
  }
  const bigTipCount = clientBookings.filter(b => Number(b.tip || 0) >= 30 && String(b.status || '') !== 'noshow').length;
  let lastVisitDate = null;
  for (const b of clientBookings) { const d = b.start_at ? new Date(b.start_at) : null; if (d && (!lastVisitDate || d > lastVisitDate)) lastVisitDate = d; }
  const daysSinceLastVisit = lastVisitDate ? (now - lastVisitDate) / (1000 * 60 * 60 * 24) : Infinity;
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const recentVisits = clientBookings.filter(b => { const d = b.start_at ? new Date(b.start_at) : null; return d && d >= sixtyDaysAgo && String(b.status || '') !== 'noshow'; }).length;
  if (noShows >= 1 && foundNoshow) {
    if (bigTipsAfterLastNoshow >= 5) return 'vip';
    if (visitsAfterLastNoshow >= 10) return 'active';
    return 'at_risk';
  }
  if (daysSinceLastVisit >= 90 && totalVisits >= 3) return 'at_risk';
  if (bigTipCount >= 1) return 'vip';
  if (recentVisits >= 2) return 'active';
  if (completedVisits <= 1) return 'new';
  return 'active';
}

// ============================================================
// AUTH COOKIE
// ============================================================
function setAuthCookie(res, token) {
  const secure = NODE_ENV === 'production';
  res.cookie('vuriumbook_token', token, {
    httpOnly: true, secure, sameSite: 'Lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
  });
}

function clearAuthCookie(res) {
  const secure = NODE_ENV === 'production';
  res.cookie('vuriumbook_token', '', {
    httpOnly: true, secure, sameSite: 'Lax', maxAge: 0, path: '/',
  });
}

// ============================================================
// HEALTH
// ============================================================
app.get('/health', (req, res) => res.json({ ok: true, service: 'vuriumbook-api', version: '3.0.0' }));

app.get('/health/db', async (req, res) => {
  const results = {};
  try {
    const snap = await db.collection('workspaces').limit(1).get();
    results.workspaces = { ok: true, count: snap.size };
    // Test the same operations signup does
    if (!snap.empty) {
      const ws = snap.docs[0];
      results.workspace_id = ws.id;
      const users = await ws.ref.collection('users').limit(1).get();
      results.users_query = { ok: true, count: users.size };
    }
    // Test slug collection
    const slugs = await db.collection('slugs').limit(1).get();
    results.slugs = { ok: true, count: slugs.size };
    res.json({ ok: true, firestore: 'connected', ...results });
  } catch (e) {
    res.status(500).json({ ok: false, firestore: 'error', code: e.code || null, message: e.message || String(e), step: results });
  }
});

// ============================================================
// AUTH ROUTES (no workspace middleware — pre /api)
// ============================================================
app.post('/auth/signup', async (req, res) => {
  try {
    const v = validate(SignupSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { workspace_name, username, password, name, email, phone, timezone } = v.data;

    // Check if username already used in any workspace
    const usernameLC = username.toLowerCase();
    const allWs = await db.collection('workspaces').get();
    for (const ws of allWs.docs) {
      const dup = await ws.ref.collection('users')
        .where('username', '==', usernameLC).where('active', '==', true).limit(1).get();
      if (!dup.empty) {
        return res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists. Please sign in.' });
      }
    }

    // Create workspace with slug
    const wsRef = db.collection('workspaces').doc();
    const slug = await generateUniqueSlug(workspace_name);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial
    const wsData = {
      name: sanitizeHtml(workspace_name),
      slug,
      plan_type: 'individual',
      billing_status: 'trialing',
      trial_ends_at: toIso(trialEnd),
      trial_used: false,
      owner_username: usernameLC,
      timezone: timezone || 'America/Chicago',
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    };
    await wsRef.set(wsData);
    await registerSlug(slug, wsRef.id);

    // Create owner user in workspace
    const userRef = wsRef.collection('users').doc();
    const userData = {
      username: usernameLC,
      name: sanitizeHtml(name || username),
      email: sanitizeHtml(email || '') || null,
      phone: phone || null,
      role: 'owner',
      password_hash: hashPassword(password),
      active: true,
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    };
    await userRef.set(userData);

    // Create default settings doc
    await wsRef.collection('settings').doc('config').set({
      timezone: timezone || 'America/Chicago',
      created_at: toIso(new Date()),
    });

    // Sign JWT
    const token = jwt.sign({
      uid: userRef.id,
      username: usernameLC,
      role: 'owner',
      name: userData.name,
      workspace_id: wsRef.id,
      permissions: PERMISSIONS.owner,
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });

    setAuthCookie(res, token);
    res.status(201).json({
      ok: true,
      workspace_id: wsRef.id,
      workspace_name: wsData.name,
      slug,
      user_id: userRef.id,
      token,
    });
  } catch (e) {
    console.error('signup error:', e?.code, e?.message, e?.stack);
    res.status(500).json({ error: 'signup_failed', detail: e?.message || 'Internal error', code: e?.code || null });
  }
});

app.post('/auth/setup-owner', async (req, res) => {
  try {
    const v = validate(LoginSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { workspace_id, username, password } = v.data;
    const wsDoc = await db.collection('workspaces').doc(workspace_id).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    // Check if owner already exists
    const existingOwner = await db.collection('workspaces').doc(workspace_id).collection('users').where('role', '==', 'owner').limit(1).get();
    if (!existingOwner.empty) return res.status(409).json({ error: 'Owner already exists for this workspace' });
    const userRef = db.collection('workspaces').doc(workspace_id).collection('users').doc();
    const userData = {
      username: username.toLowerCase(),
      name: sanitizeHtml(username),
      role: 'owner',
      password_hash: hashPassword(password),
      active: true,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    await userRef.set(userData);
    const token = jwt.sign({
      uid: userRef.id, username: userData.username, role: 'owner',
      name: userData.name, workspace_id, permissions: PERMISSIONS.owner,
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);
    res.status(201).json({ ok: true, user_id: userRef.id, token });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Login by email only — searches all workspaces
app.post('/auth/login-email', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const emailLC = email.toLowerCase().trim();
    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip);
    if (!rl.allowed) {
      res.set('Retry-After', String(rl.retryAfter));
      return res.status(429).json({ error: 'Too many login attempts. Try again later.', retry_after: rl.retryAfter });
    }
    // Search all workspaces for this email
    const wsSnap = await db.collection('workspaces').get();
    let foundUser = null, foundWsId = null;
    for (const ws of wsSnap.docs) {
      const usersSnap = await db.collection('workspaces').doc(ws.id).collection('users')
        .where('username', '==', emailLC).where('active', '==', true).limit(1).get();
      if (!usersSnap.empty) {
        foundUser = { ...usersSnap.docs[0].data(), uid: usersSnap.docs[0].id };
        foundWsId = ws.id;
        break;
      }
    }
    if (!foundUser || !foundWsId) return res.status(401).json({ error: 'Invalid email or password' });
    if (!checkPassword(password, foundUser.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
    await resetRateLimit(ip);
    const token = jwt.sign({
      uid: foundUser.uid, username: foundUser.username, role: foundUser.role,
      name: foundUser.name, workspace_id: foundWsId,
      barber_id: foundUser.barber_id || null,
      mentor_barber_ids: foundUser.mentor_barber_ids || [],
      permissions: PERMISSIONS[foundUser.role] || {},
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);
    writeAuditLog(foundWsId, { action: 'user.login', resource_id: foundUser.uid, data: { username: foundUser.username }, req }).catch(() => {});
    res.json({
      ok: true, token,
      user: {
        id: foundUser.uid, uid: foundUser.uid, username: foundUser.username, name: foundUser.name,
        role: foundUser.role, workspace_id: foundWsId, barber_id: foundUser.barber_id || null,
        permissions: PERMISSIONS[foundUser.role] || {},
      },
    });
  } catch (e) {
    console.error('login-email error:', e);
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const v = validate(LoginSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { workspace_id, username, password } = v.data;
    const ip = getClientIp(req);

    // Rate limit
    const rl = await checkRateLimit(ip);
    if (!rl.allowed) {
      res.set('Retry-After', String(rl.retryAfter));
      return res.status(429).json({ error: 'Too many login attempts. Try again later.', retry_after: rl.retryAfter });
    }

    // Check workspace exists
    const wsDoc = await db.collection('workspaces').doc(workspace_id).get();
    if (!wsDoc.exists) return res.status(401).json({ error: 'Invalid credentials' });

    // Find user
    const usersSnap = await db.collection('workspaces').doc(workspace_id).collection('users')
      .where('username', '==', username.toLowerCase())
      .where('active', '==', true)
      .limit(1).get();

    if (usersSnap.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const userDoc = usersSnap.docs[0];
    const user = userDoc.data();

    if (!checkPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await resetRateLimit(ip);

    const token = jwt.sign({
      uid: userDoc.id,
      username: user.username,
      role: user.role,
      name: user.name,
      workspace_id,
      barber_id: user.barber_id || null,
      mentor_barber_ids: user.mentor_barber_ids || [],
      permissions: PERMISSIONS[user.role] || {},
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });

    setAuthCookie(res, token);

    writeAuditLog(workspace_id, { action: 'user.login', resource_id: userDoc.id, data: { username: user.username }, req }).catch(() => {});

    res.json({
      ok: true,
      token,
      user: {
        id: userDoc.id, username: user.username, name: user.name,
        role: user.role, workspace_id, barber_id: user.barber_id || null,
        permissions: PERMISSIONS[user.role] || {},
      },
    });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// ============================================================
// AUTHENTICATED API ROUTES
// ============================================================

// --- Auth: me, logout, change-password ---
app.get('/api/auth/me', (req, res) => {
  res.json({
    user: {
      id: req.user.uid, username: req.user.username, name: req.user.name,
      role: req.user.role, workspace_id: req.user.workspace_id,
      barber_id: req.user.barber_id || null,
      permissions: PERMISSIONS[req.user.role] || {},
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  writeAuditLog(req.wsId, { action: 'user.logout', resource_id: req.user.uid, req }).catch(() => {});
  res.json({ ok: true });
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const v = validate(ChangePasswordSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { current_password, new_password } = v.data;

    const userRef = req.ws('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    if (!checkPassword(current_password, userDoc.data().password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await userRef.update({ password_hash: hashPassword(new_password), updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'user.change_password', resource_id: req.user.uid, req }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

app.delete('/api/auth/delete-account', async (req, res) => {
  try {
    const password = safeStr(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'Password required to confirm deletion' });
    const userRef = req.ws('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    if (!checkPassword(password, userDoc.data().password_hash)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    if (req.user.role === 'owner') {
      // Owner: delete entire workspace and all subcollections
      const wsRef = db.collection('workspaces').doc(req.wsId);
      const subcollections = [
        'users', 'barbers', 'services', 'clients', 'bookings', 'memberships',
        'expenses', 'reviews', 'applications', 'attendance', 'audit_logs',
        'cash_reports', 'crm_push_tokens', 'expense_categories', 'messages',
        'payment_requests', 'payroll_rules', 'phone_access_log', 'requests',
        'settings', 'waitlist'
      ];
      for (const colName of subcollections) {
        const snap = await wsRef.collection(colName).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        if (!snap.empty) await batch.commit();
      }
      await wsRef.delete();
    } else {
      // Non-owner: soft-delete user only
      await userRef.update({ active: false, deleted: true, deleted_at: toIso(new Date()), updated_at: toIso(new Date()) });
      const tokenSnap = await req.ws('crm_push_tokens').where('user_id', '==', req.user.uid).get();
      for (const d of tokenSnap.docs) await d.ref.delete();
      writeAuditLog(req.wsId, { action: 'user.delete_self', resource_id: req.user.uid, req }).catch(() => {});
    }

    clearAuthCookie(res);
    res.json({ ok: true, deleted: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// --- Workspace info ---
app.get('/api/workspace', async (req, res) => {
  try {
    const doc = await req.wsDoc().get();
    if (!doc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const data = doc.data();
    res.json({ id: doc.id, name: data.name, plan: data.plan, timezone: data.timezone, created_at: data.created_at });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// ============================================================
// BARBERS CRUD
// ============================================================
app.get('/api/barbers', async (req, res) => {
  try {
    const snap = await req.ws('barbers').orderBy('name').get();
    const list = snap.docs.map(d => {
      const data = d.data() || {};
      if (data.active === false) return null;
      return { id: d.id, ...data };
    }).filter(Boolean);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/barbers', requireRole('owner', 'admin'), async (req, res) => {
  try {
    // Plan-based team member limit
    const wsDoc = await req.wsDoc().get();
    const wsData = wsDoc.exists ? wsDoc.data() : {};
    const effectivePlan = getEffectivePlan(wsData);
    const planDef = getPlanDef(effectivePlan);
    if (planDef.member_limit !== null) {
      const existingSnap = await req.ws('barbers').where('active', '==', true).get();
      if (existingSnap.size >= planDef.member_limit) {
        return res.status(403).json({ error: `Your plan allows ${planDef.member_limit} team member(s). Upgrade to add more.`, code: 'TEAM_LIMIT_REACHED', current_plan: wsData.plan_type || 'individual', effective_plan: effectivePlan });
      }
    }
    const b = req.body || {};
    const name = safeStr(b.name);
    if (!name) return res.status(400).json({ error: 'name is required' });
    const schedule = b.schedule && typeof b.schedule === 'object' ? normalizeSchedule(b.schedule) : null;
    const doc = {
      name: sanitizeHtml(name),
      level: safeStr(b.level) || null,
      photo_url: safeStr(b.photo_url) || null,
      schedule, schedule_overrides: {},
      active: true,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('barbers').add(doc);
    writeAuditLog(req.wsId, { action: 'barber.create', resource_id: ref.id, data: { name }, req }).catch(() => {});
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Schedule override for a specific date (must be before /:id)
app.patch('/api/barbers/:id/schedule-override', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('barbers').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Barber not found' });
    const b = req.body || {};
    const dateKey = safeStr(b.date); // YYYY-MM-DD
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const overrides = existing.data()?.schedule_overrides || {};
    if (b.remove) {
      delete overrides[dateKey];
    } else {
      overrides[dateKey] = {
        enabled: b.enabled !== false,
        startMin: Number(b.startMin || 600),
        endMin: Number(b.endMin || 1200),
      };
    }
    // Clean overrides older than 30 days
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    for (const k of Object.keys(overrides)) { if (k < cutoff) delete overrides[k]; }
    await ref.update({ schedule_overrides: overrides, updated_at: toIso(new Date()) });
    res.json({ ok: true, schedule_overrides: overrides });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/barbers/:id', async (req, res) => {
  try {
    const doc = await req.ws('barbers').doc(req.params.id).get();
    if (!doc.exists || doc.data()?.active === false) return res.status(404).json({ error: 'Barber not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/barbers/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('barbers').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Barber not found' });
    const b = req.body || {};
    const patch = { updated_at: toIso(new Date()) };
    if (b.name != null) patch.name = sanitizeHtml(safeStr(b.name));
    if (b.level != null) patch.level = safeStr(b.level);
    if (b.photo_url != null) patch.photo_url = safeStr(b.photo_url) || null;
    if (b.active != null) patch.active = !!b.active;
    if (b.schedule && typeof b.schedule === 'object') patch.schedule = normalizeSchedule(b.schedule);
    if (b.schedule_overrides && typeof b.schedule_overrides === 'object') patch.schedule_overrides = b.schedule_overrides;
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/barbers/:id', requireRole('owner'), async (req, res) => {
  try {
    const ref = req.ws('barbers').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Barber not found' });
    await ref.set({ active: false, updated_at: toIso(new Date()) }, { merge: true });
    res.json({ ok: true, id: req.params.id, soft_deleted: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SERVICES CRUD
// ============================================================
app.get('/api/services', async (req, res) => {
  try {
    const snap = await req.ws('services').orderBy('name').get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false);
    res.json({ services: list });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/services', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const name = safeStr(b.name);
    if (!name) return res.status(400).json({ error: 'name required' });
    const doc = {
      name: sanitizeHtml(name),
      duration_minutes: Math.max(1, Math.round(Number(b.duration_minutes ?? b.durationMin ?? 30)) || 30),
      price_cents: Math.max(0, Math.round(Number(b.price_cents ?? b.priceCents ?? 0)) || 0),
      barber_ids: Array.isArray(b.barber_ids) ? b.barber_ids.map(String).filter(Boolean) : [],
      service_type: safeStr(b.service_type || 'primary'),
      active: true,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('services').add(doc);
    res.status(201).json({ service: { id: ref.id, ...doc } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/services/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('services').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Service not found' });
    const b = req.body || {};
    const patch = { updated_at: toIso(new Date()) };
    if (b.name != null) patch.name = sanitizeHtml(safeStr(b.name));
    if (b.duration_minutes != null || b.durationMin != null) patch.duration_minutes = Math.max(1, Math.round(Number(b.duration_minutes ?? b.durationMin) || 30));
    if (b.price_cents != null || b.priceCents != null) patch.price_cents = Math.max(0, Math.round(Number(b.price_cents ?? b.priceCents) || 0));
    if (b.active != null) patch.active = !!b.active;
    if (b.barber_ids != null) patch.barber_ids = Array.isArray(b.barber_ids) ? b.barber_ids.map(String).filter(Boolean) : [];
    if (b.service_type != null) patch.service_type = safeStr(b.service_type) || 'primary';
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    res.json({ service: { id: saved.id, ...saved.data() } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/services/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('services').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Service not found' });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// CLIENTS CRUD
// ============================================================
app.get('/api/clients', async (req, res) => {
  try {
    const q = safeStr(req.query?.q || '').toLowerCase();
    const snap = await req.ws('clients').orderBy('created_at', 'desc').limit(500).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (q) list = list.filter(c =>
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.phone_norm || '').includes(q) ||
      String(c.email || '').toLowerCase().includes(q)
    );
    // If no local results and searching by phone, try Square customers
    if (list.length === 0 && q) {
      try {
        const digits = q.replace(/\D/g, '');
        if (digits.length >= 10) {
          const headers = await squareHeaders(req.ws, { hasBody: true });
          const phone = digits.length === 10 ? '+1' + digits : '+' + digits;
          const sr = await squareFetch('/v2/customers/search', {
            method: 'POST', headers,
            body: JSON.stringify({ query: { filter: { phone_number: { exact: phone } } }, limit: 10 }),
          });
          if (sr.ok) {
            const sd = await sr.json();
            for (const sc of (sd.customers || [])) {
              // Import Square customer to local DB
              const newClient = {
                name: [sc.given_name, sc.family_name].filter(Boolean).join(' ') || 'Square Customer',
                phone: sc.phone_number || '', phone_norm: (sc.phone_number || '').replace(/\D/g, ''),
                email: sc.email_address || '', square_customer_id: sc.id,
                source: 'square', created_at: toIso(new Date()), updated_at: toIso(new Date()),
              };
              const ref = await req.ws('clients').add(newClient);
              list.push({ id: ref.id, ...newClient });
            }
          }
        }
      } catch {}
    }

    // Auto-classify
    try {
      const clientNames = list.map(c => String(c.name || '')).filter(Boolean);
      if (clientNames.length > 0) {
        const allBookings = [];
        for (let i = 0; i < clientNames.length; i += 30) {
          const batch = clientNames.slice(i, i + 30);
          const bSnap = await req.ws('bookings').where('client_name', 'in', batch).orderBy('start_at', 'desc').limit(1000).get();
          allBookings.push(...bSnap.docs.map(d => d.data()));
        }
        list = list.map(c => ({ ...c, client_status: classifyClient(String(c.name || ''), allBookings) }));
      }
    } catch (e) { console.warn('classifyClient error:', e?.message); }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/clients', async (req, res) => {
  try {
    const v = validate(ClientCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { name, phone, email } = v.data;
    // Check for duplicate phone
    const pn = normPhone(phone);
    if (pn) {
      const dupPhone = await req.ws('clients').where('phone_norm', '==', pn).limit(1).get();
      if (!dupPhone.empty) return res.status(409).json({ error: 'Client with this phone already exists', existing_id: dupPhone.docs[0].id, existing_name: dupPhone.docs[0].data().name });
    }
    // Check for duplicate email
    if (email) {
      const emailLC = email.toLowerCase().trim();
      const dupEmail = await req.ws('clients').where('email', '==', emailLC).limit(1).get();
      if (!dupEmail.empty) return res.status(409).json({ error: 'Client with this email already exists', existing_id: dupEmail.docs[0].id, existing_name: dupEmail.docs[0].data().name });
    }
    const doc = {
      name: sanitizeHtml(name),
      phone: phone || null,
      phone_norm: pn || null,
      email: sanitizeHtml(email)?.toLowerCase() || null,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('clients').add(doc);
    writeAuditLog(req.wsId, { action: 'client.create', resource_id: ref.id, data: { name }, req }).catch(() => {});
    res.status(201).json({ id: ref.id, ...doc, client_status: 'new' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Request phone access (must be before /:id)
app.post('/api/clients/request-phone', async (req, res) => {
  try {
    const clientId = safeStr(req.body?.client_id || '');
    if (!clientId) return res.status(400).json({ error: 'client_id required' });
    const clientDoc = await req.ws('clients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const clientData = clientDoc.data();
    const phone = clientData.phone || clientData.phone_norm;
    if (!phone) return res.status(404).json({ error: 'No phone on file' });
    // Owner gets instant access
    if (req.user.role === 'owner') {
      const plainPhone = decryptPhone(phone);
      req.ws('phone_access_log').add({ client_id: clientId, user_id: req.user.uid, role: req.user.role, granted: true, created_at: toIso(new Date()) }).catch(() => {});
      return res.json({ phone: plainPhone });
    }
    // Admin: check GPS if geofence configured
    if (req.user.role === 'admin') {
      const settingsDoc = await req.ws('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};
      if (settings.geofence_lat && settings.geofence_lng) {
        const lat = Number(req.body?.lat);
        const lng = Number(req.body?.lng);
        if (!lat || !lng) return res.status(400).json({ error: 'Location required for phone access' });
        const dist = haversineMeters(lat, lng, Number(settings.geofence_lat), Number(settings.geofence_lng));
        const radius = Number(settings.geofence_radius_m || 250);
        if (dist > radius) {
          req.ws('phone_access_log').add({ client_id: clientId, user_id: req.user.uid, role: req.user.role, granted: false, reason: 'too_far', distance_m: Math.round(dist), created_at: toIso(new Date()) }).catch(() => {});
          return res.status(403).json({ error: 'You must be at the shop to access client phone numbers' });
        }
      }
      const plainPhone = decryptPhone(phone);
      req.ws('phone_access_log').add({ client_id: clientId, user_id: req.user.uid, role: req.user.role, granted: true, created_at: toIso(new Date()) }).catch(() => {});
      return res.json({ phone: plainPhone });
    }
    // Barber/student: masked
    return res.json({ phone: phoneForRole(phone, req.user.role) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const doc = await req.ws('clients').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    const data = doc.data();
    const bSnap = await req.ws('bookings').where('client_name', '==', String(data.name || '')).orderBy('start_at', 'desc').limit(20).get();
    const bookings = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ id: doc.id, ...data, bookings });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/clients/:id', async (req, res) => {
  try {
    const v = validate(ClientPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const b = v.data;
    const ref = req.ws('clients').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    const patch = { updated_at: toIso(new Date()) };
    if (b.name != null) patch.name = sanitizeHtml(safeStr(b.name));
    if (b.phone != null) { patch.phone = safeStr(b.phone) || null; patch.phone_norm = normPhone(b.phone) || null; }
    if (b.email != null) patch.email = sanitizeHtml(safeStr(b.email));
    if (b.notes != null) patch.notes = sanitizeHtml(safeStr(b.notes));
    if (b.status != null) patch.status = safeStr(b.status);
    if (b.preferred_barber != null) patch.preferred_barber = safeStr(b.preferred_barber);
    if (Array.isArray(b.tags)) patch.tags = b.tags.map(t => sanitizeHtml(safeStr(t))).filter(Boolean);
    if (b.photo_url != null) patch.photo_url = safeStr(b.photo_url) || null;
    await ref.update(patch);
    writeAuditLog(req.wsId, { action: 'client.update', resource_id: req.params.id, data: patch, req }).catch(() => {});
    res.json({ id: req.params.id, ...doc.data(), ...patch });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/clients/:id', requireRole('owner'), async (req, res) => {
  try {
    const ref = req.ws('clients').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Client not found' });
    await ref.delete();
    writeAuditLog(req.wsId, { action: 'client.delete', resource_id: req.params.id, req }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// BOOKINGS CRUD
// ============================================================
app.get('/api/bookings', async (req, res) => {
  try {
    const statusFilter = safeStr(req.query?.status || '');
    const barberId = safeStr(req.query?.barber_id || '');
    const startFrom = safeStr(req.query?.start_from || '');
    const startTo = safeStr(req.query?.start_to || '');
    let query = req.ws('bookings').orderBy('start_at', 'desc').limit(500);
    if (barberId) query = req.ws('bookings').where('barber_id', '==', barberId).orderBy('start_at', 'desc').limit(500);
    const snap = await query.get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (statusFilter) list = list.filter(b => String(b.status || '') === statusFilter);
    if (startFrom) list = list.filter(b => String(b.start_at || '') >= startFrom);
    if (startTo) list = list.filter(b => String(b.start_at || '') <= startTo);
    // Barber role: only own bookings
    if (req.user.role === 'barber' && req.user.barber_id) {
      list = list.filter(b => b.barber_id === req.user.barber_id);
    }
    // Student role: only mentor bookings
    if (req.user.role === 'student' && Array.isArray(req.user.mentor_barber_ids)) {
      list = list.filter(b => req.user.mentor_barber_ids.includes(b.barber_id));
    }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const v = validate(BookingCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const data = v.data;
    const startAt = parseIso(data.start_at);
    if (!startAt) return res.status(400).json({ error: 'Invalid start_at' });
    const durMin = data.duration_minutes || 30;
    const endAt = data.end_at ? parseIso(data.end_at) : addMinutes(startAt, durMin);
    const doc = {
      client_name: sanitizeHtml(data.client_name) || null,
      client_phone: data.client_phone || null,
      client_email: data.client_email ? data.client_email.toLowerCase() : null,
      customer_id: data.customer_id || null,
      barber_id: data.barber_id,
      barber_name: sanitizeHtml(data.barber_name) || null,
      service_id: data.service_id || null,
      service_name: sanitizeHtml(data.service_name) || null,
      start_at: toIso(startAt),
      end_at: toIso(endAt),
      duration_minutes: durMin,
      status: data.status || 'booked',
      source: data.source || 'crm',
      notes: sanitizeHtml(data.notes) || null,
      customer_note: sanitizeHtml(data.customer_note) || null,
      sms_consent: data.sms_consent || false,
      paid: data.paid || false,
      workspace_id: req.wsId,
      client_token: crypto.randomBytes(24).toString('hex'),
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };

    // Conflict detection via transaction
    const bookingsRef = req.ws('bookings');
    const bookingRef = bookingsRef.doc();
    try {
      await db.runTransaction(async (tx) => {
        await ensureNoConflictTx(tx, bookingsRef, { barberId: data.barber_id, startAt, endAt });
        tx.set(bookingRef, doc);
      });
    } catch (e) {
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) {
        return res.status(409).json({ error: 'Slot already booked' });
      }
      throw e;
    }
    writeAuditLog(req.wsId, { action: 'booking.create', resource_id: bookingRef.id, data: { client_name: doc.client_name, barber_id: doc.barber_id }, req }).catch(() => {});
    // SMS confirmation + push + schedule reminders
    const settingsDoc = await req.ws('settings').doc('config').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const tz = settingsData?.timezone || 'America/Chicago';
    const shopName = safeStr(settingsData?.shop_name || '');
    if (doc.client_phone) {
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      const prefix = shopName ? `${shopName}: ` : '';
      sendSms(doc.client_phone, `${prefix}Your appointment is confirmed for ${dateStr} at ${timeStr} with ${doc.barber_name || 'your barber'}. Reply STOP to unsubscribe.`).catch(() => {});
      scheduleReminders(req.ws, bookingRef.id, doc, tz, shopName).catch(() => {});
    }
    sendCrmPushToStaff(req.ws, doc.barber_id, 'New Booking', `${doc.client_name || 'Client'} booked for ${doc.start_at?.slice(0, 10)}`, { type: 'booking_confirmed' }).catch(() => {});
    // Email confirmation
    if (doc.client_email) {
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
      const manageUrl = `https://vurium.com/manage-booking?token=${doc.client_token}`;
      sendEmail(doc.client_email, 'Booking Confirmed', vuriumEmailTemplate('Booking Confirmed', `
        <p>Your appointment has been confirmed:</p>
        <div style="padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:#e8e8ed;">${doc.service_name || 'Appointment'}</div>
          <div style="color:rgba(255,255,255,.4);margin-top:4px;">with ${doc.barber_name || 'your specialist'}</div>
          <div style="color:rgba(130,150,220,.7);font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
        </div>
        <div style="text-align:center;margin:20px 0;display:flex;gap:10px;justify-content:center;">
          <a href="${manageUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#e8e8ed;text-decoration:none;font-size:13px;font-weight:500;">Reschedule</a>
          <a href="${manageUrl}?action=cancel" style="display:inline-block;padding:12px 24px;border-radius:10px;background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.2);color:rgba(255,140,140,.9);text-decoration:none;font-size:13px;font-weight:500;">Cancel</a>
        </div>
      `, shopName), shopName).catch(() => {});
    }
    res.status(201).json({ id: bookingRef.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const v = validate(BookingPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const ref = req.ws('bookings').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Booking not found' });
    const b = v.data;
    const patch = { updated_at: toIso(new Date()) };
    if (b.client_name != null) patch.client_name = sanitizeHtml(b.client_name);
    if (b.client_phone != null) patch.client_phone = b.client_phone;
    if (b.client_email != null) patch.client_email = b.client_email.toLowerCase();
    if (b.barber_id != null) patch.barber_id = b.barber_id;
    if (b.barber_name != null) patch.barber_name = sanitizeHtml(b.barber_name);
    if (b.service_id != null) patch.service_id = b.service_id;
    if (b.service_name != null) patch.service_name = sanitizeHtml(b.service_name);
    if (b.start_at != null) patch.start_at = b.start_at;
    if (b.end_at != null) patch.end_at = b.end_at;
    if (b.duration_minutes != null) patch.duration_minutes = b.duration_minutes;
    if (b.status != null) patch.status = b.status;
    if (b.notes != null) patch.notes = sanitizeHtml(b.notes);
    if (b.customer_note != null) patch.customer_note = sanitizeHtml(b.customer_note);
    if (b.paid != null) patch.paid = b.paid;
    if (b.payment_status != null) patch.payment_status = b.payment_status;
    if (b.payment_method != null) patch.payment_method = b.payment_method;
    if (b.tip != null) patch.tip = b.tip;
    if (b.tip_amount != null) patch.tip_amount = b.tip_amount;
    if (b.amount != null) patch.amount = b.amount;
    if (b.service_amount != null) patch.service_amount = b.service_amount;

    // If rescheduling, check conflicts
    if (b.start_at && b.barber_id) {
      const startAt = parseIso(b.start_at);
      const endAt = b.end_at ? parseIso(b.end_at) : (startAt ? addMinutes(startAt, b.duration_minutes || existing.data().duration_minutes || 30) : null);
      if (startAt && endAt) {
        try {
          await db.runTransaction(async (tx) => {
            await ensureNoConflictTx(tx, req.ws('bookings'), { barberId: b.barber_id, startAt, endAt, excludeBookingId: req.params.id });
            tx.update(ref, patch);
          });
          const saved = await ref.get();
          writeAuditLog(req.wsId, { action: 'booking.update', resource_id: req.params.id, data: patch, req }).catch(() => {});
          return res.json({ id: saved.id, ...saved.data() });
        } catch (e) {
          if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
          throw e;
        }
      }
    }

    await ref.update(patch);
    const saved = await ref.get();
    writeAuditLog(req.wsId, { action: 'booking.update', resource_id: req.params.id, data: patch, req }).catch(() => {});
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const ref = req.ws('bookings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });
    const bookingData = doc.data();
    await ref.update({ status: 'cancelled', updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'booking.cancelled', resource_id: req.params.id, req }).catch(() => {});
    // SMS cancellation notification
    if (bookingData.client_phone) {
      const cancelSettings = await req.ws('settings').doc('config').get();
      const cancelShopName = cancelSettings.exists ? safeStr(cancelSettings.data()?.shop_name || '') : '';
      const cancelPrefix = cancelShopName ? `${cancelShopName}: ` : '';
      sendSms(bookingData.client_phone, `${cancelPrefix}Your appointment with ${bookingData.barber_name || 'your barber'} has been cancelled. Reply STOP to unsubscribe.`).catch(() => {});
    }
    sendCrmPushToBarber(req.ws, bookingData.barber_id, 'Booking Cancelled', `${bookingData.client_name || 'Client'} cancelled`, { type: 'booking_cancelled' }).catch(() => {});
    // Email cancellation notification
    if (bookingData.client_email) {
      sendEmail(bookingData.client_email, 'Booking Cancelled', vuriumEmailTemplate('Booking Cancelled', `
        <p>Your appointment has been cancelled:</p>
        <div style="padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:#e8e8ed;">${bookingData.service_name || 'Appointment'}</div>
          <div style="color:rgba(255,255,255,.4);margin-top:4px;">with ${bookingData.barber_name || 'your specialist'}</div>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,.3);">To book a new appointment, visit our booking page.</p>
      `, cancelShopName), cancelShopName).catch(() => {});
    }
    res.json({ ok: true, id: req.params.id, status: 'cancelled' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// AVAILABILITY
// ============================================================
app.post('/api/availability', async (req, res) => {
  try {
    const b = req.body || {};
    const barberId = safeStr(b.barber_id);
    const startIso = b.start_at;
    const endIso = b.end_at;
    const durationMin = Math.max(1, Number(b.duration_minutes || 30));
    if (!barberId) return res.status(400).json({ error: 'barber_id required' });
    const start = parseIso(startIso);
    const end = parseIso(endIso);
    if (!start || !end) return res.status(400).json({ error: 'start_at and end_at required' });
    const range = clampDateRange(start, end);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });
    const barberDoc = await req.ws('barbers').doc(barberId).get();
    if (!barberDoc.exists || barberDoc.data()?.active === false) return res.status(404).json({ error: 'Barber not found' });
    const barber = barberDoc.data();

    // Get workspace timezone
    const settingsDoc = await req.ws('settings').doc('config').get();
    const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';

    const busy = await getBusyIntervalsForBarber(req.ws, barberId, toIso(range.start), toIso(range.end));
    const avail = [];
    for (const cur of eachTzDay(range.start, range.end, timeZone)) {
      const sch = getScheduleForDate(barber, cur, timeZone);
      let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone, busy });
      slots = slots.filter(t => t >= range.start && t < range.end);
      slots = slots.filter(t => t > new Date());
      slots = filterSlotsAgainstBusy(slots, busy, durationMin);
      for (const t of slots) avail.push({ start_at: toIso(t), local_day: getTzDateKey(t, timeZone) });
    }
    res.json({ time_zone: timeZone, availabilities: avail, slots: avail.map(x => x.start_at) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// USERS CRUD
// ============================================================
app.get('/api/users', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const snap = await req.ws('users').get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, username: data.username, name: data.name, role: data.role, active: data.active, barber_id: data.barber_id || null, phone: data.phone || null, photo_url: data.photo_url || null, created_at: data.created_at, updated_at: data.updated_at };
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/users', requireRole('owner'), async (req, res) => {
  try {
    const v = validate(UserCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { username, password, role, name, email, barber_id, mentor_barber_ids, phone } = v.data;
    // Check plan member limit
    const wsDoc = await req.wsDoc().get();
    const planType = wsDoc.exists ? (wsDoc.data()?.plan_type || 'individual') : 'individual';
    const planConfig = PLAN_FEATURES[planType] || PLAN_FEATURES.individual;
    if (planConfig.member_limit !== null) {
      const usersSnap = await req.ws('users').where('active', '==', true).get();
      if (usersSnap.size >= planConfig.member_limit) {
        return res.status(403).json({ error: `Your ${planType} plan allows ${planConfig.member_limit} user(s). Upgrade to add more team members.` });
      }
    }
    const usernameLC = username.toLowerCase();
    // Check uniqueness within workspace
    const existing = await req.ws('users').where('username', '==', usernameLC).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Username already exists' });
    const doc = {
      username: usernameLC,
      name: sanitizeHtml(name || username),
      email: email ? email.toLowerCase() : null,
      role: role || 'barber',
      password_hash: hashPassword(password),
      barber_id: barber_id || null,
      mentor_barber_ids: mentor_barber_ids || [],
      phone: phone || null,
      active: true,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('users').add(doc);
    writeAuditLog(req.wsId, { action: 'user.create', resource_id: ref.id, data: { username: usernameLC, role }, req }).catch(() => {});
    res.status(201).json({ id: ref.id, username: doc.username, name: doc.name, role: doc.role, active: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Students list (must be before /:id)
app.get('/api/users/students', async (req, res) => {
  try {
    const snap = await req.ws('users').where('role', '==', 'student').where('active', '==', true).get();
    let students = snap.docs.map(d => {
      const u = d.data();
      return { id: d.id, name: u.name || u.username, role: 'student', mentor_barber_ids: Array.isArray(u.mentor_barber_ids) ? u.mentor_barber_ids : [] };
    });
    if (req.user.role === 'barber' && req.user.barber_id) {
      students = students.filter(s => s.mentor_barber_ids.includes(req.user.barber_id));
    }
    res.json({ students });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const v = validate(UserPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const isSelf = req.params.id === req.user.uid;
    // Non-owners can only update their own notification_prefs and photo
    if (!isSelf && req.user.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
    const ref = req.ws('users').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'User not found' });
    const b = v.data;
    const patch = { updated_at: toIso(new Date()) };
    if (isSelf) {
      // Self-update: notification_prefs, photo_url, schedule, email
      if (b.notification_prefs) patch.notification_prefs = b.notification_prefs;
      if (b.photo_url != null) patch.photo_url = b.photo_url || null;
      if (b.schedule) patch.schedule = b.schedule;
      if (b.email != null) patch.email = b.email ? b.email.toLowerCase() : null;
    }
    if (req.user.role === 'owner') {
      if (b.name != null) patch.name = sanitizeHtml(b.name);
      if (b.email != null) patch.email = b.email ? b.email.toLowerCase() : null;
      if (b.role != null) patch.role = b.role;
      if (b.active != null) patch.active = b.active;
      if (b.barber_id != null) patch.barber_id = b.barber_id;
      if (b.mentor_barber_ids != null) patch.mentor_barber_ids = b.mentor_barber_ids;
      if (b.phone != null) patch.phone = b.phone;
      if (b.photo_url != null) patch.photo_url = b.photo_url || null;
      if (b.password) patch.password_hash = hashPassword(b.password);
      if (b.notification_prefs) patch.notification_prefs = b.notification_prefs;
      if (b.schedule) patch.schedule = b.schedule;
    }
    await ref.update(patch);
    writeAuditLog(req.wsId, { action: 'user.update', resource_id: req.params.id, data: { role: b.role }, req }).catch(() => {});
    const saved = await ref.get();
    const data = saved.data();
    res.json({ id: saved.id, username: data.username, name: data.name, role: data.role, active: data.active, barber_id: data.barber_id, phone: data.phone, notification_prefs: data.notification_prefs || {} });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/users/:id', requireRole('owner'), async (req, res) => {
  try {
    if (req.params.id === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    const ref = req.ws('users').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'User not found' });
    await ref.update({ active: false, deleted: true, updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'user.delete', resource_id: req.params.id, req }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PAYMENTS (Square + local)
// ============================================================
app.get('/api/payments', async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    const barberId = safeStr(req.query?.barber_id || '');
    // Local payment_requests
    const prSnap = await req.ws('payment_requests').orderBy('created_at', 'desc').limit(200).get();
    let payments = prSnap.docs.map(d => ({ id: d.id, source: 'local', ...d.data() }));
    // Try to get Square payments too
    try {
      const headers = await squareHeaders(req.ws);
      const params = new URLSearchParams();
      if (from) params.set('begin_time', from);
      if (to) params.set('end_time', to);
      const sqResp = await squareFetch(`/v2/payments?${params}`, { headers });
      if (sqResp.ok) {
        const sqData = await sqResp.json();
        const sqPayments = (sqData.payments || []).map(p => ({
          id: p.id, source: 'square', payment_id: p.id,
          amount_cents: p.amount_money?.amount || 0, tip_cents: p.tip_money?.amount || 0,
          status: (p.status || '').toLowerCase(), created_at: p.created_at,
          card_brand: p.card_details?.card?.card_brand, last_4: p.card_details?.card?.last_4,
        }));
        // Merge, dedup by payment_id
        const existingIds = new Set(payments.map(p => p.payment_id).filter(Boolean));
        for (const sp of sqPayments) {
          if (!existingIds.has(sp.payment_id)) payments.push(sp);
        }
      }
    } catch {}
    // Enrich with booking data
    for (const p of payments) {
      if (p.booking_id) {
        try {
          const bDoc = await req.ws('bookings').doc(p.booking_id).get();
          if (bDoc.exists) {
            const bd = bDoc.data();
            p.client_name = bd.client_name;
            p.barber_id = bd.barber_id;
            p.barber_name = bd.barber_name;
            p.service_name = bd.service_name;
          }
        } catch {}
      }
    }
    if (barberId) payments = payments.filter(p => p.barber_id === barberId);
    if (from) payments = payments.filter(p => (p.created_at || '') >= from);
    if (to) payments = payments.filter(p => (p.created_at || '') <= to);
    // Totals
    const totalGross = payments.reduce((s, p) => s + (Number(p.amount_cents || 0) / 100), 0);
    const totalTips = payments.reduce((s, p) => s + (Number(p.tip_cents || 0) / 100), 0);
    res.json({ payments, totals: { gross: totalGross, tips: totalTips, count: payments.length } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// MEMBERSHIPS CRUD
// ============================================================
app.get('/api/memberships', requirePlanFeature('membership'), async (req, res) => {
  try {
    const snap = await req.ws('memberships').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/memberships', requirePlanFeature('membership'), requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.client_name) return res.status(400).json({ error: 'client_name required' });
    const doc = {
      client_name: sanitizeHtml(safeStr(b.client_name)),
      barber_id: safeStr(b.barber_id) || null,
      barber_name: sanitizeHtml(safeStr(b.barber_name)) || null,
      service_id: safeStr(b.service_id) || null,
      service_name: sanitizeHtml(safeStr(b.service_name)) || null,
      status: 'active',
      frequency: safeStr(b.frequency || 'weekly'),
      duration_minutes: Number(b.duration_minutes || 30),
      discount_pct: Number(b.discount_pct || 0),
      next_booking_at: b.next_booking_at || toIso(new Date()),
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('memberships').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/memberships/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('memberships').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Membership not found' });
    const b = req.body || {};
    const patch = { updated_at: toIso(new Date()) };
    if (b.status != null) patch.status = b.status;
    if (b.frequency != null) patch.frequency = b.frequency;
    if (b.duration_minutes != null) patch.duration_minutes = Number(b.duration_minutes);
    if (b.discount_pct != null) patch.discount_pct = Number(b.discount_pct);
    if (b.next_booking_at != null) patch.next_booking_at = b.next_booking_at;
    await ref.update(patch);
    const saved = await ref.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/memberships/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('memberships').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Membership not found' });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// EXPENSES CRUD
// ============================================================
// NOTE: /categories and /total MUST be before /:id to avoid Express treating them as :id
app.get('/api/expenses/categories', requirePlanFeature('expenses'), async (req, res) => {
  try {
    const snap = await req.ws('expense_categories').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/expenses/categories', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const name = sanitizeHtml(safeStr(req.body?.name));
    if (!name) return res.status(400).json({ error: 'name required' });
    const ref = await req.ws('expense_categories').add({ name, created_at: toIso(new Date()) });
    res.status(201).json({ id: ref.id, name });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/expenses/total', requirePlanFeature('expenses'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    let query = req.ws('expenses');
    if (from) query = query.where('date', '>=', from);
    if (to) query = query.where('date', '<=', to);
    const snap = await query.get();
    const total = snap.docs.reduce((sum, d) => sum + Number(d.data()?.amount || 0), 0);
    res.json({ total, count: snap.size });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/expenses', requirePlanFeature('expenses'), async (req, res) => {
  try {
    const snap = await req.ws('expenses').orderBy('date', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/expenses', requirePlanFeature('expenses'), async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      date: safeStr(b.date) || toIso(new Date()).slice(0, 10),
      amount: Number(b.amount || 0),
      category: sanitizeHtml(safeStr(b.category)) || 'Other',
      description: sanitizeHtml(safeStr(b.description)) || null,
      created_by: req.user.uid,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('expenses').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/expenses/:id', async (req, res) => {
  try {
    const ref = req.ws('expenses').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Expense not found' });
    const b = req.body || {};
    const patch = { updated_at: toIso(new Date()) };
    if (b.date != null) patch.date = b.date;
    if (b.amount != null) patch.amount = Number(b.amount);
    if (b.category != null) patch.category = sanitizeHtml(safeStr(b.category));
    if (b.description != null) patch.description = sanitizeHtml(safeStr(b.description));
    await ref.update(patch);
    const saved = await ref.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const ref = req.ws('expenses').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Expense not found' });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// ATTENDANCE
// ============================================================
app.get('/api/attendance', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const snap = await req.ws('attendance').orderBy('date', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/attendance/status', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    const today = new Date().toISOString().slice(0, 10);
    const snap = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', today)
      .limit(1).get();
    if (snap.empty) return res.json({ clocked_in: false });
    const data = snap.docs[0].data();
    res.json({ clocked_in: !data.clock_out, ...data, id: snap.docs[0].id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-in', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Optional GPS geofence check
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (lat && lng) {
      const settingsDoc = await req.ws('settings').doc('config').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};
      if (settings.geofence_lat && settings.geofence_lng) {
        const dist = haversineMeters(lat, lng, Number(settings.geofence_lat), Number(settings.geofence_lng));
        const radius = Number(settings.geofence_radius_m || 500);
        if (dist > radius) return res.status(403).json({ error: 'You are too far from the shop to clock in', distance_m: Math.round(dist) });
      }
    }
    const doc = {
      user_id: userId,
      user_name: req.user.name || req.user.username,
      barber_id: req.user.barber_id || null,
      role: req.user.role,
      date: today,
      clock_in: toIso(now),
      clock_out: null,
      lat: lat || null, lng: lng || null,
      created_at: toIso(now),
    };
    const ref = await req.ws('attendance').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-out', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    const today = new Date().toISOString().slice(0, 10);
    const snap = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', today)
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'No clock-in found for today' });
    const docRef = snap.docs[0].ref;
    await docRef.update({ clock_out: toIso(new Date()) });
    const saved = await docRef.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/admin-clock-out', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const userId = safeStr(req.body?.user_id || '');
    const date = safeStr(req.body?.date || new Date().toISOString().slice(0, 10));
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const snap = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', date)
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'No clock-in found' });
    const docRef = snap.docs[0].ref;
    const clockOutTime = req.body?.clock_out ? toIso(parseIso(req.body.clock_out) || new Date()) : toIso(new Date());
    await docRef.update({ clock_out: clockOutTime, admin_clock_out: true, admin_id: req.user.uid });
    const saved = await docRef.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// REVIEWS CRUD
// ============================================================
app.get('/api/reviews', async (req, res) => {
  try {
    const snap = await req.ws('reviews').orderBy('created_at', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      client_name: sanitizeHtml(safeStr(b.client_name)) || 'Anonymous',
      barber_id: safeStr(b.barber_id) || null,
      barber_name: sanitizeHtml(safeStr(b.barber_name)) || null,
      rating: Math.min(5, Math.max(1, Number(b.rating || 5))),
      text: sanitizeHtml(safeStr(b.text)) || null,
      status: 'pending',
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('reviews').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/reviews/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('reviews').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Review not found' });
    const patch = { updated_at: toIso(new Date()) };
    if (req.body?.status != null) patch.status = req.body.status;
    if (req.body?.text != null) patch.text = sanitizeHtml(req.body.text);
    await ref.update(patch);
    const saved = await ref.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/reviews/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('reviews').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Review not found' });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// MESSAGES
// ============================================================
app.get('/api/messages', requirePlanFeature('messages'), async (req, res) => {
  try {
    const chatType = safeStr(req.query?.chatType || 'general');
    // 'team' includes old 'general' messages for backward compat
    const snap = chatType === 'team'
      ? await req.ws('messages').where('chatType', 'in', ['team', 'general']).orderBy('createdAt', 'desc').limit(100).get()
      : await req.ws('messages').where('chatType', '==', chatType).orderBy('createdAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/messages', requirePlanFeature('messages'), async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      content: sanitizeHtml(safeStr(b.content || b.text)),
      chatType: safeStr(b.chatType || 'general'),
      sender_id: req.user.uid,
      sender_name: req.user.name || req.user.username,
      sender_role: req.user.role,
      createdAt: toIso(new Date()),
    };
    // Allow media-only messages (image, audio, file)
    if (b.imageUrl) doc.imageUrl = safeStr(b.imageUrl);
    if (b.audioUrl) doc.audioUrl = safeStr(b.audioUrl);
    if (b.fileUrl) doc.fileUrl = safeStr(b.fileUrl);
    if (b.fileName) doc.fileName = safeStr(b.fileName);
    if (b.senderPhoto) doc.senderPhoto = safeStr(b.senderPhoto);
    if (!doc.content && !doc.imageUrl && !doc.audioUrl && !doc.fileUrl) return res.status(400).json({ error: 'content required' });
    const ref = await req.ws('messages').add(doc);
    // Push notification — DMs go to specific user, group chats broadcast by role
    const pushTitle = doc.chatType.startsWith('dm_') ? doc.sender_name : `Chat: ${doc.sender_name}`;
    const pushBody = doc.content ? doc.content.slice(0, 100) : (doc.imageUrl ? '📷 Photo' : doc.audioUrl ? '🎤 Voice' : '📎 File');
    const pushData = { type: 'message', chatType: doc.chatType };
    if (doc.chatType.startsWith('dm_')) {
      // DM: push only to the other user
      const parts = doc.chatType.split('_');
      const otherUid = parts[1] === req.user.uid ? parts[2] : parts[1];
      sendCrmPush(req.ws, otherUid, pushTitle, pushBody, pushData).catch(() => {});
    } else {
      const chatRoleMap = { general: ['owner', 'admin', 'barber'], team: ['owner', 'admin', 'barber'], barbers: ['barber'], admins: ['owner', 'admin'], students: ['student'] };
      const targetRoles = chatRoleMap[doc.chatType] || ['owner', 'admin', 'barber'];
      sendCrmPushToRoles(req.ws, targetRoles, pushTitle, pushBody, pushData).catch(() => {});
    }
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PAYROLL
// ============================================================
app.get('/api/payroll', requirePlanFeature('payroll'), requireRole('owner'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    // Fetch bookings and barber profiles in parallel
    let query = req.ws('bookings');
    if (from) query = query.where('start_at', '>=', from);
    if (to) query = query.where('start_at', '<=', to);
    const [snap, barbersSnap] = await Promise.all([
      query.get(),
      req.ws('barbers').get(),
    ]);
    const barberProfiles = {};
    barbersSnap.docs.forEach(d => { const data = d.data() || {}; barberProfiles[d.id] = data; });
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Group by barber with full booking details
    const byBarber = {};
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      const bid = b.barber_id || 'unknown';
      const profile = barberProfiles[bid] || {};
      if (!byBarber[bid]) byBarber[bid] = {
        barber_id: bid,
        barber_name: profile.name || b.barber_name || b.barber || bid,
        barber_photo: profile.photo || profile.avatar || '',
        barber_level: profile.level || '',
        bookings_count: 0, client_count: 0,
        service_total: 0, tips_total: 0,
        bookings: [],
      };
      byBarber[bid].bookings_count++;
      byBarber[bid].service_total += Number(b.service_amount || b.amount || 0);
      byBarber[bid].tips_total += Number(b.tip || b.tip_amount || 0);
      byBarber[bid].bookings.push({
        id: b.id,
        date: (b.start_at || b.date || '').slice(0, 10),
        client: b.client_name || b.client || '',
        service: b.service_name || b.service || '',
        service_amount: Number(b.service_amount || b.amount || 0),
        tip: Number(b.tip || b.tip_amount || 0),
        status: b.status || '',
        paid: !!b.paid,
        payment_method: b.payment_method || '',
      });
    }
    // client_count = unique clients per barber
    for (const bid of Object.keys(byBarber)) {
      const clients = new Set(byBarber[bid].bookings.map(bk => bk.client).filter(Boolean));
      byBarber[bid].client_count = clients.size || byBarber[bid].bookings_count;
    }
    res.json({ barbers: Object.values(byBarber), period: { from, to } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/payroll/rules', requirePlanFeature('payroll'), requireRole('owner'), async (req, res) => {
  try {
    const snap = await req.ws('payroll_rules').get();
    const rules = {};
    snap.docs.forEach(d => { rules[d.id] = { id: d.id, ...d.data() }; });
    res.json({ rules });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/payroll/rules/:id', requireRole('owner'), async (req, res) => {
  try {
    const b = req.body || {};
    const patch = { updated_at: toIso(new Date()) };
    // Barber commission fields
    if (b.base_pct != null) patch.base_pct = Math.max(0, Math.min(100, Number(b.base_pct) || 0));
    if (b.tips_pct != null) patch.tips_pct = Math.max(0, Math.min(100, Number(b.tips_pct) || 0));
    if (b.tiers != null && Array.isArray(b.tiers)) patch.tiers = b.tiers.map(t => ({
      type: t.type === 'clients' ? 'clients' : 'revenue',
      threshold: Math.max(0, Number(t.threshold) || 0),
      pct: Math.max(0, Math.min(100, Number(t.pct) || 0)),
    }));
    if (b.custom_bonuses != null && Array.isArray(b.custom_bonuses)) patch.custom_bonuses = b.custom_bonuses.map(cb => ({
      label: safeStr(cb.label || ''),
      type: ['percent_revenue', 'percent_owner', 'fixed'].includes(cb.type) ? cb.type : 'fixed',
      value: Number(cb.value) || 0,
    }));
    if (b.late_penalty_per_min != null) patch.late_penalty_per_min = Math.max(0, Number(b.late_penalty_per_min) || 0);
    if (b.late_reset_at != null) patch.late_reset_at = safeStr(b.late_reset_at);
    // Admin payroll fields
    if (b.hourly_rate != null) patch.hourly_rate = Math.max(0, Number(b.hourly_rate) || 0);
    if (b.owner_profit_pct != null) patch.owner_profit_pct = Math.max(0, Math.min(100, Number(b.owner_profit_pct) || 0));
    if (b.service_fee_pct != null) patch.service_fee_pct = Math.max(0, Math.min(100, Number(b.service_fee_pct) || 0));
    if (b.service_fee_days != null && Array.isArray(b.service_fee_days)) patch.service_fee_days = b.service_fee_days.filter(d => typeof d === 'number' && d >= 0 && d <= 6);
    // Legacy fields
    if (b.commission_pct != null) patch.commission_pct = Math.max(0, Math.min(100, Number(b.commission_pct) || 0));
    if (b.tip_pct != null) patch.tip_pct = Math.max(0, Math.min(100, Number(b.tip_pct) || 0));
    if (b.type != null) patch.type = safeStr(b.type);
    if (b.barber_id != null) patch.barber_id = safeStr(b.barber_id);
    const ref = req.ws('payroll_rules').doc(req.params.id);
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    res.json({ id: saved.id, ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SETTINGS
// ============================================================
app.get('/api/settings', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    res.json(doc.exists ? { id: 'config', ...doc.data() } : {});
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Timezone endpoint — available to all authenticated users (not just owner/admin)
app.get('/api/settings/timezone', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    res.json({ timezone: doc.exists ? (doc.data()?.timezone || 'America/Chicago') : 'America/Chicago' });
  } catch (e) { res.status(500).json({ timezone: 'America/Chicago' }); }
});

app.post('/api/settings', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const ALLOWED_SETTINGS = ['timezone', 'shop_name', 'shop_address', 'shop_phone', 'shop_email',
      'booking_buffer_minutes', 'default_duration_minutes', 'currency', 'locale',
      'sms_enabled', 'push_enabled', 'booking_confirmation', 'hero_url', 'logo_url',
      'geofence_lat', 'geofence_lng', 'geofence_radius_m', 'theme', 'custom_css',
      'dash_calendar', 'dash_clients', 'dash_payments', 'dash_waitlist', 'dash_portfolio',
      'dash_cash', 'dash_membership', 'dash_attendance', 'dash_expenses', 'dash_payroll',
      'clock_in_enabled', 'waitlist_enabled', 'portfolio_enabled', 'membership_enabled', 'cash_register_enabled',
      'dash_shortcuts', 'dash_widgets'];
    const patch = { updated_at: toIso(new Date()) };
    for (const key of ALLOWED_SETTINGS) {
      if (b[key] !== undefined) patch[key] = typeof b[key] === 'string' ? sanitizeHtml(b[key]) : b[key];
    }
    // Slug update — on workspace doc, not settings
    if (b.slug !== undefined) {
      const newSlug = slugify(b.slug);
      if (newSlug && newSlug.length >= 2) {
        const wsDoc = await req.wsDoc().get();
        const oldSlug = wsDoc.exists ? wsDoc.data()?.slug : null;
        if (newSlug !== oldSlug) {
          const existing = await db.collection('slugs').doc(newSlug).get();
          if (existing.exists && existing.data()?.workspace_id !== req.wsId) {
            return res.status(409).json({ error: 'This URL is already taken. Try a different one.' });
          }
          if (oldSlug) await db.collection('slugs').doc(oldSlug).delete().catch(() => {});
          await registerSlug(newSlug, req.wsId);
          await req.wsDoc().update({ slug: newSlug, updated_at: toIso(new Date()) });
        }
      }
    }
    // Nested objects — stored on settings doc
    if (b.tax !== undefined && typeof b.tax === 'object') patch.tax = b.tax;
    if (b.payroll !== undefined && typeof b.payroll === 'object') patch.payroll = b.payroll;
    // Site config — stored on workspace doc for custom plan
    if (b.site_config !== undefined && typeof b.site_config === 'object') {
      // Sanitize custom HTML — strip <script>, <iframe>, event handlers, javascript: urls
      if (b.site_config.custom_html) {
        b.site_config.custom_html = b.site_config.custom_html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<script[^>]*>/gi, '')
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          .replace(/<iframe[^>]*>/gi, '')
          .replace(/<object[\s\S]*?<\/object>/gi, '')
          .replace(/<embed[^>]*>/gi, '')
          .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
          .replace(/\bon\w+\s*=\s*\S+/gi, '')
          .replace(/javascript\s*:/gi, '')
          .replace(/data\s*:\s*text\/html/gi, '');
      }
      // Sanitize custom CSS — strip expressions and imports
      if (b.site_config.custom_css) {
        b.site_config.custom_css = b.site_config.custom_css
          .replace(/@import\b[^;]*/gi, '')
          .replace(/expression\s*\(/gi, '')
          .replace(/javascript\s*:/gi, '')
          .replace(/url\s*\(\s*["']?\s*javascript:/gi, 'url(');
      }
      await req.wsDoc().update({ site_config: b.site_config, updated_at: toIso(new Date()) });
    }
    const ref = req.ws('settings').doc('config');
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    res.json({ id: 'config', ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// AUDIT LOGS
// ============================================================
app.get('/api/audit-logs', requireRole('owner'), async (req, res) => {
  try {
    const snap = await req.ws('audit_logs').orderBy('created_at', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// CASH REPORTS
// ============================================================
app.get('/api/cash-reports', requirePlanFeature('cash_register'), async (req, res) => {
  try {
    const snap = await req.ws('cash_reports').orderBy('date', 'desc').limit(60).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/cash-reports', requirePlanFeature('cash_register'), async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      date: safeStr(b.date) || new Date().toISOString().slice(0, 10),
      amount: Number(b.amount || 0),
      notes: sanitizeHtml(safeStr(b.notes)) || null,
      created_by: req.user.uid,
      created_at: toIso(new Date()),
    };
    const ref = await req.ws('cash_reports').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// WAITLIST CRUD
// ============================================================
app.get('/api/waitlist', requirePlanFeature('waitlist'), async (req, res) => {
  try {
    const date = safeStr(req.query?.date || '');
    const barberId = safeStr(req.query?.barber_id || '');
    let query = req.ws('waitlist').where('notified', '==', false);
    if (date) query = query.where('date', '==', date);
    const snap = await query.orderBy('created_at', 'desc').limit(100).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (barberId) list = list.filter(w => w.barber_id === barberId);
    if (req.user.role === 'barber' && req.user.barber_id) {
      list = list.filter(w => w.barber_id === req.user.barber_id);
    }
    res.json({ waitlist: list });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/waitlist', requirePlanFeature('waitlist'), async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      phone_norm: normPhone(safeStr(b.phone)),
      phone_raw: safeStr(b.phone),
      client_name: sanitizeHtml(safeStr(b.client_name)) || null,
      barber_id: safeStr(b.barber_id),
      barber_name: safeStr(b.barber_name),
      date: safeStr(b.date),
      service_ids: Array.isArray(b.service_ids) ? b.service_ids : [],
      service_names: Array.isArray(b.service_names) ? b.service_names : [],
      duration_minutes: Math.max(1, Number(b.duration_minutes || 30)),
      preferred_start_min: Math.max(0, Number(b.preferred_start_min || 0)),
      preferred_end_min: Math.min(1440, Number(b.preferred_end_min || 1440)),
      notified: false,
      added_by: req.user.uid,
      created_at: toIso(new Date()),
    };
    if (!doc.barber_id || !doc.date) return res.status(400).json({ error: 'barber_id and date required' });
    const ref = await req.ws('waitlist').add(doc);
    sendCrmPushToStaff(req.ws, doc.barber_id, 'Waitlist', `${doc.client_name || 'Client'} wants ${doc.date}`, { type: 'waitlist' }).catch(() => {});
    res.status(201).json({ ok: true, id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/waitlist/:id', requirePlanFeature('waitlist'), async (req, res) => {
  try {
    const ref = req.ws('waitlist').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const action = safeStr(req.body?.action || '');
    if (action === 'confirm') {
      await ref.update({ notified: true, confirmed: true, confirmed_at: toIso(new Date()), confirmed_by: req.user.uid });
      return res.json({ ok: true, confirmed: true });
    }
    if (action === 'remove') {
      await ref.update({ notified: true, removed: true, removed_at: toIso(new Date()) });
      return res.json({ ok: true, removed: true });
    }
    res.status(400).json({ error: 'action must be confirm or remove' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/admin/waitlist/check', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const settingsDoc = await req.ws('settings').doc('config').get();
    const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    const now = new Date();
    const todayKey = getTzDateKey(now, timeZone);
    const tomorrowKey = getTzDateKey(new Date(now.getTime() + 86400000), timeZone);
    const waitSnap = await req.ws('waitlist').where('notified', '==', false).get();
    const pending = waitSnap.docs.filter(d => [todayKey, tomorrowKey].includes(d.data().date));
    if (!pending.length) return res.json({ ok: true, checked: 0, notified: 0 });
    let notified = 0;
    for (const wDoc of pending) {
      const w = wDoc.data();
      try {
        const barberDoc = await req.ws('barbers').doc(w.barber_id).get();
        if (!barberDoc.exists || barberDoc.data()?.active === false) continue;
        const barber = barberDoc.data();
        const dateObj = new Date(w.date + 'T00:00:00');
        const busy = await getBusyIntervalsForBarber(req.ws, w.barber_id, toIso(dateObj), toIso(new Date(dateObj.getTime() + 86400000)));
        const sch = getScheduleForDate(barber, dateObj, timeZone);
        let slots = buildSmartSlotsForDay({ dayDateUTC: dateObj, schedule: sch, durationMin: w.duration_minutes, stepMin: w.duration_minutes, timeZone, busy });
        slots = filterSlotsAgainstBusy(slots, busy, w.duration_minutes);
        slots = slots.filter(t => t > now);
        if (w.preferred_start_min || w.preferred_end_min < 1440) {
          slots = slots.filter(t => {
            const p = getTzParts(t, timeZone);
            const slotMin = p.hour * 60 + p.minute;
            return slotMin >= (w.preferred_start_min || 0) && slotMin < (w.preferred_end_min || 1440);
          });
        }
        if (!slots.length) continue;
        const slotTime = slots[0].toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
        const svcText = Array.isArray(w.service_names) && w.service_names.length ? w.service_names.join(', ') : 'your service';
        const wlSettings = await req.ws('settings').doc('config').get();
        const wlShopName = wlSettings.exists ? safeStr(wlSettings.data()?.shop_name || '') : '';
        const wlPrefix = wlShopName || 'VuriumBook';
        const msg = `${wlPrefix}: A spot opened up for ${svcText} with ${w.barber_name || 'your barber'} on ${w.date} at ${slotTime}. Book now! Reply STOP to unsubscribe.`;
        sendSms(w.phone_raw || w.phone_norm, msg).catch(() => {});
        await wDoc.ref.update({ notified: true, notified_at: toIso(new Date()), notified_slot: toIso(slots[0]) });
        notified++;
      } catch (e) { console.warn('waitlist check error for', wDoc.id, e?.message); }
    }
    res.json({ ok: true, checked: pending.length, notified });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// APPLICATIONS CRUD
// ============================================================
app.get('/api/applications', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const statusFilter = safeStr(req.query?.status || '');
    const typeFilter = safeStr(req.query?.type || '');
    const limitN = Math.min(200, Math.max(1, Number(req.query?.limit || 100)));
    const snap = await req.ws('applications').orderBy('created_at', 'desc').limit(limitN).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (typeFilter) list = list.filter(a => String(a.type || a.role || '').toLowerCase().includes(typeFilter.toLowerCase()));
    res.json({ applications: list, count: list.length });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/applications/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const status = safeStr(req.body?.status || '');
    const notes = safeStr(req.body?.notes || '');
    if (!['new', 'reviewed', 'interview', 'hired', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const ref = req.ws('applications').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Not found' });
    const patch = { status, updated_at: toIso(new Date()), reviewed_by: safeStr(req.user.name || req.user.username) };
    if (notes) patch.notes = sanitizeHtml(notes);
    await ref.update(patch);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/applications/:id', requireRole('owner'), async (req, res) => {
  try {
    await req.ws('applications').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// REQUESTS CRUD (Staff Requests)
// ============================================================
app.get('/api/requests', async (req, res) => {
  try {
    const snap = await req.ws('requests').orderBy('createdAt', 'desc').limit(100).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (req.user.role === 'barber' && req.user.barber_id) {
      list = list.filter(r => r.barberId === req.user.barber_id);
    }
    res.json({ requests: list });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/requests', async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      type: safeStr(b.type || 'schedule_change'),
      barberId: safeStr(b.barberId || req.user.barber_id || ''),
      barberName: sanitizeHtml(safeStr(b.barberName || req.user.name || '')),
      status: 'pending',
      data: b.data || {},
      notes: sanitizeHtml(safeStr(b.notes || '')),
      createdBy: req.user.uid,
      createdAt: toIso(new Date()),
      updatedAt: toIso(new Date()),
    };
    const ref = await req.ws('requests').add(doc);
    sendCrmPushToRoles(req.ws, ['owner', 'admin'], 'New Request', `${doc.barberName} submitted a ${doc.type} request`, { type: 'request' }).catch(() => {});
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.patch('/api/requests/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.ws('requests').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const status = safeStr(req.body?.status || '');
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Use approved or rejected' });
    const requestData = doc.data();
    const patch = { status, reviewedBy: safeStr(req.user.name || req.user.username), reviewedAt: toIso(new Date()), updatedAt: toIso(new Date()) };
    if (req.body?.adminNotes) patch.adminNotes = sanitizeHtml(safeStr(req.body.adminNotes));
    // Auto-apply on approval
    if (status === 'approved' && requestData.barberId && requestData.data) {
      try {
        const barberId = requestData.barberId;
        const data = requestData.data;
        if (requestData.type === 'schedule_change' && data.schedule) {
          await req.ws('barbers').doc(barberId).update({ schedule: normalizeSchedule(data.schedule), updated_at: toIso(new Date()) });
        }
        if (requestData.type === 'photo_change' && data.photo_url) {
          await req.ws('barbers').doc(barberId).update({ photo_url: data.photo_url, updated_at: toIso(new Date()) });
        }
        if (requestData.type === 'profile_change') {
          const profilePatch = { updated_at: toIso(new Date()) };
          if (data.name) profilePatch.name = sanitizeHtml(data.name);
          if (data.level) profilePatch.level = data.level;
          await req.ws('barbers').doc(barberId).update(profilePatch);
        }
      } catch (e) { console.warn('Auto-apply request error:', e?.message); }
    }
    await ref.update(patch);
    // Notify barber
    sendCrmPushToBarber(req.ws, requestData.barberId, `Request ${status}`, `Your ${requestData.type} request was ${status}`, { type: 'request_update' }).catch(() => {});
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SQUARE OAUTH ROUTES
// ============================================================
app.get('/api/square/oauth/url', requireRole('owner'), async (req, res) => {
  try {
    if (!SQUARE_APP_ID) return res.status(400).json({ error: 'Square App ID not configured' });
    const scopes = 'PAYMENTS_READ PAYMENTS_WRITE ORDERS_READ MERCHANT_PROFILE_READ DEVICES_READ CUSTOMERS_READ CUSTOMERS_WRITE';
    const redirectUri = `${req.protocol}://${req.get('host')}/api/square/oauth/callback`;
    const state = req.wsId;
    const url = `${SQUARE_BASE}/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${encodeURIComponent(scopes)}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/square/oauth/status', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('square_oauth').get();
    if (!doc.exists || !doc.data()?.access_token) return res.json({ connected: false });
    const data = doc.data();
    res.json({ connected: true, merchant_id: data.merchant_id || null, connected_at: data.connected_at || null });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/square/oauth/disconnect', requireRole('owner'), async (req, res) => {
  try {
    await req.ws('settings').doc('square_oauth').delete();
    res.json({ ok: true, disconnected: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// STRIPE CONNECT (for accepting client payments)
// ============================================================
const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || '';

// Create Express Connect account and return onboarding URL
app.get('/api/stripe-connect/oauth/url', requireRole('owner'), async (req, res) => {
  try {
    if (!STRIPE_SECRET) return res.status(400).json({ error: 'Stripe not configured' });
    // Check if already connected
    const existing = await req.ws('settings').doc('stripe_connect').get();
    if (existing.exists && existing.data()?.account_id) {
      return res.status(400).json({ error: 'Already connected. Disconnect first.' });
    }
    // Create Express account
    const account = await stripeFetch('/v1/accounts', {
      method: 'POST',
      body: new URLSearchParams({
        type: 'express',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'metadata[workspace_id]': req.wsId,
      }).toString(),
    });
    // Save account_id immediately
    await req.ws('settings').doc('stripe_connect').set({
      account_id: account.id,
      connected_at: toIso(new Date()),
      onboarding_complete: false,
    });
    // Create account link for onboarding
    const accountLink = await stripeFetch('/v1/account_links', {
      method: 'POST',
      body: new URLSearchParams({
        account: account.id,
        refresh_url: `${FRONTEND_URL}/settings?tab=square&stripe=refresh`,
        return_url: `${FRONTEND_URL}/settings?tab=square&stripe=connected`,
        type: 'account_onboarding',
      }).toString(),
    });
    res.json({ url: accountLink.url });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Check Stripe Connect status
app.get('/api/stripe-connect/status', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('stripe_connect').get();
    if (!doc.exists || !doc.data()?.account_id) {
      return res.json({ connected: false });
    }
    const data = doc.data();
    // Check account status from Stripe
    let charges_enabled = false, payouts_enabled = false;
    if (STRIPE_SECRET && data.account_id) {
      try {
        const acct = await stripeFetch(`/v1/accounts/${data.account_id}`);
        charges_enabled = !!acct.charges_enabled;
        payouts_enabled = !!acct.payouts_enabled;
        // Update onboarding status
        if (charges_enabled && !data.onboarding_complete) {
          await req.ws('settings').doc('stripe_connect').update({ onboarding_complete: true });
        }
      } catch {}
    }
    res.json({
      connected: true,
      account_id: data.account_id,
      connected_at: data.connected_at,
      charges_enabled,
      payouts_enabled,
      onboarding_complete: data.onboarding_complete || charges_enabled,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Resume onboarding (if user didn't finish)
app.get('/api/stripe-connect/onboarding-url', requireRole('owner'), async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('stripe_connect').get();
    if (!doc.exists || !doc.data()?.account_id) {
      return res.status(400).json({ error: 'Not connected. Start connection first.' });
    }
    const accountLink = await stripeFetch('/v1/account_links', {
      method: 'POST',
      body: new URLSearchParams({
        account: doc.data().account_id,
        refresh_url: `${FRONTEND_URL}/settings?tab=square&stripe=refresh`,
        return_url: `${FRONTEND_URL}/settings?tab=square&stripe=connected`,
        type: 'account_onboarding',
      }).toString(),
    });
    res.json({ url: accountLink.url });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Disconnect Stripe Connect
app.post('/api/stripe-connect/disconnect', requireRole('owner'), async (req, res) => {
  try {
    await req.ws('settings').doc('stripe_connect').delete();
    res.json({ ok: true, disconnected: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Create Payment Intent on connected account (authenticated — staff use)
app.post('/api/stripe-connect/create-payment-intent', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('stripe_connect').get();
    if (!doc.exists || !doc.data()?.account_id) {
      return res.status(400).json({ error: 'Stripe not connected' });
    }
    const b = req.body || {};
    const amountCents = Math.round(Number(b.amount_cents) || 0);
    if (amountCents < 50) return res.status(400).json({ error: 'Amount too small (min $0.50)' });
    const connectedAccountId = doc.data().account_id;
    const platformFee = Math.round(amountCents * 0.02); // 2% platform fee
    const pi = await stripeFetch('/v1/payment_intents', {
      method: 'POST',
      body: new URLSearchParams({
        amount: String(amountCents),
        currency: b.currency || 'usd',
        'payment_method_types[0]': 'card',
        'payment_method_types[1]': 'apple_pay',
        'payment_method_types[2]': 'google_pay',
        application_fee_amount: String(platformFee),
        'transfer_data[destination]': connectedAccountId,
        'metadata[booking_id]': safeStr(b.booking_id || ''),
        'metadata[workspace_id]': req.wsId,
        description: safeStr(b.description || 'VuriumBook payment'),
      }).toString(),
    });
    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Create Payment Intent on connected account (PUBLIC — booking page)
app.post('/public/stripe-connect/create-payment-intent/:wsId', async (req, res) => {
  try {
    const wsId = safeStr(req.params.wsId);
    if (!wsId) return res.status(400).json({ error: 'Missing workspace' });
    const wsCol = (col) => db.collection(`workspaces/${wsId}/${col}`);
    const doc = await wsCol('settings').doc('stripe_connect').get();
    if (!doc.exists || !doc.data()?.account_id) {
      return res.status(400).json({ error: 'Online payments not available' });
    }
    const b = req.body || {};
    const amountCents = Math.round(Number(b.amount_cents) || 0);
    if (amountCents < 50) return res.status(400).json({ error: 'Amount too small' });
    const connectedAccountId = doc.data().account_id;
    const platformFee = Math.round(amountCents * 0.02);
    const pi = await stripeFetch('/v1/payment_intents', {
      method: 'POST',
      body: new URLSearchParams({
        amount: String(amountCents),
        currency: b.currency || 'usd',
        'automatic_payment_methods[enabled]': 'true',
        application_fee_amount: String(platformFee),
        'transfer_data[destination]': connectedAccountId,
        'metadata[booking_id]': safeStr(b.booking_id || ''),
        'metadata[workspace_id]': wsId,
        'metadata[client_name]': safeStr(b.client_name || ''),
        description: safeStr(b.description || 'Booking payment'),
      }).toString(),
    });
    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Stripe Connect webhook
app.post('/api/webhooks/stripe-connect', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    const obj = event.data?.object;
    if (!obj) return res.json({ ok: true });
    const wsId = obj.metadata?.workspace_id || '';
    if (!wsId) return res.json({ ok: true });
    if (event.type === 'payment_intent.succeeded') {
      const bookingId = obj.metadata?.booking_id;
      if (bookingId) {
        const wsRef = db.collection(`workspaces/${wsId}/bookings`).doc(bookingId);
        await wsRef.update({
          paid: true,
          payment_status: 'paid',
          payment_method: 'stripe',
          payment_id: obj.id,
          amount: (obj.amount || 0) / 100,
          updated_at: toIso(new Date()),
        }).catch(() => {});
      }
    }
    res.json({ ok: true });
  } catch (e) { res.json({ ok: true }); }
});

// ============================================================
// SQUARE CUSTOMER SYNC
// ============================================================
app.post('/api/square/customers/sync', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws, { hasBody: true });
    const { client_id, name, phone, email } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    // Check if local client already has a square_customer_id
    const clientDoc = await req.ws('clients').doc(client_id).get();
    if (clientDoc.exists && clientDoc.data()?.square_customer_id) {
      // Already linked — fetch latest from Square
      try {
        const r = await squareFetch(`/v2/customers/${clientDoc.data().square_customer_id}`, { headers });
        if (r.ok) {
          const d = await r.json();
          return res.json({ customer: d.customer, linked: true });
        }
      } catch {}
    }

    // Search Square by phone or reference_id
    const searchQueries = [];
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 10) {
        searchQueries.push({ filter: { phone_number: { exact: digits.length === 10 ? '+1' + digits : '+' + digits } } });
      }
    }
    searchQueries.push({ filter: { reference_id: { exact: client_id } } });

    for (const query of searchQueries) {
      try {
        const r = await squareFetch('/v2/customers/search', {
          method: 'POST', headers,
          body: JSON.stringify({ query, limit: 1 }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.customers?.length) {
            // Found — link to local client
            await req.ws('clients').doc(client_id).update({ square_customer_id: d.customers[0].id, updated_at: toIso(new Date()) });
            return res.json({ customer: d.customers[0], linked: true });
          }
        }
      } catch {}
    }

    // Not found — create in Square
    const nameParts = (name || '').trim().split(/\s+/);
    const createBody = {
      idempotency_key: crypto.randomUUID(),
      given_name: nameParts[0] || '',
      family_name: nameParts.slice(1).join(' ') || '',
      reference_id: client_id,
    };
    if (phone) createBody.phone_number = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    if (email) createBody.email_address = email;

    const r = await squareFetch('/v2/customers', {
      method: 'POST', headers,
      body: JSON.stringify(createBody),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Square error', details: d });

    // Link to local client
    await req.ws('clients').doc(client_id).update({ square_customer_id: d.customer.id, updated_at: toIso(new Date()) });
    res.json({ customer: d.customer, created: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SQUARE TERMINAL PAYMENTS
// ============================================================
app.get('/api/payments/terminal/devices', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws);
    const r = await squareFetch('/v2/devices', { headers });
    const data = await r.json();
    res.json({ devices: data.devices || [] });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/payments/terminal', async (req, res) => {
  try {
    const b = req.body || {};
    const amountCents = b.amount_cents ? Math.round(Number(b.amount_cents)) : Math.round(Number(b.amount || 0) * 100);
    const bookingId = safeStr(b.booking_id || '');
    const deviceId = safeStr(b.device_id || process.env.SQUARE_DEVICE_ID || '');
    const paymentMethod = safeStr(b.payment_method || 'card');
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: 'amount required' });
    // For non-card payments (cash, zelle, other), just record locally
    if (paymentMethod !== 'card') {
      const doc = {
        booking_id: bookingId, amount_cents: amountCents, payment_method: paymentMethod,
        status: 'completed', created_by: req.user.uid, created_at: toIso(new Date()),
        client_name: safeStr(b.client_name || ''),
        service_name: safeStr(b.service_name || ''),
        service_amount: Number(b.service_amount || 0),
        tax_amount: Number(b.tax_amount || 0),
        fee_amount: Number(b.fee_amount || 0),
        tip_amount: Number(b.tip_amount || 0),
      };
      const ref = await req.ws('payment_requests').add(doc);
      if (bookingId) {
        const bookingPatch = { payment_status: 'paid', paid: true, payment_method: paymentMethod, amount: amountCents / 100, updated_at: toIso(new Date()) };
        if (b.tip_amount) bookingPatch.tip_amount = Number(b.tip_amount);
        if (b.tax_amount) bookingPatch.tax_amount = Number(b.tax_amount);
        if (b.fee_amount) bookingPatch.fee_amount = Number(b.fee_amount);
        if (b.service_amount) bookingPatch.service_amount = Number(b.service_amount);
        await req.ws('bookings').doc(bookingId).update(bookingPatch).catch(() => {});
      }
      return res.status(201).json({ id: ref.id, ...doc });
    }
    // Card payment via Square Terminal
    if (!deviceId) return res.status(400).json({ error: 'device_id required for card payments' });
    const headers = await squareHeaders(req.ws, { hasBody: true });
    const locationId = safeStr(b.location_id || process.env.SQUARE_LOCATION_ID || '');
    const idempotencyKey = crypto.randomUUID();

    // Auto-sync client to Square if we have client info
    let squareCustomerId = safeStr(b.square_customer_id || '');
    if (!squareCustomerId && bookingId) {
      try {
        const bookingDoc = await req.ws('bookings').doc(bookingId).get();
        const bData = bookingDoc.exists ? bookingDoc.data() : {};
        const clientId = bData?.customer_id || bData?.client_id || '';
        if (clientId) {
          const clientDoc = await req.ws('clients').doc(clientId).get();
          if (clientDoc.exists) {
            const cData = clientDoc.data();
            if (cData?.square_customer_id) {
              squareCustomerId = cData.square_customer_id;
            } else {
              // Create/find in Square
              try {
                const nameParts = (cData?.name || '').trim().split(/\s+/);
                const createBody = { idempotency_key: crypto.randomUUID(), given_name: nameParts[0] || '', family_name: nameParts.slice(1).join(' ') || '', reference_id: clientId };
                if (cData?.phone) createBody.phone_number = cData.phone.startsWith('+') ? cData.phone : '+1' + cData.phone.replace(/\D/g, '');
                if (cData?.email) createBody.email_address = cData.email;
                const cr = await squareFetch('/v2/customers', { method: 'POST', headers, body: JSON.stringify(createBody) });
                if (cr.ok) {
                  const cd = await cr.json();
                  squareCustomerId = cd.customer?.id || '';
                  if (squareCustomerId) await req.ws('clients').doc(clientId).update({ square_customer_id: squareCustomerId, updated_at: toIso(new Date()) }).catch(() => {});
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    const sqBody = {
      idempotency_key: idempotencyKey,
      checkout: {
        amount_money: { amount: amountCents, currency: 'USD' },
        device_options: { device_id: deviceId, tip_settings: { allow_tipping: true } },
        payment_type: 'CARD_PRESENT',
        note: b.note || `Booking ${bookingId}`,
        ...(squareCustomerId ? { customer_id: squareCustomerId } : {}),
      },
    };
    const r = await squareFetch('/v2/terminals/checkouts', { method: 'POST', headers, body: JSON.stringify(sqBody) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Square error', details: data });
    const checkout = data.checkout || {};
    const prDoc = {
      checkout_id: checkout.id, booking_id: bookingId, amount_cents: amountCents,
      payment_method: 'card', status: 'pending', device_id: deviceId, location_id: locationId,
      service_amount: Number(b.service_amount || 0), tax_amount: Number(b.tax_amount || 0),
      fee_amount: Number(b.fee_amount || 0), client_name: safeStr(b.client_name || ''),
      created_by: req.user.uid, created_at: toIso(new Date()),
    };
    const ref = await req.ws('payment_requests').add(prDoc);
    res.status(201).json({ id: ref.id, checkout_id: checkout.id, status: checkout.status });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/payments/terminal/status/:checkoutId', async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws);
    const r = await squareFetch(`/v2/terminals/checkouts/${req.params.checkoutId}`, { headers });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Square error', details: data });
    const checkout = data.checkout || {};
    // Update local record
    const prSnap = await req.ws('payment_requests').where('checkout_id', '==', req.params.checkoutId).limit(1).get();
    if (!prSnap.empty) {
      const patch = { status: (checkout.status || 'PENDING').toLowerCase(), updated_at: toIso(new Date()) };
      if (checkout.payment_ids?.length) patch.payment_id = checkout.payment_ids[0];
      if (checkout.status === 'COMPLETED') {
        patch.completed_at = toIso(new Date());
        const tipCents = checkout.tip_money?.amount || 0;
        patch.tip_cents = tipCents;
        const totalCents = checkout.amount_money?.amount || 0;
        const prData = prSnap.docs[0].data();
        if (prData.booking_id) {
          const bPatch = {
            payment_status: 'paid', paid: true, payment_method: 'terminal',
            tip: tipCents / 100, tip_amount: tipCents / 100,
            amount: totalCents / 100,
            updated_at: toIso(new Date()),
          };
          if (checkout.payment_ids?.length) bPatch.payment_id = checkout.payment_ids[0];
          // Preserve service_amount/tax/fees from original payment request for payroll
          if (prData.service_amount) bPatch.service_amount = prData.service_amount;
          if (prData.tax_amount) bPatch.tax_amount = prData.tax_amount;
          if (prData.fee_amount) bPatch.fee_amount = prData.fee_amount;
          await req.ws('bookings').doc(prData.booking_id).update(bPatch).catch(() => {});
        }
      }
      await prSnap.docs[0].ref.update(patch);
    }
    res.json({ checkout_id: checkout.id, status: checkout.status, payment_ids: checkout.payment_ids || [], tip_money: checkout.tip_money || null });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/payments/terminal/cancel/:checkoutId', async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws, { hasBody: true });
    const r = await squareFetch(`/v2/terminals/checkouts/${req.params.checkoutId}/cancel`, { method: 'POST', headers, body: '{}' });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Square error', details: data });
    const prSnap = await req.ws('payment_requests').where('checkout_id', '==', req.params.checkoutId).limit(1).get();
    if (!prSnap.empty) await prSnap.docs[0].ref.update({ status: 'cancelled', updated_at: toIso(new Date()) });
    res.json({ ok: true, status: 'cancelled' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SQUARE REFUNDS
// ============================================================
app.post('/api/payments/refund/:paymentId', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const amountCents = req.body?.amount_cents ? Math.round(Number(req.body.amount_cents)) : null;
    const headers = await squareHeaders(req.ws, { hasBody: true });
    // Get payment to know amount
    const payResp = await squareFetch(`/v2/payments/${paymentId}`, { headers: await squareHeaders(req.ws) });
    const payData = await payResp.json();
    if (!payResp.ok) return res.status(400).json({ error: 'Payment not found', details: payData });
    const payment = payData.payment || {};
    const refundAmount = amountCents || payment.amount_money?.amount || 0;
    const refundBody = {
      idempotency_key: crypto.randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: refundAmount, currency: payment.amount_money?.currency || 'USD' },
      reason: safeStr(req.body?.reason || 'Refund from CRM'),
    };
    const r = await squareFetch('/v2/refunds', { method: 'POST', headers, body: JSON.stringify(refundBody) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Refund failed', details: data });
    writeAuditLog(req.wsId, { action: 'payment.refund', resource_id: paymentId, data: { amount_cents: refundAmount }, req }).catch(() => {});
    res.json({ ok: true, refund: data.refund });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/payments/refund-by-booking/:bookingId', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const prSnap = await req.ws('payment_requests').where('booking_id', '==', bookingId).where('status', '==', 'completed').limit(1).get();
    if (prSnap.empty) return res.status(404).json({ error: 'No completed payment found for this booking' });
    const pr = prSnap.docs[0].data();
    if (!pr.payment_id) return res.status(400).json({ error: 'No Square payment ID — manual refund needed' });
    const headers = await squareHeaders(req.ws, { hasBody: true });
    const refundBody = {
      idempotency_key: crypto.randomUUID(),
      payment_id: pr.payment_id,
      amount_money: { amount: pr.amount_cents || 0, currency: 'USD' },
      reason: safeStr(req.body?.reason || 'Refund by booking'),
    };
    const r = await squareFetch('/v2/refunds', { method: 'POST', headers, body: JSON.stringify(refundBody) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Refund failed', details: data });
    await prSnap.docs[0].ref.update({ status: 'refunded', refunded_at: toIso(new Date()) });
    await req.ws('bookings').doc(bookingId).update({ payment_status: 'refunded', updated_at: toIso(new Date()) }).catch(() => {});
    writeAuditLog(req.wsId, { action: 'payment.refund', resource_id: bookingId, data: { payment_id: pr.payment_id }, req }).catch(() => {});
    res.json({ ok: true, refund: data.refund });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/payments/delete-by-booking', requireRole('owner'), async (req, res) => {
  try {
    const bookingId = safeStr(req.body?.booking_id || req.query?.booking_id || '');
    if (!bookingId) return res.status(400).json({ error: 'booking_id required' });
    const prSnap = await req.ws('payment_requests').where('booking_id', '==', bookingId).get();
    let deleted = 0;
    for (const d of prSnap.docs) { await d.ref.delete(); deleted++; }
    res.json({ ok: true, deleted });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUSH TOKEN REGISTRATION (CRM staff)
// ============================================================
app.post('/api/push/register', async (req, res) => {
  try {
    const deviceToken = safeStr(req.body?.device_token);
    const platform = safeStr(req.body?.platform || 'ios');
    const app = safeStr(req.body?.app || 'crm');
    if (!deviceToken) return res.status(400).json({ error: 'device_token required' });
    await req.ws('crm_push_tokens').doc(deviceToken).set({
      device_token: deviceToken, platform, app,
      user_id: req.user.uid, user_name: safeStr(req.user.name || req.user.username),
      role: safeStr(req.user.role), barber_id: safeStr(req.user.barber_id || ''),
      updated_at: toIso(new Date()),
    }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// REVIEWS IMPORT (owner bulk import)
// ============================================================
app.post('/api/reviews/import', requireRole('owner'), async (req, res) => {
  try {
    const items = Array.isArray(req.body?.reviews) ? req.body.reviews : [];
    if (!items.length) return res.status(400).json({ error: 'reviews[] required' });
    const batch = db.batch();
    let count = 0;
    for (const r of items.slice(0, 500)) {
      const ref = req.ws('reviews').doc();
      batch.set(ref, {
        barber_id: safeStr(r.barber_id || ''), barber_name: safeStr(r.barber_name || ''),
        client_name: sanitizeHtml(safeStr(r.name || 'Anonymous')),
        rating: Math.max(1, Math.min(5, Number(r.rating || 5))),
        text: sanitizeHtml(safeStr(r.text || '')).slice(0, 2000),
        source: 'google', status: 'approved',
        created_at: safeStr(r.ts || r.createdAt || '') || toIso(new Date()),
      });
      count++;
    }
    await batch.commit();
    res.status(201).json({ ok: true, imported: count });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PAYROLL BACKFILL TIPS
// ============================================================
app.post('/api/payroll/backfill-tips', requireRole('owner'), async (req, res) => {
  try {
    const from = safeStr(req.body?.from || req.query?.from || '');
    const to = safeStr(req.body?.to || req.query?.to || '');
    let query = req.ws('payment_requests').where('status', '==', 'completed');
    const snap = await query.get();
    let updated = 0;
    for (const d of snap.docs) {
      const pr = d.data();
      if (!pr.booking_id || !pr.tip_cents) continue;
      if (from && pr.created_at < from) continue;
      if (to && pr.created_at > to) continue;
      const tipAmount = pr.tip_cents / 100;
      await req.ws('bookings').doc(pr.booking_id).update({ tip: tipAmount, tip_amount: tipAmount, updated_at: toIso(new Date()) }).catch(() => {});
      updated++;
    }
    res.json({ ok: true, updated });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// ADMIN ROUTES
// ============================================================
app.get('/api/admin/security-log', requireRole('owner'), async (req, res) => {
  try {
    const snap = await db.collection('security_log').orderBy('created_at', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/admin/debug-booking/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.ws('bookings').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.delete('/api/admin/cleanup-rate-limits', requireRole('owner'), async (req, res) => {
  try {
    const snap = await db.collection('rate_limits').get();
    let deleted = 0;
    for (const d of snap.docs) { await d.ref.delete(); deleted++; }
    res.json({ ok: true, deleted });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC ROUTES (no auth required, workspace_id in URL)
// ============================================================
// Resolve slug or workspace ID → workspace data
app.get('/public/resolve/:slugOrId', async (req, res) => {
  try {
    const wsId = await resolveSlug(req.params.slugOrId);
    if (!wsId) return res.status(404).json({ error: 'Not found' });
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Not found' });
    const data = wsDoc.data();
    const effectivePlan = getEffectivePlan(data);
    res.json({
      workspace_id: wsId,
      slug: data.slug || null,
      name: data.name || '',
      plan_type: data.plan_type || 'individual',
      effective_plan: effectivePlan,
      site_config: data.site_config || null,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/public/services/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const snap = await db.collection('workspaces').doc(wsId).collection('services').orderBy('name').get();
    const services = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false);
    res.json({ services });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/public/barbers/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const snap = await db.collection('workspaces').doc(wsId).collection('barbers').orderBy('name').get();
    const barbers = snap.docs.map(d => {
      const data = d.data() || {};
      if (data.active === false) return null;
      return { id: d.id, name: data.name, level: data.level || null, photo_url: data.photo_url || null, schedule: data.schedule || defaultSchedule(), schedule_overrides: data.schedule_overrides || {} };
    }).filter(Boolean);
    res.json({ barbers });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/availability/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const b = req.body || {};
    const barberId = safeStr(b.barber_id);
    const durationMin = Math.max(1, Number(b.duration_minutes || 30));
    const start = parseIso(b.start_at);
    const end = parseIso(b.end_at);
    if (!barberId || !start || !end) return res.status(400).json({ error: 'barber_id, start_at, end_at required' });
    const range = clampDateRange(start, end);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });
    const barberDoc = await wsCol('barbers').doc(barberId).get();
    if (!barberDoc.exists || barberDoc.data()?.active === false) return res.status(404).json({ error: 'Barber not found' });
    const barber = barberDoc.data();
    const settingsDoc = await wsCol('settings').doc('config').get();
    const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    const busy = await getBusyIntervalsForBarber(wsCol, barberId, toIso(range.start), toIso(range.end));
    const avail = [];
    for (const cur of eachTzDay(range.start, range.end, timeZone)) {
      const sch = getScheduleForDate(barber, cur, timeZone);
      let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone, busy });
      slots = slots.filter(t => t >= range.start && t < range.end && t > new Date());
      slots = filterSlotsAgainstBusy(slots, busy, durationMin);
      for (const t of slots) avail.push({ start_at: toIso(t), local_day: getTzDateKey(t, timeZone) });
    }
    res.json({ time_zone: timeZone, availabilities: avail, slots: avail.map(x => x.start_at) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/bookings/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const booking = req.body || {};
    const startAt = parseIso(booking.start_at);
    const barberId = safeStr(booking.barber_id);
    const clientName = sanitizeHtml(safeStr(booking.client_name));
    const clientPhone = safeStr(booking.client_phone);
    const clientEmail = sanitizeHtml(safeStr(booking.client_email || '')).toLowerCase() || null;
    const smsConsent = !!booking.sms_consent;
    const durMin = Number(booking.duration_minutes || 30);
    if (!startAt || !barberId) return res.status(400).json({ error: 'start_at and barber_id required' });
    const endAt = addMinutes(startAt, durMin);
    // Deduplicate client by phone or email — link to existing or create new
    const phoneNorm = normPhone(clientPhone) || null;
    let clientId = null;
    // Try email dedup first
    if (clientEmail && !clientId) {
      const existingByEmail = await wsCol('clients').where('email', '==', clientEmail).limit(1).get();
      if (!existingByEmail.empty) {
        clientId = existingByEmail.docs[0].id;
        const existingData = existingByEmail.docs[0].data();
        // Update phone if not set
        if (phoneNorm && !existingData.phone_norm) {
          await existingByEmail.docs[0].ref.update({ phone: clientPhone, phone_norm: phoneNorm, updated_at: toIso(new Date()) });
        }
      }
    }
    if (phoneNorm && !clientId) {
      const existingClient = await wsCol('clients').where('phone_norm', '==', phoneNorm).limit(1).get();
      if (!existingClient.empty) {
        clientId = existingClient.docs[0].id;
        // Update name if provided and different
        const existingName = existingClient.docs[0].data().name;
        if (clientName && clientName !== existingName && clientName !== 'Walk-in') {
          await existingClient.docs[0].ref.update({ name: clientName, updated_at: toIso(new Date()) });
        }
      } else {
        // Create new client record
        const clientRef = await wsCol('clients').add({
          name: clientName || 'Walk-in',
          phone: clientPhone || null,
          phone_norm: phoneNorm,
          email: clientEmail,
          client_status: 'new',
          created_at: toIso(new Date()),
          updated_at: toIso(new Date()),
        });
        clientId = clientRef.id;
      }
    }
    // If still no client found but has email — create from email
    if (!clientId && clientEmail) {
      const clientRef = await wsCol('clients').add({
        name: clientName || 'Walk-in',
        phone: clientPhone || null,
        phone_norm: phoneNorm,
        email: clientEmail,
        client_status: 'new',
        created_at: toIso(new Date()),
        updated_at: toIso(new Date()),
      });
      clientId = clientRef.id;
    }

    const doc = {
      client_name: clientName || 'Walk-in',
      client_phone: clientPhone || null,
      client_email: clientEmail,
      phone_norm: phoneNorm,
      client_id: clientId,
      barber_id: barberId,
      barber_name: sanitizeHtml(safeStr(booking.barber_name)) || null,
      service_id: safeStr(booking.service_id) || null,
      service_name: sanitizeHtml(safeStr(booking.service_name)) || null,
      start_at: toIso(startAt), end_at: toIso(endAt),
      duration_minutes: durMin,
      status: 'booked', paid: false, source: 'website',
      notes: sanitizeHtml(safeStr(booking.notes)) || null,
      customer_note: sanitizeHtml(safeStr(booking.customer_note)) || null,
      sms_consent: smsConsent,
      workspace_id: wsId,
      client_token: crypto.randomBytes(24).toString('hex'),
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const bookingsRef = wsCol('bookings');
    const bookingRef = bookingsRef.doc();
    try {
      await db.runTransaction(async (tx) => {
        await ensureNoConflictTx(tx, bookingsRef, { barberId, startAt, endAt });
        tx.set(bookingRef, doc);
      });
    } catch (e) {
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
      throw e;
    }
    // SMS confirmation + reminders (only if consented)
    if (smsConsent && clientPhone) {
      const settingsDoc = await wsCol('settings').doc('config').get();
      const pubSettingsData = settingsDoc.exists ? settingsDoc.data() : {};
      const tz = pubSettingsData?.timezone || 'America/Chicago';
      const pubShopName = safeStr(pubSettingsData?.shop_name || '');
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      const pubPrefix = pubShopName ? `${pubShopName}: ` : '';
      sendSms(clientPhone, `${pubPrefix}Your appointment is confirmed for ${dateStr} at ${timeStr} with ${doc.barber_name || 'your barber'}. Reply STOP to unsubscribe.`).catch(() => {});
      scheduleReminders(wsCol, bookingRef.id, doc, tz, pubShopName).catch(() => {});
    }
    // Email confirmation
    const bookingEmail = doc.client_email;
    if (bookingEmail) {
        const emailSettingsDoc = await wsCol('settings').doc('config').get();
        const emailSettingsData = emailSettingsDoc.exists ? emailSettingsDoc.data() : {};
        const emailTz = emailSettingsData?.timezone || 'America/Chicago';
        const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: emailTz });
        const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: emailTz });
        const emailShopName = safeStr(emailSettingsData?.shop_name || '');
        const emailLogo = emailSettingsData?.logo_url || '';
        const wsDocData = await db.collection('workspaces').doc(wsId).get();
        const emailTemplate = wsDocData.exists ? (wsDocData.data()?.site_config?.template || 'modern') : 'modern';
        const manageUrl = `https://vurium.com/manage-booking?token=${doc.client_token}`;
        const et = EMAIL_THEMES[emailTemplate] || EMAIL_THEMES.modern;
        const isLt = ['classic','colorful'].includes(emailTemplate);
        const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
        const cardBrd = et.border;
        sendEmail(bookingEmail, 'Booking Confirmed', vuriumEmailTemplate('Booking Confirmed', `
          <p>Your appointment has been confirmed:</p>
          <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${cardBrd};margin:16px 0;">
            <div style="font-size:16px;font-weight:600;color:${et.text};">${doc.service_name || 'Appointment'}</div>
            <div style="color:${et.muted};margin-top:4px;">with ${doc.barber_name || 'your specialist'}</div>
            <div style="color:${et.accent};font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
          </div>
          <div style="text-align:center;margin:20px 0;">
            <a href="${manageUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${cardBrd};color:${et.text};text-decoration:none;font-size:13px;font-weight:500;margin-right:8px;">Reschedule</a>
            <a href="${manageUrl}&action=cancel" style="display:inline-block;padding:12px 24px;border-radius:10px;background:rgba(220,60,60,.08);border:1px solid rgba(220,60,60,.2);color:rgba(220,80,80,.8);text-decoration:none;font-size:13px;font-weight:500;">Cancel</a>
          </div>
        `, emailShopName, emailLogo, emailTemplate), emailShopName).catch(() => {});
    }
    res.status(201).json({ booking_id: bookingRef.id, id: bookingRef.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC CONFIG
// ============================================================
app.get('/public/config/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const doc = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
    const data = doc.exists ? doc.data() : {};
    res.json({
      shopStatusMode: safeStr(data.shopStatusMode || 'auto'),
      shopStatusCustomText: safeStr(data.shopStatusCustomText || ''),
      bannerEnabled: !!data.bannerEnabled,
      bannerText: safeStr(data.bannerText || ''),
      hero_media_url: safeStr(data.hero_media_url || data.hero_url || ''),
      hero_media_type: safeStr(data.hero_media_type || 'video'),
      shop_name: safeStr(data.shop_name || ''),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC REVIEWS
// ============================================================
app.get('/public/reviews/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const barberName = safeStr(req.query?.barber || '');
    const snap = await wsCol('reviews').where('status', '==', 'approved').orderBy('created_at', 'desc').limit(200).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (barberName) {
      list = list.filter(r => String(r.barber_name || '').toLowerCase().includes(barberName.toLowerCase()));
    }
    const avg = list.length ? Math.round(list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length * 10) / 10 : 0;
    res.json({ ok: true, items: list.map(r => ({ name: r.client_name || r.name, rating: r.rating, text: r.text, ts: r.created_at })), avg, count: list.length });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/reviews/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const b = req.body || {};
    const doc = {
      barber_id: safeStr(b.barber_id || ''), barber_name: safeStr(b.barber_name || ''),
      client_name: sanitizeHtml(safeStr(b.name || 'Anonymous')),
      rating: Math.max(1, Math.min(5, Number(b.rating || 5))),
      text: sanitizeHtml(safeStr(b.text || '')).slice(0, 2000),
      source: 'website', status: 'pending', created_at: toIso(new Date()),
    };
    const ref = await wsCol('reviews').add(doc);
    res.status(201).json({ ok: true, id: ref.id, status: 'pending' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC DEVICE TOKENS
// ============================================================
app.post('/public/device-tokens/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const token = safeStr(req.body?.token);
    const customerId = safeStr(req.body?.customer_id);
    const platform = safeStr(req.body?.platform || 'ios');
    if (!token || !customerId) return res.status(400).json({ error: 'token and customer_id required' });
    await db.collection('workspaces').doc(wsId).collection('device_tokens').doc(token).set({
      token, customer_id: customerId, platform, updated_at: toIso(new Date()),
    }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC PHONE VERIFICATION
// ============================================================
app.post('/public/verify/send/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const phone = normPhone(safeStr(req.body?.phone));
    if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid phone required' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const key = `verify_${phone}`;
    await db.collection('workspaces').doc(wsId).collection('phone_verify').doc(key).set({
      phone, code, attempts: 0,
      expires_at: toIso(new Date(Date.now() + 10 * 60 * 1000)),
      created_at: toIso(new Date()),
    });
    const formatted = phone.length === 10 ? `+1${phone}` : `+${phone}`;
    const verifySettings = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
    const verifyShopName = verifySettings.exists ? safeStr(verifySettings.data()?.shop_name || '') : '';
    const verifyPrefix = verifyShopName || 'VuriumBook';
    sendSms(formatted, `${verifyPrefix}: Your verification code is ${code}. Do not share this code.`).catch(e => console.warn('verify SMS error:', e?.message));
    res.json({ ok: true, sent: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/verify/check/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const phone = normPhone(safeStr(req.body?.phone));
    const code = safeStr(req.body?.code);
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
    const key = `verify_${phone}`;
    const ref = wsCol('phone_verify').doc(key);
    const doc = await ref.get();
    if (!doc.exists) return res.status(400).json({ error: 'No code sent. Request a new one.' });
    const data = doc.data();
    if (new Date(data.expires_at) < new Date()) { await ref.delete(); return res.status(400).json({ error: 'Code expired. Request a new one.' }); }
    if ((data.attempts || 0) >= 5) { await ref.delete(); return res.status(429).json({ error: 'Too many attempts. Request a new code.' }); }
    if (data.code !== code) { await ref.update({ attempts: (data.attempts || 0) + 1 }); return res.status(400).json({ error: 'Invalid code. Try again.' }); }
    await ref.delete();
    const clientSnap = await wsCol('clients').where('phone_norm', '==', phone).limit(1).get();
    let client = null;
    if (!clientSnap.empty) {
      const cd = clientSnap.docs[0].data();
      client = { id: clientSnap.docs[0].id, name: cd.name || null, email: cd.email || null };
    }
    res.json({ ok: true, verified: true, client });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC WAITLIST
// ============================================================
app.post('/public/waitlist/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const phone = normPhone(safeStr(req.body?.phone));
    const barberId = safeStr(req.body?.barber_id);
    const date = safeStr(req.body?.date);
    const clientName = safeStr(req.body?.client_name || '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    if (!barberId) return res.status(400).json({ error: 'barber_id required' });
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    // Check duplicate
    const existing = await wsCol('waitlist').where('phone_norm', '==', phone).where('barber_id', '==', barberId).where('date', '==', date).where('notified', '==', false).limit(1).get();
    if (!existing.empty) return res.json({ ok: true, id: existing.docs[0].id, already: true });
    const doc = {
      phone_norm: phone, phone_raw: safeStr(req.body?.phone),
      client_name: clientName || null, barber_id: barberId,
      barber_name: safeStr(req.body?.barber_name),
      date, service_ids: Array.isArray(req.body?.service_ids) ? req.body.service_ids : [],
      service_names: Array.isArray(req.body?.service_names) ? req.body.service_names : [],
      duration_minutes: Math.max(1, Number(req.body?.duration_minutes || 30)),
      preferred_start_min: Math.max(0, Number(req.body?.preferred_start_min || 0)),
      preferred_end_min: Math.min(1440, Number(req.body?.preferred_end_min || 1440)),
      notified: false, created_at: toIso(new Date()),
    };
    const ref = await wsCol('waitlist').add(doc);
    sendCrmPushToStaff(wsCol, barberId, 'Waitlist', `${clientName || 'Client'} wants ${date}`, { type: 'waitlist' }).catch(() => {});
    res.status(201).json({ ok: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC APPLICATIONS
// ============================================================
app.post('/public/applications/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const b = req.body || {};
    const doc = {
      type: safeStr(b.type || 'application'),
      role: safeStr(b.role || 'Barber'),
      name: sanitizeHtml(safeStr(b.name || '')),
      phone: safeStr(b.phone || ''),
      email: sanitizeHtml(safeStr(b.email || '')),
      instagram: sanitizeHtml(safeStr(b.instagram || '')),
      experience: safeStr(b.experience || ''),
      english: safeStr(b.english || ''),
      fulltime: safeStr(b.fulltime || ''),
      portfolio: sanitizeHtml(safeStr(b.portfolio || '')),
      motivation: sanitizeHtml(safeStr(b.motivation || '')),
      license: safeStr(b.license || ''),
      schedule: safeStr(b.schedule || ''),
      message: sanitizeHtml(safeStr(b.message || '')),
      status: 'new', source: safeStr(b.source || 'website'),
      created_at: toIso(new Date()),
    };
    if (!doc.name) return res.status(400).json({ error: 'name required' });
    if (!doc.phone) return res.status(400).json({ error: 'phone required' });
    const ref = await db.collection('workspaces').doc(wsId).collection('applications').add(doc);
    res.status(201).json({ ok: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC ANALYTICS — track booking page visits
// ============================================================
app.post('/public/analytics/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.json({ ok: true }); // silent fail
    const b = req.body || {};
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    await db.collection('workspaces').doc(wsId).collection('analytics').add({
      source: safeStr(b.source || 'direct').slice(0, 50),
      referrer: safeStr(b.referrer || '').slice(0, 200),
      date,
      created_at: toIso(now),
    });
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ANALYTICS SUMMARY — auth required (owner/admin)
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const snap = await req.ws('analytics').where('date', '>=', weekAgoStr).orderBy('date').get();
    const docs = snap.docs.map(d => d.data());

    // Total visits
    const total = docs.length;

    // By source
    const bySource = {};
    docs.forEach(d => {
      const s = d.source || 'direct';
      bySource[s] = (bySource[s] || 0) + 1;
    });

    // By day
    const byDay = {};
    for (let i = 0; i < 7; i++) {
      const dd = new Date(now); dd.setDate(dd.getDate() - 6 + i);
      byDay[dd.toISOString().slice(0, 10)] = 0;
    }
    docs.forEach(d => {
      if (byDay[d.date] !== undefined) byDay[d.date]++;
    });

    res.json({
      total,
      by_source: bySource,
      by_day: Object.entries(byDay).map(([day, count]) => ({ day, count })),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// BACKGROUND JOBS (multi-tenant)
// ============================================================
let _lastReminderRun = 0;
let _lastMembershipRun = 0;

async function runAutoReminders() {
  const now = Date.now();
  if (now - _lastReminderRun < 3 * 60 * 1000) return; // throttle 3 min
  _lastReminderRun = now;
  try {
    const wsSnap = await db.collection('workspaces').limit(100).get();
    for (const ws of wsSnap.docs) {
      const wsCol = (col) => db.collection('workspaces').doc(ws.id).collection(col);
      try {
        const snap = await wsCol('sms_reminders').where('sent', '==', false).limit(50).get();
        for (const d of snap.docs) {
          const r = d.data();
          if (!r.send_at || new Date(r.send_at) > new Date()) continue;
          sendSms(r.phone, r.message).catch(() => {});
          await d.ref.update({ sent: true, sent_at: toIso(new Date()) });
        }
      } catch (e) { console.warn('runAutoReminders error for ws', ws.id, e?.message); }
    }
  } catch (e) { console.warn('runAutoReminders error:', e?.message); }
}

async function runAutoMemberships() {
  const now = Date.now();
  if (now - _lastMembershipRun < 5 * 60 * 1000) return; // throttle 5 min
  _lastMembershipRun = now;
  try {
    const wsSnap = await db.collection('workspaces').limit(100).get();
    for (const ws of wsSnap.docs) {
      const wsCol = (col) => db.collection('workspaces').doc(ws.id).collection(col);
      try {
        const snap = await wsCol('memberships').where('status', '==', 'active').get();
        const settingsDoc = await wsCol('settings').doc('config').get();
        const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
        const horizon = new Date(Date.now() + 8 * 7 * 86400000); // 8 weeks
        for (const d of snap.docs) {
          const m = d.data();
          let nextAt = parseIso(m.next_booking_at);
          if (!nextAt || nextAt > horizon) continue;
          const barberId = m.barber_id;
          if (!barberId) continue;
          const durMin = m.duration_minutes || 30;
          let count = 0;
          while (nextAt && nextAt <= horizon && count < 20) {
            count++;
            try {
              const endAt = addMinutes(nextAt, durMin);
              const bookingsRef = wsCol('bookings');
              const bookingRef = bookingsRef.doc();
              await db.runTransaction(async (tx) => {
                await ensureNoConflictTx(tx, bookingsRef, { barberId, startAt: nextAt, endAt });
                tx.set(bookingRef, {
                  client_name: m.client_name || 'Membership', barber_id: barberId,
                  barber_name: m.barber_name || null, service_id: m.service_id || null,
                  service_name: m.service_name || null,
                  start_at: toIso(nextAt), end_at: toIso(endAt),
                  duration_minutes: durMin, status: 'booked', source: 'membership',
                  membership_id: d.id, paid: false,
                  created_at: toIso(new Date()), updated_at: toIso(new Date()),
                });
              });
            } catch {}
            // Advance to next occurrence
            const freq = m.frequency || 'weekly';
            if (freq === 'weekly') nextAt = new Date(nextAt.getTime() + 7 * 86400000);
            else if (freq === 'biweekly') nextAt = new Date(nextAt.getTime() + 14 * 86400000);
            else if (freq === 'monthly') { nextAt.setMonth(nextAt.getMonth() + 1); }
            else break;
          }
          await d.ref.update({ next_booking_at: toIso(nextAt), updated_at: toIso(new Date()) });
        }
      } catch (e) { console.warn('runAutoMemberships error for ws', ws.id, e?.message); }
    }
  } catch (e) { console.warn('runAutoMemberships error:', e?.message); }
}

// Run background jobs every 3 minutes
setInterval(() => {
  runAutoReminders().catch(() => {});
  runAutoMemberships().catch(() => {});
}, 3 * 60 * 1000);

// ============================================================
// STRIPE BILLING (env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*)
// ============================================================
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICES = {
  individual: process.env.STRIPE_PRICE_INDIVIDUAL || process.env.STRIPE_PRICE_STARTER || '',
  salon: process.env.STRIPE_PRICE_SALON || process.env.STRIPE_PRICE_PRO || '',
  custom: process.env.STRIPE_PRICE_CUSTOM || '',
};
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vurium.com';

async function stripeFetch(path, options = {}) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Stripe error');
  return data;
}

// Create Stripe Checkout Session (requires auth)
app.post('/api/billing/checkout', async (req, res) => {
  try {
    if (!STRIPE_SECRET) return res.status(400).json({ error: 'Stripe not configured' });
    const plan = safeStr(req.body?.plan || 'salon');
    const priceId = STRIPE_PRICES[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });
    const wsDoc = await req.wsDoc().get();
    const wsData = wsDoc.exists ? wsDoc.data() : {};
    // Create or get Stripe customer
    let customerId = wsData.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeFetch('/v1/customers', {
        method: 'POST',
        body: new URLSearchParams({
          email: req.user.username || '',
          name: wsData.name || '',
          'metadata[workspace_id]': req.wsId,
        }).toString(),
      });
      customerId = customer.id;
      await req.wsDoc().update({ stripe_customer_id: customerId });
    }
    // Create checkout session
    const session = await stripeFetch('/v1/checkout/sessions', {
      method: 'POST',
      body: new URLSearchParams({
        'customer': customerId,
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${FRONTEND_URL}/dashboard?billing=success`,
        'cancel_url': `${FRONTEND_URL}/dashboard?billing=cancelled`,
        'subscription_data[trial_period_days]': wsData.trial_used ? '0' : '14',
        'subscription_data[metadata][workspace_id]': req.wsId,
        'metadata[workspace_id]': req.wsId,
        'allow_promotion_codes': 'true',
      }).toString(),
    });
    // Immediately update plan type (don't rely solely on webhook)
    await req.wsDoc().update({ plan_type: plan, stripe_customer_id: customerId, updated_at: toIso(new Date()) });
    res.json({ url: session.url, session_id: session.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Create subscription with incomplete payment (for Stripe Elements on frontend)
app.post('/api/billing/create-subscription', async (req, res) => {
  try {
    if (!STRIPE_SECRET) return res.status(400).json({ error: 'Stripe not configured' });
    const plan = safeStr(req.body?.plan || 'salon');
    const priceId = STRIPE_PRICES[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });
    const wsDoc = await req.wsDoc().get();
    const wsData = wsDoc.exists ? wsDoc.data() : {};
    // Create or get Stripe customer
    let customerId = wsData.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeFetch('/v1/customers', {
        method: 'POST',
        body: new URLSearchParams({
          email: req.user.username || '',
          name: wsData.name || req.user.name || '',
          'metadata[workspace_id]': req.wsId,
        }).toString(),
      });
      customerId = customer.id;
      await req.wsDoc().update({ stripe_customer_id: customerId });
    }
    // Create subscription with incomplete payment
    const params = new URLSearchParams({
      'customer': customerId,
      'items[0][price]': priceId,
      'payment_behavior': 'default_incomplete',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'metadata[workspace_id]': req.wsId,
      'expand[0]': 'latest_invoice.payment_intent',
    });
    if (!wsData.trial_used) {
      params.set('trial_period_days', '14');
      params.set('expand[0]', 'pending_setup_intent');
    }
    const subscription = await stripeFetch('/v1/subscriptions', {
      method: 'POST',
      body: params.toString(),
    });
    // Return clientSecret for frontend Stripe Elements
    let clientSecret;
    if (subscription.pending_setup_intent) {
      clientSecret = subscription.pending_setup_intent.client_secret;
    } else if (subscription.latest_invoice?.payment_intent) {
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
    }
    if (!clientSecret) return res.status(400).json({ error: 'Could not create payment intent' });
    // Immediately update plan in Firestore (don't rely solely on webhook)
    const planPatch = {
      plan_type: plan,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      billing_status: subscription.status || 'active',
      subscription_status: subscription.status || 'active',
      trial_used: true,
      updated_at: toIso(new Date()),
    };
    if (subscription.trial_end) planPatch.trial_ends_at = toIso(new Date(subscription.trial_end * 1000));
    await req.wsDoc().update(planPatch);
    res.json({
      subscriptionId: subscription.id,
      clientSecret,
      type: subscription.pending_setup_intent ? 'setup' : 'payment',
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Get billing status
app.get('/api/billing/status', async (req, res) => {
  try {
    const wsDoc = await req.wsDoc().get();
    const data = wsDoc.exists ? wsDoc.data() : {};
    const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
    const now = new Date();
    const trialActive = trialEnd && trialEnd > now;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0;
    const effectivePlan = getEffectivePlan(data);
    res.json({
      plan_type: data.plan_type || data.plan || 'individual',
      billing_status: data.billing_status || data.subscription_status || (trialActive ? 'trialing' : 'inactive'),
      effective_plan: effectivePlan,
      plan: data.plan_type || data.plan || 'individual', // legacy compat
      stripe_subscription_id: data.stripe_subscription_id || null,
      stripe_customer_id: data.stripe_customer_id || null,
      trial_active: !!trialActive,
      trial_ends_at: data.trial_ends_at || null,
      trial_days_left: daysLeft,
      subscription_status: data.billing_status || data.subscription_status || (trialActive ? 'trialing' : 'inactive'),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Cancel subscription
app.post('/api/billing/cancel', requireRole('owner'), async (req, res) => {
  try {
    const wsDoc = await req.wsDoc().get();
    const data = wsDoc.exists ? wsDoc.data() : {};
    if (!data.stripe_subscription_id) return res.status(400).json({ error: 'No active subscription' });
    await stripeFetch(`/v1/subscriptions/${data.stripe_subscription_id}`, {
      method: 'POST',
      body: new URLSearchParams({ cancel_at_period_end: 'true' }).toString(),
    });
    await req.wsDoc().update({ subscription_status: 'cancelling', updated_at: toIso(new Date()) });
    res.json({ ok: true, status: 'cancelling' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});


// Account limits — returns plan info, features, limits


// Migrate workspace to activate trial
app.post('/api/account/activate-trial', requireRole('owner'), async (req, res) => {
  try {
    const wsDoc = await req.wsDoc().get();
    const wsData = wsDoc.exists ? wsDoc.data() : {};
    if (wsData.billing_status === 'trialing' && wsData.trial_ends_at) {
      return res.json({ ok: true, already: true, message: 'Trial already active' });
    }
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const slug = wsData.slug || await generateUniqueSlug(wsData.name || 'business');
    const patch = {
      plan_type: wsData.plan_type || 'individual',
      billing_status: 'trialing',
      trial_ends_at: toIso(trialEnd),
      trial_used: false,
      slug,
      updated_at: toIso(new Date()),
    };
    await req.wsDoc().update(patch);
    if (!wsData.slug) await registerSlug(slug, req.wsId);
    res.json({ ok: true, plan_type: patch.plan_type, billing_status: 'trialing', trial_ends_at: patch.trial_ends_at, slug });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/account/limits', async (req, res) => {
  try {
    const wsDoc = await req.wsDoc().get();
    let wsData = wsDoc.exists ? wsDoc.data() : {};

    // Auto-migrate old accounts: if no plan_type, set defaults + activate trial
    if (!wsData.plan_type && wsDoc.exists) {
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const slug = wsData.slug || await generateUniqueSlug(wsData.name || 'business');
      const migratePatch = {
        plan_type: 'individual',
        billing_status: 'trialing',
        trial_ends_at: toIso(trialEnd),
        trial_used: false,
        slug,
        updated_at: toIso(new Date()),
      };
      await req.wsDoc().update(migratePatch);
      if (!wsData.slug) await registerSlug(slug, req.wsId).catch(() => {});
      wsData = { ...wsData, ...migratePatch };
      console.log('Auto-migrated workspace:', req.wsId, 'slug:', slug);
    }

    const planType = wsData.plan_type || 'individual';
    const billingStatus = wsData.billing_status || 'inactive';
    const effectivePlan = getEffectivePlan(wsData);
    const planDef = getPlanDef(effectivePlan);
    const trialEnd = wsData.trial_ends_at ? new Date(wsData.trial_ends_at) : null;
    const trialActive = billingStatus === 'trialing' && trialEnd && trialEnd > new Date();
    res.json({
      plan_type: planType,
      billing_status: billingStatus,
      effective_plan: effectivePlan,
      features: planDef.features,
      member_limit: planDef.member_limit,
      staff_limit: planDef.staff_limit,
      is_unlimited: !!planDef.is_unlimited,
      trial_active: !!trialActive,
      trial_ends_at: wsData.trial_ends_at || null,
      trial_days_left: trialActive ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0,
      slug: wsData.slug || null,
      site_config: wsData.site_config || null,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Stripe Billing Portal (manage subscription)
app.post('/api/billing/portal', requireRole('owner'), async (req, res) => {
  try {
    if (!STRIPE_SECRET) return res.status(400).json({ error: 'Stripe not configured' });
    const wsDoc = await req.wsDoc().get();
    const data = wsDoc.exists ? wsDoc.data() : {};
    if (!data.stripe_customer_id) return res.status(400).json({ error: 'No billing account' });
    const session = await stripeFetch('/v1/billing_portal/sessions', {
      method: 'POST',
      body: new URLSearchParams({
        customer: data.stripe_customer_id,
        return_url: `${FRONTEND_URL}/dashboard`,
      }).toString(),
    });
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Apple IAP Verification
app.post('/api/billing/apple-verify', requireRole('owner'), async (req, res) => {
  try {
    const { transactionId, originalTransactionId, productId, plan, environment, expiresDate, purchaseDate } = req.body;
    if (!transactionId || !productId || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validPlans = ['individual', 'salon', 'custom'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const wsRef = req.wsDoc();
    const updateData = {
      plan_type: plan,
      billing_status: 'active',
      billing_source: 'apple',
      apple_transaction_id: transactionId,
      apple_original_transaction_id: originalTransactionId || transactionId,
      apple_product_id: productId,
      apple_environment: environment || 'production',
      apple_expires_at: expiresDate ? new Date(expiresDate * 1000).toISOString() : null,
      apple_purchase_date: purchaseDate ? new Date(purchaseDate * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const wsDoc = await wsRef.get();
    const wsData = wsDoc.exists ? wsDoc.data() : {};
    if (wsData.trial_active) {
      updateData.trial_active = false;
    }

    await wsRef.update(updateData);
    console.log(`[Apple IAP] Verified purchase for workspace ${req.workspaceId}: ${plan} (txn: ${transactionId})`);
    res.json({ ok: true, plan });
  } catch (e) {
    console.error('[Apple IAP] Verify error:', e);
    res.status(500).json({ error: e?.message });
  }
});

// Stripe Webhook (before auth middleware — already registered before /api middleware)
// We need a separate raw body endpoint
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    // In production, verify signature with STRIPE_WEBHOOK_SECRET
    const type = event.type;
    const obj = event.data?.object;
    if (!obj) return res.json({ ok: true });
    const wsId = obj.metadata?.workspace_id || obj.subscription_details?.metadata?.workspace_id || '';
    if (!wsId) {
      // Try to find workspace by customer ID
      if (obj.customer) {
        const wsSnap = await db.collection('workspaces').where('stripe_customer_id', '==', obj.customer).limit(1).get();
        if (!wsSnap.empty) {
          const foundWsId = wsSnap.docs[0].id;
          await handleStripeEvent(foundWsId, type, obj);
        }
      }
      return res.json({ ok: true });
    }
    await handleStripeEvent(wsId, type, obj);
    res.json({ ok: true });
  } catch (e) { console.error('Stripe webhook error:', e); res.json({ ok: true }); }
});

async function handleStripeEvent(wsId, type, obj) {
  const wsRef = db.collection('workspaces').doc(wsId);
  const patch = { updated_at: toIso(new Date()) };
  if (type === 'checkout.session.completed') {
    if (obj.subscription) {
      patch.stripe_subscription_id = obj.subscription;
      patch.billing_status = 'active';
      patch.subscription_status = 'active';
      patch.trial_used = true;
    }
  } else if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
    patch.stripe_subscription_id = obj.id;
    patch.billing_status = obj.status; // active, trialing, past_due, canceled
    patch.subscription_status = obj.status;
    patch.trial_used = true; // Mark trial as used once subscription exists
    if (obj.trial_end) patch.trial_ends_at = toIso(new Date(obj.trial_end * 1000));
    const priceId = obj.items?.data?.[0]?.price?.id || '';
    if (priceId === STRIPE_PRICES.individual) patch.plan_type = 'individual';
    else if (priceId === STRIPE_PRICES.salon) patch.plan_type = 'salon';
    else if (priceId === STRIPE_PRICES.custom) patch.plan_type = 'custom';
  } else if (type === 'customer.subscription.deleted') {
    patch.billing_status = 'canceled';
    patch.subscription_status = 'canceled';
    // plan_type stays — just billing_status changes
  } else if (type === 'invoice.payment_failed') {
    patch.billing_status = 'past_due';
    patch.subscription_status = 'past_due';
  }
  await wsRef.update(patch).catch(() => {});
}

// ============================================================
// MANAGE BOOKING (client-facing: cancel / reschedule via email link)
// ============================================================

async function getBookingByToken(token) {
  const snap = await db.collectionGroup('bookings').where('client_token', '==', token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ref: doc.ref, id: doc.id, data: doc.data() };
}

app.get('/public/manage-booking/:token', async (req, res) => {
  try {
    const booking = await getBookingByToken(req.params.token);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const { id, data } = booking;
    res.json({
      id,
      workspace_id: data.workspace_id,
      status: data.status,
      client_name: data.client_name,
      service_name: data.service_name,
      barber_name: data.barber_name,
      barber_id: data.barber_id,
      start_at: data.start_at,
      end_at: data.end_at,
      duration_minutes: data.duration_minutes || 30,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/manage-booking/:token/cancel', async (req, res) => {
  try {
    const booking = await getBookingByToken(req.params.token);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const { ref, data } = booking;
    if (['cancelled', 'completed', 'done'].includes(data.status)) {
      return res.status(400).json({ error: `Booking is already ${data.status}` });
    }
    if (data.start_at && new Date(data.start_at) < new Date()) {
      return res.status(400).json({ error: 'Cannot cancel a past appointment' });
    }
    await ref.update({ status: 'cancelled', updated_at: toIso(new Date()) });
    // Send cancellation confirmation email
    if (data.client_email) {
      const wsId = data.workspace_id;
      const settingsDoc = wsId ? await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get() : null;
      const shopName = settingsDoc?.exists ? safeStr(settingsDoc.data()?.shop_name || '') : '';
      sendEmail(data.client_email, 'Booking Cancelled', vuriumEmailTemplate('Booking Cancelled', `
        <p>Your appointment has been cancelled as requested.</p>
        <div style="padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:#e8e8ed;">${data.service_name || 'Appointment'}</div>
          <div style="color:rgba(255,255,255,.4);margin-top:4px;">with ${data.barber_name || 'your specialist'}</div>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,.3);">To book a new appointment, visit our booking page.</p>
      `, shopName), shopName).catch(() => {});
    }
    res.json({ ok: true, status: 'cancelled' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/manage-booking/:token/reschedule', async (req, res) => {
  try {
    const booking = await getBookingByToken(req.params.token);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const { ref, data } = booking;
    if (['cancelled', 'completed', 'done'].includes(data.status)) {
      return res.status(400).json({ error: `Cannot reschedule a ${data.status} booking` });
    }
    if (data.start_at && new Date(data.start_at) < new Date()) {
      return res.status(400).json({ error: 'Cannot reschedule a past appointment' });
    }
    const newStartAt = parseIso(req.body?.start_at);
    if (!newStartAt || newStartAt <= new Date()) return res.status(400).json({ error: 'Invalid new start_at' });
    const durMin = data.duration_minutes || 30;
    const newEndAt = addMinutes(newStartAt, durMin);
    const wsId = data.workspace_id;
    if (!wsId) return res.status(500).json({ error: 'Booking has no workspace reference' });
    const bookingsRef = db.collection('workspaces').doc(wsId).collection('bookings');
    try {
      await db.runTransaction(async (tx) => {
        await ensureNoConflictTx(tx, bookingsRef, { barberId: data.barber_id, startAt: newStartAt, endAt: newEndAt, excludeBookingId: ref.id });
        tx.update(ref, { start_at: toIso(newStartAt), end_at: toIso(newEndAt), status: 'booked', updated_at: toIso(new Date()) });
      });
    } catch (e) {
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
      throw e;
    }
    // Send rescheduled confirmation email
    if (data.client_email) {
      const settingsDoc = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
      const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
      const shopName = safeStr(settingsData?.shop_name || '');
      const tz = settingsData?.timezone || 'America/Chicago';
      const timeStr = newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = newStartAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
      const manageUrl = `https://vurium.com/manage-booking?token=${req.params.token}`;
      sendEmail(data.client_email, 'Booking Rescheduled', vuriumEmailTemplate('Booking Rescheduled', `
        <p>Your appointment has been rescheduled:</p>
        <div style="padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:#e8e8ed;">${data.service_name || 'Appointment'}</div>
          <div style="color:rgba(255,255,255,.4);margin-top:4px;">with ${data.barber_name || 'your specialist'}</div>
          <div style="color:rgba(130,150,220,.7);font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <a href="${manageUrl}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#e8e8ed;text-decoration:none;font-size:13px;font-weight:500;">Manage Booking</a>
        </div>
      `, shopName), shopName).catch(() => {});
    }
    res.json({ ok: true, start_at: toIso(newStartAt), end_at: toIso(newEndAt) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// 404 fallback
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message, err.code || '', err.stack || '');
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`VuriumBook API running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});
