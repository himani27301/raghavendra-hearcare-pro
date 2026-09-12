import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === 'production';
const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? '' : 'dev-hearcare-secret-change-me');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || '';

if (IS_PROD && !JWT_SECRET) throw new Error('JWT_SECRET is required in production');
if (IS_PROD && !MONGODB_URI) throw new Error('MONGODB_URI is required in production');

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, cb) {
    if (!origin || !IS_PROD) return cb(null, true);
    const allowed = FRONTEND_URL.split(',').map(x => x.trim()).filter(Boolean);
    return cb(null, allowed.includes(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '3mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const dayKey = (v = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
const monthKey = (v = new Date()) => dayKey(v).slice(0, 7);
const objectId = mongoose.Schema.Types.ObjectId;
const digits = v => String(v || '').replace(/\D/g, '');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'doctor', 'receptionist', 'patient'], default: 'receptionist' },
  patientId: { type: objectId, ref: 'Patient', default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const patientSchema = new mongoose.Schema({
  patientCode: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  age: Number,
  gender: String,
  city: String,
  address: String,
  email: String,
  emergencyContact: String,
  lastVisit: Date,
  balance: { type: Number, default: 0 }
}, { timestamps: true });

const visitSchema = new mongoose.Schema({
  patientId: { type: objectId, ref: 'Patient', index: true },
  date: { type: Date, default: Date.now },
  purpose: String,
  notes: String,
  doctor: String,
  followUpDate: Date
}, { timestamps: true });
const testSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, date: { type: Date, default: Date.now }, testType: String, rightEar: String, leftEar: String, notes: String }, { timestamps: true });
const aidSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, ear: String, type: String, brand: String, model: String, serialNumber: { type: String, index: true }, price: Number, fittingDate: Date, warrantyEnd: Date, lastProgrammed: Date }, { timestamps: true });
const appointmentSchema = new mongoose.Schema({
  patientId: { type: objectId, ref: 'Patient', index: true },
  patientName: String,
  date: Date,
  time: String,
  purpose: String,
  assignedDoctor: String,
  requestedBy: { type: String, default: 'staff' },
  notes: String,
  status: { type: String, default: 'Pending' }
}, { timestamps: true });
const repairSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, patientName: String, phone: String, brand: String, model: String, serialNumber: String, issue: String, dateReceived: { type: Date, default: Date.now }, sentTo: String, expectedReturn: Date, status: { type: String, default: 'Received' }, notes: String }, { timestamps: true });
const paymentSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, patientName: String, purpose: String, amount: Number, paid: Number, balance: Number, method: String, status: String, date: { type: Date, default: Date.now } }, { timestamps: true });
const inventorySchema = new mongoose.Schema({ name: String, category: String, quantity: Number, lowStockAt: Number, price: Number }, { timestamps: true });
const auditSchema = new mongoose.Schema({ actorId: objectId, actorName: String, action: String, entity: String, entityId: String, at: { type: Date, default: Date.now } });

const User = mongoose.model('User', userSchema);
const Patient = mongoose.model('Patient', patientSchema);
const Visit = mongoose.model('Visit', visitSchema);
const HearingTest = mongoose.model('HearingTest', testSchema);
const HearingAid = mongoose.model('HearingAid', aidSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Repair = mongoose.model('Repair', repairSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Audit = mongoose.model('Audit', auditSchema);

let dbMode = 'memory';
const memory = { users: [], patients: [], visits: [], tests: [], aids: [], appointments: [], repairs: [], payments: [], inventory: [] };
const mid = () => Math.random().toString(36).slice(2, 10);
const serial = async () => {
  if (dbMode === 'mongodb') {
    const latest = await Patient.findOne({ patientCode: /^RSH-\d+$/ }).sort({ patientCode: -1 }).lean();
    const next = latest?.patientCode ? Number(latest.patientCode.split('-')[1]) + 1 : (await Patient.countDocuments()) + 1;
    return `RSH-${String(next).padStart(6, '0')}`;
  }
  return `RSH-${String(memory.patients.length + 1).padStart(6, '0')}`;
};
const clean = d => d ? ({ ...d.toObject?.() ?? d, id: String(d._id ?? d.id) }) : d;
const audit = async (req, action, entity, entityId) => {
  try { if (dbMode === 'mongodb' && req.user) await Audit.create({ actorId: req.user.id, actorName: req.user.name, action, entity, entityId: String(entityId || '') }); } catch {}
};

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Session expired' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ message: 'Session expired' }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Not allowed' });
const staffRoles = ['admin', 'doctor', 'receptionist'];

