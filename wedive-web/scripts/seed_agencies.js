/**
 * Seed agencies data to Firestore
 * Run with: node scripts/seed_agencies.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS env var)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'dive-dex-app-dev'
  });
}

const db = admin.firestore();

async function seedAgencies() {
  const seedPath = path.join(__dirname, '../src/data/agencies_seed.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  console.log(`Seeding ${seedData.length} agencies to Firestore...`);

  for (const agency of seedData) {
    const docRef = db.collection('agencies').doc(agency.id);
    await docRef.set({
      name: agency.name,
      website: agency.website,
      logoUrl: agency.logoUrl || '',
      ranks: agency.ranks,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✓ ${agency.name}`);
  }

  console.log('Done!');
}

seedAgencies().catch(console.error);
