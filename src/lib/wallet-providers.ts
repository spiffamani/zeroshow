import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { UnboundTransaction, WalletProvider, MidnightProvider, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { Binding, type CoinPublicKey, type EncPublicKey, type FinalizedTransaction, type Proof, type SignatureEnabled, Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => new Uint8Array((value.replace(/^0x/, '').match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16)));
type ShieldedKeys = Awaited<ReturnType<ConnectedAPI['getShieldedAddresses']>>;

export function createWalletProviders(api: ConnectedAPI, shielded: ShieldedKeys) {
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey as CoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey as EncPublicKey,
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx)) as Transaction<SignatureEnabled, Proof, Binding>;
    },
  };
  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      const [txId] = tx.identifiers();
      if (!txId) throw new Error('Midnight returned a transaction without an ID.');
      await api.submitTransaction(toHex(tx.serialize()));
      return txId;
    },
  };
  return { walletProvider, midnightProvider } satisfies Pick<MidnightProviders, 'walletProvider' | 'midnightProvider'>;
}
