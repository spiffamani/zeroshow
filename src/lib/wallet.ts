import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global { interface Window { midnight?: Record<string, InitialAPI> } }

export type OneAmWallet = { id: string; api: InitialAPI };

export function findOneAmWallet(): OneAmWallet | undefined {
  const match = Object.entries(window.midnight ?? {}).find(([, api]) => {
    const label = `${api.name} ${api.rdns}`.toLowerCase();
    return label.includes('1am') || label.includes('oneam');
  });
  return match ? { id: match[0], api: match[1] } : undefined;
}

export async function connectOneAm(): Promise<{ wallet: OneAmWallet; connected: ConnectedAPI }> {
  const wallet = findOneAmWallet();
  if (!wallet) throw new Error('1AM Wallet was not detected. Install or unlock the 1AM browser extension, then reload this page.');
  if (!/^4\./.test(wallet.api.apiVersion)) throw new Error(`Unsupported 1AM connector version: ${wallet.api.apiVersion}. This app needs DApp Connector API 4.x.`);
  const connected = await wallet.api.connect('preprod');
  const configuration = await connected.getConfiguration();
  if (configuration.networkId !== 'preprod') throw new Error(`Connected wallet reports ${configuration.networkId}; switch 1AM to Preprod and reconnect.`);
  return { wallet, connected };
}
