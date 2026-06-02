// Fortress front-end. Vanilla JS SPA — no build step, served by the Express
// server on the same origin, so /api calls are same-origin (no CORS).

const app = document.getElementById('app');
const api = (path, opts) => fetch('/api' + path, {
  headers: { 'Content-Type': 'application/json' },
  ...opts,
}).then(async (r) => {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Request failed');
  return body;
});

const fmtFromPence = (p) => (p / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

let session = null;

// ── Router ───────────────────────────────────────────────────────────────
async function route(name, arg) {
  window.scrollTo(0, 0);
  if (name === 'dashboard') return renderDashboard();
  if (name === 'account') return renderAccount(arg);
  if (name === 'pay') return renderPayment(arg);
  if (name === 'audit') return renderAudit();
}

document.querySelectorAll('[data-route]').forEach((b) =>
  b.addEventListener('click', () => route(b.dataset.route)));

document.getElementById('reset').addEventListener('click', async () => {
  await api('/demo/reset', { method: 'POST' });
  await loadSession();
  route('dashboard');
});

// ── Dashboard ────────────────────────────────────────────────────────────
async function renderDashboard() {
  app.innerHTML = '<p class="sub">Loading accounts…</p>';
  const accounts = await api('/accounts');
  const total = accounts.reduce((s, a) => s + a.balancePence, 0);

  const view = el(`<div>
    <h1 class="greeting">Good afternoon, ${session.customer.name.split(' ')[0]}</h1>
    <p class="sub">${session.customer.tier} · Total balance ${fmtFromPence(total)}</p>
    <h2 class="section">Your accounts</h2>
    <div class="cards" id="cards"></div>
    <div class="pay-cta"><button class="btn full" id="makePayment">Make a payment</button></div>
  </div>`);

  const cards = view.querySelector('#cards');
  accounts.forEach((a) => {
    const card = el(`<div class="account-card">
      <div>
        <div class="account-name">${a.name}</div>
        <div class="account-meta">${a.maskedNumber} · Sort ${a.sortCode}</div>
      </div>
      <div class="account-balance">${a.balance}</div>
    </div>`);
    card.addEventListener('click', () => route('account', a.id));
    cards.appendChild(card);
  });

  view.querySelector('#makePayment').addEventListener('click', () => route('pay'));
  app.replaceChildren(view);
}

// ── Account detail ───────────────────────────────────────────────────────
async function renderAccount(id) {
  app.innerHTML = '<p class="sub">Loading…</p>';
  const a = await api('/accounts/' + id);
  const view = el(`<div>
    <button class="back">← All accounts</button>
    <div class="balance-hero">
      <div class="label">${a.name} · ${a.maskedNumber}</div>
      <div class="amount">${a.balance}</div>
      <div class="num">Sort code ${a.sortCode}</div>
    </div>
    <h2 class="section">Recent transactions</h2>
    <div id="txns"></div>
    <div class="pay-cta"><button class="btn full" id="pay">Make a payment from this account</button></div>
  </div>`);

  const txns = view.querySelector('#txns');
  a.transactions.forEach((t) => txns.appendChild(el(`<div class="txn">
    <div><div class="txn-desc">${t.description}</div><div class="txn-date">${t.date}</div></div>
    <div class="txn-amt ${t.credit ? 'credit' : ''}">${t.credit ? '+' : ''}${t.amount.replace('-', '')}</div>
  </div>`)));

  view.querySelector('.back').addEventListener('click', () => route('dashboard'));
  view.querySelector('#pay').addEventListener('click', () => route('pay', id));
  app.replaceChildren(view);
}

// ── Make a payment ───────────────────────────────────────────────────────
async function renderPayment(presetAccountId) {
  app.innerHTML = '<p class="sub">Loading…</p>';
  const [accounts, payees] = await Promise.all([api('/accounts'), api('/payees')]);

  const view = el(`<div>
    <button class="back">← Cancel</button>
    <h1 class="greeting">Make a payment</h1>
    <p class="sub">Every payment is checked by Sentinel before money moves.</p>

    <div class="demo-label">Demo scenarios — one click to fill</div>
    <div class="demo-presets" id="presets"></div>

    <div class="panel">
      <div class="field">
        <label>From account</label>
        <select id="source"></select>
      </div>
      <div class="field">
        <label>Payee</label>
        <select id="payee"></select>
      </div>
      <div id="newPayeeFields" style="display:none">
        <div class="field">
          <label>Payee name</label>
          <input id="payeeName" placeholder="e.g. JD Motors" />
        </div>
        <div class="field">
          <label>Payee account number</label>
          <input id="payeeAcct" placeholder="e.g. 8842 0091" />
        </div>
      </div>
      <div class="field">
        <label>Amount (£)</label>
        <input id="amount" type="number" min="0" step="0.01" placeholder="0.00" />
      </div>
      <div class="field">
        <label>Reference (optional)</label>
        <input id="reference" placeholder="What's it for?" />
      </div>
      <div class="error" id="err" style="display:none"></div>
      <button class="btn full" id="submit">Review payment</button>
    </div>
  </div>`);

  // Source accounts
  const source = view.querySelector('#source');
  accounts.forEach((a) => source.appendChild(el(`<option value="${a.id}">${a.name} — ${a.balance} (${a.maskedNumber})</option>`)));
  if (presetAccountId) source.value = presetAccountId;

  // Payees: saved (trusted) + "new payee"
  const payeeSel = view.querySelector('#payee');
  payees.forEach((p) => payeeSel.appendChild(el(`<option value="${p.id}">${p.name} ${p.trusted ? '· trusted' : ''}</option>`)));
  payeeSel.appendChild(el(`<option value="__new__">+ New payee…</option>`));
  const newFields = view.querySelector('#newPayeeFields');
  payeeSel.addEventListener('change', () => {
    newFields.style.display = payeeSel.value === '__new__' ? 'block' : 'none';
  });

  // Demo presets (Beats 1–3). Names/amounts pre-filled so there's no fumbling.
  const presets = view.querySelector('#presets');
  const setForm = ({ payee, name, acct, amount, reference }) => {
    payeeSel.value = payee;
    newFields.style.display = payee === '__new__' ? 'block' : 'none';
    if (payee === '__new__') { view.querySelector('#payeeName').value = name; view.querySelector('#payeeAcct').value = acct; }
    view.querySelector('#amount').value = amount;
    view.querySelector('#reference').value = reference || '';
  };
  [
    { label: '⭐ Living Trust · Thames Water bill £42', cfg: { payee: 'pay_water', amount: '42', reference: 'Water bill' } },
    { label: 'Control · British Gas bill £90', cfg: { payee: 'pay_gas', amount: '90', reference: 'Gas bill' } },
    { label: 'Beat 1 · Routine (Landlord £1,200)', cfg: { payee: 'pay_landlord', amount: '1200', reference: 'Rent' } },
    { label: 'Beat 2 · New payee £8,000 (car)', cfg: { payee: '__new__', name: 'JD Motors', acct: '8842 0091', amount: '8000', reference: 'Car purchase' } },
    { label: 'Beat 3 · New payee £8,000 (scam)', cfg: { payee: '__new__', name: 'Acct Safety - A Morgan', acct: '6610 2255', amount: '8000', reference: '' } },
  ].forEach((p) => {
    const chip = el(`<button class="chip">${p.label}</button>`);
    chip.addEventListener('click', () => setForm(p.cfg));
    presets.appendChild(chip);
  });

  view.querySelector('.back').addEventListener('click', () => route('dashboard'));
  view.querySelector('#submit').addEventListener('click', () => submitPayment(view));
  app.replaceChildren(view);
}

async function submitPayment(view) {
  const err = view.querySelector('#err');
  err.style.display = 'none';
  const sourceAccountId = view.querySelector('#source').value;
  const payeeVal = view.querySelector('#payee').value;
  const amountPence = Math.round(parseFloat(view.querySelector('#amount').value) * 100);
  const reference = view.querySelector('#reference').value;

  if (!amountPence || amountPence <= 0) { err.textContent = 'Enter a valid amount.'; err.style.display = 'block'; return; }

  const payload = { sourceAccountId, amountPence, reference };
  if (payeeVal === '__new__') {
    payload.payeeName = view.querySelector('#payeeName').value.trim();
    payload.payeeAccountNumber = view.querySelector('#payeeAcct').value.trim();
    if (!payload.payeeName) { err.textContent = 'Enter a payee name.'; err.style.display = 'block'; return; }
  } else {
    payload.existingPayeeId = payeeVal;
  }

  const btn = view.querySelector('#submit');
  btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const result = await api('/payments/assess', { method: 'POST', body: JSON.stringify(payload) });
    if (result.decision === 'clear') {
      renderConfirm(result.paymentId, { ...payload, cleared: true, reasons: result.reasons });
    } else {
      renderInterview(result.paymentId, result.reasons);
    }
  } catch (e) {
    err.textContent = e.message; err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Review payment';
  }
}

