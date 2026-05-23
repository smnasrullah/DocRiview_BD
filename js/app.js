'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  BD_DATA.init();
  await DB.init();
  renderNavbar();
  await updateHeroStats();
  showPage('home');
  initDegreeBuilder();
});

function setEl(id, val) {
  const e = document.getElementById(id);
  if (e) e.textContent = val;
}

async function updateHeroStats() {
  const s = await DB.getStats();
  setEl('stat-visits',   (s.totalVisits  || 0).toLocaleString());
  setEl('stat-doctors',  (s.totalDoctors || 0).toLocaleString());
  setEl('stat-patients', (s.totalPatients|| 0).toLocaleString());
}

function showPage(page, data = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) { el.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  if (page === 'home')              { renderFeaturedDoctors(); updateHeroStats(); renderSpecialistSections(); }
  if (page === 'doctors')           renderDoctorsPage(data);
  if (page === 'doctor-profile')    renderDoctorProfile(data.id);
  if (page === 'patient-dashboard') renderPatientDashboard();
  if (page === 'doctor-dashboard')  renderDoctorDashboard();
  if (page === 'profile')           renderProfilePage();
  if (page === 'settings')          renderSettingsPage();
  if (page === 'admin')             renderAdmin();
}

// ── Navbar ────────────────────────────────────────────────────

function renderNavbar() {
  const user = DB.getSession();
  const nav  = document.getElementById('nav-user-area');
  if (!nav) return;

  if (user) {
    const pic = user.profilePic
      ? `<img src="${user.profilePic}" class="nav-avatar-img" onclick="toggleDropdown()">`
      : `<button class="avatar-btn" onclick="toggleDropdown()" title="${user.name}">${user.avatar}</button>`;
    const dashPage = user.role === 'admin' ? 'admin' : user.role === 'doctor' ? 'doctor-dashboard' : 'patient-dashboard';
    nav.innerHTML = `
      <button class="nav-link" onclick="showPage('${dashPage}')">Dashboard</button>
      <div class="user-dropdown">
        ${pic}
        <div class="dropdown-menu" id="user-dropdown-menu">
          <div class="dropdown-header">
            <strong>${user.name}</strong>
            <span class="role-badge">${user.role === 'doctor' ? '👨‍⚕️' : user.role === 'admin' ? '⚙️' : '🧑‍🤒'}</span>
          </div>
          <button onclick="showPage('profile');closeDropdown()">👤 Profile</button>
          <button onclick="showPage('settings');closeDropdown()">⚙️ Settings</button>
          <button onclick="logout();closeDropdown()" class="danger-btn">🚪 Logout</button>
        </div>
      </div>`;
  } else {
    nav.innerHTML = `
      <button class="nav-btn outline" onclick="openModal('modal-login')">Login</button>
      <button class="nav-btn" onclick="openModal('modal-reg-choice')">Sign Up</button>`;
  }
}

function toggleDropdown() { document.getElementById('user-dropdown-menu')?.classList.toggle('open'); }
function closeDropdown()  { document.getElementById('user-dropdown-menu')?.classList.remove('open'); }

document.addEventListener('click', e => {
  if (!e.target.closest('.user-dropdown') &&
      !e.target.closest('.avatar-btn') &&
      !e.target.closest('.nav-avatar-img')) closeDropdown();
});

// ── Home ─────────────────────────────────────────────────────

async function renderFeaturedDoctors() {
  const c = document.getElementById('featured-doctors');
  if (!c) return;
  const all = await DB.getAllDoctors();
  const top = all.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
  c.innerHTML = top.map(d => doctorCardHTML(d)).join('');
}

async function renderSpecialistSections() {
  const container = document.getElementById('specialist-sections');
  if (!container) return;
  const all = await DB.getAllDoctors();
  if (!all.length) { container.innerHTML = ''; return; }

  const groups = {};
  all.forEach(d => {
    if (!groups[d.specialty]) groups[d.specialty] = [];
    groups[d.specialty].push(d);
  });

  container.innerHTML = Object.entries(groups).map(([specialty, docs]) => {
    const top3 = docs.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    return `
      <div class="specialist-section">
        <div class="section-header">
          <h2 class="section-title">${specialtyIcon(specialty)} <span>${specialty}</span></h2>
          <button class="view-all" onclick="filterDoctors('${specialty.replace(/'/g, "\\'")}');showPage('doctors')">সব দেখুন →</button>
        </div>
        <div class="doctors-grid">${top3.map(d => doctorCardHTML(d)).join('')}</div>
      </div>`;
  }).join('');
}

function specialtyIcon(specialty) {
  const map = {
    'Cardiologist': '❤️', 'Dermatologist': '🧴', 'Orthopedic': '🦴',
    'Gynecologist': '👩‍⚕️', 'Neurologist': '🧠', 'Pediatrician': '👶',
    'General Physician': '🩺', 'ENT': '👂', 'Ophthalmologist': '👁️',
    'Psychiatrist': '🧘', 'Gastroenterologist': '🫁', 'Urologist': '🔬',
    'Oncologist': '🎗️', 'Endocrinologist': '⚗️', 'Nephrologist': '🫘',
    'Pulmonologist': '🫁', 'Rheumatologist': '🦵', 'Hematologist': '🩸',
    'Radiologist': '📡', 'Surgeon': '🔪', 'Pathologist': '🔭',
  };
  for (const key of Object.keys(map)) {
    if (specialty.toLowerCase().includes(key.toLowerCase())) return map[key];
  }
  return '🏥';
}

function doctorCardHTML(d) {
  const stars     = '★'.repeat(Math.round(d.rating || 0)) + '☆'.repeat(5 - Math.round(d.rating || 0));
  const initials  = d.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarHTML = d.profilePic
    ? `<img src="${d.profilePic}" class="card-avatar-img">`
    : `<div class="doc-avatar">${initials}</div>`;
  const degreeStr = Array.isArray(d.degrees) && d.degrees.length
    ? d.degrees.map(dg => dg.degree).join(', ')
    : (d.degree || '');
  const bmdcBadge = d.bmdcSuspended
    ? `<span class="bmdc-badge suspended">🚫 BMDC Suspended</span>`
    : d.bmdcVerified
      ? `<span class="bmdc-badge verified">✅ BMDC Verified</span>`
      : `<span class="bmdc-badge unverified">⚠️ Unverified</span>`;

  return `
    <div class="doctor-card" onclick="showPage('doctor-profile',{id:${d.id}})">
      <div class="card-header">
        ${avatarHTML}
        <div class="doc-name">${d.name}</div>
        <div class="doc-specialty">${d.specialty}</div>
        ${bmdcBadge}
        <div class="available-badge ${d.available ? 'yes' : 'no'}">${d.available ? '● Available' : '● Unavailable'}</div>
      </div>
      <div class="card-body">
        <div class="doc-info">
          <div class="doc-info-row"><span class="icon">🏥</span>${d.hospital}</div>
          <div class="doc-info-row"><span class="icon">🎓</span>${degreeStr}</div>
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
          <button class="book-btn" onclick="event.stopPropagation();showPage('doctor-profile',{id:${d.id}})">বিস্তারিত →</button>
        </div>
      </div>
    </div>`;
}

// ── Doctors page ──────────────────────────────────────────────

let currentSpecialty = '', currentDistrict = '', currentSort = 'rating';