async function ensureStaff({ name, email, password, role }) {
  if (!email || !password || dbMode !== 'mongodb') return;
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized });
  if (!existing) await User.create({ name, email: normalized, passwordHash: await bcrypt.hash(password, 12), role, active: true });
}

async function initDb() {
  if (!MONGODB_URI) { dbMode = 'memory'; return; }
  try {
    await mongoose.connect(MONGODB_URI);
    dbMode = 'mongodb';

    if ((await User.countDocuments({ role: 'admin' })) === 0) {
      const email = process.env.INITIAL_ADMIN_EMAIL;
      const password = process.env.INITIAL_ADMIN_PASSWORD;
      if (email && password) await User.create({ name: process.env.INITIAL_ADMIN_NAME || 'Clinic Admin', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin', active: true });
    }

    await ensureStaff({ name: 'Dr. Sarala', email: process.env.DOCTOR_SARALA_EMAIL, password: process.env.DOCTOR_SARALA_PASSWORD, role: 'doctor' });
    await ensureStaff({ name: 'Dr. Suresh Naidu', email: process.env.DOCTOR_SURESH_EMAIL, password: process.env.DOCTOR_SURESH_PASSWORD, role: 'doctor' });
    await ensureStaff({ name: 'Reception', email: process.env.RECEPTION_EMAIL, password: process.env.RECEPTION_PASSWORD, role: 'receptionist' });
  } catch (e) {
    if (IS_PROD) throw e;
    console.error('MongoDB connection failed; using memory mode:', e.message);
    dbMode = 'memory';
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true, mode: dbMode === 'mongodb' ? 'mongodb' : 'demo-memory', timezone: TZ, production: IS_PROD }));

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  let user;
  if (dbMode === 'mongodb') user = await User.findOne({ email, active: { $ne: false } });
  else user = memory.users.find(u => u.email === email);
  const ok = user && (dbMode === 'mongodb' ? await bcrypt.compare(password, user.passwordHash || '') : user.password === password);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
  const u = clean(user);
  const token = jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role, patientId: u.patientId ? String(u.patientId) : null }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, patientId: u.patientId || null } });
});

app.post('/api/auth/patient-login', async (req, res) => {
  const patientCode = String(req.body.patientCode || '').trim().toUpperCase();
  const phone = digits(req.body.phone);
  if (!patientCode || phone.length < 8) return res.status(400).json({ message: 'Enter your patient ID and registered mobile number' });
  if (dbMode !== 'mongodb') return res.status(503).json({ message: 'Patient login requires the clinic database' });
  const patient = await Patient.findOne({ patientCode });
  if (!patient || digits(patient.phone) !== phone) return res.status(401).json({ message: 'Patient ID or mobile number does not match our records' });
  const p = clean(patient);
  const safe = { id: `patient:${p.id}`, name: p.name, email: p.email || '', role: 'patient', patientId: p.id, patientCode: p.patientCode };
  res.json({ token: jwt.sign(safe, JWT_SECRET, { expiresIn: '8h' }), user: safe });
});

app.get('/api/doctors', auth, async (req, res) => {
  if (dbMode !== 'mongodb') return res.json([{ name: 'Dr. Sarala' }, { name: 'Dr. Suresh Naidu' }]);
  const rows = await User.find({ role: 'doctor', active: { $ne: false } }).select('name').sort({ name: 1 });
  res.json(rows.map(x => ({ id: String(x._id), name: x.name })));
});

