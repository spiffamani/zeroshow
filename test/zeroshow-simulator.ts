import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "../managed/contract/index.js";
import { type ZeroshowPrivateState, witnesses } from "../witnesses.js";

export class ZeroshowSimulator {
  readonly contract: Contract<ZeroshowPrivateState>;
  circuitContext: CircuitContext<ZeroshowPrivateState>;

  constructor(completedTasks: bigint) {
    this.contract = new Contract<ZeroshowPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext({ completedTasks }, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): ZeroshowPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public proveThreshold(threshold: bigint): { result: boolean; ledger: Ledger } {
    const callResult = this.contract.impureCircuits.proveThreshold(
      this.circuitContext,
      threshold
    );
    this.circuitContext = callResult.context;
    return {
      result: callResult.result,
      ledger: ledger(this.circuitContext.currentQueryContext.state)
    };
  }
}
