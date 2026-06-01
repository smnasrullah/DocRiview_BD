'use strict';

const API_BASE = '/api';
const TOKEN_KEY = 'dr_auth_token';

// ── HTTP Helpers ──────────────────────────────────────────────
const _http = {
  _token() { return sessionStorage.getItem(TOKEN_KEY); },

  async _req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = this._token();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res  = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { _error: data.error || 'Server error' };
    return data;
  },

  get:    (p)    => _http._req('GET',    p),
  post:   (p, b) => _http._req('POST',   p, b),
  put:    (p, b) => _http._req('PUT',    p, b),
  delete: (p)    => _http._req('DELETE', p),
};

// ── DB Public API ─────────────────────────────────────────────
const DB = {
  async init() {
    _http.post('/visit').catch(() => {});
  },

  // Stats
  async getStats() {
    const s = await _http.get('/stats');
    return s._error
      ? { totalDoctors: 0, totalPatients: 0, totalReviews: 0, totalVisits: 0, pendingReviews: 0 }
      : s;
  },

  // Session
  setSession(user)  { sessionStorage.setItem('current_user', JSON.stringify(user)); },
  getSession()      { return JSON.parse(sessionStorage.getItem('current_user') || 'null'); },
  clearSession()    { sessionStorage.removeItem('current_user'); sessionStorage.removeItem(TOKEN_KEY); },

  async refreshSession() {
    const data = await _http.get('/users/me');
    if (!data._error) { this.setSession(data); return data; }
    return null;
  },

  // Auth
  async findUser(email, password) {
    const data = await _http.post('/auth/login', { email, password });
    if (data._error) return null;
    if (data.banned) return { banned: true, banReason: data.banReason };
    sessionStorage.setItem(TOKEN_KEY, data.token);
    this.setSession(data.user);
    return data.user;
  },

  async emailExists(email) {
    const d = await _http.get('/auth/check/email?email=' + encodeURIComponent(email));
    return d.exists || false;
  },

  async phoneExistsForPatient(phone) {
    const d = await _http.get('/auth/check/phone?phone=' + encodeURIComponent(phone));
    return d.exists || false;
  },

  async isPhoneBanned(phone) {
    const d = await _http.get('/auth/check/phone?phone=' + encodeURIComponent(phone));
    return d.banned || false;
  },

  async isDeviceBanned() {
    const fp = this.getDeviceFingerprint();
    const d  = await _http.get('/auth/check/device?fp=' + encodeURIComponent(fp));
    return d.banned || false;
  },

  async bmdcExists(bmdc) {
    const d = await _http.get('/auth/check/bmdc?bmdc=' + encodeURIComponent(bmdc));
    return d.exists || false;
  },

  async registerPatient(data) {
    const result = await _http.post('/auth/register/patient', { ...data, deviceFp: this.getDeviceFingerprint() });
    if (result._error) return { error: result._error };
    sessionStorage.setItem(TOKEN_KEY, result.token);
    this.setSession(result.user);
    return { user: result.user };
  },

  async registerDoctor(data) {
    const result = await _http.post('/auth/register/doctor', { ...data, deviceFp: this.getDeviceFingerprint() });
    if (result._error) return { error: result._error };
    sessionStorage.setItem(TOKEN_KEY, result.token);
    this.setSession(result.user);
    return { user: result.user, doctor: result.doctor };
  },

  // Users
  async updateUser(id, data) {
    const result = await _http.put('/users/me', data);
    if (result._error) return { error: result._error };
    this.setSession(result.user);
    return result;
  },

  async updateDoctorProfile(userId, data) {
    const result = await _http.put('/doctors/me', data);
    if (result._error) return { error: result._error };
    return result;
  },

  async setProfilePic(userId, base64) {
    await _http.put('/users/me/pic', { base64 });
    await this.refreshSession();
  },

  async deleteAccount() {
    await _http.delete('/users/me');
    this.clearSession();
    return { success: true };
  },

  async getUserById() {
    const d = await _http.get('/users/me');
    return d._error ? null : d;
  },

  // Doctors
  async getAllDoctors() {
    const d = await _http.get('/doctors');
    return Array.isArray(d) ? d : [];
  },

  async getDoctorById(id) {
    const d = await _http.get('/doctors/' + id);
    return d._error ? null : d;
  },

  async getDoctorByUserId(uid) {
    const docs = await this.getAllDoctors();
    return docs.find(d => d.userId === parseInt(uid)) || null;
  },

  async searchDoctors(q, specialty, district, sortBy) {
    const params = new URLSearchParams();
    if (q)        params.set('q',        q);
    if (specialty)params.set('specialty', specialty);
    if (district) params.set('district',  district);
    if (sortBy)   params.set('sort',      sortBy);
    const url = '/doctors' + (params.toString() ? '?' + params : '');
    const d   = await _http.get(url);
    return Array.isArray(d) ? d : [];
  },

  // Reviews
  async getReviewsByDoctor(id) {
    const d = await _http.get('/doctors/' + id + '/reviews');
    return Array.isArray(d) ? d : [];
  },

  async addReview(doctorId, patientId, patientName, rating, comment, fileData) {
    const result = await _http.post('/doctors/' + doctorId + '/reviews', {
      rating, comment, fileData: fileData || null,
      deviceFp: this.getDeviceFingerprint(),
    });
    if (result._error) return { error: result._error };
    return result;
  },

  async addReply(reviewId, authorId, authorName, authorRole, text) {
    const result = await _http.post('/reviews/' + reviewId + '/reply', { text });
    return result._error ? { error: result._error } : result;
  },

  async markHelpful(id) {
    await _http.post('/reviews/' + id + '/helpful');
  },

  async changePassword(newPass) {
    return _http.put('/users/me/password', { newPassword: newPass });
  },

  // Admin
  async getAll(table) {
    if (table === 'users')   { const d = await _http.get('/admin/users');   return Array.isArray(d) ? d : []; }
    if (table === 'reviews') { const d = await _http.get('/admin/reviews'); return Array.isArray(d) ? d : []; }
    if (table === 'doctors') { return this.getAllDoctors(); }
    return [];
  },

  async banUser(userId, reason)  { await _http.post('/admin/users/' + userId + '/ban',   { reason }); },
  async unbanUser(userId)        { await _http.post('/admin/users/' + userId + '/unban'); },

  async setReviewVerification(reviewId, status) {
    const backendStatus = status === 'fake' ? 'flagged' : status;
    return _http.put('/reviews/' + reviewId + '/verify', { status: backendStatus });
  },

  async getReviewFile(reviewId) {
    const d = await _http.get('/reviews/' + reviewId + '/file');
    return d._error ? null : d;
  },

  async deleteReview(reviewId)  { await _http.delete('/reviews/' + reviewId); },
  async deleteDoctor(id)        { await _http.delete('/doctors/' + id); },

  async revokeBmdc(bmdc)        { return _http.post('/admin/bmdc/revoke',    { bmdc }); },
  async reinstateBmdc(bmdc)     { return _http.post('/admin/bmdc/reinstate', { bmdc }); },

  async runBmdcSync() {
    const d = await _http.post('/admin/bmdc/sync');
    return d._error ? { suspended: 0, checked: 0 } : d;
  },

  async getBmdcSyncInfo() {
    const d = await _http.get('/admin/bmdc');
    return d._error ? { lastSync: 'N/A', log: [], revokedCount: 0 } : d;
  },

  async getRevokedBmdcList() {
    const d = await _http.get('/admin/bmdc/revoked');
    return Array.isArray(d) ? d : [];
  },

  // Device Fingerprint
  getDeviceFingerprint() {
    const existing = localStorage.getItem('_device_fp');
    if (existing) return existing;
    const nav    = window.navigator;
    const scr    = window.screen;
    const parts  = [
      nav.userAgent, nav.language, nav.platform,
      nav.hardwareConcurrency || '',
      scr.width + 'x' + scr.height, scr.colorDepth,
      new Date().getTimezoneOffset(),
    ].join('|');
    let hash = 0;
    for (let i = 0; i < parts.length; i++) {
      const c = parts.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash;
    }
    const fp = 'DEV_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    localStorage.setItem('_device_fp', fp);
    return fp;
  },
};
