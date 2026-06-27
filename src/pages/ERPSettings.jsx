import { useState, useEffect, useCallback } from "react";
import {
  getERPEnrichedTenants,
  updateTenantERPFields,
  updateLicenseERPFields,
  getLicenseByKey,
  migrateERPFields,
} from "../services/firestoreService";
import { getLang } from "../lib/i18n";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
import logo from "../assets/logo.png";
import { PLANS, getPlanTemplate, applyPlanTemplate, ALL_MODULES, MODULE_LABELS } from "../lib/licenseTemplates";
import { validateERPSettings } from "../lib/erpValidation";
import { debug } from "../lib/debug";

import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Switch, Checkbox, FormControlLabel, FormGroup, TextField, Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// ── Styled Components ──

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh", backgroundColor: "#04091a", marginLeft: 0,
  position: "relative", overflow: "hidden", transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: { marginLeft: "240px" },
}));

const TopBar = styled(Box)({
  background: "linear-gradient(to right, #090f22, #0c1830)",
  borderBottom: "1px solid rgba(15,184,166,0.12)", padding: "16px 28px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.50)", position: "relative",
  "&::after": {
    content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
    background: "linear-gradient(to right, transparent, #0fb8a6 35%, #3b82f6 65%, transparent)", opacity: 0.45,
  },
});

const ContentWrapper = styled(Box)({ padding: "24px 28px", position: "relative", zIndex: 1 });

const GlassPanel = styled(Box)({
  background: "linear-gradient(to bottom, #0b1628, #081020)", borderRadius: "16px",
  border: "1px solid rgba(15,184,166,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.55)", overflow: "hidden",
});

const StyledTableContainer = styled(Box)({
  "& .MuiTable-root": { backgroundColor: "transparent" },
  "& .MuiTableHead-root": { backgroundColor: "#0c1a30" },
  "& .MuiTableCell-head": {
    color: "#2dd4bf", fontWeight: 700, fontSize: "11px", letterSpacing: "0.8px",
    textTransform: "uppercase", padding: "14px 20px", borderBottom: "1px solid rgba(15,184,166,0.12)",
  },
  "& .MuiTableRow-root": {
    transition: "all 0.15s ease", borderBottom: "1px solid rgba(15,184,166,0.06)",
    "&:nth-of-type(odd)": { backgroundColor: "rgba(8,16,32,0.35)" },
    "&:hover": { backgroundColor: "rgba(15,184,166,0.09)" },
  },
  "& .MuiTableCell-body": { color: "#dde6f0", fontSize: "13px", padding: "14px 20px", borderBottom: "none" },
});

const StatusBadge = styled(Chip)(({ statuscolor }) => ({
  borderRadius: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", height: "28px", minWidth: "80px",
  ...(statuscolor === "active" ? {
    backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399",
    border: "1px solid rgba(52,211,153,0.28)",
  } : {
    backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171",
    border: "1px solid rgba(248,113,113,0.28)",
  }),
}));

const PlanBadge = styled(Chip)(({ plan }) => ({
  borderRadius: "8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", height: "24px",
  ...(plan === "ENTERPRISE" ? {
    backgroundColor: "rgba(139,92,246,0.14)", color: "#a78bfa",
    border: "1px solid rgba(139,92,246,0.28)",
  } : plan === "PRO" ? {
    backgroundColor: "rgba(59,130,246,0.14)", color: "#60a5fa",
    border: "1px solid rgba(59,130,246,0.28)",
  } : {
    backgroundColor: "rgba(15,184,166,0.10)", color: "#2dd4bf",
    border: "1px solid rgba(15,184,166,0.20)",
  }),
}));

const ActionButton = styled(Button)(({ btnvariant }) => ({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px",
  padding: "8px 18px", transition: "all 0.2s ease",
  ...(btnvariant === "primary" ? {
    background: "linear-gradient(to right, #0fb8a6, #0d9488)", color: "white",
    boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
    "&:hover": { background: "linear-gradient(to right, #0d9488, #0b7a72)", transform: "translateY(-1px)" },
  } : btnvariant === "danger" ? {
    backgroundColor: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)",
    "&:hover": { backgroundColor: "#f87171", color: "white" },
  } : {
    backgroundColor: "rgba(15,184,166,0.07)", color: "#2dd4bf", border: "1px solid rgba(15,184,166,0.20)",
    "&:hover": { backgroundColor: "rgba(15,184,166,0.20)", borderColor: "#0fb8a6" },
  }),
}));

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    backgroundColor: "#0b1628", borderRadius: "20px",
    border: "1px solid rgba(15,184,166,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.80)",
  },
  "& .MuiDialogTitle-root": {
    background: "linear-gradient(to right, #0d9488, #083040)", color: "white",
    fontSize: "18px", fontWeight: 700, padding: "20px 24px",
    "&::after": {
      content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "1px",
      background: "linear-gradient(to right, transparent, rgba(15,184,166,0.5), transparent)",
    },
  },
});