// ── Sentinel interview ───────────────────────────────────────────────────
async function renderInterview(paymentId, reasons) {
  const view = el(`<div>
    <div class="sentinel-head">
      <span class="sentinel-badge">🛡 Sentinel · second pair of eyes</span>
    </div>
    <div class="review-banner">
      <strong>This payment needs a closer look.</strong> ${(reasons || []).join('. ')}.
      Sentinel will ask a couple of questions before any money moves.
    </div>
    <div class="chat" id="chat"></div>
    <div id="inputArea"></div>
  </div>`);
  app.replaceChildren(view);

  const chat = view.querySelector('#chat');
  const inputArea = view.querySelector('#inputArea');

  const addBubble = (role, text) => { const b = el(`<div class="bubble ${role}">${text}</div>`); chat.appendChild(b); chat.scrollTop = chat.scrollHeight; return b; };

  // Suggested victim/honest answers — read verbatim so demo runs are consistent.
  const HINTS = [
    "I'm buying a used car from a dealer I found myself on Autotrader.",
    "Someone from the bank's fraud team called and said my account isn't safe — they're helping me move my money to a safe account.",
    "I arranged it myself, no one contacted me about it.",
    "They told me to keep this between us and not mention it to the bank.",
  ];

  async function turn(answer) {
    if (answer) addBubble('customer', answer);
    const thinking = addBubble('sentinel thinking', '<span class="spin"></span> Sentinel is considering your answer…');
    inputArea.innerHTML = '';
    try {
      const r = await api('/payments/interview', { method: 'POST', body: JSON.stringify({ paymentId, answer: answer || '' }) });
      thinking.remove();
      addBubble('sentinel', r.message);
      if (r.decision === 'release') {
        setTimeout(() => renderConfirm(paymentId, { released: true }), 700);
      } else if (r.decision === 'hold') {
        setTimeout(() => renderHeld(r), 700);
      } else {
        showInput();
      }
    } catch (e) {
      thinking.remove();
      addBubble('sentinel', 'Something went wrong with the check, so this payment stays paused to be safe.');
    }
  }

  function showInput() {
    inputArea.innerHTML = '';
    const box = el(`<div>
      <div class="answer-row">
        <input id="answer" placeholder="Type your answer…" autocomplete="off" />
        <button class="btn" id="send">Send</button>
      </div>
      <div class="answer-hints" id="hints"></div>
    </div>`);
    const input = box.querySelector('#answer');
    const send = () => { const v = input.value.trim(); if (v) turn(v); };
    box.querySelector('#send').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    const hints = box.querySelector('#hints');
    HINTS.forEach((h) => { const c = el(`<button class="hint-chip">💬 ${h}</button>`); c.addEventListener('click', () => { input.value = h; input.focus(); }); hints.appendChild(c); });
    inputArea.appendChild(box);
    input.focus();
  }

  // Kick off: Sentinel's opening question (no answer yet).
  turn('');
}

