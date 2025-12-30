'use client';

import dynamic from 'next/dynamic';

const HeaderClient = dynamic(() => import('./header-client'), { ssr: false });

export default function Header() {
  return <HeaderClient />;
}
