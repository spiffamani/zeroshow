import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';

const COMPATIBLE = '4.x';
const isOneAm = (wallet: InitialAPI): boolean => /1\s?am/i.test(wallet.name);

export const listWallets = (): InitialAPI[] => {
  const injected = window.midnight;
  if (!injected) return [];
  return Object.values(injected).filter(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      'name' in wallet &&
      semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE),
  );
};

export const hasOneAmWallet = (): boolean => listWallets().some(isOneAm);

export const selectWallet = (): InitialAPI => {
  const wallet = listWallets().find(isOneAm);
  if (!wallet) throw new Error('1AM Wallet was not detected. Install or unlock 1AM, then refresh this page.');
  return wallet;
};
