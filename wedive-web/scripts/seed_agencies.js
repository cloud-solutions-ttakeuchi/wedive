
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key) env[key] = val;
      }
    });
    return env;
  } catch (e) {
    console.warn(`Failed to load ${filePath}`, e);
    return {};
  }
}

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const localEnvPath = path.resolve(__dirname, '../.env.local');

  const env = loadEnvFile(envPath);
  const localEnv = loadEnvFile(localEnvPath);

  // MERGE: environment variables have highest priority, then local .env, then base .env
  // But for this script, we want to allow explicit override via process.env
  return { ...env, ...localEnv };
}

const fileEnv = loadEnv();
// Prioritize process.env
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || fileEnv.VITE_FIREBASE_PROJECT_ID;

console.log('Target Project ID:', projectId);

if (!projectId) {
  console.error('Error: Project ID not found. Check .env or .env.local');
  process.exit(1);
}

// Initialize Firebase Admin
// This will attempt to use Google Application Default Credentials (ADC)
// Make sure to run `gcloud auth application-default login` before this script.
initializeApp({
  projectId: projectId,
  credential: applicationDefault()
});

const db = getFirestore();

// Load Seed Data
const seedFilePath = path.resolve(__dirname, '../src/data/agencies_seed.json');
const agencies = JSON.parse(fs.readFileSync(seedFilePath, 'utf-8'));

async function seedAgencies() {
  console.log(`Seeding ${agencies.length} agencies to Firestore (${projectId}) using Admin SDK...`);

  const batch = db.batch();

  for (const agency of agencies) {
    const docRef = db.collection('agencies').doc(agency.id);
    batch.set(docRef, agency);
  }

  await batch.commit();
  console.log('Successfully seeded agencies! 🚀');
  process.exit(0);
}

seedAgencies().catch(e => {
  console.error(e);
  process.exit(1);
});
