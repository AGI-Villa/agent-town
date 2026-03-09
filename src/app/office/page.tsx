'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfficePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/town?area=office');
  }, [router]);

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-[#1a1a2e]">
      <p className="font-pixel text-sm text-[#83769c]">Entering Office...</p>
    </main>
  );
}
