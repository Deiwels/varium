// ============================================================
// VuriumBook — Multi-Tenant Express Backend
// All Firestore collections scoped under workspaces/{workspace_id}/
// ============================================================

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// FIRESTORE
// ============================================================
const db = new Firestore();

// ============================================================
// MULTI-TENANT HELPER
// Returns a reference to workspaces/{workspaceId} subcollection
// Usage: tenantDb(wid).collection('bookings')
// ============================================================
function tenantDb(workspaceId) {
  if (!workspaceId) throw new Error('workspace_id is required');
  const wsRef = db.collection('workspaces').doc(workspaceId);
  return {
    collection: (name) => wsRef.collection(name),
    doc: () => wsRef,
    ref: wsRef,
  };
}

// ============================================================
// ENV / SECRETS
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env variable is not set.');
  process.exit(1);
}
const TOKEN_TTL = 24 * 3600; // 24 hours

// Square
const SQUARE_TOKEN_ENV = safeStr(process.env.SQUARE_TOKEN || '');
const SQUARE_VERSION = process.env.SQUARE_VERSION || '2026-01-22';
const SQUARE_BASE = (process.env.SQUARE_ENV || 'production').toLowerCase() === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com';
const SQUARE_TIMEOUT_MS = Number(process.env.SQUARE_TIMEOUT_MS || 15000);
const SQUARE_APP_ID = safeStr(process.env.SQUARE_APP_ID || '');
const SQUARE_APP_SECRET = safeStr(process.env.SQUARE_APP_SECRET || '');

// Twilio
function twilioCredentials() {
  return {
    accountSid: safeStr(process.env.TWILIO_ACCOUNT_SID),
    authToken: safeStr(process.env.TWILIO_AUTH_TOKEN),
    from: safeStr(process.env.TWILIO_FROM),
  };
}

// APNs
const APNS_KEY_ID = safeStr(process.env.APNS_KEY_ID || '');
const APNS_TEAM_ID = safeStr(process.env.APNS_TEAM_ID || '');
const APNS_KEY_P8 = safeStr(process.env.APNS_KEY_P8 || '');
const APNS_BUNDLE_ID = safeStr(process.env.APNS_BUNDLE_ID || '');
const APNS_ENV = (process.env.APNS_ENVIRONMENT || 'production').toLowerCase();
const APNS_HOST = APNS_ENV === 'development' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
const CRM_BUNDLE_ID = safeStr(process.env.CRM_BUNDLE_ID || 'com.vuriumbook.crm');

const SHOP_TIME_ZONE = process.env.SHOP_TIME_ZONE || 'America/Chicago';

// ============================================================
// MIDDLEWARE
// ============================================================
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://vuriumbook.com',
  'https://www.vuriumbook.com',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY', 'X-Auth-Token', 'Cookie'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '16mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ============================================================
// HELPERS
// ============================================================
function safeStr(x) { return String(x ?? '').trim(); }
function normPhone(x) { const digits = String(x || '').replace(/[^\d]/g, ''); if (!digits) return ''; return digits.length > 15 ? digits.slice(-15) : digits; }
function parseIso(s) { const d = new Date(String(s || '')); return Number.isNaN(d.getTime()) ? null : d; }
function toIso(d) { return new Date(d).toISOString(); }
function splitCsv(v) { return String(v || '').split(',').map(x => String(x || '').trim()).filter(Boolean); }
function normalizeStringArray(v, fallback = []) { if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean); if (typeof v === 'string') return splitCsv(v); return fallback; }
function normalizeNumberArray(v, fallback = []) { if (Array.isArray(v)) { const arr = v.map(x => Number(x)).filter(x => Number.isFinite(x)); return arr.length ? arr : fallback; } return fallback; }
function toBool(v, fallback = true) { if (typeof v === 'boolean') return v; if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (s === 'true') return true; if (s === 'false') return false; } return fallback; }
function sanitizeHtml(str) { if (str == null) return str; return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); }
function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }
function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60000); }
function clampDateRange(start, end) { if (!(start instanceof Date) || !(end instanceof Date)) return null; if (end <= start) return null; if (end.getTime() - start.getTime() > 60 * 86400000) return null; return { start, end }; }
function defaultRadarLabels() { return ['FADE', 'LONG', 'BEARD', 'STYLE', 'DETAIL']; }
function defaultRadarValues() { return [4.5, 4.5, 4.5, 4.5, 4.5]; }

function getClientIp(req) {
  return safeStr(
    (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.headers['x-real-ip'] || req.ip || 'unknown'
  ).trim() || 'unknown';
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

function formatDateTime(isoStr, timeZone = SHOP_TIME_ZONE) {
  const d = new Date(isoStr);
  if (isNaN(+d)) return isoStr;
  return d.toLocaleString('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ============================================================
// TIMEZONE HELPERS
// ============================================================
function getTzParts(date, timeZone = SHOP_TIME_ZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = fmt.formatToParts(date); const out = {};
  for (const p of parts) { if (p.type !== 'literal') out[p.type] = p.value; }
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(out.hour), minute: Number(out.minute), second: Number(out.second), weekday: wdMap[out.weekday] };
}
function getTzDateKey(date, timeZone = SHOP_TIME_ZONE) { const p = getTzParts(date, timeZone); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; }
function getTimeZoneOffsetMinutes(date, timeZone = SHOP_TIME_ZONE) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = dtf.formatToParts(date); const map = {};
  for (const p of parts) { if (p.type !== 'literal') map[p.type] = p.value; }
  const utcTs = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
  return Math.round((utcTs - date.getTime()) / 60000);
}
function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = SHOP_TIME_ZONE) {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMin = getTimeZoneOffsetMinutes(approxUtc, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60000);
}
function startOfDayInTz(date, timeZone = SHOP_TIME_ZONE) { const p = getTzParts(date, timeZone); return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, timeZone); }
function eachTzDay(start, end, timeZone = SHOP_TIME_ZONE) {
  const days = []; let cur = startOfDayInTz(start, timeZone); const last = startOfDayInTz(end, timeZone);
  while (cur.getTime() <= last.getTime()) { days.push(new Date(cur)); cur = addMinutes(cur, 24 * 60); }
  return days;
}
function chicagoDateStr(date) { return (date || new Date()).toLocaleDateString('en-CA', { timeZone: SHOP_TIME_ZONE }); }

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================
function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { ok: false, error: messages };
  }
  return { ok: true, data: result.data };
}

const RegisterSchema = z.object({
  email: z.string().email('valid email required').max(200).trim(),
  password: z.string().min(6, 'min 6 chars').max(200),
  name: z.string().min(1, 'name required').max(120).trim(),
  workspace_name: z.string().min(1, 'workspace name required').max(120).trim(),
});

const LoginSchema = z.object({
  email: z.string().email('valid email required').max(200).trim(),
  password: z.string().min(1, 'required').max(200),
});

const BookingCreateSchema = z.object({
  client_name: z.string().min(1).max(120).trim().optional(),
  client_phone: z.string().max(30).optional(),
  barber_id: z.string().min(1, 'barber_id required').max(80),
  barber_name: z.string().max(120).optional(),
  service_id: z.string().max(500).optional(),
  service_name: z.string().max(200).optional(),
  start_at: z.string().min(1, 'start_at required').refine(s => !isNaN(Date.parse(s)), 'invalid ISO date'),
  end_at: z.string().optional().refine(s => !s || !isNaN(Date.parse(s)), 'invalid ISO date'),
  duration_minutes: z.number().int().min(1).max(480).optional(),
  status: z.enum(['booked', 'confirmed', 'arrived', 'cancelled', 'noshow', 'completed', 'done']).optional(),
  source: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  customer_note: z.string().max(1000).optional(),
  paid: z.boolean().optional(),
});

const BookingPatchSchema = BookingCreateSchema.partial().extend({
  payment_status: z.enum(['paid', 'unpaid']).optional(),
  payment_method: z.string().max(40).optional(),
  tip: z.number().min(0).optional(),
  tip_amount: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
  service_amount: z.number().min(0).optional(),
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
  new_password: z.string().min(4, 'min 4 chars').max(200),
});

const UserCreateSchema = z.object({
  username: z.string().min(2).max(80).trim(),
  password: z.string().min(4).max(200),
  role: z.enum(['owner', 'admin', 'barber', 'student']).optional().default('barber'),
  name: z.string().max(120).optional(),
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
  role: z.enum(['owner', 'admin', 'barber', 'student']).optional(),
  active: z.boolean().optional(),
  barber_id: z.string().max(80).optional(),
  password: z.string().min(4).max(200).optional(),
  mentor_barber_ids: z.array(z.string().max(80)).optional(),
  phone: z.string().max(30).optional(),
  photo_url: z.string().max(500000).optional().or(z.literal('')),
  schedule: z.array(z.object({ enabled: z.boolean(), startMin: z.number(), endMin: z.number() })).optional(),
  notification_prefs: NotificationPrefsSchema,
});

// ============================================================
// AUTH — password hashing
// ============================================================
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(plain).digest('hex');
  return salt + ':' + hash;
}

function checkPassword(plain, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const check = crypto.createHmac('sha256', salt).update(plain).digest('hex');
    return check === hash;
  } catch { return false; }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function getTokenFromReq(req) {
  // 1. Cookie
  if (req.cookies?.varium_token) return req.cookies.varium_token;
  // 2. Bearer
  const auth = safeStr(req.headers['authorization'] || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  // 3. X-Auth-Token
  const xauth = safeStr(req.headers['x-auth-token'] || '');
  if (xauth) return xauth;
  return '';
}

function getSession(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  return verifyToken(token);
}

function buildAuthCookie(token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? 'Secure; ' : '';
  return `varium_token=${token}; HttpOnly; ${secure}SameSite=Lax; Max-Age=604800; Path=/`;
}

function buildClearCookie() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? 'Secure; ' : '';
  return `varium_token=; HttpOnly; ${secure}SameSite=Lax; Max-Age=0; Path=/`;
}

// ============================================================
// PERMISSIONS
// ============================================================
const PERMISSIONS = {
  owner: {
    canViewAll: true, canViewPayroll: true, canViewSettings: true,
    canViewPayments: true, canManageBarbers: true, canManageServices: true,
    canManageClients: true, canViewAllBookings: true, canManageBookings: true,
    canChangePassword: true, canManageUsers: true
  },
  admin: {
    canViewAll: true, canViewPayroll: false, canViewSettings: false,
    canViewPayments: true, canManageBarbers: false, canManageServices: false,
    canManageClients: true, canViewAllBookings: true, canManageBookings: true,
    canChangePassword: true, canManageUsers: false
  },
  barber: {
    canViewAll: false, canViewPayroll: false, canViewSettings: false,
    canViewPayments: false, canManageBarbers: false, canManageServices: false,
    canManageClients: false, canViewAllBookings: false, canManageBookings: true,
    canChangePassword: true, canManageUsers: false
  },
  student: {
    canViewAll: false, canViewPayroll: false, canViewSettings: false,
    canViewPayments: false, canManageBarbers: false, canManageServices: false,
    canManageClients: false, canViewAllBookings: false, canManageBookings: false,
    canChangePassword: true, canManageUsers: false,
    canViewMentorBookings: true,
  }
};

function hasPermission(session, perm) {
  if (!session?.role) return false;
  return !!PERMISSIONS[session.role]?.[perm];
}

// ============================================================
// AUTH MIDDLEWARE — extracts session + tenantDb
// ============================================================
function authMiddleware(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.session = session;
  if (session.workspace_id) {
    req.tdb = tenantDb(session.workspace_id);
    req.workspace_id = session.workspace_id;
  }
  next();
}

// Optional auth — sets session if present but doesn't block
function optionalAuth(req, res, next) {
  const session = getSession(req);
  if (session) {
    req.session = session;
    if (session.workspace_id) {
      req.tdb = tenantDb(session.workspace_id);
      req.workspace_id = session.workspace_id;
    }
  }
  next();
}

// Require specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: `Requires ${roles.join(' or ')} role` });
    next();
  };
}

// ============================================================
// TWILIO SMS
// ============================================================
const SMS_FOOTER = ' Reply STOP to unsubscribe or HELP for help.';

async function sendSms(to, body) {
  const { accountSid, authToken, from } = twilioCredentials();
  if (!accountSid || !authToken || !from) { console.warn('Twilio not configured'); return null; }
  const toFormatted = formatPhone(to);
  if (!toFormatted) { console.warn('sendSms: invalid phone', to); return null; }
  const payload = new URLSearchParams({ To: toFormatted, From: from, Body: body }).toString();
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ============================================================
// APNs PUSH NOTIFICATIONS
// ============================================================
let _apnsJwt = null;
let _apnsJwtCreatedAt = 0;

function base64url(buf) {
  const str = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getApnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (_apnsJwt && (now - _apnsJwtCreatedAt) < 3000) return _apnsJwt;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_KEY_P8) return null;
  try {
    const header = base64url(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }));
    const payload = base64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
    const pem = Buffer.from(APNS_KEY_P8, 'base64').toString('utf8');
    const sig = base64url(crypto.sign(null, Buffer.from(header + '.' + payload), { key: pem, dsaEncoding: 'ieee-p1363' }));
    _apnsJwt = header + '.' + payload + '.' + sig;
    _apnsJwtCreatedAt = now;
    return _apnsJwt;
  } catch (e) { console.warn('getApnsJwt error:', e?.message); return null; }
}

