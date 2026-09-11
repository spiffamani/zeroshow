import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';

const COMPATIBLE = '4.x';

export const listWallets = (): InitialAPI[] => {
  const injected = window.midnight;
  if (!injected) return [];
  return Object.values(injected).filter(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE),
  );
};

export const selectWallet = (): InitialAPI => {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error('No Midnight wallet found. Install Lace and refresh.');
  }
  return wallets[0];
};
