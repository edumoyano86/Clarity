'use client';

// This file serves as a clean, central entry point for all Firebase-related exports.

export { firebaseApp, auth, firestore } from './client';

export {
  FirebaseProvider,
  useFirebase,
  useAuth,
  useFirestore,
  useFirebaseApp,
  useUser,
} from './provider';

export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