async function renderDoctorsPage(data = {}) {
  const container = document.getElementById('doctors-list');
  if (!container) return;
  if (data.specialty !== undefined) currentSpecialty = data.specialty;
  if (data.district  !== undefined) currentDistrict  = data.district;
  if (data.sort      !== undefined) currentSort       = data.sort;
  const query = data.query !== undefined ? data.query : (document.getElementById('search-input-2')?.value || '');

  const allDocs = await DB.getAllDoctors();
  const pillsEl = document.getElementById('specialty-pills');
  if (pillsEl) {
    const specs = [...new Set(allDocs.map(d => d.specialty))];
    pillsEl.innerHTML =
      `<button class="pill ${!currentSpecialty ? 'active' : ''}" onclick="filterDoctors('')">সব</button>` +
      specs.map(s => `<button class="pill ${currentSpecialty === s ? 'active' : ''}" onclick="filterDoctors('${s.replace(/'/g, "\\'")}'">${s}</button>`).join('');
  }
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === currentSort));

  const docs = await DB.searchDoctors(query, currentSpecialty, currentDistrict, currentSort);
  container.innerHTML = docs.length
    ? docs.map(d => doctorCardHTML(d)).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔍</div><h3>কোনো ডাক্তার পাওয়া যায়নি</h3></div>`;
}

function filterDoctors(s) { renderDoctorsPage({ specialty: s }); }
function sortDoctors(s)   { renderDoctorsPage({ sort: s }); }
function handleSearch() {
  showPage('doctors', {
    query:     document.getElementById('search-input')?.value || '',
    specialty: document.getElementById('search-specialty')?.value || '',
  });
}

// ── Doctor profile ────────────────────────────────────────────

async function renderDoctorProfile(id) {
  const doc = await DB.getDoctorById(id);
  if (!doc) return;
  const user      = DB.getSession();
  const container = document.getElementById('doctor-profile-content');
  if (!container) return;

  const reviews   = await DB.getReviewsByDoctor(id);
  const stars     = '★'.repeat(Math.round(doc.rating || 0)) + '☆'.repeat(5 - Math.round(doc.rating || 0));
  const initials  = doc.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarHTML = doc.profilePic
    ? `<img src="${doc.profilePic}" class="profile-hero-img">`
    : `<div class="profile-avatar">${initials}</div>`;

  const canReview  = user && user.role === 'patient';
  const degreesHTML = Array.isArray(doc.degrees) && doc.degrees.length
    ? `<div class="degrees-list">${doc.degrees.map(dg => `
        <div class="degree-chip">
          <strong>${dg.degree}</strong>
          <span>${dg.subject ? `— ${dg.subject}` : ''}</span>
          <span class="deg-inst">${dg.institution}${dg.year ? `, ${dg.year}` : ''}</span>
        </div>`).join('')}</div>`
    : `<p style="color:var(--gray-400);font-size:0.9rem">—</p>`;

  const bmdcBadge = doc.bmdcSuspended
    ? `<span class="bmdc-badge suspended">🚫 BMDC Suspended</span>`
    : doc.bmdcVerified
      ? `<span class="bmdc-badge verified">✅ BMDC Verified</span>`
      : `<span class="bmdc-badge unverified">⚠️ Unverified</span>`;

  let myDocId = null;
  if (user && user.role === 'doctor') {
    const myDoc = await DB.getDoctorByUserId(user.id);
    myDocId = myDoc?.id;
  }

  const reviewsHTML = reviews.length === 0
    ? `<div class="empty-state"><div class="icon">💬</div><h3>এখনো কোনো review নেই</h3><p>${canReview ? 'প্রথম review লিখুন!' : ''}</p></div>`
    : reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
        const verBadge = r.verificationStatus === 'verified'
          ? `<span class="ver-badge verified">✅ Verified Visit</span>`
          : r.verificationStatus === 'fake' || r.verificationStatus === 'flagged'
            ? `<span class="ver-badge fake">⚠️ Unverified</span>`
            : `<span class="ver-badge pending">🕐 Pending</span>`;

        const repliesHTML = (r.replies || []).map(rep => `
          <div class="reply-card ${rep.authorRole === 'doctor' ? 'doctor-reply' : ''}">
            <div class="reply-meta">
              <strong>${rep.authorRole === 'doctor' ? '👨‍⚕️ ' + rep.authorName : rep.authorName}</strong>
              <span class="reply-date">${rep.date}</span>
            </div>
            <p>${rep.text}</p>
          </div>`).join('');

        const canReply = user && (
          (user.role === 'doctor' && myDocId === parseInt(id)) ||
          user.role === 'patient'
        );
        const replyBtn = canReply
          ? `<button class="reply-btn" onclick="openReplyModal(${r.id}, ${id})">↩️ Reply</button>` : '';

        return `
          <div class="review-card">
            <div class="review-top">
              <div class="reviewer-info">
                <div class="reviewer-avatar">${r.patientName.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                <div>
                  <div class="reviewer-name">${r.patientName}</div>
                  <div class="review-date">${r.date}</div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                ${verBadge}
              </div>
            </div>
            <p class="review-comment">${r.comment}</p>
            <div class="review-actions">
              <button class="helpful-btn" onclick="markHelpfulAndRefresh(${r.id},${id})">👍 Helpful (${r.helpful})</button>
              ${replyBtn}
            </div>
            ${repliesHTML ? `<div class="replies-section">${repliesHTML}</div>` : ''}
          </div>`;
      }).join('');

  container.innerHTML = `
    <div class="profile-hero">
      <div style="max-width:1100px;margin:0 auto">
        <button onclick="showPage('doctors')" class="back-btn">← সব ডাক্তার</button>
        <div class="profile-main">
          ${avatarHTML}
          <div class="profile-info">
            <h1>${doc.name}</h1>
            <div class="specialty">${doc.specialty}${doc.drType ? ` · <em>${doc.drType}</em>` : ''}</div>
            ${bmdcBadge}
            <div class="profile-meta">
              <div class="meta-item"><span class="icon">🆔</span>BMDC: ${doc.bmdc || 'N/A'}</div>
              <div class="meta-item"><span class="icon">🏥</span>${doc.hospital}</div>
              <div class="meta-item"><span class="icon">⏱️</span>${doc.experience} বছর অভিজ্ঞতা</div>
              <div class="meta-item"><span class="icon">⭐</span>${doc.rating || 0} (${doc.reviews} reviews)</div>
              <div class="meta-item"><span class="icon">📍</span>${doc.district || ''}</div>
              <div class="meta-item"><span class="icon">📞</span>${doc.phone || ''}</div>
              ${doc.languages ? `<div class="meta-item"><span class="icon">🗣️</span>${doc.languages}</div>` : ''}
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
            <p style="font-size:0.92rem;color:var(--gray-600);line-height:1.8">${doc.about || '—'}</p>
          </div>
          <div class="profile-card" style="margin-bottom:20px">
            <h3>🎓 একাডেমিক যোগ্যতা</h3>
            ${degreesHTML}
          </div>
          <div class="profile-card" style="margin-bottom:20px">
            <h3>চেম্বার ও Visit তথ্য</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="doc-info-row"><span class="icon">🏥</span><span>${doc.chamber || doc.hospital}</span></div>
              ${doc.visitLocation ? `<div class="doc-info-row"><span class="icon">📌</span><span>${doc.visitLocation}</span></div>` : ''}
              ${doc.visitDays     ? `<div class="doc-info-row"><span class="icon">📅</span><span>${doc.visitDays}</span></div>`     : ''}
              ${Array.isArray(doc.visitHours) && doc.visitHours.length
                ? `<div class="doc-info-row"><span class="icon">⏰</span><span>${doc.visitHours.join(', ')}</span></div>`
                : doc.chamberTime ? `<div class="doc-info-row"><span class="icon">⏰</span><span>${doc.chamberTime}</span></div>` : ''}
              ${doc.medicalCollege ? `<div class="doc-info-row"><span class="icon">🎓</span><span>${doc.medicalCollege}</span></div>` : ''}
            </div>
          </div>
          <div class="profile-card">
            <h3>রোগীদের মতামত (${reviews.length})</h3>
            <div class="reviews-list">${reviewsHTML}</div>
            ${canReview ? `<div style="margin-top:18px"><button class="btn-primary" onclick="handleReview(${doc.id})" style="font-size:0.9rem;padding:10px 22px">✍️ Review লিখুন</button></div>` : ''}
            ${!user ? `<div style="margin-top:14px;font-size:0.85rem;color:var(--gray-400)">Review দিতে <a onclick="openModal('modal-login')" style="color:var(--teal);cursor:pointer;font-weight:600">login করুন</a></div>` : ''}
          </div>
        </div>
        <div>
          <div class="profile-card" style="text-align:center;margin-bottom:20px">
            <div style="font-size:3rem;font-weight:800;color:var(--navy);font-family:var(--font-head)">${doc.rating || '—'}</div>
            <div style="color:var(--accent);font-size:1.4rem;margin:4px 0">${stars}</div>
            <div style="font-size:0.82rem;color:var(--gray-400)">${doc.reviews} reviews</div>
          </div>
          <div class="profile-card">
            <h3>💰 Visit Fee</h3>
            <div style="font-size:1.8rem;font-weight:800;color:var(--teal);font-family:var(--font-head)">৳${(doc.fee || 0).toLocaleString()}</div>
            <div style="font-size:0.8rem;color:var(--gray-400);margin-top:4px">প্রতি visit</div>
          </div>
        </div>
      </div>
    </div>`;
}

async function markHelpfulAndRefresh(reviewId, doctorId) {
  await DB.markHelpful(reviewId);
  renderDoctorProfile(doctorId);
  showToast('Helpful mark হয়েছে!', 'success');
}

// ── Review ────────────────────────────────────────────────────

function handleReview(doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Review দিতে আগে login করুন', 'error'); openModal('modal-login'); return; }
  if (user.role !== 'patient') { showToast('শুধুমাত্র রোগীরা review দিতে পারবেন', 'error'); return; }

  document.getElementById('review-form').onsubmit = async e => {
    e.preventDefault();
    const rating  = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('review-comment').value.trim();
    if (!rating)  { showToast('Rating দিন', 'error'); return; }
    if (!comment) { showToast('Review লিখুন', 'error'); return; }

    const fileInput = document.getElementById('review-file');
    let fileData = null;
    if (fileInput?.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) { showToast('File size ৫MB-এর বেশি হবে না', 'error'); return; }
      fileData = await new Promise(res => {
        const r = new FileReader();
        r.onload = ev => res({ data: ev.target.result, name: file.name, type: file.type });
        r.readAsDataURL(file);
      });
    }
    const result = await DB.addReview(doctorId, user.id, user.name, rating, comment, fileData);
    if (result.error) { showToast(result.error, 'error'); closeModal('modal-review'); return; }
    closeModal('modal-review');
    document.getElementById('review-form').reset();
    showToast(`Review সফলভাবে দেওয়া হয়েছে! 🌟 (এই মাসে আর ${result.remaining} টি বাকি)`, 'success');
    if (document.getElementById('page-doctor-profile').classList.contains('active')) renderDoctorProfile(doctorId);
  };
  openModal('modal-review');
}

function openReplyModal(reviewId, doctorId) {
  const user = DB.getSession();
  if (!user) { showToast('Reply দিতে login করুন', 'error'); return; }

  document.getElementById('reply-form').onsubmit = async e => {
    e.preventDefault();
    const text = document.getElementById('reply-text').value.trim();
    if (!text) { showToast('Reply লিখুন', 'error'); return; }
    await DB.addReply(reviewId, user.id, user.name, user.role, text);
    closeModal('modal-reply');
    document.getElementById('reply-form').reset();
    renderDoctorProfile(doctorId);
    showToast('Reply দেওয়া হয়েছে!', 'success');
  };
  openModal('modal-reply');
}

// ── Patient dashboard ─────────────────────────────────────────

async function renderPatientDashboard() {
  const user = DB.getSession();
  if (!user || user.role !== 'patient') { showPage('home'); return; }

  setEl('patient-dash-name',  user.name.split(' ')[0]);
  setEl('patient-dash-name2', user.name.split(' ')[0]);

  const { reviews, remaining } = await _http.get('/users/me/reviews')
    .then(d => d._error ? { reviews: [], remaining: 20 } : d)
    .catch(()  => ({ reviews: [], remaining: 20 }));

  setEl('patient-dash-reviews',      (reviews || []).length);
  setEl('patient-review-remaining',  remaining >= 0 ? remaining : 0);

  const picEl = document.getElementById('patient-dash-pic');
  if (picEl) picEl.innerHTML = user.profilePic
    ? `<img src="${user.profilePic}" class="dash-avatar-img">`
    : `<div class="dash-avatar">${user.avatar}</div>`;

  const infoEl = document.getElementById('patient-info-list');
  if (infoEl) infoEl.innerHTML = `
    <div class="info-row"><span>📧 Email</span><span>${user.email}</span></div>
    <div class="info-row"><span>📞 Phone</span><span>${user.phone || '—'}</span></div>
    <div class="info-row"><span>🩸 Blood Group</span><span>${user.bloodGroup || '—'}</span></div>
    <div class="info-row"><span>🎂 বয়স</span><span>${user.age || '—'}</span></div>
    <div class="info-row"><span>⚧️ লিঙ্গ</span><span>${user.gender || '—'}</span></div>
    <div class="info-row"><span>📍 ঠিকানা</span><span>${user.address || '—'}</span></div>
    <div class="info-row"><span>📅 যোগ দিয়েছেন</span><span>${user.joined}</span></div>`;

  const revEl = document.getElementById('patient-reviews-list');
  if (revEl) {
    const all = reviews || [];
    if (all.length) {
      const docsArr = await Promise.all([...new Set(all.map(r => r.doctorId))].map(id => DB.getDoctorById(id)));
      const docsMap = {};
      docsArr.forEach(d => { if (d) docsMap[d.id] = d; });
      revEl.innerHTML = all.map(r => `
        <div class="review-card">
          <div class="review-top">
            <div onclick="showPage('doctor-profile',{id:${r.doctorId}})" style="cursor:pointer">
              <div class="reviewer-name" style="color:var(--teal)">${docsMap[r.doctorId]?.name || '—'}</div>
              <div class="review-date">${r.date}</div>
            </div>
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          </div>
          <p class="review-comment">${r.comment}</p>
        </div>`).join('');
    } else {
      revEl.innerHTML = `<div class="empty-state"><div class="icon">✍️</div><h3>কোনো review নেই</h3><p>ডাক্তার দেখুন ও review দিন</p></div>`;
    }
  }
}

// ── Doctor dashboard ──────────────────────────────────────────

async function renderDoctorDashboard() {
  const user = DB.getSession();
  if (!user || user.role !== 'doctor') { showPage('home'); return; }

  const doc = await DB.getDoctorByUserId(user.id);
  setEl('doctor-dash-name', user.name);

  const picEl = document.getElementById('doctor-dash-pic');
  if (picEl) picEl.innerHTML = (doc?.profilePic || user.profilePic)
    ? `<img src="${doc?.profilePic || user.profilePic}" class="dash-avatar-img">`
    : `<div class="dash-avatar">${user.avatar}</div>`;

  if (!doc) return;
  setEl('doctor-dash-specialty',     doc.specialty);
  setEl('doctor-dash-bmdc',          doc.bmdc || '—');
  setEl('doctor-dash-rating',        `${doc.rating || 0} ⭐`);
  setEl('doctor-dash-reviews-count', doc.reviews);

  const reviews = await DB.getReviewsByDoctor(doc.id);
  const revEl   = document.getElementById('doctor-reviews-received');
  if (revEl) {
    revEl.innerHTML = reviews.length
      ? reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
          const verBadge = r.verificationStatus === 'verified'
            ? `<span class="ver-badge verified">✅ Verified</span>`
            : r.verificationStatus === 'fake' || r.verificationStatus === 'flagged'
              ? `<span class="ver-badge fake">⚠️ Unverified</span>`
              : `<span class="ver-badge pending">🕐 Pending</span>`;
          const repliesHTML = (r.replies || []).map(rep => `
            <div class="reply-card ${rep.authorRole === 'doctor' ? 'doctor-reply' : ''}">
              <strong>${rep.authorRole === 'doctor' ? '👨‍⚕️ আপনি' : rep.authorName}</strong>: ${rep.text}
              <span class="reply-date">${rep.date}</span>
            </div>`).join('');
          return `
            <div class="review-card">
              <div class="review-top">
                <div class="reviewer-info">
                  <div class="reviewer-avatar">${r.patientName.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                  <div><div class="reviewer-name">${r.patientName}</div><div class="review-date">${r.date}</div></div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                  ${verBadge}
                </div>
              </div>
              <p class="review-comment">${r.comment}</p>
              ${repliesHTML ? `<div class="replies-section">${repliesHTML}</div>` : ''}
              <button class="reply-btn" onclick="openReplyModal(${r.id}, ${doc.id})">↩️ Reply করুন</button>
            </div>`;
        }).join('')
      : `<div class="empty-state"><div class="icon">💬</div><h3>এখনো কোনো review পাননি</h3></div>`;
  }

  const infoEl = document.getElementById('doctor-info-list');
  if (infoEl) {
    const degStr = Array.isArray(doc.degrees)
      ? doc.degrees.map(d => `${d.degree} (${d.institution})`).join(', ')
      : (doc.degree || '—');
    infoEl.innerHTML = `
      <div class="info-row"><span>🏥 Hospital</span><span>${doc.hospital}</span></div>
      <div class="info-row"><span>🎓 Degree</span><span>${degStr}</span></div>
      <div class="info-row"><span>📅 Visit Days</span><span>${doc.visitDays || doc.chamberTime || '—'}</span></div>
      <div class="info-row"><span>📍 জেলা</span><span>${doc.district || '—'}</span></div>
      <div class="info-row"><span>💰 Fee</span><span>৳${(doc.fee || 0).toLocaleString()}</span></div>
      <div class="info-row"><span>📞 Phone</span><span>${doc.phone || '—'}</span></div>
      <div class="info-row"><span>📧 Email</span><span>${doc.email || '—'}</span></div>`;
  }
}

// ── Profile ───────────────────────────────────────────────────

async function renderProfilePage() {
  const user = DB.getSession();
  if (!user) { showPage('home'); return; }
  const isDoctor = user.role === 'doctor';
  const doc      = isDoctor ? await DB.getDoctorByUserId(user.id) : null;
  const el       = document.getElementById('profile-content');
  if (!el) return;

  const picHTML = user.profilePic
    ? `<img src="${user.profilePic}" class="profile-big-img">`
    : `<div class="profile-big-avatar">${user.avatar}</div>`;

  el.innerHTML = `
    <div class="profile-hero" style="padding:40px 5%">
      <div style="max-width:900px;margin:0 auto;display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="position:relative">
          ${picHTML}
          <label for="pic-upload" class="pic-upload-btn" title="ছবি পরিবর্তন করুন">📷
            <input type="file" id="pic-upload" accept="image/*" style="display:none" onchange="uploadProfilePic(this)">
          </label>
        </div>
        <div>
          <h1 style="font-family:var(--font-head);font-size:1.8rem;color:white;font-weight:800">${user.name}</h1>
          <div style="color:var(--teal-light);margin-top:4px">${user.role === 'doctor' ? '👨‍⚕️ ডাক্তার' : user.role === 'admin' ? '⚙️ Admin' : '🧑‍🤒 রোগী'}</div>
          <div style="color:var(--gray-400);font-size:0.85rem;margin-top:4px">যোগ দিয়েছেন: ${user.joined}</div>
        </div>
      </div>
    </div>
    <div style="max-width:900px;margin:0 auto;padding:32px 5%">
      <div class="profile-card">
        <h3>ব্যক্তিগত তথ্য</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="info-row"><span>📧 Email</span><span>${user.email}</span></div>
          ${user.phone      ? `<div class="info-row"><span>📞 Phone</span><span>${user.phone}</span></div>` : ''}
          ${user.gender     ? `<div class="info-row"><span>⚧️ লিঙ্গ</span><span>${user.gender}</span></div>` : ''}
          ${user.age        ? `<div class="info-row"><span>🎂 বয়স</span><span>${user.age} বছর</span></div>` : ''}
          ${user.bloodGroup ? `<div class="info-row"><span>🩸 Blood Group</span><span>${user.bloodGroup}</span></div>` : ''}
          ${user.address    ? `<div class="info-row"><span>📍 ঠিকানা</span><span>${user.address}</span></div>` : ''}
          ${isDoctor && doc ? `
            <div class="info-row"><span>🏥 Hospital</span><span>${doc.hospital}</span></div>
            <div class="info-row"><span>🆔 BMDC</span><span>${doc.bmdc}</span></div>
            <div class="info-row"><span>⭐ Rating</span><span>${doc.rating || 0} (${doc.reviews} reviews)</span></div>` : ''}
        </div>
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn-primary" onclick="showPage('settings')" style="font-size:0.9rem;padding:10px 22px">⚙️ Settings</button>
          <button onclick="logout()" class="btn-danger-sm">🚪 Logout</button>
        </div>
      </div>
    </div>`;
}

function uploadProfilePic(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('ছবির size ২MB-এর বেশি হবে না', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    const user = DB.getSession();
    await DB.setProfilePic(user.id, e.target.result);
    renderNavbar();
    renderProfilePage();
    showToast('Profile picture update হয়েছে! সবাই দেখতে পাবেন ✅', 'success');
  };
  reader.readAsDataURL(file);
}

// ── Settings ──────────────────────────────────────────────────

async function renderSettingsPage() {
  const user     = DB.getSession();
  if (!user) { showPage('home'); return; }
  const isDoctor = user.role === 'doctor';
  const doc      = isDoctor ? await DB.getDoctorByUserId(user.id) : null;
  const el       = document.getElementById('settings-content');
  if (!el) return;

  el.innerHTML = `
    <div style="max-width:700px;margin:0 auto">
      <div class="profile-card" style="margin-bottom:24px">
        <h3>👤 ব্যক্তিগত তথ্য পরিবর্তন</h3>
        <form onsubmit="saveBasicSettings(event)">
          <div class="form-group"><label>পূর্ণ নাম</label><input class="form-control" id="set-name" value="${user.name}"></div>
          <div class="form-group"><label>Email</label><input class="form-control" type="email" id="set-email" value="${user.email}"></div>
          ${user.role === 'patient' ? `
          <div class="form-row">
            <div class="form-group"><label>Phone</label><input class="form-control" id="set-phone" value="${user.phone || ''}"></div>
            <div class="form-group"><label>Blood Group</label>
              <select class="form-control" id="set-blood">
                ${['','A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => `<option ${user.bloodGroup === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>বয়স</label><input class="form-control" type="number" id="set-age" value="${user.age || ''}"></div>
            <div class="form-group"><label>লিঙ্গ</label>
              <select class="form-control" id="set-gender">
                ${['','Male','Female','Other'].map(g => `<option ${user.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group"><label>ঠিকানা</label><input class="form-control" id="set-address" value="${user.address || ''}"></div>` : ''}
          <button class="btn-full" type="submit">তথ্য save করুন</button>
        </form>
      </div>
      ${isDoctor && doc ? `
      <div class="profile-card" style="margin-bottom:24px">
        <h3>👨‍⚕️ Doctor Profile পরিবর্তন</h3>
        <form onsubmit="saveDoctorSettings(event)">
          <div class="form-group"><label>Hospital</label><input class="form-control" id="set-hospital" value="${doc.hospital || ''}"></div>
          <div class="form-group"><label>Chamber Address</label><input class="form-control" id="set-chamber" value="${doc.chamber || ''}"></div>
          <div class="form-group"><label>Visit Location</label>
            <select class="form-control" id="set-visit-location">
              ${['','সরকারি হাসপাতাল','বেসরকারি হাসপাতাল','ক্লিনিক','ডায়াগনস্টিক সেন্টার','নিজস্ব চেম্বার','অনলাইন (Telemedicine)']
                .map(v => `<option ${doc.visitLocation === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Visit Days</label><input class="form-control" id="set-visit-days" value="${doc.visitDays || ''}"></div>
          <div class="form-row">
            <div class="form-group"><label>জেলা</label>
              <select class="form-control" id="set-district">
                ${BD_DATA.DISTRICTS.map(d => `<option ${doc.district === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Visit Fee (৳)</label><input class="form-control" type="number" id="set-fee" value="${doc.fee || ''}"></div>
          </div>
          <div class="form-group"><label>অভিজ্ঞতা (বছর)</label><input class="form-control" type="number" id="set-exp" value="${doc.experience || ''}"></div>
          <div class="form-group"><label>About</label><textarea class="form-control" id="set-about" rows="3">${doc.about || ''}</textarea></div>
          <button class="btn-full" type="submit">Profile save করুন</button>
        </form>
      </div>` : ''}
      <div class="profile-card" style="margin-bottom:24px">
        <h3>🔑 Password পরিবর্তন</h3>
        <form onsubmit="changePassword(event)">
          <div class="form-row">
            <div class="form-group"><label>নতুন Password</label><input class="form-control" type="password" id="set-new-pass" placeholder="কমপক্ষে ৬ অক্ষর" required></div>
            <div class="form-group"><label>Confirm</label><input class="form-control" type="password" id="set-confirm-pass" placeholder="আবার দিন" required></div>
          </div>
          <button class="btn-full" type="submit">Password পরিবর্তন করুন</button>
        </form>
      </div>
      <div class="profile-card danger-zone">
        <h3 style="color:var(--danger)">⚠️ Danger Zone</h3>
        <p style="font-size:0.88rem;color:var(--gray-600);margin-bottom:16px">Account delete করলে সব তথ্য মুছে যাবে।</p>
        <button onclick="confirmDeleteAccount()" class="btn-danger-sm">🗑️ Account Delete করুন</button>
      </div>
    </div>`;
}

async function saveBasicSettings(e) {
  e.preventDefault();
  const user = DB.getSession();
  const data = { name: document.getElementById('set-name').value, email: document.getElementById('set-email').value };
  if (user.role === 'patient') {
    data.phone      = document.getElementById('set-phone')?.value   || '';
    data.bloodGroup = document.getElementById('set-blood')?.value   || '';
    data.age        = document.getElementById('set-age')?.value     || '';
    data.gender     = document.getElementById('set-gender')?.value  || '';
    data.address    = document.getElementById('set-address')?.value || '';
    data.avatar     = data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  const result = await DB.updateUser(user.id, data);
  if (result.error) { showToast(result.error, 'error'); return; }
  await DB.refreshSession(user.id);
  renderNavbar();
  showToast('তথ্য সফলভাবে save হয়েছে! ✅', 'success');
}

async function saveDoctorSettings(e) {
  e.preventDefault();
  const data = {
    hospital:      document.getElementById('set-hospital').value,
    chamber:       document.getElementById('set-chamber').value,
    visitLocation: document.getElementById('set-visit-location').value,
    visitDays:     document.getElementById('set-visit-days').value,
    district:      document.getElementById('set-district').value,
    fee:           parseInt(document.getElementById('set-fee').value)  || 0,
    experience:    parseInt(document.getElementById('set-exp').value)  || 0,
    about:         document.getElementById('set-about').value,
  };
  const result = await DB.updateDoctorProfile(DB.getSession().id, data);
  if (result.error) { showToast(result.error, 'error'); return; }
  showToast('Doctor profile save হয়েছে! ✅', 'success');
}

async function changePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById('set-new-pass').value;
  const confirm = document.getElementById('set-confirm-pass').value;
  if (newPass.length < 6)    { showToast('কমপক্ষে ৬ অক্ষরের password দিন', 'error'); return; }
  if (newPass !== confirm)   { showToast('Password দুটো মিলছে না', 'error'); return; }
  const result = await DB.changePassword(newPass);
  if (result._error) { showToast(result._error, 'error'); return; }
  ['set-new-pass','set-confirm-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  showToast('Password পরিবর্তন হয়েছে! ✅', 'success');
}

async function confirmDeleteAccount() {
  if (!confirm('সত্যিই কি account delete করতে চান? এই কাজ পূর্বাবস্থায় ফেরানো যাবে না।')) return;
  if (!confirm('আরেকবার নিশ্চিত করুন — account delete হয়ে যাবে।')) return;
  await DB.deleteAccount(DB.getSession().id);
  renderNavbar();
  showPage('home');
  showToast('Account সফলভাবে delete করা হয়েছে', 'info');
}

// ── Admin ─────────────────────────────────────────────────────

async function renderAdmin() {
  const user = DB.getSession();
  if (!user || user.role !== 'admin') { showPage('home'); return; }

  const s = await DB.getStats();
  setEl('admin-total-doctors',  s.totalDoctors);
  setEl('admin-total-patients', s.totalPatients);
  setEl('admin-total-reviews',  s.totalReviews);
  setEl('admin-total-visits',   (s.totalVisits || 0).toLocaleString());
  setEl('admin-pending-reviews',s.pendingReviews);

  renderAdminDoctors();
  renderAdminUsers();
  renderAdminReviews();
  renderAdminBmdc();
}

async function renderAdminDoctors() {
  const el = document.getElementById('admin-doctors-list');
  if (!el) return;
  const docs = await DB.getAllDoctors();
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>নাম</th><th>Specialty</th><th>BMDC</th><th>Status</th><th>Rating</th><th>Fee</th><th>Action</th></tr></thead>
    <tbody>${docs.map(d => `<tr>
      <td><strong>${d.name}</strong><div style="font-size:0.76rem;color:var(--gray-400)">${Array.isArray(d.degrees) ? d.degrees.map(x => x.degree).join(', ') : (d.degree || '')}</div></td>
      <td>${d.specialty}</td>
      <td style="font-family:monospace;font-size:0.82rem">${d.bmdc || '—'}</td>
      <td>${d.bmdcSuspended ? '<span class="status-badge cancelled">🚫 Suspended</span>' : '<span class="status-badge confirmed">✅ Active</span>'}</td>
      <td>⭐ ${d.rating} (${d.reviews})</td>
      <td>৳${(d.fee || 0).toLocaleString()}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        <button onclick="adminDeleteDoctor(${d.id})" class="admin-btn-danger">Delete</button>
        ${d.bmdcSuspended
          ? `<button onclick="adminReinstateBmdc('${d.bmdc}')" class="admin-btn-success">Reinstate</button>`
          : `<button onclick="adminRevokeBmdc('${d.bmdc}')" class="admin-btn-warn">Revoke BMDC</button>`}
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function renderAdminUsers() {
  const el = document.getElementById('admin-users-list');
  if (!el) return;
  const users = (await DB.getAll('users')).filter(u => u.role !== 'admin');
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>নাম</th><th>Role</th><th>Email</th><th>Status</th><th>কারণ</th><th>Action</th></tr></thead>
    <tbody>${users.map(u => `<tr>
      <td><strong>${u.name}</strong></td>
      <td><span class="status-badge ${u.role === 'doctor' ? 'confirmed' : 'pending'}">${u.role === 'doctor' ? '👨‍⚕️ Doctor' : '🧑‍🤒 Patient'}</span></td>
      <td style="font-size:0.82rem">${u.email}</td>
      <td><span class="status-badge ${u.banned ? 'cancelled' : 'confirmed'}">${u.banned ? '🚫 Banned' : '✅ Active'}</span></td>
      <td style="font-size:0.78rem;color:var(--gray-400)">${u.banReason === 'bmdc_revoked' ? '🆔 BMDC Revoked' : u.banReason === 'monthly_review_limit' ? '📊 Review Limit' : u.banned ? '⚙️ Admin' : '—'}</td>
      <td style="display:flex;gap:4px">
        ${u.banned
          ? `<button onclick="adminUnbanUser(${u.id})" class="admin-btn-success">Unban</button>`
          : `<button onclick="adminBanUser(${u.id})" class="admin-btn-danger">Ban</button>`}
        <button onclick="confirmAdminDeleteUser(${u.id})" class="admin-btn-warn">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function renderAdminReviews() {
  const el = document.getElementById('admin-reviews-list');
  if (!el) return;
  const reviews = await DB.getAll('reviews');
  reviews.sort((a, b) => ({ pending: 0, verified: 1, fake: 2, flagged: 2 }[a.verificationStatus] || 1) - ({ pending: 0, verified: 1, fake: 2, flagged: 2 }[b.verificationStatus] || 1));

  const docsArr = await Promise.all([...new Set(reviews.map(r => r.doctorId))].map(id => DB.getDoctorById(id)));
  const docsMap = {};
  docsArr.forEach(d => { if (d) docsMap[d.id] = d; });

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>রোগী</th><th>ডাক্তার</th><th>Rating</th><th>Comment</th><th>File</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${reviews.map(r => `<tr>
      <td><strong>${r.patientName}</strong><div style="font-size:0.75rem;color:var(--gray-400)">${r.date}</div></td>
      <td>${docsMap[r.doctorId]?.name || '—'}</td>
      <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
      <td style="font-size:0.82rem;max-width:180px;white-space:normal">${(r.comment || '').slice(0, 80)}${(r.comment || '').length > 80 ? '...' : ''}</td>
      <td>${r.fileRef ? `<button onclick="adminViewFile(${r.id})" class="admin-btn-info">📎 দেখুন</button>` : '<span style="color:var(--gray-400);font-size:0.8rem">নেই</span>'}</td>
      <td>${r.verificationStatus === 'verified' ? '<span class="ver-badge verified">✅ Verified</span>' : (r.verificationStatus === 'fake' || r.verificationStatus === 'flagged') ? '<span class="ver-badge fake">⚠️ Unverified</span>' : '<span class="ver-badge pending">🕐 Pending</span>'}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${r.verificationStatus !== 'verified' ? `<button onclick="setReviewStatus(${r.id},'verified')" class="admin-btn-success">✅</button>` : ''}
        ${r.verificationStatus !== 'fake' && r.verificationStatus !== 'flagged' ? `<button onclick="setReviewStatus(${r.id},'fake')" class="admin-btn-warn">⚠️</button>` : ''}
        <button onclick="adminDeleteReview(${r.id})" class="admin-btn-danger">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function renderAdminBmdc() {
  const el = document.getElementById('admin-bmdc-section');
  if (!el) return;
  const info    = await DB.getBmdcSyncInfo();
  const revoked = await DB.getRevokedBmdcList();

  el.innerHTML = `
    <div class="profile-card" style="margin-bottom:16px">
      <h3>🔄 BMDC Auto-Sync</h3>
      <p style="font-size:0.85rem;color:var(--gray-600);margin-bottom:12px">
        প্রতিদিন automatically BMDC status check হয়। Revoked BMDC-র ডাক্তারের account suspend হয়।<br>
        <em style="color:var(--gray-400);font-size:0.8rem">বাস্তবে Government BMDC API-র সাথে connect করতে হবে।</em>
      </p>
      <div class="info-row"><span>⏱️ শেষ sync</span><span>${info.lastSync}</span></div>
      <div class="info-row"><span>🚫 Revoked BMDC</span><span>${info.revokedCount} টি</span></div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button onclick="adminRunSync()" class="btn-primary" style="font-size:0.85rem;padding:8px 18px">🔄 এখনই Sync করুন</button>
        <button onclick="adminRevokeBmdcPrompt()" class="admin-btn-warn">🚫 BMDC Revoke করুন</button>
      </div>
    </div>
    ${revoked.length ? `
    <div class="profile-card">
      <h3>Revoked BMDC তালিকা</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>BMDC No.</th><th>Action</th></tr></thead>
        <tbody>${revoked.map(b => `<tr>
          <td style="font-family:monospace">${b}</td>
          <td><button onclick="adminReinstateBmdc('${b}')" class="admin-btn-success">Reinstate</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}`;
}

async function adminRunSync()           { const r = await DB.runBmdcSync(); renderAdmin(); showToast(`BMDC Sync সম্পন্ন! ${r.suspended} টি account suspend হয়েছে।`, 'info'); }
async function adminRevokeBmdc(bmdc)    { if (!confirm(`BMDC ${bmdc} revoke করবেন?`)) return; await DB.revokeBmdc(bmdc); renderAdmin(); showToast(`BMDC ${bmdc} revoke হয়েছে।`, 'info'); }
async function adminReinstateBmdc(bmdc) { await DB.reinstateBmdc(bmdc); renderAdmin(); showToast('BMDC reinstate হয়েছে', 'success'); }
function adminRevokeBmdcPrompt()        { const b = prompt('কোন BMDC নম্বর revoke করতে চান?'); if (b) adminRevokeBmdc(b.trim()); }
async function setReviewStatus(reviewId, status) { await DB.setReviewVerification(reviewId, status); renderAdminReviews(); showToast(`Review ${status === 'verified' ? 'Verified' : 'Unverified'} চিহ্নিত হয়েছে`, 'success'); }

async function adminViewFile(reviewId) {
  const fileData = await DB.getReviewFile(reviewId);
  if (!fileData) { showToast('File পাওয়া যায়নি', 'error'); return; }
  document.getElementById('admin-file-viewer-content').innerHTML = `
    <div style="text-align:center">
      <p style="font-size:0.85rem;color:var(--gray-600);margin-bottom:12px">
        📎 <strong>${fileData.file_name || fileData.fileName}</strong>
        <span style="color:var(--gray-400);font-size:0.78rem"> — শুধুমাত্র admin দেখতে পারেন।</span>
      </p>
      ${(fileData.mime_type || fileData.mimeType || '').startsWith('image/')
        ? `<img src="${fileData.file_data || fileData.fileData}" style="max-width:100%;max-height:60vh;border-radius:8px;border:1px solid var(--gray-200)">`
        : `<a href="${fileData.file_data || fileData.fileData}" download="${fileData.file_name || fileData.fileName}" class="btn-primary" style="display:inline-block;text-decoration:none">⬇️ Download করুন</a>`}
    </div>`;
  openModal('modal-admin-file');
}

async function adminDeleteDoctor(id)    { if (!confirm('এই ডাক্তারকে delete করবেন?')) return; await DB.deleteDoctor(id); renderAdmin(); showToast('ডাক্তার remove হয়েছে', 'info'); }
async function adminDeleteReview(id)    { if (!confirm('এই review delete করবেন?')) return; await DB.deleteReview(id); renderAdminReviews(); showToast('Review delete হয়েছে', 'info'); }
async function adminBanUser(id)         { await DB.banUser(id, 'admin_ban'); renderAdmin(); showToast('Ban করা হয়েছে', 'info'); }
async function adminUnbanUser(id)       { await DB.unbanUser(id); renderAdmin(); showToast('Unban হয়েছে', 'success'); }
async function confirmAdminDeleteUser(id) { if (!confirm('এই user-কে সম্পূর্ণ delete করবেন?')) return; await DB.deleteAccount(id); renderAdmin(); showToast('User delete হয়েছে', 'info'); }

function openAddDoctorModal() {
  document.getElementById('add-doctor-form').onsubmit = async e => {
    e.preventDefault();
    const data = {
      name:       document.getElementById('add-name').value,
      specialty:  document.getElementById('add-specialty').value,
      degrees:    [{ degree: document.getElementById('add-degree').value, institution: document.getElementById('add-institution').value, year: '', subject: '' }],
      bmdc:       document.getElementById('add-bmdc').value,
      hospital:   document.getElementById('add-hospital').value,
      chamber:    document.getElementById('add-chamber').value,
      district:   document.getElementById('add-district').value,
      experience: document.getElementById('add-exp').value,
      fee:        document.getElementById('add-fee').value,
      phone:      document.getElementById('add-phone').value,
      email:      document.getElementById('add-email').value,
      about:      document.getElementById('add-about').value,
    };
    const result = await _http.post('/doctors', data);
    if (result._error) { showToast(result._error, 'error'); return; }
    closeModal('modal-add-doctor');
    renderAdmin();
    showToast('ডাক্তার সফলভাবে যোগ হয়েছে!', 'success');
    e.target.reset();
  };
  openModal('modal-add-doctor');
}

// ── Auth ──────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const result = await DB.findUser(
    document.getElementById('login-email').value,
    document.getElementById('login-password').value
  );
  if (!result) { showToast('Email বা password ভুল', 'error'); return; }
  if (result.banned) {
    showToast(result.banReason === 'bmdc_revoked'
      ? 'আপনার BMDC নম্বর revoke হয়েছে। BMDC কর্তৃপক্ষের সাথে যোগাযোগ করুন।'
      : 'আপনার account বন্ধ করা হয়েছে। admin-এর সাথে যোগাযোগ করুন।', 'error');
    return;
  }
  closeModal('modal-login');
  renderNavbar();
  updateHeroStats();
  showToast(`স্বাগতম, ${result.name.split(' ')[0]}! 👋`, 'success');
  if (result.role === 'admin')        showPage('admin');
  else if (result.role === 'doctor')  showPage('doctor-dashboard');
  else                                showPage('patient-dashboard');
}

// ── Degree builder ────────────────────────────────────────────

let degrees = [];
const DEGREE_LIST = ['MBBS','BDS','FCPS','MD','MS','MPhil','PhD','DDV','DCH','DGO','DTCD','DA','DLO','DO','MPH','MRCP','FRCS','FRCP','Diploma','Post-Graduate Diploma'];
const SUBJECTS = ['Medicine','Surgery','Cardiology','Dermatology','Orthopedics','Gynecology','Neurology','Pediatrics','ENT','Ophthalmology','Psychiatry','Gastroenterology','Urology','Endocrinology','Oncology','Pulmonology','Nephrology','Radiology','Anaesthesiology','Pathology','Microbiology','Physical Medicine','Hematology','Rheumatology','Hepatology','Neonatology','Vascular Surgery','Plastic Surgery','Neurosurgery','Cardiothoracic Surgery'];

function initDegreeBuilder() {
  const degSel = document.getElementById('degree-select');
  const subSel = document.getElementById('degree-subject');
  if (degSel) degSel.innerHTML = '<option value="">Degree বেছে নিন</option>' + DEGREE_LIST.map(d => `<option value="${d}">${d}</option>`).join('');
  if (subSel) subSel.innerHTML = '<option value="">Subject (optional)</option>' + SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('');
}

function addDegree() {
  const deg  = document.getElementById('degree-select').value;
  const inst = document.getElementById('degree-institution').value;
  const year = document.getElementById('degree-year').value;
  const sub  = document.getElementById('degree-subject').value;
  if (!deg || !inst) { showToast('Degree ও Institution বাছুন', 'error'); return; }
  degrees.push({ degree: deg, institution: inst, year, subject: sub });
  renderDegreeList();
  document.getElementById('degree-year').value = '';
}

function removeDegree(idx) { degrees.splice(idx, 1); renderDegreeList(); }

function renderDegreeList() {
  const el = document.getElementById('degrees-added');
  if (!el) return;
  el.innerHTML = degrees.length
    ? degrees.map((d, i) => `
        <div class="degree-chip" style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <span><strong>${d.degree}</strong>${d.subject ? ` — ${d.subject}` : ''} · <em>${d.institution}${d.year ? ', ' + d.year : ''}</em></span>
          <button type="button" onclick="removeDegree(${i})" style="color:var(--danger);background:none;font-size:0.85rem;font-weight:700">✕</button>
        </div>`).join('')
    : `<p style="color:var(--gray-400);font-size:0.85rem;margin:0">কোনো degree যোগ করা হয়নি</p>`;
}

// ── OTP & Registration ────────────────────────────────────────

let _pendingPatient = null, _pendingDoctor = null, _otpTimerInterval = null;

async function handlePatientRegister(e) {
  e.preventDefault();
  const pass = document.getElementById('pat-password').value;
  const conf = document.getElementById('pat-confirm').value;
  if (pass !== conf)    { showToast('Password দুটো মিলছে না', 'error'); return; }
  if (pass.length < 6)  { showToast('Password কমপক্ষে ৬ অক্ষরের হতে হবে', 'error'); return; }
  const data = {
    name:        document.getElementById('pat-name').value.trim(),
    email:       document.getElementById('pat-email').value.trim(),
    password:    pass,
    phone:       document.getElementById('pat-phone').value.trim(),
    gender:      document.getElementById('pat-gender').value,
    age:         document.getElementById('pat-age').value,
    bloodGroup:  document.getElementById('pat-blood').value,
    address:     document.getElementById('pat-address').value.trim(),
  };
  if (!data.phone)                                     { showToast('Phone number দিন', 'error'); return; }
  if (await DB.emailExists(data.email))                { showToast('এই email দিয়ে আগেই account আছে', 'error'); return; }
  if (await DB.phoneExistsForPatient(data.phone))      { showToast('এই phone number দিয়ে আগেই account আছে', 'error'); return; }
  if (await DB.isPhoneBanned(data.phone))              { showToast('এই phone number দিয়ে account খোলা সম্ভব নয়', 'error'); return; }
  if (await DB.isDeviceBanned())                       { showToast('এই device থেকে account খোলা সম্ভব নয়', 'error'); return; }
  _pendingPatient = data; _pendingDoctor = null;
  await sendOTPAndShowModal(data.email, data.name);
}

async function handleDoctorRegister(e) {
  e.preventDefault();
  if (degrees.length === 0) { showToast('কমপক্ষে একটি Degree যোগ করুন', 'error'); return; }
  const hospital = document.getElementById('doc-hospital').value.trim();
  const district = document.getElementById('doc-district').value;
  const fee      = document.getElementById('doc-fee').value;
  const phone    = document.getElementById('doc-phone').value.trim();
  if (!hospital || !district || !fee || !phone) { showToast('সব তথ্য দিন', 'error'); return; }
  const visitHours = Array.from(document.querySelectorAll('input[name="visit-hours"]:checked')).map(cb => cb.value);
  const data = {
    name:          document.getElementById('doc-name').value.trim(),
    email:         document.getElementById('doc-email').value.trim(),
    password:      document.getElementById('doc-password').value,
    specialty:     document.getElementById('doc-specialty').value,
    degrees,
    bmdc:          document.getElementById('doc-bmdc').value,
    experience:    document.getElementById('doc-experience').value,
    about:         document.getElementById('doc-about').value,
    hospital, district, fee, phone,
    chamber:       document.getElementById('doc-chamber').value,
    visitLocation: document.getElementById('doc-visit-location').value,
    visitDays:     document.getElementById('doc-visit-days').value,
    visitHours,
    drType:        document.getElementById('doc-dr-type').value,
    medicalCollege:document.getElementById('doc-medical-college').value,
    gender:        document.getElementById('doc-gender-dr').value,
    languages:     document.getElementById('doc-languages').value,
  };
  _pendingDoctor = data; _pendingPatient = null;
  await sendOTPAndShowModal(data.email, data.name);
}

async function sendOTPAndShowModal(email, name) {
  showToast('Email পাঠানো হচ্ছে...', 'info');
  const result = await EmailVerification.sendOTP(email, name);
  if (!result.success) { showToast('Email পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error'); return; }
  closeModal('modal-reg-patient');
  closeModal('modal-reg-doctor');
  openModal('modal-otp-verify');
  setEl('otp-email-display', email);
  const demoBox = document.getElementById('otp-demo-box');
  if (result.demo) {
    demoBox.style.display = 'block';
    setEl('otp-demo-code', result.code);
    setEl('otp-demo-note', '⚠️ Demo mode — emailjs.js configure করুন।');
  } else {
    demoBox.style.display = 'none';
    showToast('Verification code পাঠানো হয়েছে! 📧', 'success');
  }
  startOTPTimer();
}

function startOTPTimer() {
  clearInterval(_otpTimerInterval);
  _otpTimerInterval = setInterval(() => {
    const secs   = EmailVerification.getRemainingSeconds();
    const timerEl = document.getElementById('otp-timer');
    if (!timerEl) return;
    if (secs > 0) {
      timerEl.textContent = `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
      timerEl.style.color = secs < 60 ? 'var(--danger)' : 'var(--teal)';
    } else {
      timerEl.textContent = 'মেয়াদ শেষ';
      timerEl.style.color = 'var(--danger)';
      clearInterval(_otpTimerInterval);
    }
  }, 1000);
}

async function resendOTP() {
  const email = EmailVerification.getPendingEmail();
  if (!email) { showToast('Session শেষ। আবার form fill করুন।', 'error'); closeModal('modal-otp-verify'); return; }
  document.getElementById('otp-code-input').value = '';
  showToast('নতুন code পাঠানো হচ্ছে...', 'info');
  const result = await EmailVerification.sendOTP(email, _pendingPatient?.name || _pendingDoctor?.name || '');
  if (result.demo) { document.getElementById('otp-demo-box').style.display = 'block'; setEl('otp-demo-code', result.code); }
  startOTPTimer();
  showToast('নতুন code পাঠানো হয়েছে!', 'success');
}

async function handleOTPVerify(e) {
  e.preventDefault();
  const input = document.getElementById('otp-code-input').value.trim();
  if (!input || input.length !== 6) { showToast('৬-digit code দিন', 'error'); return; }
  const email = EmailVerification.getPendingEmail();
  if (!email) { showToast('Session শেষ। আবার চেষ্টা করুন।', 'error'); closeModal('modal-otp-verify'); return; }
  const check = EmailVerification.verifyOTP(email, input);
  if (check.error) { showToast(check.error, 'error'); return; }
  clearInterval(_otpTimerInterval);

  if (_pendingPatient) {
    const result = await DB.registerPatient(_pendingPatient);
    if (result.error) { showToast(result.error, 'error'); return; }
    _pendingPatient = null;
    closeModal('modal-otp-verify');
    document.getElementById('patient-reg-form')?.reset();
    renderNavbar(); updateHeroStats();
    showToast(`Email verified! স্বাগতম, ${result.user.name.split(' ')[0]}! 🎉`, 'success');
    showPage('patient-dashboard');
  } else if (_pendingDoctor) {
    const result = await DB.registerDoctor(_pendingDoctor);
    if (result.error) { showToast(result.error, 'error'); return; }
    degrees = [];
    _pendingDoctor = null;
    closeModal('modal-otp-verify');
    renderNavbar(); updateHeroStats();
    showToast('Email verified! Doctor account তৈরি হয়েছে! 🎉', 'success');
    showPage('doctor-dashboard');
  }
  document.getElementById('otp-verify-form')?.reset();
}

// ── Doctor registration steps ─────────────────────────────────

function showDoctorStep(step) {
  document.querySelectorAll('.doc-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`doc-step-${step}`)?.classList.add('active');
  document.querySelectorAll('.si').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === step);
    s.classList.toggle('done',   i + 1 < step);
  });
}

async function doctorStep1Next() {
  const name  = document.getElementById('doc-name').value.trim();
  const email = document.getElementById('doc-email').value.trim();
  const pass  = document.getElementById('doc-password').value;
  const conf  = document.getElementById('doc-confirm').value;
  if (!name || !email || !pass)         { showToast('সব তথ্য দিন', 'error'); return; }
  if (pass !== conf)                    { showToast('Password দুটো মিলছে না', 'error'); return; }
  if (pass.length < 6)                  { showToast('Password কমপক্ষে ৬ অক্ষরের হতে হবে', 'error'); return; }
  if (await DB.emailExists(email))      { showToast('এই email দিয়ে আগেই account আছে', 'error'); return; }
  showDoctorStep(2);
}

async function doctorStep2Next() {
  const specialty = document.getElementById('doc-specialty').value;
  const bmdc      = document.getElementById('doc-bmdc').value.trim();
  const exp       = document.getElementById('doc-experience').value;
  if (!specialty || !bmdc || !exp)      { showToast('সব তথ্য দিন', 'error'); return; }
  if (degrees.length === 0)             { showToast('কমপক্ষে একটি Degree যোগ করুন', 'error'); return; }
  if (await DB.bmdcExists(bmdc))        { showToast('এই BMDC নম্বর দিয়ে আগেই ডাক্তার registered আছেন', 'error'); return; }
  showDoctorStep(3);
}

// ── Shared utilities ──────────────────────────────────────────

function logout() { DB.clearSession(); renderNavbar(); updateHeroStats(); showPage('home'); showToast('Logout সফল হয়েছে', 'info'); }

function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${{ success: '✅', error: '❌', info: 'ℹ️' }[type] || ''}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

function switchTab(tabId, btn) {
  const p = btn.closest('.tabs').parentElement;
  p.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  p.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  p.querySelector('#' + tabId)?.classList.add('active');
}

function switchDashTab(tabId, btn) {
  const dash = btn.closest('.dash-main') || btn.closest('.dash-layout').querySelector('.dash-main');
  dash.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  btn.closest('.dash-sidebar').querySelectorAll('.dash-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  dash.querySelector('#' + tabId)?.classList.add('active');
  if (tabId === 'pd-overview') { const u = DB.getSession(); if (u) setEl('patient-dash-name2', u.name.split(' ')[0]); }
}
