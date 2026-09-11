import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  createZeroshowPrivateState,
  defaultZeroshowPrivateState,
  witnesses,
  type ZeroshowPrivateState,
} from '../../contracts/witnesses';
import { PRIVATE_STATE_ID } from './constants';

// Compiled Compact output — Vite bundles the JS implementation.
import * as ZeroShow from '../../contracts/managed/zeroshow/contract/index.js';

export { createZeroshowPrivateState, defaultZeroshowPrivateState, witnesses, ZeroShow };
export type { ZeroshowPrivateState };

export const compiledContract = (
  CompiledContract.make('zeroshow', (ZeroShow as any).Contract) as any
).pipe(
  (CompiledContract as any).withWitnesses(witnesses),
  (CompiledContract as any).withCompiledFileAssets('/'),
);

export async function deployZeroshow(providers: any, privateState: ZeroshowPrivateState) {
  return deployContract(providers, {
    compiledContract,
    args: [],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
}

export async function joinZeroshow(providers: any, contractAddress: string, privateState: ZeroshowPrivateState) {
  return findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
}