app.get('/api/staff', auth, allow('admin'), async (req, res) => {
  const rows = await User.find({ role: { $in: ['admin', 'doctor', 'receptionist'] } }).select('name email role active createdAt').sort({ role: 1, name: 1 });
  res.json(rows.map(clean));
});

const defaultStaff = [
  { name: 'Dr. Sarala', email: 'dr.sarala@raghavendrahearing.local', role: 'doctor' },
  { name: 'Dr. Suresh Naidu', email: 'dr.suresh@raghavendrahearing.local', role: 'doctor' },
  { name: 'Reception', email: 'reception@raghavendrahearing.local', role: 'receptionist' }
];
const temporaryPassword = () => `HC-${crypto.randomBytes(7).toString('base64url')}`;

app.post('/api/staff/bootstrap-defaults', auth, allow('admin'), async (req, res) => {
  const created = [];
  for (const row of defaultStaff) {
    const existing = await User.findOne({ email: row.email });
    if (existing) continue;
    const password = temporaryPassword();
    const user = await User.create({ ...row, passwordHash: await bcrypt.hash(password, 12), active: true });
    created.push({ id: String(user._id), name: row.name, email: row.email, role: row.role, password });
  }
  await audit(req, 'CREATE', 'DefaultStaff', created.map(x => x.id).join(','));
  res.json({ created, message: created.length ? 'Staff logins created. Save these temporary passwords now.' : 'All default staff accounts already exist.' });
});

app.post('/api/staff/:id/reset-password', auth, allow('admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || !['doctor', 'receptionist'].includes(user.role)) return res.status(404).json({ message: 'Staff account not found' });
  const password = temporaryPassword();
  user.passwordHash = await bcrypt.hash(password, 12);
  user.active = true;
  await user.save();
  await audit(req, 'RESET_PASSWORD', 'User', user._id);
  res.json({ id: String(user._id), name: user.name, email: user.email, password });
});

app.get('/api/dashboard', auth, allow(...staffRoles), async (req, res) => {
  if (dbMode !== 'mongodb') return res.json({ totalPatients: memory.patients.length, todayAppointments: 0, completedAppointments: 0, confirmedAppointments: 0, monthlyRevenue: 0, pendingPayments: 0, pendingPaymentPatients: 0, repairsInProgress: 0, repairsReady: 0, lowStock: 0, recentAppointments: [], recentRepairs: [] });
  const today = dayKey();
  const month = monthKey();
  const [patients, appointments, payments, repairs, inventory] = await Promise.all([Patient.find(), Appointment.find().sort({ date: 1, time: 1 }), Payment.find(), Repair.find().sort({ dateReceived: -1 }), Inventory.find()]);
  const todayApps = appointments.filter(a => dayKey(a.date) === today);
  const monthPays = payments.filter(p => monthKey(p.date || p.createdAt) === month);
  const pendingPays = payments.filter(p => Number(p.balance || 0) > 0);
  res.json({
    totalPatients: patients.length,
    todayAppointments: todayApps.length,
    completedAppointments: todayApps.filter(a => a.status === 'Completed').length,
    confirmedAppointments: todayApps.filter(a => a.status === 'Confirmed').length,
    monthlyRevenue: monthPays.reduce((s, p) => s + Number(p.paid || 0), 0),
    pendingPayments: pendingPays.reduce((s, p) => s + Number(p.balance || 0), 0),
    pendingPaymentPatients: new Set(pendingPays.map(p => String(p.patientId))).size,
    repairsInProgress: repairs.filter(r => !['Delivered', 'Returned'].includes(r.status)).length,
    repairsReady: repairs.filter(r => r.status === 'Returned').length,
    lowStock: inventory.filter(i => Number(i.quantity || 0) <= Number(i.lowStockAt || 0)).length,
    recentAppointments: todayApps.slice(0, 8).map(clean),
    recentRepairs: repairs.filter(r => r.status !== 'Delivered').slice(0, 6).map(clean)
  });
});

