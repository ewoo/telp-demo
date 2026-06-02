// Fortress API server. Server-authoritative: balances, the payment state
// machine, and all limits live here. The client cannot self-authorise a payment.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const { getState, reset, pounds, findAccount } = require('./data');
const rules = require('./rules');
const audit = require('./audit');
const sentinel = require('./claude');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MAX_INTERVIEW_TURNS = 4; // hard cap → fail-closed to hold

// Display-only timestamp. Never used for logic.
const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

// ── Customer / accounts ────────────────────────────────────────────────────
app.get('/api/session', (req, res) => {
  const { customer } = getState();
  res.json({ customer, liveSentinel: sentinel.isLiveModeAvailable(), model: sentinel.MODEL });
});

app.get('/api/accounts', (req, res) => {
  const { accounts } = getState();
  res.json(accounts.map((a) => ({ ...a, balance: pounds(a.balancePence) })));
});

app.get('/api/accounts/:id', (req, res) => {
  const account = findAccount(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const { transactions } = getState();
  res.json({
    ...account,
    balance: pounds(account.balancePence),
    transactions: (transactions[account.id] || []).map((t) => ({
      ...t,
      amount: pounds(t.amountPence),
      credit: t.amountPence >= 0,
    })),
  });
});

app.get('/api/payees', (req, res) => {
  const { payees } = getState();
  res.json(payees);
});

// ── Payment state machine ──────────────────────────────────────────────────
// created → needs_review → released | held → confirmed
//        └─ clear ─────────────────────────────────────┘ (released)

// Step 1: assess. Runs the cheap rules layer.
app.post('/api/payments/assess', (req, res) => {
  const { sourceAccountId, payeeName, payeeAccountNumber, amountPence, reference, existingPayeeId } = req.body;
  const state = getState();
  const source = findAccount(sourceAccountId);
  if (!source) return res.status(400).json({ error: 'Invalid source account' });
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive whole number of pence' });
  }

  const existingPayee = existingPayeeId ? state.payees.find((p) => p.id === existingPayeeId) : null;
  if (!existingPayee && !payeeName) return res.status(400).json({ error: 'Payee name required' });

  const payment = {
    id: newId('pay'),
    sourceAccountId,
    sourceAccountName: source.name,
    payeeName: existingPayee ? existingPayee.name : payeeName,
    payeeAccountNumber: existingPayee ? existingPayee.maskedNumber : payeeAccountNumber,
    payeeTrusted: !!(existingPayee && existingPayee.trusted),
    amountPence,
    reference: reference || '',
    status: 'created',
    interview: [],
    createdAt: now(),
  };

  const decision = rules.assess(payment);
  audit.record('payment.assessed', {
    paymentId: payment.id, amount: pounds(amountPence), payee: payment.payeeName,
    decision: decision.decision, reasons: decision.reasons,
  }, now());

  if (decision.decision === 'clear') {
    payment.status = 'released'; // cleared the rules layer → ready to confirm
    state.payments[payment.id] = payment;
    return res.json({ paymentId: payment.id, decision: 'clear', reasons: decision.reasons, status: 'released' });
  }

  payment.status = 'needs_review';
  state.payments[payment.id] = payment;
  res.json({ paymentId: payment.id, decision: 'needs_review', reasons: decision.reasons, status: 'needs_review' });
});

