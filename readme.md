# FlipArena

> **A full-stack, peer-to-peer heads-or-tails betting arena on Solana** — Players connect a wallet, open or accept on-chain matches, and compete head-to-head for 2× the stake. The UI updates in real time over WebSockets, outcomes are resolved on-chain with Orao VRF, and the server tracks matches, chat, and wallet stats in MongoDB.

<p align="center">
  <img src="https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana&logoColor=white" alt="Solana" />
  <img src="https://img.shields.io/badge/Anchor-0.26-000?style=flat" alt="Anchor" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-TypeScript-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js" />
</p>

---

## Overview

FlipArena is split into three packages:

| Package | Role |
|--------|------|
| **fliparena-client** | React UI — wallet connect, open/accept matches, live lobby, chat |
| **fliparena-server** | Node.js WebSocket server — match orchestration, tx relay, MongoDB, VRF settlement |
| **fliparena-program** | Anchor/Rust reference workspace (on-chain program kept from original deploy) |

The **production PvP program** used by the client and server is deployed at:

`472RXUv8zUX7zm4LprxNsFQvAZYEpSGaY9EUE4akCvG6`

---

## Repository structure

```
FlipArena/
├── fliparena-client/           # React + Tailwind + wallet adapter
│   ├── src/
│   │   ├── components/         # UI (arena, modals, header, chat)
│   │   ├── providers/          # Arena socket + effects providers
│   │   └── lib/                # RPC, program IDs, menu tokens
│   └── package.json
│
├── fliparena-server/           # WebSocket server + MongoDB
│   ├── services/               # Anchor txs, refunds, social notify
│   ├── models/                 # Match & chat schemas
│   ├── config/                 # DB connection
│   ├── constants/              # Program ID, seeds, token list
│   ├── index.ts                # WebSocket entry (port 8881)
│   └── package.json
│
├── fliparena-program/          # Anchor workspace (reference)
│   └── anchor-workspace/
│       ├── programs/coinflip/  # Rust program (unchanged on-chain name)
│       ├── tests/
│       └── cli/
│
└── readme.md
```

---

## Getting started

### 1. MongoDB

Create a MongoDB database (local or Atlas) and note credentials for `.env`.

### 2. Server

```bash
cd fliparena-server
yarn install
```

Create `fliparena-server/.env` (see [Configuration](#configuration)).

Place the program IDL at `fliparena-server/program-idl.ts` (gitignored). Copy from `fliparena-program/anchor-workspace/target/types/coinflip.ts` or your build artifacts.

```bash
yarn dev
```

WebSocket listens on **port 8881**.

### 3. Client

```bash
cd fliparena-client
yarn install
```

Edit `fliparena-client/src/lib/constant.ts`:

- Set `WS_HOST` to `ws://localhost:8881`
- Set `RPC` to your Solana cluster URL

```bash
yarn start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

### Server environment (`fliparena-server/.env`)

| Variable | Description |
|----------|-------------|
| `RPC` | Solana RPC URL |
| `PRIVATE_KEY` | Base58 relayer wallet secret |
| `FEE_RECEIVER` | Platform fee recipient |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_HOST` / `DB_NAME` | MongoDB credentials |

Example:

```env
RPC=https://api.devnet.solana.com
PRIVATE_KEY=your_base58_secret_key
FEE_RECEIVER=YourFeeReceiverPublicKey
DB_USERNAME=your_user
DB_PASSWORD=your_password
DB_HOST=cluster0.xxxxx.mongodb.net
DB_NAME=fliparena
```

### Client (`fliparena-client/src/lib/constant.ts`)

| Constant | Purpose |
|----------|---------|
| `FLIPARENA_PROGRAM` | On-chain program public key |
| `WS_HOST` | WebSocket URL |
| `RPC` | Solana JSON-RPC endpoint |

### IDL file

`fliparena-server` imports the IDL from `program-idl.ts`. Regenerate after contract changes:

```bash
anchor idl parse -f target/idl/coinflip.json -o program-idl.ts
```

---

## WebSocket API

Connect to `WS_HOST`. Messages are JSON: `{ "type": "<EVENT>", ... }`.

### Client → server

| Type | Description |
|------|-------------|
| `OPEN_MATCH` | Build open-match tx |
| `ACCEPT_MATCH` | Build accept-match tx |
| `LIST_MATCHES` | List active matches (last 5 minutes) |
| `SUBMIT_MATCH_TX` | `event: "create"` or `"join"` — submit signed txs |
| `GET_WALLET_STATS` | Stats for a wallet address |
| `CHAT_SEND` | Send chat message |
| `LOAD_CHAT` | Paginated chat history (`page`) |

### Server → client

| Type | Description |
|------|-------------|
| `MATCH_OPENED` | Unsigned open tx + match metadata |
| `OPPONENT_JOINED` | Unsigned accept tx + `matchPda` |
| `MATCH_LIST` | Active matches array |
| `MATCH_ADDED` | New match broadcast |
| `OPPONENT_UPDATED` | Opponent joined |
| `PROCESS_UPDATED` | Tx processing state |
| `MATCH_SETTLED` | Match finished with result |
| `MATCH_EXPIRED` | Match expired / refunded |
| `WALLET_STATS` | `{ win, games }` for wallet |
| `CHAT_BATCH` | Chat messages |
| `ERROR` | Error string for UI toasts |

---

## On-chain compatibility

FlipArena keeps the **existing deployed program** unchanged:

- Program ID: `472RXUv8zUX7zm4LprxNsFQvAZYEpSGaY9EUE4akCvG6`
- Instructions: `createGame`, `joinOpposite`, `handleGame` (called internally by server)
- PDA seeds: `coinflip_global_main`, `coinflip_game`
- Randomness: [Orao Solana VRF](https://github.com/orao-network/solana-vrf)

Only application-layer names (folders, models, WebSocket events, UI copy) were rebranded.

---

## Supported tokens

Default list in `fliparena-server/constants/index.ts`: SOL, USDT, USDC, BONK.

---

## Quick reference — run locally

```bash
# Terminal 1 — server
cd fliparena-server && yarn && yarn dev

# Terminal 2 — client
cd fliparena-client && yarn && yarn start
```

Ensure MongoDB is running, `.env` is configured, `program-idl.ts` exists, and `WS_HOST` / `RPC` match your setup.

---

**Keywords:** FlipArena, Solana, anchor, PvP betting, blockchain-game, heads-or-tails, mongodb, websocket
