'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarDays, CreditCard, HeartPulse, LogOut, Menu, Package, Plus,
  Search, Stethoscope, Users, Wrench, ChevronRight, Clock3, BadgeIndianRupee,
  Boxes, AlertTriangle, X, Phone, MapPin, ClipboardPlus, ShoppingBag, Bell,
  ShieldCheck, Ear, MessageCircle, Smartphone, UserCog, Send, CalendarPlus,
  CircleDollarSign, CheckCircle2
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = v => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
const fullDate = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());
const greeting = () => { const h = Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date())); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const todayInputDate = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const o = Object.fromEntries(p.map(({ type, value }) => [type, value])); return `${o.year}-${o.month}-${o.day}`; };
const phoneDigits = v => String(v || '').replace(/\D/g, '');
const waUrl = (phone, message = '') => `https://wa.me/${phoneDigits(phone).startsWith('91') ? phoneDigits(phone) : `91${phoneDigits(phone)}`}?text=${encodeURIComponent(message)}`;

async function api(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && typeof window !== 'undefined') { localStorage.removeItem('hearcare-session'); window.location.replace('/'); return; }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function Status({ value }) {
  const s = String(value || '').toLowerCase();
  const tone = s === 'paid' || ['delivered', 'completed', 'confirmed'].some(x => s.includes(x)) ? 'green' : ['pending', 'progress', 'sent', 'partial', 'received', 'returned'].some(x => s.includes(x)) ? 'amber' : ['reject', 'cancel'].some(x => s.includes(x)) ? 'red' : 'blue';
  return <span className={`status ${tone}`}>{value}</span>;
}
function Empty({ children }) { return <div className="empty-state">{children}</div>; }
function Loading() { return <div className="loading"><div className="spinner"/><p>Loading clinic data…</p></div>; }
function Modal({ title, subtitle, onClose, children }) { return <div className="modal-layer"><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn modal-close" onClick={onClose}><X/></button></div>{children}</div></div>; }
function PageHead({ eyebrow, title, copy, action }) { return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div>; }
function ContactActions({ phone, message, compact = false }) {
  if (!phone) return null;
  return <div className={`contact-actions ${compact ? 'compact' : ''}`} onClick={e => e.stopPropagation()}>
    <a className="contact-btn" href={`tel:${phoneDigits(phone)}`} title="Call"><Phone size={15}/>{!compact && 'Call'}</a>
    <a className="contact-btn whatsapp" href={waUrl(phone, message)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={15}/>{!compact && 'WhatsApp'}</a>
    <a className="contact-btn" href={`sms:${phoneDigits(phone)}?body=${encodeURIComponent(message || '')}`} title="SMS"><Smartphone size={15}/>{!compact && 'SMS'}</a>
  </div>;
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = mode === 'staff'
        ? await api('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password }) })
        : await api('/auth/patient-login', '', { method: 'POST', body: JSON.stringify({ patientCode, phone }) });
      onLogin(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <main className="login-shell">
    <section className="login-brand">
      <div className="official-badge"><div className="ear-mark"><Ear size={34}/></div><div><strong>RAGHAVENDRA</strong><span>Speech & Hearing Center</span></div></div>
      <div className="hero-copy"><span className="eyebrow">HEARCARE PRO</span><h1>Clinical care, service tracking and billing in one secure workspace.</h1><p>Diagnostics, fittings, repairs, appointments, billing and patient history for your clinic team.</p><div className="hero-pills"><span>Since 2010</span><span>Audiology + Hearing Aids</span><span>A S Rao Nagar</span></div></div>
      <div className="login-foot">Raghavendra Speech and Hearing Center · Hyderabad</div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div><span className="eyebrow">CLINIC WORKSPACE</span><h2>Sign in</h2><p className="muted">Secure access for staff and patients.</p></div>
        <div className="login-tabs"><button type="button" className={mode === 'staff' ? 'active' : ''} onClick={() => { setMode('staff'); setError(''); }}>Staff</button><button type="button" className={mode === 'patient' ? 'active' : ''} onClick={() => { setMode('patient'); setError(''); }}>Patient</button></div>
        {mode === 'staff' ? <>
          <label>Email<input suppressHydrationWarning autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@clinic.com"/></label>
          <label>Password<input suppressHydrationWarning autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Your password"/></label>
        </> : <>
          <label>Patient ID<input suppressHydrationWarning value={patientCode} onChange={e => setPatientCode(e.target.value.toUpperCase())} placeholder="RSH-000001"/></label>
          <label>Registered mobile number<input suppressHydrationWarning inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile used at the clinic"/></label>
          <p className="login-help">For privacy, patient access uses both your unique patient ID and the mobile number registered with the clinic.</p>
        </>}
        {error && <div className="error">{error}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Signing in…' : mode === 'staff' ? 'Sign in securely' : 'Open my care portal'}</button>
        {DEMO_MODE && <div className="muted center">Demo mode enabled</div>}
      </form>
    </section>
  </main>;
}

const baseNav = [
  ['dashboard','Overview',Activity], ['patients','Patients',Users], ['appointments','Appointments',CalendarDays],
  ['repairs','Repairs',Wrench], ['payments','Payments',CreditCard], ['followups','Follow-ups',MessageCircle],
  ['inventory','Inventory',Package], ['team','Team',UserCog]
];
function navFor(role) {
  if (role === 'patient') return [['portal','My Care',HeartPulse]];
  if (role === 'doctor') return baseNav.filter(([id]) => ['dashboard','patients','appointments','repairs'].includes(id));
  if (role === 'receptionist') return baseNav.filter(([id]) => !['team'].includes(id));
  return baseNav;
}

function Shell({ session, onLogout }) {
  const [view, setView] = useState(session.user.role === 'patient' ? 'portal' : 'dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const allowed = navFor(session.user.role);
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="side-brand"><div className="ear-mark small"><Ear size={22}/></div><div><b>Raghavendra</b><span>Speech & Hearing Center</span></div></div>
      <nav>{allowed.map(([id,label,Icon]) => <button key={id} className={view===id?'active':''} onClick={() => { setView(id); setMobileOpen(false); }}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="clinic-meta"><ShieldCheck size={16}/><span>HearCare Pro<br/><small>{session.user.role === 'patient' ? 'Patient portal' : 'Clinic workspace'}</small></span></div>
      <div className="side-bottom"><div className="user-mini"><div className="avatar">{session.user.name?.[0]}</div><div><b>{session.user.name}</b><span>{session.user.role}</span></div></div><button className="icon-btn" onClick={onLogout}><LogOut size={18}/></button></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><button className="menu" onClick={() => setMobileOpen(v => !v)}><Menu/></button><div className="top-title"><b>Raghavendra Speech and Hearing Center</b><span>A S Rao Nagar · Hyderabad</span></div><div className="top-actions"><span className="today-chip">{fullDate()}</span><button className="icon-btn"><Bell size={18}/></button><div className="avatar">{session.user.name?.[0]}</div></div></header>
      <div className="content">
        {view==='dashboard'&&<Dashboard token={session.token} user={session.user} setView={setView}/>} 
        {view==='patients'&&<Patients token={session.token} role={session.user.role} user={session.user}/>} 
        {view==='appointments'&&<Appointments token={session.token} role={session.user.role}/>} 
        {view==='repairs'&&<Repairs token={session.token}/>} 
        {view==='payments'&&<Payments token={session.token}/>} 
        {view==='followups'&&<FollowUps token={session.token}/>} 
        {view==='inventory'&&<Inventory token={session.token} role={session.user.role}/>} 
        {view==='team'&&<Team token={session.token}/>} 
        {view==='portal'&&<PatientPortal token={session.token}/>} 
      </div>
    </section>
  </div>;
}

function Dashboard({ token, user, setView }) {
  const [d,setD] = useState(null);
  useEffect(() => { api('/dashboard', token).then(setD).catch(console.error); }, [token]);
  if (!d) return <Loading/>;
  const allCards = [
    ['Patients',d.totalPatients,Users,'active clinic records','patients'],
    ['Appointments today',d.todayAppointments,CalendarDays,`${d.completedAppointments} completed · ${d.confirmedAppointments} confirmed`,'appointments'],
    ['Revenue this month',money(d.monthlyRevenue),BadgeIndianRupee,'actual collections this month','payments'],
    ['Outstanding',money(d.pendingPayments),CreditCard,`${d.pendingPaymentPatients} patients with dues`,'payments'],
    ['Active repairs',d.repairsInProgress,Wrench,`${d.repairsReady} ready/returned`,'repairs'],
    ['Low stock',d.lowStock,Boxes,'items at reorder level','inventory']
  ];
  const cards = user.role === 'doctor' ? allCards.filter(([l]) => ['Patients','Appointments today','Active repairs'].includes(l)) : allCards;
  return <>
    <div className="dashboard-hero"><div><span className="eyebrow">{fullDate().toUpperCase()}</span><h1>{greeting()}, {user.name?.split(' ')[0]} 👋</h1><p>{d.todayAppointments ? `${d.todayAppointments} appointments scheduled today.` : 'No appointments scheduled today.'} Everything below is calculated live from clinic data.</p></div>{user.role !== 'doctor' && <button className="primary" onClick={() => setView('patients')}><Plus size={17}/> New patient</button>}</div>
    <div className="quick-search" onClick={() => setView('patients')}><Search size={20}/><div><b>Search a patient</b><span>Name · phone · patient ID · hearing-aid serial number</span></div><ChevronRight/></div>
    <div className={`metric-grid ${cards.length <= 3 ? 'compact-grid' : ''}`}>{cards.map(([l,v,I,s,target]) => <div className="metric clickable" key={l} onClick={() => setView(target)}><div className="metric-icon"><I size={21}/></div><span>{l}</span><b>{v}</b><small>{s}</small></div>)}</div>
    <div className="two-col">
      <section className="card"><div className="card-head"><div><h3>Today’s clinic</h3><p>Appointments for {fullDate()}</p></div><button className="text-btn" onClick={() => setView('appointments')}>Open schedule <ChevronRight size={16}/></button></div><div className="list">{d.recentAppointments?.length ? d.recentAppointments.map(a => <div className="row" key={a.id}><div className="timebox"><Clock3 size={16}/><b>{a.time}</b></div><div className="grow"><b>{a.patientName}</b><span>{a.purpose}{a.assignedDoctor ? ` · ${a.assignedDoctor}` : ''}</span></div><Status value={a.status}/></div>) : <Empty>No appointments today.</Empty>}</div></section>
      <section className="card"><div className="card-head"><div><h3>Service desk</h3><p>Active hearing-aid repairs</p></div><button className="text-btn" onClick={() => setView('repairs')}>Repair board <ChevronRight size={16}/></button></div><div className="list">{d.recentRepairs?.length ? d.recentRepairs.map(r => <div className="row" key={r.id}><div className="circle"><Wrench size={16}/></div><div className="grow"><b>{r.patientName}</b><span>{r.brand} {r.model} · {r.issue}</span></div><Status value={r.status}/></div>) : <Empty>No active repairs.</Empty>}</div></section>
    </div>
  </>;
}

function Patients({ token, role, user }) {
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[selected,setSelected]=useState(null),[show,setShow]=useState(false);
  const load=()=>api(`/patients?q=${encodeURIComponent(q)}`,token).then(setItems);
  useEffect(()=>{load();},[q]);
  const open=async id=>setSelected(await api(`/patients/${id}`,token));
  const canCreate = ['admin','receptionist'].includes(role);
  return <>
    <PageHead eyebrow="PATIENT RECORDS" title="Patients" copy="Search by name, phone, patient ID or hearing-aid serial number." action={canCreate?<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> New patient</button>:null}/>
    <section className="card"><div className="search"><Search size={19}/><input placeholder="Search patients, phone, RSH-000001 or serial number…" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Phone</th><th>Last visit</th><th>Outstanding</th><th>Contact</th><th/></tr></thead><tbody>{items.map(p=><tr key={p.id} onClick={()=>open(p.id)}><td><div className="person"><div className="avatar soft">{p.name?.[0]}</div><div><b>{p.name}</b><span>{p.age?`${p.age} yrs · `:''}{p.gender||''}</span></div></div></td><td><span className="code-pill">{p.patientCode||'—'}</span></td><td>{p.phone}</td><td>{fmtDate(p.lastVisit)}</td><td>{money(p.balance)}</td><td><ContactActions compact phone={p.phone} message={`Hello ${p.name}, this is Raghavendra Speech & Hearing Center.`}/></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div></section>
    {selected&&<PatientDrawer patient={selected} token={token} role={role} user={user} onClose={()=>setSelected(null)} onRefresh={()=>open(selected.id)}/>} 
    {show&&<PatientModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}
  </>;
}

function PatientDrawer({ patient, token, role, user, onClose, onRefresh }) {
  const [visitOpen,setVisitOpen]=useState(false),[testOpen,setTestOpen]=useState(false),[aidOpen,setAidOpen]=useState(false);
  const clinical = ['admin','doctor'].includes(role);
  const latestVisit = patient.visits?.[0];
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="drawer">
    <div className="drawer-head"><button className="icon-btn" onClick={onClose}><X/></button></div>
    <div className="patient-hero"><div className="avatar xl">{patient.name?.[0]}</div><div className="grow"><span className="eyebrow">{patient.patientCode||'PATIENT PROFILE'}</span><h2>{patient.name}</h2><p><Phone size={15}/> {patient.phone} {patient.city&&<> · <MapPin size={15}/> {patient.city}</>}</p></div><ContactActions phone={patient.phone} message={`Hello ${patient.name}, this is Raghavendra Speech & Hearing Center.`}/></div>
    <div className="mini-stats"><div><span>Last visit</span><b>{fmtDate(patient.lastVisit)}</b></div><div><span>Outstanding</span><b>{money(patient.balance)}</b></div><div><span>Next follow-up</span><b>{fmtDate(latestVisit?.followUpDate)}</b></div></div>
    <div className="section-title"><div><h3>Care timeline</h3><p>Services, clinical notes and follow-ups</p></div>{clinical&&<button className="secondary" onClick={()=>setVisitOpen(true)}><ClipboardPlus size={16}/> Add visit</button>}</div>
    <div className="timeline">{patient.visits?.length?patient.visits.map(v=><div className="event" key={v.id}><div className="dot"/><div><div className="event-top"><b>{v.purpose}</b><span>{fmtDate(v.date)}</span></div><p>{v.notes||'No notes added.'}</p><small>{v.doctor}{v.followUpDate ? ` · Follow-up ${fmtDate(v.followUpDate)}` : ''}</small></div></div>):<Empty>No visits yet.</Empty>}</div>
    <div className="drawer-block"><div className="section-title"><div><h3>Appointments</h3><p>Scheduled and requested visits</p></div></div>{patient.appointments?.length?patient.appointments.slice(0,5).map(a=><div className="row compact" key={a.id}><div className="circle"><CalendarDays size={16}/></div><div className="grow"><b>{a.purpose}</b><span>{fmtDate(a.date)} · {a.time}{a.assignedDoctor ? ` · ${a.assignedDoctor}` : ''}</span></div><Status value={a.status}/></div>):<p className="empty-note">No appointments recorded.</p>}</div>
    <div className="drawer-block"><div className="section-title"><div><h3>Audiology</h3><p>PTA, impedance, BERA, OAE, ECOG</p></div>{clinical&&<button className="secondary" onClick={()=>setTestOpen(true)}><Plus size={15}/> Add test</button>}</div>{patient.hearingTests?.length?patient.hearingTests.map(t=><div className="row compact" key={t.id}><div className="circle"><Stethoscope size={16}/></div><div className="grow"><b>{t.testType}</b><span>{fmtDate(t.date)} · R: {t.rightEar||'—'} · L: {t.leftEar||'—'}</span></div></div>):<p className="empty-note">No tests recorded.</p>}</div>
    <div className="drawer-block"><div className="section-title"><div><h3>Hearing aids</h3><p>Fittings, serial numbers and warranty</p></div>{clinical&&<button className="secondary" onClick={()=>setAidOpen(true)}><Plus size={15}/> Add device</button>}</div>{patient.hearingAids?.length?patient.hearingAids.map(h=><div className="row compact" key={h.id}><div className="circle"><Ear size={16}/></div><div className="grow"><b>{h.brand} {h.model} · {h.ear}</b><span>{h.type} · S/N {h.serialNumber||'—'} · fitted {fmtDate(h.fittingDate)} · warranty {fmtDate(h.warrantyEnd)}</span></div><b>{money(h.price)}</b></div>):<p className="empty-note">No devices recorded.</p>}</div>
    <div className="drawer-block"><div className="section-title"><div><h3>Repairs</h3><p>Live service status</p></div></div>{patient.repairs?.length?patient.repairs.map(r=><div className="row compact" key={r.id}><div className="circle"><Wrench size={16}/></div><div className="grow"><b>{r.brand} {r.model}</b><span>{r.issue}</span></div><Status value={r.status}/></div>):<p className="empty-note">No repairs recorded.</p>}</div>
    {visitOpen&&<VisitModal patientId={patient.id} token={token} user={user} onClose={()=>setVisitOpen(false)} onSaved={()=>{setVisitOpen(false);onRefresh();}}/>}
    {testOpen&&<TestModal patientId={patient.id} token={token} onClose={()=>setTestOpen(false)} onSaved={()=>{setTestOpen(false);onRefresh();}}/>}
    {aidOpen&&<AidModal patientId={patient.id} token={token} onClose={()=>setAidOpen(false)} onSaved={()=>{setAidOpen(false);onRefresh();}}/>}
  </aside></div>;
}

function PatientModal({token,onClose,onSaved}) {
  const [f,setF]=useState({name:'',phone:'',age:'',gender:'',city:'Hyderabad',address:'',email:'',emergencyContact:''}),[err,setErr]=useState('');
  const save=async()=>{try{await api('/patients',token,{method:'POST',body:JSON.stringify(f)});onSaved();}catch(e){setErr(e.message);}};
  return <Modal title="Create patient record" subtitle="A unique RSH patient ID is generated automatically" onClose={onClose}><div className="form-grid"><label className="span2">Full name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Age<input type="number" value={f.age} onChange={e=>setF({...f,age:e.target.value})}/></label><label>Gender<select value={f.gender} onChange={e=>setF({...f,gender:e.target.value})}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label><label>City<input value={f.city} onChange={e=>setF({...f,city:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Emergency contact<input value={f.emergencyContact} onChange={e=>setF({...f,emergencyContact:e.target.value})}/></label><label className="span2">Address<textarea rows="3" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></label></div>{err&&<div className="error">{err}</div>}<button className="primary wide" onClick={save}>Create patient</button></Modal>;
}
function VisitModal({patientId,token,user,onClose,onSaved}) {
  const [doctors,setDoctors]=useState([]); const [f,setF]=useState({purpose:'Testing',notes:'',doctor:user?.role==='doctor'?user.name:'Dr. Sarala',followUpDate:''});
  useEffect(()=>{api('/doctors',token).then(setDoctors).catch(()=>{});},[token]);
  const save=async()=>{await api(`/patients/${patientId}/visits`,token,{method:'POST',body:JSON.stringify(f)});onSaved();};
  return <Modal title="Add visit" subtitle="Add the service and recommended follow-up to the permanent timeline" onClose={onClose}><div className="form-grid"><label>Purpose<select value={f.purpose} onChange={e=>setF({...f,purpose:e.target.value})}><option>Testing</option><option>Buying Hearing Aid</option><option>Repair/Service</option><option>Accessories</option><option>Speech Therapy</option><option>Follow-up</option><option>Other</option></select></label><label>Doctor / clinician<select value={f.doctor} onChange={e=>setF({...f,doctor:e.target.value})}>{doctors.length?doctors.map(d=><option key={d.id||d.name}>{d.name}</option>):<><option>Dr. Sarala</option><option>Dr. Suresh Naidu</option></>}</select></label><label>Recommended follow-up<input type="date" value={f.followUpDate} onChange={e=>setF({...f,followUpDate:e.target.value})}/></label><label className="span2">Clinical notes<textarea rows="5" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Save visit</button></Modal>;
}
function TestModal({patientId,token,onClose,onSaved}) { const [f,setF]=useState({testType:'Pure Tone Audiometry',rightEar:'',leftEar:'',notes:''}); const save=async()=>{await api(`/patients/${patientId}/tests`,token,{method:'POST',body:JSON.stringify(f)});onSaved();}; return <Modal title="Add audiology test" subtitle="Structured diagnostic record" onClose={onClose}><div className="form-grid"><label className="span2">Test<select value={f.testType} onChange={e=>setF({...f,testType:e.target.value})}><option>Pure Tone Audiometry</option><option>Impedance / Tympanometry</option><option>Speech Audiometry</option><option>BERA</option><option>OAE</option><option>ECOG</option></select></label><label>Right ear<input value={f.rightEar} onChange={e=>setF({...f,rightEar:e.target.value})}/></label><label>Left ear<input value={f.leftEar} onChange={e=>setF({...f,leftEar:e.target.value})}/></label><label className="span2">Notes<textarea rows="4" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Save test</button></Modal>; }
function AidModal({patientId,token,onClose,onSaved}) { const [f,setF]=useState({ear:'Left',type:'RIC',brand:'',model:'',serialNumber:'',price:'',fittingDate:todayInputDate(),warrantyEnd:''}); const save=async()=>{await api(`/patients/${patientId}/hearing-aids`,token,{method:'POST',body:JSON.stringify(f)});onSaved();}; return <Modal title="Add hearing aid" subtitle="Record fitted device and warranty" onClose={onClose}><div className="form-grid"><label>Ear<select value={f.ear} onChange={e=>setF({...f,ear:e.target.value})}><option>Left</option><option>Right</option><option>Bilateral</option></select></label><label>Type<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option>BTE</option><option>RIC</option><option>ITE</option><option>ITC</option><option>CIC</option></select></label><label>Brand<input value={f.brand} onChange={e=>setF({...f,brand:e.target.value})}/></label><label>Model<input value={f.model} onChange={e=>setF({...f,model:e.target.value})}/></label><label>Serial number<input value={f.serialNumber} onChange={e=>setF({...f,serialNumber:e.target.value})}/></label><label>Price<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></label><label>Fitting date<input type="date" value={f.fittingDate} onChange={e=>setF({...f,fittingDate:e.target.value})}/></label><label>Warranty end<input type="date" value={f.warrantyEnd} onChange={e=>setF({...f,warrantyEnd:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Save hearing aid</button></Modal>; }

function Appointments({token,role}) {
  const [items,setItems]=useState([]),[show,setShow]=useState(false); const load=()=>api('/appointments',token).then(setItems); useEffect(()=>{load();},[token]); const update=(id,status)=>api(`/appointments/${id}`,token,{method:'PATCH',body:JSON.stringify({status})}).then(load);
  return <><PageHead eyebrow="SCHEDULING" title="Appointments" copy="Patient requests and clinic bookings appear together in one live schedule." action={<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Book appointment</button>}/><section className="card"><div className="table-wrap"><table><thead><tr><th>Date & time</th><th>Patient</th><th>Purpose</th><th>Doctor</th><th>Requested by</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td><b>{fmtDate(a.date)}</b><br/><span className="muted">{a.time}</span></td><td>{a.patientName}</td><td>{a.purpose}</td><td>{a.assignedDoctor||'—'}</td><td><span className="code-pill">{a.requestedBy==='patient'?'Patient':'Clinic'}</span></td><td><Status value={a.status}/></td><td><div className="inline-actions"><button onClick={()=>update(a.id,'Confirmed')}>Confirm</button><button onClick={()=>update(a.id,'Completed')}>Complete</button><button onClick={()=>update(a.id,'Cancelled')}>Cancel</button></div></td></tr>)}</tbody></table></div></section>{show&&<AppointmentModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}</>;
}
function AppointmentModal({token,onClose,onSaved}) {
  const [patients,setPatients]=useState([]),[doctors,setDoctors]=useState([]),[f,setF]=useState({patientId:'',date:todayInputDate(),time:'10:00',purpose:'Hearing Test',assignedDoctor:''});
  useEffect(()=>{api('/patients',token).then(setPatients);api('/doctors',token).then(setDoctors).catch(()=>{});},[token]);
  const save=async()=>{await api('/appointments',token,{method:'POST',body:JSON.stringify(f)});onSaved();};
  return <Modal title="Book appointment" subtitle="Create a clinic time slot" onClose={onClose}><div className="form-grid"><label className="span2">Patient<select value={f.patientId} onChange={e=>setF({...f,patientId:e.target.value})}><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patientCode} · {p.name} · {p.phone}</option>)}</select></label><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Time<input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label><label>Purpose<select value={f.purpose} onChange={e=>setF({...f,purpose:e.target.value})}><option>Hearing Test</option><option>Hearing Aid Fitting</option><option>Repair Follow-up</option><option>Consultation</option><option>Speech Therapy</option><option>Accessories</option></select></label><label>Doctor<select value={f.assignedDoctor} onChange={e=>setF({...f,assignedDoctor:e.target.value})}><option value="">Any available doctor</option>{doctors.map(d=><option key={d.id||d.name}>{d.name}</option>)}</select></label></div><button className="primary wide" onClick={save}>Book appointment</button></Modal>;
}

function Repairs({token}) {
  const [items,setItems]=useState([]),[show,setShow]=useState(false); const load=()=>api('/repairs',token).then(setItems); useEffect(()=>{load();},[token]); const update=(id,status)=>api(`/repairs/${id}`,token,{method:'PATCH',body:JSON.stringify({status})}).then(load); const statuses=['Received','Sent','In Progress','Returned','Delivered'];
  return <><PageHead eyebrow="SERVICE DESK" title="Repairs & servicing" copy="Track each device from clinic intake to patient delivery." action={<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> New repair</button>}/><div className="repair-board">{statuses.map(s=><section className="repair-col" key={s}><div className="repair-col-head"><b>{s}</b><span>{items.filter(i=>i.status===s).length}</span></div>{items.filter(i=>i.status===s).map(r=><div className="repair-card" key={r.id}><div className="repair-person"><div className="circle"><Wrench size={16}/></div><div className="grow"><b>{r.patientName}</b><span>{r.phone}</span></div><ContactActions compact phone={r.phone} message={r.status==='Returned'?`Hello ${r.patientName}, your hearing aid repair is ready for collection at Raghavendra Speech & Hearing Center.`:`Hello ${r.patientName}, this is Raghavendra Speech & Hearing Center regarding your hearing aid repair.`}/></div><h4>{r.brand} {r.model}</h4><p>{r.issue}</p><small>{r.serialNumber&&`S/N ${r.serialNumber} · `}Received {fmtDate(r.dateReceived)}</small><select value={r.status} onChange={e=>update(r.id,e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></div>)}</section>)}</div>{show&&<RepairModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}</>;
}
function RepairModal({token,onClose,onSaved}) { const [patients,setPatients]=useState([]),[f,setF]=useState({patientId:'',brand:'',model:'',serialNumber:'',issue:'',sentTo:'Clinic bench',expectedReturn:''}); useEffect(()=>{api('/patients',token).then(setPatients);},[token]); const save=async()=>{await api('/repairs',token,{method:'POST',body:JSON.stringify(f)});onSaved();}; return <Modal title="Receive hearing aid for repair" subtitle="Creates a live service job" onClose={onClose}><div className="form-grid"><label className="span2">Patient<select value={f.patientId} onChange={e=>setF({...f,patientId:e.target.value})}><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patientCode} · {p.name}</option>)}</select></label><label>Brand<input value={f.brand} onChange={e=>setF({...f,brand:e.target.value})}/></label><label>Model<input value={f.model} onChange={e=>setF({...f,model:e.target.value})}/></label><label>Serial number<input value={f.serialNumber} onChange={e=>setF({...f,serialNumber:e.target.value})}/></label><label>Sent to<input value={f.sentTo} onChange={e=>setF({...f,sentTo:e.target.value})}/></label><label className="span2">Issue<textarea rows="4" value={f.issue} onChange={e=>setF({...f,issue:e.target.value})}/></label><label>Expected return<input type="date" value={f.expectedReturn} onChange={e=>setF({...f,expectedReturn:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Create repair job</button></Modal>; }

function Payments({token}) {
  const [items,setItems]=useState([]),[show,setShow]=useState(false); const load=()=>api('/payments',token).then(setItems); useEffect(()=>{load();},[token]); const total=items.reduce((a,p)=>a+Number(p.amount||0),0),pending=items.reduce((a,p)=>a+Number(p.balance||0),0),collected=items.reduce((a,p)=>a+Number(p.paid||0),0);
  return <><PageHead eyebrow="BILLING" title="Payments" copy="Track collections, dues and payment methods." action={<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Record payment</button>}/><div className="summary-strip"><div><span>Total billed</span><b>{money(total)}</b></div><div><span>Collected</span><b>{money(collected)}</b></div><div><span>Outstanding</span><b>{money(pending)}</b></div></div><section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Purpose</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>{items.map(p=><tr key={p.id}><td>{fmtDate(p.date||p.createdAt)}</td><td>{p.patientName}</td><td>{p.purpose}<br/><span className="muted">{p.method||''}</span></td><td>{money(p.amount)}</td><td>{money(p.paid)}</td><td>{money(p.balance)}</td><td><Status value={p.status}/></td></tr>)}</tbody></table></div></section>{show&&<PaymentModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}</>;
}
function PaymentModal({token,onClose,onSaved}) { const [patients,setPatients]=useState([]),[f,setF]=useState({patientId:'',purpose:'',amount:'',paid:'',method:'Cash',date:todayInputDate()}); useEffect(()=>{api('/patients',token).then(setPatients);},[token]); const save=async()=>{await api('/payments',token,{method:'POST',body:JSON.stringify(f)});onSaved();}; return <Modal title="Record bill / payment" subtitle="Patient outstanding balance updates automatically" onClose={onClose}><div className="form-grid"><label className="span2">Patient<select value={f.patientId} onChange={e=>setF({...f,patientId:e.target.value})}><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patientCode} · {p.name}</option>)}</select></label><label className="span2">Purpose<input value={f.purpose} onChange={e=>setF({...f,purpose:e.target.value})} placeholder="Hearing aid / test / service…"/></label><label>Total amount<input type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label><label>Amount received<input type="number" value={f.paid} onChange={e=>setF({...f,paid:e.target.value})}/></label><label>Method<select value={f.method} onChange={e=>setF({...f,method:e.target.value})}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></label><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Save transaction</button></Modal>; }

function FollowUps({token}) {
  const [items,setItems]=useState(null); useEffect(()=>{api('/followups',token).then(setItems);},[token]); if(!items)return <Loading/>;
  const labels={repair:'Repair ready',appointment:'Appointment',followup:'Clinical follow-up',thankyou:'Thank you',payment:'Payment due'};
  return <><PageHead eyebrow="PATIENT COMMUNICATION" title="Follow-ups & reminders" copy="Reception worklist for calls, WhatsApp messages, SMS and patient recalls."/><div className="followup-grid">{items.length?items.map(t=><article className={`followup-card priority-${t.priority}`} key={t.id}><div className="followup-top"><div><span className="eyebrow">{labels[t.type]||t.type}</span><h3>{t.patientName}</h3><p><span className="code-pill">{t.patientCode}</span> · {t.phone}</p></div>{t.dueDate&&<span className="due-chip">{fmtDate(t.dueDate)}</span>}</div><div className="followup-reason"><b>{t.reason}</b><p>{t.message}</p></div><ContactActions phone={t.phone} message={t.message}/></article>):<section className="card"><Empty>No reminders need attention right now.</Empty></section>}</div></>;
}

function Inventory({token,role}) { const [items,setItems]=useState([]),[show,setShow]=useState(false); const load=()=>api('/inventory',token).then(setItems); useEffect(()=>{load();},[token]); return <><PageHead eyebrow="STOCK" title="Accessories & inventory" copy="Batteries, domes, receivers, chargers, mould supplies and more." action={role==='admin'?<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Add item</button>:null}/><div className="inventory-grid">{items.map(i=><div className="inventory-card" key={i.id}><div className="metric-icon"><ShoppingBag size={20}/></div><div className="grow"><span>{i.category}</span><h3>{i.name}</h3><p>{money(i.price)} each · reorder at {i.lowStockAt}</p></div><div className={`stock ${i.quantity<=i.lowStockAt?'low':''}`}><b>{i.quantity}</b><span>in stock</span></div>{i.quantity<=i.lowStockAt&&<div className="warning"><AlertTriangle size={14}/> Low stock</div>}</div>)}</div>{show&&<InventoryModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}</>; }
function InventoryModal({token,onClose,onSaved}) { const [f,setF]=useState({name:'',category:'Batteries',quantity:'',lowStockAt:'',price:''}); const save=async()=>{await api('/inventory',token,{method:'POST',body:JSON.stringify(f)});onSaved();}; return <Modal title="Add inventory item" subtitle="Set a reorder level for automatic low-stock alerts" onClose={onClose}><div className="form-grid"><label className="span2">Item name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Category<input value={f.category} onChange={e=>setF({...f,category:e.target.value})}/></label><label>Price<input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></label><label>Quantity<input type="number" value={f.quantity} onChange={e=>setF({...f,quantity:e.target.value})}/></label><label>Low-stock threshold<input type="number" value={f.lowStockAt} onChange={e=>setF({...f,lowStockAt:e.target.value})}/></label></div><button className="primary wide" onClick={save}>Add inventory item</button></Modal>; }

function Team({token}) {
  const [items,setItems]=useState(null); useEffect(()=>{api('/staff',token).then(setItems);},[token]); if(!items)return <Loading/>;
  return <><PageHead eyebrow="ACCESS CONTROL" title="Clinic team" copy="Separate staff accounts keep activity attributable to the correct doctor or receptionist."/><div className="team-grid">{items.map(s=><article className="team-card" key={s.id}><div className="avatar xl">{s.name?.[0]}</div><div className="grow"><h3>{s.name}</h3><p>{s.email}</p><span className="role-chip">{s.role}</span></div><div className={`active-dot ${s.active===false?'off':''}`}/></article>)}</div></>;
}

function PatientPortal({token}) {
  const [d,setD]=useState(null),[show,setShow]=useState(false); const load=()=>api('/portal',token).then(setD); useEffect(()=>{load();},[token]); if(!d)return <Loading/>;
  const activeRepairs=d.repairs.filter(r=>r.status!=='Delivered');
  const serviceNames=[...new Set(d.visits.map(v=>v.purpose).filter(Boolean))];
  return <>
    <PageHead eyebrow="MY HEARING CARE" title={`Hello, ${d.patient.name.split(' ')[0]} 👋`} copy={`${d.patient.patientCode||''} · Your appointments, services, hearing aids, repairs and dues.`} action={<button className="primary" onClick={()=>setShow(true)}><CalendarPlus size={17}/> Request next visit</button>}/>
    <div className="portal-hero"><div><span className="eyebrow">NEXT APPOINTMENT</span><h2>{d.nextAppointment?`${fmtDate(d.nextAppointment.date)} · ${d.nextAppointment.time}`:'No appointment booked'}</h2><p>{d.nextAppointment?`${d.nextAppointment.purpose}${d.nextAppointment.assignedDoctor?` · ${d.nextAppointment.assignedDoctor}`:''} · ${d.nextAppointment.status}`:'Request your next visit when you are ready.'}</p></div><div className="portal-icon"><CalendarDays size={30}/></div></div>
    <div className="metric-grid patient"><div className="metric"><div className="metric-icon"><CreditCard/></div><span>Payment due</span><b>{money(d.balance)}</b><small>{d.balance?'Contact reception for payment options':'No outstanding dues'}</small></div><div className="metric"><div className="metric-icon"><Wrench/></div><span>Active repairs</span><b>{activeRepairs.length}</b><small>Live service status</small></div><div className="metric"><div className="metric-icon"><Ear/></div><span>Hearing aids</span><b>{d.hearingAids?.length||0}</b><small>Devices linked to your record</small></div><div className="metric"><div className="metric-icon"><Clock3/></div><span>Recommended follow-up</span><b className="small-metric-value">{fmtDate(d.nextFollowUp?.followUpDate)}</b><small>{d.nextFollowUp?.purpose||'No follow-up date recorded'}</small></div></div>
    <div className="portal-service-strip"><div><span className="eyebrow">SERVICES ON YOUR RECORD</span><div className="service-chips">{serviceNames.length?serviceNames.map(x=><span key={x}>{x}</span>):<span>No services recorded yet</span>}</div></div></div>
    <div className="two-col"><section className="card"><div className="card-head"><div><h3>Repair updates</h3><p>Latest service progress</p></div></div><div className="list">{d.repairs.length?d.repairs.map(r=><div className="row" key={r.id}><div className="circle"><Wrench size={16}/></div><div className="grow"><b>{r.brand} {r.model}</b><span>{r.issue}</span></div><Status value={r.status}/></div>):<Empty>No repair jobs.</Empty>}</div></section><section className="card"><div className="card-head"><div><h3>Recent visits</h3><p>Your care and recommended return dates</p></div></div><div className="list">{d.visits.length?d.visits.slice(0,6).map(v=><div className="row" key={v.id}><div className="circle"><Stethoscope size={16}/></div><div className="grow"><b>{v.purpose}</b><span>{fmtDate(v.date)}{v.followUpDate?` · return ${fmtDate(v.followUpDate)}`:''}</span></div></div>):<Empty>No visits recorded yet.</Empty>}</div></section></div>
    <section className="card portal-appointments"><div className="card-head"><div><h3>My appointments</h3><p>Requests appear here immediately and are confirmed by reception.</p></div></div><div className="list">{d.appointments?.length?d.appointments.slice(0,8).map(a=><div className="row" key={a.id}><div className="circle"><CalendarDays size={16}/></div><div className="grow"><b>{fmtDate(a.date)} · {a.time}</b><span>{a.purpose}{a.assignedDoctor?` · ${a.assignedDoctor}`:''}</span></div><Status value={a.status}/></div>):<Empty>No appointments yet.</Empty>}</div></section>
    {show&&<PatientAppointmentModal token={token} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();}}/>}
  </>;
}
function PatientAppointmentModal({token,onClose,onSaved}) {
  const [doctors,setDoctors]=useState([]),[f,setF]=useState({date:todayInputDate(),time:'10:00',purpose:'Follow-up',assignedDoctor:'',notes:''}),[err,setErr]=useState('');
  useEffect(()=>{api('/doctors',token).then(setDoctors).catch(()=>{});},[token]);
  const save=async()=>{try{await api('/portal/appointments',token,{method:'POST',body:JSON.stringify(f)});onSaved();}catch(e){setErr(e.message);}};
  return <Modal title="Request your next visit" subtitle="Reception will confirm the slot after your request is submitted" onClose={onClose}><div className="form-grid"><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Preferred time<input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label><label>Purpose<select value={f.purpose} onChange={e=>setF({...f,purpose:e.target.value})}><option>Follow-up</option><option>Hearing Test</option><option>Hearing Aid Fitting</option><option>Repair Follow-up</option><option>Consultation</option><option>Speech Therapy</option><option>Accessories</option></select></label><label>Preferred doctor<select value={f.assignedDoctor} onChange={e=>setF({...f,assignedDoctor:e.target.value})}><option value="">Any available doctor</option>{doctors.map(d=><option key={d.id||d.name}>{d.name}</option>)}</select></label><label className="span2">Anything reception should know?<textarea rows="3" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label></div>{err&&<div className="error">{err}</div>}<button className="primary wide" onClick={save}><Send size={16}/> Send appointment request</button></Modal>;
}

export default function Home() {
  const [session,setSession]=useState(null);
  useEffect(()=>{const s=localStorage.getItem('hearcare-session');if(s)try{setSession(JSON.parse(s));}catch{}},[]);
  const login=s=>{localStorage.setItem('hearcare-session',JSON.stringify(s));setSession(s);};
  const logout=()=>{localStorage.removeItem('hearcare-session');setSession(null);};
  return session?<Shell session={session} onLogout={logout}/>:<Login onLogin={login}/>;
}
