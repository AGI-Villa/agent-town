'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { NotificationBell } from '@/components/notifications';
import { YouTubeBGM } from '@/components/audio';

const TownCanvas = dynamic(
  () => import('@/components/game/TownCanvas'),
  { ssr: false }
);

export default function TownPage() {
  const [showUI, setShowUI] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const initialArea = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('area') || undefined;
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#1a1a2e]">
      {/* Hide mobile nav on town page */}
      <style jsx global>{`
        @media (max-width: 767px) {
          nav[aria-label="Mobile navigation"] {
            display: none !important;
          }
        }
      `}</style>

      <div className="absolute inset-0">
        <TownCanvas initialArea={initialArea} />
      </div>

      {showUI && (
        <>
          <nav className="absolute top-3 left-3 z-50 flex items-center gap-2 sm:gap-3 bg-black/60 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-2 safe-area-top">
            <div className="flex gap-1.5 sm:gap-2">
              <a href="/" className="font-pixel text-[8px] sm:text-[9px] text-[#83769c] hover:text-white transition-colors touch-manipulation">HOME</a>
              <span className="font-pixel text-[8px] sm:text-[9px] text-[#ffa300]">TOWN</span>
              <a href="/feed" className="font-pixel text-[8px] sm:text-[9px] text-[#83769c] hover:text-white transition-colors touch-manipulation">FEED</a>
              <a href="/timeline" className="font-pixel text-[8px] sm:text-[9px] text-[#83769c] hover:text-white transition-colors touch-manipulation">TIMELINE</a>
            </div>
            <div className="w-px h-4 bg-[#5f574f]" />
            <NotificationBell />
          </nav>

          {/* Desktop instructions - hidden on mobile */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-1.5 hidden md:block">
            <p className="font-pixel text-[8px] text-[#83769c]">
              SCROLL TO ZOOM &bull; DRAG TO PAN &bull; KEYS 1-6 NAVIGATE AREAS &bull; KEY 0 FIT MAP &bull; CLICK AGENT FOR DETAILS
            </p>
          </div>

          {/* Mobile instructions */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 md:hidden safe-area-bottom">
            <p className="font-pixel text-[7px] text-[#83769c] text-center">
              PINCH TO ZOOM &bull; DRAG TO PAN &bull; TAP AGENT FOR DETAILS
            </p>
          </div>

          {/* Music control - bottom left (Stardew Valley OST via YouTube) */}
          <div className="absolute bottom-3 left-3 z-50 hidden sm:block">
            <YouTubeBGM />
          </div>
        </>
      )}

      <button
        onClick={() => setShowUI(v => !v)}
        className="absolute top-3 right-3 z-50 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 font-pixel text-[8px] sm:text-[9px] text-[#83769c] hover:text-white active:bg-white/10 transition-colors touch-manipulation safe-area-top"
      >
        {showUI ? 'HIDE UI' : 'SHOW UI'}
      </button>
    </main>
  );
}
