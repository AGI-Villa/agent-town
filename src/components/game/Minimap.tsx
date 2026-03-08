'use client';

import { useEffect, useRef, useState } from 'react';

interface MinimapProps {
  mapWidth: number;
  mapHeight: number;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
  areas: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  onAreaClick?: (areaName: string) => void;
}

export function Minimap({
  mapWidth,
  mapHeight,
  viewportX,
  viewportY,
  viewportWidth,
  viewportHeight,
  areas,
  onAreaClick,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapWidth = 160;
  const minimapHeight = 120;
  const scaleX = minimapWidth / mapWidth;
  const scaleY = minimapHeight / mapHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1d2b53';
    ctx.fillRect(0, 0, minimapWidth, minimapHeight);

    // Draw areas
    areas.forEach((area) => {
      ctx.fillStyle = area.color;
      ctx.fillRect(
        area.x * scaleX,
        area.y * scaleY,
        area.width * scaleX,
        area.height * scaleY
      );
      
      // Area border
      ctx.strokeStyle = '#5f574f';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        area.x * scaleX,
        area.y * scaleY,
        area.width * scaleX,
        area.height * scaleY
      );
    });

    // Draw viewport indicator
    ctx.strokeStyle = '#fff1e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      viewportX * scaleX,
      viewportY * scaleY,
      viewportWidth * scaleX,
      viewportHeight * scaleY
    );
  }, [viewportX, viewportY, viewportWidth, viewportHeight, areas, scaleX, scaleY]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAreaClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;

    // Find clicked area
    for (const area of areas) {
      if (
        x >= area.x &&
        x < area.x + area.width &&
        y >= area.y &&
        y < area.y + area.height
      ) {
        onAreaClick(area.name);
        break;
      }
    }
  };

  return (
    <div className="border-2 border-[#5f574f] bg-[#1d2b53]">
      <div className="border-b border-[#5f574f] px-2 py-1">
        <span className="font-pixel text-[8px] text-[#c2c3c7]">MAP</span>
      </div>
      <canvas
        ref={canvasRef}
        width={minimapWidth}
        height={minimapHeight}
        onClick={handleClick}
        className="cursor-pointer"
        style={{ display: 'block' }}
      />
      {/* Area labels */}
      <div className="px-2 py-1 flex flex-wrap gap-2">
        {areas.map((area) => (
          <button
            key={area.name}
            onClick={() => onAreaClick?.(area.name)}
            className="font-pixel text-[8px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
          >
            {area.name.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
