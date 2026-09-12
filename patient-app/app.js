const API = 'https://raghavendra-hearcare-api.onrender.com/api';
let session = null;
let portal = null;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const digits = value => String(value || '').replace(/\D/g, '');
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const fmtDate = value => value ? new Date(value).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}) : '—';
const dayKey = value => {
  const d = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const o = Object.fromEntries(parts.map(x => [x.type,x.value]));
  return `${o.year}-${o.month}-${o.day}`;
};
const statusTone = value => {
  const s = String(value || '').toLowerCase();
  if (s === 'paid' || ['delivered','completed','confirmed'].some(x => s.includes(x))) return 'green';
  if (['pending','progress','sent','partial','received','returned'].some(x => s.includes(x))) return 'amber';
  if (['reject','cancel'].some(x => s.includes(x))) return 'red';
  return 'blue';
};
const status = value => `<span class="status ${statusTone(value)}">${esc(value || '—')}</span>`;

async function api(path, options = {}) {
  const headers = {'Content-Type':'application/json', ...(options.headers || {})};
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(`${API}${path}`, {...options, headers});
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session) {
    clearSession();
    throw new Error('Your session expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

function saveSession(value) {
  session = value;
  localStorage.setItem('hearcare-patient-session', JSON.stringify(value));
}
function clearSession() {
  session = null;
  portal = null;
  localStorage.removeItem('hearcare-patient-session');
  $('portalView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
}
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2600);
}
function showError(id, message='') {
  const el = $(id);
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  showError('loginError');
  const button = $('loginBtn');
  button.disabled = true;
  button.textContent = 'Opening your care…';
  try {
    const patientCode = $('patientCode').value.trim().toUpperCase();
    const phone = digits($('phone').value);
    const result = await api('/auth/patient-login', {method:'POST', body:JSON.stringify({patientCode, phone})});
    saveSession(result);
    await openPortal();
  } catch (err) {
    showError('loginError', err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Open my care';
  }
});

$('logoutBtn').addEventListener('click', clearSession);
$('closeSheet').addEventListener('click', () => $('appointmentSheet').classList.add('hidden'));
$('appointmentSheet').addEventListener('click', e => { if (e.target === $('appointmentSheet')) $('appointmentSheet').classList.add('hidden'); });

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));

function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  $(`${name}Tab`).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${name}"]`).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

