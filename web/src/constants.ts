export const PRIVATE_STATE_ID = 'zeroshowPrivateState';
export const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID as string) || 'preprod';
export const INDEXER_URL =
  import.meta.env.VITE_INDEXER_URL || 'https://indexer.preprod.midnight.network/api/v4/graphql';
export const DEFAULT_CONTRACT = (import.meta.env.VITE_DEFAULT_CONTRACT as string) || '';
