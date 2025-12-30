
const sharedConfig = {
  measurementId: ""
};

const isServer = typeof window === 'undefined';

let firebaseConfig: any;

if (isServer) {
  // Server-side config
  if (
    !process.env.FIREBASE_API_KEY ||
    !process.env.FIREBASE_AUTH_DOMAIN ||
    !process.env.FIREBASE_PROJECT_ID
  ) {
    throw new Error('Firebase server environment variables are not set.');
  }
  firebaseConfig = {
    ...sharedConfig,
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  };
} else {
  // Client-side config
  if (
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
     throw new Error('Firebase client environment variables are not set.');
  }
  firebaseConfig = {
    ...sharedConfig,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

export { firebaseConfig };
