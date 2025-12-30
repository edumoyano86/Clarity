'use server'

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';

// IMPORTANT: Never share this file with the client.
// It contains sensitive credentials.

const firebaseConfig = {
  credential: credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
};

let app: FirebaseApp;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

db = getFirestore(app);

export { db };
