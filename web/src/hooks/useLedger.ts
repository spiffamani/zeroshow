import { useCallback, useEffect, useState } from 'react';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { ZeroShow } from '../contract';
import { INDEXER_URL } from '../constants';
import { bytesToHex, bytesToText, hexToBytes } from '../encoding';

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

export type PublicLedger = {
  showIdHex: string;
  showIdText: string;
  minAge: string;
  ticketCommitment: string;
  admitted: boolean;
  checkIns: string;
};

export function useLedger(contractAddress: string | null, refreshInterval = 12_000) {
  const [ledger, setLedger] = useState<PublicLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contractAddress || !/^[0-9a-fA-F]{64}$/.test(contractAddress)) {
      setLedger(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CONTRACT_STATE_QUERY,
          variables: { address: contractAddress },
        }),
      });
      const gql = await res.json();
      if (gql.errors) throw new Error(gql.errors[0]?.message ?? 'Indexer query failed');
      const stateHex = gql.data?.contractAction?.state;
      if (!stateHex) throw new Error('Contract not found on Preprod indexer yet');
      const contractState = ContractState.deserialize(hexToBytes(stateHex));
      const onChain = ZeroShow.ledger(contractState.data);
      setLedger({
        showIdHex: bytesToHex(onChain.showId),
        showIdText: bytesToText(onChain.showId) || '(empty)',
        minAge: onChain.minAge.toString(),
        ticketCommitment: bytesToHex(onChain.ticketCommitment),
        admitted: onChain.admitted,
        checkIns: onChain.checkIns.toString(),
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!contractAddress) return;
    const id = setInterval(() => void refresh(), refreshInterval);
    return () => clearInterval(id);
  }, [contractAddress, refreshInterval, refresh]);

  return { ledger, loading, error, refresh };
}
