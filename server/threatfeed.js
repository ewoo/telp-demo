// Threat-intelligence feed. Tracks attack vectors that are "active in the wild"
// and computes the current defense posture. In production this would be fed by
// industry intel sharing; here the vectors are seeded (data.js) and armed/
// activated from the SOC console — so a threat can be flipped live on stage.

const { getState } = require('./data');

const POSTURE_RANK = { NORMAL: 0, HEIGHTENED: 1, LOCKDOWN: 2 };

function listThreats() {
  return getState().threats;
}

function activeThreats() {
  return getState().threats.filter((t) => t.active);
}

// Highest posture among active vectors (NORMAL if none active).
function posture() {
  let best = 'NORMAL';
  for (const t of activeThreats()) {
    if (POSTURE_RANK[t.posture] > POSTURE_RANK[best]) best = t.posture;
  }
  return best;
}

// Active advisories whose targetPayee names this payee (entity-scoped intel).
// These OVERRIDE a payee's trusted status.
function advisoriesTargeting(payeeName) {
  const name = (payeeName || '').toLowerCase();
  return activeThreats().filter(
    (t) => t.targetPayee && name.includes(t.targetPayee.toLowerCase())
  );
}

function find(id) {
  return getState().threats.find((t) => t.id === id);
}

function activate(id) {
  const t = find(id);
  if (t) t.active = true;
  return t;
}

function deactivate(id) {
  const t = find(id);
  if (t) t.active = false;
  return t;
}

module.exports = { listThreats, activeThreats, posture, advisoriesTargeting, activate, deactivate, find };
