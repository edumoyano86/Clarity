'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// This function initializes Firebase and returns the SDKs.
export function initializeFirebase() {
  let firebaseApp: FirebaseApp;

  // Check if Firebase has already been initialized.
  if (!getApps().length) {
    // If not initialized, initialize with the provided config.
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    // If already initialized, get the existing app instance.
    firebaseApp = getApp();
  }

  // Return the initialized app and the required SDKs.
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
