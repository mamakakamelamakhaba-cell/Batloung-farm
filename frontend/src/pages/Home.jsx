import { useMemo } from 'react';

const EMOJIS = ['🍎', '🍌', '🍊', '🥭', '🍇', '🍏', '🍋', '🍑', '🍐', '🍓'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
const FEATURES = [
  ['📦', 'Boxes by size', 'Small, medium and large boxes are counted and priced separately for apples, bananas, oranges, mangoes and grapes.'],
  ['⏳', 'Fresh-first stock', 'Every delivery is a batch with an expiry date. Oldest stock sells first and spoilage is recorded, not hidden.'],
  ['🤝', 'Vendor credit', 'Credit limits, part-payments by cash or mobile money, overdue reminders and printable statements.'],
  ['🧾', 'Invoices and returns', 'Download a PDF invoice for every sale and handle damaged returns without deleting history.'],
  ['📈', 'Profit and trends', 'Gross profit by fruit, box size or sale, plus demand analysis that shows what to buy more of.']
];

export default function Home({ loggedIn, onLogin }) {
  // Floating fruit for the animated background (generated once)
  const fruit = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    e: EMOJIS[i % EMOJIS.length], left: (i * 4.6 + Math.random() * 3).toFixed(1), size: 28 + ((Math.random() * 34) | 0),
    dur: 16 + ((Math.random() * 16) | 0), delay: -((Math.random() * 30) | 0), sway: ((Math.random() * 120 - 60) | 0)
  })), []);
  const cta = loggedIn ? 'Open dashboard' : 'Admin login';

  return (
    <div>
      <section className="home">
        <div className="sun" />
        <div className="fruit-field" aria-hidden="true">
          {fruit.map((f, i) => <span key={i} style={{ left: `${f.left}%`, '--size': `${f.size}px`, '--dur': `${f.dur}s`, '--delay': `${f.delay}s`, '--sway': `${f.sway}px` }}>{f.e}</span>)}
        </div>
        <svg className="hills hills-back" viewBox="0 0 2400 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 150 C200 70 400 230 600 150 S1000 70 1200 150 C1400 70 1600 230 1800 150 S2200 70 2400 150 V300 H0 Z" /></svg>
        <svg className="hills hills-mid" viewBox="0 0 2400 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 170 C150 100 450 240 600 170 S1050 100 1200 170 C1350 100 1650 240 1800 170 S2250 100 2400 170 V300 H0 Z" /></svg>
        <svg className="hills hills-front" viewBox="0 0 2400 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 200 C300 140 300 260 600 200 S900 140 1200 200 C1500 140 1500 260 1800 200 S2100 140 2400 200 V300 H0 Z" /></svg>
        <div className="truck" aria-hidden="true">
          <svg viewBox="0 0 170 90">
            <g>
              <rect x="4" y="10" width="100" height="52" rx="6" fill="#F77F00" /><text x="14" y="46" fontSize="30">🍎🍌🍊</text>
              <path d="M108 26h30l18 18v18h-48z" fill="#2D6A4F" /><path d="M116 31h18l11 13h-29z" fill="#cdeccf" />
              <rect x="4" y="62" width="152" height="8" rx="3" fill="#1B4332" />
              <circle className="wheel" cx="36" cy="72" r="12" fill="#222" /><circle cx="36" cy="72" r="5" fill="#ddd" />
              <circle className="wheel" cx="128" cy="72" r="12" fill="#222" /><circle cx="128" cy="72" r="5" fill="#ddd" />
            </g>
          </svg>
        </div>
        <nav className="home-nav">
          <div className="brand"><span className="logo">🍊</span> Batloung Farm</div>
          <button className="btn green" onClick={onLogin}>{cta}</button>
        </nav>
        <div className="hero-copy">
          <h1>Orchard-fresh fruit for every stall in Lesotho.</h1>
          <p>Batloung Farm buys from growers across South Africa and supplies street vendors and small retailers in Maseru. This system keeps every box, price and payment in order.</p>
          <div className="hero-actions"><button className="btn" onClick={onLogin}>Open the dashboard</button><a className="btn ghost" href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features').scrollIntoView({ behavior: 'smooth' }); }}>See what it tracks</a></div>
          <div className="province-chips">{PROVINCES.map((p) => <span key={p}>{p}</span>)}</div>
        </div>
      </section>
      <section className="home-info" id="features">
        <h2>Everything a fruit distributor needs to count</h2>
        <div className="info-grid">{FEATURES.map(([ico, t, d]) => <div className="info-card" key={t}><span className="ico">{ico}</span><h3>{t}</h3><p>{d}</p></div>)}</div>
      </section>
      <div className="home-foot">Batloung Farm, Maseru, Lesotho. Distribution Management System.</div>
    </div>
  );
}
