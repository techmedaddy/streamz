'use client';

import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  GitBranch,
  FileCode,
  BookOpen,
  Server,
  Zap,
  Hash,
  GraduationCap,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { KAFKA_DOCS } from './docs/kafkaContent';

export type NavSection =
  | 'overview'
  | 'inventory'
  | 'orders'
  | 'simulator'
  | 'topics'
  | 'topology'
  | 'contracts'
  | 'kafka-foundations'
  | 'kafka-topics-partitions'
  | 'kafka-kraft-consensus'
  | 'kafka-producers'
  | 'kafka-consumers'
  | 'kafka-enterprise-patterns'
  | 'streamz-architecture'
  | 'specs'
  | 'api';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  skuCount: number;
  orderCount: number;
}

export function Sidebar({
  currentSection,
  onSelectSection,
  skuCount,
  orderCount,
}: SidebarProps) {
  const isDocSection = (s: string) => s.startsWith('kafka-') || s === 'streamz-architecture';

  return (
    <aside
      style={{
        width: '256px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-page)',
        borderRight: '1px solid var(--border-default)',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        height: 'calc(100vh - 56px)',
        position: 'sticky',
        top: '56px',
        overflowY: 'auto',
      }}
    >
      {/* ── Category 1: OPERATIONS ───────────────────────────────────── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            paddingLeft: '8px',
          }}
        >
          Operations
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => onSelectSection('overview')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'overview' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'overview' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'overview' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={14} />
              <span>Live Console</span>
            </div>
          </button>

          <button
            onClick={() => onSelectSection('inventory')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'inventory' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'inventory' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'inventory' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} />
              <span>Warehouse SKUs</span>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                backgroundColor: currentSection === 'inventory' ? '#ffffff' : 'var(--bg-subtle)',
                padding: '1px 5px',
                borderRadius: '3px',
                border: '1px solid var(--border-default)',
              }}
            >
              {skuCount}
            </span>
          </button>

          <button
            onClick={() => onSelectSection('orders')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'orders' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'orders' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'orders' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={14} />
              <span>Dispatch Stream</span>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                backgroundColor: currentSection === 'orders' ? '#ffffff' : 'var(--bg-subtle)',
                padding: '1px 5px',
                borderRadius: '3px',
                border: '1px solid var(--border-default)',
              }}
            >
              {orderCount}
            </span>
          </button>
        </div>
      </div>

      {/* ── Category 2: INTERACTIVE KAFKA EXPLORER ──────────────────── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            paddingLeft: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Interactive Explorer</span>
          <span
            style={{
              fontSize: '9px',
              backgroundColor: 'var(--emerald-subtle)',
              color: 'var(--emerald-text)',
              padding: '1px 4px',
              borderRadius: '3px',
              fontWeight: 700,
            }}
          >
            LEARN
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => onSelectSection('simulator')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'simulator' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'simulator' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'simulator' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <Zap size={14} />
            <span>Event Step Simulator</span>
          </button>

          <button
            onClick={() => onSelectSection('topics')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'topics' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'topics' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'topics' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <Hash size={14} />
            <span>Topics & Partitions</span>
          </button>

          <button
            onClick={() => onSelectSection('topology')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'topology' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'topology' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'topology' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <GitBranch size={14} />
            <span>Topology Flow</span>
          </button>

          <button
            onClick={() => onSelectSection('contracts')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'contracts' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'contracts' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'contracts' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <FileCode size={14} />
            <span>Event Schemas</span>
          </button>
        </div>
      </div>

      {/* ── Category 3: KAFKA MASTERCLASS (DOCS) ────────────────────── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            paddingLeft: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Kafka Masterclass</span>
          </div>
          <Link
            href="/docs"
            style={{
              fontSize: '10px',
              color: 'var(--emerald-text)',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>PORTAL</span>
            <ExternalLink size={10} />
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {KAFKA_DOCS.map((doc) => {
            return (
              <Link
                key={doc.id}
                href={`/docs?chapter=${doc.id}`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontSize: '12px',
                  lineHeight: 1.35,
                  transition: 'background-color 0.12s ease',
                }}
                className="hover:bg-neutral-100"
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    opacity: 0.8,
                    marginTop: '1px',
                  }}
                >
                  {doc.number}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Category 4: SPECIFICATIONS ──────────────────────────────── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            paddingLeft: '8px',
          }}
        >
          Specifications
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => onSelectSection('specs')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'specs' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'specs' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'specs' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <BookOpen size={14} />
            <span>Architecture Specs</span>
          </button>

          <button
            onClick={() => onSelectSection('api')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: currentSection === 'api' ? 'var(--emerald-subtle)' : 'transparent',
              color: currentSection === 'api' ? 'var(--emerald-text)' : 'var(--text-secondary)',
              fontWeight: currentSection === 'api' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
          >
            <Server size={14} />
            <span>Fastify REST API</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
