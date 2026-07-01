<p align="center">
  <img src="public/VBC.svg" alt="VirBiCoin Logo" width="120" height="120">
</p>

<h1 align="center">VBC Stats</h1>

<p align="center">
  <strong>Real-time VirBiCoin Network Statistics Dashboard</strong>
</p>

<p align="center">
  <a href="https://stats.virbicoin.com">
    <img src="https://img.shields.io/badge/Dashboard-stats.virbicoin.com-cyan?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Dashboard">
  </a>
  <a href="https://explorer.virbicoin.com">
    <img src="https://img.shields.io/badge/Explorer-Live-green?style=for-the-badge&logo=ethereum&logoColor=white" alt="Explorer">
  </a>
  <a href="https://discord.virbicoin.com">
    <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/ESLint-10-4B32C3?style=flat-square&logo=eslint&logoColor=white" alt="ESLint">
  <img src="https://img.shields.io/badge/Node.js-≥20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License: MIT">
  </a>
</p>

---

## 📑 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Tech Stack](#-tech-stack)
- [Available Scripts](#️-available-scripts)
- [Project Structure](#-project-structure)
- [Architecture](#️-architecture)
- [Configuration](#-configuration)
- [Docker Deployment](#-docker-deployment)
- [Security](#-security)
- [geth Compatibility](#-geth-compatibility)
- [Network Resources](#-network-resources)
- [Community](#-community)
- [License](#-license)

---

## ⛓️ About

VBC Stats is a modern, real-time blockchain network statistics dashboard for VirBiCoin. It provides live metrics, interactive maps, and detailed node information via WebSocket connections.

| Feature        | Value        |
| -------------- | ------------ |
| **Chain ID**   | `329`        |
| **Symbol**     | `VBC`        |
| **Algorithm**  | Ethash (GPU) |
| **Block Time** | 12-14 sec    |
| **EVM**        | Compatible   |

## ✨ Features

- **Real-time Statistics** — Live blockchain metrics via WebSocket (Primus)
- **Halving Countdown** — Live countdown to the next block reward reduction with era progress
- **Network Map** — Interactive world map showing node locations with Leaflet
- **Modern UI** — Responsive design with Tailwind CSS 4
- **Interactive Charts** — Recharts-powered visualizations
- **Node Management** — Sortable, filterable node table with real-time updates
- **Unified Server** — Single port serves the client (Vite dev / static) and WebSocket
- **Docker Support** — Production-ready Docker configuration
- **geth Compatible** — Works with eth-netstats-client protocol

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/virbicoin/vbc-stats.git
cd vbc-stats

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) to view the dashboard.

## 📦 Tech Stack

| Category   | Technology                                       |
| ---------- | ------------------------------------------------ |
| Build Tool | [Vite 8](https://vite.dev)                       |
| UI Library | [React 19](https://react.dev)                    |
| Language   | [TypeScript 6](https://www.typescriptlang.org)   |
| Styling    | [Tailwind CSS 4](https://tailwindcss.com)        |
| Charts     | [Recharts](https://recharts.org)                 |
| Maps       | [Leaflet](https://leafletjs.com) + React-Leaflet |
| Real-time  | [Primus 8](https://github.com/primus/primus)     |
| Backend    | [Express 5](https://expressjs.com) + Node.js 20+ |
| GeoIP      | geoip-lite                                       |
| Linting    | ESLint 10 + Prettier 3                           |

## 🛠️ Available Scripts

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start dev server (Vite middleware + WebSocket)     |
| `npm run build`     | Build for production                               |
| `npm run start`     | Start production server                            |
| `npm run check`     | Run all quality checks (lint + format + typecheck) |
| `npm run lint`      | Run ESLint                                         |
| `npm run lint:fix`  | Auto-fix ESLint issues                             |
| `npm run typecheck` | TypeScript type check                              |
| `npm run format`    | Format with Prettier                               |
| `npm run updatedb`  | Refresh the geoip-lite database from MaxMind       |

> **Git Hooks**: On `npm install`, the `prepare` script sets `core.hooksPath` to `.githooks`. A **pre-push hook** runs `npm run check` (the same checks as CI) before every `git push` and aborts the push on failure. Auto-fix with `npm run lint:fix && npm run format`, or bypass in an emergency with `git push --no-verify` (discouraged).

## 📁 Project Structure

```
vbc-stats/
├── index.html                  # Vite entry HTML (metadata, fonts, #root)
├── src/                        # Frontend source (SPA)
│   ├── main.tsx                # Entry point (createRoot)
│   ├── App.tsx                 # Root component (Header + Dashboard + Footer)
│   ├── Dashboard.tsx           # Main dashboard (formerly app/page.tsx)
│   ├── index.css               # Global styles (Tailwind)
│   ├── components/             # Reusable UI components
│   │   ├── Charts.tsx          # Chart grid (Recharts, lazy-loads Map)
│   │   ├── HalvingCountdown.tsx # Block reward halving countdown
│   │   ├── Nodes.tsx           # Node table
│   │   ├── Map.tsx             # Leaflet world map
│   │   ├── MinerBlocks.tsx     # Miner block display
│   │   ├── header.tsx          # Header
│   │   └── footer.tsx          # Footer
│   ├── types/                  # TypeScript declarations
│   └── vite-env.d.ts           # Vite client types
├── lib/                        # Server-side libraries
│   ├── collection.ts           # Node collection management
│   ├── express.ts              # Express app setup (+ /geoip)
│   ├── routes/geoip.ts         # GeoIP API handler (Express)
│   └── utils/config.ts         # Server configuration
├── server.ts                   # Unified server (Express + Vite/static + Primus)
├── vite.config.ts              # Vite config (client build → dist/, @ alias)
├── public/                     # Static assets
└── Dockerfile                  # Production Docker image
```

## 🏗️ Architecture

**Development** — `server.ts` runs Vite (middleware) + WebSocket on one port.
**Production** — Nginx serves the static client (`dist/`) and reverse-proxies the
WebSocket/geoip endpoints below to `server.ts` (see [deploy/nginx.conf.example](deploy/nginx.conf.example)):

- **`/primus`** — WebSocket for browser clients (real-time dashboard updates)
- **`/external`** — WebSocket for external services
- **`/api`** — WebSocket for blockchain nodes (miners/validators)
- **`/geoip`** — GeoIP lookup (Express)
- **`/*`** — Client: Vite middleware (dev) / **Nginx serves `dist/`** (prod)

## ⚙️ Configuration

Create a `.env` file:

```env
PORT=5000              # Server port (client + WebSocket unified)
WS_SECRET=your_secret  # WebSocket auth secret (multiple: secret1|secret2)
VITE_WS_URL=           # Client WebSocket URL (omit for same-origin)
```

### GeoIP accuracy

Node locations come from the bundled `geoip-lite` database, whose free GeoLite2
snapshot is inaccurate for IPv6 and cloud/hosting ranges (these often resolve to
the provider's home country rather than the datacenter region). Two optional,
deployment-specific knobs improve this without changing source code:

- **Refresh the database** — set a free MaxMind `LICENSE_KEY` in `.env` and run
  `npm run updatedb`, then rebuild/restart. Improves coverage but cannot fix
  cloud-range misattribution.
- **Pin known nodes** — copy `geo-overrides.example.json` to `geo-overrides.json`
  (git-ignored) or point `GEO_OVERRIDES_FILE` at your own file, then restart.
  Each key matches a node's id or display name and takes precedence over geoip.

## 🚀 Deployment (SSG: static frontend + WebSocket backend)

Production serves the built static client via **Nginx**, which reverse-proxies the
WebSocket/geoip endpoints to the Node backend (`server.ts`). Cloudflare sits in
front of Nginx as a proxy only.

```bash
# On the server
git pull
npm ci
npm run build                      # generates dist/ (the static client Nginx serves)
NODE_ENV=production npm run start   # server.ts (WebSocket + geoip) on :5000
                                   # use pm2/systemd to keep it alive
```

Then point Nginx at `dist/` and proxy `/primus`, `/external`, `/api`, `/geoip`
to `127.0.0.1:5000`. See **[deploy/nginx.conf.example](deploy/nginx.conf.example)**.

## 🔒 Security

- WebSocket authentication via shared secret (WS_SECRET)
- IP-based ban list for API connections
- Connection rate limiting (5 connections / 30s)
- IP address validation on GeoIP endpoint
- Private IP filtering
- Environment secrets excluded from version control

## 🔌 geth Compatibility

Compatible with geth's built-in ethstats client:

- **Latency**: `node-ping` → `node-pong` → `latency` (RTT as string)
- **Blocks**: `difficulty` and `totalDiff` sent as strings, parsed on reception
- **Field mapping**: `totalDiff` → `totalDifficulty`

## 🌐 Network Resources

<table>
  <tr>
    <td align="center">
      <a href="https://explorer.virbicoin.com">
        <img src="https://img.shields.io/badge/🔍_Explorer-blue?style=for-the-badge" alt="Explorer">
      </a>
    </td>
    <td align="center">
      <a href="https://pool.virbicoin.com">
        <img src="https://img.shields.io/badge/⛏️_Mining_Pool-orange?style=for-the-badge" alt="Pool">
      </a>
    </td>
    <td align="center">
      <a href="https://stats.virbicoin.com">
        <img src="https://img.shields.io/badge/📊_Stats-green?style=for-the-badge" alt="Stats">
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://rpc.virbicoin.com">
        <img src="https://img.shields.io/badge/🌐_RPC-teal?style=for-the-badge" alt="RPC">
      </a>
    </td>
    <td align="center">
      <a href="https://www.virbicoin.com">
        <img src="https://img.shields.io/badge/🏠_Website-gray?style=for-the-badge" alt="Website">
      </a>
    </td>
    <td align="center">
      <a href="https://www.virbicoin.com/whitepaper">
        <img src="https://img.shields.io/badge/📄_Whitepaper-slateblue?style=for-the-badge" alt="Whitepaper">
      </a>
    </td>
  </tr>
</table>

## 💬 Community

<p>
  <a href="https://discord.virbicoin.com">
    <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord">
  </a>
  <a href="https://x.com/VirBiCoin">
    <img src="https://img.shields.io/badge/X_(Twitter)-000000?style=for-the-badge&logo=x&logoColor=white" alt="X">
  </a>
  <a href="https://bitcointalk.org/index.php?topic=5546988.0">
    <img src="https://img.shields.io/badge/Bitcointalk-F7931A?style=for-the-badge&logo=bitcoin&logoColor=white" alt="Bitcointalk">
  </a>
  <a href="https://coinpaprika.com/coin/vbc-virbicoin/">
    <img src="https://img.shields.io/badge/CoinPaprika-00d4aa?style=for-the-badge" alt="CoinPaprika">
  </a>
</p>

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ by the VirBiCoin Team</sub>
</p>
