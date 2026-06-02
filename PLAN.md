# Vault — Team Plan & Build Brief

> **The most secure account on the market.** An online banking concept where security *is* the product — built for a world where the attacker has the same AI we do.
>
> **Team 7 · Build Sprint · ~60 min build · 4 min demo**

---

## 1. The story we're telling

For a century, banks won because they were harder to fool than their customers. Frontier AI is breaking that: cloned voices beat phone auth, deepfakes clear video KYC, scams run at machine scale. Every incumbent still defends the perimeter against *last decade's* attacker.

**Vault assumes the attacker already has the same models we do — and makes security the product, not the fine print.**

Our wedge is the threat the old stack is blind to: **AI-driven fraud and coercion at the point of payment.** Traditional controls are deterministic rules on structured data, so they cannot see **Authorised Push Payment (APP) fraud** — where the customer is *tricked into sending the money themselves*, and every signal says the transaction is legitimate. The real signal lives in **unstructured human behaviour** — exactly what an LLM can read and a rules engine cannot.

So Vault adds **a second pair of eyes when money moves.** A cheap rules layer decides whether a payment needs a closer look. When it fires, an AI opens a short, adaptive conversation grounded in real scam patterns, reads the answers, and **holds the payment before the money's gone.** Every step is logged to an **immutable audit trail** — the proof of an effective warning that UK reimbursement rules require. Underneath: a back end built to **assume breach**, so security holds even as adversary tooling improves.

Not a bank with more features. The most secure account on the market, for people who get that "secure" no longer means what it used to.

---

## 2. What we're building

Three core banking capabilities, with the payment flow as the hero:

1. **List accounts** — a dashboard of the customer's accounts with masked numbers and balances.
2. **See balance & transactions** — an account detail view.
3. **Make a payment** — the centrepiece, where the Vault intervention lives.

The first two are table stakes, built fast. All the differentiation is in **how a payment is handled.**

---

## 3. The hero flow — what happens when money moves

```
Customer enters a payment
          │
          ▼
   ┌──────────────────────┐
   │  RULES LAYER (cheap)  │   new payee? large amount? typology cues?
   └──────────┬───────────┘
        clear │ needs_review
     ─────────┼──────────────────────────────────────────
     │ commit │                                          │
     ▼        ▼                                          ▼
  SUCCESS    ┌──────────────────────────────────────────────┐
             │  AI SECOND PAIR OF EYES (Claude)             │
             │  short, adaptive conversation grounded in    │
             │  real scam patterns:                         │
             │  "This is a new payee — what's it for?"      │
             │  reads free-text answers → scores coercion   │
             └───────────────────┬──────────────────────────┘
                         release  │  hold
                          ▼       ▼
                       SUCCESS   PAYMENT HELD  (money never left)
          │
          ▼
   IMMUTABLE AUDIT TRAIL  (hash-chained, timestamped, every step)
   = proof of an "effective warning" for UK PSR reimbursement rules
```

**The thesis on screen:** a normal payment and a scam payment can look *identical* to a rules engine — same amount, same new payee. Only the **conversation** tells them apart. That is the demo.

---

## 4. The scam typologies we screen for

Naming the real APP fraud categories is part of our domain-expertise score:

- **"Safe account" / impersonation** — "your account is compromised, move funds to a safe account."
- **Investment / crypto** — too-good returns, urgency.
- **Purchase scam** — paying for goods that don't exist.
- **Romance** — emotional coercion.
- **Invoice / mandate redirect** — a payee's bank details "have changed."

The AI's job is to detect the **behavioural fingerprint** — unexpected contact, urgency, secrecy, third-party coaching — *not* keywords.

---

## 5. Architecture

```
telp-demo/
├── server/                 # Node + Express — server-authoritative
│   ├── index.js            # API routes + payment state machine
│   ├── data.js             # in-memory seed: customer, accounts, payees, transactions
│   ├── rules.js            # cheap deterministic triage
│   ├── claude.js           # Anthropic SDK call (+ scripted fallback)
│   ├── audit.js            # hash-chained immutable log
│   └── .env                # ANTHROPIC_API_KEY (gitignored, server-only)
└── client/                 # Vite + React
    └── src/  Dashboard · AccountDetail · PaymentFlow · AuditTrail
```

