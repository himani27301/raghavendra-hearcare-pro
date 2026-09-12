import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

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

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'receptionist', 'patient'], default: 'receptionist' },
  patientId: { type: objectId, ref: 'Patient', default: null }
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

const visitSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, date: { type: Date, default: Date.now }, purpose: String, notes: String, doctor: String }, { timestamps: true });
const testSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, date: { type: Date, default: Date.now }, testType: String, rightEar: String, leftEar: String, notes: String }, { timestamps: true });
const aidSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, ear: String, type: String, brand: String, model: String, serialNumber: { type: String, index: true }, price: Number, fittingDate: Date, warrantyEnd: Date, lastProgrammed: Date }, { timestamps: true });
const appointmentSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, patientName: String, date: Date, time: String, purpose: String, status: { type: String, default: 'Pending' } }, { timestamps: true });
const repairSchema = new mongoose.Schema({ patientId: { type: objectId, ref: 'Patient', index: true }, patientName: String, phone: String, brand: String, model: String, serialNumber: String, issue: String, dateReceived: { type: Date, default: Date.now }, sentTo: String, expectedReturn: Date, status: { type: String, default: 'Received' } }, { timestamps: true });
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
  if (dbMode === 'mongodb') return `RSH-${String((await Patient.countDocuments()) + 1).padStart(6, '0')}`;
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

async function initDb() {
  if (!MONGODB_URI) { dbMode = 'memory'; return; }
  try {
    await mongoose.connect(MONGODB_URI);
    dbMode = 'mongodb';
    if ((await User.countDocuments()) === 0) {
      const email = process.env.INITIAL_ADMIN_EMAIL;
      const password = process.env.INITIAL_ADMIN_PASSWORD;
      if (email && password) await User.create({ name: process.env.INITIAL_ADMIN_NAME || 'Dr. Raghavendra', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    }
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
  if (dbMode === 'mongodb') user = await User.findOne({ email });
  else user = memory.users.find(u => u.email === email);
  const ok = user && (dbMode === 'mongodb' ? await bcrypt.compare(password, user.passwordHash || '') : user.password === password);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
  const u = clean(user);
  const token = jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role, patientId: u.patientId ? String(u.patientId) : null }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, patientId: u.patientId || null } });
});

app.get('/api/dashboard', auth, allow('admin', 'receptionist'), async (req, res) => {
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

app.get('/api/patients', auth, allow('admin', 'receptionist'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (dbMode !== 'mongodb') return res.json(memory.patients);
  let ids = [];
  if (q) ids = await HearingAid.find({ serialNumber: { $regex: q, $options: 'i' } }).distinct('patientId');
  const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }, { patientCode: { $regex: q, $options: 'i' } }, { _id: { $in: ids } }] } : {};
  const rows = await Patient.find(filter).sort({ updatedAt: -1 }).limit(200);
  res.json(rows.map(clean));
});

app.post('/api/patients', auth, allow('admin', 'receptionist'), async (req, res) => {
  try {
    const data = { ...req.body, patientCode: await serial(), balance: 0 };
    if (dbMode !== 'mongodb') { const p = { id: mid(), ...data }; memory.patients.unshift(p); return res.status(201).json(p); }
    const p = await Patient.create(data); await audit(req, 'CREATE', 'Patient', p._id); res.status(201).json(clean(p));
  } catch (e) { res.status(400).json({ message: e.code === 11000 ? 'Phone number already exists' : e.message }); }
});

app.get('/api/patients/:id', auth, allow('admin', 'receptionist'), async (req, res) => {
  if (dbMode !== 'mongodb') return res.json(memory.patients.find(p => p.id === req.params.id));
  const p = await Patient.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const [visits, hearingTests, hearingAids, appointments, repairs, payments] = await Promise.all([
    Visit.find({ patientId: p._id }).sort({ date: -1 }), HearingTest.find({ patientId: p._id }).sort({ date: -1 }), HearingAid.find({ patientId: p._id }).sort({ fittingDate: -1 }), Appointment.find({ patientId: p._id }).sort({ date: -1 }), Repair.find({ patientId: p._id }).sort({ dateReceived: -1 }), Payment.find({ patientId: p._id }).sort({ date: -1 })
  ]);
  res.json({ ...clean(p), visits: visits.map(clean), hearingTests: hearingTests.map(clean), hearingAids: hearingAids.map(clean), appointments: appointments.map(clean), repairs: repairs.map(clean), payments: payments.map(clean) });
});

