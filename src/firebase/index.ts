
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This check prevents re-initializing the app on every hot-reload
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

auth = getAuth(firebaseApp);
// Use initializeFirestore to apply settings
firestore = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});

export { firebaseApp, auth, firestore };

// Explicit exports to avoid conflicts
export {
  FirebaseProvider,
  useFirebase,
  useAuth,
  useFirestore,
  useFirebaseApp,
  useUser,
  useMemoFirebase,
} from './provider';
export type { FirebaseContextState, FirebaseServicesAndUser, UserHookResult } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useCollection, type UseCollectionResult, type WithId } from './firestore/use-collection';
export { useDoc, type UseDocResult } from './firestore/use-doc';
export {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from './non-blocking-updates';
export {
  initiateAnonymousSignIn,
  initiateEmailSignUp,
  initiateEmailSignIn,
} from './non-blocking-login';
export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';
