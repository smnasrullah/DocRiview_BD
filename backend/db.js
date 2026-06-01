'use strict';

// ============================================================
// db.js  —  DocReview BD  |  Microsoft SQL Server Edition
// ============================================================
// SQLite (better-sqlite3) → Microsoft SQL Server (mssql)
//
// server.js calls DB functions synchronously — we use
// deasync to wrap all async MSSQL calls into sync functions
// so server.js remains 100% unchanged.
//
// Encryption: AES-256-GCM at-rest (identical to SQLite version)
//   Encrypted : name, email, phone, address, blood_group,
//               gender, age, profile_pic, doctor phone/email,
//               review patient_name, comment, file_data/name,
//               banned_phone
//   Plain     : specialty, hospital, about, rating, district,
//               bmdc, degrees (JSON), replies (JSON), etc.
//   Passwords : bcrypt (one-way, separate)
// ============================================================

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
// deasync removed — not compatible with Node v24

let sql;
try { sql = require('mssql'); }
catch { console.error('[DB] Missing: npm install mssql deasync'); process.exit(1); }

// ── Constants ─────────────────────────────────────────────────
const SALT      = 12;
const PAGE_SIZE = 20;

// ── SQL Server config (from .env) ────────────────────────────
const SQL_CONFIG = {
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME     || 'docreview_bd',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt:                process.env.DB_ENCRYPT     === 'true',   // true for Azure
    trustServerCertificate: process.env.DB_TRUST_CERT  !== 'false',  // true for local/self-signed
    enableArithAbort:       true,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
  pool: { max: 10, min: 2, idleTimeoutMillis: 30000 },
};

// ── Encryption ───────────────────────────────────────────────
const ENC_KEY = (() => {
  const h = process.env.ENC_KEY;
  if (h && /^[0-9a-fA-F]{64}$/.test(h)) return Buffer.from(h, 'hex');
  return crypto.createHash('sha256')
    .update(process.env.ENC_KEY || 'docreview_bd_CHANGE_IN_PRODUCTION_ENVIRONMENT_KEY_32b!')
    .digest();
})();

const ALGO   = 'aes-256-gcm';
const IV_LEN = 12;

function enc(v) {
  if (v === null || v === undefined || v === '') return null;
  const iv = crypto.randomBytes(IV_LEN);
  const c  = crypto.createCipheriv(ALGO, ENC_KEY, iv);
  const ct = Buffer.concat([c.update(String(v), 'utf8'), c.final()]);
  const tg = c.getAuthTag();
  return iv.toString('hex') + ':' + tg.toString('hex') + ':' + ct.toString('hex');
}

function dec(v) {
  if (!v) return null;
  try {
    const [ivH, tgH, ctH] = v.split(':');
    if (!ivH || !tgH || !ctH) return v;
    const d = crypto.createDecipheriv(ALGO, ENC_KEY, Buffer.from(ivH, 'hex'));
    d.setAuthTag(Buffer.from(tgH, 'hex'));
    return Buffer.concat([d.update(Buffer.from(ctH, 'hex')), d.final()]).toString('utf8');
  } catch { return null; }
}

const E = v => (v !== null && v !== undefined && v !== '') ? enc(String(v)) : null;
const D = v => v ? dec(v) : null;

// syncify removed — all methods now exported as async directly

// ── Pool ──────────────────────────────────────────────────────
let pool = null;

async function _getPool() {
  if (!pool) throw new Error('[DB] Pool not initialized. Call initDB() first.');
  return pool;
}

// ── Async query helpers ───────────────────────────────────────
async function _query(sqlStr, params = {}) {
  const p   = await _getPool();
  const req = p.request();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined)          req.input(k, sql.NVarChar,          null);
    else if (Number.isInteger(v))               req.input(k, sql.Int,               v);
    else if (typeof v === 'number')             req.input(k, sql.Float,             v);
    else if (typeof v === 'bigint')             req.input(k, sql.BigInt,            v);
    else                                        req.input(k, sql.NVarChar(sql.MAX), String(v));
  }
  return req.query(sqlStr);
}

async function _get(s, p = {})  { return (await _query(s, p)).recordset[0] || null; }
async function _all(s, p = {})  { return (await _query(s, p)).recordset; }
async function _run(s, p = {})  { const r = await _query(s, p); return { rowsAffected: r.rowsAffected[0] || 0, lastId: r.recordset?.[0]?.new_id || null }; }

