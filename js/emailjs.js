'use strict';

// ── EmailJS Configuration ────────────────────────────────────
// Setup: https://www.emailjs.com
//   1. Create free account → Email Services → Add Gmail → Connect
//   2. Email Templates → Create New Template:
//        To Email : {{to_email}}
//        Subject  : DocReview BD — Verification Code
//        Body     : নমস্কার {{to_name}}, আপনার code: {{otp_code}}
//   3. Account → General → Copy Public Key
//   4. Replace the three values below:

const EMAIL_CONFIG = {
  PUBLIC_KEY:  'YOUR_PUBLIC_KEY',
  SERVICE_ID:  'YOUR_SERVICE_ID',
  TEMPLATE_ID: 'YOUR_TEMPLATE_ID',
};

// ─────────────────────────────────────────────────────────────

const EmailVerification = {

  _store: {},

  generateOTP() {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  },

  _save(email, code) {
    this._store[email.toLowerCase().trim()] = {
      code,
      expires:  Date.now() + 10 * 60 * 1000,
      attempts: 0,
    };
  },

  getPendingEmail() {
    return Object.keys(this._store)[0] || null;
  },

  getRemainingSeconds() {
    const email = this.getPendingEmail();
    if (!email) return 0;
    return Math.max(0, Math.floor((this._store[email].expires - Date.now()) / 1000));
  },

  verifyOTP(email, input) {
    const key    = email.toLowerCase().trim();
    const record = this._store[key];
    if (!record)                    return { error: 'OTP pending নেই। আবার চেষ্টা করুন।' };
    if (Date.now() > record.expires){ delete this._store[key]; return { error: 'OTP মেয়াদ শেষ হয়েছে।' }; }
    if (record.attempts >= 5)       { delete this._store[key]; return { error: 'অনেকবার ভুল। নতুন OTP নিন।' }; }
    if (record.code !== String(input).trim()) {
      record.attempts++;
      return { error: `ভুল OTP। আরো ${5 - record.attempts} বার সুযোগ আছে।` };
    }
    delete this._store[key];
    return { success: true };
  },

  async sendOTP(email, name) {
    const code = this.generateOTP();
    this._save(email, code);

    const isConfigured =
      EMAIL_CONFIG.PUBLIC_KEY  !== 'YOUR_PUBLIC_KEY' &&
      EMAIL_CONFIG.SERVICE_ID  !== 'YOUR_SERVICE_ID' &&
      EMAIL_CONFIG.TEMPLATE_ID !== 'YOUR_TEMPLATE_ID';

    if (!isConfigured) {
      return { success: true, demo: true, code };
    }

    try {
      emailjs.init({ publicKey: EMAIL_CONFIG.PUBLIC_KEY });
      await emailjs.send(EMAIL_CONFIG.SERVICE_ID, EMAIL_CONFIG.TEMPLATE_ID, {
        to_email: email,
        to_name:  name,
        otp_code: code,
      });
      return { success: true, demo: false };
    } catch (err) {
      console.error('[EmailJS]', err);
      return { success: true, demo: true, code, error: err?.text || err?.message };
    }
  },
};
