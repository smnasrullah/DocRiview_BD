'use strict';

const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');

let Database;
try { Database = require('better-sqlite3'); }
catch { console.error('[DB] Run: npm install'); process.exit(1); }

const DB_PATH    = path.join(__dirname, 'data', 'docreview.db');
const SALT       = 12;
const PAGE_SIZE  = 20;

let db = null;

async function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);

  db.pragma('journal_mode  = WAL');
  db.pragma('synchronous   = NORMAL');
  db.pragma('foreign_keys  = ON');
  db.pragma('temp_store    = MEMORY');
  db.pragma('cache_size    = -32000');
  db.pragma('mmap_size     = 268435456');
  db.pragma('wal_autocheckpoint = 1000');

  _schema();
  _seed();
  console.log('[DB] better-sqlite3 ready →', DB_PATH);
  return db;
}

function _schema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL COLLATE NOCASE,
      password       TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('admin','patient','doctor')),
      avatar         TEXT,
      joined         TEXT DEFAULT (date('now')),
      phone          TEXT,
      gender         TEXT,
      age            INTEGER,
      blood_group    TEXT,
      address        TEXT,
      profile_pic    TEXT,
      banned         INTEGER NOT NULL DEFAULT 0,
      ban_reason     TEXT,
      banned_at      TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      device_fp      TEXT,
      network_hint   TEXT,
      deleted        INTEGER NOT NULL DEFAULT 0,
      deleted_at     TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email) WHERE deleted=0;
    CREATE INDEX IF NOT EXISTS ix_users_role  ON users(role);
    CREATE INDEX IF NOT EXISTS ix_users_phone ON users(phone) WHERE role='patient';

    CREATE TABLE IF NOT EXISTS doctors (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      specialty      TEXT,
      degrees        TEXT DEFAULT '[]',
      bmdc           TEXT,
      bmdc_verified  INTEGER DEFAULT 1,
      bmdc_suspended INTEGER DEFAULT 0,
      hospital       TEXT,
      chamber        TEXT,
      chamber_time   TEXT,
      visit_location TEXT,
      visit_days     TEXT,
      visit_hours    TEXT DEFAULT '[]',
      district       TEXT,
      experience     INTEGER DEFAULT 0,
      fee            INTEGER DEFAULT 0,
      rating         REAL DEFAULT 0.0,
      reviews_count  INTEGER DEFAULT 0,
      available      INTEGER DEFAULT 1,
      phone          TEXT,
      email          TEXT,
      about          TEXT,
      dr_type        TEXT,
      medical_college TEXT,
      languages      TEXT,
      gender         TEXT,
      profile_pic    TEXT,
      deleted        INTEGER NOT NULL DEFAULT 0,
      deleted_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_doc_specialty ON doctors(specialty) WHERE deleted=0;
    CREATE INDEX IF NOT EXISTS ix_doc_district  ON doctors(district)  WHERE deleted=0;
    CREATE INDEX IF NOT EXISTS ix_doc_rating    ON doctors(rating DESC) WHERE deleted=0;

    CREATE VIRTUAL TABLE IF NOT EXISTS doctors_fts USING fts5(
      doctor_id UNINDEXED, name, specialty, about,
      content='doctors', content_rowid='id'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id           INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      patient_id          INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      patient_name        TEXT,
      rating              INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment             TEXT,
      date                TEXT DEFAULT (date('now')),
      helpful             INTEGER DEFAULT 0,
      replies             TEXT DEFAULT '[]',
      verification_status TEXT DEFAULT 'pending'
                          CHECK(verification_status IN ('pending','verified','flagged','removed')),
      file_ref            INTEGER,
      device_fp           TEXT,
      network_hint        TEXT,
      UNIQUE(doctor_id, patient_id)
    );
    CREATE INDEX IF NOT EXISTS ix_rev_doctor  ON reviews(doctor_id, date DESC);
    CREATE INDEX IF NOT EXISTS ix_rev_patient ON reviews(patient_id, date DESC);

    CREATE TABLE IF NOT EXISTS review_files (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      file_data TEXT NOT NULL,
      file_name TEXT,
      mime_type TEXT
    );

    CREATE TABLE IF NOT EXISTS bmdc_revoked (
      bmdc       TEXT PRIMARY KEY COLLATE NOCASE,
      revoked_at TEXT DEFAULT (datetime('now')),
      reason     TEXT
    );
    CREATE TABLE IF NOT EXISTS bmdc_sync_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT,
      revoked_checked INTEGER DEFAULT 0,
      suspended       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS banned_phones (
      phone     TEXT PRIMARY KEY,
      banned_at TEXT DEFAULT (datetime('now')),
      reason    TEXT
    );
    CREATE TABLE IF NOT EXISTS banned_devices (
      device_fp TEXT PRIMARY KEY,
      banned_at TEXT DEFAULT (datetime('now')),
      reason    TEXT
    );
    CREATE TABLE IF NOT EXISTS banned_networks (
      network_hint TEXT PRIMARY KEY,
      banned_at    TEXT DEFAULT (datetime('now')),
      reason       TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ts          TEXT NOT NULL DEFAULT (datetime('now')),
      actor_id    INTEGER,
      actor_role  TEXT,
      action      TEXT NOT NULL,
      target_type TEXT,
      target_id   INTEGER,
      detail      TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_log(ts DESC);

    CREATE TABLE IF NOT EXISTS otp_store (
      email    TEXT PRIMARY KEY COLLATE NOCASE,
      code     TEXT NOT NULL,
      expires  INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS site_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

function _seed() {
  const cnt = _get("SELECT COUNT(*) AS c FROM users WHERE deleted=0").c;
  if (cnt > 0) return;

  db.transaction(() => {
    const adminHash = bcrypt.hashSync('Adm!n@DocR3v!3w2025#BD', SALT);
    const p123 = bcrypt.hashSync('pass123', SALT);

    _run("INSERT INTO users(name,email,password,role,avatar,joined,banned,email_verified) VALUES(?,?,?,'admin','AD','2024-01-01',0,1)",
      ['Admin','docreviewbd.admin@system.bd',adminHash]);
    _run("INSERT INTO users(name,email,password,role,avatar,joined,phone,blood_group,age,gender,address,banned,email_verified) VALUES(?,?,?,'patient','RH','2024-02-10','01711234567','B+',35,'Male','Mirpur, Dhaka',0,1)",
      ['Rahim Hossain','rahim@gmail.com',p123]);
    _run("INSERT INTO users(name,email,password,role,avatar,joined,phone,blood_group,age,gender,address,banned,email_verified) VALUES(?,?,?,'patient','FB','2024-03-05','01822345678','O+',28,'Female','Dhanmondi, Dhaka',0,1)",
      ['Fatema Begum','fatema@gmail.com',p123]);

    const docs = [
      { name:'Dr. Arif Ahmed',    specialty:'Cardiologist (হৃদরোগ)',        bmdc:'A-12345', hospital:'Square Hospital, Dhaka',          chamber:'Square Hospital, 18/F West Panthapath', days:'Sat-Thu', hours:'6PM-9PM', dist:'Dhaka', exp:15, fee:1500, rat:4.8, cnt:124, type:'Senior Consultant', col:'Dhaka Medical College', gen:'Male',
        degrees:[{degree:'MBBS',institution:'Dhaka Medical College',year:2002},{degree:'MD (Cardiology)',institution:'BSMMU',year:2007},{degree:'FCPS',institution:'BCPS',year:2009}],
        about:'Specialist in heart diseases with 15 years of experience. Expert in interventional cardiology.' },
      { name:'Dr. Nasrin Islam',  specialty:'Dermatologist (চর্মরোগ)',       bmdc:'A-23456', hospital:'United Hospital, Dhaka',           chamber:'United Hospital, Plot 15, Road 71, Gulshan', days:'Sun-Thu', hours:'5PM-8PM', dist:'Dhaka', exp:10, fee:1200, rat:4.6, cnt:89,  type:'Consultant',       col:'Chittagong Medical College', gen:'Female',
        degrees:[{degree:'MBBS',institution:'Chittagong Medical College',year:2006},{degree:'DDV',institution:'BSMMU',year:2010},{degree:'FCPS (Dermatology)',institution:'BCPS',year:2013}],
        about:'Expert in skin diseases, laser treatment and cosmetic dermatology.' },
      { name:'Dr. Karim Uddin',   specialty:'Orthopedic Surgeon (অস্থি ও জোড়া)', bmdc:'A-34567', hospital:'Labaid Hospital, Dhaka',     chamber:'Labaid Specialized Hospital, Dhanmondi',   days:'Sat-Wed', hours:'4PM-7PM', dist:'Dhaka', exp:20, fee:2000, rat:4.9, cnt:203, type:'Professor',         col:'Rajshahi Medical College',   gen:'Male',
        degrees:[{degree:'MBBS',institution:'Rajshahi Medical College',year:2000},{degree:'MS (Orthopedics)',institution:'BSMMU',year:2006},{degree:'FCPS (Surgery)',institution:'BCPS',year:2008}],
        about:'Senior orthopedic surgeon specializing in joint replacement and spine surgery. 3000+ successful surgeries.' },
      { name:'Dr. Shamima Akter', specialty:'Gynecologist (স্ত্রীরোগ)',        bmdc:'A-45678', hospital:'Anwer Khan Modern Hospital, Dhaka', chamber:'Anwer Khan Modern Hospital, Dhanmondi',   days:'Mon-Thu', hours:'5PM-8PM', dist:'Dhaka', exp:12, fee:1300, rat:4.7, cnt:156, type:'Associate Professor', col:'Mymensingh Medical College',  gen:'Female',
        degrees:[{degree:'MBBS',institution:'Mymensingh Medical College',year:2004},{degree:'FCPS (Gynecology)',institution:'BCPS',year:2010},{degree:'MS (Obs & Gynae)',institution:'BSMMU',year:2012}],
        about:"Women's health specialist. Expert in high-risk pregnancy and laparoscopic surgery." },
      { name:'Dr. Rafiqul Islam', specialty:'Neurologist (স্নায়বিক)',          bmdc:'A-56789', hospital:'BIRDEM General Hospital, Dhaka', chamber:'BIRDEM General Hospital, Shahbag',          days:'Sun-Thu', hours:'3PM-6PM', dist:'Dhaka', exp:18, fee:1800, rat:4.5, cnt:97,  type:'Senior Consultant', col:'Sir Salimullah Medical College', gen:'Male',
        degrees:[{degree:'MBBS',institution:'Sir Salimullah Medical College',year:2001},{degree:'MD (Neurology)',institution:'BSMMU',year:2007},{degree:'FCPS',institution:'BCPS',year:2010}],
        about:'Expert in brain and nervous system disorders, stroke management and epilepsy treatment.' },
      { name:'Dr. Sumaiya Khan',  specialty:'Pediatrician (শিশুরোগ)',         bmdc:'A-67890', hospital:'Dhaka Shishu Hospital',           chamber:'Dhaka Shishu Hospital, Sher-e-Bangla Nagar', days:'Sat-Thu', hours:'8AM-2PM', dist:'Dhaka', exp:8,  fee:1000, rat:4.8, cnt:178, type:'Consultant',       col:'Dhaka Medical College',      gen:'Female',
        degrees:[{degree:'MBBS',institution:'Dhaka Medical College',year:2008},{degree:'DCH',institution:'BCPS',year:2011},{degree:'FCPS (Pediatrics)',institution:'BCPS',year:2014}],
        about:'Child health specialist. Expert in newborn care, vaccinations and childhood diseases.' },
    ];

    const ins = db.prepare(`
      INSERT INTO doctors(name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,chamber_time,
        visit_location,visit_days,visit_hours,district,experience,fee,rating,reviews_count,
        phone,email,about,dr_type,medical_college,gender,languages,available,deleted)
      VALUES(?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)
    `);

    for (const d of docs) {
      const r = ins.run(d.name, d.specialty, JSON.stringify(d.degrees), d.bmdc,
        d.hospital, d.chamber, `${d.days}: ${d.hours}`, 'Private Hospital',
        d.days, JSON.stringify([d.hours]), d.dist, d.exp, d.fee, d.rat, d.cnt,
        '', '', d.about, d.type, d.col, d.gen, 'বাংলা, English');
      _run("INSERT INTO doctors_fts(doctor_id,name,specialty,about) VALUES(?,?,?,?)",
        [r.lastInsertRowid, d.name, d.specialty, d.about]);
    }

    const ir = db.prepare(`INSERT INTO reviews(doctor_id,patient_id,patient_name,rating,comment,date,helpful,replies,verification_status) VALUES(?,?,?,?,?,?,?,?,?)`);
    ir.run(1,2,'Rahim Hossain',5,'Excellent doctor! Very attentive. Highly recommended.','2024-11-15',12,'[]','verified');
    ir.run(1,3,'Fatema Begum',4,'Good experience. Very knowledgeable.','2024-12-01',7,'[]','verified');
    ir.run(2,2,'Rahim Hossain',5,'Dr. Nasrin is amazing! Skin improved drastically.','2024-10-20',20,'[]','verified');
    ir.run(3,3,'Fatema Begum',5,'Best orthopedic surgeon in Bangladesh.','2024-09-12',15,'[]','verified');
    ir.run(5,2,'Rahim Hossain',4,'Very thorough in diagnosis.','2025-01-05',8,'[]','verified');

    _run("INSERT OR IGNORE INTO site_meta(key,value) VALUES('site_visits','0')");
    _run("INSERT OR IGNORE INTO site_meta(key,value) VALUES('version','2.0.0')");
  })();

  console.log('[DB] Seed inserted');
}

const _stmts = new Map();
function _s(sql) {
  if (!_stmts.has(sql)) _stmts.set(sql, db.prepare(sql));
  return _stmts.get(sql);
}
function _get(sql, ...p)  { return _s(sql).get(...p); }
function _all(sql, ...p)  { return _s(sql).all(...p); }
function _run(sql, p = []) { return db.prepare(sql).run(...p); }

function _mapUser(u) {
  if (!u) return null;
  return { id:u.id, name:u.name, email:u.email, role:u.role, avatar:u.avatar, joined:u.joined,
    phone:u.phone, gender:u.gender, age:u.age, bloodGroup:u.blood_group, address:u.address,
    profilePic:u.profile_pic, banned:!!u.banned, banReason:u.ban_reason, emailVerified:!!u.email_verified };
}

function _mapDoctor(d) {
  if (!d) return null;
  return { id:d.id, userId:d.user_id, name:d.name, specialty:d.specialty,
    degrees:_jp(d.degrees,[]), bmdc:d.bmdc, bmdcVerified:!!d.bmdc_verified, bmdcSuspended:!!d.bmdc_suspended,
    hospital:d.hospital, chamber:d.chamber, chamberTime:d.chamber_time,
    visitLocation:d.visit_location, visitDays:d.visit_days, visitHours:_jp(d.visit_hours,[]),
    district:d.district, experience:d.experience, fee:d.fee, rating:d.rating, reviews:d.reviews_count,
    available:!!d.available, phone:d.phone, email:d.email, about:d.about, drType:d.dr_type,
    medicalCollege:d.medical_college, languages:d.languages, gender:d.gender, profilePic:d.profile_pic };
}

function _mapReview(r) {
  if (!r) return null;
  // normalize: backend stores 'flagged', frontend expects 'fake'
  const vs = r.verification_status === 'flagged' ? 'fake' : r.verification_status;
  return { id:r.id, doctorId:r.doctor_id, patientId:r.patient_id, patientName:r.patient_name,
    rating:r.rating, comment:r.comment, date:r.date, helpful:r.helpful, replies:_jp(r.replies,[]),
    verificationStatus:vs, fileRef:r.file_ref };
}

function _jp(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

function _audit(actorId, role, action, type, targetId, detail) {
  try { _run("INSERT INTO audit_log(actor_id,actor_role,action,target_type,target_id,detail) VALUES(?,?,?,?,?,?)",
    [actorId||null, role||null, action, type||null, targetId||null, detail?JSON.stringify(detail):null]); } catch {}
}

function _banPhone(phone, reason)   { _run("INSERT OR IGNORE INTO banned_phones(phone,reason)   VALUES(?,?)", [phone.replace(/\D/g,''), reason]); }
function _banDevice(fp, reason)     { if (fp) _run("INSERT OR IGNORE INTO banned_devices(device_fp,reason) VALUES(?,?)", [fp, reason]); }
function _banNetwork(hint, reason)  { if (hint) _run("INSERT OR IGNORE INTO banned_networks(network_hint,reason) VALUES(?,?)", [hint, reason]); }

module.exports = {
  initDB,

  // Site
  getVisitCount() { return parseInt(_get("SELECT value FROM site_meta WHERE key='site_visits'")?.value||'0'); },
  recordVisit()   { _run("UPDATE site_meta SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) WHERE key='site_visits'"); },

  // OTP
  saveOtp(email, code, ttl=600_000) {
    _run("INSERT OR REPLACE INTO otp_store(email,code,expires,attempts) VALUES(?,?,?,0)",
      [email.toLowerCase().trim(), code, Date.now()+ttl]);
  },
  verifyOtp(email, input) {
    const r = _get("SELECT * FROM otp_store WHERE email=?", email.toLowerCase().trim());
    if (!r)                  return { error: 'OTP pending নেই। আবার চেষ্টা করুন।' };
    if (Date.now()>r.expires){ _run("DELETE FROM otp_store WHERE email=?", [r.email]); return { error: 'OTP মেয়াদ শেষ।' }; }
    if (r.attempts>=5)       { _run("DELETE FROM otp_store WHERE email=?", [r.email]); return { error: 'অনেকবার ভুল। নতুন OTP নিন।' }; }
    if (r.code!==String(input).trim()) {
      _run("UPDATE otp_store SET attempts=attempts+1 WHERE email=?", [r.email]);
      return { error: `ভুল OTP। আরো ${4-r.attempts} বার সুযোগ।` };
    }
    _run("DELETE FROM otp_store WHERE email=?", [r.email]);
    return { success: true };
  },

  // Users
  findUser(email, password) {
    const u = _get("SELECT * FROM users WHERE email=? AND deleted=0", email.trim());
    if (!u) return null;
    if (!bcrypt.compareSync(password, u.password)) return null;
    if (u.banned) return { banned:true, banReason:u.ban_reason };
    return _mapUser(u);
  },
  getUserById(id)         { return _mapUser(_get("SELECT * FROM users WHERE id=? AND deleted=0", id)); },
  emailExists(email)      { return !!_get("SELECT id FROM users WHERE email=? AND deleted=0", email.trim()); },
  phoneExistsForPatient(phone) {
    const c = phone.replace(/\D/g,'');
    return !!_get("SELECT id FROM users WHERE role='patient' AND REPLACE(REPLACE(phone,'-',''),' ','')=? AND deleted=0", c);
  },
  isPhoneBanned(phone)    { return !!_get("SELECT phone FROM banned_phones WHERE phone=?", phone.replace(/\D/g,'')); },
  isDeviceBanned(fp)      { return fp ? !!_get("SELECT device_fp FROM banned_devices WHERE device_fp=?", fp) : false; },
  isNetworkBanned(hint)   { return hint ? !!_get("SELECT network_hint FROM banned_networks WHERE network_hint=?", hint) : false; },
  bmdcExists(bmdc)        { return !!_get("SELECT id FROM doctors WHERE bmdc=? AND deleted=0", bmdc.trim()); },

  registerPatient(data, deviceFp, networkHint) {
    if (this.emailExists(data.email))           return { error: 'এই email দিয়ে আগেই account আছে' };
    if (this.phoneExistsForPatient(data.phone)) return { error: 'এই phone number দিয়ে আগেই account আছে' };
    if (this.isPhoneBanned(data.phone))         return { error: 'এই phone number দিয়ে account খোলা সম্ভব নয়' };
    if (deviceFp  && this.isDeviceBanned(deviceFp))    return { error: 'এই device থেকে account খোলা সম্ভব নয়' };
    if (networkHint && this.isNetworkBanned(networkHint)) return { error: 'এই network থেকে account খোলা সম্ভব নয়' };

    const hash   = bcrypt.hashSync(data.password, SALT);
    const avatar = data.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const info = _run(`INSERT INTO users(name,email,password,role,avatar,phone,gender,age,blood_group,address,email_verified,device_fp,network_hint,banned)
      VALUES(?,?,?,'patient',?,?,?,?,?,?,1,?,?,0)`,
      [data.name.trim(),data.email.trim(),hash,avatar,
       data.phone.replace(/\D/g,''),data.gender||null,data.age||null,
       data.bloodGroup||null,data.address||null,deviceFp||null,networkHint||null]);
    const user = this.getUserById(info.lastInsertRowid);
    _audit(null,null,'register_patient','user',user.id,{email:user.email});
    return { user };
  },

  registerDoctor(data, deviceFp, networkHint) {
    if (this.emailExists(data.email)) return { error: 'এই email দিয়ে আগেই account আছে' };
    if (this.bmdcExists(data.bmdc))   return { error: 'এই BMDC নম্বর দিয়ে আগেই registered আছেন' };
    if (deviceFp && this.isDeviceBanned(deviceFp)) return { error: 'এই device থেকে account খোলা সম্ভব নয়' };
    if (_get("SELECT bmdc FROM bmdc_revoked WHERE bmdc=?", data.bmdc.trim()))
      return { error: 'এই BMDC নম্বরটি বর্তমানে active নেই।' };

    const hash   = bcrypt.hashSync(data.password, SALT);
    const avatar = data.name.replace(/^Dr\.?\s*/i,'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

    const { userId, docId } = db.transaction(() => {
      const ui = _run("INSERT INTO users(name,email,password,role,avatar,email_verified,device_fp,network_hint,banned) VALUES(?,?,?,'doctor',?,1,?,?,0)",
        [data.name.trim(),data.email.trim(),hash,avatar,deviceFp||null,networkHint||null]);
      const uid = ui.lastInsertRowid;
      const di = _run(`INSERT INTO doctors(user_id,name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,chamber_time,
        visit_location,visit_days,visit_hours,district,experience,fee,phone,email,about,
        dr_type,medical_college,gender,languages,available,rating,reviews_count)
        VALUES(?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,0)`,
        [uid,data.name.trim(),data.specialty,JSON.stringify(data.degrees||[]),data.bmdc.trim(),
         data.hospital||'',data.chamber||'',data.chamberTime||'',data.visitLocation||'',
         data.visitDays||'',JSON.stringify(data.visitHours||[]),data.district||'',
         parseInt(data.experience)||0,parseInt(data.fee)||0,
         data.phone||'',data.email.trim(),data.about||'',data.drType||'',
         data.medicalCollege||'',data.gender||'',data.languages||'']);
      _run("INSERT INTO doctors_fts(doctor_id,name,specialty,about) VALUES(?,?,?,?)",
        [di.lastInsertRowid,data.name,data.specialty||'',data.about||'']);
      return { userId:uid, docId:di.lastInsertRowid };
    })();

    const user   = this.getUserById(userId);
    const doctor = _mapDoctor(_get("SELECT * FROM doctors WHERE id=?", docId));
    _audit(null,null,'register_doctor','doctor',docId,{email:data.email,bmdc:data.bmdc});
    return { user, doctor };
  },

  updateUser(id, data) {
    const u = _get("SELECT * FROM users WHERE id=? AND deleted=0", id);
    if (!u) return { error: 'User পাওয়া যায়নি' };
    if (data.email && data.email!==u.email && this.emailExists(data.email)) return { error: 'এই email আগেই ব্যবহার হচ্ছে' };
    const fields=[], vals=[], map={name:'name',email:'email',phone:'phone',gender:'gender',age:'age',bloodGroup:'blood_group',address:'address'};
    for (const [k,col] of Object.entries(map)) if (data[k]!==undefined) { fields.push(`${col}=?`); vals.push(data[k]); }
    if (!fields.length) return { user:_mapUser(u) };
    vals.push(id);
    _run(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals);
    if (data.name)  _run("UPDATE doctors SET name=?  WHERE user_id=? AND deleted=0", [data.name,id]);
    if (data.email) _run("UPDATE doctors SET email=? WHERE user_id=? AND deleted=0", [data.email,id]);
    _audit(id,u.role,'update_profile','user',id,{fields:Object.keys(data)});
    return { user:this.getUserById(id) };
  },

  changePassword(userId, newPassword) {
    _run("UPDATE users SET password=? WHERE id=?", [bcrypt.hashSync(newPassword, SALT), userId]);
    _audit(userId,null,'change_password','user',userId);
    return { success:true };
  },

  updateDoctorProfile(userId, data) {
    const doc = _get("SELECT * FROM doctors WHERE user_id=? AND deleted=0", userId);
    if (!doc) return { error: 'Doctor profile পাওয়া যায়নি' };
    const fields=[], vals=[];
    const map={specialty:'specialty',hospital:'hospital',chamber:'chamber',chamberTime:'chamber_time',
      visitLocation:'visit_location',visitDays:'visit_days',district:'district',experience:'experience',
      fee:'fee',phone:'phone',about:'about',drType:'dr_type',medicalCollege:'medical_college',
      languages:'languages',gender:'gender',available:'available'};
    for (const [k,col] of Object.entries(map)) if (data[k]!==undefined) { fields.push(`${col}=?`); vals.push(data[k]); }
    if (data.degrees!==undefined)    { fields.push('degrees=?');     vals.push(JSON.stringify(data.degrees)); }
    if (data.visitHours!==undefined) { fields.push('visit_hours=?'); vals.push(JSON.stringify(data.visitHours)); }
    if (!fields.length) return { doctor:_mapDoctor(doc) };
    vals.push(doc.id);
    _run(`UPDATE doctors SET ${fields.join(',')} WHERE id=?`, vals);
    const updated = _get("SELECT * FROM doctors WHERE id=?", doc.id);
    _run("INSERT OR REPLACE INTO doctors_fts(doctor_id,name,specialty,about) VALUES(?,?,?,?)",
      [doc.id,updated.name,updated.specialty||'',updated.about||'']);
    _audit(userId,'doctor','update_doctor_profile','doctor',doc.id);
    return { doctor:_mapDoctor(updated) };
  },

  setProfilePic(userId, base64) {
    _run("UPDATE users   SET profile_pic=? WHERE id=?",            [base64, userId]);
    _run("UPDATE doctors SET profile_pic=? WHERE user_id=? AND deleted=0", [base64, userId]);
    _audit(userId,null,'update_pic','user',userId);
  },

  deleteAccount(userId) {
    const u = _get("SELECT * FROM users WHERE id=?", userId);
    if (!u) return { error: 'User পাওয়া যায়নি' };
    _run("UPDATE users    SET deleted=1,deleted_at=datetime('now'),email=email||'__del'||id WHERE id=?", [userId]);
    _run("UPDATE doctors  SET deleted=1,deleted_at=datetime('now') WHERE user_id=?", [userId]);
    _audit(userId,u.role,'delete_account','user',userId);
    return { success:true };
  },

  banUser(userId, reason) {
    const u = _get("SELECT phone,device_fp,network_hint FROM users WHERE id=?", userId);
    _run("UPDATE users SET banned=1,ban_reason=?,banned_at=datetime('now') WHERE id=?", [reason||'admin_ban',userId]);
    if (u?.phone)        _banPhone(u.phone, reason);
    if (u?.device_fp)    _banDevice(u.device_fp, reason);
    if (u?.network_hint) _banNetwork(u.network_hint, reason);
    _audit(null,'system','ban_user','user',userId,{reason});
  },

  unbanUser(userId) {
    _run("UPDATE users SET banned=0,ban_reason=NULL WHERE id=?", [userId]);
    _audit(null,'system','unban_user','user',userId);
  },

  // Doctors
  getAllDoctors()   { return _all("SELECT * FROM doctors WHERE deleted=0 ORDER BY rating DESC").map(_mapDoctor); },
  getDoctorById(id){ return _mapDoctor(_get("SELECT * FROM doctors WHERE id=? AND deleted=0", id)); },
  getDoctorByUserId(uid){ return _mapDoctor(_get("SELECT * FROM doctors WHERE user_id=? AND deleted=0", uid)); },

  getDoctorPic(id) {
    const d = _get("SELECT profile_pic,user_id FROM doctors WHERE id=?", id);
    if (!d) return null;
    if (d.profile_pic) return d.profile_pic;
    return _get("SELECT profile_pic FROM users WHERE id=?", d.user_id)?.profile_pic || null;
  },

  searchDoctors(q, specialty, district, sortBy, page=1) {
    const off = (parseInt(page)||1) - 1;
    let sql='', params=[];

    if (q) {
      const safe = q.replace(/['"]/g,'').trim();
      sql = `SELECT d.* FROM doctors d JOIN doctors_fts f ON f.doctor_id=d.id WHERE doctors_fts MATCH ? AND d.deleted=0`;
      params.push(`"${safe}"`);
      if (specialty){ sql+=" AND d.specialty=?"; params.push(specialty); }
      if (district) { sql+=" AND d.district=?";  params.push(district); }
    } else {
      sql = "SELECT * FROM doctors WHERE deleted=0";
      if (specialty){ sql+=" AND specialty=?"; params.push(specialty); }
      if (district) { sql+=" AND district=?";  params.push(district); }
    }
    const orderMap = { fee_low:'fee ASC', fee_high:'fee DESC', experience:'experience DESC' };
    sql += ` ORDER BY ${orderMap[sortBy]||'rating DESC'} LIMIT ${PAGE_SIZE} OFFSET ${off*PAGE_SIZE}`;
    return db.prepare(sql).all(...params).map(_mapDoctor);
  },

  addDoctor(data) {
    if (this.bmdcExists(data.bmdc)) return { error: 'এই BMDC নম্বর আগেই registered' };
    const info = _run(`INSERT INTO doctors(name,specialty,degrees,bmdc,bmdc_verified,hospital,chamber,chamber_time,
      visit_location,visit_days,visit_hours,district,experience,fee,phone,email,about,dr_type,
      medical_college,gender,languages,available,rating,reviews_count) VALUES(?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,0)`,
      [data.name,data.specialty,JSON.stringify(data.degrees||[]),data.bmdc,
       data.hospital||'',data.chamber||'',data.chamberTime||'',data.visitLocation||'',
       data.visitDays||'',JSON.stringify(data.visitHours||[]),data.district||'',
       parseInt(data.experience)||0,parseInt(data.fee)||0,data.phone||'',data.email||'',
       data.about||'',data.drType||'',data.medicalCollege||'',data.gender||'',data.languages||'']);
    _run("INSERT INTO doctors_fts(doctor_id,name,specialty,about) VALUES(?,?,?,?)",
      [info.lastInsertRowid,data.name,data.specialty||'',data.about||'']);
    _audit(null,'admin','add_doctor','doctor',info.lastInsertRowid,{bmdc:data.bmdc});
    return { doctor:_mapDoctor(_get("SELECT * FROM doctors WHERE id=?", info.lastInsertRowid)) };
  },

  deleteDoctor(id) {
    const doc = _get("SELECT user_id FROM doctors WHERE id=?", id);
    _run("UPDATE doctors SET deleted=1,deleted_at=datetime('now') WHERE id=?", [id]);
    _run("DELETE FROM doctors_fts WHERE doctor_id=?", [id]);
    if (doc?.user_id) _run("UPDATE users SET deleted=1,deleted_at=datetime('now') WHERE id=?", [doc.user_id]);
    _audit(null,'admin','delete_doctor','doctor',id);
  },

  // Reviews
  getReviewsByDoctor(id)  { return _all("SELECT * FROM reviews WHERE doctor_id=? ORDER BY date DESC", id).map(_mapReview); },
  getReviewsByPatient(id) { return _all("SELECT * FROM reviews WHERE patient_id=? ORDER BY date DESC", id).map(_mapReview); },
  getAllReviews()          { return _all("SELECT * FROM reviews ORDER BY date DESC").map(_mapReview); },
  markHelpful(id)         { _run("UPDATE reviews SET helpful=helpful+1 WHERE id=?", [id]); },

  checkReviewLimitMonthly(pid) {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    return _get("SELECT COUNT(*) AS c FROM reviews WHERE patient_id=? AND date>=?",
      pid, d.toISOString().split('T')[0])?.c || 0;
  },
  checkNetworkReviewMonthly(hint) {
    if (!hint) return 0;
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    return _get("SELECT COUNT(*) AS c FROM reviews WHERE network_hint=? AND date>=?",
      hint, d.toISOString().split('T')[0])?.c || 0;
  },

  addReview(doctorId, patientId, patientName, rating, comment, fileData, deviceFp, networkHint) {
    const u = _get("SELECT banned,phone,device_fp,network_hint FROM users WHERE id=?", patientId);
    if (u?.banned)                              return { error: 'আপনার account বন্ধ করা হয়েছে' };
    if (deviceFp  && this.isDeviceBanned(deviceFp))    return { error: 'এই device থেকে review দেওয়া সম্ভব নয়' };
    if (networkHint && this.isNetworkBanned(networkHint)) return { error: 'এই network থেকে review দেওয়া সম্ভব নয়' };

    const monthCount = this.checkReviewLimitMonthly(patientId);
    if (monthCount >= 20) {
      this.banUser(patientId, 'monthly_review_limit');
      if (deviceFp)    _banDevice(deviceFp,    'monthly_review_limit');
      if (networkHint) _banNetwork(networkHint, 'monthly_review_limit');
      return { error: 'মাসিক ২০টির সীমা পূর্ণ। account বন্ধ হয়েছে।' };
    }

    const netCount = this.checkNetworkReviewMonthly(networkHint);
    if (netCount >= 20) {
      this.banUser(patientId, 'network_review_limit');
      if (networkHint) _banNetwork(networkHint, 'network_review_limit');
      return { error: 'এই network থেকে সীমা অতিক্রম। account বন্ধ হয়েছে।' };
    }

    if (_get("SELECT id FROM reviews WHERE doctor_id=? AND patient_id=?", doctorId, patientId))
      return { error: 'আপনি এই ডাক্তারকে আগেই review করেছেন' };

    const reviewId = db.transaction(() => {
      const ri = _run(`INSERT INTO reviews(doctor_id,patient_id,patient_name,rating,comment,date,helpful,replies,verification_status,device_fp,network_hint)
        VALUES(?,?,?,?,?,date('now'),0,'[]','pending',?,?)`,
        [doctorId,patientId,patientName,rating,comment,deviceFp||null,networkHint||null]);
      const rid = ri.lastInsertRowid;
      if (fileData?.data) {
        _run("INSERT INTO review_files(review_id,file_data,file_name,mime_type) VALUES(?,?,?,?)",
          [rid,fileData.data,fileData.name,fileData.type]);
        _run("UPDATE reviews SET file_ref=? WHERE id=?", [rid,rid]);
      }
      return rid;
    })();

    this._recalcRating(doctorId);
    _audit(patientId,'patient','add_review','review',reviewId,{doctorId,rating});
    return { review:_mapReview(_get("SELECT * FROM reviews WHERE id=?", reviewId)), remaining:20-(monthCount+1) };
  },

  _recalcRating(doctorId) {
    const a = _get("SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE doctor_id=?", doctorId);
    _run("UPDATE doctors SET rating=?,reviews_count=? WHERE id=?",
      [Math.round((a?.avg_r||0)*10)/10, a?.cnt||0, doctorId]);
  },

  addReply(reviewId, authorId, authorName, authorRole, text) {
    if (!text?.trim()) return { error: 'Reply text দিন' };
    const r = _get("SELECT replies FROM reviews WHERE id=?", reviewId);
    if (!r) return { error: 'Review পাওয়া যায়নি' };
    const replies = _jp(r.replies,[]);
    const reply = { id:Date.now(), authorId, authorName, authorRole, text:text.trim(), date:new Date().toISOString().split('T')[0] };
    replies.push(reply);
    _run("UPDATE reviews SET replies=? WHERE id=?", [JSON.stringify(replies), reviewId]);
    _audit(authorId,authorRole,'add_reply','review',reviewId);
    return { success:true, reply };
  },

  setReviewVerification(reviewId, status) {
    if (!['pending','verified','flagged','removed','fake'].includes(status)) return { error:'Invalid status' };
    // 'fake' is an alias for 'flagged' — frontend uses 'fake', normalize it
    if (status === 'fake') status = 'flagged';
    if (!_get("SELECT id FROM reviews WHERE id=?", reviewId)) return { error:'Review পাওয়া যায়নি' };
    _run("UPDATE reviews SET verification_status=? WHERE id=?", [status, reviewId]);
    _audit(null,'admin','verify_review','review',reviewId,{status});
    return { success:true };
  },

  deleteReview(reviewId) {
    const r = _get("SELECT doctor_id FROM reviews WHERE id=?", reviewId);
    _run("DELETE FROM review_files WHERE review_id=?", [reviewId]);
    _run("DELETE FROM reviews WHERE id=?", [reviewId]);
    if (r) this._recalcRating(r.doctor_id);
    _audit(null,'admin','delete_review','review',reviewId);
  },

  getReviewFile(reviewId) { return _get("SELECT * FROM review_files WHERE review_id=?", reviewId)||null; },

  // BMDC
  getRevokedBmdc() { return _all("SELECT bmdc FROM bmdc_revoked").map(r=>r.bmdc); },

  revokeBmdc(bmdc, reason) {
    _run("INSERT OR IGNORE INTO bmdc_revoked(bmdc,reason) VALUES(?,?)", [bmdc.trim(), reason||'admin']);
    _audit(null,'admin','revoke_bmdc',null,null,{bmdc});
    return this._runBmdcSync();
  },

  reinstateBmdc(bmdc) {
    _run("DELETE FROM bmdc_revoked WHERE bmdc=?", [bmdc.trim()]);
    const doc = _get("SELECT id,user_id FROM doctors WHERE bmdc=?", bmdc.trim());
    if (doc) {
      _run("UPDATE doctors SET bmdc_verified=1,bmdc_suspended=0 WHERE id=?", [doc.id]);
      if (doc.user_id) _run("UPDATE users SET banned=0,ban_reason=NULL WHERE id=? AND ban_reason='bmdc_revoked'", [doc.user_id]);
    }
    _audit(null,'admin','reinstate_bmdc',null,null,{bmdc});
    return { success:true };
  },

  _runBmdcSync() {
    const revoked = this.getRevokedBmdc().map(b=>b.toLowerCase().trim());
    const doctors = _all("SELECT id,user_id,bmdc FROM doctors WHERE deleted=0");
    let suspended = 0;
    db.transaction(() => {
      for (const d of doctors) {
        if (revoked.includes((d.bmdc||'').toLowerCase().trim())) {
          _run("UPDATE doctors SET bmdc_verified=0,bmdc_suspended=1 WHERE id=?", [d.id]);
          if (d.user_id) {
            const u = _get("SELECT banned FROM users WHERE id=?", d.user_id);
            if (u&&!u.banned) { _run("UPDATE users SET banned=1,ban_reason='bmdc_revoked',banned_at=datetime('now') WHERE id=?", [d.user_id]); suspended++; }
          }
        }
      }
      _run("INSERT INTO bmdc_sync_log(date,revoked_checked,suspended) VALUES(datetime('now'),?,?)", [revoked.length, suspended]);
    })();
    return { suspended, checked:doctors.length };
  },

  getBmdcSyncInfo() {
    return { lastSync:_get("SELECT date FROM bmdc_sync_log ORDER BY id DESC LIMIT 1")?.date||'কখনো হয়নি',
      log:_all("SELECT * FROM bmdc_sync_log ORDER BY id DESC LIMIT 5"),
      revokedCount:this.getRevokedBmdc().length };
  },

  autoBmdcSync() {
    const last = _get("SELECT value FROM site_meta WHERE key='bmdc_last_sync'");
    if (!last || (Date.now()-parseInt(last.value||'0'))>86_400_000) {
      this._runBmdcSync();
      _run("INSERT OR REPLACE INTO site_meta(key,value) VALUES('bmdc_last_sync',?)", [Date.now().toString()]);
    }
  },

  // Stats
  getStats() {
    return {
      totalDoctors:   _get("SELECT COUNT(*) AS c FROM doctors  WHERE deleted=0").c,
      totalPatients:  _get("SELECT COUNT(*) AS c FROM users    WHERE role='patient' AND deleted=0").c,
      totalReviews:   _get("SELECT COUNT(*) AS c FROM reviews").c,
      totalVisits:    this.getVisitCount(),
      pendingReviews: _get("SELECT COUNT(*) AS c FROM reviews  WHERE verification_status='pending'").c,
      bannedUsers:    _get("SELECT COUNT(*) AS c FROM users    WHERE banned=1").c,
      bannedDevices:  _get("SELECT COUNT(*) AS c FROM banned_devices").c,
      bannedNetworks: _get("SELECT COUNT(*) AS c FROM banned_networks").c,
    };
  },

  getAllUsers()   { return _all("SELECT * FROM users WHERE deleted=0 ORDER BY id DESC").map(_mapUser); },
  getAuditLog(limit=50, offset=0) { return _all("SELECT * FROM audit_log ORDER BY ts DESC LIMIT ? OFFSET ?", limit, offset); },
};