const StyledField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#0f1e36", borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(15,184,166,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "#0fb8a6" },
  },
  "& .MuiInputBase-input": { color: "#dde6f0", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 },
  "& .MuiFormHelperText-root": { color: "#4a6080", fontSize: "11px" },
});

const StyledSelect = styled(Select)({
  backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.35)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0fb8a6" },
  "& .MuiSvgIcon-root": { color: "#4a6080" },
});

const EmptyState = styled(Box)({ textAlign: "center", padding: "48px 20px", color: "#3a5070" });

const StatCard = styled(Box)({
  background: "linear-gradient(135deg, #0b1628, #081020)",
  border: "1px solid rgba(15,184,166,0.10)", borderRadius: "14px",
  padding: "18px 22px", flex: "1 1 0", minWidth: 0,
});

const ToggleRow = styled(Box)({
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 0", borderBottom: "1px solid rgba(15,184,166,0.06)",
  "&:last-child": { borderBottom: "none" },
});

// ── Component ──

const EMPTY_FORM = {
  erpEnabled: false,
  status: "ACTIVE",
  plan: "BASIC",
  licenseStatus: "ACTIVE",
  licenseExpiry: "",
  maxUsers: 5,
  maxDoctors: 2,
  enabledModules: ["patients", "appointments"],
};

