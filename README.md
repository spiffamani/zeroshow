# zeroshow

**Get in. Keep the ticket — and your age — to yourself.**

ZeroShow is a privacy-first live-event check-in protocol on [Midnight](https://midnight.network). A host posts a public show id and an age gate. A guest proves they hold a ticket and meet the gate. The ledger learns a commitment and a yes/no. It never learns the ticket secret or the number.

This repository is the Midnight Moon **Level 2 — Waxing Crescent** submission (September cohort): the Level 1 Compact contract, wired to a Lace-connected door UI on **Preprod**. The guest's ticket and age stay in the browser; the circuit proves they qualify; the public ledger only learns a hash and a boolean.

Live demo: _pending first Vercel deploy — run `npx vercel --prod` from the repo root, then replace this line._

---

## Initial product idea

Getting into a show today usually means oversharing. The door scans a QR code tied to an email, a name, sometimes a date of birth. An age-gated venue does not need your birthday. It needs one bit: *are you old enough, and do you hold a valid ticket?*

ZeroShow keeps the **ticket secret** and the **guest age** in Compact witnesses on the guest's machine. The circuit checks `age >= minAge`, hashes the ticket into a public **commitment**, and writes an **admitted** flag. Later levels can add issuer-signed tickets, nullifiers so a ticket cannot be replayed, and selective disclosure for the promoter — still without putting the raw ticket or the raw age on-chain.

The name is the product: **zero-knowledge show** admission.

---

## Public state vs private witness

Compact is privacy-by-default. Values that come from a `witness` (or from circuit arguments) are tainted. They cannot be written to the ledger, returned from an exported circuit, or passed to another contract unless we explicitly wrap them in `disclose()`.

| Layer | What it is | In ZeroShow |
| --- | --- | --- |
| **Private witness** | Off-chain data the DApp supplies at proof time. Never stored on the public ledger. Used only to construct the ZK proof. | `ticketSecret` (32 bytes) and `guestAge`. |
| **Public ledger** | On-chain state every observer can read. | `showId`, `minAge`, `ticketCommitment`, `admitted`, `checkIns`. |
| **`disclose()`** | Compiler annotation. Does not itself publish data. It tells Compact it is intentional for a witness-derived value to cross a public boundary. | Used for the show id, the age gate, the ticket **commitment**, and the boolean **admitted** result — never for the raw secret or the raw age. |

**Rule we follow:** prove in-circuit, disclose the *outcome* (and a hash/commitment), never the input.

---

## Level 2 privacy claim

This is the observable privacy behavior reviewers should check in the UI:

1. Type a ticket passphrase and an age in the **Guest** panel. Those fields are browser-only. They are hashed / proven locally. They are never circuit arguments and never ledger fields.
2. Call `checkIn`. The proof asserts `guestAge >= minAge` and commits `persistentHash(["zeroshow:ticket", ticketSecret])`.
3. Refresh the **Public ledger** panel. It must show:
   - `ticketCommitment` — a 32-byte hex hash, **not** the passphrase
   - `admitted` — `true` or `false`
   - `checkIns` — a counter
   - `minAge` / `showId` — host-published public values
4. The passphrase and the numeric age must **not** appear in the public panel, the indexer payload, or the transaction's public effects.

If you type age `17` against a gate of `18`, `checkIn` fails in-circuit (`Guest does not meet the age gate`) and the ledger does not learn why — only that the proof was invalid.

---

## Level 2 scope

What this cycle ships:

- Vite + React door UI (`web/`)
- Lace **connect / disconnect** via the DApp connector API (`window.midnight` enumeration, `connect('preprod')`)
- `openShow` and `checkIn` called from the frontend
- Observable privacy: private form vs public ledger panel
- Contract deployed to Midnight **Preprod**
- Live demo (Vercel)
- This README (privacy claim + Preprod address)
- At least 8 meaningful commits

What later moons still add: issuer-signed tickets, nullifiers, production key management.

---

## Repository layout

```text
zeroshow/
├── contracts/
│   ├── zeroshow.compact      # Compact source
│   ├── witnesses.ts          # Private-state callbacks for the circuits
│   └── managed/zeroshow/     # Generated circuits + keys (committed)
├── web/                      # Vite + React door UI (Lace on Preprod)
├── src/                      # Deploy, CLI, tests
├── scripts/                  # compile wrapper (WSL on Windows), clean, e2e
├── screenshots/              # Compile + deploy evidence
├── docker-compose.yml        # Local node / indexer / proof server
├── vercel.json               # Live demo build
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js 22+**
- **Docker Desktop** with Compose v2 (proof server)
- **Compact compiler 0.31.1** — [Install the Midnight toolchain](https://docs.midnight.network/getting-started/installation)
- On Windows: **WSL Ubuntu**. Compact has no native Windows binary; `npm run compile` calls WSL for you.
- [Lace](https://www.lace.io/) browser extension, network set to **Preprod**
- Preprod tNIGHT from the [Preprod faucet](https://faucet.preprod.midnight.network/), then **Generate tDUST** in Lace (fees)

---

## Setup — run locally

```bash
git clone https://github.com/spiffamani/zeroshow.git
cd zeroshow
npm install
```

Compile the Compact contract (circuits listed in the output):

```bash
npm run compile
# WSL equivalent:
# compact compile contracts/zeroshow.compact contracts/managed/zeroshow
```

Run tests:

```bash
npm test
```

Start the local proof server (Lace → Settings → Midnight → Local `http://localhost:6300`):

```bash
npm run proof-server:start
```

Door UI:

```bash
npm install --prefix web
npm run web
```

Opens `http://localhost:3000`. Connect Lace, join the Preprod contract (or **Deploy new door**), call `openShow`, then `checkIn`.

CLI path (optional):

```bash
npm run setup -- --network preprod
npm run cli -- --network preprod
```

Wallet seeds live in `.midnight-state.json` (gitignored).

---

## Level 2 submission evidence

| Requirement | Where |
| --- | --- |
| Public GitHub repo + README | this repository |
| Live demo | see **Live demo** at the top |
| Lace connect / disconnect | `web/src/App.tsx`, `web/src/selectWallet.ts` |
| Circuit called from the frontend | `openShow` / `checkIn` in the door UI |
| Observable privacy behavior | [Level 2 privacy claim](#level-2-privacy-claim) |
| Preprod contract address | [Preprod deployment](#preprod-deployment) |
| Demo video | wallet connect + successful `checkIn` (record in Chrome with Lace) |
| 8+ meaningful commits | git history |

---

## Preprod deployment

| Field | Value |
| --- | --- |
| Network | Midnight Preprod |
| Faucet | https://faucet.preprod.midnight.network/ |
| Contract address | _deploy from the UI (**Deploy new door**) or `npm run setup -- --network preprod`, then paste the 64-hex address here and into `web/.env` as `VITE_DEFAULT_CONTRACT`_ |
| Proof server | local Docker `midnightntwrk/proof-server:8.1.0` on port 6300 |

After the first Preprod deploy, set `VITE_DEFAULT_CONTRACT` so the live demo joins that door automatically.

---

## Preview deployment (Level 1)

| Field | Value |
| --- | --- |
| Network | Midnight Preview |
| Faucet | https://faucet.preview.midnight.network/ |
| Wallet (unshielded) | `mn_addr_preview1hg085sw00jg6c9l6gmdy94w34vnnn3z08e5ksmfxmln7z6z98w5qr8w5y9` |
| Contract address | `96c0c47ccd7d0b8952a6e6dd0cdd817d1c75c654d6702b62a4340d90c4c2e079` |
| Faucet tx | `0051cd4f55b14a2b6bfe272232336bce8ef3a42f2a208f28e83a92e4fd3dcc3842` |
| Evidence | `screenshots/compile.png`, `screenshots/deploy.png`, `screenshots/faucet.png` |

---

## Roadmap (later moons)

| Level | Theme | ZeroShow increment |
| --- | --- | --- |
| 1 New Moon | Toolchain | Compact contract, tests, Preview deploy |
| 2 Waxing Crescent | Frontend | Door UI + Lace wallet on Preprod |
| 3 First Quarter | Production | Tests, CI/CD, issue a real problem statement |
| 4 Waxing Gibbous | MVP | Issuer attestation + nullifier so tickets cannot be replayed |
| 5 Full Moon | Users | Feedback loop and Preprod guests |
| 6 Supermoon | Mainnet | Brand, docs, real venues |

---

## License

MIT
