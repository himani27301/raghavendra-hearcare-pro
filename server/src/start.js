import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function ensureBootstrapAccounts() {
  if (process.env.BOOTSTRAP_SYNC_ACCOUNTS !== 'true') return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return;

  await mongoose.connect(uri);

  const User = mongoose.models.BootstrapUser || mongoose.model(
    'BootstrapUser',
    new mongoose.Schema({
      name: String,
      email: String,
      passwordHash: String,
      role: String,
      active: Boolean,
      patientId: mongoose.Schema.Types.ObjectId
    }, { collection: 'users', strict: false, timestamps: true })
  );

  const accounts = [
    {
      name: process.env.INITIAL_ADMIN_NAME || 'Dr. Raghavendra',
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD,
      role: 'admin'
    },
    {
      name: 'Dr. Sarala',
      email: process.env.DOCTOR_SARALA_EMAIL,
      password: process.env.DOCTOR_SARALA_PASSWORD,
      role: 'doctor'
    },
    {
      name: 'Dr. Suresh Naidu',
      email: process.env.DOCTOR_SURESH_EMAIL,
      password: process.env.DOCTOR_SURESH_PASSWORD,
      role: 'doctor'
    },
    {
      name: 'Reception',
      email: process.env.RECEPTION_EMAIL,
      password: process.env.RECEPTION_PASSWORD,
      role: 'receptionist'
    }
  ];

  let created = 0;
  for (const account of accounts) {
    if (!account.email || !account.password) continue;
    const email = account.email.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('_id');
    if (existing) continue;

    await User.create({
      name: account.name,
      email,
      passwordHash: await bcrypt.hash(account.password, 12),
      role: account.role,
      active: true
    });
    created += 1;
  }

  await mongoose.disconnect();
  console.log(`HearCare bootstrap check complete (${created} account${created === 1 ? '' : 's'} created)`);
}

try {
  await ensureBootstrapAccounts();
} catch (err) {
  console.error('Bootstrap account check failed:', err.message);
}

await import('./index.js');
