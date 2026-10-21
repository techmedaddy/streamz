<p align="center">
  <img src="./assets/streamz-banner.png" alt="streamz" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/techmedaddy/streamz"><img src="https://img.shields.io/badge/status-active-10b981?style=flat-square" alt="Status" /></a>
  <a href="https://kafka.apache.org/"><img src="https://img.shields.io/badge/kafka-KRaft-06b6d4?style=flat-square&logo=apachekafka&logoColor=white" alt="Kafka KRaft" /></a>
  <a href="https://fastify.io/"><img src="https://img.shields.io/badge/fastify-v5-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-15+-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square" alt="License" /></a>
  <a href="http://localhost:3000/docs"><img src="https://img.shields.io/badge/docs-masterclass-8b5cf6?style=flat-square" alt="Docs" /></a>
</p>

# streamz

**streamz** is a distributed order and inventory choreography engine built on **Apache Kafka KRaft**, **Fastify**, and **PostgreSQL**.

Engineered for production and designed for learning, it demonstrates real-world event-driven patterns with zero external dependencies — running 100% locally with a built-in operations UI and an interactive Kafka Masterclass.

---

## ⚡ Quickstart

Get everything running in under 60 seconds:

```bash
# 1. Install dependencies
npm install

# 2. Start Kafka KRaft & PostgreSQL
npm run docker:up

# 3. Start services & dashboard UI
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the operations console or [http://localhost:3000/docs](http://localhost:3000/docs) for the Kafka Masterclass documentation.

---

## 🚀 Features

- **Apache Kafka KRaft Mode** — Raft metadata consensus without ZooKeeper.
- **Zero Overselling** — Atomic row-level locks (`SELECT ... FOR UPDATE`) prevent inventory race conditions.
- **Distributed Sagas** — Automated compensating transactions on stock depletion.
- **Murmur2 Partitioning** — Consistent key-based message routing matching Kafka native standards.
- **Resilient Workers** — Idempotent producers, consumer group rebalancing, and Dead Letter Queues (DLQ).
- **Interactive Console & Docs** — Built-in event simulator, partition calculator, and Kafka masterclass.

---

## 🏛️ Architecture

```mermaid
graph LR
    UI["Operations UI<br/>(:3000)"] --> OS["Order Service<br/>(:3001)"]
    OS -->|orders| K["Kafka KRaft<br/>(:9094)"]
    K -->|inventory-workers| IS["Inventory Service<br/>(:3002)"]
    IS -->|inventory-events| K
    K -->|order-workers| OS
    K -->|notification-workers| NW["Notification Worker<br/>(:3003)"]
    NW -.->|failed| DLQ["DLQ"]
```

---

## 🧪 Tests

```bash
# Run end-to-end choreography test
npm run test:e2e
```

---

## 📖 Documentation

Comprehensive guides, Kafka internals, and architecture blueprints are available in the dedicated documentation portal at [`/docs`](http://localhost:3000/docs).

---

## 📄 License

[MIT](./LICENSE)
