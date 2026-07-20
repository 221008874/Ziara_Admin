// src/components/shared/PageShells.jsx
//
// Shared layout shells and action components used across Doctors, Tenants,
// Licenses.  Centralising them eliminates the duplicated-and-diverged
// styled() definitions in each page.
//
// KEY FIXES applied here:
//  1. marginLeft responsive — use theme.breakpoints inside styled(), NOT
//     the sx-only shorthand { xs: 0, md: "240px" }
//  2. ActionButton "variant" collision — MUI/HTML reserve "variant".
//     We rename the custom prop to "btnVariant" and mark it transient
//     with shouldForwardProp so it never reaches the DOM.
//  3. StatusBadge disabled behaviour — Chip ignores the HTML disabled
//     attribute; wrap the onClick guard inside the component instead.

import { Button, Chip, Box } from "@mui/material";
import { styled } from "@mui/material/styles";

// ─── Page Shell ───────────────────────────────────────────────────────────────

export const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: "var(--bg-primary)",
  marginLeft: 0,                          // mobile: no sidebar
  position: "relative",
  overflow: "hidden",
  transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: {
    marginLeft: "240px",                  // desktop: sidebar width
  },
}));

export const TopBar = styled(Box)({
  background: "linear-gradient(to right, var(--bg-primary), var(--bg-secondary))",
  borderBottom: "1px solid rgba(28,138,126,0.12)",
  padding: "16px 28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.50)",
  position: "sticky",          // keeps topbar visible while scrolling
  top: 0,
  zIndex: 10,
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: 0, left: 0, right: 0, height: "2px",
    background: "linear-gradient(to right, transparent, var(--zy-teal-500) 35%, var(--zy-info) 65%, transparent)",
    opacity: 0.45,
  },
});

export const ContentWrapper = styled(Box)({
  padding: "24px 28px",
  position: "relative",
  zIndex: 1,
});

export const GlassPanel = styled(Box)({
  background: "linear-gradient(to bottom, var(--bg-secondary), var(--bg-tertiary))",
  borderRadius: "16px",
  border: "1px solid rgba(28,138,126,0.12)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
  overflow: "hidden",
});

export const StatCard = styled(Box)({
  background: "linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))",
  border: "1px solid rgba(28,138,126,0.10)",
  borderRadius: "14px",
  padding: "18px 22px",
  flex: "1 1 0",
  minWidth: 0,
});

export const EmptyState = styled(Box)({
  textAlign: "center",
  padding: "48px 20px",
});

// ─── ActionButton ─────────────────────────────────────────────────────────────
// FIX: renamed custom prop to "btnVariant" (not "variant") to avoid collision
//      with MUI's own variant prop and the HTML attribute.
//      shouldForwardProp prevents "btnVariant" from reaching the DOM element.

export const ActionButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "btnVariant",
})(({ btnVariant }) => ({
  borderRadius: "9px",
  textTransform: "none",
  fontWeight: 600,
  fontSize: "12px",
  padding: "8px 18px",
  transition: "all 0.2s ease",

  ...(btnVariant === "primary" && {
    background: "linear-gradient(to right, var(--zy-teal-500), var(--zy-teal-700))",
    color: "white",
    boxShadow: "0 4px 14px rgba(28,138,126,0.40)",
    "&:hover": {
      background: "linear-gradient(to right, var(--zy-teal-700), var(--zy-teal-700))",
      transform: "translateY(-1px)",
      boxShadow: "0 6px 20px rgba(28,138,126,0.55)",
    },
    "&.Mui-disabled": {
      background: "linear-gradient(to right, var(--zy-teal-700), var(--zy-teal-900))",
      color: "rgba(255,255,255,0.5)",
      boxShadow: "none",
      transform: "none",
    },
  }),

  ...(btnVariant === "warning" && {
    backgroundColor: "rgba(245,158,11,0.12)",
    color: "var(--zy-warning)",
    border: "1px solid rgba(245,158,11,0.30)",
    "&:hover": { backgroundColor: "var(--zy-warning)", color: "white" },
  }),

  ...(btnVariant === "danger" && {
    backgroundColor: "rgba(248,113,113,0.10)",
    color: "var(--danger)",
    border: "1px solid rgba(248,113,113,0.25)",
    "&:hover": { backgroundColor: "var(--danger)", color: "white" },
  }),

  ...((!btnVariant || btnVariant === "secondary") && {
    backgroundColor: "rgba(28,138,126,0.07)",
    color: "var(--accent-light)",
    border: "1px solid rgba(28,138,126,0.20)",
    "&:hover": { backgroundColor: "rgba(28,138,126,0.20)", borderColor: "var(--zy-teal-500)" },
  }),
}));

