'use client';

import { FirebaseProvider } from '@/firebase';
import { AuthForm } from '@/components/auth/auth-form';
import { Logo } from '@/components/logo';

export default function LoginPage() {
    return (
        <FirebaseProvider>
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                <div className="w-full max-w-sm">
                    <div className="mb-8 flex justify-center">
                        <Logo />
                    </div>
                    <AuthForm />
                </div>
            </div>
        </FirebaseProvider>
    )
}