app.get('/api/patients', auth, allow(...staffRoles), async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (dbMode !== 'mongodb') return res.json(memory.patients);
  let ids = [];
  if (q) ids = await HearingAid.find({ serialNumber: { $regex: q, $options: 'i' } }).distinct('patientId');
  const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }, { patientCode: { $regex: q, $options: 'i' } }, { _id: { $in: ids } }] } : {};
  const rows = await Patient.find(filter).sort({ updatedAt: -1 }).limit(300);
  res.json(rows.map(clean));
});

app.post('/api/patients', auth, allow('admin', 'receptionist'), async (req, res) => {
  try {
    const data = { ...req.body, patientCode: await serial(), balance: 0 };
    if (dbMode !== 'mongodb') { const p = { id: mid(), ...data }; memory.patients.unshift(p); return res.status(201).json(p); }
    const p = await Patient.create(data); await audit(req, 'CREATE', 'Patient', p._id); res.status(201).json(clean(p));
  } catch (e) { res.status(400).json({ message: e.code === 11000 ? 'Phone number already exists' : e.message }); }
});

app.get('/api/patients/:id', auth, allow(...staffRoles), async (req, res) => {
  if (dbMode !== 'mongodb') return res.json(memory.patients.find(p => p.id === req.params.id));
  const p = await Patient.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const [visits, hearingTests, hearingAids, appointments, repairs, payments] = await Promise.all([
    Visit.find({ patientId: p._id }).sort({ date: -1 }), HearingTest.find({ patientId: p._id }).sort({ date: -1 }), HearingAid.find({ patientId: p._id }).sort({ fittingDate: -1 }), Appointment.find({ patientId: p._id }).sort({ date: -1 }), Repair.find({ patientId: p._id }).sort({ dateReceived: -1 }), Payment.find({ patientId: p._id }).sort({ date: -1 })
  ]);
  res.json({ ...clean(p), visits: visits.map(clean), hearingTests: hearingTests.map(clean), hearingAids: hearingAids.map(clean), appointments: appointments.map(clean), repairs: repairs.map(clean), payments: payments.map(clean) });
});

app.post('/api/patients/:id/visits', auth, allow('admin', 'doctor'), async (req, res) => {
  const v = await Visit.create({ patientId: req.params.id, ...req.body, doctor: req.body.doctor || req.user.name });
  await Patient.findByIdAndUpdate(req.params.id, { lastVisit: v.date }); await audit(req, 'CREATE', 'Visit', v._id); res.status(201).json(clean(v));
});
app.post('/api/patients/:id/tests', auth, allow('admin', 'doctor'), async (req, res) => { const t = await HearingTest.create({ patientId: req.params.id, ...req.body }); await audit(req, 'CREATE', 'HearingTest', t._id); res.status(201).json(clean(t)); });
app.post('/api/patients/:id/hearing-aids', auth, allow('admin', 'doctor'), async (req, res) => { const h = await HearingAid.create({ patientId: req.params.id, ...req.body }); await audit(req, 'CREATE', 'HearingAid', h._id); res.status(201).json(clean(h)); });

app.get('/api/appointments', auth, allow(...staffRoles), async (req, res) => res.json(dbMode === 'mongodb' ? (await Appointment.find().sort({ date: 1, time: 1 })).map(clean) : memory.appointments));
app.post('/api/appointments', auth, allow('admin', 'receptionist', 'doctor'), async (req, res) => {
  const p = await Patient.findById(req.body.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const a = await Appointment.create({ ...req.body, patientName: p.name, requestedBy: 'staff', status: req.body.status || 'Pending' });
  await audit(req, 'CREATE', 'Appointment', a._id); res.status(201).json(clean(a));
});
app.patch('/api/appointments/:id', auth, allow(...staffRoles), async (req, res) => { const a = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true }); await audit(req, 'UPDATE', 'Appointment', req.params.id); res.json(clean(a)); });

