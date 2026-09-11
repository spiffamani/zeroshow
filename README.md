# zeroshow

**Get in. Keep the ticket — and your age — to yourself.**

ZeroShow is a privacy-first live-event check-in protocol on [Midnight](https://midnight.network). A host posts a public show id and an age gate. A guest proves they hold a ticket and meet the gate. The ledger learns a commitment and a yes/no. It never learns the ticket secret or the number.

This repository is the Midnight Moon **Level 1 — New Moon** submission (September cohort): toolchain, first Compact contract (public ledger + private witness + deliberate `disclose()`), tests, compiled circuits, Preview deploy, and this product sketch.

---

## Initial product idea

Getting into a show today usually means oversharing. The door scans a QR code tied to an email, a name, sometimes a date of birth. An age-gated venue does not need your birthday. It needs one bit: *are you old enough, and do you hold a valid ticket?*

ZeroShow keeps the **ticket secret** and the **guest age** in Compact witnesses on the guest's machine. The circuit checks `age >= minAge`, hashes the ticket into a public **commitment**, and writes an **admitted** flag. Later levels can add issuer-signed tickets, nullifiers so a ticket cannot be replayed, a Lace-connected door app, and selective disclosure for the promoter — still without putting the raw ticket or the raw age on-chain.

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

## Level 1 scope

What this cycle ships:

- Compact contract with public ledger fields and private witnesses
- `compact compile` producing `contracts/managed/zeroshow` (circuits + keys)
- Passing test suite (`npm test`)
- Deploy to Midnight **Preview** with a visible contract address
- This README (idea + public vs private + local setup)
- At least 5 meaningful commits

What this cycle does **not** ship (later moons): Lace UI, issuer signatures, nullifiers, production key management.

---

## Repository layout

```text
zeroshow/
├── contracts/
│   ├── zeroshow.compact      # Compact source
│   ├── witnesses.ts          # Private-state callbacks for the circuits
│   └── managed/zeroshow/     # Generated circuits + keys (committed for this challenge)
├── src/                      # Deploy, CLI, tests
├── scripts/                  # compile wrapper (WSL on Windows), clean, e2e
├── screenshots/              # Compile output + deploy address
├── docker-compose.yml        # Local node / indexer / proof server
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js 22+**
- **Docker Desktop** with Compose v2 (proof server)
- **Compact compiler 0.31.1** — [Install the Midnight toolchain](https://docs.midnight.network/getting-started/installation)
- On Windows: **WSL Ubuntu**. Compact has no native Windows binary; `npm run compile` calls WSL for you.
- A Preview wallet with tNIGHT from the [Preview faucet](https://midnight-tmnight-preview.nethermind.dev/)

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

Start the proof server (Preview only needs this container):

```bash
npm run proof-server:start
```

Deploy to Midnight **Preview**:

```bash
npm run setup -- --network preview
```

The first Preview run generates a wallet and prints a faucet URL. Fund the address, wait for tNIGHT, then the script deploys and prints the **contract address**. Save a screenshot of that output for the submission.

Wallet seeds live in `.midnight-state.json` (gitignored).

Interact with the deployed contract:

```bash
npm run cli
```

---

## Submission evidence

| Requirement | Where |
| --- | --- |
| Public GitHub repo + README | this repository |
| Setup instructions | [Setup — run locally](#setup--run-locally) |
| Screenshot: compile (circuits listed) | `screenshots/compile.png` |
| Screenshot: deployed address | `screenshots/deploy.png` |
| Public state vs private witness | [section above](#public-state-vs-private-witness) |
| Initial product idea | [section above](#initial-product-idea) |
| 5+ meaningful commits | git history |

---

## Preview deployment

| Field | Value |
| --- | --- |
| Network | Midnight Preview |
| Explorer / faucet | https://midnight-tmnight-preview.nethermind.dev/ |
| Contract address | see `screenshots/deploy.png` after `npm run setup -- --network preview` |

---

## Roadmap (later moons)

| Level | Theme | ZeroShow increment |
| --- | --- | --- |
| 2 Waxing Crescent | Frontend | Door UI + Lace wallet on Preview |
| 3 First Quarter | Production | Tests, CI/CD, issue a real problem statement |
| 4 Waxing Gibbous | MVP | Issuer attestation + nullifier so tickets cannot be replayed |
| 5 Full Moon | Users | Feedback loop and Preprod guests |
| 6 Supermoon | Mainnet | Brand, docs, real venues |

---

## License

MIT
