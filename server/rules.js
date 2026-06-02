// Cheap, deterministic triage layer. Decides ONLY whether a payment needs a closer
// look — it does NOT decide fraud. Its job is to be fast and catch the ambiguous
// cases (new payee, large amount) and hand them to Sentinel (the AI). A genuinely
// low-risk payment to a trusted payee clears here with zero friction.

const { getState } = require('./data');

function assess(payment) {
  const { config } = getState();
  const reasons = [];

  // Trusted, previously-paid payee within normal pattern → clear, no friction.
  if (payment.payeeTrusted) {
    return { decision: 'clear', reasons: ['Trusted payee, paid before'] };
  }

  // New payee over the review threshold → needs a closer look.
  if (!payment.payeeTrusted && payment.amountPence >= config.newPayeeReviewAbovePence) {
    reasons.push(`New payee, ${(payment.amountPence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} (over £${config.newPayeeReviewAbovePence / 100} new-payee threshold)`);
  }

  // Any cue in the payment reference is a (soft) signal worth a look.
  const ref = (payment.reference || '').toLowerCase();
  const cueHit = config.typologyCues.find((c) => ref.includes(c));
  if (cueHit) reasons.push(`Reference matches a known scam cue ("${cueHit}")`);

  if (reasons.length > 0) {
    return { decision: 'needs_review', reasons };
  }

  // Small payment to a new payee, no cues → clear.
  return { decision: 'clear', reasons: ['Below new-payee review threshold'] };
}

// Hard limits enforced at commit time regardless of the AI decision.
function checkLimits(payment, sourceAccount) {
  const { config, spentTodayPence } = getState();
  if (payment.amountPence <= 0) return { ok: false, error: 'Amount must be greater than zero' };
  if (payment.amountPence > sourceAccount.balancePence) return { ok: false, error: 'Insufficient funds' };
  if (spentTodayPence + payment.amountPence > config.dailyLimitPence) {
    return { ok: false, error: 'Daily payment limit exceeded' };
  }
  return { ok: true };
}

module.exports = { assess, checkLimits };
