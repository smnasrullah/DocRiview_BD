// ============================================================
// app.js — Doctor Review System
// Handles: routing, auth, doctors, reviews, appointments
// ============================================================

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  renderNavbar();
  showPage('home');
  renderHomePage();
});

// ===== ROUTING =====
function showPage(page, data = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) {
    el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (page === 'home') renderHomePage();
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
    nav.innerHTML = `
      <button class="nav-link" onclick="showPage('${user.role === 'admin' ? 'admin' : 'dashboard'}')">
        ${user.role === 'admin' ? '⚙️ Admin Panel' : '📋 My Dashboard'}
      </button>
      <button class="avatar-btn" onclick="showPage('${user.role === 'admin' ? 'admin' : 'dashboard'}')" title="${user.name}">${user.avatar}</button>
      <button class="nav-btn outline" onclick="logout()">Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <button class="nav-btn outline" onclick="openModal('modal-login')">Login</button>
      <button class="nav-btn" onclick="openModal('modal-register')">Sign Up</button>
    `;
  }
}

// ===== HOME PAGE =====
function renderHomePage() {
  renderFeaturedDoctors();
}

function renderFeaturedDoctors() {
  const container = document.getElementById('featured-doctors');
  if (!container) return;
  const doctors = DB.getAllDoctors().slice(0, 3);
  container.innerHTML = doctors.map(d => doctorCardHTML(d)).join('');
}

function doctorCardHTML(d) {
  const stars = '★'.repeat(Math.round(d.rating)) + '☆'.repeat(5 - Math.round(d.rating));
  return `
    <div class="doctor-card" onclick="showPage('doctor-profile', {id: ${d.id}})">
      <div class="card-header">
        <div class="doc-avatar">${d.name.split(' ').slice(-1)[0][0]}${d.name.split(' ')[1]?.[0] || ''}</div>
        <div class="doc-name">${d.name}</div>
        <div class="doc-specialty">${d.specialty}</div>
        <div class="available-badge ${d.available ? 'yes' : 'no'}">${d.available ? '● Available' : '● Unavailable'}</div>
      </div>
      <div class="card-body">
        <div class="doc-info">
          <div class="doc-info-row"><span class="icon">🏥</span> ${d.hospital}</div>
          <div class="doc-info-row"><span class="icon">⏱️</span> ${d.experience} years experience</div>
        </div>
        <div class="rating-row">
          <span class="stars">${stars}</span>
          <span class="rating-num">${d.rating || 'New'}</span>
          <span class="review-count">(${d.reviews} reviews)</span>
        </div>
        <div class="card-footer">
          <div class="fee">৳${d.fee.toLocaleString()} <span>/ visit</span></div>
          <button class="book-btn" onclick="event.stopPropagation(); handleBooking(${d.id})">Book Now</button>
        </div>
      </div>
    </div>`;
}