**Stack decisions (locked):**
- **Node + Express + Vite/React**, in-memory data — fastest path to a working, demo-able app.
- **Real Claude API** for the intervention, with a scripted fallback so a network blip can't break the demo.
- Money stored as **integer pence**, never floats.

### API surface

| Route | Purpose |
|---|---|
| `GET /api/accounts` | List the customer's accounts |
| `GET /api/accounts/:id` | Balance + transactions for one account |
| `POST /api/payments/assess` | Rules layer → `clear` or `needs_review` + reason |
| `POST /api/payments/interview` | One AI conversation turn → `continue` / `release` / `hold` |
| `POST /api/payments/confirm` | Commit the payment — only if server marked it `released` |
| `GET /api/audit` | The hash-chained audit trail |
| `POST /api/demo/reset` | Reset to seed state between demo runs |

---

## 6. Data setup required (share this with the team)

Everything below is seeded in `server/data.js` as an in-memory store and **reset to this exact state on every server restart** — so every demo run starts clean and identical.

### 6.1 The customer (the "logged-in" user)

```
Alex Morgan
Customer since 2019 · Vault Premier
Daily payment limit: £10,000
```

A single hardcoded session — no auth infrastructure. This is a deliberate scope choice to save sprint minutes; we speak to "real auth would go here" in the demo.

### 6.2 Accounts — powers "list accounts" + "see balance"

| Account | Masked no. | Sort code | Balance |
|---|---|---|---|
| **Current Account** | ••••3491 | 04-00-72 | **£14,820.55** |
| **Savings** | ••••8806 | 04-00-72 | **£42,100.00** |
| **Joint Account** (with partner) | ••••1175 | 04-00-72 | **£3,265.10** |

> The **Current Account** is the payment source for all demo beats. Its £14,820 balance comfortably covers two £8,000 payments — no "insufficient funds" distraction mid-demo.

### 6.3 Trusted payees — pre-seeded so a normal payment clears instantly

| Payee | Account | Trusted | Times paid | Last paid |
|---|---|:---:|:---:|---|
| **The Landlord (Jane Foster)** | ••••5520 | ✅ | 14 | last month |
| **Thames Water** | ••••9043 | ✅ | 8 | 2 weeks ago |
| **British Gas** | ••••2210 | ✅ | 11 | 3 weeks ago |

"Trusted" means paid repeatedly before, so the rules layer waves it through. This is what makes "pay the landlord £1,200" clear with zero friction.

### 6.4 Transaction history — makes the account detail look real

Pre-seed ~8 recent transactions on the Current Account. The repeated landlord payments are *why* the landlord is trusted — judges see the logic, not just a flag.

```
−£1,200.00  The Landlord — Rent      May 1
+£3,400.00  ACME Corp — Salary       May 28
−£64.20     Tesco                     May 27
−£42.00     Thames Water              May 20
−£89.99     British Gas               May 18
−£12.99     Spotify                   May 15
+£50.00     From Joint Account        May 12
−£1,200.00  The Landlord — Rent      Apr 1   ← establishes the landlord trust pattern
```

### 6.5 NOT pre-seeded — created live in the demo (the scam mechanics)

New payees in the review/scam beats are added **at demo time** — being brand-new is itself a risk signal the rules layer reads. This keeps the trigger honest: new payee + amount + typology cues drive review, **not a hidden `isScam` flag.**

- **Honest-large beat:** new payee e.g. *"JD Motors"* — a genuine used-car purchase.
- **Scam beat:** new payee e.g. *"Acct Safety — A Morgan"* — the "safe account" the victim is coached to create.

### 6.6 Rules-layer config (read from data)

```
dailyLimit:          £10,000
newPayeeReviewAbove: £1,000      # new payee + over this  → needs_review
trustedPayeeSkip:    true        # trusted + in-pattern   → clear
typologyCues:        ["safe account", "fraud team", "crypto",
                      "investment", "romance", "invoice changed", ...]  # cue, not verdict
```

### 6.7 Audit trail

Starts **empty**, seeded with a **genesis hash** so the chain is verifiable, and fills live as the demo runs. Each action appends a tamper-evident entry; judges watch it populate in real time.

---

## 7. Risk, governance & edge cases

Judges award 25 points for risk awareness — and naming an edge case scores even when we don't build it. Split into **build it** (cheap + central) and **speak to it** (acknowledge in the demo).

