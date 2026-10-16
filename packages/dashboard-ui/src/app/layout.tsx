import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Streamz — Real-Time Kafka Observability & Event Choreography Console',
  description:
    'Deep-dive Kafka internals observability dashboard with real-time partition lag heatmaps, distributed trace waterfalls, cluster topology, and chaos failure injection.',
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
      </head>
      <body>{children}</body>
    </html>
  );
}
