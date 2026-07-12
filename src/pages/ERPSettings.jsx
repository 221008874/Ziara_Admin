import { useState, useEffect } from "react";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
const logo = "/favicon.svg";
import {
  getERPEnrichedTenants,
  updateTenantERPFields,
  updateLicenseERPFields,
  migrateERPFields,
  triggerERPSync,
} from "../services/firestoreService";
import { debug } from "../lib/debug";
import { normalizeError } from "../lib/errorHandler";
import { useNotification } from "../contexts/NotificationContext";
import { PLANS, PLAN_KEYS, ALL_MODULES, MODULE_LABELS, getPlanTemplate } from "../lib/licenseTemplates";
import { validateERPSettings } from "../lib/erpValidation";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel, FormGroup, Switch,
} from "@mui/material";
import { styled } from "@mui/material/styles";

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: "#04091a",
  marginLeft: 0,
  position: "relative",
  overflow: "hidden",
  transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: { marginLeft: "240px" },
}));

const TopBar = styled(Box)({
  background: "linear-gradient(to right, #090f22, #0c1830)",
  borderBottom: "1px solid rgba(15,184,166,0.12)",
  padding: "16px 28px",
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

const StatCard = styled(Box)({
  background: "linear-gradient(135deg, #0b1628, #081020)",
  border: "1px solid rgba(15,184,166,0.10)", borderRadius: "14px",
  padding: "18px 22px", flex: "1 1 0", minWidth: 0,
});

const EmptyState = styled(Box)({ textAlign: "center", padding: "48px 20px", color: "#3a5070" });

const ActionButton = styled(Button)(({ variant: v }) => ({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px", transition: "all 0.2s ease",
  ...(v === "primary" ? {
    background: "linear-gradient(to right, #0fb8a6, #0d9488)", color: "white", boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
    "&:hover": { background: "linear-gradient(to right, #0d9488, #0b7a72)", transform: "translateY(-1px)" },
  } : v === "warning" ? {
    backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.30)",
    "&:hover": { backgroundColor: "#f59e0b", color: "white" },
  } : v === "danger" ? {
    backgroundColor: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)",
    "&:hover": { backgroundColor: "#f87171", color: "white" },
  } : v === "migration" ? {
    background: "linear-gradient(to right, #7c3aed, #6d28d9)", color: "white", boxShadow: "0 4px 14px rgba(124,58,237,0.40)",
    "&:hover": { background: "linear-gradient(to right, #6d28d9, #5b21b6)", transform: "translateY(-1px)" },
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
    fontSize: "18px", fontWeight: 700, padding: "20px 24px", position: "relative",
    "&::after": { content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(to right, transparent, rgba(15,184,166,0.5), transparent)" },
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
  "& .MuiInputLabel-root.Mui-focused": { color: "#0fb8a6" },
});

const StyledSelect = styled(Select)({
  backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.35)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0fb8a6" },
  "& .MuiSvgIcon-root": { color: "#4a6080" },
});

function isUnlimited(v) { return v === -1 || v === Infinity; }

export default function ERPSettings() {
  const { toggle } = useSidebar();
  const { showNotification } = useNotification();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTarget, setConfigTarget] = useState(null);
  const [configForm, setConfigForm] = useState({
    erpEnabled: false,
    status: "ACTIVE",
    plan: "BASIC",
    maxUsers: 5,
    maxDoctors: 2,
    enabledModules: [],
    expiresAt: "",
    licenseStatus: "ACTIVE",
  });
  const [configErrors, setConfigErrors] = useState([]);
  const [configSaving, setConfigSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getERPEnrichedTenants();
      setTenants(data);
    } catch (e) {
      debug.error("ERPSettings.load", e);
      setError(normalizeError(e).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openConfig = (t) => {
    const lic = t.licenseERP || {};
    setConfigTarget(t);
    setConfigForm({
      erpEnabled: t.erpEnabled ?? false,
      status: t.status || "ACTIVE",
      plan: lic.plan || t.plan || "BASIC",
      maxUsers: lic.maxUsers ?? PLANS[lic.plan || t.plan || "BASIC"]?.maxUsers ?? 5,
      maxDoctors: lic.maxDoctors ?? PLANS[lic.plan || t.plan || "BASIC"]?.maxDoctors ?? 2,
      enabledModules: lic.enabledModules ?? [...(PLANS[lic.plan || t.plan || "BASIC"]?.enabledModules || ["patients", "appointments"])],
      expiresAt: lic.expiresAt || "",
      licenseStatus: lic.status || t.licenseERP?.status || "ACTIVE",
    });
    setConfigErrors([]);
    setConfigOpen(true);
  };

  const handlePlanChange = (planId) => {
    const tmpl = getPlanTemplate(planId);
    if (!tmpl) return;
    setConfigForm(p => ({
      ...p,
      plan: planId,
      maxUsers: p.maxUsers ?? tmpl.maxUsers,
      maxDoctors: p.maxDoctors ?? tmpl.maxDoctors,
      enabledModules: p.enabledModules.length > 0 ? p.enabledModules : [...tmpl.enabledModules],
    }));
  };

  const handleConfigSave = async () => {
    if (!configTarget) return;
    const validationErrors = validateERPSettings(configForm);
    if (validationErrors.length > 0) {
      setConfigErrors(validationErrors);
      return;
    }
    setConfigErrors([]);
    setConfigSaving(true);
    try {
      await updateTenantERPFields(configTarget.id, {
        erpEnabled: configForm.erpEnabled,
        status: configForm.status,
        plan: configForm.plan,
      });
      if (configTarget.licenseKey) {
        await updateLicenseERPFields(configTarget.licenseKey, {
          plan: configForm.plan,
          status: configForm.licenseStatus,
          expiresAt: configForm.expiresAt || "",
          maxUsers: configForm.maxUsers,
          maxDoctors: configForm.maxDoctors,
          enabledModules: configForm.enabledModules,
        });
      }
      showNotification("ERP settings updated", "success");
      triggerERPSync().then(r => { if (!r.success) showNotification(r.message, "warning"); });
      setConfigOpen(false);
      load();
    } catch (e) {
      setConfigErrors([e.message]);
    } finally { setConfigSaving(false); }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await migrateERPFields();
      setMigrateResult(result);
      if (result.errors.length === 0) {
        showNotification(`Migration complete: ${result.tenantsUpdated} tenants, ${result.licensesUpdated} licenses`, "success");
      } else {
        showNotification(`Migration completed with ${result.errors.length} error(s)`, "warning");
      }
      load();
    } catch (e) {
      setMigrateResult({ errors: [e.message] });
    } finally { setMigrating(false); }
  };

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const erpEnabled = tenants.filter(t => t.erpEnabled).length;
  const erpDisabled = tenants.filter(t => !t.erpEnabled).length;
  const active = tenants.filter(t => t.status === "ACTIVE").length;

  return (
    <PageContainer>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,58,237,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>ERP Integration</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Configure SaaS metadata for the ERP system</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <ActionButton variant="migration" onClick={handleMigrate} disabled={migrating}>
            {migrating ? <CircularProgress size={14} sx={{ color: "white", mr: 1 }} /> : null}
            {migrating ? "Migrating..." : "Migrate ERP Fields"}
          </ActionButton>
          <ActionButton variant="primary" onClick={() => triggerERPSync().then(r => { if (!r.success) showNotification(r.message, "warning"); })}>
            Sync ERP
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}

        {migrateResult && migrateResult.errors.length > 0 && (
          <Alert severity="warning" onClose={() => setMigrateResult(null)} sx={{ mb: 3, backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f59e0b" } }}>
            Migration errors: {migrateResult.errors.join("; ")}
          </Alert>
        )}

        <Box className="stats-grid" sx={{ mb: 3 }}>
          {[
            { label: "Total Tenants", value: tenants.length, color: "#2dd4bf" },
            { label: "ERP Enabled",   value: erpEnabled,     color: "#34d399" },
            { label: "ERP Disabled",  value: erpDisabled,    color: "#f87171" },
            { label: "Active",        value: active,         color: "#60a5fa" },
          ].map(s => (
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
                    <TableCell>ERP</TableCell>
                    <TableCell>Users</TableCell>
                    <TableCell>Doctors</TableCell>
                    <TableCell>Modules</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <EmptyState>
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>⚡</Typography>
                          <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No tenants found</Typography>
                          <Typography sx={{ color: "#283848", fontSize: "13px" }}>Create tenants in the Tenants page first</Typography>
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map(t => {
                      const lic = t.licenseERP || {};
                      const planId = lic.plan || t.plan || "BASIC";
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>
                              {t.name?.en || t.name || t.id}
                            </Typography>
                            {t.name?.ar && (
                              <Typography sx={{ fontSize: "11px", color: "#9ecfca", mt: 0.25, fontFamily: "sans-serif" }}>
                                {t.name.ar}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={planId} size="small" sx={{
                              fontWeight: 600, fontSize: "10px", borderRadius: "8px", height: "24px",
                              backgroundColor: planId === "ENTERPRISE" ? "rgba(139,92,246,0.14)" : planId === "PRO" ? "rgba(59,130,246,0.14)" : "rgba(15,184,166,0.10)",
                              color: planId === "ENTERPRISE" ? "#a78bfa" : planId === "PRO" ? "#60a5fa" : "#2dd4bf",
                              border: `1px solid ${planId === "ENTERPRISE" ? "rgba(139,92,246,0.28)" : planId === "PRO" ? "rgba(59,130,246,0.28)" : "rgba(15,184,166,0.20)"}`,
                            }} />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.erpEnabled ? "Enabled" : "Disabled"}
                              size="small"
                              sx={{
                                fontWeight: 600, fontSize: "10px", borderRadius: "8px", height: "24px",
                                backgroundColor: t.erpEnabled ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                                color: t.erpEnabled ? "#34d399" : "#f87171",
                                border: `1px solid ${t.erpEnabled ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"}`,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>
                              {isUnlimited(lic.maxUsers) ? "∞" : (lic.maxUsers ?? "—")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>
                              {isUnlimited(lic.maxDoctors) ? "∞" : (lic.maxDoctors ?? "—")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                              {(lic.enabledModules || []).map(m => (
                                <Chip key={m} label={MODULE_LABELS[m]?.en || m} size="small" sx={{
                                  fontWeight: 600, fontSize: "9px", height: "20px", borderRadius: "6px",
                                  backgroundColor: "rgba(15,184,166,0.10)", color: "#2dd4bf",
                                  border: "1px solid rgba(15,184,166,0.20)",
                                }} />
                              ))}
                              {(!lic.enabledModules || lic.enabledModules.length === 0) && (
                                <Typography sx={{ color: "#4a6080", fontSize: "11px" }}>—</Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.status || "—"}
                              size="small"
                              sx={{
                                fontWeight: 600, fontSize: "10px", borderRadius: "12px", height: "28px",
                                backgroundColor: t.status === "ACTIVE" ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                                color: t.status === "ACTIVE" ? "#34d399" : "#f87171",
                                border: `1px solid ${t.status === "ACTIVE" ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"}`,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <ActionButton variant="warning" size="small" onClick={() => openConfig(t)}>
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

      <StyledDialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="md" fullWidth sx={{ "& .MuiDialog-paper": { maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle>ERP Configuration — {configTarget?.name?.en || configTarget?.id || ""}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          {configErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
              {configErrors.map((e, i) => <div key={i}>{e}</div>)}
            </Alert>
          )}

          <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "14px", mb: 2 }}>Tenant Settings</Typography>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, p: 2, backgroundColor: "#0a1428", borderRadius: "12px", border: "1px solid rgba(15,184,166,0.10)" }}>
            <Box>
              <Typography sx={{ color: "#dde6f0", fontSize: "14px", fontWeight: 600 }}>ERP Enabled</Typography>
              <Typography sx={{ color: "#4a6080", fontSize: "11px" }}>Allow this tenant to use ERP web features</Typography>
            </Box>
            <Switch
              checked={configForm.erpEnabled}
              onChange={e => setConfigForm(p => ({ ...p, erpEnabled: e.target.checked }))}
              sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#0fb8a6" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "rgba(15,184,166,0.40)" }, "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.10)" } }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Tenant Status</InputLabel>
              <StyledSelect label="Tenant Status" value={configForm.status} onChange={e => setConfigForm(p => ({ ...p, status: e.target.value }))}>
                <MenuItem value="ACTIVE" sx={{ backgroundColor: "#0f1e36", color: "#34d399" }}>ACTIVE</MenuItem>
                <MenuItem value="INACTIVE" sx={{ backgroundColor: "#0f1e36", color: "#f87171" }}>INACTIVE</MenuItem>
              </StyledSelect>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>License Status</InputLabel>
              <StyledSelect label="License Status" value={configForm.licenseStatus} onChange={e => setConfigForm(p => ({ ...p, licenseStatus: e.target.value }))}>
                <MenuItem value="ACTIVE" sx={{ backgroundColor: "#0f1e36", color: "#34d399" }}>ACTIVE</MenuItem>
                <MenuItem value="INACTIVE" sx={{ backgroundColor: "#0f1e36", color: "#f87171" }}>INACTIVE</MenuItem>
                <MenuItem value="EXPIRED" sx={{ backgroundColor: "#0f1e36", color: "#ef4444" }}>EXPIRED</MenuItem>
              </StyledSelect>
            </FormControl>
          </Box>

          <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "14px", mb: 2, mt: 1 }}>Plan & Limits</Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={configForm.plan} onChange={e => handlePlanChange(e.target.value)}>
              {PLAN_KEYS.map(p => (
                <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
                  {p} — {PLANS[p].maxUsers === -1 ? "Unlimited users" : `${PLANS[p].maxUsers} users`}, {PLANS[p].maxDoctors === -1 ? "unlimited doctors" : `${PLANS[p].maxDoctors} doctors`}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 1 }}>
            <StyledField
              fullWidth label="Max Users" margin="normal"
              type="number"
              value={configForm.maxUsers}
              onChange={e => setConfigForm(p => ({ ...p, maxUsers: e.target.value === "" ? "" : Number(e.target.value) }))}
              disabled={configForm.plan === "ENTERPRISE"}
              helperText={configForm.plan === "ENTERPRISE" ? "Unlimited for Enterprise" : "Override plan default"}
            />
            <StyledField
              fullWidth label="Max Doctors" margin="normal"
              type="number"
              value={configForm.maxDoctors}
              onChange={e => setConfigForm(p => ({ ...p, maxDoctors: e.target.value === "" ? "" : Number(e.target.value) }))}
              disabled={configForm.plan === "ENTERPRISE"}
              helperText={configForm.plan === "ENTERPRISE" ? "Unlimited for Enterprise" : "Override plan default"}
            />
          </Box>

          <StyledField
            fullWidth label="License Expiry (ERP)" margin="normal"
            type="date"
            value={configForm.expiresAt}
            onChange={e => setConfigForm(p => ({ ...p, expiresAt: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            helperText="ERP-specific expiry (separate from license expiryDate)"
          />

          <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "14px", mb: 1, mt: 2 }}>Enabled Modules</Typography>
          <Box sx={{ p: 2, backgroundColor: "#0a1428", borderRadius: "12px", border: "1px solid rgba(15,184,166,0.10)" }}>
            <FormGroup row>
              {ALL_MODULES.map(m => (
                <FormControlLabel
                  key={m}
                  control={
                    <Checkbox
                      checked={configForm.enabledModules.includes(m) || configForm.enabledModules.includes("*")}
                      onChange={e => {
                        if (configForm.plan === "ENTERPRISE" && configForm.enabledModules.includes("*")) return;
                        setConfigForm(p => ({
                          ...p,
                          enabledModules: e.target.checked
                            ? [...p.enabledModules, m]
                            : p.enabledModules.filter(x => x !== m),
                        }));
                      }}
                      disabled={configForm.plan === "ENTERPRISE" && configForm.enabledModules.includes("*")}
                      sx={{ color: "#4a6080", "&.Mui-checked": { color: "#0fb8a6" } }}
                    />
                  }
                  label={<Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>{MODULE_LABELS[m]?.en || m}</Typography>}
                  sx={{ minWidth: "140px", mb: 0.5 }}
                />
              ))}
            </FormGroup>
            {configForm.plan === "ENTERPRISE" && (
              <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 1, fontStyle: "italic" }}>
                Enterprise plan includes all modules by default.
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setConfigOpen(false)} disabled={configSaving}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleConfigSave} disabled={configSaving}>
              {configSaving ? <CircularProgress size={14} sx={{ color: "white", mr: 1 }} /> : null}
              {configSaving ? "Saving..." : "Save Configuration"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}


