// ============================================================
// database.js — Browser-based database (localStorage as DB)
// Mimics SQL tables: users, doctors, reviews, appointments
// ============================================================

const DB = {
  init() {
    if (!localStorage.getItem('db_initialized')) {
      // --- USERS TABLE ---
      const users = [
        { id: 1, name: 'Admin User', email: 'admin@docreview.com', password: 'admin123', role: 'admin', avatar: 'AU', joined: '2024-01-01' },
        { id: 2, name: 'Rahim Hossain', email: 'rahim@gmail.com', password: 'pass123', role: 'patient', avatar: 'RH', joined: '2024-02-10' },
        { id: 3, name: 'Fatema Begum', email: 'fatema@gmail.com', password: 'pass123', role: 'patient', avatar: 'FB', joined: '2024-03-05' },
      ];

      // --- DOCTORS TABLE ---
      const doctors = [
        { id: 1, name: 'Dr. Arif Ahmed', specialty: 'Cardiologist', hospital: 'Square Hospital, Dhaka', experience: 15, fee: 1500, rating: 4.8, reviews: 124, img: null, available: true, about: 'Specialist in heart diseases with 15 years of experience. MBBS, MD (Cardiology), FCPS.' },
        { id: 2, name: 'Dr. Nasrin Islam', specialty: 'Dermatologist', hospital: 'United Hospital, Dhaka', experience: 10, fee: 1200, rating: 4.6, reviews: 89, img: null, available: true, about: 'Expert in skin diseases, laser treatment and cosmetic dermatology. MBBS, DDV.' },
        { id: 3, name: 'Dr. Karim Uddin', specialty: 'Orthopedic', hospital: 'Labaid Hospital, Dhaka', experience: 20, fee: 2000, rating: 4.9, reviews: 203, img: null, available: true, about: 'Senior orthopedic surgeon specializing in joint replacement and spine surgery.' },
        { id: 4, name: 'Dr. Shamima Akter', specialty: 'Gynecologist', hospital: 'Anwer Khan Modern, Dhaka', experience: 12, fee: 1300, rating: 4.7, reviews: 156, img: null, available: false, about: 'Women\'s health specialist with expertise in high-risk pregnancy and laparoscopic surgery.' },
        { id: 5, name: 'Dr. Rafiqul Islam', specialty: 'Neurologist', hospital: 'National Hospital, Dhaka', experience: 18, fee: 1800, rating: 4.5, reviews: 97, img: null, available: true, about: 'Expert in brain and nervous system disorders, stroke management and epilepsy treatment.' },
        { id: 6, name: 'Dr. Sumaiya Khan', specialty: 'Pediatrician', hospital: 'Dhaka Shishu Hospital', experience: 8, fee: 1000, rating: 4.8, reviews: 178, img: null, available: true, about: 'Child health specialist focused on newborn care, vaccinations and childhood diseases.' },
      ];

      // --- REVIEWS TABLE ---
      const reviews = [
        { id: 1, doctorId: 1, patientId: 2, patientName: 'Rahim Hossain', rating: 5, comment: 'Excellent doctor! Very attentive and explained everything clearly. Highly recommended.', date: '2024-11-15', helpful: 12 },
        { id: 2, doctorId: 1, patientId: 3, patientName: 'Fatema Begum', rating: 4, comment: 'Good experience. The doctor is very knowledgeable. Wait time was a bit long.', date: '2024-12-01', helpful: 7 },
        { id: 3, doctorId: 2, patientId: 2, patientName: 'Rahim Hossain', rating: 5, comment: 'Dr. Nasrin is amazing! My skin condition improved drastically within weeks.', date: '2024-10-20', helpful: 20 },
        { id: 4, doctorId: 3, patientId: 3, patientName: 'Fatema Begum', rating: 5, comment: 'Best orthopedic surgeon in Bangladesh. Very professional and caring.', date: '2024-09-12', helpful: 15 },
        { id: 5, doctorId: 5, patientId: 2, patientName: 'Rahim Hossain', rating: 4, comment: 'Very thorough in his diagnosis. Helped me understand my condition better.', date: '2025-01-05', helpful: 8 },
      ];

      // --- APPOINTMENTS TABLE ---
      const appointments = [
        { id: 1, doctorId: 1, patientId: 2, patientName: 'Rahim Hossain', date: '2025-04-10', time: '10:00 AM', status: 'confirmed', fee: 1500 },
        { id: 2, doctorId: 3, patientId: 3, patientName: 'Fatema Begum', date: '2025-04-15', time: '2:30 PM', status: 'pending', fee: 2000 },
      ];

      this.save('users', users);
      this.save('doctors', doctors);
      this.save('reviews', reviews);
      this.save('appointments', appointments);
      localStorage.setItem('db_initialized', 'true');
      localStorage.setItem('db_next_ids', JSON.stringify({ users: 4, doctors: 7, reviews: 6, appointments: 3 }));
    }
  },

  save(table, data) { localStorage.setItem('db_' + table, JSON.stringify(data)); },
  getAll(table) { return JSON.parse(localStorage.getItem('db_' + table) || '[]'); },
  nextId(table) {
    const ids = JSON.parse(localStorage.getItem('db_next_ids') || '{}');
    const id = ids[table] || 1;
    ids[table] = id + 1;
    localStorage.setItem('db_next_ids', JSON.stringify(ids));
    return id;
  },

  // --- USERS ---
  findUser(email, password) { return this.getAll('users').find(u => u.email === email && u.password === password); },
  getUserById(id) { return this.getAll('users').find(u => u.id === id); },
  registerUser(name, email, password) {
    const users = this.getAll('users');
    if (users.find(u => u.email === email)) return { error: 'Email already exists' };
    const user = { id: this.nextId('users'), name, email, password, role: 'patient', avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2), joined: new Date().toISOString().split('T')[0] };
    users.push(user);
    this.save('users', users);
    return { user };
  },

  // --- DOCTORS ---
  getAllDoctors() { return this.getAll('doctors'); },
  getDoctorById(id) { return this.getAll('doctors').find(d => d.id === parseInt(id)); },
  searchDoctors(query, specialty) {
    return this.getAll('doctors').filter(d => {
      const matchQ = !query || d.name.toLowerCase().includes(query.toLowerCase()) || d.specialty.toLowerCase().includes(query.toLowerCase());
      const matchS = !specialty || d.specialty === specialty;
      return matchQ && matchS;
    });
  },
  addDoctor(data) {
    const doctors = this.getAll('doctors');
    const doc = { id: this.nextId('doctors'), ...data, rating: 0, reviews: 0, available: true };
    doctors.push(doc);
    this.save('doctors', doctors);
    return doc;
  },
  deleteDoctor(id) {
    const doctors = this.getAll('doctors').filter(d => d.id !== parseInt(id));
    this.save('doctors', doctors);
  },

  // --- REVIEWS ---
  getReviewsByDoctor(doctorId) { return this.getAll('reviews').filter(r => r.doctorId === parseInt(doctorId)); },
  getReviewsByPatient(patientId) { return this.getAll('reviews').filter(r => r.patientId === parseInt(patientId)); },
  addReview(doctorId, patientId, patientName, rating, comment) {
    const reviews = this.getAll('reviews');
    const existing = reviews.find(r => r.doctorId === parseInt(doctorId) && r.patientId === parseInt(patientId));
    if (existing) return { error: 'You have already reviewed this doctor' };
    const review = { id: this.nextId('reviews'), doctorId: parseInt(doctorId), patientId: parseInt(patientId), patientName, rating: parseInt(rating), comment, date: new Date().toISOString().split('T')[0], helpful: 0 };
    reviews.push(review);
    this.save('reviews', reviews);
    // Update doctor rating
    const doctors = this.getAll('doctors');
    const doc = doctors.find(d => d.id === parseInt(doctorId));
    if (doc) {
      const docReviews = reviews.filter(r => r.doctorId === parseInt(doctorId));
      doc.rating = Math.round((docReviews.reduce((s, r) => s + r.rating, 0) / docReviews.length) * 10) / 10;
      doc.reviews = docReviews.length;
      this.save('doctors', doctors);
    }
    return { review };
  },
  markHelpful(reviewId) {
    const reviews = this.getAll('reviews');
    const r = reviews.find(r => r.id === parseInt(reviewId));
    if (r) { r.helpful++; this.save('reviews', reviews); }
  },

  // --- APPOINTMENTS ---
  getAppointmentsByPatient(patientId) { return this.getAll('appointments').filter(a => a.patientId === parseInt(patientId)); },
  getAllAppointments() { return this.getAll('appointments'); },
  bookAppointment(doctorId, patientId, patientName, date, time, fee) {
    const appointments = this.getAll('appointments');
    const appt = { id: this.nextId('appointments'), doctorId: parseInt(doctorId), patientId: parseInt(patientId), patientName, date, time, fee, status: 'pending' };
    appointments.push(appt);
    this.save('appointments', appointments);
    return { appointment: appt };
  },
  updateAppointmentStatus(id, status) {
    const appointments = this.getAll('appointments');
    const a = appointments.find(a => a.id === parseInt(id));
    if (a) { a.status = status; this.save('appointments', appointments); }
  },

  // --- SESSION ---
  setSession(user) { sessionStorage.setItem('current_user', JSON.stringify(user)); },
  getSession() { return JSON.parse(sessionStorage.getItem('current_user') || 'null'); },
  clearSession() { sessionStorage.removeItem('current_user'); },

  // --- STATS (for admin) ---
  getStats() {
    return {
      totalDoctors: this.getAll('doctors').length,
      totalPatients: this.getAll('users').filter(u => u.role === 'patient').length,
      totalReviews: this.getAll('reviews').length,
      totalAppointments: this.getAll('appointments').length,
    };
  }
};
