import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'streamz',
  description: 'Real-time inventory stock management and order processing operations platform.',
  icons: {
    icon: [
      { url: '/icon.svg?v=3', type: 'image/svg+xml' },
      { url: '/logo.svg?v=3', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg?v=3',
    apple: '/icon.svg?v=3',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg?v=3" />
        <link rel="shortcut icon" href="/icon.svg?v=3" />
      </head>
      <body>{children}</body>
    </html>
  );
}
