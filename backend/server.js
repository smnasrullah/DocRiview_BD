'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const path      = require('path');
const DB        = require('./db');

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'docreview_bd_CHANGE_IN_PROD';

// ── Encryption Key Startup Check ─────────────────────────────
// Warn if default/missing ENC_KEY is used in production
if (process.env.NODE_ENV === 'production' && !process.env.ENC_KEY) {
  console.error('\n[FATAL] ENC_KEY is not set in environment!');
  console.error('[FATAL] All sensitive data encryption will use a weak fallback key.');
  console.error('[FATAL] Set ENC_KEY in your .env file before starting in production.\n');
  process.exit(1);
}
if (!process.env.ENC_KEY) {
  console.warn('\n[WARN] ENC_KEY not set — using development fallback key.');
  console.warn('[WARN] Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.warn('[WARN] Then set ENC_KEY=<result> in your .env file.\n');
}
if (process.env.JWT_SECRET === 'docreview_bd_CHANGE_IN_PROD' || process.env.JWT_SECRET === 'docreview_bd_CHANGE_THIS_TO_A_LONG_RANDOM_SECRET') {
  console.warn('[WARN] JWT_SECRET is using the default value. Change it in production!\n');
}

// ── Middleware ────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin:         process.env.ALLOWED_ORIGIN || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, '..')));

// ── Rate Limiters ─────────────────────────────────────────────
const authLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'অনেকবার চেষ্টা করেছেন। ১৫ মিনিট পর আবার চেষ্টা করুন।' } });
const otpLimiter   = rateLimit({ windowMs: 60 * 1000, max: 5,
  message: { error: 'OTP request সীমা অতিক্রম। ১ মিনিট পর চেষ্টা করুন।' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: 120 });

// ── Auth Helpers ──────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d', issuer: 'docreview-bd' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authorization header missing' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET, { issuer: 'docreview-bd' });
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired. আবার login করুন।' : 'Token invalid';
    res.status(401).json({ error: msg });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
    next();
  };
}

function networkHint(req) {
  const ip    = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const match = /^(192\.168\.\d+|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+)/.exec(ip);
  return match ? 'NET_' + match[0].replace(/\./g, '_') : null;
}

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Stats & Visit ─────────────────────────────────────────────
app.post('/api/visit', async (req, res) => {
  await DB.recordVisit();
  res.json({ ok: true, visits: await DB.getVisitCount() });
});

app.get('/api/stats', readLimiter, async (req, res) => {
  res.json(await DB.getStats());
});

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email ও password দিন' });
  const result = await DB.findUser(email, password);
  if (!result)       return res.status(401).json({ error: 'Email বা password ভুল' });
  if (result.banned) return res.status(403).json({ banned: true, error: 'আপনার account বন্ধ করা হয়েছে।', banReason: result.banReason });
  res.json({ user: result, token: signToken(result) });
});

app.post('/api/auth/otp/save', otpLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email ও code দিন' });
  await DB.saveOtp(email, String(code));
  res.json({ ok: true });
});

app.post('/api/auth/otp/verify', otpLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email ও code দিন' });
  const result = await DB.verifyOtp(email, String(code));
  if (result.error) return res.status(400).json(result);
  res.json({ ok: true });
});

app.post('/api/auth/register/patient', authLimiter, async (req, res) => {
  const result = await DB.registerPatient(req.body, req.body.deviceFp || null, networkHint(req));
  if (result.error) return res.status(400).json(result);
  res.status(201).json({ user: result.user, token: signToken(result.user) });
});

app.post('/api/auth/register/doctor', authLimiter, async (req, res) => {
  const result = await DB.registerDoctor(req.body, req.body.deviceFp || null, networkHint(req));
  if (result.error) return res.status(400).json(result);
  res.status(201).json({ user: result.user, doctor: result.doctor, token: signToken(result.user) });
});

app.get('/api/auth/check/email',  readLimiter, async (req, res) => res.json({ exists: await DB.emailExists(req.query.email || '') }));
app.get('/api/auth/check/phone',  readLimiter, async (req, res) => {
  const p = req.query.phone || '';
  res.json({ exists: await DB.phoneExistsForPatient(p), banned: await DB.isPhoneBanned(p) });
});
app.get('/api/auth/check/device', readLimiter, async (req, res) => res.json({ banned: await DB.isDeviceBanned(req.query.fp || '') }));
app.get('/api/auth/check/bmdc',   readLimiter, async (req, res) => res.json({ exists: await DB.bmdcExists(req.query.bmdc || '') }));

// ── Doctors ───────────────────────────────────────────────────
app.get('/api/doctors', readLimiter, async (req, res) => {
  const { q, specialty, district, sort, page } = req.query;
  if (q || specialty || district || sort)
    return res.json(await DB.searchDoctors(q, specialty, district, sort, page));
  res.json(await DB.getAllDoctors());
});

app.get('/api/doctors/:id',     readLimiter, async (req, res) => {
  const doc = await DB.getDoctorById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Doctor পাওয়া যায়নি' });
  res.json(doc);
});

app.get('/api/doctors/:id/pic', readLimiter, async (req, res) => {
  res.json({ pic: await DB.getDoctorPic(req.params.id) });
});

