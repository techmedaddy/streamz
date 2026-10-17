'use client';

import React from 'react';

interface StreamzLogoProps {
  size?: number;
  className?: string;
}

export function StreamzLogo({ size = 18, className = '' }: StreamzLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        fill="url(#streamz-lightning-grad)"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="streamz-lightning-grad"
          x1="3"
          y1="2"
          x2="21"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}
