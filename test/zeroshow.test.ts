import { ZeroshowSimulator } from "./zeroshow-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId("undeployed");

describe("Zeroshow smart contract", () => {
  it("initializes ledger state with verifiedCount at zero", () => {
    const simulator = new ZeroshowSimulator(5n);
    const initialLedger = simulator.getLedger();
    expect(initialLedger.verifiedCount).toEqual(0n);
  });

  it("proves the threshold is met without revealing the private value", () => {
    const simulator = new ZeroshowSimulator(10n);
    const { result, ledger } = simulator.proveThreshold(5n);
    expect(result).toBe(true);
    expect(ledger.verifiedCount).toEqual(1n);
  });

  it("proves the threshold is NOT met when private value is too low", () => {
    const simulator = new ZeroshowSimulator(2n);
    const { result, ledger } = simulator.proveThreshold(5n);
    expect(result).toBe(false);
    expect(ledger.verifiedCount).toEqual(1n);
  });

  it("keeps the private completedTasks value unchanged after proving", () => {
    const simulator = new ZeroshowSimulator(7n);
    simulator.proveThreshold(3n);
    expect(simulator.getPrivateState()).toEqual({ completedTasks: 7n });
  });
});
