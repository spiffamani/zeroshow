# Zeroshow

Zeroshow is a Midnight DApp prototype for proving a private achievement threshold. A user enters an achievement count and a public minimum. The Compact contract compares them, discloses the yes/no result, and increments a public proof counter. The exact count is not recorded on-chain.

## Level 2 DApp

The app is a React + Vite frontend wired to the compiled Compact contract and Midnight.js 4.1.1. It connects to the **1AM Wallet** through Midnight's DApp Connector API v4, requests the Preprod network, delegates proof generation to the connected wallet, and submits deploy/call transactions through that wallet.

### Privacy boundary

- The task count is entered in the browser and stored as contract private state encrypted by the browser's local private-state provider. The input field itself is not saved in local storage.
- **The connected wallet's proving provider receives the proof preimage, which contains the private witness.** The wallet chooses its proving modality; Zeroshow does not guarantee that proving data stays on the user's device. Only the zero-knowledge proof and the circuit's disclosed boolean are submitted to Midnight.
- Public ledger state contains only `verifiedCount`; the threshold and disclosed yes/no result are visible in the transaction.
- The task count is currently self-reported. The proof establishes that the entered number meets the threshold; it does not establish that an issuer verified the underlying achievements. Issuer attestations are future work.

## Run locally

Requirements: Node.js 22+, the Compact compiler, a browser with the 1AM extension, and a 1AM wallet configured for Midnight Preprod.

```sh
npm install
npm run compact
npm run dev
```

Open the local Vite URL, connect 1AM on Preprod, enter a private-state password (at least 16 characters), set the private count and public threshold, then choose **Deploy & prove on Preprod**. Approve the wallet requests. The first proof flow deploys the contract; later flows use the saved contract address. The address is stored in local storage and can be supplied before build with `VITE_CONTRACT_ADDRESS`.

Build for hosting with:

```sh
npm run build
npm run preview
```

The build copies the compiled contract's proving/verifying keys and ZKIR files into `dist/managed`. Host the contents of `dist` on a static host such as Vercel or Netlify.

## Wallet behavior

Connect asks the 1AM extension for a Preprod connection. Disconnect clears the app's active connector session; the extension remains unlocked because the DApp Connector API does not provide a wallet-wide lock operation. The frontend verifies the wallet's reported network before allowing contract actions.

The Level 2 prompt names Lace, while this submission intentionally uses 1AM at the user's request. The challenge reviewer may treat that as a deviation from its wallet-connect requirement.

## Project layout

- `contracts/zeroshow.compact`: threshold proof circuit and public ledger counter.
- `witnesses.ts`: returns the private achievement count to Compact at proving time.
- `managed/`: compiled contract module and proof artifacts.
- `src/lib/`: connector discovery, wallet transaction adapter, providers, and compiled-contract setup.
- `src/App.tsx`: wallet controls, private threshold form, deployment/circuit transaction flow, and result display.
- `test/`: simulator-based contract tests.

## What the proof shows

The public output answers only whether `completedTasks >= threshold`. The exact task count stays out of the on-chain ledger. Because the count is self-reported, a production product would need trusted achievement inputs (for example, signed issuer attestations) before a verifier could treat the claim as evidence of real-world completion.
