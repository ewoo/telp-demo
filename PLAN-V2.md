# Fortress v2 — Adaptive Threat-Intelligence Layer

> **This layers on top of [`PLAN.md`](./PLAN.md).** The original plan (concept, the three core features, Sentinel the intent interview, the hash-chained audit, the data setup) stays exactly as written. v2 adds **one new capability**: Fortress changes *how carefully it defends* in real time, the moment a new attack vector appears in the wild.
>
> Branch: `amit-v2`

---

## 1. What v2 adds — and why it matters

The core pitch is *"the bank that assumes the attacker already has the same models we do."* The attacker **evolves**. A static rules engine — even a smart one — can't answer that: it defends today against the techniques it knew about yesterday.

v2 makes Fortress's caution **adaptive to the live threat landscape**. A **threat-intelligence feed** tracks attack vectors that are active *right now*. The moment a new vector spikes (a surge in a particular impersonation technique, a new deepfake method, an active SIM-swap campaign), Fortress's **defense posture** rises and the **Sentinel agent's behaviour changes** — it takes more precaution around exactly those vectors, probes them harder, lowers its bar to hold, and where appropriate escalates to an identity step-up.

**The headline:** *"Most banks patch their fraud rules quarterly. Fortress changes how carefully it listens the moment a new scam appears — in seconds, not quarters."*

This hits **Creativity & Innovation (25)** and **Risk & Governance Awareness (25)** at once, and gives the demo a tangible before/after moment.

---

## 2. The two-threat model (recap)

v2 sharpens the security story into two complementary layers (see also `PLAN.md` §3):

| Layer | Answers | Catches |
|---|---|---|
| **Identity assurance** | *"Is this really Alex?"* | **Account takeover (ATO)** — stolen credentials, cloned voice, hijacked session |
| **Intent assurance** (Sentinel, from v1) | *"Is Alex being tricked?"* | **APP / coercion** — the genuine Alex, pressured into paying |

**Honest design note (resolves a real objection).** Knowledge-based questions ("who did you pay last month?") are **weak inside a logged-in session** — an attacker with the password can just read the answer off the account. So in v2, identity escalation is **possession-first** (step-up to a passkey on Alex's real device, which a password-holder can't pass). Knowledge questions return only when the active vector occurs in a channel where they're genuinely valid. **Threat intel decides *which* precaution fires — and picks the one the active attacker can't beat.**

---

## 3. The threat-intelligence feed

A feed of attack vectors that are **active in the wild right now**. In a production system this would be fed by industry intel sharing (e.g. an ISAC / Action Fraud / internal fraud-ops). For the demo it's a **seeded, toggleable feed** so we can flip a threat live on stage.

**A threat vector looks like:**
```
id:          TIV-2026-014
name:        "Safe account" bank-impersonation surge
category:    impersonation / APP
severity:    HIGH   (+340% this week)
indicators:  ["safe account", "fraud team", unexpected inbound contact,
              new payee, amount > £1,000]
posture:     HEIGHTENED
directive:   Probe safe-account pattern explicitly; lower hold threshold;
             warn customer by name about this exact scam.
step_up:     none (APP vector — identity won't help; intensify intent probing)
```
```
id:          TIV-2026-031
name:        Thames Water billing-scam surge          ← ENTITY-SCOPED (headline beat)
category:    impersonation / APP
severity:    HIGH   (+280% this week)
targetPayee: "Thames Water"                           ← scopes the advisory to ONE biller
indicators:  ["arrears", "overdue", "refund", unexpected bill prompt]
posture:     HEIGHTENED
directive:   Even for the TRUSTED Thames Water payee, pause and run a short
             targeted check; ask whether the customer was prompted (text/call/
             email) about their bill; hold on an unexpected-prompt fingerprint.
step_up:     none (APP vector — intent check, not identity)
```
```
id:          TIV-2026-021
name:        Credential-stuffing + SIM-swap ATO campaign
category:    account takeover
severity:    CRITICAL
indicators:  [new device, impossible travel, SMS-OTP requested]
posture:     LOCKDOWN
directive:   Treat SMS OTP as compromised.
step_up:     device-bound passkey on the registered handset (possession)
```

Each vector carries: `id`, `name`, `category`, `severity`, behavioural `indicators`, the `posture` it drives, a plain-language `directive` for the agent, the `step_up` method it mandates, and an **optional `targetPayee`** — when set, the advisory is **scoped to a specific biller** and **overrides that payee's trusted status** (see §6, "Living Trust").

