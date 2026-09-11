import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Binding, Proof, SignatureEnabled, Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import type { ZeroshowPrivateState } from './contract';
import { NETWORK_ID, PRIVATE_STATE_ID } from './constants';

export async function createBrowserProviders(connectedAPI: ConnectedAPI) {
  setNetworkId(NETWORK_ID as NetworkId);
  const config = await connectedAPI.getConfiguration();
  const proofServerUri = config.proverServerUri;
  if (!proofServerUri) {
    throw new Error('Lace did not return a proof server URI. Set Lace → Midnight → Local proof server to http://localhost:6300');
  }
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider(window.location.origin, fetch.bind(window));
  const privateStateProvider = inMemoryPrivateStateProvider<string, ZeroshowPrivateState>();

  return {
    privateStateProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: any) => {
        const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: any) => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
    privateStateId: PRIVATE_STATE_ID,
  };
}
