import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadEnvFile(filename) {
  const fullPath = path.join(rootDir, filename);
  if (!fs.existsSync(fullPath)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

const env = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([key, val]) => key !== "measurementId" && !val)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.error("Missing Firebase config keys in .env.local:", missingKeys.join(", "));
  process.exit(1);
}

const dataPath = path.join(rootDir, "src", "data", "portfolioData.json");
const portfolioData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const batch = writeBatch(db);

let count = 0;

function queueDoc(collectionName, docId, payload) {
  batch.set(doc(db, collectionName, docId), { ...payload, updatedAt: serverTimestamp() });
  count += 1;
}

// Core singleton documents inside `portfolio`
queueDoc("portfolio", "profile", portfolioData.profile);
queueDoc("portfolio", "academics", portfolioData.academics);
queueDoc("portfolio", "hero", portfolioData.hero);
queueDoc("portfolio", "bio", portfolioData.bio);
queueDoc("portfolio", "navigation", { links: portfolioData.navLinks });

// Collection items (each document editable/reorderable independently in Firebase Console)
for (const skill of portfolioData.skills) {
  const { id, ...rest } = skill;
  queueDoc("skills", id, { visible: true, ...rest });
}

for (const project of portfolioData.projects) {
  const { id, ...rest } = project;
  queueDoc("projects", id, { visible: true, ...rest });
}

for (const stop of portfolioData.journey) {
  const { id, ...rest } = stop;
  queueDoc("journey", id, { visible: true, ...rest });
}

for (const group of portfolioData.milestones) {
  const { id, ...rest } = group;
  queueDoc("milestones", id, { visible: true, ...rest });
}

try {
  await batch.commit();
  console.log(`Seeded ${count} documents into Firestore project "${firebaseConfig.projectId}".`);
  console.log("Collections populated: portfolio, skills, projects, journey, milestones.");
  process.exit(0);
} catch (err) {
  console.error("Failed to seed Firestore:", err?.code || err?.message || err);
  if (err?.code === "permission-denied") {
    console.error("\nYour Firestore rules currently block client writes (good for production!).");
    console.error("To run this one-time seed:");
    console.error("  1. In Firebase Console -> Firestore -> Rules, temporarily set `allow write: if true;` on portfolio/skills/projects/journey/milestones and Publish.");
    console.error("  2. Re-run: npm run seed:firestore");
    console.error("  3. Immediately restore the production rules from firestore.rules (`allow write: if false;`) and Publish.");
  }
  process.exit(1);
}