---

## 4. Defense posture model

The active feed computes a single **defense posture**, which both the rules layer and Sentinel read:

```
Threat feed (active vectors, severity)
        │ raises / lowers
        ▼
   DEFENSE POSTURE:   NORMAL ──▶ HEIGHTENED ──▶ LOCKDOWN
        │ feeds
   ┌────┴───────────────────────────────────┐
   ▼                                         ▼
RULES LAYER                              SENTINEL (agent)
weights matching vectors up;            live advisories added to its context;
lowers the "clear" threshold            probes the active pattern harder;
for hot patterns                        lower bar to hold; may mandate step-up
```

- **NORMAL** — baseline (today's v1 behaviour).
- **HEIGHTENED** — a relevant vector is active: extra scrutiny + explicit customer warnings around that pattern; lower hold threshold.
- **LOCKDOWN** — a critical vector is active: mandatory step-up (possession) for any matching payment; degraded factors (e.g. SMS OTP) disabled.

---

## 5. Screens & UX — a separate internal surface

The threat-intel console is a **separate page at its own URL (`/soc`)**, **not linked from the customer app** — because bank customers never see threat intel; analysts do. (Separation for the demo; production gates `/soc` behind staff SSO + role-based access control.)

| Surface | URL | Audience | What it shows |
|---|---|---|---|
| **Customer banking app** | `/` | Customer | Accounts, payments, Sentinel, audit. **No threat-intel link.** |
| **🛰 Security Operations console** | `/soc` | Internal (analyst) | Threat vectors **pre-armed (pending)**, each activated with **one click**; current posture; severity. Marked `🔒 INTERNAL`. This is where the "before/after" is driven on stage. |
| **Posture badge** *(top bar of the customer app)* | `/` | Customer | A small chip — `Posture: Heightened / Lockdown` — a legitimate customer-facing "heightened security" signal; flips on a ~2s poll. Hidden at Normal. |
| **Inline advisory** *(in the payment/interview)* | `/` | Customer | The review banner names the advisory that flagged the payment, e.g. *"Trusted payee under active threat advisory — Thames Water billing-scam surge."* |

So the demo is genuinely **two windows, two URLs**: open `/soc` on one, the customer app on the other. The narrative: *"Here's what our security operations sees — and here's how, the instant a threat goes live, it changes what the customer experiences."*

---

## 6. Headline demo beat — "Living Trust": a trusted bill payment, re-screened live

**The concept.** Trust is not a permanent flag — it is **continuously re-underwritten against live intelligence**. A trusted, recurring, two-years-running utility payment is the *last* thing anyone expects a bank to question. That's exactly why pausing it lands so hard.

> *"Your monthly water bill has gone through untouched for two years. Today — because fraudsters are actively impersonating that exact company — Fortress paused it to check. And caught a scam wearing your utility's name."*

It's **surgical**: only payments to the named biller change behaviour; every other trusted payment still sails through. And it drops into our **existing seed** — Thames Water is already a *trusted* payee (paid 8×) and in the transaction history, so the "every month it just goes through" baseline is already there.

**The beat (flavour A — targeted Sentinel check; one button):**
```
1. Pay British Gas (trusted) £90 → clears instantly. ✓  (control — unaffected)
2. ⟶ SOC presses ACTIVATE on the armed "Thames Water billing-scam surge".
3. Within ~2s the posture badge flips → HEIGHTENED.
4. Pay Thames Water (trusted) £42 → SAME trusted status, but Fortress now
   PAUSES it and Sentinel runs a short, scoped check:
   "There's currently a surge in scams impersonating Thames Water. Are you
    paying your normal bill as usual, or did you get a call, text, or email
    prompting this payment?"
   • "Just my normal bill"            → reassured, released ✓
   • "I got a text saying I'm in arrears" → unexpected-prompt fingerprint → HELD
5. Cut to audit → "Thames Water payment re-screened under advisory TIV-2026-031".
```

> *"Two trusted payments. Only one re-screened — the one the world just flagged. Same trust status, different behaviour, live."*

### How the change reaches Alex (technical)
- **Behaviour change — automatic & reliable.** The rules layer reads the **live feed fresh, server-side** on every payment. The instant the Thames Water advisory is armed, the trusted-payee shortcut is **overridden** for that biller and the payment is routed to Sentinel — no refresh, no re-run.
- **Passive indicators (badge + advisory banner)** flip via a lightweight **~2-second poll** on the customer app — so they update "as soon as" the SOC activates, with nobody touching Alex's screen. (A websocket would be instant but is overkill; the poll is bulletproof for a live demo.)

**Fallback (bulletproof):** if a live flip ever feels risky on the day, the "pay quiet → activate → re-pay the same biller" version still lands the point.

**Secondary beat (still available):** the generic **safe-account surge** vector drives the same mid-conversation change on the £8,000 new-payee scam from `PLAN.md` §8 — useful as a second illustration if there's time.

**What's next, not now:** *(Phase B)* activating a **takeover** vector → an attacker-with-password payment hits **LOCKDOWN** → forced **passkey step-up on Alex's real device** → attacker can't approve → held. The three-villain arc. Named in the demo as the roadmap.

---

## 7. Change impact — what gets built

| Component | Change | Effort |
|---|---|---|
| `server/threatfeed.js` *(new)* | Active vectors + posture computation; activate/deactivate. | S |
| `server/data.js` | Seed threat vectors incl. a couple of dormant ones to flip live. | XS |
| `server/index.js` | `GET /api/threats`, `POST /api/threats/activate`; thread active-threat context through `assess`/`interview`; optional identity step-up branch. | M |
| `server/rules.js` | Match payment against active-vector indicators → escalate even if it'd otherwise clear. **Trust-override:** if an active advisory's `targetPayee` matches, a *trusted* payee is routed to Sentinel anyway (reason: *"Trusted payee under active threat advisory"*). | S |
| `server/claude.js` | Inject **live advisories** into Sentinel's context; probe the active pattern harder; lower hold bar; scripted fallback gets the same awareness. *(See §8 caching note.)* | M |
| `client/` | New **SOC console screen**; **posture badge** in the top bar; **inline advisory banner**; demo toggle. (Phase B: passkey step-up screen.) | M–L |
| `server/audit.js` (usage) | Log posture changes + *which advisory* influenced each decision. | XS |
| `PLAN-V2.md` | This document. | — |

Effort key: XS < S < M < L.

---

## 8. Technical gotcha — prompt caching

Sentinel's system prompt is **prompt-cached** (stable prefix → cache hit). The threat advisories are **volatile** — they change as the feed updates. Splicing live advisories into the cached system prompt would **break the cache on every feed change**.

**Correct design:** keep the stable Sentinel system prompt cached as-is, and inject the **active advisories as a separate, non-cached block immediately after it** (or as a `system`-role message in the conversation). This preserves the cache while still steering the agent with live intel.

---

## 9. Governance & audit additions

- Every **posture change** is written to the hash-chained audit trail.
- Every Sentinel decision records **which advisory influenced it** (e.g. *"hold influenced by advisory TIV-2026-014"*) — strong evidence for the "effective warning" requirement and for regulator-facing explainability.
- Demonstrates **explainable, attributable** automated decisions — a real differentiator for a financial-services audience.

---

## 10. Phasing (demo-safe)

- **Phase A — the core wow (recommended first).** Threat feed + posture + Sentinel behaviour change + SOC console + live toggle + posture badge + advisory banner + audit. Delivers the "same payment, different behaviour" beat on its own.
- **Phase B — identity escalation.** Possession/passkey step-up under takeover vectors; the three-villain arc.

---

## 11. Decisions

**Locked:**
- ✅ **SOC console** — full screen (reads as a real ops console on a projector).
- ✅ **Headline beat** — "Living Trust": the trusted Thames Water bill payment, re-screened live (flavour A — targeted Sentinel check).
- ✅ **Pre-armed vectors** — loaded in a pending state, one-click ACTIVATE.
- ✅ **Live feed** — seeded/toggleable for demo reliability; a real intel feed (ISAC / Action Fraud) named as the production path.
- ✅ **Phase A first**; Phase B (passkey step-up / ATO beat) named as "what's next" unless time allows.

**Pre-armed vector set (4):**
1. **Thames Water billing-scam surge** ⭐ — entity-scoped (`targetPayee`), drives the headline Living-Trust beat.
2. **Safe-account / bank-impersonation surge** — drives the secondary mid-conversation beat.
3. **AI voice-clone impersonation** 🔥 — "on the rise"; on-thesis (Family B — lands fully with Phase B).
4. **SIM-swap + credential-stuffing ATO** — drives LOCKDOWN + passkey step-up (Phase B).

**Still open:**
- **Posture levels** — three (Normal / Heightened / Lockdown) or just two (Normal / Heightened)? *(Lean three — Lockdown is what Phase B needs.)*
