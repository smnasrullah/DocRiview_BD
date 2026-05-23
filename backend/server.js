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

// ── Middleware ─────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin:         process.env.ALLOWED_ORIGIN || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, '..')));

// ── Rate limiters ──────────────────────────────────────────────

const authLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,  message: { error: 'অনেকবার চেষ্টা করেছেন। ১৫ মিনিট পর আবার চেষ্টা করুন।' } });
const otpLimiter   = rateLimit({ windowMs:      60 * 1000, max: 5,   message: { error: 'OTP request সীমা অতিক্রম। ১ মিনিট পর চেষ্টা করুন।' } });
const writeLimiter = rateLimit({ windowMs:      60 * 1000, max: 30  });
const readLimiter  = rateLimit({ windowMs:      60 * 1000, max: 120 });

// ── Auth helpers ───────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d', issuer: 'docreview-bd' }
  );
}

function auth(req, res, next) {
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

function role(...roles) {
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

// ── Health ─────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Site ───────────────────────────────────────────────────────

app.post('/api/visit',   (req, res) => { DB.recordVisit(); res.json({ ok: true }); });
app.get('/api/stats', readLimiter, (req, res) => res.json(DB.getStats()));

// ── Auth ───────────────────────────────────────────────────────

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email ও password দিন' });
  const result = DB.findUser(email, password);
  if (!result)       return res.status(401).json({ error: 'Email বা password ভুল' });
  if (result.banned) return res.status(403).json({ banned: true, error: 'আপনার account বন্ধ করা হয়েছে।', banReason: result.banReason });
  res.json({ user: result, token: signToken(result) });
});

app.post('/api/auth/otp/save',   otpLimiter, (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email ও code দিন' });
  DB.saveOtp(email, String(code));
  res.json({ ok: true });
});

app.post('/api/auth/otp/verify', otpLimiter, (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email ও code দিন' });
  const result = DB.verifyOtp(email, String(code));
  if (result.error) return res.status(400).json(result);
  res.json({ ok: true });
});

app.post('/api/auth/register/patient', authLimiter, (req, res) => {
  const result = DB.registerPatient(req.body, req.body.deviceFp || null, networkHint(req));
  if (result.error) return res.status(400).json(result);
  res.status(201).json({ user: result.user, token: signToken(result.user) });
});

app.post('/api/auth/register/doctor', authLimiter, (req, res) => {
  const result = DB.registerDoctor(req.body, req.body.deviceFp || null, networkHint(req));
  if (result.error) return res.status(400).json(result);
  res.status(201).json({ user: result.user, doctor: result.doctor, token: signToken(result.user) });
});

app.get('/api/auth/check/email',  readLimiter, (req, res) => res.json({ exists: DB.emailExists(req.query.email || '') }));
app.get('/api/auth/check/phone',  readLimiter, (req, res) => {
  const p = req.query.phone || '';
  res.json({ exists: DB.phoneExistsForPatient(p), banned: DB.isPhoneBanned(p) });
});
app.get('/api/auth/check/device', readLimiter, (req, res) => res.json({ banned: DB.isDeviceBanned(req.query.fp || '') }));
app.get('/api/auth/check/bmdc',   readLimiter, (req, res) => res.json({ exists: DB.bmdcExists(req.query.bmdc || '') }));

// ── Doctors ────────────────────────────────────────────────────

app.get('/api/doctors', readLimiter, (req, res) => {
  const { q, specialty, district, sort, page } = req.query;
  res.json((q || specialty || district || sort)
    ? DB.searchDoctors(q, specialty, district, sort, page)
    : DB.getAllDoctors());
});

app.get('/api/doctors/:id',     readLimiter, (req, res) => {
  const doc = DB.getDoctorById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Doctor পাওয়া যায়নি' });
  res.json(doc);
});

app.get('/api/doctors/:id/pic', readLimiter, (req, res) => res.json({ pic: DB.getDoctorPic(req.params.id) }));

