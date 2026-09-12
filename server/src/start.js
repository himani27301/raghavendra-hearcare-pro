import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function syncBootstrapAccounts() {
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

  for (const account of accounts) {
    if (!account.email || !account.password) continue;
    const email = account.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(account.password, 12);
    await User.findOneAndUpdate(
      { email },
      { $set: { name: account.name, email, passwordHash, role: account.role, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await mongoose.disconnect();
  console.log('HearCare bootstrap accounts synchronized');
}

try {
  await syncBootstrapAccounts();
} catch (err) {
  console.error('Bootstrap account sync failed:', err.message);
}

await import('./index.js');