async function sendApnsPush(deviceToken, title, body, data = {}, bundleId = '') {
  const apnsJwt = getApnsJwt();
  const topic = bundleId || APNS_BUNDLE_ID;
  if (!apnsJwt || !deviceToken || !topic) return null;
  const http2 = require('http2');
  return new Promise(resolve => {
    let client;
    try {
      client = http2.connect(`https://${APNS_HOST}`);
      client.on('error', () => resolve(null));
      const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default', badge: 1 }, ...data });
      const req = client.request({
        ':method': 'POST', ':path': `/3/device/${deviceToken}`,
        'authorization': `bearer ${apnsJwt}`, 'apns-topic': topic,
        'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json',
      });
      req.setEncoding('utf8');
      let respData = '';
      req.on('data', chunk => respData += chunk);
      req.on('end', () => { client.close(); resolve({ data: respData }); });
      req.on('error', () => { client.close(); resolve(null); });
      req.end(payload);
      setTimeout(() => { try { client.close(); } catch {} resolve(null); }, 10000);
    } catch { if (client) try { client.close(); } catch {} resolve(null); }
  });
}

// Tenant-scoped push helpers
async function getDeviceTokensForCustomer(tdb, customerId) {
  if (!customerId) return [];
  try {
    const snap = await tdb.collection('device_tokens').where('customer_id', '==', String(customerId)).where('platform', '==', 'ios').limit(5).get();
    return snap.docs.map(d => d.data().token).filter(Boolean);
  } catch { return []; }
}

async function sendPushToCustomer(tdb, customerId, title, body, data = {}) {
  const tokens = await getDeviceTokensForCustomer(tdb, customerId);
  for (const token of tokens) await sendApnsPush(token, title, body, data);
  return tokens.length > 0;
}

async function sendCrmPush(tdb, userId, title, body, data = {}) {
  try {
    const snap = await tdb.collection('crm_push_tokens').where('user_id', '==', String(userId)).where('platform', '==', 'ios').limit(5).get();
    for (const d of snap.docs) {
      const t = d.data().device_token;
      if (t) await sendApnsPush(t, title, body, data, CRM_BUNDLE_ID);
    }
  } catch {}
}

async function sendCrmPushToRoles(tdb, roles, title, body, data = {}, excludeUserId = '') {
  try {
    const snap = await tdb.collection('crm_push_tokens').where('platform', '==', 'ios').limit(50).get();
    for (const d of snap.docs) {
      const dd = d.data();
      if (excludeUserId && dd.user_id === excludeUserId) continue;
      if (roles.length && !roles.includes(dd.role)) continue;
      if (dd.device_token) await sendApnsPush(dd.device_token, title, body, data, CRM_BUNDLE_ID);
    }
  } catch {}
}

async function sendCrmPushToBarber(tdb, barberId, title, body, data = {}) {
  if (!barberId) return;
  try {
    const snap = await tdb.collection('crm_push_tokens').where('barber_id', '==', String(barberId)).where('platform', '==', 'ios').limit(5).get();
    for (const d of snap.docs) {
      const t = d.data().device_token;
      if (t) await sendApnsPush(t, title, body, data, CRM_BUNDLE_ID);
    }
  } catch {}
}

async function sendCrmPushToStaff(tdb, barberId, title, body, data = {}) {
  sendCrmPushToRoles(tdb, ['owner', 'admin'], title, body, data).catch(() => {});
  sendCrmPushToBarber(tdb, barberId, title, body, data).catch(() => {});
}

// ============================================================
// SMS HELPERS (tenant-scoped)
// ============================================================
async function sendBookingConfirmation(tdb, booking) {
  const phone = booking.client_phone || booking.phone; if (!phone) return;
  const barber = booking.barber_name || 'your barber';
  const time = formatDateTime(booking.start_at);
  const msg = `Booking confirmed for ${time} with ${barber}.${SMS_FOOTER}`;
  try { await sendSms(phone, msg); } catch (e) { console.warn('SMS confirm err:', e?.message); }
  const cid = booking.customer_id || booking.client_id;
  if (cid) sendPushToCustomer(tdb, cid, 'Booking Confirmed', `Your appointment with ${barber} on ${time} is confirmed.`, { type: 'booking_confirmed', booking_id: booking.id || '' }).catch(() => {});
}

async function sendCancellationSms(tdb, booking) {
  const phone = booking.client_phone || booking.phone; if (!phone) return;
  const time = formatDateTime(booking.start_at);
  const msg = `Your appointment on ${time} has been cancelled.${SMS_FOOTER}`;
  try { await sendSms(phone, msg); } catch (e) { console.warn('SMS cancel err:', e?.message); }
}

async function sendRescheduleSms(tdb, booking) {
  const phone = booking.client_phone || booking.phone; if (!phone) return;
  const barber = booking.barber_name || 'your barber';
  const newTime = formatDateTime(booking.start_at);
  const msg = `Your appointment has been updated to ${newTime} with ${barber}.${SMS_FOOTER}`;
  try { await sendSms(phone, msg); } catch (e) { console.warn('SMS reschedule err:', e?.message); }
}

async function scheduleReminders(tdb, bookingId, booking) {
  const startAt = new Date(booking.start_at);
  if (isNaN(+startAt)) return;
  const phone = booking.client_phone || booking.phone;
  if (!phone) return;
  const remind24 = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  const remind2 = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
  const now = new Date();
  const common = {
    booking_id: bookingId, phone, client_name: booking.client_name || '',
    barber: booking.barber_name || '', service: booking.service_name || '', start_at: booking.start_at,
  };
  const batch = db.batch();
  if (remind24 > now) batch.set(tdb.collection('sms_reminders').doc(`${bookingId}_24h`), { ...common, send_at: remind24.toISOString(), sent: false, type: 'reminder_24h' });
  if (remind2 > now) batch.set(tdb.collection('sms_reminders').doc(`${bookingId}_2h`), { ...common, send_at: remind2.toISOString(), sent: false, type: 'reminder_2h' });
  try { await batch.commit(); } catch (e) { console.warn('scheduleReminders error:', e?.message); }
}

// ============================================================
// SQUARE HELPERS (tenant-scoped via workspace shop_config)
// ============================================================
async function getSquareToken(tdb) {
  if (!tdb) return SQUARE_TOKEN_ENV || '';
  try {
    const doc = await tdb.collection('shop_config').doc('square_oauth').get();
    if (doc.exists && doc.data()?.access_token) return doc.data().access_token;
  } catch {}
  return SQUARE_TOKEN_ENV || '';
}

async function squareHeaders(tdb, { hasBody = false } = {}) {
  const token = await getSquareToken(tdb);
  if (!token) throw new Error('Square not connected');
  return {
    'Authorization': `Bearer ${token}`,
    'Square-Version': SQUARE_VERSION,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function squareFetch(path, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SQUARE_TIMEOUT_MS);
  try {
    return await fetch(`${SQUARE_BASE}${path}`, { ...options, signal: controller.signal });
  } finally { clearTimeout(t); }
}

// ============================================================
// SCHEDULING HELPERS
// ============================================================
function defaultSchedule() { return { startMin: 8 * 60, endMin: 20 * 60, days: [0, 1, 2, 3, 4, 5, 6] }; }

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
  const result = { startMin: Number.isFinite(startMin) ? Math.max(0, Math.min(1440, Math.round(startMin))) : def.startMin, endMin: Number.isFinite(endMin) ? Math.max(0, Math.min(1440, Math.round(endMin))) : def.endMin, days: days.length ? days : def.days };
  if (Array.isArray(sch.perDay)) result.perDay = sch.perDay;
  return result;
}

function getScheduleForDate(barberDoc, dateObj, timeZone = SHOP_TIME_ZONE) {
  const parts = getTzParts(dateObj, timeZone);
  const dow = parts.weekday;
  const dateKey = getTzDateKey(dateObj, timeZone);
  const overrides = barberDoc?.schedule_overrides;
  if (overrides && typeof overrides === 'object' && overrides[dateKey]) {
    const ov = overrides[dateKey];
    return { works: ov.enabled !== false, startMin: Number(ov.startMin || 600), endMin: Number(ov.endMin || 1200), dayKey: dateKey, weekday: dow, isOverride: true };
  }
  const sch = barberDoc?.schedule || barberDoc?.work_schedule || null;
  const use = normalizeSchedule(sch);
  if (use.perDay && use.perDay[dow]) {
    const daySchedule = use.perDay[dow];
    return { works: daySchedule.enabled !== false, startMin: Number(daySchedule.startMin || use.startMin), endMin: Number(daySchedule.endMin || use.endMin), dayKey: dateKey, weekday: dow };
  }
  return { works: use.days.includes(dow), startMin: use.startMin, endMin: use.endMin, dayKey: dateKey, weekday: dow };
}

function buildSlotsForDay({ dayDateUTC, schedule, durationMin, stepMin = 30, timeZone = SHOP_TIME_ZONE }) {
  const { works, startMin, endMin } = schedule; if (!works) return [];
  const parts = getTzParts(dayDateUTC, timeZone);
  const workStart = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(startMin / 60), minute: startMin % 60 }, timeZone);
  const workEnd = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(endMin / 60), minute: endMin % 60 }, timeZone);
  const slots = [];
  for (let t = new Date(workStart); addMinutes(t, durationMin) <= workEnd; t = addMinutes(t, stepMin)) slots.push(new Date(t));
  return slots;
}

function buildSmartSlotsForDay({ dayDateUTC, schedule, durationMin, stepMin = 30, timeZone = SHOP_TIME_ZONE, busy = [] }) {
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
  return slots.filter(s => { const e = new Date(s.getTime() + durMs); return !busy.some(b => overlaps(s, e, b.start, b.end)); });
}

async function getBusyIntervalsForBarber(tdb, barberId, rangeStartIso, rangeEndIso) {
  const rangeStart = parseIso(rangeStartIso), rangeEnd = parseIso(rangeEndIso);
  if (!rangeStart || !rangeEnd) return [];
  const snap = await tdb.collection('bookings').where('barber_id', '==', String(barberId)).get();
  const out = [];
  for (const doc of snap.docs) {
    const b = doc.data(); if (String(b.status || 'booked') === 'cancelled') continue;
    const s = parseIso(b.start_at), e = parseIso(b.end_at); if (!s || !e) continue;
    if (s < rangeEnd && rangeStart < e) out.push({ start: s, end: e, id: doc.id });
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

async function ensureNoConflictTx(tx, tdb, { barberId, startAt, endAt }) {
  const snap = await tx.get(tdb.collection('bookings').where('barber_id', '==', String(barberId)));
  for (const doc of snap.docs) {
    const b = doc.data(); if (String(b.status || 'booked') === 'cancelled') continue;
    const s = parseIso(b.start_at), e = parseIso(b.end_at); if (!s || !e) continue;
    if (overlaps(startAt, endAt, s, e)) { const err = new Error('CONFLICT'); err.code = 'CONFLICT'; throw err; }
  }
}

async function ensureNoConflictTxExclude(tx, tdb, { barberId, startAt, endAt, excludeBookingId }) {
  const snap = await tx.get(tdb.collection('bookings').where('barber_id', '==', String(barberId)));
  for (const doc of snap.docs) {
    if (excludeBookingId && String(doc.id) === excludeBookingId) continue;
    const b = doc.data(); if (String(b.status || 'booked') === 'cancelled') continue;
    const s = parseIso(b.start_at), e = parseIso(b.end_at); if (!s || !e) continue;
    if (overlaps(startAt, endAt, s, e)) { const err = new Error('CONFLICT'); err.code = 'CONFLICT'; throw err; }
  }
}

// ============================================================
// AUDIT LOG (tenant-scoped)
// ============================================================
async function writeAuditLog(tdb, { action, resource_id, data, req }) {
  if (!tdb) return;
  try {
    const session = req?.session || getSession(req);
    await tdb.collection('audit_logs').add({
      action: safeStr(action), resource_id: safeStr(resource_id || ''),
      actor_uid: safeStr(session?.uid || session?.account_id || 'anonymous'),
      actor_name: safeStr(session?.name || 'anonymous'),
      actor_role: safeStr(session?.role || 'unknown'),
      ip: getClientIp(req), data: data || null, created_at: toIso(new Date()),
    });
  } catch (e) { console.warn('writeAuditLog error:', e?.message); }
}

// ============================================================
// CLIENT CLASSIFICATION
// ============================================================
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

// Barber helpers
function normalizeBarberPublicProfile(src = {}, fallbackLevel = '') {
  const level = safeStr(src.level || fallbackLevel);
  const about = safeStr(src.about || src.description || src.bio || '');
  return {
    about, description: about, bio: about,
    base_price: safeStr(src.base_price || src.basePrice || src.price || ''),
    public_role: safeStr(src.public_role || src.publicRole || level || ''),
    public_enabled: toBool(src.public_enabled, true),
    public_off_days: normalizeStringArray(src.public_off_days ?? src.off_days, []),
    radar_labels: normalizeStringArray(src.radar_labels, defaultRadarLabels()),
    radar_values: normalizeNumberArray(src.radar_values, defaultRadarValues()),
  };
}

function barberToPublicCard(b) {
  return {
    barber: safeStr(b?.name), role: safeStr(b?.public_role || b?.level || 'Barber'),
    off_days: Array.isArray(b?.public_off_days) ? b.public_off_days.map(String).filter(Boolean) : [],
    photo_url: safeStr(b?.photo_url || b?.photo || '') || null,
    about: safeStr(b?.about || b?.description || b?.bio || ''),
    price: safeStr(b?.base_price || '') || null,
    radar_labels: Array.isArray(b?.radar_labels) && b.radar_labels.length ? b.radar_labels.map(String) : defaultRadarLabels(),
    radar_values: Array.isArray(b?.radar_values) && b.radar_values.length ? b.radar_values.map(x => Number(x) || 0) : defaultRadarValues(),
    public_enabled: toBool(b?.public_enabled, true),
    portfolio: Array.isArray(b?.portfolio) ? b.portfolio.filter(x => typeof x === 'string' && x) : [],
  };
}

async function listActiveServices(tdb) {
  const snap = await tdb.collection('services').orderBy('name').get();
  return snap.docs.map(d => {
    const s = d.data() || {}; if (s.active === false) return null;
    const durMin = Number(s.duration_minutes ?? s.durationMin ?? 30) || 30;
    const price = Number(s.price_cents ?? s.priceCents ?? 0) || 0;
    const rawBarbers = Array.isArray(s.barber_ids) ? s.barber_ids : [];
    return { id: d.id, name: String(s.name || 'Service'), durationMs: durMin * 60000, priceCents: price, version: s.version != null ? String(s.version) : '1', barber_ids: rawBarbers.map(String).filter(Boolean), service_type: safeStr(s.service_type || 'primary') };
  }).filter(Boolean);
}

async function getServiceById(tdb, id) {
  const doc = await tdb.collection('services').doc(String(id)).get();
  if (!doc.exists) return null;
  const s = doc.data() || {};
  return { id: doc.id, name: String(s.name || 'Service'), duration_minutes: Number(s.duration_minutes ?? 30) || 30, price_cents: Number(s.price_cents ?? 0) || 0, version: s.version != null ? String(s.version) : '1', barber_ids: (Array.isArray(s.barber_ids) ? s.barber_ids : []).map(String).filter(Boolean) };
}

async function getBarberById(tdb, id) {
  const snap = await tdb.collection('barbers').doc(String(id)).get();
  if (!snap.exists) return null;
  const b = snap.data() || {}; if (b.active === false) return null;
  return { id: snap.id, ...b };
}

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
    await ref.set({ ip, attempts: 1, first_attempt: now, last_attempt: now, blocked_until: null, updated_at: toIso(new Date()) });
    return { allowed: true };
  }
  const newAttempts = (data.attempts || 0) + 1;
  if (newAttempts >= RATE_LIMIT_MAX) {
    await ref.set({ ip, attempts: newAttempts, first_attempt: data.first_attempt, last_attempt: now, blocked_until: now + blkMs, updated_at: toIso(new Date()) });
    return { allowed: false, retryAfter: RATE_LIMIT_BLOCK * 60 };
  }
  await ref.set({ ip, attempts: newAttempts, first_attempt: data.first_attempt, last_attempt: now, blocked_until: null, updated_at: toIso(new Date()) });
  return { allowed: true };
}

