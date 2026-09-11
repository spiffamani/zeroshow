import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { WebSocket } from 'ws';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken } from './wallet';
import {
  PRIVATE_STATE_ID,
  createProviders,
  defaultZeroshowPrivateState,
  loadCompiledContract,
  zkConfigPathFrom,
} from './contract';

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

const zkConfigPath = zkConfigPathFrom(import.meta.url);

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function padShowId(text: string): Uint8Array {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(text);
  out.set(encoded.slice(0, 32));
  return out;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ zeroshow CLI                                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(
      `No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`,
    );
    process.exit(1);
  }
  console.log(` Contract: ${deployment.address}`);
  console.log(` Network: ${network}\n`);

  try {
    const { ZeroShow, compiledContract } = await loadCompiledContract(zkConfigPath);

    console.log(' Connecting to wallet...');
    const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(
        ` Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`,
      );
    }

    console.log(' Syncing with network...');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r ⏳ Still syncing... (${elapsed}s elapsed) `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r ✓ Synced with network. \n');

    await persistWalletState(network, walletCtx);
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(` Balance: ${balance.toLocaleString()} tNight\n`);

    if (balance === 0n && network !== 'undeployed' && networkConfig.faucet) {
      const address = walletCtx.unshieldedKeystore.getBech32Address();
      console.log(' ⚠ Wallet has no tNight. Fund it from the faucet to send transactions:');
      console.log(` ${networkConfig.faucet}`);
      console.log(` Wallet address: ${address}\n`);
    }

    console.log(' Connecting to contract...');
    const providers = await createProviders(walletCtx, networkConfig, zkConfigPath);
    const deployed: any = await findDeployedContract(providers as any, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: defaultZeroshowPrivateState(),
    });
    console.log(' ✅ Connected!\n');

    let running = true;
    while (running) {
      console.log('─── Menu ───────────────────────────────────────────────────────');
      console.log(' 1. Open a show (public show id + age gate)');
      console.log(' 2. Check in (private ticket + age stay off-chain)');
      console.log(' 3. Read public ledger');
      console.log(' 4. Check wallet balance');
      console.log(' 5. Exit\n');

      const choice = await rl.question(' Your choice: ');

      switch (choice.trim()) {
        case '1': {
          const showName = await rl.question(' Show id text (padded to 32 bytes): ');
          const ageText = await rl.question(' Minimum age: ');
          const minAge = BigInt(ageText.trim() || '18');
          console.log('\n Submitting openShow (this may take 30-60 seconds)...');
          try {
            const tx = await deployed.callTx.openShow(padShowId(showName.trim() || 'zeroshow-demo'), minAge);
            console.log('\n ✅ Show opened on-chain');
            console.log(` Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            console.error('\n ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }
        case '2': {
          console.log('\n Checking in with the private witness (ticket secret + age).');
          console.log(' Those values never leave this machine except inside the ZK proof.\n');
          console.log(' Submitting checkIn (this may take 30-60 seconds)...');
          try {
            const tx = await deployed.callTx.checkIn();
            console.log('\n ✅ Check-in submitted');
            console.log(` Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            console.error('\n ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }
        case '3': {
          console.log('\n Reading public ledger...');
          try {
            const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
            if (contractState) {
              const ledgerState = ZeroShow.ledger(contractState.data);
              console.log(`\n showId:           ${bytesToHex(ledgerState.showId)}`);
              console.log(` minAge:           ${ledgerState.minAge}`);
              console.log(` ticketCommitment: ${bytesToHex(ledgerState.ticketCommitment)}`);
              console.log(` admitted:         ${ledgerState.admitted}`);
              console.log(` checkIns:         ${ledgerState.checkIns}\n`);
            } else {
              console.log('\n Ledger state empty\n');
            }
          } catch (error) {
            console.error('\n ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }
        case '4': {
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n tNight: ${currentBalance.toLocaleString()}`);
          console.log(` DUST: ${dustBalance.toLocaleString()}\n`);
          break;
        }
        case '5':
          running = false;
          console.log('\n 👋 Goodbye!\n');
          break;
        default:
          console.log('\n ❌ Invalid choice. Please enter 1-5.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