async function openPortal() {
  $('loginView').classList.add('hidden');
  $('portalView').classList.remove('hidden');
  $('homeTab').innerHTML = '<div class="empty">Loading your care…</div>';
  try {
    portal = await api('/portal');
    $('headerName').textContent = portal.patient?.name ? portal.patient.name.split(' ')[0] : 'My Care';
    renderAll();
    loadDoctors();
  } catch (err) {
    toast(err.message);
    if (!session) return;
    $('homeTab').innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

function renderAll() {
  renderHome();
  renderAppointments();
  renderRepairs();
  renderProfile();
}

function renderHome() {
  const p = portal.patient || {};
  const next = portal.nextAppointment;
  const follow = portal.nextFollowUp;
  const activeRepairs = (portal.repairs || []).filter(r => r.status !== 'Delivered');
  const latestVisits = (portal.visits || []).slice(0,4);
  $('homeTab').innerHTML = `
    <div class="hello"><p class="kicker">${esc(p.patientCode || 'MY HEARING CARE')}</p><h1>Hello, ${esc((p.name || 'there').split(' ')[0])}</h1><p>Your clinic record is synced securely with Raghavendra Speech & Hearing Center.</p></div>
    <div class="hero-card">
      <span class="label">NEXT APPOINTMENT</span>
      <h2>${next ? `${fmtDate(next.date)} · ${esc(next.time || '')}` : 'No visit booked'}</h2>
      <p>${next ? `${esc(next.purpose || 'Appointment')}${next.assignedDoctor ? ` · ${esc(next.assignedDoctor)}` : ''} · ${esc(next.status || '')}` : 'Request your next visit and reception will confirm the slot.'}</p>
      <button class="mini-btn" onclick="openAppointmentSheet()">${next ? 'Request another visit' : 'Request a visit'}</button>
    </div>
    <div class="metric-grid">
      <div class="metric"><span class="metric-label">Payment due</span><strong>${money(portal.balance)}</strong><small>${portal.balance ? 'Contact reception for payment details' : 'No outstanding dues'}</small></div>
      <div class="metric"><span class="metric-label">Active repairs</span><strong>${activeRepairs.length}</strong><small>Live service status</small></div>
      <div class="metric"><span class="metric-label">Hearing aids</span><strong>${(portal.hearingAids || []).length}</strong><small>Devices on your record</small></div>
      <div class="metric"><span class="metric-label">Follow-up</span><strong style="font-size:15px">${fmtDate(follow?.followUpDate)}</strong><small>${esc(follow?.purpose || 'No follow-up recorded')}</small></div>
    </div>
    <section class="section">
      <div class="section-head"><div><h2>Recent care</h2><p>Your latest clinic visits</p></div><button class="link-button" onclick="switchTab('appointments')">Visits</button></div>
      <div class="list">${latestVisits.length ? latestVisits.map(v => `
        <div class="item"><div class="item-icon">+</div><div class="item-main"><b>${esc(v.purpose || 'Clinic visit')}</b><span>${fmtDate(v.date)}${v.doctor ? ` · ${esc(v.doctor)}` : ''}${v.followUpDate ? ` · return ${fmtDate(v.followUpDate)}` : ''}</span></div></div>`).join('') : '<div class="empty">No visits recorded yet.</div>'}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Hearing aids</h2><p>Devices linked to your clinic record</p></div></div>
      <div class="list">${(portal.hearingAids || []).length ? portal.hearingAids.map(h => `
        <div class="item"><div class="item-icon">◖</div><div class="item-main"><b>${esc([h.brand,h.model].filter(Boolean).join(' ') || 'Hearing aid')}</b><span>${esc(h.ear || '')}${h.type ? ` · ${esc(h.type)}` : ''}${h.serialNumber ? ` · S/N ${esc(h.serialNumber)}` : ''}${h.warrantyEnd ? ` · warranty ${fmtDate(h.warrantyEnd)}` : ''}</span></div></div>`).join('') : '<div class="empty">No hearing aids recorded yet.</div>'}
      </div>
    </section>`;
}

function renderAppointments() {
  const rows = portal.appointments || [];
  $('appointmentsTab').innerHTML = `
    <div class="page-title"><h1>Appointments</h1><p>Requests are confirmed by clinic reception.</p></div>
    <button class="btn primary" style="margin:0 0 14px" onclick="openAppointmentSheet()">Request next visit</button>
    ${rows.length ? rows.map(a => `
      <article class="appointment-card">
        <div class="appointment-top"><div><h3>${fmtDate(a.date)} · ${esc(a.time || '')}</h3><p>${esc(a.purpose || 'Appointment')}${a.assignedDoctor ? ` · ${esc(a.assignedDoctor)}` : ''}</p></div>${status(a.status)}</div>
        ${['Pending','Confirmed'].includes(a.status) ? `<div class="appointment-actions"><button onclick="cancelAppointment('${esc(a.id)}')">Cancel appointment</button></div>` : ''}
      </article>`).join('') : '<div class="empty">No appointments yet.</div>'}`;
}

function repairProgress(value) {
  const order = ['Received','Sent','In Progress','Returned','Delivered'];
  const i = Math.max(0, order.indexOf(value));
  return Math.round(((i + 1) / order.length) * 100);
}
function renderRepairs() {
  const rows = portal.repairs || [];
  $('repairsTab').innerHTML = `
    <div class="page-title"><h1>Repairs</h1><p>Track your device from clinic intake to delivery.</p></div>
    ${rows.length ? rows.map(r => `
      <article class="repair-card">
        <div class="appointment-top"><div><h3>${esc([r.brand,r.model].filter(Boolean).join(' ') || 'Hearing aid repair')}</h3><p>${esc(r.issue || 'Service job')}</p></div>${status(r.status)}</div>
        <div class="repair-step"><span style="width:${repairProgress(r.status)}%"></span></div>
        <p>Received ${fmtDate(r.dateReceived)}${r.expectedReturn ? ` · expected ${fmtDate(r.expectedReturn)}` : ''}${r.sentTo ? ` · ${esc(r.sentTo)}` : ''}</p>
      </article>`).join('') : '<div class="empty">No repair jobs on your record.</div>'}`;
}

function renderProfile() {
  const p = portal.patient || {};
  const services = [...new Set((portal.visits || []).map(v => v.purpose).filter(Boolean))];
  $('profileTab').innerHTML = `
    <div class="page-title"><h1>My profile</h1><p>Details stored by the clinic.</p></div>
    <div class="profile-card">
      <div class="profile-row"><span>Patient ID</span><b>${esc(p.patientCode || '—')}</b></div>
      <div class="profile-row"><span>Name</span><b>${esc(p.name || '—')}</b></div>
      <div class="profile-row"><span>Mobile</span><b>${esc(p.phone || '—')}</b></div>
      <div class="profile-row"><span>City</span><b>${esc(p.city || '—')}</b></div>
      <div class="profile-row"><span>Last visit</span><b>${fmtDate(p.lastVisit)}</b></div>
      <div class="profile-row"><span>Current balance</span><b>${money(portal.balance)}</b></div>
    </div>
    <section class="section"><div class="section-head"><div><h2>Services on my record</h2><p>Based on completed clinic visits</p></div></div><div class="list">${services.length ? services.map(s => `<div class="item"><div class="item-icon">✓</div><div class="item-main"><b>${esc(s)}</b></div></div>`).join('') : '<div class="empty">No services recorded yet.</div>'}</div></section>
    <section class="section"><div class="section-head"><div><h2>Need help?</h2><p>Contact clinic reception</p></div></div><div class="list"><div class="item"><div class="item-icon">☎</div><div class="item-main"><b>Raghavendra Speech & Hearing Center</b><span>A S Rao Nagar · Hyderabad</span></div></div></div></section>`;
}

window.openAppointmentSheet = function openAppointmentSheet() {
  $('appointmentDate').min = dayKey();
  if (!$('appointmentDate').value) $('appointmentDate').value = dayKey();
  showError('appointmentError');
  $('appointmentSheet').classList.remove('hidden');
};

async function loadDoctors() {
  try {
    const doctors = await api('/doctors');
    const select = $('appointmentDoctor');
    select.innerHTML = '<option value="">Any available doctor</option>' + doctors.map(d => `<option>${esc(d.name)}</option>`).join('');
  } catch {}
}

$('appointmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  showError('appointmentError');
  const payload = {
    date: $('appointmentDate').value,
    time: $('appointmentTime').value,
    purpose: $('appointmentPurpose').value,
    assignedDoctor: $('appointmentDoctor').value,
    notes: $('appointmentNotes').value.trim()
  };
  try {
    await api('/portal/appointments', {method:'POST',body:JSON.stringify(payload)});
    $('appointmentSheet').classList.add('hidden');
    $('appointmentNotes').value = '';
    portal = await api('/portal');
    renderAll();
    toast('Appointment request sent');
    switchTab('appointments');
  } catch (err) { showError('appointmentError', err.message); }
});

window.cancelAppointment = async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await api(`/portal/appointments/${encodeURIComponent(id)}/cancel`, {method:'PATCH'});
    portal = await api('/portal');
    renderAll();
    toast('Appointment cancelled');
  } catch (err) { toast(err.message); }
};

(async function boot() {
  try {
    const stored = localStorage.getItem('hearcare-patient-session');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.user?.role === 'patient' && parsed?.token) {
        session = parsed;
        await openPortal();
      } else {
        localStorage.removeItem('hearcare-patient-session');
      }
    }
  } catch {
    localStorage.removeItem('hearcare-patient-session');
  }
})();
