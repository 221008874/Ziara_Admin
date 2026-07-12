import { NavLink, useNavigate } from "react-router-dom";
import { Box, Typography, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Menu, X, Building2, Stethoscope, Key, Cloud, Zap, Settings } from "lucide-react";
const logo = "/favicon.svg";
import { useSidebar } from "../App";

// ─── Styled Components ───────────────────────────────────────────────────────

const SidebarRoot = styled(Box)(({ $open }) => ({
  width: 240,
  minHeight: "100vh",
  background: "linear-gradient(to bottom, #090f22, #060d1c)",
  borderRight: "1px solid rgba(15,184,166,0.10)",
  display: "flex",
  flexDirection: "column",
  position: "fixed",
  left: 0,
  top: 0,
  bottom: 0,
  zIndex: 100,
  boxShadow: "4px 0 24px rgba(0,0,0,0.40)",
  transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
  "@media (max-width: 768px)": {
    transform: $open ? "translateX(0)" : "translateX(-100%)",
    width: 260,
  },
}));

const Logo = styled(Box)({
  padding: "16px 20px",
  borderBottom: "1px solid rgba(15,184,166,0.08)",
  display: "flex",
  alignItems: "center",
  gap: 12,
});

const LogoIcon = styled("img")({
  width: 40,
  height: 40,
  borderRadius: "10px",
  objectFit: "contain",
  flexShrink: 0,
});

const CloseBtn = styled(IconButton)({
  display: "none",
  position: "absolute",
  right: 12,
  top: 16,
  color: "#4a6a8a",
  "@media (max-width: 768px)": {
    display: "flex",
  },
  "&:hover": { backgroundColor: "rgba(15,184,166,0.10)" },
});

const NavSection = styled(Box)({
  padding: "12px 10px",
  flex: 1,
  overflowY: "auto",
});

const SectionLabel = styled(Typography)({
  fontSize: "9px",
  fontWeight: 700,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  color: "#2a3a52",
  padding: "8px 10px 4px",
});

const NavItem = styled(NavLink)({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 14px",
  borderRadius: "10px",
  marginBottom: 2,
  textDecoration: "none",
  color: "#4a6a8a",
  fontSize: "13px",
  fontWeight: 500,
  transition: "all 0.18s ease",
  position: "relative",
  "&:hover": {
    backgroundColor: "rgba(15,184,166,0.08)",
    color: "#9ecfca",
  },
  "&.active": {
    backgroundColor: "rgba(15,184,166,0.12)",
    color: "#2dd4bf",
    fontWeight: 600,
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "20%",
      bottom: "20%",
      width: 3,
      borderRadius: "0 3px 3px 0",
      backgroundColor: "#0fb8a6",
      boxShadow: "0 0 8px rgba(15,184,166,0.60)",
    },
  },
});

const NavIcon = styled(Box)({
  fontSize: 16,
  width: 20,
  textAlign: "center",
  flexShrink: 0,
});

const BottomSection = styled(Box)({
  padding: "12px 10px 20px",
  borderTop: "1px solid rgba(15,184,166,0.08)",
});

const UserBox = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: "10px",
  backgroundColor: "rgba(15,184,166,0.05)",
  border: "1px solid rgba(15,184,166,0.10)",
  marginBottom: 8,
});

const LogoutBtn = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: "10px",
  color: "#f87171",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.18s ease",
  "&:hover": {
    backgroundColor: "rgba(248,113,113,0.10)",
    color: "#fca5a5",
  },
});

// ─── Nav Config ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    section: "Management",
    items: [
      { to: "/tenants",   icon: <Building2 size={16} />, label: "Tenants"   },
      { to: "/doctors",   icon: <Stethoscope size={16} />, label: "Doctors"   },
      { to: "/licenses",  icon: <Key size={16} />, label: "Licenses"  },
      { to: "/updates",   icon: <Cloud size={16} />, label: "Updates"   },
    ],
  },
  {
    section: "System",
    items: [
      { to: "/settings", icon: <Settings size={16} />, label: "SaaS Settings" },
    ],
  },
  {
    section: "ERP Integration",
    items: [
      { to: "/erp-settings", icon: <Zap size={16} />, label: "ERP Settings" },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar({ onToggle }) {
  const { open } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      /* noop */
    }
    localStorage.removeItem("clinic_admin_logged");
    localStorage.removeItem("clinic_admin_user");
    navigate("/login");
  };

  const adminUser = localStorage.getItem("clinic_admin_user") || "Admin";

  return (
    <SidebarRoot $open={open}>
      <CloseBtn onClick={onToggle} size="small">
        <X size={20} />
      </CloseBtn>

      {/* Logo */}
      <Logo>
        <LogoIcon src={logo} alt="Smart Clinic" />
        <Box>
          <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "14px", lineHeight: 1.2 }}>
            Smart Clinic
          </Typography>
          <Typography sx={{ color: "#2a3a52", fontSize: "10px", fontStyle: "italic" }}>
            Admin Console
          </Typography>
        </Box>
      </Logo>

      {/* Navigation */}
      <NavSection>
        {NAV_ITEMS.map((group) => (
          <Box key={group.section} sx={{ mb: 1 }}>
            <SectionLabel>{group.section}</SectionLabel>
            {group.items.map((item) => (
              <NavItem key={item.to} to={item.to} end={item.to === "/"} onClick={() => window.innerWidth <= 768 && onToggle?.()}>
                <NavIcon>{item.icon}</NavIcon>
                {item.label}
              </NavItem>
            ))}
          </Box>
        ))}
      </NavSection>

      {/* User + Logout */}
      <BottomSection>
        <UserBox>
          <Box sx={{ fontSize: 14 }}>👋</Box>
          <Typography sx={{ color: "#4a6a8a", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {adminUser}
          </Typography>
        </UserBox>
        <LogoutBtn onClick={handleLogout}>
          <NavIcon>🚪</NavIcon>
          Logout
        </LogoutBtn>
      </BottomSection>
    </SidebarRoot>
  );
}

// ─── Hamburger Button (for pages to render) ────────────────────────────────

export function Hamburger({ onClick }) {
  return (
    <IconButton
      onClick={onClick}
      sx={{
        display: { xs: "flex", md: "none" },
        color: "#eaf2ff",
        mr: 1,
        "&:hover": { backgroundColor: "rgba(15,184,166,0.12)" },
      }}
      size="small"
    >
      <Menu size={22} />
    </IconButton>
  );
}
