// ============================================================
// app.js — Doctor Review System v3
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  renderNavbar();
  updateHeroStats();
  showPage('home');
});

// ===== HERO STATS (real counts) =====
function updateHeroStats() {
  const stats = DB.getStats();
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val.toLocaleString(); };
  el('stat-visits', stats.totalVisits);
  el('stat-doctors', stats.totalDoctors);
  el('stat-patients', stats.totalPatients);
}

// ===== ROUTING =====
function showPage(page, data = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) { el.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (page === 'home') { renderFeaturedDoctors(); updateHeroStats(); }
  if (page === 'doctors') renderDoctorsPage(data);
  if (page === 'doctor-profile') renderDoctorProfile(data.id);
  if (page === 'dashboard') renderDashboard();
  if (page === 'admin') renderAdmin();
}

// ===== NAVBAR =====
function renderNavbar() {
  const user = DB.getSession();
  const nav = document.getElementById('nav-user-area');
  if (!nav) return;
  if (user) {
    const dest = user.role === 'admin' ? 'admin' : 'dashboard';
    nav.innerHTML = `
      <button class="nav-link" onclick="showPage('${dest}')">${user.role === 'admin' ? '⚙️ Admin' : user.role === 'doctor' ? '👨‍⚕️ Dashboard' : '📋 Dashboard'}</button>
      <button class="avatar-btn" onclick="showPage('${dest}')" title="${user.name}">${user.avatar}</button>
      <button class="nav-btn outline" onclick="logout()">Logout</button>`;
  } else {
    nav.innerHTML = `
      <button class="nav-btn outline" onclick="openModal('modal-login')">Login</button>
      <button class="nav-btn" onclick="openModal('modal-reg-choice')">Sign Up</button>`;
  }
}

// ===== HOME =====
function renderFeaturedDoctors() {
  const container = document.getElementById('featured-doctors');
  if (!container) return;
  // top 3 by rating
  const top = DB.getAllDoctors().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
  container.innerHTML = top.map(d => doctorCardHTML(d)).join('');
}

function doctorCardHTML(d) {
  const stars = '★'.repeat(Math.round(d.rating || 0)) + '☆'.repeat(5 - Math.round(d.rating || 0));
  const initials = d.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `
    <div class="doctor-card" onclick="showPage('doctor-profile', {id: ${d.id}})">
      <div class="card-header">
        <div class="doc-avatar">${initials}</div>
        <div class="doc-name">${d.name}</div>
        <div class="doc-specialty">${d.specialty}</div>
        <div class="available-badge ${d.available ? 'yes' : 'no'}">${d.available ? '● Available' : '● Unavailable'}</div>
      </div>
      <div class="card-body">
        <div class="doc-info">
          <div class="doc-info-row"><span class="icon">🏥</span>${d.hospital}</div>
          <div class="doc-info-row"><span class="icon">🎓</span>${d.degree || ''}</div>
          <div class="doc-info-row"><span class="icon">⏱️</span>${d.experience} বছরের অভিজ্ঞতা</div>
          <div class="doc-info-row"><span class="icon">📍</span>${d.district || 'Dhaka'}</div>
        </div>
        <div class="rating-row">
          <span class="stars">${stars}</span>
          <span class="rating-num">${d.rating || 'New'}</span>
          <span class="review-count">(${d.reviews} reviews)</span>
        </div>
        <div class="card-footer">
          <div class="fee">৳${(d.fee || 0).toLocaleString()} <span>/ visit</span></div>
          <button class="book-btn" onclick="event.stopPropagation(); handleBooking(${d.id})">Book Now</button>
        </div>
      </div>
    </div>`;
}

// ===== DOCTORS PAGE =====
let currentSpecialty = '', currentDistrict = '', currentSort = 'rating';