app.post('/api/patients/:id/visits', auth, allow('admin', 'receptionist'), async (req, res) => {
  const v = await Visit.create({ patientId: req.params.id, ...req.body });
  await Patient.findByIdAndUpdate(req.params.id, { lastVisit: v.date }); await audit(req, 'CREATE', 'Visit', v._id); res.status(201).json(clean(v));
});
app.post('/api/patients/:id/tests', auth, allow('admin'), async (req, res) => { const t = await HearingTest.create({ patientId: req.params.id, ...req.body }); await audit(req, 'CREATE', 'HearingTest', t._id); res.status(201).json(clean(t)); });
app.post('/api/patients/:id/hearing-aids', auth, allow('admin'), async (req, res) => { const h = await HearingAid.create({ patientId: req.params.id, ...req.body }); await audit(req, 'CREATE', 'HearingAid', h._id); res.status(201).json(clean(h)); });

app.get('/api/appointments', auth, allow('admin', 'receptionist'), async (req, res) => res.json(dbMode === 'mongodb' ? (await Appointment.find().sort({ date: 1, time: 1 })).map(clean) : memory.appointments));
app.post('/api/appointments', auth, allow('admin', 'receptionist'), async (req, res) => { const p = await Patient.findById(req.body.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' }); const a = await Appointment.create({ ...req.body, patientName: p.name, status: 'Pending' }); await audit(req, 'CREATE', 'Appointment', a._id); res.status(201).json(clean(a)); });
app.patch('/api/appointments/:id', auth, allow('admin', 'receptionist'), async (req, res) => { const a = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true }); await audit(req, 'UPDATE', 'Appointment', req.params.id); res.json(clean(a)); });

app.get('/api/repairs', auth, allow('admin', 'receptionist'), async (req, res) => res.json(dbMode === 'mongodb' ? (await Repair.find().sort({ dateReceived: -1 })).map(clean) : memory.repairs));
app.post('/api/repairs', auth, allow('admin', 'receptionist'), async (req, res) => { const p = await Patient.findById(req.body.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' }); const r = await Repair.create({ ...req.body, patientName: p.name, phone: p.phone, status: 'Received' }); await audit(req, 'CREATE', 'Repair', r._id); res.status(201).json(clean(r)); });
app.patch('/api/repairs/:id', auth, allow('admin', 'receptionist'), async (req, res) => { const r = await Repair.findByIdAndUpdate(req.params.id, req.body, { new: true }); await audit(req, 'UPDATE', 'Repair', req.params.id); res.json(clean(r)); });

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

app.get('/api/portal', auth, allow('patient'), async (req, res) => {
  if (!req.user.patientId) return res.status(404).json({ message: 'No patient record linked to this account' });
  const p = await Patient.findById(req.user.patientId); if (!p) return res.status(404).json({ message: 'Patient not found' });
  const [appointments, repairs, visits, hearingAids] = await Promise.all([Appointment.find({ patientId: p._id }).sort({ date: 1 }), Repair.find({ patientId: p._id }).sort({ dateReceived: -1 }), Visit.find({ patientId: p._id }).sort({ date: -1 }), HearingAid.find({ patientId: p._id })]);
  const today = dayKey();
  const nextAppointment = appointments.find(a => dayKey(a.date) >= today && !['Cancelled', 'Completed'].includes(a.status)) || null;
  res.json({ patient: clean(p), nextAppointment: clean(nextAppointment), repairs: repairs.map(clean), visits: visits.map(clean), hearingAids: hearingAids.map(clean), balance: p.balance || 0 });
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: IS_PROD ? 'Server error' : err.message }); });

await initDb();
app.listen(PORT, () => console.log(`HearCare API on http://localhost:${PORT} (${dbMode === 'mongodb' ? 'MongoDB' : 'demo memory'})`));