// ── Schema ────────────────────────────────────────────────────
async function _schema() {

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
  CREATE TABLE users (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    name           NVARCHAR(MAX) NOT NULL,
    email          NVARCHAR(MAX) NOT NULL,
    password       NVARCHAR(MAX) NOT NULL,
    role           NVARCHAR(10)  NOT NULL DEFAULT 'patient'
                   CHECK(role IN ('admin','patient','doctor')),
    avatar         NVARCHAR(10),
    joined         NVARCHAR(20)  DEFAULT CONVERT(NVARCHAR,GETDATE(),23),
    phone          NVARCHAR(MAX),
    gender         NVARCHAR(MAX),
    age            NVARCHAR(MAX),
    blood_group    NVARCHAR(MAX),
    address        NVARCHAR(MAX),
    profile_pic    NVARCHAR(MAX),
    banned         INT           NOT NULL DEFAULT 0,
    ban_reason     NVARCHAR(100),
    banned_at      NVARCHAR(30),
    email_verified INT           NOT NULL DEFAULT 0,
    device_fp      NVARCHAR(500),
    network_hint   NVARCHAR(100),
    deleted        INT           NOT NULL DEFAULT 0,
    deleted_at     NVARCHAR(30)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_users_role' AND object_id=OBJECT_ID('users'))
    CREATE INDEX ix_users_role ON users(role) WHERE deleted=0`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='doctors' AND xtype='U')
  CREATE TABLE doctors (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE SET NULL,
    name            NVARCHAR(300)  NOT NULL,
    specialty       NVARCHAR(200),
    degrees         NVARCHAR(MAX)  DEFAULT '[]',
    bmdc            NVARCHAR(50),
    bmdc_verified   INT DEFAULT 1,
    bmdc_suspended  INT DEFAULT 0,
    hospital        NVARCHAR(400),
    chamber         NVARCHAR(400),
    chamber_time    NVARCHAR(200),
    visit_location  NVARCHAR(200),
    visit_days      NVARCHAR(200),
    visit_hours     NVARCHAR(MAX)  DEFAULT '[]',
    district        NVARCHAR(100),
    experience      INT DEFAULT 0,
    fee             INT DEFAULT 0,
    rating          FLOAT DEFAULT 0.0,
    reviews_count   INT DEFAULT 0,
    available       INT DEFAULT 1,
    phone           NVARCHAR(MAX),
    email           NVARCHAR(MAX),
    about           NVARCHAR(MAX),
    dr_type         NVARCHAR(100),
    medical_college NVARCHAR(200),
    languages       NVARCHAR(200),
    gender          NVARCHAR(30),
    profile_pic     NVARCHAR(MAX),
    deleted         INT NOT NULL DEFAULT 0,
    deleted_at      NVARCHAR(30)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_doc_specialty' AND object_id=OBJECT_ID('doctors'))
    CREATE INDEX ix_doc_specialty ON doctors(specialty) WHERE deleted=0`);
  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_doc_district' AND object_id=OBJECT_ID('doctors'))
    CREATE INDEX ix_doc_district ON doctors(district) WHERE deleted=0`);
  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_doc_rating' AND object_id=OBJECT_ID('doctors'))
    CREATE INDEX ix_doc_rating ON doctors(rating DESC) WHERE deleted=0`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reviews' AND xtype='U')
  CREATE TABLE reviews (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    doctor_id           INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id          INT NOT NULL REFERENCES users(id)   ON DELETE NO ACTION,
    patient_name        NVARCHAR(MAX),
    rating              INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment             NVARCHAR(MAX),
    date                NVARCHAR(20) DEFAULT CONVERT(NVARCHAR,GETDATE(),23),
    helpful             INT DEFAULT 0,
    replies             NVARCHAR(MAX) DEFAULT '[]',
    verification_status NVARCHAR(20)  DEFAULT 'pending'
                        CHECK(verification_status IN ('pending','verified','flagged','removed')),
    file_ref            INT,
    device_fp           NVARCHAR(500),
    network_hint        NVARCHAR(100),
    CONSTRAINT uq_review UNIQUE(doctor_id, patient_id)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_rev_doctor' AND object_id=OBJECT_ID('reviews'))
    CREATE INDEX ix_rev_doctor ON reviews(doctor_id, date DESC)`);
  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_rev_patient' AND object_id=OBJECT_ID('reviews'))
    CREATE INDEX ix_rev_patient ON reviews(patient_id, date DESC)`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='review_files' AND xtype='U')
  CREATE TABLE review_files (
    id        INT IDENTITY(1,1) PRIMARY KEY,
    review_id INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    file_data NVARCHAR(MAX) NOT NULL,
    file_name NVARCHAR(MAX),
    mime_type NVARCHAR(100)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bmdc_revoked' AND xtype='U')
  CREATE TABLE bmdc_revoked (
    bmdc       NVARCHAR(50)  PRIMARY KEY,
    revoked_at NVARCHAR(30)  DEFAULT CONVERT(NVARCHAR,GETDATE(),120),
    reason     NVARCHAR(200)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bmdc_sync_log' AND xtype='U')
  CREATE TABLE bmdc_sync_log (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    date            NVARCHAR(30),
    revoked_checked INT DEFAULT 0,
    suspended       INT DEFAULT 0
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='banned_phones' AND xtype='U')
  CREATE TABLE banned_phones (
    phone     NVARCHAR(MAX),
    banned_at NVARCHAR(30) DEFAULT CONVERT(NVARCHAR,GETDATE(),120),
    reason    NVARCHAR(200)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='banned_devices' AND xtype='U')
  CREATE TABLE banned_devices (
    device_fp NVARCHAR(500) PRIMARY KEY,
    banned_at NVARCHAR(30)  DEFAULT CONVERT(NVARCHAR,GETDATE(),120),
    reason    NVARCHAR(200)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='banned_networks' AND xtype='U')
  CREATE TABLE banned_networks (
    network_hint NVARCHAR(100) PRIMARY KEY,
    banned_at    NVARCHAR(30)  DEFAULT CONVERT(NVARCHAR,GETDATE(),120),
    reason       NVARCHAR(200)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_log' AND xtype='U')
  CREATE TABLE audit_log (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    ts          NVARCHAR(30)  NOT NULL DEFAULT CONVERT(NVARCHAR,GETDATE(),120),
    actor_id    INT,
    actor_role  NVARCHAR(20),
    action      NVARCHAR(100) NOT NULL,
    target_type NVARCHAR(50),
    target_id   INT,
    detail      NVARCHAR(MAX)
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='ix_audit_ts' AND object_id=OBJECT_ID('audit_log'))
    CREATE INDEX ix_audit_ts ON audit_log(ts DESC)`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='otp_store' AND xtype='U')
  CREATE TABLE otp_store (
    email    NVARCHAR(MAX) NOT NULL,
    code     NVARCHAR(20)  NOT NULL,
    expires  BIGINT        NOT NULL,
    attempts INT           DEFAULT 0
  )`);

  await _query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='site_meta' AND xtype='U')
  CREATE TABLE site_meta (
    [key]  NVARCHAR(100) PRIMARY KEY,
    value  NVARCHAR(MAX)
  )`);
}

// ── Seed ──────────────────────────────────────────────────────
async function _seed() {
  const row = await _get(`SELECT COUNT(*) AS c FROM users WHERE deleted=0`);
  if (row && row.c > 0) return;

  const adminHash = bcrypt.hashSync('Adm!n@DocR3v!3w2025#BD', SALT);
  const p123      = bcrypt.hashSync('pass123', SALT);

  await _query(`INSERT INTO users(name,email,password,role,avatar,joined,banned,email_verified)
    VALUES(@name,@email,@pw,'admin','AD','2024-01-01',0,1)`,
    { name: E('Admin'), email: E('docreviewbd.admin@system.bd'), pw: adminHash });

  const u1 = await _run(`INSERT INTO users(name,email,password,role,avatar,joined,phone,blood_group,age,gender,address,banned,email_verified)
    OUTPUT INSERTED.id AS new_id
    VALUES(@n,@e,@pw,'patient','RH','2024-02-10',@ph,@bl,@ag,@gn,@ad,0,1)`,
    { n:E('Rahim Hossain'), e:E('rahim@gmail.com'), pw:p123, ph:E('01711234567'), bl:E('B+'), ag:E('35'), gn:E('Male'), ad:E('Mirpur, Dhaka') });

  const u2 = await _run(`INSERT INTO users(name,email,password,role,avatar,joined,phone,blood_group,age,gender,address,banned,email_verified)
    OUTPUT INSERTED.id AS new_id
    VALUES(@n,@e,@pw,'patient','FB','2024-03-05',@ph,@bl,@ag,@gn,@ad,0,1)`,
    { n:E('Fatema Begum'), e:E('fatema@gmail.com'), pw:p123, ph:E('01822345678'), bl:E('O+'), ag:E('28'), gn:E('Female'), ad:E('Dhanmondi, Dhaka') });

  const docs = [
    { n:'Dr. Arif Ahmed',    s:'Cardiologist (হৃদরোগ)',              b:'A-12345', h:'Square Hospital, Dhaka',            ch:'Square Hospital, 18/F West Panthapath', d:'Dhaka', ex:15, f:1500, r:4.8, rc:124, t:'Senior Consultant',   mc:'Dhaka Medical College',          g:'Male',   ph:'01912345678', em:'arif@sq.com',     ab:'Specialist in heart diseases with 15 years of experience.', dg:[{degree:'MBBS',institution:'Dhaka Medical College',year:'2002'},{degree:'MD (Cardiology)',institution:'BSMMU',year:'2007'},{degree:'FCPS',institution:'BCPS',year:'2009'}] },
    { n:'Dr. Nasrin Islam',  s:'Dermatologist (চর্মরোগ)',             b:'A-23456', h:'United Hospital, Dhaka',             ch:'United Hospital, Plot 15, Road 71, Gulshan', d:'Dhaka', ex:10, f:1200, r:4.6, rc:89,  t:'Consultant',         mc:'Chittagong Medical College',     g:'Female', ph:'01812456789', em:'nasrin@uh.com',   ab:'Expert in skin diseases, laser treatment and cosmetic dermatology.', dg:[{degree:'MBBS',institution:'Chittagong Medical College',year:'2006'},{degree:'DDV',institution:'BSMMU',year:'2010'},{degree:'FCPS (Dermatology)',institution:'BCPS',year:'2013'}] },
    { n:'Dr. Karim Uddin',   s:'Orthopedic Surgeon (অস্থি ও জোড়া)', b:'A-34567', h:'Labaid Hospital, Dhaka',              ch:'Labaid Specialized Hospital, Dhanmondi',    d:'Dhaka', ex:20, f:2000, r:4.9, rc:203, t:'Professor',          mc:'Rajshahi Medical College',       g:'Male',   ph:'01712567890', em:'karim@lb.com',    ab:'Senior orthopedic surgeon. 3000+ successful surgeries.', dg:[{degree:'MBBS',institution:'Rajshahi Medical College',year:'2000'},{degree:'MS (Orthopedics)',institution:'BSMMU',year:'2006'},{degree:'FCPS (Surgery)',institution:'BCPS',year:'2008'}] },
    { n:'Dr. Shamima Akter', s:'Gynecologist (স্ত্রীরোগ)',             b:'A-45678', h:"Anwer Khan Modern Hospital, Dhaka",   ch:"Anwer Khan Modern Hospital, Dhanmondi",     d:'Dhaka', ex:12, f:1300, r:4.7, rc:156, t:'Associate Professor', mc:'Mymensingh Medical College',     g:'Female', ph:'01612678901', em:'shamima@ak.com', ab:"Women's health specialist. Expert in high-risk pregnancy.", dg:[{degree:'MBBS',institution:'Mymensingh Medical College',year:'2004'},{degree:'FCPS (Gynecology)',institution:'BCPS',year:'2010'}] },
    { n:'Dr. Rafiqul Islam', s:'Neurologist (স্নায়বিক)',              b:'A-56789', h:'BIRDEM General Hospital, Dhaka',      ch:'BIRDEM General Hospital, Shahbag',          d:'Dhaka', ex:18, f:1800, r:4.5, rc:97,  t:'Senior Consultant',  mc:'Sir Salimullah Medical College', g:'Male',   ph:'01512789012', em:'rafiq@bd.com',    ab:'Expert in brain and nervous system disorders, stroke management.', dg:[{degree:'MBBS',institution:'Sir Salimullah Medical College',year:'2001'},{degree:'MD (Neurology)',institution:'BSMMU',year:'2007'}] },
    { n:'Dr. Sumaiya Khan',  s:'Pediatrician (শিশুরোগ)',              b:'A-67890', h:'Dhaka Shishu Hospital',               ch:'Dhaka Shishu Hospital, Sher-e-Bangla Nagar',d:'Dhaka', ex:8,  f:1000, r:4.8, rc:178, t:'Consultant',         mc:'Dhaka Medical College',          g:'Female', ph:'01412890123', em:'sumaiya@dsh.com', ab:'Child health specialist. Expert in newborn care and childhood diseases.', dg:[{degree:'MBBS',institution:'Dhaka Medical College',year:'2008'},{degree:'DCH',institution:'BCPS',year:'2011'},{degree:'FCPS (Pediatrics)',institution:'BCPS',year:'2014'}] },
  ];

  const docIds = [];
  for (const dc of docs) {
    const dr = await _run(`INSERT INTO doctors(name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,
      chamber_time,visit_location,visit_days,visit_hours,district,experience,fee,rating,reviews_count,
      phone,email,about,dr_type,medical_college,gender,languages,available,deleted)
      OUTPUT INSERTED.id AS new_id
      VALUES(@n,@s,@dg,@b,1,@h,@ch,'',@vl,'','[]',@d,@ex,@f,@r,@rc,@ph,@em,@ab,@t,@mc,@g,'Bangla, English',1,0)`,
      { n:dc.n, s:dc.s, dg:JSON.stringify(dc.dg), b:dc.b, h:dc.h, ch:dc.ch, vl:'', d:dc.d,
        ex:dc.ex, f:dc.f, r:dc.r, rc:dc.rc, ph:E(dc.ph), em:E(dc.em), ab:dc.ab, t:dc.t, mc:dc.mc, g:dc.g });
    docIds.push(dr.lastId);
  }

  const pid1 = u1.lastId, pid2 = u2.lastId;
  const reviews = [
    { did:docIds[0], pid:pid1, pn:'Rahim Hossain',  rt:5, cm:'Excellent doctor! Very attentive.',           dt:'2024-11-15', hp:12 },
    { did:docIds[0], pid:pid2, pn:'Fatema Begum',    rt:4, cm:'Good experience. Very knowledgeable.',         dt:'2024-12-01', hp:7  },
    { did:docIds[1], pid:pid1, pn:'Rahim Hossain',  rt:5, cm:'Dr. Nasrin is amazing! Skin improved.',        dt:'2024-10-20', hp:20 },
    { did:docIds[2], pid:pid2, pn:'Fatema Begum',    rt:5, cm:'Best orthopedic surgeon in Bangladesh.',      dt:'2024-09-12', hp:15 },
    { did:docIds[4], pid:pid1, pn:'Rahim Hossain',  rt:4, cm:'Very thorough in diagnosis.',                  dt:'2025-01-05', hp:8  },
  ];
  for (const rv of reviews) {
    if (!rv.pid) continue;
    await _query(`INSERT INTO reviews(doctor_id,patient_id,patient_name,rating,comment,date,helpful,replies,verification_status)
      VALUES(@did,@pid,@pn,@rt,@cm,@dt,@hp,'[]','verified')`,
      { did:rv.did, pid:rv.pid, pn:E(rv.pn), rt:rv.rt, cm:E(rv.cm), dt:rv.dt, hp:rv.hp });
  }

  await _query(`IF NOT EXISTS (SELECT 1 FROM site_meta WHERE [key]='site_visits') INSERT INTO site_meta([key],value) VALUES('site_visits','0')`);
  await _query(`IF NOT EXISTS (SELECT 1 FROM site_meta WHERE [key]='version') INSERT INTO site_meta([key],value) VALUES('version','3.0.0-mssql')`);
  console.log('[DB] Seed complete — all sensitive fields AES-256-GCM encrypted');
}

// ── Mappers ───────────────────────────────────────────────────
function _mapUser(u) {
  if (!u) return null;
  return { id:u.id, role:u.role, avatar:u.avatar, joined:u.joined,
    banned:!!u.banned, banReason:u.ban_reason, emailVerified:!!u.email_verified,
    name:D(u.name), email:D(u.email), phone:D(u.phone), gender:D(u.gender),
    age:D(u.age), bloodGroup:D(u.blood_group), address:D(u.address), profilePic:D(u.profile_pic) };
}
function _mapDoctor(d) {
  if (!d) return null;
  return { id:d.id, userId:d.user_id, name:d.name, specialty:d.specialty,
    degrees:_jp(d.degrees,[]), bmdc:d.bmdc, bmdcVerified:!!d.bmdc_verified, bmdcSuspended:!!d.bmdc_suspended,
    hospital:d.hospital, chamber:d.chamber, chamberTime:d.chamber_time,
    visitLocation:d.visit_location, visitDays:d.visit_days, visitHours:_jp(d.visit_hours,[]),
    district:d.district, experience:d.experience, fee:d.fee, rating:d.rating, reviews:d.reviews_count,
    available:!!d.available, about:d.about, drType:d.dr_type, medicalCollege:d.medical_college,
    languages:d.languages, gender:d.gender,
    phone:D(d.phone), email:D(d.email), profilePic:D(d.profile_pic) };
}
function _mapReview(r) {
  if (!r) return null;
  const vs = r.verification_status === 'flagged' ? 'fake' : r.verification_status;
  return { id:r.id, doctorId:r.doctor_id, patientId:r.patient_id, rating:r.rating, date:r.date,
    helpful:r.helpful, replies:_jp(r.replies,[]), verificationStatus:vs, fileRef:r.file_ref,
    patientName:D(r.patient_name), comment:D(r.comment) };
}
function _jp(s,fb) { try { return JSON.parse(s); } catch { return fb; } }

// ── Internal helpers ──────────────────────────────────────────
async function _audit(actorId, role, action, type, targetId, detail) {
  try { await _query(`INSERT INTO audit_log(actor_id,actor_role,action,target_type,target_id,detail)
    VALUES(@a,@r,@ac,@t,@ti,@d)`,
    { a:actorId||null, r:role||null, ac:action, t:type||null, ti:targetId||null, d:detail?JSON.stringify(detail):null }); } catch {}
}
async function _banPhone(phone, reason) {
  const ep = E(phone.replace(/\D/g,''));
  await _query(`IF NOT EXISTS (SELECT 1 FROM banned_phones WHERE phone=@p) INSERT INTO banned_phones(phone,reason) VALUES(@p,@r)`,{ p:ep, r:reason||null });
}
async function _banDevice(fp, reason) {
  if (!fp) return;
  await _query(`IF NOT EXISTS (SELECT 1 FROM banned_devices WHERE device_fp=@f) INSERT INTO banned_devices(device_fp,reason) VALUES(@f,@r)`,{ f:fp, r:reason||null });
}
async function _banNetwork(hint, reason) {
  if (!hint) return;
  await _query(`IF NOT EXISTS (SELECT 1 FROM banned_networks WHERE network_hint=@h) INSERT INTO banned_networks(network_hint,reason) VALUES(@h,@r)`,{ h:hint, r:reason||null });
}
async function _recalcRating(doctorId) {
  const a = await _get(`SELECT AVG(CAST(rating AS FLOAT)) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE doctor_id=@id`,{ id:doctorId });
  await _query(`UPDATE doctors SET rating=@r,reviews_count=@c WHERE id=@id`,
    { r:Math.round((a?.avg_r||0)*10)/10, c:a?.cnt||0, id:doctorId });
}

// ── Async implementation ──────────────────────────────────────
const _async = {
  // Init
  async initDB() {
    pool = await sql.connect(SQL_CONFIG);
    pool.on('error', err => console.error('[DB Pool error]', err));
    await _schema();
    await _seed();
    console.log('[DB] MS SQL Server ready —', SQL_CONFIG.database, '@ AES-256-GCM encrypted');
  },

  // Site
  async getVisitCount() {
    const r = await _get(`SELECT value FROM site_meta WHERE [key]='site_visits'`);
    return parseInt(r?.value||'0');
  },
  async recordVisit() {
    await _query(`UPDATE site_meta SET value=CAST(CAST(value AS INT)+1 AS NVARCHAR) WHERE [key]='site_visits'`);
  },

  // OTP
  async saveOtp(email, code, ttl=600000) {
    const ee = E(email.toLowerCase().trim());
    await _query(`DELETE FROM otp_store WHERE email=@e`,{ e:ee });
    await _query(`INSERT INTO otp_store(email,code,expires,attempts) VALUES(@e,@c,@ex,0)`,
      { e:ee, c:String(code), ex:Date.now()+ttl });
  },
  async verifyOtp(email, input) {
    const rows = await _all(`SELECT * FROM otp_store`);
    const row  = rows.find(r => D(r.email) === email.toLowerCase().trim());
    if (!row) return { error:'OTP pending নেই।' };
    if (Date.now() > row.expires) { await _query(`DELETE FROM otp_store WHERE email=@e`,{e:row.email}); return { error:'OTP মেয়াদ শেষ।' }; }
    if (row.attempts >= 5)        { await _query(`DELETE FROM otp_store WHERE email=@e`,{e:row.email}); return { error:'অনেকবার ভুল। নতুন OTP নিন।' }; }
    if (row.code !== String(input).trim()) {
      await _query(`UPDATE otp_store SET attempts=attempts+1 WHERE email=@e`,{e:row.email});
      return { error:`ভুল OTP। আরো ${4-row.attempts} বার সুযোগ।` };
    }
    await _query(`DELETE FROM otp_store WHERE email=@e`,{e:row.email});
    return { success:true };
  },
  async cleanExpiredOtps() {
    const rows = await _all(`SELECT email,expires FROM otp_store`);
    for (const r of rows) if (Date.now()>r.expires) await _query(`DELETE FROM otp_store WHERE email=@e`,{e:r.email});
  },

  // Users
  async findUser(email, password) {
    const rows = await _all(`SELECT * FROM users WHERE deleted=0`);
    const u = rows.find(r => !r.banned && D(r.email)===email.trim());
    if (!u) return null;
    if (!bcrypt.compareSync(password, u.password)) return null;
    return _mapUser(u);
  },
  async getUserById(id) {
    return _mapUser(await _get(`SELECT * FROM users WHERE id=@id AND deleted=0`,{id}));
  },
  async getAllUsers() {
    return (await _all(`SELECT * FROM users WHERE deleted=0 ORDER BY id DESC`)).map(_mapUser);
  },
  async emailExists(email) {
    const rows = await _all(`SELECT email FROM users WHERE deleted=0`);
    return rows.some(r => D(r.email)===email.trim());
  },
  async phoneExistsForPatient(phone) {
    const clean = phone.replace(/\D/g,'');
    const rows  = await _all(`SELECT phone FROM users WHERE role='patient' AND deleted=0`);
    return rows.some(r => D(r.phone)===clean);
  },
  async isPhoneBanned(phone) {
    const clean = phone.replace(/\D/g,'');
    const rows  = await _all(`SELECT phone FROM banned_phones`);
    return rows.some(r => D(r.phone)===clean);
  },
  async isDeviceBanned(fp) {
    if (!fp) return false;
    return !!(await _get(`SELECT device_fp FROM banned_devices WHERE device_fp=@f`,{f:fp}));
  },
  async isNetworkBanned(hint) {
    if (!hint) return false;
    return !!(await _get(`SELECT network_hint FROM banned_networks WHERE network_hint=@h`,{h:hint}));
  },
  async bmdcExists(bmdc) {
    return !!(await _get(`SELECT id FROM doctors WHERE bmdc=@b AND deleted=0`,{b:bmdc.trim()}));
  },
  async registerPatient(data, deviceFp, networkHint) {
    if (await _async.emailExists(data.email))            return { error:'এই email দিয়ে আগেই account আছে' };
    if (await _async.phoneExistsForPatient(data.phone))  return { error:'এই phone number দিয়ে আগেই account আছে' };
    if (await _async.isPhoneBanned(data.phone))          return { error:'এই phone number দিয়ে account খোলা সম্ভব নয়' };
    if (deviceFp && await _async.isDeviceBanned(deviceFp)) return { error:'এই device থেকে account খোলা সম্ভব নয়' };
    const hash   = bcrypt.hashSync(data.password, SALT);
    const avatar = data.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const res = await _run(`INSERT INTO users(name,email,password,role,avatar,phone,gender,age,blood_group,address,email_verified,device_fp,network_hint,banned)
      OUTPUT INSERTED.id AS new_id
      VALUES(@n,@e,@pw,'patient',@av,@ph,@gn,@ag,@bl,@ad,1,@df,@nh,0)`,
      { n:E(data.name.trim()), e:E(data.email.trim()), pw:hash, av:avatar,
        ph:E(data.phone?.replace(/\D/g,'')), gn:E(data.gender||null), ag:E(data.age?.toString()||null),
        bl:E(data.bloodGroup||null), ad:E(data.address||null), df:deviceFp||null, nh:networkHint||null });
    const user = await _async.getUserById(res.lastId);
    await _audit(null,null,'register_patient','user',user.id,{role:'patient'});
    return { user };
  },
  async registerDoctor(data, deviceFp, networkHint) {
    if (await _async.emailExists(data.email))      return { error:'এই email দিয়ে আগেই account আছে' };
    if (await _async.bmdcExists(data.bmdc))        return { error:'এই BMDC নম্বর দিয়ে আগেই registered আছেন' };
    if (deviceFp && await _async.isDeviceBanned(deviceFp)) return { error:'এই device থেকে account খোলা সম্ভব নয়' };
    if (await _get(`SELECT bmdc FROM bmdc_revoked WHERE bmdc=@b`,{b:data.bmdc.trim()})) return { error:'এই BMDC নম্বরটি বর্তমানে active নেই।' };
    const hash   = bcrypt.hashSync(data.password, SALT);
    const avatar = data.name.replace(/^Dr\.?\s*/i,'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const uRes = await _run(`INSERT INTO users(name,email,password,role,avatar,email_verified,device_fp,network_hint,banned)
      OUTPUT INSERTED.id AS new_id VALUES(@n,@e,@pw,'doctor',@av,1,@df,@nh,0)`,
      { n:E(data.name.trim()), e:E(data.email.trim()), pw:hash, av:avatar, df:deviceFp||null, nh:networkHint||null });
    const dRes = await _run(`INSERT INTO doctors(user_id,name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,
      chamber_time,visit_location,visit_days,visit_hours,district,experience,fee,phone,email,about,dr_type,medical_college,gender,languages,available,rating,reviews_count)
      OUTPUT INSERTED.id AS new_id
      VALUES(@uid,@n,@s,@dg,@b,1,@h,@ch,@ct,@vl,@vd,@vh,@d,@ex,@f,@ph,@em,@ab,@t,@mc,@g,@la,1,0,0)`,
      { uid:uRes.lastId, n:data.name.trim(), s:data.specialty, dg:JSON.stringify(data.degrees||[]),
        b:data.bmdc.trim(), h:data.hospital||'', ch:data.chamber||'', ct:data.chamberTime||'',
        vl:data.visitLocation||'', vd:data.visitDays||'', vh:JSON.stringify(data.visitHours||[]),
        d:data.district||'', ex:parseInt(data.experience)||0, f:parseInt(data.fee)||0,
        ph:E(data.phone||''), em:E(data.email.trim()), ab:data.about||'',
        t:data.drType||'', mc:data.medicalCollege||'', g:data.gender||'', la:data.languages||'' });
    const user   = await _async.getUserById(uRes.lastId);
    const doctor = _mapDoctor(await _get(`SELECT * FROM doctors WHERE id=@id`,{id:dRes.lastId}));
    await _audit(null,null,'register_doctor','doctor',dRes.lastId,{bmdc:data.bmdc});
    return { user, doctor };
  },
  async updateUser(id, data) {
    const u = await _get(`SELECT * FROM users WHERE id=@id AND deleted=0`,{id});
    if (!u) return { error:'User পাওয়া যায়নি' };
    if (data.email && data.email!==D(u.email) && await _async.emailExists(data.email)) return { error:'এই email আগেই ব্যবহার হচ্ছে' };
    const map = { name:'name', email:'email', phone:'phone', gender:'gender', age:'age', bloodGroup:'blood_group', address:'address' };
    const sets=[], params={id};
    for (const [k,col] of Object.entries(map)) if (data[k]!==undefined) { sets.push(`${col}=@${k}`); params[k]=E(data[k]); }
    if (!sets.length) return { user:_mapUser(u) };
    await _query(`UPDATE users SET ${sets.join(',')} WHERE id=@id`,params);
    if (data.name)  await _query(`UPDATE doctors SET name=@n WHERE user_id=@id AND deleted=0`,{n:data.name,id});
    if (data.email) await _query(`UPDATE doctors SET email=@e WHERE user_id=@id AND deleted=0`,{e:E(data.email),id});
    await _audit(id,u.role,'update_profile','user',id,{fields:Object.keys(data)});
    return { user:await _async.getUserById(id) };
  },
  async changePassword(userId, newPassword) {
    await _query(`UPDATE users SET password=@h WHERE id=@id`,{h:bcrypt.hashSync(newPassword,SALT),id:userId});
    await _audit(userId,null,'change_password','user',userId);
    return { success:true };
  },
  async updateDoctorProfile(userId, data) {
    const doc = await _get(`SELECT * FROM doctors WHERE user_id=@uid AND deleted=0`,{uid:userId});
    if (!doc) return { error:'Doctor profile পাওয়া যায়নি' };
    const plainMap={ specialty:'specialty', hospital:'hospital', chamber:'chamber', chamberTime:'chamber_time',
      visitLocation:'visit_location', visitDays:'visit_days', district:'district', experience:'experience',
      fee:'fee', about:'about', drType:'dr_type', medicalCollege:'medical_college', languages:'languages', gender:'gender', available:'available' };
    const sets=[], params={docId:doc.id};
    for (const [k,col] of Object.entries(plainMap)) if (data[k]!==undefined) { sets.push(`${col}=@${k}`); params[k]=data[k]; }
    if (data.phone!==undefined)      { sets.push('phone=@phone');            params.phone=E(data.phone); }
    if (data.degrees!==undefined)    { sets.push('degrees=@degrees');        params.degrees=JSON.stringify(data.degrees); }
    if (data.visitHours!==undefined) { sets.push('visit_hours=@visitHours'); params.visitHours=JSON.stringify(data.visitHours); }
    if (!sets.length) return { doctor:_mapDoctor(doc) };
    await _query(`UPDATE doctors SET ${sets.join(',')} WHERE id=@docId`,params);
    await _audit(userId,'doctor','update_doctor_profile','doctor',doc.id);
    return { doctor:_mapDoctor(await _get(`SELECT * FROM doctors WHERE id=@id`,{id:doc.id})) };
  },
  async setProfilePic(userId, base64) {
    await _query(`UPDATE users   SET profile_pic=@p WHERE id=@id`,{p:E(base64),id:userId});
    await _query(`UPDATE doctors SET profile_pic=@p WHERE user_id=@id AND deleted=0`,{p:E(base64),id:userId});
    await _audit(userId,null,'update_pic','user',userId);
  },
  async deleteAccount(userId) {
    const u = await _get(`SELECT role FROM users WHERE id=@id`,{id:userId});
    await _query(`UPDATE users SET deleted=1,deleted_at=CONVERT(NVARCHAR,GETDATE(),120),email=email+'__del'+CAST(id AS NVARCHAR) WHERE id=@id`,{id:userId});
    await _query(`UPDATE doctors SET deleted=1,deleted_at=CONVERT(NVARCHAR,GETDATE(),120) WHERE user_id=@id`,{id:userId});
    await _audit(userId,u?.role,'delete_account','user',userId);
    return { success:true };
  },
  async banUser(userId, reason) {
    const u = await _get(`SELECT phone,device_fp,network_hint FROM users WHERE id=@id`,{id:userId});
    await _query(`UPDATE users SET banned=1,ban_reason=@r,banned_at=CONVERT(NVARCHAR,GETDATE(),120) WHERE id=@id`,{r:reason||'admin_ban',id:userId});
    if (u?.phone)        await _banPhone(D(u.phone), reason);
    if (u?.device_fp)    await _banDevice(u.device_fp, reason);
    if (u?.network_hint) await _banNetwork(u.network_hint, reason);
    await _audit(null,'system','ban_user','user',userId,{reason});
  },
  async unbanUser(userId) {
    await _query(`UPDATE users SET banned=0,ban_reason=NULL WHERE id=@id`,{id:userId});
    await _audit(null,'system','unban_user','user',userId);
  },

  // Doctors
  async getAllDoctors() {
    return (await _all(`SELECT * FROM doctors WHERE deleted=0 ORDER BY rating DESC`)).map(_mapDoctor);
  },
  async getDoctorById(id) {
    return _mapDoctor(await _get(`SELECT * FROM doctors WHERE id=@id AND deleted=0`,{id}));
  },
  async getDoctorByUserId(uid) {
    return _mapDoctor(await _get(`SELECT * FROM doctors WHERE user_id=@uid AND deleted=0`,{uid}));
  },
  async getDoctorPic(id) {
    const d = await _get(`SELECT profile_pic,user_id FROM doctors WHERE id=@id`,{id});
    if (!d) return null;
    if (d.profile_pic) return D(d.profile_pic);
    const u = await _get(`SELECT profile_pic FROM users WHERE id=@uid`,{uid:d.user_id});
    return D(u?.profile_pic)||null;
  },
  async searchDoctors(q, specialty, district, sortBy, page=1) {
    const offset = ((parseInt(page)||1)-1)*PAGE_SIZE;
    const order  = ({fee_low:'fee ASC',fee_high:'fee DESC',experience:'experience DESC'})[sortBy]||'rating DESC';
    const params = { offset, limit:PAGE_SIZE };
    let where = 'WHERE deleted=0';
    if (specialty) { where += ' AND specialty=@spec'; params.spec=specialty; }
    if (district)  { where += ' AND district=@dist';  params.dist=district; }
    if (q) {
      const safe = q.replace(/['"%]/g,'').trim();
      where += ` AND (name LIKE @q OR specialty LIKE @q OR about LIKE @q)`;
      params.q = `%${safe}%`;
    }
    const rows = await _all(
      `SELECT * FROM doctors ${where} ORDER BY ${order} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      params
    );
    return rows.map(_mapDoctor);
  },
  async addDoctor(data) {
    if (await _async.bmdcExists(data.bmdc)) return { error:'এই BMDC নম্বর আগেই registered' };
    const res = await _run(`INSERT INTO doctors(name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,
      chamber_time,visit_location,visit_days,visit_hours,district,experience,fee,phone,email,about,
      dr_type,medical_college,gender,languages,available,rating,reviews_count)
      OUTPUT INSERTED.id AS new_id
      VALUES(@n,@s,@dg,@b,1,@h,@ch,@ct,@vl,@vd,@vh,@d,@ex,@f,@ph,@em,@ab,@t,@mc,@g,@la,1,0,0)`,
      { n:data.name, s:data.specialty, dg:JSON.stringify(data.degrees||[]), b:data.bmdc,
        h:data.hospital||'', ch:data.chamber||'', ct:data.chamberTime||'',
        vl:data.visitLocation||'', vd:data.visitDays||'', vh:JSON.stringify(data.visitHours||[]),
        d:data.district||'', ex:parseInt(data.experience)||0, f:parseInt(data.fee)||0,
        ph:E(data.phone||''), em:E(data.email||''), ab:data.about||'',
        t:data.drType||'', mc:data.medicalCollege||'', g:data.gender||'', la:data.languages||'' });
    const doctor = _mapDoctor(await _get(`SELECT * FROM doctors WHERE id=@id`,{id:res.lastId}));
    await _audit(null,'admin','add_doctor','doctor',res.lastId,{bmdc:data.bmdc});
    return { doctor };
  },
  async deleteDoctor(id) {
    const doc = await _get(`SELECT user_id FROM doctors WHERE id=@id`,{id});
    await _query(`UPDATE doctors SET deleted=1,deleted_at=CONVERT(NVARCHAR,GETDATE(),120) WHERE id=@id`,{id});
    if (doc?.user_id) await _query(`UPDATE users SET deleted=1,deleted_at=CONVERT(NVARCHAR,GETDATE(),120) WHERE id=@uid`,{uid:doc.user_id});
    await _audit(null,'admin','delete_doctor','doctor',id);
  },

  // Reviews
  async getReviewsByDoctor(id) {
    return (await _all(`SELECT * FROM reviews WHERE doctor_id=@id ORDER BY date DESC`,{id})).map(_mapReview);
  },
  async getReviewsByPatient(id) {
    return (await _all(`SELECT * FROM reviews WHERE patient_id=@id ORDER BY date DESC`,{id})).map(_mapReview);
  },
  async getAllReviews() {
    return (await _all(`SELECT * FROM reviews ORDER BY date DESC`)).map(_mapReview);
  },
  async markHelpful(id) {
    await _query(`UPDATE reviews SET helpful=helpful+1 WHERE id=@id`,{id});
  },
  async checkReviewLimitMonthly(pid) {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    const r = await _get(`SELECT COUNT(*) AS c FROM reviews WHERE patient_id=@pid AND date>=@d`,
      { pid, d:d.toISOString().split('T')[0] });
    return r?.c||0;
  },
  async checkNetworkReviewMonthly(hint) {
    if (!hint) return 0;
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    const r = await _get(`SELECT COUNT(*) AS c FROM reviews WHERE network_hint=@h AND date>=@d`,
      { h:hint, d:d.toISOString().split('T')[0] });
    return r?.c||0;
  },
  async addReview(doctorId, patientId, patientName, rating, comment, fileData, deviceFp, networkHint) {
    const u = await _get(`SELECT banned,phone,device_fp,network_hint FROM users WHERE id=@id`,{id:patientId});
    if (u?.banned)                                                    return { error:'আপনার account বন্ধ করা হয়েছে' };
    if (deviceFp    && await _async.isDeviceBanned(deviceFp))         return { error:'এই device থেকে review দেওয়া সম্ভব নয়' };
    if (networkHint && await _async.isNetworkBanned(networkHint))     return { error:'এই network থেকে review দেওয়া সম্ভব নয়' };
    const mc = await _async.checkReviewLimitMonthly(patientId);
    if (mc >= 20) {
      await _async.banUser(patientId,'monthly_review_limit');
      if (deviceFp)    await _banDevice(deviceFp,'monthly_review_limit');
      if (networkHint) await _banNetwork(networkHint,'monthly_review_limit');
      return { error:'মাসিক ২০টির সীমা পূর্ণ। account বন্ধ হয়েছে।' };
    }
    const nc = await _async.checkNetworkReviewMonthly(networkHint);
    if (nc >= 20) {
      await _async.banUser(patientId,'network_review_limit');
      if (networkHint) await _banNetwork(networkHint,'network_review_limit');
      return { error:'এই network থেকে সীমা অতিক্রম। account বন্ধ হয়েছে।' };
    }
    if (await _get(`SELECT id FROM reviews WHERE doctor_id=@did AND patient_id=@pid`,{did:doctorId,pid:patientId}))
      return { error:'আপনি এই ডাক্তারকে আগেই review করেছেন' };
    const rRes = await _run(`INSERT INTO reviews(doctor_id,patient_id,patient_name,rating,comment,date,helpful,replies,verification_status,device_fp,network_hint)
      OUTPUT INSERTED.id AS new_id
      VALUES(@did,@pid,@pn,@rt,@cm,CONVERT(NVARCHAR,GETDATE(),23),0,'[]','pending',@df,@nh)`,
      { did:doctorId, pid:patientId, pn:E(patientName), rt:rating, cm:E(comment), df:deviceFp||null, nh:networkHint||null });
    const reviewId = rRes.lastId;
    if (fileData?.data) {
      await _query(`INSERT INTO review_files(review_id,file_data,file_name,mime_type) VALUES(@rid,@fd,@fn,@mt)`,
        { rid:reviewId, fd:E(fileData.data), fn:E(fileData.name), mt:fileData.type });
      await _query(`UPDATE reviews SET file_ref=@rid WHERE id=@rid`,{rid:reviewId});
    }
    await _recalcRating(doctorId);
    await _audit(patientId,'patient','add_review','review',reviewId,{doctorId,rating});
    const rev = _mapReview(await _get(`SELECT * FROM reviews WHERE id=@id`,{id:reviewId}));
    return { review:rev, remaining:20-(mc+1) };
  },
  async addReply(reviewId, authorId, authorName, authorRole, text) {
    if (!text?.trim()) return { error:'Reply text দিন' };
    const r = await _get(`SELECT replies FROM reviews WHERE id=@id`,{id:reviewId});
    if (!r) return { error:'Review পাওয়া যায়নি' };
    const replies = _jp(r.replies,[]);
    const reply   = { id:Date.now(), authorId, authorName, authorRole, text:text.trim(), date:new Date().toISOString().split('T')[0] };
    replies.push(reply);
    await _query(`UPDATE reviews SET replies=@rp WHERE id=@id`,{rp:JSON.stringify(replies),id:reviewId});
    await _audit(authorId,authorRole,'add_reply','review',reviewId);
    return { success:true, reply };
  },
  async setReviewVerification(reviewId, status) {
    if (status==='fake') status='flagged';
    if (!['pending','verified','flagged','removed'].includes(status)) return { error:'Invalid status' };
    if (!(await _get(`SELECT id FROM reviews WHERE id=@id`,{id:reviewId}))) return { error:'Review পাওয়া যায়নি' };
    await _query(`UPDATE reviews SET verification_status=@s WHERE id=@id`,{s:status,id:reviewId});
    await _audit(null,'admin','verify_review','review',reviewId,{status});
    return { success:true };
  },
  async deleteReview(reviewId) {
    const r = await _get(`SELECT doctor_id FROM reviews WHERE id=@id`,{id:reviewId});
    await _query(`DELETE FROM review_files WHERE review_id=@id`,{id:reviewId});
    await _query(`DELETE FROM reviews WHERE id=@id`,{id:reviewId});
    if (r) await _recalcRating(r.doctor_id);
    await _audit(null,'admin','delete_review','review',reviewId);
  },
  async getReviewFile(reviewId) {
    const f = await _get(`SELECT * FROM review_files WHERE review_id=@id`,{id:reviewId});
    if (!f) return null;
    return { ...f, file_data:D(f.file_data), file_name:D(f.file_name) };
  },

  // BMDC
  async getRevokedBmdc() {
    return (await _all(`SELECT bmdc FROM bmdc_revoked`)).map(r=>r.bmdc);
  },
  async getBmdcSyncInfo() {
    const last = await _get(`SELECT TOP 1 date FROM bmdc_sync_log ORDER BY id DESC`);
    const log  = await _all(`SELECT TOP 5 * FROM bmdc_sync_log ORDER BY id DESC`);
    return { lastSync:last?.date||'কখনো হয়নি', log, revokedCount:(await _async.getRevokedBmdc()).length };
  },
  async revokeBmdc(bmdc, reason) {
    await _query(`IF NOT EXISTS (SELECT 1 FROM bmdc_revoked WHERE bmdc=@b) INSERT INTO bmdc_revoked(bmdc,reason) VALUES(@b,@r)`,
      { b:bmdc.trim(), r:reason||'admin' });
    await _audit(null,'admin','revoke_bmdc',null,null,{bmdc});
    return _async._runBmdcSync();
  },
  async reinstateBmdc(bmdc) {
    await _query(`DELETE FROM bmdc_revoked WHERE bmdc=@b`,{b:bmdc.trim()});
    const doc = await _get(`SELECT id,user_id FROM doctors WHERE bmdc=@b`,{b:bmdc.trim()});
    if (doc) {
      await _query(`UPDATE doctors SET bmdc_verified=1,bmdc_suspended=0 WHERE id=@id`,{id:doc.id});
      if (doc.user_id) await _query(`UPDATE users SET banned=0,ban_reason=NULL WHERE id=@uid AND ban_reason='bmdc_revoked'`,{uid:doc.user_id});
    }
    await _audit(null,'admin','reinstate_bmdc',null,null,{bmdc});
    return { success:true };
  },
  async _runBmdcSync() {
    const revoked = (await _async.getRevokedBmdc()).map(b=>b.toLowerCase().trim());
    const doctors = await _all(`SELECT id,user_id,bmdc FROM doctors WHERE deleted=0`);
    let suspended = 0;
    for (const d of doctors) {
      if (revoked.includes((d.bmdc||'').toLowerCase().trim())) {
        await _query(`UPDATE doctors SET bmdc_verified=0,bmdc_suspended=1 WHERE id=@id`,{id:d.id});
        if (d.user_id) {
          const u = await _get(`SELECT banned FROM users WHERE id=@uid`,{uid:d.user_id});
          if (u && !u.banned) {
            await _query(`UPDATE users SET banned=1,ban_reason='bmdc_revoked',banned_at=CONVERT(NVARCHAR,GETDATE(),120) WHERE id=@uid`,{uid:d.user_id});
            suspended++;
          }
        }
      }
    }
    await _query(`INSERT INTO bmdc_sync_log(date,revoked_checked,suspended) VALUES(CONVERT(NVARCHAR,GETDATE(),120),@c,@s)`,
      { c:revoked.length, s:suspended });
    return { suspended, checked:doctors.length };
  },
  async autoBmdcSync() {
    const last = await _get(`SELECT value FROM site_meta WHERE [key]='bmdc_last_sync'`);
    if (!last || (Date.now()-parseInt(last.value||'0'))>86400000) {
      await _async._runBmdcSync();
      await _query(`IF EXISTS (SELECT 1 FROM site_meta WHERE [key]='bmdc_last_sync')
        UPDATE site_meta SET value=@v WHERE [key]='bmdc_last_sync'
        ELSE INSERT INTO site_meta([key],value) VALUES('bmdc_last_sync',@v)`,
        { v:Date.now().toString() });
    }
  },

  // Stats
  async getStats() {
    const [d,p,r,pend,ban,dev,net] = await Promise.all([
      _get(`SELECT COUNT(*) AS c FROM doctors WHERE deleted=0`),
      _get(`SELECT COUNT(*) AS c FROM users WHERE role='patient' AND deleted=0`),
      _get(`SELECT COUNT(*) AS c FROM reviews`),
      _get(`SELECT COUNT(*) AS c FROM reviews WHERE verification_status='pending'`),
      _get(`SELECT COUNT(*) AS c FROM users WHERE banned=1`),
      _get(`SELECT COUNT(*) AS c FROM banned_devices`),
      _get(`SELECT COUNT(*) AS c FROM banned_networks`),
    ]);
    return { totalDoctors:d?.c||0, totalPatients:p?.c||0, totalReviews:r?.c||0,
      totalVisits:await _async.getVisitCount(), pendingReviews:pend?.c||0,
      bannedUsers:ban?.c||0, bannedDevices:dev?.c||0, bannedNetworks:net?.c||0 };
  },
  async getAuditLog(limit=50, offset=0) {
    return _all(`SELECT * FROM audit_log ORDER BY ts DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,{offset,limit});
  },
};

// ── Direct async export (Node v24 compatible) ─────────────────
// All methods are async — server.js uses await on each call
module.exports = _async;