### Built-in guardrails (the short list we implement)

1. **Money as integer pence** — no floating-point money bugs.
2. **Fail-closed AI** — any LLM error, timeout, or hitting the max turn cap → **HOLD**, never auto-release.
3. **Server-authoritative state machine** — `/confirm` commits only if the *server* marked the payment `released`; the client cannot self-authorize or skip the interview. This is the "assume breach" proof point.
4. **Idempotency on confirm** — double-click / double-submit cannot create a duplicate payment.
5. **Prompt-injection-resistant system prompt** — the model cannot be talked out of a hold by the payer's own text; final authority and limits stay server-side.
6. **Hash-chained audit** — editing any entry breaks the chain; we demo the tamper detection.
7. **`.env` server-only** — API key gitignored, never logged, never sent to the browser.
8. **Reset-to-seed** — clean, identical state for every demo run.

### Edge cases we name in the demo (out of sprint scope)

- Scammer coaching answers in real time while on the phone with the victim (we ask things a coached victim still reveals).
- Re-checking balance at commit time, not just at assessment.
- Rate limiting / brute-force protection.
- Real KYC, multi-user concurrency, persistent storage.

---

## 8. The 4-minute demo script

Maps to the three judge questions: *what & why · what's distinctive · what's next.*

**Open with the problem (≈45s).** APP fraud, AI-scale scams, the blind spot in deterministic rules. Land the line: *"every signal says the transaction is legitimate."*

**Beat 1 — Routine payment (≈10s).** Pay the trusted landlord £1,200 → clears instantly, balance ticks down. *"Vault is invisible when it's safe."*

**Beat 2 — Large payment, honest story (≈45s, optional).** £8,000 to a brand-new payee → review fires → AI asks what it's for → *"buying a used car from a dealer I found myself"* → no coercion fingerprint → **released.** *"It doesn't just block big payments — it understands them."*

**Beat 3 — The scam (≈90s).** £8,000 to a brand-new payee — *same amount* → same review → *"someone from the bank's fraud team called and said my account isn't safe, they're helping me move my money to a safe account"* → AI recognises the **safe-account typology** → **HOLDS.** Money never left. Cut to the audit trail. *"This is the effective warning UK reimbursement rules require."*

**Close (≈40s).** Assume-breach design, PSR reimbursement angle, what we'd build next.

> **Headline line:** *"Two payments. Same amount. Same new payee. A rules engine sees one transaction twice. Vault sees a customer buying a car — and a customer being robbed."*

### Demo reliability
- Saved payees pre-seeded so Beat 1 is one click.
- Optional prompt-hint chips so the spoken answers are consistent every run.
- Scripted fallback behind the real Claude call so a network blip can't break Beat 3.
- `Reset` button returns to clean seed state between runs.

---

## 9. Build sequence (~60 min)

| Min | Work |
|---|---|
| 0–10 | Scaffold server + client running; seed data in place |
| 10–25 | Accounts list + balances + transactions end-to-end |
| 25–45 | Payment flow + rules layer + **AI intervention** + audit trail |
| 45–55 | Polish UI, masked PII, governance touches, demo dry-run |
| 55–60 | Buffer / drop in the API key / rehearse handoffs |

---

## 10. Decisions locked & open items

**Locked**
- Stack: Node + Express + Vite/React, in-memory data.
- AI engine: real Claude API + scripted fallback.
- Concept: Vault — security as the product, APP fraud at point of payment.

**Open — need from the team**
- `ANTHROPIC_API_KEY` (server-side `.env`) for the live Claude path.
- Customer name: keep "Alex Morgan" or swap?
- Keep the Joint account (3 accounts) or trim to 2 for a cleaner screen?
- Show all three demo beats, or just Beat 1 + Beat 3 to stay well inside 4 minutes?

---

## 11. What each team member can own

- **Builder(s)** — drive Claude Code through the scaffold and core build.
- **Validator(s)** — exercise edge cases, run the demo dry, confirm the guardrails hold.
- **Narrator(s)** — shape the 4-minute story, rehearse handoffs, own the headline line.
- **Clock-watcher** — call time at the 30- and 50-minute marks; protect 5 minutes for demo prep.

*Every member must be able to speak to what was built and why — judges may ask anyone.*
