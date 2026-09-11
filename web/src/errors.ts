export function extractErrorMessage(e: unknown): string {
  if (!e) return '';
  if (e instanceof Error && e.message) return e.message;
  const anyErr = e as { message?: string; cause?: { message?: string; failure?: { message?: string; cause?: { message?: string } } } };
  if (anyErr.message) return anyErr.message;
  const failure = anyErr.cause?.failure;
  if (failure?.message) return failure.message;
  if (failure?.cause?.message) return failure.cause.message;
  if (anyErr.cause?.message) return anyErr.cause.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function friendlyError(e: unknown): string {
  const msg = extractErrorMessage(e);
  if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Transaction cancelled in Lace.';
  if (msg.includes('Failed to fetch') || msg.includes('Failed Proof Server') || msg.includes('proof server')) {
    return 'Could not reach the proof server. Start it with `npm run proof-server:start` and point Lace at http://localhost:6300.';
  }
  if (msg.includes('Guest does not meet the age gate')) return 'Check-in rejected: the private age does not meet the public gate.';
  if (msg.includes('mismatched verifier keys')) return 'Contract version mismatch. Deploy a new door from this build.';
  if (msg.includes('No Midnight wallet')) return msg;
  if (msg.includes('submission') || msg.includes('Submission')) return 'Transaction failed to submit. Check tNIGHT / tDUST and try again.';
  return msg || 'Unexpected error. Check the browser console.';
}
