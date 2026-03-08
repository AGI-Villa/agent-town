'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { StatusGrid } from '@/components/status/StatusGrid';

const TownCanvas = dynamic(
  () => import('@/components/game/TownCanvas'),
  { ssr: false }
);

type ViewMode = 'town' | 'grid';

export default function TownPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('town');

  return (
    <main className="min-h-screen bg-[#000000]">
      {/* Header */}
      <header className="border-b-4 border-[#5f574f] bg-[#1d2b53] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" role="img" aria-label="Town">
                🏘️
              </span>
              <div>
                <h1 className="font-pixel text-lg text-[#fff1e8] sm:text-xl">
                  AGENT TOWN
                </h1>
                <p className="font-pixel text-[10px] text-[#c2c3c7]">
                  TOWN VIEW
                </p>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('town')}
                className={`font-pixel text-[10px] px-3 py-2 border-2 transition-colors ${
                  viewMode === 'town'
                    ? 'border-[#ffa300] text-[#ffa300] bg-[#ffa300]/10'
                    : 'border-[#5f574f] text-[#83769c] hover:text-[#fff1e8] hover:border-[#fff1e8]'
                }`}
                aria-pressed={viewMode === 'town'}
              >
                TOWN
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`font-pixel text-[10px] px-3 py-2 border-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'border-[#ffa300] text-[#ffa300] bg-[#ffa300]/10'
                    : 'border-[#5f574f] text-[#83769c] hover:text-[#fff1e8] hover:border-[#fff1e8]'
                }`}
                aria-pressed={viewMode === 'grid'}
              >
                GRID
              </button>
            </div>
          </div>

          <nav className="mt-4 flex gap-4" aria-label="Main navigation">
            <a
              href="/"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              HOME
            </a>
            <a
              href="/status"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              STATUS
            </a>
            <a
              href="/office"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              OFFICE
            </a>
            <a
              href="/town"
              className="font-pixel text-[10px] text-[#ffa300] underline underline-offset-4"
              aria-current="page"
            >
              TOWN
            </a>
            <a
              href="/feed"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              FEED
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {viewMode === 'town' ? (
          <div className="flex flex-col">
            <div className="border-4 border-[#5f574f] rounded-none overflow-hidden bg-[#1d2b53] p-4">
              <TownCanvas />
            </div>
            <p className="text-[#83769c] mt-4 font-pixel text-[10px] text-center">
              CLICK ON AN AGENT TO VIEW DETAILS • USE NUMBER KEYS 1-5 TO NAVIGATE • RIGHT-CLICK DRAG TO PAN
            </p>
          </div>
        ) : (
          <StatusGrid />
        )}
      </div>
    </main>
  );
}