app.post('/api/doctors', authMiddleware, requireRole('admin'), writeLimiter, async (req, res) => {
  const result = await DB.addDoctor(req.body);
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.delete('/api/doctors/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  await DB.deleteDoctor(req.params.id);
  res.json({ success: true });
});

app.put('/api/doctors/me', authMiddleware, requireRole('doctor'), writeLimiter, async (req, res) => {
  const result = await DB.updateDoctorProfile(req.user.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ── Reviews ───────────────────────────────────────────────────
app.get('/api/doctors/:id/reviews', readLimiter, async (req, res) => {
  res.json(await DB.getReviewsByDoctor(req.params.id));
});

app.post('/api/doctors/:id/reviews', authMiddleware, requireRole('patient'), writeLimiter, async (req, res) => {
  const { rating, comment, fileData, deviceFp } = req.body;
  const user = await DB.getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User পাওয়া যায়নি' });
  const result = await DB.addReview(
    req.params.id, req.user.id, user.name,
    rating, comment, fileData, deviceFp, networkHint(req)
  );
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.post('/api/reviews/:id/helpful', writeLimiter, async (req, res) => {
  await DB.markHelpful(req.params.id);
  res.json({ success: true });
});

app.post('/api/reviews/:id/reply', authMiddleware, writeLimiter, async (req, res) => {
  const { text } = req.body;
  const user = await DB.getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User পাওয়া যায়নি' });
  const result = await DB.addReply(req.params.id, req.user.id, user.name, req.user.role, text);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/reviews/:id/verify', authMiddleware, requireRole('admin'), async (req, res) => {
  const result = await DB.setReviewVerification(req.params.id, req.body.status);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/reviews/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  await DB.deleteReview(req.params.id);
  res.json({ success: true });
});

app.get('/api/reviews/:id/file', authMiddleware, requireRole('admin'), async (req, res) => {
  const file = await DB.getReviewFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'File পাওয়া যায়নি' });
  res.json(file);
});

// ── Users ─────────────────────────────────────────────────────
app.get('/api/users/me', authMiddleware, async (req, res) => {
  const user = await DB.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User পাওয়া যায়নি' });
  res.json(user);
});

app.put('/api/users/me', authMiddleware, writeLimiter, async (req, res) => {
  const result = await DB.updateUser(req.user.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/users/me/pic', authMiddleware, writeLimiter, async (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Image data নেই' });
  if (base64.length > 5 * 1024 * 1024)
    return res.status(400).json({ error: 'Image ৫MB-এর বেশি হবে না' });
  await DB.setProfilePic(req.user.id, base64);
  res.json({ success: true });
});

app.put('/api/users/me/password', authMiddleware, writeLimiter, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'কমপক্ষে ৬ অক্ষরের password দিন' });
  await DB.changePassword(req.user.id, newPassword);
  res.json({ success: true });
});

app.delete('/api/users/me', authMiddleware, async (req, res) => {
  await DB.deleteAccount(req.user.id);
  res.json({ success: true });
});

app.get('/api/users/me/reviews', authMiddleware, requireRole('patient'), async (req, res) => {
  const reviews   = await DB.getReviewsByPatient(req.user.id);
  const remaining = 20 - await DB.checkReviewLimitMonthly(req.user.id);
  res.json({ reviews, remaining: remaining < 0 ? 0 : remaining });
});

// ── Admin ─────────────────────────────────────────────────────
app.get('/api/admin/users',   authMiddleware, requireRole('admin'), async (req, res) => res.json(await DB.getAllUsers()));
app.get('/api/admin/reviews', authMiddleware, requireRole('admin'), async (req, res) => res.json(await DB.getAllReviews()));

app.get('/api/admin/audit', authMiddleware, requireRole('admin'), async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  res.json(await DB.getAuditLog(limit, offset));
});

app.post('/api/admin/users/:id/ban',   authMiddleware, requireRole('admin'), async (req, res) => {
  await DB.banUser(req.params.id, req.body.reason || 'admin_ban');
  res.json({ success: true });
});
app.post('/api/admin/users/:id/unban', authMiddleware, requireRole('admin'), async (req, res) => {
  await DB.unbanUser(req.params.id);
  res.json({ success: true });
});

// ── BMDC ──────────────────────────────────────────────────────
app.get('/api/admin/bmdc',         authMiddleware, requireRole('admin'), async (req, res) => res.json(await DB.getBmdcSyncInfo()));
app.get('/api/admin/bmdc/revoked', authMiddleware, requireRole('admin'), async (req, res) => res.json(await DB.getRevokedBmdc()));

app.post('/api/admin/bmdc/sync', authMiddleware, requireRole('admin'), async (req, res) => {
  res.json(await DB._runBmdcSync());
});

app.post('/api/admin/bmdc/revoke', authMiddleware, requireRole('admin'), async (req, res) => {
  const { bmdc, reason } = req.body;
  if (!bmdc) return res.status(400).json({ error: 'BMDC নম্বর দিন' });
  res.json(await DB.revokeBmdc(bmdc, reason));
});

app.post('/api/admin/bmdc/reinstate', authMiddleware, requireRole('admin'), async (req, res) => {
  const { bmdc } = req.body;
  if (!bmdc) return res.status(400).json({ error: 'BMDC নম্বর দিন' });
  res.json(await DB.reinstateBmdc(bmdc));
});

// ── 404 & Error Handlers ──────────────────────────────────────
app.use('/api/*', async (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

app.get('*', async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
let server;

DB.initDB().then(async () => {
  await DB.autoBmdcSync();
  setInterval(() => DB.cleanExpiredOtps().catch(console.error), 10 * 60 * 1000);

  server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   DocReview BD  ·  http://localhost:${PORT}
╚══════════════════════════════════════╝`);
  });
}).catch(err => {
  console.error('[FATAL] DB init failed:', err);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down...`);
  server?.close(() => { console.log('[DONE] Server closed.'); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM',             () => shutdown('SIGTERM'));
process.on('SIGINT',              () => shutdown('SIGINT'));
process.on('uncaughtException',   err => console.error('[UNCAUGHT]',  err));
process.on('unhandledRejection',  err => console.error('[UNHANDLED]', err));
