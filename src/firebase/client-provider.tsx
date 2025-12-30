'use client';

import React from 'react';
import FirebaseProvider from './provider';

// This provider ensures that Firebase is initialized only on the client side.
export default function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  return <FirebaseProvider>{children}</FirebaseProvider>;
}
