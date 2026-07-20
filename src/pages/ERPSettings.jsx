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
  TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel, Button,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel, FormGroup, Switch,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, StyledTableContainer, ActionButton, StatCard, EmptyState, dialogPaperSx, dialogTitleSx, sharedFieldSx } from "./components/shared/PageShells";

const StyledSelect = styled(Select)({
  backgroundColor: "var(--bg-input)", borderRadius: "10px", color: "var(--text-secondary)", fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(28,138,126,0.18)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(28,138,126,0.35)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "var(--zy-teal-500)" },
  "& .MuiSvgIcon-root": { color: "var(--zy-slate-300)" },
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
        <CircularProgress sx={{ color: "var(--zy-teal-500)" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const erpEnabled = tenants.filter(t => t.erpEnabled).length;
  const erpDisabled = tenants.filter(t => !t.erpEnabled).length;
  const active = tenants.filter(t => t.status === "ACTIVE").length;

  return (
    <PageContainer>
      <title>ERP Settings — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,58,237,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>ERP Integration</Typography>
            <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Configure SaaS metadata for the ERP system</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            onClick={handleMigrate}
            disabled={migrating}
            sx={{
              borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px",
              background: "linear-gradient(to right, var(--zy-teal-900), var(--zy-teal-900))", color: "white",
              boxShadow: "0 4px 14px rgba(124,58,237,0.40)",
              "&:hover": { background: "linear-gradient(to right, var(--zy-teal-900), var(--zy-teal-900))", transform: "translateY(-1px)" },
              transition: "all 0.2s ease",
            }}
          >
            {migrating ? <CircularProgress size={14} sx={{ color: "white", mr: 1 }} /> : null}
            {migrating ? "Migrating..." : "Migrate ERP Fields"}
          </Button>
          <ActionButton btnVariant="primary" onClick={() => triggerERPSync().then(r => { if (!r.success) showNotification(r.message, "warning"); })}>
            Sync ERP
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)", borderRadius: "12px", "& .MuiAlert-icon": { color: "var(--danger)" } }}>
            {error}
          </Alert>
        )}

        {migrateResult && migrateResult.errors.length > 0 && (
          <Alert severity="warning" onClose={() => setMigrateResult(null)} sx={{ mb: 3, backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "var(--zy-warning)", borderRadius: "12px", "& .MuiAlert-icon": { color: "var(--zy-warning)" } }}>
            Migration errors: {migrateResult.errors.join("; ")}
          </Alert>
        )}

        <Box className="stats-grid" sx={{ mb: 3 }}>
          {[
            { label: "Total Tenants", value: tenants.length, color: "var(--accent-light)" },
            { label: "ERP Enabled",   value: erpEnabled,     color: "var(--success)" },
            { label: "ERP Disabled",  value: erpDisabled,    color: "var(--danger)" },
            { label: "Active",        value: active,         color: "var(--zy-info)" },
          ].map(s => (
            <StatCard key={s.label}>
              <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>{s.label}</Typography>
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
                          <Typography sx={{ color: "var(--zy-slate-300)", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No tenants found</Typography>
                          <Typography sx={{ color: "var(--zy-slate-700)", fontSize: "13px" }}>Create tenants in the Tenants page first</Typography>
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
                            <Typography sx={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {t.name?.en || t.name || t.id}
                            </Typography>
                            {t.name?.ar && (
                              <Typography sx={{ fontSize: "11px", color: "var(--zy-teal-100)", mt: 0.25, fontFamily: "sans-serif" }}>
                                {t.name.ar}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={planId} size="small" sx={{
                              fontWeight: 600, fontSize: "10px", borderRadius: "8px", height: "24px",
                              backgroundColor: planId === "ENTERPRISE" ? "rgba(139,92,246,0.14)" : planId === "PRO" ? "rgba(59,130,246,0.14)" : "rgba(28,138,126,0.10)",
                              color: planId === "ENTERPRISE" ? "var(--zy-teal-100)" : planId === "PRO" ? "var(--zy-info)" : "var(--accent-light)",
                              border: `1px solid ${planId === "ENTERPRISE" ? "rgba(139,92,246,0.28)" : planId === "PRO" ? "rgba(59,130,246,0.28)" : "rgba(28,138,126,0.20)"}`,
                            }} />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.erpEnabled ? "Enabled" : "Disabled"}
                              size="small"
                              sx={{
                                fontWeight: 600, fontSize: "10px", borderRadius: "8px", height: "24px",
                                backgroundColor: t.erpEnabled ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                                color: t.erpEnabled ? "var(--success)" : "var(--danger)",
                                border: `1px solid ${t.erpEnabled ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"}`,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                              {isUnlimited(lic.maxUsers) ? "∞" : (lic.maxUsers ?? "—")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                              {isUnlimited(lic.maxDoctors) ? "∞" : (lic.maxDoctors ?? "—")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                              {(lic.enabledModules || []).map(m => (
                                <Chip key={m} label={MODULE_LABELS[m]?.en || m} size="small" sx={{
                                  fontWeight: 600, fontSize: "9px", height: "20px", borderRadius: "6px",
                                  backgroundColor: "rgba(28,138,126,0.10)", color: "var(--accent-light)",
                                  border: "1px solid rgba(28,138,126,0.20)",
                                }} />
                              ))}
                              {(!lic.enabledModules || lic.enabledModules.length === 0) && (
                                <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px" }}>—</Typography>
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
                                color: t.status === "ACTIVE" ? "var(--success)" : "var(--danger)",
                                border: `1px solid ${t.status === "ACTIVE" ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"}`,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <ActionButton btnVariant="warning" size="small" onClick={() => openConfig(t)}>
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

      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { ...dialogPaperSx, maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle sx={dialogTitleSx}>ERP Configuration — {configTarget?.name?.en || configTarget?.id || ""}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "var(--bg-secondary)" }}>
          {configErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)", borderRadius: "12px", "& .MuiAlert-icon": { color: "var(--danger)" } }}>
              {configErrors.map((e, i) => <div key={i}>{e}</div>)}
            </Alert>
          )}

          <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px", mb: 2 }}>Tenant Settings</Typography>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, p: 2, backgroundColor: "var(--bg-primary)", borderRadius: "12px", border: "1px solid rgba(28,138,126,0.10)" }}>
            <Box>
              <Typography sx={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600 }}>ERP Enabled</Typography>
              <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px" }}>Allow this tenant to use ERP web features</Typography>
            </Box>
            <Switch
              checked={configForm.erpEnabled}
              onChange={e => setConfigForm(p => ({ ...p, erpEnabled: e.target.checked }))}
              sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "var(--zy-teal-500)" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "rgba(28,138,126,0.40)" }, "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.10)" } }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "var(--text-dark)", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "var(--zy-teal-500)" } }}>Tenant Status</InputLabel>
              <StyledSelect label="Tenant Status" value={configForm.status} onChange={e => setConfigForm(p => ({ ...p, status: e.target.value }))}>
                <MenuItem value="ACTIVE" sx={{ backgroundColor: "var(--bg-input)", color: "var(--success)" }}>ACTIVE</MenuItem>
                <MenuItem value="INACTIVE" sx={{ backgroundColor: "var(--bg-input)", color: "var(--danger)" }}>INACTIVE</MenuItem>
              </StyledSelect>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "var(--text-dark)", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "var(--zy-teal-500)" } }}>License Status</InputLabel>
              <StyledSelect label="License Status" value={configForm.licenseStatus} onChange={e => setConfigForm(p => ({ ...p, licenseStatus: e.target.value }))}>
                <MenuItem value="ACTIVE" sx={{ backgroundColor: "var(--bg-input)", color: "var(--success)" }}>ACTIVE</MenuItem>
                <MenuItem value="INACTIVE" sx={{ backgroundColor: "var(--bg-input)", color: "var(--danger)" }}>INACTIVE</MenuItem>
                <MenuItem value="EXPIRED" sx={{ backgroundColor: "var(--bg-input)", color: "var(--zy-danger)" }}>EXPIRED</MenuItem>
              </StyledSelect>
            </FormControl>
          </Box>

          <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px", mb: 2, mt: 1 }}>Plan & Limits</Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "var(--text-dark)", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "var(--zy-teal-500)" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={configForm.plan} onChange={e => handlePlanChange(e.target.value)}>
              {PLAN_KEYS.map(p => (
                <MenuItem key={p} value={p} sx={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  {p} — {PLANS[p].maxUsers === -1 ? "Unlimited users" : `${PLANS[p].maxUsers} users`}, {PLANS[p].maxDoctors === -1 ? "unlimited doctors" : `${PLANS[p].maxDoctors} doctors`}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 1 }}>
            <TextField
              fullWidth label="Max Users" margin="normal"
              type="number"
              value={configForm.maxUsers}
              onChange={e => setConfigForm(p => ({ ...p, maxUsers: e.target.value === "" ? "" : Number(e.target.value) }))}
              disabled={configForm.plan === "ENTERPRISE"}
              helperText={configForm.plan === "ENTERPRISE" ? "Unlimited for Enterprise" : "Override plan default"}
              sx={sharedFieldSx}
            />
            <TextField
              fullWidth label="Max Doctors" margin="normal"
              type="number"
              value={configForm.maxDoctors}
              onChange={e => setConfigForm(p => ({ ...p, maxDoctors: e.target.value === "" ? "" : Number(e.target.value) }))}
              disabled={configForm.plan === "ENTERPRISE"}
              helperText={configForm.plan === "ENTERPRISE" ? "Unlimited for Enterprise" : "Override plan default"}
              sx={sharedFieldSx}
            />
          </Box>

          <TextField
            fullWidth label="License Expiry (ERP)" margin="normal"
            type="date"
            value={configForm.expiresAt}
            onChange={e => setConfigForm(p => ({ ...p, expiresAt: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            helperText="ERP-specific expiry (separate from license expiryDate)"
            sx={sharedFieldSx}
          />

          <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px", mb: 1, mt: 2 }}>Enabled Modules</Typography>
          <Box sx={{ p: 2, backgroundColor: "var(--bg-primary)", borderRadius: "12px", border: "1px solid rgba(28,138,126,0.10)" }}>
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
                      sx={{ color: "var(--zy-slate-300)", "&.Mui-checked": { color: "var(--zy-teal-500)" } }}
                    />
                  }
                  label={<Typography sx={{ color: "var(--text-secondary)", fontSize: "13px" }}>{MODULE_LABELS[m]?.en || m}</Typography>}
                  sx={{ minWidth: "140px", mb: 0.5 }}
                />
              ))}
            </FormGroup>
            {configForm.plan === "ENTERPRISE" && (
              <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", mt: 1, fontStyle: "italic" }}>
                Enterprise plan includes all modules by default.
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setConfigOpen(false)} disabled={configSaving}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleConfigSave} disabled={configSaving}>
              {configSaving ? <CircularProgress size={14} sx={{ color: "white", mr: 1 }} /> : null}
              {configSaving ? "Saving..." : "Save Configuration"}
            </ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
