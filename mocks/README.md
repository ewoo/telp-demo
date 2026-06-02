# Fortress — Demo Prototype

Interactive UX prototype for **Team 7 · Fortress** (security as the product), with **Sentinel** — the AI "second pair of eyes" that checks every payment before money moves. No backend, no build step, scripted Sentinel responses — built for a reliable live demo.

> This prototype mirrors the flow in the **`amit-v2` branch** (the team's chosen build): rules layer → Sentinel interview → confirm → success/held, with a hash-chained audit trail — **plus the v2 adaptive threat-intelligence layer** (SOC console, live defense posture, "Living Trust" re-screening).

## v2 — the "Living Trust" headline beat

The **🛰 Threat Intel** tab is the internal **SOC console**: four pre-armed threat vectors, each with a one-click **ACTIVATE**. Activating one raises Fortress's **defense posture** (the badge in the top bar flips to *Heightened* / *Lockdown*) and changes customer-facing behaviour live.

The money shot:

1. **Threat Intel tab → ACTIVATE** the *Thames Water billing-scam surge* (posture → Heightened).
2. **Pay → ⭐ Living Trust · Thames Water bill £42** → even though Thames Water is a *trusted* payee paid for years, the active advisory **overrides its trust** and Sentinel runs a scoped check: *"did you get a call/text prompting this, or is it your normal bill?"*
   - **"Just my normal monthly bill"** → released ✓
   - **"I got a text saying I'm in arrears"** → **HELD** (unexpected-prompt fingerprint)
3. **Control · British Gas bill £90** (also trusted, *not* targeted) → still **clears instantly** — proving the re-screening is surgical, scoped to the one biller the world flagged.

> *"Two trusted payments. Only one re-screened — the one the world just flagged. Same trust status, different behaviour, live."*

## How to run it

Open **`vault-prototype.html`** in a browser. Either:

- Double-click the file, **or**
- Serve the folder: `npx -y serve mocks -l 4321` → open http://localhost:4321/vault-prototype.html

## Run it on your iPhone (the convincing demo)

Hosted via GitHub Pages: **https://ewoo.github.io/telp-demo/**

One-time Pages setup (repo → Settings → Pages → Source: `main` / root → Save).

On the iPhone, for a fullscreen, native-looking app:

1. Open **https://ewoo.github.io/telp-demo/** in **Safari** (Safari required for fullscreen).
2. **Share → Add to Home Screen → Add.**
3. Launch the navy **Fortress** icon — it opens fullscreen, no Safari bars.
4. Drive the demo with the floating **DEMO** button (bottom-right): jump to **Make a payment** or the **Audit trail**, or **Reset**.

> Loads once and runs entirely on-device — flaky room WiFi won't break it mid-demo. Load it before you walk up, and **Reset** right before presenting.

## How to demo it — the three beats

Go to **Make a payment** and tap a **demo scenario** to fill the form, then **Review payment**:

1. **Beat 1 · Routine (Landlord £1,200)** — trusted payee → clears instantly → Confirm & send. *"Fortress is invisible when it's safe."*
2. **Beat 2 · New payee £8,000 (car)** — rules flag it → Sentinel interview. In the chat, tap the **car / Autotrader** suggested answer → Sentinel **releases** → confirm. *"It doesn't just block big payments, it understands them."*
3. **Beat 3 · New payee £8,000 (scam)** — *same amount, same flags* → Sentinel interview. Tap the **"fraud team / safe account"** suggested answer → Sentinel **HOLDS** with the behavioural signal tags. Money never left.

> In the interview, tap a **suggested answer** (the 💬 chips) then **Send** — scripted so every run is identical. Try the **"keep this between us"** answer too, and the prompt-injection edge case is handled (any attempt to talk Sentinel into approving → HOLD).

## The headline

> Two payments. Same amount. Same new payee. A rules engine sees one transaction twice. Fortress sees a customer buying a car — and a customer being robbed.
