'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

let firebaseApp: FirebaseApp = null as any;
let auth: Auth = null as any;
let firestore: Firestore = null as any;

// Solo inicializa Firebase si la configuración está presente y es válida.
// Esto evita errores durante el proceso de construcción de Next.js (pre-rendering)
// cuando las variables de entorno pueden no estar disponibles en el entorno de build.
const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

if (isConfigValid) {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  auth = getAuth(firebaseApp);
  firestore = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
  });
}

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
