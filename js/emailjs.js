
const EMAIL_CONFIG = {
  PUBLIC_KEY:   'YOUR_PUBLIC_KEY', // EmailJS public key দিন এখানে
  SERVICE_ID:   'YOUR_SERVICE_ID', // EmailJS service ID
  TEMPLATE_ID:  'YOUR_TEMPLATE_ID', // EmailJS template ID
};

// ============================================================
// EmailVerification — সব verification logic এখানে
// ============================================================

const EmailVerification = {

  // ৬-digit OTP তৈরি করো
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // OTP save করো localStorage-এ (email, code, expiry সহ)
  saveOTP(email, code) {
    const data = {
      email: email.toLowerCase().trim(),
      code,
      expires: Date.now() + 10 * 60 * 1000, // ১০ মিনিট
      attempts: 0,
    };
    localStorage.setItem('pending_otp', JSON.stringify(data));
  },

  // OTP verify করো
  verifyOTP(email, inputCode) {
    const raw = localStorage.getItem('pending_otp');
    if (!raw) return { error: 'কোনো verification pending নেই। আবার চেষ্টা করুন।' };

    const data = JSON.parse(raw);

    if (data.email !== email.toLowerCase().trim())
      return { error: 'Email মিলছে না।' };

    if (Date.now() > data.expires) {
      localStorage.removeItem('pending_otp');
      return { error: 'Code-এর মেয়াদ শেষ হয়ে গেছে। নতুন code নিন।' };
    }

    // Max 5 attempts
    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts > 5) {
      localStorage.removeItem('pending_otp');
      return { error: 'অনেকবার ভুল code দিয়েছেন। নতুন code নিন।' };
    }
    localStorage.setItem('pending_otp', JSON.stringify(data));

    if (data.code !== inputCode.toString().trim())
      return { error: `ভুল code। আরো ${6 - data.attempts} বার চেষ্টা করতে পারবেন।` };

    // সফল — OTP মুছে দাও
    localStorage.removeItem('pending_otp');
    return { success: true };
  },

  // Pending OTP-এর email পড়ো
  getPendingEmail() {
    const raw = localStorage.getItem('pending_otp');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expires) { localStorage.removeItem('pending_otp'); return null; }
    return data.email;
  },

  // Remaining time (seconds)
  getRemainingSeconds() {
    const raw = localStorage.getItem('pending_otp');
    if (!raw) return 0;
    const data = JSON.parse(raw);
    const remaining = Math.floor((data.expires - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  },

  // EmailJS দিয়ে real email পাঠাও
  async sendOTP(toEmail, toName) {
    const code = this.generateOTP();
    this.saveOTP(toEmail, code);

    // EmailJS configured কিনা চেক করো
    if (EMAIL_CONFIG.PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
      // Demo mode — console-এ দেখাও
      console.warn('⚠️ EmailJS configured নেই। Demo mode-এ আছে।');
      console.log(`📧 Demo OTP for ${toEmail}: ${code}`);
      return { success: true, demo: true, code };
    }

    try {
      // EmailJS initialize
      emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);

      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATE_ID,
        {
          to_email:  toEmail,
          to_name:   toName || toEmail.split('@')[0],
          otp_code:  code,
          site_name: 'DocReview BD',
          expire_min: '10',
        }
      );

      if (response.status === 200) {
        return { success: true, demo: false };
      } else {
        throw new Error('EmailJS error: ' + response.text);
      }
    } catch (err) {
      console.error('Email send failed:', err);
      // Fallback: demo mode
      return { success: true, demo: true, code, error: err.message };
    }
  },
};
