// Hash-chained, tamper-evident audit trail.
// Each entry hashes the previous entry's hash + its own payload. Editing any past
// entry breaks the chain — which is exactly what we demo for governance. The audit
// is the "effective warning" evidence UK PSR reimbursement rules require.

const crypto = require('crypto');
const { getState } = require('./data');

const GENESIS_HASH = '0'.repeat(64);

function hashEntry(prevHash, payload) {
  return crypto
    .createHash('sha256')
    .update(prevHash + JSON.stringify(payload))
    .digest('hex');
}

// Append an event to the chain. `seq` is implied by array position.
// We pass an explicit timestamp string in (Date.* is fine in plain server code,
// but we keep timestamps display-only and never use them for logic).
function record(event, detail, timestamp) {
  const state = getState();
  const prevHash = state.audit.length ? state.audit[state.audit.length - 1].hash : GENESIS_HASH;
  const payload = { event, detail, timestamp };
  const entry = { seq: state.audit.length, prevHash, ...payload, hash: hashEntry(prevHash, payload) };
  state.audit.push(entry);
  return entry;
}

// Re-derive every hash and confirm the chain is intact. Returns {valid, brokenAt}.
function verify() {
  const state = getState();
  let prevHash = GENESIS_HASH;
  for (const e of state.audit) {
    const expected = hashEntry(prevHash, { event: e.event, detail: e.detail, timestamp: e.timestamp });
    if (expected !== e.hash || e.prevHash !== prevHash) {
      return { valid: false, brokenAt: e.seq };
    }
    prevHash = e.hash;
  }
  return { valid: true, brokenAt: null };
}

module.exports = { record, verify, GENESIS_HASH };
