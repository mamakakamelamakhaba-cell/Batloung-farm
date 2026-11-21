import { useEffect, useState } from 'react';
import { useAuth, useHashRoute, useToast } from './context';
import { Modal } from './components/ui';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Fruits from './pages/Fruits';
import Stock from './pages/Stock';
import Vendors from './pages/Vendors';
import VendorProfile from './pages/VendorProfile';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Payments from './pages/Payments';
import Returns from './pages/Returns';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';

const NAV = [
  ['dashboard', '📊', 'Dashboard', Dashboard], ['suppliers', '🚜', 'Suppliers', Suppliers], ['fruits', '🍎', 'Fruits & prices', Fruits],
  ['stock', '📦', 'Stock', Stock], ['vendors', '🛒', 'Vendors', Vendors], ['purchases', '🚚', 'Purchases', Purchases],
  ['sales', '🧾', 'Sales & invoices', Sales], ['payments', '💵', 'Payments', Payments], ['returns', '↩️', 'Returns', Returns],
  ['expenses', '🧮', 'Expenses', Expenses], ['reports', '📈', 'Reports', Reports]
];

function LoginModal({ onClose }) {
  const { login } = useAuth();
  const toast = useToast();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const admin = await login(u, p);
      toast(`Welcome back, ${admin.full_name}`);
      window.location.hash = '#/dashboard';
      onClose();
    } catch (err) { toast(err.message, 'err'); setBusy(false); }
  };
  return (
    <Modal title="Administrator login" onClose={onClose}>
      <form className="login-box" onSubmit={submit}>
        <span className="big">🍊</span>
        <p className="hint">Sign in to manage suppliers, stock, vendors and sales.</p>
        <div style={{ textAlign: 'left' }}>
          <label className="f">Username</label>
          <input autoFocus autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required />
          <label className="f" style={{ marginTop: 10 }}>Password</label>
          <input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required />
        </div>
        <div className="modal-foot"><button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>Log in</button></div>
      </form>
    </Modal>
  );
}

export default function App() {
  const parts = useHashRoute();
  const { token, meta, metaError, admin, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const page = parts[0] || (token ? 'dashboard' : 'home');
  const param = parts[1];

  useEffect(() => { setMenu(false); if (!token && page !== 'home') setLoginOpen(true); }, [page, token]);

  // ---- public home page (also shown when not logged in) ----
  if (page === 'home' || !token) {
    const openApp = () => { if (token) window.location.hash = '#/dashboard'; else setLoginOpen(true); };
    return (
      <>
        <Home loggedIn={!!token} onLogin={openApp} />
        {loginOpen && !token && <LoginModal onClose={() => setLoginOpen(false)} />}
      </>
    );
  }

  // ---- administrator area ----
  const current = NAV.find((n) => n[0] === page) || NAV[0];
  const Page = page === 'vendors' && param ? VendorProfile : current[3];
  const title = page === 'vendors' && param ? 'Vendor profile' : current[2];

  return (
    <div className="app">
      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="brand"><span className="logo">🍊</span> Batloung Farm</div>
        <nav className="nav">
          {NAV.map(([k, ico, t]) => <a key={k} href={`#/${k}`} className={current[0] === k ? 'active' : ''}><span className="emoji">{ico}</span>{t}</a>)}
          <hr />
          <a href="#/home"><span className="emoji">🏡</span>Home page</a>
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn ghost sm menu-toggle" onClick={() => setMenu((m) => !m)}>Menu</button>
            <h1>{title}</h1>
          </div>
          <div className="who"><span>Signed in as {admin}</span><button className="btn ghost sm" onClick={logout}>Log out</button></div>
        </div>
        <div className="view">
          {!meta ? (
            <div className="empty"><span className="big">{metaError ? '⚠️' : '🍊'}</span>{metaError || 'Loading...'}</div>
          ) : (
            <Page key={page + (param || '')} id={param} />
          )}
        </div>
      </main>
    </div>
  );
}