function renderDoctorsPage(data = {}) {
  const container = document.getElementById('doctors-list');
  if (!container) return;
  if (data.specialty !== undefined) currentSpecialty = data.specialty;
  if (data.district !== undefined) currentDistrict = data.district;
  if (data.sort !== undefined) currentSort = data.sort;
  const query = data.query !== undefined ? data.query : (document.getElementById('search-input-2')?.value || '');

  // Specialty pills
  const pillsEl = document.getElementById('specialty-pills');
  if (pillsEl) {
    const specs = [...new Set(DB.getAllDoctors().map(d => d.specialty))];
    pillsEl.innerHTML = `<button class="pill ${!currentSpecialty ? 'active' : ''}" onclick="filterDoctors('')">সব</button>` +
      specs.map(s => `<button class="pill ${currentSpecialty === s ? 'active' : ''}" onclick="filterDoctors('${s}')">${s}</button>`).join('');
  }

  // Sort buttons active state
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === currentSort));

  const doctors = DB.searchDoctors(query, currentSpecialty, currentDistrict, currentSort);
  if (doctors.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔍</div><h3>কোনো ডাক্তার পাওয়া যায়নি</h3><p>অন্য keyword দিয়ে খুঁজুন</p></div>`;
  } else {
    container.innerHTML = doctors.map(d => doctorCardHTML(d)).join('');
  }
}

function filterDoctors(specialty) { renderDoctorsPage({ specialty }); }
function sortDoctors(sortBy) { renderDoctorsPage({ sort: sortBy }); }
function handleSearch() {
  const q = document.getElementById('search-input')?.value || '';
  const s = document.getElementById('search-specialty')?.value || '';
  showPage('doctors', { query: q, specialty: s });
}

// ===== DOCTOR PROFILE =====
function renderDoctorProfile(id) {
  const doc = DB.getDoctorById(id);
  if (!doc) return;
  const container = document.getElementById('doctor-profile-content');
  if (!container) return;
  const reviews = DB.getReviewsByDoctor(id);
  const stars = '★'.repeat(Math.round(doc.rating || 0)) + '☆'.repeat(5 - Math.round(doc.rating || 0));
  const initials = doc.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const reviewsHTML = reviews.length === 0
    ? `<div class="empty-state"><div class="icon">💬</div><h3>এখনো কোনো review নেই</h3><p>প্রথম review লিখুন!</p></div>`
    : reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
        <div class="review-card">
          <div class="review-top">
            <div class="reviewer-info">
              <div class="reviewer-avatar">${r.patientName.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
              <div><div class="reviewer-name">${r.patientName}</div><div class="review-date">${r.date}</div></div>
            </div>
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          </div>
          <p class="review-comment">${r.comment}</p>
          <button class="helpful-btn" onclick="DB.markHelpful(${r.id}); showToast('Helpful হিসেবে mark হয়েছে!','success'); renderDoctorProfile(${id})">👍 Helpful (${r.helpful})</button>
        </div>`).join('');

  container.innerHTML = `
    <div class="profile-hero">
      <div style="max-width:1100px;margin:0 auto">
        <button onclick="showPage('doctors')" style="color:var(--teal-light);font-size:0.85rem;margin-bottom:20px;display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer">← সব ডাক্তার</button>
        <div class="profile-main">
          <div class="profile-avatar">${initials}</div>
          <div class="profile-info">
            <h1>${doc.name}</h1>
            <div class="specialty">${doc.specialty}</div>
            <div style="font-size:0.85rem;color:var(--teal-light);margin-bottom:12px">${doc.degree || ''}</div>
            <div class="profile-meta">
              <div class="meta-item"><span class="icon">🏥</span>${doc.hospital}</div>
              <div class="meta-item"><span class="icon">🆔</span>BMDC: ${doc.bmdc || 'N/A'}</div>
              <div class="meta-item"><span class="icon">⏱️</span>${doc.experience} বছর অভিজ্ঞতা</div>
              <div class="meta-item"><span class="icon">⭐</span>${doc.rating || 0} (${doc.reviews} reviews)</div>
              <div class="meta-item"><span class="icon">📍</span>${doc.district || ''}</div>
              <div class="meta-item"><span class="icon">📞</span>${doc.phone || ''}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="max-width:1100px;margin:0 auto">
      <div class="profile-body">
        <div>
          <div class="profile-card" style="margin-bottom:20px">
            <h3>পরিচিতি</h3>
            <p style="font-size:0.92rem;color:var(--gray-600);line-height:1.8">${doc.about}</p>
          </div>
          <div class="profile-card" style="margin-bottom:20px">
            <h3>চেম্বার তথ্য</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="doc-info-row"><span class="icon">🏥</span><span style="font-size:0.9rem;color:var(--gray-600)">${doc.chamber || doc.hospital}</span></div>
              <div class="doc-info-row"><span class="icon">⏰</span><span style="font-size:0.9rem;color:var(--gray-600)">${doc.chamberTime || 'সময় জানতে call করুন'}</span></div>
              <div class="doc-info-row"><span class="icon">📞</span><span style="font-size:0.9rem;color:var(--gray-600)">${doc.phone || ''}</span></div>
            </div>
          </div>
          <div class="profile-card">
            <h3>রোগীদের মতামত (${reviews.length})</h3>
            <div class="reviews-list">${reviewsHTML}</div>
            <div style="margin-top:18px">
              <button class="btn-primary" onclick="handleReview(${doc.id})" style="font-size:0.9rem;padding:10px 22px">✍️ Review লিখুন</button>
            </div>
          </div>
        </div>
        <div>
          <div class="profile-card" style="margin-bottom:16px;text-align:center">
            <div style="font-size:3rem;font-weight:800;color:var(--navy);font-family:var(--font-head)">${doc.rating || '—'}</div>
            <div style="color:var(--accent);font-size:1.4rem;margin:4px 0">${stars}</div>
            <div style="font-size:0.82rem;color:var(--gray-400)">${doc.reviews} reviews</div>
          </div>
          <div class="profile-card">
            <h3>Appointment নিন</h3>
            <div style="margin-bottom:12px">
              <div style="font-size:0.83rem;color:var(--gray-600);margin-bottom:4px">Visit Fee</div>
              <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;color:var(--navy)">৳${(doc.fee || 0).toLocaleString()}</div>
            </div>
            <div style="font-size:0.82rem;margin-bottom:16px;color:${doc.available ? 'var(--success)' : 'var(--danger)'}">
              ${doc.available ? '● এখন সিরিয়াল নেওয়া যাচ্ছে' : '● এখন unavailable'}
            </div>
            <button class="btn-full" onclick="handleBooking(${doc.id})" ${!doc.available ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
              📅 Appointment নিন
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

// ===== BOOKING =====
function handleBooking(doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Appointment নিতে আগে login করুন', 'error'); openModal('modal-login'); return; }
  if (user.role === 'doctor' || user.role === 'admin') { showToast('শুধুমাত্র রোগীরা appointment নিতে পারবেন', 'error'); return; }
  const doc = DB.getDoctorById(doctorId);
  if (!doc) return;
  document.getElementById('book-doctor-name').textContent = doc.name;
  document.getElementById('book-doctor-specialty').textContent = doc.specialty;
  document.getElementById('book-doctor-fee').textContent = `৳${(doc.fee || 0).toLocaleString()}`;
  document.getElementById('book-form').onsubmit = (e) => {
    e.preventDefault();
    const date = document.getElementById('book-date').value;
    const time = document.getElementById('book-time').value;
    if (!date || !time) { showToast('সব তথ্য দিন', 'error'); return; }
    DB.bookAppointment(doctorId, user.id, user.name, date, time, doc.fee);
    closeModal('modal-booking');
    showToast('Appointment সফলভাবে নেওয়া হয়েছে! 🎉', 'success');
  };
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('book-date').min = tomorrow.toISOString().split('T')[0];
  openModal('modal-booking');
}

// ===== REVIEW =====
function handleReview(doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Review দিতে আগে login করুন', 'error'); openModal('modal-login'); return; }
  if (user.role !== 'patient') { showToast('শুধুমাত্র রোগীরা review দিতে পারবেন', 'error'); return; }
  document.getElementById('review-form').onsubmit = (e) => {
    e.preventDefault();
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('review-comment').value.trim();
    if (!rating) { showToast('Rating দিন', 'error'); return; }
    if (!comment) { showToast('Review লিখুন', 'error'); return; }
    const result = DB.addReview(doctorId, user.id, user.name, rating, comment);
    if (result.error) { showToast(result.error, 'error'); return; }
    closeModal('modal-review');
    document.getElementById('review-form').reset();
    showToast('Review সফলভাবে দেওয়া হয়েছে! 🌟', 'success');
    if (document.getElementById('page-doctor-profile').classList.contains('active')) renderDoctorProfile(doctorId);
  };
  openModal('modal-review');
}

// ===== DASHBOARD =====
function renderDashboard() {
  const user = DB.getSession();
  if (!user) { showPage('home'); return; }
  if (user.role === 'doctor') { renderDoctorDashboard(user); return; }

  document.getElementById('dash-welcome').textContent = `স্বাগতম, ${user.name.split(' ')[0]}! 👋`;
  const appts = DB.getAppointmentsByPatient(user.id);
  const reviews = DB.getReviewsByPatient(user.id);
  document.getElementById('dash-appts-count').textContent = appts.length;
  document.getElementById('dash-reviews-count').textContent = reviews.length;

  const apptEl = document.getElementById('dash-appointments');
  if (apptEl) {
    if (!appts.length) {
      apptEl.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h3>কোনো appointment নেই</h3><p>ডাক্তার খুঁজুন এবং appointment নিন</p></div>`;
    } else {
      apptEl.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>ডাক্তার</th><th>Specialty</th><th>তারিখ</th><th>সময়</th><th>Fee</th><th>Status</th></tr></thead>
        <tbody>${appts.map(a => { const doc = DB.getDoctorById(a.doctorId); return `<tr>
          <td><strong>${doc ? doc.name : '—'}</strong></td><td>${doc ? doc.specialty : '—'}</td>
          <td>${a.date}</td><td>${a.time}</td><td>৳${a.fee.toLocaleString()}</td>
          <td><span class="status-badge ${a.status}">${a.status === 'confirmed' ? '✅ Confirmed' : a.status === 'pending' ? '⏳ Pending' : '❌ Cancelled'}</span></td>
        </tr>`; }).join('')}</tbody>
      </table></div>`;
    }
  }

  const revEl = document.getElementById('dash-reviews');
  if (revEl) {
    if (!reviews.length) {
      revEl.innerHTML = `<div class="empty-state"><div class="icon">✍️</div><h3>কোনো review নেই</h3><p>ডাক্তার দেখান এবং review দিন</p></div>`;
    } else {
      revEl.innerHTML = reviews.map(r => { const doc = DB.getDoctorById(r.doctorId); return `
        <div class="review-card"><div class="review-top">
          <div><div class="reviewer-name">${doc ? doc.name : '—'}</div><div class="review-date">${r.date}</div></div>
          <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div><p class="review-comment">${r.comment}</p></div>`; }).join('');
    }
  }
}

function renderDoctorDashboard(user) {
  const doc = DB.getDoctorByUserId(user.id);
  document.getElementById('dash-welcome').textContent = `স্বাগতম, ${user.name}! 👨‍⚕️`;
  const appts = doc ? DB.getAppointmentsByDoctor(doc.id) : [];
  const reviews = doc ? DB.getReviewsByDoctor(doc.id) : [];
  document.getElementById('dash-appts-count').textContent = appts.length;
  document.getElementById('dash-reviews-count').textContent = reviews.length;
  const apptEl = document.getElementById('dash-appointments');
  if (apptEl) {
    if (!appts.length) {
      apptEl.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h3>কোনো appointment নেই</h3></div>`;
    } else {
      apptEl.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>রোগী</th><th>তারিখ</th><th>সময়</th><th>Fee</th><th>Status</th></tr></thead>
        <tbody>${appts.map(a => `<tr>
          <td>${a.patientName}</td><td>${a.date}</td><td>${a.time}</td><td>৳${a.fee.toLocaleString()}</td>
          <td><span class="status-badge ${a.status}">${a.status}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
  }
}

// ===== ADMIN =====
function renderAdmin() {
  const user = DB.getSession();
  if (!user || user.role !== 'admin') { showPage('home'); return; }
  const stats = DB.getStats();
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val.toLocaleString(); };
  el('admin-total-doctors', stats.totalDoctors);
  el('admin-total-patients', stats.totalPatients);
  el('admin-total-reviews', stats.totalReviews);
  el('admin-total-appts', stats.totalAppointments);
  el('admin-total-visits', stats.totalVisits);
  renderAdminDoctors();
  renderAdminAppointments();
}

function renderAdminDoctors() {
  const el = document.getElementById('admin-doctors-list');
  if (!el) return;
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>নাম</th><th>Specialty</th><th>BMDC</th><th>জেলা</th><th>Rating</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${DB.getAllDoctors().map(d => `<tr>
      <td><strong>${d.name}</strong><div style="font-size:0.76rem;color:var(--gray-400)">${d.degree || ''}</div></td>
      <td>${d.specialty}</td><td style="font-family:monospace;font-size:0.82rem">${d.bmdc || '—'}</td>
      <td>${d.district || '—'}</td><td>⭐ ${d.rating} (${d.reviews})</td>
      <td>৳${(d.fee || 0).toLocaleString()}</td>
      <td><span class="status-badge ${d.available ? 'confirmed' : 'cancelled'}">${d.available ? 'Available' : 'Unavailable'}</span></td>
      <td><button onclick="adminDeleteDoctor(${d.id})" style="color:var(--danger);font-size:0.8rem;background:rgba(230,57,70,0.1);padding:4px 10px;border-radius:6px">Delete</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderAdminAppointments() {
  const el = document.getElementById('admin-appts-list');
  if (!el) return;
  const appts = DB.getAllAppointments();
  if (!appts.length) { el.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h3>কোনো appointment নেই</h3></div>`; return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>রোগী</th><th>ডাক্তার</th><th>তারিখ</th><th>সময়</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${appts.map(a => { const doc = DB.getDoctorById(a.doctorId); return `<tr>
      <td>${a.patientName}</td><td>${doc ? doc.name : '—'}</td>
      <td>${a.date}</td><td>${a.time}</td><td>৳${a.fee.toLocaleString()}</td>
      <td><span class="status-badge ${a.status}">${a.status}</span></td>
      <td style="display:flex;gap:6px">
        <button onclick="DB.updateAppointmentStatus(${a.id},'confirmed');renderAdmin();showToast('Confirmed!','success')" style="color:var(--success);font-size:0.8rem;background:rgba(82,183,136,0.1);padding:4px 10px;border-radius:6px">✅</button>
        <button onclick="DB.updateAppointmentStatus(${a.id},'cancelled');renderAdmin();showToast('Cancelled','info')" style="color:var(--danger);font-size:0.8rem;background:rgba(230,57,70,0.1);padding:4px 10px;border-radius:6px">❌</button>
      </td>
    </tr>`; }).join('')}</tbody>
  </table></div>`;
}

function adminDeleteDoctor(id) {
  if (!confirm('এই ডাক্তারকে delete করবেন?')) return;
  DB.deleteDoctor(id); renderAdmin(); showToast('ডাক্তার remove হয়েছে', 'info');
}

function openAddDoctorModal() {
  document.getElementById('add-doctor-form').onsubmit = (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('add-name').value, specialty: document.getElementById('add-specialty').value,
      degree: document.getElementById('add-degree').value, bmdc: document.getElementById('add-bmdc').value,
      hospital: document.getElementById('add-hospital').value, chamber: document.getElementById('add-chamber').value,
      chamberTime: document.getElementById('add-chamber-time').value, district: document.getElementById('add-district').value,
      experience: document.getElementById('add-exp').value, fee: document.getElementById('add-fee').value,
      phone: document.getElementById('add-phone').value, email: document.getElementById('add-email').value,
      about: document.getElementById('add-about').value,
    };
    const result = DB.addDoctor(data);
    if (result.error) { showToast(result.error, 'error'); return; }
    closeModal('modal-add-doctor'); renderAdmin();
    showToast('ডাক্তার সফলভাবে যোগ হয়েছে!', 'success'); e.target.reset();
  };
  openModal('modal-add-doctor');
}

// ===== AUTH — LOGIN =====
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const user = DB.findUser(email, password);
  if (!user) { showToast('Email বা password ভুল', 'error'); return; }
  DB.setSession(user);
  closeModal('modal-login');
  renderNavbar(); updateHeroStats();
  showToast(`স্বাগতম, ${user.name.split(' ')[0]}! 👋`, 'success');
  if (user.role === 'admin') showPage('admin');
  else showPage('dashboard');
}

// ===== AUTH — PATIENT REGISTER =====
function handlePatientRegister(e) {
  e.preventDefault();
  const password = document.getElementById('pat-password').value;
  const confirm = document.getElementById('pat-confirm').value;
  if (password !== confirm) { showToast('Password দুটো মিলছে না', 'error'); return; }
  if (password.length < 6) { showToast('Password কমপক্ষে ৬ অক্ষরের হতে হবে', 'error'); return; }
  const data = {
    name: document.getElementById('pat-name').value,
    email: document.getElementById('pat-email').value,
    password,
    phone: document.getElementById('pat-phone').value,
    gender: document.getElementById('pat-gender').value,
    age: document.getElementById('pat-age').value,
    bloodGroup: document.getElementById('pat-blood').value,
    address: document.getElementById('pat-address').value,
  };
  if (!data.phone) { showToast('Phone number দিন', 'error'); return; }
  const result = DB.registerPatient(data);
  if (result.error) { showToast(result.error, 'error'); return; }
  DB.setSession(result.user);
  closeModal('modal-reg-patient');
  renderNavbar(); updateHeroStats();
  showToast(`Account তৈরি হয়েছে! স্বাগতম, ${result.user.name.split(' ')[0]}! 🎉`, 'success');
  showPage('dashboard');
  document.getElementById('patient-reg-form').reset();
}

// ===== AUTH — DOCTOR REGISTER (MULTI-STEP) =====
let doctorStep = 1;
function showDoctorStep(step) {
  doctorStep = step;
  document.querySelectorAll('.doc-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`doc-step-${step}`)?.classList.add('active');
  document.querySelectorAll('.si').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === step);
    s.classList.toggle('done', i + 1 < step);
  });
}

