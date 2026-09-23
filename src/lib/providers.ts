import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { LedgerParameters } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type { ZeroshowPrivateState } from '../../witnesses.js';
import type { CircuitId, Providers } from './contract';
import { createWalletProviders } from './wallet-providers';

export async function buildProviders(api: ConnectedAPI, password: string): Promise<Providers> {
  if (password.length < 16) throw new Error('Choose a private-state password with at least 16 characters.');
  const config = await api.getConfiguration();
  const zkConfigProvider = new FetchZkConfigProvider<CircuitId>(`${window.location.origin}/managed`, fetch.bind(window));
  const publicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);
  const response = await fetch(config.indexerUri, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query ZeroshowLatestLedgerParameters { block { ledgerParameters } }' }),
  });
  if (!response.ok) throw new Error(`Midnight indexer returned HTTP ${response.status} while reading Preprod parameters.`);
  const payload = await response.json() as { data?: { block?: { ledgerParameters?: string } }; errors?: Array<{ message?: string }> };
  const encodedParameters = payload.data?.block?.ledgerParameters;
  if (!encodedParameters) throw new Error(payload.errors?.[0]?.message ?? 'Could not read current Preprod ledger parameters.');
  const ledgerParameters = LedgerParameters.deserialize(new Uint8Array((encodedParameters.replace(/^0x/, '').match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16))));
  const proofProvider = await dappConnectorProofProvider(api, zkConfigProvider, ledgerParameters.transactionCostModel.runtimeCostModel);
  const [shielded] = await Promise.all([api.getShieldedAddresses()]);
  const walletProviders = createWalletProviders(api, shielded);
  const privateStateProvider = levelPrivateStateProvider<string, ZeroshowPrivateState>({
    accountId: shielded.shieldedAddress,
    privateStoragePasswordProvider: () => password,
  });
  return { privateStateProvider, publicDataProvider, zkConfigProvider, proofProvider, ...walletProviders };
}
