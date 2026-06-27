# Routing & Navigation

## Route Map

| Path | Component | Access | Notes |
|---|---|---|---|
| /login | `<Login />` | Public | Email/password login |
| /register | `<AdminRegister />` | Public | 2-step OTP registration |
| /tenants | `<Tenants />` | Protected via RequireAuth | Default landing page |
| /doctors | `<Doctors />` | Protected via RequireAuth | — |
| /licenses | `<Licenses />` | Protected via RequireAuth | — |
| /updates | `<Updates />` | Protected via RequireAuth | — |
| /settings | `<Settings />` | Protected via RequireAuth | — |
| / | `<Navigate to="/tenants" />` | Protected | Root redirects to /tenants |
| * | `<Navigate to="/login" />` | Public | Catch-all redirect |

## Layout Hierarchy

BrowserRouter
  Routes
    /login           (public)
    /register        (public)
    RequireAuth      (checks onAuthStateChanged)
      SidebarCtx.Provider
        Sidebar      (fixed left nav, 240px)
        Outlet
          /tenants
          /doctors
          /licenses
          /updates
          /settings
          /          (redirects to /tenants)
    *                (redirects to /login)

## Auth Guard (RequireAuth)

Defined inline in App.jsx. Uses Firebase onAuthStateChanged observer:

function RequireAuth({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <LoadingSpinner />;
  return user ? children : <Navigate to="/login" replace />;
}

- While loading, a centered spinner is shown (MUI CircularProgress)
- No user -> redirect to /login
- User present -> render children (SidebarLayout -> protected pages)

## Sidebar Layout (SidebarLayout)

Defined inline in App.jsx. Wraps protected routes:

function SidebarLayout() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((p) => !p);

  return (
    <SidebarCtx.Provider value={{ open, toggle }}>
      <Box sx={{ display: "flex" }}>
        <Sidebar />
        <Box component="main">
          <Outlet />
        </Box>
      </Box>
    </SidebarCtx.Provider>
  );
}

## Sidebar Context

const SidebarCtx = createContext({ open: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarCtx);

- **open** (boolean): mobile sidebar open state
- **toggle** (function): toggle open state
- Consumed by Sidebar.jsx and all page components (for hamburger button)

## Navigation Links (Sidebar)

All links defined in Sidebar.jsx with lucide-react icons:

  Link        Icon        Path
  ------      ----        ----
  Dashboard   LayoutDashboard   /tenants
  Clinics     Building2         /tenants
  Doctors     Stethoscope       /doctors
  Licenses    Key               /licenses
  Updates     Package           /updates
  Settings    Settings          /settings

Each link uses react-router-dom NavLink for active state styling.
Active link highlighted with accent color (MUI Chip).

## SPA Routing (Vercel)

vercel.json rewrite rules:

  /api/*     -> /api/$1     (API routes)
  /*         -> /index.html (SPA fallback)

All unknown paths serve index.html, then React Router handles client-side routing.
