// Fortress Security Operations console (internal). Separate page/URL from the
// customer app — served at /soc, not linked from the customer-facing banking UI.
// (Separation for the demo; production would gate this behind staff SSO + RBAC.)

const root = document.getElementById('soc');
const api = (path, opts) => fetch('/api' + path, {
  headers: { 'Content-Type': 'application/json' }, ...opts,
}).then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || 'Request failed'); return b; });
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

document.getElementById('reset').addEventListener('click', async () => {
  await api('/demo/reset', { method: 'POST' });
  render();
});

async function render() {
  root.innerHTML = '<p class="sub">Loading threat intelligence…</p>';
  const { threats, posture } = await api('/threats');
  const view = el(`<div>
    <h1 class="greeting">Threat Intelligence Feed</h1>
    <p class="sub">Live attack-vector feed. Activating a vector raises Fortress's defense posture — and changes customer-facing behaviour — in real time.</p>
    <div class="posture-hero ${posture.toLowerCase()}">
      <div class="posture-label">Current defense posture</div>
      <div class="posture-value">${posture}</div>
    </div>
    <div id="cards"></div>
  </div>`);
  const cards = view.querySelector('#cards');
  threats.forEach((t) => {
    const card = el(`<div class="threat-card ${t.active ? 'active' : ''}">
      <div class="threat-head">
        <div><span class="threat-name">${t.name}</span> <span class="threat-id">${t.id}</span></div>
        <span class="sev sev-${t.severity.toLowerCase()}">${t.severity}</span>
      </div>
      <div class="threat-meta">${t.category} · ${t.trend}${t.targetPayee ? ` · targets <b>${t.targetPayee}</b>` : ''}</div>
      <div class="threat-directive">${t.directive}</div>
      <div class="threat-foot">
        <span class="threat-status">${t.active ? '🟢 ACTIVE — posture ' + t.posture : '⚪ armed · pending'}</span>
        <button class="btn ${t.active ? 'secondary' : ''}" data-id="${t.id}" data-act="${t.active ? 'deactivate' : 'activate'}">${t.active ? 'Deactivate' : 'ACTIVATE'}</button>
      </div>
    </div>`);
    card.querySelector('button').addEventListener('click', async (e) => {
      const { id, act } = e.target.dataset;
      e.target.disabled = true; e.target.textContent = '…';
      try { await api('/threats/' + act, { method: 'POST', body: JSON.stringify({ id }) }); } catch (err) {}
      render();
    });
    cards.appendChild(card);
  });
  root.replaceChildren(view);
}

render();
