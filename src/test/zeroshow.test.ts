import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  createZeroshowPrivateState,
  defaultZeroshowPrivateState,
  witnesses,
} from '../../contracts/witnesses.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const contractPath = path.join(root, 'contracts', 'zeroshow.compact');
const managedDir = path.join(root, 'contracts', 'managed', 'zeroshow');

describe('ZeroShow Compact contract', () => {
  it('declares public ledger fields and private witnesses', () => {
    const source = fs.readFileSync(contractPath, 'utf8');
    assert.match(source, /witness ticketSecret\(\): Bytes<32>;/);
    assert.match(source, /witness guestAge\(\): Uint<64>;/);
    assert.match(source, /export ledger showId: Bytes<32>;/);
    assert.match(source, /export ledger minAge: Uint<64>;/);
    assert.match(source, /export ledger ticketCommitment: Bytes<32>;/);
    assert.match(source, /export ledger admitted: Boolean/);
    assert.match(source, /export ledger checkIns: Counter/);
  });

  it('uses disclose() only at public boundaries', () => {
    const source = fs.readFileSync(contractPath, 'utf8');
    assert.match(source, /showId = disclose\(id\);/);
    assert.match(source, /minAge = disclose\(ageGate\);/);
    assert.match(source, /ticketCommitment = disclose\(commitTicket\(secret\)\);/);
    assert.match(source, /admitted = disclose\(true\);/);
    assert.doesNotMatch(source, /ticketSecret\(\)\)\s*;/);
    assert.doesNotMatch(source, /ledger .*guestAge/);
    assert.doesNotMatch(source, /age = disclose/);
  });

  it('never assigns the raw ticket secret or age to the ledger', () => {
    const source = fs.readFileSync(contractPath, 'utf8');
    assert.doesNotMatch(source, /ticketCommitment = secret/);
    assert.doesNotMatch(source, /minAge = age/);
    assert.match(source, /persistentHash/);
  });
});

describe('ZeroShow witnesses', () => {
  it('keeps the ticket secret and age in private state', () => {
    const secret = new Uint8Array(32).fill(9);
    const privateState = createZeroshowPrivateState(secret, 29n);
    const [nextSecretState, returnedSecret] = witnesses.ticketSecret({
      privateState,
      ledger: {},
    } as any);
    const [nextAgeState, returnedAge] = witnesses.guestAge({
      privateState,
      ledger: {},
    } as any);

    assert.equal(returnedSecret, secret);
    assert.equal(returnedAge, 29n);
    assert.equal(nextSecretState, privateState);
    assert.equal(nextAgeState, privateState);
    assert.notEqual(returnedAge, 18n);
  });

  it('ships a default private state that never belongs on the ledger', () => {
    const state = defaultZeroshowPrivateState();
    assert.equal(state.ticketSecret.length, 32);
    assert.equal(typeof state.guestAge, 'bigint');
    assert.ok(state.guestAge >= 18n);
  });
});

describe('compiled circuits and keys', () => {
  it('has a managed/ directory with circuits and proving keys', () => {
    assert.equal(fs.existsSync(managedDir), true, 'run npm run compile first');
    const keysDir = path.join(managedDir, 'keys');
    const zkirDir = path.join(managedDir, 'zkir');
    const contractJs = path.join(managedDir, 'contract', 'index.js');
    assert.equal(fs.existsSync(keysDir), true);
    assert.equal(fs.existsSync(zkirDir), true);
    assert.equal(fs.existsSync(contractJs), true);
    const keyFiles = fs.readdirSync(keysDir);
    assert.ok(keyFiles.some((name) => name.includes('openShow') || name.endsWith('.prover')));
    assert.ok(keyFiles.length > 0);
  });
});
