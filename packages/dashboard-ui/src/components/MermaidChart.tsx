'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  themeVariables: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '12px',
    primaryColor: '#ffffff',
    primaryTextColor: '#171717',
    primaryBorderColor: '#d4d4d4',
    lineColor: '#737373',
    secondaryColor: '#f5f5f5',
    tertiaryColor: '#fafafa',
  },
});

export function MermaidChart({ chart, id }: { chart: string; id: string }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    try {
      mermaid.render(id, chart).then((result) => {
        setSvg(result.svg);
      });
    } catch (err) {
      console.error('Mermaid render error:', err);
    }
  }, [chart, id]);

  if (!svg) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        Rendering architecture flow...
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