function doctorStep1Next() {
  const name = document.getElementById('doc-name').value.trim();
  const email = document.getElementById('doc-email').value.trim();
  const pass = document.getElementById('doc-password').value;
  const conf = document.getElementById('doc-confirm').value;
  if (!name || !email || !pass) { showToast('সব তথ্য দিন', 'error'); return; }
  if (pass !== conf) { showToast('Password দুটো মিলছে না', 'error'); return; }
  if (pass.length < 6) { showToast('Password কমপক্ষে ৬ অক্ষরের হতে হবে', 'error'); return; }
  if (DB.emailExists(email)) { showToast('এই email দিয়ে আগেই account আছে', 'error'); return; }
  showDoctorStep(2);
}

function doctorStep2Next() {
  const specialty = document.getElementById('doc-specialty').value;
  const degree = document.getElementById('doc-degree').value.trim();
  const bmdc = document.getElementById('doc-bmdc').value.trim();
  const exp = document.getElementById('doc-experience').value;
  if (!specialty || !degree || !bmdc || !exp) { showToast('সব তথ্য দিন', 'error'); return; }
  if (DB.bmdcExists(bmdc)) { showToast('এই BMDC নম্বর দিয়ে আগেই ডাক্তার registered আছেন', 'error'); return; }
  showDoctorStep(3);
}