// ===== DOCTORS PAGE =====
function renderDoctorsPage(data = {}) {
  const container = document.getElementById('doctors-list');
  if (!container) return;
  const query = data.query || '';
  const specialty = data.specialty || '';
  const doctors = DB.searchDoctors(query, specialty);

  // render specialty pills
  const pillsEl = document.getElementById('specialty-pills');
  if (pillsEl) {
    const specialties = [...new Set(DB.getAllDoctors().map(d => d.specialty))];
    pillsEl.innerHTML = `<button class="pill ${!specialty ? 'active' : ''}" onclick="filterDoctors('')">All</button>` +
      specialties.map(s => `<button class="pill ${specialty === s ? 'active' : ''}" onclick="filterDoctors('${s}')">${s}</button>`).join('');
  }

  if (doctors.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔍</div><h3>No doctors found</h3><p>Try a different search term</p></div>`;
  } else {
    container.innerHTML = doctors.map(d => doctorCardHTML(d)).join('');
  }
}

let currentSpecialty = '';
function filterDoctors(specialty) {
  currentSpecialty = specialty;
  renderDoctorsPage({ specialty });
}

// ===== SEARCH =====
function handleSearch() {
  const query = document.getElementById('search-input')?.value || '';
  const specialty = document.getElementById('search-specialty')?.value || '';
  showPage('doctors', { query, specialty });
}

// ===== DOCTOR PROFILE =====
function renderDoctorProfile(id) {
  const doc = DB.getDoctorById(id);
  if (!doc) return;
  const container = document.getElementById('doctor-profile-content');
  if (!container) return;

  const reviews = DB.getReviewsByDoctor(id);
  const stars = '★'.repeat(Math.round(doc.rating)) + '☆'.repeat(5 - Math.round(doc.rating));

  const reviewsHTML = reviews.length === 0
    ? `<div class="empty-state"><div class="icon">💬</div><h3>No reviews yet</h3><p>Be the first to review!</p></div>`
    : reviews.map(r => `
        <div class="review-card">
          <div class="review-top">
            <div class="reviewer-info">
              <div class="reviewer-avatar">${r.patientName.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
              <div>
                <div class="reviewer-name">${r.patientName}</div>
                <div class="review-date">${r.date}</div>
              </div>
            </div>
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          </div>
          <p class="review-comment">${r.comment}</p>
          <button class="helpful-btn" onclick="DB.markHelpful(${r.id}); showToast('Marked as helpful!','success')">👍 Helpful (${r.helpful})</button>
        </div>`).join('');

  container.innerHTML = `
    <div class="profile-hero">
      <div class="profile-main">
        <div class="profile-avatar">${doc.name.split(' ').slice(-1)[0][0]}${doc.name.split(' ')[1]?.[0]||''}</div>
        <div class="profile-info">
          <h1>${doc.name}</h1>
          <div class="specialty">${doc.specialty}</div>
          <div class="profile-meta">
            <div class="meta-item"><span class="icon">🏥</span> ${doc.hospital}</div>
            <div class="meta-item"><span class="icon">⏱️</span> ${doc.experience} yrs exp</div>
            <div class="meta-item"><span class="icon">⭐</span> ${doc.rating} (${doc.reviews} reviews)</div>
            <div class="meta-item"><span class="icon">💰</span> ৳${doc.fee.toLocaleString()}/visit</div>
          </div>
        </div>
      </div>
    </div>
    <div class="profile-body">
      <div>
        <div class="profile-card" style="margin-bottom:24px">
          <h3>About</h3>
          <p style="font-size:0.92rem;color:var(--gray-600);line-height:1.75">${doc.about}</p>
        </div>
        <div class="profile-card">
          <h3>Patient Reviews (${reviews.length})</h3>
          <div class="reviews-list">${reviewsHTML}</div>
          <div style="margin-top:20px">
            <button class="btn-primary" onclick="handleReview(${doc.id})" style="font-size:0.9rem;padding:10px 22px">✍️ Write a Review</button>
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
          <h3>Book Appointment</h3>
          <div style="margin-bottom:12px">
            <div style="font-size:0.85rem;color:var(--gray-600);margin-bottom:4px">Consultation Fee</div>
            <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;color:var(--navy)">৳${doc.fee.toLocaleString()}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;margin-bottom:16px;color:${doc.available?'var(--success)':'var(--danger)'}">
            ${doc.available ? '● Available for appointment' : '● Currently unavailable'}
          </div>
          <button class="btn-full" onclick="handleBooking(${doc.id})" ${!doc.available ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            📅 Book Appointment
          </button>
        </div>
      </div>
    </div>`;
}

// ===== BOOKING =====
function handleBooking(doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Please login to book an appointment', 'error'); openModal('modal-login'); return; }
  const doc = DB.getDoctorById(doctorId);
  if (!doc) return;
  document.getElementById('book-doctor-name').textContent = doc.name;
  document.getElementById('book-doctor-fee').textContent = `৳${doc.fee.toLocaleString()}`;
  document.getElementById('book-form').onsubmit = (e) => {
    e.preventDefault();
    const date = document.getElementById('book-date').value;
    const time = document.getElementById('book-time').value;
    if (!date || !time) { showToast('Please fill all fields', 'error'); return; }
    DB.bookAppointment(doctorId, user.id, user.name, date, time, doc.fee);
    closeModal('modal-booking');
    showToast('Appointment booked successfully! 🎉', 'success');
  };
  openModal('modal-booking');
  // Set min date to tomorrow
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  document.getElementById('book-date').min = tomorrow.toISOString().split('T')[0];
}

// ===== REVIEW =====
function handleReview(doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Please login to write a review', 'error'); openModal('modal-login'); return; }
  document.getElementById('review-form').onsubmit = (e) => {
    e.preventDefault();
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('review-comment').value.trim();
    if (!rating) { showToast('Please select a rating', 'error'); return; }
    if (!comment) { showToast('Please write a comment', 'error'); return; }
    const result = DB.addReview(doctorId, user.id, user.name, rating, comment);
    if (result.error) { showToast(result.error, 'error'); return; }
    closeModal('modal-review');
    showToast('Review submitted! Thank you 🌟', 'success');
    if (document.getElementById('page-doctor-profile').classList.contains('active')) {
      renderDoctorProfile(doctorId);
    }
    document.getElementById('review-form').reset();
  };
  openModal('modal-review');
}

// ===== PATIENT DASHBOARD =====
function renderDashboard() {
  const user = DB.getSession();
  if (!user) { showPage('home'); return; }

  const appts = DB.getAppointmentsByPatient(user.id);
  const reviews = DB.getReviewsByPatient(user.id);

  document.getElementById('dash-welcome').textContent = `Welcome back, ${user.name.split(' ')[0]}! 👋`;
  document.getElementById('dash-appts-count').textContent = appts.length;
  document.getElementById('dash-reviews-count').textContent = reviews.length;

  // Appointments
  const apptContainer = document.getElementById('dash-appointments');
  if (apptContainer) {
    if (appts.length === 0) {
      apptContainer.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h3>No appointments yet</h3><p>Book your first appointment</p></div>`;
    } else {
      apptContainer.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Doctor</th><th>Specialty</th><th>Date</th><th>Time</th><th>Fee</th><th>Status</th></tr></thead>
        <tbody>${appts.map(a => {
          const doc = DB.getDoctorById(a.doctorId);
          return `<tr>
            <td>${doc ? doc.name : 'Unknown'}</td>
            <td>${doc ? doc.specialty : '—'}</td>
            <td>${a.date}</td><td>${a.time}</td>
            <td>৳${a.fee.toLocaleString()}</td>
            <td><span class="status-badge ${a.status}">${a.status}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    }
  }

  // Reviews
  const revContainer = document.getElementById('dash-reviews');
  if (revContainer) {
    if (reviews.length === 0) {
      revContainer.innerHTML = `<div class="empty-state"><div class="icon">✍️</div><h3>No reviews yet</h3><p>Share your experience with doctors</p></div>`;
    } else {
      revContainer.innerHTML = reviews.map(r => {
        const doc = DB.getDoctorById(r.doctorId);
        return `<div class="review-card">
          <div class="review-top">
            <div><div class="reviewer-name">${doc ? doc.name : 'Doctor'}</div><div class="review-date">${r.date}</div></div>
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          </div>
          <p class="review-comment">${r.comment}</p>
        </div>`;
      }).join('');
    }
  }
}

// ===== ADMIN PANEL =====
function renderAdmin() {
  const user = DB.getSession();
  if (!user || user.role !== 'admin') { showPage('home'); return; }

  const stats = DB.getStats();
  document.getElementById('admin-total-doctors').textContent = stats.totalDoctors;
  document.getElementById('admin-total-patients').textContent = stats.totalPatients;
  document.getElementById('admin-total-reviews').textContent = stats.totalReviews;
  document.getElementById('admin-total-appts').textContent = stats.totalAppointments;

  renderAdminDoctors();
  renderAdminAppointments();
}

function renderAdminDoctors() {
  const container = document.getElementById('admin-doctors-list');
  if (!container) return;
  const doctors = DB.getAllDoctors();
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Specialty</th><th>Hospital</th><th>Rating</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${doctors.map(d => `<tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.specialty}</td>
      <td style="font-size:0.82rem">${d.hospital}</td>
      <td>⭐ ${d.rating} (${d.reviews})</td>
      <td>৳${d.fee.toLocaleString()}</td>
      <td><span class="status-badge ${d.available ? 'confirmed' : 'cancelled'}">${d.available ? 'Available' : 'Unavailable'}</span></td>
      <td><button onclick="adminDeleteDoctor(${d.id})" style="color:var(--danger);font-size:0.8rem;background:rgba(230,57,70,0.1);padding:4px 10px;border-radius:6px">Delete</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderAdminAppointments() {
  const container = document.getElementById('admin-appts-list');
  if (!container) return;
  const appts = DB.getAllAppointments();
  if (appts.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><h3>No appointments</h3></div>`; return; }
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${appts.map(a => {
      const doc = DB.getDoctorById(a.doctorId);
      return `<tr>
        <td>${a.patientName}</td>
        <td>${doc ? doc.name : '—'}</td>
        <td>${a.date}</td><td>${a.time}</td>
        <td>৳${a.fee.toLocaleString()}</td>
        <td><span class="status-badge ${a.status}">${a.status}</span></td>
        <td style="display:flex;gap:6px">
          <button onclick="DB.updateAppointmentStatus(${a.id},'confirmed');renderAdmin();showToast('Confirmed!','success')" style="color:var(--success);font-size:0.8rem;background:rgba(82,183,136,0.1);padding:4px 10px;border-radius:6px">Confirm</button>
          <button onclick="DB.updateAppointmentStatus(${a.id},'cancelled');renderAdmin();showToast('Cancelled','info')" style="color:var(--danger);font-size:0.8rem;background:rgba(230,57,70,0.1);padding:4px 10px;border-radius:6px">Cancel</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function adminDeleteDoctor(id) {
  if (!confirm('Delete this doctor?')) return;
  DB.deleteDoctor(id);
  renderAdmin();
  showToast('Doctor removed', 'info');
}

function openAddDoctorModal() {
  document.getElementById('add-doctor-form').onsubmit = (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('add-name').value,
      specialty: document.getElementById('add-specialty').value,
      hospital: document.getElementById('add-hospital').value,
      experience: parseInt(document.getElementById('add-exp').value),
      fee: parseInt(document.getElementById('add-fee').value),
      about: document.getElementById('add-about').value,
    };
    DB.addDoctor(data);
    closeModal('modal-add-doctor');
    renderAdmin();
    showToast('Doctor added successfully!', 'success');
    e.target.reset();
  };
  openModal('modal-add-doctor');
}

// ===== AUTH =====
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const user = DB.findUser(email, password);
  if (!user) { showToast('Invalid email or password', 'error'); return; }
  DB.setSession(user);
  closeModal('modal-login');
  renderNavbar();
  showToast(`Welcome back, ${user.name.split(' ')[0]}! 👋`, 'success');
  if (user.role === 'admin') showPage('admin');
  else showPage('dashboard');
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  const result = DB.registerUser(name, email, password);
  if (result.error) { showToast(result.error, 'error'); return; }
  DB.setSession(result.user);
  closeModal('modal-register');
  renderNavbar();
  showToast(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`, 'success');
  showPage('dashboard');
}

function logout() {
  DB.clearSession();
  renderNavbar();
  showPage('home');
  showToast('Logged out successfully', 'info');
}

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}
// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== TABS =====
function switchTab(tabId, btn) {
  const tabsContainer = btn.closest('.tabs').parentElement;
  tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tabsContainer.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  tabsContainer.querySelector('#' + tabId)?.classList.add('active');
}
