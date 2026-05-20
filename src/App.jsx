import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import AdminRegister from "./pages/AdminRegister";
import Licenses from "./pages/Licenses";
import Tenants from "./pages/Tenants";
import Doctors from "./pages/Doctors";
import Settings from "./pages/Settings";
import Updates from "./pages/Updates";
import Login from "./pages/Login";
import Sidebar, { Hamburger } from "./components/Sidebar";

// ─── Sidebar Context ─────────────────────────────────────────────────────────

const SidebarCtx = createContext({ open: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarCtx);

// ─── Auth Guard ───────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#04091a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#0fb8a6", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// ─── Sidebar Layout ───────────────────────────────────────────────────────────

function SidebarLayout() {
  const [sideOpen, setSideOpen] = useState(false);
  const toggle = () => setSideOpen((o) => !o);

  return (
    <SidebarCtx.Provider value={{ open: sideOpen, toggle }}>
      <Sidebar onToggle={toggle} />

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sideOpen ? "active" : ""}`}
        onClick={toggle}
        style={{ display: sideOpen ? "block" : "none" }}
      />

      <Outlet />
    </SidebarCtx.Provider>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<AdminRegister />} />
        {/* Protected — all share the sidebar layout */}
        <Route
          element={
            <RequireAuth>
              <SidebarLayout />
            </RequireAuth>
          }
        >
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/licenses" element={<Licenses />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/settings" element={<Settings />} />
          <Route index element={<Navigate to="/tenants" replace />} />
          <Route path="/" element={<Navigate to="/tenants" replace />} />
        </Route>
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { Hamburger };
