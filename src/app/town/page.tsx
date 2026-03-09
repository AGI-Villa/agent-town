'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const TownCanvas = dynamic(
  () => import('@/components/game/TownCanvas'),
  { ssr: false }
);

export default function TownPage() {
  const [showUI, setShowUI] = useState(true);

  const initialArea = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('area') || undefined;
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#1a1a2e]">
      <div className="absolute inset-0">
        <TownCanvas initialArea={initialArea} />
      </div>

      {showUI && (
        <>
          <nav className="absolute top-3 left-3 z-50 flex gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
            <a href="/" className="font-pixel text-[9px] text-[#83769c] hover:text-white transition-colors">HOME</a>
            <span className="font-pixel text-[9px] text-[#ffa300]">TOWN</span>
            <a href="/feed" className="font-pixel text-[9px] text-[#83769c] hover:text-white transition-colors">FEED</a>
          </nav>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-1.5">
            <p className="font-pixel text-[8px] text-[#83769c]">
              SCROLL TO ZOOM &bull; DRAG TO PAN &bull; KEYS 1-6 NAVIGATE AREAS &bull; KEY 0 FIT MAP &bull; CLICK AGENT FOR DETAILS
            </p>
          </div>
        </>
      )}

      <button
        onClick={() => setShowUI(v => !v)}
        className="absolute top-3 right-3 z-50 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 font-pixel text-[9px] text-[#83769c] hover:text-white transition-colors"
      >
        {showUI ? 'HIDE UI' : 'SHOW UI'}
      </button>
    </main>
  );
}
