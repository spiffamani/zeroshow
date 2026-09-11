import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type ZeroshowPrivateState = {
  readonly ticketSecret: Uint8Array;
  readonly guestAge: bigint;
};

export const createZeroshowPrivateState = (
  ticketSecret: Uint8Array,
  guestAge: bigint,
): ZeroshowPrivateState => ({
  ticketSecret,
  guestAge,
});

export const defaultZeroshowPrivateState = (): ZeroshowPrivateState =>
  createZeroshowPrivateState(new Uint8Array(32).fill(7), 21n);

type Ledger = unknown;

export const witnesses = {
  ticketSecret: ({
    privateState,
  }: WitnessContext<Ledger, ZeroshowPrivateState>): [ZeroshowPrivateState, Uint8Array] => [
    privateState,
    privateState.ticketSecret,
  ],
  guestAge: ({
    privateState,
  }: WitnessContext<Ledger, ZeroshowPrivateState>): [ZeroshowPrivateState, bigint] => [
    privateState,
    privateState.guestAge,
  ],
};
