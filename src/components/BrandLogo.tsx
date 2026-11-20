'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
}

const SIZE_MAP = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
};

export function BrandLogo({
  size = 'md',
  showText = false,
  subtitle,
}: BrandLogoProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div
        className={`${SIZE_MAP[size]} relative rounded-full overflow-hidden ring-2 ring-red-600/80 shadow-lg shadow-red-600/20 bg-zinc-950 shrink-0`}
      >
        <img
          src="/cmgamer-logo.jpg"
          alt="CM GAMER Logo"
          className="w-full h-full object-cover scale-[1.18]"
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-black tracking-tight text-white">
              CM <span className="text-red-500">GAMER</span>
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] font-medium text-zinc-400">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
