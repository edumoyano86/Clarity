import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';

// IMPORTANT: Never share this file with the client.
// It contains sensitive credentials.

const firebaseConfig = {
  credential: credential.applicationDefault(),
  projectId: 'clarity-d5e76',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);

export { db };
