'use client';

// This file is now simplified to re-export the single, correctly initialized instances.
// This prevents any possibility of a duplicate or incorrect Firebase app instance.
export { firebaseApp, auth, firestore } from './index';
