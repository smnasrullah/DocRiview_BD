// ============================================================
// database.js — Doctor Review System v3
// ============================================================

const DB = {
  init() {
    if (!localStorage.getItem('db_initialized')) {
      const users = [
        { id: 1, name: 'Admin User', email: 'admin@docreview.com', password: 'admin123', role: 'admin', avatar: 'AU', joined: '2024-01-01' },
        { id: 2, name: 'Rahim Hossain', email: 'rahim@gmail.com', password: 'pass123', role: 'patient', avatar: 'RH', joined: '2024-02-10', phone: '01711234567', bloodGroup: 'B+', age: 35, gender: 'Male', address: 'Mirpur, Dhaka' },
        { id: 3, name: 'Fatema Begum', email: 'fatema@gmail.com', password: 'pass123', role: 'patient', avatar: 'FB', joined: '2024-03-05', phone: '01822345678', bloodGroup: 'O+', age: 28, gender: 'Female', address: 'Dhanmondi, Dhaka' },
      ];
      const doctors = [
        { id: 1, userId: null, name: 'Dr. Arif Ahmed', specialty: 'Cardiologist', degree: 'MBBS, MD (Cardiology), FCPS', bmdc: 'A-12345', hospital: 'Square Hospital, Dhaka', chamber: 'Square Hospital, 18/F West Panthapath, Dhaka', chamberTime: 'Sat-Thu: 6PM-9PM', district: 'Dhaka', experience: 15, fee: 1500, rating: 4.8, reviews: 124, available: true, phone: '01912345678', email: 'arif@sq.com', about: 'Specialist in heart diseases with 15 years of experience. Expert in interventional cardiology and echocardiography.' },
        { id: 2, userId: null, name: 'Dr. Nasrin Islam', specialty: 'Dermatologist', degree: 'MBBS, DDV, FCPS (Dermatology)', bmdc: 'A-23456', hospital: 'United Hospital, Dhaka', chamber: 'United Hospital, Plot 15, Road 71, Gulshan', chamberTime: 'Sun-Thu: 5PM-8PM', district: 'Dhaka', experience: 10, fee: 1200, rating: 4.6, reviews: 89, available: true, phone: '01812456789', email: 'nasrin@uh.com', about: 'Expert in skin diseases, laser treatment and cosmetic dermatology.' },
        { id: 3, userId: null, name: 'Dr. Karim Uddin', specialty: 'Orthopedic Surgeon', degree: 'MBBS, MS (Orthopedics), FCPS', bmdc: 'A-34567', hospital: 'Labaid Hospital, Dhaka', chamber: 'Labaid Specialized Hospital, Dhanmondi', chamberTime: 'Sat-Wed: 4PM-7PM', district: 'Dhaka', experience: 20, fee: 2000, rating: 4.9, reviews: 203, available: true, phone: '01712567890', email: 'karim@lb.com', about: 'Senior orthopedic surgeon specializing in joint replacement and spine surgery. 3000+ successful surgeries.' },
        { id: 4, userId: null, name: 'Dr. Shamima Akter', specialty: 'Gynecologist', degree: 'MBBS, FCPS (Gynecology)', bmdc: 'A-45678', hospital: 'Anwer Khan Modern, Dhaka', chamber: 'Anwer Khan Modern Hospital, Dhanmondi', chamberTime: 'Mon-Thu: 5PM-8PM', district: 'Dhaka', experience: 12, fee: 1300, rating: 4.7, reviews: 156, available: false, phone: '01612678901', email: 'shamima@ak.com', about: "Women's health specialist. Expert in high-risk pregnancy and laparoscopic surgery." },
        { id: 5, userId: null, name: 'Dr. Rafiqul Islam', specialty: 'Neurologist', degree: 'MBBS, MD (Neurology), FCPS', bmdc: 'A-56789', hospital: 'BIRDEM Hospital, Dhaka', chamber: 'BIRDEM General Hospital, Shahbag', chamberTime: 'Sun-Thu: 3PM-6PM', district: 'Dhaka', experience: 18, fee: 1800, rating: 4.5, reviews: 97, available: true, phone: '01512789012', email: 'rafiq@bd.com', about: 'Expert in brain and nervous system disorders, stroke management and epilepsy treatment.' },
        { id: 6, userId: null, name: 'Dr. Sumaiya Khan', specialty: 'Pediatrician', degree: 'MBBS, DCH, FCPS (Pediatrics)', bmdc: 'A-67890', hospital: 'Dhaka Shishu Hospital', chamber: 'Dhaka Shishu Hospital, Sher-e-Bangla Nagar', chamberTime: 'Sat-Thu: 8AM-2PM', district: 'Dhaka', experience: 8, fee: 1000, rating: 4.8, reviews: 178, available: true, phone: '01412890123', email: 'sumaiya@dsh.com', about: 'Child health specialist. Expert in newborn care, vaccinations and childhood diseases.' },
      ];
      const reviews = [
        { id: 1, doctorId: 1, patientId: 2, patientName: 'Rahim Hossain', rating: 5, comment: 'Excellent doctor! Very attentive and explained everything clearly. Highly recommended.', date: '2024-11-15', helpful: 12 },
        { id: 2, doctorId: 1, patientId: 3, patientName: 'Fatema Begum', rating: 4, comment: 'Good experience. The doctor is very knowledgeable. Wait time was a bit long.', date: '2024-12-01', helpful: 7 },
        { id: 3, doctorId: 2, patientId: 2, patientName: 'Rahim Hossain', rating: 5, comment: 'Dr. Nasrin is amazing! My skin condition improved drastically within weeks.', date: '2024-10-20', helpful: 20 },
        { id: 4, doctorId: 3, patientId: 3, patientName: 'Fatema Begum', rating: 5, comment: 'Best orthopedic surgeon in Bangladesh. Very professional and caring.', date: '2024-09-12', helpful: 15 },
        { id: 5, doctorId: 5, patientId: 2, patientName: 'Rahim Hossain', rating: 4, comment: 'Very thorough in his diagnosis. Helped me understand my condition better.', date: '2025-01-05', helpful: 8 },
      ];
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
    this.recordVisit();
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

  // ===== VISIT COUNTER =====
  recordVisit() {
    const count = parseInt(localStorage.getItem('site_visits') || '0') + 1;
    localStorage.setItem('site_visits', count);
  },
  getVisitCount() { return parseInt(localStorage.getItem('site_visits') || '0'); },

  // ===== VALIDATION =====
  emailExists(email) { return !!this.getAll('users').find(u => u.email === email.toLowerCase().trim()); },
  phoneExistsForPatient(phone) {
    const clean = phone.replace(/\D/g, '');
    return !!this.getAll('users').find(u => u.role === 'patient' && u.phone && u.phone.replace(/\D/g, '') === clean);
  },
  bmdcExists(bmdc) {
    return !!this.getAll('doctors').find(d => d.bmdc && d.bmdc.toLowerCase().trim() === bmdc.toLowerCase().trim());
  },

  // ===== USERS =====
  findUser(email, password) { return this.getAll('users').find(u => u.email === email.trim() && u.password === password); },
  getUserById(id) { return this.getAll('users').find(u => u.id === parseInt(id)); },

  registerPatient(data) {
    if (this.emailExists(data.email)) return { error: 'এই email দিয়ে আগেই account আছে' };
    if (this.phoneExistsForPatient(data.phone)) return { error: 'এই phone number দিয়ে আগেই account আছে' };
    const user = {
      id: this.nextId('users'), role: 'patient',
      joined: new Date().toISOString().split('T')[0],
      avatar: data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      name: data.name, email: data.email.trim(), password: data.password,
      phone: data.phone.replace(/\D/g, ''),
      gender: data.gender, age: data.age, bloodGroup: data.bloodGroup, address: data.address,
    };
    const users = this.getAll('users');
    users.push(user);
    this.save('users', users);
    return { user };
  },

  registerDoctor(data) {
    if (this.emailExists(data.email)) return { error: 'এই email দিয়ে আগেই account আছে' };
    if (this.bmdcExists(data.bmdc)) return { error: 'এই BMDC নম্বর দিয়ে আগেই ডাক্তার registered আছেন' };
    const userId = this.nextId('users');
    const user = {
      id: userId, role: 'doctor',
      joined: new Date().toISOString().split('T')[0],
      avatar: data.name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      name: data.name, email: data.email.trim(), password: data.password,
    };
    const users = this.getAll('users');
    users.push(user);
    this.save('users', users);
    const doctor = {
      id: this.nextId('doctors'), userId,
      rating: 0, reviews: 0, available: true,
      name: data.name, specialty: data.specialty, degree: data.degree,
      bmdc: data.bmdc.trim(), hospital: data.hospital, chamber: data.chamber,
      chamberTime: data.chamberTime, district: data.district,
      experience: parseInt(data.experience) || 0, fee: parseInt(data.fee) || 0,
      phone: data.phone, email: data.email.trim(), about: data.about || '',
    };
    const doctors = this.getAll('doctors');
    doctors.push(doctor);
    this.save('doctors', doctors);
    return { user, doctor };
  },

  // ===== DOCTORS =====
  getAllDoctors() { return this.getAll('doctors'); },
  getDoctorById(id) { return this.getAll('doctors').find(d => d.id === parseInt(id)); },
  getDoctorByUserId(uid) { return this.getAll('doctors').find(d => d.userId === parseInt(uid)); },

  searchDoctors(query, specialty, district, sortBy) {
    let results = this.getAll('doctors').filter(d => {
      const q = !query || d.name.toLowerCase().includes(query.toLowerCase()) || d.specialty.toLowerCase().includes(query.toLowerCase());
      const s = !specialty || d.specialty === specialty;
      const dist = !district || d.district === district;
      return q && s && dist;
    });
    // Sort
    if (sortBy === 'rating') results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'fee_low') results.sort((a, b) => (a.fee || 0) - (b.fee || 0));
    else if (sortBy === 'fee_high') results.sort((a, b) => (b.fee || 0) - (a.fee || 0));
    else if (sortBy === 'experience') results.sort((a, b) => (b.experience || 0) - (a.experience || 0));
    else results.sort((a, b) => (b.rating || 0) - (a.rating || 0)); // default: rating
    return results;
  },

  addDoctor(data) {
    if (this.bmdcExists(data.bmdc)) return { error: 'এই BMDC নম্বর আগেই registered' };
    const doctors = this.getAll('doctors');
    const doc = { id: this.nextId('doctors'), ...data, rating: 0, reviews: 0, available: true };
    doctors.push(doc);
    this.save('doctors', doctors);
    return { doctor: doc };
  },
  deleteDoctor(id) { this.save('doctors', this.getAll('doctors').filter(d => d.id !== parseInt(id))); },

  // ===== REVIEWS =====
  getReviewsByDoctor(id) { return this.getAll('reviews').filter(r => r.doctorId === parseInt(id)); },
  getReviewsByPatient(id) { return this.getAll('reviews').filter(r => r.patientId === parseInt(id)); },
  addReview(doctorId, patientId, patientName, rating, comment) {
    const reviews = this.getAll('reviews');
    if (reviews.find(r => r.doctorId === parseInt(doctorId) && r.patientId === parseInt(patientId)))
      return { error: 'আপনি এই ডাক্তারকে আগেই review করেছেন' };
    const review = { id: this.nextId('reviews'), doctorId: parseInt(doctorId), patientId: parseInt(patientId), patientName, rating: parseInt(rating), comment, date: new Date().toISOString().split('T')[0], helpful: 0 };
    reviews.push(review);
    this.save('reviews', reviews);
    // update doctor rating
    const doctors = this.getAll('doctors');
    const doc = doctors.find(d => d.id === parseInt(doctorId));
    if (doc) {
      const dr = reviews.filter(r => r.doctorId === parseInt(doctorId));
      doc.rating = Math.round((dr.reduce((s, r) => s + r.rating, 0) / dr.length) * 10) / 10;
      doc.reviews = dr.length;
      this.save('doctors', doctors);
    }
    return { review };
  },
  markHelpful(id) {
    const reviews = this.getAll('reviews');
    const r = reviews.find(r => r.id === parseInt(id));
    if (r) { r.helpful++; this.save('reviews', reviews); }
  },

  // ===== APPOINTMENTS =====
  getAppointmentsByPatient(id) { return this.getAll('appointments').filter(a => a.patientId === parseInt(id)); },
  getAppointmentsByDoctor(id) { return this.getAll('appointments').filter(a => a.doctorId === parseInt(id)); },
  getAllAppointments() { return this.getAll('appointments'); },
  bookAppointment(doctorId, patientId, patientName, date, time, fee) {
    const appt = { id: this.nextId('appointments'), doctorId: parseInt(doctorId), patientId: parseInt(patientId), patientName, date, time, fee, status: 'pending' };
    const appointments = this.getAll('appointments');
    appointments.push(appt);
    this.save('appointments', appointments);
    return { appointment: appt };
  },
  updateAppointmentStatus(id, status) {
    const appointments = this.getAll('appointments');
    const a = appointments.find(a => a.id === parseInt(id));
    if (a) { a.status = status; this.save('appointments', appointments); }
  },

  // ===== SESSION =====
  setSession(user) { sessionStorage.setItem('current_user', JSON.stringify(user)); },
  getSession() { return JSON.parse(sessionStorage.getItem('current_user') || 'null'); },
  clearSession() { sessionStorage.removeItem('current_user'); },

  // ===== STATS — real counts only =====
  getStats() {
    const users = this.getAll('users');
    return {
      totalDoctors: this.getAll('doctors').length,
      totalPatients: users.filter(u => u.role === 'patient').length,
      totalReviews: this.getAll('reviews').length,
      totalAppointments: this.getAll('appointments').length,
      totalVisits: this.getVisitCount(),
    };
  }
};