export default function ERPSettings() {
  const { toggle } = useSidebar();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    debug.component("ERPSettings", "Mounted");
    load();
    return () => debug.component("ERPSettings", "Unmounted");
  }, []);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getERPEnrichedTenants();
      setTenants(data);
      debug.action("ERPSettings", `Loaded ${data.length} tenants`);
    } catch (e) {
      debug.error("ERPSettings.load", e);
      setError("Failed to load tenants: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (tenant) => {
    const licERP = tenant.licenseERP || {};
    const formData = {
      erpEnabled: tenant.erpEnabled ?? false,
      status: tenant.status || "ACTIVE",
      plan: licERP.plan || tenant.plan || "BASIC",
      licenseStatus: licERP.status || "ACTIVE",
      licenseExpiry: licERP.expiresAt
        ? (typeof licERP.expiresAt === "object" && licERP.expiresAt.toDate
            ? licERP.expiresAt.toDate().toISOString().split("T")[0]
            : licERP.expiresAt)
        : (typeof tenant.expiryDate === "string" ? tenant.expiryDate : ""),
      maxUsers: licERP.maxUsers ?? 5,
      maxDoctors: licERP.maxDoctors ?? 2,
      enabledModules: licERP.enabledModules ?? ["patients", "appointments"],
    };
    setEditTarget(tenant);
    setForm(formData);
    setValidationErrors({});
    setDialogOpen(true);
  };

  const handlePlanChange = (newPlan) => {
    const updated = applyPlanTemplate(newPlan, {
      ...form,
      plan: newPlan,
    });
    setForm(updated);
  };

  const handleSave = async () => {
    const result = validateERPSettings(form);
    setValidationErrors(result.errors);
    if (!result.valid) return;

    if (!editTarget) return;
    setSaving(true); setError(null);

    try {
      // 1. Update tenant ERP fields
      await updateTenantERPFields(editTarget.id, {
        erpEnabled: form.erpEnabled,
        status: form.status,
        plan: form.plan,
      });

      // 2. Update license ERP fields (if tenant has a license key)
      if (editTarget.licenseKey) {
        const expiresAt = form.licenseExpiry ? new Date(form.licenseExpiry) : null;
        await updateLicenseERPFields(editTarget.licenseKey, {
          tenantId: editTarget.id,
          plan: form.plan,
          status: form.licenseStatus,
          expiresAt: expiresAt,
          maxUsers: form.maxUsers,
          maxDoctors: form.maxDoctors,
          enabledModules: form.enabledModules,
        });
      }

      debug.action("ERPSettings", `Saved ERP settings for ${editTarget.name}`);
      setSuccess(`ERP settings saved for ${editTarget.name}`);
      setTimeout(() => setSuccess(null), 4000);
      setDialogOpen(false);
      load();
    } catch (e) {
      debug.error("ERPSettings.save", e);
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm("Run ERP field migration on all existing tenants and licenses? This is safe to re-run.")) return;
    setMigrating(true); setError(null); setSuccess(null);
    try {
      const result = await migrateERPFields();
      setSuccess(`Migration complete: ${result.tenantsUpdated} tenants, ${result.licensesUpdated} licenses updated.`);
      if (result.errors.length > 0) {
        setError("Migration errors: " + result.errors.join("; "));
      }
      setTimeout(() => setSuccess(null), 6000);
      load();
    } catch (e) {
      setError("Migration failed: " + e.message);
    } finally {
      setMigrating(false);
    }
  };

  const toggleModule = (mod) => {
    setForm((prev) => {
      const current = prev.enabledModules || [];
      const next = current.includes(mod)
        ? current.filter((m) => m !== mod)
        : [...current, mod];
      return { ...prev, enabledModules: next };
    });
  };

  const toggleAllModules = () => {
    setForm((prev) => {
      const current = prev.enabledModules || [];
      const allEnabled = ALL_MODULES.every((m) => current.includes(m));
      return {
        ...prev,
        enabledModules: allEnabled ? [] : [...ALL_MODULES],
      };
    });
  };

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const erpEnabled = tenants.filter((t) => t.erpEnabled).length;

  return (
    <PageContainer>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>ERP Settings</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>SaaS metadata for ERP integration</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <ActionButton btnvariant="secondary" onClick={handleMigrate} disabled={migrating}>
            {migrating ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
            {migrating ? "Migrating..." : "Run Migration"}
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px" }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3, backgroundColor: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: "12px" }}>
            {success}
          </Alert>
        )}

        <Box className="stats-grid" sx={{ mb: 3 }}>
          {[
            { label: "Total Tenants", value: tenants.length, color: "#2dd4bf" },
            { label: "ERP Enabled", value: erpEnabled, color: "#34d399" },
            { label: "ERP Disabled", value: tenants.length - erpEnabled, color: "#f87171" },
            { label: "Active", value: tenants.filter((t) => t.status === "ACTIVE").length, color: "#60a5fa" },
          ].map((s) => (
            <StatCard key={s.label}>
              <Typography sx={{ color: "#4a6080", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ color: s.color, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{s.value}</Typography>
            </StatCard>
          ))}
        </Box>

        <GlassPanel>
          <div className="table-responsive">
            <StyledTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>ERP Enabled</TableCell>
                    <TableCell>User Limit</TableCell>
                    <TableCell>Doctor Limit</TableCell>
                    <TableCell>Modules</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <EmptyState>
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>⚡</Typography>
                          <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px" }}>No tenants found</Typography>
                          <Typography sx={{ color: "#283848", fontSize: "13px" }}>Create a tenant in Tenants first</Typography>
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((t) => {
                      const lic = t.licenseERP || {};
                      const mods = lic.enabledModules || [];
                      const modCount = mods.includes("*") ? ALL_MODULES.length : mods.length;
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>{getLang(t.name)}</Typography>
                          </TableCell>
                          <TableCell>
                            <PlanBadge plan={lic.plan || t.plan || "BASIC"} label={lic.plan || t.plan || "BASIC"} size="small" />
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              statuscolor={(t.status || "INACTIVE").toLowerCase()}
                              label={t.status || "INACTIVE"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.erpEnabled ? "YES" : "NO"}
                              size="small"
                              sx={{
                                fontWeight: 600, fontSize: "10px",
                                backgroundColor: t.erpEnabled ? "rgba(52,211,153,0.14)" : "rgba(100,116,139,0.14)",
                                color: t.erpEnabled ? "#34d399" : "#64748b",
                                border: t.erpEnabled ? "1px solid rgba(52,211,153,0.28)" : "1px solid rgba(100,116,139,0.28)",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontFamily: "monospace", color: lic.maxUsers === -1 ? "#a78bfa" : "#dde6f0" }}>
                              {lic.maxUsers === -1 ? "∞" : lic.maxUsers ?? "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontFamily: "monospace", color: lic.maxDoctors === -1 ? "#a78bfa" : "#dde6f0" }}>
                              {lic.maxDoctors === -1 ? "∞" : lic.maxDoctors ?? "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={
                                <Box>
                                  {mods.includes("*")
                                    ? ALL_MODULES.map((m) => <div key={m}>{MODULE_LABELS[m]?.en || m}</div>)
                                    : mods.length > 0
                                      ? mods.map((m) => <div key={m}>{MODULE_LABELS[m]?.en || m}</div>)
                                      : "No modules"}
                                </Box>
                              }
                            >
                              <Chip
                                 label={mods.includes("*") ? "All" : `${modCount} module`}
                                size="small"
                                sx={{
                                  fontWeight: 600, fontSize: "10px",
                                  backgroundColor: "rgba(15,184,166,0.08)", color: "#2dd4bf",
                                  border: "1px solid rgba(15,184,166,0.20)",
                                }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            <ActionButton btnvariant="primary" size="small" onClick={() => openDialog(t)}>
                              Configure
                            </ActionButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </StyledTableContainer>
          </div>
        </GlassPanel>
      </ContentWrapper>

      {/* ── Configure Dialog ── */}
      <StyledDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          ERP Configuration: `${editTarget ? getLang(editTarget.name) : ""}`
        </DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          {/* Tenant Status */}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600 }}>Tenant Status</InputLabel>
            <StyledSelect
              label="Tenant Status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <MenuItem value="ACTIVE" sx={{ color: "#34d399" }}>ACTIVE</MenuItem>
              <MenuItem value="INACTIVE" sx={{ color: "#f87171" }}>INACTIVE</MenuItem>
            </StyledSelect>
          </FormControl>

          {/* ERP Enabled */}
          <ToggleRow>
            <Box>
              <Typography sx={{ color: "#dde6f0", fontSize: "14px", fontWeight: 600 }}>ERP Integration Enabled</Typography>
              <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>
                Allow ERP system to read this tenant's data
              </Typography>
            </Box>
            <Switch
              checked={!!form.erpEnabled}
              onChange={(e) => setForm((p) => ({ ...p, erpEnabled: e.target.checked }))}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: "#0fb8a6" },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "rgba(15,184,166,0.40)" },
              }}
            />
          </ToggleRow>

          {/* Plan */}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600 }}>
              Plan (auto-populates limits on select)
            </InputLabel>
            <StyledSelect
              label="Plan"
              value={form.plan}
              onChange={(e) => handlePlanChange(e.target.value)}
            >
              {Object.keys(PLANS).map((p) => (
                <MenuItem key={p} value={p} sx={{ color: "#dde6f0" }}>{p}</MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          {/* License Status */}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600 }}>License Status</InputLabel>
            <StyledSelect
              label="License Status"
              value={form.licenseStatus}
              onChange={(e) => setForm((p) => ({ ...p, licenseStatus: e.target.value }))}
            >
              <MenuItem value="ACTIVE" sx={{ color: "#34d399" }}>ACTIVE</MenuItem>
              <MenuItem value="INACTIVE" sx={{ color: "#f87171" }}>INACTIVE</MenuItem>
              <MenuItem value="EXPIRED" sx={{ color: "#ef4444" }}>EXPIRED</MenuItem>
            </StyledSelect>
          </FormControl>

          {/* Expiration Date */}
          <StyledField
            fullWidth label="License Expiration" margin="normal"
            type="date" value={form.licenseExpiry}
            onChange={(e) => setForm((p) => ({ ...p, licenseExpiry: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            error={!!validationErrors.licenseExpiry}
            helperText={validationErrors.licenseExpiry?.[0]}
          />

          {/* Limits */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 1 }}>
            <StyledField
              fullWidth label="User Limit (-1 = unlimited)" margin="normal"
              type="number" value={form.maxUsers}
              onChange={(e) => setForm((p) => ({ ...p, maxUsers: parseInt(e.target.value) || 0 }))}
              error={!!validationErrors.maxUsers}
              helperText={validationErrors.maxUsers?.[0]}
            />
            <StyledField
              fullWidth label="Doctor Limit (-1 = unlimited)" margin="normal"
              type="number" value={form.maxDoctors}
              onChange={(e) => setForm((p) => ({ ...p, maxDoctors: parseInt(e.target.value) || 0 }))}
              error={!!validationErrors.maxDoctors}
              helperText={validationErrors.maxDoctors?.[0]}
            />
          </Box>

          {/* Enabled Modules */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ color: "#eaf2ff", fontSize: "13px", fontWeight: 600 }}>Enabled Modules</Typography>
              <Button
                size="small"
                onClick={toggleAllModules}
                sx={{ color: "#0fb8a6", textTransform: "none", fontSize: "11px", fontWeight: 600 }}
              >
                {ALL_MODULES.every((m) => (form.enabledModules || []).includes(m)) ? "Deselect All" : "Select All"}
              </Button>
            </Box>
            <FormGroup sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
              {ALL_MODULES.map((mod) => (
                <FormControlLabel
                  key={mod}
                  control={
                    <Checkbox
                      checked={(form.enabledModules || []).includes(mod)}
                      onChange={() => toggleModule(mod)}
                      sx={{ color: "#4a6080", "&.Mui-checked": { color: "#0fb8a6" } }}
                    />
                  }
                  label={
                    <Typography sx={{ color: "#9ecfca", fontSize: "13px" }}>
                      {MODULE_LABELS[mod]?.en || mod}
                    </Typography>
                  }
                />
              ))}
            </FormGroup>
            {validationErrors.enabledModules && (
              <Typography sx={{ color: "#f87171", fontSize: "12px", mt: 1 }}>
                {validationErrors.enabledModules[0]}
              </Typography>
            )}
          </Box>

          {/* Buttons */}
          <Box sx={{ mt: 4, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnvariant="secondary" onClick={() => setDialogOpen(false)}>Cancel</ActionButton>
            <ActionButton btnvariant="primary" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={14} sx={{ mr: 1, color: "white" }} /> : null}
              {saving ? "Saving..." : "Save Configuration"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}