// Step 2: interview turn. Sentinel reads the answer and decides.
app.post('/api/payments/interview', async (req, res) => {
  const { paymentId, answer } = req.body;
  const state = getState();
  const payment = state.payments[paymentId];
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (!['needs_review'].includes(payment.status)) {
    return res.status(409).json({ error: `Payment is ${payment.status}, not under review` });
  }

  if (answer && answer.trim()) {
    payment.interview.push({ role: 'customer', content: answer.trim() });
    audit.record('interview.answer', { paymentId, answer: answer.trim() }, now());
  }

  const result = await sentinel.runTurn(payment, payment.interview);

  // Hard turn cap → FAIL-CLOSED. If Sentinel still wants to continue past the
  // cap, the server overrides to a hold for human review.
  const customerTurns = payment.interview.filter((t) => t.role === 'customer').length;
  let decision = result.decision;
  let message = result.message;
  if (decision === 'continue' && customerTurns >= MAX_INTERVIEW_TURNS) {
    decision = 'hold';
    message = "I've asked everything I can automatically, so I'm pausing this payment for a human review to be safe. No money has left your account.";
  }

  payment.interview.push({ role: 'sentinel', content: message });

  if (decision === 'release') {
    payment.status = 'released';
    audit.record('sentinel.released', { paymentId, engine: result.engine, signals: result.signals }, now());
  } else if (decision === 'hold') {
    payment.status = 'held';
    audit.record('sentinel.held', { paymentId, engine: result.engine, signals: result.signals }, now());
  } else {
    audit.record('sentinel.question', { paymentId, engine: result.engine }, now());
  }

  res.json({ paymentId, decision, message, signals: result.signals, engine: result.engine, status: payment.status });
});

// Step 3: confirm. Commits ONLY if the server marked the payment released.
// Idempotent on idempotencyKey so a double-click can't double-pay.
const committedKeys = new Map(); // idempotencyKey → response

app.post('/api/payments/confirm', (req, res) => {
  const { paymentId, idempotencyKey } = req.body;
  if (idempotencyKey && committedKeys.has(idempotencyKey)) {
    return res.json(committedKeys.get(idempotencyKey)); // replay → same result
  }

  const state = getState();
  const payment = state.payments[paymentId];
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  // Server-authoritative gate: only a server-released payment can commit.
  if (payment.status !== 'released') {
    return res.status(409).json({ error: `Payment cannot be confirmed from status "${payment.status}"` });
  }

  const source = findAccount(payment.sourceAccountId);
  // Re-check limits at commit time (balance may have changed since assess).
  const limit = rules.checkLimits(payment, source);
  if (!limit.ok) {
    audit.record('payment.rejected', { paymentId, reason: limit.error }, now());
    return res.status(409).json({ error: limit.error });
  }

  // Commit: debit, record transaction, advance daily spend.
  source.balancePence -= payment.amountPence;
  state.spentTodayPence += payment.amountPence;
  payment.status = 'confirmed';
  const txn = {
    id: newId('t'),
    date: 'Today',
    description: `${payment.payeeName}${payment.reference ? ' — ' + payment.reference : ''}`,
    amountPence: -payment.amountPence,
  };
  state.transactions[source.id] = [txn, ...(state.transactions[source.id] || [])];

  audit.record('payment.confirmed', {
    paymentId, amount: pounds(payment.amountPence), payee: payment.payeeName,
    newBalance: pounds(source.balancePence),
  }, now());

  const result = { paymentId, status: 'confirmed', newBalance: pounds(source.balancePence), newBalancePence: source.balancePence };
  if (idempotencyKey) committedKeys.set(idempotencyKey, result);
  res.json(result);
});

// ── Audit trail ────────────────────────────────────────────────────────────
app.get('/api/audit', (req, res) => {
  const { audit: log } = getState();
  res.json({ entries: log, verification: audit.verify() });
});

// ── Demo reset ─────────────────────────────────────────────────────────────
app.post('/api/demo/reset', (req, res) => {
  reset();
  committedKeys.clear();
  audit.record('demo.reset', { note: 'State restored to seed' }, now());
  res.json({ ok: true });
});

// Serve the built/static client.
app.use(express.static(path.join(__dirname, '..', 'client')));

app.listen(PORT, () => {
  // Seed a genesis audit entry so the hash chain is verifiable from entry 0.
  audit.record('system.genesis', { note: 'Fortress audit trail initialised' }, now());
  console.log(`\n  🏰  Fortress API running on http://localhost:${PORT}`);
  console.log(`      Sentinel: ${sentinel.isLiveModeAvailable() ? `LIVE (${sentinel.MODEL})` : 'scripted fallback (no ANTHROPIC_API_KEY)'}\n`);
});
