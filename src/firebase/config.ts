// Shared config for both client and server.
const sharedConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// Determine if we're on the server
const isServer = typeof window === 'undefined';

const getFirebaseConfig = () => {
  if (isServer) {
    // Server-side config
    return {
      ...sharedConfig,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      appId: process.env.FIREBASE_APP_ID,
    };
  } else {
    // Client-side config
    return {
      ...sharedConfig,
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }
};

export const firebaseConfig = getFirebaseConfig();