// ── Confirm & success ────────────────────────────────────────────────────
async function renderConfirm(paymentId, info) {
  const view = el(`<div>
    <div class="sentinel-head"><span class="sentinel-badge">✓ Cleared by Sentinel</span></div>
    <h1 class="greeting" style="margin-top:10px">Confirm payment</h1>
    <p class="sub">${info.released ? 'Sentinel released this payment after the safety check.' : 'This payment cleared instantly — trusted payee, no risk signals.'}</p>
    <div class="panel">
      <p>You're about to send this payment. No money has left your account yet.</p>
      <div class="error" id="err" style="display:none"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel">Cancel</button>
        <button class="btn" id="confirm">Confirm &amp; send</button>
      </div>
    </div>
  </div>`);
  app.replaceChildren(view);

  const idempotencyKey = 'idem_' + paymentId; // one logical confirm per payment
  view.querySelector('#cancel').addEventListener('click', () => route('dashboard'));
  view.querySelector('#confirm').addEventListener('click', async () => {
    const btn = view.querySelector('#confirm');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await api('/payments/confirm', { method: 'POST', body: JSON.stringify({ paymentId, idempotencyKey }) });
      renderSuccess(r);
    } catch (e) {
      const err = view.querySelector('#err'); err.textContent = e.message; err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Confirm & send';
    }
  });
}

