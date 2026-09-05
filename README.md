# zeroshow

## Public state vs private witness

- **Public (ledger state):** `verifiedCount` — a counter tracking how many threshold proofs have been submitted. Reveals nothing about any individual's data.
- **Private (witness):** `completedTasks()` — the actual number of tasks/achievements a user has completed. This value never leaves the user's local machine.
- **Disclosed output:** only the boolean result of `proveThreshold()` — whether the private value met the given threshold — is made public via `disclose()`.

## Idea

Zeroshow proves a private achievement claim is true without exposing the underlying data — starting with "prove you've completed at least N tasks" and extending later to freelance work history, certifications, or DAO contribution records.
