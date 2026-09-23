import { useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { buildProviders } from './lib/providers';
import { connectOneAm, findOneAmWallet, type OneAmWallet } from './lib/wallet';
import { compiledZeroshow, type Providers } from './lib/contract';
import * as ZeroshowContract from '../managed/contract/index.js';
import type { ZeroshowPrivateState } from '../witnesses';

const STORAGE_KEY = 'zeroshow-contract-preprod';
const initialAddress = import.meta.env.VITE_CONTRACT_ADDRESS ?? localStorage.getItem(STORAGE_KEY) ?? '';

export default function App() {
  const [wallet, setWallet] = useState<OneAmWallet | null>(null);
  const providersRef = useRef<Providers | null>(null);
  const [api, setApi] = useState<ConnectedAPI | null>(null);
  const [walletFound, setWalletFound] = useState(false);
  const [address, setAddress] = useState(initialAddress);
  const [count, setCount] = useState('12');
  const [threshold, setThreshold] = useState('10');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Connect 1AM on Preprod to get started.');
  const [result, setResult] = useState<boolean | null>(null);
  const [verifiedCount, setVerifiedCount] = useState<string | null>(null);
  const [txId, setTxId] = useState('');

  useEffect(() => { const update = () => setWalletFound(Boolean(findOneAmWallet())); update(); window.addEventListener('focus', update); return () => window.removeEventListener('focus', update); }, []);
  useEffect(() => { setNetworkId('preprod'); }, []);

  async function connect() {
    setBusy(true); setStatus('Waiting for 1AM approval…');
    try { const session = await connectOneAm(); setWallet(session.wallet); setApi(session.connected); setStatus('Connected to 1AM on Preprod. The app will send the witness to 1AM for proving.'); }
    catch (error) { setStatus(message(error)); } finally { setBusy(false); }
  }
  function disconnect() { providersRef.current = null; setApi(null); setWallet(null); setResult(null); setStatus('Disconnected from this app. The wallet itself remains unlocked.'); }
  function updateCount(value: string) { setCount(value); setResult(null); }

  async function runProof() {
    if (!api) return;
    const privateCount = parseUint(count, 'Your private task count'); const publicThreshold = parseUint(threshold, 'The public threshold');
    setBusy(true); setResult(null); setStatus('Preparing a private proof…');
    try {
      const providers = providersRef.current ?? await buildProviders(api, password);
      providersRef.current = providers;
      const privateState: ZeroshowPrivateState = { completedTasks: privateCount };
      let contract;
      let activeAddress = address.trim();
      if (!activeAddress) {
        setStatus('Deploying Zeroshow to Preprod… approve the transaction in 1AM.');
        const deployed = await deployContract(providers, { compiledContract: compiledZeroshow, privateStateId: 'zeroshow-private-state', initialPrivateState: privateState });
        contract = deployed;
        activeAddress = deployed.deployTxData.public.contractAddress;
        setAddress(activeAddress);
        localStorage.setItem(STORAGE_KEY, activeAddress);
      } else {
        setStatus('Connecting to your Zeroshow contract…');
        contract = await findDeployedContract(providers, { compiledContract: compiledZeroshow, contractAddress: address.trim(), privateStateId: 'zeroshow-private-state', initialPrivateState: privateState });
      }
      providers.privateStateProvider.setContractAddress(activeAddress as never);
      await providers.privateStateProvider.set('zeroshow-private-state', privateState);
      setStatus('Generating and submitting the proof… approve in 1AM if prompted.');
      const tx = await contract.callTx.proveThreshold(publicThreshold);
      const output = tx.private.result;
      setResult(output); setVerifiedCount(String(ZeroshowContract.ledger(tx.public.nextContractState).verifiedCount));
      setTxId(tx.public.txId ?? '');
      setStatus(output ? 'Proof accepted. The public result is TRUE; your exact count stayed private.' : 'Proof accepted. The public result is FALSE; your exact count stayed private.');
    } catch (error) { setStatus(message(error)); }
    finally { setBusy(false); }
  }

  const detected = walletFound || Boolean(findOneAmWallet());
  return <main className="page-shell">
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">z</span> zeroshow</a><div className="nav-right"><span className="network-pill"><i /> MIDNIGHT · PREPROD</span>{api ? <><span className="wallet-label">{wallet?.api.name || '1AM Wallet'}</span><button className="button button-quiet" onClick={disconnect}>Disconnect</button></> : <button className="button button-connect" onClick={connect} disabled={!detected || busy}>{busy ? 'Connecting…' : detected ? 'Connect 1AM' : '1AM not detected'}</button>}</div></nav>
    <section className="hero" id="top"><div className="eyebrow"><span className="eyebrow-dot"/> PRIVATE ACHIEVEMENT PROOFS <span className="eyebrow-divider"/> BUILT ON MIDNIGHT</div><div className="hero-grid"><div><h1>Show what<br/>you’ve <em>earned.</em></h1><p className="hero-copy">Prove you meet the bar. Keep the details yours.</p><p className="hero-subcopy">Zeroshow checks a private achievement count against a public threshold. The network verifies your claim. Your exact number is never published on-chain.</p><a className="text-link" href="#proof">Make a proof <span>↓</span></a></div><div className="moon-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="moon-glow"/><div className="moon"/><span className="star star-a">✦</span><span className="star star-b">·</span><span className="star star-c">✧</span><div className="moon-caption">DISCLOSE THE CLAIM<br/><b>NOT THE RECORD</b></div></div></div><div className="hero-footer"><span>01 / A PRIVATE PROOF</span><span>WITNESS HANDLED BY 1AM</span><span>ZERO KNOWLEDGE BY DESIGN</span></div></section>
    <section className="proof-section" id="proof"><div className="section-heading"><div><div className="eyebrow muted">THE THRESHOLD CHECK</div><h2>Prove your progress.</h2></div><p>Choose the private count and the public bar.<br/>Only the outcome is disclosed on-chain.</p></div><div className="proof-layout"><div className="proof-card"><div className="card-top"><span className="step-label">YOUR PROOF</span><span className="private-badge"><span/> PRIVATE INPUT</span></div><label htmlFor="count">Tasks completed <span>PRIVATE</span></label><div className="number-control"><input id="count" inputMode="numeric" value={count} onChange={e => updateCount(e.target.value)} disabled={busy || Boolean(providersRef.current)} aria-describedby="private-note"/><span>tasks</span></div><p id="private-note" className="field-note"><span>◈</span> This count is sent to 1AM’s proving provider. It is not included in the on-chain result.</p><div className="field-divider"/><label htmlFor="threshold">Minimum required <span>PUBLIC</span></label><div className="number-control"><input id="threshold" inputMode="numeric" value={threshold} onChange={e => {setThreshold(e.target.value);setResult(null)}} disabled={busy}/><span>tasks</span></div><p className="field-note public-note"><span>◎</span> The threshold and yes/no result are public.</p><div className="field-divider"/><label htmlFor="password">Private state password <span>ENCRYPTED LOCAL</span></label><input className="password-input" id="password" type="password" autoComplete="new-password" minLength={16} placeholder="At least 16 characters" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy || Boolean(providersRef.current)}/><p className="field-note">Used to encrypt your contract state in this browser. Keep it safe.</p><button className="button button-submit" onClick={runProof} disabled={!api || busy || !password || !count || !threshold}>{busy ? <><span className="spinner"/> Working…</> : address ? 'Prove this threshold' : 'Deploy & prove on Preprod'}<span>↗</span></button><div className="status-line"><span className={api ? 'status-lamp live' : 'status-lamp'}/>{status}</div></div><div className="result-column"><div className={'result-card '+(result === null ? '' : result ? 'result-yes' : 'result-no')}><div className="result-top"><span>DISCLOSED RESULT</span><span className="chain-icon">◉</span></div><div className="result-value">{result === null ? <span className="result-empty">—</span> : result ? 'YES' : 'NO'}</div><p>{result === null ? 'Your result will appear here after a successful Preprod transaction.' : 'This boolean is the only claim disclosed by the circuit.'}</p><div className="result-footer"><span>EXACT COUNT</span><b>HIDDEN</b><span className="lock-icon">⌑</span></div></div><div className="contract-card"><div className="mini-heading"><span>NETWORK RECORD</span><span className="live-pill">PREPROD</span></div><div className="record-row"><span>Contract address</span><code>{address ? short(address) : 'Not deployed yet'}</code></div>{address && <div className="record-row"><span>Explorer</span><a href={'https://explorer.preprod.midnight.network/contract/'+encodeURIComponent(address)} target="_blank" rel="noreferrer">View contract ↗</a></div>}<div className="record-row"><span>Verified proofs</span><code>{verifiedCount ?? '—'}</code></div>{txId && <div className="record-row"><span>Latest transaction</span><code>{short(txId)}</code></div>}<div className="record-bottom">The network records proof activity. It does not record your task count.</div></div><div className="privacy-callout"><span className="callout-icon">◈</span><p><b>Private on-chain, self-reported input.</b> The wallet’s proving provider receives the witness; Midnight receives a proof and the disclosed yes/no result. This prototype does not verify that the task count came from an issuer.</p></div></div></div></section>
    <footer><span>ZEROSHOW <b>·</b> A MIDNIGHT DAPP</span><span>SELECTIVE DISCLOSURE FOR REAL LIFE</span><a href="https://docs.midnight.network/" target="_blank" rel="noreferrer">MIDNIGHT DOCS ↗</a></footer>
  </main>;
}
function parseUint(value: string, label: string): bigint { if (!/^\d+$/.test(value)) throw new Error(label+' must be a whole number.'); const parsed=BigInt(value); if(parsed>18446744073709551615n) throw new Error(label+' cannot exceed Uint<64>.'); return parsed; }
function message(error: unknown): string { return error instanceof Error ? error.message : 'Something went wrong while contacting Midnight.'; }
function short(value: string): string { return value.length > 20 ? value.slice(0,10)+'…'+value.slice(-7) : value; }
