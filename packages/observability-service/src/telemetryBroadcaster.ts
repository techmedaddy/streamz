import { WebSocket } from 'ws';
import { KafkaAdminHarvester, ClusterOverview } from './adminHarvester.js';
import { PartitionLagEngine, ConsumerGroupLagSummary } from './lagEngine.js';
import { TraceCollector } from './traceCollector.js';
import { EventTraceSpan } from '@streamz/contracts';

export type TelemetryMessageType = 'CLUSTER_SNAPSHOT' | 'EVENT_SPAN' | 'CONNECTED';

export interface TelemetryMessage<T = any> {
  type: TelemetryMessageType;
  timestamp: string;
  payload: T;
}

export interface ClusterSnapshotPayload {
  cluster: ClusterOverview;
  lagSummaries: ConsumerGroupLagSummary[];
  connectedClients: number;
}

export class TelemetryBroadcaster {
  private harvester: KafkaAdminHarvester;
  private lagEngine: PartitionLagEngine;
  private traceCollector: TraceCollector;
  private clients = new Set<WebSocket>();
  private snapshotTimer: NodeJS.Timeout | null = null;
  private isHarvesting = false;

  constructor(
    harvester: KafkaAdminHarvester,
    lagEngine: PartitionLagEngine,
    traceCollector: TraceCollector
  ) {
    this.harvester = harvester;
    this.lagEngine = lagEngine;
    this.traceCollector = traceCollector;

    // Hook immediate event span pulse
    this.traceCollector.on('span', (span: EventTraceSpan) => {
      this.broadcast({
        type: 'EVENT_SPAN',
        timestamp: new Date().toISOString(),
        payload: span,
      });
    });
  }

  /**
   * Registers a newly connected WebSocket client and sends initial handshake.
   */
  public handleConnection(socket: WebSocket): void {
    this.clients.add(socket);

    const sendWelcomeAndSnapshot = () => {
      const welcome: TelemetryMessage<{ clientCount: number }> = {
        type: 'CONNECTED',
        timestamp: new Date().toISOString(),
        payload: { clientCount: this.clients.size },
      };
      try {
        socket.send(JSON.stringify(welcome));
        this.sendSnapshotToClient(socket).catch(() => {});
      } catch {}
    };

    if (socket.readyState === WebSocket.OPEN) {
      sendWelcomeAndSnapshot();
    } else {
      socket.once('open', sendWelcomeAndSnapshot);
    }

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
    });
  }

  /**
   * Starts periodic cluster snapshot broadcasting (default 1000ms).
   */
  public startPeriodicBroadcast(intervalMs = 1000): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    this.snapshotTimer = setInterval(async () => {
      if (this.clients.size === 0 || this.isHarvesting) {
        return;
      }
      await this.broadcastSnapshot();
    }, intervalMs);
  }

  public stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    for (const client of this.clients) {
      try {
        client.close();
      } catch {}
    }
    this.clients.clear();
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcasts a JSON message to all currently connected and open WebSocket clients.
   */
  public broadcast(message: TelemetryMessage): void {
    if (this.clients.size === 0) return;
    const serialized = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(serialized);
        } catch {
          this.clients.delete(client);
        }
      } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Harvests full cluster snapshot and broadcasts to all clients.
   */
  public async broadcastSnapshot(): Promise<void> {
    this.isHarvesting = true;
    try {
      const [cluster, lagSummaries] = await Promise.all([
        this.harvester.getClusterOverview(),
        this.lagEngine.getAllConsumerGroupsLag(),
      ]);

      const snapshot: TelemetryMessage<ClusterSnapshotPayload> = {
        type: 'CLUSTER_SNAPSHOT',
        timestamp: new Date().toISOString(),
        payload: {
          cluster,
          lagSummaries,
          connectedClients: this.clients.size,
        },
      };

      this.broadcast(snapshot);
    } catch {
      // Non-fatal telemetry snapshot skip
    } finally {
      this.isHarvesting = false;
    }
  }

  private async sendSnapshotToClient(socket: WebSocket): Promise<void> {
    try {
      const [cluster, lagSummaries] = await Promise.all([
        this.harvester.getClusterOverview(),
        this.lagEngine.getAllConsumerGroupsLag(),
      ]);

      const snapshot: TelemetryMessage<ClusterSnapshotPayload> = {
        type: 'CLUSTER_SNAPSHOT',
        timestamp: new Date().toISOString(),
        payload: {
          cluster,
          lagSummaries,
          connectedClients: this.clients.size,
        },
      };

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(snapshot));
      }
    } catch {}
  }
}
