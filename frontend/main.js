/* =============================================
  HomoDentHealth — Shared JavaScript
   ============================================= */

// ── Mobile menu toggle ──────────────────────────
(function() {
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', menu.classList.contains('open'));
    });
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }
})();

// ── Active nav link ──────────────────────────────
(function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

// ── Local storage helpers ────────────────────────
const Store = {
  save(key, value) {
    try { localStorage.setItem('dc_' + key, JSON.stringify(value)); } catch (e) {}
  },
  load(key) {
    try {
      const v = localStorage.getItem('dc_' + key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  },
  clear(key) {
    try { localStorage.removeItem('dc_' + key); } catch (e) {}
  }
};

// ── API helper ────────────────────────────────────
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'http://localhost:4000';

async function apiFetch(path, options = {}) {
  const token = Store.load('access_token');
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );
  const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function currentUser() { return Store.load('user'); }

const DASHBOARD_BY_ROLE = {
  admin: 'admin.html',
  dentist: 'dentist.html',
  clinic_manager: 'clinic-admin.html',
  user: 'dashboard.html',
  content_admin: 'content-admin.html',
  live_chat_agent: 'livechat-admin.html'
};

function dashboardUrlForRole(role) {
  return DASHBOARD_BY_ROLE[role] || 'dashboard.html';
}

// Redirects to auth.html if not logged in (or wrong role, if allowedRoles given).
// Returns the cached user object on success.
function requireAuth(allowedRoles) {
  const token = Store.load('access_token');
  const user = Store.load('user');
  if (!token || !user) {
    window.location.href = 'auth.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = dashboardUrlForRole(user.role);
    return null;
  }
  return user;
}

function logout() {
  Store.clear('access_token');
  Store.clear('refresh_token');
  Store.clear('user');
  window.location.href = 'auth.html';
}

// Swap the nav's Login/Register links for Dashboard/Logout when signed in.
// Works without touching each page's markup — finds links pointing at auth.html.
(function updateNavForAuthState() {
  const user = currentUser();
  const token = Store.load('access_token');
  if (!token || !user) return;

  const dashHref = dashboardUrlForRole(user.role);

  document.querySelectorAll('.nav-actions, .m-actions').forEach(wrap => {
    const links = Array.from(wrap.querySelectorAll('a[href="auth.html"]'));
    if (!links.length) return;
    links[0].textContent = 'Dashboard';
    links[0].href = dashHref;
    if (links[1]) {
      links[1].textContent = 'Logout';
      links[1].href = '#';
      links[1].addEventListener('click', e => { e.preventDefault(); logout(); });
    }
  });
})();

// ── Symptom Assessment Engine (instant client-side result) ──
const TriageEngine = {
  assess(data) {
    // Emergency detection — highest priority
    if (data.difficultyBreathing || data.severeBleed) {
      return {
        level: 'emergency',
        levelLabel: '🚨 Emergency',
        condition: 'Life-threatening Dental Emergency',
        details: 'Difficulty breathing or severe uncontrolled bleeding requires immediate emergency care.',
        action: 'Call emergency services (112) or go to the nearest hospital ER immediately.',
        homeCare: [],
        color: '#A51C30'
      };
    }
    if (data.facialSwelling && data.fever && data.severePain) {
      return {
        level: 'emergency',
        levelLabel: '🚨 Emergency',
        condition: 'Possible Dental Abscess with Systemic Spread',
        details: 'Combination of facial swelling, fever, and severe pain suggests a spreading infection that can be life-threatening.',
        action: 'Seek emergency dental or hospital care immediately. Do not wait.',
        homeCare: [],
        color: '#A51C30'
      };
    }
    if (data.trauma) {
      return {
        level: 'severe',
        levelLabel: '⚠️ Urgent',
        condition: 'Dental Trauma',
        details: 'Physical injury to teeth or jaw needs prompt professional assessment.',
        action: 'Visit a dentist or emergency dental clinic within the next few hours. Keep any knocked-out tooth in milk or saline.',
        homeCare: ['Apply gentle pressure for bleeding', 'Rinse gently with clean water', 'Avoid hot/cold foods', 'Keep the tooth moist if knocked out'],
        color: '#DC3545'
      };
    }

    // Abscess pattern
    if (data.swelling && data.fever && data.throbbingPain) {
      return {
        level: 'severe',
        levelLabel: '⚠️ Urgent',
        condition: 'Possible Dental Abscess',
        details: 'Throbbing pain with swelling and fever strongly suggests a dental abscess — a bacterial infection requiring antibiotics and dental treatment.',
        action: 'See a dentist urgently today or tomorrow. Do not delay — infection can spread.',
        homeCare: ['Warm salt-water rinse every 2 hours', 'OTC pain reliever (paracetamol)', 'Avoid very hot or cold food', 'Do not apply heat to the face'],
        color: '#DC3545'
      };
    }

    // Moderate conditions
    if (data.coldSensitivity && data.painOnBiting) {
      return {
        level: 'moderate',
        levelLabel: '🔶 Moderate',
        condition: 'Possible Dental Caries (Cavity) — Moderate Stage',
        details: 'Sensitivity to cold and pain on biting suggests a cavity that has progressed into the dentin. Filling or root treatment may be needed.',
        action: 'Schedule a dental appointment within the next 1–2 weeks.',
        homeCare: ['Use sensitivity toothpaste', 'Avoid very cold, hot, or sweet foods', 'Brush gently twice daily with fluoride toothpaste', 'Rinse with antiseptic mouthwash'],
        color: '#D97706'
      };
    }
    if (data.bleedingGums && data.swollenGums) {
      return {
        level: 'moderate',
        levelLabel: '🔶 Moderate',
        condition: 'Possible Gingivitis / Early Periodontal Disease',
        details: 'Bleeding and swollen gums indicate inflammation of the gum tissue, often due to plaque buildup. Treatable with professional cleaning.',
        action: 'Book a dental check-up and professional scaling within 1–2 weeks.',
        homeCare: ['Brush teeth gently twice daily', 'Floss once daily', 'Use antibacterial mouthwash', 'Increase water intake', 'Reduce sugary snacks'],
        color: '#D97706'
      };
    }
    if (data.jawPain) {
      return {
        level: 'moderate',
        levelLabel: '🔶 Moderate',
        condition: 'Possible TMJ (Temporomandibular Joint) Disorder',
        details: 'Pain in the jaw joint area could indicate TMJ disorder, teeth grinding, or referred pain from other dental issues.',
        action: 'Schedule a dental appointment within 1–2 weeks for evaluation.',
        homeCare: ['Soft diet only', 'Avoid wide mouth opening (yawning, large bites)', 'Apply warm compress to jaw', 'Over-the-counter anti-inflammatories if tolerated'],
        color: '#D97706'
      };
    }
    if (data.coldSensitivity) {
      return {
        level: 'moderate',
        levelLabel: '🔶 Moderate',
        condition: 'Possible Early Dental Caries or Dentin Hypersensitivity',
        details: 'Cold sensitivity is an early warning sign of tooth decay or exposed dentin. Early treatment prevents progression.',
        action: 'Schedule a routine dental check-up within 2–4 weeks.',
        homeCare: ['Switch to sensitivity toothpaste', 'Avoid acidic drinks (sodas, citrus)', 'Use a soft-bristle toothbrush', 'Fluoride rinse after brushing'],
        color: '#D97706'
      };
    }
    if (data.badBreath && data.bleedingGums) {
      return {
        level: 'moderate',
        levelLabel: '🔶 Moderate',
        condition: 'Possible Periodontal Infection',
        details: 'Persistent bad breath combined with bleeding gums may indicate gum disease or underlying infection.',
        action: 'Schedule a dental check-up soon.',
        homeCare: ['Thorough brushing of teeth and tongue', 'Daily flossing', 'Antiseptic mouthwash', 'Stay well hydrated', 'Reduce sugary and processed foods'],
        color: '#D97706'
      };
    }

    // Mild
    if (data.badBreath) {
      return {
        level: 'mild',
        levelLabel: '✅ Mild',
        condition: 'Poor Oral Hygiene / Possible Minor Infection',
        details: 'Persistent bad breath can result from plaque buildup, dry mouth, dietary habits, or minor infection.',
        action: 'Improve oral hygiene routine. Visit a dentist for a check-up if persisting beyond 2 weeks.',
        homeCare: ['Brush teeth and tongue twice daily', 'Floss daily', 'Drink more water', 'Use antibacterial mouthwash', 'Reduce garlic, onion, coffee intake'],
        color: '#2E9B6B'
      };
    }
    if (data.mildPain) {
      return {
        level: 'mild',
        levelLabel: '✅ Mild',
        condition: 'Minor Dental Discomfort',
        details: 'Mild, occasional pain may be caused by minor irritation, food impaction, or early-stage sensitivity.',
        action: 'Monitor for 2–3 days. Schedule a routine dental check if symptoms persist.',
        homeCare: ['Warm salt-water rinse 2–3 times daily', 'Gentle brushing with soft brush', 'Avoid very hard, sticky, or sweet foods', 'OTC pain reliever if needed'],
        color: '#2E9B6B'
      };
    }

    // Default
    return {
      level: 'mild',
      levelLabel: '✅ Routine',
      condition: 'Routine Dental Check-Up Recommended',
      details: 'No urgent dental concern detected based on the symptoms provided. Regular dental visits prevent problems from developing.',
      action: 'Schedule a routine dental check-up every 6 months.',
      homeCare: ['Brush twice daily with fluoride toothpaste and gently from gum line', 'Floss once daily', 'Reduce sugary drinks and snacks', 'Take self cleansing fruit e.g Water melon, Cucumber', 'Use warm water and salt to gargle your mouth', 'Attend regular dental check-ups'],
      color: '#2E9B6B'
    };
  }
};

// ── Assessment Page ──────────────────────────────
(function initAssessment() {
  const form = document.getElementById('assessment-form');
  if (!form) return;

  let currentStep = 1;
  const totalSteps = 5;
  const data = {};

  function showStep(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    const stepEl = document.getElementById('step-' + n);
    if (stepEl) stepEl.classList.add('active');
    document.getElementById('step-counter').textContent = `Step ${n} of ${totalSteps}`;
    const pct = ((n - 1) / (totalSteps - 1)) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  function nextStep() {
    if (collectStep(currentStep)) {
      currentStep = Math.min(currentStep + 1, totalSteps);
      showStep(currentStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function prevStep() {
    currentStep = Math.max(currentStep - 1, 1);
    showStep(currentStep);
  }

  function collectStep(n) {
    if (n === 1) {
      const name = document.getElementById('pt-name');
      const age = document.getElementById('pt-age');
      if (!name || !name.value.trim()) { showError('err-name', 'Please enter your name.'); return false; }
      clearError('err-name');
      data.name = name.value.trim();
      data.age = age ? age.value : '';
      data.gender = document.querySelector('input[name="gender"]:checked')?.value || '';
      data.medicalConditions = document.getElementById('pt-medical')?.value || '';
      return true;
    }
    if (n === 2) {
      const sel = document.querySelectorAll('.complaint-option.selected');
      if (!sel.length) { showError('err-complaint', 'Please select at least one symptom.'); return false; }
      clearError('err-complaint');
      data.complaints = [...sel].map(el => el.dataset.value);
      return true;
    }
    if (n === 3) {
      data.painLocation = document.querySelector('input[name="pain-location"]:checked')?.value || '';
      data.painType = document.querySelector('input[name="pain-type"]:checked')?.value || '';
      data.throbbingPain = !!document.getElementById('chk-throbbing')?.checked;
      data.coldSensitivity = !!document.getElementById('chk-cold')?.checked;
      data.painOnBiting = !!document.getElementById('chk-biting')?.checked;
      data.bleedingGums = !!document.getElementById('chk-bleeding')?.checked;
      data.swollenGums = !!document.getElementById('chk-swollen-gums')?.checked;
      data.jawPain = !!document.getElementById('chk-jaw')?.checked;
      data.badBreath = !!document.getElementById('chk-breath')?.checked;
      data.mildPain = data.complaints?.includes('tooth-pain') && !data.throbbingPain;
      return true;
    }
    if (n === 4) {
      data.facialSwelling = !!document.getElementById('chk-facial-swelling')?.checked;
      data.difficultyBreathing = !!document.getElementById('chk-breathing')?.checked;
      data.severeBleed = !!document.getElementById('chk-severe-bleed')?.checked;
      data.fever = !!document.getElementById('chk-fever')?.checked;
      data.swelling = !!document.getElementById('chk-swelling')?.checked;
      data.severePain = !!document.getElementById('chk-severe-pain')?.checked;
      data.trauma = !!document.getElementById('chk-trauma')?.checked;
      return true;
    }
    return true;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearError(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; }
  }

  document.querySelectorAll('.complaint-option').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('selected'));
  });

  document.querySelectorAll('.btn-next').forEach(btn => btn.addEventListener('click', nextStep));
  document.querySelectorAll('.btn-prev').forEach(btn => btn.addEventListener('click', prevStep));

  const submitBtn = document.getElementById('btn-submit-assessment');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      collectStep(4);
      const result = TriageEngine.assess(data);
      data.result = result;
      Store.save('assessment', data);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';

      // Persist to the backend so it's visible on the dashboard and to clinic
      // staff. Works for guests too — falls back gracefully if it fails so the
      // person still sees their result either way.
      try {
        const symptoms = {
          difficultyBreathing: data.difficultyBreathing, severeBleed: data.severeBleed,
          facialSwelling: data.facialSwelling, fever: data.fever, severePain: data.severePain,
          trauma: data.trauma, swelling: data.swelling, throbbingPain: data.throbbingPain,
          coldSensitivity: data.coldSensitivity, painOnBiting: data.painOnBiting,
          bleedingGums: data.bleedingGums, swollenGums: data.swollenGums,
          jawPain: data.jawPain, badBreath: data.badBreath, mildPain: data.mildPain
        };
        const res = await apiFetch('/api/assessment', {
          method: 'POST',
          body: JSON.stringify({
            patientName: data.name,
            age: data.age,
            gender: data.gender,
            medicalConditions: data.medicalConditions,
            symptoms,
            selectedConditions: data.complaints
          })
        });
        if (res && res.assessment && res.assessment.id) {
          Store.save('assessment_id', res.assessment.id);
        }
      } catch (e) {
        Store.clear('assessment_id');
      }

      window.location.href = 'results.html';
    });
  }

  showStep(1);
})();

// ── Results Page ─────────────────────────────────
(function initResults() {
  const resultWrap = document.getElementById('result-content');
  if (!resultWrap) return;

  const assessment = Store.load('assessment');
  if (!assessment || !assessment.result) {
    resultWrap.innerHTML = `<div class="alert alert-warning"><span class="alert-icon">⚠️</span><div>No assessment data found. <a href="assessment.html" class="text-primary fw-600">Start a new assessment</a>.</div></div>`;
    return;
  }

  const r = assessment.result;
  const levelColors = { emergency: '#A51C30', severe: '#DC3545', moderate: '#D97706', mild: '#2E9B6B' };
  const levelBg = { emergency: '#FCE4E8', severe: '#FEE2E2', moderate: '#FEF3C7', mild: '#D1FAE5' };

  const homeCareHtml = r.homeCare.length
    ? r.homeCare.map(h => `<li style="padding:6px 0;border-bottom:1px solid #F0F7F7;font-size:0.875rem;color:#1C2B2D">✔ ${h}</li>`).join('')
    : '';

  const assessmentId = Store.load('assessment_id');
  const referralParam = assessmentId ? `?referralId=${encodeURIComponent(assessmentId)}` : '';
  const savedNotice = assessmentId
    ? `<p style="text-align:center;font-size:0.8rem;color:#5A7477;margin-top:-12px;margin-bottom:24px;">✔ Saved${currentUser() ? ' to your account' : ' — sign in to view it later from your dashboard'}</p>`
    : '';

  resultWrap.innerHTML = `
    <div style="text-align:center;margin-bottom:12px;">
      <div style="display:inline-flex;align-items:center;gap:10px;background:${levelBg[r.level]};color:${levelColors[r.level]};font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:1.1rem;padding:12px 28px;border-radius:100px;margin-bottom:20px;">
        ${r.levelLabel}
      </div>
      <h2 style="margin-bottom:8px;">${r.condition}</h2>
      <p style="max-width:560px;margin:0 auto;">${r.details}</p>
    </div>
    ${savedNotice}

    <div class="alert ${r.level === 'emergency' ? 'alert-danger' : r.level === 'severe' ? 'alert-danger' : r.level === 'moderate' ? 'alert-warning' : 'alert-success'}" style="margin-bottom:28px;">
      <span class="alert-icon">${r.level === 'emergency' || r.level === 'severe' ? '🚨' : r.level === 'moderate' ? '⚕️' : '✅'}</span>
      <div><strong>Recommended Action:</strong><br>${r.action}</div>
    </div>

    ${r.homeCare.length ? `
    <div class="card" style="margin-bottom:28px;">
      <h3 style="margin-bottom:16px;">🏠 Home Care Advice</h3>
      <ul>${homeCareHtml}</ul>
    </div>` : ''}

    <div class="alert alert-info">
      <span class="alert-icon">ℹ️</span>
      <div><strong>Important Disclaimer:</strong> This is <em>not</em> a medical diagnosis. Results are based on the symptoms you reported and should not replace professional dental evaluation. Always consult a licensed dental professional.</div>
    </div>

    <div style="display:flex;gap:14px;margin-top:32px;flex-wrap:wrap;">
      <a href="clinics.html" class="btn btn-primary btn-lg">🏥 Find Nearest Clinic</a>
      <a href="appointment.html${referralParam}" class="btn btn-secondary btn-lg">📅 Book Appointment</a>
      <a href="assessment.html" class="btn btn-ghost btn-lg">↺ New Assessment</a>
    </div>
  `;

  const nameEl = document.getElementById('patient-name');
  if (nameEl && assessment.name) nameEl.textContent = assessment.name;
})();

// ── Contact form ─────────────────────────────────
(function initContact() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('c-name')?.value,
          email: document.getElementById('c-email')?.value,
          phone: document.getElementById('c-phone')?.value,
          subject: document.getElementById('c-subject')?.value,
          message: document.getElementById('c-message')?.value
        })
      });
      const success = document.getElementById('contact-success');
      if (success) { success.style.display = 'flex'; form.style.display = 'none'; }
    } catch (err) {
      alert(err.message || 'Could not send your message. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  });
})();
