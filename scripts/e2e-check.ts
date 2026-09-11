import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from '../src/network';
import { createWallet, persistWalletState } from '../src/wallet';
import {
  PRIVATE_STATE_ID,
  createProviders,
  defaultZeroshowPrivateState,
  loadCompiledContract,
  zkConfigPathFrom,
} from '../src/contract';

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const PRIVATE_NOTICE = getOrCreateWallet;
const { network, config: networkConfig } = resolveNetwork();
const WALLET = PRIVATE_NOTICE(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

function fail(msg: string): never {
  console.error(`❌ e2e-check failed: ${msg}`);
  process.exit(1);
}

function isHexAddress(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length >= 32;
}

async function main() {
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}.`);
    process.exit(1);
  }
  if (!isHexAddress(deployment.address)) {
    fail(`Deployment address missing or invalid: ${JSON.stringify(deployment, null, 2)}`);
  }

  const zkConfigPath = zkConfigPathFrom(import.meta.url.replace('/scripts/', '/src/'));
  const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'managed', 'zeroshow');
  if (!fs.existsSync(path.join(configPath, 'contract', 'index.js'))) {
    fail('Compiled contract missing — run `npm run compile`.');
  }

  const { compiledContract } = await loadCompiledContract(configPath);
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  const providers = await createProviders(walletCtx, networkConfig, configPath);

  try {
    await findDeployedContract(providers as any, {
      contractAddress: deployment.address,
      compiledContract: compiledContract as any,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: defaultZeroshowPrivateState(),
    });
  } catch (err: any) {
    await walletCtx.wallet.stop();
    fail(`findDeployedContract threw: ${err?.message ?? err}`);
  }

  const onChainState = await providers.publicDataProvider.queryContractState(deployment.address);
  if (!onChainState) {
    await walletCtx.wallet.stop();
    fail(`queryContractState returned null for ${deployment.address}`);
  }

  console.log(`✅ e2e-check passed`);
  console.log(` contractAddress: ${deployment.address}`);
  console.log(` network: ${network}`);

  await walletCtx.wallet.stop();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
