import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { DEFAULT_CONTRACT, NETWORK_ID, PRIVATE_STATE_ID } from './constants';
import { createZeroshowPrivateState, deployZeroshow, joinZeroshow } from './contract';
import { padShowId, passphraseToSecret, truncAddr } from './encoding';
import { friendlyError } from './errors';
import { useLedger } from './hooks/useLedger';
import { createBrowserProviders } from './providers';
import { listWallets, selectWallet } from './selectWallet';

type WalletState = 'detecting' | 'no-wallet' | 'ready' | 'connecting' | 'connected';

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState(DEFAULT_CONTRACT);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showName, setShowName] = useState('zeroshow-door');
  const [minAge, setMinAge] = useState('18');
  const [ticket, setTicket] = useState('');
  const [guestAge, setGuestAge] = useState('21');
  const deployedRef = useRef<any>(null);
  const providersRef = useRef<any>(null);

  const { ledger, loading: ledgerLoading, error: ledgerError, refresh } = useLedger(
    contractAddress || null,
  );

  const note = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 12));
  }, []);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (listWallets().length > 0) {
        setWalletState('ready');
        clearInterval(id);
      } else if (n > 40) {
        setWalletState('no-wallet');
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const handleConnect = async () => {
    setError(null);
    setWalletState('connecting');
    try {
      const initial = selectWallet();
      const connected = await initial.connect(NETWORK_ID);
      const { unshieldedAddress } = await connected.getUnshieldedAddress();
      const status = await connected.getConnectionStatus();
      if (status.status !== 'connected') {
        throw new Error('Lace did not report a connected status.');
      }
      const providers = await createBrowserProviders(connected);
      providersRef.current = providers;
      setWallet(connected);
      setAddress(unshieldedAddress);
      setWalletState('connected');
      note(`Lace connected on ${NETWORK_ID}: ${truncAddr(unshieldedAddress)}`);
      if (contractAddress) {
        await attachContract(providers, contractAddress, 'join');
      }
    } catch (e) {
      setWalletState('ready');
      setError(friendlyError(e));
    }
  };

  const handleDisconnect = async () => {
    try {
      await (wallet as { disconnect?: () => Promise<void> } | null)?.disconnect?.();
    } catch {
      /* lace may not expose disconnect */
    }
    deployedRef.current = null;
    providersRef.current = null;
    setWallet(null);
    setAddress(null);
    setWalletState('ready');
    note('Lace disconnected.');
  };

  const attachContract = async (providers: any, addressToUse: string, mode: 'join' | 'deploy') => {
    const blank = createZeroshowPrivateState(new Uint8Array(32), 0n);
    let deployed: any;
    if (mode === 'deploy') {
      deployed = await deployZeroshow(providers, blank);
    } else {
      providers.privateStateProvider.setContractAddress(addressToUse);
      deployed = await joinZeroshow(providers, addressToUse, blank);
    }
    deployedRef.current = deployed;
    const resolved =
      deployed?.deployTxData?.public?.contractAddress ??
      deployed?.deployedContractAddress ??
      addressToUse;
    providers.privateStateProvider.setContractAddress(resolved);
    setContractAddress(resolved);
    setJoinInput(resolved);
    note(mode === 'deploy' ? `Deployed Preprod door ${resolved}` : `Joined contract ${resolved}`);
    await refresh();
    return resolved;
  };

  const requireSession = () => {
    if (!wallet || !providersRef.current) throw new Error('Connect Lace first.');
    return providersRef.current;
  };

  const handleJoin = async () => {
    setError(null);
    setBusy('Joining contract…');
    try {
      const providers = requireSession();
      const addr = joinInput.trim();
      if (!/^[0-9a-fA-F]{64}$/.test(addr)) throw new Error('Contract address must be 64 hex characters.');
      await attachContract(providers, addr, 'join');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleDeploy = async () => {
    setError(null);
    setBusy('Deploying to Preprod (proving). Keep Lace open…');
    try {
      const providers = requireSession();
      const addr = await attachContract(providers, joinInput || '0'.repeat(64), 'deploy');
      note('Copy this Preprod address into the README and VITE_DEFAULT_CONTRACT.');
      await navigator.clipboard.writeText(addr).catch(() => undefined);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleOpenShow = async () => {
    setError(null);
    setBusy('Calling openShow… proof may take up to a minute.');
    try {
      requireSession();
      if (!deployedRef.current) throw new Error('Join or deploy a contract first.');
      const tx = await deployedRef.current.callTx.openShow(padShowId(showName.trim() || 'zeroshow-door'), BigInt(minAge || '18'));
      note(`openShow submitted: ${tx.public.txId}`);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleCheckIn = async () => {
    setError(null);
    setBusy('Calling checkIn with private witnesses…');
    try {
      const providers = requireSession();
      if (!deployedRef.current || !contractAddress) throw new Error('Join or deploy a contract first.');
      if (!ticket.trim()) throw new Error('Enter a ticket passphrase. It stays in this browser.');
      const secret = await passphraseToSecret(ticket.trim());
      providers.privateStateProvider.setContractAddress(contractAddress);
      await providers.privateStateProvider.set(
        PRIVATE_STATE_ID,
        createZeroshowPrivateState(secret, BigInt(guestAge || '0')),
      );
      const tx = await deployedRef.current.callTx.checkIn();
      note(`checkIn submitted: ${tx.public.txId}`);
      note('Public ledger should now show a commitment + admitted=true — not your passphrase or age.');
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="shell">
      <header className="mast">
        <div>
          <p className="kicker">Level 2 · Waxing Crescent · Preprod</p>
          <h1>ZeroShow door</h1>
          <p className="lede">
            Prove you belong. The chain sees a commitment and a yes. It never sees the ticket or the age.
          </p>
        </div>
        <div className="wallet">
          {walletState === 'connected' ? (
            <>
              <span className="pill live">Lace · {NETWORK_ID}</span>
              <code title={address ?? ''}>{truncAddr(address ?? '')}</code>
              <button type="button" onClick={() => void handleDisconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={walletState !== 'ready'}
              onClick={() => void handleConnect()}
            >
              {walletState === 'detecting' && 'Looking for Lace…'}
              {walletState === 'no-wallet' && 'Install Lace to connect'}
              {walletState === 'ready' && 'Connect Lace'}
              {walletState === 'connecting' && 'Approve in Lace…'}
            </button>
          )}
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}
      {busy && <div className="banner busy">{busy}</div>}

      <section className="card">
        <h2>Contract on Preprod</h2>
        <div className="row">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.trim())}
            placeholder="64-character Preprod contract address"
            spellCheck={false}
          />
          <button type="button" disabled={!wallet || !!busy} onClick={() => void handleJoin()}>
            Join
          </button>
          <button type="button" disabled={!wallet || !!busy} onClick={() => void handleDeploy()}>
            Deploy new door
          </button>
        </div>
        {contractAddress && (
          <p className="mono">
            Active: <span>{contractAddress}</span>
          </p>
        )}
      </section>

      <div className="grid">
        <section className="card">
          <h2>Host · open the door</h2>
          <p className="hint">Public circuit arguments. These values are meant to be seen.</p>
          <label>
            Show id
            <input value={showName} onChange={(e) => setShowName(e.target.value)} />
          </label>
          <label>
            Minimum age
            <input value={minAge} onChange={(e) => setMinAge(e.target.value)} inputMode="numeric" />
          </label>
          <button type="button" className="primary" disabled={!wallet || !!busy} onClick={() => void handleOpenShow()}>
            Call openShow
          </button>
        </section>

        <section className="card private">
          <h2>Guest · private check-in</h2>
          <p className="hint">Witnesses stay in this tab. The circuit proves them; the ledger never stores them.</p>
          <label>
            Ticket passphrase
            <input
              type="password"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="never written on-chain"
              autoComplete="off"
            />
          </label>
          <label>
            Your age (private)
            <input value={guestAge} onChange={(e) => setGuestAge(e.target.value)} inputMode="numeric" />
          </label>
          <button type="button" className="primary" disabled={!wallet || !!busy} onClick={() => void handleCheckIn()}>
            Call checkIn
          </button>
        </section>
      </div>

      <section className="card ledger">
        <div className="ledger-head">
          <h2>Public ledger</h2>
          <button type="button" onClick={() => void refresh()} disabled={ledgerLoading}>
            Refresh
          </button>
        </div>
        {ledgerError && <p className="hint">{ledgerError}</p>}
        {ledger ? (
          <dl>
            <div>
              <dt>showId</dt>
              <dd>
                {ledger.showIdText}
                <small>{ledger.showIdHex}</small>
              </dd>
            </div>
            <div>
              <dt>minAge</dt>
              <dd>{ledger.minAge}</dd>
            </div>
            <div>
              <dt>ticketCommitment</dt>
              <dd className="break">{ledger.ticketCommitment}</dd>
            </div>
            <div>
              <dt>admitted</dt>
              <dd>{ledger.admitted ? 'true' : 'false'}</dd>
            </div>
            <div>
              <dt>checkIns</dt>
              <dd>{ledger.checkIns}</dd>
            </div>
          </dl>
        ) : (
          <p className="hint">Join a contract to read Preprod state. No wallet needed for this panel.</p>
        )}
        <aside className="privacy">
          <h3>Privacy claim</h3>
          <p>
            Compare what you typed in the guest form with this panel. The age and ticket passphrase never appear
            here. What is disclosed is a SHA-256 ticket commitment, a boolean admitted flag, and a check-in
            counter. That is the observable privacy behavior for Level 2.
          </p>
        </aside>
      </section>

      <section className="card">
        <h2>Session log</h2>
        {log.length === 0 ? <p className="hint">Connect Lace to begin.</p> : (
          <ul className="log">
            {log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
