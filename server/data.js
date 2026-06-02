// In-memory data store for Fortress. Money is ALWAYS integer pence — never floats.
// Everything resets to this exact seed on server start or POST /api/demo/reset,
// so every demo run is clean and identical.

const SEED = () => ({
  customer: {
    id: 'cus_alex',
    name: 'Alex Morgan',
    since: 2019,
    tier: 'Fortress Premier',
    dailyLimitPence: 1_000_000, // £10,000
  },

  accounts: [
    {
      id: 'acc_current',
      name: 'Current Account',
      maskedNumber: '••••3491',
      sortCode: '04-00-72',
      balancePence: 1_482_055, // £14,820.55
    },
    {
      id: 'acc_savings',
      name: 'Savings',
      maskedNumber: '••••8806',
      sortCode: '04-00-72',
      balancePence: 4_210_000, // £42,100.00
    },
    {
      id: 'acc_joint',
      name: 'Joint Account',
      maskedNumber: '••••1175',
      sortCode: '04-00-72',
      balancePence: 326_510, // £3,265.10
    },
  ],

  // Trusted payees — paid repeatedly before, so the rules layer waves them through.
  payees: [
    { id: 'pay_landlord', name: 'The Landlord (Jane Foster)', maskedNumber: '••••5520', trusted: true, timesPaid: 14, lastPaid: 'last month' },
    { id: 'pay_water', name: 'Thames Water', maskedNumber: '••••9043', trusted: true, timesPaid: 8, lastPaid: '2 weeks ago' },
    { id: 'pay_gas', name: 'British Gas', maskedNumber: '••••2210', trusted: true, timesPaid: 11, lastPaid: '3 weeks ago' },
  ],

  // Transaction history per account. amountPence is signed (+ credit, − debit).
  transactions: {
    acc_current: [
      { id: 't1', date: 'May 28', description: 'ACME Corp — Salary', amountPence: 340_000 },
      { id: 't2', date: 'May 27', description: 'Tesco', amountPence: -6_420 },
      { id: 't3', date: 'May 20', description: 'Thames Water', amountPence: -4_200 },
      { id: 't4', date: 'May 18', description: 'British Gas', amountPence: -8_999 },
      { id: 't5', date: 'May 15', description: 'Spotify', amountPence: -1_299 },
      { id: 't6', date: 'May 12', description: 'From Joint Account', amountPence: 5_000 },
      { id: 't7', date: 'May 1', description: 'The Landlord — Rent', amountPence: -120_000 },
      { id: 't8', date: 'Apr 1', description: 'The Landlord — Rent', amountPence: -120_000 },
    ],
    acc_savings: [
      { id: 's1', date: 'May 28', description: 'Standing order — from Current', amountPence: 50_000 },
      { id: 's2', date: 'Apr 28', description: 'Standing order — from Current', amountPence: 50_000 },
    ],
    acc_joint: [
      { id: 'j1', date: 'May 12', description: 'To Current Account', amountPence: -5_000 },
      { id: 'j2', date: 'May 3', description: 'Ocado', amountPence: -8_410 },
    ],
  },

  // Rules-layer config (read by rules.js).
  config: {
    dailyLimitPence: 1_000_000,        // £10,000
    newPayeeReviewAbovePence: 100_000, // £1,000 — new payee over this → needs_review
    // Behavioural cues the AI weighs (cue, NOT verdict). The model decides.
    typologyCues: ['safe account', 'fraud team', 'fraud department', 'crypto', 'bitcoin',
      'investment', 'guaranteed return', 'romance', 'invoice changed', 'bank details changed',
      'hmrc', 'police', 'arrest', 'urgent', 'do not tell', 'keep this between us'],
  },

  // Threat-intelligence feed. Vectors are seeded ARMED (active:false) and flipped
  // on live from the SOC console. Reset restores them all to armed/inactive.
  threats: [
    {
      id: 'TIV-2026-031',
      name: 'Thames Water billing-scam surge',
      category: 'impersonation / APP',
      severity: 'HIGH',
      trend: '+280% this week',
      posture: 'HEIGHTENED',
      targetPayee: 'Thames Water', // entity-scoped → overrides this payee's trust
      indicators: ['arrears', 'overdue', 'refund', 'final notice', 'unexpected bill prompt'],
      directive: 'Even for the TRUSTED Thames Water payee, pause and run a short, targeted check. Ask whether the customer was prompted (text/call/email) about their bill. Hold on an unexpected-prompt fingerprint; release if it is plainly their normal recurring bill.',
      stepUp: 'none',
      active: false,
    },
    {
      id: 'TIV-2026-014',
      name: 'Safe-account bank-impersonation surge',
      category: 'impersonation / APP',
      severity: 'HIGH',
      trend: '+340% this week',
      posture: 'HEIGHTENED',
      targetPayee: null,
      indicators: ['safe account', 'fraud team', 'compromised', 'move your money'],
      directive: 'Probe the safe-account pattern explicitly; warn the customer this exact scam is active right now; lower the bar to hold.',
      stepUp: 'none',
      active: false,
    },
    {
      id: 'TIV-2026-008',
      name: 'AI voice-clone impersonation campaign',
      category: 'account takeover / impersonation',
      severity: 'HIGH',
      trend: 'emerging 🔥',
      posture: 'HEIGHTENED',
      targetPayee: null,
      indicators: ['phone call', 'voice', 'relative', 'urgent'],
      directive: 'Cloned voices are defeating phone auth in the wild. Treat phone/voice-prompted payments with extra suspicion. Production response is a device-bound passkey step-up (roadmap / Phase B).',
      stepUp: 'passkey (Phase B)',
      active: false,
    },
    {
      id: 'TIV-2026-021',
      name: 'SIM-swap + credential-stuffing ATO',
      category: 'account takeover',
      severity: 'CRITICAL',
      trend: 'active',
      posture: 'LOCKDOWN',
      targetPayee: null,
      indicators: ['new device', 'sms otp', 'impossible travel'],
      directive: 'Treat SMS OTP as compromised. Production response: mandatory device-bound passkey step-up (roadmap / Phase B).',
      stepUp: 'passkey (Phase B)',
      active: false,
    },
  ],

  // In-flight payments — the server-authoritative state machine lives here.
  // status: created → needs_review → released|held → confirmed
  payments: {},

  // Hash-chained audit trail. Seeded with a verifiable genesis entry.
  audit: [],

  // Cumulative spend today, in pence (for the daily-limit check across payments).
  spentTodayPence: 0,
});

let state = SEED();

function reset() {
  state = SEED();
  return state;
}

function getState() {
  return state;
}

// Helpers
const pounds = (pence) => (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
const findAccount = (id) => state.accounts.find((a) => a.id === id);

module.exports = { getState, reset, pounds, findAccount };