app.post('/api/doctors',    auth, role('admin'),  writeLimiter, (req, res) => {
  const result = DB.addDoctor(req.body);
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.delete('/api/doctors/:id', auth, role('admin'), (req, res) => {
  DB.deleteDoctor(req.params.id);
  res.json({ success: true });
});

app.put('/api/doctors/me', auth, role('doctor'), writeLimiter, (req, res) => {
  const result = DB.updateDoctorProfile(req.user.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ── Reviews ────────────────────────────────────────────────────

app.get('/api/doctors/:id/reviews', readLimiter, (req, res) => res.json(DB.getReviewsByDoctor(req.params.id)));

app.post('/api/doctors/:id/reviews', auth, role('patient'), writeLimiter, (req, res) => {
  const user = DB.getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User পাওয়া যায়নি' });
  const { rating, comment, fileData, deviceFp } = req.body;
  const result = DB.addReview(req.params.id, req.user.id, user.name, rating, comment, fileData, deviceFp, networkHint(req));
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.post('/api/reviews/:id/helpful', writeLimiter, (req, res) => { DB.markHelpful(req.params.id); res.json({ success: true }); });

app.post('/api/reviews/:id/reply', auth, writeLimiter, (req, res) => {
  const user = DB.getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User পাওয়া যায়নি' });
  const result = DB.addReply(req.params.id, req.user.id, user.name, req.user.role, req.body.text);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/reviews/:id/verify',  auth, role('admin'), (req, res) => {
  const result = DB.setReviewVerification(req.params.id, req.body.status);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/reviews/:id',      auth, role('admin'), (req, res) => { DB.deleteReview(req.params.id); res.json({ success: true }); });
app.get('/api/reviews/:id/file',    auth, role('admin'), (req, res) => {
  const file = DB.getReviewFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'File পাওয়া যায়নি' });
  res.json(file);
});

// ── Users ──────────────────────────────────────────────────────

app.get('/api/users/me',          auth,           (req, res) => {
  const user = DB.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User পাওয়া যায়নি' });
  res.json(user);
});

app.put('/api/users/me',          auth, writeLimiter, (req, res) => {
  const result = DB.updateUser(req.user.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/users/me/pic',      auth, writeLimiter, (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Image data নেই' });
  if (base64.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image ৫MB-এর বেশি হবে না' });
  DB.setProfilePic(req.user.id, base64);
  res.json({ success: true });
});

app.put('/api/users/me/password', auth, writeLimiter, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'কমপক্ষে ৬ অক্ষরের password দিন' });
  DB.changePassword(req.user.id, newPassword);
  res.json({ success: true });
});

app.delete('/api/users/me',       auth, (req, res) => { DB.deleteAccount(req.user.id); res.json({ success: true }); });

app.get('/api/users/me/reviews',  auth, role('patient'), (req, res) => {
  const reviews   = DB.getReviewsByPatient(req.user.id);
  const remaining = Math.max(0, 20 - DB.checkReviewLimitMonthly(req.user.id));
  res.json({ reviews, remaining });
});

// ── Admin ──────────────────────────────────────────────────────

app.get('/api/admin/users',        auth, role('admin'), (req, res) => res.json(DB.getAllUsers()));
app.get('/api/admin/reviews',      auth, role('admin'), (req, res) => res.json(DB.getAllReviews()));
app.get('/api/admin/audit',        auth, role('admin'), (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  res.json(DB.getAuditLog(limit, offset));
});

app.post('/api/admin/users/:id/ban',   auth, role('admin'), (req, res) => { DB.banUser(req.params.id, req.body.reason || 'admin_ban'); res.json({ success: true }); });
app.post('/api/admin/users/:id/unban', auth, role('admin'), (req, res) => { DB.unbanUser(req.params.id); res.json({ success: true }); });

// ── BMDC ───────────────────────────────────────────────────────

app.get('/api/admin/bmdc',            auth, role('admin'), (req, res) => res.json(DB.getBmdcSyncInfo()));
app.get('/api/admin/bmdc/revoked',    auth, role('admin'), (req, res) => res.json(DB.getRevokedBmdc()));
app.post('/api/admin/bmdc/sync',      auth, role('admin'), (req, res) => res.json(DB._runBmdcSync()));

app.post('/api/admin/bmdc/revoke',    auth, role('admin'), (req, res) => {
  if (!req.body.bmdc) return res.status(400).json({ error: 'BMDC নম্বর দিন' });
  res.json(DB.revokeBmdc(req.body.bmdc, req.body.reason));
});

app.post('/api/admin/bmdc/reinstate', auth, role('admin'), (req, res) => {
  if (!req.body.bmdc) return res.status(400).json({ error: 'BMDC নম্বর দিন' });
  res.json(DB.reinstateBmdc(req.body.bmdc));
});

// ── Fallback ───────────────────────────────────────────────────

app.use('/api/*', (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.use((err, req, res, _next) => { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Internal server error' }); });

// ── Start ──────────────────────────────────────────────────────

let server;

DB.initDB().then(() => {
  DB.autoBmdcSync();
  setInterval(() => DB.cleanExpiredOtps(), 10 * 60 * 1000);

  server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   DocReview BD · http://localhost:${PORT} ║
╚══════════════════════════════════════╝`);
  });
}).catch(err => { console.error('[FATAL]', err); process.exit(1); });

function shutdown(sig) {
  console.log(`\n[${sig}] Shutting down...`);
  server?.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM',            () => shutdown('SIGTERM'));
process.on('SIGINT',             () => shutdown('SIGINT'));
process.on('uncaughtException',   e  => console.error('[UNCAUGHT]',  e));
process.on('unhandledRejection',  e  => console.error('[UNHANDLED]', e));
