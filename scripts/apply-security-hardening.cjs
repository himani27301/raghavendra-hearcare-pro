const fs = require('fs');

const indexPath = 'server/src/index.js';
const packagePath = 'server/package.json';

let src = fs.readFileSync(indexPath, 'utf8');
let changed = false;

function replaceOnce(from, to, label) {
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error(`Could not find ${label} patch target`);
  src = src.replace(from, to);
  changed = true;
}

replaceOnce(
  "import cors from 'cors';\nimport jwt from 'jsonwebtoken';",
  "import cors from 'cors';\nimport helmet from 'helmet';\nimport { rateLimit } from 'express-rate-limit';\nimport jwt from 'jsonwebtoken';",
  'security imports'
);

replaceOnce(
  "app.set('trust proxy', 1);\napp.use(cors({",
  "app.set('trust proxy', 1);\napp.disable('x-powered-by');\napp.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));\napp.use(cors({",
  'helmet middleware'
);

replaceOnce(
  "  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');\n  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');",
  "  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');\n  res.setHeader('Cache-Control', 'no-store');\n  res.setHeader('Pragma', 'no-cache');\n  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');",
  'no-store headers'
);

replaceOnce(
  "const staffRoles = ['admin', 'doctor', 'receptionist'];\n",
  "const staffRoles = ['admin', 'doctor', 'receptionist'];\n\nconst staffLoginLimiter = rateLimit({\n  windowMs: 15 * 60 * 1000,\n  limit: 15,\n  standardHeaders: true,\n  legacyHeaders: false,\n  skipSuccessfulRequests: true,\n  message: { message: 'Too many sign-in attempts. Try again in a few minutes.' }\n});\nconst patientLoginLimiter = rateLimit({\n  windowMs: 15 * 60 * 1000,\n  limit: 10,\n  standardHeaders: true,\n  legacyHeaders: false,\n  skipSuccessfulRequests: true,\n  message: { message: 'Too many sign-in attempts. Try again in a few minutes.' }\n});\n",
  'login rate limiters'
);

replaceOnce(
  "app.post('/api/auth/login', async (req, res) => {",
  "app.post('/api/auth/login', staffLoginLimiter, async (req, res) => {",
  'staff login limiter'
);

replaceOnce(
  "app.post('/api/auth/patient-login', async (req, res) => {",
  "app.post('/api/auth/patient-login', patientLoginLimiter, async (req, res) => {",
  'patient login limiter'
);

if (changed) fs.writeFileSync(indexPath, src);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.dependencies ||= {};
pkg.dependencies.helmet = pkg.dependencies.helmet || '^8.0.0';
pkg.dependencies['express-rate-limit'] = pkg.dependencies['express-rate-limit'] || '^8.0.0';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('HearCare security hardening applied');