app.get('/api/repairs', auth, allow(...staffRoles), async (req, res) => res.json(dbMode === 'mongodb' ? (await Repair.find().sort({ dateReceived: -1 })).map(clean) : memory.repairs));
app.post('/api/repairs', auth, allow(...staffRoles), async (req, res) => { const p = await Patient.findById(req.body.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' }); const r = await Repair.create({ ...req.body, patientName: p.name, phone: p.phone, status: 'Received' }); await audit(req, 'CREATE', 'Repair', r._id); res.status(201).json(clean(r)); });
app.patch('/api/repairs/:id', auth, allow(...staffRoles), async (req, res) => { const r = await Repair.findByIdAndUpdate(req.params.id, req.body, { new: true }); await audit(req, 'UPDATE', 'Repair', req.params.id); res.json(clean(r)); });

app.get('/api/payments', auth, allow('admin', 'receptionist'), async (req, res) => res.json(dbMode === 'mongodb' ? (await Payment.find().sort({ date: -1 })).map(clean) : memory.payments));
app.post('/api/payments', auth, allow('admin', 'receptionist'), async (req, res) => {
  const p = await Patient.findById(req.body.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const amount = Number(req.body.amount || 0), paid = Number(req.body.paid || 0), balance = Math.max(0, amount - paid);
  const status = balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';
  const pay = await Payment.create({ ...req.body, patientName: p.name, amount, paid, balance, status });
  const sum = await Payment.aggregate([{ $match: { patientId: p._id } }, { $group: { _id: null, balance: { $sum: '$balance' } } }]);
  await Patient.findByIdAndUpdate(p._id, { balance: sum[0]?.balance || 0 }); await audit(req, 'CREATE', 'Payment', pay._id); res.status(201).json(clean(pay));
});

app.get('/api/inventory', auth, allow('admin', 'receptionist'), async (req, res) => res.json(dbMode === 'mongodb' ? (await Inventory.find().sort({ name: 1 })).map(clean) : memory.inventory));
app.post('/api/inventory', auth, allow('admin'), async (req, res) => { const i = await Inventory.create(req.body); await audit(req, 'CREATE', 'Inventory', i._id); res.status(201).json(clean(i)); });

app.get('/api/followups', auth, allow('admin', 'receptionist'), async (req, res) => {
  const [patients, appointments, repairs, payments, visits] = await Promise.all([Patient.find(), Appointment.find(), Repair.find(), Payment.find(), Visit.find().sort({ date: -1 })]);
  const today = new Date(`${dayKey()}T00:00:00+05:30`);
  const inDays = n => new Date(today.getTime() + n * 86400000);
  const tasks = [];
  const patientMap = new Map(patients.map(p => [String(p._id), p]));
  const add = (patientId, type, reason, dueDate, message, priority = 2) => {
    const p = patientMap.get(String(patientId)); if (!p) return;
    tasks.push({ id: `${type}-${patientId}-${String(dueDate || '')}`, patientId: String(p._id), patientCode: p.patientCode, patientName: p.name, phone: p.phone, type, reason, dueDate, message, priority });
  };

  for (const a of appointments) {
    const d = new Date(a.date);
    if (['Cancelled', 'Completed'].includes(a.status)) continue;
    if (d >= today && d <= inDays(3)) add(a.patientId, 'appointment', a.status === 'Pending' ? 'Appointment request needs confirmation' : 'Upcoming appointment reminder', a.date, `Hello ${a.patientName}, this is Raghavendra Speech & Hearing Center. Reminder for your ${a.purpose || 'appointment'} on ${dayKey(a.date)} at ${a.time || ''}. Please reply/call us if you need to reschedule.`, a.status === 'Pending' ? 1 : 2);
  }
  for (const r of repairs) {
    if (r.status === 'Returned') add(r.patientId, 'repair', 'Repair ready for collection', r.expectedReturn || new Date(), `Hello ${r.patientName}, your ${[r.brand, r.model].filter(Boolean).join(' ')} hearing aid repair is ready for collection at Raghavendra Speech & Hearing Center.`, 1);
  }
  const latestVisitByPatient = new Map();
  for (const v of visits) if (!latestVisitByPatient.has(String(v.patientId))) latestVisitByPatient.set(String(v.patientId), v);
  for (const [pid, v] of latestVisitByPatient) {
    if (v.followUpDate) {
      const d = new Date(v.followUpDate);
      if (d <= inDays(7)) add(pid, 'followup', d < today ? 'Follow-up overdue' : 'Follow-up due soon', v.followUpDate, `Hello, this is Raghavendra Speech & Hearing Center. Your recommended follow-up is due around ${dayKey(v.followUpDate)}. Please contact us to book a convenient slot.`, d < today ? 1 : 2);
    } else if (dayKey(v.date) === dayKey()) {
      add(pid, 'thankyou', 'Thank patient after today’s visit', v.date, 'Thank you for visiting Raghavendra Speech & Hearing Center today. We hope your visit was comfortable. Please contact us anytime if you need help with your hearing care.', 3);
    }
  }
  const balanceByPatient = new Map();
  for (const p of payments) if (Number(p.balance || 0) > 0) balanceByPatient.set(String(p.patientId), (balanceByPatient.get(String(p.patientId)) || 0) + Number(p.balance || 0));
  for (const [pid, balance] of balanceByPatient) add(pid, 'payment', `Payment due ₹${balance.toLocaleString('en-IN')}`, null, `Hello, this is Raghavendra Speech & Hearing Center. A balance of ₹${balance.toLocaleString('en-IN')} is pending on your account. Please contact reception if you need payment details.`, 3);

  tasks.sort((a, b) => a.priority - b.priority || new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01'));
  res.json(tasks.slice(0, 300));
});

app.get('/api/portal', auth, allow('patient'), async (req, res) => {
  if (!req.user.patientId) return res.status(404).json({ message: 'No patient record linked to this account' });
  const p = await Patient.findById(req.user.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const [appointments, repairs, visits, hearingAids, hearingTests, payments] = await Promise.all([
    Appointment.find({ patientId: p._id }).sort({ date: 1 }),
    Repair.find({ patientId: p._id }).sort({ dateReceived: -1 }),
    Visit.find({ patientId: p._id }).sort({ date: -1 }),
    HearingAid.find({ patientId: p._id }),
    HearingTest.find({ patientId: p._id }).sort({ date: -1 }),
    Payment.find({ patientId: p._id }).sort({ date: -1 })
  ]);
  const today = dayKey();
  const nextAppointment = appointments.find(a => dayKey(a.date) >= today && !['Cancelled', 'Completed'].includes(a.status)) || null;
  const nextFollowUp = visits.find(v => v.followUpDate && dayKey(v.followUpDate) >= today) || visits.find(v => v.followUpDate) || null;
  res.json({ patient: clean(p), nextAppointment: clean(nextAppointment), nextFollowUp: clean(nextFollowUp), appointments: appointments.map(clean), repairs: repairs.map(clean), visits: visits.map(clean), hearingAids: hearingAids.map(clean), hearingTests: hearingTests.map(clean), payments: payments.map(clean), balance: p.balance || 0 });
});

app.post('/api/portal/appointments', auth, allow('patient'), async (req, res) => {
  const p = await Patient.findById(req.user.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const date = new Date(`${req.body.date}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'Choose a valid date' });
  const a = await Appointment.create({ patientId: p._id, patientName: p.name, date, time: req.body.time, purpose: req.body.purpose || 'Follow-up', assignedDoctor: req.body.assignedDoctor || '', notes: req.body.notes || '', requestedBy: 'patient', status: 'Pending' });
  await audit(req, 'CREATE', 'AppointmentRequest', a._id);
  res.status(201).json(clean(a));
});

app.patch('/api/portal/appointments/:id/cancel', auth, allow('patient'), async (req, res) => {
  const a = await Appointment.findOne({ _id: req.params.id, patientId: req.user.patientId });
  if (!a) return res.status(404).json({ message: 'Appointment not found' });
  if (!['Pending', 'Confirmed'].includes(a.status)) return res.status(400).json({ message: 'This appointment can no longer be cancelled online' });
  a.status = 'Cancelled'; await a.save(); res.json(clean(a));
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: IS_PROD ? 'Server error' : err.message }); });

await initDb();
app.listen(PORT, () => console.log(`HearCare API on http://localhost:${PORT} (${dbMode === 'mongodb' ? 'MongoDB' : 'demo memory'})`));
