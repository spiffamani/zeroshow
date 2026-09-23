import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import * as Zeroshow from '../managed/contract/index.js';
import { witnesses, type ZeroshowPrivateState } from '../../witnesses.js';

export type ContractType = Zeroshow.Contract<ZeroshowPrivateState>;
export type CircuitId = ProvableCircuitId<ContractType>;
export type Providers = MidnightProviders<CircuitId, string, ZeroshowPrivateState>;

export const compiledZeroshow = CompiledContract.make<ContractType, ZeroshowPrivateState>(
  'Zeroshow', Zeroshow.Contract
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/managed')
);
