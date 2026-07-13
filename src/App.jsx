import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { CircularProgress, Box } from "@mui/material";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotificationProvider } from "./contexts/NotificationContext";
import AdminRegister from "./pages/AdminRegister";
import Licenses from "./pages/Licenses";
import Tenants from "./pages/Tenants";
import Doctors from "./pages/Doctors";
import Settings from "./pages/Settings";
import PlatformAdmins from "./pages/PlatformAdmins";
import ErrorLogs from "./pages/ErrorLogs";

import Updates from "./pages/Updates";
import ERPSettings from "./pages/ERPSettings";
import Login from "./pages/Login";
import Sidebar, { Hamburger } from "./components/Sidebar";

// ─── Sidebar Context ─────────────────────────────────────────────────────────

const SidebarCtx = createContext({ open: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarCtx);

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function AuthLoading() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#04091a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <CircularProgress sx={{ color: "#0fb8a6" }} size={40} thickness={3} />
      <Box sx={{ color: "#3a5070", fontSize: "13px", fontWeight: 500 }}>Verifying session…</Box>
    </Box>
  );
}

function RequireAuth({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.getIdToken(true);
          const tokenResult = await u.getIdTokenResult();
          const isAdmin = tokenResult.claims?.admin === true || tokenResult.claims?.role === "admin";
          if (isAdmin) {
            setUser(u);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <AuthLoading />;

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
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
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
              <Route path="/platform-admins" element={<PlatformAdmins />} />
              <Route path="/error-logs" element={<ErrorLogs />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/erp-settings" element={<ERPSettings />} />
              <Route path="/settings" element={<Settings />} />
              <Route index element={<Navigate to="/tenants" replace />} />
              <Route path="/" element={<Navigate to="/tenants" replace />} />
            </Route>
            {/* Catch-all */}
              <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </NotificationProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export { Hamburger };
