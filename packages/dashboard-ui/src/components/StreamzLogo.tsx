'use client';

import React from 'react';

interface StreamzLogoProps {
  size?: number;
  className?: string;
}

export function StreamzLogo({ size = 20, className = '' }: StreamzLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="streamz-cyan-violet-grad"
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Track 0: Outer Partition Data Stream */}
      <path
        d="M 26 5 H 11 A 6 6 0 0 0 11 17 H 21 A 6 6 0 0 1 21 27 H 6"
        stroke="url(#streamz-cyan-violet-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Track 1: Middle Partition Data Stream */}
      <path
        d="M 26 8.8 H 12 A 3.7 3.7 0 0 0 12 16.2 H 20 A 3.7 3.7 0 0 1 20 23.2 H 6"
        stroke="url(#streamz-cyan-violet-grad)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />

      {/* Track 2: Inner Partition Data Stream */}
      <path
        d="M 26 12.4 H 13 A 1.8 1.8 0 0 0 13 16 H 19 A 1.8 1.8 0 0 1 19 19.6 H 6"
        stroke="url(#streamz-cyan-violet-grad)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