function renderSuccess(r) {
  const view = el(`<div class="outcome success">
    <div class="icon">✓</div>
    <h2>Payment sent</h2>
    <p>Your payment has been completed. Your new balance is <strong>${r.newBalance}</strong>.</p>
    <div class="btn-row" style="justify-content:center">
      <button class="btn secondary" id="audit">View audit trail</button>
      <button class="btn" id="done">Back to accounts</button>
    </div>
  </div>`);
  view.querySelector('#done').addEventListener('click', () => route('dashboard'));
  view.querySelector('#audit').addEventListener('click', () => route('audit'));
  app.replaceChildren(view);
}

function renderHeld(r) {
  const signals = (r.signals || []).filter(Boolean);
  const view = el(`<div class="outcome held">
    <div class="icon">⏸</div>
    <h2>Payment held</h2>
    <p>${r.message}</p>
    ${signals.length ? `<div class="signals">${signals.map((s) => `<span class="signal-tag">${s.replace(/_/g, ' ')}</span>`).join('')}</div>` : ''}
    <div class="held-note">🔒 The money never left your account. Every step has been written to the immutable audit trail — the evidence of an effective warning that reimbursement rules require.</div>
    <div class="btn-row" style="justify-content:center">
      <button class="btn secondary" id="audit">View audit trail</button>
      <button class="btn" id="done">Back to accounts</button>
    </div>
  </div>`);
  view.querySelector('#done').addEventListener('click', () => route('dashboard'));
  view.querySelector('#audit').addEventListener('click', () => route('audit'));
  app.replaceChildren(view);
}

// ── Audit trail ──────────────────────────────────────────────────────────
async function renderAudit() {
  app.innerHTML = '<p class="sub">Loading audit trail…</p>';
  const { entries, verification } = await api('/audit');
  const view = el(`<div>
    <h1 class="greeting">Audit trail</h1>
    <p class="sub">Hash-chained and tamper-evident. Editing any entry breaks the chain.</p>
    <div class="audit-verify ${verification.valid ? 'ok' : 'bad'}">
      ${verification.valid ? '✓ Chain verified — all entries intact' : `✗ Chain broken at entry #${verification.brokenAt}`}
    </div>
    <div id="entries"></div>
  </div>`);
  const list = view.querySelector('#entries');
  if (!entries.length) list.appendChild(el('<div class="empty">No activity yet. Make a payment to see the trail fill up.</div>'));
  [...entries].reverse().forEach((e) => {
    const detail = Object.entries(e.detail || {})
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
    list.appendChild(el(`<div class="audit-entry">
      <div class="audit-top"><span class="audit-event">${e.event}</span><span class="audit-seq">#${e.seq} · ${new Date(e.timestamp).toLocaleTimeString('en-GB')}</span></div>
      <div class="audit-detail">${detail || '—'}</div>
      <div class="audit-hash">hash ${e.hash.slice(0, 24)}… · prev ${e.prevHash.slice(0, 12)}…</div>
    </div>`));
  });
  app.replaceChildren(view);
}

// ── Posture badge (customer-facing trust signal; controls live at /soc) ───
function updatePostureBadge(posture) {
  const b = document.getElementById('posture-badge');
  if (!b) return;
  if (posture === 'NORMAL') { b.textContent = ''; b.className = 'posture-badge'; return; }
  b.textContent = 'Posture: ' + posture;
  b.className = 'posture-badge ' + posture.toLowerCase();
}
async function refreshPosture() {
  try { updatePostureBadge((await api('/threats')).posture); } catch (e) {}
}

// ── Boot ─────────────────────────────────────────────────────────────────
async function loadSession() {
  session = await api('/session');
  document.getElementById('who').textContent = session.customer.name;
  const status = document.getElementById('sentinel-status');
  status.innerHTML = session.liveSentinel
    ? `<span class="dot live"></span> Sentinel LIVE · ${session.model}`
    : `<span class="dot scripted"></span> Sentinel · scripted fallback`;
}

(async function () {
  try {
    await loadSession();
    route('dashboard');
    refreshPosture();
    setInterval(refreshPosture, 2000); // ~2s poll → badge flips when SOC activates
  } catch (e) {
    app.innerHTML = `<div class="empty">Could not reach the Fortress server.<br>${e.message}</div>`;
  }
})();