// ─── StatusBadge ──────────────────────────────────────────────────────────────
// FIX: Chip doesn't honour the HTML `disabled` attr for click-blocking.
//      Guard the onClick callback here instead of relying on disabled prop.

export const StatusBadge = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "statusColor",
})(({ statusColor }) => ({
  borderRadius: "12px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  height: "28px",
  minWidth: "80px",
  cursor: "pointer",
  transition: "filter 0.15s ease",

  ...(statusColor === "active" && {
    backgroundColor: "rgba(52,211,153,0.14)",
    color: "var(--success)",
    border: "1px solid rgba(52,211,153,0.28)",
    boxShadow: "0 0 8px rgba(52,211,153,0.15)",
  }),
  ...(statusColor === "expired" && {
    backgroundColor: "rgba(239,68,68,0.14)",
    color: "var(--zy-danger)",
    border: "1px solid rgba(239,68,68,0.28)",
    boxShadow: "0 0 8px rgba(239,68,68,0.15)",
    cursor: "default",
  }),
  ...(statusColor === "inactive" && {
    backgroundColor: "rgba(248,113,113,0.14)",
    color: "var(--danger)",
    border: "1px solid rgba(248,113,113,0.28)",
    boxShadow: "0 0 8px rgba(248,113,113,0.15)",
  }),
  "&:hover": { filter: "brightness(1.2)" },
}));

/**
 * Usage in pages — replace the inline StatusBadge usages with this helper.
 *
 * <ClickableStatus
 *   status={row.status}          // "ACTIVE" | "INACTIVE" | "EXPIRED"
 *   onToggle={() => toggle(...)} // omit or pass null for expired
 *   loading={isLoading}
 * />
 */
export function ClickableStatus({ status, onToggle, loading }) {
  const normalized = status?.toUpperCase() ?? "INACTIVE";
  const colorKey   = normalized === "ACTIVE" ? "active"
                   : normalized === "EXPIRED" ? "expired"
                   : "inactive";

  const handleClick = () => {
    // FIX: explicitly block clicks while loading or when status is EXPIRED
    if (loading || normalized === "EXPIRED" || !onToggle) return;
    onToggle();
  };

  return (
    <StatusBadge
      statusColor={colorKey}
      label={normalized}
      size="small"
      onClick={handleClick}
      sx={{ opacity: loading ? 0.6 : 1 }}
    />
  );
}

// ─── Shared table styling ─────────────────────────────────────────────────────

export const StyledTableContainer = styled(Box)({
  "& .MuiTable-root": { backgroundColor: "transparent" },
  "& .MuiTableHead-root": { backgroundColor: "var(--bg-secondary)" },
  "& .MuiTableCell-head": {
    color: "var(--accent-light)", fontWeight: 700, fontSize: "11px", letterSpacing: "0.8px",
    textTransform: "uppercase", padding: "14px 20px",
    borderBottom: "1px solid rgba(28,138,126,0.12)",
  },
  "& .MuiTableRow-root": {
    transition: "background 0.15s ease",
    borderBottom: "1px solid rgba(28,138,126,0.06)",
    "&:nth-of-type(odd)": { backgroundColor: "rgba(8,16,32,0.35)" },
    "&:hover": { backgroundColor: "rgba(28,138,126,0.09)" },
  },
  "& .MuiTableCell-body": {
    color: "var(--text-secondary)", fontSize: "13px", padding: "14px 20px", borderBottom: "none",
  },
});

// ─── Shared Dialog styling ────────────────────────────────────────────────────

export const StyledDialog = styled(Box)({
  // use via sx on the MUI Dialog's PaperProps
  // or import separately; kept here for reference
});





export const dialogPaperSx = {
  backgroundColor: "var(--bg-secondary)",
  borderRadius: "20px",
  border: "1px solid rgba(28,138,126,0.15)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.80)",
};

export const dialogTitleSx = {
  background: "linear-gradient(to right, var(--zy-teal-700), var(--zy-teal-900))",
  color: "white",
  fontSize: "18px",
  fontWeight: 700,
  padding: "20px 24px",
  position: "relative",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: 0, left: 0, right: 0, height: "1px",
    background: "linear-gradient(to right, transparent, rgba(28,138,126,0.5), transparent)",
  },
};

// ─── Shared text-field styling ────────────────────────────────────────────────

export const sharedFieldSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "var(--bg-input)",
    borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(28,138,126,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(28,138,126,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "var(--zy-teal-500)", boxShadow: "0 0 0 3px rgba(28,138,126,0.12)" },
  },
  "& .MuiInputBase-input": { color: "var(--text-secondary)", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "var(--text-dark)", fontSize: "12px", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "var(--zy-teal-500)" },
  "& .MuiFormHelperText-root": { color: "var(--zy-slate-300)", fontSize: "11px" },
};