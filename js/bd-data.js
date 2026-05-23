'use strict';

const BD_DATA = {

    DISTRICTS: [
    // Dhaka Division
    "Dhaka","Gazipur","Narayanganj","Narsingdi","Manikganj","Munshiganj","Tangail","Kishoreganj","Faridpur","Rajbari","Gopalganj","Madaripur","Shariatpur",
    // Chittagong Division
    "Chittagong","Cox's Bazar","Feni","Lakshmipur","Comilla","Chandpur","Brahmanbaria","Noakhali","Rangamati","Bandarban","Khagrachhari",
    // Sylhet Division
    "Sylhet","Moulvibazar","Habiganj","Sunamganj",
    // Rajshahi Division
    "Rajshahi","Bogra","Chapainawabganj","Naogaon","Natore","Sirajganj","Pabna","Joypurhat",
    // Khulna Division
    "Khulna","Bagerhat","Satkhira","Jessore","Narail","Magura","Jhenaidah","Chuadanga","Kushtia","Meherpur",
    // Barisal Division
    "Barisal","Bhola","Patuakhali","Pirojpur","Jhalokati","Barguna",
    // Rangpur Division
    "Rangpur","Dinajpur","Gaibandha","Kurigram","Lalmonirhat","Nilphamari","Panchagarh","Thakurgaon",
    // Mymensingh Division
    "Mymensingh","Jamalpur","Sherpur","Netrokona",
  ],

    SPECIALTIES: [
    // Medicine
    "General Physician (সাধারণ চিকিৎসক)",
    "Medicine Specialist (মেডিসিন)",
    "Cardiologist (হৃদরোগ)",
    "Neurologist (স্নায়ুরোগ)",
    "Gastroenterologist (পেট ও পাচনতন্ত্র)",
    "Endocrinologist (হরমোন ও ডায়াবেটিস)",
    "Rheumatologist (বাত রোগ)",
    "Hematologist (রক্ত রোগ)",
    "Nephrologist (কিডনি রোগ)",
    "Pulmonologist (ফুসফুস ও শ্বাসতন্ত্র)",
    "Oncologist (ক্যান্সার)",
    "Infectious Disease Specialist (সংক্রামক রোগ)",
    // Surgery
    "General Surgeon (সাধারণ শল্য)",
    "Orthopedic Surgeon (অস্থি ও জোড়া)",
    "Neurosurgeon (মস্তিষ্ক ও স্নায়ু শল্য)",
    "Cardiothoracic Surgeon (হৃদ ও বক্ষ শল্য)",
    "Colorectal Surgeon (কোলোরেক্টাল)",
    "Plastic Surgeon (প্লাস্টিক ও পুনর্গঠন)",
    "Vascular Surgeon (রক্তনালী)",
    "Pediatric Surgeon (শিশু শল্য)",
    "Laparoscopic Surgeon (ল্যাপারোস্কোপিক)",
    "Urologist (মূত্রনালী ও কিডনি শল্য)",
    // Obs & Gynae
    "Gynecologist (স্ত্রীরোগ)",
    "Gynecologist & Obstetrician (স্ত্রীরোগ ও প্রসূতি)",
    // Pediatrics
    "Pediatrician (শিশুরোগ)",
    "Neonatologist (নবজাতক বিশেষজ্ঞ)",
    // Dermatology
    "Dermatologist (চর্মরোগ)",
    "Venereologist (যৌন ও চর্মরোগ)",
    // ENT
    "ENT Specialist (নাক-কান-গলা)",
    "Head & Neck Surgeon (মাথা ও গলা শল্য)",
    // Eye
    "Ophthalmologist (চক্ষু রোগ)",
    "Vitreoretinal Surgeon (রেটিনা)",
    // Psychiatry
    "Psychiatrist (মানসিক রোগ)",
    "Addiction Medicine (মাদকাসক্তি)",
    // Radiology
    "Radiologist (রেডিওলজি)",
    "Interventional Radiologist (আইআর)",
    "Sonologist (আলট্রাসাউন্ড)",
    // Anaesthesia
    "Anaesthesiologist (অবেদনবিদ)",
    "Pain Management Specialist (ব্যথা ব্যবস্থাপনা)",
    // Pathology
    "Pathologist (প্যাথলজি)",
    "Microbiologist (অণুজীব বিজ্ঞান)",
    // Dentistry
    "Dentist / BDS (দন্ত চিকিৎসক)",
    "Orthodontist (দাঁত সরানো)",
    "Oral & Maxillofacial Surgeon (মুখ ও চোয়াল)",
    // Physical Medicine
    "Physical Medicine & Rehab (শারীরিক চিকিৎসা)",
    // Others
    "Nutritionist / Dietitian (পুষ্টিবিদ)",
    "Hepatologist (যকৃৎ রোগ)",
    "Geriatrician (বৃদ্ধ রোগ)",
    "Sports Medicine (ক্রীড়া চিকিৎসা)",
    "Emergency Medicine (জরুরি চিকিৎসা)",
    "Forensic Medicine (ফরেনসিক)",
    "Occupational Medicine (পেশাগত রোগ)",
    "Transfusion Medicine (রক্ত সঞ্চালন)",
  ],

    // Source: Ministry of Health & Family Welfare / BMDC
  MEDICAL_COLLEGES: {
    govt: [
      "Dhaka Medical College (DMC), Dhaka",
      "Sir Salimullah Medical College (SSMC), Dhaka",
      "Shaheed Suhrawardy Medical College, Dhaka",
      "Mugda Medical College, Dhaka",
      "Mymensingh Medical College (MMC), Mymensingh",
      "Chittagong Medical College (CMC), Chittagong",
      "Rajshahi Medical College (RMC), Rajshahi",
      "Khulna Medical College (KMC), Khulna",
      "Sylhet MAG Osmani Medical College (SOMC), Sylhet",
      "Rangpur Medical College (RangMC), Rangpur",
      "Sher-e-Bangla Medical College (SBMC), Barisal",
      "Faridpur Medical College (FMC), Faridpur",
      "Dinajpur Medical College (DnMC), Dinajpur",
      "Comilla Medical College (CoMC), Comilla",
      "Jessore Medical College (JMC), Jessore",
      "Cox's Bazar Medical College (CBMC), Cox's Bazar",
      "Sheikh Hasina Medical College, Tangail",
      "Shaheed Ziaur Rahman Medical College, Bogra",
      "M Abdur Rahim Medical College, Dinajpur",
      "Kushtia Medical College (KuMC), Kushtia",
      "Satkhira Medical College (SMC), Satkhira",
    ],
    army: [
      "Army Medical College Dhaka (AMCD), Dhaka",
      "Army Medical College Bogra (AMCB), Bogra",
      "Army Medical College Comilla (AMCC), Comilla",
      "Army Medical College Chattogram (AMCCH), Chattogram",
      "Army Medical College Jessore (AMCJ), Jessore",
      "Army Medical College Rangpur (AMCR), Rangpur",
    ],
    private: [
      "Bangladesh Medical College (BMC), Dhaka",
      "Ibrahim Medical College (BIRDEM), Dhaka",
      "Enam Medical College, Savar, Dhaka",
      "Holy Family Red Crescent Medical College, Dhaka",
      "Anwer Khan Modern Medical College, Dhaka",
      "National Medical College, Dhaka",
      "Z H Sikder Women's Medical College, Dhaka",
      "Ibrahim Cardiac Hospital & Research Institute, Dhaka",
      "Marks Medical College, Dhaka",
      "Popular Medical College, Dhaka",
      "Shahabuddin Medical College, Dhaka",
      "Eastern Medical College, Comilla",
      "Brahmanbaria Medical College, Brahmanbaria",
      "Community Based Medical College (CBMC), Mymensingh",
      "Jahurul Islam Medical College, Kishoreganj",
      "Tairunnessa Memorial Medical College, Gazipur",
      "Kumudini Women's Medical College, Tangail",
      "Medical College for Women & Hospital (MCWH), Dhaka",
      "Green Life Medical College, Dhaka",
      "North Bengal Medical College, Rajshahi",
      "Islami Bank Medical College, Rajshahi",
      "Rajshahi Community Medical College, Rajshahi",
      "Rangpur Community Medical College, Rangpur",
      "TMM Medical College, Bogra",
      "Parkview Medical College, Sylhet",
      "North East Medical College, Sylhet",
      "Jalalabad Ragib Rabeya Medical College, Sylhet",
      "Sylhet Women's Medical College, Sylhet",
      "Chittagong Maa-O-Shishu Hospital Medical College, Chittagong",
      "Southern Medical College, Chittagong",
      "International Medical College, Gazipur",
      "Uttara Adhunik Medical College, Dhaka",
      "Ad-din Women's Medical College, Dhaka",
      "Prime Medical College, Rangpur",
      "Pabna Medical College, Pabna",
      "Sheikh Sayera Khatun Medical College, Gopalganj",
      "Noakhali Medical College (NMC), Noakhali",
      "Khwaja Yunus Ali Medical College (KYAMC), Sirajganj",
      "Gazi Medical College (GMC), Khulna",
      "Monno Medical College, Manikganj",
      "MH Samorita Medical College, Dhaka",
      "BSMMU (Post-Graduate Institute)",
      "National Institute of Cardiovascular Diseases (NICVD)",
      "National Institute of Neurosciences (NINS)",
      "National Institute of Cancer Research & Hospital (NICRH)",
      "National Institute of Kidney Diseases & Urology (NIKDU)",
      "Bangabandhu Sheikh Mujib Medical University (BSMMU)",
    ],
  },

    getAllColleges() {
    return [
      ...this.MEDICAL_COLLEGES.govt,
      ...this.MEDICAL_COLLEGES.army,
      ...this.MEDICAL_COLLEGES.private,
    ];
  },

    populateSelect(selectId, options, placeholder = 'বেছে নিন') {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>` +
      options.map(o => `<option value="${o}">${o}</option>`).join('');
  },

    init() {
    const allColleges = this.getAllColleges();

    // Specialty selects
    ['search-specialty', 'doc-specialty', 'add-specialty', 'search-specialty-2'].forEach(id => {
      this.populateSelect(id, this.SPECIALTIES, 'সব Specialty');
    });

    // District selects
    ['search-district-2', 'doc-district', 'add-district', 'set-district'].forEach(id => {
      this.populateSelect(id, this.DISTRICTS, 'সব জেলা');
    });

    // Medical college selects
    ['doc-medical-college', 'add-medical-college'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<option value="">Medical College বেছে নিন</option>
        <optgroup label="─── সরকারি Medical College ───">
          ${this.MEDICAL_COLLEGES.govt.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>
        <optgroup label="─── Army Medical College ───">
          ${this.MEDICAL_COLLEGES.army.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>
        <optgroup label="─── বেসরকারি Medical College ───">
          ${this.MEDICAL_COLLEGES.private.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>`;
    });

    // Degree institution select (in degree builder)
    const instEl = document.getElementById('degree-institution');
    if (instEl) {
      instEl.innerHTML = `<option value="">Institution বেছে নিন</option>
        <optgroup label="─── সরকারি ───">
          ${this.MEDICAL_COLLEGES.govt.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>
        <optgroup label="─── Army ───">
          ${this.MEDICAL_COLLEGES.army.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>
        <optgroup label="─── বেসরকারি ───">
          ${this.MEDICAL_COLLEGES.private.map(c => `<option value="${c}">${c}</option>`).join('')}
        </optgroup>
        <optgroup label="─── বিদেশী ───">
          <option value="India (বিভিন্ন)">India (বিভিন্ন)</option>
          <option value="UK / Royal College">UK / Royal College</option>
          <option value="USA / American Board">USA / American Board</option>
          <option value="Australia">Australia</option>
          <option value="অন্যান্য বিদেশী">অন্যান্য বিদেশী</option>
        </optgroup>`;
    }
  },
};