async function resetRateLimit(ip) {
  const key = `ratelimit_login_${String(ip || 'unknown').replace(/[^a-zA-Z0-9._:-]/g, '_')}`;
  await db.collection('rate_limits').doc(key).delete().catch(() => {});
}

// ============================================================
// ROUTES
// ============================================================

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// ============================================================
// AUTH — MULTI-TENANT (global accounts collection)
// ============================================================

// POST /api/auth/register — create account + workspace
app.post('/api/auth/register', async (req, res) => {
  try {
    const v = validate(RegisterSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { email, password, name, workspace_name } = v.data;
    const emailLower = email.toLowerCase().trim();

    // Check if account exists
    const existing = await db.collection('accounts').where('email', '==', emailLower).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Account with this email already exists' });

    // Create workspace
    const wsRef = db.collection('workspaces').doc();
    const workspaceId = wsRef.id;
    await wsRef.set({
      name: sanitizeHtml(workspace_name),
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    // Create account
    const accountRef = db.collection('accounts').doc();
    const accountId = accountRef.id;
    await accountRef.set({
      email: emailLower,
      name: sanitizeHtml(name),
      password_hash: hashPassword(password),
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    // Create workspace membership
    const tdb = tenantDb(workspaceId);
    const userRef = tdb.collection('users').doc();
    const userId = userRef.id;
    await userRef.set({
      account_id: accountId,
      email: emailLower,
      name: sanitizeHtml(name),
      username: emailLower,
      role: 'owner',
      barber_id: '',
      active: true,
      password_hash: hashPassword(password),
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    // Create membership record (account -> workspace mapping)
    await db.collection('account_workspaces').add({
      account_id: accountId,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      created_at: toIso(new Date()),
    });

    // Create default settings
    await tdb.collection('shop_config').doc('settings').set({
      shop_name: sanitizeHtml(workspace_name),
      timezone: SHOP_TIME_ZONE,
      currency: 'USD',
      tax: { enabled: false, rate: 0, label: 'Tax', included_in_price: false },
      fees: [],
      booking: { cancellation_hours: 2, reminder_hours_24: true, reminder_hours_2: true, sms_on_reschedule: true },
      payroll: { default_barber_pct: 60, tips_pct: 100, period: 'weekly' },
      display: { show_prices: true, require_phone: false, allow_notes: true },
      created_at: toIso(new Date()),
    });

    const payload = {
      account_id: accountId,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      name: sanitizeHtml(name),
      email: emailLower,
      permissions: PERMISSIONS.owner,
    };
    const token = signToken(payload);
    res.set('Set-Cookie', buildAuthCookie(token));
    return res.status(201).json({ ok: true, token, user: payload, workspace_id: workspaceId });
  } catch (e) {
    console.error('register error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      res.set('Retry-After', String(rateCheck.retryAfter));
      return res.status(429).json({ error: `Too many login attempts. Try again later.`, retry_after: rateCheck.retryAfter });
    }

    const v = validate(LoginSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { email, password } = v.data;
    const emailLower = email.toLowerCase().trim();

    // Find account
    const snap = await db.collection('accounts').where('email', '==', emailLower).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Invalid credentials' });
    const accountDoc = snap.docs[0];
    const account = accountDoc.data();

    if (!checkPassword(password, account.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    resetRateLimit(clientIp).catch(() => {});

    // Get workspaces for this account
    const wsSnap = await db.collection('account_workspaces').where('account_id', '==', accountDoc.id).get();
    const workspaces = [];
    for (const d of wsSnap.docs) {
      const data = d.data();
      try {
        const wsDoc = await db.collection('workspaces').doc(data.workspace_id).get();
        workspaces.push({ workspace_id: data.workspace_id, user_id: data.user_id, role: data.role, name: wsDoc.exists ? wsDoc.data().name : 'Workspace' });
      } catch {}
    }

    if (workspaces.length === 0) {
      return res.status(401).json({ error: 'No workspaces found for this account' });
    }

    // If only one workspace, auto-select it
    // If workspace_id provided in body, use that
    let selected = workspaces[0];
    const requestedWs = safeStr(req.body?.workspace_id || '');
    if (requestedWs) {
      const found = workspaces.find(w => w.workspace_id === requestedWs);
      if (found) selected = found;
    }

    // Get user details from workspace
    const tdb = tenantDb(selected.workspace_id);
    const userDoc = await tdb.collection('users').doc(selected.user_id).get();
    const user = userDoc.exists ? userDoc.data() : {};

    const payload = {
      account_id: accountDoc.id,
      workspace_id: selected.workspace_id,
      user_id: selected.user_id,
      uid: selected.user_id,
      role: safeStr(user.role || selected.role || 'barber'),
      name: safeStr(user.name || account.name || emailLower),
      email: emailLower,
      barber_id: safeStr(user.barber_id || ''),
      mentor_barber_ids: Array.isArray(user.mentor_barber_ids) ? user.mentor_barber_ids : [],
      permissions: PERMISSIONS[user.role || selected.role || 'barber'] || PERMISSIONS.barber,
    };

    const token = signToken(payload);
    await accountDoc.ref.update({ last_login: toIso(new Date()) }).catch(() => {});

    res.set('Set-Cookie', buildAuthCookie(token));
    return res.json({ ok: true, token, user: payload, workspaces, workspace_id: selected.workspace_id });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// GET /api/workspaces — list workspaces for current account
app.get('/api/workspaces', authMiddleware, async (req, res) => {
  try {
    const accountId = req.session.account_id;
    if (!accountId) return res.status(400).json({ error: 'No account_id in session' });

    const wsSnap = await db.collection('account_workspaces').where('account_id', '==', accountId).get();
    const workspaces = [];
    for (const d of wsSnap.docs) {
      const data = d.data();
      try {
        const wsDoc = await db.collection('workspaces').doc(data.workspace_id).get();
        workspaces.push({ workspace_id: data.workspace_id, user_id: data.user_id, role: data.role, name: wsDoc.exists ? wsDoc.data().name : 'Workspace' });
      } catch {}
    }
    return res.json({ workspaces });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// POST /api/workspaces — create new workspace
app.post('/api/workspaces', authMiddleware, async (req, res) => {
  try {
    const name = sanitizeHtml(safeStr(req.body?.name || ''));
    if (!name) return res.status(400).json({ error: 'name required' });

    const wsRef = db.collection('workspaces').doc();
    const workspaceId = wsRef.id;
    await wsRef.set({ name, created_at: toIso(new Date()), updated_at: toIso(new Date()) });

    const tdb = tenantDb(workspaceId);
    const userRef = tdb.collection('users').doc();
    const userId = userRef.id;
    await userRef.set({
      account_id: req.session.account_id,
      email: req.session.email,
      name: req.session.name,
      username: req.session.email,
      role: 'owner',
      barber_id: '',
      active: true,
      password_hash: '', // uses account-level auth
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    await db.collection('account_workspaces').add({
      account_id: req.session.account_id,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      created_at: toIso(new Date()),
    });

    // Default settings
    await tdb.collection('shop_config').doc('settings').set({
      shop_name: name, timezone: SHOP_TIME_ZONE, currency: 'USD',
      created_at: toIso(new Date()),
    });

    return res.status(201).json({ ok: true, workspace_id: workspaceId, name });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// POST /api/workspaces/:id/invite
app.post('/api/workspaces/:id/invite', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const wsId = req.params.id;
    const email = safeStr(req.body?.email || '').toLowerCase().trim();
    const role = safeStr(req.body?.role || 'barber');
    if (!email) return res.status(400).json({ error: 'email required' });
    if (!['admin', 'barber', 'student'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const tdb = tenantDb(wsId);
    await tdb.collection('invites').add({
      email,
      role,
      invited_by: req.session.user_id,
      status: 'pending',
      created_at: toIso(new Date()),
    });

    return res.json({ ok: true, invited: email, role });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// POST /api/workspaces/:id/join
app.post('/api/workspaces/:id/join', authMiddleware, async (req, res) => {
  try {
    const wsId = req.params.id;
    const accountId = req.session.account_id;
    const email = req.session.email;

    // Check invite
    const tdb = tenantDb(wsId);
    const invSnap = await tdb.collection('invites').where('email', '==', email).where('status', '==', 'pending').limit(1).get();
    if (invSnap.empty) return res.status(403).json({ error: 'No pending invite for your email' });

    const invite = invSnap.docs[0].data();

    // Create user in workspace
    const userRef = tdb.collection('users').doc();
    const userId = userRef.id;
    await userRef.set({
      account_id: accountId,
      email,
      name: req.session.name,
      username: email,
      role: invite.role,
      barber_id: '',
      active: true,
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    await db.collection('account_workspaces').add({
      account_id: accountId,
      workspace_id: wsId,
      user_id: userId,
      role: invite.role,
      created_at: toIso(new Date()),
    });

    await invSnap.docs[0].ref.update({ status: 'accepted', accepted_at: toIso(new Date()) });

    return res.json({ ok: true, workspace_id: wsId, user_id: userId, role: invite.role });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    if (req.tdb) {
      const userDoc = await req.tdb.collection('users').doc(req.session.user_id || req.session.uid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        return res.json({
          user: {
            uid: userDoc.id, user_id: userDoc.id, account_id: req.session.account_id,
            workspace_id: req.session.workspace_id,
            email: u.email || req.session.email,
            name: safeStr(u.name || req.session.name),
            role: safeStr(u.role || req.session.role),
            barber_id: safeStr(u.barber_id || ''),
            photo_url: safeStr(u.photo_url || '') || null,
            schedule: u.schedule || null,
            mentor_barber_ids: Array.isArray(u.mentor_barber_ids) ? u.mentor_barber_ids : [],
            notification_prefs: u.notification_prefs || null,
          },
          permissions: PERMISSIONS[u.role || req.session.role] || PERMISSIONS.barber,
        });
      }
    }
    return res.json({ user: req.session, permissions: PERMISSIONS[req.session.role] || PERMISSIONS.barber });
  } catch { return res.json({ user: req.session, permissions: PERMISSIONS[req.session.role] || PERMISSIONS.barber }); }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const v = validate(ChangePasswordSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { current_password, new_password } = v.data;

    // Check against account
    const accountDoc = await db.collection('accounts').doc(req.session.account_id).get();
    if (!accountDoc.exists) return res.status(404).json({ error: 'Account not found' });
    if (!checkPassword(current_password, accountDoc.data().password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await accountDoc.ref.update({ password_hash: hashPassword(new_password), updated_at: toIso(new Date()) });
    return res.json({ ok: true, message: 'Password updated' });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// POST /api/auth/logout
app.post('/api/auth/logout', optionalAuth, async (req, res) => {
  if (req.tdb) writeAuditLog(req.tdb, { action: 'user.logout', resource_id: req.session?.user_id || '', data: {}, req }).catch(() => {});
  res.set('Set-Cookie', buildClearCookie());
  return res.json({ ok: true });
});

// ============================================================
// ALL REMAINING ROUTES — TENANT-SCOPED
// All routes below require auth + workspace
// ============================================================

// Barbers
app.get('/api/barbers', authMiddleware, async (req, res) => {
  try {
    const snap = await req.tdb.collection('barbers').orderBy('name').get();
    const list = snap.docs.map(d => {
      const data = d.data() || {}; if (data.active === false) return null;
      const pub = normalizeBarberPublicProfile(data, data.level);
      return { id: d.id, name: safeStr(data.name), level: safeStr(data.level || ''), photo_url: safeStr(data.photo_url || '') || null, team_member_id: safeStr(data.team_member_id || '') || null, schedule: data.schedule || null, work_schedule: data.work_schedule || null, schedule_overrides: data.schedule_overrides || {}, active: data.active !== false, created_at: data.created_at || null, updated_at: data.updated_at || null, username: safeStr(data.username || ''), portfolio: Array.isArray(data.portfolio) ? data.portfolio : [], ...pub, public_card: barberToPublicCard({ id: d.id, ...data, ...pub }) };
    }).filter(Boolean);
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/barbers', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const body = req.body || {}; const name = safeStr(body.name);
    if (!name) return res.status(400).json({ error: 'name is required' });
    const level = safeStr(body.level), photo_url = safeStr(body.photo_url || '');
    const schedule = body.schedule && typeof body.schedule === 'object' ? normalizeSchedule(body.schedule) : null;
    const pub = normalizeBarberPublicProfile(body, level);
    const doc = { name, level: level || null, photo_url: photo_url || null, team_member_id: safeStr(body.team_member_id || '') || null, username: safeStr(body.username || '') || null, ...pub, public_role: pub.public_role || level || null, schedule, work_schedule: schedule, active: true, created_at: toIso(new Date()), updated_at: toIso(new Date()) };
    const ref = await req.tdb.collection('barbers').add(doc);
    return res.status(201).json({ id: ref.id, ...doc, public_card: barberToPublicCard({ id: ref.id, ...doc }) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/barbers/:id', authMiddleware, async (req, res) => {
  try {
    const b = await getBarberById(req.tdb, req.params.id);
    if (!b) return res.status(404).json({ error: 'barber not found' });
    const pub = normalizeBarberPublicProfile(b, b.level);
    return res.json({ barber: { ...b, ...pub, public_card: barberToPublicCard({ ...b, ...pub }) } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/barbers/:id/schedule-override', authMiddleware, async (req, res) => {
  try {
    const barberId = req.params.id;
    const { date, startMin, endMin, enabled, remove } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const ref = req.tdb.collection('barbers').doc(barberId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Barber not found' });
    const current = doc.data()?.schedule_overrides || {};
    if (remove) delete current[date];
    else current[date] = { startMin: Number(startMin || 600), endMin: Number(endMin || 1200), enabled: enabled !== false };
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    Object.keys(current).forEach(k => { if (k < cutoffKey) delete current[k]; });
    await ref.update({ schedule_overrides: current, updated_at: toIso(new Date()) });
    return res.json({ ok: true, date, overrides: current });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/barbers/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const ref = req.tdb.collection('barbers').doc(id);
    const exists = await ref.get();
    if (!exists.exists) return res.status(404).json({ error: 'barber not found' });
    const patch = req.body || {}, updates = {};
    const sch = patch.schedule || patch.work_schedule || null;
    if (sch && typeof sch === 'object') { const n = normalizeSchedule(sch); updates.schedule = n; updates.work_schedule = n; }
    if (patch.name != null) updates.name = safeStr(patch.name);
    if (patch.level != null) updates.level = safeStr(patch.level);
    if (patch.photo_url != null) updates.photo_url = safeStr(patch.photo_url) || null;
    if (patch.about != null) { const a = safeStr(patch.about); updates.about = a; updates.description = a; updates.bio = a; }
    if (patch.base_price != null) updates.base_price = safeStr(patch.base_price);
    if (patch.public_role != null) updates.public_role = safeStr(patch.public_role);
    if (patch.public_enabled != null) updates.public_enabled = toBool(patch.public_enabled, true);
    if (patch.active != null) updates.active = toBool(patch.active, true);
    if (Array.isArray(patch.portfolio)) updates.portfolio = patch.portfolio.filter(x => typeof x === 'string').slice(0, 50);
    updates.updated_at = toIso(new Date());
    await ref.set(updates, { merge: true });
    const snap = await ref.get(), saved = snap.data() || {};
    const pub = normalizeBarberPublicProfile(saved, saved.level);
    return res.json({ barber: { id: snap.id, ...saved, ...pub, public_card: barberToPublicCard({ id: snap.id, ...saved, ...pub }) } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/barbers/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.tdb.collection('barbers').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'barber not found' });
    await ref.set({ active: false, public_enabled: false, updated_at: toIso(new Date()) }, { merge: true });
    return res.json({ ok: true, id: req.params.id, soft_deleted: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Services
app.get('/api/services', authMiddleware, async (req, res) => {
  try {
    const snap = await req.tdb.collection('services').orderBy('name').get();
    return res.json({ services: snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s && s.active !== false) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/services', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {}, name = safeStr(b.name);
    if (!name) return res.status(400).json({ error: 'name required' });
    const payload = { name, duration_minutes: Math.max(1, Math.round(Number(b.duration_minutes ?? 30)) || 30), price_cents: Math.max(0, Math.round(Number(b.price_cents ?? 0))), version: safeStr(b.version) || '1', active: b.active == null ? true : !!b.active, barber_ids: (Array.isArray(b.barber_ids) ? b.barber_ids : []).map(String).filter(Boolean), service_type: safeStr(b.service_type || 'primary'), updated_at: toIso(new Date()) };
    const id = b.id ? safeStr(b.id) : '';
    const ref = id ? req.tdb.collection('services').doc(id) : req.tdb.collection('services').doc();
    const existing = await ref.get(); if (!existing.exists) payload.created_at = toIso(new Date());
    await ref.set(payload, { merge: true });
    const saved = await ref.get();
    return res.json({ service: { id: ref.id, ...saved.data() } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/services/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.tdb.collection('services').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'service not found' });
    const b = req.body || {}, patch = {};
    if (b.name != null) patch.name = safeStr(b.name);
    if (b.duration_minutes != null) patch.duration_minutes = Math.max(1, Math.round(Number(b.duration_minutes) || 30));
    if (b.price_cents != null) patch.price_cents = Math.max(0, Math.round(Number(b.price_cents)));
    if (b.active != null) patch.active = !!b.active;
    if (b.service_type != null) patch.service_type = safeStr(b.service_type);
    if (Array.isArray(b.barber_ids)) patch.barber_ids = b.barber_ids.map(String).filter(Boolean);
    patch.updated_at = toIso(new Date());
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    return res.json({ service: { id: saved.id, ...saved.data() } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/services/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.tdb.collection('services').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'service not found' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Clients
app.post('/api/clients', authMiddleware, async (req, res) => {
  try {
    const v = validate(ClientCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { name, phone, email } = v.data;
    const doc = { name: sanitizeHtml(name), phone: phone || null, phone_norm: normPhone(phone) || null, email: sanitizeHtml(email) || null, created_at: toIso(new Date()), updated_at: toIso(new Date()) };
    const ref = await req.tdb.collection('clients').add(doc);
    writeAuditLog(req.tdb, { action: 'client.create', resource_id: ref.id, data: { name }, req }).catch(() => {});
    return res.status(201).json({ id: ref.id, ...doc, client_status: 'new' });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/clients', authMiddleware, async (req, res) => {
  try {
    const q = safeStr(req.query?.q || '').toLowerCase();
    const snap = await req.tdb.collection('clients').orderBy('created_at', 'desc').limit(500).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (q) list = list.filter(c => String(c.name || '').toLowerCase().includes(q) || String(c.phone_norm || '').includes(q) || String(c.email || '').toLowerCase().includes(q));
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/clients/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await req.tdb.collection('clients').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    const data = doc.data();
    const bSnap = await req.tdb.collection('bookings').where('client_name', '==', String(data.name || '')).orderBy('start_at', 'desc').limit(20).get();
    const bookings = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ id: doc.id, ...data, bookings });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/clients/:id', authMiddleware, async (req, res) => {
  try {
    const v = validate(ClientPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const b = v.data, patch = { updated_at: toIso(new Date()) };
    if (b.name != null) patch.name = sanitizeHtml(safeStr(b.name));
    if (b.phone != null) { patch.phone = safeStr(b.phone) || null; patch.phone_norm = normPhone(b.phone) || null; }
    if (b.email != null) patch.email = sanitizeHtml(safeStr(b.email));
    if (b.notes != null) patch.notes = sanitizeHtml(safeStr(b.notes));
    if (b.status != null) patch.status = safeStr(b.status);
    if (b.preferred_barber != null) patch.preferred_barber = safeStr(b.preferred_barber);
    if (Array.isArray(b.tags)) patch.tags = b.tags.map(t => sanitizeHtml(safeStr(t))).filter(Boolean);
    if (b.photo_url != null) patch.photo_url = safeStr(b.photo_url) || null;
    const ref = req.tdb.collection('clients').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    await ref.update(patch);
    writeAuditLog(req.tdb, { action: 'client.update', resource_id: req.params.id, data: patch, req }).catch(() => {});
    return res.json({ id: req.params.id, ...doc.data(), ...patch });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/clients/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const ref = req.tdb.collection('clients').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Client not found' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Bookings
app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const from = parseIso(req.query?.from), to = parseIso(req.query?.to);
    if (!from || !to) return res.status(400).json({ error: 'from and to required (ISO)' });
    const session = req.session;
    let bookings;
    if (session.role === 'barber' && session.barber_id) {
      const snap = await req.tdb.collection('bookings').where('barber_id', '==', session.barber_id).where('start_at', '>=', toIso(from)).where('start_at', '<', toIso(to)).orderBy('start_at').get();
      bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (session.role === 'student') {
      const mentorIds = Array.isArray(session.mentor_barber_ids) ? session.mentor_barber_ids : [];
      if (!mentorIds.length) return res.json({ bookings: [] });
      const snaps = await Promise.all(mentorIds.map(bid => req.tdb.collection('bookings').where('barber_id', '==', bid).where('start_at', '>=', toIso(from)).where('start_at', '<', toIso(to)).orderBy('start_at').get()));
      bookings = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
      bookings.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
    } else {
      const snap = await req.tdb.collection('bookings').where('start_at', '>=', toIso(from)).where('start_at', '<', toIso(to)).orderBy('start_at').get();
      bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return res.json({ bookings });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const v = validate(BookingCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const session = req.session;
    if (session.role === 'barber' && session.barber_id) {
      const reqBarberId = safeStr(req.body?.barber_id || '');
      if (reqBarberId && reqBarberId !== session.barber_id) return res.status(403).json({ error: 'Barbers can only create bookings for themselves' });
    }
    const body = req.body || {};
    const client_name = sanitizeHtml(safeStr(body.client_name || body.client) || 'Client');
    const client_phone = safeStr(body.client_phone || body.phone) || null;
    const barber_id = safeStr(body.barber_id) || '';
    let barber_name = sanitizeHtml(safeStr(body.barber_name || body.barber) || '');
    if (barber_id && !barber_name) { try { const bDoc = await req.tdb.collection('barbers').doc(barber_id).get(); if (bDoc.exists) barber_name = safeStr(bDoc.data()?.name || ''); } catch {} }
    const service_id = safeStr(body.service_id || ''), service_name = sanitizeHtml(safeStr(body.service_name || 'Service'));
    const status = safeStr(body.status || 'booked'), source = safeStr(body.source || 'crm');
    const notes = sanitizeHtml(safeStr(body.notes)) || null;
    const paid = !!body.paid;
    const start = parseIso(body.start_at), duration = Number(body.duration_minutes || 30);
    if (!barber_id) return res.status(400).json({ error: 'barber_id required' });
    if (!start) return res.status(400).json({ error: 'start_at required (ISO)' });
    const end = parseIso(body.end_at) || new Date(start.getTime() + Math.max(1, duration) * 60000);
    const doc = { client_name, client_phone, barber_id, barber_name, service_id: service_id || null, service_name, status, paid, start_at: toIso(start), end_at: toIso(end), duration_minutes: Math.max(1, Math.round((end - start) / 60000)), source, notes, customer_note: sanitizeHtml(safeStr(body.customer_note)) || notes, created_at: toIso(new Date()), updated_at: toIso(new Date()), client: client_name, barber: barber_name || barber_id, service: service_name, booking_type: safeStr(body.booking_type || '') || null, student_id: safeStr(body.student_id || '') || null, training_type: safeStr(body.training_type || '') || null };
    const result = await db.runTransaction(async tx => {
      await ensureNoConflictTx(tx, req.tdb, { barberId: barber_id, startAt: start, endAt: end });
      const ref = req.tdb.collection('bookings').doc(); tx.set(ref, doc); return { id: ref.id };
    });
    const bookingData = { ...doc, id: result.id };
    sendBookingConfirmation(req.tdb, bookingData).catch(() => {});
    scheduleReminders(req.tdb, result.id, bookingData).catch(() => {});
    sendCrmPushToStaff(req.tdb, barber_id, 'New Booking', `${client_name} at ${formatDateTime(toIso(start))}`, { type: 'booking', booking_id: result.id }).catch(() => {});
    writeAuditLog(req.tdb, { action: 'booking.create', resource_id: result.id, data: { barber_id, client_name }, req }).catch(() => {});
    return res.status(201).json({ id: result.id, ...doc });
  } catch (e) {
    if (e?.code === 'CONFLICT' || String(e?.message || '').includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
    return res.status(500).json({ error: e?.message });
  }
});

app.patch('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const v = validate(BookingPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const body = req.body || {}, patch = {};
    if (body.client_name != null) { patch.client_name = sanitizeHtml(safeStr(body.client_name)); patch.client = patch.client_name; }
    if (body.client_phone != null) { patch.client_phone = safeStr(body.client_phone) || null; patch.phone = patch.client_phone; }
    if (body.barber_id != null) patch.barber_id = safeStr(body.barber_id) || null;
    if (body.barber_name != null) { patch.barber_name = sanitizeHtml(safeStr(body.barber_name)); patch.barber = patch.barber_name; }
    if (body.service_id != null) patch.service_id = safeStr(body.service_id) || null;
    if (body.service_name != null) { patch.service_name = sanitizeHtml(safeStr(body.service_name)); patch.service = patch.service_name; }
    if (body.status != null) patch.status = safeStr(body.status);
    if (body.notes != null) patch.notes = sanitizeHtml(safeStr(body.notes)) || null;
    if (body.paid != null) patch.paid = !!body.paid;
    if (body.payment_status === 'paid') patch.paid = true;
    if (body.payment_method != null) patch.payment_method = safeStr(body.payment_method);
    if (body.tip != null || body.tip_amount != null) { const tipVal = Number(body.tip ?? body.tip_amount ?? 0); patch.tip = Math.max(0, tipVal); patch.tip_amount = patch.tip; }
    if (body.amount != null || body.service_amount != null) { const amt = Number(body.amount ?? body.service_amount ?? 0); if (Number.isFinite(amt) && amt >= 0) patch.service_amount = amt; }
    if (body.start_at) { const d = parseIso(body.start_at); if (!d) return res.status(400).json({ error: 'start_at must be ISO' }); patch.start_at = toIso(d); }
    if (body.end_at) { const d = parseIso(body.end_at); if (!d) return res.status(400).json({ error: 'end_at must be ISO' }); patch.end_at = toIso(d); }
    if (body.duration_minutes != null) patch.duration_minutes = Math.max(30, Math.round(Number(body.duration_minutes) / 30) * 30);
    patch.updated_at = toIso(new Date());
    const ref = req.tdb.collection('bookings').doc(id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'booking not found' });
    const prev = existing.data() || {};
    const nextBarberId = patch.barber_id != null ? safeStr(patch.barber_id) : safeStr(prev.barber_id);
    const nextStart = patch.start_at ? parseIso(patch.start_at) : parseIso(prev.start_at);
    const nextEnd = patch.end_at ? parseIso(patch.end_at) : parseIso(prev.end_at);
    await db.runTransaction(async tx => {
      const moved = nextBarberId !== safeStr(prev.barber_id) || (+nextStart !== +(parseIso(prev.start_at))) || (+nextEnd !== +(parseIso(prev.end_at)));
      if (moved) await ensureNoConflictTxExclude(tx, req.tdb, { barberId: nextBarberId, startAt: nextStart, endAt: nextEnd, excludeBookingId: id });
      tx.set(ref, patch, { merge: true });
    });
    const updated = await ref.get();
    const updatedData = updated.data() || {};
    if (patch.status && patch.status !== (prev.status || 'booked')) {
      writeAuditLog(req.tdb, { action: `booking.${patch.status}`, resource_id: id, data: { old_status: prev.status, new_status: patch.status }, req }).catch(() => {});
      if (patch.status === 'cancelled') sendCancellationSms(req.tdb, updatedData).catch(() => {});
    }
    if (body.start_at && prev.start_at && body.start_at !== prev.start_at) sendRescheduleSms(req.tdb, updatedData).catch(() => {});
    return res.json({ id: updated.id, ...updatedData });
  } catch (e) {
    if (e?.code === 'CONFLICT' || String(e?.message || '').includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
    return res.status(500).json({ error: e?.message });
  }
});

app.delete('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const ref = req.tdb.collection('bookings').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'booking not found' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Payments — Terminal
app.get('/api/payments/terminal/devices', authMiddleware, async (req, res) => {
  try {
    if (!(await getSquareToken(req.tdb))) return res.status(500).json({ error: 'Square not connected' });
    const r = await squareFetch('/v2/devices', { method: 'GET', headers: await squareHeaders(req.tdb) });
    const data = await r.json().catch(() => ({}));
    const devices = (data?.devices || []).map(d => ({ id: d.id, name: d.name || d.id, status: d.status?.category || 'UNKNOWN' }));
    return res.json({ devices });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/payments/terminal', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {}, booking_id = safeStr(body.booking_id);
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' });
    const amountRaw = Number(body.amount || 0);
    const amountCents = Math.round(amountRaw * 100);
    const payment_source = safeStr(body.source || body.payment_method || 'terminal');
    const is_manual = ['cash', 'zelle', 'other'].includes(payment_source);
    const tip_amount = Math.max(0, Number(body.tip || body.tip_amount || 0));
    const doc = {
      booking_id, amount: amountRaw, amount_cents: amountCents, currency: safeStr(body.currency || 'USD'),
      note: safeStr(body.note || '').slice(0, 60), client_name: safeStr(body.client_name || ''),
      barber_id: safeStr(body.barber_id || ''), barber_name: safeStr(body.barber_name || ''),
      service_name: safeStr(body.service_name || ''), service_amount: Math.max(0, Number(body.service_amount || 0)),
      tax_amount: Math.max(0, Number(body.tax_amount || 0)), fee_amount: Math.max(0, Number(body.fee_amount || 0)),
      tip: tip_amount, tip_amount, source: payment_source, payment_method: payment_source,
      provider: is_manual ? payment_source : 'square_terminal',
      status: is_manual ? 'completed' : 'requested', paid: is_manual,
      device_id: is_manual ? null : safeStr(body.device_id || ''),
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.tdb.collection('payment_requests').add(doc);
    if (is_manual) return res.status(201).json({ ok: true, id: ref.id, mode: payment_source, paid: true, ...doc });
    if (!(await getSquareToken(req.tdb))) return res.status(201).json({ ok: true, id: ref.id, mode: 'log_only', ...doc });
    if (!doc.device_id) return res.status(400).json({ error: 'device_id required for terminal payments', log_id: ref.id });
    const checkoutPayload = {
      idempotency_key: ref.id,
      checkout: {
        amount_money: { amount: amountCents, currency: doc.currency },
        ...(doc.note ? { note: doc.note } : {}),
        device_options: { device_id: doc.device_id, tip_settings: { allow_tipping: true, separate_tip_screen: true, custom_tip_field: true } },
        payment_options: { autocomplete: true },
      }
    };
    const squareRes = await squareFetch('/v2/terminals/checkouts', { method: 'POST', headers: await squareHeaders(req.tdb, { hasBody: true }), body: JSON.stringify(checkoutPayload) });
    const squareData = await squareRes.json().catch(() => ({}));
    if (!squareRes.ok) {
      await ref.update({ status: 'square_error', square_error: JSON.stringify(squareData), updated_at: toIso(new Date()) });
      return res.status(squareRes.status).json({ error: 'Square Terminal error', square: squareData, log_id: ref.id });
    }
    const checkout_id = squareData?.checkout?.id || null;
    await ref.update({ status: 'sent_to_terminal', checkout_id, updated_at: toIso(new Date()) });
    return res.status(201).json({ ok: true, id: ref.id, checkout_id, square: squareData });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Payments list
app.get('/api/payments', authMiddleware, async (req, res) => {
  try {
    const from = req.query?.from ? new Date(req.query.from) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const to = req.query?.to ? new Date(req.query.to) : new Date();
    const barberFilter = safeStr(req.query?.barber_id || '');
    const prSnap = await req.tdb.collection('payment_requests').where('created_at', '>=', toIso(from)).where('created_at', '<=', toIso(to)).orderBy('created_at', 'desc').limit(500).get();
    let payments = prSnap.docs.map(d => {
      const p = d.data();
      const amt = Number(p.amount || 0), tipAmt = Number(p.tip || p.tip_amount || 0);
      const src = safeStr(p.source || p.payment_method || 'terminal');
      const status = ['cash', 'zelle', 'other'].includes(src) ? 'paid' : (p.status === 'completed' ? 'paid' : p.status || 'pending');
      return { id: d.id, date: safeStr(p.created_at || '').slice(0, 10), created_at: p.created_at, client_name: safeStr(p.client_name || ''), barber_id: safeStr(p.barber_id || ''), barber_name: safeStr(p.barber_name || ''), method: src, amount: amt, tip: tipAmt, fee: 0, net: amt + tipAmt, status, note: safeStr(p.note || p.service_name || ''), booking_id: safeStr(p.booking_id || ''), source: src };
    });
    if (barberFilter) payments = payments.filter(p => p.barber_id === barberFilter);
    const totals = { gross: payments.reduce((s, p) => s + p.amount + p.tip, 0), tips: payments.reduce((s, p) => s + p.tip, 0), count: payments.length };
    return res.json({ payments, totals, from: toIso(from), to: toIso(to) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Payroll
app.get('/api/payroll/rules', authMiddleware, async (req, res) => {
  try {
    const snap = await req.tdb.collection('payroll_rules').get();
    const rules = {}; snap.docs.forEach(d => { rules[d.id] = d.data(); });
    return res.json({ rules });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/payroll/rules/:barberId', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const barberId = req.params.barberId;
    const b = req.body || {};
    const rule = {
      base_pct: Math.max(0, Math.min(100, Number(b.base_pct ?? 60))),
      tips_pct: Math.max(0, Math.min(100, Number(b.tips_pct ?? 100))),
      tiers: Array.isArray(b.tiers) ? b.tiers.map(t => ({ type: safeStr(t.type || 'revenue'), threshold: Math.max(0, Number(t.threshold || 0)), pct: Math.max(0, Math.min(100, Number(t.pct || 60))) })).filter(t => t.threshold > 0) : [],
      ...(b.hourly_rate != null ? { hourly_rate: Math.max(0, Number(b.hourly_rate || 0)) } : {}),
      updated_at: toIso(new Date()),
    };
    await req.tdb.collection('payroll_rules').doc(barberId).set(rule, { merge: true });
    return res.json({ ok: true, barberId, rule });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/payroll', authMiddleware, async (req, res) => {
  try {
    const from = req.query?.from ? new Date(req.query.from) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const to = req.query?.to ? new Date(req.query.to) : new Date();
    const bookSnap = await req.tdb.collection('bookings').where('start_at', '>=', toIso(from)).where('start_at', '<', toIso(to)).orderBy('start_at').get();
    const bookings = bookSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const barberSnap = await req.tdb.collection('barbers').where('active', '==', true).get();
    const barbers = barberSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rulesSnap = await req.tdb.collection('payroll_rules').get();
    const rules = {}; rulesSnap.docs.forEach(d => { rules[d.id] = d.data(); });
    const EXCLUDED = ['cancelled', 'noshow', 'refunded', 'block'];
    const byBarber = {};
    for (const bk of bookings) {
      const bid = safeStr(bk.barber_id); if (!bid) continue;
      if (safeStr(bk.type || bk.booking_type || '').toLowerCase() === 'block' || safeStr(bk.client_name) === 'BLOCKED') continue;
      if (!byBarber[bid]) byBarber[bid] = { bookings: [], tipsTotal: 0, serviceTotal: 0, clientCount: 0 };
      const status = safeStr(bk.status || '').toLowerCase();
      if (EXCLUDED.includes(status)) { byBarber[bid].bookings.push(bk); continue; }
      byBarber[bid].bookings.push(bk);
      if (bk.paid || status === 'done' || status === 'completed') {
        const baseAmount = Number(bk.service_amount || bk.amount || 0) - Number(bk.tax_amount || 0) - Number(bk.fee_amount || 0);
        byBarber[bid].serviceTotal += Math.max(0, baseAmount);
        byBarber[bid].tipsTotal += Number(bk.tip || bk.tip_amount || 0);
      }
      byBarber[bid].clientCount++;
    }
    const result = barbers.map(barber => {
      const bid = barber.id, data = byBarber[bid] || { bookings: [], tipsTotal: 0, serviceTotal: 0, clientCount: 0 };
      const rule = rules[bid] || { base_pct: 60, tips_pct: 100, tiers: [] };
      const base_pct = Number(rule.base_pct ?? 60), tips_pct = Number(rule.tips_pct ?? 100);
      const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
      let effective_pct = base_pct;
      const allMatching = [...tiers.filter(t => t.type === 'revenue' && data.serviceTotal >= t.threshold), ...tiers.filter(t => t.type === 'clients' && data.clientCount >= t.threshold)];
      if (allMatching.length) effective_pct = Math.max(...allMatching.map(t => t.pct));
      const barber_service_share = data.serviceTotal * (effective_pct / 100);
      const barber_tips = data.tipsTotal * (tips_pct / 100);
      return { barber_id: bid, barber_name: safeStr(barber.name), bookings_count: data.bookings.length, client_count: data.clientCount, service_total: Math.round(data.serviceTotal * 100) / 100, tips_total: Math.round(data.tipsTotal * 100) / 100, effective_pct, barber_service_share: Math.round(barber_service_share * 100) / 100, barber_tips: Math.round(barber_tips * 100) / 100, barber_total: Math.round((barber_service_share + barber_tips) * 100) / 100, rule: { base_pct, tips_pct, tiers } };
    });
    const totals = { service_total: result.reduce((s, r) => s + r.service_total, 0), tips_total: result.reduce((s, r) => s + r.tips_total, 0), barber_total: result.reduce((s, r) => s + r.barber_total, 0) };
    return res.json({ from: toIso(from), to: toIso(to), barbers: result, totals });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Expenses
app.get('/api/expenses', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || ''), to = safeStr(req.query?.to || '');
    let query = req.tdb.collection('expenses').orderBy('date', 'desc').limit(500);
    if (from && to) query = req.tdb.collection('expenses').where('date', '>=', from).where('date', '<=', to).orderBy('date', 'desc').limit(500);
    const snap = await query.get();
    let expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (req.session.role === 'admin') expenses = expenses.filter(e => e.created_by === req.session.user_id);
    return res.json({ expenses });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/expenses', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const amount = Number(b.amount || 0);
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be > 0' });
    const date = safeStr(b.date || '');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Date required (YYYY-MM-DD)' });
    const doc = { amount: Math.round(amount * 100) / 100, category: sanitizeHtml(safeStr(b.category || 'Other')), description: sanitizeHtml(safeStr(b.description || '')), date, created_by: req.session.user_id, created_by_name: req.session.name, created_at: toIso(new Date()), updated_at: toIso(new Date()) };
    const ref = await req.tdb.collection('expenses').add(doc);
    return res.status(201).json({ expense: { id: ref.id, ...doc } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/expenses/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.tdb.collection('expenses').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Expense not found' });
    if (req.session.role === 'admin' && doc.data().created_by !== req.session.user_id) return res.status(403).json({ error: 'Can only edit own expenses' });
    const b = req.body || {}, patch = { updated_at: toIso(new Date()) };
    if (b.amount != null) patch.amount = Math.round(Math.max(0, Number(b.amount)) * 100) / 100;
    if (b.category != null) patch.category = sanitizeHtml(safeStr(b.category));
    if (b.description != null) patch.description = sanitizeHtml(safeStr(b.description));
    if (b.date != null) patch.date = safeStr(b.date);
    await ref.update(patch);
    return res.json({ expense: { id: req.params.id, ...doc.data(), ...patch } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/expenses/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const ref = req.tdb.collection('expenses').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Expense not found' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Cash Reports
app.get('/api/cash-reports', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || ''), to = safeStr(req.query?.to || '');
    let query = req.tdb.collection('cash_reports').orderBy('date', 'desc').limit(90);
    if (from) query = req.tdb.collection('cash_reports').where('date', '>=', from).where('date', '<=', to || from).orderBy('date', 'desc').limit(90);
    const snap = await query.get();
    return res.json({ reports: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/cash-reports', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const date = safeStr(req.body?.date || '');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const actualCash = Number(req.body?.actual_cash ?? 0);
    const notes = sanitizeHtml(safeStr(req.body?.notes || '')).slice(0, 500);
    const existing = await req.tdb.collection('cash_reports').where('date', '==', date).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ actual_cash: actualCash, notes, submitted_by: req.session.name, submitted_at: toIso(new Date()), updated_at: toIso(new Date()) });
      return res.json({ ok: true, id: existing.docs[0].id, updated: true });
    }
    const doc = { date, actual_cash: actualCash, notes, submitted_by: req.session.name, submitted_at: toIso(new Date()), created_at: toIso(new Date()) };
    const ref = await req.tdb.collection('cash_reports').add(doc);
    return res.status(201).json({ ok: true, id: ref.id });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Messages (chat)
const CHAT_ACCESS = { owner: ['general', 'barbers', 'admins', 'students'], admin: ['general', 'barbers', 'admins', 'students'], barber: ['general', 'barbers'], student: ['general', 'students'] };

app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    const chatType = safeStr(req.query?.chatType || 'general');
    const limitN = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
    if (!(CHAT_ACCESS[req.session.role] || []).includes(chatType)) return res.status(403).json({ error: 'Access denied' });
    const snap = await req.tdb.collection('messages').where('chatType', '==', chatType).orderBy('createdAt', 'desc').limit(limitN).get();
    return res.json({ messages: snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse() });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/messages', authMiddleware, async (req, res) => {
  try {
    const chatType = safeStr(req.body?.chatType || '');
    const text = sanitizeHtml(safeStr(req.body?.text || '')).slice(0, 2000);
    if (!chatType || !text) return res.status(400).json({ error: 'chatType and text required' });
    if (!(CHAT_ACCESS[req.session.role] || []).includes(chatType)) return res.status(403).json({ error: 'Access denied' });
    const doc = { chatType, senderId: req.session.user_id || req.session.uid, senderName: req.session.name, senderRole: req.session.role, text, imageUrl: safeStr(req.body?.imageUrl || '') || null, createdAt: toIso(new Date()) };
    const ref = await req.tdb.collection('messages').add(doc);
    sendCrmPushToRoles(req.tdb, [], chatType, `${req.session.name}: ${text.slice(0, 100)}`, { type: 'message', chatType }, req.session.user_id || req.session.uid).catch(() => {});
    return res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Requests
app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    let snap;
    if (['owner', 'admin'].includes(req.session.role)) snap = await req.tdb.collection('requests').orderBy('createdAt', 'desc').limit(100).get();
    else snap = await req.tdb.collection('requests').where('barberId', '==', req.session.uid || req.session.user_id).orderBy('createdAt', 'desc').limit(50).get();
    return res.json({ requests: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const type = safeStr(req.body?.type || '');
    if (!['schedule_change', 'photo_change', 'block_time', 'profile_change', 'service_change'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const doc = { type, barberId: req.session.uid || req.session.user_id, barberName: req.session.name, status: 'pending', data: req.body?.data || {}, createdAt: toIso(new Date()) };
    const ref = await req.tdb.collection('requests').add(doc);
    sendCrmPushToRoles(req.tdb, ['owner', 'admin'], 'New Request', `${req.session.name}: ${type.replace('_', ' ')}`, { type: 'request' }).catch(() => {});
    return res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/requests/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const status = safeStr(req.body?.status || '');
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const ref = req.tdb.collection('requests').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Request not found' });
    await ref.update({ status, reviewedBy: req.session.name, reviewedAt: toIso(new Date()) });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Users (workspace-scoped)
app.get('/api/users', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const snap = await req.tdb.collection('users').orderBy('created_at', 'desc').limit(100).get();
    const users = snap.docs.map(d => {
      const u = d.data();
      return { id: d.id, username: u.username, name: u.name, email: u.email, role: u.role, active: u.active, barber_id: u.barber_id || '', mentor_barber_ids: Array.isArray(u.mentor_barber_ids) ? u.mentor_barber_ids : [], phone: u.phone || null, last_login: u.last_login || null };
    });
    return res.json({ users });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/users', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const v = validate(UserCreateSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { username, password, role, name, barber_id, mentor_barber_ids, phone } = v.data;
    const uname = username.toLowerCase().trim();
    const existing = await req.tdb.collection('users').where('username', '==', uname).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Username already exists' });
    const doc = { username: uname, name: name || uname, role, barber_id: barber_id || '', mentor_barber_ids: Array.isArray(mentor_barber_ids) ? mentor_barber_ids.filter(Boolean) : [], phone: safeStr(phone || '') || null, password_hash: hashPassword(password), active: true, created_at: toIso(new Date()), updated_at: toIso(new Date()) };
    const ref = await req.tdb.collection('users').add(doc);
    return res.status(201).json({ ok: true, id: ref.id, username: uname, name: doc.name, role });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const uid = req.params.id;
    const isSelf = (req.session.user_id || req.session.uid) === uid;
    const isSelfNotifOnly = isSelf && Object.keys(req.body || {}).length === 1 && req.body.notification_prefs;
    if (!isSelfNotifOnly && !hasPermission(req.session, 'canManageUsers')) return res.status(403).json({ error: 'Owner access required' });
    const v = validate(UserPatchSchema, req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const b = v.data, patch = { updated_at: toIso(new Date()) };
    if (b.name != null) patch.name = safeStr(b.name);
    if (b.role != null) patch.role = b.role;
    if (b.active != null) patch.active = b.active;
    if (b.barber_id != null) patch.barber_id = safeStr(b.barber_id);
    if (b.password != null) { patch.password_hash = hashPassword(b.password); patch.password = null; }
    if (Array.isArray(b.mentor_barber_ids)) patch.mentor_barber_ids = b.mentor_barber_ids.filter(Boolean);
    if (b.phone != null) patch.phone = safeStr(b.phone) || null;
    if (b.photo_url != null) patch.photo_url = safeStr(b.photo_url) || null;
    if (Array.isArray(b.schedule)) patch.schedule = b.schedule;
    if (b.notification_prefs) patch.notification_prefs = b.notification_prefs;
    const ref = req.tdb.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    await ref.update(patch);
    return res.json({ ok: true, id: uid, ...doc.data(), ...patch });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/users/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const uid = req.params.id;
    if (uid === (req.session.user_id || req.session.uid)) return res.status(400).json({ error: 'Cannot delete yourself' });
    const ref = req.tdb.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    if (doc.data()?.role === 'owner') return res.status(400).json({ error: 'Cannot delete owner' });
    await ref.update({ active: false, updated_at: toIso(new Date()) });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Settings
app.get('/api/settings', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.tdb.collection('shop_config').doc('settings').get();
    const defaults = {
      shop_name: 'Shop', timezone: SHOP_TIME_ZONE, currency: 'USD',
      tax: { enabled: false, rate: 0, label: 'Tax', included_in_price: false }, fees: [],
      booking: { cancellation_hours: 2, reminder_hours_24: true, reminder_hours_2: true, sms_on_reschedule: true },
      payroll: { default_barber_pct: 60, tips_pct: 100, period: 'weekly' },
      display: { show_prices: true, require_phone: false, allow_notes: true },
    };
    return res.json(doc.exists ? { ...defaults, ...doc.data() } : defaults);
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/settings', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {}, patch = { updated_at: toIso(new Date()) };
    if (b.shop_name != null) patch.shop_name = safeStr(b.shop_name);
    if (b.timezone != null) patch.timezone = safeStr(b.timezone);
    if (b.currency != null) patch.currency = safeStr(b.currency || 'USD');
    if (b.tax && typeof b.tax === 'object') patch.tax = { enabled: !!b.tax.enabled, rate: Math.max(0, Math.min(50, Number(b.tax.rate || 0))), label: safeStr(b.tax.label || 'Tax'), included_in_price: !!b.tax.included_in_price };
    if (Array.isArray(b.fees)) patch.fees = b.fees.map(f => ({ id: safeStr(f.id || '') || ('fee_' + Date.now()), label: safeStr(f.label || 'Fee'), type: ['fixed', 'percent'].includes(f.type) ? f.type : 'percent', value: Math.max(0, Number(f.value || 0)), enabled: !!f.enabled })).filter(f => f.label);
    if (b.booking && typeof b.booking === 'object') patch.booking = b.booking;
    if (b.payroll && typeof b.payroll === 'object') patch.payroll = b.payroll;
    if (b.display && typeof b.display === 'object') patch.display = b.display;
    if (b.shopStatusMode != null) patch.shopStatusMode = safeStr(b.shopStatusMode);
    if (b.bannerEnabled != null) patch.bannerEnabled = !!b.bannerEnabled;
    if (b.bannerText != null) patch.bannerText = sanitizeHtml(safeStr(b.bannerText));
    await req.tdb.collection('shop_config').doc('settings').set(patch, { merge: true });
    return res.json({ ok: true, ...patch });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Memberships
app.get('/api/memberships', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const snap = await req.tdb.collection('memberships').orderBy('created_at', 'desc').limit(200).get();
    return res.json({ memberships: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/memberships', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const client_name = sanitizeHtml(safeStr(b.client_name || ''));
    const barber_id = safeStr(b.barber_id || '');
    if (!client_name) return res.status(400).json({ error: 'client_name required' });
    if (!barber_id) return res.status(400).json({ error: 'barber_id required' });
    const frequency = ['weekly', 'biweekly', 'monthly'].includes(b.frequency) ? b.frequency : 'weekly';
    const doc = {
      client_name, barber_id, barber_name: sanitizeHtml(safeStr(b.barber_name || '')),
      service_id: safeStr(b.service_id || ''), service_name: sanitizeHtml(safeStr(b.service_name || '')),
      duration_minutes: Math.max(15, Math.min(480, Number(b.duration_minutes || 30))),
      frequency, preferred_day: Math.max(0, Math.min(6, Number(b.preferred_day || 0))),
      preferred_time_min: Math.max(0, Math.min(1440, Number(b.preferred_time_min || 600))),
      discount_pct: Math.max(0, Math.min(50, Number(b.discount_pct ?? 10))),
      status: 'active', charge_count: 0,
      created_by: req.session.user_id || req.session.uid,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.tdb.collection('memberships').add(doc);
    return res.status(201).json({ membership: { id: ref.id, ...doc } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/memberships/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ref = req.tdb.collection('memberships').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Membership not found' });
    const b = req.body || {}, patch = { updated_at: toIso(new Date()) };
    if (b.frequency != null && ['weekly', 'biweekly', 'monthly'].includes(b.frequency)) patch.frequency = b.frequency;
    if (b.barber_id != null) patch.barber_id = safeStr(b.barber_id);
    if (b.status != null && ['active', 'paused', 'cancelled'].includes(b.status)) patch.status = b.status;
    if (b.discount_pct != null) patch.discount_pct = Math.max(0, Math.min(50, Number(b.discount_pct)));
    await ref.update(patch);
    return res.json({ membership: { id: req.params.id, ...doc.data(), ...patch } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/memberships/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const ref = req.tdb.collection('memberships').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Membership not found' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Waitlist
app.get('/api/waitlist', authMiddleware, async (req, res) => {
  try {
    const date = safeStr(req.query?.date || '');
    let query = req.tdb.collection('waitlist').where('notified', '==', false);
    if (date) query = query.where('date', '==', date);
    const snap = await query.orderBy('created_at', 'desc').limit(100).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (req.session.role === 'barber' && req.session.barber_id) list = list.filter(w => w.barber_id === req.session.barber_id);
    return res.json({ waitlist: list });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/waitlist', authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const doc = {
      phone_norm: normPhone(safeStr(b.phone)), phone_raw: safeStr(b.phone),
      client_name: sanitizeHtml(safeStr(b.client_name)) || null,
      barber_id: safeStr(b.barber_id), barber_name: safeStr(b.barber_name),
      date: safeStr(b.date), service_ids: Array.isArray(b.service_ids) ? b.service_ids : [],
      duration_minutes: Math.max(1, Number(b.duration_minutes || 30)),
      notified: false, added_by: req.session.user_id || req.session.uid,
      created_at: toIso(new Date()),
    };
    if (!doc.barber_id || !doc.date) return res.status(400).json({ error: 'barber_id and date required' });
    const ref = await req.tdb.collection('waitlist').add(doc);
    return res.status(201).json({ ok: true, id: ref.id, ...doc });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/waitlist/:id', authMiddleware, async (req, res) => {
  try {
    const ref = req.tdb.collection('waitlist').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const action = safeStr(req.body?.action || '');
    if (action === 'confirm') { await ref.update({ notified: true, confirmed: true, confirmed_at: toIso(new Date()) }); return res.json({ ok: true }); }
    if (action === 'remove') { await ref.update({ notified: true, removed: true, removed_at: toIso(new Date()) }); return res.json({ ok: true }); }
    return res.status(400).json({ error: 'action must be confirm or remove' });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Reviews
app.get('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const snap = await req.tdb.collection('reviews').orderBy('createdAt', 'desc').limit(200).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const barberId = safeStr(req.query?.barber_id || '');
    if (barberId) list = list.filter(r => r.barber_id === barberId);
    const avg = list.length ? Math.round(list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length * 10) / 10 : 0;
    return res.json({ reviews: list, avg, count: list.length });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const doc = { barber_id: safeStr(b.barber_id || ''), barber_name: safeStr(b.barber_name || ''), name: sanitizeHtml(safeStr(b.name || 'Anonymous')), rating: Math.max(1, Math.min(5, Number(b.rating || 5))), text: sanitizeHtml(safeStr(b.text || '')).slice(0, 2000), source: safeStr(b.source || 'crm'), status: safeStr(b.status || 'pending'), createdAt: toIso(new Date()) };
    const ref = await req.tdb.collection('reviews').add(doc);
    return res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/reviews/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const status = safeStr(req.body?.status || '');
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Use approved or rejected' });
    const ref = req.tdb.collection('reviews').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Not found' });
    await ref.update({ status, reviewedBy: req.session.name, reviewedAt: toIso(new Date()) });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/reviews/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    await req.tdb.collection('reviews').doc(req.params.id).delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Applications
app.get('/api/applications', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const snap = await req.tdb.collection('applications').orderBy('created_at', 'desc').limit(200).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const statusFilter = safeStr(req.query?.status || '');
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    return res.json({ applications: list, count: list.length });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.patch('/api/applications/:id', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const status = safeStr(req.body?.status || '');
    if (!['new', 'reviewed', 'interview', 'hired', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const ref = req.tdb.collection('applications').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Not found' });
    await ref.update({ status, reviewed_by: req.session.name, updated_at: toIso(new Date()) });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.delete('/api/applications/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    await req.tdb.collection('applications').doc(req.params.id).delete();
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Students
app.get('/api/users/students', authMiddleware, async (req, res) => {
  try {
    const snap = await req.tdb.collection('users').where('role', '==', 'student').where('active', '==', true).get();
    let students = snap.docs.map(d => { const u = d.data(); return { id: d.id, name: u.name || u.username, role: 'student', mentor_barber_ids: Array.isArray(u.mentor_barber_ids) ? u.mentor_barber_ids : [] }; });
    if (req.session.role === 'barber' && req.session.barber_id) students = students.filter(s => s.mentor_barber_ids.includes(req.session.barber_id));
    return res.json({ students });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Push Registration
app.post('/api/push/register', authMiddleware, async (req, res) => {
  try {
    const deviceToken = safeStr(req.body?.device_token);
    if (!deviceToken) return res.status(400).json({ error: 'device_token required' });
    await req.tdb.collection('crm_push_tokens').doc(deviceToken).set({
      device_token: deviceToken, platform: safeStr(req.body?.platform || 'ios'),
      user_id: req.session.user_id || req.session.uid, user_name: req.session.name,
      role: req.session.role, barber_id: safeStr(req.session.barber_id || ''),
      updated_at: toIso(new Date()),
    }, { merge: true });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Attendance
const SHOP_LAT = Number(process.env.SHOP_LAT || 42.15482);
const SHOP_LNG = Number(process.env.SHOP_LNG || -87.98261);
const CLOCK_RADIUS_M = Number(process.env.CLOCK_RADIUS_M || 250);

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/api/attendance/status', authMiddleware, async (req, res) => {
  try {
    const uid = req.session.user_id || req.session.uid;
    const todayStr = chicagoDateStr();
    const todaySnap = await req.tdb.collection('attendance').where('user_id', '==', uid).where('date', '==', todayStr).get();
    let clocked_in = false, attendance_id = null, clock_in = null;
    for (const doc of todaySnap.docs) {
      const data = doc.data();
      if (data.clock_out === null || data.clock_out === undefined) {
        clocked_in = true; attendance_id = doc.id;
        clock_in = data.clock_in ? (typeof data.clock_in.toDate === 'function' ? data.clock_in.toDate().toISOString() : data.clock_in) : null;
        break;
      }
    }
    let today_minutes = 0;
    todaySnap.docs.forEach(d => { if (d.data().duration_minutes) today_minutes += Number(d.data().duration_minutes); });
    if (clocked_in && clock_in) today_minutes += Math.max(0, Math.round((Date.now() - new Date(clock_in).getTime()) / 60000));
    return res.json({ clocked_in, attendance_id, clock_in, today_minutes });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-in', authMiddleware, async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng required' });
    const dist = haversineMeters(Number(lat), Number(lng), SHOP_LAT, SHOP_LNG);
    if (dist > CLOCK_RADIUS_M) return res.status(403).json({ error: `Must be at shop. You are ${Math.round(dist)}m away.`, distance: Math.round(dist) });
    const uid = req.session.user_id || req.session.uid;
    const todaySnap = await req.tdb.collection('attendance').where('user_id', '==', uid).where('date', '==', chicagoDateStr()).get();
    const alreadyOpen = todaySnap.docs.some(d => d.data().clock_out === null || d.data().clock_out === undefined);
    if (alreadyOpen) return res.status(409).json({ error: 'Already clocked in' });
    const now = new Date();
    const doc = { user_id: uid, user_name: req.session.name, barber_id: req.session.barber_id || null, role: req.session.role, clock_in: Timestamp.fromDate(now), clock_out: null, clock_in_lat: Number(lat), clock_in_lng: Number(lng), duration_minutes: null, date: chicagoDateStr(now) };
    const ref = await req.tdb.collection('attendance').add(doc);
    sendCrmPushToRoles(req.tdb, ['owner'], 'Clock In', `${req.session.name} clocked in`, { type: 'attendance' }).catch(() => {});
    return res.json({ ok: true, attendance_id: ref.id, clock_in: now.toISOString() });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-out', authMiddleware, async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng required' });
    const uid = req.session.user_id || req.session.uid;
    const mySnap = await req.tdb.collection('attendance').where('user_id', '==', uid).where('date', '==', chicagoDateStr()).get();
    const openDoc = mySnap.docs.find(d => d.data().clock_out === null || d.data().clock_out === undefined);
    if (!openDoc) return res.status(404).json({ error: 'Not clocked in' });
    const docData = openDoc.data();
    const clockInTime = docData.clock_in ? (typeof docData.clock_in.toDate === 'function' ? docData.clock_in.toDate() : new Date(docData.clock_in)) : new Date();
    const now = new Date();
    const dist = haversineMeters(Number(lat), Number(lng), SHOP_LAT, SHOP_LNG);
    const duration_minutes = Math.round((now.getTime() - clockInTime.getTime()) / 60000);
    await openDoc.ref.update({ clock_out: Timestamp.fromDate(now), clock_out_lat: Number(lat), clock_out_lng: Number(lng), duration_minutes: Math.max(0, duration_minutes), at_shop: dist <= CLOCK_RADIUS_M, distance_meters: Math.round(dist) });
    return res.json({ ok: true, duration_minutes: Math.max(0, duration_minutes), clock_out: now.toISOString(), at_shop: dist <= CLOCK_RADIUS_M });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/admin-clock-out', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { attendance_id } = req.body || {};
    if (!attendance_id) return res.status(400).json({ error: 'attendance_id required' });
    const docRef = req.tdb.collection('attendance').doc(attendance_id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Record not found' });
    const docData = docSnap.data();
    if (docData.clock_out !== null && docData.clock_out !== undefined) return res.status(400).json({ error: 'Already clocked out' });
    const clockInTime = docData.clock_in ? (typeof docData.clock_in.toDate === 'function' ? docData.clock_in.toDate() : new Date(docData.clock_in)) : new Date();
    const now = new Date();
    const duration_minutes = Math.round((now.getTime() - clockInTime.getTime()) / 60000);
    await docRef.update({ clock_out: Timestamp.fromDate(now), duration_minutes: Math.max(0, duration_minutes), admin_clock_out: true, admin_clock_out_by: req.session.user_id || req.session.uid });
    return res.json({ ok: true, duration_minutes: Math.max(0, duration_minutes), clock_out: now.toISOString() });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/attendance', authMiddleware, async (req, res) => {
  try {
    const fromDate = safeStr(req.query?.from || chicagoDateStr());
    const toDate = safeStr(req.query?.to || chicagoDateStr());
    const isAdmin = ['owner', 'admin'].includes(req.session.role);
    const snap = await req.tdb.collection('attendance').where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'desc').limit(500).get();
    let filteredDocs = snap.docs;
    if (!isAdmin) filteredDocs = filteredDocs.filter(d => d.data().user_id === (req.session.user_id || req.session.uid));
    const records = filteredDocs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, clock_in: data.clock_in ? (typeof data.clock_in.toDate === 'function' ? data.clock_in.toDate().toISOString() : data.clock_in) : null, clock_out: data.clock_out ? (typeof data.clock_out.toDate === 'function' ? data.clock_out.toDate().toISOString() : data.clock_out) : null };
    });
    const by_user = {}; let total_minutes = 0;
    records.forEach(r => {
      const uid = r.user_id;
      if (!by_user[uid]) by_user[uid] = { name: r.user_name, role: r.role, total_minutes: 0, shifts: 0 };
      if (r.duration_minutes) { by_user[uid].total_minutes += r.duration_minutes; total_minutes += r.duration_minutes; }
      by_user[uid].shifts++;
    });
    return res.json({ attendance: records, summary: { total_minutes, total_hours: +(total_minutes / 60).toFixed(1), by_user } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Audit logs
app.get('/api/audit-logs', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const limitN = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
    const snap = await req.tdb.collection('audit_logs').orderBy('created_at', 'desc').limit(limitN).get();
    let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const actionF = safeStr(req.query?.action || '');
    if (actionF) logs = logs.filter(l => String(l.action || '').includes(actionF));
    return res.json({ logs, count: logs.length });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Availability report
app.post('/api/availability/report', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const date = safeStr(body.date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const barbers = Array.isArray(body.barbers) ? body.barbers : [];
    if (!barbers.length) return res.status(400).json({ error: 'barbers[] required' });
    const dayRef = req.tdb.collection('availability_reports').doc(date);
    const batch = db.batch();
    batch.set(dayRef, { date, source: safeStr(body.source || 'crm'), generated_at: safeStr(body.generated_at) || toIso(new Date()), updated_at: toIso(new Date()) }, { merge: true });
    const cleaned = [];
    for (const b of barbers) {
      const barber_id = safeStr(b?.barber_id); if (!barber_id) continue;
      const docRef = dayRef.collection('barbers').doc(barber_id);
      const busy = Array.isArray(b?.busy) ? b.busy.slice(0, 500) : [];
      const free_slots = Array.isArray(b?.free_slots) ? b.free_slots.slice(0, 2000).map(s => safeStr(s)).filter(Boolean) : [];
      batch.set(docRef, { date, barber_id, barber_name: safeStr(b?.barber_name || ''), busy, free_slots, busy_count: busy.length, free_count: free_slots.length, updated_at: toIso(new Date()) }, { merge: true });
      cleaned.push({ barber_id, busy_count: busy.length, free_count: free_slots.length });
    }
    await batch.commit();
    return res.json({ ok: true, date, barbers: cleaned });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Public routes (workspace-scoped via workspace_id query param or path)
app.get('/public/:workspace_id/barbers', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const snap = await tdb.collection('barbers').orderBy('name').get();
    const barbers = snap.docs.map(d => {
      const data = d.data() || {}; if (data.active === false) return null;
      const pub = normalizeBarberPublicProfile(data, data.level);
      if (pub.public_enabled === false) return null;
      return { id: d.id, name: safeStr(data.name), level: safeStr(data.level || ''), photo_url: safeStr(data.photo_url || '') || null, schedule: data.schedule || defaultSchedule(), schedule_overrides: data.schedule_overrides || {}, portfolio: Array.isArray(data.portfolio) ? data.portfolio : [], ...pub, public_card: barberToPublicCard({ id: d.id, ...data, ...pub }) };
    }).filter(Boolean);
    return res.json({ barbers });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/services', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    return res.json({ services: await listActiveServices(tdb) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/availability', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const barber_id = safeStr(req.body?.barber_id), start = parseIso(req.body?.start_at), end = parseIso(req.body?.end_at);
    const durationMin = Math.max(1, Number(req.body?.duration_minutes || 30));
    if (!barber_id || !start || !end) return res.status(400).json({ error: 'barber_id, start_at, end_at required' });
    const barber = await getBarberById(tdb, barber_id);
    if (!barber) return res.status(400).json({ error: 'Unknown barber_id' });
    const rangeOk = clampDateRange(start, end);
    if (!rangeOk) return res.status(400).json({ error: 'Invalid date range' });
    const busy = await getBusyIntervalsForBarber(tdb, barber.id, toIso(rangeOk.start), toIso(rangeOk.end));
    const avail = [];
    for (const cur of eachTzDay(rangeOk.start, rangeOk.end, SHOP_TIME_ZONE)) {
      const sch = getScheduleForDate(barber, cur, SHOP_TIME_ZONE);
      let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone: SHOP_TIME_ZONE, busy });
      slots = slots.filter(t => t >= rangeOk.start && t < rangeOk.end && t > new Date());
      slots = filterSlotsAgainstBusy(slots, busy, durationMin);
      for (const t of slots) avail.push({ start_at: toIso(t), local_day: getTzDateKey(t, SHOP_TIME_ZONE) });
    }
    return res.json({ time_zone: SHOP_TIME_ZONE, availabilities: avail, slots: avail.map(x => x.start_at) });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/bookings', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const booking = req.body?.booking || {};
    const startAt = parseIso(booking.start_at), customerId = safeStr(booking.customer_id), barberId = safeStr(booking.barber_id);
    if (!startAt || !customerId || !barberId) return res.status(400).json({ error: 'booking.start_at, customer_id, barber_id required' });
    const barber = await getBarberById(tdb, barberId);
    if (!barber) return res.status(400).json({ error: 'Unknown barber_id' });
    const customerSnap = await tdb.collection('clients').doc(customerId).get();
    if (!customerSnap.exists) return res.status(400).json({ error: 'Unknown customer_id' });
    const customer = customerSnap.data() || {};
    const durationMin = Math.max(1, Number(booking.duration_minutes || 30));
    const endAt = new Date(startAt.getTime() + durationMin * 60000);
    const doc = {
      customer_id: customerId, client_name: safeStr(customer.name) || 'Client', client_phone: safeStr(customer.phone) || null,
      barber_id: barber.id, barber_name: safeStr(barber.name), service_name: safeStr(booking.service_name || 'Service'),
      status: 'booked', paid: false, start_at: toIso(startAt), end_at: toIso(endAt), duration_minutes: durationMin,
      source: 'website', customer_note: sanitizeHtml(safeStr(booking.customer_note)) || null,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const result = await db.runTransaction(async tx => {
      await ensureNoConflictTx(tx, tdb, { barberId: barber.id, startAt, endAt });
      const ref = tdb.collection('bookings').doc(); tx.set(ref, doc); return { id: ref.id };
    });
    sendBookingConfirmation(tdb, { ...doc, id: result.id }).catch(() => {});
    scheduleReminders(tdb, result.id, { ...doc, id: result.id }).catch(() => {});
    sendCrmPushToStaff(tdb, barber.id, 'New Booking', `${safeStr(customer.name)} at ${formatDateTime(toIso(startAt))}`, { type: 'booking', booking_id: result.id }).catch(() => {});
    return res.status(201).json({ booking_id: result.id, id: result.id });
  } catch (e) {
    if (e?.code === 'CONFLICT' || String(e?.message || '').includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked' });
    return res.status(500).json({ error: e?.message });
  }
});

app.post('/public/:workspace_id/clients', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const phoneRaw = safeStr(req.body?.phone), phone = normPhone(phoneRaw);
    const first = safeStr(req.body?.first_name), last = safeStr(req.body?.last_name), email = safeStr(req.body?.email);
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const snap = await tdb.collection('clients').where('phone_norm', '==', phone).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0], existing = doc.data() || {};
      const full = `${first}${last ? ' ' + last : ''}`.trim();
      const patch = { updated_at: toIso(new Date()) };
      if (full) patch.name = full; if (email) patch.email = email;
      if (Object.keys(patch).length > 1) await doc.ref.set(patch, { merge: true });
      return res.json({ id: doc.id, client: { id: doc.id, ...existing, ...patch } });
    }
    if (!first) return res.status(400).json({ error: 'first_name required for new client' });
    const full = `${first}${last ? ' ' + last : ''}`.trim();
    const doc = { name: full, given_name: first, family_name: last || null, email: email || null, phone: phoneRaw || null, phone_norm: phone, created_at: toIso(new Date()), updated_at: toIso(new Date()) };
    const ref = await tdb.collection('clients').add(doc);
    return res.status(201).json({ id: ref.id, client: { id: ref.id, ...doc } });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/public/:workspace_id/config', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const doc = await tdb.collection('shop_config').doc('settings').get();
    const data = doc.exists ? doc.data() : {};
    return res.json({ shopStatusMode: safeStr(data.shopStatusMode || 'auto'), bannerEnabled: !!data.bannerEnabled, bannerText: safeStr(data.bannerText || ''), hero_media_url: safeStr(data.hero_media_url || ''), hero_media_type: safeStr(data.hero_media_type || 'video') });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/public/:workspace_id/reviews', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const snap = await tdb.collection('reviews').where('status', '==', 'approved').orderBy('createdAt', 'desc').limit(200).get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const avg = list.length ? Math.round(list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length * 10) / 10 : 0;
    return res.json({ ok: true, items: list.map(r => ({ name: r.name, rating: r.rating, text: r.text, ts: r.createdAt })), avg, count: list.length });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/reviews', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const b = req.body || {};
    const doc = { barber_id: safeStr(b.barber_id || ''), barber_name: safeStr(b.barber_name || ''), name: sanitizeHtml(safeStr(b.name || 'Anonymous')), rating: Math.max(1, Math.min(5, Number(b.rating || 5))), text: sanitizeHtml(safeStr(b.text || '')).slice(0, 2000), source: 'website', status: 'pending', createdAt: toIso(new Date()) };
    const ref = await tdb.collection('reviews').add(doc);
    return res.status(201).json({ ok: true, id: ref.id, status: 'pending' });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/waitlist', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const phone = normPhone(safeStr(req.body?.phone));
    const barber_id = safeStr(req.body?.barber_id);
    const date = safeStr(req.body?.date);
    if (!phone) return res.status(400).json({ error: 'phone required' });
    if (!barber_id) return res.status(400).json({ error: 'barber_id required' });
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const existing = await tdb.collection('waitlist').where('phone_norm', '==', phone).where('barber_id', '==', barber_id).where('date', '==', date).where('notified', '==', false).limit(1).get();
    if (!existing.empty) return res.json({ ok: true, id: existing.docs[0].id, already: true });
    const doc = { phone_norm: phone, phone_raw: safeStr(req.body?.phone), client_name: safeStr(req.body?.client_name) || null, barber_id, barber_name: safeStr(req.body?.barber_name), date, duration_minutes: Math.max(1, Number(req.body?.duration_minutes || 30)), notified: false, created_at: toIso(new Date()) };
    const ref = await tdb.collection('waitlist').add(doc);
    sendCrmPushToStaff(tdb, barber_id, 'Waitlist', `${doc.client_name || 'Client'} wants ${date}`, { type: 'waitlist' }).catch(() => {});
    return res.status(201).json({ ok: true, id: ref.id });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/device-tokens', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const token = safeStr(req.body?.token), customer_id = safeStr(req.body?.customer_id);
    if (!token || !customer_id) return res.status(400).json({ error: 'token and customer_id required' });
    await tdb.collection('device_tokens').doc(token).set({ token, customer_id, platform: safeStr(req.body?.platform || 'ios'), updated_at: toIso(new Date()) }, { merge: true });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/verify/send', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const phone = normPhone(safeStr(req.body?.phone));
    if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid phone required' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await tdb.collection('phone_verify').doc(`verify_${phone}`).set({ phone, code, attempts: 0, expires_at: toIso(new Date(Date.now() + 10 * 60 * 1000)), created_at: toIso(new Date()) });
    const formatted = phone.length === 10 ? `+1${phone}` : `+${phone}`;
    await sendSms(formatted, `Your verification code is ${code}. Do not share this code.${SMS_FOOTER}`).catch(() => {});
    return res.json({ ok: true, sent: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/verify/check', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const phone = normPhone(safeStr(req.body?.phone)), code = safeStr(req.body?.code);
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
    const ref = tdb.collection('phone_verify').doc(`verify_${phone}`);
    const doc = await ref.get();
    if (!doc.exists) return res.status(400).json({ error: 'No code sent' });
    const data = doc.data();
    if (new Date(data.expires_at) < new Date()) { await ref.delete(); return res.status(400).json({ error: 'Code expired' }); }
    if ((data.attempts || 0) >= 5) { await ref.delete(); return res.status(429).json({ error: 'Too many attempts' }); }
    if (data.code !== code) { await ref.update({ attempts: (data.attempts || 0) + 1 }); return res.status(400).json({ error: 'Invalid code' }); }
    await ref.delete();
    const clientSnap = await tdb.collection('clients').where('phone_norm', '==', phone).limit(1).get();
    let client = null;
    if (!clientSnap.empty) { const cd = clientSnap.docs[0].data(); client = { id: clientSnap.docs[0].id, name: cd.name || null, email: cd.email || null }; }
    return res.json({ ok: true, verified: true, client });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post('/public/:workspace_id/applications', async (req, res) => {
  try {
    const tdb = tenantDb(req.params.workspace_id);
    const b = req.body || {};
    const doc = {
      type: safeStr(b.type || 'application'), role: safeStr(b.role || 'Barber'),
      name: sanitizeHtml(safeStr(b.name || '')), phone: safeStr(b.phone || ''),
      email: sanitizeHtml(safeStr(b.email || '')), instagram: sanitizeHtml(safeStr(b.instagram || '')),
      experience: safeStr(b.experience || ''), motivation: sanitizeHtml(safeStr(b.motivation || '')),
      status: 'new', source: safeStr(b.source || 'website'), created_at: toIso(new Date()),
    };
    if (!doc.name) return res.status(400).json({ error: 'name required' });
    if (!doc.phone) return res.status(400).json({ error: 'phone required' });
    const ref = await tdb.collection('applications').add(doc);
    return res.status(201).json({ ok: true, id: ref.id });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Square OAuth (workspace-scoped)
app.get('/api/square/oauth/url', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    if (!SQUARE_APP_SECRET) return res.status(500).json({ error: 'SQUARE_APP_SECRET not configured' });
    const state = crypto.randomBytes(32).toString('hex');
    await req.tdb.collection('shop_config').doc('square_oauth_state').set({ state, created_at: toIso(new Date()), uid: req.session.user_id });
    const redirectUri = `${req.protocol}://${req.get('host')}/api/square/oauth/callback`;
    const scopes = 'PAYMENTS_READ PAYMENTS_WRITE ORDERS_READ MERCHANT_PROFILE_READ DEVICES_READ';
    const url = `${SQUARE_BASE}/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${encodeURIComponent(scopes)}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.json({ url });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.get('/api/square/oauth/status', authMiddleware, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.tdb.collection('shop_config').doc('square_oauth').get();
    if (!doc.exists || !doc.data()?.access_token) return res.json({ connected: false });
    const d = doc.data();
    return res.json({ connected: true, merchant_id: d.merchant_id || '', connected_at: d.connected_at || null });
  } catch { return res.json({ connected: false }); }
});

app.post('/api/square/oauth/disconnect', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    await req.tdb.collection('shop_config').doc('square_oauth').delete();
    return res.json({ ok: true, disconnected: true });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

// Webhooks
app.post('/api/webhooks/square', async (req, res) => {
  // Square webhooks are not tenant-scoped by default
  // In production, use a workspace_id in the webhook URL or lookup by checkout_id
  return res.json({ ok: true });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path, method: req.method }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`VuriumBook backend running on port ${PORT}`);
  console.log(`CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!SQUARE_TOKEN_ENV) console.warn('WARNING: SQUARE_TOKEN not set');
  if (!APNS_KEY_P8) console.warn('WARNING: APNS_KEY_P8 not set - push notifications disabled');
});
