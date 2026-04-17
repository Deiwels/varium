// ============================================================
// Vurium SaaS — Multi-Tenant Backend (v3.1.0)
// Cloud Run: https://vuriumbook-api-431945333485.us-central1.run.app
// AI Diagnostics powered by Claude Sonnet
// ============================================================
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const http2 = require('http2');
const path = require('path');
const fsPromises = require('fs').promises;
const { z } = require('zod');
const { Firestore } = require('@google-cloud/firestore');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
// BE.9 — server-side DOMPurify via linkedom for custom HTML sanitization.
// linkedom is ~500 KB vs ~20 MB for jsdom → faster Cloud Run cold start.
// Lazy-initialized on first use so cold-start cost is deferred until a
// write site actually needs it.
const { Window: LinkedomWindow } = require('linkedom');
const createDOMPurify = require('dompurify');
let _domPurifyInstance = null;
function getDomPurify() {
  if (_domPurifyInstance) return _domPurifyInstance;
  _domPurifyInstance = createDOMPurify(new LinkedomWindow());
  return _domPurifyInstance;
}

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

// BE.1 — distributed job-lock instance id. Generated once at module load, unique per
// Cloud Run revision/instance so `withJobLock()` can detect whether a lock is held by
// "me" (safe to refresh/release) or "another instance" (skip this cycle).
const JOB_INSTANCE_ID = crypto.randomBytes(8).toString('hex');

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
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
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

// BUG-013 fix: webhook endpoints need their raw body for signature verification
// (Stripe HMAC, Apple JWS, Stripe Connect HMAC). The global express.json() would consume
// the stream first and leave req.body as a parsed object with no way to reconstruct the
// exact raw bytes. Skip JSON parsing here for webhook paths — each webhook route applies
// its own express.raw() / express.json() middleware inline.
function isWebhookEndpoint(fullPath) {
  if (!fullPath) return false;
  return fullPath === '/api/stripe/webhook' || fullPath.startsWith('/api/webhooks/');
}
const jsonParser = express.json({ limit: '10mb' });
app.use((req, res, next) => {
  if (isWebhookEndpoint(req.path)) return next();
  return jsonParser(req, res, next);
});

// CSRF protection — verify Origin/Referer for state-changing requests
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  // Skip for webhooks (Stripe, Stripe Connect, Apple, Telnyx, Square) — they don't send Origin
  if (isWebhookEndpoint(req.path)) return next();
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  // Allow if no origin (server-to-server, curl, mobile apps)
  if (!origin && !referer) return next();
  // Check origin against allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) return next();
  // Check referer starts with allowed origin
  if (referer && ALLOWED_ORIGINS.some(ao => referer.startsWith(ao))) return next();
  // In development, allow localhost
  if (NODE_ENV !== 'production') return next();
  // Reject
  console.warn('CSRF blocked:', { method: req.method, path: req.path, origin, referer: referer.slice(0, 60) });
  return res.status(403).json({ error: 'Forbidden: invalid origin' });
});

// Security headers
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com https://connect.facebook.net https://*.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' https://*.stripe.com https://*.googleapis.com https://api.telnyx.com https://api.resend.com https://*.run.app",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
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

// ============================================================
// BE.9 — Custom HTML / CSS sanitization (plan: BE.9-DOMPurify-Custom-HTML-Plan-v2)
// ============================================================
// Defense-in-depth Layer 1 (backend-primary). Called at every site_config
// write site before the value lands in Firestore. The frontend booking page
// applies Layer 2 (DOMPurify at render) as a safety net.
//
// Scope: public booking page only — custom_html / custom_css / ai_css.
// Not in scope: developer/email templates, email HTML signatures
// (still use sanitizeHtml() entity escaping above).
//
// CSS sanitizer is intentionally regex-based per Option A in the plan — the
// three dangerous CSS patterns (expression, url(javascript:), @import) are
// well-defined and the regex approach keeps us off a css-tree dependency.
// Google Fonts imports are explicitly allowed because the AI Style generator
// and real user CSS both legitimately reference them.
// ============================================================

const CUSTOM_CSS_MAX_LEN = 50000; // 50 KB hard cap per plan — DoS prevention

function sanitizeCustomCss(css) {
  if (!css || typeof css !== 'string') return '';
  let out = css;
  // Strip CSS `expression(...)` — IE-era XSS vector still recognized by some engines
  out = out.replace(/expression\s*\(/gi, '');
  // Rewrite any `javascript:` URL inside url(...) to a safe no-op
  out = out.replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(');
  // Block @import except Google Fonts (legitimate for AI-generated styles)
  out = out.replace(/@import\b(?!(?:[^;]*fonts\.googleapis\.com))/gi, '/* @import blocked */');
  // Hard cap length
  if (out.length > CUSTOM_CSS_MAX_LEN) out = out.slice(0, CUSTOM_CSS_MAX_LEN);
  return out;
}

function sanitizeCustomHtml(html) {
  if (!html || typeof html !== 'string') return '';
  try {
    const dom = getDomPurify();
    return dom.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'b', 'i', 'strong', 'em', 'u',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'div', 'span', 'section', 'article', 'header', 'footer',
        'hr',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'pre', 'code',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe', 'style', 'link', 'meta'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    });
  } catch (e) {
    console.warn('[BE.9] sanitizeCustomHtml threw, falling back to entity-escape:', e?.message);
    // Defense-in-depth: if DOMPurify crashes on a weird input we still return
    // SOMETHING escaped rather than letting the raw string through.
    return sanitizeHtml(html);
  }
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
// plan_type: individual ($29) | salon | custom
// billing_status: trialing | active | past_due | canceled | inactive
// effective_plan: during trial → custom (full access, 14 days)
//                 active subscription → paid plan
//                 expired / no subscription → 'expired' (no access, no bookings)
// ============================================================
const PLAN_FEATURES = {
  expired: {
    member_limit: 0, staff_limit: 0,
    features: [],
  },
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

  // During active trial → give full access (custom) so user can try everything
  if (billingStatus === 'trialing') {
    const trialEnd = wsData?.trial_ends_at ? new Date(wsData.trial_ends_at) : null;
    if (trialEnd && trialEnd > new Date()) {
      return 'custom';
    }
  }

  // Active or cancelling subscription → give the plan they paid for
  // 'cancelling' means auto-renew is off but current period is still active
  if (billingStatus === 'active' || billingStatus === 'cancelling') {
    // Check Apple subscription expiry (webhook may be delayed)
    if (wsData?.billing_source === 'apple' && wsData?.apple_expires_at) {
      if (new Date(wsData.apple_expires_at) < new Date()) return 'expired';
    }
    // Map legacy plan names
    if (planType === 'starter' || planType === 'free' || planType === 'trial') return 'individual';
    if (planType === 'pro') return 'salon';
    if (planType === 'enterprise') return 'custom';
    if (['individual', 'salon', 'custom'].includes(planType)) return planType;
    return 'individual';
  }

  // past_due (grace period) → still give access
  if (billingStatus === 'past_due') {
    if (['individual', 'salon', 'custom'].includes(planType)) return planType;
    return 'individual';
  }

  // No active subscription / canceled / expired trial → no access
  return 'expired';
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

function encryptPII(text) {
  const key = getPhoneEncryptionKey();
  if (!key || !text) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'enc:' + iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + tag.toString('hex');
  } catch { return text; }
}

function decryptPII(value) {
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
  } catch { return value; }
}

// ============================================================
// TOTP (RFC 6238) — MFA for admin/owner accounts
// ============================================================
function generateTOTPSecret() {
  return crypto.randomBytes(20).toString('hex');
}

function toBase32(hex) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(hex, 'hex');
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

function generateTOTP(secretHex, timeStep = 30, digits = 6) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex')).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % (10 ** digits);
  return String(code).padStart(digits, '0');
}

function verifyTOTP(secretHex, token, window = 1) {
  for (let i = -window; i <= window; i++) {
    const epoch = Math.floor(Date.now() / 1000) + i * 30;
    const counter = Math.floor(epoch / 30);
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuf.writeUInt32BE(counter & 0xffffffff, 4);
    const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex')).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
    if (String(code).padStart(6, '0') === String(token).trim()) return true;
  }
  return false;
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

function telnyxVerifyFallbackFrom() {
  // Keep OTP/verification traffic isolated from reminder senders when a dedicated
  // platform 2FA number is configured. Falls back only if the OTP-specific env var
  // has not been provisioned yet.
  return safeStr(process.env.TELNYX_VERIFY_FROM || process.env.TELNYX_FROM);
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

// Get per-workspace SMS config.
// New workspaces should use a dedicated toll-free number once the owner enables SMS in Settings.
// Legacy / grandfathered workspaces may still use their dedicated 10DLC registration path.
// Global TELNYX_FROM is allowed only for flows that explicitly opt into fallback
// (for example public OTP while Verify is still using the legacy local-code path).
async function getWorkspaceSmsConfig(wsId, opts = {}) {
  const allowGlobalFallback = opts.allowGlobalFallback !== false;
  const fallbackFrom = allowGlobalFallback ? safeStr(process.env.TELNYX_FROM) : '';
  if (!wsId) return { fromNumber: fallbackFrom, brandName: '', status: 'none', numberType: '', canSend: !!fallbackFrom };
  try {
    const doc = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
    const data = doc.exists ? doc.data() : {};
    const status = safeStr(data.sms_registration_status || 'none');
    const numberType = safeStr(data.sms_number_type || '');
    const hasOwnNumber = !!data.sms_from_number;
    const isVerified = status === 'active' || status === 'verified';
    const canSend = (hasOwnNumber && isVerified) || (!hasOwnNumber && !!fallbackFrom);
    return {
      fromNumber: hasOwnNumber && isVerified ? safeStr(data.sms_from_number) : fallbackFrom,
      brandName: safeStr(data.sms_brand_name || data.shop_name || ''),
      status,
      numberType,
      canSend,
    };
  } catch { return { fromNumber: fallbackFrom, brandName: '', status: 'none', numberType: '', canSend: !!fallbackFrom }; }
}

const DEFAULT_SMS_CONSENT_TEXT =
  'I agree to receive appointment notifications via SMS (confirmations, reminders, reschedules, and cancellations). Message frequency may vary (up to 5 per booking). Standard message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase.';

async function sendSms(to, body, fromOverride, wsId) {
  // By default, send from the workspace sender when one is active.
  // Some OTP flows still pass a global fallback sender explicitly while Verify is being rolled out.
  const { apiKey, from } = telnyxCredentials();
  if (!apiKey) { console.warn('Telnyx not configured'); return Promise.resolve(null); }
  const effectiveFrom = fromOverride || from;
  if (!effectiveFrom) { console.warn('Telnyx FROM not configured'); return Promise.resolve(null); }
  const toFormatted = formatPhone(to);
  if (!toFormatted) { console.warn('sendSms: invalid phone', to); return Promise.resolve(null); }
  // Log SMS send for compliance audit trail
  const phoneNormLog = normPhone(to);
  db.collection('sms_logs').add({
    phone_last4: phoneNormLog ? '****' + phoneNormLog.slice(-4) : '****',
    direction: 'outbound',
    from_number: effectiveFrom,
    workspace_id: wsId || null,
    message_preview: String(body || '').slice(0, 50) + '...',
    char_count: String(body || '').length,
    sent_at: toIso(new Date()),
  }).catch(() => {});
  const payload = JSON.stringify({ from: effectiveFrom, to: toFormatted, text: body });
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



// ─── Telnyx REST API helper ───────────────────────────────────────────────────
function telnyxApi(method, path, body) {
  const { apiKey } = telnyxCredentials();
  if (!apiKey) return Promise.reject(new Error('Telnyx not configured'));
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.telnyx.com',
      path: path.startsWith('/') ? path : '/' + path,
      method,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (resp.statusCode >= 400) reject(new Error(parsed?.errors?.[0]?.detail || parsed?.error || `Telnyx API ${resp.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error('Telnyx API parse error')); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Email via Resend ─────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM_DOMAIN = 'noreply@vurium.com';
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app';

// Most email clients (Gmail, Outlook, Apple Mail) strip `data:` URIs from
// <img src>. When the workspace logo is stored as a data URL, substitute a
// public HTTPS endpoint that decodes and serves the image on demand.
function resolveEmailLogoUrl(wsId, rawLogoUrl) {
  const s = String(rawLogoUrl || '');
  if (!s) return '';
  if (s.startsWith('data:')) return `${BACKEND_PUBLIC_URL}/public/workspaces/${encodeURIComponent(wsId)}/logo`;
  return s;
}

function sendEmailOnce(to, subject, html, fromName) {
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

async function sendEmail(to, subject, html, fromName, retries = 2) {
  if (!RESEND_API_KEY) { console.warn('Resend not configured'); return null; }
  if (!to) return null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await sendEmailOnce(to, subject, html, fromName);
    if (result?.id) return result; // success
    if (attempt < retries) {
      const delay = (attempt + 1) * 2000; // 2s, 4s
      console.warn(`sendEmail retry ${attempt + 1}/${retries} for ${to} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error(`sendEmail FAILED after ${retries + 1} attempts: ${to} — ${subject}`);
  return null;
}

const EMAIL_THEMES = {
  modern:       { bg: '#010101', card: '#0d0d0d', border: 'rgba(255,255,255,.08)', text: '#e8e8ed', muted: 'rgba(255,255,255,.5)', accent: 'rgba(130,150,220,.7)', footer: 'rgba(255,255,255,.15)' },
  classic:      { bg: '#f5f5f5', card: '#ffffff', border: 'rgba(0,0,0,.08)', text: '#1a1a1a', muted: 'rgba(0,0,0,.5)', accent: '#333', footer: 'rgba(0,0,0,.2)' },
  bold:         { bg: '#080808', card: '#111111', border: 'rgba(255,255,255,.1)', text: '#ffffff', muted: 'rgba(255,255,255,.55)', accent: '#fff', footer: 'rgba(255,255,255,.18)' },
  'dark-luxury': { bg: '#0c0a08', card: '#12100e', border: 'rgba(200,170,120,.12)', text: '#e8dcc8', muted: 'rgba(200,170,120,.5)', accent: '#c8a87a', footer: 'rgba(200,170,120,.2)' },
  'dark-cosmos': { bg: '#010101', card: '#0a0a0e', border: 'rgba(255,255,255,.05)', text: '#f0f0f5', muted: 'rgba(255,255,255,.40)', accent: 'rgba(130,150,220,.7)', footer: 'rgba(255,255,255,.15)' },
  colorful:     { bg: '#fafafa', card: '#ffffff', border: 'rgba(99,102,241,.12)', text: '#2a2a2a', muted: 'rgba(0,0,0,.45)', accent: '#6366f1', footer: 'rgba(99,102,241,.3)' },
  custom:       { bg: '#000000', card: '#0d0d0d', border: 'rgba(255,255,255,.08)', text: '#e9e9e9', muted: 'rgba(255,255,255,.5)', accent: '#0a84ff', footer: 'rgba(255,255,255,.15)' },
};

function vuriumEmailTemplate(title, bodyHtml, shopName, logoUrl, template, contactInfo) {
  const displayName = shopName || 'VuriumBook';
  const t = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
  const isLight = ['classic', 'colorful'].includes(template);
  const colorScheme = isLight ? 'light' : 'dark';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" width="40" height="40" style="border-radius:10px;display:block;margin:0 auto;" alt="${displayName}">`
    : `<div style="width:48px;height:48px;margin:0 auto;border-radius:14px;background:${isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'};border:1px solid ${t.border};text-align:center;line-height:48px;font-size:22px;font-weight:700;color:${t.muted};">${(displayName || 'V')[0].toUpperCase()}</div>`;
  const contactLines = [];
  if (contactInfo?.address) contactLines.push(sanitizeHtml(String(contactInfo.address)));
  if (contactInfo?.phone) contactLines.push(sanitizeHtml(String(contactInfo.phone)));
  const contactHtml = contactLines.length
    ? `<div style="font-size:11px;color:${t.muted};line-height:1.6;margin-bottom:12px;">
${shopName ? `<strong style="color:${t.text};">${sanitizeHtml(shopName)}</strong><br>` : ''}${contactLines.join('<br>')}
</div>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="${colorScheme}">
<meta name="supported-color-schemes" content="${colorScheme}">
<style>:root{color-scheme:${colorScheme};}body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}img{-ms-interpolation-mode:bicubic;border:0;}</style>
</head>
<body style="margin:0;padding:0;background:${t.bg};font-family:'Inter',Helvetica,Arial,sans-serif;color:${t.text};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:480px;background:${t.card};border:1px solid ${t.border};border-radius:20px;overflow:hidden;">
<tr><td style="padding:32px 28px 24px;text-align:center;background:${t.card};">
<div style="margin-bottom:16px;">
${logoHtml}
</div>
<div style="font-size:13px;font-weight:500;color:${t.muted};letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;">${displayName}</div>
<h1 style="margin:0;font-size:22px;font-weight:600;color:${t.text};letter-spacing:-.02em;">${title}</h1>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:14px;line-height:1.7;color:${t.muted};background:${t.card};">
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${t.border};text-align:center;background:${t.card};">
${contactHtml}
<a href="https://vurium.com" style="font-size:11px;color:${t.footer};text-decoration:none;">Powered by VuriumBook&trade;</a>
<div style="margin-top:8px;font-size:11px;color:${t.footer};">
<a href="https://vurium.com/privacy" style="color:${t.footer};text-decoration:underline;">Privacy Policy</a>
&nbsp;&middot;&nbsp;
<a href="https://vurium.com/terms" style="color:${t.footer};text-decoration:underline;">Terms of Service</a>
</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function getWorkspaceEmailConfig(wsId) {
  const [settingsDoc, wsDoc] = await Promise.all([
    db.collection('workspaces').doc(wsId).collection('settings').doc('config').get(),
    db.collection('workspaces').doc(wsId).get(),
  ]);
  const s = settingsDoc.exists ? settingsDoc.data() : {};
  const w = wsDoc.exists ? wsDoc.data() : {};
  return {
    shopName: safeStr(s?.shop_name || ''),
    logoUrl: resolveEmailLogoUrl(wsId, s?.logo_url || ''),
    tz: s?.timezone || 'America/Chicago',
    // 'custom' is a website-only template (custom HTML/CSS) — fall back to 'modern' for emails
    template: (['modern','classic','bold','dark-luxury','colorful'].includes(w?.site_config?.template) ? w.site_config.template : 'modern'),
    contactInfo: {
      address: safeStr(s?.shop_address || ''),
      phone: safeStr(s?.shop_phone || ''),
    },
  };
}

function getVuriumMailboxMeta(account) {
  const email = safeStr(account || '').trim().toLowerCase();
  if (email === 'billing@vurium.com') {
    return {
      teamLabel: 'Billing',
      teamEmail: 'billing@vurium.com',
      fromName: 'Vurium Billing',
      fromHeader: 'Vurium Billing <billing@vurium.com>',
      eyebrow: 'Billing message',
      intro: 'You are receiving this message from the Vurium billing team.',
      actionNote: 'Reply directly to this email if you need help with billing, invoices, or plan changes.',
      signature: 'Vurium Billing',
    };
  }
  if (email === 'sales@vurium.com') {
    return {
      teamLabel: 'Sales',
      teamEmail: 'sales@vurium.com',
      fromName: 'Vurium Sales',
      fromHeader: 'Vurium Sales <sales@vurium.com>',
      eyebrow: 'Sales message',
      intro: 'You are receiving this message from the Vurium sales team.',
      actionNote: 'Reply directly to this email if you would like help with pricing, demos, or rollout questions.',
      signature: 'Vurium Sales',
    };
  }
  if (email === 'security@vurium.com') {
    return {
      teamLabel: 'Security',
      teamEmail: 'security@vurium.com',
      fromName: 'Vurium Security',
      fromHeader: 'Vurium Security <security@vurium.com>',
      eyebrow: 'Security message',
      intro: 'You are receiving this message from the Vurium security team.',
      actionNote: 'Reply directly to this email if you need help with account safety or security-related questions.',
      signature: 'Vurium Security',
    };
  }
  return {
    teamLabel: 'Support',
    teamEmail: 'support@vurium.com',
    fromName: 'Vurium Support',
    fromHeader: 'Vurium Support <support@vurium.com>',
    eyebrow: 'Support message',
    intro: 'You are receiving this message from the Vurium support team.',
    actionNote: 'Reply directly to this email if you need anything else and our team will pick it up.',
    signature: 'Vurium Support',
  };
}

// ─── Support/Admin Email Template — formal, logo in header bar ────────────────
function vuriumSupportEmailTemplate(subject, bodyHtml, opts = {}) {
  const teamLabel = sanitizeHtml(safeStr(opts.teamLabel || 'Support'));
  const teamEmail = sanitizeHtml(safeStr(opts.teamEmail || 'support@vurium.com'));
  const eyebrow = sanitizeHtml(safeStr(opts.eyebrow || `${teamLabel} message`));
  const intro = sanitizeHtml(safeStr(opts.intro || `You are receiving this message from the Vurium ${teamLabel.toLowerCase()} team.`));
  const actionNote = sanitizeHtml(safeStr(opts.actionNote || 'Reply directly to this email if you need anything else and our team will pick it up.'));
  const signature = sanitizeHtml(safeStr(opts.signature || `Vurium ${teamLabel}`));
  const cleanSubject = sanitizeHtml(safeStr(subject || 'Message from Vurium'));
  const preheader = sanitizeHtml(safeStr(opts.preheader || `${cleanSubject} — message from ${signature}`));
  const safeBody = bodyHtml || '<p style="margin:0;color:#475467;">No message content.</p>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#101828;">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
<tr><td style="padding:0 6px 18px;">
<table cellpadding="0" cellspacing="0" style="margin:0 auto 0 0;">
<tr>
<td style="width:52px;vertical-align:middle;">
<img src="https://vurium.com/logo-transparent-dark.png?v=2" width="52" height="52" style="width:52px;height:52px;display:block;object-fit:contain;" alt="Vurium">
</td>
<td style="padding-left:14px;vertical-align:middle;">
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#667085;font-weight:600;">Vurium</div>
<div style="font-size:16px;font-weight:600;color:#101828;letter-spacing:-.02em;">${teamLabel}</div>
</td>
</tr>
</table>
</td></tr>
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dfe5ef;border-radius:22px;overflow:hidden;">
<tr><td style="padding:28px 32px 18px;border-bottom:1px solid #edf1f7;">
<div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#eef2ff;border:1px solid #d8ddf5;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4f5f86;">${eyebrow}</div>
<h1 style="margin:18px 0 10px;font-size:28px;line-height:1.18;font-weight:650;color:#101828;letter-spacing:-.03em;">${cleanSubject}</h1>
<p style="margin:0;font-size:14px;line-height:1.7;color:#667085;">${intro}</p>
</td></tr>
<tr><td style="padding:24px 32px 8px;">
<div style="font-size:15px;line-height:1.8;color:#344054;">
${safeBody}
</div>
</td></tr>
<tr><td style="padding:0 32px 30px;">
<div style="margin-top:24px;padding:16px 18px;border-radius:14px;background:#f8fafc;border:1px solid #e8edf5;font-size:13px;line-height:1.7;color:#475467;">
${actionNote}
</div>
<div style="margin-top:26px;font-size:14px;line-height:1.7;color:#475467;">
<div style="margin-bottom:2px;">Best,</div>
<div style="font-weight:600;color:#101828;">${signature}</div>
<div><a href="mailto:${teamEmail}" style="color:#4f5f86;text-decoration:none;">${teamEmail}</a></div>
</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 10px 0;font-size:11px;line-height:1.7;color:#98a2b3;">
<a href="https://vurium.com" style="color:#98a2b3;text-decoration:none;">vurium.com</a>
&nbsp;&middot;&nbsp;
<a href="https://vurium.com/privacy" style="color:#98a2b3;text-decoration:underline;">Privacy Policy</a>
&nbsp;&middot;&nbsp;
<a href="https://vurium.com/terms" style="color:#98a2b3;text-decoration:underline;">Terms of Service</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function scheduleReminders(wsCol, bookingId, booking, timeZone, shopName, fromNumber) {
  try {
    const startAt = parseIso(booking.start_at);
    if (!startAt) return;
    const phone = booking.client_phone || booking.phone_norm;
    if (!phone) return;
    const reminderPhoneNorm = normPhone(phone);
    const clientName = booking.client_name || 'Client';
    const barberName = booking.barber_name || 'your specialist';
    const prefix = shopName ? `${shopName}: ` : '';
    const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || 'America/Chicago' });
    const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timeZone || 'America/Chicago' });
    // 24h reminder
    const remind24 = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    if (remind24 > new Date()) {
      await wsCol('sms_reminders').add({ booking_id: bookingId, phone, phone_norm: reminderPhoneNorm, from_number: fromNumber || null, type: '24h', send_at: toIso(remind24), sent: false, message: `${prefix}Reminder: Your appointment with ${barberName} is tomorrow ${dateStr} at ${timeStr}. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, created_at: toIso(new Date()) });
    }
    // 2h reminder
    const remind2 = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
    if (remind2 > new Date()) {
      await wsCol('sms_reminders').add({ booking_id: bookingId, phone, phone_norm: reminderPhoneNorm, from_number: fromNumber || null, type: '2h', send_at: toIso(remind2), sent: false, message: `${prefix}Reminder: Your appointment with ${barberName} is in 2 hours at ${timeStr}. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, created_at: toIso(new Date()) });
    }
  } catch (e) { console.warn('scheduleReminders error:', e?.message); }
}

// ============================================================
// WAITLIST AUTO-FILL — notify waitlist clients when a cancellation opens a slot
// ============================================================
async function tryWaitlistAutoFill(wsId, cancelledBooking) {
  try {
    const wsCol = (col) => db.collection(`workspaces/${wsId}/${col}`);
    const settingsDoc = await wsCol('settings').doc('config').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    // SET-006 (revised): only bail if owner EXPLICITLY set waitlist_enabled to false.
    // Previously a bare falsy check (undefined default) silently disabled auto-fill on
    // every Salon+ workspace that never toggled the setting — the feature was dead by
    // default. Plan-level gate is enforced below via `getEffectivePlan()` flow (see
    // `POST /public/waitlist/:workspace_id` for the same guard).
    if (settings.waitlist_enabled === false) return;
    const timeZone = settings.timezone || 'America/Chicago';
    const shopName = settings.shop_name || '';

    const startAt = parseIso(cancelledBooking.start_at);
    if (!startAt || startAt <= new Date()) return; // only future bookings
    const barberId = cancelledBooking.barber_id;
    if (!barberId) return;
    const dateKey = getTzDateKey(startAt, timeZone);

    // Find waitlist entries matching this barber + date
    const waitSnap = await wsCol('waitlist').where('notified', '==', false).where('barber_id', '==', barberId).where('date', '==', dateKey).limit(10).get();
    if (waitSnap.empty) return;

    const barberDoc = await wsCol('barbers').doc(barberId).get();
    if (!barberDoc.exists || barberDoc.data()?.active === false) return;
    const barber = barberDoc.data();

    // Check if the cancelled slot is actually free now
    const slotEnd = parseIso(cancelledBooking.end_at) || addMinutes(startAt, cancelledBooking.duration_minutes || 30);
    const busy = await getBusyIntervalsForBarber(wsCol, barberId, toIso(startAt), toIso(slotEnd));
    const conflicting = busy.filter(iv => iv.start < slotEnd && startAt < iv.end);
    if (conflicting.length > 0) return; // slot not actually free

    const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
    const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone });
    const bookUrl = `https://vurium.com/book/${wsId}`;
    const smsConf = await getWorkspaceSmsConfig(wsId, { allowGlobalFallback: false });
    const prefix = shopName ? `${shopName}: ` : '';

    for (const wDoc of waitSnap.docs) {
      const w = wDoc.data();
      // Check preferred time window
      if (w.preferred_start_min || w.preferred_end_min < 1440) {
        const p = getTzParts(startAt, timeZone);
        const slotMin = p.hour * 60 + p.minute;
        if (slotMin < (w.preferred_start_min || 0) || slotMin >= (w.preferred_end_min || 1440)) continue;
      }
      const svcText = Array.isArray(w.service_names) && w.service_names.length ? w.service_names.join(', ') : 'your service';
      // SMS
      const wlPhoneNorm = normPhone(w.phone_raw || w.phone_norm);
      if (wlPhoneNorm) {
        const optOut = await wsCol('clients').where('phone_norm', '==', wlPhoneNorm).where('sms_opt_out', '==', true).limit(1).get();
        if (optOut.empty && smsConf.canSend) {
          sendSms(wlPhoneNorm, `${prefix}A spot just opened up for ${svcText} with ${w.barber_name || 'your specialist'} on ${dateKey} at ${timeStr}. Book now: ${bookUrl} Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, smsConf.fromNumber, wsId).catch(() => {});
        }
      }
      // Email
      if (w.email) {
        try {
          const cfg = await getWorkspaceEmailConfig(wsId);
          const t = EMAIL_THEMES[cfg.template] || EMAIL_THEMES.modern;
          const isLt = ['classic', 'colorful'].includes(cfg.template);
          const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
          sendEmail(w.email, `A spot opened up – ${shopName || 'VuriumBook'}`, vuriumEmailTemplate('A Spot Opened Up!', `
            <div style="text-align:center;margin-bottom:20px;">
              <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:999px;background:${isLt ? 'rgba(40,167,69,.08)' : 'rgba(130,220,170,.1)'};border:1px solid ${isLt ? 'rgba(40,167,69,.15)' : 'rgba(130,220,170,.15)'};text-align:center;line-height:48px;font-size:20px;">&#127881;</div>
              <p style="font-size:15px;color:${t.text};margin:0;font-weight:600;">A spot just opened up!</p>
            </div>
            <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${t.border};margin:16px 0;">
              <div style="font-size:16px;font-weight:600;color:${t.text};">${svcText}</div>
              <div style="color:${t.muted};margin-top:4px;">with ${w.barber_name || 'your specialist'}</div>
              <div style="color:${t.accent};font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
            </div>
            <div style="text-align:center;margin:24px 0 8px;">
              <a href="${bookUrl}" style="display:inline-block;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;color:${isLt ? '#fff' : 'rgba(130,220,170,.9)'};background:${isLt ? '#333' : 'rgba(130,220,170,.1)'};border:1px solid ${isLt ? '#333' : 'rgba(130,220,170,.2)'};">Book Now</a>
            </div>
            <p style="font-size:12px;color:${t.muted};text-align:center;margin-top:16px;">This slot may fill up quickly — book soon to secure your spot.</p>
          `, cfg.shopName, cfg.logoUrl, cfg.template, cfg.contactInfo), cfg.shopName).catch(() => {});
        } catch { /* skip email error */ }
      }
      await wDoc.ref.update({ notified: true, notified_at: toIso(new Date()), notified_slot: toIso(startAt), auto_fill: true });
      break; // notify first matching waitlist entry only
    }
  } catch (e) { console.warn('tryWaitlistAutoFill error:', e?.message); }
}

// ============================================================
// SATISFACTION PING — post-visit SMS + email with Google review link
// ============================================================
async function scheduleSatisfactionPing(wsId, wsCol, bookingId, bookingData) {
  try {
    const settingsDoc = await wsCol('settings').doc('config').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    if (settings.satisfaction_sms_enabled === false) return;
    const googleReviewUrl = settings.google_review_url;
    const shopName = settings.shop_name || '';
    const timeZone = settings.timezone || 'America/Chicago';

    // Deduplicate — don't schedule if satisfaction reminder already exists for this booking
    const existingSnap = await wsCol('sms_reminders').where('booking_id', '==', bookingId).where('type', '==', 'satisfaction').limit(1).get();
    if (!existingSnap.empty) return;

    const phone = bookingData.client_phone || bookingData.phone_norm;
    const phoneNorm = phone ? normPhone(phone) : null;
    const clientName = bookingData.client_name || 'there';
    const barberName = bookingData.barber_name || 'your specialist';
    const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    const smsConf = await getWorkspaceSmsConfig(wsId, { allowGlobalFallback: false });

    // Schedule SMS (if phone + Google review URL available)
    if (phone && googleReviewUrl && smsConf.canSend) {
      const prefix = shopName ? `${shopName}: ` : '';
      const message = `${prefix}Hi ${clientName}! Thanks for your visit with ${barberName}. We'd love your feedback — leave a review here: ${googleReviewUrl} Msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
      await wsCol('sms_reminders').add({
        booking_id: bookingId, phone, phone_norm: phoneNorm,
        from_number: smsConf.fromNumber || null, type: 'satisfaction',
        send_at: toIso(sendAt), sent: false, message, created_at: toIso(new Date()),
      });
    }

    // Send satisfaction email (immediate, with Google review link)
    const clientEmail = bookingData.client_email;
    if (clientEmail) {
      const cfg = await getWorkspaceEmailConfig(wsId);
      const { logoUrl, template, contactInfo } = cfg;
      const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
      const isLt = ['classic', 'colorful'].includes(template);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      const serviceName = bookingData.service_name || 'your appointment';
      const reviewLink = googleReviewUrl || `https://vurium.com/book/${wsId}`;
      const stars = [1, 2, 3, 4, 5].map(n => {
        const starUrl = googleReviewUrl || reviewLink;
        return `<a href="${starUrl}" style="text-decoration:none;font-size:32px;margin:0 4px;" title="${n} star${n > 1 ? 's' : ''}">⭐</a>`;
      }).join('');
      sendEmail(clientEmail, `How was your visit${shopName ? ' at ' + shopName : ''}?`, vuriumEmailTemplate('How was your visit?', `
        <p style="color:${et.muted};margin-bottom:16px;">Hi ${clientName}! We hope you enjoyed ${serviceName} with ${barberName}.</p>
        <div style="padding:20px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;text-align:center;">
          <p style="color:${et.text};font-size:15px;font-weight:500;margin-bottom:12px;">Rate your experience</p>
          <div style="margin-bottom:16px;">${stars}</div>
          <a href="${reviewLink}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:14px;font-weight:600;">Leave a Google Review</a>
        </div>
        <p style="color:${et.muted};font-size:12px;text-align:center;">Your feedback helps us improve and helps others find us!</p>
      `, shopName, logoUrl, template, contactInfo), shopName).catch(() => {});
    }
  } catch (e) { console.warn('scheduleSatisfactionPing error:', e?.message); }
}

// ============================================================
// APNs PUSH NOTIFICATIONS
// ============================================================
let _apnsJwt = null;
let _apnsJwtTime = 0;

function getApnsJwt() {
  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  const keyP8 = process.env.APNS_KEY_P8 || '';
  const keyPath = process.env.APNS_KEY_PATH || '';
  if (!keyId || !teamId || (!keyP8 && !keyPath)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_apnsJwt && now - _apnsJwtTime < 3000) return _apnsJwt;
  try {
    let key;
    if (keyP8) {
      // Handle various formats: literal \n, base64, or raw PEM
      key = keyP8.replace(/\\n/g, '\n');
      if (!key.includes('-----BEGIN')) {
        // Might be base64 encoded
        try { key = Buffer.from(key, 'base64').toString('utf8'); } catch {}
      }
      if (!key.includes('-----BEGIN')) {
        // Raw key material — wrap in PEM
        key = '-----BEGIN PRIVATE KEY-----\n' + key + '\n-----END PRIVATE KEY-----';
      }
    } else {
      const fs = require('fs');
      key = fs.readFileSync(keyPath, 'utf8');
    }
    console.log('🔔 [APNs] Key parsed: len=' + key.length + ' hasPEM=' + key.includes('-----BEGIN'));
    _apnsJwt = jwt.sign({}, key, { algorithm: 'ES256', keyid: keyId, issuer: teamId, expiresIn: '1h' });
    _apnsJwtTime = now;
    console.log('🔔 [APNs] JWT created successfully');
    return _apnsJwt;
  } catch (e) { console.error('🔔 [APNs] getApnsJwt error:', e?.message); return null; }
}

function sendApnsPush(deviceToken, title, body, data = {}, bundleId) {
  bundleId = bundleId || process.env.APNS_BUNDLE_ID || 'com.vurium.VuriumBook';
  const apnsJwt = getApnsJwt();
  if (!apnsJwt || !deviceToken) { console.warn('🔔 [APNs] Skip push: jwt=' + !!apnsJwt + ' token=' + !!deviceToken); return Promise.resolve(null); }
  const env = process.env.APNS_ENVIRONMENT || process.env.APNS_ENV || 'sandbox';
  const host = (env === 'sandbox' || env === 'development') ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  return new Promise((resolve) => {
    try {
      const client = http2.connect(`https://${host}`);
      const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default', 'mutable-content': 1 }, ...data });
      const headers = { ':method': 'POST', ':path': `/3/device/${deviceToken}`, 'authorization': `bearer ${apnsJwt}`, 'apns-topic': bundleId, 'apns-push-type': 'alert', 'apns-priority': '10' };
      const req = client.request(headers);
      let respData = '';
      let status = 0;
      req.on('response', (h) => { status = h[':status']; });
      req.on('data', c => respData += c);
      req.on('end', () => { client.close(); if (status !== 200) console.error('🔔 [APNs] Push failed status=' + status + ' body=' + respData + ' token=' + deviceToken.slice(0,8) + '...'); resolve(respData); });
      req.on('error', (e) => { client.close(); console.error('🔔 [APNs] Push error:', e?.message); resolve(null); });
      req.write(payload);
      req.end();
      setTimeout(() => { try { client.close(); } catch {} resolve(null); }, 10000);
    } catch (e) { console.error('🔔 [APNs] Push exception:', e?.message); resolve(null); }
  });
}

// Helper: get workspace push notification settings (from Settings → Booking).
// BUG-003 fix: cache is now keyed per workspace (was a single shared object that caused a
// 30-second cross-tenant leak — e.g. workspace A's push_chat_messages=false would cause
// workspace B to silently drop chat pushes for up to 30s, or vice versa). The cache is
// also capped at 256 entries to bound memory under churn.
const _wsPushPrefsCache = new Map(); // wsId -> { prefs, ts }
const WS_PUSH_PREFS_TTL_MS = 30000;
const WS_PUSH_PREFS_MAX = 256;
async function getWorkspacePushPrefs(wsCol) {
  const now = Date.now();
  try {
    const settingsRef = wsCol('settings').doc('config');
    // Path shape: workspaces/{wsId}/settings/config
    const wsId = settingsRef.path.split('/')[1] || '__unknown__';

    const cached = _wsPushPrefsCache.get(wsId);
    if (cached && now - cached.ts < WS_PUSH_PREFS_TTL_MS) return cached.prefs;

    const snap = await settingsRef.get();
    const data = snap.exists ? snap.data() : {};
    const booking = data.booking || {};

    // Evict oldest entry if cache is full — cheap bounded LRU-ish
    if (_wsPushPrefsCache.size >= WS_PUSH_PREFS_MAX) {
      const firstKey = _wsPushPrefsCache.keys().next().value;
      if (firstKey !== undefined) _wsPushPrefsCache.delete(firstKey);
    }
    _wsPushPrefsCache.set(wsId, { prefs: booking, ts: now });
    return booking;
  } catch { return {}; }
}

// Helper: check if workspace allows this push type
function workspaceAllowsPush(bookingSettings, prefKey) {
  if (!prefKey) return true;
  // Settings keys: push_confirm, push_reminder_24, push_reminder_2, push_reschedule, push_cancel, push_waitlist
  return bookingSettings[prefKey] !== false; // default true if not set
}

async function getCrmDeviceTokens(wsCol, userId) {
  try {
    const snap = await wsCol('crm_push_tokens').where('user_id', '==', userId).get();
    return snap.docs.map(d => d.data().device_token).filter(Boolean);
  } catch (e) { console.error('🔔 [APNs] getCrmDeviceTokens error:', e?.message); return []; }
}

async function sendCrmPush(wsCol, userId, title, body, data = {}, prefKey = null) {
  if (prefKey) {
    const wsPrefs = await getWorkspacePushPrefs(wsCol);
    if (!workspaceAllowsPush(wsPrefs, prefKey)) { console.log('🔔 [APNs] Skipped push (workspace pref ' + prefKey + '=off)'); return; }
  }
  const tokens = await getCrmDeviceTokens(wsCol, userId);
  console.log('🔔 [APNs] sendCrmPush to user=' + userId + ' tokens=' + tokens.length + ' title=' + title);
  for (const t of tokens) sendApnsPush(t, title, body, data).catch(e => console.error('🔔 [APNs] sendCrmPush error:', e?.message));
}

async function sendCrmPushToRoles(wsCol, roles, title, body, data = {}, excludeUserId = null, prefKey = null) {
  try {
    if (prefKey) {
      const wsPrefs = await getWorkspacePushPrefs(wsCol);
      if (!workspaceAllowsPush(wsPrefs, prefKey)) { console.log('🔔 [APNs] Skipped role push (workspace pref ' + prefKey + '=off)'); return; }
    }
    const snap = await wsCol('crm_push_tokens').get();
    let count = 0;
    for (const d of snap.docs) {
      const td = d.data();
      if (roles.includes(td.role) && td.user_id !== excludeUserId) {
        count++;
        sendApnsPush(td.device_token, title, body, data).catch(e => console.error('🔔 [APNs] role push error:', e?.message));
      }
    }
    console.log('🔔 [APNs] sendCrmPushToRoles roles=' + roles.join(',') + ' sent=' + count + ' title=' + title);
  } catch (e) { console.error('🔔 [APNs] sendCrmPushToRoles error:', e?.message); }
}

async function sendCrmPushToBarber(wsCol, barberId, title, body, data = {}, prefKey = null) {
  try {
    if (prefKey) {
      const wsPrefs = await getWorkspacePushPrefs(wsCol);
      if (!workspaceAllowsPush(wsPrefs, prefKey)) { console.log('🔔 [APNs] Skipped barber push (workspace pref ' + prefKey + '=off)'); return; }
    }
    const snap = await wsCol('crm_push_tokens').where('barber_id', '==', barberId).get();
    console.log('🔔 [APNs] sendCrmPushToBarber barber=' + barberId + ' tokens=' + snap.size + ' title=' + title);
    for (const d of snap.docs) sendApnsPush(d.data().device_token, title, body, data).catch(e => console.error('🔔 [APNs] barber push error:', e?.message));
  } catch (e) { console.error('🔔 [APNs] sendCrmPushToBarber error:', e?.message); }
}

async function sendCrmPushToStaff(wsCol, barberId, title, body, data = {}, prefKey = null, excludeUserId = null) {
  if (barberId) sendCrmPushToBarber(wsCol, barberId, title, body, data, prefKey).catch(e => console.error('🔔 [APNs] staff barber error:', e?.message));
}

// Startup APNs check
(function checkApnsConfig() {
  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  const keyPath = process.env.APNS_KEY_PATH || '';
  const keyP8 = process.env.APNS_KEY_P8 || '';
  const env = process.env.APNS_ENVIRONMENT || process.env.APNS_ENV || 'sandbox';
  if (!keyId || !teamId || (!keyP8 && !keyPath)) {
    console.warn('⚠️  [APNs] Push notifications DISABLED — missing env vars: ' +
      (!keyId ? 'APNS_KEY_ID ' : '') + (!teamId ? 'APNS_TEAM_ID ' : '') + (!keyP8 && !keyPath ? 'APNS_KEY_P8/APNS_KEY_PATH' : ''));
  } else {
    console.log('🔔 [APNs] Push enabled — env=' + env + ' keyId=' + keyId + ' teamId=' + teamId + ' key=' + (keyP8 ? 'P8_ENV' : 'FILE'));
  }
})();

// Diagnostic: check APNs config (superadmin only).
// BUG-002 fix: was registered before the auth middleware at line ~3350 and leaked
// partial APNs key id / team id / JWT validity / key source. Now gated behind the
// Developer Panel magic-link auth (`requireSuperadmin`), which is the same path used
// by every other `/api/vurium-dev/*` diagnostic endpoint.
app.get('/api/push/status', requireSuperadmin, (req, res) => {
  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  const keyP8 = process.env.APNS_KEY_P8 || '';
  const keyPath = process.env.APNS_KEY_PATH || '';
  const env = process.env.APNS_ENVIRONMENT || process.env.APNS_ENV || 'sandbox';
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.vurium.VuriumBook';

  let jwtValid = false;
  let jwtError = null;
  let keyInfo = {};
  try {
    let key;
    if (keyP8) {
      key = keyP8.replace(/\\n/g, '\n');
      keyInfo.hasBeginHeader = key.includes('-----BEGIN');
      keyInfo.length = key.length;
      keyInfo.first20 = key.substring(0, 20).replace(/[^\x20-\x7E]/g, '?');
      if (!key.includes('-----BEGIN')) {
        try { const decoded = Buffer.from(key, 'base64').toString('utf8'); if (decoded.includes('-----BEGIN')) key = decoded; keyInfo.base64Decoded = decoded.includes('-----BEGIN'); } catch {}
      }
      if (!key.includes('-----BEGIN')) {
        key = '-----BEGIN PRIVATE KEY-----\n' + key + '\n-----END PRIVATE KEY-----';
        keyInfo.wrapped = true;
      }
    }
    const testJwt = require('jsonwebtoken');
    testJwt.sign({}, key || 'none', { algorithm: 'ES256', keyid: keyId, issuer: teamId, expiresIn: '1h' });
    jwtValid = true;
  } catch (e) {
    jwtError = e?.message;
  }

  res.json({
    configured: !!(keyId && teamId && (keyP8 || keyPath)),
    env,
    bundleId,
    keyId: keyId ? keyId.slice(0,4) + '...' : 'MISSING',
    teamId: teamId ? teamId.slice(0,4) + '...' : 'MISSING',
    keySource: keyP8 ? 'ENV_VAR' : keyPath ? 'FILE' : 'MISSING',
    keyP8Length: keyP8.length,
    keyInfo,
    jwtValid,
    jwtError,
  });
});

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
  guest: {
    canViewAll: false, canViewPayroll: false, canViewSettings: false,
    canViewPayments: false, canManageBarbers: false, canManageServices: false,
    canManageClients: true, canViewAllBookings: true, canManageBookings: true,
    canChangePassword: true, canManageUsers: false,
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
  timezone: z.string().max(60),
  business_type: z.string().max(60).optional(),
  shop_name: z.string().max(120).optional(),
  shop_address: z.string().max(250).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  postal_code: z.string().max(10).optional(),
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
  status_override: z.string().max(40).nullable().optional(),
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
  role: z.enum(['owner', 'admin', 'barber', 'student', 'guest']).optional().default('barber'),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254),
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
  role: z.enum(['owner', 'admin', 'barber', 'student', 'guest']).optional(),
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

// Check custom permissions from workspace settings (role_permissions)
// Owners and admins always pass. Barber/student checked against Firestore config.
function requireCustomPerm(permKey) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const role = req.user.role;
    if (role === 'owner' || role === 'admin') return next();
    // Check custom role_permissions from workspace settings
    // permKey format: 'category.action' e.g. 'financial.access_terminal' or 'pages.payments'
    try {
      const wsId = req.user.workspace_id;
      if (!wsId) return res.status(403).json({ error: 'Forbidden' });
      const doc = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
      const perms = doc.exists ? doc.data()?.role_permissions : null;
      const rolePerms = perms?.[role];
      if (rolePerms) {
        // Support dot notation: 'financial.access_terminal' → rolePerms.financial.access_terminal
        const parts = permKey.split('.');
        let val = rolePerms;
        for (const p of parts) { val = val?.[p]; }
        if (val) return next();
      }
    } catch {}
    return res.status(403).json({ error: 'Forbidden' });
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
    // Verify Square webhook signature (HMAC-SHA256 using SQUARE_APP_SECRET as key)
    if (SQUARE_APP_SECRET) {
      const sig = req.headers['x-square-hmacsha256-signature'];
      if (sig) {
        const notificationUrl = `${process.env.FRONTEND_URL || 'https://vurium.com'}/api/webhooks/square`;
        const payload = JSON.stringify(req.body);
        const expectedSig = crypto.createHmac('sha256', SQUARE_APP_SECRET).update(notificationUrl + payload).digest('base64');
        if (sig !== expectedSig) {
          console.warn('[SQUARE] Invalid webhook signature');
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }
    }
    const event = req.body;
    if (!event?.type) return res.json({ ok: true });
    logWebhookEvent('square', event.type, '', { merchant_id: event.merchant_id, event_id: event.event_id }).catch(() => {});
    // Find workspace by merchant_id from event (avoid N+1 scan)
    const sqMerchantId = event.merchant_id || '';
    let targetWsId = '';
    if (sqMerchantId) {
      // Fast lookup: find workspace with this Square merchant_id in settings
      const wsSnap = await db.collection('workspaces').get();
      for (const ws of wsSnap.docs) {
        try {
          const sqDoc = await db.collection('workspaces').doc(ws.id).collection('settings').doc('square').get();
          if (sqDoc.exists && (sqDoc.data()?.merchant_id === sqMerchantId || sqDoc.data()?.access_token)) { targetWsId = ws.id; break; }
        } catch {}
      }
    }
    if (event.type === 'terminal.checkout.updated') {
      const checkout = event.data?.object?.checkout;
      if (!checkout?.id) return res.json({ ok: true });
      // Search target workspace first, then fallback to recent workspaces (limit 20)
      const searchWsList = targetWsId ? [targetWsId] : (await db.collection('workspaces').orderBy('updated_at', 'desc').limit(20).get()).docs.map(d => d.id);
      for (const wsId of searchWsList) {
        const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
        const prSnap = await wsCol('payment_requests').where('checkout_id', '==', checkout.id).limit(1).get();
        if (!prSnap.empty) {
          const prDoc = prSnap.docs[0];
          const status = checkout.status || 'PENDING';
          const patch = { status: status.toLowerCase(), updated_at: toIso(new Date()) };
          if (checkout.payment_ids?.length) patch.payment_id = checkout.payment_ids[0];
          if (status === 'COMPLETED') {
            patch.completed_at = toIso(new Date());
            let tipCents = 0;
            let serviceCents = checkout.amount_money?.amount || 0;
            // Always fetch tip from payment object (checkout.tip_money only set when allow_tipping=false)
            if (checkout.payment_ids?.length) {
              try {
                const payHeaders = await squareHeaders(wsCol);
                const pr = await squareFetch(`/v2/payments/${checkout.payment_ids[0]}`, { headers: payHeaders });
                if (pr.ok) {
                  const pd = await pr.json();
                  const payment = pd.payment || {};
                  tipCents = payment.tip_money?.amount || 0;
                  // amount_money = service only (without tip)
                  if (payment.amount_money?.amount) serviceCents = payment.amount_money.amount;
                }
              } catch {}
            }
            if (!tipCents) tipCents = checkout.tip_money?.amount || 0;
            patch.tip_cents = tipCents;
            // Update booking
            const prData = prDoc.data();
            if (prData.booking_id) {
              const bPatch = {
                payment_status: 'paid', paid: true, payment_method: 'terminal',
                tip: tipCents / 100, tip_amount: tipCents / 100,
                amount: serviceCents / 100,
                updated_at: toIso(new Date()),
              };
              if (checkout.payment_ids?.length) bPatch.payment_id = checkout.payment_ids[0];
              // Preserve service_amount/tax/fees from original payment request for payroll
              if (prData.service_amount) bPatch.service_amount = prData.service_amount;
              if (prData.tax_amount) bPatch.tax_amount = prData.tax_amount;
              if (prData.fee_amount) bPatch.fee_amount = prData.fee_amount;
              await wsCol('bookings').doc(prData.booking_id).update(bPatch).catch(e => console.error('[PAYMENT] Booking update failed:', prData.booking_id, e?.message));
            }
          }
          await prDoc.ref.update(patch);
          break;
        }
      }
    }
    // Auto-reconcile any completed payment
    if (event.type === 'payment.completed' || event.type === 'payment.updated') {
      const payment = event.data?.object?.payment;
      if (payment?.id && (payment.status || '').toUpperCase() === 'COMPLETED') {
        const spServiceCents = payment.amount_money?.amount || 0; // amount_money = service only
        const spTipCents = payment.tip_money?.amount || 0;
        const spDate = (payment.created_at || '').slice(0, 10);
        const spNote = payment.note || '';
        // Search target workspace first, fallback to all
        const searchList2 = targetWsId ? [targetWsId] : (await db.collection('workspaces').orderBy('updated_at', 'desc').limit(20).get()).docs.map(d => d.id);
        for (const wsId2 of searchList2) {
          const ws = { id: wsId2 };
          const wsCol = (col) => db.collection('workspaces').doc(ws.id).collection(col);
          // Skip if already tracked
          const existingPr = await wsCol('payment_requests').where('payment_id', '==', payment.id).limit(1).get();
          if (!existingPr.empty) break;
          // Try note match
          const noteMatch = spNote.match(/Booking\s+(\S+)/i);
          let bookingId = noteMatch ? noteMatch[1] : '';
          if (bookingId) {
            const bDoc = await wsCol('bookings').doc(bookingId).get();
            if (bDoc.exists && !bDoc.data()?.paid) {
              await wsCol('bookings').doc(bookingId).update({
                paid: true, payment_status: 'paid', payment_method: 'terminal', payment_id: payment.id,
                tip: spTipCents / 100, tip_amount: spTipCents / 100, amount: spServiceCents / 100,
                updated_at: toIso(new Date()),
              }).catch(e => console.error("[PAYMENT] Booking update failed:", e?.message));
              await wsCol('payment_requests').add({
                booking_id: bookingId, payment_id: payment.id, amount_cents: spServiceCents, tip_cents: spTipCents,
                payment_method: 'card', status: 'completed', source: 'webhook_reconciled', created_at: payment.created_at,
              }).catch(e => console.error("[PAYMENT] Payment request create failed:", e?.message));
              break;
            }
          }
          // Fuzzy match by date + amount.
          // BUG-009 fix: booking documents do not have a top-level `date` field —
          // the CRM create path and public booking create path both write `start_at`
          // as an ISO datetime string and nothing else. Querying `.where('date', '==', spDate)`
          // returned zero matches every time, so Square payments without a booking
          // id in the note stayed unreconciled forever. We now do a ranged query on
          // `start_at` covering spDate 00:00 → 24:00 UTC-ish (best-effort; exact
          // workspace timezone is not needed for this ±$2 tolerance reconciliation).
          const dayStart = `${spDate}T00:00:00.000Z`;
          const dayEnd = `${spDate}T23:59:59.999Z`;
          const bSnap = await wsCol('bookings')
            .where('start_at', '>=', dayStart)
            .where('start_at', '<=', dayEnd)
            .limit(100)
            .get();
          for (const bDoc of bSnap.docs) {
            const b = bDoc.data();
            if (b.paid) continue;
            const bCents = Math.round((Number(b.service_amount || b.amount || 0)) * 100);
            if (Math.abs(bCents - spServiceCents) <= 200) {
              await wsCol('bookings').doc(bDoc.id).update({
                paid: true, payment_status: 'paid', payment_method: 'terminal', payment_id: payment.id,
                tip: spTipCents / 100, tip_amount: spTipCents / 100, amount: spServiceCents / 100,
                updated_at: toIso(new Date()),
              }).catch(e => console.error("[PAYMENT] Booking update failed:", e?.message));
              await wsCol('payment_requests').add({
                booking_id: bDoc.id, payment_id: payment.id, amount_cents: spServiceCents, tip_cents: spTipCents,
                payment_method: 'card', status: 'completed', source: 'webhook_reconciled', created_at: payment.created_at,
              }).catch(e => console.error("[PAYMENT] Payment request create failed:", e?.message));
              break;
            }
          }
          break; // only check first workspace with matching data
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
    sendEmail(email, 'Reset Your Password', vuriumSupportEmailTemplate('Reset Your Password', `
      <p>We received a request to reset your password.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#e8e8ed;text-decoration:none;font-weight:600;font-size:14px;">Reset Password</a>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,.25);">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size:12px;color:rgba(255,255,255,.15);margin-top:16px;">— The Vurium Team</p>
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
    const newHash = hashPassword(password);
    await userRef.update({
      password_hash: newHash,
      reset_token: null,
      reset_token_expires: null,
      updated_at: toIso(new Date()),
    });
    console.log(`Password reset successful for user ${uid} in workspace ${ws}`);
    writeAuditLog(ws, { action: 'user.password_reset', resource_id: uid, data: { method: 'email_link' } }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { console.error('Password reset error:', e?.message); res.status(500).json({ error: e?.message }); }
});

// ============================================================
// TELNYX INBOUND SMS WEBHOOK (STOP / HELP) — before auth middleware
// ============================================================

// Gap 2: Ed25519 webhook signature verification (mirrors Stripe/Square pattern already in codebase).
// Safely no-ops when TELNYX_WEBHOOK_PUBLIC_KEY env var is not set (dev / pre-secret-rotation).
// Set TELNYX_WEBHOOK_PUBLIC_KEY in GitHub Secrets + deploy.yml to activate in production.
function verifyTelnyxWebhookSignature(req) {
  const publicKey = process.env.TELNYX_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) return; // dev/staging — do not block if key not set
  const sig = req.headers['telnyx-signature-ed25519'];
  const ts  = req.headers['telnyx-timestamp'];
  if (!sig || !ts) {
    const err = new Error('Missing Telnyx webhook signature');
    err.statusCode = 401;
    throw err;
  }
  try {
    const msgBuf = Buffer.from(`${ts}|${JSON.stringify(req.body)}`);
    const pubBuf = Buffer.from(publicKey, 'base64');
    const sigBuf = Buffer.from(sig, 'base64');
    const ok = crypto.verify(null, msgBuf,
      { key: pubBuf, format: 'der', type: 'spki' },
      sigBuf
    );
    if (!ok) throw new Error('Signature mismatch');
  } catch {
    const err = new Error('Invalid Telnyx webhook signature');
    err.statusCode = 401;
    throw err;
  }
}

app.post('/api/webhooks/telnyx', async (req, res) => {
  try {
    verifyTelnyxWebhookSignature(req);
    const payload = req.body?.data?.payload || req.body?.data || {};
    const direction = payload.direction || '';
    if (direction !== 'inbound') return res.status(200).json({ ok: true });
    const from = payload.from?.phone_number || '';
    const body = String(payload.text || '').trim().toUpperCase();
    const digits = from.replace(/\D/g, '');
    const phoneNorm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (!phoneNorm) return res.status(200).json({ ok: true });

    // Determine which workspace this message belongs to by matching the TO number
    const toNumber = payload.to?.phone_number || '';
    const toNorm = toNumber.replace(/\D/g, '');
    let matchedWsId = null;
    let matchedShopName = 'Vurium';
    let matchedFromNumber = toNumber || safeStr(process.env.TELNYX_FROM);

    // Gap 3: O(1) lookup via phone_number_index instead of scanning all workspaces
    if (toNorm) {
      const idxDoc = await db.collection('phone_number_index').doc(toNorm).get();
      if (idxDoc.exists) {
        const idx = idxDoc.data();
        matchedWsId = idx.workspace_id || null;
        matchedShopName = idx.shop_name || 'Vurium';
        matchedFromNumber = idx.from_number || toNumber;
      }
    }

    if (body === 'STOP' || body === 'UNSUBSCRIBE' || body === 'CANCEL' || body === 'END' || body === 'QUIT') {
      // Gap 3: collectionGroup query — find matching clients across all workspaces without O(N) scan
      const allClientSnap = await db.collectionGroup('clients').where('phone_norm', '==', phoneNorm).get().catch(() => null);
      const affectedWsIds = new Set();
      if (allClientSnap && !allClientSnap.empty) {
        for (const cDoc of allClientSnap.docs) {
          await cDoc.ref.update({ sms_opt_out: true, sms_opt_out_at: toIso(new Date()) }).catch(() => {});
          const wsId = cDoc.ref.parent?.parent?.id;
          if (wsId) affectedWsIds.add(wsId);
        }
      }
      // Cancel pending reminders for each affected workspace
      for (const wsId of affectedWsIds) {
        const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
        const reminderSnap = await wsCol('sms_reminders').where('sent', '==', false).limit(50).get().catch(() => null);
        if (!reminderSnap) continue;
        for (const r of reminderSnap.docs) {
          const rPhone = String(r.data().phone || '').replace(/\D/g, '');
          const rNorm = rPhone.length === 11 && rPhone.startsWith('1') ? rPhone.slice(1) : rPhone;
          if (rNorm === phoneNorm) {
            await r.ref.update({ sent: true, cancelled: true, cancelled_at: toIso(new Date()) }).catch(() => {});
          }
        }
      }
      sendSms(from, `${matchedShopName}: You have been unsubscribed and will not receive further messages. Reply HELP for help.`, matchedFromNumber, matchedWsId).catch(() => {});
    } else if (body === 'HELP' || body === 'INFO') {
      sendSms(from, `${matchedShopName}: For help, email support@vurium.com or visit https://vurium.com/privacy. Msg & data rates may apply. Reply STOP to opt out.`, matchedFromNumber, matchedWsId).catch(() => {});
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.warn('Telnyx inbound webhook error:', e?.message);
    res.status(200).json({ ok: true });
  }
});

// ============================================================
// TELNYX 10DLC STATUS WEBHOOK (brand/campaign status updates)
// ============================================================
app.post('/api/webhooks/telnyx-10dlc', async (req, res) => {
  try {
    verifyTelnyxWebhookSignature(req);
    const event = req.body?.data || {};
    const eventType = event.event_type || req.body?.event_type || '';
    const payload = event.payload || event || {};

    // Find workspace by brand_id or campaign_id
    const brandId = payload.brand_id || payload.brandId || '';
    const campaignId = payload.campaign_id || payload.campaignId || '';
    const status = payload.status || payload.csp_campaign_status || '';

    if (!brandId && !campaignId) return res.status(200).json({ ok: true });

    const wsSnap = await db.collection('workspaces').limit(200).get();
    for (const ws of wsSnap.docs) {
      const cfg = await db.collection('workspaces').doc(ws.id).collection('settings').doc('config').get();
      if (!cfg.exists) continue;
      const data = cfg.data();
      const matchBrand = brandId && data.telnyx_brand_id === brandId;
      const matchCampaign = campaignId && data.telnyx_campaign_id === campaignId;
      if (!matchBrand && !matchCampaign) continue;

      // Map Telnyx status to our status
      let newStatus = data.sms_registration_status;
      if (status === 'VERIFIED' || status === 'VETTED') newStatus = 'pending_campaign';
      else if (status === 'MNO_PROVISIONED' || status === 'ACTIVE') newStatus = 'active';
      else if (status === 'MNO_REJECTED' || status === 'REJECTED' || status === 'FAILED') newStatus = 'rejected';
      else if (status === 'MNO_PENDING' || status === 'TCR_PENDING') newStatus = 'pending_approval';

      await cfg.ref.update({ sms_registration_status: newStatus, sms_status_updated_at: toIso(new Date()) });
      console.log(`10DLC status update: ws=${ws.id} status=${newStatus} (${status})`);
      break;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.warn('Telnyx 10DLC webhook error:', e?.message);
    res.status(200).json({ ok: true });
  }
});

// ─── Contact Form (public, no auth) ─────────────────────────────────────────
const CONTACT_RATE = {};
app.post('/contact', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  if (CONTACT_RATE[ip] && now - CONTACT_RATE[ip] < 60000) {
    return res.status(429).json({ error: 'Please wait before submitting again.' });
  }
  CONTACT_RATE[ip] = now;

  const name = sanitizeHtml(safeStr(req.body.name));
  const email = sanitizeHtml(safeStr(req.body.email));
  const company = sanitizeHtml(safeStr(req.body.company));
  const message = sanitizeHtml(safeStr(req.body.message));

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const html = vuriumEmailTemplate('New Contact Form Submission', `
    <p style="margin:0 0 12px;"><strong>Name:</strong> ${name}</p>
    <p style="margin:0 0 12px;"><strong>Email:</strong> <a href="mailto:${email}" style="color:rgba(130,150,220,.8);text-decoration:none;">${email}</a></p>
    ${company ? `<p style="margin:0 0 12px;"><strong>Company:</strong> ${company}</p>` : ''}
    <p style="margin:0 0 4px;"><strong>Message:</strong></p>
    <p style="margin:0;white-space:pre-wrap;">${message}</p>
  `, 'Vurium', 'https://vurium.com/logo.jpg', 'dark-cosmos');

  sendEmail('support@vurium.com', `[Contact] ${name} — ${company || 'No company'}`, html, 'Vurium Contact')
    .then(() => res.json({ ok: true }))
    .catch((e) => { console.warn('Contact email error:', e?.message); res.status(500).json({ error: 'Failed to send message.' }); });
});

// ============================================================
// VURIUM SUPER-ADMIN PANEL — Private admin endpoints
// Separate auth via magic link (not VuriumBook accounts)
// Must be before the workspace auth middleware below
// ============================================================
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || ADMIN_EMAIL; // forward inbound emails here
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || (JWT_SECRET + '_admin');

function requireSuperadmin(req, res, next) {
  const token = req.cookies?.vurium_admin_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '') || '';
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
    req.adminUser = payload;
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

// BE.8 commit 2 (2026-04-15): removed the top-level LEGACY_SMS_STATUSES Set.
// Rationale: Owner confirmed all workspaces except Element are test-only, so
// there is no real data to migrate. Element is still caught by the
// `isProtectedLegacyWorkspace` / `telnyx_brand_id` / `telnyx_campaign_id`
// checks in `isLegacyManualSmsPath()` below, which remain intact. The status-
// string check was a false-positive guard that made any workspace in a
// transitional legacy status look "legacy" even if it was just a test
// workspace. For historical reference + the unused /api/vurium-dev/sms/*
// audit tool, the status list now lives inside LEGACY_SMS_STATUS_VALUES below.

// Legacy SMS status values — kept as a self-contained constant ONLY for the
// /api/vurium-dev/sms/legacy-audit tool. Not referenced by isLegacyManualSmsPath
// or any production flow. If the audit endpoints are deleted in the future,
// this constant can be deleted with them.
const LEGACY_SMS_STATUS_VALUES = Object.freeze([
  'pending_otp',
  'verified',
  'brand_created',
  'pending_campaign',
  'pending_number',
  'pending_approval',
  'pending_vetting',
]);

function isProtectedLegacyWorkspace(workspace, settings) {
  const slug = safeStr(workspace?.slug || '').toLowerCase();
  const name = safeStr(settings?.sms_brand_name || settings?.shop_name || workspace?.name || '').toLowerCase();
  return slug === 'elementbarbershop' || name === 'element barbershop';
}

function isLegacyManualSmsPath(workspace, settings) {
  const numberType = safeStr(settings?.sms_number_type || '');
  return numberType === '10dlc'
    || !!settings?.telnyx_brand_id
    || !!settings?.telnyx_campaign_id
    || isProtectedLegacyWorkspace(workspace, settings);
}

function getWorkspaceBookingUrl(workspaceLike) {
  const frontendUrl = String(process.env.FRONTEND_URL || 'https://vurium.com').replace(/\/+$/, '');
  const slug = safeStr(workspaceLike?.slug || '');
  const id = safeStr(workspaceLike?.id || '');
  const handle = slug || id;
  return handle ? `${frontendUrl}/book/${encodeURIComponent(handle)}` : `${frontendUrl}/book/`;
}

async function provisionTollFreeSmsForWorkspace(workspace, opts = {}) {
  const wsId = safeStr(workspace?.id || '');
  if (!wsId) {
    const err = new Error('Missing workspace id');
    err.statusCode = 400;
    throw err;
  }

  const settingsRef = db.collection('workspaces').doc(wsId).collection('settings').doc('config');
  const settingsDoc = await settingsRef.get();
  const data = settingsDoc.exists ? settingsDoc.data() : {};
  const currentStatus = safeStr(data.sms_registration_status || 'none');

  if (isLegacyManualSmsPath(workspace, data)) {
    const err = new Error('This workspace is on the grandfathered manual / 10DLC path');
    err.statusCode = 409;
    throw err;
  }

  if (data.sms_from_number && currentStatus === 'active') {
    return {
      ok: true,
      already_active: true,
      status: currentStatus,
      phone_number: data.sms_from_number,
      number_type: safeStr(data.sms_number_type || 'toll-free'),
      messaging_profile_id: data.sms_messaging_profile_id || '',
    };
  }

  if (currentStatus && !['none', 'rejected', 'failed'].includes(currentStatus)) {
    const err = new Error('SMS setup already in progress');
    err.statusCode = 409;
    err.meta = { status: currentStatus };
    throw err;
  }

  await settingsRef.set({
    sms_registration_status: 'provisioning',
    sms_status_updated_at: toIso(new Date()),
    updated_at: toIso(new Date()),
  }, { merge: true });

  const shopName = safeStr(data.sms_brand_name || data.shop_name || workspace?.name || 'Business');
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app';

  let phoneNumber = '';
  let profileId = '';

  try {
    const searchResult = await telnyxApi('GET', '/v2/available_phone_numbers?filter[country_code]=US&filter[number_type]=toll-free&filter[features]=sms&filter[limit]=1');
    const availableNumber = searchResult?.data?.[0]?.phone_number;
    if (!availableNumber) throw new Error('No toll-free numbers available');
    await telnyxApi('POST', '/v2/number_orders', { phone_numbers: [{ phone_number: availableNumber }] });
    phoneNumber = availableNumber;

    try {
      const profileResult = await telnyxApi('POST', '/v2/messaging_profiles', {
        name: `VuriumBook TF - ${shopName}`,
        webhook_url: `${apiBaseUrl}/api/webhooks/telnyx`,
        enabled: true,
      });
      profileId = profileResult?.data?.id || '';

      if (profileId) {
        await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
          response_type: 'STOP',
          response_text: `${shopName}: You have been unsubscribed and will receive no further messages. Reply HELP for help or START to re-subscribe.`,
        }).catch(() => {});
        await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
          response_type: 'HELP',
          response_text: `${shopName}: For help, contact support@vurium.com. Visit https://vurium.com/privacy for Privacy Policy. Reply STOP to opt out.`,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('TF messaging profile creation failed:', e?.message || e);
    }

    if (profileId && phoneNumber) {
      try {
        const numId = phoneNumber.replace('+', '');
        await telnyxApi('PATCH', `/v2/phone_numbers/${numId}`, { messaging_profile_id: profileId });
      } catch (e) {
        console.warn('TF number→profile association failed:', e?.message || e);
        try {
          await telnyxApi('PATCH', `/v2/phone_numbers/${encodeURIComponent(phoneNumber)}`, { messaging_profile_id: profileId });
        } catch { /* non-critical */ }
      }
    }

    await settingsRef.set({
      sms_from_number: phoneNumber,
      sms_number_type: 'toll-free',
      sms_messaging_profile_id: profileId,
      sms_brand_name: shopName,
      sms_registration_status: 'active',
      sms_registered_at: toIso(new Date()),
      sms_status_updated_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    }, { merge: true });

    // Gap 3: write phone_number_index for O(1) inbound webhook lookup
    if (phoneNumber) {
      const idxKey = phoneNumber.replace(/\D/g, '');
      db.collection('phone_number_index').doc(idxKey).set({
        workspace_id: wsId,
        shop_name: shopName,
        from_number: phoneNumber,
        updated_at: toIso(new Date()),
      }).catch(() => {});
    }

    const actor = safeStr(opts.actor_name || 'system');
    writeAuditLog(wsId, {
      action: 'sms.enable_tollfree',
      data: { phone_number: phoneNumber, profile_id: profileId, actor, source: safeStr(opts.source || 'workspace') },
      req: {
        headers: {},
        ip: safeStr(opts.actor_ip || 'system'),
        user: { uid: safeStr(opts.actor_uid || 'system'), name: actor, username: actor, role: safeStr(opts.actor_role || 'system') },
      },
    }).catch(() => {});

    return {
      ok: true,
      status: 'active',
      phone_number: phoneNumber,
      number_type: 'toll-free',
      messaging_profile_id: profileId,
      already_active: false,
    };
  } catch (e) {
    await settingsRef.set({
      sms_registration_status: 'failed',
      sms_status_updated_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    }, { merge: true }).catch(() => {});
    const err = new Error(e?.message || 'Failed to enable SMS');
    err.statusCode = e?.statusCode || 400;
    throw err;
  }
}

// ============================================================
// SMS AUTO-PROVISION (Gap 5 from Telnyx-Integration-Plan.md)
// ============================================================
// Non-throwing wrapper around provisionTollFreeSmsForWorkspace.
// Called automatically at trial start, Stripe paid upgrade, and Apple IAP verify
// so owners do not have to manually press "Enable SMS" in Settings.
// On transient failure, schedules a background retry with exponential backoff.
// Respects legacy/protected workspaces (Element Barbershop stays untouched).

const SMS_AUTO_PROVISION_MAX_RETRIES = 5;
// Backoff: 5min, 15min, 45min, 2h, 6h
const SMS_AUTO_PROVISION_BACKOFF_MS = [5, 15, 45, 120, 360].map(m => m * 60 * 1000);

function computeSmsAutoRetryAt(retryCount) {
  const idx = Math.max(0, Math.min(retryCount, SMS_AUTO_PROVISION_BACKOFF_MS.length - 1));
  return new Date(Date.now() + SMS_AUTO_PROVISION_BACKOFF_MS[idx]);
}

async function autoProvisionSmsOnActivation(workspaceLike, source = 'unknown') {
  const wsId = safeStr(workspaceLike?.id || '');
  if (!wsId) return { ok: false, skipped: 'missing_workspace_id' };

  try {
    // Load fresh workspace + settings state so guards are based on current data
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return { ok: false, skipped: 'workspace_not_found' };
    const wsData = wsDoc.data() || {};
    const workspace = { id: wsId, name: wsData.name || workspaceLike?.name || '', slug: wsData.slug || workspaceLike?.slug || '' };

    const settingsRef = db.collection('workspaces').doc(wsId).collection('settings').doc('config');
    const settingsDoc = await settingsRef.get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    // Guard 1: protected / legacy workspaces never auto-migrate
    if (isLegacyManualSmsPath(workspace, settings)) {
      return { ok: false, skipped: 'legacy_manual_path' };
    }

    // Guard 2: already active → nothing to do
    const currentStatus = safeStr(settings.sms_registration_status || 'none');
    if (currentStatus === 'active' && settings.sms_from_number) {
      return { ok: true, already_active: true };
    }

    // Guard 3: provisioning in progress (another call fired just now)
    if (currentStatus === 'provisioning') {
      return { ok: false, skipped: 'already_provisioning' };
    }

    // Guard 4: max retries exhausted, owner needs to manually intervene
    if (currentStatus === 'failed_max_retries') {
      return { ok: false, skipped: 'max_retries_exhausted' };
    }

    // Only proceed from: none, rejected, failed
    if (currentStatus && !['none', 'rejected', 'failed'].includes(currentStatus)) {
      return { ok: false, skipped: `status:${currentStatus}` };
    }

    // Attempt provisioning
    try {
      const result = await provisionTollFreeSmsForWorkspace(workspace, {
        source: `auto:${source}`,
        actor_name: 'auto_provision',
        actor_role: 'system',
        actor_uid: 'system',
      });
      // On success, provisionTollFreeSmsForWorkspace already set status='active' and wrote audit log.
      // Clear any retry metadata.
      await settingsRef.set({
        sms_auto_provision_retry_count: 0,
        sms_auto_provision_next_retry_at: null,
        sms_auto_provision_last_error: null,
        sms_auto_provision_last_source: source,
        sms_auto_provision_succeeded_at: toIso(new Date()),
      }, { merge: true }).catch(() => {});
      return { ok: true, result };
    } catch (provisionErr) {
      // provisionTollFreeSmsForWorkspace already set status='failed'.
      // Track retry count + schedule next attempt.
      const prevRetryCount = Number(settings.sms_auto_provision_retry_count || 0);
      const nextRetryCount = prevRetryCount + 1;
      const reachedMax = nextRetryCount >= SMS_AUTO_PROVISION_MAX_RETRIES;

      const patch = {
        sms_auto_provision_retry_count: nextRetryCount,
        sms_auto_provision_last_error: safeStr(provisionErr?.message || 'unknown').slice(0, 500),
        sms_auto_provision_last_source: source,
        sms_auto_provision_last_attempt_at: toIso(new Date()),
      };

      if (reachedMax) {
        patch.sms_registration_status = 'failed_max_retries';
        patch.sms_auto_provision_next_retry_at = null;
      } else {
        patch.sms_auto_provision_next_retry_at = toIso(computeSmsAutoRetryAt(prevRetryCount));
      }

      await settingsRef.set(patch, { merge: true }).catch(() => {});

      writeAuditLog(wsId, {
        action: reachedMax ? 'sms.auto_provision_exhausted' : 'sms.auto_provision_failed',
        data: {
          source,
          retry_count: nextRetryCount,
          error: safeStr(provisionErr?.message || '').slice(0, 200),
          next_retry_at: patch.sms_auto_provision_next_retry_at || null,
        },
        req: {
          headers: {},
          ip: 'system',
          user: { uid: 'system', name: 'auto_provision', username: 'system', role: 'system' },
        },
      }).catch(() => {});

      return {
        ok: false,
        error: provisionErr?.message || 'provision_failed',
        retry_count: nextRetryCount,
        reached_max: reachedMax,
      };
    }
  } catch (e) {
    // Defensive: never throw out of this helper — callers rely on fire-and-forget
    console.warn('autoProvisionSmsOnActivation error for ws', wsId, e?.message);
    return { ok: false, error: e?.message || 'unknown' };
  }
}

// Magic link: rate limiter (3 requests per 15 min per IP)
const magicLinkLimiter = {};
// Used magic tokens (one-time use)
const usedMagicTokens = new Set();
// Auto-cleanup used tokens every hour
setInterval(() => usedMagicTokens.clear(), 3600000);

// Magic link: request login link
app.post('/api/vurium-dev/auth/request', express.json(), (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // Rate limit: 3 requests per 15 minutes
  if (!magicLinkLimiter[ip]) magicLinkLimiter[ip] = { count: 0, reset: now + 900000 };
  if (now > magicLinkLimiter[ip].reset) magicLinkLimiter[ip] = { count: 0, reset: now + 900000 };
  magicLinkLimiter[ip].count++;
  if (magicLinkLimiter[ip].count > 3) {
    return res.json({ ok: true }); // Don't reveal rate limit — always "sent"
  }

  const email = safeStr(req.body?.email || '').toLowerCase().trim();
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) {
    // Don't reveal whether email is valid — always say "sent"
    return res.json({ ok: true });
  }

  const jti = crypto.randomBytes(16).toString('hex'); // unique token ID for one-time use
  const magicToken = jwt.sign({ email, role: 'superadmin', purpose: 'magic_link', jti }, ADMIN_JWT_SECRET, { expiresIn: '15m' });
  const frontendUrl = process.env.FRONTEND_URL || 'https://vurium.com';
  const link = `${frontendUrl}/developer/verify?token=${magicToken}`;

  const html = vuriumEmailTemplate('Developer Login', `
    <p style="margin:0 0 16px;color:rgba(255,255,255,.6);">Click the button below to sign in to the Vurium Developer panel. This link expires in 15 minutes.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${link}" style="display:inline-block;padding:12px 32px;border-radius:999px;background:rgba(130,150,220,.2);color:rgba(130,150,220,.95);font-weight:700;font-size:14px;text-decoration:none;border:1px solid rgba(130,150,220,.3);">Sign in to Developer Panel</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,.25);">If you didn't request this, ignore this email. This link can only be used once.</p>
  `, 'Vurium', 'https://vurium.com/logo.jpg', 'dark-cosmos');

  sendEmail(ADMIN_EMAIL, 'Vurium Developer — Sign In Link', html, 'Vurium')
    .then((result) => {
      if (result?.id) { console.log('[DEV-AUTH] Magic link sent to', ADMIN_EMAIL, 'resend_id:', result.id); }
      else { console.warn('[DEV-AUTH] Magic link send may have failed:', JSON.stringify(result)); }
      res.json({ ok: true });
    })
    .catch((e) => { console.error('[DEV-AUTH] Magic link send error:', e?.message); res.json({ ok: true }); });
});

app.post('/api/vurium-dev/auth/local', express.json(), (req, res) => {
  const host = safeStr(req.hostname || '').toLowerCase();
  const ip = getClientIp(req);
  const isLoopbackHost = host === '127.0.0.1' || host === 'localhost';
  const isLoopbackIp = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (process.env.NODE_ENV === 'production' || (!isLoopbackHost && !isLoopbackIp)) {
    return res.status(403).json({ error: 'Local owner access is available only on localhost.' });
  }

  const email = ADMIN_EMAIL || 'owner@local.dev';
  const sessionToken = jwt.sign({ email, role: 'superadmin', purpose: 'local_dev' }, ADMIN_JWT_SECRET, { expiresIn: '24h' });
  console.log(`[DEV-AUTH] Local owner access: ${email} from ${ip} at ${new Date().toISOString()}`);

  res.cookie('vurium_admin_token', sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400000,
  });

  res.json({ ok: true, token: sessionToken, email });
});

// Magic link: verify token → set HttpOnly cookie
app.post('/api/vurium-dev/auth/verify', express.json(), (req, res) => {
  const token = safeStr(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.purpose !== 'magic_link' || payload.role !== 'superadmin') {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // One-time use: check if token was already used
    if (usedMagicTokens.has(payload.jti)) {
      return res.status(401).json({ error: 'This link has already been used' });
    }
    usedMagicTokens.add(payload.jti);

    // Log login event
    const ip = getClientIp(req);
    console.log(`[DEV-AUTH] Login: ${payload.email} from ${ip} at ${new Date().toISOString()}`);
    db.collection('vurium_dev_logins').add({
      email: payload.email, ip, ua: safeStr(req.headers['user-agent'] || '').substring(0, 300),
      created_at: toIso(new Date()),
    }).catch(() => {});

    // Issue session token (24h)
    const sessionToken = jwt.sign({ email: payload.email, role: 'superadmin' }, ADMIN_JWT_SECRET, { expiresIn: '24h' });

    res.cookie('vurium_admin_token', sessionToken, {
      httpOnly: true, secure: true, sameSite: 'none',
      path: '/', maxAge: 86400000, // 24h
    });
    res.json({ ok: true, token: sessionToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired link' });
  }
});

// Logout
app.post('/api/vurium-dev/auth/logout', (req, res) => {
  res.cookie('vurium_admin_token', '', { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 });
  res.json({ ok: true });
});

// Ping — auth check for admin panel
app.get('/api/vurium-dev/ping', requireSuperadmin, (req, res) => {
  res.json({ ok: true, email: req.adminUser.email });
});

// ── Platform metrics (superadmin only) ──
app.get('/api/vurium-dev/platform', requireSuperadmin, async (req, res) => {
  try {
    // 1. All workspaces
    const wsSnap = await db.collection('workspaces').get();
    const workspaces = [];
    wsSnap.forEach(d => workspaces.push({ id: d.id, ...d.data() }));

    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();

    // 2. Aggregate workspace metrics
    const byPlan = { individual: 0, salon: 0, custom: 0 };
    const byStatus = { trialing: 0, active: 0, past_due: 0, canceled: 0, inactive: 0 };
    const signupsLast30d = [];
    const signupsLast7d = [];
    let totalRevenue = 0;
    let trialCount = 0;
    let paidCount = 0;

    for (const ws of workspaces) {
      const plan = ws.plan_type || 'individual';
      if (byPlan[plan] !== undefined) byPlan[plan]++;
      const status = ws.billing_status || 'inactive';
      if (byStatus[status] !== undefined) byStatus[status]++;
      else byStatus.inactive++;

      if (ws.created_at >= thirtyDaysAgo) signupsLast30d.push(ws);
      if (ws.created_at >= sevenDaysAgo) signupsLast7d.push(ws);

      if (status === 'trialing') trialCount++;
      if (status === 'active') paidCount++;
    }

    // 3. Signups by day (last 30d)
    const signupsByDay = {};
    for (const ws of workspaces) {
      if (ws.created_at >= thirtyDaysAgo) {
        const day = (ws.created_at || '').substring(0, 10);
        if (day) signupsByDay[day] = (signupsByDay[day] || 0) + 1;
      }
    }

    // 4. Per-workspace details (bookings, clients, revenue counts)
    const wsDetails = [];
    for (const ws of workspaces) {
      try {
        const settingsDoc = await db.collection('workspaces').doc(ws.id).collection('settings').doc('config').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};

        // Count bookings
        const bookingsSnap = await db.collection('workspaces').doc(ws.id).collection('bookings').count().get();
        const bookingCount = bookingsSnap.data().count || 0;

        // Count clients
        const clientsSnap = await db.collection('workspaces').doc(ws.id).collection('clients').count().get();
        const clientCount = clientsSnap.data().count || 0;

        // Count staff
        const barbersSnap = await db.collection('workspaces').doc(ws.id).collection('barbers').where('active', '==', true).count().get();
        const staffCount = barbersSnap.data().count || 0;

        wsDetails.push({
          id: ws.id,
          name: settings.shop_name || ws.name || ws.id,
          slug: ws.slug || '',
          plan: ws.plan_type || 'individual',
          status: ws.billing_status || 'inactive',
          trial_ends: ws.trial_ends_at || null,
          created_at: ws.created_at || '',
          bookings: bookingCount,
          clients: clientCount,
          staff: staffCount,
          sms_status: settings.sms_registration_status || 'none',
          sms_number: settings.sms_from_number || '',
          sms_number_type: settings.sms_number_type || '',
        });
      } catch { /* skip broken workspace */ }
    }

    // Sort by created_at desc
    wsDetails.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    // 5. Trial conversion rate
    const trialConverted = workspaces.filter(w => w.trial_used === true).length;
    const totalTrials = workspaces.filter(w => w.trial_ends_at).length;
    const conversionRate = totalTrials ? Math.round((trialConverted / totalTrials) * 100) : 0;

    res.json({
      total_workspaces: workspaces.length,
      by_plan: byPlan,
      by_status: byStatus,
      signups_30d: signupsLast30d.length,
      signups_7d: signupsLast7d.length,
      signups_by_day: signupsByDay,
      trial_count: trialCount,
      paid_count: paidCount,
      trial_conversion_rate: conversionRate,
      workspaces: wsDetails,
    });
  } catch (e) {
    console.error('Platform metrics error:', e);
    res.status(500).json({ error: 'Failed to fetch platform metrics' });
  }
});

app.get('/api/vurium-dev/sms/status', requireSuperadmin, async (req, res) => {
  try {
    res.json({
      default_path: 'toll-free',
      manual_path_enabled: true,
      verify_profile_configured: !!process.env.TELNYX_VERIFY_PROFILE_ID,
      rollout_gate: 'pilot_or_telnyx_confirmation',
      protected_legacy_workspace: {
        slug: 'elementbarbershop',
        name: 'Element Barbershop',
      },
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to fetch SMS admin status' });
  }
});

app.post('/api/vurium-dev/sms/provision', requireSuperadmin, express.json(), async (req, res) => {
  try {
    const workspaceId = safeStr(req.body?.workspace_id || '');
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace_id' });

    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });

    const workspace = { id: wsDoc.id, ...wsDoc.data() };
    const result = await provisionTollFreeSmsForWorkspace(workspace, {
      source: 'developer',
      actor_uid: req.adminUser?.email || 'superadmin',
      actor_name: req.adminUser?.email || 'superadmin',
      actor_role: 'superadmin',
      actor_ip: getClientIp(req),
    });

    res.json(result);
  } catch (e) {
    res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed to provision toll-free number', ...(e?.meta || {}) });
  }
});

// ============================================================
// BE.8 — LEGACY SMS STATUS MIGRATION (plan: BE.8-Legacy-SMS-Migration-Plan-v2)
// ============================================================
// Owner-approved 4-AI-gated plan (2026-04-15). Purpose: migrate workspaces
// carrying old manual-10DLC status values (pending_otp / verified / brand_created /
// pending_campaign / pending_number / pending_approval / pending_vetting) onto the
// new pipeline (none / provisioning / pending / active / failed*). Element
// Barbershop is skipped via isProtectedLegacyWorkspace() — protected legacy.
//
// Sequence (Owner runs):
//   Pre-Step 0: Firestore export (Cloud Console → workspaces → Export to gs://)
//   1. GET  /api/vurium-dev/sms/legacy-audit                           — list affected workspaces
//   2. POST /api/vurium-dev/sms/migrate-legacy-statuses?dryRun=true    — preview transitions
//   3. POST /api/vurium-dev/sms/migrate-legacy-statuses?dryRun=false   — real migration (atomic batch)
//   4. GET  /api/vurium-dev/sms/legacy-audit                           — must return total: 0
//   5. POST /api/vurium-dev/sms/restore-legacy-status/:wsId            — manual rollback if needed
//
// After Owner verifies total: 0, a separate commit removes LEGACY_SMS_STATUSES.
// ============================================================

function mapLegacyStatusToNew(oldStatus, settings) {
  const hasBrand = !!settings?.telnyx_brand_id;
  switch (oldStatus) {
    case 'pending_otp':
    case 'verified':
      return hasBrand ? 'pending' : 'none';
    case 'brand_created':
    case 'pending_campaign':
    case 'pending_number':
      return 'pending';
    case 'pending_approval':
    case 'pending_vetting':
      return 'pending';
    default:
      return null; // not a legacy status
  }
}

async function collectLegacyWorkspaces() {
  const transitions = [];
  let elementSkipped = false;
  const legacySet = new Set(LEGACY_SMS_STATUS_VALUES);
  const wsSnap = await db.collection('workspaces').limit(500).get();
  for (const ws of wsSnap.docs) {
    const cfgDoc = await db.collection('workspaces').doc(ws.id).collection('settings').doc('config').get();
    if (!cfgDoc.exists) continue;
    const settings = cfgDoc.data() || {};
    const oldStatus = safeStr(settings.sms_registration_status || '');
    if (!legacySet.has(oldStatus)) continue;

    const workspace = { id: ws.id, ...ws.data() };
    if (isProtectedLegacyWorkspace(workspace, settings)) {
      elementSkipped = true;
      continue;
    }

    const newStatus = mapLegacyStatusToNew(oldStatus, settings);
    if (!newStatus) continue;

    transitions.push({
      workspace_id: ws.id,
      slug: safeStr(workspace.slug || ''),
      name: safeStr(workspace.name || settings.shop_name || ''),
      old_status: oldStatus,
      new_status: newStatus,
      number_type: safeStr(settings.sms_number_type || ''),
      has_brand: !!settings.telnyx_brand_id,
      has_campaign: !!settings.telnyx_campaign_id,
    });
  }
  return { transitions, elementSkipped };
}

// Step 1 — Audit (read-only)
app.get('/api/vurium-dev/sms/legacy-audit', requireSuperadmin, async (req, res) => {
  try {
    const { transitions, elementSkipped } = await collectLegacyWorkspaces();
    res.json({
      total: transitions.length,
      elementSkipped,
      workspaces: transitions.map(t => ({
        id: t.workspace_id,
        slug: t.slug,
        name: t.name,
        status: t.old_status,
        number_type: t.number_type,
      })),
    });
  } catch (e) {
    console.warn('[BE.8] legacy-audit error:', e?.message);
    res.status(500).json({ error: e?.message || 'Failed to run legacy audit' });
  }
});

// Step 2 — Migration (dry-run or real, atomic batch)
app.post('/api/vurium-dev/sms/migrate-legacy-statuses', requireSuperadmin, express.json(), async (req, res) => {
  try {
    const dryRun = safeStr(req.query?.dryRun || '').toLowerCase() !== 'false';
    const { transitions, elementSkipped } = await collectLegacyWorkspaces();

    if (transitions.length === 0) {
      return res.json({
        dryRun,
        total: 0,
        transitions: [],
        elementSkipped,
        batches: 0,
        message: 'No legacy workspaces to migrate. LEGACY_SMS_STATUSES Set can be safely removed in next commit.',
      });
    }

    // Firestore batches are capped at 500 operations. We only write 1 op per workspace,
    // so up to 500 transitions fit in a single batch. Anything above needs splitting.
    const BATCH_LIMIT = 500;
    const batchCount = Math.ceil(transitions.length / BATCH_LIMIT);

    for (const t of transitions) {
      console.log(`[BE.8] ${dryRun ? 'DRY' : 'MIGRATE'} ws=${t.workspace_id} slug=${t.slug} ${t.old_status} → ${t.new_status}`);
    }

    if (!dryRun) {
      const now = toIso(new Date());
      for (let b = 0; b < batchCount; b++) {
        const batch = db.batch();
        const slice = transitions.slice(b * BATCH_LIMIT, (b + 1) * BATCH_LIMIT);
        for (const t of slice) {
          const ref = db.collection('workspaces').doc(t.workspace_id).collection('settings').doc('config');
          batch.update(ref, {
            sms_registration_status: t.new_status,
            sms_registration_status_legacy: t.old_status,
            sms_status_updated_at: now,
            sms_migration_source: 'BE.8-legacy-statuses',
          });
        }
        await batch.commit();
        console.log(`[BE.8] Batch ${b + 1}/${batchCount} committed (${slice.length} ops)`);
      }
    }

    res.json({
      dryRun,
      total: transitions.length,
      transitions,
      elementSkipped,
      batches: batchCount,
      note: dryRun ? 'No writes performed. Re-run with ?dryRun=false to apply.' : 'Migration applied. Run GET /api/vurium-dev/sms/legacy-audit to verify total: 0.',
    });
  } catch (e) {
    console.warn('[BE.8] migrate-legacy-statuses error:', e?.message);
    res.status(500).json({ error: e?.message || 'Failed to run legacy status migration' });
  }
});

// ============================================================
// BE.9 — One-shot re-sanitization of existing site_config (custom_html / custom_css / ai_css)
// ============================================================
// Scope: ALL workspaces. Reads each workspace doc, runs the three fields through
// the BE.9 sanitizers, writes back only if anything actually changed. Uses
// db.batch() with 500-op limit like BE.8 migration. Supports ?dryRun=true.
// Needed because backend sanitization only protects NEW writes — existing
// stored values written before BE.9 landed would otherwise stay un-sanitized
// until someone saves them again.

app.post('/api/vurium-dev/sanitize-existing-custom-content', requireSuperadmin, express.json(), async (req, res) => {
  try {
    const dryRun = safeStr(req.query?.dryRun || '').toLowerCase() !== 'false';
    const wsSnap = await db.collection('workspaces').limit(500).get();
    const changes = [];

    for (const ws of wsSnap.docs) {
      const data = ws.data() || {};
      const sc = data.site_config || null;
      if (!sc || typeof sc !== 'object') continue;

      const before = {
        custom_html: sc.custom_html || '',
        custom_css: sc.custom_css || '',
        ai_css: sc.ai_css || '',
      };
      const after = {
        custom_html: sanitizeCustomHtml(before.custom_html),
        custom_css: sanitizeCustomCss(before.custom_css),
        ai_css: sanitizeCustomCss(before.ai_css),
      };

      const diffs = [];
      if (after.custom_html !== before.custom_html) diffs.push('custom_html');
      if (after.custom_css !== before.custom_css) diffs.push('custom_css');
      if (after.ai_css !== before.ai_css) diffs.push('ai_css');
      if (diffs.length === 0) continue;

      changes.push({
        workspace_id: ws.id,
        slug: safeStr(data.slug || ''),
        name: safeStr(data.name || ''),
        fields_changed: diffs,
        before_len: {
          custom_html: before.custom_html.length,
          custom_css: before.custom_css.length,
          ai_css: before.ai_css.length,
        },
        after_len: {
          custom_html: after.custom_html.length,
          custom_css: after.custom_css.length,
          ai_css: after.ai_css.length,
        },
      });

      console.log(`[BE.9] ${dryRun ? 'DRY' : 'SANITIZE'} ws=${ws.id} fields=${diffs.join(',')}`);
    }

    if (!dryRun && changes.length > 0) {
      const BATCH_LIMIT = 500;
      const batchCount = Math.ceil(changes.length / BATCH_LIMIT);
      const now = toIso(new Date());
      for (let b = 0; b < batchCount; b++) {
        const batch = db.batch();
        const slice = changes.slice(b * BATCH_LIMIT, (b + 1) * BATCH_LIMIT);
        for (const c of slice) {
          const wsRef = db.collection('workspaces').doc(c.workspace_id);
          const wsDocNow = await wsRef.get();
          const scNow = (wsDocNow.exists ? wsDocNow.data()?.site_config : null) || {};
          const patch = { ...scNow };
          if (c.fields_changed.includes('custom_html')) patch.custom_html = sanitizeCustomHtml(scNow.custom_html || '');
          if (c.fields_changed.includes('custom_css')) patch.custom_css = sanitizeCustomCss(scNow.custom_css || '');
          if (c.fields_changed.includes('ai_css')) patch.ai_css = sanitizeCustomCss(scNow.ai_css || '');
          batch.update(wsRef, { site_config: patch, updated_at: now });
        }
        await batch.commit();
        console.log(`[BE.9] Batch ${b + 1}/${batchCount} committed (${slice.length} ops)`);
      }
    }

    res.json({
      dryRun,
      total: changes.length,
      changes,
      note: dryRun
        ? 'No writes performed. Re-run with ?dryRun=false to apply.'
        : 'Re-sanitization applied. Affected workspaces had their custom_html / custom_css / ai_css replaced with sanitized versions.',
    });
  } catch (e) {
    console.warn('[BE.9] sanitize-existing-custom-content error:', e?.message);
    res.status(500).json({ error: e?.message || 'Failed to re-sanitize existing custom content' });
  }
});

// Step 5 — Restore (manual rollback using the snapshot we wrote in step 2)
// Reads sms_registration_status_legacy that BE.8 migration wrote as a breadcrumb
// and writes it back as the active status. Owner can also fall back to the full
// Firestore export from Pre-Step 0 via Cloud Console if this endpoint is unavailable.
app.post('/api/vurium-dev/sms/restore-legacy-status/:wsId', requireSuperadmin, express.json(), async (req, res) => {
  try {
    const wsId = safeStr(req.params.wsId || '');
    if (!wsId) return res.status(400).json({ error: 'Missing wsId' });

    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const workspace = { id: wsId, ...wsDoc.data() };

    const cfgRef = db.collection('workspaces').doc(wsId).collection('settings').doc('config');
    const cfgDoc = await cfgRef.get();
    if (!cfgDoc.exists) return res.status(404).json({ error: 'Workspace settings/config not found' });
    const settings = cfgDoc.data() || {};

    if (isProtectedLegacyWorkspace(workspace, settings)) {
      return res.status(409).json({ error: 'Refusing to restore protected legacy workspace (Element)' });
    }

    const override = safeStr(req.body?.status || '');
    const legacy = safeStr(settings.sms_registration_status_legacy || '');
    const target = override || legacy;
    if (!target) {
      return res.status(400).json({
        error: 'No legacy status to restore. Pass { "status": "pending_otp" } in body to force a specific value.',
        current: safeStr(settings.sms_registration_status || ''),
      });
    }

    await cfgRef.update({
      sms_registration_status: target,
      sms_status_updated_at: toIso(new Date()),
      sms_migration_source: `BE.8-restore-${override ? 'override' : 'snapshot'}`,
    });
    console.log(`[BE.8] RESTORE ws=${wsId} → ${target} (from ${override ? 'override' : 'snapshot'})`);

    res.json({ ok: true, workspace_id: wsId, restored_status: target, source: override ? 'override' : 'snapshot' });
  } catch (e) {
    console.warn('[BE.8] restore-legacy-status error:', e?.message);
    res.status(500).json({ error: e?.message || 'Failed to restore legacy status' });
  }
});

// ── Analytics tracker ingest (unauthenticated, rate-limited) ──
const trackerLimiter = {};
app.post('/t', express.json({ limit: '1kb' }), (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  if (!trackerLimiter[ip]) trackerLimiter[ip] = { count: 0, reset: now + 60000 };
  if (now > trackerLimiter[ip].reset) { trackerLimiter[ip] = { count: 0, reset: now + 60000 }; }
  trackerLimiter[ip].count++;
  if (trackerLimiter[ip].count > 60) return res.status(429).end();

  const { url, ref, scr, vid, sid } = req.body || {};
  if (!url || typeof url !== 'string' || url.length > 500) return res.status(400).end();

  const ua = safeStr(req.headers['user-agent'] || '').substring(0, 300);
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)/i);
  const browser = browserMatch ? browserMatch[1].toLowerCase().replace('trident', 'ie') : 'other';
  const ipHash = crypto.createHash('sha256').update(ip + JWT_SECRET).digest('hex').substring(0, 16);

  db.collection('vurium_analytics').add({
    url: safeStr(url).substring(0, 500),
    referrer: safeStr(ref || '').substring(0, 500),
    device, browser,
    screen: safeStr(scr || '').substring(0, 20),
    visitor_id: safeStr(vid || '').substring(0, 40),
    session_id: safeStr(sid || '').substring(0, 40),
    ip_hash: ipHash,
    created_at: toIso(new Date()),
  }).catch(e => console.warn('Analytics write error:', e?.message));

  res.status(204).end();
});

// ── Analytics query (superadmin only) ──
app.get('/api/vurium-dev/analytics', requireSuperadmin, async (req, res) => {
  try {
    const range = req.query.range || '7d';
    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const snap = await db.collection('vurium_analytics')
      .where('created_at', '>=', since)
      .orderBy('created_at', 'desc')
      .limit(50000)
      .get();

    const docs = [];
    snap.forEach(d => docs.push(d.data()));

    // Aggregate
    const uniqueVisitors = new Set(docs.map(d => d.visitor_id).filter(Boolean));
    const uniqueSessions = new Set(docs.map(d => d.session_id).filter(Boolean));

    // Pageviews by day
    const byDay = {};
    docs.forEach(d => {
      const day = (d.created_at || '').substring(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    });

    // Top pages
    const byPage = {};
    docs.forEach(d => { if (d.url) byPage[d.url] = (byPage[d.url] || 0) + 1; });
    const topPages = Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([url, count]) => ({ url, count }));

    // Top referrers
    const byRef = {};
    docs.forEach(d => {
      if (d.referrer) {
        try { const h = new URL(d.referrer).hostname; byRef[h] = (byRef[h] || 0) + 1; } catch { byRef[d.referrer] = (byRef[d.referrer] || 0) + 1; }
      }
    });
    const topReferrers = Object.entries(byRef).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, count]) => ({ source, count }));

    // Device breakdown
    const byDevice = { desktop: 0, mobile: 0, tablet: 0 };
    docs.forEach(d => { if (d.device && byDevice[d.device] !== undefined) byDevice[d.device]++; });

    // Browser breakdown
    const byBrowser = {};
    docs.forEach(d => { if (d.browser) byBrowser[d.browser] = (byBrowser[d.browser] || 0) + 1; });

    // Conversion funnel: visitors who hit / then /signup in same session
    const sessionPages = {};
    docs.forEach(d => {
      if (d.session_id && d.url) {
        if (!sessionPages[d.session_id]) sessionPages[d.session_id] = new Set();
        sessionPages[d.session_id].add(d.url);
      }
    });
    const landingSessions = Object.values(sessionPages).filter(s => s.has('/')).length;
    const signupSessions = Object.values(sessionPages).filter(s => s.has('/signup')).length;
    const completedSignups = Object.values(sessionPages).filter(s => s.has('/dashboard')).length;

    res.json({
      range: days,
      total_pageviews: docs.length,
      unique_visitors: uniqueVisitors.size,
      unique_sessions: uniqueSessions.size,
      by_day: byDay,
      top_pages: topPages,
      top_referrers: topReferrers,
      devices: byDevice,
      browsers: byBrowser,
      funnel: { landing: landingSessions, signup: signupSessions, completed: completedSignups },
    });
  } catch (e) {
    console.error('Analytics query error:', e);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── Email: Send (superadmin only) ──
app.post('/api/vurium-dev/email/send', requireSuperadmin, async (req, res) => {
  try {
    const { to, subject, body_html, mailbox } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Missing to or subject' });

    const mailboxMeta = getVuriumMailboxMeta(mailbox);
    const html = vuriumSupportEmailTemplate(subject, body_html || '<p>No content</p>', mailboxMeta);
    const result = await sendEmail(to, subject, html, mailboxMeta.fromName);

    // Save outbound email
    await db.collection('vurium_emails').add({
      direction: 'outbound',
      from: `noreply@vurium.com`,
      mailbox: mailboxMeta.teamEmail,
      to, subject,
      body_html: body_html || '',
      body_text: '',
      status: result?.id ? 'sent' : 'failed',
      read: true,
      created_at: toIso(new Date()),
    });

    res.json({ ok: true, id: result?.id });
  } catch (e) {
    console.error('Admin email send error:', e);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ── Email: Resend inbound webhook ──
app.post('/api/vurium-dev/email/inbound', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const { from, to, subject, html, text } = req.body || {};
    if (!from) return res.status(400).json({ error: 'Missing from' });

    const senderEmail = typeof from === 'string' ? from : (from?.address || from?.email || JSON.stringify(from));
    const recipientEmail = typeof to === 'string' ? to : (Array.isArray(to) ? to.map(t => t?.address || t).join(', ') : JSON.stringify(to));
    const cleanSubject = safeStr(subject || '(no subject)').substring(0, 500);

    await db.collection('vurium_emails').add({
      direction: 'inbound',
      from: senderEmail,
      to: recipientEmail,
      subject: cleanSubject,
      body_html: (html || '').substring(0, 100000),
      body_text: (text || '').substring(0, 50000),
      status: 'received',
      read: false,
      created_at: toIso(new Date()),
    });

    // Forward notification to admin's personal email
    if (ADMIN_NOTIFY_EMAIL) {
      const notifyHtml = vuriumSupportEmailTemplate('New Email Received', `
        <p style="margin:0 0 12px;color:#475467;">You received a new email on <strong style="color:#101828;">${recipientEmail}</strong>.</p>
        <div style="margin:16px 0;padding:16px 20px;border-radius:14px;background:#f8fafc;border:1px solid #e8edf5;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">From</p>
          <p style="margin:0 0 16px;color:#344054;">${senderEmail}</p>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Subject</p>
          <p style="margin:0 0 16px;font-weight:600;color:#101828;">${cleanSubject}</p>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Preview</p>
          <p style="margin:0;color:#475467;font-size:13px;line-height:1.7;">${safeStr(text || '').substring(0, 300)}${(text || '').length > 300 ? '...' : ''}</p>
        </div>
        <p style="margin:16px 0 0;text-align:center;">
          <a href="https://vurium.com/developer/email" style="display:inline-block;padding:11px 26px;border-radius:999px;background:#eef2ff;color:#4f5f86;font-weight:700;font-size:13px;text-decoration:none;border:1px solid #d8ddf5;">Open in Developer Panel</a>
        </p>
      `, {
        teamLabel: 'Support Inbox',
        teamEmail: 'support@vurium.com',
        fromName: 'Vurium Support',
        eyebrow: 'Inbox alert',
        intro: 'A new message was received in the Vurium support inbox.',
        actionNote: 'Open the Developer Panel to review the full thread and reply from the correct Vurium mailbox.',
        signature: 'Vurium Support Operations',
      });
      sendEmail(ADMIN_NOTIFY_EMAIL, `[Vurium] ${cleanSubject} — from ${senderEmail}`, notifyHtml, 'Vurium Support').catch(() => {});
    }

    console.log('[DEV-EMAIL] Inbound from', senderEmail, 'subject:', cleanSubject);
    res.json({ ok: true });
  } catch (e) {
    console.error('Inbound email error:', e);
    res.status(500).json({ error: 'Failed to store inbound email' });
  }
});

// ── Email: List (superadmin only) ──
app.get('/api/vurium-dev/emails', requireSuperadmin, async (req, res) => {
  try {
    const direction = req.query.direction || 'all';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    let q = db.collection('vurium_emails').orderBy('created_at', 'desc').limit(limit);
    if (direction !== 'all') q = q.where('direction', '==', direction);

    const snap = await q.get();
    const emails = [];
    snap.forEach(d => emails.push({ id: d.id, ...d.data() }));
    res.json({ emails });
  } catch (e) {
    console.error('Email list error:', e);
    res.status(500).json({ error: 'Failed to list emails' });
  }
});

// ── Email: Get single (superadmin only) ──
app.get('/api/vurium-dev/emails/:id', requireSuperadmin, async (req, res) => {
  try {
    const doc = await db.collection('vurium_emails').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get email' });
  }
});

// ── Email: Mark read/unread (superadmin only) ──
app.patch('/api/vurium-dev/emails/:id', requireSuperadmin, async (req, res) => {
  try {
    const { read } = req.body;
    await db.collection('vurium_emails').doc(req.params.id).update({ read: !!read });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// ── Gmail API Integration ────────────────────────────────────────────────────
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = BACKEND_PUBLIC_URL + '/api/vurium-dev/gmail/callback';
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

function makeOAuth2Client() {
  return new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
}

async function saveGmailTokens(account, tokens) {
  const ref = db.collection('vurium_config').doc('gmail_tokens');
  await ref.set({ [account]: tokens }, { merge: true });
}

async function getGmailTokens(account) {
  const doc = await db.collection('vurium_config').doc('gmail_tokens').get();
  if (!doc.exists) return null;
  return doc.data()[account] || null;
}

async function getGmailClient(account) {
  const tokens = await getGmailTokens(account);
  if (!tokens || !tokens.refresh_token) return null;
  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token || undefined,
    expiry_date: tokens.expires_at || 0,
  });
  // auto-refresh if expired
  if (!tokens.access_token || (tokens.expires_at && Date.now() > tokens.expires_at - 60000)) {
    const { credentials } = await oauth2.refreshAccessToken();
    await saveGmailTokens(account, {
      refresh_token: tokens.refresh_token,
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date,
    });
    oauth2.setCredentials(credentials);
  }
  return google.gmail({ version: 'v1', auth: oauth2 });
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function decodeBody(part) {
  if (part.body && part.body.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  }
  return '';
}

function extractBody(payload) {
  // direct body
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { html: decodeBody(payload), text: '' };
  }
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { html: '', text: decodeBody(payload) };
  }
  // multipart
  let html = '', text = '';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) html = decodeBody(part);
      else if (part.mimeType === 'text/plain' && part.body?.data) text = decodeBody(part);
      else if (part.mimeType?.startsWith('multipart/') && part.parts) {
        const nested = extractBody(part);
        if (nested.html) html = nested.html;
        if (nested.text) text = nested.text;
      }
    }
  }
  return { html, text };
}

function buildRawEmail({ from, to, cc, bcc, subject, html, inReplyTo, references }) {
  const boundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${references || inReplyTo}`);
  const body = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    html,
    `--${boundary}--`,
  ].join('\r\n');
  const raw = headers.join('\r\n') + '\r\n\r\n' + body;
  return Buffer.from(raw).toString('base64url');
}

async function sendGmailReply({ account, to, subject, bodyHtml, threadId, messageId }) {
  const gmail = await getGmailClient(account);
  if (!gmail) {
    const err = new Error('Account not connected');
    err.code = 'GMAIL_NOT_CONNECTED';
    throw err;
  }
  const mailboxMeta = getVuriumMailboxMeta(account);
  const styledHtml = vuriumSupportEmailTemplate(subject, bodyHtml || '', mailboxMeta);
  const raw = buildRawEmail({
    from: mailboxMeta.fromHeader,
    to,
    subject,
    html: styledHtml,
    inReplyTo: messageId,
    references: messageId,
  });
  const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId } });
  return { id: result.data.id, threadId: result.data.threadId };
}

// Gmail OAuth: Start authorization
app.get('/api/vurium-dev/gmail/auth', requireSuperadmin, (req, res) => {
  const account = req.query.account;
  if (!account) return res.status(400).json({ error: 'account query param required' });
  if (!GMAIL_CLIENT_ID) return res.status(500).json({ error: 'Gmail OAuth not configured' });
  const oauth2 = makeOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    login_hint: account,
    state: account,
  });
  res.json({ url });
});

// Gmail OAuth: Callback from Google
app.get('/api/vurium-dev/gmail/callback', async (req, res) => {
  try {
    const { code, state: account } = req.query;
    if (!code || !account) return res.status(400).send('Missing code or account');
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    await saveGmailTokens(account, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at: tokens.expiry_date,
    });
    res.redirect(`https://vurium.com/developer/email?connected=${encodeURIComponent(account)}`);
  } catch (e) {
    console.error('Gmail callback error:', e.message);
    res.redirect(`https://vurium.com/developer/email?error=oauth_failed`);
  }
});

// Gmail: Connection status for all mailboxes
app.get('/api/vurium-dev/gmail/status', requireSuperadmin, async (req, res) => {
  try {
    const doc = await db.collection('vurium_config').doc('gmail_tokens').get();
    const data = doc.exists ? doc.data() : {};
    const status = {};
    for (const account of Object.keys(data)) {
      status[account] = !!data[account]?.refresh_token;
    }
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get Gmail status' });
  }
});

// Gmail: List messages
app.get('/api/vurium-dev/gmail/messages', requireSuperadmin, async (req, res) => {
  try {
    const { account, maxResults = '20', pageToken, q } = req.query;
    if (!account) return res.status(400).json({ error: 'account required' });
    const gmail = await getGmailClient(account);
    if (!gmail) return res.status(400).json({ error: 'Account not connected', needsAuth: true });

    const listParams = { userId: 'me', maxResults: parseInt(maxResults) };
    if (pageToken) listParams.pageToken = pageToken;
    if (q) listParams.q = q;

    const list = await gmail.users.messages.list(listParams);
    if (!list.data.messages || list.data.messages.length === 0) {
      return res.json({ messages: [], nextPageToken: null });
    }

    const messages = await Promise.all(
      list.data.messages.map(async (m) => {
        const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] });
        const headers = msg.data.payload?.headers || [];
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          snippet: msg.data.snippet,
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          labelIds: msg.data.labelIds || [],
          isUnread: (msg.data.labelIds || []).includes('UNREAD'),
        };
      })
    );

    res.json({ messages, nextPageToken: list.data.nextPageToken || null });
  } catch (e) {
    console.error('Gmail list error:', e.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Gmail: Get single message
app.get('/api/vurium-dev/gmail/messages/:id', requireSuperadmin, async (req, res) => {
  try {
    const { account } = req.query;
    if (!account) return res.status(400).json({ error: 'account required' });
    const gmail = await getGmailClient(account);
    if (!gmail) return res.status(400).json({ error: 'Account not connected', needsAuth: true });

    const msg = await gmail.users.messages.get({ userId: 'me', id: req.params.id, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const { html, text } = extractBody(msg.data.payload);

    res.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date'),
      messageId: getHeader(headers, 'Message-ID') || getHeader(headers, 'Message-Id'),
      labelIds: msg.data.labelIds || [],
      isUnread: (msg.data.labelIds || []).includes('UNREAD'),
      body_html: html,
      body_text: text,
    });
  } catch (e) {
    console.error('Gmail get error:', e.message);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Gmail: Send email
app.post('/api/vurium-dev/gmail/send', requireSuperadmin, async (req, res) => {
  try {
    const { account, to, cc, bcc, subject, body_html } = req.body;
    if (!account || !to || !subject) return res.status(400).json({ error: 'account, to, subject required' });
    const gmail = await getGmailClient(account);
    if (!gmail) return res.status(400).json({ error: 'Account not connected', needsAuth: true });

    const mailboxMeta = getVuriumMailboxMeta(account);
    const styledHtml = vuriumSupportEmailTemplate(subject, body_html || '', mailboxMeta);
    const raw = buildRawEmail({ from: mailboxMeta.fromHeader, to, cc, bcc, subject, html: styledHtml });
    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    res.json({ ok: true, id: result.data.id, threadId: result.data.threadId });
  } catch (e) {
    console.error('Gmail send error:', e.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Gmail: Reply to email
app.post('/api/vurium-dev/gmail/reply', requireSuperadmin, async (req, res) => {
  try {
    const { account, to, subject, body_html, threadId, messageId } = req.body;
    if (!account || !to || !subject || !threadId) return res.status(400).json({ error: 'account, to, subject, threadId required' });
    const result = await sendGmailReply({
      account,
      to,
      subject,
      bodyHtml: body_html || '',
      threadId,
      messageId,
    });
    res.json({ ok: true, id: result.id, threadId: result.threadId });
  } catch (e) {
    if (e.code === 'GMAIL_NOT_CONNECTED') return res.status(400).json({ error: 'Account not connected', needsAuth: true });
    console.error('Gmail reply error:', e.message);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// ── AI Diagnostics System ────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';
const AI_PROVIDER_MODE = safeStr(process.env.AI_PROVIDER_MODE || 'hybrid').toLowerCase();
const AnthropicClient = Anthropic.default || Anthropic;
const OpenAIClient = OpenAI.default || OpenAI;
const anthropic = ANTHROPIC_API_KEY ? new AnthropicClient({ apiKey: ANTHROPIC_API_KEY }) : null;
const openai = OPENAI_API_KEY ? new OpenAIClient({ apiKey: OPENAI_API_KEY }) : null;

const DIAGNOSTIC_SYSTEM_PROMPT = `You are the AI product advisor and diagnostics engine for VuriumBook — a multi-tenant SaaS platform for barbershops and salons.

PLATFORM ARCHITECTURE:
- Multi-tenant: each workspace = one barbershop/salon business
- Subcollections per workspace: bookings, clients, barbers, services, users, settings, audit_logs
- Billing: Stripe (plans: individual, salon, custom). Trial period, then paid subscription.
- SMS: Telnyx (appointment reminders 24h and 2h before, booking confirmations)
- Email: Resend (branded transactional emails from noreply@vurium.com)
- Frontend: Next.js on Vercel (vurium.com), Backend: Express on Cloud Run
- Database: Google Cloud Firestore
- Features: online booking page, client management, barber scheduling, services catalog, cash reports, payroll, memberships, analytics, push notifications (iOS/Android)

YOUR ROLE — You are NOT just a monitoring tool. You are a smart product advisor who:
1. FINDS BUGS & CODE ISSUES: Analyze data patterns that indicate bugs (e.g., bookings without clients, orphaned data, failed payments with no retry, SMS not sent for bookings)
2. SUGGESTS IMPROVEMENTS: Based on usage patterns, suggest code/UX improvements (e.g., if most bookings happen on mobile, suggest mobile-first optimizations; if clients rarely rebook, suggest loyalty features)
3. PROPOSES NEW FEATURES: Based on what successful barbershop/salon SaaS platforms offer, propose features that would increase retention and revenue (e.g., waitlist, no-show tracking, client reviews, automated marketing, gift cards)
4. ANALYZES USER BEHAVIOR: Look at booking patterns, client engagement, workspace activity to understand how users actually use the platform and where they struggle
5. GROWTH INSIGHTS: Analyze trial conversion, churn signals, feature adoption to suggest growth strategies

You will receive aggregated platform metrics including:
- Workspace details (names, plans, billing status, booking/client counts)
- Booking patterns (today's bookings, completion rates, payment status)
- User engagement (active workspaces, feature usage)
- SMS/Email delivery stats
- Security events
- Analytics (pageviews, visitor patterns)

Return a JSON object with:
- health_score: 0-100 (considers both technical health AND product health)
- summary: 2-3 sentence overview of platform state and key insight
- issues: array of findings, each with:
  - severity: "critical" | "warning" | "info"
  - category: "bug" | "improvement" | "new_feature" | "user_behavior" | "growth" | "security" | "performance"
  - title: concise title (max 60 chars)
  - description: detailed explanation with specific data points
  - recommendation: actionable suggestion with concrete steps

PRIORITIES:
- Bugs and data integrity issues = critical
- UX improvements based on actual user behavior = warning
- New feature ideas and growth strategies = info
- Be specific, reference actual numbers from the data
- Think like a product manager + engineer combined
- Consider what would make a barbershop owner's life easier
- Suggest features that competing platforms (Square Appointments, Fresha, Booksy, Vagaro) offer

IMPORTANT: Return ONLY valid JSON, no markdown, no code fences. Aim for 5-10 actionable findings per scan.`;

const WORKFLOW_STATUS_VALUES = ['done', 'partial', 'blocked', 'needs_review', 'queued'];
const WORKFLOW_ESCALATION_TARGET_VALUES = ['none', 'AI-1', 'AI-2', 'AI-3', 'AI-5', 'AI-6', 'AI-7', 'AI-8', 'AI-9', 'AI-10', 'AI-11', 'Owner'];
const WorkflowStatusSchema = z.enum(WORKFLOW_STATUS_VALUES);
const WorkflowEscalationTargetSchema = z.enum(WORKFLOW_ESCALATION_TARGET_VALUES);
const WorkflowWritebackStateSchema = z.object({
  status: WorkflowStatusSchema,
  relative_path: z.string().default(''),
  reason: z.string().default(''),
}).nullable().default(null);
const WorkflowOwnerNotificationStateSchema = z.object({
  status: WorkflowStatusSchema,
  recipient: z.string().default(''),
  reason: z.string().default(''),
}).nullable().default(null);
const WorkflowAIExecutionMetaSchema = z.object({
  provider: z.string().default(''),
  model: z.string().default(''),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
}).nullable().default(null);

const AI3PlanningIntakeInputSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(1),
  requested_by: z.string().default('Owner'),
  complexity: z.string().default('non-trivial'),
  external_dependency: z.boolean().default(false),
  product_context_links: z.array(z.string()).default([]),
  known_constraints: z.array(z.string()).default([]),
  priority: z.string().default('medium'),
});

const AI3PlanningIntakeOutputSchema = z.object({
  agent: z.literal('AI-3'),
  workflow: z.literal('planning_intake'),
  task_id: z.string().min(1),
  status: WorkflowStatusSchema,
  requires_ai5: z.boolean(),
  requires_ai6: z.boolean(),
  requires_ai7: z.boolean(),
  recommended_sequence: z.array(z.string()).default([]),
  plan_skeleton: z.object({
    objective: z.string().default(''),
    workstreams: z.array(z.string()).default([]),
    missing_inputs: z.array(z.string()).default([]),
    acceptance_criteria_seed: z.array(z.string()).default([]),
  }),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const AI3QAScanInputSchema = z.object({
  task_id: z.string().min(1),
  plan_link: z.string().min(1),
  acceptance_criteria: z.array(z.string()).default([]),
  implementation_summary: z.array(z.string()).default([]),
  changed_areas: z.array(z.string()).default([]),
  hotfix: z.boolean().default(false),
});

const AI3QAScanOutputSchema = z.object({
  agent: z.literal('AI-3'),
  workflow: z.literal('qa_scan'),
  task_id: z.string().min(1),
  status: WorkflowStatusSchema,
  result: z.enum(['pass', 'fail', 'needs_review']),
  findings: z.array(z.string()).default([]),
  follow_up_items: z.array(z.string()).default([]),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const SUPPORT_EMAIL_LABEL_VALUES = ['support', 'lead', 'onboarding', 'technical', 'billing', 'compliance_risk'];
const SUPPORT_ROUTE_LANE_VALUES = ['support_reply', 'technical_escalation', 'billing_escalation', 'compliance_escalation'];
const SUPPORT_TECHNICAL_TARGET_VALUES = ['none', 'AI-1', 'AI-2'];
const SupportEmailLabelSchema = z.enum(SUPPORT_EMAIL_LABEL_VALUES);
const SupportRouteLaneSchema = z.enum(SUPPORT_ROUTE_LANE_VALUES);
const SupportTechnicalTargetSchema = z.enum(SUPPORT_TECHNICAL_TARGET_VALUES);

const AI9SupportInboxInputSchema = z.object({
  message_id: z.string().min(1),
  thread_id: z.string().min(1),
  from_email: z.string().min(3),
  subject: z.string().min(1),
  body: z.string().min(1),
  body_html: z.string().default(''),
  received_at: z.string().default(''),
  account: z.string().default(''),
  mailbox: z.string().default(''),
});

const AI9SupportInboxOutputSchema = z.object({
  agent: z.literal('AI-9'),
  workflow: z.literal('support_inbox_process'),
  status: WorkflowStatusSchema,
  message_id: z.string().min(1),
  thread_id: z.string().min(1),
  from_email: z.string().min(3),
  subject: z.string().min(1),
  reply_subject: z.string().min(1),
  account: z.string().default(''),
  mailbox: z.string().default(''),
  label: SupportEmailLabelSchema,
  route_lane: SupportRouteLaneSchema,
  reply_draft: z.string().default(''),
  safe_to_send: z.boolean(),
  escalate_to: WorkflowEscalationTargetSchema,
  technical_target: SupportTechnicalTargetSchema,
  faq_candidate: z.boolean(),
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const SUPPORT_EXECUTION_ACTION_VALUES = ['sent_reply', 'escalated', 'manual_review_required'];
const SupportExecutionActionSchema = z.enum(SUPPORT_EXECUTION_ACTION_VALUES);

const AI9SupportExecutionOutputSchema = z.object({
  agent: z.literal('AI-9'),
  workflow: z.literal('support_inbox_execute'),
  status: WorkflowStatusSchema,
  action: SupportExecutionActionSchema,
  message_id: z.string().min(1),
  thread_id: z.string().min(1),
  account: z.string().default(''),
  mailbox: z.string().default(''),
  label: SupportEmailLabelSchema,
  safe_to_send: z.boolean(),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  gmail_message_id: z.string().default(''),
  gmail_thread_id: z.string().default(''),
  escalation_note: z.object({
    title: z.string().default(''),
    target: WorkflowEscalationTargetSchema,
    body: z.string().default(''),
  }).nullable().default(null),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  next_step: z.string().default(''),
});

const AI8GrowthBriefInputSchema = z.object({
  request_id: z.string().min(1),
  campaign_name: z.string().default(''),
  goal: z.string().min(1),
  audience: z.string().min(1),
  channel: z.string().default(''),
  current_offer_link: z.string().default(''),
  product_truth_links: z.array(z.string()).default([]),
  known_objections: z.array(z.string()).default([]),
  approved_claims_link: z.string().default(''),
  need_static_creatives: z.boolean().default(true),
  need_video_brief: z.boolean().default(true),
  brand_direction: z.array(z.string()).default([]),
  formats: z.array(z.string()).default([]),
});

const AI8GrowthBriefOutputSchema = z.object({
  agent: z.literal('AI-8'),
  workflow: z.literal('growth_brief'),
  request_id: z.string().min(1),
  status: WorkflowStatusSchema,
  growth_brief: z.object({
    goal: z.string().default(''),
    audience: z.string().default(''),
    hook: z.string().default(''),
    cta: z.string().default(''),
    channels: z.array(z.string()).default([]),
    asset_requests: z.array(z.string()).default([]),
    risk_notes: z.array(z.string()).default([]),
  }),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const AI11CreativeVariantsInputSchema = z.object({
  creative_request_id: z.string().min(1),
  growth_brief_link: z.string().default(''),
  goal: z.string().min(1),
  audience: z.string().min(1),
  hook: z.string().min(1),
  cta: z.string().min(1),
  brand_direction: z.array(z.string()).default([]),
  approved_claims_link: z.string().default(''),
  formats: z.array(z.string()).default([]),
});

const AI11CreativeVariantsOutputSchema = z.object({
  agent: z.literal('AI-11'),
  workflow: z.literal('creative_variants'),
  creative_request_id: z.string().min(1),
  status: WorkflowStatusSchema,
  variants: z.array(z.object({
    variant_id: z.string().min(1),
    angle: z.string().default(''),
    prompt: z.string().default(''),
    format: z.string().default(''),
  })).default([]),
  needs_review: z.boolean(),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const AI10VideoBriefInputSchema = z.object({
  video_request_id: z.string().min(1),
  growth_brief_link: z.string().default(''),
  goal: z.string().min(1),
  audience: z.string().min(1),
  hook: z.string().min(1),
  cta: z.string().min(1),
  product_truth_links: z.array(z.string()).default([]),
  approved_claims_link: z.string().default(''),
  asset_dependencies: z.array(z.string()).default([]),
});

const AI10VideoBriefOutputSchema = z.object({
  agent: z.literal('AI-10'),
  workflow: z.literal('video_brief'),
  video_request_id: z.string().min(1),
  status: WorkflowStatusSchema,
  video_brief: z.object({
    goal: z.string().default(''),
    format: z.string().default(''),
    hook: z.string().default(''),
    cta: z.string().default(''),
  }),
  script: z.array(z.object({
    scene: z.number(),
    duration_sec: z.number(),
    text: z.string().default(''),
  })).default([]),
  dependencies_needed: z.array(z.string()).default([]),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  next_step: z.string().default(''),
});

const GrowthAssetFlowInputSchema = z.object({
  request_id: z.string().min(1),
  campaign_name: z.string().default(''),
  goal: z.string().min(1),
  audience: z.string().min(1),
  channel: z.string().default(''),
  current_offer_link: z.string().default(''),
  product_truth_links: z.array(z.string()).default([]),
  known_objections: z.array(z.string()).default([]),
  approved_claims_link: z.string().default(''),
  need_static_creatives: z.boolean().default(true),
  need_video_brief: z.boolean().default(true),
  brand_direction: z.array(z.string()).default([]),
  formats: z.array(z.string()).default([]),
});

const GrowthAssetFlowOutputSchema = z.object({
  agent: z.literal('SYSTEM'),
  workflow: z.literal('growth_asset_flow'),
  status: WorkflowStatusSchema,
  request_id: z.string().min(1),
  growth_brief: AI8GrowthBriefOutputSchema.nullable().default(null),
  creative_output: AI11CreativeVariantsOutputSchema.nullable().default(null),
  video_output: AI10VideoBriefOutputSchema.nullable().default(null),
  creative_requested: z.boolean(),
  video_requested: z.boolean(),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const RESEARCH_SOURCE_STATUS_VALUES = ['provided', 'fetched', 'failed'];
const ResearchSourceStatusSchema = z.enum(RESEARCH_SOURCE_STATUS_VALUES);

const ResearchSourceSummarySchema = z.object({
  source_type: z.string().default('official_source'),
  topic: z.string().default(''),
  url: z.string().default(''),
  title: z.string().default(''),
  status: ResearchSourceStatusSchema.default('fetched'),
});

const AI5ResearchBriefInputSchema = z.object({
  research_id: z.string().min(1),
  task_id: z.string().min(1),
  topic: z.string().min(1),
  questions: z.array(z.string()).default([]),
  target_sources: z.array(z.string()).default([]),
  related_links: z.array(z.string()).default([]),
  source_urls: z.array(z.string()).default([]),
});

const AI5ResearchBriefOutputSchema = z.object({
  agent: z.literal('AI-5'),
  workflow: z.literal('research_brief'),
  research_id: z.string().min(1),
  task_id: z.string().min(1),
  status: WorkflowStatusSchema,
  facts: z.array(z.string()).default([]),
  inferences: z.array(z.string()).default([]),
  open_questions: z.array(z.string()).default([]),
  source_summary: z.array(ResearchSourceSummarySchema).default([]),
  deep_research_prompt: z.string().default(''),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const OWNER_NOTIFICATION_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'];
const OwnerNotificationSeveritySchema = z.enum(OWNER_NOTIFICATION_SEVERITY_VALUES);

const OwnerNotificationInputSchema = z.object({
  workflow_source: z.string().min(1),
  severity: OwnerNotificationSeveritySchema.default('medium'),
  subject: z.string().min(1),
  summary: z.string().min(1),
  details: z.array(z.string()).default([]),
  next_step: z.string().default(''),
  links: z.array(z.string()).default([]),
  recipient: z.string().default(''),
});

const OwnerNotificationOutputSchema = z.object({
  agent: z.literal('SYSTEM'),
  workflow: z.literal('owner_notification'),
  status: WorkflowStatusSchema,
  channel: z.literal('email'),
  workflow_source: z.string().min(1),
  severity: OwnerNotificationSeveritySchema,
  recipient: z.string().default(''),
  subject: z.string().default(''),
  reason: z.string().default(''),
  notification_id: z.string().default(''),
  next_step: z.string().default(''),
});

const OBSIDIAN_WRITEBACK_MODE_VALUES = ['create', 'append', 'replace'];
const ObsidianWritebackModeSchema = z.enum(OBSIDIAN_WRITEBACK_MODE_VALUES);

const ObsidianWritebackInputSchema = z.object({
  relative_path: z.string().min(1),
  content: z.string().min(1),
  mode: ObsidianWritebackModeSchema.default('create'),
  dry_run: z.boolean().default(false),
});

const ObsidianWritebackOutputSchema = z.object({
  agent: z.literal('SYSTEM'),
  workflow: z.literal('obsidian_writeback'),
  status: WorkflowStatusSchema,
  mode: ObsidianWritebackModeSchema,
  relative_path: z.string().min(1),
  absolute_path: z.string().default(''),
  bytes_written: z.number().default(0),
  reason: z.string().default(''),
  next_step: z.string().default(''),
});

const OWNER_INTAKE_KIND_VALUES = ['advisory', 'task', 'growth', 'research', 'handoff', 'truth_update_draft'];
const OwnerIntakeKindSchema = z.enum(OWNER_INTAKE_KIND_VALUES);
const OwnerIntakeInputKindSchema = z.enum(['auto', 'advisory', ...OWNER_INTAKE_KIND_VALUES]);

const OwnerIntakeInputSchema = z.object({
  message: z.string().min(1),
  title: z.string().default(''),
  intake_kind: OwnerIntakeInputKindSchema.default('auto'),
  requested_by: z.string().default('Owner'),
  priority: z.string().default('medium'),
  product_context_links: z.array(z.string()).default([]),
  known_constraints: z.array(z.string()).default([]),
  source_urls: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  target_sources: z.array(z.string()).default([]),
  related_links: z.array(z.string()).default([]),
  related_task_id: z.string().default(''),
  audience: z.string().default(''),
  channel: z.string().default(''),
  approved_claims_link: z.string().default(''),
  current_offer_link: z.string().default(''),
  need_static_creatives: z.boolean().optional(),
  need_video_brief: z.boolean().optional(),
});

const OwnerIntakeOutputSchema = z.object({
  agent: z.literal('SYSTEM'),
  workflow: z.literal('owner_intake'),
  status: WorkflowStatusSchema,
  intake_id: z.string().min(1),
  intake_kind: OwnerIntakeKindSchema,
  title: z.string().min(1),
  queue_stage: z.string().default(''),
  route_target: WorkflowEscalationTargetSchema,
  created_note_relative_path: z.string().default(''),
  downstream_workflow: z.string().default('none'),
  downstream_status: WorkflowStatusSchema,
  downstream_reference: z.string().default(''),
  downstream_result: z.any().nullable().default(null),
  escalate_to: WorkflowEscalationTargetSchema,
  reason: z.string().default(''),
  writeback_targets: z.array(z.string()).default([]),
  writeback: WorkflowWritebackStateSchema,
  owner_notification: WorkflowOwnerNotificationStateSchema,
  operator_reply: z.string().default(''),
  follow_on_workflow: z.string().default('none'),
  follow_on_status: WorkflowStatusSchema,
  follow_on_reference: z.string().default(''),
  follow_on_result: z.any().nullable().default(null),
  next_step: z.string().default(''),
});

const OwnerAdvisoryOutputSchema = z.object({
  agent: z.literal('SYSTEM'),
  workflow: z.literal('owner_advisory'),
  status: WorkflowStatusSchema,
  reply: z.string().default(''),
  suggested_mode: z.enum(['none', ...OWNER_INTAKE_KIND_VALUES]).default('none'),
  reason: z.string().default(''),
  ai_meta: WorkflowAIExecutionMetaSchema,
  next_step: z.string().default(''),
});

const AI3_PLANNING_INTAKE_SYSTEM_PROMPT = `You are AI 3 inside the VuriumBook AI Operating System.

Your role:
- convert non-trivial task intake into structured planning intake
- identify whether AI 5, AI 6, or AI 7 are needed before planning continues
- stay inside planning / structure / QA governance
- do not invent compliance, vendor, product, or pricing truth

Rules:
- return JSON only
- no markdown
- no code fences
- do not write implementation code
- if critical information is missing, block or escalate instead of guessing
- keep recommended_sequence realistic and ownership-based
- when context.owner_conversation_history or context.active_focus is present, use that thread context to resolve references like "this", "that problem", or "continue"
- do not force the owner to restate the same problem if the recent conversation already identifies the active issue

Return exactly this JSON shape:
{
  "agent": "AI-3",
  "workflow": "planning_intake",
  "task_id": "TASK-123",
  "status": "done",
  "requires_ai5": true,
  "requires_ai6": false,
  "requires_ai7": true,
  "recommended_sequence": ["AI-5", "AI-7", "AI-3"],
  "plan_skeleton": {
    "objective": "short objective",
    "workstreams": ["research", "planning"],
    "missing_inputs": ["missing thing"],
    "acceptance_criteria_seed": ["criterion 1"]
  },
  "escalate_to": "AI-5",
  "reason": "why escalation or dependency exists",
  "writeback_targets": ["04-Tasks/Workflow-Queue.md", "04-Tasks/Handoffs/"],
  "next_step": "clear next action"
}`;

const OWNER_ADVISORY_SYSTEM_PROMPT = `You are the front-door owner copilot inside the VuriumBook AI Operating System.

Your role:
- act like a smart first response, similar to a senior operator/copilot
- answer broad questions, status requests, strategy questions, and early exploration without immediately turning them into delivery tasks
- only recommend moving into task / growth / research / handoff / truth draft mode when that would help next
- be practical, concise, and clear

Rules:
- return JSON only
- no markdown
- no code fences
- do not create fake certainty
- if the user is asking for understanding, advice, analysis, or status, keep it advisory first
- if the user clearly asks to start or execute work, suggest the correct next mode instead of forcing a task automatically
- when context.project_snapshot is provided, ground the answer in that internal context first
- when context.owner_conversation_history or context.active_focus is provided, continue the same thread instead of acting like this is a brand new conversation
- if the owner says "continue", "this issue", or "that problem", infer the most recent relevant focus from conversation context before asking them to restate it
- for internal project status / overview requests, summarize what is already visible in queue, notes, and recent writebacks before recommending any execution mode
- do not ask for AI-5 or external source URLs when the request is only about internal project status and the answer can be formed from internal context

Return exactly this JSON shape:
{
  "agent": "SYSTEM",
  "workflow": "owner_advisory",
  "status": "done",
  "reply": "short but useful answer for the owner",
  "suggested_mode": "task",
  "reason": "why this mode is recommended next",
  "next_step": "what the owner should say or do next"
}`;

const AI3_QA_SCAN_SYSTEM_PROMPT = `You are AI 3 inside the VuriumBook AI Operating System.

Your role:
- run a structured QA scan after implementation or hotfix
- compare acceptance criteria against the implementation summary
- identify likely gaps, follow-up work, and escalation targets
- stay inside planning / QA governance

Rules:
- return JSON only
- no markdown
- no code fences
- do not approve launch
- do not invent implementation facts that are not supported by the provided summary
- if confidence is low or verification is incomplete, use "needs_review"

Return exactly this JSON shape:
{
  "agent": "AI-3",
  "workflow": "qa_scan",
  "task_id": "TASK-123",
  "status": "done",
  "result": "needs_review",
  "findings": ["finding 1"],
  "follow_up_items": ["follow-up 1"],
  "escalate_to": "AI-2",
  "reason": "why escalation or follow-up is needed",
  "writeback_targets": ["04-Tasks/*QA-Scan*.md", "04-Tasks/Workflow-Queue.md"],
  "next_step": "clear next action"
}`;

const AI9_SUPPORT_INBOX_SYSTEM_PROMPT = `You are AI 9 inside the VuriumBook AI Operating System.

Your role:
- classify incoming support inbox messages
- draft safe routine replies when appropriate
- escalate risky, ambiguous, billing, technical, or compliance-sensitive cases
- never invent product truth, pricing, legal claims, or promises

Classification labels:
- support
- lead
- onboarding
- technical
- billing
- compliance_risk

Routing rules:
- support / lead / onboarding -> route_lane = "support_reply"
- technical -> route_lane = "technical_escalation"
- billing -> route_lane = "billing_escalation"
- compliance_risk -> route_lane = "compliance_escalation"

Escalation rules:
- technical backend / API / server / data issues -> escalate_to = "AI-1", technical_target = "AI-1"
- technical UI / frontend / rendering / booking-page issues -> escalate_to = "AI-2", technical_target = "AI-2"
- product ambiguity -> escalate_to = "AI-6"
- compliance / policy wording -> escalate_to = "AI-7"
- billing / refund / pricing exception / account-sensitive commitments -> escalate_to = "Owner"
- routine low-risk support / onboarding / lead -> escalate_to = "none"

Safe-send rules:
- safe_to_send may be true only for routine support / onboarding / lead replies
- safe_to_send must be false for technical, billing, compliance-risk, angry or dispute-like, or unclear requests
- if uncertain, escalate instead of guessing

Rules:
- return JSON only
- no markdown
- no code fences
- keep reply short and clear
- do not promise launch dates, refunds, pricing exceptions, legal outcomes, or unsupported features

Return exactly this JSON shape:
{
  "agent": "AI-9",
  "workflow": "support_inbox_process",
  "status": "done",
  "message_id": "msg-123",
  "thread_id": "thread-123",
  "from_email": "user@example.com",
  "subject": "Need help",
  "reply_subject": "Re: Need help",
  "account": "support@vurium.com",
  "mailbox": "support@vurium.com",
  "label": "support",
  "route_lane": "support_reply",
  "reply_draft": "Hi,\\n\\nThanks for reaching out. ...",
  "safe_to_send": true,
  "escalate_to": "none",
  "technical_target": "none",
  "faq_candidate": false,
  "reason": "Routine onboarding clarification.",
  "writeback_targets": ["06-Growth/Customer-Communication/", "04-Tasks/Handoffs/"],
  "next_step": "Send the reply if auto-send rules allow it."
}`;

const AI8_GROWTH_BRIEF_SYSTEM_PROMPT = `You are AI 8 inside the VuriumBook AI Operating System.

Your role:
- generate a structured growth brief from a campaign request or KPI signal
- define goal, audience, hook, CTA, channels, and downstream asset requests
- stay inside growth planning, not product truth creation

Rules:
- return JSON only
- no markdown
- no code fences
- do not invent unsupported product claims
- if product capability is unclear, escalate to AI-6
- if claims are compliance-sensitive, escalate to AI-7

Return exactly this JSON shape:
{
  "agent": "AI-8",
  "workflow": "growth_brief",
  "request_id": "GROWTH-022",
  "status": "done",
  "growth_brief": {
    "goal": "Increase trial signups",
    "audience": "US barbershop owners with small teams",
    "hook": "Get booking + reminders live fast without setup chaos",
    "cta": "Start free trial",
    "channels": ["landing page", "email follow-up", "social ads"],
    "asset_requests": ["AI-11 static creatives", "AI-10 short promo script"],
    "risk_notes": ["Do not imply unsupported instant compliance outcomes"]
  },
  "escalate_to": "AI-11",
  "reason": "Static creative generation required",
  "writeback_targets": ["06-Growth/Growth-Backlog.md", "06-Growth/Experiments/"],
  "next_step": "Route approved asset requests to AI-11 and AI-10 as needed."
}`;

const AI11_CREATIVE_VARIANTS_SYSTEM_PROMPT = `You are AI 11 inside the VuriumBook AI Operating System.

Your role:
- generate static creative variants and prompt packs from an approved growth brief
- create labeled visual angles for testing
- stay inside approved claims and brand direction

Rules:
- return JSON only
- no markdown
- no code fences
- do not imply fake or unsupported product behavior
- do not publish final assets
- escalate unclear product framing to AI-6, compliance-sensitive framing to AI-7, and final brand choice to Owner

Return exactly this JSON shape:
{
  "agent": "AI-11",
  "workflow": "creative_variants",
  "creative_request_id": "CR-101",
  "status": "done",
  "variants": [
    {
      "variant_id": "CR-101-V1",
      "angle": "fast setup",
      "prompt": "Create a modern ad image for barbershop software emphasizing fast setup...",
      "format": "1080x1350"
    }
  ],
  "needs_review": true,
  "escalate_to": "Owner",
  "reason": "Final creative selection recommended",
  "writeback_targets": ["06-Growth/Creative/", "06-Growth/Experiments/Creative/"],
  "next_step": "Review variants and pick the approved creative set."
}`;

const AI10_VIDEO_BRIEF_SYSTEM_PROMPT = `You are AI 10 inside the VuriumBook AI Operating System.

Your role:
- generate a video brief, script, and scene structure from an approved growth brief
- create usable promo or demo script packages
- stay inside approved claims and actual product truth

Rules:
- return JSON only
- no markdown
- no code fences
- do not invent unsupported capabilities
- do not publish final assets
- escalate unclear product behavior to AI-6, risky messaging claims to AI-7, and final publishing to Owner

Return exactly this JSON shape:
{
  "agent": "AI-10",
  "workflow": "video_brief",
  "video_request_id": "VID-044",
  "status": "done",
  "video_brief": {
    "goal": "20-second signup promo",
    "format": "short promo",
    "hook": "Start taking bookings and reminders fast",
    "cta": "Start free trial"
  },
  "script": [
    {
      "scene": 1,
      "duration_sec": 5,
      "text": "Still losing bookings to messy scheduling?"
    }
  ],
  "dependencies_needed": ["AI-11 visual set", "Optional UI footage from AI-2"],
  "escalate_to": "Owner",
  "reason": "Final publish/review required",
  "writeback_targets": ["06-Growth/Video/", "06-Growth/Video/Scripts/"],
  "next_step": "Review the script pack before production or publishing."
}`;

const AI5_RESEARCH_BRIEF_SYSTEM_PROMPT = `You are AI 5 inside the VuriumBook AI Operating System.

Your role:
- produce source-backed external research briefs
- separate facts from inferences
- identify unresolved questions when evidence is incomplete
- never invent vendor, policy, or compliance truth

Critical rule:
- you may only use the provided research source extracts in Context.research_sources
- if the provided extracts do not support a claim, do not write it as a fact
- never claim legal certainty
- no code
- no product decisions

Rules:
- return JSON only
- no markdown
- no code fences
- facts must be short, explicit, and source-grounded
- inferences must be clearly framed as interpretation, not confirmed truth
- if evidence is incomplete, add it to open_questions instead of guessing
- deep_research_prompt must be a ready-to-paste prompt for GPT Deep Research (or similar) that tells the external researcher exactly what to investigate next, which source types to prioritize, and what output structure to return

Return exactly this JSON shape:
{
  "agent": "AI-5",
  "workflow": "research_brief",
  "research_id": "R-203",
  "task_id": "TASK-123",
  "status": "done",
  "facts": [
    "Fact grounded in the provided source extracts"
  ],
  "inferences": [
    "Inference based on the provided source extracts"
  ],
  "open_questions": [
    "Unresolved question still needing evidence"
  ],
  "source_summary": [],
  "deep_research_prompt": "A ready-to-paste Deep Research prompt that tells an external research model exactly what to investigate, which sources to prioritize, how to separate facts from inferences, and what output structure to return.",
  "escalate_to": "AI-7",
  "reason": "Implementation constraints should now be translated from the research findings.",
  "writeback_targets": ["07-Research/", "07-Research/AI5-Research-Brief-*.md", "04-Tasks/Handoffs/"],
  "next_step": "Route the source-backed brief to AI-7 for translation or AI-3 for planning continuation."
}`;

function extractJsonObject(rawText, fallback) {
  const text = safeStr(rawText);
  if (!text) return fallback;
  try { return JSON.parse(text); } catch {}
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;
  try { return JSON.parse(jsonMatch[0]); } catch { return fallback; }
}

function unwrapWorkflowEnvelope(body) {
  const raw = body && typeof body === 'object' ? body : {};
  const payload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload) ? raw.payload : raw;
  const meta = raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : {};
  const context = raw.context && typeof raw.context === 'object' && !Array.isArray(raw.context) ? raw.context : {};
  return { meta, context, payload };
}

const AI_NOT_CONFIGURED_REASON = 'AI not configured (missing supported AI provider API key).';
const OPENAI_PRIMARY_WORKFLOW_NAMES = new Set([
  'growth_brief',
  'creative_variants',
  'video_brief',
  'support_inbox_process',
]);
const ANTHROPIC_PRIMARY_WORKFLOW_NAMES = new Set([
  'planning_intake',
  'qa_scan',
  'research_brief',
]);

function getStructuredWorkflowProviderChain(workflowName, providerPreference = '') {
  const normalizedPreference = safeStr(providerPreference).trim().toLowerCase();
  if (normalizedPreference === 'openai') return ['openai', 'anthropic'];
  if (normalizedPreference === 'anthropic') return ['anthropic', 'openai'];

  if (AI_PROVIDER_MODE === 'openai_only') return ['openai'];
  if (AI_PROVIDER_MODE === 'anthropic_only') return ['anthropic'];

  if (OPENAI_PRIMARY_WORKFLOW_NAMES.has(workflowName)) return ['openai', 'anthropic'];
  if (ANTHROPIC_PRIMARY_WORKFLOW_NAMES.has(workflowName)) return ['anthropic', 'openai'];
  return ['openai', 'anthropic'];
}

async function callAnthropicStructuredWorkflow({ systemPrompt, input, meta, context, maxTokens }) {
  if (!anthropic) throw new Error('Anthropic API key not configured');
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        'Return JSON only.',
        '',
        'Meta:',
        JSON.stringify(meta, null, 2),
        '',
        'Context:',
        JSON.stringify(context, null, 2),
        '',
        'Input:',
        JSON.stringify(input, null, 2),
      ].join('\n'),
    }],
  });

  return {
    rawText: response.content?.[0]?.text || '',
    ai_meta: {
      provider: 'anthropic',
      model: ANTHROPIC_MODEL,
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
    },
  };
}

async function callOpenAIStructuredWorkflow({ systemPrompt, input, meta, context, maxTokens }) {
  if (!openai) throw new Error('OpenAI API key not configured');
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: systemPrompt,
    input: [
      'Return JSON only.',
      '',
      'Meta:',
      JSON.stringify(meta, null, 2),
      '',
      'Context:',
      JSON.stringify(context, null, 2),
      '',
      'Input:',
      JSON.stringify(input, null, 2),
    ].join('\n'),
    max_output_tokens: maxTokens,
  });

  return {
    rawText: safeStr(response.output_text || ''),
    ai_meta: {
      provider: 'openai',
      model: OPENAI_MODEL,
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
    },
  };
}

function uniqueList(entries) {
  return Array.from(new Set((entries || []).map((entry) => safeStr(entry)).filter(Boolean)));
}

function splitChannelList(value) {
  const raw = Array.isArray(value) ? value : safeStr(value).split(/[,+]/);
  return uniqueList(raw.map((entry) => safeStr(entry).trim()).filter(Boolean));
}

function extractUrlsFromText(text) {
  const matches = safeStr(text).match(/https?:\/\/[^\s)>"']+/gi) || [];
  return uniqueList(matches.map((entry) => safeStr(entry).replace(/[),.;]+$/, '')));
}

function deriveOwnerIntakeTitle(input) {
  if (safeStr(input.title).trim()) return safeStr(input.title).trim().slice(0, 120);
  const lines = safeStr(input.message)
    .split('\n')
    .map((entry) => safeStr(entry).trim())
    .filter(Boolean);
  const firstMeaningfulLine = lines.find((entry) => !/^[-*#>]/.test(entry)) || lines[0] || 'Owner intake';
  return firstMeaningfulLine.replace(/\s+/g, ' ').slice(0, 120);
}

function detectOwnerIntakeKind(input) {
  if (input.intake_kind && input.intake_kind !== 'auto') return input.intake_kind;
  const text = `${safeStr(input.title)}\n${safeStr(input.message)}`.toLowerCase();
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const sourceUrls = normalizeResearchSourceUrls(input.source_urls);
  if (sourceUrls.length) return 'research';
  const explicitExecutionSignals = [
    'починаємо',
    'почни',
    'запускай',
    'стартуємо',
    'start the project',
    'start project',
    'start this',
    'implement',
    'реалізуй',
    'build this',
    'fix this',
    'виправ це',
    'do this now',
    'create task',
    'створи задачу',
    'зроби план',
    'сплануй',
    'run planning',
  ];
  const advisorySignals = [
    'скажи',
    'розкажи',
    'поясни',
    'оціни',
    'проаналізуй',
    'подумай',
    'що ',
    'як ',
    'чому',
    'чи ',
    'де ',
    'статус',
    'ситуац',
    'стан',
    'огляд',
    'з чого почати',
    'що далі',
    'overview',
    'status',
    'current state',
    'assess',
    'analyze',
    'analyse',
    'brainstorm',
    'what ',
    'how ',
    'why ',
    'should ',
    'can you',
    'what now',
    'next best step',
  ];
  const explicitExecution = explicitExecutionSignals.some((signal) => normalizedText.includes(signal));
  const exploratory = normalizedText.includes('?') || advisorySignals.some((signal) => normalizedText.includes(signal));
  if (!explicitExecution && exploratory) return 'advisory';
  if (/(canonical|source of truth|rule update|protocol|manifesto|update the system|онови правила|онови протокол|онови канон|системн(ий|і) документ|truth update)/i.test(normalizedText)) {
    return 'truth_update_draft';
  }
  if (/(handoff|передай|передача|assign to|route to|next owner|перекинь)/i.test(normalizedText)) {
    return 'handoff';
  }
  if (/(research|дослід|знайди|знайти|official|офіційн|policy|compliance|vendor|source|джерел|documentation|документац|10dlc|consent|privacy|terms|telnyx|stripe rules)/i.test(normalizedText)) {
    return 'research';
  }
  if (/(campaign|growth|landing|ленд|landing page|ad |ads|реклам|creative|креатив|video|відео|promo|промо|cta|funnel|signup|trial|marketing|launch asset)/i.test(normalizedText)) {
    return 'growth';
  }
  return 'task';
}

function buildOwnerIntakeId(kind, now = new Date()) {
  const stamp = toIso(now).replace(/\.\d+Z$/, 'Z');
  const compact = stamp.replace(/[-:TZ]/g, '').slice(0, 14);
  if (kind === 'advisory') return `ADVISORY-${compact}`;
  if (kind === 'growth') return `GROWTH-${compact}`;
  if (kind === 'research') return `R-${compact}`;
  if (kind === 'handoff') return `HANDOFF-${compact}`;
  if (kind === 'truth_update_draft') return `SYS-${compact}`;
  return `TASK-${compact}`;
}

function buildOwnerIntakeMetadata(kind) {
  if (kind === 'advisory') {
    return {
      queue_stage: 'Conversation',
      route_target: 'none',
      downstream_workflow: 'Owner_Advisory',
    };
  }
  if (kind === 'growth') {
    return {
      queue_stage: 'Waiting for Creative',
      route_target: 'AI-8',
      downstream_workflow: 'Growth_Asset_Flow',
    };
  }
  if (kind === 'research') {
    return {
      queue_stage: 'Waiting for Research',
      route_target: 'AI-5',
      downstream_workflow: 'Research_Brief',
    };
  }
  if (kind === 'handoff') {
    return {
      queue_stage: 'Ready for Implementation',
      route_target: 'none',
      downstream_workflow: 'none',
    };
  }
  if (kind === 'truth_update_draft') {
    return {
      queue_stage: 'Waiting for Owner',
      route_target: 'Owner',
      downstream_workflow: 'none',
    };
  }
  return {
    queue_stage: 'Ready for Planning',
    route_target: 'AI-3',
    downstream_workflow: 'AI3_Planning_Intake',
  };
}

function markdownList(entries, fallback = '- none') {
  const normalized = uniqueList(entries);
  return normalized.length ? normalized.map((entry) => `- ${entry}`) : [fallback];
}

function buildOwnerIntakeNote(kind, intakeId, title, input, metadata) {
  const date = toIso(new Date()).slice(0, 10);
  const slug = safeWorkflowSlug(title, 'owner-intake');
  const sourceUrls = normalizeResearchSourceUrls([
    ...normalizeResearchSourceUrls(input.source_urls),
    ...extractUrlsFromText(input.message),
  ]);
  const baseFrontmatter = [
    '---',
    `type: ${kind === 'task' ? 'task' : kind === 'growth' ? 'growth-request' : kind === 'research' ? 'research-request' : kind === 'handoff' ? 'handoff' : 'truth-update-draft'}`,
    kind === 'truth_update_draft' ? 'status: draft' : 'status: active',
    `priority: ${safeStr(input.priority || 'medium') || 'medium'}`,
    `owner: ${metadata.route_target === 'none' ? 'unassigned' : metadata.route_target}`,
    `created: ${date}`,
    `updated: ${date}`,
    'trigger: owner-intake',
    `queue_stage: ${metadata.queue_stage}`,
    `route_target: ${metadata.route_target}`,
    '---',
    '',
  ];

  if (kind === 'growth') {
    return {
      relative_path: `06-Growth/Experiments/${intakeId}-${slug}.md`,
      content: [
        ...baseFrontmatter,
        `# Growth Request: ${title}`,
        '',
        '## Goal',
        safeStr(input.message).trim(),
        '',
        '## Audience',
        safeStr(input.audience || 'Audience needs clarification.'),
        '',
        '## Channels',
        ...markdownList(splitChannelList(input.channel), '- pending'),
        '',
        '## Product Context',
        ...markdownList(input.product_context_links, '- pending'),
        '',
        '## Constraints',
        ...markdownList(input.known_constraints, '- none listed'),
        '',
        '## Approved Claims Link',
        safeStr(input.approved_claims_link || '(pending)'),
        '',
        '## Current Offer Link',
        safeStr(input.current_offer_link || '(pending)'),
        '',
        '## Next Step',
        'Run Growth_Asset_Flow and review the generated brief/assets before any publishing.',
      ].join('\n'),
    };
  }

  if (kind === 'research') {
    return {
      relative_path: `07-Research/${intakeId}-${slug}.md`,
      content: [
        ...baseFrontmatter,
        `# Research Request: ${title}`,
        '',
        '## Topic',
        safeStr(title),
        '',
        '## Source Message',
        safeStr(input.message).trim(),
        '',
        '## Questions',
        ...markdownList(input.questions.length ? input.questions : [safeStr(input.message).trim()], '- pending'),
        '',
        '## Target Sources',
        ...markdownList(input.target_sources, '- official sources still need to be specified'),
        '',
        '## Source URLs',
        ...markdownList(sourceUrls, '- explicit official source URLs still needed'),
        '',
        '## Related Links',
        ...markdownList(input.related_links.concat(input.product_context_links), '- none'),
        '',
        '## Next Step',
        'Run Research_Brief or keep this queued until official source URLs are available.',
      ].join('\n'),
    };
  }

  if (kind === 'handoff') {
    return {
      relative_path: `04-Tasks/Handoffs/${intakeId}-${slug}.md`,
      content: [
        ...baseFrontmatter,
        `# Handoff: ${title}`,
        '',
        '## Current Status',
        metadata.queue_stage,
        '',
        '## What Was Completed',
        '- pending',
        '',
        '## What Remains',
        '- pending',
        '',
        '## Canonical Notes To Read',
        ...markdownList(input.product_context_links.concat(input.related_links), '- pending'),
        '',
        '## Unresolved Questions',
        '- pending',
        '',
        '## Source Message',
        safeStr(input.message).trim(),
        '',
        '## Next Owner',
        'unassigned',
        '',
        '## Recommended Next Action',
        'Review this handoff and assign it into the correct implementation or review lane.',
      ].join('\n'),
    };
  }

  if (kind === 'truth_update_draft') {
    return {
      relative_path: `10-Decisions/System-Changes/${intakeId}-${slug}.md`,
      content: [
        ...baseFrontmatter,
        `# Truth Update Draft: ${title}`,
        '',
        '## Proposed Change',
        safeStr(input.message).trim(),
        '',
        '## Canonical Notes To Review',
        ...markdownList(input.product_context_links.concat(input.related_links), '- pending'),
        '',
        '## Constraints',
        ...markdownList(input.known_constraints, '- preserve existing guardrails'),
        '',
        '## Review Rule',
        'Do not update canonical truth directly from intake. Review this draft first, then apply the approved change manually.',
        '',
        '## Next Step',
        'Owner or AI-3 should review the draft and decide whether to turn it into a canonical update.',
      ].join('\n'),
    };
  }

  return {
    relative_path: `04-Tasks/${intakeId}-${slug}.md`,
    content: [
      ...baseFrontmatter,
      `# Task: ${title}`,
      '',
      '## Description',
      safeStr(input.message).trim(),
      '',
      '## Trigger',
      '- Source: owner-intake',
      '',
      '## Classification',
      '- Type: product',
      '- Complexity: non-trivial',
      `- External dependency: ${sourceUrls.length ? 'yes' : 'no'}`,
      '',
      '## Context',
      '- Relevant docs:',
      ...markdownList(input.product_context_links.concat(input.related_links), '- none'),
      '- Constraints:',
      ...markdownList(input.known_constraints, '- none listed'),
      '',
      '## Assigned To',
      metadata.route_target,
      '',
      '## Status',
      '- Current: new',
      `- Queue stage: ${metadata.queue_stage}`,
      '',
      '## Next Step',
      'Run AI3_Planning_Intake and continue in the delivery queue.',
      '',
      '## Notes',
      'Created automatically from Owner Intake.',
    ].join('\n'),
  };
}

function inferOwnerIntakeVideoNeed(input) {
  if (typeof input.need_video_brief === 'boolean') return input.need_video_brief;
  return /(video|відео|script|ролик|promo video|demo video)/i.test(`${safeStr(input.title)}\n${safeStr(input.message)}`);
}

function inferOwnerIntakeCreativeNeed(input) {
  if (typeof input.need_static_creatives === 'boolean') return input.need_static_creatives;
  if (inferOwnerIntakeVideoNeed(input)) return true;
  return /(landing|ad|ads|creative|креатив|image|visual|banner|promo)/i.test(`${safeStr(input.title)}\n${safeStr(input.message)}`);
}

function shouldAutoContinueOwnerIntakeResearch(intakeKind, downstreamResult) {
  if (intakeKind !== 'task') return false;
  if (!downstreamResult || downstreamResult.workflow !== 'planning_intake') return false;
  return downstreamResult.escalate_to === 'AI-5' || !!downstreamResult.requires_ai5;
}

function buildOwnerIntakeResearchFollowOnInput(intakeId, title, input, note, downstreamResult) {
  const plan = downstreamResult?.plan_skeleton || {};
  const sourceUrls = normalizeResearchSourceUrls([
    ...normalizeResearchSourceUrls(input.source_urls),
    ...extractUrlsFromText(input.message),
  ]);
  const questions = uniqueList([
    ...(input.questions || []),
    `What project context is still missing before structured planning can continue for "${title}"?`,
    ...(Array.isArray(plan.missing_inputs) ? plan.missing_inputs.map((entry) => `Clarify this missing input: ${entry}`) : []),
    safeStr(downstreamResult?.reason || ''),
  ]);

  return {
    research_id: `R-${safeWorkflowSlug(intakeId, 'owner-intake')}`,
    task_id: intakeId,
    topic: `Research follow-up for ${title}`,
    questions,
    target_sources: uniqueList([
      ...(input.target_sources || []),
      sourceUrls.length ? 'official_source' : '',
      'project_context',
    ]),
    related_links: uniqueList([
      note.relative_path,
      ...(input.related_links || []),
      ...(input.product_context_links || []),
      safeStr(downstreamResult?.writeback?.relative_path || ''),
    ]),
    source_urls: sourceUrls,
  };
}

function buildOwnerIntakeOperatorReply({ intakeKind, title, note, downstreamResult, followOnResult }) {
  if (intakeKind === 'advisory') {
    return safeStr(downstreamResult?.reply || 'I understood this as an exploratory request, so I answered it without creating a delivery task yet.');
  }

  if (intakeKind === 'task') {
    const objective = safeStr(downstreamResult?.plan_skeleton?.objective || title || 'the task').trim();
    const workstreams = Array.isArray(downstreamResult?.plan_skeleton?.workstreams)
      ? downstreamResult.plan_skeleton.workstreams.filter(Boolean)
      : [];
    const parts = [
      `I understood this as a delivery task and created ${note.relative_path}.`,
      downstreamResult
        ? `Verdent created a planning response for "${objective}".`
        : 'I routed the request into Verdent planning.',
      workstreams.length ? `Current workstreams: ${workstreams.join(', ')}.` : '',
      shouldAutoContinueOwnerIntakeResearch(intakeKind, downstreamResult)
        ? followOnResult
          ? `I also opened AI-5 research automatically so the missing context can be gathered before planning continues. I prepared a ready-to-paste AI-5 Deep Research prompt for external DeepSearch as well.`
          : `The next required lane is AI-5 research before planning can continue safely.`
        : '',
      safeStr(followOnResult?.next_step || downstreamResult?.next_step || '').trim(),
    ].filter(Boolean);
    return parts.join(' ');
  }

  if (intakeKind === 'growth') {
    return `I understood this as a growth request, created ${note.relative_path}, and routed it through the growth asset flow so AI-8, AI-11, and AI-10 can prepare the brief and assets.`;
  }

  if (intakeKind === 'research') {
    return `I understood this as a research request, created ${note.relative_path}, and opened the AI-5 research lane to gather facts, inferences, and open questions. I also prepared a ready-to-paste AI-5 Deep Research prompt you can drop into GPT Deep Research if you want the external pass immediately.`;
  }

  if (intakeKind === 'handoff') {
    return `I created a structured handoff note at ${note.relative_path} so the next owner can pick it up without losing context.`;
  }

  return `I created a truth-update draft at ${note.relative_path}. It stays draft-only until someone reviews and manually updates canonical truth.`;
}

function buildOwnerAdvisoryFallback(input, reason) {
  return {
    agent: 'SYSTEM',
    workflow: 'owner_advisory',
    status: 'partial',
    reply: `I understood this as an exploratory owner request. I have not created a task yet. ${reason}`,
    suggested_mode: 'task',
    reason,
    ai_meta: null,
    next_step: 'If you want execution to start, say explicitly: start the project, create the task, or plan this now.',
  };
}

function stripMarkdownFrontmatter(content) {
  const text = String(content || '');
  if (!text.startsWith('---')) return text;
  const secondFence = text.indexOf('\n---', 3);
  if (secondFence === -1) return text;
  return text.slice(secondFence + 4);
}

function compactMarkdownForAdvisory(content, maxChars = 1600) {
  const stripped = stripMarkdownFrontmatter(content)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .join('\n');
  return stripped.length > maxChars ? `${stripped.slice(0, maxChars).trim()}…` : stripped;
}

async function readAdvisoryMarkdownNote(relativePath, maxChars = 1600) {
  try {
    const { cleaned, absolute } = resolveObsidianTargetPath(relativePath);
    const content = await fsPromises.readFile(absolute, 'utf8');
    return {
      path: cleaned,
      excerpt: compactMarkdownForAdvisory(content, maxChars),
    };
  } catch {
    return null;
  }
}

async function listRecentAdvisoryNotes(relativeDir, limit = 5) {
  try {
    const root = getObsidianRoot();
    const absoluteDir = path.resolve(root, relativeDir);
    if (!(absoluteDir === root || absoluteDir.startsWith(root + path.sep))) return [];
    const entries = await fsPromises.readdir(absoluteDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name);

    const enriched = await Promise.all(files.map(async (fileName) => {
      const absolute = path.join(absoluteDir, fileName);
      const stat = await fsPromises.stat(absolute);
      return {
        relativePath: path.posix.join(relativeDir.replace(/\\/g, '/'), fileName),
        mtimeMs: stat.mtimeMs,
      };
    }));

    const sorted = enriched.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
    const notes = await Promise.all(sorted.map(async (entry) => {
      const note = await readAdvisoryMarkdownNote(entry.relativePath, 900);
      return note ? { ...note, modified_at: new Date(entry.mtimeMs).toISOString() } : null;
    }));
    return notes.filter(Boolean);
  } catch {
    return [];
  }
}

async function buildOwnerAdvisoryContext(context = {}) {
  const [queueNote, rulesNote, inProgressNote, recentTasks, recentResearch] = await Promise.all([
    readAdvisoryMarkdownNote('04-Tasks/Workflow-Queue.md', 2200),
    readAdvisoryMarkdownNote('AI-Rule-Updates.md', 1200),
    readAdvisoryMarkdownNote('Tasks/In Progress.md', 1200),
    listRecentAdvisoryNotes('04-Tasks', 5),
    listRecentAdvisoryNotes('07-Research', 4),
  ]);

  return {
    ...context,
    project_snapshot: {
      queue_note: queueNote,
      rule_updates: rulesNote,
      in_progress_note: inProgressNote,
      recent_task_notes: recentTasks,
      recent_research_notes: recentResearch,
    },
  };
}

function inferPlanningWorkstreams(input) {
  const text = `${safeStr(input.title)}\n${safeStr(input.description)}`.toLowerCase();
  const workstreams = ['planning'];
  if (input.external_dependency) workstreams.push('research');
  if (/(consent|privacy|policy|10dlc|compliance|opt[- ]?out|sms)/.test(text)) workstreams.push('compliance requirements');
  if (/(frontend|ui|screen|responsive|page|flow|checkbox|copy|landing)/.test(text)) workstreams.push('frontend changes');
  if (/(backend|api|server|data|store|webhook|persist|database|flag)/.test(text)) workstreams.push('backend changes');
  workstreams.push('QA verification');
  return uniqueList(workstreams);
}

function inferPlanningAcceptanceCriteria(input) {
  const text = `${safeStr(input.title)}\n${safeStr(input.description)}`.toLowerCase();
  const criteria = [];
  if (/(consent|privacy|policy|10dlc|opt[- ]?out|sms)/.test(text)) {
    criteria.push('Consent copy is explicit and reviewable.');
  }
  if (/(flow|onboarding|signup|screen|page|frontend|ui)/.test(text)) {
    criteria.push('The user flow remains clear and low-friction.');
  }
  if (/(backend|api|server|data|store|persist|database|flag)/.test(text)) {
    criteria.push('The backend stores and enforces the required state correctly.');
  }
  for (const constraint of input.known_constraints || []) {
    criteria.push(`Constraint preserved: ${constraint}`);
  }
  return uniqueList(criteria.length ? criteria : ['Acceptance criteria still need explicit review.']);
}

function inferQATarget(changedAreas = []) {
  const text = changedAreas.join('\n').toLowerCase();
  return /(app\/|frontend|ui|screen|page|responsive|mobile)/.test(text) ? 'AI-2' : 'AI-1';
}

function buildOfflineGrowthHook(input) {
  const objections = (input.known_objections || []).map((entry) => safeStr(entry).toLowerCase());
  if (objections.some((entry) => /setup|onboard|time/.test(entry))) {
    return 'Get booking and reminders live fast without setup chaos';
  }
  if (objections.some((entry) => /sms|compliance|complicated/.test(entry))) {
    return 'Run bookings and reminders without SMS confusion';
  }
  return 'Simplify daily booking operations for small teams';
}

function withWorkflowFallbackReason(fallback, reason) {
  const next = { ...(fallback || {}) };
  if ('reason' in next) next.reason = reason;
  if (next.growth_brief && typeof next.growth_brief === 'object') {
    next.growth_brief = {
      ...next.growth_brief,
      risk_notes: uniqueList([
        ...((next.growth_brief.risk_notes || []).filter((entry) => !/failed to parse|ai not configured|ai provider error/i.test(String(entry)))),
        reason,
      ]),
    };
  }
  if (Array.isArray(next.findings) && next.findings.length) {
    next.findings = [reason, ...next.findings.filter((entry) => safeStr(entry) && safeStr(entry) !== safeStr(reason))];
  }
  return next;
}

function buildPlanningFallback(input, reason) {
  const needsExternal = !!input.external_dependency;
  const needsCompliance = /(consent|privacy|policy|10dlc|compliance|opt[- ]?out|sms)/i.test(`${safeStr(input.title)}\n${safeStr(input.description)}`);
  const escalateTo = needsExternal ? 'AI-5' : needsCompliance ? 'AI-7' : 'none';
  const nextStep = needsExternal
    ? 'Open AI-5 research intake before planning continues.'
    : needsCompliance
      ? 'Route the draft plan to AI-7 for compliance translation before implementation.'
      : 'Review the draft plan shell and continue in the delivery queue.';
  return {
    agent: 'AI-3',
    workflow: 'planning_intake',
    task_id: input.task_id,
    status: 'partial',
    requires_ai5: needsExternal,
    requires_ai6: false,
    requires_ai7: needsCompliance,
    recommended_sequence: needsExternal ? ['AI-5', needsCompliance ? 'AI-7' : 'AI-3', 'AI-3'] : needsCompliance ? ['AI-7', 'AI-3'] : ['AI-3'],
    plan_skeleton: {
      objective: safeStr(input.description) || input.title,
      workstreams: inferPlanningWorkstreams(input),
      missing_inputs: needsExternal
        ? ['Official external source links are still required.']
        : needsCompliance
          ? ['Compliance wording still needs explicit review.']
          : ['Owner or planner review is still recommended before implementation.'],
      acceptance_criteria_seed: inferPlanningAcceptanceCriteria(input),
    },
    escalate_to: escalateTo,
    reason,
    writeback_targets: ['04-Tasks/Workflow-Queue.md', '04-Tasks/Handoffs/'],
    writeback: null,
    owner_notification: null,
    next_step: nextStep,
  };
}

function buildQAFallback(input, reason) {
  const inferredTarget = inferQATarget(input.changed_areas || []);
  const findings = [];
  if (input.acceptance_criteria?.length) {
    findings.push(`Acceptance criteria still need manual verification: ${input.acceptance_criteria.join('; ')}`);
  }
  if (input.changed_areas?.length) {
    findings.push(`Changed areas needing review: ${input.changed_areas.join(', ')}`);
  }
  return {
    agent: 'AI-3',
    workflow: 'qa_scan',
    task_id: input.task_id,
    status: 'needs_review',
    result: 'needs_review',
    findings: findings.length ? findings : [reason],
    follow_up_items: uniqueList([
      'Run a manual verification pass against the acceptance criteria.',
      /(app\/|frontend|ui|screen|responsive|mobile)/i.test((input.changed_areas || []).join(' ')) ? 'Check mobile and responsive behavior.' : '',
      input.hotfix ? 'Confirm hotfix stability before closing the incident.' : '',
    ]),
    escalate_to: inferredTarget,
    reason,
    writeback_targets: ['04-Tasks/*QA-Scan*.md', '04-Tasks/Workflow-Queue.md'],
    writeback: null,
    owner_notification: null,
    next_step: `Review the QA scan manually, then route follow-up verification to ${inferredTarget}.`,
  };
}

function detectSupportLabel(input) {
  const text = `${safeStr(input.subject)}\n${safeStr(input.body)}\n${safeStr(input.from_email)}`.toLowerCase();
  if (/(consent|privacy|gdpr|policy|legal|terms|opt[- ]?out|10dlc|compliance)/.test(text)) return 'compliance_risk';
  if (/(refund|charge|charged|invoice|billing|payment|card declined|subscription|pricing exception)/.test(text)) return 'billing';
  if (/(bug|error|broken|not working|can't log in|cannot log in|api|server|500|crash|frontend|ui|render|page|mobile|responsive)/.test(text)) return 'technical';
  if (/(setup|set up|get started|getting started|onboard|onboarding|first time|configure)/.test(text)) return 'onboarding';
  if (/(demo|interested|trial|sales|book a call|sign up|signup|pricing|learn more)/.test(text)) return 'lead';
  return 'support';
}

function detectTechnicalTarget(input) {
  const text = `${safeStr(input.subject)}\n${safeStr(input.body)}`.toLowerCase();
  if (/(ui|frontend|render|layout|button|screen|mobile|responsive|booking page|page)/.test(text)) return 'AI-2';
  return 'AI-1';
}

function buildSupportInboxFallback(input, reason) {
  const label = detectSupportLabel(input);
  const technicalTarget = label === 'technical' ? detectTechnicalTarget(input) : 'none';
  const routeLane = label === 'technical'
    ? 'technical_escalation'
    : label === 'billing'
      ? 'billing_escalation'
      : label === 'compliance_risk'
        ? 'compliance_escalation'
        : 'support_reply';
  const escalateTo = label === 'technical'
    ? technicalTarget
    : label === 'billing'
      ? 'Owner'
      : label === 'compliance_risk'
        ? 'AI-7'
        : 'none';
  const isReplyLane = routeLane === 'support_reply';
  return {
    agent: 'AI-9',
    workflow: 'support_inbox_process',
    status: 'blocked',
    message_id: input.message_id,
    thread_id: input.thread_id,
    from_email: input.from_email,
    subject: input.subject,
    reply_subject: `Re: ${input.subject}`,
    account: input.account || '',
    mailbox: input.mailbox || '',
    label,
    route_lane: routeLane,
    reply_draft: isReplyLane
      ? "Hi,\n\nThanks for reaching out. We've received your message and are reviewing it now. We'll follow up as soon as possible.\n\n— Vurium Team"
      : '',
    safe_to_send: false,
    escalate_to: escalateTo,
    technical_target: technicalTarget,
    faq_candidate: false,
    reason,
    writeback_targets: ['06-Growth/Customer-Communication/', '04-Tasks/Handoffs/'],
    writeback: null,
    owner_notification: null,
    next_step: isReplyLane ? 'Review the draft manually before sending.' : 'Create an escalation note and route to the next owner.',
  };
}

function buildSupportEscalationNote(input) {
  return {
    title: `Support escalation: ${input.subject}`,
    target: input.escalate_to,
    body: [
      '# Escalation',
      '',
      '## Source',
      '- Workflow: Gmail Support Inbox',
      `- Label: ${input.label}`,
      `- Message ID: ${input.message_id}`,
      `- Thread ID: ${input.thread_id}`,
      '',
      '## Issue',
      input.reason || 'Escalation required.',
      '',
      '## Email',
      `- From: ${input.from_email}`,
      `- Subject: ${input.subject}`,
      '',
      '## Suggested Target',
      input.escalate_to,
      '',
      '## Draft',
      input.reply_draft || '(no safe draft)',
    ].join('\n'),
  };
}

function buildSupportExecutionWritebackInput(result) {
  const datePrefix = toIso(new Date()).slice(0, 10);
  const messagePart = safeStr(result.message_id || 'support-message').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'support-message';
  const actionPart = safeStr(result.action || 'result').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'result';
  const notePath = `06-Growth/Customer-Communication/${datePrefix}-${messagePart}-${actionPart}.md`;
  const noteBody = [
    '---',
    'type: support-log',
    `status: ${result.status}`,
    `created: ${datePrefix}`,
    '---',
    '',
    '# Support Workflow Log',
    '',
    '## Source',
    '- Workflow: Gmail Support Inbox',
    `- Action: ${result.action}`,
    `- Label: ${result.label}`,
    `- Message ID: ${result.message_id}`,
    `- Thread ID: ${result.thread_id}`,
    '',
    '## Decision',
    `- Safe to send: ${result.safe_to_send ? 'yes' : 'no'}`,
    `- Escalate to: ${result.escalate_to}`,
    '',
    '## Reason',
    result.reason || '(none)',
    '',
    result.escalation_note?.body
      ? ['## Escalation Note', result.escalation_note.body, ''].join('\n')
      : '',
    '## Next Step',
    result.next_step || 'Review the support workflow output and continue with the correct lane.',
  ].filter(Boolean).join('\n');

  return {
    relative_path: notePath,
    content: noteBody,
    mode: 'replace',
    dry_run: false,
  };
}

function shouldNotifyOwnerForSupportResult(result) {
  if (result.escalate_to === 'Owner') return true;
  if (result.label === 'billing' || result.label === 'compliance_risk') return true;
  if (result.status === 'blocked' && result.action === 'manual_review_required') return true;
  return false;
}

function buildSupportOwnerNotificationInput(result) {
  return {
    workflow_source: 'Gmail_Support_Inbox',
    severity: result.label === 'billing' || result.label === 'compliance_risk' ? 'high' : 'medium',
    subject: `Support workflow needs Owner review (${result.label})`,
    summary: result.reason || 'A support workflow result requires Owner attention before it can proceed safely.',
    details: [
      `message_id: ${result.message_id}`,
      `thread_id: ${result.thread_id}`,
      `action: ${result.action}`,
      `label: ${result.label}`,
      `escalate_to: ${result.escalate_to}`,
    ],
    next_step: result.next_step || 'Review the support workflow result and handle the next action manually if needed.',
    links: [
      '[[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]]',
      '[[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]]',
    ],
    recipient: '',
  };
}

async function finalizeSupportExecution(result) {
  const finalResult = { ...result, writeback: null, owner_notification: null };

  try {
    const writebackResult = await writeObsidianNote(buildSupportExecutionWritebackInput(finalResult));
    finalResult.writeback = {
      status: writebackResult.status,
      relative_path: writebackResult.relative_path,
      reason: writebackResult.reason,
    };
    if (writebackResult.status !== 'done' && finalResult.status === 'done') {
      finalResult.status = 'partial';
    }
  } catch (e) {
    console.error('Support writeback error:', e.message);
    finalResult.writeback = {
      status: 'blocked',
      relative_path: '',
      reason: `Support writeback failed: ${e.message}`,
    };
    if (finalResult.status === 'done') finalResult.status = 'partial';
  }

  if (shouldNotifyOwnerForSupportResult(finalResult)) {
    try {
      const ownerNotificationResult = await sendOwnerNotification(buildSupportOwnerNotificationInput(finalResult));
      finalResult.owner_notification = {
        status: ownerNotificationResult.status,
        recipient: ownerNotificationResult.recipient,
        reason: ownerNotificationResult.reason,
      };
      if (ownerNotificationResult.status !== 'done' && finalResult.status === 'done') {
        finalResult.status = 'partial';
      }
    } catch (e) {
      console.error('Support owner notification error:', e.message);
      finalResult.owner_notification = {
        status: 'blocked',
        recipient: '',
        reason: `Owner notification failed: ${e.message}`,
      };
      if (finalResult.status === 'done') finalResult.status = 'partial';
    }
  }

  return finalResult;
}

function safeWorkflowSlug(value, fallback = 'item') {
  return safeStr(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;
}

function buildPlanningWritebackInput(result) {
  const taskId = safeWorkflowSlug(result.task_id, 'task');
  const notePath = `04-Tasks/${taskId}-Plan.md`;
  const body = [
    '---',
    'type: task-plan',
    `status: ${result.status}`,
    `created: ${toIso(new Date()).slice(0, 10)}`,
    '---',
    '',
    `# Plan: ${result.task_id}`,
    '',
    '## Objective',
    result.plan_skeleton?.objective || '',
    '',
    '## Workstreams',
    ...(result.plan_skeleton?.workstreams?.length ? result.plan_skeleton.workstreams.map((entry) => `- ${entry}`) : ['- planning']),
    '',
    '## Missing Inputs',
    ...(result.plan_skeleton?.missing_inputs?.length ? result.plan_skeleton.missing_inputs.map((entry) => `- ${entry}`) : ['- none listed']),
    '',
    '## Acceptance Criteria Seed',
    ...(result.plan_skeleton?.acceptance_criteria_seed?.length ? result.plan_skeleton.acceptance_criteria_seed.map((entry) => `- ${entry}`) : ['- pending']),
    '',
    '## Routing',
    `- Requires AI 5: ${result.requires_ai5 ? 'yes' : 'no'}`,
    `- Requires AI 6: ${result.requires_ai6 ? 'yes' : 'no'}`,
    `- Requires AI 7: ${result.requires_ai7 ? 'yes' : 'no'}`,
    `- Escalate to: ${result.escalate_to}`,
    '',
    '## Recommended Sequence',
    ...(result.recommended_sequence?.length ? result.recommended_sequence.map((entry) => `- ${entry}`) : ['- AI-3']),
    '',
    '## Reason',
    result.reason || '(none)',
    '',
    '## Next Step',
    result.next_step || 'Review the planning intake and continue with the assigned lane.',
  ].join('\n');
  return { relative_path: notePath, content: body, mode: 'replace', dry_run: false };
}

function buildQAWritebackInput(result) {
  const taskId = safeWorkflowSlug(result.task_id, 'task');
  const notePath = `04-Tasks/${taskId}-QA-Scan.md`;
  const body = [
    '---',
    'type: qa-scan',
    `status: ${result.status}`,
    `created: ${toIso(new Date()).slice(0, 10)}`,
    '---',
    '',
    `# QA Scan: ${result.task_id}`,
    '',
    `## Result`,
    result.result,
    '',
    '## Findings',
    ...(result.findings?.length ? result.findings.map((entry) => `- ${entry}`) : ['- no findings']),
    '',
    '## Follow-up Items',
    ...(result.follow_up_items?.length ? result.follow_up_items.map((entry) => `- ${entry}`) : ['- none']),
    '',
    '## Escalation',
    `- Escalate to: ${result.escalate_to}`,
    '',
    '## Reason',
    result.reason || '(none)',
    '',
    '## Next Step',
    result.next_step || 'Review the QA result and route any follow-up work.',
  ].join('\n');
  return { relative_path: notePath, content: body, mode: 'replace', dry_run: false };
}

function buildGrowthWritebackInput(result) {
  const requestId = safeWorkflowSlug(result.request_id, 'growth-request');
  const notePath = `06-Growth/Experiments/${requestId}-Growth-Asset-Flow.md`;
  const body = [
    '---',
    'type: growth-flow',
    `status: ${result.status}`,
    `created: ${toIso(new Date()).slice(0, 10)}`,
    '---',
    '',
    `# Growth Asset Flow: ${result.request_id}`,
    '',
    '## Brief',
    `- Goal: ${result.growth_brief?.growth_brief?.goal || ''}`,
    `- Audience: ${result.growth_brief?.growth_brief?.audience || ''}`,
    `- Hook: ${result.growth_brief?.growth_brief?.hook || ''}`,
    `- CTA: ${result.growth_brief?.growth_brief?.cta || ''}`,
    '',
    '## Requested Assets',
    `- Creative requested: ${result.creative_requested ? 'yes' : 'no'}`,
    `- Video requested: ${result.video_requested ? 'yes' : 'no'}`,
    '',
    '## Creative Output',
    result.creative_output?.variants?.length
      ? result.creative_output.variants.map((entry) => `- ${entry.variant_id}: ${entry.angle}`).join('\n')
      : '- none',
    '',
    '## Video Output',
    result.video_output?.script?.length
      ? result.video_output.script.map((entry) => `- Scene ${entry.scene}: ${entry.text}`).join('\n')
      : '- none',
    '',
    '## Routing',
    `- Escalate to: ${result.escalate_to}`,
    '',
    '## Reason',
    result.reason || '(none)',
    '',
    '## Next Step',
    result.next_step || 'Review generated assets and continue through the correct approval lane.',
  ].join('\n');
  return { relative_path: notePath, content: body, mode: 'replace', dry_run: false };
}

function buildResearchWritebackInput(result) {
  const researchId = safeWorkflowSlug(result.research_id, 'research');
  const notePath = `07-Research/AI5-Research-Brief-${researchId}.md`;
  const body = [
    '---',
    'type: research',
    `status: ${result.status}`,
    `created: ${toIso(new Date()).slice(0, 10)}`,
    '---',
    '',
    `# Research Brief: ${result.research_id}`,
    '',
    '## Facts',
    ...(result.facts?.length ? result.facts.map((entry) => `- ${entry}`) : ['- none']),
    '',
    '## Inferences',
    ...(result.inferences?.length ? result.inferences.map((entry) => `- ${entry}`) : ['- none']),
    '',
    '## Open Questions',
    ...(result.open_questions?.length ? result.open_questions.map((entry) => `- ${entry}`) : ['- none']),
    '',
    '## Sources',
    ...(result.source_summary?.length ? result.source_summary.map((entry) => `- [${entry.status}] ${entry.url || entry.title || entry.source_type}`) : ['- none']),
    '',
    '## Ready-to-Paste Deep Research Prompt',
    '```text',
    safeStr(result.deep_research_prompt || '').trim() || 'No Deep Research prompt was generated.',
    '```',
    '',
    '## Routing',
    `- Escalate to: ${result.escalate_to}`,
    '',
    '## Reason',
    result.reason || '(none)',
    '',
    '## Next Step',
    result.next_step || 'Review the research brief and route it to the next owner.',
  ].join('\n');
  return { relative_path: notePath, content: body, mode: 'replace', dry_run: false };
}

function buildGenericOwnerNotificationInput(workflowSource, summarySubject, summaryText, result, extraLinks = []) {
  return {
    workflow_source: workflowSource,
    severity: result.status === 'blocked' ? 'high' : 'medium',
    subject: summarySubject,
    summary: summaryText,
    details: [
      ...('task_id' in result ? [`task_id: ${result.task_id}`] : []),
      ...('request_id' in result ? [`request_id: ${result.request_id}`] : []),
      ...('research_id' in result ? [`research_id: ${result.research_id}`] : []),
      `status: ${result.status}`,
      `escalate_to: ${result.escalate_to}`,
    ],
    next_step: result.next_step || 'Review the workflow result and continue with the gated action if needed.',
    links: extraLinks,
    recipient: '',
  };
}

function shouldNotifyOwner(result) {
  return result.escalate_to === 'Owner';
}

async function finalizeWorkflowResult(result, { writebackBuilder = null, ownerBuilder = null } = {}) {
  const finalResult = { ...result, writeback: null, owner_notification: null };

  if (writebackBuilder) {
    try {
      const writebackResult = await writeObsidianNote(writebackBuilder(finalResult));
      finalResult.writeback = {
        status: writebackResult.status,
        relative_path: writebackResult.relative_path,
        reason: writebackResult.reason,
      };
      if (writebackResult.status !== 'done' && finalResult.status === 'done') finalResult.status = 'partial';
    } catch (e) {
      console.error(`${finalResult.workflow} writeback error:`, e.message);
      finalResult.writeback = {
        status: 'blocked',
        relative_path: '',
        reason: `Writeback failed: ${e.message}`,
      };
      if (finalResult.status === 'done') finalResult.status = 'partial';
    }
  }

  if (ownerBuilder && shouldNotifyOwner(finalResult)) {
    try {
      const ownerResult = await sendOwnerNotification(ownerBuilder(finalResult));
      finalResult.owner_notification = {
        status: ownerResult.status,
        recipient: ownerResult.recipient,
        reason: ownerResult.reason,
      };
      if (ownerResult.status !== 'done' && finalResult.status === 'done') finalResult.status = 'partial';
    } catch (e) {
      console.error(`${finalResult.workflow} owner notification error:`, e.message);
      finalResult.owner_notification = {
        status: 'blocked',
        recipient: '',
        reason: `Owner notification failed: ${e.message}`,
      };
      if (finalResult.status === 'done') finalResult.status = 'partial';
    }
  }

  return finalResult;
}

async function executeSupportInboxAction(input) {
  const account = safeStr(input.account || input.mailbox || 'support@vurium.com').trim().toLowerCase() || 'support@vurium.com';
  const mailbox = safeStr(input.mailbox || input.account || account).trim().toLowerCase() || account;
  const shouldSend = !!input.safe_to_send && input.escalate_to === 'none';
  if (shouldSend) {
    try {
      const sendResult = await sendGmailReply({
        account,
        to: input.from_email,
        subject: input.reply_subject,
        bodyHtml: String(input.reply_draft || '').replace(/\n/g, '<br>'),
        threadId: input.thread_id,
        messageId: input.message_id,
      });
      return {
        agent: 'AI-9',
        workflow: 'support_inbox_execute',
        status: 'done',
        action: 'sent_reply',
        message_id: input.message_id,
        thread_id: input.thread_id,
        account,
        mailbox,
        label: input.label,
        safe_to_send: true,
        escalate_to: 'none',
        reason: input.reason || 'Routine reply sent safely.',
        gmail_message_id: sendResult.id,
        gmail_thread_id: sendResult.threadId,
        escalation_note: null,
        writeback: null,
        owner_notification: null,
        next_step: 'Reply sent. Log the outcome and update the queue if durable follow-up is needed.',
      };
    } catch (e) {
      const blockedReason = e.code === 'GMAIL_NOT_CONNECTED'
        ? `Mailbox ${account} is not connected for Gmail sending.`
        : `Reply send failed: ${e.message}`;
      return {
        agent: 'AI-9',
        workflow: 'support_inbox_execute',
        status: 'blocked',
        action: 'manual_review_required',
        message_id: input.message_id,
        thread_id: input.thread_id,
        account,
        mailbox,
        label: input.label,
        safe_to_send: false,
        escalate_to: 'Owner',
        reason: blockedReason,
        gmail_message_id: '',
        gmail_thread_id: '',
        escalation_note: buildSupportEscalationNote({
          ...input,
          account,
          mailbox,
          escalate_to: 'Owner',
          reason: blockedReason,
        }),
        writeback: null,
        owner_notification: null,
        next_step: 'Review the blocked send manually, then send from the correct mailbox or reconnect Gmail.',
      };
    }
  }

  const action = input.safe_to_send
    ? 'manual_review_required'
    : input.escalate_to === 'none'
      ? 'manual_review_required'
      : 'escalated';

  return {
    agent: 'AI-9',
    workflow: 'support_inbox_execute',
    status: action === 'manual_review_required' ? 'needs_review' : 'done',
    action,
    message_id: input.message_id,
    thread_id: input.thread_id,
    account,
    mailbox,
    label: input.label,
    safe_to_send: !!input.safe_to_send,
    escalate_to: input.escalate_to,
    reason: input.reason || 'Escalation or manual review required.',
    gmail_message_id: '',
    gmail_thread_id: '',
    escalation_note: buildSupportEscalationNote({
      ...input,
      account,
      mailbox,
      escalate_to: input.escalate_to,
    }),
    writeback: null,
    owner_notification: null,
    next_step: input.safe_to_send
      ? 'Review the draft manually before sending.'
      : 'Create the escalation note and route it to the correct next owner.',
  };
}

function buildGrowthBriefFallback(input, reason) {
  const channels = splitChannelList(input.channel);
  const assetRequests = uniqueList([
    input.need_static_creatives ? 'AI-11 static creatives' : '',
    input.need_video_brief ? 'AI-10 promo video brief' : '',
    'AI-9 follow-up email',
  ]);
  const escalateTo = input.need_static_creatives ? 'AI-11' : input.need_video_brief ? 'AI-10' : 'none';
  return {
    agent: 'AI-8',
    workflow: 'growth_brief',
    request_id: input.request_id,
    status: 'partial',
    growth_brief: {
      goal: input.goal,
      audience: input.audience,
      hook: buildOfflineGrowthHook(input),
      cta: 'Start free trial',
      channels: channels.length ? channels : ['landing page'],
      asset_requests: assetRequests,
      risk_notes: uniqueList([
        'Do not imply unsupported instant compliance outcomes.',
        reason,
      ]),
    },
    escalate_to: escalateTo,
    reason,
    writeback_targets: ['06-Growth/Growth-Backlog.md', '06-Growth/Experiments/'],
    writeback: null,
    owner_notification: null,
    next_step: assetRequests.length
      ? `Review the draft brief and route asset creation to ${assetRequests.join(', ')}.`
      : 'Review the draft growth brief and continue with the next campaign step.',
  };
}

function buildCreativeVariantsFallback(input, reason) {
  const formats = input.formats?.length ? input.formats : ['1080x1350'];
  const angles = ['fast setup', 'reduce admin chaos', 'more repeat visits'];
  return {
    agent: 'AI-11',
    workflow: 'creative_variants',
    creative_request_id: input.creative_request_id,
    status: 'partial',
    variants: angles.slice(0, Math.max(2, Math.min(3, formats.length + 1))).map((angle, index) => ({
      variant_id: `${input.creative_request_id}-V${index + 1}`,
      angle,
      prompt: `Create a ${safeStr((input.brand_direction || []).join(', ') || 'clean, modern')} static ad for ${input.audience}. Emphasize "${input.hook}" with a clear CTA "${input.cta}". Keep claims inside approved product truth and avoid unsupported compliance promises.`,
      format: formats[index % formats.length],
    })),
    needs_review: true,
    escalate_to: 'Owner',
    reason,
    writeback_targets: ['06-Growth/Creative/', '06-Growth/Experiments/Creative/'],
    writeback: null,
    owner_notification: null,
    next_step: 'Review the generated creative variants and choose the approved set before publishing.',
  };
}

function buildVideoBriefFallback(input, reason) {
  return {
    agent: 'AI-10',
    workflow: 'video_brief',
    video_request_id: input.video_request_id,
    status: 'partial',
    video_brief: {
      goal: input.goal,
      format: 'short promo',
      hook: input.hook || 'Simplify booking operations',
      cta: input.cta || 'Start free trial',
    },
    script: [
      { scene: 1, duration_sec: 5, text: safeStr(input.hook) || 'Still losing time to messy booking workflows?' },
      { scene: 2, duration_sec: 7, text: `Show ${input.audience || 'small teams'} getting booking and reminders running with less friction.` },
      { scene: 3, duration_sec: 8, text: safeStr(input.cta) ? `${input.cta} and simplify your daily flow.` : 'Start free trial and simplify your daily flow.' },
    ],
    dependencies_needed: input.asset_dependencies?.length ? input.asset_dependencies : ['AI-11 visual set'],
    escalate_to: 'Owner',
    reason,
    writeback_targets: ['06-Growth/Video/', '06-Growth/Video/Scripts/'],
    writeback: null,
    owner_notification: null,
    next_step: 'Review the draft script pack before production or publishing.',
  };
}

function decodeBasicHtmlEntities(text) {
  return safeStr(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlToPlainText(html) {
  return decodeBasicHtmlEntities(
    safeStr(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function inferResearchSourceType(url) {
  const text = safeStr(url).toLowerCase();
  if (/(policy|compliance|terms|privacy|legal|10dlc|consent)/.test(text)) return 'official_policy';
  if (/(docs|developer|api|support|help|knowledgebase|kb)/.test(text)) return 'official_vendor_doc';
  return 'official_source';
}

function buildResearchWritebackTargets() {
  return ['07-Research/', '07-Research/AI5-Research-Brief-*.md', '04-Tasks/Handoffs/'];
}

function buildDeepResearchPromptFromBrief(input, result = {}) {
  const topic = safeStr(input?.topic || 'Research topic needs clarification').trim();
  const researchId = safeStr(input?.research_id || '').trim();
  const taskId = safeStr(input?.task_id || '').trim();
  const questions = uniqueList([
    ...((Array.isArray(input?.questions) ? input.questions : []).map((entry) => safeStr(entry).trim())),
    ...((Array.isArray(result?.open_questions) ? result.open_questions : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);
  const targetSources = uniqueList([
    ...((Array.isArray(input?.target_sources) ? input.target_sources : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);
  const relatedLinks = uniqueList([
    ...((Array.isArray(input?.related_links) ? input.related_links : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);
  const knownSourceUrls = uniqueList([
    ...normalizeResearchSourceUrls(input?.source_urls),
    ...((Array.isArray(result?.source_summary) ? result.source_summary : [])
      .map((entry) => safeStr(entry?.url).trim())
      .filter(Boolean)),
  ]);
  const facts = uniqueList([
    ...((Array.isArray(result?.facts) ? result.facts : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);
  const inferences = uniqueList([
    ...((Array.isArray(result?.inferences) ? result.inferences : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);
  const openQuestions = uniqueList([
    ...((Array.isArray(result?.open_questions) ? result.open_questions : []).map((entry) => safeStr(entry).trim())),
  ]).filter(Boolean);

  const lines = [
    'Act as AI-5 Research for the VuriumBook operating system.',
    'Your job is to do a source-backed Deep Research pass that unblocks planning and implementation.',
    '',
    `Research topic: ${topic}`,
    ...(taskId ? [`Task ID: ${taskId}`] : []),
    ...(researchId ? [`Research ID: ${researchId}`] : []),
    '',
    'Questions to answer:',
    ...(questions.length
      ? questions.map((entry) => `- ${entry}`)
      : ['- Identify the official facts still needed to unblock planning for this topic.']),
    '',
    'Source rules:',
    '- Prioritize official vendor documentation, official policy/legal pages, platform help centers, and primary-source standards.',
    '- If a claim is not supported by a primary source, do not present it as a fact.',
    '- Separate confirmed facts from inferences.',
    '- Attach a source URL to every factual claim.',
    '- Do not claim legal certainty unless the source explicitly states it.',
    '- If evidence is incomplete, list it as an open question instead of guessing.',
    '',
    ...(knownSourceUrls.length
      ? [
        'Known official source URLs to inspect first:',
        ...knownSourceUrls.map((entry) => `- ${entry}`),
        '',
      ]
      : [
        'Known official source URLs to inspect first:',
        '- Discover the relevant official sources as part of the research pass.',
        '',
      ]),
    ...(targetSources.length
      ? [
        'Source types to prioritize:',
        ...targetSources.map((entry) => `- ${entry}`),
        '',
      ]
      : []),
    ...(relatedLinks.length
      ? [
        'Internal context links / notes to use as framing only:',
        ...relatedLinks.map((entry) => `- ${entry}`),
        '',
      ]
      : []),
    ...(facts.length
      ? [
        'Current source-backed facts already collected locally:',
        ...facts.map((entry) => `- ${entry}`),
        '',
      ]
      : []),
    ...(inferences.length
      ? [
        'Current working inferences already identified locally:',
        ...inferences.map((entry) => `- ${entry}`),
        '',
      ]
      : []),
    ...(openQuestions.length
      ? [
        'Still unresolved:',
        ...openQuestions.map((entry) => `- ${entry}`),
        '',
      ]
      : []),
    'Return the result in this exact structure:',
    '1. Executive summary',
    '2. Facts',
    '   - one bullet per fact',
    '   - include the exact supporting source URL after each fact',
    '3. Inferences',
    '4. Open questions',
    '5. Sources consulted',
    '6. Recommended next inputs needed for planning',
    '',
    'If the evidence is weak or contradictory, say that explicitly and recommend the next official source to inspect.',
  ];

  return lines.join('\n').trim();
}

function getObsidianRoot() {
  return path.resolve(process.env.VURIUM_OBSIDIAN_ROOT || path.resolve(__dirname, '../docs'));
}

function resolveObsidianTargetPath(relativePath) {
  const cleaned = safeStr(relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) throw new Error('Missing relative_path');
  if (!cleaned.endsWith('.md')) throw new Error('Obsidian writeback only supports .md files');
  const root = getObsidianRoot();
  const absolute = path.resolve(root, cleaned);
  if (!(absolute === root || absolute.startsWith(root + path.sep))) {
    throw new Error('Obsidian writeback path escapes the configured vault root');
  }
  return { root, cleaned, absolute };
}

function buildOwnerNotificationHtml(input) {
  const severity = safeStr(input.severity || 'medium').toUpperCase();
  const detailsHtml = (Array.isArray(input.details) ? input.details : [])
    .filter(Boolean)
    .map((entry) => `<li style="margin:0 0 8px;color:#344054;">${sanitizeHtml(String(entry))}</li>`)
    .join('');
  const linksHtml = (Array.isArray(input.links) ? input.links : [])
    .filter(Boolean)
    .map((entry) => `<li style="margin:0 0 8px;"><span style="color:#475467;">${sanitizeHtml(String(entry))}</span></li>`)
    .join('');

  return vuriumSupportEmailTemplate(input.subject, `
    <p style="margin:0 0 12px;color:#475467;">An automation lane raised an Owner notification from <strong style="color:#101828;">${sanitizeHtml(input.workflow_source)}</strong>.</p>
    <div style="margin:16px 0;padding:16px 20px;border-radius:14px;background:#f8fafc;border:1px solid #e8edf5;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Severity</p>
      <p style="margin:0 0 16px;font-weight:600;color:#101828;">${severity}</p>
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Summary</p>
      <p style="margin:0 0 16px;color:#344054;">${sanitizeHtml(input.summary)}</p>
      ${detailsHtml ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Details</p><ul style="margin:0 0 16px 18px;padding:0;">${detailsHtml}</ul>` : ''}
      ${linksHtml ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Links / References</p><ul style="margin:0 0 16px 18px;padding:0;">${linksHtml}</ul>` : ''}
      ${input.next_step ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;">Next Step</p><p style="margin:0;color:#344054;">${sanitizeHtml(input.next_step)}</p>` : ''}
    </div>
  `, {
    teamLabel: 'Operations',
    teamEmail: 'support@vurium.com',
    fromName: 'Vurium Operations',
    eyebrow: 'Automation alert',
    intro: 'A workflow needs Owner awareness or action before it can proceed safely.',
    actionNote: 'Review the workflow output and complete the next step only if the action fits current governance and approval rules.',
    signature: 'Vurium Operations',
  });
}

async function sendOwnerNotification(input) {
  const recipient = safeStr(input.recipient || process.env.VURIUM_OWNER_EMAIL || ADMIN_NOTIFY_EMAIL).trim().toLowerCase();
  if (!recipient) {
    return {
      agent: 'SYSTEM',
      workflow: 'owner_notification',
      status: 'blocked',
      channel: 'email',
      workflow_source: input.workflow_source,
      severity: input.severity,
      recipient: '',
      subject: input.subject,
      reason: 'No Owner notification email is configured.',
      notification_id: '',
      next_step: 'Set ADMIN_NOTIFY_EMAIL or VURIUM_OWNER_EMAIL before using automatic Owner notifications.',
    };
  }

  const subject = `[Vurium][${String(input.severity || 'medium').toUpperCase()}] ${input.subject}`;
  const html = buildOwnerNotificationHtml(input);
  const result = await sendEmail(recipient, subject, html, 'Vurium Operations');

  await db.collection('vurium_emails').add({
    direction: 'outbound',
    from: 'noreply@vurium.com',
    mailbox: 'support@vurium.com',
    to: recipient,
    subject,
    body_html: html,
    body_text: '',
    status: result?.id ? 'sent' : 'failed',
    read: true,
    created_at: toIso(new Date()),
  }).catch(() => {});

  if (!result?.id) {
    return {
      agent: 'SYSTEM',
      workflow: 'owner_notification',
      status: 'blocked',
      channel: 'email',
      workflow_source: input.workflow_source,
      severity: input.severity,
      recipient,
      subject,
      reason: 'Owner notification email failed to send.',
      notification_id: '',
      next_step: 'Review the blocked notification manually and resend from the developer/admin panel.',
    };
  }

  return {
    agent: 'SYSTEM',
    workflow: 'owner_notification',
    status: 'done',
    channel: 'email',
    workflow_source: input.workflow_source,
    severity: input.severity,
    recipient,
    subject,
    reason: 'Owner notification sent successfully.',
    notification_id: result.id,
    next_step: input.next_step || 'Review the notification and continue with the gated action if needed.',
  };
}

async function writeObsidianNote(input) {
  const { cleaned, absolute } = resolveObsidianTargetPath(input.relative_path);
  const content = String(input.content || '');
  const finalContent = content.endsWith('\n') ? content : `${content}\n`;
  const directory = path.dirname(absolute);

  if (input.dry_run) {
    return {
      agent: 'SYSTEM',
      workflow: 'obsidian_writeback',
      status: 'done',
      mode: input.mode,
      relative_path: cleaned,
      absolute_path: absolute,
      bytes_written: Buffer.byteLength(finalContent),
      reason: 'Dry run completed successfully. No file was written.',
      next_step: 'Disable dry_run to perform the actual writeback.',
    };
  }

  await fsPromises.mkdir(directory, { recursive: true });
  if (input.mode === 'create') {
    try {
      await fsPromises.access(absolute);
      return {
        agent: 'SYSTEM',
        workflow: 'obsidian_writeback',
        status: 'needs_review',
        mode: input.mode,
        relative_path: cleaned,
        absolute_path: absolute,
        bytes_written: 0,
        reason: 'Target note already exists. Refusing to overwrite in create mode.',
        next_step: 'Choose append or replace mode, or use a new target path.',
      };
    } catch {}
    await fsPromises.writeFile(absolute, finalContent, 'utf8');
  } else if (input.mode === 'append') {
    await fsPromises.appendFile(absolute, finalContent, 'utf8');
  } else {
    await fsPromises.writeFile(absolute, finalContent, 'utf8');
  }

  return {
    agent: 'SYSTEM',
    workflow: 'obsidian_writeback',
    status: 'done',
    mode: input.mode,
    relative_path: cleaned,
    absolute_path: absolute,
    bytes_written: Buffer.byteLength(finalContent),
    reason: 'Obsidian note writeback completed successfully.',
    next_step: 'Continue with notification or downstream routing if needed.',
  };
}

function buildResearchBriefQueued(input, reason) {
  const result = {
    agent: 'AI-5',
    workflow: 'research_brief',
    research_id: input.research_id,
    task_id: input.task_id,
    status: 'queued',
    facts: [],
    inferences: [],
    open_questions: input.questions.length ? input.questions : ['Research request needs explicit external fact questions.'],
    source_summary: [],
    escalate_to: 'AI-3',
    reason,
    writeback_targets: buildResearchWritebackTargets(),
    writeback: null,
    owner_notification: null,
    next_step: 'Attach official source URLs to the research request, then rerun AI-5 research intake.',
  };
  return {
    ...result,
    deep_research_prompt: buildDeepResearchPromptFromBrief(input, result),
  };
}

function buildResearchBriefBlocked(input, reason, sourceSummary = []) {
  const result = {
    agent: 'AI-5',
    workflow: 'research_brief',
    research_id: input.research_id,
    task_id: input.task_id,
    status: 'blocked',
    facts: [],
    inferences: [],
    open_questions: input.questions.length ? input.questions : ['Research request needs manual review.'],
    source_summary: sourceSummary,
    escalate_to: 'AI-3',
    reason,
    writeback_targets: buildResearchWritebackTargets(),
    writeback: null,
    owner_notification: null,
    next_step: 'Repair the source list or attach accessible official sources before rerunning AI-5 research intake.',
  };
  return {
    ...result,
    deep_research_prompt: buildDeepResearchPromptFromBrief(input, result),
  };
}

function buildResearchBriefStaged(input, reason, sourceSummary = [], fetchedSources = []) {
  const result = {
    agent: 'AI-5',
    workflow: 'research_brief',
    research_id: input.research_id,
    task_id: input.task_id,
    status: 'partial',
    facts: fetchedSources.slice(0, 3).map((entry) => `Official source staged for review: ${entry.title || entry.url}`),
    inferences: [],
    open_questions: uniqueList([
      ...(input.questions || []),
      'Review the fetched source excerpts manually or rerun once the AI key is configured.',
    ]),
    source_summary: sourceSummary,
    escalate_to: 'AI-3',
    reason,
    writeback_targets: buildResearchWritebackTargets(),
    writeback: null,
    owner_notification: null,
    next_step: 'Review the fetched official sources manually, then continue planning or rerun AI-5 once the AI key is configured.',
  };
  return {
    ...result,
    deep_research_prompt: buildDeepResearchPromptFromBrief(input, result),
  };
}

function normalizeResearchSourceUrls(sourceUrls) {
  return Array.from(new Set((Array.isArray(sourceUrls) ? sourceUrls : [])
    .map((entry) => safeStr(entry).trim())
    .filter(Boolean)))
    .slice(0, 5);
}

async function fetchResearchSources(sourceUrls) {
  const normalized = normalizeResearchSourceUrls(sourceUrls);
  const fetched = [];
  const failed = [];

  for (const rawUrl of normalized) {
    let timeout = null;
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VuriumBook-AI5-Research/1.0',
          'Accept': 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,text/markdown;q=0.8,*/*;q=0.2',
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = safeStr(response.headers.get('content-type')).toLowerCase();
      if (/application\/pdf|\/pdf\b/.test(contentType)) throw new Error('PDF sources are not supported in this MVP lane');
      const body = await response.text();
      const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const extractedTitle = stripHtmlToPlainText(titleMatch?.[1] || '');
      const extractedText = /html|xml/.test(contentType)
        ? stripHtmlToPlainText(body)
        : decodeBasicHtmlEntities(safeStr(body)).replace(/\s+/g, ' ').trim();
      if (!extractedText) throw new Error('Empty source content');
      fetched.push({
        source_type: inferResearchSourceType(parsed.toString()),
        topic: '',
        url: parsed.toString(),
        title: extractedTitle || parsed.hostname,
        status: 'fetched',
        content: extractedText.slice(0, 7000),
      });
    } catch (e) {
      failed.push({
        source_type: inferResearchSourceType(rawUrl),
        topic: '',
        url: rawUrl,
        title: '',
        status: 'failed',
        error: e.name === 'AbortError' ? 'Fetch timed out' : e.message,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return { fetched, failed };
}

async function generateResearchBrief(meta, context, input) {
  const sourceUrls = normalizeResearchSourceUrls(input.source_urls);
  if (!sourceUrls.length) {
    return buildResearchBriefQueued(
      input,
      'AI-5 research intake requires explicit official source URLs before it can produce source-backed findings.'
    );
  }

  const { fetched, failed } = await fetchResearchSources(sourceUrls);
  const sourceSummary = [
    ...fetched.map(({ source_type, topic, url, title, status }) => ({ source_type, topic, url, title, status })),
    ...failed.map(({ source_type, topic, url, title, status }) => ({ source_type, topic, url, title, status })),
  ];

  if (!fetched.length) {
    return buildResearchBriefBlocked(
      input,
      'AI-5 could not fetch any usable official sources from the provided source_urls list.',
      sourceSummary
    );
  }

  if (!anthropic && !openai) {
    return buildResearchBriefStaged(input, AI_NOT_CONFIGURED_REASON, sourceSummary, fetched);
  }

  const fallback = buildResearchBriefBlocked(
    input,
    'Failed to parse AI-5 research brief output from the model.',
    sourceSummary
  );

  const result = await runStructuredWorkflowAI({
    workflowName: 'research_brief',
    systemPrompt: AI5_RESEARCH_BRIEF_SYSTEM_PROMPT,
    input: {
      ...input,
      source_urls: sourceUrls,
    },
    meta,
    context: {
      ...context,
      research_sources: fetched.map(({ source_type, url, title, content }) => ({
        source_type,
        url,
        title,
        excerpt: content,
      })),
    },
    fallback,
    outputSchema: AI5ResearchBriefOutputSchema,
    maxTokens: 1800,
  });

  const fetchFailures = failed.map((entry) => `Unable to fetch ${entry.url}: ${entry.error}`);
  const finalizedResult = {
    ...result,
    status: failed.length && result.status === 'done' ? 'partial' : result.status,
    open_questions: Array.from(new Set([...(result.open_questions || []), ...fetchFailures])),
    source_summary: sourceSummary,
    reason: result.reason || (failed.length
      ? 'Research completed with some source fetch failures.'
      : 'Source-backed research brief generated successfully.'),
    writeback_targets: result.writeback_targets?.length ? result.writeback_targets : buildResearchWritebackTargets(),
    next_step: result.next_step || (result.escalate_to === 'AI-7'
      ? 'Route the source-backed findings to AI-7 for compliance translation.'
      : 'Review the research brief and route it to the next owner.'),
  };

  return AI5ResearchBriefOutputSchema.parse({
    ...finalizedResult,
    deep_research_prompt: safeStr(result.deep_research_prompt || '').trim()
      || buildDeepResearchPromptFromBrief(input, finalizedResult),
  });
}

function shouldGenerateCreativeAssets(growthOutput, input) {
  if (!input.need_static_creatives) return false;
  const requests = growthOutput?.growth_brief?.asset_requests || [];
  if (!requests.length) return true;
  return requests.some((entry) => /ai-11|static|creative|image|visual/i.test(String(entry)));
}

function shouldGenerateVideoAssets(growthOutput, input) {
  if (!input.need_video_brief) return false;
  const requests = growthOutput?.growth_brief?.asset_requests || [];
  if (!requests.length) return true;
  return requests.some((entry) => /ai-10|video|script|promo/i.test(String(entry)));
}

async function generateGrowthBrief(meta, context, input) {
  return runStructuredWorkflowAI({
    workflowName: 'growth_brief',
    systemPrompt: AI8_GROWTH_BRIEF_SYSTEM_PROMPT,
    input,
    meta,
    context,
    fallback: buildGrowthBriefFallback(input, anthropic ? 'Failed to parse growth brief AI output.' : AI_NOT_CONFIGURED_REASON),
    outputSchema: AI8GrowthBriefOutputSchema,
    maxTokens: 1500,
  });
}

async function generateCreativeVariants(meta, context, input) {
  return runStructuredWorkflowAI({
    workflowName: 'creative_variants',
    systemPrompt: AI11_CREATIVE_VARIANTS_SYSTEM_PROMPT,
    input,
    meta,
    context,
    fallback: buildCreativeVariantsFallback(input, anthropic ? 'Failed to parse creative variants AI output.' : AI_NOT_CONFIGURED_REASON),
    outputSchema: AI11CreativeVariantsOutputSchema,
    maxTokens: 1800,
  });
}

async function generateVideoBrief(meta, context, input) {
  return runStructuredWorkflowAI({
    workflowName: 'video_brief',
    systemPrompt: AI10_VIDEO_BRIEF_SYSTEM_PROMPT,
    input,
    meta,
    context,
    fallback: buildVideoBriefFallback(input, anthropic ? 'Failed to parse video brief AI output.' : AI_NOT_CONFIGURED_REASON),
    outputSchema: AI10VideoBriefOutputSchema,
    maxTokens: 1800,
  });
}

async function executeGrowthAssetFlow(meta, context, input) {
  const growth = await generateGrowthBrief(meta, context, input);
  if (growth.escalate_to !== 'none' && !['AI-10', 'AI-11'].includes(growth.escalate_to)) {
    return {
      agent: 'SYSTEM',
      workflow: 'growth_asset_flow',
      status: growth.status === 'done' ? 'needs_review' : growth.status,
      request_id: input.request_id,
      growth_brief: growth,
      creative_output: null,
      video_output: null,
      creative_requested: false,
      video_requested: false,
      escalate_to: growth.escalate_to,
      reason: growth.reason || 'Growth brief requires upstream review before asset generation.',
      writeback_targets: ['06-Growth/Growth-Backlog.md', '06-Growth/Experiments/'],
      writeback: null,
      owner_notification: null,
      next_step: growth.next_step || 'Resolve the growth brief escalation before generating assets.',
    };
  }

  const creativeRequested = shouldGenerateCreativeAssets(growth, input);
  const videoRequested = shouldGenerateVideoAssets(growth, input);

  let creativeOutput = null;
  if (creativeRequested) {
    creativeOutput = await generateCreativeVariants(
      { ...meta, workflow_name: 'AI11_Creative_Variants', trigger_source: meta.trigger_source || 'growth_asset_flow' },
      context,
      {
        creative_request_id: `${input.request_id}-creative`,
        growth_brief_link: input.campaign_name ? `[[${input.campaign_name} Growth Brief]]` : '',
        goal: growth.growth_brief.goal,
        audience: growth.growth_brief.audience,
        hook: growth.growth_brief.hook,
        cta: growth.growth_brief.cta,
        brand_direction: input.brand_direction,
        approved_claims_link: input.approved_claims_link,
        formats: input.formats,
      }
    );
  }

  let videoOutput = null;
  if (videoRequested) {
    videoOutput = await generateVideoBrief(
      { ...meta, workflow_name: 'AI10_Video_Brief', trigger_source: meta.trigger_source || 'growth_asset_flow' },
      context,
      {
        video_request_id: `${input.request_id}-video`,
        growth_brief_link: input.campaign_name ? `[[${input.campaign_name} Growth Brief]]` : '',
        goal: growth.growth_brief.goal,
        audience: growth.growth_brief.audience,
        hook: growth.growth_brief.hook,
        cta: growth.growth_brief.cta,
        product_truth_links: input.product_truth_links,
        approved_claims_link: input.approved_claims_link,
        asset_dependencies: ['AI-11 visuals', 'AI-2 UI screenshots if needed'],
      }
    );
  }

  const downstreamEscalation = creativeOutput?.escalate_to && creativeOutput.escalate_to !== 'none'
    ? creativeOutput.escalate_to
    : videoOutput?.escalate_to && videoOutput.escalate_to !== 'none'
      ? videoOutput.escalate_to
      : growth.escalate_to;

  const blocked = [growth, creativeOutput, videoOutput].some((item) => item && item.status === 'blocked');
  return {
    agent: 'SYSTEM',
    workflow: 'growth_asset_flow',
    status: blocked ? 'blocked' : 'done',
    request_id: input.request_id,
    growth_brief: growth,
    creative_output: creativeOutput,
    video_output: videoOutput,
    creative_requested: creativeRequested,
    video_requested: videoRequested,
    escalate_to: downstreamEscalation || 'none',
    reason: blocked
      ? 'One or more growth asset steps were blocked and require review.'
      : 'Growth brief and requested assets generated successfully.',
    writeback_targets: ['06-Growth/Growth-Backlog.md', '06-Growth/Experiments/', '06-Growth/Creative/', '06-Growth/Video/'],
    writeback: null,
    owner_notification: null,
    ai_meta: growth.ai_meta || creativeOutput?.ai_meta || videoOutput?.ai_meta || null,
    next_step: blocked
      ? 'Review blocked asset outputs and route them to the correct owner.'
      : 'Review the generated growth brief and asset drafts, then move approved assets into production lanes.',
  };
}

async function executePlanningIntakeWorkflow(meta, context, input, { notifyOwner = true } = {}) {
  const result = await runStructuredWorkflowAI({
    workflowName: 'planning_intake',
    systemPrompt: AI3_PLANNING_INTAKE_SYSTEM_PROMPT,
    input,
    meta,
    context,
    fallback: buildPlanningFallback(input, anthropic ? 'Failed to parse planning intake AI output.' : AI_NOT_CONFIGURED_REASON),
    outputSchema: AI3PlanningIntakeOutputSchema,
    maxTokens: 1400,
  });

  return AI3PlanningIntakeOutputSchema.parse(await finalizeWorkflowResult(result, {
    writebackBuilder: buildPlanningWritebackInput,
    ownerBuilder: notifyOwner
      ? (finalResult) => buildGenericOwnerNotificationInput(
        'AI3_Planning_Intake',
        `Planning intake needs Owner review (${finalResult.task_id})`,
        finalResult.reason || 'Planning intake requires Owner review before work can continue safely.',
        finalResult,
        ['[[04-Tasks/Workflow-Queue|Workflow Queue]]']
      )
      : null,
  }));
}

async function executeQAScanWorkflow(meta, context, input, { notifyOwner = true } = {}) {
  const result = await runStructuredWorkflowAI({
    workflowName: 'qa_scan',
    systemPrompt: AI3_QA_SCAN_SYSTEM_PROMPT,
    input,
    meta,
    context,
    fallback: buildQAFallback(input, anthropic ? 'Failed to parse QA scan AI output.' : AI_NOT_CONFIGURED_REASON),
    outputSchema: AI3QAScanOutputSchema,
    maxTokens: 1400,
  });

  return AI3QAScanOutputSchema.parse(await finalizeWorkflowResult(result, {
    writebackBuilder: buildQAWritebackInput,
    ownerBuilder: notifyOwner
      ? (finalResult) => buildGenericOwnerNotificationInput(
        'AI3_QA_Scan',
        `QA scan needs Owner review (${finalResult.task_id})`,
        finalResult.reason || 'QA scan result requires Owner awareness before release or launch.',
        finalResult,
        ['[[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]]']
      )
      : null,
  }));
}

async function executeGrowthAssetFlowWorkflow(meta, context, input, { notifyOwner = true } = {}) {
  const result = GrowthAssetFlowOutputSchema.parse(await executeGrowthAssetFlow(meta, context, input));
  return GrowthAssetFlowOutputSchema.parse(await finalizeWorkflowResult(result, {
    writebackBuilder: buildGrowthWritebackInput,
    ownerBuilder: notifyOwner
      ? (finalResult) => buildGenericOwnerNotificationInput(
        'Growth_Asset_Flow',
        `Growth asset flow needs Owner review (${finalResult.request_id})`,
        finalResult.reason || 'Growth asset flow requires Owner review before approval or publishing.',
        finalResult,
        ['[[08-Runbooks/Growth/Campaign-Workflow|Campaign Workflow]]']
      )
      : null,
  }));
}

async function executeResearchBriefWorkflow(meta, context, input, { notifyOwner = true } = {}) {
  const result = await generateResearchBrief(meta, context, input);
  return AI5ResearchBriefOutputSchema.parse(await finalizeWorkflowResult(result, {
    writebackBuilder: buildResearchWritebackInput,
    ownerBuilder: notifyOwner
      ? (finalResult) => buildGenericOwnerNotificationInput(
        'Research_Brief',
        `Research brief needs Owner review (${finalResult.research_id})`,
        finalResult.reason || 'Research brief requires Owner review before risk-sensitive decisions continue.',
        finalResult,
        ['[[07-Research/Research-Index|Research Index]]']
      )
      : null,
  }));
}

async function executeOwnerAdvisory(meta, context, input) {
  const advisoryContext = await buildOwnerAdvisoryContext(context);
  return OwnerAdvisoryOutputSchema.parse(await runStructuredWorkflowAI({
    workflowName: 'owner_advisory',
    systemPrompt: OWNER_ADVISORY_SYSTEM_PROMPT,
    input: {
      message: safeStr(input.message).trim(),
      title: safeStr(input.title).trim(),
      requested_by: safeStr(input.requested_by || 'Owner') || 'Owner',
      priority: safeStr(input.priority || 'medium') || 'medium',
      product_context_links: uniqueList(input.product_context_links || []),
      known_constraints: uniqueList(input.known_constraints || []),
    },
    meta,
    context: advisoryContext,
    fallback: buildOwnerAdvisoryFallback(input, anthropic || openai
      ? 'The advisory response fell back to a safer draft because parsing did not complete.'
      : AI_NOT_CONFIGURED_REASON),
    outputSchema: OwnerAdvisoryOutputSchema,
    maxTokens: 1100,
  }));
}

async function executeOwnerIntake(meta, context, input) {
  const title = deriveOwnerIntakeTitle(input);
  const intakeKind = detectOwnerIntakeKind(input);
  const intakeId = buildOwnerIntakeId(intakeKind);
  const metadata = buildOwnerIntakeMetadata(intakeKind);
  const note = intakeKind === 'advisory'
    ? { relative_path: '', content: '' }
    : buildOwnerIntakeNote(intakeKind, intakeId, title, input, metadata);

  let writeback = null;
  if (intakeKind !== 'advisory') {
    try {
      const writebackResult = await writeObsidianNote({
        relative_path: note.relative_path,
        content: note.content,
        mode: 'create',
        dry_run: false,
      });
      writeback = {
        status: writebackResult.status,
        relative_path: writebackResult.relative_path,
        reason: writebackResult.reason,
      };
    } catch (e) {
      writeback = {
        status: 'blocked',
        relative_path: '',
        reason: `Writeback failed: ${e.message}`,
      };
    }
  }

  let downstreamResult = null;
  let followOnResult = null;
  if (intakeKind === 'advisory') {
    downstreamResult = await executeOwnerAdvisory(
      { ...meta, workflow_name: 'Owner_Advisory', trigger_source: meta.trigger_source || 'owner_intake' },
      context,
      input
    );
  } else if (intakeKind === 'task') {
    downstreamResult = await executePlanningIntakeWorkflow(
      { ...meta, workflow_name: 'AI3_Planning_Intake', trigger_source: meta.trigger_source || 'owner_intake' },
      {
        ...context,
        owner_intake_note: note.relative_path,
      },
      {
        task_id: intakeId,
        title,
        description: safeStr(input.message).trim(),
        requested_by: safeStr(input.requested_by || 'Owner') || 'Owner',
        complexity: 'non-trivial',
        external_dependency: normalizeResearchSourceUrls([
          ...normalizeResearchSourceUrls(input.source_urls),
          ...extractUrlsFromText(input.message),
        ]).length > 0,
        product_context_links: uniqueList([note.relative_path, ...(input.product_context_links || []), ...(input.related_links || [])]),
        known_constraints: uniqueList(input.known_constraints || []),
        priority: safeStr(input.priority || 'medium') || 'medium',
      },
      { notifyOwner: false }
    );

    if (shouldAutoContinueOwnerIntakeResearch(intakeKind, downstreamResult)) {
      followOnResult = await executeResearchBriefWorkflow(
        { ...meta, workflow_name: 'Research_Brief', trigger_source: meta.trigger_source || 'owner_intake_follow_on' },
        {
          ...context,
          owner_intake_note: note.relative_path,
          planning_note: safeStr(downstreamResult?.writeback?.relative_path || ''),
        },
        buildOwnerIntakeResearchFollowOnInput(intakeId, title, input, note, downstreamResult),
        { notifyOwner: false }
      );
    }
  } else if (intakeKind === 'growth') {
    downstreamResult = await executeGrowthAssetFlowWorkflow(
      { ...meta, workflow_name: 'Growth_Asset_Flow', trigger_source: meta.trigger_source || 'owner_intake' },
      {
        ...context,
        owner_intake_note: note.relative_path,
      },
      {
        request_id: intakeId,
        campaign_name: title,
        goal: safeStr(input.message).trim(),
        audience: safeStr(input.audience || 'Audience needs clarification.') || 'Audience needs clarification.',
        channel: safeStr(input.channel || ''),
        current_offer_link: safeStr(input.current_offer_link || ''),
        product_truth_links: uniqueList(input.product_context_links || []),
        known_objections: [],
        approved_claims_link: safeStr(input.approved_claims_link || ''),
        need_static_creatives: inferOwnerIntakeCreativeNeed(input),
        need_video_brief: inferOwnerIntakeVideoNeed(input),
        brand_direction: ['clean', 'modern', 'trustworthy'],
        formats: ['1080x1350', '1200x628'],
      },
      { notifyOwner: false }
    );
  } else if (intakeKind === 'research') {
    downstreamResult = await executeResearchBriefWorkflow(
      { ...meta, workflow_name: 'Research_Brief', trigger_source: meta.trigger_source || 'owner_intake' },
      {
        ...context,
        owner_intake_note: note.relative_path,
      },
      {
        research_id: intakeId,
        task_id: safeStr(input.related_task_id || intakeId) || intakeId,
        topic: title,
        questions: uniqueList((input.questions || []).length ? input.questions : [safeStr(input.message).trim()]),
        target_sources: uniqueList(input.target_sources || []),
        related_links: uniqueList([note.relative_path, ...(input.related_links || []), ...(input.product_context_links || [])]),
        source_urls: normalizeResearchSourceUrls([
          ...normalizeResearchSourceUrls(input.source_urls),
          ...extractUrlsFromText(input.message),
        ]),
      },
      { notifyOwner: false }
    );
  }

  const downstreamStatus = downstreamResult?.status || (writeback?.status || 'queued');
  const followOnStatus = followOnResult?.status || downstreamStatus;
  let status = downstreamStatus;
  if (!downstreamResult) {
    status = writeback?.status === 'done' ? 'done' : writeback?.status || 'queued';
  } else if (writeback && writeback.status !== 'done' && downstreamStatus === 'done') {
    status = 'partial';
  } else if (followOnResult && ['blocked', 'needs_review', 'partial'].includes(followOnStatus) && status === 'done') {
    status = followOnStatus === 'partial' ? 'partial' : 'needs_review';
  }

  const overallEscalation = followOnResult?.escalate_to || downstreamResult?.escalate_to || metadata.route_target;
  const reason = followOnResult?.reason
    || downstreamResult?.reason
    || (intakeKind === 'truth_update_draft'
      ? 'Truth updates from Owner Intake must remain draft-only until manually approved.'
      : intakeKind === 'handoff'
        ? 'Handoff note created from Owner Intake.'
        : 'Owner intake created successfully.');
  const operatorReply = buildOwnerIntakeOperatorReply({
    intakeKind,
    title,
    note,
    downstreamResult,
    followOnResult,
  });

  return OwnerIntakeOutputSchema.parse({
    agent: 'SYSTEM',
    workflow: 'owner_intake',
    status,
    intake_id: intakeId,
    intake_kind: intakeKind,
    title,
    queue_stage: metadata.queue_stage,
    route_target: metadata.route_target,
    created_note_relative_path: writeback?.relative_path || note.relative_path,
    downstream_workflow: metadata.downstream_workflow,
    downstream_status: downstreamStatus,
    downstream_reference: downstreamResult?.writeback?.relative_path || '',
    downstream_result: downstreamResult,
    escalate_to: overallEscalation,
    reason,
    writeback_targets: uniqueList([
      note.relative_path,
      ...(downstreamResult?.writeback_targets || []),
      ...(followOnResult?.writeback_targets || []),
    ]),
    writeback,
    owner_notification: downstreamResult?.owner_notification || null,
    operator_reply: operatorReply,
    follow_on_workflow: followOnResult?.workflow === 'research_brief' ? 'Research_Brief' : 'none',
    follow_on_status: followOnStatus,
    follow_on_reference: followOnResult?.writeback?.relative_path || '',
    follow_on_result: followOnResult,
    next_step: followOnResult?.next_step
      || downstreamResult?.next_step
      || (intakeKind === 'truth_update_draft'
        ? 'Review the draft and manually update canonical truth only after approval.'
        : intakeKind === 'handoff'
          ? 'Assign the handoff to the correct next owner and continue in the queue.'
          : `Open ${metadata.downstream_workflow} and continue the routed lane.`),
  });
}

async function runStructuredWorkflowAI({
  workflowName = 'structured_workflow',
  systemPrompt,
  input,
  meta = {},
  context = {},
  fallback,
  outputSchema,
  maxTokens = 1600,
}) {
  const providerChain = getStructuredWorkflowProviderChain(
    workflowName,
    meta.ai_provider || context.ai_provider || input.ai_provider || ''
  );
  const errors = [];

  for (const provider of providerChain) {
    try {
      const providerResult = provider === 'anthropic'
        ? await callAnthropicStructuredWorkflow({ systemPrompt, input, meta, context, maxTokens })
        : await callOpenAIStructuredWorkflow({ systemPrompt, input, meta, context, maxTokens });
      const parsed = extractJsonObject(providerResult.rawText, null);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Failed to parse JSON object from ${provider} response`);
      }
      const validated = outputSchema.parse(parsed);
      return {
        ...validated,
        ai_meta: providerResult.ai_meta,
      };
    } catch (e) {
      errors.push(`${provider}: ${safeStr(e?.message || 'Unknown provider error')}`);
    }
  }

  const reason = errors.length
    ? `AI provider error: ${errors.join(' | ')}`
    : AI_NOT_CONFIGURED_REASON;
  return outputSchema.parse(withWorkflowFallbackReason(fallback, reason));
}

async function collectDiagnosticMetrics() {
  const now = new Date();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const h24Iso = h24.toISOString();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Workspace stats
  const wsSnap = await db.collection('workspaces').get();
  const workspaces = [];
  const byPlan = {}, byStatus = {};
  let expiredTrials = 0;
  wsSnap.forEach(d => {
    const w = d.data();
    const plan = w.plan_type || w.plan || 'none';
    const status = w.billing_status || 'inactive';
    workspaces.push({ id: d.id, name: w.name || d.id, plan, billing_status: status, created_at: w.created_at, slug: w.slug || '' });
    byPlan[plan] = (byPlan[plan] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (!w.trial_active && !['active', 'trialing'].includes(status)) expiredTrials++;
  });

  // Security events (last 100, filter by time in JS)
  let securityEvents = [];
  try {
    const secSnap = await db.collection('global_security_log').orderBy('timestamp', 'desc').limit(100).get();
    const byType = {};
    secSnap.forEach(d => {
      const data = d.data();
      if (data.timestamp && data.timestamp >= h24Iso) {
        const t = data.type || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
      }
    });
    securityEvents = Object.entries(byType).map(([type, count]) => ({ type, count }));
  } catch (e) { console.warn('Diagnostics: security_log query failed:', e.message); }

  // SMS stats (last 200, filter in JS)
  let smsStats = { sent: 0, failed: 0 };
  try {
    const smsSnap = await db.collection('sms_logs').orderBy('created_at', 'desc').limit(200).get();
    smsSnap.forEach(d => {
      const s = d.data();
      if (s.created_at && s.created_at >= h24Iso) {
        if (s.status === 'sent' || s.status === 'delivered') smsStats.sent++;
        else smsStats.failed++;
      }
    });
  } catch (e) { console.warn('Diagnostics: sms_logs query failed:', e.message); }

  // Email stats (last 200, filter in JS)
  let emailStats = { sent: 0, failed: 0 };
  try {
    const emSnap = await db.collection('vurium_emails').orderBy('created_at', 'desc').limit(200).get();
    emSnap.forEach(d => {
      const e = d.data();
      if (e.created_at && e.created_at >= h24Iso) {
        if (e.status === 'sent' || e.status === 'delivered') emailStats.sent++;
        else emailStats.failed++;
      }
    });
  } catch (e) { console.warn('Diagnostics: vurium_emails query failed:', e.message); }

  // Sample up to 10 workspaces for booking/client counts
  const sampleWs = workspaces.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10);
  let totalBookings = 0, totalClients = 0, totalBookingsToday = 0, unpaidCompleted = 0;
  const wsDetails = [];
  for (const ws of sampleWs) {
    try {
      const wsRef = db.collection('workspaces').doc(ws.id);

      // Read settings for shop name and feature flags
      let shopName = ws.name || ws.id, hasOnlineBooking = false, hasSmsEnabled = false, hasLogo = false;
      try {
        const settingsDoc = await wsRef.collection('settings').doc('config').get();
        if (settingsDoc.exists) {
          const cfg = settingsDoc.data();
          shopName = cfg?.shop_name || ws.name || ws.id;
          hasOnlineBooking = !!cfg?.online_booking_enabled;
          hasSmsEnabled = !!cfg?.sms_enabled;
          hasLogo = !!cfg?.logo_url;
        }
      } catch { }

      // Total counts (parallel)
      const [bCountSnap, cCountSnap, barberCountSnap, serviceCountSnap] = await Promise.all([
        wsRef.collection('bookings').count().get(),
        wsRef.collection('clients').count().get(),
        wsRef.collection('barbers').where('active', '==', true).count().get(),
        wsRef.collection('services').count().get(),
      ]);
      const bCount = bCountSnap.data().count || 0;
      const cCount = cCountSnap.data().count || 0;
      const barberCount = barberCountSnap.data().count || 0;
      const serviceCount = serviceCountSnap.data().count || 0;

      // Recent bookings analysis (last 100)
      let todayCount = 0, weekCount = 0, wsUnpaid = 0, completed = 0, cancelled = 0, noShow = 0;
      const bookingsByDay = {};
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      try {
        const recentSnap = await wsRef.collection('bookings').orderBy('start_at', 'desc').limit(100).get();
        recentSnap.forEach(d => {
          const b = d.data();
          const bDate = (b.start_at || b.date || '').slice(0, 10);
          if (bDate === today) todayCount++;
          if (b.start_at && b.start_at >= weekAgo) weekCount++;
          if (bDate) bookingsByDay[bDate] = (bookingsByDay[bDate] || 0) + 1;
          if (b.status === 'completed') completed++;
          if (b.status === 'cancelled' || b.status === 'canceled') cancelled++;
          if (b.status === 'no_show' || b.no_show) noShow++;
          if (b.status === 'completed' && (!b.payment_status || b.payment_status === 'unpaid')) wsUnpaid++;
        });
      } catch { }

      totalBookings += bCount;
      totalClients += cCount;
      totalBookingsToday += todayCount;
      unpaidCompleted += wsUnpaid;
      wsDetails.push({
        name: shopName, plan: ws.plan, status: ws.billing_status,
        bookings: bCount, clients: cCount, barbers: barberCount, services: serviceCount,
        bookings_today: todayCount, bookings_this_week: weekCount,
        completed, cancelled, no_show: noShow, unpaid: wsUnpaid,
        online_booking: hasOnlineBooking, sms_enabled: hasSmsEnabled, has_logo: hasLogo,
        busiest_days: Object.entries(bookingsByDay).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => ({ date: d, count: c })),
      });
    } catch (e) { console.warn('Diagnostics: workspace scan failed for', ws.id, e.message); }
  }

  // Analytics — pageviews + top pages
  let pageviews24h = 0;
  const topPages = {};
  const devices = { desktop: 0, mobile: 0, tablet: 0 };
  try {
    const aSnap = await db.collection('vurium_analytics').orderBy('ts', 'desc').limit(1000).get();
    aSnap.forEach(d => {
      const data = d.data();
      if (data.ts && data.ts >= h24Iso) {
        pageviews24h++;
        const page = data.path || data.page || '/';
        topPages[page] = (topPages[page] || 0) + 1;
        const dev = (data.device || 'desktop').toLowerCase();
        if (dev.includes('mobile') || dev.includes('phone')) devices.mobile++;
        else if (dev.includes('tablet')) devices.tablet++;
        else devices.desktop++;
      }
    });
  } catch (e) { console.warn('Diagnostics: analytics query failed:', e.message); }

  return {
    timestamp: now.toISOString(),
    workspaces: { total: workspaces.length, by_plan: byPlan, by_status: byStatus, expired_trials: expiredTrials, details: wsDetails },
    security: { events_24h: securityEvents },
    sms: smsStats,
    email: emailStats,
    bookings: { total_all_time: totalBookings, total_today: totalBookingsToday, unpaid_completed: unpaidCompleted, total_clients: totalClients, sampled_workspaces: sampleWs.length },
    analytics: {
      pageviews_24h: pageviews24h,
      top_pages: Object.entries(topPages).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, c]) => ({ page: p, views: c })),
      devices,
    },
  };
}

async function runAIDiagnosticScan(triggeredBy = 'auto') {
  const scanRef = db.collection('vurium_diagnostics').doc();
  const startedAt = new Date().toISOString();

  await scanRef.set({ status: 'running', triggered_by: triggeredBy, started_at: startedAt, completed_at: null });

  try {
    if (!anthropic) throw new Error('Anthropic API key not configured');

    // Check for stuck scans (>5 min running)
    const stuckSnap = await db.collection('vurium_diagnostics').where('status', '==', 'running').get();
    stuckSnap.forEach(d => {
      if (d.id !== scanRef.id) {
        const s = d.data();
        if (s.started_at && (Date.now() - new Date(s.started_at).getTime()) > 5 * 60 * 1000) {
          d.ref.update({ status: 'failed', error: 'Scan timed out', completed_at: new Date().toISOString() });
        }
      }
    });

    const metrics = await collectDiagnosticMetrics();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: DIAGNOSTIC_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze these platform health metrics and return JSON:\n\n${JSON.stringify(metrics, null, 2)}` }],
    });

    const rawText = response.content[0]?.text || '{}';
    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      // Try extracting JSON from potential markdown
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { health_score: 0, summary: 'Failed to parse AI response', issues: [] };
    }

    const completedAt = new Date().toISOString();
    const issueCounts = { critical: 0, warning: 0, info: 0 };
    (analysis.issues || []).forEach(i => { if (issueCounts[i.severity] !== undefined) issueCounts[i.severity]++; });

    await scanRef.update({
      status: 'completed',
      completed_at: completedAt,
      duration_ms: Date.now() - new Date(startedAt).getTime(),
      health_score: analysis.health_score || 0,
      summary: analysis.summary || '',
      issues: analysis.issues || [],
      issue_counts: issueCounts,
      metrics_snapshot: metrics,
      ai_model: 'claude-sonnet-4-20250514',
      tokens_used: { input: response.usage?.input_tokens || 0, output: response.usage?.output_tokens || 0 },
      error: null,
    });

    // Cleanup: keep only last 50 scans
    const allScans = await db.collection('vurium_diagnostics').orderBy('started_at', 'desc').offset(50).get();
    const batch = db.batch();
    allScans.forEach(d => batch.delete(d.ref));
    if (!allScans.empty) await batch.commit();

    return scanRef.id;
  } catch (e) {
    console.error('AI diagnostic scan failed:', e.message);
    await scanRef.update({ status: 'failed', completed_at: new Date().toISOString(), error: e.message });
    return scanRef.id;
  }
}

// AI Diagnostics: List scans
app.get('/api/vurium-dev/ai/scans', requireSuperadmin, async (req, res) => {
  try {
    const snap = await db.collection('vurium_diagnostics').orderBy('started_at', 'desc').limit(20).get();
    const scans = [];
    let isFirst = true;
    snap.forEach(d => {
      const data = d.data();
      const scan = {
        id: d.id, status: data.status, triggered_by: data.triggered_by,
        started_at: data.started_at, completed_at: data.completed_at,
        health_score: data.health_score || null, summary: data.summary || '',
        issue_counts: data.issue_counts || { critical: 0, warning: 0, info: 0 },
        duration_ms: data.duration_ms || null,
      };
      // Include full issues for the latest completed scan
      if (isFirst && data.status === 'completed' && data.issues) {
        scan.issues = data.issues;
      }
      if (data.status === 'completed') isFirst = false;
      scans.push(scan);
    });
    const lastCompleted = scans.find(s => s.status === 'completed');
    const nextScanAt = lastCompleted ? new Date(new Date(lastCompleted.started_at).getTime() + 30 * 60 * 1000).toISOString() : null;
    const isRunning = scans.some(s => s.status === 'running');
    res.json({ scans, next_scan_at: nextScanAt, is_running: isRunning });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// AI Diagnostics: Trigger manual scan
app.post('/api/vurium-dev/ai/scan', requireSuperadmin, async (req, res) => {
  try {
    if (!anthropic) return res.status(503).json({ error: 'AI diagnostics not configured (missing ANTHROPIC_API_KEY)' });
    // Check for running scan
    const runningSnap = await db.collection('vurium_diagnostics').where('status', '==', 'running').limit(1).get();
    if (!runningSnap.empty) return res.status(409).json({ error: 'Scan already in progress' });
    // Fire and forget
    const scanId = await runAIDiagnosticScan('manual').catch(() => null);
    res.json({ ok: true, scan_id: scanId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

app.post('/api/vurium-dev/ai/planning-intake', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = AI3PlanningIntakeInputSchema.parse(payload);
    res.json(await executePlanningIntakeWorkflow(meta, context, input));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid planning-intake payload', details: e.issues });
    console.error('AI planning intake error:', e.message);
    res.status(500).json({ error: 'Failed to generate planning intake' });
  }
});

app.post('/api/vurium-dev/ai/qa-scan', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = AI3QAScanInputSchema.parse(payload);
    res.json(await executeQAScanWorkflow(meta, context, input));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid qa-scan payload', details: e.issues });
    console.error('AI QA scan error:', e.message);
    res.status(500).json({ error: 'Failed to generate QA scan' });
  }
});

app.post('/api/vurium-dev/ai/support-inbox-process', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = AI9SupportInboxInputSchema.parse(payload);
    if (!anthropic && !openai) {
      return res.json(buildSupportInboxFallback(input, AI_NOT_CONFIGURED_REASON));
    }
    const result = await runStructuredWorkflowAI({
      workflowName: 'support_inbox_process',
      systemPrompt: AI9_SUPPORT_INBOX_SYSTEM_PROMPT,
      input,
      meta,
      context,
      fallback: buildSupportInboxFallback(input, 'Failed to parse support inbox AI output.'),
      outputSchema: AI9SupportInboxOutputSchema,
      maxTokens: 1800,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid support-inbox payload', details: e.issues });
    console.error('AI support inbox error:', e.message);
    res.status(500).json({ error: 'Failed to process support inbox message' });
  }
});

app.post('/api/vurium-dev/ai/support-inbox-execute', requireSuperadmin, async (req, res) => {
  try {
    const { payload } = unwrapWorkflowEnvelope(req.body);
    const input = AI9SupportInboxOutputSchema.parse(payload);
    const result = AI9SupportExecutionOutputSchema.parse(await finalizeSupportExecution(await executeSupportInboxAction(input)));
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid support-inbox execution payload', details: e.issues });
    console.error('AI support inbox execute error:', e.message);
    res.status(500).json({ error: 'Failed to execute support inbox action' });
  }
});

app.post('/api/vurium-dev/ai/growth-asset-flow', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = GrowthAssetFlowInputSchema.parse(payload);
    res.json(await executeGrowthAssetFlowWorkflow(meta, context, input));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid growth-asset-flow payload', details: e.issues });
    console.error('AI growth asset flow error:', e.message);
    res.status(500).json({ error: 'Failed to generate growth asset flow' });
  }
});

app.post('/api/vurium-dev/ai/research-brief', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = AI5ResearchBriefInputSchema.parse(payload);
    res.json(await executeResearchBriefWorkflow(meta, context, input));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid research-brief payload', details: e.issues });
    console.error('AI research brief error:', e.message);
    res.status(500).json({ error: 'Failed to generate research brief' });
  }
});

app.post('/api/vurium-dev/ai/owner-intake', requireSuperadmin, async (req, res) => {
  try {
    const { meta, context, payload } = unwrapWorkflowEnvelope(req.body);
    const input = OwnerIntakeInputSchema.parse(payload);
    res.json(await executeOwnerIntake(meta, context, input));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid owner-intake payload', details: e.issues });
    console.error('Owner intake error:', e.message);
    res.status(500).json({ error: 'Failed to process owner intake' });
  }
});

app.post('/api/vurium-dev/automation/owner-notify', requireSuperadmin, async (req, res) => {
  try {
    const { payload } = unwrapWorkflowEnvelope(req.body);
    const input = OwnerNotificationInputSchema.parse(payload);
    const result = OwnerNotificationOutputSchema.parse(await sendOwnerNotification(input));
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid owner-notify payload', details: e.issues });
    console.error('Owner notification error:', e.message);
    res.status(500).json({ error: 'Failed to send Owner notification' });
  }
});

app.post('/api/vurium-dev/automation/obsidian-writeback', requireSuperadmin, async (req, res) => {
  try {
    const { payload } = unwrapWorkflowEnvelope(req.body);
    const input = ObsidianWritebackInputSchema.parse(payload);
    const result = ObsidianWritebackOutputSchema.parse(await writeObsidianNote(input));
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid obsidian-writeback payload', details: e.issues });
    console.error('Obsidian writeback error:', e.message);
    res.status(500).json({ error: 'Failed to write Obsidian note' });
  }
});

// AI Diagnostics: Get scan details
app.get('/api/vurium-dev/ai/scans/:id', requireSuperadmin, async (req, res) => {
  try {
    const doc = await db.collection('vurium_diagnostics').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Scan not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

// Apply auth + workspace for all /api/ routes
// API rate limiting middleware (120 req/min per IP)
app.use('/api', (req, res, next) => {
  const rl = checkApiRateLimit(getClientIp(req));
  res.set('X-RateLimit-Limit', String(API_RATE_LIMIT));
  res.set('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.set('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retry_after: rl.retryAfter });
  }
  next();
});
// BUG-013 fix: webhook endpoints must bypass JWT auth middleware — they verify via provider
// signatures (Stripe HMAC, Apple JWS, Telnyx Ed25519) and do not carry user tokens.
// Affected endpoints registered later in the file: /api/stripe/webhook (~10400),
// /api/webhooks/stripe-connect (~7680), /api/webhooks/apple (~10550). Square, Telnyx, and
// Telnyx-10dlc webhooks are already registered before this middleware and so are naturally
// unaffected. Uses `isWebhookEndpoint` helper defined at line ~60 where the global JSON
// parser skip lives.
app.use('/api', (req, res, next) => {
  // Fast path: webhook endpoints skip JWT auth entirely. Inside `/api` mount, req.path
  // is the stripped path (e.g. /stripe/webhook), so we reconstruct the full path before
  // checking the shared helper.
  const fullPath = '/api' + req.path;
  if (isWebhookEndpoint(fullPath)) return next();
  return authenticate(req, res, (err) => {
    if (err) return next(err);
    return requireAuth(req, res, (err2) => {
      if (err2) return next(err2);
      return resolveWorkspace(req, res, next);
    });
  });
});

// Apply only authenticate for /public/ routes (no auth required)
app.use('/public', (req, res, next) => {
  const rl = checkApiRateLimit(getClientIp(req));
  if (!rl.allowed) {
    res.set('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests.', retry_after: rl.retryAfter });
  }
  next();
});
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

// In-memory rate limiter for public endpoints (no Firestore cost)
const publicRateLimits = new Map();
function checkPublicRateLimit(ip, endpoint, maxPerMin = 20) {
  const key = `${endpoint}_${ip}`;
  const now = Date.now();
  const entry = publicRateLimits.get(key);
  if (!entry || now - entry.start > 60000) {
    publicRateLimits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  if (entry.count > maxPerMin) return false;
  return true;
}
// Cleanup old entries every 5 min
setInterval(() => { const now = Date.now(); publicRateLimits.forEach((v, k) => { if (now - v.start > 120000) publicRateLimits.delete(k); }); }, 5 * 60 * 1000);

async function resetRateLimit(ip) {
  const key = `ratelimit_login_${String(ip || 'unknown').replace(/[^a-zA-Z0-9._:-]/g, '_')}`;
  await db.collection('rate_limits').doc(key).delete().catch(() => {});
}

// ============================================================
// GENERAL API RATE LIMITING (in-memory, per IP)
// ============================================================
const _apiRateBuckets = new Map();
const API_RATE_LIMIT = 300;       // max requests per window
const API_RATE_WINDOW = 60 * 1000; // 1 minute window

function checkApiRateLimit(ip) {
  const now = Date.now();
  const key = String(ip || 'unknown');
  const bucket = _apiRateBuckets.get(key);
  if (!bucket || now - bucket.start > API_RATE_WINDOW) {
    _apiRateBuckets.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: API_RATE_LIMIT - 1 };
  }
  bucket.count++;
  if (bucket.count > API_RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((bucket.start + API_RATE_WINDOW - now) / 1000) };
  }
  return { allowed: true, remaining: API_RATE_LIMIT - bucket.count };
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - API_RATE_WINDOW * 2;
  for (const [key, bucket] of _apiRateBuckets) {
    if (bucket.start < cutoff) _apiRateBuckets.delete(key);
  }
}, 5 * 60 * 1000);

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

// Log webhook events for debugging (stored per-workspace or globally)
async function logWebhookEvent(source, eventType, wsId, data) {
  try {
    const doc = { source, event_type: eventType, workspace_id: wsId || '', data: typeof data === 'object' ? JSON.stringify(data).slice(0, 2000) : '', created_at: toIso(new Date()) };
    if (wsId) {
      await db.collection('workspaces').doc(wsId).collection('webhook_logs').add(doc);
    } else {
      await db.collection('webhook_logs').add(doc);
    }
  } catch {} // never block on logging failure
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
  // Use < instead of <= to avoid including an extra day when end falls exactly on midnight
  while (cur.getTime() < end.getTime()) { days.push(new Date(cur)); cur = addMinutes(cur, 24 * 60); }
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
    return { works: ov.enabled === true, startMin: Number(ov.startMin ?? 600), endMin: Number(ov.endMin ?? 1200), dayKey: dateKey, weekday: dow, isOverride: true };
  }
  const sch = barberDoc?.schedule || null;
  const use = normalizeSchedule(sch);
  if (use.perDay && use.perDay[dow]) {
    const daySchedule = use.perDay[dow];
    return { works: daySchedule.enabled !== false, startMin: Number(daySchedule.startMin ?? use.startMin), endMin: Number(daySchedule.endMin ?? use.endMin), dayKey: dateKey, weekday: dow };
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

function ensureWithinSchedule(barberData, startAt, endAt, timeZone = 'America/Chicago') {
  const sch = getScheduleForDate(barberData, startAt, timeZone);
  if (!sch.works) {
    const err = new Error('OUTSIDE_SCHEDULE');
    err.code = 'OUTSIDE_SCHEDULE';
    throw err;
  }
  const parts = getTzParts(startAt, timeZone);
  const workStart = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(sch.startMin / 60), minute: sch.startMin % 60 }, timeZone);
  const workEnd = zonedTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: Math.floor(sch.endMin / 60), minute: sch.endMin % 60 }, timeZone);
  if (startAt < workStart || endAt > workEnd) {
    const err = new Error('OUTSIDE_SCHEDULE');
    err.code = 'OUTSIDE_SCHEDULE';
    throw err;
  }
}

// Client classification
const NOSHOW_STATUSES = new Set(['noshow', 'no_show', 'no-show']);
function isNoshow(s) { return NOSHOW_STATUSES.has(String(s || '').toLowerCase()); }
function classifyClient(clientName, bookings, squareExtra, phoneNorm) {
  // squareExtra: optional { visits: number, tips: number, spend: number } from Square
  // phoneNorm: optional normalized phone to also match bookings by phone
  const now = new Date();
  const clientBookings = bookings.filter(b => {
    if (String(b.client_name || '') === clientName) return true;
    if (phoneNorm && phoneNorm.length >= 10 && String(b.phone_norm || '') === phoneNorm) return true;
    return false;
  });
  const sqVisits = squareExtra?.visits || 0;
  const sqBigTips = squareExtra?.tips ? Math.floor(squareExtra.tips / 30) : 0; // estimate big tip count from total tips
  const totalVisits = clientBookings.length + sqVisits;
  const noShows = clientBookings.filter(b => isNoshow(b.status)).length;
  const completedVisits = totalVisits - noShows;
  const sorted = [...clientBookings].sort((a, b) => String(a.start_at || '').localeCompare(String(b.start_at || '')));
  let visitsAfterLastNoshow = 0, bigTipsAfterLastNoshow = 0, foundNoshow = false;
  for (const b of sorted) {
    if (isNoshow(b.status)) { foundNoshow = true; visitsAfterLastNoshow = 0; bigTipsAfterLastNoshow = 0; }
    else { visitsAfterLastNoshow++; if (Number(b.tip || 0) >= 30) bigTipsAfterLastNoshow++; }
  }
  const bigTipCount = clientBookings.filter(b => Number(b.tip || 0) >= 30 && !isNoshow(b.status)).length + sqBigTips;
  let lastVisitDate = null;
  for (const b of clientBookings) { const d = b.start_at ? new Date(b.start_at) : null; if (d && (!lastVisitDate || d > lastVisitDate)) lastVisitDate = d; }
  const daysSinceLastVisit = lastVisitDate ? (now - lastVisitDate) / (1000 * 60 * 60 * 24) : Infinity;
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const recentVisits = clientBookings.filter(b => { const d = b.start_at ? new Date(b.start_at) : null; return d && d >= sixtyDaysAgo && !isNoshow(b.status); }).length;
  if (noShows >= 1 && foundNoshow) {
    if (bigTipsAfterLastNoshow >= 5) return 'vip';
    if (visitsAfterLastNoshow >= 10) return 'active';
    return 'at_risk';
  }
  if (daysSinceLastVisit >= 90 && totalVisits >= 3) return 'at_risk';
  if (bigTipCount >= 1) return 'vip';
  if (recentVisits >= 2 || sqVisits >= 2) return 'active';
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
app.get('/health', (req, res) => res.json({ ok: true, service: 'vuriumbook-api', version: '3.1.0', uptime: Math.floor(process.uptime()), memory_mb: Math.round(process.memoryUsage().heapUsed / 1048576), timestamp: new Date().toISOString() }));

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
    const { workspace_name, username, password, name, email, phone, timezone, business_type, shop_name } = v.data;

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
      business_type: business_type || null,
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

    // Create default settings doc with business address for SMS/compliance
    const { shop_address, street: bStreet, city: bCity, state: bState, postal_code: bZip } = v.data;
    await wsRef.collection('settings').doc('config').set({
      timezone: timezone || 'America/Chicago',
      shop_name: sanitizeHtml(shop_name || workspace_name),
      shop_address: sanitizeHtml(shop_address || ''),
      shop_street: sanitizeHtml(bStreet || ''),
      shop_city: sanitizeHtml(bCity || ''),
      shop_state: sanitizeHtml(bState || ''),
      shop_zip: sanitizeHtml(bZip || ''),
      shop_phone: phone || null,
      shop_email: sanitizeHtml(email || ''),
      business_type: business_type || null,
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

    // SMS auto-provision on trial start (Gap 5).
    // New workspaces get a dedicated toll-free number automatically — owner does not
    // have to click "Enable SMS" in Settings. Fire-and-forget so signup response is not blocked.
    // Grandfathered manual 10DLC / Element Barbershop guarded inside the helper.
    autoProvisionSmsOnActivation({ id: wsRef.id, name: wsData.name, slug }, 'signup_trial').catch(() => {});

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

// ─── Sign in with Apple ─────────────────────────────────────────────────────
// Apple JWKS cache
let appleJWKSCache = null;
let appleJWKSCacheTime = 0;
const APPLE_JWKS_TTL = 24 * 60 * 60 * 1000; // 24h

async function fetchAppleJWKS() {
  if (appleJWKSCache && Date.now() - appleJWKSCacheTime < APPLE_JWKS_TTL) return appleJWKSCache;
  return new Promise((resolve, reject) => {
    https.get('https://appleid.apple.com/auth/keys', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          appleJWKSCache = JSON.parse(data);
          appleJWKSCacheTime = Date.now();
          resolve(appleJWKSCache);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function jwkToPem(jwk) {
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' });
}

async function verifyAppleToken(identityToken) {
  const header = JSON.parse(Buffer.from(identityToken.split('.')[0], 'base64url').toString());
  const jwks = await fetchAppleJWKS();
  const key = jwks.keys.find(k => k.kid === header.kid);
  if (!key) throw new Error('Apple signing key not found');
  const pem = jwkToPem(key);
  const BUNDLE_ID = 'com.vurium.VuriumBook';
  const SERVICES_ID = 'com.vurium.vuriumbook.web';
  return jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: [BUNDLE_ID, SERVICES_ID],
  });
}

app.post('/auth/apple-signin', async (req, res) => {
  try {
    const { identityToken, userIdentifier, fullName, email } = req.body || {};
    if (!identityToken) return res.status(400).json({ error: 'Missing identityToken' });

    // Verify Apple identity token
    let applePayload;
    try {
      applePayload = await verifyAppleToken(identityToken);
      console.log('[Apple SignIn] Token verified, sub:', applePayload.sub, 'email:', applePayload.email, 'aud:', applePayload.aud);
    } catch (e) {
      console.error('[Apple SignIn] Token verification failed:', e.message);
      // Try to decode without verification for debugging
      try {
        const debugPayload = JSON.parse(Buffer.from(identityToken.split('.')[1], 'base64url').toString());
        console.error('[Apple SignIn] Token aud:', debugPayload.aud, 'iss:', debugPayload.iss, 'sub:', debugPayload.sub);
      } catch {}
      return res.status(401).json({ error: 'Invalid Apple identity token: ' + e.message });
    }

    const appleUserId = applePayload.sub;
    const appleEmail = (applePayload.email || email || '').toLowerCase().trim();
    const userName = fullName?.givenName
      ? `${fullName.givenName} ${fullName.familyName || ''}`.trim()
      : appleEmail.split('@')[0];

    if (!appleUserId) return res.status(400).json({ error: 'Invalid Apple user ID' });

    // 1. Search for existing user by apple_user_id
    const allWs = await db.collection('workspaces').get();
    let foundUser = null, foundWsId = null;

    for (const ws of allWs.docs) {
      const snap = await ws.ref.collection('users')
        .where('apple_user_id', '==', appleUserId).where('active', '==', true).limit(1).get();
      if (!snap.empty) {
        foundUser = { ...snap.docs[0].data(), uid: snap.docs[0].id };
        foundWsId = ws.id;
        break;
      }
    }

    // 2. If not found by apple_user_id, search by email to link accounts
    if (!foundUser && appleEmail) {
      for (const ws of allWs.docs) {
        const snap = await ws.ref.collection('users')
          .where('username', '==', appleEmail).where('active', '==', true).limit(1).get();
        if (!snap.empty) {
          foundUser = { ...snap.docs[0].data(), uid: snap.docs[0].id };
          foundWsId = ws.id;
          // Link Apple ID to existing account
          await ws.ref.collection('users').doc(foundUser.uid).update({
            apple_user_id: appleUserId,
            updated_at: toIso(new Date()),
          });
          console.log(`[Apple SignIn] Linked Apple ID to existing user ${foundUser.uid} in workspace ${ws.id}`);
          break;
        }
      }
    }

    // 3. Found existing user — login
    if (foundUser && foundWsId) {
      const token = jwt.sign({
        uid: foundUser.uid, username: foundUser.username, role: foundUser.role,
        name: foundUser.name, workspace_id: foundWsId,
        barber_id: foundUser.barber_id || null,
        mentor_barber_ids: foundUser.mentor_barber_ids || [],
        permissions: PERMISSIONS[foundUser.role] || {},
      }, JWT_SECRET, { expiresIn: TOKEN_TTL });
      setAuthCookie(res, token);
      writeAuditLog(foundWsId, { action: 'user.login.apple', resource_id: foundUser.uid, data: { apple_user_id: appleUserId }, req }).catch(() => {});
      return res.json({
        ok: true, token,
        user: {
          id: foundUser.uid, uid: foundUser.uid, username: foundUser.username, name: foundUser.name,
          role: foundUser.role, workspace_id: foundWsId, barber_id: foundUser.barber_id || null,
          permissions: PERMISSIONS[foundUser.role] || {},
        },
      });
    }

    // 4. No existing user — create new workspace + owner (signup flow)
    const wsRef = db.collection('workspaces').doc();
    const workspaceName = userName || 'My Business';
    const slug = await generateUniqueSlug(workspaceName);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await wsRef.set({
      name: sanitizeHtml(workspaceName),
      slug,
      plan_type: 'individual',
      billing_status: 'trialing',
      trial_ends_at: toIso(trialEnd),
      trial_used: false,
      owner_username: appleEmail || appleUserId,
      timezone: 'America/Chicago',
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });
    await registerSlug(slug, wsRef.id).catch(() => {});

    const userRef = wsRef.collection('users').doc();
    await userRef.set({
      username: appleEmail || appleUserId,
      name: sanitizeHtml(userName),
      email: appleEmail || null,
      role: 'owner',
      password_hash: null, // Apple users don't have password
      apple_user_id: appleUserId,
      active: true,
      created_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    await wsRef.collection('settings').doc('config').set({
      timezone: 'America/Chicago',
      shop_name: sanitizeHtml(workspaceName),
      created_at: toIso(new Date()),
    });

    const token = jwt.sign({
      uid: userRef.id, username: appleEmail || appleUserId, role: 'owner',
      name: sanitizeHtml(userName), workspace_id: wsRef.id,
      permissions: PERMISSIONS.owner,
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);

    console.log(`[Apple SignIn] Created new workspace ${wsRef.id} for Apple user ${appleUserId}`);
    res.status(201).json({
      ok: true, token, isNewUser: true,
      workspace_id: wsRef.id, slug,
      user: {
        id: userRef.id, uid: userRef.id, username: appleEmail || appleUserId,
        name: sanitizeHtml(userName), role: 'owner', workspace_id: wsRef.id,
        permissions: PERMISSIONS.owner,
      },
    });
  } catch (e) {
    console.error('[Apple SignIn] Error:', e);
    res.status(500).json({ error: e?.message || 'Apple sign-in failed' });
  }
});

// ─── Sign in with Google ────────────────────────────────────────────────────
let googleJWKSCache = null;
let googleJWKSCacheTime = 0;

async function fetchGoogleJWKS() {
  if (googleJWKSCache && Date.now() - googleJWKSCacheTime < APPLE_JWKS_TTL) return googleJWKSCache;
  return new Promise((resolve, reject) => {
    https.get('https://www.googleapis.com/oauth2/v3/certs', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          googleJWKSCache = JSON.parse(data);
          googleJWKSCacheTime = Date.now();
          resolve(googleJWKSCache);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function verifyGoogleToken(idToken) {
  const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64url').toString());
  const jwks = await fetchGoogleJWKS();
  const key = jwks.keys.find(k => k.kid === header.kid);
  if (!key) throw new Error('Google signing key not found');
  const pem = jwkToPem(key);
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  return jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: GOOGLE_CLIENT_ID || undefined,
  });
}

app.post('/auth/google-signin', async (req, res) => {
  try {
    const { idToken, code } = req.body || {};

    let googlePayload;

    if (idToken) {
      // Direct id_token verification
      try {
        googlePayload = await verifyGoogleToken(idToken);
        console.log('[Google SignIn] Token verified, sub:', googlePayload.sub, 'email:', googlePayload.email);
      } catch (e) {
        console.error('[Google SignIn] Token verification failed:', e.message);
        return res.status(401).json({ error: 'Invalid Google identity token: ' + e.message });
      }
    } else if (code) {
      // Exchange authorization code for tokens
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
      const REDIRECT_URI = (process.env.FRONTEND_URL || 'https://vurium.com') + '/api/auth/google-callback';
      const tokenRes = await new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }).toString();
        const req2 = https.request('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
        }, res2 => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req2.on('error', reject);
        req2.write(postData);
        req2.end();
      });
      if (!tokenRes.id_token) {
        console.error('[Google SignIn] Code exchange failed:', tokenRes);
        return res.status(401).json({ error: 'Failed to exchange Google code' });
      }
      try {
        googlePayload = await verifyGoogleToken(tokenRes.id_token);
      } catch (e) {
        // Fallback: decode without verification (token just came from Google)
        googlePayload = JSON.parse(Buffer.from(tokenRes.id_token.split('.')[1], 'base64url').toString());
      }
    } else {
      return res.status(400).json({ error: 'Missing idToken or code' });
    }

    const googleUserId = googlePayload.sub;
    const googleEmail = (googlePayload.email || '').toLowerCase().trim();
    const userName = googlePayload.name || googleEmail.split('@')[0];

    if (!googleUserId) return res.status(400).json({ error: 'Invalid Google user ID' });

    // 1. Search for existing user by google_user_id
    const allWs = await db.collection('workspaces').get();
    let foundUser = null, foundWsId = null;

    for (const ws of allWs.docs) {
      const snap = await ws.ref.collection('users')
        .where('google_user_id', '==', googleUserId).where('active', '==', true).limit(1).get();
      if (!snap.empty) {
        foundUser = { ...snap.docs[0].data(), uid: snap.docs[0].id };
        foundWsId = ws.id;
        break;
      }
    }

    // 2. If not found by google_user_id, search by email
    if (!foundUser && googleEmail) {
      for (const ws of allWs.docs) {
        const snap = await ws.ref.collection('users')
          .where('username', '==', googleEmail).where('active', '==', true).limit(1).get();
        if (!snap.empty) {
          foundUser = { ...snap.docs[0].data(), uid: snap.docs[0].id };
          foundWsId = ws.id;
          await ws.ref.collection('users').doc(foundUser.uid).update({
            google_user_id: googleUserId,
            updated_at: toIso(new Date()),
          });
          console.log(`[Google SignIn] Linked Google ID to existing user ${foundUser.uid}`);
          break;
        }
      }
    }

    // 3. Found existing user — login
    if (foundUser && foundWsId) {
      const token = jwt.sign({
        uid: foundUser.uid, username: foundUser.username, role: foundUser.role,
        name: foundUser.name, workspace_id: foundWsId,
        barber_id: foundUser.barber_id || null,
        mentor_barber_ids: foundUser.mentor_barber_ids || [],
        permissions: PERMISSIONS[foundUser.role] || {},
      }, JWT_SECRET, { expiresIn: TOKEN_TTL });
      setAuthCookie(res, token);
      writeAuditLog(foundWsId, { action: 'user.login.google', resource_id: foundUser.uid, req }).catch(() => {});
      return res.json({
        ok: true, token,
        user: {
          id: foundUser.uid, uid: foundUser.uid, username: foundUser.username, name: foundUser.name,
          role: foundUser.role, workspace_id: foundWsId, barber_id: foundUser.barber_id || null,
          permissions: PERMISSIONS[foundUser.role] || {},
        },
      });
    }

    // 4. New user — create workspace + owner
    const wsRef = db.collection('workspaces').doc();
    const workspaceName = userName || 'My Business';
    const slug = await generateUniqueSlug(workspaceName);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await wsRef.set({
      name: sanitizeHtml(workspaceName), slug,
      plan_type: 'individual', billing_status: 'trialing',
      trial_ends_at: toIso(trialEnd), trial_used: false,
      owner_username: googleEmail || googleUserId,
      timezone: 'America/Chicago',
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    });
    await registerSlug(slug, wsRef.id).catch(() => {});

    const userRef = wsRef.collection('users').doc();
    await userRef.set({
      username: googleEmail || googleUserId,
      name: sanitizeHtml(userName), email: googleEmail || null,
      role: 'owner', password_hash: null,
      google_user_id: googleUserId, active: true,
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    });

    await wsRef.collection('settings').doc('config').set({
      timezone: 'America/Chicago', shop_name: sanitizeHtml(workspaceName),
      created_at: toIso(new Date()),
    });

    const token = jwt.sign({
      uid: userRef.id, username: googleEmail || googleUserId, role: 'owner',
      name: sanitizeHtml(userName), workspace_id: wsRef.id,
      permissions: PERMISSIONS.owner,
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);

    console.log(`[Google SignIn] Created new workspace ${wsRef.id} for Google user ${googleUserId}`);
    res.status(201).json({
      ok: true, token, isNewUser: true,
      workspace_id: wsRef.id, slug,
      user: {
        id: userRef.id, uid: userRef.id, username: googleEmail || googleUserId,
        name: sanitizeHtml(userName), role: 'owner', workspace_id: wsRef.id,
        permissions: PERMISSIONS.owner,
      },
    });
  } catch (e) {
    console.error('[Google SignIn] Error:', e);
    res.status(500).json({ error: e?.message || 'Google sign-in failed' });
  }
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
      alertSecurityBreach('Brute Force Attempt (Rate Limited)', { ip, email: emailLC, window: '15 minutes' });
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
    if (!foundUser || !foundWsId) { trackFailedLogin(ip, email); return res.status(401).json({ error: 'Invalid email or password' }); }
    if (!checkPassword(password, foundUser.password_hash)) { trackFailedLogin(ip, email); return res.status(401).json({ error: 'Invalid email or password' }); }
    // MFA check — if user has MFA enabled, require TOTP code
    if (foundUser.mfa_enabled && foundUser.mfa_secret) {
      const mfaCode = safeStr(req.body?.mfa_code || '');
      if (!mfaCode) {
        return res.status(403).json({ error: 'MFA code required', mfa_required: true });
      }
      if (!verifyTOTP(foundUser.mfa_secret, mfaCode)) {
        trackFailedLogin(ip, email);
        return res.status(401).json({ error: 'Invalid MFA code', mfa_required: true });
      }
    }
    await resetRateLimit(ip);
    const token = jwt.sign({
      uid: foundUser.uid, username: foundUser.username, role: foundUser.role,
      name: foundUser.name, workspace_id: foundWsId,
      barber_id: foundUser.barber_id || null,
      mentor_barber_ids: foundUser.mentor_barber_ids || [],
      permissions: PERMISSIONS[foundUser.role] || {},
    }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);
    writeAuditLog(foundWsId, { action: 'user.login', resource_id: foundUser.uid, data: { username: foundUser.username, mfa: !!foundUser.mfa_enabled }, req }).catch(() => {});
    res.json({
      ok: true, token,
      user: {
        id: foundUser.uid, uid: foundUser.uid, username: foundUser.username, name: foundUser.name,
        role: foundUser.role, workspace_id: foundWsId, barber_id: foundUser.barber_id || null,
        permissions: PERMISSIONS[foundUser.role] || {},
        mfa_enabled: !!foundUser.mfa_enabled,
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
      alertSecurityBreach('Brute Force Attempt (Rate Limited)', { ip, email: safeStr(req.body?.email || ''), window: '15 minutes' });
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

    // MFA check
    if (user.mfa_enabled && user.mfa_secret) {
      const mfaCode = safeStr(req.body?.mfa_code || '');
      if (!mfaCode) {
        return res.status(403).json({ error: 'MFA code required', mfa_required: true });
      }
      if (!verifyTOTP(user.mfa_secret, mfaCode)) {
        trackFailedLogin(ip, username);
        return res.status(401).json({ error: 'Invalid MFA code', mfa_required: true });
      }
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
        id: userDoc.id, uid: userDoc.id, username: user.username, name: user.name,
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

// MFA setup — generate TOTP secret
app.post('/api/auth/mfa/setup', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const userRef = req.ws('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const secret = generateTOTPSecret();
    await userRef.update({ mfa_secret_pending: secret, updated_at: toIso(new Date()) });
    const base32Secret = toBase32(secret);
    const otpauthUrl = `otpauth://totp/Vurium:${encodeURIComponent(userDoc.data().username || userDoc.data().email || 'user')}?secret=${base32Secret}&issuer=Vurium&digits=6&period=30`;
    res.json({ ok: true, secret: base32Secret, otpauth_url: otpauthUrl });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// MFA verify — confirm setup with a valid TOTP code
app.post('/api/auth/mfa/verify', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const code = safeStr(req.body?.code || '');
    if (!code || code.length !== 6) return res.status(400).json({ error: '6-digit code required' });
    const userRef = req.ws('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const pendingSecret = userDoc.data().mfa_secret_pending;
    if (!pendingSecret) return res.status(400).json({ error: 'No MFA setup in progress. Call /api/auth/mfa/setup first.' });
    if (!verifyTOTP(pendingSecret, code)) return res.status(401).json({ error: 'Invalid code. Try again.' });
    // Activate MFA
    await userRef.update({ mfa_secret: pendingSecret, mfa_enabled: true, mfa_secret_pending: null, mfa_enabled_at: toIso(new Date()), updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'user.mfa_enabled', resource_id: req.user.uid, req }).catch(() => {});
    res.json({ ok: true, mfa_enabled: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// MFA disable
app.post('/api/auth/mfa/disable', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const password = safeStr(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'Password required' });
    const userRef = req.ws('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    if (!checkPassword(password, userDoc.data().password_hash)) return res.status(401).json({ error: 'Incorrect password' });
    await userRef.update({ mfa_secret: null, mfa_enabled: false, mfa_secret_pending: null, updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'user.mfa_disabled', resource_id: req.user.uid, req }).catch(() => {});
    res.json({ ok: true, mfa_enabled: false });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// MFA status
app.get('/api/auth/mfa/status', requireAuth, async (req, res) => {
  try {
    const userDoc = await req.ws('users').doc(req.user.uid).get();
    res.json({ mfa_enabled: !!(userDoc.exists && userDoc.data().mfa_enabled) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
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

    // Log security event for account deletion
    alertSecurityBreach('Account Deletion', { workspace: req.wsId, user_id: req.user.uid, role: req.user.role, ip: req.ip });

    if (req.user.role === 'owner') {
      // Owner: delete entire workspace and all subcollections
      const wsRef = db.collection('workspaces').doc(req.wsId);

      // BUG-010 fix: the top-level `slugs` collection and the top-level
      // `phone_number_index` entry (Gap 3) both point into this workspace. If we do
      // not delete them first, the slug stays reserved forever (new signups can
      // never reuse the friendly URL) and the inbound SMS webhook still resolves
      // STOP replies to a dead workspace id.
      try {
        const wsDocSnap = await wsRef.get();
        const slug = wsDocSnap.exists ? (wsDocSnap.data()?.slug || '') : '';
        if (slug) {
          await db.collection('slugs').doc(slug).delete().catch(() => {});
        }
        // Clean up phone_number_index for this workspace's SMS sender
        const cfgSnap = await wsRef.collection('settings').doc('config').get();
        if (cfgSnap.exists) {
          const cfgData = cfgSnap.data() || {};
          const fromNumber = safeStr(cfgData.sms_from_number || '').replace(/\D/g, '');
          if (fromNumber) {
            await db.collection('phone_number_index').doc(fromNumber).delete().catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Slug / phone_number_index cleanup warning:', e?.message);
      }

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
    const pageLimit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 500);
    const snap = await req.ws('clients').orderBy('created_at', 'desc').limit(pageLimit).get();
    let list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, name: decryptPII(data.name), email: decryptPII(data.email), phone: data.phone ? decryptPhone(data.phone) : data.phone };
    });
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
              const sqName = [sc.given_name, sc.family_name].filter(Boolean).join(' ') || 'Square Customer';
              const sqEmail = sc.email_address || '';
              const sqPhoneNorm = (sc.phone_number || '').replace(/\D/g, '');
              const newClient = {
                name: encryptPII(sqName),
                phone: sc.phone_number ? encryptPhone(sc.phone_number) : '', phone_norm: sqPhoneNorm,
                email: encryptPII(sqEmail), square_customer_id: sc.id,
                source: 'square', created_at: toIso(new Date()), updated_at: toIso(new Date()),
              };
              const ref = await req.ws('clients').add(newClient);
              list.push({ id: ref.id, ...newClient, name: sqName, email: sqEmail, phone: sc.phone_number || '' });
            }
          }
        }
      } catch {}
    }

    // Auto-classify (with manual override support)
    try {
      const clientNames = list.map(c => String(c.name || '')).filter(Boolean);
      if (clientNames.length > 0) {
        const allBookings = [];
        for (let i = 0; i < clientNames.length; i += 30) {
          const batch = clientNames.slice(i, i + 30);
          const bSnap = await req.ws('bookings').where('client_name', 'in', batch).orderBy('start_at', 'desc').limit(1000).get();
          allBookings.push(...bSnap.docs.map(d => d.data()));
        }
        list = list.map(c => {
          const computed = classifyClient(String(c.name || ''), allBookings);
          // status_override (if explicitly set) wins over auto-classification
          const override = c.status_override || null;
          return { ...c, client_status: override || computed, client_status_computed: computed };
        });
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
    // Check for duplicate phone (phone_norm is stored unencrypted for lookups)
    const pn = normPhone(phone);
    if (pn) {
      const dupPhone = await req.ws('clients').where('phone_norm', '==', pn).limit(1).get();
      if (!dupPhone.empty) return res.status(409).json({ error: 'Client with this phone already exists', existing_id: dupPhone.docs[0].id, existing_name: decryptPII(dupPhone.docs[0].data().name) });
    }
    // Check for duplicate email — scan and decrypt since emails are encrypted
    if (email) {
      const emailLC = email.toLowerCase().trim();
      const allClients = await req.ws('clients').limit(500).get();
      const dupEmail = allClients.docs.find(d => {
        const stored = decryptPII(d.data().email);
        return stored && stored.toLowerCase() === emailLC;
      });
      if (dupEmail) return res.status(409).json({ error: 'Client with this email already exists', existing_id: dupEmail.id, existing_name: decryptPII(dupEmail.data().name) });
    }
    const plainName = sanitizeHtml(name);
    const plainEmail = sanitizeHtml(email)?.toLowerCase() || null;
    const doc = {
      name: encryptPII(plainName),
      phone: phone ? encryptPhone(phone) : null,
      phone_norm: pn || null,
      email: encryptPII(plainEmail),
      created_at: toIso(new Date()), updated_at: toIso(new Date()),
    };
    const ref = await req.ws('clients').add(doc);
    writeAuditLog(req.wsId, { action: 'client.create', resource_id: ref.id, data: { name: plainName }, req }).catch(() => {});
    res.status(201).json({ id: ref.id, ...doc, name: plainName, email: plainEmail, phone: phone || null, client_status: 'new' });
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
    const decName = decryptPII(data.name);
    const decEmail = decryptPII(data.email);
    const decPhone = data.phone ? decryptPhone(data.phone) : data.phone;
    const bMap = new Map();
    const bSnap = await req.ws('bookings').where('client_name', '==', decName).orderBy('start_at', 'desc').limit(200).get();
    for (const d of bSnap.docs) bMap.set(d.id, { id: d.id, ...d.data() });
    if (data.phone_norm && data.phone_norm.length >= 10) {
      const pSnap = await req.ws('bookings').where('phone_norm', '==', data.phone_norm).orderBy('start_at', 'desc').limit(200).get();
      for (const d of pSnap.docs) { if (!bMap.has(d.id)) bMap.set(d.id, { id: d.id, ...d.data() }); }
    }
    const bookings = [...bMap.values()].sort((a, b) => String(b.start_at || '').localeCompare(String(a.start_at || '')));
    const computed = classifyClient(decName, bookings, undefined, data.phone_norm);
    const override = data.status_override || null;
    const client_status = override || computed;
    res.json({ id: doc.id, ...data, name: decName, email: decEmail, phone: decPhone, bookings, client_status, client_status_computed: computed });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/clients/:id/history', async (req, res) => {
  try {
    const doc = await req.ws('clients').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
    const data = doc.data();
    const decName = decryptPII(data.name);
    const clientPhoneNorm = data.phone_norm || '';
    // Local bookings — by name AND by phone
    const bSnap = await req.ws('bookings').where('client_name', '==', decName).orderBy('start_at', 'desc').limit(200).get();
    const bookingsMap = new Map();
    for (const d of bSnap.docs) bookingsMap.set(d.id, { id: d.id, ...d.data() });
    // Also fetch by phone_norm to catch same client with different name
    if (clientPhoneNorm && clientPhoneNorm.length >= 10) {
      const pSnap = await req.ws('bookings').where('phone_norm', '==', clientPhoneNorm).orderBy('start_at', 'desc').limit(200).get();
      for (const d of pSnap.docs) { if (!bookingsMap.has(d.id)) bookingsMap.set(d.id, { id: d.id, ...d.data() }); }
    }
    const bookings = [...bookingsMap.values()].sort((a, b) => String(b.start_at || '').localeCompare(String(a.start_at || '')));
    const localVisits = bookings.filter(b => !isNoshow(b.status) && b.status !== 'cancelled').length;
    const noShows = bookings.filter(b => isNoshow(b.status)).length;
    const localSpend = bookings.reduce((sum, b) => sum + (Number(b.service_amount || b.amount || 0)), 0);
    const localTips = bookings.reduce((sum, b) => sum + (Number(b.tip || b.tip_amount || 0)), 0);
    let lastVisit = bookings[0]?.start_at || null;
    // Square payments (if connected)
    let sqVisits = 0, sqSpend = 0, sqTips = 0, sqPayments = [];
    const squareCustId = data.square_customer_id;
    if (squareCustId) {
      try {
        const headers = await squareHeaders(req.ws);
        const sqRes = await squareFetch(`/v2/payments?customer_id=${encodeURIComponent(squareCustId)}&limit=100`, { headers });
        if (sqRes.ok) {
          const sqData = await sqRes.json();
          sqPayments = (sqData.payments || []).filter(p => p.status === 'COMPLETED');
          sqVisits = sqPayments.length;
          sqSpend = sqPayments.reduce((sum, p) => sum + ((p.amount_money?.amount || 0) / 100), 0);
          sqTips = sqPayments.reduce((sum, p) => sum + ((p.tip_money?.amount || 0) / 100), 0);
          // Update lastVisit if Square has more recent
          for (const p of sqPayments) {
            if (p.created_at && (!lastVisit || p.created_at > lastVisit)) lastVisit = p.created_at;
          }
        }
      } catch {} // Square not connected or error — skip silently
    }
    const totalVisits = localVisits + sqVisits;
    const totalSpend = localSpend + sqSpend;
    const totalTips = localTips + sqTips;
    const avgTip = totalVisits > 0 ? Math.round((totalTips / totalVisits) * 100) / 100 : 0;
    // Classify with Square data
    const computed = classifyClient(decName, bookings, { visits: sqVisits, tips: sqTips, spend: sqSpend }, clientPhoneNorm);
    const override = data.status_override || null;
    const client_status = override || computed;
    res.json({
      visits: totalVisits, local_visits: localVisits, square_visits: sqVisits,
      spend: Math.round(totalSpend * 100) / 100, tips: Math.round(totalTips * 100) / 100, avg_tip: avgTip,
      no_shows: noShows, last_visit: lastVisit,
      client_status, client_status_computed: computed,
      square_customer_id: squareCustId || null,
    });
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
    if (b.name != null) patch.name = encryptPII(sanitizeHtml(safeStr(b.name)));
    if (b.phone != null) { patch.phone = b.phone ? encryptPhone(safeStr(b.phone)) : null; patch.phone_norm = normPhone(b.phone) || null; }
    if (b.email != null) patch.email = encryptPII(sanitizeHtml(safeStr(b.email)));
    if (b.notes != null) patch.notes = sanitizeHtml(safeStr(b.notes));
    if (b.status != null) patch.status = safeStr(b.status);
    if (b.status_override !== undefined) patch.status_override = b.status_override ? safeStr(b.status_override) : null;
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
    const startFrom = safeStr(req.query?.start_from || req.query?.from || '');
    const startTo = safeStr(req.query?.start_to || req.query?.to || '');
    let query = req.ws('bookings').orderBy('start_at', 'desc').limit(500);
    if (barberId) query = req.ws('bookings').where('barber_id', '==', barberId).orderBy('start_at', 'desc').limit(500);
    const snap = await query.get();
    let list = snap.docs.map(d => {
      const data = d.data();
      // Strip large data URL from list response, send flag instead
      const hasPhoto = !!(data.reference_photo_url || data.reference_photo?.data_url);
      const { reference_photo, reference_photo_url, ...rest } = data;
      // Decrypt encrypted notes
      if (rest.notes) rest.notes = decryptPII(rest.notes);
      if (rest.customer_note) rest.customer_note = decryptPII(rest.customer_note);
      return { id: d.id, ...rest, has_reference_photo: hasPhoto };
    });
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
    // Enrich each booking with client_status from auto-classification (no-show → at_risk etc.)
    try {
      const uniqueNames = [...new Set(list.map(b => String(b.client_name || '')).filter(Boolean))];
      // Also collect unique phone_norms for phone-based matching
      const phoneByName = new Map();
      for (const b of list) {
        const name = String(b.client_name || '');
        const phone = String(b.phone_norm || '');
        if (name && phone && phone.length >= 10) phoneByName.set(name, phone);
      }
      if (uniqueNames.length > 0) {
        // Pull the wider booking history needed for classification — by name AND phone
        const historyBookings = [];
        for (let i = 0; i < uniqueNames.length; i += 30) {
          const batch = uniqueNames.slice(i, i + 30);
          const hSnap = await req.ws('bookings').where('client_name', 'in', batch).orderBy('start_at', 'desc').limit(2000).get();
          historyBookings.push(...hSnap.docs.map(d => d.data()));
        }
        // Also fetch bookings by phone_norm for clients whose name might differ
        const uniquePhones = [...new Set([...phoneByName.values()])];
        for (let i = 0; i < uniquePhones.length; i += 30) {
          const batch = uniquePhones.slice(i, i + 30);
          const pSnap = await req.ws('bookings').where('phone_norm', 'in', batch).orderBy('start_at', 'desc').limit(2000).get();
          for (const d of pSnap.docs) {
            const data = d.data();
            if (!historyBookings.some(h => h.start_at === data.start_at && h.client_name === data.client_name)) {
              historyBookings.push(data);
            }
          }
        }
        // Check if any clients have Square history or existing client records
        const sqExtraByName = new Map();
        try {
          // Check by phone — find client records matching booking phones
          for (const [name, phone] of phoneByName) {
            if (sqExtraByName.has(name)) continue;
            const cSnap = await req.ws('clients').where('phone_norm', '==', phone).limit(1).get();
            if (!cSnap.empty) {
              const cData = cSnap.docs[0].data();
              if (cData.square_customer_id) {
                sqExtraByName.set(name, { visits: 2, tips: 0, spend: 0 });
              }
            }
          }
        } catch {}
        const statusByName = new Map();
        for (const name of uniqueNames) statusByName.set(name, classifyClient(name, historyBookings, sqExtraByName.get(name), phoneByName.get(name)));
        list = list.map(b => ({ ...b, client_status: statusByName.get(String(b.client_name || '')) || 'new' }));
      }
    } catch (e) { console.warn('booking client_status enrich error:', e?.message); }
    res.json(list);

    // Background auto-reconcile: check Square for unmatched payments (throttled, max once per 2 min per workspace)
    const now = Date.now();
    const reconcileKey = `_lastReconcile_${req.wsId}`;
    if (!_apiRateBuckets.has(reconcileKey) || now - (_apiRateBuckets.get(reconcileKey)?.start || 0) > 120000) {
      _apiRateBuckets.set(reconcileKey, { start: now, count: 0 });
      const unpaid = list.filter(b => !b.paid && b.status !== 'cancelled' && b.status !== 'noshow' && b.status !== 'no_show');
      if (unpaid.length > 0) {
        (async () => {
          try {
            const headers = await squareHeaders(req.ws);
            const today = toIso(new Date()).slice(0, 10);
            const sqResp = await squareFetch(`/v2/payments?sort_order=DESC&begin_time=${today}T00:00:00Z`, { headers });
            if (!sqResp.ok) return;
            const sqData = await sqResp.json();
            const sqPayments = (sqData.payments || []).filter(p => (p.status || '').toUpperCase() === 'COMPLETED');
            const prSnap = await req.ws('payment_requests').limit(500).get();
            const matchedIds = new Set(prSnap.docs.map(d => d.data().payment_id).filter(Boolean));
            for (const sp of sqPayments) {
              if (matchedIds.has(sp.id)) continue;
              const spCents = sp.amount_money?.amount || 0; // amount_money = service only (no tip)
              const spDate = (sp.created_at || '').slice(0, 10);
              const spNote = sp.note || '';
              const noteMatch = spNote.match(/Booking\s+(\S+)/i);
              let matched = false;
              // Match by booking_id in note
              if (noteMatch) {
                const bid = noteMatch[1];
                const b = unpaid.find(u => u.id === bid);
                if (b) {
                  await req.ws('bookings').doc(bid).update({ paid: true, payment_status: 'paid', payment_method: 'terminal', payment_id: sp.id, tip: (sp.tip_money?.amount || 0) / 100, tip_amount: (sp.tip_money?.amount || 0) / 100, amount: (sp.amount_money?.amount || 0) / 100, updated_at: toIso(new Date()) }).catch(() => {});
                  await req.ws('payment_requests').add({ booking_id: bid, payment_id: sp.id, amount_cents: sp.amount_money?.amount || 0, tip_cents: sp.tip_money?.amount || 0, payment_method: 'card', status: 'completed', source: 'auto_reconciled', created_at: sp.created_at }).catch(() => {});
                  matched = true;
                }
              }
              // Match by date + amount
              if (!matched) {
                for (const b of unpaid) {
                  const bDate = (b.date || b.start_at?.slice(0, 10) || '');
                  if (bDate !== spDate) continue;
                  const bCents = Math.round((Number(b.service_amount || b.amount || 0)) * 100);
                  if (Math.abs(bCents - spCents) <= 200) {
                    await req.ws('bookings').doc(b.id).update({ paid: true, payment_status: 'paid', payment_method: 'terminal', payment_id: sp.id, tip: (sp.tip_money?.amount || 0) / 100, tip_amount: (sp.tip_money?.amount || 0) / 100, amount: (sp.amount_money?.amount || 0) / 100, updated_at: toIso(new Date()) }).catch(() => {});
                    await req.ws('payment_requests').add({ booking_id: b.id, payment_id: sp.id, amount_cents: sp.amount_money?.amount || 0, tip_cents: sp.tip_money?.amount || 0, payment_method: 'card', status: 'completed', source: 'auto_reconciled', created_at: sp.created_at }).catch(() => {});
                    break;
                  }
                }
              }
            }
          } catch {}
        })();
      }
    }
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/bookings/:id/photo', async (req, res) => {
  try {
    const doc = await req.ws('bookings').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });
    const data = doc.data();
    const photoUrl = data.reference_photo_url || data.reference_photo?.data_url || null;
    res.json({ photo_url: photoUrl });
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
      service_ids: Array.isArray(data.service_ids) ? data.service_ids.filter(Boolean) : [],
      service_name: sanitizeHtml(data.service_name) || null,
      start_at: toIso(startAt),
      end_at: toIso(endAt),
      duration_minutes: durMin,
      status: data.status || 'booked',
      source: data.source || 'crm',
      notes: encryptPII(sanitizeHtml(data.notes)) || null,
      customer_note: encryptPII(sanitizeHtml(data.customer_note)) || null,
      sms_consent: data.sms_consent || false,
      paid: data.paid || false,
      workspace_id: req.wsId,
      client_token: crypto.randomBytes(24).toString('hex'),
      created_by: req.user ? { uid: req.user.uid, name: req.user.name || req.user.username, role: req.user.role } : null,
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
    const cfg = await getWorkspaceEmailConfig(req.wsId);
    const { shopName, logoUrl, tz, template } = cfg;
    const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
    const isLt = ['classic', 'colorful'].includes(template);
    const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
    if (doc.client_phone) {
      // Check SMS opt-out before sending
      const adminPhoneNorm = normPhone(doc.client_phone);
      let adminOptedOut = false;
      if (adminPhoneNorm) {
        const optSnap = await req.ws('clients').where('phone_norm', '==', adminPhoneNorm).where('sms_opt_out', '==', true).limit(1).get();
        adminOptedOut = !optSnap.empty;
      }
      if (!adminOptedOut) {
        const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
        const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
        const prefix = shopName ? `${shopName}: ` : '';
        const wsSmsConf = await getWorkspaceSmsConfig(req.wsId, { allowGlobalFallback: false });
        if (wsSmsConf.canSend) {
          sendSms(doc.client_phone, `${prefix}Your appointment is confirmed for ${dateStr} at ${timeStr} with ${doc.barber_name || 'your specialist'}. Msg freq varies, up to 5 msgs/booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help. https://vurium.com/privacy`, wsSmsConf.fromNumber, req.wsId).catch(() => {});
          scheduleReminders(req.ws, bookingRef.id, doc, tz, shopName, wsSmsConf.fromNumber).catch(() => {});
        }
      }
    }
    sendCrmPushToStaff(req.ws, doc.barber_id, 'New Booking', `${doc.client_name || 'Client'} booked for ${doc.start_at?.slice(0, 10)}`, { type: 'booking_confirmed' }, 'push_booking_confirm', req.user.uid).catch(() => {});
    // Email confirmation
    if (doc.client_email) {
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
      const manageUrl = `https://vurium.com/manage-booking?ws=${req.wsId}&bid=${bookingRef.id}&token=${doc.client_token}`;
      sendEmail(doc.client_email, 'Booking Confirmed', vuriumEmailTemplate('Booking Confirmed', `
        <p>Your appointment has been confirmed:</p>
        <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:${et.text};">${doc.service_name || 'Appointment'}</div>
          <div style="color:${et.muted};margin-top:4px;">with ${doc.barber_name || 'your specialist'}</div>
          <div style="color:${et.accent};font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
        </div>
        <div style="text-align:center;margin:20px 0;display:flex;gap:10px;justify-content:center;">
          <a href="${manageUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${cardBg};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:13px;font-weight:500;">Reschedule</a>
          <a href="${manageUrl}&action=cancel" style="display:inline-block;padding:12px 24px;border-radius:10px;background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.2);color:rgba(255,140,140,.9);text-decoration:none;font-size:13px;font-weight:500;">Cancel</a>
        </div>
      `, shopName, logoUrl, template, cfg.contactInfo), shopName).catch(() => {});
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
    const existingData = existing.data();
    const b = v.data;
    const patch = { updated_at: toIso(new Date()) };
    if (b.client_name != null) patch.client_name = sanitizeHtml(b.client_name);
    if (b.client_phone != null) patch.client_phone = b.client_phone;
    if (b.client_email != null) patch.client_email = b.client_email.toLowerCase();
    if (b.barber_id != null) patch.barber_id = b.barber_id;
    if (b.barber_name != null) patch.barber_name = sanitizeHtml(b.barber_name);
    if (b.service_id != null) patch.service_id = b.service_id;
    if (b.service_ids != null) patch.service_ids = Array.isArray(b.service_ids) ? b.service_ids.filter(Boolean) : [];
    if (b.service_name != null) patch.service_name = sanitizeHtml(b.service_name);
    if (b.start_at != null) patch.start_at = b.start_at;
    if (b.end_at != null) patch.end_at = b.end_at;
    if (b.duration_minutes != null) patch.duration_minutes = b.duration_minutes;
    if (b.status != null) patch.status = b.status;
    if (b.notes != null) patch.notes = encryptPII(sanitizeHtml(b.notes));
    if (b.customer_note != null) patch.customer_note = encryptPII(sanitizeHtml(b.customer_note));
    if (b.paid != null) patch.paid = b.paid;
    if (b.payment_status != null) patch.payment_status = b.payment_status;
    if (b.payment_method != null) patch.payment_method = b.payment_method;
    if (b.tip != null) patch.tip = b.tip;
    if (b.tip_amount != null) patch.tip_amount = b.tip_amount;
    if (b.amount != null) patch.amount = b.amount;
    if (b.service_amount != null) patch.service_amount = b.service_amount;

    // Helper: send client email after update
    const notifyClient = async (savedData) => {
      const clientEmail = savedData.client_email || existingData.client_email;
      if (!clientEmail) return;
      const cfg = await getWorkspaceEmailConfig(req.wsId);
      const { shopName, logoUrl, tz, template } = cfg;
      const manageUrl = `https://vurium.com/manage-booking?ws=${req.wsId}&bid=${req.params.id}&token=${savedData.client_token || existingData.client_token}`;
      const serviceName = savedData.service_name || existingData.service_name || 'Appointment';
      const barberName = savedData.barber_name || existingData.barber_name || 'your specialist';
      const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
      const isLt = ['classic', 'colorful'].includes(template);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';

      // Rescheduled
      if (patch.start_at && patch.start_at !== existingData.start_at) {
        const newStart = parseIso(patch.start_at);
        const timeStr = newStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
        const dateStr = newStart.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
        sendEmail(clientEmail, 'Appointment Rescheduled', vuriumEmailTemplate('Appointment Rescheduled', `
          <p>Your appointment has been rescheduled:</p>
          <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
            <div style="font-size:16px;font-weight:600;color:${et.text};">${serviceName}</div>
            <div style="color:${et.muted};margin-top:4px;">with ${barberName}</div>
            <div style="color:${et.accent};font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
          </div>
          <div style="text-align:center;margin:20px 0;">
            <a href="${manageUrl}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:13px;font-weight:500;">Manage Booking</a>
          </div>
        `, shopName, logoUrl, template, cfg.contactInfo), shopName).catch(() => {});
      }

      // Satisfaction ping — schedule SMS + email 2h after completion
      if ((patch.status === 'done' || patch.status === 'completed') && existingData.status !== 'done' && existingData.status !== 'completed') {
        scheduleSatisfactionPing(req.wsId, req.ws, req.params.id, { ...existingData, ...savedData }).catch(() => {});
      }

      // Cancelled via status change
      if (patch.status === 'cancelled' && existingData.status !== 'cancelled') {
        sendEmail(clientEmail, 'Appointment Cancelled', vuriumEmailTemplate('Appointment Cancelled', `
          <p>Your appointment has been cancelled:</p>
          <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
            <div style="font-size:16px;font-weight:600;color:${et.text};">${serviceName}</div>
            <div style="color:${et.muted};margin-top:4px;">with ${barberName}</div>
          </div>
          <p style="font-size:12px;color:${et.muted};">To book a new appointment, visit our booking page.</p>
        `, shopName, logoUrl, template, cfg.contactInfo), shopName).catch(() => {});
        // Waitlist auto-fill — notify waitlist when cancellation opens a slot
        tryWaitlistAutoFill(req.wsId, { ...existingData, ...savedData }).catch(() => {});
      }
    };

    // If rescheduling, check conflicts
    if (b.start_at && b.barber_id) {
      const startAt = parseIso(b.start_at);
      const endAt = b.end_at ? parseIso(b.end_at) : (startAt ? addMinutes(startAt, b.duration_minutes || existingData.duration_minutes || 30) : null);
      if (startAt && endAt) {
        try {
          await db.runTransaction(async (tx) => {
            await ensureNoConflictTx(tx, req.ws('bookings'), { barberId: b.barber_id, startAt, endAt, excludeBookingId: req.params.id });
            tx.update(ref, patch);
          });
          const saved = await ref.get();
          writeAuditLog(req.wsId, { action: 'booking.update', resource_id: req.params.id, data: patch, req }).catch(() => {});
          notifyClient(saved.data()).catch(() => {});
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
    notifyClient(saved.data()).catch(() => {});
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
    // SMS cancellation notification (check opt-out first)
    if (bookingData.client_phone) {
      const cancelPhoneNorm = normPhone(bookingData.client_phone);
      let cancelOptedOut = false;
      if (cancelPhoneNorm) {
        const coSnap = await req.ws('clients').where('phone_norm', '==', cancelPhoneNorm).where('sms_opt_out', '==', true).limit(1).get();
        cancelOptedOut = !coSnap.empty;
      }
      if (!cancelOptedOut) {
        const cancelSettings = await req.ws('settings').doc('config').get();
        const cancelShopName = cancelSettings.exists ? safeStr(cancelSettings.data()?.shop_name || '') : '';
        const cancelPrefix = cancelShopName ? `${cancelShopName}: ` : '';
        const cancelSmsConf = await getWorkspaceSmsConfig(req.wsId, { allowGlobalFallback: false });
        if (cancelSmsConf.canSend) {
          sendSms(bookingData.client_phone, `${cancelPrefix}Your appointment with ${bookingData.barber_name || 'your specialist'} has been cancelled. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, cancelSmsConf.fromNumber, req.wsId).catch(() => {});
        }
      }
    }
    sendCrmPushToBarber(req.ws, bookingData.barber_id, 'Booking Cancelled', `${bookingData.client_name || 'Client'} cancelled`, { type: 'booking_cancelled' }, 'push_cancel').catch(() => {});
    // Waitlist auto-fill
    tryWaitlistAutoFill(req.wsId, bookingData).catch(() => {});
    // Email cancellation notification
    if (bookingData.client_email) {
      const cfg = await getWorkspaceEmailConfig(req.wsId);
      const { shopName: cfgShop, logoUrl, template } = cfg;
      const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
      const isLt = ['classic', 'colorful'].includes(template);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      sendEmail(bookingData.client_email, 'Booking Cancelled', vuriumEmailTemplate('Booking Cancelled', `
        <p>Your appointment has been cancelled:</p>
        <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:${et.text};">${bookingData.service_name || 'Appointment'}</div>
          <div style="color:${et.muted};margin-top:4px;">with ${bookingData.barber_name || 'your specialist'}</div>
        </div>
        <p style="font-size:12px;color:${et.muted};">To book a new appointment, visit our booking page.</p>
      `, cfgShop, logoUrl, template, cfg.contactInfo), cfgShop).catch(() => {});
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
// Lightweight staff list for messaging — all authenticated users can see team members
app.get('/api/staff', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const snap = await req.ws('users').where('active', '==', true).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, role: data.role, photo_url: data.photo_url || null };
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/users', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const snap = await req.ws('users').get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, username: data.username, name: data.name, role: data.role, active: data.active, deleted: data.deleted || false, barber_id: data.barber_id || null, phone: data.phone || null, photo_url: data.photo_url || null, schedule: data.schedule || null, created_at: data.created_at, updated_at: data.updated_at };
    }).filter(u => !u.deleted);
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
    const emailLC = email ? email.toLowerCase() : null;
    // Check uniqueness within workspace
    const existing = await req.ws('users').where('username', '==', usernameLC).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Username already exists' });
    // Check email uniqueness within workspace
    if (emailLC) {
      const emailExists = await req.ws('users').where('email', '==', emailLC).limit(1).get();
      if (!emailExists.empty) return res.status(409).json({ error: 'A team member with this email already exists' });
    }
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
    // Send welcome email with login details
    if (doc.email) {
      getWorkspaceEmailConfig(req.wsId).then(cfg => {
        const roleLabel = (role === 'admin') ? 'Admin' : 'Team Member';
        const bodyHtml = `
          <p style="margin:0 0 16px;">Welcome to <strong>${cfg.shopName || 'VuriumBook'}</strong>! An account has been created for you.</p>
          <div style="padding:16px 20px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin:0 0 20px;">
            <div style="margin:0 0 8px;"><strong>Role:</strong> ${roleLabel}</div>
            <div style="margin:0 0 8px;"><strong>Login email:</strong> ${doc.email}</div>
            <div style="margin:0;"><strong>Password:</strong> the one set by your manager</div>
          </div>
          <p style="margin:0 0 16px;">Sign in at:</p>
          <a href="https://vurium.com/signin" style="display:inline-block;padding:12px 28px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Sign In to VuriumBook&trade;</a>
          <p style="margin:20px 0 0;font-size:12px;opacity:.5;">If you didn't expect this email, you can safely ignore it. Use "Forgot password" on the sign-in page if you need to reset your password.</p>`;
        sendEmail(doc.email, `Your ${cfg.shopName || 'VuriumBook'} Account`, vuriumEmailTemplate('Welcome to the Team!', bodyHtml, cfg.shopName, cfg.logoUrl, cfg.template, cfg.contactInfo), cfg.shopName);
      }).catch(() => {});
    }
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
    if (req.params.id === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself — use Delete Account in Settings' });
    const ref = req.ws('users').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const userData = doc.data();
    if (userData.role === 'owner') return res.status(400).json({ error: 'Cannot delete the owner account this way — owner must use Delete Account in Settings' });
    const hard = String(req.query?.hard || '') === 'true';
    if (hard) {
      // Hard delete: remove the user document entirely + push tokens
      await ref.delete();
      try {
        const tokSnap = await req.ws('crm_push_tokens').where('user_id', '==', req.params.id).get();
        const batch = db.batch();
        tokSnap.docs.forEach(d => batch.delete(d.ref));
        if (tokSnap.docs.length) await batch.commit();
      } catch {}
    } else {
      await ref.update({ active: false, deleted: true, updated_at: toIso(new Date()) });
    }
    writeAuditLog(req.wsId, { action: 'user.delete', resource_id: req.params.id, hard, req }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PAYMENTS (Square + local)
// ============================================================
app.get('/api/payments', requireCustomPerm('pages.payments'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    const barberId = safeStr(req.query?.barber_id || '');
    // Local payment_requests
    const payLimit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 1000);
    const prSnap = await req.ws('payment_requests').orderBy('created_at', 'desc').limit(payLimit).get();
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
    if (from) payments = payments.filter(p => (p.created_at || '').slice(0, 10) >= from.slice(0, 10));
    if (to) payments = payments.filter(p => (p.created_at || '').slice(0, 10) <= to.slice(0, 10));
    // Normalize each payment to a consistent format for the frontend
    const normalized = payments.map(p => {
      // For local payments: service_amount is in dollars, amount_cents is total (incl tax/fees)
      // For Square: amount_cents is service amount in cents
      const isLocal = p.source === 'local';
      const amount = isLocal && p.service_amount ? Number(p.service_amount) : Number(p.amount_cents || 0) / 100;
      // tip_amount is in dollars for local, tip_cents is in cents for Square
      const tip = p.tip_cents ? Number(p.tip_cents) / 100 : Number(p.tip_amount || 0);
      const fee = p.fee_cents ? Number(p.fee_cents) / 100 : Number(p.fee_amount || 0);
      const method = p.payment_method || p.method || (p.card_brand ? 'card' : 'other');
      const rawStatus = (p.status || '').toLowerCase();
      const status = rawStatus === 'completed' ? 'paid' : rawStatus;
      const date = (p.created_at || p.date || '').slice(0, 10);
      return {
        id: p.id,
        square_id: p.payment_id || p.square_id || null,
        source: p.source || 'local',
        date,
        created_at: p.created_at || '',
        client_name: p.client_name || '',
        client_phone: p.client_phone || '',
        barber_name: p.barber_name || '',
        barber_id: p.barber_id || '',
        method,
        amount,
        tip,
        fee,
        net: amount + tip - fee,
        status,
        note: p.note || (p.service_name ? `VuriumBook • ${p.client_name || ''} • ${p.service_name || ''}` : ''),
        receipt_url: p.receipt_url || '',
        booking_id: p.booking_id || '',
      };
    });
    // Totals
    const totalGross = normalized.reduce((s, p) => s + p.amount + p.tip, 0);
    const totalTips = normalized.reduce((s, p) => s + p.tip, 0);
    const totalFees = normalized.reduce((s, p) => s + p.fee, 0);
    const totalNet = normalized.reduce((s, p) => s + p.net, 0);
    res.json({ payments: normalized, totals: { gross: totalGross, tips: totalTips, fees: totalFees, net: totalNet, count: normalized.length } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// AUTO-RECONCILE SQUARE PAYMENTS WITH BOOKINGS
// ============================================================
app.post('/api/payments/reconcile', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws);
    const from = safeStr(req.body?.from || req.query?.from || '');
    const to = safeStr(req.body?.to || req.query?.to || '');
    // Fetch Square payments
    const params = new URLSearchParams();
    if (from) params.set('begin_time', from + 'T00:00:00Z');
    if (to) params.set('end_time', to + 'T23:59:59Z');
    params.set('sort_order', 'DESC');
    const sqResp = await squareFetch(`/v2/payments?${params}`, { headers });
    if (!sqResp.ok) return res.status(sqResp.status).json({ error: 'Failed to fetch Square payments' });
    const sqData = await sqResp.json();
    const sqPayments = (sqData.payments || []).filter(p => (p.status || '').toUpperCase() === 'COMPLETED');

    // Get unpaid bookings in date range
    let bookingsQuery = req.ws('bookings').orderBy('start_at', 'desc').limit(500);
    const bSnap = await bookingsQuery.get();
    const unpaidBookings = bSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => !b.paid && b.status !== 'cancelled' && b.status !== 'noshow');

    // Get existing payment_requests to skip already-matched
    const prSnap = await req.ws('payment_requests').limit(500).get();
    const matchedPaymentIds = new Set(prSnap.docs.map(d => d.data().payment_id).filter(Boolean));

    let matched = 0;
    const results = [];

    for (const sp of sqPayments) {
      if (matchedPaymentIds.has(sp.id)) continue; // already tracked
      const spServiceCents = sp.amount_money?.amount || 0; // amount_money = service only (no tip)
      const spTipCents = sp.tip_money?.amount || 0;
      const spDate = (sp.created_at || '').slice(0, 10);
      const spNote = sp.note || '';

      // Try to extract booking_id from note (format: "Booking XXXXX")
      const noteMatch = spNote.match(/Booking\s+(\S+)/i);

      let bestMatch = null;
      let matchReason = '';

      // Strategy 1: Direct booking_id from note
      if (noteMatch) {
        const bid = noteMatch[1];
        const booking = unpaidBookings.find(b => b.id === bid);
        if (booking) { bestMatch = booking; matchReason = 'booking_id in note'; }
      }

      // Strategy 2: Match by date + amount (within $2 tolerance)
      if (!bestMatch) {
        for (const b of unpaidBookings) {
          const bDate = (b.date || b.start_at?.slice(0, 10) || '');
          if (bDate !== spDate) continue;
          const bAmountCents = Math.round((Number(b.service_amount || b.amount || 0)) * 100);
          if (Math.abs(bAmountCents - spServiceCents) <= 200) {
            bestMatch = b;
            matchReason = `date+amount (${bDate}, $${(spServiceCents/100).toFixed(2)} ≈ $${(bAmountCents/100).toFixed(2)})`;
            break;
          }
        }
      }

      if (bestMatch) {
        // Create payment_request record
        await req.ws('payment_requests').add({
          checkout_id: null, booking_id: bestMatch.id, payment_id: sp.id,
          amount_cents: spServiceCents, tip_cents: spTipCents,
          payment_method: 'card', status: 'completed',
          client_name: bestMatch.client_name || '', service_name: bestMatch.service_name || '',
          service_amount: Number(bestMatch.service_amount || 0),
          card_brand: sp.card_details?.card?.card_brand || '', last_4: sp.card_details?.card?.last_4 || '',
          source: 'reconciled', created_at: sp.created_at, completed_at: sp.created_at,
          matched_by: matchReason,
        });
        // Mark booking as paid
        await req.ws('bookings').doc(bestMatch.id).update({
          paid: true, payment_status: 'paid', payment_method: 'terminal',
          payment_id: sp.id,
          tip: spTipCents / 100, tip_amount: spTipCents / 100,
          amount: spServiceCents / 100,
          updated_at: toIso(new Date()),
        }).catch(() => {});
        // Remove from unpaid list
        const idx = unpaidBookings.findIndex(b => b.id === bestMatch.id);
        if (idx >= 0) unpaidBookings.splice(idx, 1);
        matched++;
        results.push({ booking: bestMatch.client_name, payment: sp.id, tip: spTipCents / 100, reason: matchReason });
        matchedPaymentIds.add(sp.id);
      }
    }

    res.json({ ok: true, matched, total_square: sqPayments.length, unmatched_bookings: unpaidBookings.length, results });
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
    let total = 0;
    const by_category = {};
    snap.docs.forEach(d => {
      const data = d.data() || {};
      const amt = Number(data.amount || 0);
      total += amt;
      const cat = data.category || 'Other';
      by_category[cat] = (by_category[cat] || 0) + amt;
    });
    res.json({ total, count: snap.size, by_category });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/expenses', requirePlanFeature('expenses'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    let query = req.ws('expenses');
    if (from) query = query.where('date', '>=', from);
    if (to) query = query.where('date', '<=', to);
    query = query.orderBy('date', 'desc');
    const snap = await query.limit(200).get();
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
    let q = req.ws('attendance').orderBy('date', 'desc');
    const from = safeStr(req.query.from || '');
    const to = safeStr(req.query.to || '');
    if (from) q = q.where('date', '>=', from);
    if (to) q = q.where('date', '<=', to);
    const snap = await q.limit(200).get();
    res.json({ attendance: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/attendance/status', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    // Use workspace timezone for "today" (not UTC)
    const settingsDoc = await req.ws('settings').doc('config').get();
    const tz = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    // Get ALL today's records to find the latest one and sum total minutes
    const snap = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', today)
      .get();
    if (snap.empty) return res.json({ clocked_in: false, today_minutes: 0 });
    // Find latest record (most recent clock_in)
    let latest = snap.docs[0];
    let totalMinutes = 0;
    snap.docs.forEach(d => {
      const dd = d.data();
      if (dd.clock_in && (!latest.data().clock_in || dd.clock_in > latest.data().clock_in)) latest = d;
      if (dd.duration_minutes) totalMinutes += dd.duration_minutes;
    });
    const data = latest.data();
    if (!data.clock_out && data.clock_in) {
      totalMinutes += Math.round((Date.now() - new Date(data.clock_in).getTime()) / 60000);
    }
    res.json({ clocked_in: !data.clock_out, today_minutes: totalMinutes, clock_in: data.clock_in, ...data, id: latest.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-in', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    const now = new Date();
    // Load settings once for timezone + geofence
    const settingsDoc = await req.ws('settings').doc('config').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const tz = settings.timezone || 'America/Chicago';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
    // Prevent double clock-in — check if already clocked in today
    const existing = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', today)
      .get();
    const alreadyClockedIn = existing.docs.some(d => !d.data().clock_out);
    if (alreadyClockedIn) return res.status(409).json({ error: 'Already clocked in' });
    // GPS geofence check
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    let atShop = false;
    let distanceMeters = null;
    if (lat && lng && settings.geofence_lat && settings.geofence_lng) {
      const dist = haversineMeters(lat, lng, Number(settings.geofence_lat), Number(settings.geofence_lng));
      const radius = Number(settings.geofence_radius_m || 500);
      distanceMeters = Math.round(dist);
      atShop = dist <= radius;
      if (!atShop) return res.status(403).json({ error: `You are too far from the shop to clock in (${distanceMeters}m away, max ${radius}m)`, distance_m: distanceMeters });
    } else if (lat && lng) {
      // GPS provided but no geofence configured — allow but mark unknown
      atShop = false;
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
      at_shop: atShop,
      distance_meters: distanceMeters,
      created_at: toIso(now),
    };
    const ref = await req.ws('attendance').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/attendance/clock-out', requirePlanFeature('attendance'), async (req, res) => {
  try {
    const userId = req.user.uid;
    // Use workspace timezone for "today"
    const tzDoc = await req.ws('settings').doc('config').get();
    const tz = tzDoc.exists ? (tzDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const snap = await req.ws('attendance')
      .where('user_id', '==', userId)
      .where('date', '==', today)
      .get();
    if (snap.empty) return res.status(404).json({ error: 'No clock-in found for today' });
    // Find the open record (no clock_out)
    const openDoc = snap.docs.find(d => !d.data().clock_out);
    if (!openDoc) return res.status(404).json({ error: 'No active clock-in found' });
    const docRef = openDoc.ref;
    const existing = openDoc.data();
    const clockOutTime = new Date();
    const durationMinutes = existing.clock_in ? Math.round((clockOutTime.getTime() - new Date(existing.clock_in).getTime()) / 60000) : null;
    await docRef.update({ clock_out: toIso(clockOutTime), duration_minutes: durationMinutes });
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
    const existing = snap.docs[0].data();
    const clockOutTime = req.body?.clock_out ? toIso(parseIso(req.body.clock_out) || new Date()) : toIso(new Date());
    const durationMinutes = existing.clock_in ? Math.round((new Date(clockOutTime).getTime() - new Date(existing.clock_in).getTime()) / 60000) : null;
    await docRef.update({ clock_out: clockOutTime, duration_minutes: durationMinutes, admin_clock_out: true, admin_id: req.user.uid });
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
// Get last message preview for each DM conversation
app.get('/api/messages/dm-previews', requirePlanFeature('messages'), async (req, res) => {
  try {
    const userId = req.user.uid;
    const snap = await req.ws('messages').where('chatType', '>=', 'dm_').where('chatType', '<=', 'dm_\uf8ff').orderBy('chatType').orderBy('createdAt', 'desc').get();
    const previews = {};
    for (const d of snap.docs) {
      const data = d.data();
      // Only include DMs that involve this user
      if (!data.chatType.includes(userId)) continue;
      // Only keep the latest message per chatType
      if (previews[data.chatType]) continue;
      previews[data.chatType] = {
        text: data.content || (data.imageUrl ? '📷 Photo' : data.audioUrl ? '🎤 Voice' : data.fileUrl ? '📎 File' : ''),
        senderName: data.sender_name || '',
        senderId: data.sender_id || '',
        time: data.createdAt || '',
      };
    }
    res.json(previews);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Fix broken DM chatTypes where uid was empty (dm__recipientId -> dm_senderId_recipientId)
app.post('/api/messages/fix-dm', requireRole('owner'), async (req, res) => {
  try {
    const snap = await req.ws('messages').where('chatType', '>=', 'dm__').where('chatType', '<=', 'dm__\uf8ff').get();
    let fixed = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const senderId = data.sender_id;
      if (!senderId) continue;
      // chatType is dm__recipientId — extract recipientId
      const recipientId = data.chatType.replace('dm__', '');
      if (!recipientId) continue;
      // Build correct chatType with sorted IDs
      const correctChatType = 'dm_' + [senderId, recipientId].sort().join('_');
      await d.ref.update({ chatType: correctChatType });
      fixed++;
    }
    res.json({ ok: true, fixed, total: snap.size });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/messages', requirePlanFeature('messages'), async (req, res) => {
  try {
    const chatType = safeStr(req.query?.chatType || 'general');
    const msgLimit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);
    // 'team' includes old 'general' messages for backward compat
    const snap = chatType === 'team'
      ? await req.ws('messages').where('chatType', 'in', ['team', 'general']).orderBy('createdAt', 'desc').limit(msgLimit).get()
      : await req.ws('messages').where('chatType', '==', chatType).orderBy('createdAt', 'desc').limit(msgLimit).get();
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
      sendCrmPush(req.ws, otherUid, pushTitle, pushBody, pushData, 'push_chat_messages').catch(() => {});
    } else {
      const chatRoleMap = { general: ['owner', 'admin', 'barber'], team: ['owner', 'admin', 'barber'], barbers: ['barber'], admins: ['owner', 'admin'], students: ['student'] };
      const targetRoles = chatRoleMap[doc.chatType] || ['owner', 'admin', 'barber'];
      sendCrmPushToRoles(req.ws, targetRoles, pushTitle, pushBody, pushData, req.user.uid, 'push_chat_messages').catch(() => {});
    }
    res.status(201).json({ id: ref.id, ...doc });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// BE.4: toggle an emoji reaction on a message.
// Frontend has supported long-press reactions for weeks, but this endpoint was
// missing — every reaction tap returned 404 in production.
// Stored shape: `reactions: { [emoji]: uid[] }` — if uid is already in the array
// for that emoji we remove it (untoggle), otherwise we add it. A Firestore
// transaction keeps concurrent taps from stomping each other; `@google-cloud/firestore`
// does not expose a directly-imported `FieldValue`, so we use read-modify-write.
app.patch('/api/messages/:id/reactions', requirePlanFeature('messages'), async (req, res) => {
  try {
    const msgId = safeStr(req.params.id);
    if (!msgId) return res.status(400).json({ error: 'message id required' });
    const emojiRaw = safeStr(req.body?.emoji || '');
    // Allow only a small fixed set of emojis to match the frontend picker and
    // avoid unbounded keys in the Firestore doc.
    const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '🔥', '👏', '😢']);
    if (!ALLOWED_REACTIONS.has(emojiRaw)) return res.status(400).json({ error: 'unsupported emoji' });

    const uid = safeStr(req.user.uid);
    if (!uid) return res.status(401).json({ error: 'no user' });

    const msgRef = req.ws('messages').doc(msgId);
    let toggled = 'unchanged';
    let finalReactions = {};

    await db.runTransaction(async (tx) => {
      const msgDoc = await tx.get(msgRef);
      if (!msgDoc.exists) {
        const err = new Error('message not found');
        err.statusCode = 404;
        throw err;
      }
      const current = msgDoc.data() || {};
      const reactions = (current.reactions && typeof current.reactions === 'object') ? { ...current.reactions } : {};
      const arr = Array.isArray(reactions[emojiRaw]) ? reactions[emojiRaw].slice() : [];
      if (arr.includes(uid)) {
        const filtered = arr.filter(u => u !== uid);
        if (filtered.length === 0) delete reactions[emojiRaw];
        else reactions[emojiRaw] = filtered;
        toggled = 'removed';
      } else {
        reactions[emojiRaw] = [...arr, uid];
        toggled = 'added';
      }
      finalReactions = reactions;
      tx.update(msgRef, { reactions });
    });

    res.json({ ok: true, toggled, reactions: finalReactions });
  } catch (e) {
    if (e?.statusCode === 404) return res.status(404).json({ error: e.message });
    res.status(500).json({ error: e?.message });
  }
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
    // Include all active barbers even if they have no bookings in the period
    for (const [bid, profile] of Object.entries(barberProfiles)) {
      if (profile.active === false) continue;
      if (!byBarber[bid]) {
        byBarber[bid] = {
          barber_id: bid,
          barber_name: profile.name || bid,
          barber_photo: profile.photo || profile.avatar || '',
          barber_level: profile.level || '',
          bookings_count: 0, client_count: 0,
          service_total: 0, tips_total: 0,
          bookings: [],
        };
      }
    }
    res.json({ barbers: Object.values(byBarber), period: { from, to } });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ─── Payroll Smart Audit ─────────────────────────────────────────────────────
app.get('/api/payroll/audit', requirePlanFeature('payroll'), requireRole('owner'), async (req, res) => {
  try {
    const from = safeStr(req.query?.from || '');
    const to = safeStr(req.query?.to || '');
    const checks = [];

    // Fetch all data in parallel
    let bQuery = req.ws('bookings');
    if (from) bQuery = bQuery.where('start_at', '>=', from);
    if (to) bQuery = bQuery.where('start_at', '<=', to);
    let eQuery = req.ws('expenses');
    const fromDate = from ? from.slice(0, 10) : '';
    const toDate = to ? to.slice(0, 10) : '';
    if (fromDate) eQuery = eQuery.where('date', '>=', fromDate);
    if (toDate) eQuery = eQuery.where('date', '<=', toDate);

    const [bookingsSnap, paymentsSnap, attSnap, expSnap, rulesSnap, cashSnap, usersSnap] = await Promise.all([
      bQuery.get(),
      req.ws('payment_requests').orderBy('created_at', 'desc').limit(500).get(),
      req.ws('attendance').orderBy('date', 'desc').limit(300).get(),
      eQuery.get(),
      req.ws('payroll_rules').get(),
      req.ws('cash_reports').orderBy('date', 'desc').limit(60).get(),
      req.ws('users').get(),
    ]);

    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.status !== 'cancelled');
    const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const attendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const expenses = expSnap.docs;
    const rules = {};
    rulesSnap.docs.forEach(d => { rules[d.id] = d.data(); });
    const cashReports = cashSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const admins = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'admin' && u.active !== false);

    // ── Check 1: Unpaid completed bookings ──
    // Only flag real completed services, not blocks/pending/booked
    const unpaidCompleted = bookings.filter(b => !b.paid && b.type !== 'block' && b.status !== 'noshow' && b.status !== 'no_show' && b.status !== 'booked' && b.status !== 'pending' && Number(b.service_amount || b.amount || 0) > 0);
    const unpaidAmount = unpaidCompleted.reduce((s, b) => s + Number(b.service_amount || b.amount || 0), 0);
    checks.push({
      id: 'unpaid_bookings',
      status: unpaidCompleted.length > 0 ? 'warning' : 'ok',
      label: 'Unpaid bookings',
      detail: unpaidCompleted.length > 0
        ? `${unpaidCompleted.length} completed booking${unpaidCompleted.length > 1 ? 's' : ''} not paid — $${unpaidAmount.toFixed(2)} uncollected`
        : 'All completed bookings are paid',
      count: unpaidCompleted.length, amount: unpaidAmount,
    });

    // ── Check 2: Booking ↔ Payment match ──
    const paidBookings = bookings.filter(b => b.paid);
    const paymentBookingIds = new Set(payments.map(p => p.booking_id).filter(Boolean));
    const paidNoPayment = paidBookings.filter(b => !paymentBookingIds.has(b.id) && b.payment_method !== 'cash');
    const orphanPayments = payments.filter(p => {
      if (!p.booking_id) return true;
      const inRange = !fromDate || (p.created_at || '').slice(0, 10) >= fromDate;
      const inRangeTo = !toDate || (p.created_at || '').slice(0, 10) <= toDate;
      return inRange && inRangeTo && !bookings.find(b => b.id === p.booking_id);
    });
    const matchIssues = paidNoPayment.length + orphanPayments.length;
    checks.push({
      id: 'booking_payment_match',
      status: matchIssues > 0 ? 'warning' : 'ok',
      label: 'Booking ↔ Payment match',
      detail: matchIssues > 0
        ? `${paidNoPayment.length} paid booking${paidNoPayment.length !== 1 ? 's' : ''} without payment record, ${orphanPayments.length} orphan payment${orphanPayments.length !== 1 ? 's' : ''}`
        : `All ${paidBookings.length} paid bookings have matching payments`,
      count: matchIssues,
    });

    // ── Check 3: Cash reconciliation ──
    const cashBookings = paidBookings.filter(b => (b.payment_method || '').toLowerCase() === 'cash');
    const expectedCash = cashBookings.reduce((s, b) => s + Number(b.service_amount || b.amount || 0) + Number(b.tip || b.tip_amount || 0), 0);
    const reportMap = new Map(cashReports.map(r => [r.date, r]));
    // Sum cash reports for dates in our range
    let countedCash = 0;
    let hasReports = false;
    const datesWithCash = new Set(cashBookings.map(b => (b.start_at || '').slice(0, 10)));
    datesWithCash.forEach(date => {
      const r = reportMap.get(date);
      if (r) { countedCash += Number(r.amount || r.actual_cash || 0); hasReports = true; }
    });
    const cashDiff = hasReports ? countedCash - expectedCash : null;
    checks.push({
      id: 'cash_reconciliation',
      status: !hasReports && expectedCash > 0 ? 'warning' : (cashDiff !== null && Math.abs(cashDiff) > 1) ? 'warning' : 'ok',
      label: 'Cash reconciliation',
      detail: !hasReports && expectedCash > 0
        ? `$${expectedCash.toFixed(2)} cash expected but no count submitted`
        : hasReports
          ? `Expected $${expectedCash.toFixed(2)}, counted $${countedCash.toFixed(2)}${cashDiff !== null ? ` (${cashDiff >= 0 ? '+' : ''}$${cashDiff.toFixed(2)})` : ''}`
          : 'No cash transactions in period',
      diff: cashDiff,
    });

    // ── Check 4: Admin attendance ──
    const adminDetails = [];
    for (const admin of admins) {
      const attRecords = attendance.filter(a => a.user_id === admin.id);
      const totalMins = attRecords.reduce((s, a) => {
        let mins = Number(a.duration_minutes || 0);
        if (!a.clock_out && a.clock_in) mins += Math.max(0, Math.round((Date.now() - new Date(a.clock_in).getTime()) / 60000));
        return s + mins;
      }, 0);
      const hours = totalMins / 60;
      const rule = rules[admin.id] || {};
      const hourlyRate = Number(rule.hourly_rate || 0);
      adminDetails.push({ name: admin.name || admin.username, hours, rate: hourlyRate, shifts: attRecords.length });
    }
    const adminIssues = adminDetails.filter(a => a.hours === 0 && a.rate > 0);
    checks.push({
      id: 'admin_hours',
      status: adminIssues.length > 0 ? 'warning' : admins.length === 0 ? 'ok' : 'ok',
      label: 'Admin attendance',
      detail: admins.length === 0 ? 'No admin users configured'
        : adminDetails.map(a => `${a.name}: ${a.hours.toFixed(1)}h (${a.shifts} shifts)`).join(', ')
        + (adminIssues.length > 0 ? ` — ⚠ ${adminIssues.map(a => a.name).join(', ')} has $${adminIssues[0]?.rate}/hr but 0 hours` : ''),
    });

    // ── Check 5: Totals consistency ──
    const grossServices = paidBookings.reduce((s, b) => s + Number(b.service_amount || b.amount || 0), 0);
    const grossTips = paidBookings.reduce((s, b) => s + Number(b.tip || b.tip_amount || 0), 0);
    const expensesTotal = expenses.reduce((s, d) => s + Number(d.data()?.amount || 0), 0);
    checks.push({
      id: 'totals_check',
      status: 'ok',
      label: 'Period totals',
      detail: `Services $${grossServices.toFixed(2)} · Tips $${grossTips.toFixed(2)} · ${paidBookings.length} paid bookings · Expenses $${expensesTotal.toFixed(2)}`,
    });

    // ── Check 6: Bookings without service amount ──
    const noAmount = paidBookings.filter(b => !b.service_amount && !b.amount);
    checks.push({
      id: 'missing_amounts',
      status: noAmount.length > 0 ? 'warning' : 'ok',
      label: 'Service amounts',
      detail: noAmount.length > 0
        ? `${noAmount.length} paid booking${noAmount.length !== 1 ? 's' : ''} missing service amount — payroll may be inaccurate`
        : 'All paid bookings have service amounts',
      count: noAmount.length,
    });

    // ── Check 7: Square card payments vs bookings ──
    // Compare only linked payments (Square payments matched to bookings via payment_id)
    const cardBookings = paidBookings.filter(b => ['terminal', 'card', 'applepay'].includes((b.payment_method || '').toLowerCase()));
    const bookingCardTotal = cardBookings.reduce((s, b) => s + Number(b.service_amount || b.amount || 0) + Number(b.tip || b.tip_amount || 0), 0);
    const bookingPaymentIds = new Set(cardBookings.map(b => b.payment_id).filter(Boolean));
    let squareLinkedTotal = 0;
    let squareLinkedCount = 0;
    let squareTotalAll = 0;
    let squareCountAll = 0;
    let squareConnected = false;
    try {
      const sqHeaders = await squareHeaders(req.ws);
      const params = new URLSearchParams();
      if (from) params.set('begin_time', from);
      if (to) params.set('end_time', to);
      params.set('sort_order', 'DESC');
      const sqResp = await squareFetch(`/v2/payments?${params}`, { headers: sqHeaders });
      if (sqResp.ok) {
        squareConnected = true;
        const sqData = await sqResp.json();
        const completed = (sqData.payments || []).filter(p => (p.status || '').toUpperCase() === 'COMPLETED');
        squareCountAll = completed.length;
        squareTotalAll = completed.reduce((s, p) => s + (Number(p.amount_money?.amount || 0) + Number(p.tip_money?.amount || 0)) / 100, 0);
        // Only count Square payments that are linked to our bookings
        const linked = completed.filter(p => bookingPaymentIds.has(p.id));
        squareLinkedCount = linked.length;
        squareLinkedTotal = linked.reduce((s, p) => s + (Number(p.amount_money?.amount || 0) + Number(p.tip_money?.amount || 0)) / 100, 0);
      }
    } catch {} // Square not connected
    const linkedDiff = Math.abs(bookingCardTotal - squareLinkedTotal);
    const unlinkedCount = squareCountAll - squareLinkedCount;
    const unlinkedAmount = squareTotalAll - squareLinkedTotal;
    checks.push({
      id: 'square_match',
      status: !squareConnected ? 'ok' : linkedDiff > 2 ? 'warning' : 'ok',
      label: 'Square verification',
      detail: !squareConnected ? 'Square not connected — skipped'
        : linkedDiff <= 2
          ? `Matched: bookings $${bookingCardTotal.toFixed(2)} = Square $${squareLinkedTotal.toFixed(2)} (${squareLinkedCount} linked)${unlinkedCount > 0 ? ` + ${unlinkedCount} unlinked Square payments ($${unlinkedAmount.toFixed(2)})` : ''}`
          : `Linked mismatch: bookings $${bookingCardTotal.toFixed(2)} vs Square $${squareLinkedTotal.toFixed(2)} (diff $${linkedDiff.toFixed(2)})${unlinkedCount > 0 ? ` + ${unlinkedCount} unlinked ($${unlinkedAmount.toFixed(2)})` : ''}`,
      diff: squareConnected ? linkedDiff : null,
    });

    const summary = { ok: checks.filter(c => c.status === 'ok').length, warnings: checks.filter(c => c.status === 'warning').length, errors: checks.filter(c => c.status === 'error').length };
    res.json({ checks, summary });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/payroll/audit/status', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('payroll_audit').get();
    if (!doc.exists) return res.json({ warnings_count: 0, warnings: [] });
    res.json(doc.data());
  } catch (e) { res.json({ warnings_count: 0, warnings: [] }); }
});

// ── Smart Booking Audit Status ──
app.get('/api/booking-audit/status', requireAuth, async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('booking_audit').get();
    if (!doc.exists) return res.json({ warnings_count: 0, critical_count: 0, warnings: [], last_run: null });
    res.json(doc.data());
  } catch (e) { res.json({ warnings_count: 0, critical_count: 0, warnings: [], last_run: null }); }
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
// 10DLC SMS REGISTRATION (ISV automation via Telnyx API)
// ============================================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app';

// Toll-free SMS setup — default reminder path for new workspaces.
app.post('/api/sms/enable-tollfree', requireRole('owner'), async (req, res) => {
  try {
    const wsDoc = await db.collection('workspaces').doc(req.wsId).get();
    const workspace = { id: req.wsId, ...(wsDoc.exists ? wsDoc.data() : {}) };
    const result = await provisionTollFreeSmsForWorkspace(workspace, {
      source: 'workspace',
      actor_uid: req.user?.uid || 'unknown',
      actor_name: req.user?.name || req.user?.username || 'unknown',
      actor_role: req.user?.role || 'unknown',
      actor_ip: getClientIp(req),
    });

    res.json(result);
  } catch (e) {
    console.error('TF SMS enable error:', e);
    res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed to enable SMS', ...(e?.meta || {}) });
  }
});

// 10DLC SMS registration for Salon/Business plan
app.post('/api/sms/register', requireRole('owner'), async (req, res) => {
  try {
    const b = req.body || {};
    const companyName = safeStr(b.company_name);
    const displayName = safeStr(b.display_name || b.company_name);
    const ein = safeStr(b.ein || '');
    const entityType = safeStr(b.entity_type || 'PRIVATE_PROFIT');
    const vertical = safeStr(b.vertical || 'PROFESSIONAL');
    const website = safeStr(b.website || '');
    const phone = safeStr(b.phone || '');
    const email = safeStr(b.email || '');
    const street = safeStr(b.street || '');
    const city = safeStr(b.city || '');
    const state = safeStr(b.state || '');
    const postalCode = safeStr(b.postal_code || '');
    const country = safeStr(b.country || 'US');

    if (!companyName) return res.status(400).json({ error: 'Company name is required' });
    if (!phone) return res.status(400).json({ error: 'Business phone is required' });
    if (!email) return res.status(400).json({ error: 'Business email is required' });
    if (!street || !city || !state || !postalCode) return res.status(400).json({ error: 'Full address is required' });

    const workspaceDoc = await db.collection('workspaces').doc(req.wsId).get();
    const bookingUrl = getWorkspaceBookingUrl({ id: req.wsId, ...(workspaceDoc.exists ? workspaceDoc.data() : {}) });

    const settingsRef = req.ws('settings').doc('config');

    // Step 1: Create Brand
    const brandPayload = {
      entityType, displayName, companyName, phone, email, website,
      street, city, state, postalCode, country, vertical,
    };
    if (ein) brandPayload.ein = ein;
    if (ein) brandPayload.einIssuingCountry = country;

    // Sole proprietor extra fields
    if (entityType === 'SOLE_PROPRIETOR') {
      brandPayload.firstName = safeStr(b.first_name || '');
      brandPayload.lastName = safeStr(b.last_name || '');
      if (b.date_of_birth) brandPayload.dateOfBirth = safeStr(b.date_of_birth);
      if (b.mobile_phone) brandPayload.mobilePhone = safeStr(b.mobile_phone);
    }

    let brandResult;
    try {
      brandResult = await telnyxApi('POST', '/v2/10dlc/brand', brandPayload);
    } catch (e) {
      return res.status(400).json({ error: 'Brand creation failed: ' + e.message, step: 'brand' });
    }
    const brandId = brandResult?.data?.brandId || brandResult?.data?.id || '';
    await settingsRef.update({
      sms_number_type: '10dlc',
      telnyx_brand_id: brandId,
      sms_brand_name: displayName,
      sms_registration_status: 'pending_vetting',
      sms_registered_at: toIso(new Date()),
      updated_at: toIso(new Date()),
    });

    // Step 1b: For Sole Proprietors — trigger OTP verification
    const isSoleProp = entityType === 'SOLE_PROPRIETOR';
    if (isSoleProp) {
      try {
        await telnyxApi('POST', `/v2/10dlc/brand/${brandId}/smsOtp`, {
          pinSms: `VuriumBook: Your verification code is @OTP_PIN@. Enter this code to verify your identity. Expires in 24 hours.`,
          successSms: `VuriumBook: Your brand has been verified successfully. You can now send SMS to your clients.`,
        });
      await settingsRef.update({ sms_registration_status: 'pending_otp', sms_number_type: '10dlc' });
        // Return early — user must verify OTP before campaign can be created
        return res.json({
          ok: true, step: 'otp_sent', brand_id: brandId, status: 'pending_otp',
          message: 'Verification code sent to your mobile. Enter it to continue.',
        });
      } catch (e) {
        console.warn('SP OTP send failed:', e.message);
        // Continue anyway — may not require OTP in all cases
      }
    } else {
      // For regular businesses — request enhanced brand vetting
      try {
        await telnyxApi('POST', `/v2/10dlc/brands/${brandId}/vetting_requests`, {});
      } catch (e) {
        console.warn('Enhanced vetting request failed (non-critical):', e.message);
      }
    }

    // Step 2: Create Campaign
    const shopName = displayName || companyName;
    const campaignUseCase = isSoleProp ? 'SOLE_PROPRIETOR' : 'CUSTOMER_CARE';
    let campaignResult;
    try {
      campaignResult = await telnyxApi('POST', '/v2/10dlc/campaignBuilder', {
        brandId,
        usecase: campaignUseCase,
        description: `${shopName} sends transactional appointment-related SMS to clients who book appointments. Message types include booking confirmations, 24-hour reminders, 2-hour reminders, and cancellation notices. Messages are non-marketing and sent only after the client provides explicit SMS consent during the booking flow.`,
        messageFlow: `Clients opt in on the online booking page at ${bookingUrl}. During booking, the client enters their mobile number and checks an optional SMS consent checkbox stating they agree to receive ${shopName} Appointment Notifications via SMS. The consent text includes message frequency, rates disclosure, STOP/HELP instructions, and links to Terms and Privacy Policy. Consent is not a condition of booking.`,
        sample1: `${shopName}: Your appointment is confirmed for Mon Apr 7 at 2:00 PM with John. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
        sample2: `${shopName}: Reminder: Your appointment with John is tomorrow Mon Apr 7 at 2:00 PM. Reply STOP to opt out, HELP for help.`,
        helpMessage: `${shopName}: For help, contact support@vurium.com or call (847) 630-1884. Visit https://vurium.com/privacy for our Privacy Policy. Reply STOP to opt out.`,
        helpKeywords: 'HELP',
        optinKeywords: 'START,YES',
        optoutKeywords: 'STOP,UNSUBSCRIBE,CANCEL,END,QUIT',
        optinMessage: `${shopName}: You're subscribed to appointment SMS. Msg frequency varies, up to 5 per booking. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Consent is not a condition of purchase.`,
        optoutMessage: `${shopName}: You have been unsubscribed and will receive no further messages.`,
        embeddedLink: false,
        embeddedPhone: false,
        numberPool: false,
        ageGated: false,
        directLending: false,
      });
    } catch (e) {
      await settingsRef.update({ sms_registration_status: 'brand_created', sms_number_type: '10dlc' });
      return res.status(400).json({ error: 'Campaign creation failed: ' + e.message, step: 'campaign', brand_id: brandId });
    }
    const campaignId = campaignResult?.data?.campaignId || campaignResult?.data?.id || '';
    await settingsRef.update({
      sms_number_type: '10dlc',
      telnyx_campaign_id: campaignId,
      sms_registration_status: 'pending_campaign',
      updated_at: toIso(new Date()),
    });

    // Step 3: Search & buy a local phone number
    let phoneNumber = '';
    try {
      const areaCode = postalCode ? postalCode.slice(0, 3) : '';
      const searchParams = new URLSearchParams({ 'filter[country_code]': 'US', 'filter[features]': 'sms', 'filter[limit]': '1' });
      if (state) searchParams.set('filter[administrative_area]', state);
      const searchResult = await telnyxApi('GET', `/v2/available_phone_numbers?${searchParams.toString()}`);
      const availableNumber = searchResult?.data?.[0]?.phone_number;
      if (!availableNumber) throw new Error('No numbers available');

      const orderResult = await telnyxApi('POST', '/v2/number_orders', {
        phone_numbers: [{ phone_number: availableNumber }],
      });
      phoneNumber = availableNumber;
    } catch (e) {
      await settingsRef.update({ sms_registration_status: 'pending_number', sms_number_type: '10dlc' });
      return res.status(400).json({ error: 'Number purchase failed: ' + e.message, step: 'number', brand_id: brandId, campaign_id: campaignId });
    }

    // Step 4: Create messaging profile
    let profileId = '';
    try {
      const profileResult = await telnyxApi('POST', '/v2/messaging_profiles', {
        name: `VuriumBook - ${shopName}`,
        webhook_url: `${API_BASE_URL}/api/webhooks/telnyx`,
        enabled: true,
      });
      profileId = profileResult?.data?.id || '';
    } catch (e) {
      console.warn('Messaging profile creation failed:', e.message);
    }

    // Step 4b: Configure custom STOP/HELP auto-responses for this business
    if (profileId) {
      try {
        await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
          response_type: 'STOP',
          response_text: `${shopName}: You have been unsubscribed and will receive no further messages. Reply HELP for help or START to re-subscribe.`,
        });
        await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
          response_type: 'HELP',
          response_text: `${shopName}: For help, contact support@vurium.com or call (847) 630-1884. Visit https://vurium.com/privacy for our Privacy Policy. Reply STOP to opt out.`,
        });
      } catch (e) {
        console.warn('Auto-response config failed:', e.message);
      }
    }

    // Step 5: Assign number to campaign + messaging profile
    try {
      await telnyxApi('POST', '/v2/10dlc/phoneNumberCampaign', {
        phoneNumber,
        campaignId,
      });
    } catch (e) {
      console.warn('Number-campaign assignment failed:', e.message);
    }
    if (phoneNumber && profileId) {
      try {
        await telnyxApi('PATCH', `/v2/phone_numbers/${phoneNumber.replace('+', '')}`, { messaging_profile_id: profileId });
      } catch (e) {
        console.warn('Number→profile association failed:', e.message);
      }
    }

    // Step 6: Save all to settings
    await settingsRef.update({
      sms_from_number: phoneNumber,
      sms_number_type: '10dlc',
      sms_messaging_profile_id: profileId,
      sms_registration_status: 'pending_approval',
      updated_at: toIso(new Date()),
    });

    writeAuditLog(req.wsId, { action: 'sms.register', resource_id: brandId, data: { campaign_id: campaignId, phone_number: phoneNumber }, req }).catch(() => {});

    res.json({
      ok: true,
      brand_id: brandId,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      messaging_profile_id: profileId,
      status: 'pending_approval',
    });
  } catch (e) {
    console.error('SMS register error:', e);
    res.status(500).json({ error: e?.message || 'Registration failed' });
  }
});

// Sole Proprietor OTP verification — called after /api/sms/register returns step=otp_sent
app.post('/api/sms/verify-otp', requireRole('owner'), async (req, res) => {
  try {
    const pin = safeStr(req.body?.pin || '');
    if (!pin || pin.length !== 6) return res.status(400).json({ error: '6-digit PIN required' });

    const settingsRef = req.ws('settings').doc('config');
    const doc = await settingsRef.get();
    const data = doc.exists ? doc.data() : {};
    const brandId = data.telnyx_brand_id;
    if (!brandId) return res.status(400).json({ error: 'No brand found. Register first.' });

    // Verify OTP with Telnyx
    try {
      await telnyxApi('POST', `/v2/10dlc/brand/${brandId}/smsOtp/verify`, { otpPin: pin });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired code: ' + e.message });
    }

    await settingsRef.update({ sms_registration_status: 'verified', sms_number_type: '10dlc', updated_at: toIso(new Date()) });

    // Now auto-create campaign + buy number + assign (same flow as regular registration continues)
    const workspaceDoc = await db.collection('workspaces').doc(req.wsId).get();
    const bookingUrl = getWorkspaceBookingUrl({ id: req.wsId, ...(workspaceDoc.exists ? workspaceDoc.data() : {}) });
    const displayName = safeStr(data.sms_brand_name || data.shop_name || '');
    const shopName = displayName || 'Business';
    const state = safeStr(data.shop_address?.split(',').slice(-2, -1)[0]?.trim() || '');

    // Create SP Campaign
    let campaignResult;
    try {
      campaignResult = await telnyxApi('POST', '/v2/10dlc/campaignBuilder', {
        brandId,
        usecase: 'SOLE_PROPRIETOR',
        description: `${shopName} sends transactional appointment-related SMS to clients who book appointments. Message types include booking confirmations, 24-hour reminders, 2-hour reminders, and cancellation notices. Messages are non-marketing and sent only after the client provides explicit SMS consent during the booking flow.`,
        messageFlow: `Clients opt in on the online booking page at ${bookingUrl}. During booking, the client enters their mobile number and checks an optional SMS consent checkbox stating they agree to receive ${shopName} Appointment Notifications via SMS. The consent text includes message frequency, rates disclosure, STOP/HELP instructions, and links to Terms and Privacy Policy. Consent is not a condition of booking.`,
        sample1: `${shopName}: Your appointment is confirmed for Mon Apr 7 at 2:00 PM. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
        sample2: `${shopName}: Reminder: Your appointment is tomorrow at 2:00 PM. Reply STOP to opt out, HELP for help.`,
        helpMessage: `${shopName}: For help, contact support@vurium.com. Visit https://vurium.com/privacy for Privacy Policy. Reply STOP to opt out.`,
        helpKeywords: 'HELP',
        optinKeywords: 'START,YES',
        optoutKeywords: 'STOP,UNSUBSCRIBE,CANCEL,END,QUIT',
        optinMessage: `${shopName}: You're subscribed to appointment SMS. Msg frequency varies, up to 5 per booking. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Consent is not a condition of purchase.`,
        optoutMessage: `${shopName}: You have been unsubscribed and will receive no further messages.`,
        embeddedLink: false,
        embeddedPhone: false,
        numberPool: false,
        ageGated: false,
        directLending: false,
        termsAndConditions: true,
      });
    } catch (e) {
      return res.status(400).json({ error: 'Campaign creation failed: ' + e.message, step: 'campaign' });
    }
    const campaignId = campaignResult?.data?.campaignId || campaignResult?.data?.id || '';

    // Buy number
    let phoneNumber = '';
    try {
      const searchResult = await telnyxApi('GET', '/v2/available_phone_numbers?filter[country_code]=US&filter[features]=sms&filter[limit]=1');
      const availNum = searchResult?.data?.[0]?.phone_number;
      if (!availNum) throw new Error('No numbers available');
      await telnyxApi('POST', '/v2/number_orders', { phone_numbers: [{ phone_number: availNum }] });
      phoneNumber = availNum;
    } catch (e) {
      console.warn('Number purchase failed:', e.message);
    }

    // Create messaging profile
    let profileId = '';
    try {
      const profileResult = await telnyxApi('POST', '/v2/messaging_profiles', {
        name: `VuriumBook - ${shopName}`,
        webhook_url: `${API_BASE_URL}/api/webhooks/telnyx`,
        enabled: true,
      });
      profileId = profileResult?.data?.id || '';

      // Custom STOP/HELP auto-responses
      await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
        response_type: 'STOP', response_text: `${shopName}: You have been unsubscribed. No further messages will be sent. Reply HELP for help.`,
      }).catch(() => {});
      await telnyxApi('POST', `/v2/messaging_profiles/${profileId}/autoresp_configs`, {
        response_type: 'HELP', response_text: `${shopName}: For help, contact support@vurium.com. Visit https://vurium.com/privacy. Reply STOP to opt out.`,
      }).catch(() => {});
    } catch (e) {
      console.warn('Profile creation failed:', e.message);
    }

    // Assign number to campaign + profile
    if (phoneNumber && campaignId) {
      try {
        await telnyxApi('POST', '/v2/10dlc/phoneNumberCampaign', { phoneNumber, campaignId });
      } catch (e) {
        console.warn('Number-campaign assignment failed:', e.message);
      }
    }
    if (phoneNumber && profileId) {
      try {
        await telnyxApi('PATCH', `/v2/phone_numbers/${phoneNumber.replace('+', '')}`, { messaging_profile_id: profileId });
      } catch (e) {
        console.warn('Number→profile association failed:', e.message);
      }
    }

    // Save everything — SP campaigns typically auto-approve
    await settingsRef.update({
      telnyx_campaign_id: campaignId,
      sms_from_number: phoneNumber,
      sms_number_type: '10dlc',
      sms_messaging_profile_id: profileId,
      sms_registration_status: 'active', // SP campaigns auto-approve after OTP verification
      updated_at: toIso(new Date()),
    });

    // Gap 3: write phone_number_index so inbound STOP/HELP webhooks resolve this 10DLC
    // workspace via O(1) lookup instead of scanning all workspaces (matches toll-free path).
    if (phoneNumber) {
      const idxKey = phoneNumber.replace(/\D/g, '');
      db.collection('phone_number_index').doc(idxKey).set({
        workspace_id: req.wsId,
        shop_name: shopName,
        from_number: phoneNumber,
        number_type: '10dlc',
        updated_at: toIso(new Date()),
      }).catch(() => {});
    }

    writeAuditLog(req.wsId, { action: 'sms.sp_verified', resource_id: brandId, data: { campaign_id: campaignId, phone_number: phoneNumber }, req }).catch(() => {});

    res.json({
      ok: true, status: 'active',
      brand_id: brandId, campaign_id: campaignId,
      phone_number: phoneNumber, messaging_profile_id: profileId,
    });
  } catch (e) {
    console.error('SMS OTP verify error:', e);
    res.status(500).json({ error: e?.message || 'Verification failed' });
  }
});

app.get('/api/sms/status', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    const data = doc.exists ? doc.data() : {};
    res.json({
      status: data.sms_registration_status || 'none',
      brand_id: data.telnyx_brand_id || null,
      campaign_id: data.telnyx_campaign_id || null,
      from_number: data.sms_from_number || null,
      number_type: data.sms_number_type || null,
      brand_name: data.sms_brand_name || data.shop_name || null,
      messaging_profile_id: data.sms_messaging_profile_id || null,
      registered_at: data.sms_registered_at || null,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// SETTINGS
// ============================================================
app.get('/api/settings', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    res.json(doc.exists ? { id: 'config', ...doc.data() } : {});
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Timezone endpoint — available to all authenticated users (not just owner/admin)
app.get('/api/settings/timezone', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    const data = doc.exists ? doc.data() : {};
    res.json({ timezone: data?.timezone || 'America/Chicago', clock_in_enabled: !!data?.clock_in_enabled });
  } catch (e) { res.status(500).json({ timezone: 'America/Chicago', clock_in_enabled: false }); }
});

// Role permissions — available to all authenticated users (they need to know their own permissions)
app.get('/api/settings/permissions', async (req, res) => {
  try {
    const doc = await req.ws('settings').doc('config').get();
    const data = doc.exists ? doc.data() : {};
    res.json({ role_permissions: data?.role_permissions || null });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Save role permissions — owner only
app.post('/api/settings/permissions', requireRole('owner'), async (req, res) => {
  try {
    const { role_permissions } = req.body || {};
    if (!role_permissions || typeof role_permissions !== 'object') return res.status(400).json({ error: 'role_permissions required' });
    await req.ws('settings').doc('config').set({ role_permissions, updated_at: toIso(new Date()) }, { merge: true });
    writeAuditLog(req.wsId, { action: 'settings.permissions.update', data: { roles: Object.keys(role_permissions) }, req }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/settings', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const ALLOWED_SETTINGS = ['timezone', 'shop_name', 'shop_address', 'shop_phone', 'shop_email',
      'booking_buffer_minutes', 'default_duration_minutes', 'currency', 'locale',
      'sms_enabled', 'push_enabled', 'booking_confirmation', 'hero_url', 'hero_media_url', 'logo_url',
      'geofence_lat', 'geofence_lng', 'geofence_radius_m', 'theme', 'custom_css',
      'dash_calendar', 'dash_clients', 'dash_payments', 'dash_waitlist', 'dash_portfolio',
      'dash_cash', 'dash_membership', 'dash_attendance', 'dash_expenses', 'dash_payroll',
      'clock_in_enabled', 'waitlist_enabled', 'portfolio_enabled', 'membership_enabled', 'cash_register_enabled',
      'dash_shortcuts', 'dash_widgets', 'business_type',
      'sms_from_number', 'sms_brand_name', 'telnyx_campaign_id', 'telnyx_brand_id', 'sms_registration_status',
      'sms_messaging_profile_id', 'sms_number_type', 'sms_registered_at', 'sms_status_updated_at',
      'google_review_url', 'satisfaction_sms_enabled', 'online_booking_enabled'];
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
    // Sync business_type to workspace doc (used in /public/resolve and /api/account/limits)
    if (b.business_type !== undefined) {
      await req.wsDoc().update({ business_type: sanitizeHtml(b.business_type), updated_at: toIso(new Date()) });
    }
    // Nested objects — stored on settings doc (deep-merge with existing)
    if (b.tax !== undefined && typeof b.tax === 'object') patch.tax = b.tax;
    if (b.payroll !== undefined && typeof b.payroll === 'object') patch.payroll = b.payroll;
    if (b.square !== undefined && typeof b.square === 'object') patch.square = b.square;
    if (b.fees !== undefined && Array.isArray(b.fees)) patch.fees = b.fees;
    if (b.charges !== undefined && Array.isArray(b.charges)) patch.charges = b.charges;
    if (b.booking !== undefined && typeof b.booking === 'object') patch.booking = b.booking;
    if (b.display !== undefined && typeof b.display === 'object') patch.display = b.display;
    // Site config — stored on workspace doc for custom plan.
    // BE.9: all custom_html / custom_css / ai_css fields routed through
    // sanitizeCustomHtml() + sanitizeCustomCss() helpers (DOMPurify + regex).
    if (b.site_config !== undefined && typeof b.site_config === 'object') {
      if (b.site_config.custom_html !== undefined) {
        b.site_config.custom_html = sanitizeCustomHtml(b.site_config.custom_html);
      }
      if (b.site_config.custom_css !== undefined) {
        b.site_config.custom_css = sanitizeCustomCss(b.site_config.custom_css);
      }
      if (b.site_config.ai_css !== undefined) {
        b.site_config.ai_css = sanitizeCustomCss(b.site_config.ai_css);
      }
      await req.wsDoc().update({ site_config: b.site_config, updated_at: toIso(new Date()) });
    }
    const ref = req.ws('settings').doc('config');
    await ref.set(patch, { merge: true });
    const saved = await ref.get();
    res.json({ id: 'config', ...saved.data() });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ── AI Style Generator ───────────────────────────────────────────────────────
const AI_STYLE_SYSTEM_PROMPT = `You generate CSS for a barbershop/salon booking page. The page uses React inline styles, so ALL your CSS properties MUST use !important.

The page has NO background decorations — it's a clean blank canvas (#010101 black). Your CSS has FULL control over the entire visual appearance including page background.

TARGET SELECTORS (use .booking-page as parent):
- .booking-page — FULL PAGE: background (solid, gradient, or animated), font-family, color. min-height:100vh.
- .booking-page header — top bar with shop name
- .booking-page main — content area
- .booking-page footer — bottom footer with legal text
- .booking-page h1, .booking-page h2 — headings
- .booking-page p, .booking-page span, .booking-page div — all text elements
- .booking-page button — all buttons
- .booking-page input, .booking-page textarea, .booking-page select — form fields
- .booking-page a — all links
- .bp-hero — hero section
- .bp-hero-image — hero image container (you can change border-radius, border, box-shadow, height)
- .bp-hero-image img — hero image itself (you can change object-fit, filter, opacity)
- .bp-card — service/barber/timeslot cards
- .bp-btn — primary action button
- .bp-section-title — section labels
- .bp-legal — SMS legal disclosure text at bottom (IMPORTANT: set readable color!)
- .bp-legal a — privacy/terms links
- .bp-footer — footer wrapper
- .bp-booking-flow — the multi-step booking area

CRITICAL RULES:
1. EVERY CSS property MUST have !important
2. Output ONLY pure CSS. No markdown, no code fences, no explanations.
3. DO NOT change: display, position, flex-direction, grid-template, width, z-index.
4. YOU MUST SET .booking-page background — the page is blank without it.
5. YOU MUST style .bp-legal and .bp-footer with readable text color matching the background!
6. Style EVERYTHING consistently: background, header, footer, buttons, inputs, cards, ALL text.
7. @import Google Fonts if needed (MUST be first line).
8. You CAN change .bp-hero-image height, border-radius, box-shadow, and img filter/opacity.
9. You CAN use CSS gradients, animations, ::before/::after for decorative backgrounds.
10. Ensure ALL text has sufficient contrast against its background.
11. Generate 30-50 lines of rich, complete CSS.

EXAMPLE for "luxury gold dark":
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
.booking-page { background: linear-gradient(135deg, #0a0806 0%, #1a1510 50%, #0a0806 100%) !important; font-family: 'Playfair Display', serif !important; color: #e8dcc8 !important; min-height: 100vh !important; }
.booking-page header { background: rgba(10,8,6,.9) !important; border-bottom: 1px solid rgba(200,170,100,.15) !important; backdrop-filter: blur(20px) !important; }
.booking-page header span { color: #c9a84c !important; }
.booking-page h1, .booking-page h2 { color: #c9a84c !important; font-family: 'Playfair Display', serif !important; text-shadow: 0 0 30px rgba(200,170,100,.15) !important; }
.booking-page p, .booking-page div { color: rgba(200,170,100,.55) !important; }
.booking-page button { background: linear-gradient(135deg, rgba(200,170,100,.12), rgba(200,170,100,.06)) !important; color: #c9a84c !important; border: 1px solid rgba(200,170,100,.25) !important; border-radius: 12px !important; box-shadow: 0 4px 20px rgba(200,170,100,.08) !important; }
.booking-page button:hover { background: rgba(200,170,100,.18) !important; }
.booking-page input, .booking-page textarea { background: rgba(200,170,100,.04) !important; border: 1px solid rgba(200,170,100,.12) !important; color: #e8dcc8 !important; border-radius: 10px !important; }
.bp-hero-image { height: 250px !important; border-radius: 20px !important; border: 1px solid rgba(200,170,100,.2) !important; box-shadow: 0 8px 40px rgba(200,170,100,.1) !important; }
.booking-page footer { background: rgba(10,8,6,.6) !important; border-top: 1px solid rgba(200,170,100,.08) !important; }
.booking-page footer *, .bp-legal, .bp-legal a { color: rgba(200,170,100,.35) !important; }
.booking-page a { color: rgba(200,170,100,.7) !important; }`;

app.post('/api/ai/generate-style', requireRole('owner', 'admin'), async (req, res) => {
  try {
    if (!openai && !anthropic) return res.status(503).json({ error: 'AI not configured' });
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.length < 3) return res.status(400).json({ error: 'Please describe your desired style' });
    if (prompt.length > 500) return res.status(400).json({ error: 'Description too long (max 500 chars)' });

    let css = '';
    const providerErrors = [];

    if (openai) {
      try {
        const response = await openai.responses.create({
          model: OPENAI_MODEL,
          instructions: AI_STYLE_SYSTEM_PROMPT,
          input: `Generate CSS for this style: ${prompt}`,
          max_output_tokens: 1024,
        });
        css = safeStr(response.output_text || '');
      } catch (e) {
        providerErrors.push(`openai: ${safeStr(e?.message || 'Unknown provider error')}`);
      }
    }

    if (!css && anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: AI_STYLE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Generate CSS for this style: ${prompt}` }],
        });
        css = response.content[0]?.text || '';
      } catch (e) {
        providerErrors.push(`anthropic: ${safeStr(e?.message || 'Unknown provider error')}`);
      }
    }

    if (!css) {
      return res.status(502).json({
        error: 'AI style generation failed',
        details: providerErrors,
      });
    }

    // Strip markdown code fences if present
    css = css.replace(/```css\n?/gi, '').replace(/```\n?/gi, '').trim();
    // BE.9: sanitize AI-generated CSS through the shared helper
    // (same rules as user-written custom_css; Google Fonts @import allowed)
    css = sanitizeCustomCss(css);

    // Save to workspace
    const wsDoc = await req.wsDoc().get();
    const sc = wsDoc.exists ? (wsDoc.data()?.site_config || {}) : {};
    await req.wsDoc().update({
      site_config: { ...sc, template: 'ai', ai_css: css, ai_prompt: prompt },
      updated_at: toIso(new Date()),
    });

    res.json({ ok: true, css, prompt });
  } catch (e) {
    console.error('AI style generation error:', e.message);
    res.status(500).json({ error: 'Failed to generate style' });
  }
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
    sendCrmPushToStaff(req.ws, doc.barber_id, 'Waitlist', `${doc.client_name || 'Client'} wants ${doc.date}`, { type: 'waitlist' }, 'push_waitlist').catch(() => {});
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
        const msg = `${wlPrefix}: A spot opened up for ${svcText} with ${w.barber_name || 'your specialist'} on ${w.date} at ${slotTime}. Book now! Msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
        // Send notification via email and/or SMS
        if (w.email) {
          try {
            const cfg = await getWorkspaceEmailConfig(req.wsId);
            const dateStr = new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const t = EMAIL_THEMES[cfg.template] || EMAIL_THEMES.modern;
            const isLt = ['classic', 'colorful'].includes(cfg.template);
            const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
            const bookUrl = `https://vurium.com/book/${req.wsId}`;
            const bodyHtml = `
              <div style="text-align:center;margin-bottom:20px;">
                <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:999px;background:${isLt ? 'rgba(40,167,69,.08)' : 'rgba(130,220,170,.1)'};border:1px solid ${isLt ? 'rgba(40,167,69,.15)' : 'rgba(130,220,170,.15)'};text-align:center;line-height:48px;font-size:20px;">&#127881;</div>
                <p style="font-size:15px;color:${t.text};margin:0;font-weight:600;">A spot just opened up!</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${cardBg};border:1px solid ${t.border};border-radius:14px;">
                <tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Date</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${dateStr}</td></tr>
                <tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Time</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${slotTime}</td></tr>
                ${w.barber_name ? `<tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">With</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${w.barber_name}</td></tr>` : ''}
                <tr><td style="padding:14px 18px;"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Service</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};">${svcText}</td></tr>
              </table>
              <div style="text-align:center;margin:24px 0 8px;">
                <a href="${bookUrl}" style="display:inline-block;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;color:${isLt ? '#fff' : 'rgba(130,220,170,.9)'};background:${isLt ? '#333' : 'rgba(130,220,170,.1)'};border:1px solid ${isLt ? '#333' : 'rgba(130,220,170,.2)'};">Book Now</a>
              </div>
              <p style="font-size:12px;color:${t.muted};text-align:center;margin-top:16px;">This slot may fill up quickly — book soon to secure your spot.</p>`;
            const html = vuriumEmailTemplate('A Spot Opened Up!', bodyHtml, cfg.shopName, cfg.logoUrl, cfg.template, cfg.contactInfo);
            sendEmail(w.email, `A spot opened up – ${cfg.shopName || 'VuriumBook'}`, html, cfg.shopName || 'VuriumBook');
          } catch (emailErr) { console.warn('waitlist email error:', emailErr?.message); }
        }
        // Also send SMS if phone available
        const wlPhoneNorm = normPhone(w.phone_raw || w.phone_norm);
        if (wlPhoneNorm) {
          const wlOptOut = await req.ws('clients').where('phone_norm', '==', wlPhoneNorm).where('sms_opt_out', '==', true).limit(1).get();
          if (!wlOptOut.empty) { await wDoc.ref.update({ notified: true, notified_at: toIso(new Date()), cancelled_reason: 'sms_opt_out' }); continue; }
          const wlSmsConf = await getWorkspaceSmsConfig(req.wsId, { allowGlobalFallback: false });
          if (wlSmsConf.canSend) {
            sendSms(wlPhoneNorm, msg, wlSmsConf.fromNumber, req.wsId).catch(() => {});
          }
        }
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
    sendCrmPushToRoles(req.ws, ['owner', 'admin'], 'New Request', `${doc.barberName} submitted a ${doc.type} request`, { type: 'request' }, null, 'push_booking_confirm').catch(() => {});
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
    sendCrmPushToBarber(req.ws, requestData.barberId, `Request ${status}`, `Your ${requestData.type} request was ${status}`, { type: 'request_update' }, 'push_booking_confirm').catch(() => {});
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// RECEIPTS
// ============================================================
app.post('/api/receipts/send', async (req, res) => {
  try {
    const { booking_id, phone } = req.body || {};
    if (!booking_id || !phone) return res.status(400).json({ error: 'booking_id and phone required' });
    const bookingDoc = await req.ws('bookings').doc(booking_id).get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'Booking not found' });
    const b = bookingDoc.data();
    const serviceName = b.service_name || 'Service';
    const amount = Number(b.amount || b.service_amount || 0);
    const tip = Number(b.tip || b.tip_amount || 0);
    const total = amount + tip;
    const date = b.date || b.start_at?.slice(0, 10) || '';
    const barberName = b.barber_name || '';
    // Get shop name
    const settingsDoc = await req.ws('settings').doc('config').get();
    const shopName = settingsDoc.exists ? settingsDoc.data()?.shop_name || 'VuriumBook' : 'VuriumBook';
    // Check opt-out before sending
    const phoneNorm = normPhone(phone);
    if (phoneNorm) {
      const optOutCheck = await req.ws('clients').where('phone_norm', '==', phoneNorm).where('sms_opt_out', '==', true).limit(1).get();
      if (!optOutCheck.empty) return res.json({ ok: true, skipped: 'opted_out' });
    }
    const lines = [
      `${shopName} — Receipt`,
      `Date: ${date}`,
      barberName ? `Specialist: ${barberName}` : '',
      `Service: ${serviceName}`,
      `Amount: $${amount.toFixed(2)}`,
      tip > 0 ? `Tip: $${tip.toFixed(2)}` : '',
      `Total: $${total.toFixed(2)}`,
      `Payment: ${(b.payment_method || '').charAt(0).toUpperCase() + (b.payment_method || '').slice(1)}`,
      '',
      'Thank you for your visit!',
      'Reply STOP to opt out, HELP for help.'
    ].filter(Boolean).join('\n');
    const receiptSmsConf = await getWorkspaceSmsConfig(req.wsId, { allowGlobalFallback: false });
    if (!receiptSmsConf.canSend) return res.json({ ok: true, skipped: 'sms_unavailable' });
    await sendSms(phone, lines, receiptSmsConf.fromNumber, req.wsId);
    res.json({ ok: true });
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

app.get('/api/square/oauth/status', requireCustomPerm('financial.access_terminal'), async (req, res) => {
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
app.get('/api/stripe-connect/status', requireCustomPerm('financial.access_terminal'), async (req, res) => {
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
    // Verify Stripe Connect webhook signature (same logic as main Stripe webhook)
    let event;
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      if (sig) {
        const payload = req.body.toString();
        const timestamp = sig.split(',').find(s => s.startsWith('t='))?.slice(2);
        const v1Sig = sig.split(',').find(s => s.startsWith('v1='))?.slice(3);
        if (timestamp && v1Sig) {
          if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return res.status(400).json({ error: 'Webhook too old' });
          const expectedSig = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');
          if (expectedSig !== v1Sig) return res.status(400).json({ error: 'Invalid signature' });
        }
        event = JSON.parse(payload);
      } else {
        event = JSON.parse(req.body.toString());
      }
    } else {
      event = JSON.parse(req.body.toString());
    }
    const obj = event.data?.object;
    if (!obj) return res.json({ ok: true });
    const wsId = obj.metadata?.workspace_id || '';
    logWebhookEvent('stripe_connect', event.type, wsId, { event_id: event.id }).catch(() => {});
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
app.get('/api/square/locations', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws);
    const r = await squareFetch('/v2/locations', { headers });
    const data = await r.json();
    res.json({ locations: (data.locations || []).map(l => ({ id: l.id, name: l.name, status: l.status, address: l.address })) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/api/payments/terminal/devices', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws);
    const r = await squareFetch('/v2/devices', { headers });
    const data = await r.json();
    // Extract usable device IDs for terminal checkouts
    const devices = (data.devices || []).map(d => {
      // device.id format is "device:SERIAL_NUMBER" — the serial number is used for terminal API
      const serialNumber = d.id?.startsWith('device:') ? d.id.slice(7) : d.id || '';
      const appComponent = (d.components || []).find(c => c.type === 'APPLICATION' && c.application_details?.device_code_id);
      return { ...d, serial_number: serialNumber, device_code_id: appComponent?.application_details?.device_code_id || '' };
    });
    res.json({ devices });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/api/payments/terminal', async (req, res) => {
  try {
    const b = req.body || {};
    const amountCents = b.amount_cents ? Math.round(Number(b.amount_cents)) : Math.round(Number(b.amount || 0) * 100);
    const bookingId = safeStr(b.booking_id || '');
    // Device ID: from request > workspace settings > env var
    let deviceId = safeStr(b.device_id || '');
    if (!deviceId) {
      try {
        const settingsDoc = await req.ws('settings').doc('config').get();
        deviceId = safeStr(settingsDoc.exists ? settingsDoc.data()?.square?.terminal_device_id || '' : '');
      } catch {}
    }
    if (!deviceId) deviceId = safeStr(process.env.SQUARE_DEVICE_ID || '');
    const paymentMethod = safeStr(b.payment_method || 'card');
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: 'amount required' });
    // Server-side price verification: if booking has service, check amount is reasonable
    if (bookingId) {
      try {
        const bDoc = await req.ws('bookings').doc(bookingId).get();
        if (bDoc.exists) {
          const bData = bDoc.data();
          const expectedCents = Math.round(Number(bData.service_amount || bData.amount || 0) * 100);
          // Allow if no expected price (manual amount), or within 20% tolerance (tax/fees may vary)
          if (expectedCents > 0 && amountCents > 0) {
            const ratio = amountCents / expectedCents;
            if (ratio > 2.0 || ratio < 0.5) {
              console.warn(`[PAYMENT] Price mismatch: booking ${bookingId} expected ~${expectedCents}c, got ${amountCents}c`);
              return res.status(400).json({ error: 'Amount does not match booking price' });
            }
          }
        }
      } catch {} // Don't block payment if check fails
    }
    // For non-card payments (cash, zelle, other), just record locally
    if (paymentMethod !== 'card') {
      const tipDollars = Number(b.tip_amount || b.tip || 0);
      const doc = {
        booking_id: bookingId, amount_cents: amountCents, payment_method: paymentMethod,
        status: 'completed', created_by: req.user.uid, created_at: toIso(new Date()),
        client_name: safeStr(b.client_name || ''),
        service_name: safeStr(b.service_name || ''),
        service_amount: Number(b.service_amount || 0),
        tax_amount: Number(b.tax_amount || 0),
        fee_amount: Number(b.fee_amount || 0),
        tip_amount: tipDollars,
      };
      const ref = await req.ws('payment_requests').add(doc);
      if (bookingId) {
        const bookingPatch = { payment_status: 'paid', paid: true, payment_method: paymentMethod, amount: amountCents / 100, tip: tipDollars, tip_amount: tipDollars, updated_at: toIso(new Date()) };
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
    // Get location_id: from request > workspace settings > env > auto-fetch from Square
    let locationId = safeStr(b.location_id || '');
    if (!locationId) {
      try {
        const settingsDoc = await req.ws('settings').doc('config').get();
        locationId = safeStr(settingsDoc.exists ? settingsDoc.data()?.square?.location_id || '' : '');
      } catch {}
    }
    if (!locationId) locationId = safeStr(process.env.SQUARE_LOCATION_ID || '');
    if (!locationId) {
      try {
        const lr = await squareFetch('/v2/locations', { headers });
        const ld = await lr.json();
        const loc = (ld.locations || []).find(l => l.status === 'ACTIVE') || ld.locations?.[0];
        if (loc?.id) {
          locationId = loc.id;
          // Save for future use
          await req.ws('settings').doc('config').set({ square: { location_id: locationId } }, { merge: true }).catch(() => {});
        }
      } catch {}
    }
    const idempotencyKey = crypto.randomUUID();

    // Auto-sync client to Square and build rich note
    let squareCustomerId = safeStr(b.square_customer_id || '');
    let clientName = safeStr(b.client_name || '');
    let clientPhone = '';
    let serviceName = safeStr(b.service_name || '');
    let barberName = '';

    if (bookingId) {
      try {
        const bookingDoc = await req.ws('bookings').doc(bookingId).get();
        const bData = bookingDoc.exists ? bookingDoc.data() : {};
        if (!clientName) clientName = safeStr(bData?.client_name || '');
        clientPhone = safeStr(bData?.client_phone || '');
        if (!serviceName) serviceName = safeStr(bData?.service_name || '');
        barberName = safeStr(bData?.barber_name || '');

        // Find or create Square customer
        if (!squareCustomerId) {
          const clientId = bData?.customer_id || bData?.client_id || '';
          let cData = null;
          if (clientId) {
            const clientDoc = await req.ws('clients').doc(clientId).get();
            if (clientDoc.exists) cData = { id: clientId, ...clientDoc.data() };
          }
          // Fallback: search clients by phone
          if (!cData && clientPhone) {
            const phoneNorm = clientPhone.replace(/\D/g, '');
            if (phoneNorm.length >= 10) {
              const cSnap = await req.ws('clients').where('phone_norm', '==', phoneNorm.slice(-10)).limit(1).get();
              if (!cSnap.empty) cData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() };
            }
          }

          if (cData) {
            if (cData.square_customer_id) {
              squareCustomerId = cData.square_customer_id;
            } else {
              // Create in Square
              try {
                const nameParts = (cData.name || clientName || '').trim().split(/\s+/);
                const createBody = { idempotency_key: crypto.randomUUID(), given_name: nameParts[0] || '', family_name: nameParts.slice(1).join(' ') || '', reference_id: cData.id };
                const ph = cData.phone || clientPhone;
                if (ph) createBody.phone_number = ph.startsWith('+') ? ph : '+1' + ph.replace(/\D/g, '');
                if (cData.email) createBody.email_address = cData.email;
                const cr = await squareFetch('/v2/customers', { method: 'POST', headers, body: JSON.stringify(createBody) });
                if (cr.ok) {
                  const cd = await cr.json();
                  squareCustomerId = cd.customer?.id || '';
                  if (squareCustomerId) await req.ws('clients').doc(cData.id).update({ square_customer_id: squareCustomerId, updated_at: toIso(new Date()) }).catch(() => {});
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    // Build descriptive note for Square
    const noteParts = ['VuriumBook'];
    if (clientName) noteParts.push(clientName);
    if (serviceName) noteParts.push(serviceName);
    if (barberName) noteParts.push(`w/ ${barberName}`);
    noteParts.push(`Booking ${bookingId}`);
    const checkoutNote = b.note || noteParts.join(' • ');

    const sqBody = {
      idempotency_key: idempotencyKey,
      checkout: {
        amount_money: { amount: amountCents, currency: 'USD' },
        device_options: { device_id: deviceId, tip_settings: { allow_tipping: true, custom_tip_field: true, tip_percentages: (b.tip_percentages || [15, 20, 25]).map(Number) } },
        payment_type: 'CARD_PRESENT',
        note: checkoutNote,
        ...(squareCustomerId ? { customer_id: squareCustomerId } : {}),
        ...(locationId ? { location_id: locationId } : {}),
      },
    };
    const r = await squareFetch('/v2/terminals/checkouts', { method: 'POST', headers, body: JSON.stringify(sqBody) });
    const data = await r.json();
    if (!r.ok) {
      const errDetail = data?.errors?.[0]?.detail || data?.message || JSON.stringify(data?.errors || data);
      return res.status(r.status).json({ error: 'Square error: ' + errDetail, details: data });
    }
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
      if (checkout.status === 'COMPLETED' || checkout.status === 'COMPLETE') {
        patch.completed_at = toIso(new Date());
        patch.status = 'completed';
        const prData = prSnap.docs[0].data();

        // Fetch tip from payment object (checkout.tip_money is null when allow_tipping=true)
        let tipCents = 0;
        let serviceCents = checkout.amount_money?.amount || 0; // amount_money = service only (what we sent)
        if (checkout.payment_ids?.length) {
          try {
            const payHeaders = await squareHeaders(req.ws);
            const pr = await squareFetch(`/v2/payments/${checkout.payment_ids[0]}`, { headers: payHeaders });
            if (pr.ok) {
              const pd = await pr.json();
              const payment = pd.payment || {};
              tipCents = payment.tip_money?.amount || 0;
              // amount_money = service amount (without tip), total_money = service + tip
              if (payment.amount_money?.amount) serviceCents = payment.amount_money.amount;
            }
          } catch {}
        }
        if (!tipCents) tipCents = checkout.tip_money?.amount || 0;
        patch.tip_cents = tipCents;

        // Update booking — ALWAYS mark as paid with all data
        if (prData.booking_id) {
          await req.ws('bookings').doc(prData.booking_id).update({
            payment_status: 'paid', paid: true, payment_method: 'terminal',
            tip: tipCents / 100, tip_amount: tipCents / 100,
            amount: serviceCents / 100,
            ...(checkout.payment_ids?.length ? { payment_id: checkout.payment_ids[0] } : {}),
            ...(prData.service_amount ? { service_amount: prData.service_amount } : {}),
            ...(prData.tax_amount ? { tax_amount: prData.tax_amount } : {}),
            ...(prData.fee_amount ? { fee_amount: prData.fee_amount } : {}),
            updated_at: toIso(new Date()),
          }).catch(() => {});
        }
      }
      await prSnap.docs[0].ref.update(patch);
    }
    // Return status with tip from payment (not checkout which is always null for tipping)
    let responseTip = 0;
    if (!prSnap?.empty) {
      const updatedPr = await prSnap.docs[0].ref.get();
      responseTip = updatedPr.exists ? (updatedPr.data()?.tip_cents || 0) : 0;
    }
    res.json({ checkout_id: checkout.id, status: checkout.status, payment_ids: checkout.payment_ids || [], tip_money: { amount: responseTip, currency: 'USD' }, tip_cents: responseTip });
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
    const appName = safeStr(req.body?.app || 'crm');
    if (!deviceToken) return res.status(400).json({ error: 'device_token required' });

    // Remove this device token from ALL other workspaces first
    // BUG-014 fix: middleware sets req.wsId (not req.workspaceId) — skip was never matching, causing
    // the current workspace's own token to be deleted and recreated on every register call.
    try {
      const allWs = await db.collection('workspaces').get();
      for (const ws of allWs.docs) {
        if (ws.id === req.wsId) continue; // skip current workspace
        const tokenDoc = ws.ref.collection('crm_push_tokens').doc(deviceToken);
        const exists = await tokenDoc.get();
        if (exists.exists) {
          await tokenDoc.delete();
          console.log('🔔 [PUSH] Removed token from old workspace: ' + ws.id);
        }
      }
    } catch (e) { console.warn('🔔 [PUSH] Cleanup error:', e?.message); }

    // Register in current workspace
    await req.ws('crm_push_tokens').doc(deviceToken).set({
      device_token: deviceToken, platform, app: appName,
      user_id: req.user.uid, user_name: safeStr(req.user.name || req.user.username),
      role: safeStr(req.user.role), barber_id: safeStr(req.user.barber_id || ''),
      updated_at: toIso(new Date()),
    }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Unregister push token (on logout)
app.post('/api/push/unregister', async (req, res) => {
  try {
    const deviceToken = safeStr(req.body?.device_token);
    if (!deviceToken) return res.status(400).json({ error: 'device_token required' });
    await req.ws('crm_push_tokens').doc(deviceToken).delete();
    console.log('🔔 [PUSH] Unregistered token: ' + deviceToken.slice(0, 10) + '...');
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

app.post('/api/payroll/sync-tips-from-square', requireRole('owner'), async (req, res) => {
  try {
    const headers = await squareHeaders(req.ws, {});
    const snap = await req.ws('payment_requests').where('status', '==', 'completed').where('payment_method', '==', 'card').get();
    let updated = 0;
    for (const d of snap.docs) {
      const pr = d.data();
      if (!pr.booking_id || !pr.payment_id) continue;
      if (pr.tip_cents > 0) continue; // already has tip
      try {
        const r = await squareFetch(`/v2/payments/${pr.payment_id}`, { headers });
        if (r.ok) {
          const pd = await r.json();
          const tipCents = pd.payment?.tip_money?.amount || 0;
          if (tipCents > 0) {
            await d.ref.update({ tip_cents: tipCents, updated_at: toIso(new Date()) });
            await req.ws('bookings').doc(pr.booking_id).update({ tip: tipCents / 100, tip_amount: tipCents / 100, updated_at: toIso(new Date()) }).catch(() => {});
            updated++;
          }
        }
      } catch {}
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
    const planDef = getPlanDef(effectivePlan);
    res.json({
      workspace_id: wsId,
      slug: data.slug || null,
      name: data.name || '',
      plan_type: data.plan_type || 'individual',
      effective_plan: effectivePlan,
      site_config: data.site_config || null,
      business_type: data.business_type || null,
      waitlist_enabled: planDef.features.includes('waitlist'),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.get('/public/services/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    if (getEffectivePlan(wsDoc.data()) === 'expired') return res.status(403).json({ error: 'This business is not accepting bookings at this time.' });
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
    if (getEffectivePlan(wsDoc.data()) === 'expired') return res.status(403).json({ error: 'This business is not accepting bookings at this time.' });
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
    if (!barberId) return res.status(400).json({ error: 'barber_id required' });
    const barberDoc = await wsCol('barbers').doc(barberId).get();
    if (!barberDoc.exists || barberDoc.data()?.active === false) return res.status(404).json({ error: 'Barber not found' });
    const barber = barberDoc.data();
    const settingsDoc = await wsCol('settings').doc('config').get();
    const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    // Support date param (YYYY-MM-DD in workspace timezone) or start_at/end_at
    let start, end;
    const dateParam = safeStr(b.date);
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split('-').map(Number);
      start = zonedTimeToUtc({ year: y, month: m, day: d, hour: 0, minute: 0 }, timeZone);
      end = addMinutes(start, 24 * 60);
    } else {
      start = parseIso(b.start_at);
      end = parseIso(b.end_at);
    }
    if (!start || !end) return res.status(400).json({ error: 'date or start_at/end_at required' });
    const range = clampDateRange(start, end);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });
    const busy = await getBusyIntervalsForBarber(wsCol, barberId, toIso(range.start), toIso(range.end));
    const avail = [];
    for (const cur of eachTzDay(range.start, range.end, timeZone)) {
      const sch = getScheduleForDate(barber, cur, timeZone);
      if (!sch.works) continue;
      let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone, busy });
      slots = slots.filter(t => t >= range.start && t < range.end && t > new Date());
      slots = filterSlotsAgainstBusy(slots, busy, durationMin);
      // Double-check each slot is within barber working hours (guard against timezone edge cases)
      const dayParts = getTzParts(cur, timeZone);
      const workStartUTC = zonedTimeToUtc({ year: dayParts.year, month: dayParts.month, day: dayParts.day, hour: Math.floor(sch.startMin / 60), minute: sch.startMin % 60 }, timeZone);
      const workEndUTC = zonedTimeToUtc({ year: dayParts.year, month: dayParts.month, day: dayParts.day, hour: Math.floor(sch.endMin / 60), minute: sch.endMin % 60 }, timeZone);
      slots = slots.filter(t => t >= workStartUTC && addMinutes(t, durationMin) <= workEndUTC);
      for (const t of slots) avail.push({ start_at: toIso(t), local_day: getTzDateKey(t, timeZone) });
    }
    res.json({ time_zone: timeZone, availabilities: avail, slots: avail.map(x => x.start_at) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Smart recommendation helper — fetches alternative slots/barbers when booking fails
// ── Booking Rate Limiter — max 3 bookings per phone/email per hour per workspace ──
const _bookingRateMap = new Map(); // key: "wsId:phone|email" → [timestamps]
const BOOKING_RATE_LIMIT = 3;
const BOOKING_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkBookingRateLimit(wsId, phone, email) {
  const now = Date.now();
  const keys = [];
  const phoneNorm = phone ? normPhone(phone) : null;
  if (phoneNorm) keys.push(`${wsId}:p:${phoneNorm}`);
  if (email) keys.push(`${wsId}:e:${email.toLowerCase()}`);
  for (const key of keys) {
    const timestamps = _bookingRateMap.get(key) || [];
    const recent = timestamps.filter(t => now - t < BOOKING_RATE_WINDOW);
    if (recent.length >= BOOKING_RATE_LIMIT) return false;
    _bookingRateMap.set(key, recent);
  }
  return true;
}

function recordBookingRateHit(wsId, phone, email) {
  const now = Date.now();
  const phoneNorm = phone ? normPhone(phone) : null;
  if (phoneNorm) {
    const key = `${wsId}:p:${phoneNorm}`;
    const arr = (_bookingRateMap.get(key) || []).filter(t => now - t < BOOKING_RATE_WINDOW);
    arr.push(now);
    _bookingRateMap.set(key, arr);
  }
  if (email) {
    const key = `${wsId}:e:${email.toLowerCase()}`;
    const arr = (_bookingRateMap.get(key) || []).filter(t => now - t < BOOKING_RATE_WINDOW);
    arr.push(now);
    _bookingRateMap.set(key, arr);
  }
}

// Clean up rate limit map periodically (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of _bookingRateMap) {
    const recent = timestamps.filter(t => now - t < BOOKING_RATE_WINDOW);
    if (recent.length === 0) _bookingRateMap.delete(key);
    else _bookingRateMap.set(key, recent);
  }
}, 10 * 60 * 1000);

async function getSmartRecommendation(wsCol, barberId, startAt, durationMin, timeZone) {
  try {
    const rec = { message: '', alternative_slots: [], alternative_barbers: [] };
    // Get next 3 available slots for same barber (today + next 2 days)
    const rangeStart = new Date(Math.max(startAt.getTime(), Date.now()));
    const rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + 3);
    const barberDoc = await wsCol('barbers').doc(barberId).get();
    if (barberDoc.exists && barberDoc.data()?.active !== false) {
      const barber = barberDoc.data();
      const busy = await getBusyIntervalsForBarber(wsCol, barberId, toIso(rangeStart), toIso(rangeEnd));
      for (const cur of eachTzDay(rangeStart, rangeEnd, timeZone)) {
        if (rec.alternative_slots.length >= 3) break;
        const sch = getScheduleForDate(barber, cur, timeZone);
        if (!sch.works) continue;
        let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone, busy });
        slots = slots.filter(t => t > new Date());
        slots = filterSlotsAgainstBusy(slots, busy, durationMin);
        for (const t of slots) {
          if (rec.alternative_slots.length >= 3) break;
          rec.alternative_slots.push(toIso(t));
        }
      }
    }
    // Get alternative barbers with their next available slot
    const barbersSnap = await wsCol('barbers').get();
    for (const bDoc of barbersSnap.docs) {
      if (bDoc.id === barberId || bDoc.data()?.active === false) continue;
      if (rec.alternative_barbers.length >= 3) break;
      const bData = bDoc.data();
      const bBusy = await getBusyIntervalsForBarber(wsCol, bDoc.id, toIso(rangeStart), toIso(rangeEnd));
      let nextSlot = null;
      for (const cur of eachTzDay(rangeStart, rangeEnd, timeZone)) {
        if (nextSlot) break;
        const sch = getScheduleForDate(bData, cur, timeZone);
        if (!sch.works) continue;
        let slots = buildSmartSlotsForDay({ dayDateUTC: cur, schedule: sch, durationMin, stepMin: durationMin, timeZone, busy: bBusy });
        slots = slots.filter(t => t > new Date());
        slots = filterSlotsAgainstBusy(slots, bBusy, durationMin);
        if (slots.length > 0) nextSlot = toIso(slots[0]);
      }
      if (nextSlot) {
        rec.alternative_barbers.push({ id: bDoc.id, name: bData.name || 'Available specialist', next_slot: nextSlot });
      }
    }
    if (rec.alternative_slots.length > 0 || rec.alternative_barbers.length > 0) {
      rec.message = rec.alternative_slots.length > 0
        ? 'This time is unavailable. Here are the nearest open slots:'
        : 'This specialist is unavailable. Other specialists have openings:';
    }
    return rec.message ? rec : null;
  } catch { return null; }
}

app.post('/public/bookings/:workspace_id', (req, res, next) => {
  if (!checkPublicRateLimit(getClientIp(req), 'booking', 10)) return res.status(429).json({ error: 'Too many booking requests. Please wait a moment.' });
  next();
}, async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    // Block bookings if account expired (no active subscription or trial)
    const wsData = wsDoc.data();
    const effectivePlan = getEffectivePlan(wsData);
    if (effectivePlan === 'expired') return res.status(403).json({ error: 'This business is not accepting bookings at this time.' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const pubSettingsDocPre = await wsCol('settings').doc('config').get();
    const pubSettingsDataPre = pubSettingsDocPre.exists ? pubSettingsDocPre.data() : {};
    const allowPublicNotes = pubSettingsDataPre?.display?.allow_notes !== false;
    if (pubSettingsDataPre?.online_booking_enabled === false) {
      return res.status(403).json({ error: 'Online booking is currently disabled for this business.' });
    }
    const booking = req.body || {};
    // Idempotency: prevent double-submit
    const idempotencyKey = safeStr(booking.idempotency_key || '');
    if (idempotencyKey) {
      try {
        const existing = await wsCol('bookings').where('idempotency_key', '==', idempotencyKey).limit(1).get();
        if (!existing.empty) return res.status(200).json({ id: existing.docs[0].id, duplicate: true });
      } catch {}
    }
    const startAt = parseIso(booking.start_at);
    const barberId = safeStr(booking.barber_id);
    const clientName = sanitizeHtml(safeStr(booking.client_name));
    const clientPhone = safeStr(booking.client_phone);
    const clientEmail = sanitizeHtml(safeStr(booking.client_email || '')).toLowerCase() || null;
    const smsConsent = !!booking.sms_consent;
    const durMin = Number(booking.duration_minutes || 30);
    if (!startAt || !barberId) return res.status(400).json({ error: 'start_at and barber_id required' });
    // Rate limit: max 3 bookings per phone/email per hour
    if (!checkBookingRateLimit(wsId, clientPhone, clientEmail)) {
      return res.status(429).json({ error: 'Too many booking requests. Please try again later.' });
    }
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
          name: encryptPII(clientName || 'Walk-in'),
          phone: clientPhone ? encryptPhone(clientPhone) : null,
          phone_norm: phoneNorm,
          email: encryptPII(clientEmail),
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
        name: encryptPII(clientName || 'Walk-in'),
        phone: clientPhone ? encryptPhone(clientPhone) : null,
        phone_norm: phoneNorm,
        email: encryptPII(clientEmail),
        client_status: 'new',
        created_at: toIso(new Date()),
        updated_at: toIso(new Date()),
      });
      clientId = clientRef.id;
    }

    // Validate against barber schedule (reuse pubSettingsDocPre from above)
    const pubTimeZone = pubSettingsDataPre?.timezone || 'America/Chicago';
    const pubBarberDoc = await wsCol('barbers').doc(barberId).get();
    if (!pubBarberDoc.exists || pubBarberDoc.data()?.active === false) {
      // Suggest alternative barbers
      const altRec = await getSmartRecommendation(wsCol, barberId, startAt, durMin, pubTimeZone);
      return res.status(404).json({ error: 'Barber not found', ...(altRec ? { recommendation: { ...altRec, message: 'This specialist is no longer available. Here are other options:' } } : {}) });
    }
    try {
      ensureWithinSchedule(pubBarberDoc.data(), startAt, endAt, pubTimeZone);
    } catch (e) {
      if (e.code === 'OUTSIDE_SCHEDULE') {
        const recommendation = await getSmartRecommendation(wsCol, barberId, startAt, durMin, pubTimeZone);
        return res.status(400).json({ error: 'Selected time is outside barber working hours', ...(recommendation ? { recommendation } : {}) });
      }
      throw e;
    }

    // Reference photo — store data URL directly (compressed JPEG from frontend)
    let referencePhotoUrl = null;
    if (allowPublicNotes && booking.reference_photo && typeof booking.reference_photo === 'object') {
      const dataUrl = safeStr(booking.reference_photo.data_url || '');
      if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length < 800000) {
        referencePhotoUrl = dataUrl;
      }
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
      service_ids: Array.isArray(booking.service_ids) ? booking.service_ids.map(s => safeStr(s)).filter(Boolean) : [],
      service_name: sanitizeHtml(safeStr(booking.service_name)) || null,
      start_at: toIso(startAt), end_at: toIso(endAt),
      duration_minutes: durMin,
      status: 'booked', paid: false, source: 'website',
      notes: allowPublicNotes ? (encryptPII(sanitizeHtml(safeStr(booking.customer_note || booking.notes))) || null) : null,
      customer_note: allowPublicNotes ? (encryptPII(sanitizeHtml(safeStr(booking.customer_note))) || null) : null,
      reference_photo_url: allowPublicNotes ? referencePhotoUrl : null,
      sms_consent: smsConsent,
      sms_consent_ip: smsConsent ? getClientIp(req) : null,
      sms_consent_ua: smsConsent ? safeStr(req.headers['user-agent'] || '').slice(0, 500) : null,
      sms_consent_at: smsConsent ? toIso(new Date()) : null,
      sms_consent_text: smsConsent ? safeStr(booking.sms_consent_text || DEFAULT_SMS_CONSENT_TEXT).slice(0, 1000) : null,
      workspace_id: wsId,
      client_token: crypto.randomBytes(24).toString('hex'),
      idempotency_key: idempotencyKey || null,
      created_by: { name: clientName || 'Client', role: 'client' },
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
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) {
        const recommendation = await getSmartRecommendation(wsCol, barberId, startAt, durMin, pubTimeZone);
        return res.status(409).json({ error: 'Slot already booked', ...(recommendation ? { recommendation } : {}) });
      }
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
      const pubSmsConf = await getWorkspaceSmsConfig(wsId, { allowGlobalFallback: false });
      if (pubSmsConf.canSend) {
        sendSms(clientPhone, `${pubPrefix}Your appointment is confirmed for ${dateStr} at ${timeStr} with ${doc.barber_name || 'your specialist'}. Msg freq varies, up to 5 msgs/booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help. https://vurium.com/privacy`, pubSmsConf.fromNumber, wsId).catch(() => {});
        scheduleReminders(wsCol, bookingRef.id, doc, tz, pubShopName, pubSmsConf.fromNumber).catch(() => {});
      }
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
        const emailLogo = resolveEmailLogoUrl(wsId, emailSettingsData?.logo_url || '');
        const emailContactInfo = {
          address: safeStr(emailSettingsData?.shop_address || ''),
          phone: safeStr(emailSettingsData?.shop_phone || ''),
        };
        const wsDocData = await db.collection('workspaces').doc(wsId).get();
        const rawTemplate = wsDocData.exists ? wsDocData.data()?.site_config?.template : null;
        const emailTemplate = ['modern','classic','bold','dark-luxury','colorful'].includes(rawTemplate) ? rawTemplate : 'modern';
        const manageUrl = `https://vurium.com/manage-booking?ws=${wsId}&bid=${bookingRef.id}&token=${doc.client_token}`;
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
        `, emailShopName, emailLogo, emailTemplate, emailContactInfo), emailShopName).catch(() => {});
    }
    recordBookingRateHit(wsId, clientPhone, clientEmail);
    res.status(201).json({ booking_id: bookingRef.id, id: bookingRef.id });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// PUBLIC: GROUP BOOKING (multiple barbers at same start_at, single transaction)
// ============================================================
app.post('/public/bookings-group/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const wsData = wsDoc.data();
    const effectivePlan = getEffectivePlan(wsData);
    if (effectivePlan === 'expired') return res.status(403).json({ error: 'This business is not accepting bookings at this time.' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const pubSettingsDocPre = await wsCol('settings').doc('config').get();
    const pubSettingsDataPre = pubSettingsDocPre.exists ? pubSettingsDocPre.data() : {};
    const allowPublicNotes = pubSettingsDataPre?.display?.allow_notes !== false;
    if (pubSettingsDataPre?.online_booking_enabled === false) {
      return res.status(403).json({ error: 'Online booking is currently disabled for this business.' });
    }
    const body = req.body || {};
    const groups = Array.isArray(body.bookings) ? body.bookings : [];
    if (groups.length === 0 || groups.length > 5) return res.status(400).json({ error: 'Between 1 and 5 bookings required' });
    const startAt = parseIso(body.start_at);
    if (!startAt) return res.status(400).json({ error: 'start_at required' });
    const clientName = sanitizeHtml(safeStr(body.client_name));
    const clientPhone = safeStr(body.client_phone);
    const clientEmail = sanitizeHtml(safeStr(body.client_email || '')).toLowerCase() || null;
    const smsConsent = !!body.sms_consent;
    // Rate limit
    if (!checkBookingRateLimit(wsId, clientPhone, clientEmail)) {
      return res.status(429).json({ error: 'Too many booking requests. Please try again later.' });
    }

    // Client dedup (shared across all bookings in the group)
    const phoneNorm = normPhone(clientPhone) || null;
    let clientId = null;
    if (clientEmail && !clientId) {
      const existingByEmail = await wsCol('clients').where('email', '==', clientEmail).limit(1).get();
      if (!existingByEmail.empty) {
        clientId = existingByEmail.docs[0].id;
        const existingData = existingByEmail.docs[0].data();
        if (phoneNorm && !existingData.phone_norm) {
          await existingByEmail.docs[0].ref.update({ phone: clientPhone, phone_norm: phoneNorm, updated_at: toIso(new Date()) });
        }
      }
    }
    if (phoneNorm && !clientId) {
      const existingClient = await wsCol('clients').where('phone_norm', '==', phoneNorm).limit(1).get();
      if (!existingClient.empty) {
        clientId = existingClient.docs[0].id;
        const existingName = existingClient.docs[0].data().name;
        if (clientName && clientName !== existingName && clientName !== 'Walk-in') {
          await existingClient.docs[0].ref.update({ name: clientName, updated_at: toIso(new Date()) });
        }
      } else {
        const clientRef = await wsCol('clients').add({
          name: encryptPII(clientName || 'Walk-in'),
          phone: clientPhone ? encryptPhone(clientPhone) : null,
          phone_norm: phoneNorm,
          email: encryptPII(clientEmail),
          client_status: 'new',
          created_at: toIso(new Date()), updated_at: toIso(new Date()),
        });
        clientId = clientRef.id;
      }
    }
    if (!clientId && clientEmail) {
      const clientRef = await wsCol('clients').add({
        name: encryptPII(clientName || 'Walk-in'),
        phone: clientPhone ? encryptPhone(clientPhone) : null,
        phone_norm: phoneNorm,
        email: encryptPII(clientEmail),
        client_status: 'new',
        created_at: toIso(new Date()), updated_at: toIso(new Date()),
      });
      clientId = clientRef.id;
    }

    // Reference photo
    let referencePhotoUrl = null;
    if (allowPublicNotes && body.reference_photo && typeof body.reference_photo === 'object') {
      const dataUrl = safeStr(body.reference_photo.data_url || '');
      if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length < 800000) {
        referencePhotoUrl = dataUrl;
      }
    }

    // Reuse pubSettingsDataPre from above
    const pubTimeZone = pubSettingsDataPre?.timezone || 'America/Chicago';

    // Validate each barber
    const barberDocs = {};
    for (const g of groups) {
      const bid = safeStr(g.barber_id);
      if (!bid) return res.status(400).json({ error: 'barber_id required for each booking' });
      if (!barberDocs[bid]) {
        const bdoc = await wsCol('barbers').doc(bid).get();
        if (!bdoc.exists || bdoc.data()?.active === false) return res.status(404).json({ error: `Barber ${bid} not found` });
        barberDocs[bid] = bdoc;
      }
    }

    // Build booking docs and validate schedule
    const bookingsRef = wsCol('bookings');
    const bookingRefs = [];
    const bookingDocs = [];
    const clientToken = crypto.randomBytes(24).toString('hex');
    for (const g of groups) {
      const bid = safeStr(g.barber_id);
      const durMin = Number(g.duration_minutes || 30);
      const endAt = addMinutes(startAt, durMin);
      try {
        ensureWithinSchedule(barberDocs[bid].data(), startAt, endAt, pubTimeZone);
      } catch (e) {
        if (e.code === 'OUTSIDE_SCHEDULE') return res.status(400).json({ error: `Selected time is outside ${safeStr(g.barber_name) || 'barber'} working hours` });
        throw e;
      }
      const ref = bookingsRef.doc();
      bookingRefs.push(ref);
      bookingDocs.push({
        client_name: clientName || 'Walk-in',
        client_phone: clientPhone || null,
        client_email: clientEmail,
        phone_norm: phoneNorm,
        client_id: clientId,
        barber_id: bid,
        barber_name: sanitizeHtml(safeStr(g.barber_name)) || null,
        service_id: Array.isArray(g.service_ids) && g.service_ids.length > 0 ? safeStr(g.service_ids[0]) : null,
        service_ids: Array.isArray(g.service_ids) ? g.service_ids.map(s => safeStr(s)).filter(Boolean) : [],
        service_name: sanitizeHtml(safeStr(g.service_name)) || null,
        start_at: toIso(startAt), end_at: toIso(endAt),
        duration_minutes: durMin,
        status: 'booked', paid: false, source: 'website',
        notes: allowPublicNotes ? (encryptPII(sanitizeHtml(safeStr(body.customer_note || body.notes))) || null) : null,
        customer_note: allowPublicNotes ? (encryptPII(sanitizeHtml(safeStr(body.customer_note))) || null) : null,
        reference_photo_url: allowPublicNotes ? referencePhotoUrl : null,
        sms_consent: smsConsent,
        sms_consent_ip: smsConsent ? getClientIp(req) : null,
        sms_consent_ua: smsConsent ? safeStr(req.headers['user-agent'] || '').slice(0, 500) : null,
        sms_consent_at: smsConsent ? toIso(new Date()) : null,
        sms_consent_text: smsConsent ? safeStr(body.sms_consent_text || DEFAULT_SMS_CONSENT_TEXT).slice(0, 1000) : null,
        workspace_id: wsId,
        client_token: clientToken,
        group_booking: true,
        group_size: groups.length,
        created_by: { name: clientName || 'Client', role: 'client' },
        created_at: toIso(new Date()), updated_at: toIso(new Date()),
      });
    }

    // Atomic transaction: all-or-nothing
    try {
      await db.runTransaction(async (tx) => {
        for (let i = 0; i < bookingRefs.length; i++) {
          const bid = bookingDocs[i].barber_id;
          const endAt = parseIso(bookingDocs[i].end_at);
          await ensureNoConflictTx(tx, bookingsRef, { barberId: bid, startAt, endAt });
          tx.set(bookingRefs[i], bookingDocs[i]);
        }
      });
    } catch (e) {
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) return res.status(409).json({ error: 'Slot already booked for one of the team members' });
      throw e;
    }

    // SMS / Email notifications (send for the first booking only, mention all barbers)
    const allBarberNames = groups.map(g => safeStr(g.barber_name)).filter(Boolean);
    const allServiceNames = groups.map(g => safeStr(g.service_name)).filter(Boolean);
    if (smsConsent && clientPhone) {
      const settingsDoc = pubSettingsDocPre;
      const pubSettingsData = settingsDoc.exists ? settingsDoc.data() : {};
      const tz = pubSettingsData?.timezone || 'America/Chicago';
      const pubShopName = safeStr(pubSettingsData?.shop_name || '');
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      const pubPrefix = pubShopName ? `${pubShopName}: ` : '';
      const pubSmsConf = await getWorkspaceSmsConfig(wsId, { allowGlobalFallback: false });
      const withText = allBarberNames.length > 1 ? `with ${allBarberNames.join(' & ')}` : `with ${allBarberNames[0] || 'your specialist'}`;
      if (pubSmsConf.canSend) {
        sendSms(clientPhone, `${pubPrefix}Your appointment is confirmed for ${dateStr} at ${timeStr} ${withText}. Msg freq varies, up to 5 msgs/booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help. https://vurium.com/privacy`, pubSmsConf.fromNumber, wsId).catch(() => {});
        // Schedule reminders for first booking
        scheduleReminders(wsCol, bookingRefs[0].id, bookingDocs[0], tz, pubShopName, pubSmsConf.fromNumber).catch(() => {});
      }
    }
    if (clientEmail) {
      const emailSettingsDoc = pubSettingsDocPre;
      const emailSettingsData = emailSettingsDoc.exists ? emailSettingsDoc.data() : {};
      const emailTz = emailSettingsData?.timezone || 'America/Chicago';
      const timeStr = startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: emailTz });
      const dateStr = startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: emailTz });
      const emailShopName = safeStr(emailSettingsData?.shop_name || '');
      const emailLogo = resolveEmailLogoUrl(wsId, emailSettingsData?.logo_url || '');
      const emailContactInfo = { address: safeStr(emailSettingsData?.shop_address || ''), phone: safeStr(emailSettingsData?.shop_phone || '') };
      const wsDocData2 = await db.collection('workspaces').doc(wsId).get();
      const rawTemplate = wsDocData2.exists ? wsDocData2.data()?.site_config?.template : null;
      const emailTemplate = ['modern','classic','bold','dark-luxury','colorful'].includes(rawTemplate) ? rawTemplate : 'modern';
      const manageUrl = `https://vurium.com/manage-booking?ws=${wsId}&bid=${bookingRefs[0].id}&token=${clientToken}`;
      const et = EMAIL_THEMES[emailTemplate] || EMAIL_THEMES.modern;
      const isLt = ['classic','colorful'].includes(emailTemplate);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      const svcListHtml = groups.map(g => `<div style="padding:8px 0;border-bottom:1px solid ${et.border}"><div style="font-size:14px;font-weight:600;color:${et.text};">${sanitizeHtml(safeStr(g.service_name)) || 'Appointment'}</div><div style="color:${et.muted};font-size:13px;">with ${sanitizeHtml(safeStr(g.barber_name)) || 'your specialist'}</div></div>`).join('');
      sendEmail(clientEmail, 'Booking Confirmed', vuriumEmailTemplate('Booking Confirmed', `
        <p>Your appointment${groups.length > 1 ? 's have' : ' has'} been confirmed:</p>
        <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
          ${svcListHtml}
          <div style="color:${et.accent};font-weight:500;margin-top:10px;">${dateStr} at ${timeStr}</div>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <a href="${manageUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:13px;font-weight:500;margin-right:8px;">Reschedule</a>
          <a href="${manageUrl}&action=cancel" style="display:inline-block;padding:12px 24px;border-radius:10px;background:rgba(220,60,60,.08);border:1px solid rgba(220,60,60,.2);color:rgba(220,80,80,.8);text-decoration:none;font-size:13px;font-weight:500;">Cancel</a>
        </div>
      `, emailShopName, emailLogo, emailTemplate, emailContactInfo), emailShopName).catch(() => {});
    }

    const ids = bookingRefs.map(r => r.id);
    recordBookingRateHit(wsId, clientPhone, clientEmail);
    res.status(201).json({ booking_ids: ids, booking_id: ids[0], id: ids[0] });
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

    // SET-001 through SET-007 fix: public booking page reads display / booking / fees
    // settings but this endpoint previously returned only 9 fields, so toggles saved in
    // Settings UI silently had no effect on the public booking page. The public response
    // is now an explicit allowlist — never spread the full settings doc because it holds
    // sensitive fields (Stripe/Square/SMS tokens, role_permissions, payroll rates, etc.).
    //
    // Booking backend also enforces these same fields; the public response makes the UI
    // match the backend behavior instead of showing a form that will silently fail at
    // submit time.
    const display = data.display && typeof data.display === 'object' ? data.display : {};
    const booking = data.booking && typeof data.booking === 'object' ? data.booking : {};
    const publicDisplay = {
      show_prices: display.show_prices !== false, // default true
      require_phone: !!display.require_phone,
      allow_notes: display.allow_notes !== false, // default true
    };
    const publicBooking = {
      cancellation_hours: Number(booking.cancellation_hours || 0),
    };

    // Fees / tax / custom charges used by public online payment total calculation.
    // Only include the shape needed for price math — never raw provider secrets.
    const sanitizeFeeArray = (arr) => Array.isArray(arr) ? arr.map(f => ({
      label: safeStr(f?.label || ''),
      type: safeStr(f?.type || 'percent'),
      value: Number(f?.value || 0),
      applies_to: safeStr(f?.applies_to || 'all'),
    })) : [];
    const sanitizeTax = (t) => t && typeof t === 'object' ? {
      label: safeStr(t.label || ''),
      rate: Number(t.rate || 0),
      included_in_price: !!t.included_in_price,
      applies_to: safeStr(t.applies_to || 'all'),
    } : null;

    res.json({
      shopStatusMode: safeStr(data.shopStatusMode || 'auto'),
      shopStatusCustomText: safeStr(data.shopStatusCustomText || ''),
      bannerEnabled: !!data.bannerEnabled,
      bannerText: safeStr(data.bannerText || ''),
      hero_media_url: safeStr(data.hero_media_url || data.hero_url || ''),
      hero_media_type: safeStr(data.hero_media_type || 'video'),
      shop_name: safeStr(data.shop_name || ''),
      shop_address: safeStr(data.shop_address || ''),
      shop_phone: safeStr(data.shop_phone || ''),
      shop_email: safeStr(data.shop_email || ''),
      sms_brand_name: safeStr(data.sms_brand_name || data.shop_name || ''),
      timezone: safeStr(data.timezone || 'America/Chicago'),
      business_type: safeStr(data.business_type || ''),
      // SET-004: public booking flow needs to know when online booking is disabled
      // so the UI can render a clear "booking unavailable" state upfront instead of
      // letting the customer fill out the whole form and then hit a backend 400.
      online_booking_enabled: data.online_booking_enabled !== false,
      // SET-006 (revised 2026-04-15): waitlist defaults to ON for any plan that supports
      // it; the Settings toggle is an explicit OFF-override, not an opt-in. Earlier
      // version of this endpoint returned `!!data.waitlist_enabled` which forced false
      // whenever the owner had never touched the toggle — that silently hid the waitlist
      // form on every Salon+ workspace that was previously working. Fix: only include
      // the field when it is explicitly set in settings; when absent, frontend falls
      // back to `/public/resolve` which already returns the plan-feature value via the
      // `??` (nullish coalescing) guard in `app/book/[id]/page.tsx`.
      ...(typeof data.waitlist_enabled === 'boolean' ? { waitlist_enabled: data.waitlist_enabled } : {}),
      // SET-001 / SET-002 / SET-003
      display: publicDisplay,
      // SET-005
      booking: publicBooking,
      // SET-007 — expose the shape public payment math needs, nothing else
      tax: sanitizeTax(data.tax),
      fees: sanitizeFeeArray(data.fees),
      charges: sanitizeFeeArray(data.charges),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Serves the workspace logo as a real HTTPS image so email clients (which
// strip data: URIs) can render it. If the stored logo_url is a data URL we
// decode the base64 and return the bytes; if it's already an HTTPS URL we
// redirect to it; otherwise 404.
app.get('/public/workspaces/:workspace_id/logo', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const doc = await db.collection('workspaces').doc(wsId).collection('settings').doc('config').get();
    const raw = doc.exists ? (doc.data()?.logo_url || '') : '';
    if (!raw) return res.status(404).end();
    if (typeof raw === 'string' && raw.startsWith('data:')) {
      const match = raw.match(/^data:([^;,]+);base64,(.+)$/);
      if (!match) return res.status(404).end();
      const mime = match[1] || 'image/png';
      const buf = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', buf.length);
      return res.end(buf);
    }
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) {
      return res.redirect(302, raw);
    }
    return res.status(404).end();
  } catch (e) {
    console.warn('logo fetch error:', e?.message);
    return res.status(500).end();
  }
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
const TELNYX_VERIFY_PROFILE_ID = process.env.TELNYX_VERIFY_PROFILE_ID || '';

function formatVerifyPhone(phone) {
  const normalized = normPhone(safeStr(phone || ''));
  if (!normalized || normalized.length < 10) return '';
  return normalized.length === 10 ? `+1${normalized}` : `+${normalized}`;
}

app.post('/public/verify/send/:workspace_id', async (req, res) => {
  try {
    const wsId = req.params.workspace_id;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists) return res.status(404).json({ error: 'Workspace not found' });
    const phone = normPhone(safeStr(req.body?.phone));
    const formatted = formatVerifyPhone(phone);
    if (!formatted) return res.status(400).json({ error: 'Valid phone required' });
    // Rate limit: max 3 verification SMS per phone per 10 minutes
    const key = `verify_send_${wsId}_${phone}`;
    const rlRef = db.collection('rate_limits').doc(key);
    const rlSnap = await rlRef.get();
    const rlData = rlSnap.exists ? rlSnap.data() : null;
    const windowMs = 10 * 60 * 1000;
    const now = Date.now();
    const sendCount = (!rlData || now - Number(rlData.window_started_at || 0) > windowMs)
      ? 1
      : Number(rlData.send_count || 0) + 1;
    if (sendCount > 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please wait a few minutes.' });
    }
    await rlRef.set({
      workspace_id: wsId,
      phone,
      send_count: sendCount,
      window_started_at: (!rlData || now - Number(rlData.window_started_at || 0) > windowMs) ? now : Number(rlData.window_started_at || now),
      updated_at: now,
    }, { merge: true });

    if (TELNYX_VERIFY_PROFILE_ID) {
      try {
        await telnyxApi('POST', '/v2/verifications/sms', {
          phone_number: formatted,
          verify_profile_id: TELNYX_VERIFY_PROFILE_ID,
          type: 'sms',
        });
      } catch (e) {
        console.warn('verify send provider error:', e?.message);
        return res.status(502).json({ error: 'Verification service is temporarily unavailable. Please try again.' });
      }
      return res.json({ ok: true, sent: true, provider: 'telnyx_verify' });
    }

    // Fallback until TELNYX_VERIFY_PROFILE_ID is configured on the environment.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('workspaces').doc(wsId).collection('phone_verify').doc(`verify_${phone}`).set({
      phone, code, attempts: 0,
      expires_at: toIso(new Date(Date.now() + windowMs)),
      created_at: toIso(new Date()),
      provider: 'legacy_local',
    });
    const verifyFrom = telnyxVerifyFallbackFrom();
    if (!verifyFrom) {
      return res.status(502).json({ error: 'Verification service is temporarily unavailable. Please try again.' });
    }
    const verifyPrefix = 'VuriumBook';
    sendSms(formatted, `${verifyPrefix}: Your verification code is ${code}. Do not share this code. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, verifyFrom, wsId).catch(e => console.warn('verify SMS error:', e?.message));
    return res.json({ ok: true, sent: true, provider: 'legacy_local' });
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
    const formatted = formatVerifyPhone(phone);
    if (!formatted || !code) return res.status(400).json({ error: 'phone and code required' });

    if (TELNYX_VERIFY_PROFILE_ID) {
      try {
        await telnyxApi('POST', `/v2/verifications/by_phone_number/${encodeURIComponent(formatted)}/actions/verify`, {
          code,
          verify_profile_id: TELNYX_VERIFY_PROFILE_ID,
        });
      } catch (e) {
        const msg = safeStr(e?.message || '');
        console.warn('verify check provider error:', msg);
        if (/(invalid|expired|incorrect|not found|not verified|failed|code)/i.test(msg)) {
          return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
        }
        return res.status(502).json({ error: 'Verification service is temporarily unavailable. Please try again.' });
      }
    } else {
      const key = `verify_${phone}`;
      const ref = wsCol('phone_verify').doc(key);
      const doc = await ref.get();
      if (!doc.exists) return res.status(400).json({ error: 'No code sent. Request a new one.' });
      const data = doc.data();
      if (new Date(data.expires_at) < new Date()) { await ref.delete(); return res.status(400).json({ error: 'Code expired. Request a new one.' }); }
      if ((data.attempts || 0) >= 5) { await ref.delete(); return res.status(429).json({ error: 'Too many attempts. Request a new code.' }); }
      if (data.code !== code) { await ref.update({ attempts: (data.attempts || 0) + 1 }); return res.status(400).json({ error: 'Invalid code. Try again.' }); }
      await ref.delete();
    }

    const clientSnap = await wsCol('clients').where('phone_norm', '==', phone).limit(1).get();
    let client = null;
    if (!clientSnap.empty) {
      const cd = clientSnap.docs[0].data();
      client = { id: clientSnap.docs[0].id, name: cd.name || null, email: cd.email || null };
    }
    res.json({ ok: true, verified: true, client, provider: TELNYX_VERIFY_PROFILE_ID ? 'telnyx_verify' : 'legacy_local' });
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
    const wsData = wsDoc.data() || {};
    const effectivePlan = getEffectivePlan(wsData);
    if (effectivePlan === 'expired') return res.status(403).json({ error: 'This business is not accepting bookings at this time.' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const settingsDoc = await wsCol('settings').doc('config').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const waitlistAllowedByPlan = !!PLAN_FEATURES[effectivePlan]?.features?.includes('waitlist');
    // SET-006 (revised): waitlist is ON by default on any plan that includes the feature.
    // Previously this rejected any submission where `settingsData.waitlist_enabled` was
    // falsy — but the field is undefined on every workspace that never toggled it in
    // Settings, which matched 99% of Salon+ workspaces. That caused the form to render
    // (because /public/resolve said the plan allows it) but submits to 403. We now only
    // reject on (a) plan does not support waitlist, or (b) owner EXPLICITLY set
    // waitlist_enabled to false in Settings.
    if (!waitlistAllowedByPlan || settingsData?.waitlist_enabled === false) {
      return res.status(403).json({ error: 'Waitlist is currently disabled for this business.' });
    }
    const allowWaitlistNotes = settingsData?.display?.allow_notes !== false;
    const email = safeStr(req.body?.email || '').toLowerCase().trim();
    const phone = normPhone(safeStr(req.body?.phone || ''));
    const barberId = safeStr(req.body?.barber_id);
    const date = safeStr(req.body?.date);
    const clientName = sanitizeHtml(safeStr(req.body?.client_name || ''));
    const barberName = safeStr(req.body?.barber_name || '');
    if (!email && !phone) return res.status(400).json({ error: 'email or phone required' });
    if (!barberId) return res.status(400).json({ error: 'barber_id required' });
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    // Check duplicate by email or phone
    let existing;
    if (email) {
      existing = await wsCol('waitlist').where('email', '==', email).where('barber_id', '==', barberId).where('date', '==', date).where('notified', '==', false).limit(1).get();
    } else {
      existing = await wsCol('waitlist').where('phone_norm', '==', phone).where('barber_id', '==', barberId).where('date', '==', date).where('notified', '==', false).limit(1).get();
    }
    if (!existing.empty) return res.json({ ok: true, id: existing.docs[0].id, already: true });
    const prefStart = Math.max(0, Number(req.body?.preferred_start_min || 0));
    const prefEnd = Math.min(1440, Number(req.body?.preferred_end_min || 1440));
    const doc = {
      email: email || null,
      phone_norm: phone || null, phone_raw: phone ? safeStr(req.body?.phone) : null,
      client_name: clientName || null, barber_id: barberId,
      barber_name: barberName,
      date, service_ids: Array.isArray(req.body?.service_ids) ? req.body.service_ids : [],
      service_names: Array.isArray(req.body?.service_names) ? req.body.service_names : [],
      duration_minutes: Math.max(1, Number(req.body?.duration_minutes || 30)),
      preferred_start_min: prefStart,
      preferred_end_min: prefEnd,
      customer_note: allowWaitlistNotes ? (sanitizeHtml(safeStr(req.body?.customer_note || '')) || null) : null,
      sms_consent: !!req.body?.sms_consent,
      reference_photo: allowWaitlistNotes && req.body?.reference_photo && typeof req.body.reference_photo === 'object' ? {
        data_url: safeStr(req.body.reference_photo.data_url || '').slice(0, 600000),
        file_name: safeStr(req.body.reference_photo.file_name || 'photo.jpg'),
      } : null,
      notified: false, created_at: toIso(new Date()),
    };
    const ref = await wsCol('waitlist').add(doc);
    sendCrmPushToStaff(wsCol, barberId, 'Waitlist', `${clientName || 'Client'} wants ${date}`, { type: 'waitlist' }, 'push_waitlist').catch(() => {});
    // Send confirmation email
    if (email) {
      getWorkspaceEmailConfig(wsId).then(cfg => {
        const fmtMin = (m) => { const h = Math.floor(m / 60), mm = m % 60; const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`; };
        const dateObj = new Date(date + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const t = EMAIL_THEMES[cfg.template] || EMAIL_THEMES.modern;
        const isLt = ['classic', 'colorful'].includes(cfg.template);
        const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
        const svcText = (doc.service_names || []).join(', ');
        const timeRange = prefStart > 0 && prefEnd < 1440 ? `${fmtMin(prefStart)} – ${fmtMin(prefEnd)}` : 'Any time';
        const bodyHtml = `
          <div style="text-align:center;margin-bottom:20px;">
            <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:999px;background:${isLt ? 'rgba(99,102,241,.08)' : 'rgba(130,150,220,.1)'};border:1px solid ${isLt ? 'rgba(99,102,241,.15)' : 'rgba(130,150,220,.15)'};text-align:center;line-height:48px;font-size:20px;">&#128276;</div>
            <p style="font-size:14px;color:${t.text};margin:0;">You've been added to the waitlist${barberName ? ` for <strong>${barberName}</strong>` : ''}.</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${cardBg};border:1px solid ${t.border};border-radius:14px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Date</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${dateStr}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Preferred Time</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${timeRange}</td></tr>
            ${svcText ? `<tr><td style="padding:14px 18px;border-bottom:1px solid ${t.border};"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Service</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};border-bottom:1px solid ${t.border};">${svcText}</td></tr>` : ''}
            <tr><td style="padding:14px 18px;"><span style="font-size:11px;color:${t.muted};text-transform:uppercase;letter-spacing:.08em;">Duration</span></td><td style="padding:14px 18px;text-align:right;font-weight:600;color:${t.text};">${doc.duration_minutes} min</td></tr>
          </table>
          <p style="font-size:13px;color:${t.muted};text-align:center;line-height:1.6;margin-top:20px;">We'll notify you by email as soon as a matching slot becomes available. No action needed from you right now.</p>`;
        const html = vuriumEmailTemplate('You\'re on the Waitlist', bodyHtml, cfg.shopName, cfg.logoUrl, cfg.template, cfg.contactInfo);
        sendEmail(email, `You're on the waitlist – ${cfg.shopName || 'VuriumBook'}`, html, cfg.shopName || 'VuriumBook');
      }).catch(() => {});
    }
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

// ANALYTICS DETAILED — extended analytics for full page
app.get('/api/analytics/detailed', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - (days - 1));
    const fromStr = from.toISOString().slice(0, 10);
    const snap = await req.ws('analytics').where('date', '>=', fromStr).orderBy('date').get();
    const docs = snap.docs.map(d => d.data());

    const total = docs.length;

    // By source
    const bySource = {};
    docs.forEach(d => { const s = d.source || 'direct'; bySource[s] = (bySource[s] || 0) + 1; });

    // By day
    const byDay = {};
    for (let i = 0; i < days; i++) {
      const dd = new Date(now); dd.setDate(dd.getDate() - (days - 1) + i);
      byDay[dd.toISOString().slice(0, 10)] = 0;
    }
    docs.forEach(d => { if (byDay[d.date] !== undefined) byDay[d.date]++; });

    // By hour (from created_at timestamps)
    const byHour = {};
    for (let h = 0; h < 24; h++) byHour[h] = 0;
    docs.forEach(d => {
      if (d.created_at) {
        try { const h = new Date(d.created_at).getHours(); byHour[h]++; } catch {}
      }
    });

    // By referrer domain
    const byReferrer = {};
    docs.forEach(d => {
      if (d.referrer) {
        try {
          const host = new URL(d.referrer).hostname.replace(/^www\./, '');
          byReferrer[host] = (byReferrer[host] || 0) + 1;
        } catch { byReferrer[d.referrer.slice(0, 60)] = (byReferrer[d.referrer.slice(0, 60)] || 0) + 1; }
      }
    });

    // Week-over-week comparison
    const midpoint = new Date(now); midpoint.setDate(midpoint.getDate() - Math.floor(days / 2));
    const midStr = midpoint.toISOString().slice(0, 10);
    let periodA = 0, periodB = 0;
    docs.forEach(d => { if (d.date < midStr) periodA++; else periodB++; });

    res.json({
      total, days,
      by_source: bySource,
      by_day: Object.entries(byDay).map(([day, count]) => ({ day, count })),
      by_hour: Object.entries(byHour).map(([hour, count]) => ({ hour: parseInt(hour), count })),
      by_referrer: byReferrer,
      trend: { previous: periodA, current: periodB },
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// BACKGROUND JOBS (multi-tenant)
// ============================================================
let _lastReminderRun = 0;
let _lastMembershipRun = 0;
let _lastRetentionRun = 0;

async function runAutoReminders() {
  const now = Date.now();
  if (now - _lastReminderRun < 3 * 60 * 1000) return; // throttle 3 min
  _lastReminderRun = now;
  try {
    // Gap 4: paginate workspaces to handle >100 without skipping any
    let lastDoc = null;
    let hasMore = true;
    while (hasMore) {
      let q = db.collection('workspaces').orderBy('__name__').limit(50);
      if (lastDoc) q = q.startAfter(lastDoc);
      const wsSnap = await q.get();
      if (wsSnap.empty) break;
      for (const ws of wsSnap.docs) {
        const wsCol = (col) => db.collection('workspaces').doc(ws.id).collection(col);
        try {
          const snap = await wsCol('sms_reminders').where('sent', '==', false).limit(50).get();
          for (const d of snap.docs) {
            const r = d.data();
            if (!r.send_at || new Date(r.send_at) > new Date()) continue;
            // Check SMS opt-out before sending (use stored phone_norm if available)
            const phoneNorm = r.phone_norm || normPhone(r.phone);
            if (phoneNorm) {
              const optOutSnap = await wsCol('clients').where('phone_norm', '==', phoneNorm).where('sms_opt_out', '==', true).limit(1).get();
              if (!optOutSnap.empty) {
                await d.ref.update({ sent: true, cancelled: true, cancelled_reason: 'sms_opt_out', cancelled_at: toIso(new Date()) });
                continue;
              }
            }
            // Use stored from_number or fetch workspace config
            const reminderSmsConf = await getWorkspaceSmsConfig(ws.id, { allowGlobalFallback: false });
            const reminderFrom = r.from_number || reminderSmsConf.fromNumber;
            if (!reminderFrom || !reminderSmsConf.canSend) continue;
            sendSms(r.phone, r.message, reminderFrom, ws.id).catch(() => {});
            await d.ref.update({ sent: true, sent_at: toIso(new Date()) });
          }
        } catch (e) { console.warn('runAutoReminders error for ws', ws.id, e?.message); }
      }
      lastDoc = wsSnap.docs[wsSnap.docs.length - 1];
      hasMore = wsSnap.docs.length === 50;
    }
  } catch (e) { console.warn('runAutoReminders error:', e?.message); }
}

// Gap 5: background retry for SMS auto-provisioning.
// Iterates workspaces (paginated) and re-fires autoProvisionSmsOnActivation for any
// workspace whose sms_auto_provision_next_retry_at is due. Uses plain workspace pagination
// instead of a collectionGroup query so no extra Firestore index exemption is required.
// Respects max retries and legacy/protected guards (inside autoProvisionSmsOnActivation).
let _lastSmsAutoRetryRun = 0;
async function runSmsAutoProvisionRetry() {
  const now = Date.now();
  if (now - _lastSmsAutoRetryRun < 5 * 60 * 1000) return; // throttle 5 min
  _lastSmsAutoRetryRun = now;
  try {
    const nowMs = Date.now();
    let lastDoc = null;
    let hasMore = true;
    let processed = 0;
    const maxPerCycle = 500; // safety cap to avoid runaway scans
    while (hasMore && processed < maxPerCycle) {
      let q = db.collection('workspaces').orderBy('__name__').limit(50);
      if (lastDoc) q = q.startAfter(lastDoc);
      const wsSnap = await q.get();
      if (wsSnap.empty) break;
      for (const ws of wsSnap.docs) {
        processed++;
        try {
          const settingsDoc = await db.collection('workspaces').doc(ws.id)
            .collection('settings').doc('config').get();
          if (!settingsDoc.exists) continue;
          const data = settingsDoc.data() || {};
          const retryAt = data.sms_auto_provision_next_retry_at;
          if (!retryAt) continue;
          if (new Date(retryAt).getTime() > nowMs) continue;
          const status = safeStr(data.sms_registration_status || '');
          if (status === 'active' || status === 'failed_max_retries') continue;
          // Fire-and-forget; helper handles own errors and updates retry metadata
          const wsData = ws.data() || {};
          autoProvisionSmsOnActivation(
            { id: ws.id, name: wsData.name || '', slug: wsData.slug || '' },
            'auto_retry'
          ).catch(() => {});
        } catch (e) {
          console.warn('runSmsAutoProvisionRetry error for ws', ws.id, e?.message);
        }
      }
      lastDoc = wsSnap.docs[wsSnap.docs.length - 1];
      hasMore = wsSnap.docs.length === 50;
    }
  } catch (e) {
    console.warn('runSmsAutoProvisionRetry error:', e?.message);
  }
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

// Data retention cleanup — delete bookings older than 2 years (runs daily)
async function runRetentionCleanup() {
  const now = Date.now();
  if (now - _lastRetentionRun < 24 * 60 * 60 * 1000) return; // once per day
  _lastRetentionRun = now;
  const cutoff = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago
  const cutoffIso = toIso(cutoff);
  try {
    const wsSnap = await db.collection('workspaces').limit(100).get();
    for (const ws of wsSnap.docs) {
      try {
        const old = await db.collection('workspaces').doc(ws.id).collection('bookings')
          .where('start_at', '<', cutoffIso)
          .where('status', 'in', ['completed', 'cancelled', 'no_show'])
          .limit(100).get();
        for (const d of old.docs) {
          await d.ref.delete();
        }
        if (old.size > 0) console.log(`Retention cleanup: deleted ${old.size} old bookings from ws ${ws.id}`);
      } catch (e) { console.warn('retention cleanup error for ws', ws.id, e?.message); }
    }
  } catch (e) { console.warn('runRetentionCleanup error:', e?.message); }
}

// Security monitoring — detect suspicious activity
const _securityCounters = { failedLogins: new Map(), massDeletes: new Map() };
let _lastSecurityCheck = 0;

function logSecurityEvent(wsId, event) {
  const col = wsId ? db.collection('workspaces').doc(wsId).collection('security_log') : db.collection('global_security_log');
  col.add({ ...event, timestamp: toIso(new Date()) }).catch(() => {});
}

function alertSecurityBreach(type, details) {
  const alertEmail = process.env.SECURITY_ALERT_EMAIL || 'security@vurium.com';
  const subject = `[SECURITY ALERT] ${type}`;
  const html = `
    <h2 style="color:#e53e3e;">Security Alert: ${type}</h2>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Details:</strong></p>
    <pre style="background:#f7f7f7;padding:16px;border-radius:8px;font-size:13px;">${JSON.stringify(details, null, 2)}</pre>
    <p>Please investigate immediately. If this is a data breach, you must notify affected users within 72 hours per GDPR Article 33.</p>
  `;
  sendEmail(alertEmail, subject, html, 'Vurium Security').catch(() => {});
  console.error(`SECURITY ALERT [${type}]:`, JSON.stringify(details));
}

// Track failed login attempts (brute force detection)
function trackFailedLogin(ip, email) {
  const key = `${ip}:${email || 'unknown'}`;
  const count = (_securityCounters.failedLogins.get(key) || 0) + 1;
  _securityCounters.failedLogins.set(key, count);
  if (count >= 10) {
    alertSecurityBreach('Brute Force Attempt', { ip, email, attempts: count, window: '3 minutes' });
    _securityCounters.failedLogins.delete(key);
  }
}

// Track mass data access/deletion
function trackMassOperation(wsId, operation, count) {
  if (count >= 50) {
    alertSecurityBreach('Mass Data Operation', { workspace: wsId, operation, records_affected: count });
    logSecurityEvent(wsId, { type: 'mass_operation', operation, count });
  }
}

// Reset counters periodically
function resetSecurityCounters() {
  const now = Date.now();
  if (now - _lastSecurityCheck < 3 * 60 * 1000) return;
  _lastSecurityCheck = now;
  _securityCounters.failedLogins.clear();
  _securityCounters.massDeletes.clear();
}

// Run background jobs every 3 minutes
// ─── Periodic Payroll Audit ──────────────────────────────────────────────────
let lastAuditRun = 0;
async function runPayrollAudit() {
  if (Date.now() - lastAuditRun < 30 * 60 * 1000) return; // in-memory: skip if ran less than 30 min ago
  lastAuditRun = Date.now();
  try {
    const wsSnap = await db.collection('workspaces').get();
    for (const wsDoc of wsSnap.docs) {
      try {
        const wsData = wsDoc.data() || {};
        const plan = wsData.plan_type || 'individual';
        if (plan === 'individual') continue;
        const wsCol = (col) => db.collection(`workspaces/${wsDoc.id}/${col}`);

        // Per-workspace throttle: check last_run from Firestore (survives cold starts)
        const auditDoc = await wsCol('settings').doc('payroll_audit').get().catch(() => null);
        const auditData = auditDoc?.exists ? auditDoc.data() : {};
        const lastRunStr = auditData?.last_run || '';
        if (lastRunStr) {
          const lastRunMs = new Date(lastRunStr).getTime();
          if (Date.now() - lastRunMs < 6 * 60 * 60 * 1000) continue; // skip if ran < 6 hours ago
        }

        const now = new Date();
        const from = new Date(now); from.setDate(from.getDate() - 7);
        const fromStr = from.toISOString();
        const toStr = now.toISOString();

        const [bookingsSnap, cashSnap] = await Promise.all([
          wsCol('bookings').where('start_at', '>=', fromStr).where('start_at', '<=', toStr).get(),
          wsCol('cash_reports').orderBy('date', 'desc').limit(30).get(),
        ]);
        const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.status !== 'cancelled');
        const paidBookings = bookings.filter(b => b.paid);
        const warnings = [];

        // Check 1: Unpaid completed bookings (skip blocks, pending, booked, $0 bookings)
        const unpaid = bookings.filter(b => !b.paid && b.type !== 'block' && b.status !== 'noshow' && b.status !== 'no_show' && b.status !== 'booked' && b.status !== 'pending' && Number(b.service_amount || b.amount || 0) > 0);
        const unpaidAmt = unpaid.reduce((s, b) => s + Number(b.service_amount || b.amount || 0), 0);
        if (unpaid.length > 0) warnings.push(`${unpaid.length} unpaid bookings ($${unpaidAmt.toFixed(2)})`);

        // Check 2: Cash not counted
        const cashBookings = paidBookings.filter(b => (b.payment_method || '').toLowerCase() === 'cash');
        if (cashBookings.length > 0) {
          const expectedCash = cashBookings.reduce((s, b) => s + Number(b.service_amount || b.amount || 0) + Number(b.tip || b.tip_amount || 0), 0);
          const cashReports = cashSnap.docs.map(d => d.data());
          const reportDates = new Set(cashReports.map(r => r.date));
          const cashDates = new Set(cashBookings.map(b => (b.start_at || '').slice(0, 10)));
          const uncountedDays = [...cashDates].filter(d => !reportDates.has(d));
          if (uncountedDays.length > 0) warnings.push(`Cash not counted for ${uncountedDays.length} days ($${expectedCash.toFixed(2)} expected)`);
        }

        // Check 3: Missing service amounts
        const noAmount = paidBookings.filter(b => !b.service_amount && !b.amount);
        if (noAmount.length > 0) warnings.push(`${noAmount.length} paid bookings missing service amount`);

        // Check 4: Square card payments verification (linked only)
        const cardBookings = paidBookings.filter(b => ['terminal', 'card', 'applepay'].includes((b.payment_method || '').toLowerCase()));
        if (cardBookings.length > 0) {
          const bookingCardTotal = cardBookings.reduce((s, b) => s + Number(b.service_amount || b.amount || 0) + Number(b.tip || b.tip_amount || 0), 0);
          const bPaymentIds = new Set(cardBookings.map(b => b.payment_id).filter(Boolean));
          try {
            const headers = await squareHeaders(wsCol);
            const params = new URLSearchParams();
            params.set('begin_time', fromStr);
            params.set('end_time', toStr);
            params.set('sort_order', 'DESC');
            const sqResp = await squareFetch(`/v2/payments?${params}`, { headers });
            if (sqResp.ok) {
              const sqData = await sqResp.json();
              const completed = (sqData.payments || []).filter(p => (p.status || '').toUpperCase() === 'COMPLETED');
              const linked = completed.filter(p => bPaymentIds.has(p.id));
              const linkedTotal = linked.reduce((s, p) => s + (Number(p.amount_money?.amount || 0) + Number(p.tip_money?.amount || 0)) / 100, 0);
              const diff = Math.abs(bookingCardTotal - linkedTotal);
              if (diff > 2) {
                warnings.push(`Card mismatch: bookings $${bookingCardTotal.toFixed(2)} vs Square linked $${linkedTotal.toFixed(2)} (diff $${diff.toFixed(2)})`);
              }
            }
          } catch {} // Square not connected — skip
        }

        // Store audit result for in-app badge
        await wsCol('settings').doc('payroll_audit').set({
          last_run: toIso(new Date()),
          warnings_count: warnings.length,
          warnings,
        }, { merge: true }).catch(() => {});

        if (warnings.length === 0) continue;

        // Anti-spam: only notify if warnings changed since last notification
        const prevDoc = await wsCol('settings').doc('payroll_audit').get().catch(() => null);
        const prevData = prevDoc?.exists ? prevDoc.data() : {};
        const prevHash = prevData.notified_hash || '';
        const currentHash = [...warnings].sort().join('|');
        if (prevHash === currentHash) continue;

        await wsCol('settings').doc('payroll_audit').update({ notified_hash: currentHash }).catch(() => {});

        // Notify ONLY owner, ONLY once per new issue set
        const usersSnap = await wsCol('users').where('role', '==', 'owner').limit(1).get();
        if (!usersSnap.empty) {
          const ownerId = usersSnap.docs[0].id;
          const owner = usersSnap.docs[0].data();
          const settingsDoc = await wsCol('settings').doc('config').get().catch(() => null);
          const shopName = settingsDoc?.exists ? safeStr(settingsDoc.data()?.shop_name || '') : '';
          const displayName = shopName || wsData.name || 'Your shop';
          const title = `Payroll Audit: ${warnings.length} issue${warnings.length > 1 ? 's' : ''} — ${displayName}`;
          const body = warnings.join(' | ');

          // Push to owner only
          // Push disabled for audit — email only (push was too frequent)

          // Email to owner only
          const email = owner.email || owner.username;
          if (email && email.includes('@')) {
            const warningsHtml = warnings.map(w => `<li style="margin-bottom:8px;color:#e8e8ed;font-size:14px;">${w}</li>`).join('');
            const html = vuriumEmailTemplate('Payroll Audit', `
              <p style="color:rgba(255,255,255,.6);margin-bottom:16px;">Automatic audit found ${warnings.length} issue${warnings.length > 1 ? 's' : ''} for the last 7 days:</p>
              <ul style="padding-left:18px;margin-bottom:20px;">${warningsHtml}</ul>
              <p style="color:rgba(255,255,255,.4);font-size:13px;">Open Payroll and run Audit for details.</p>
            `, displayName, '', 'dark-cosmos');
            sendEmail(email, title, html, 'Vurium').catch(() => {});
          }
        }

      } catch (wsErr) { /* skip workspace on error */ }
    }
  } catch (e) { console.warn('runPayrollAudit error:', e?.message); }
}

// ============================================================
// SMART BOOKING AUDIT — self-scanning AI-like booking health system
// ============================================================
let lastBookingAuditRun = 0;

async function runBookingAudit() {
  if (Date.now() - lastBookingAuditRun < 30 * 60 * 1000) return; // in-memory: skip if ran < 30 min ago
  lastBookingAuditRun = Date.now();
  const globalIssues = [];
  try {
    const wsSnap = await db.collection('workspaces').get();
    for (const wsDoc of wsSnap.docs) {
      try {
        const wsData = wsDoc.data() || {};
        const wsCol = (col) => db.collection(`workspaces/${wsDoc.id}/${col}`);

        // Per-workspace throttle from Firestore (survives cold starts)
        const auditDoc = await wsCol('settings').doc('booking_audit').get().catch(() => null);
        const auditData = auditDoc?.exists ? auditDoc.data() : {};
        if (auditData?.last_run) {
          const lastMs = new Date(auditData.last_run).getTime();
          if (Date.now() - lastMs < 6 * 60 * 60 * 1000) continue; // skip if ran < 6 hours ago
        }
        const shopName = wsData.shop_name || wsData.name || wsDoc.id;
        const now = new Date();
        const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oneDayAgo = new Date(now); oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Fetch data in parallel
        const [bookingsSnap, barbersSnap, settingsDoc] = await Promise.all([
          wsCol('bookings').where('start_at', '>=', thirtyDaysAgo.toISOString()).get(),
          wsCol('barbers').get(),
          wsCol('settings').doc('config').get(),
        ]);
        const allBookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const activeBarberIds = new Set(barbersSnap.docs.filter(d => d.data()?.active !== false).map(d => d.id));
        const allBarberIds = new Set(barbersSnap.docs.map(d => d.id));
        const barberDataMap = {};
        barbersSnap.docs.forEach(d => { barberDataMap[d.id] = d.data(); });
        const timeZone = settingsDoc.exists ? (settingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
        const recentBookings = allBookings.filter(b => b.start_at >= sevenDaysAgo.toISOString());
        const warnings = [];

        // ── Check 1: Double bookings (same barber, overlapping times) ──
        const nonCancelledRecent = recentBookings.filter(b => b.status !== 'cancelled');
        const byBarber = {};
        for (const b of nonCancelledRecent) {
          if (!b.barber_id) continue;
          (byBarber[b.barber_id] = byBarber[b.barber_id] || []).push(b);
        }
        for (const [barberId, bkgs] of Object.entries(byBarber)) {
          bkgs.sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));
          for (let i = 0; i < bkgs.length - 1; i++) {
            const cur = bkgs[i];
            const next = bkgs[i + 1];
            if (cur.end_at && next.start_at && cur.end_at > next.start_at) {
              warnings.push({ severity: 'critical', check: 'double_booking', message: `Double booking: barber ${cur.barber_name || barberId} has overlapping appointments ${cur.id} and ${next.id} on ${(cur.start_at || '').slice(0, 10)}` });
            }
          }
        }

        // ── Check 2: Ghost barber bookings — notify client with alternatives ──
        const futureBookings = nonCancelledRecent.filter(b => b.start_at > now.toISOString());
        const ghostBookings = [];
        for (const b of futureBookings) {
          if (b.barber_id && !allBarberIds.has(b.barber_id)) {
            if (!b.ghost_barber_notified) ghostBookings.push(b);
            warnings.push({ severity: 'critical', check: 'ghost_barber', message: `Booking ${b.id} assigned to deleted barber ${b.barber_id} (client: ${b.client_name || 'unknown'}, ${(b.start_at || '').slice(0, 16)})` });
          } else if (b.barber_id && !activeBarberIds.has(b.barber_id)) {
            if (!b.ghost_barber_notified) ghostBookings.push(b);
            warnings.push({ severity: 'critical', check: 'ghost_barber', message: `Booking ${b.id} assigned to inactive barber ${b.barber_name || b.barber_id} (client: ${b.client_name || 'unknown'}, ${(b.start_at || '').slice(0, 16)})` });
          }
        }
        // Notify affected clients about ghost barber bookings
        for (const b of ghostBookings.slice(0, 10)) {
          try {
            const manageUrl = b.client_token ? `https://vurium.com/manage-booking?ws=${wsDoc.id}&bid=${b.id}&token=${b.client_token}` : `https://vurium.com/book/${wsDoc.id}`;
            const bookUrl = `https://vurium.com/book/${wsDoc.id}`;
            // SMS notification
            if (b.client_phone) {
              const ghostPhoneNorm = normPhone(b.client_phone);
              let ghostOptedOut = false;
              if (ghostPhoneNorm) {
                const goSnap = await wsCol('clients').where('phone_norm', '==', ghostPhoneNorm).where('sms_opt_out', '==', true).limit(1).get();
                ghostOptedOut = !goSnap.empty;
              }
              if (!ghostOptedOut) {
                const ghostSmsConf = await getWorkspaceSmsConfig(wsDoc.id, { allowGlobalFallback: false });
                const ghostPrefix = shopName ? `${shopName}: ` : '';
                if (ghostSmsConf.canSend) {
                  sendSms(b.client_phone, `${ghostPrefix}Your specialist ${b.barber_name || ''} is no longer available for your appointment on ${(b.start_at || '').slice(0, 10)}. Please rebook with another specialist: ${bookUrl} Msg & data rates may apply. Reply STOP to opt out, HELP for help.`, ghostSmsConf.fromNumber, wsDoc.id).catch(() => {});
                }
              }
            }
            // Email notification
            if (b.client_email) {
              const cfg = await getWorkspaceEmailConfig(wsDoc.id);
              const et = EMAIL_THEMES[cfg.template] || EMAIL_THEMES.modern;
              const isLt = ['classic', 'colorful'].includes(cfg.template);
              const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
              const startAt = parseIso(b.start_at);
              const dateStr = startAt ? startAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone }) : '';
              const timeStr = startAt ? startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone }) : '';
              sendEmail(b.client_email, `Action needed — your specialist is unavailable`, vuriumEmailTemplate('Specialist Unavailable', `
                <p style="color:${et.muted};">We're sorry, but your specialist <b style="color:${et.text};">${b.barber_name || 'your specialist'}</b> is no longer available for your upcoming appointment.</p>
                <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
                  <div style="font-size:16px;font-weight:600;color:${et.text};">${b.service_name || 'Appointment'}</div>
                  <div style="color:${et.muted};margin-top:4px;">${dateStr}${timeStr ? ' at ' + timeStr : ''}</div>
                </div>
                <div style="text-align:center;margin:20px 0;">
                  <a href="${manageUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:14px;font-weight:600;margin-right:8px;">Reschedule</a>
                  <a href="${bookUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(130,150,220,.12)'};border:1px solid ${isLt ? 'rgba(0,0,0,.08)' : 'rgba(130,150,220,.2)'};color:${et.accent};text-decoration:none;font-size:14px;font-weight:600;">Book Another Specialist</a>
                </div>
              `, shopName, '', cfg.template, cfg.contactInfo), shopName).catch(() => {});
            }
            // Mark as notified so we don't spam on next audit cycle
            await db.collection(`workspaces/${wsDoc.id}/bookings`).doc(b.id).update({
              ghost_barber_notified: true, ghost_barber_notified_at: toIso(new Date()),
            }).catch(() => {});
          } catch { /* skip on error */ }
        }

        // ── Check 3: Stale "booked" status — AUTO-FIX to noshow ──
        const stale = nonCancelledRecent.filter(b => b.status === 'booked' && b.start_at && b.start_at < twoHoursAgo.toISOString());
        if (stale.length > 0) {
          // Auto-fix: mark stale bookings as noshow
          let autoFixed = 0;
          for (const b of stale) {
            try {
              await db.collection(`workspaces/${wsDoc.id}/bookings`).doc(b.id).update({
                status: 'noshow', updated_at: toIso(new Date()),
                auto_noshow: true, auto_noshow_at: toIso(new Date()),
              });
              autoFixed++;
            } catch { /* skip on error */ }
          }
          warnings.push({ severity: 'warning', check: 'stale_status', message: `Auto-fixed ${autoFixed}/${stale.length} stale booking${stale.length > 1 ? 's' : ''} → noshow: ${stale.slice(0, 5).map(b => b.id).join(', ')}${stale.length > 5 ? '...' : ''}` });
        }

        // ── Check 4: Missing client data ──
        const noClient = recentBookings.filter(b => b.status !== 'cancelled' && !b.client_name && !b.client_phone && !b.client_email);
        if (noClient.length > 0) {
          warnings.push({ severity: 'warning', check: 'missing_client', message: `${noClient.length} booking${noClient.length > 1 ? 's' : ''} with no client info: ${noClient.slice(0, 3).map(b => b.id).join(', ')}` });
        }

        // ── Check 5: Orphaned future bookings (expired workspace) ──
        const effectivePlan = getEffectivePlan(wsData);
        if (effectivePlan === 'expired' && futureBookings.length > 0) {
          warnings.push({ severity: 'critical', check: 'orphaned_bookings', message: `${futureBookings.length} future booking${futureBookings.length > 1 ? 's' : ''} exist but workspace plan is expired — clients won't be served` });
        }

        // ── Check 6: Schedule violation ──
        let scheduleViolations = 0;
        for (const b of futureBookings.slice(0, 50)) {
          if (!b.barber_id || !barberDataMap[b.barber_id]) continue;
          const startAt = parseIso(b.start_at);
          const endAt = parseIso(b.end_at);
          if (!startAt || !endAt) continue;
          try {
            ensureWithinSchedule(barberDataMap[b.barber_id], startAt, endAt, timeZone);
          } catch (e) {
            if (e.code === 'OUTSIDE_SCHEDULE') scheduleViolations++;
          }
        }
        if (scheduleViolations > 0) {
          warnings.push({ severity: 'warning', check: 'schedule_violation', message: `${scheduleViolations} future booking${scheduleViolations > 1 ? 's' : ''} outside barber working hours` });
        }

        // ── Check 7: Cancellation spike (last 24h) ──
        const last24h = allBookings.filter(b => b.created_at && b.created_at >= oneDayAgo.toISOString());
        if (last24h.length >= 5) {
          const cancelled = last24h.filter(b => b.status === 'cancelled').length;
          const rate = cancelled / last24h.length;
          if (rate > 0.5) {
            warnings.push({ severity: 'warning', check: 'cancellation_spike', message: `High cancellation rate: ${cancelled}/${last24h.length} (${Math.round(rate * 100)}%) in last 24h` });
          }
        }

        // ── Check 8: No-show pattern (clients with 3+ no-shows in 30 days) ──
        const noshowBookings = allBookings.filter(b => isNoshow(b.status));
        const noshowByClient = {};
        for (const b of noshowBookings) {
          const key = b.client_phone || b.client_email || b.client_name;
          if (!key) continue;
          (noshowByClient[key] = noshowByClient[key] || []).push(b);
        }
        const repeatNoshows = Object.entries(noshowByClient).filter(([, bkgs]) => bkgs.length >= 3);
        if (repeatNoshows.length > 0) {
          warnings.push({ severity: 'info', check: 'noshow_pattern', message: `${repeatNoshows.length} client${repeatNoshows.length > 1 ? 's' : ''} with 3+ no-shows in 30 days: ${repeatNoshows.slice(0, 3).map(([k, b]) => `${k} (${b.length}x)`).join(', ')}` });
        }

        if (warnings.length === 0) continue;

        // ── Store audit result for in-app badge ──
        await wsCol('settings').doc('booking_audit').set({
          last_run: toIso(new Date()),
          warnings_count: warnings.length,
          critical_count: warnings.filter(w => w.severity === 'critical').length,
          warnings: warnings.map(w => ({ severity: w.severity, check: w.check, message: w.message })),
        }, { merge: true }).catch(() => {});

        // ── Push notification to workspace owner ──
        const criticalCount = warnings.filter(w => w.severity === 'critical').length;
        const title = `Booking Audit: ${warnings.length} issue${warnings.length > 1 ? 's' : ''}${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}`;
        const body = warnings.slice(0, 3).map(w => w.message).join(' · ');
        // Push disabled for booking audit — was too frequent. Email only.
        // sendCrmPushToRoles(wsCol, ['owner'], title, body, { screen: 'calendar' }, null, null).catch(() => {});

        // ── Email to workspace owner ──
        const usersSnap = await wsCol('users').where('role', '==', 'owner').limit(1).get();
        if (!usersSnap.empty) {
          const owner = usersSnap.docs[0].data();
          const ownerEmail = owner.email || owner.username;
          if (ownerEmail && ownerEmail.includes('@')) {
            const warningsHtml = warnings.map(w => {
              const color = w.severity === 'critical' ? '#ff6b6b' : w.severity === 'warning' ? '#ffd93d' : 'rgba(255,255,255,.6)';
              const badge = w.severity === 'critical' ? '🔴' : w.severity === 'warning' ? '🟡' : '🔵';
              return `<li style="margin-bottom:8px;color:${color};">${badge} ${w.message}</li>`;
            }).join('');
            const html = vuriumEmailTemplate('Booking Health Report', `
              <p style="color:rgba(255,255,255,.6);margin-bottom:16px;">Smart booking audit found ${warnings.length} issue${warnings.length > 1 ? 's' : ''} for <b>${shopName}</b>:</p>
              <ul style="padding-left:18px;margin-bottom:20px;list-style:none;">${warningsHtml}</ul>
              <p style="color:rgba(255,255,255,.4);font-size:13px;">Open your Calendar to review affected bookings.</p>
            `, shopName, '', 'dark-cosmos');
            sendEmail(ownerEmail, '🔍 ' + title + ' — ' + shopName, html, 'Vurium').catch(() => {});
          }
        }

        // ── Collect critical issues for support@vurium.com digest ──
        const criticalWarnings = warnings.filter(w => w.severity === 'critical');
        if (criticalWarnings.length > 0) {
          globalIssues.push({ wsId: wsDoc.id, shopName, warnings: criticalWarnings });
        }

      } catch (wsErr) { /* skip workspace on error */ }
    }

    // ── Send digest to support@vurium.com if any critical issues across all workspaces ──
    if (globalIssues.length > 0) {
      const totalCritical = globalIssues.reduce((s, g) => s + g.warnings.length, 0);
      const sectionsHtml = globalIssues.map(g => {
        const items = g.warnings.map(w => `<li style="margin-bottom:6px;color:#ff6b6b;">${w.message}</li>`).join('');
        return `
          <div style="margin-bottom:20px;padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,80,80,.15);">
            <div style="font-size:15px;font-weight:600;color:#f0f0f5;margin-bottom:8px;">${g.shopName} <span style="color:rgba(255,255,255,.3);font-weight:400;font-size:12px;">${g.wsId}</span></div>
            <ul style="padding-left:18px;margin:0;list-style:none;">${items}</ul>
          </div>`;
      }).join('');
      const supportHtml = vuriumEmailTemplate('Booking System Alert', `
        <p style="color:rgba(255,255,255,.6);margin-bottom:16px;">Smart booking audit detected <b style="color:#ff6b6b;">${totalCritical} critical issue${totalCritical > 1 ? 's' : ''}</b> across ${globalIssues.length} workspace${globalIssues.length > 1 ? 's' : ''}:</p>
        ${sectionsHtml}
        <p style="color:rgba(255,255,255,.4);font-size:13px;margin-top:20px;">Scan completed at ${new Date().toISOString()}</p>
      `, 'Vurium Platform', '', 'dark-cosmos');
      sendEmail('support@vurium.com', `🔍 Booking Alert: ${totalCritical} critical issue${totalCritical > 1 ? 's' : ''} across ${globalIssues.length} workspace${globalIssues.length > 1 ? 's' : ''}`, supportHtml, 'Vurium System').catch(() => {});
    }
  } catch (e) { console.warn('runBookingAudit error:', e?.message); }
}

// ============================================================
// BE.1 — Distributed lock for background jobs (Firestore TTL)
// ============================================================
// When Cloud Run scales to multiple instances under load, every instance fires the
// setInterval below on its own schedule. Without a distributed guard, all 7 jobs run
// once per instance per cycle — duplicate SMS reminders, duplicate auto-notify emails,
// duplicate Telnyx provision attempts, duplicate AI diagnostic spend.
//
// `withJobLock(jobName, ttlSeconds, fn)` acquires a lock row in `job_locks/{jobName}`.
// If another instance already holds a valid lock (locked_until in the future and
// locked_by !== our JOB_INSTANCE_ID), this cycle is skipped on our side. If we hold it,
// we run `fn()` under try/catch, then release the lock in `finally` via a conditional
// transaction that only deletes when we still own it. On crash, the lock expires
// naturally via TTL within at most `ttlSeconds`.
//
// Internal per-job throttles (e.g. `_lastReminderRun`) stay in place as the inner
// guard; the distributed lock is an additional outer guard for multi-instance safety.
// `resetSecurityCounters` is intentionally NOT locked — synchronous, in-memory, harmless
// to double-run.

let _jobInstanceLogged = false;
async function withJobLock(jobName, ttlSeconds, fn) {
  if (!_jobInstanceLogged) {
    console.log(`[JOBS] Instance id: ${JOB_INSTANCE_ID} · distributed lock active`);
    _jobInstanceLogged = true;
  }
  const ref = db.collection('job_locks').doc(jobName);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(30, ttlSeconds) * 1000);

  // Phase 1: acquire
  let acquired = false;
  try {
    acquired = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const data = snap.data() || {};
        const lockedUntil = data.locked_until ? new Date(data.locked_until) : null;
        if (lockedUntil && lockedUntil > now && data.locked_by && data.locked_by !== JOB_INSTANCE_ID) {
          return false;
        }
      }
      tx.set(ref, {
        job_name: jobName,
        locked_by: JOB_INSTANCE_ID,
        locked_at: toIso(now),
        locked_until: toIso(expiresAt),
      });
      return true;
    });
  } catch (e) {
    console.warn(`[JOBS] ${jobName} lock acquire failed:`, e?.message);
    return { skipped: true, reason: 'lock_error' };
  }
  if (!acquired) {
    return { skipped: true, reason: 'locked_by_another_instance' };
  }

  // Phase 2: run job (non-throwing — callers already wrap errors internally)
  try {
    await fn();
  } catch (e) {
    console.warn(`[JOBS] ${jobName} threw:`, e?.message);
  } finally {
    // Phase 3: release only if we still own it
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && snap.data()?.locked_by === JOB_INSTANCE_ID) {
          tx.delete(ref);
        }
      });
    } catch (e) {
      // Lock will expire naturally via TTL if release fails
      console.warn(`[JOBS] ${jobName} lock release failed (will expire on TTL):`, e?.message);
    }
  }
  return { ran: true };
}

setInterval(() => {
  withJobLock('runAutoReminders', 600, runAutoReminders).catch(() => {});
  withJobLock('runAutoMemberships', 600, runAutoMemberships).catch(() => {});
  withJobLock('runRetentionCleanup', 900, runRetentionCleanup).catch(() => {});
  // resetSecurityCounters is synchronous + in-memory — double-run is harmless, no lock needed
  resetSecurityCounters();
  withJobLock('runPayrollAudit', 900, runPayrollAudit).catch(() => {});
  withJobLock('runBookingAudit', 900, runBookingAudit).catch(() => {});
  withJobLock('runSmsAutoProvisionRetry', 600, runSmsAutoProvisionRetry).catch(() => {});
}, 3 * 60 * 1000);

// AI Diagnostics — auto-scan every 30 minutes. Wrapped in withJobLock too so multi-instance
// deploys do not burn double Anthropic spend on scans.
if (ANTHROPIC_API_KEY) {
  setTimeout(
    () => withJobLock('runAIDiagnosticScan', 1800, () => runAIDiagnosticScan('auto')).catch(e => console.warn('AI scan error:', e?.message)),
    120000
  );
  setInterval(
    () => withJobLock('runAIDiagnosticScan', 1800, () => runAIDiagnosticScan('auto')).catch(e => console.warn('AI scan error:', e?.message)),
    30 * 60 * 1000
  );
}

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
    const billingSource = data.billing_source || (data.apple_transaction_id ? 'apple' : (data.stripe_subscription_id ? 'stripe' : null));
    res.json({
      plan_type: data.plan_type || data.plan || 'individual',
      billing_status: data.billing_status || data.subscription_status || (trialActive ? 'trialing' : 'inactive'),
      effective_plan: effectivePlan,
      plan: data.plan_type || data.plan || 'individual', // legacy compat
      billing_source: billingSource,
      stripe_subscription_id: data.stripe_subscription_id || null,
      stripe_customer_id: data.stripe_customer_id || null,
      apple_transaction_id: data.apple_transaction_id || null,
      apple_expires_at: data.apple_expires_at || null,
      trial_active: !!trialActive,
      trial_ends_at: data.trial_ends_at || null,
      trial_days_left: daysLeft,
      subscription_status: data.billing_status || data.subscription_status || (trialActive ? 'trialing' : 'inactive'),
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Cancel subscription — routes to Stripe or Apple based on billing_source
app.post('/api/billing/cancel', requireRole('owner'), async (req, res) => {
  try {
    const wsDoc = await req.wsDoc().get();
    const data = wsDoc.exists ? wsDoc.data() : {};
    const source = data.billing_source || (data.apple_transaction_id ? 'apple' : (data.stripe_subscription_id ? 'stripe' : null));

    if (source === 'apple') {
      // Don't change status here — wait for Apple webhook DID_CHANGE_RENEWAL_STATUS
      // User may open Settings but decide not to cancel
      writeAuditLog(req.wsId, { action: 'billing.cancel.apple.redirect', req }).catch(() => {});
      return res.json({
        ok: true,
        status: data.subscription_status || 'active',
        source: 'apple',
        manage_url: 'https://apps.apple.com/account/subscriptions',
        message: 'To cancel, go to Settings → Apple ID → Subscriptions on your iPhone. Your subscription will remain active until the end of the current period.',
      });
    }

    if (!data.stripe_subscription_id) return res.status(400).json({ error: 'No active subscription found' });
    await stripeFetch(`/v1/subscriptions/${data.stripe_subscription_id}`, {
      method: 'POST',
      body: new URLSearchParams({ cancel_at_period_end: 'true' }).toString(),
    });
    await req.wsDoc().update({ subscription_status: 'cancelling', billing_status: 'cancelling', updated_at: toIso(new Date()) });
    writeAuditLog(req.wsId, { action: 'billing.cancel.stripe', req }).catch(() => {});
    res.json({ ok: true, status: 'cancelling', source: 'stripe' });
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
      business_type: wsData.business_type || null,
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
    console.log(`[Apple IAP] Verified purchase for workspace ${req.wsId}: ${plan} (txn: ${transactionId})`);

    // Gap 5: auto-provision SMS on Apple IAP activation.
    // Fire-and-forget so Apple verify response is not blocked by Telnyx provisioning latency.
    // NEW-002 fix: middleware sets req.wsId (not req.workspaceId) — earlier version passed
    // undefined workspace id into autoProvisionSmsOnActivation, causing the Apple IAP trigger
    // to silently no-op.
    const freshWs = await wsRef.get().catch(() => null);
    if (freshWs && freshWs.exists) {
      const d = freshWs.data() || {};
      autoProvisionSmsOnActivation({ id: req.wsId, name: d.name || '', slug: d.slug || '' }, 'apple_paid').catch(() => {});
    }

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
    // Verify Stripe webhook signature
    let event;
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });
      // Manual HMAC verification (no Stripe SDK dependency)
      const payload = req.body.toString();
      const timestamp = sig.split(',').find(s => s.startsWith('t='))?.slice(2);
      const v1Sig = sig.split(',').find(s => s.startsWith('v1='))?.slice(3);
      if (!timestamp || !v1Sig) return res.status(400).json({ error: 'Invalid signature format' });
      // Check timestamp tolerance (5 min)
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return res.status(400).json({ error: 'Webhook timestamp too old' });
      const expectedSig = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');
      if (expectedSig !== v1Sig) return res.status(400).json({ error: 'Invalid webhook signature' });
      event = JSON.parse(payload);
    } else {
      console.warn('[STRIPE] STRIPE_WEBHOOK_SECRET not set — accepting unverified webhook');
      event = JSON.parse(req.body.toString());
    }
    const type = event.type;
    const obj = event.data?.object;
    if (!obj) return res.json({ ok: true });
    const wsId = obj.metadata?.workspace_id || obj.subscription_details?.metadata?.workspace_id || '';
    logWebhookEvent('stripe', type, wsId, { event_id: event.id, customer: obj.customer }).catch(() => {});
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
  let shouldAutoProvisionSms = false;

  if (type === 'checkout.session.completed') {
    if (obj.subscription) {
      patch.stripe_subscription_id = obj.subscription;
      patch.billing_status = 'active';
      patch.subscription_status = 'active';
      patch.trial_used = true;
      shouldAutoProvisionSms = true;
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
    if (obj.status === 'active' || obj.status === 'trialing') shouldAutoProvisionSms = true;
  } else if (type === 'customer.subscription.deleted') {
    patch.billing_status = 'canceled';
    patch.subscription_status = 'canceled';
    // plan_type stays — just billing_status changes
  } else if (type === 'invoice.payment_failed') {
    patch.billing_status = 'past_due';
    patch.subscription_status = 'past_due';
  } else if (type === 'invoice.payment_succeeded') {
    patch.billing_status = 'active';
    patch.subscription_status = 'active';
    shouldAutoProvisionSms = true;
  }
  await wsRef.update(patch).catch(() => {});

  // Gap 5: auto-provision SMS on successful billing activation.
  // Fire-and-forget — never block webhook ack. Helper handles legacy/protected guards internally.
  if (shouldAutoProvisionSms) {
    const freshWs = await wsRef.get().catch(() => null);
    if (freshWs && freshWs.exists) {
      const d = freshWs.data() || {};
      autoProvisionSmsOnActivation({ id: wsId, name: d.name || '', slug: d.slug || '' }, `stripe:${type}`).catch(() => {});
    }
  }
}

// ============================================================
// APPLE APP STORE — receipt validation + server notifications webhook
// ============================================================

// Decode one segment of a JWS (App Store Server uses JWS-signed payloads).
// NOTE: For production you should verify the JWS signature using Apple's
// root certificates. Here we decode the payload to extract fields and rely
// on the webhook URL being a secret endpoint + cross-checking the
// originalTransactionId against our stored value.
function decodeJWSPayload(jws) {
  if (!jws || typeof jws !== 'string') return null;
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch { return null; }
}

// Validate an Apple receipt against Apple's verifyReceipt endpoint.
// Requires APPLE_SHARED_SECRET env var (App Store Connect → App-Specific Shared Secret).
async function verifyAppleReceipt(receiptData, { sandboxFallback = true } = {}) {
  const sharedSecret = process.env.APPLE_SHARED_SECRET || '';
  const body = JSON.stringify({
    'receipt-data': receiptData,
    'password': sharedSecret,
    'exclude-old-transactions': true,
  });
  const prodUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
  const r = await fetch(prodUrl, { method: 'POST', body });
  const data = await r.json();
  // 21007 = this receipt is from sandbox, retry on sandbox
  if (data?.status === 21007 && sandboxFallback) {
    const r2 = await fetch(sandboxUrl, { method: 'POST', body });
    return await r2.json();
  }
  return data;
}

// Optional: validate receipt before accepting an Apple IAP purchase.
// Clients can POST { receiptData } instead of raw transactionId.
app.post('/api/billing/apple-validate-receipt', requireRole('owner'), async (req, res) => {
  try {
    const { receiptData } = req.body || {};
    if (!receiptData) return res.status(400).json({ error: 'receiptData required' });
    const result = await verifyAppleReceipt(receiptData);
    if (result?.status !== 0) {
      return res.status(400).json({ error: 'Invalid receipt', apple_status: result?.status });
    }
    const latest = (result.latest_receipt_info && result.latest_receipt_info[0]) || null;
    if (!latest) return res.status(400).json({ error: 'No transaction info in receipt' });
    const expiresMs = parseInt(latest.expires_date_ms || '0', 10);
    const nowMs = Date.now();
    const active = expiresMs > nowMs;
    res.json({
      ok: true,
      active,
      transaction_id: latest.transaction_id,
      original_transaction_id: latest.original_transaction_id,
      product_id: latest.product_id,
      expires_at: expiresMs ? new Date(expiresMs).toISOString() : null,
      environment: result.environment || null,
    });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// App Store Server Notifications V2 webhook.
// Configure this URL in App Store Connect → App Information → App Store
// Server Notifications → Production Server URL.
//   https://<your-api>/api/webhooks/apple
app.post('/api/webhooks/apple', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const signedPayload = req.body?.signedPayload;
    if (!signedPayload) { res.json({ ok: true }); return; }
    const payload = decodeJWSPayload(signedPayload);
    if (!payload) { res.json({ ok: true }); return; }

    // payload has: notificationType, subtype, data.signedTransactionInfo, data.signedRenewalInfo
    const notificationType = payload.notificationType;
    const subtype = payload.subtype || '';
    const txInfo = decodeJWSPayload(payload?.data?.signedTransactionInfo) || {};
    const renewalInfo = decodeJWSPayload(payload?.data?.signedRenewalInfo) || {};
    logWebhookEvent('apple', notificationType + (subtype ? '.' + subtype : ''), '', { originalTransactionId: txInfo.originalTransactionId }).catch(() => {});

    const originalTransactionId = txInfo.originalTransactionId || renewalInfo.originalTransactionId;
    if (!originalTransactionId) { res.json({ ok: true }); return; }

    // Find the workspace by original transaction id
    const wsSnap = await db.collection('workspaces')
      .where('apple_original_transaction_id', '==', String(originalTransactionId))
      .limit(1).get();
    if (wsSnap.empty) { res.json({ ok: true }); return; }
    const wsRef = wsSnap.docs[0].ref;

    const patch = { updated_at: toIso(new Date()), apple_last_notification: notificationType };
    if (txInfo.expiresDate) patch.apple_expires_at = new Date(txInfo.expiresDate).toISOString();

    switch (notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
        patch.billing_status = 'active';
        patch.subscription_status = 'active';
        break;
      case 'DID_CHANGE_RENEWAL_STATUS':
        // subtype AUTO_RENEW_DISABLED → user cancelled auto-renew in Settings
        if (subtype === 'AUTO_RENEW_DISABLED') {
          patch.billing_status = 'cancelling';
          patch.subscription_status = 'cancelling';
        } else if (subtype === 'AUTO_RENEW_ENABLED') {
          patch.billing_status = 'active';
          patch.subscription_status = 'active';
        }
        break;
      case 'EXPIRED':
      case 'GRACE_PERIOD_EXPIRED':
        patch.billing_status = 'canceled';
        patch.subscription_status = 'canceled';
        break;
      case 'REFUND':
      case 'REVOKE':
        patch.billing_status = 'canceled';
        patch.subscription_status = 'canceled';
        break;
      case 'DID_FAIL_TO_RENEW':
        patch.billing_status = 'past_due';
        patch.subscription_status = 'past_due';
        break;
      default:
        // OFFER_REDEEMED, PRICE_INCREASE, RENEWAL_EXTENDED, etc. — just log
        break;
    }

    await wsRef.update(patch).catch(() => {});
    console.log(`[Apple Webhook] ${notificationType}${subtype ? '/' + subtype : ''} → workspace ${wsRef.id}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Apple Webhook] error:', e);
    res.json({ ok: true });
  }
});

// ============================================================
// MANAGE BOOKING (client-facing: cancel / reschedule via email link)
// ============================================================

async function getBookingByToken(wsId, bookingId, token) {
  const ref = db.collection('workspaces').doc(wsId).collection('bookings').doc(bookingId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  if (doc.data().client_token !== token) return null; // security check
  return { ref, id: doc.id, data: doc.data() };
}

app.get('/public/manage-booking', async (req, res) => {
  try {
    const { ws, bid, token } = req.query;
    if (!ws || !bid || !token) return res.status(400).json({ error: 'ws, bid, and token query params required' });
    const booking = await getBookingByToken(ws, bid, token);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const { id, data } = booking;
    const wsId = data.workspace_id || ws;
    const cfg = await getWorkspaceEmailConfig(wsId);
    res.json({
      id,
      workspace_id: wsId,
      shop_name: cfg.shopName,
      logo_url: cfg.logoUrl,
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

app.post('/public/manage-booking/cancel', async (req, res) => {
  try {
    const { ws, bid, token } = req.body || {};
    if (!ws || !bid || !token) return res.status(400).json({ error: 'ws, bid, and token required in request body' });
    const booking = await getBookingByToken(ws, bid, token);
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
    if (data.client_email && data.workspace_id) {
      const cfg = await getWorkspaceEmailConfig(data.workspace_id);
      const { shopName, logoUrl, template } = cfg;
      const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
      const isLt = ['classic', 'colorful'].includes(template);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      sendEmail(data.client_email, 'Booking Cancelled', vuriumEmailTemplate('Booking Cancelled', `
        <p>Your appointment has been cancelled as requested.</p>
        <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:${et.text};">${data.service_name || 'Appointment'}</div>
          <div style="color:${et.muted};margin-top:4px;">with ${data.barber_name || 'your specialist'}</div>
        </div>
        <p style="font-size:12px;color:${et.muted};">To book a new appointment, visit our booking page.</p>
      `, shopName, logoUrl, template, cfg.contactInfo), shopName).catch(() => {});
    }
    // Waitlist auto-fill
    tryWaitlistAutoFill(data.workspace_id || ws, data).catch(() => {});
    res.json({ ok: true, status: 'cancelled' });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

app.post('/public/manage-booking/reschedule', async (req, res) => {
  try {
    const { ws, bid, token } = req.body || {};
    if (!ws || !bid || !token) return res.status(400).json({ error: 'ws, bid, and token required in request body' });
    const booking = await getBookingByToken(ws, bid, token);
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
    // Validate against barber schedule
    const wsColResch = (col) => db.collection('workspaces').doc(wsId).collection(col);
    const reschBarberDoc = await wsColResch('barbers').doc(data.barber_id).get();
    if (!reschBarberDoc.exists) return res.status(404).json({ error: 'Barber not found' });
    const reschSettingsDoc = await wsColResch('settings').doc('config').get();
    const reschTz = reschSettingsDoc.exists ? (reschSettingsDoc.data()?.timezone || 'America/Chicago') : 'America/Chicago';
    try {
      ensureWithinSchedule(reschBarberDoc.data(), newStartAt, newEndAt, reschTz);
    } catch (e) {
      if (e.code === 'OUTSIDE_SCHEDULE') {
        const recommendation = await getSmartRecommendation(wsColResch, data.barber_id, newStartAt, durMin, reschTz);
        return res.status(400).json({ error: 'Selected time is outside barber working hours', ...(recommendation ? { recommendation } : {}) });
      }
      throw e;
    }
    const bookingsRef = db.collection('workspaces').doc(wsId).collection('bookings');
    try {
      await db.runTransaction(async (tx) => {
        await ensureNoConflictTx(tx, bookingsRef, { barberId: data.barber_id, startAt: newStartAt, endAt: newEndAt, excludeBookingId: ref.id });
        tx.update(ref, { start_at: toIso(newStartAt), end_at: toIso(newEndAt), status: 'booked', updated_at: toIso(new Date()) });
      });
    } catch (e) {
      if (e.code === 'CONFLICT' || String(e.message).includes('CONFLICT')) {
        const recommendation = await getSmartRecommendation(wsColResch, data.barber_id, newStartAt, durMin, reschTz);
        return res.status(409).json({ error: 'Slot already booked', ...(recommendation ? { recommendation } : {}) });
      }
      throw e;
    }
    // Send rescheduled confirmation email
    if (data.client_email) {
      const cfg = await getWorkspaceEmailConfig(wsId);
      const { shopName, logoUrl, tz, template } = cfg;
      const et = EMAIL_THEMES[template] || EMAIL_THEMES.modern;
      const isLt = ['classic', 'colorful'].includes(template);
      const cardBg = isLt ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      const timeStr = newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = newStartAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
      const manageUrl = `https://vurium.com/manage-booking?ws=${wsId}&bid=${ref.id}&token=${data.client_token}`;
      sendEmail(data.client_email, 'Booking Rescheduled', vuriumEmailTemplate('Booking Rescheduled', `
        <p>Your appointment has been rescheduled:</p>
        <div style="padding:16px;border-radius:14px;background:${cardBg};border:1px solid ${et.border};margin:16px 0;">
          <div style="font-size:16px;font-weight:600;color:${et.text};">${data.service_name || 'Appointment'}</div>
          <div style="color:${et.muted};margin-top:4px;">with ${data.barber_name || 'your specialist'}</div>
          <div style="color:${et.accent};font-weight:500;margin-top:8px;">${dateStr} at ${timeStr}</div>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <a href="${manageUrl}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:${isLt ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'};border:1px solid ${et.border};color:${et.text};text-decoration:none;font-size:13px;font-weight:500;">Manage Booking</a>
        </div>
      `, shopName, logoUrl, template, cfg.contactInfo), shopName).catch(() => {});
    }
    res.json({ ok: true, start_at: toIso(newStartAt), end_at: toIso(newEndAt) });
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// ============================================================
// GDPR DATA EXPORT (authenticated users)
// ============================================================
app.get('/api/data-export', requireAuth, async (req, res) => {
  try {
    const wsId = req.wsId;
    // BUG-008 fix: auth middleware sets req.user.uid, never req.userId. Previously every
    // query below ran with userId=undefined and silently returned empty results — GDPR
    // export responded with a zero-content file that still claimed to be a valid export.
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const wsCol = (col) => db.collection('workspaces').doc(wsId).collection(col);

    // Gather user profile
    const userDoc = await wsCol('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Gather bookings
    const bookingsSnap = await wsCol('bookings').where('user_id', '==', userId).limit(500).get();
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Gather client records by phone
    const phoneNorm = userData.phone_norm || normPhone(userData.phone || '');
    let clientRecords = [];
    if (phoneNorm) {
      const clientSnap = await wsCol('clients').where('phone_norm', '==', phoneNorm).limit(10).get();
      clientRecords = clientSnap.docs.map(d => {
        const cd = d.data();
        return { id: d.id, name: decryptPII(cd.name), phone_last4: cd.phone_norm ? '****' + cd.phone_norm.slice(-4) : '', email: decryptPII(cd.email), sms_consent: cd.sms_consent, sms_opt_out: cd.sms_opt_out || false, created_at: cd.created_at };
      });
    }

    // Gather SMS consent/reminders
    const remindersSnap = phoneNorm ? await wsCol('sms_reminders').where('phone', '==', phoneNorm).limit(100).get() : { docs: [] };
    const reminders = remindersSnap.docs.map(d => ({ id: d.id, type: d.data().type, send_at: d.data().send_at, sent: d.data().sent }));

    const exportData = {
      exported_at: toIso(new Date()),
      format_version: '1.0',
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        created_at: userData.created_at,
      },
      client_records: clientRecords,
      bookings: bookings.map(b => ({
        id: b.id,
        service_name: b.service_name,
        barber_name: b.barber_name,
        start_at: b.start_at,
        end_at: b.end_at,
        status: b.status,
        created_at: b.created_at,
      })),
      sms_reminders: reminders,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="vurium-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(exportData);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Public data export (for clients who booked via public page, using client token)
app.get('/public/data-export/:token', async (req, res) => {
  try {
    const token = safeStr(req.params.token);
    if (!token) return res.status(400).json({ error: 'Token required' });
    // Find booking by client_token across workspaces
    const wsSnap = await db.collection('workspaces').limit(100).get();
    let found = null;
    for (const ws of wsSnap.docs) {
      const bSnap = await db.collection('workspaces').doc(ws.id).collection('bookings').where('client_token', '==', token).limit(1).get();
      if (!bSnap.empty) {
        const bData = bSnap.docs[0].data();
        const phoneNorm = normPhone(bData.client_phone || '');
        // Get all bookings for this client
        let allBookings = [];
        if (phoneNorm) {
          const allSnap = await db.collection('workspaces').doc(ws.id).collection('bookings').where('phone_norm', '==', phoneNorm).limit(200).get();
          allBookings = allSnap.docs.map(d => ({ id: d.id, service_name: d.data().service_name, barber_name: d.data().barber_name, start_at: d.data().start_at, status: d.data().status, created_at: d.data().created_at }));
        }
        found = {
          exported_at: toIso(new Date()),
          format_version: '1.0',
          client: { name: bData.client_name, email: bData.client_email, phone_last4: phoneNorm ? '****' + phoneNorm.slice(-4) : '' },
          bookings: allBookings,
        };
        break;
      }
    }
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="vurium-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(found);
  } catch (e) { res.status(500).json({ error: e?.message }); }
});

// Health check duplicate removed — single endpoint at line ~3168

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
  // Log critical unhandled errors for breach detection
  if (err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('EPERM') || err.message.includes('unauthorized'))) {
    logSecurityEvent(null, { type: 'unhandled_error', message: err.message, path: req.path, ip: req.ip });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`VuriumBook API running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});
