import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { DEFAULT_CONTRACT, NETWORK_ID, PRIVATE_STATE_ID } from "./constants";
import {
  createZeroshowPrivateState,
  deployZeroshow,
  joinZeroshow,
} from "./contract";
import { padShowId, passphraseToSecret, truncAddr } from "./encoding";
import { friendlyError } from "./errors";
import { useLedger } from "./hooks/useLedger";
import { createBrowserProviders } from "./providers";
import { hasOneAmWallet, selectWallet } from "./selectWallet";

type WalletState =
  "detecting" | "no-wallet" | "ready" | "connecting" | "connected";

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>("detecting");
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState(DEFAULT_CONTRACT);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showName, setShowName] = useState("ZeroShow");
  const [minAge, setMinAge] = useState("18");
  const [ticket, setTicket] = useState("");
  const [guestAge, setGuestAge] = useState("21");
  const deployedRef = useRef<any>(null);
  const providersRef = useRef<any>(null);

  const {
    ledger,
    loading: ledgerLoading,
    error: ledgerError,
    refresh,
  } = useLedger(contractAddress || null);

  const note = useCallback((line: string) => {
    setLog((prev) =>
      [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 12),
    );
  }, []);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (hasOneAmWallet()) {
        setWalletState("ready");
        clearInterval(id);
      } else if (n > 40) {
        setWalletState("no-wallet");
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const handleConnect = async () => {
    setError(null);
    setWalletState("connecting");
    try {
      const initial = selectWallet();
      const connected = await initial.connect(NETWORK_ID);
      const { unshieldedAddress } = await connected.getUnshieldedAddress();
      const status = await connected.getConnectionStatus();
      if (status.status !== "connected") {
        throw new Error("1AM did not report a connected status.");
      }
      const providers = await createBrowserProviders(connected);
      providersRef.current = providers;
      setWallet(connected);
      setAddress(unshieldedAddress);
      setWalletState("connected");
      note(
        `${initial.name} connected on ${NETWORK_ID}: ${truncAddr(unshieldedAddress)}`,
      );
      if (contractAddress) {
        await attachContract(providers, contractAddress, "join");
      }
    } catch (e) {
      setWalletState("ready");
      setError(friendlyError(e));
    }
  };

  const handleDisconnect = async () => {
    try {
      await (
        wallet as { disconnect?: () => Promise<void> } | null
      )?.disconnect?.();
    } catch {
      /* The connector may not expose disconnect. */
    }
    deployedRef.current = null;
    providersRef.current = null;
    setWallet(null);
    setAddress(null);
    setWalletState("ready");
    note("Disconnected from this app.");
  };

  const attachContract = async (
    providers: any,
    addressToUse: string,
    mode: "join" | "deploy",
  ) => {
    const blank = createZeroshowPrivateState(new Uint8Array(32), 0n);
    let deployed: any;
    if (mode === "deploy") {
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
    note(
      mode === "deploy"
        ? `Deployed Preprod show ${resolved}`
        : `Joined contract ${resolved}`,
    );
    await refresh();
    return resolved;
  };

  const requireSession = () => {
    if (!wallet || !providersRef.current) throw new Error("Connect 1AM first.");
    return providersRef.current;
  };

  const handleJoin = async () => {
    setError(null);
    setBusy("Joining contract…");
    try {
      const providers = requireSession();
      const addr = joinInput.trim();
      if (!/^[0-9a-fA-F]{64}$/.test(addr))
        throw new Error("Contract address must be 64 hex characters.");
      await attachContract(providers, addr, "join");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleDeploy = async () => {
    setError(null);
    setBusy("Deploying to Preprod (proving). Keep 1AM open…");
    try {
      const providers = requireSession();
      const addr = await attachContract(
        providers,
        joinInput || "0".repeat(64),
        "deploy",
      );
      note(
        "Copy this Preprod address into the README and VITE_DEFAULT_CONTRACT.",
      );
      await navigator.clipboard.writeText(addr).catch(() => undefined);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleOpenShow = async () => {
    setError(null);
    setBusy("Calling openShow… proof may take up to a minute.");
    try {
      requireSession();
      if (!deployedRef.current)
        throw new Error("Join or deploy a contract first.");
      const tx = await deployedRef.current.callTx.openShow(
        padShowId(showName.trim() || "zeroshow"),
        BigInt(minAge || "18"),
      );
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
    setBusy("Calling checkIn with private witnesses…");
    try {
      const providers = requireSession();
      if (!deployedRef.current || !contractAddress)
        throw new Error("Join or deploy a contract first.");
      if (!ticket.trim())
        throw new Error(
          "Enter your ticket passphrase to create the private proof.",
        );
      const secret = await passphraseToSecret(ticket.trim());
      providers.privateStateProvider.setContractAddress(contractAddress);
      await providers.privateStateProvider.set(
        PRIVATE_STATE_ID,
        createZeroshowPrivateState(secret, BigInt(guestAge || "0")),
      );
      const tx = await deployedRef.current.callTx.checkIn();
      note(`checkIn submitted: ${tx.public.txId}`);
      note(
        "Public ledger should now show a commitment + admitted=true — not your passphrase or age.",
      );
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="ZeroShow home">
          <span className="brand-mark" aria-hidden="true">
            z
          </span>
          <span>ZeroShow</span>
        </a>
        <div className="topbar-actions">
          <span className="network-chip">
            <i /> MIDNIGHT <b>·</b> PREPROD
          </span>
          {walletState === "connected" ? (
            <div className="wallet-connected">
              <span className="wallet-pulse" />
              <span className="wallet-name">1AM connected</span>
              <code title={address ?? ""}>{truncAddr(address ?? "")}</code>
              <button
                type="button"
                className="button button-light"
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </button>
            </div>
          ) : walletState === "no-wallet" ? (
            <a
              className="button button-dark"
              href="https://1am.xyz/"
              target="_blank"
              rel="noreferrer"
            >
              Get 1AM <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <button
              type="button"
              className="button button-dark"
              disabled={walletState !== "ready"}
              onClick={() => void handleConnect()}
            >
              {walletState === "detecting" && "Finding 1AM…"}
              {walletState === "ready" && "Connect 1AM"}
              {walletState === "connecting" && "Approve in 1AM…"}
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> PRIVATE EVENT ADMISSION
          </p>
          <h1>
            Get in.
            <br />
            <em>Keep your details.</em>
          </h1>
          <p className="hero-description">
            Prove you know your ticket secret and meet the age requirement. The
            public ledger records your admission, never your raw passphrase or
            age.
          </p>
          <a className="hero-link" href="#check-in">
            Make a private proof <span>↓</span>
          </a>
          <div className="hero-signals">
            <span>
              <i>01</i> Ticket secret stays off-ledger
            </span>
            <span>
              <i>02</i> Age stays off-ledger
            </span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of a private ZeroShow admission pass"
        >
          <div className="art-orbit orbit-a" />
          <div className="art-orbit orbit-b" />
          <div className="art-star star-a">✳</div>
          <div className="art-star star-b">·</div>
          <div className="art-star star-c">✦</div>
          <div className="pass-preview">
            <div className="pass-top">
              <span className="pass-symbol">z</span>
              <span>
                ZEROSHOW <i>PRIVATE PASS</i>
              </span>
              <span className="pass-dots">•••</span>
            </div>
            <div className="pass-label">YOUR ENTRY, YOURS</div>
            <div className="pass-title">
              One proof.
              <br />
              <em>No personal details.</em>
            </div>
            <div className="pass-divider">
              <span />
              <span />
            </div>
            <div className="pass-facts">
              <span>
                Ticket secret <b>HIDDEN</b>
              </span>
              <span>
                Your age <b>PRIVATE</b>
              </span>
            </div>
            <div className="pass-code" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="art-caption">
            <span className="caption-dot" /> PRIVATE BY DESIGN
          </div>
        </div>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          <span>!</span>
          {error}
        </div>
      )}
      {busy && (
        <div className="notice notice-busy" role="status">
          <span className="loading-dot" />
          {busy}
        </div>
      )}

      <section className="workbench" id="check-in">
        <div className="main-column">
          <section className="surface checkin-card">
            <div className="section-topline">
              <span className="step-number">01</span>
              <span>GUEST CHECK-IN</span>
              <span className="private-tag">
                <i /> PRIVATE INPUT
              </span>
            </div>
            <h2>Prove your entry.</h2>
            <p className="section-intro">
              Your ticket secret and age are used to create a proof. The
              configured proving service receives them; the public ledger does
              not.
            </p>
            <div className="input-grid">
              <label className="field-label">
                Ticket passphrase <span>SECRET</span>
                <input
                  type="password"
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder="Use a long, random passphrase"
                  autoComplete="off"
                />
                <small>
                  A commitment is public, so avoid easy-to-guess phrases.
                </small>
              </label>
              <label className="field-label">
                Your age <span>PRIVATE</span>
                <input
                  value={guestAge}
                  onChange={(e) => setGuestAge(e.target.value)}
                  inputMode="numeric"
                  placeholder="Enter your age"
                />
                <small>Only the admission outcome is recorded.</small>
              </label>
            </div>
            <button
              type="button"
              className="button button-primary button-wide"
              disabled={
                !wallet || !!busy || !ticket.trim() || !deployedRef.current
              }
              onClick={() => void handleCheckIn()}
            >
              <span>{busy ? "Creating your proof…" : "Prove & check in"}</span>
              <span aria-hidden="true">↗</span>
            </button>
            {!wallet && <p className="action-hint">Connect 1AM to continue.</p>}
            {wallet && !deployedRef.current && (
              <p className="action-hint">
                Join or deploy a show using Host setup to continue.
              </p>
            )}
          </section>

          <section className="surface ledger-card">
            <div className="ledger-title-row">
              <div>
                <div className="section-topline">
                  <span className="step-number step-green">02</span>
                  <span>ON-CHAIN VIEW</span>
                </div>
                <h2>What the network sees.</h2>
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => void refresh()}
                disabled={ledgerLoading}
              >
                {ledgerLoading ? "Refreshing…" : "Refresh"} <span>↻</span>
              </button>
            </div>
            {ledgerError && <p className="ledger-empty">{ledgerError}</p>}
            {ledger ? (
              <div className="ledger-metrics">
                <div className="metric metric-highlight">
                  <span>ADMISSION</span>
                  <strong>
                    {ledger.admitted ? "Admitted" : "Not admitted"}
                  </strong>
                  <small>Public result</small>
                </div>
                <div className="metric">
                  <span>TICKET COMMITMENT</span>
                  <strong className="commitment-value">
                    {ledger.ticketCommitment}
                  </strong>
                  <small>One-way commitment</small>
                </div>
                <div className="metric">
                  <span>CHECK-INS</span>
                  <strong>{ledger.checkIns}</strong>
                  <small>Public counter</small>
                </div>
                <div className="ledger-meta">
                  <span>
                    Show <b>{ledger.showIdText || "—"}</b>
                  </span>
                  <span>
                    Minimum age <b>{ledger.minAge || "—"}</b>
                  </span>
                </div>
              </div>
            ) : !ledgerError ? (
              <div className="ledger-empty">
                <span className="empty-icon">◈</span>
                <strong>Waiting for a show</strong>
                <p>
                  Join a Preprod contract to read its public state. You can view
                  the ledger without connecting a wallet.
                </p>
              </div>
            ) : null}
            <div className="privacy-note">
              <span className="privacy-icon">✳</span>
              <p>
                <strong>Your privacy, clearly.</strong> The ledger never shows
                the raw passphrase or age. The proving service receives
                witnesses to generate the proof. This prototype does not verify
                that a promoter issued the ticket.
              </p>
            </div>
          </section>
        </div>

        <aside className="side-column">
          <details className="surface host-card" open={!contractAddress}>
            <summary>
              <span className="host-icon">⌘</span>
              <span>
                <b>Host setup</b>
                <small>Choose or create a Preprod show</small>
              </span>
              <span className="summary-chevron">⌄</span>
            </summary>
            <div className="host-content">
              <label className="field-label">
                Contract address
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.trim())}
                  placeholder="Paste a Preprod address"
                  spellCheck={false}
                />
              </label>
              <div className="button-pair">
                <button
                  type="button"
                  className="button button-light"
                  disabled={!wallet || !!busy}
                  onClick={() => void handleJoin()}
                >
                  Join show
                </button>
                <button
                  type="button"
                  className="button button-dark"
                  disabled={!wallet || !!busy}
                  onClick={() => void handleDeploy()}
                >
                  Deploy new
                </button>
              </div>
              {contractAddress && (
                <p className="active-contract">
                  <i /> SHOW CONNECTED{" "}
                  <code title={contractAddress}>
                    {truncAddr(contractAddress)}
                  </code>
                </p>
              )}
              <div className="host-divider" />
              <label className="field-label">
                Show name <span>PUBLIC</span>
                <input
                  value={showName}
                  onChange={(e) => setShowName(e.target.value)}
                  placeholder="ZeroShow"
                />
              </label>
              <label className="field-label">
                Minimum age <span>PUBLIC</span>
                <input
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <button
                type="button"
                className="button button-primary button-wide"
                disabled={!wallet || !!busy || !deployedRef.current}
                onClick={() => void handleOpenShow()}
              >
                Open this show <span aria-hidden="true">↗</span>
              </button>
            </div>
          </details>

          <section className="surface status-card">
            <div className="status-icon">◎</div>
            <div>
              <span className="status-title">
                {wallet ? "1AM CONNECTED" : "WALLET STATUS"}
              </span>
              <p>Midnight Preprod</p>
              <small>
                {wallet
                  ? "Wallet is authorized for this browser session."
                  : "Connect 1AM to create a proof."}
              </small>
            </div>
          </section>
          <details className="surface activity-card">
            <summary>
              <span>Recent activity</span>
              <span className="summary-chevron">⌄</span>
            </summary>
            {log.length ? (
              <ul className="activity-list">
                {log.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="activity-empty">
                Your show activity will appear here.
              </p>
            )}
          </details>
        </aside>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark">z</span>
          <span>ZeroShow</span>
        </a>
        <span>PRIVATE EVENT ADMISSION ON MIDNIGHT</span>
        <a
          href="https://docs.midnight.network/"
          target="_blank"
          rel="noreferrer"
        >
          MIDNIGHT NETWORK ↗
        </a>
      </footer>
    </main>
  );
}