function handleDoctorRegister(e) {
  e.preventDefault();
  const hospital = document.getElementById('doc-hospital').value.trim();
  const district = document.getElementById('doc-district').value;
  const fee = document.getElementById('doc-fee').value;
  const phone = document.getElementById('doc-phone').value.trim();
  if (!hospital || !district || !fee || !phone) { showToast('সব তথ্য দিন', 'error'); return; }

  const data = {
    name: document.getElementById('doc-name').value,
    email: document.getElementById('doc-email').value,
    password: document.getElementById('doc-password').value,
    specialty: document.getElementById('doc-specialty').value,
    degree: document.getElementById('doc-degree').value,
    bmdc: document.getElementById('doc-bmdc').value,
    experience: document.getElementById('doc-experience').value,
    about: document.getElementById('doc-about').value,
    hospital, district, fee, phone,
    chamber: document.getElementById('doc-chamber').value,
    chamberTime: document.getElementById('doc-chamber-time').value,
  };

  const result = DB.registerDoctor(data);
  if (result.error) { showToast(result.error, 'error'); return; }
  DB.setSession(result.user);
  closeModal('modal-reg-doctor');
  renderNavbar(); updateHeroStats();
  showToast(`Doctor account তৈরি হয়েছে! স্বাগতম, ${result.user.name}! 🎉`, 'success');
  showPage('dashboard');
}

function logout() {
  DB.clearSession(); renderNavbar(); showPage('home'); showToast('Logout সফল হয়েছে', 'info');
}

// ===== MODAL HELPERS =====
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${{ success: '✅', error: '❌', info: 'ℹ️' }[type] || ''}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ===== TABS =====
function switchTab(tabId, btn) {
  const p = btn.closest('.tabs').parentElement;
  p.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  p.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  p.querySelector('#' + tabId)?.classList.add('active');
}
