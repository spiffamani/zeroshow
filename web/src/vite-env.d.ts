/// <reference types="vite/client" />
import '@midnight-ntwrk/dapp-connector-api';

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_INDEXER_WS_URL: string;
  readonly VITE_DEFAULT_CONTRACT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
