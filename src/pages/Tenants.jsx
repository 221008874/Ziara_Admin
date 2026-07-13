import { useState, useEffect } from "react";
import {
  getAllTenants,
  createTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
  triggerERPSync,
  getAllLicenses,
  getAllDoctors,
} from "../services/firestoreService";
import { createBilingual, getLang, isBilingual, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { validateEgyptMobile } from "../lib/validation";
import { normalizeError } from "../lib/errorHandler";
import { useNotification } from "../contexts/NotificationContext";
import { useSidebar } from "../App";
import { useNavigate } from "react-router-dom";
import { Hamburger } from "../components/Sidebar";
import { Skeleton } from "@mui/material";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, Checkbox, FormControlLabel, FormGroup,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, StyledTableContainer, ActionButton, StatCard, EmptyState, dialogPaperSx, dialogTitleSx, sharedFieldSx, ClickableStatus } from "./components/shared/PageShells";

const PlanBadge = styled(Chip, { shouldForwardProp: (prop) => prop !== "plan" })(({ plan }) => ({
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

const PLAN_LIMITS = {
  BASIC: "5 users, 2 doctors",
  PRO: "20 users, 10 doctors",
  ENTERPRISE: "Unlimited users, unlimited doctors",
};

const FeatureChip = styled(Chip, { shouldForwardProp: (prop) => prop !== "feature" })(({ feature }) => ({
  borderRadius: "6px", fontSize: "10px", fontWeight: 600, height: "22px",
  ...(feature === "erp" ? {
    backgroundColor: "rgba(59,130,246,0.14)", color: "#60a5fa",
    border: "1px solid rgba(59,130,246,0.28)",
  } : {
    backgroundColor: "rgba(15,184,166,0.10)", color: "#2dd4bf",
    border: "1px solid rgba(15,184,166,0.20)",
  }),
}));

// ─── Blank form state ─────────────────────────────────────────────────────────

const BLANK = {
  name: createBilingual(),
  contactEmail: "",
  contactPhone: "",
  address: createBilingual(),
  city: createBilingual(),
  description: createBilingual(),
  plan: "BASIC",
  providerType: "CLINIC",
  licenseKey: "",
  expiryDate: "",
  features: ["desktop"],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Tenants() {
  const { toggle } = useSidebar();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [tenants, setTenants]         = useState([]);
  const [doctors, setDoctors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [formData, setFormData]       = useState(BLANK);
  const [editData, setEditData]       = useState(BLANK);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [allLicenses, setAllLicenses] = useState([]);

  const loadAvailableLicenses = async () => {
    try {
      const data = await getAllLicenses();
      setAllLicenses(data);
    } catch (e) {
      debug.error('Tenants.loadLicenses', e);
    }
  };

  const load = async () => {
    debug.action('Tenants', 'Loading tenants...');
    try {
      setLoading(true); setError(null);
      const [data, docData] = await Promise.all([getAllTenants(), getAllDoctors()]);
      setTenants(data);
      setDoctors(docData);
      debug.action('Tenants', `Loaded ${data.length} tenants, ${docData.length} doctors`);
    } catch (e) {
      debug.error('Tenants.load', e);
      setError(normalizeError(e).message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    debug.component('Tenants', 'Mounted');
    load();
    return () => debug.component('Tenants', 'Unmounted');
  }, []);

  const handleCreate = async () => {
    if (!formData.name.en) { setError("Tenant name (English) is required"); return; }
    if (!formData.licenseKey) { setError("License key is required"); return; }
    const phoneErr = validateEgyptMobile(formData.contactPhone);
    if (formData.contactPhone && phoneErr) { setError(`Contact Phone: ${phoneErr}`); return; }
    debug.action('Tenants', 'Creating tenant', { name: getLang(formData.name) });
    setActionLoading('create');
    try {
      setError(null);
      await createTenant(formData);
      debug.action('Tenants', 'Tenant created');
      showNotification("Tenant created successfully", "success");
      triggerERPSync().then(r => {
        if (!r.success) showNotification(r.message, "warning");
      });
      setCreateOpen(false);
      setFormData(BLANK);
      load();
    } catch (e) {
      debug.error('Tenants.create', e);
      setError(normalizeError(e).message);
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (t) => {
    debug.action('Tenants', `Opening edit: ${t.id}`);
    setEditTarget(t);
    setEditData({
      name: isBilingual(t.name) ? t.name : createBilingual(t.name || ""),
      contactEmail: t.contactEmail || "",
      contactPhone: t.contactPhone || "",
      address: isBilingual(t.address) ? t.address : createBilingual(t.address || ""),
      city: isBilingual(t.city) ? t.city : createBilingual(t.city || ""),
      description: isBilingual(t.description) ? t.description : createBilingual(t.description || ""),
      plan: t.plan || "BASIC",
      providerType: t.providerType || "CLINIC",
      licenseKey: t.licenseKey || "",
      expiryDate: t.expiryDate || "",
      features: t.features || ["desktop"],
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget || !editData.name.en) return;
    const phoneErr = validateEgyptMobile(editData.contactPhone);
    if (editData.contactPhone && phoneErr) { setError(`Contact Phone: ${phoneErr}`); return; }
    debug.action('Tenants', `Updating tenant: ${editTarget.id}`);
    setActionLoading('edit');
    try {
      setError(null);
      await updateTenant(editTarget.id, editData);
      debug.action('Tenants', `Tenant updated: ${editTarget.id}`);
      showNotification("Tenant updated successfully", "success");
      triggerERPSync().then(r => {
        if (!r.success) showNotification(r.message, "warning");
      });
      setEditOpen(false);
      load();
    } catch (e) {
      debug.error('Tenants.update', e);
      setError(normalizeError(e).message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (id, current) => {
    const next = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (current === "PENDING") return;
    debug.action('Tenants', `Toggling status: ${id} (${current} -> ${next})`);
    try {
      await updateTenantStatus(id, next);
      debug.action('Tenants', `Status updated: ${id}`);
      showNotification(`Tenant ${next === "ACTIVE" ? "activated" : "suspended"}`, "success");
      load();
    } catch (e) {
      setError(normalizeError(e).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    debug.action('Tenants', `Deleting tenant: ${deleteConfirm.id}`);
    setActionLoading('delete');
    try {
      await deleteTenant(deleteConfirm.id);
      debug.action('Tenants', `Tenant deleted: ${deleteConfirm.id}`);
      showNotification("Tenant deleted", "success");
      setDeleteConfirm(null);
      load();
    } catch (e) {
      debug.error('Tenants.delete', e);
      setError(normalizeError(e).message);
    } finally {
      setActionLoading(null);
    }
  };

  const active   = tenants.filter(t => t.status === "ACTIVE").length;
  const pending  = tenants.filter(t => t.status === "PENDING").length;
  const suspended = tenants.filter(t => t.status === "SUSPENDED" || t.status === "INACTIVE").length;
  const doctorCountByTenant = {};
  doctors.forEach(d => {
    if (d.tenantId && d.status === "ACTIVE") doctorCountByTenant[d.tenantId] = (doctorCountByTenant[d.tenantId] || 0) + 1;
  });

  const getPlanDoctorLimit = (plan) => ({ BASIC: 2, PRO: 10, ENTERPRISE: Infinity }[plan] || Infinity);

  if (loading) {
    return (
      <PageContainer>
        <TopBar>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Hamburger onClick={toggle} />
            <Skeleton sx={{ bgcolor: "#0c1a30", width: 180 }} />
          </Box>
        </TopBar>
        <ContentWrapper>
          <Box className="stats-grid" sx={{ mb: 3, display: "flex", gap: 2 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} sx={{ bgcolor: "#0c1a30", borderRadius: "14px", height: 80, flex: 1 }} />)}
          </Box>
          <Skeleton sx={{ bgcolor: "#0c1a30", borderRadius: "16px", height: 400 }} />
        </ContentWrapper>
      </PageContainer>
    );
  }

  const field = (label, key, obj, set, opts = {}) => (
    <TextField
      fullWidth label={label} margin="normal"
      value={obj[key]}
      onChange={e => set(prev => ({ ...prev, [key]: e.target.value }))}
      sx={sharedFieldSx}
      {...opts}
    />
  );

  return (
      <PageContainer>
      <title>Tenants — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Tenant Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Manage clinics & organizations</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <ActionButton btnVariant="secondary" size="small" onClick={async () => {
            const r = await triggerERPSync();
            showNotification(r.success ? "Community sync triggered" : r.message, r.success ? "success" : "warning");
          }}>
            Sync from Community
          </ActionButton>
          <ActionButton btnVariant="primary" onClick={() => { setCreateOpen(true); loadAvailableLicenses(); }} sx={{ fontSize: { xs: "11px", sm: "12px" }, px: { xs: 2, sm: 3 } }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>+ </Box>New Tenant
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}

        <Box className="stats-grid" sx={{ mb: 3 }}>
          {[
            { label: "Total Tenants", value: tenants.length, color: "#2dd4bf" },
            { label: "Active",        value: active,         color: "#34d399" },
            { label: "Pending",       value: pending,        color: "#f59e0b" },
            { label: "Suspended",     value: suspended,      color: "#f87171" },
            { label: "Pro Plan",      value: tenants.filter(t => t.plan === "PRO").length, color: "#60a5fa" },
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
                    <TableCell>Tenant Name</TableCell>
                    <TableCell>License Key</TableCell>
                    <TableCell>Contact Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Features</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState>
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>👥</Typography>
                          <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No tenants yet</Typography>
                          <Typography sx={{ color: "#283848", fontSize: "13px" }}>Click "+ New Tenant" to onboard your first clinic</Typography>
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>
                            {getLang(t.name)}
                          </Typography>
                          {getLang(t.name, "ar") && getLang(t.name, "ar") !== getLang(t.name, "en") && (
                            <Typography sx={{ fontSize: "12px", color: "#9ecfca", mt: 0.25, fontFamily: "sans-serif" }}>
                              {getLang(t.name, "ar")}
                            </Typography>
                          )}
                          {t.address && <Typography sx={{ fontSize: "11px", color: "#4a6080", mt: 0.25 }}>{getLang(t.address) || "—"}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", flexDirection: "column" }}>
                            <Typography sx={{ color: t.licenseKey ? "#34d399" : "#4a6080", fontSize: "13px", fontFamily: "monospace" }}>
                              {t.licenseKey || "—"}
                            </Typography>
                            {t.expiryDate && (
                              <Typography sx={{ fontSize: "10px", color: "#4a6080", fontFamily: "monospace" }}>
                                expires {typeof t.expiryDate === "string" ? t.expiryDate : t.expiryDate?.toDate?.().toLocaleDateString() || ""}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{t.contactEmail || "—"}</TableCell>
                        <TableCell>{t.contactPhone || "—"}</TableCell>
                        <TableCell>
                          <PlanBadge plan={t.plan} label={t.plan || "BASIC"} size="small" />
                          {(() => {
                            const used = doctorCountByTenant[t.id] || 0;
                            const limit = getPlanDoctorLimit(t.plan);
                            const isOver = limit !== Infinity && used > limit;
                            return (
                              <Typography sx={{ fontSize: "10px", color: isOver ? "#f87171" : "#4a6080", mt: 0.25 }}>
                                {used}/{limit === Infinity ? "∞" : limit} doctors
                              </Typography>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            {(t.features || ["desktop"]).map(f => (
                              <FeatureChip key={f} feature={f} label={f === "erp" ? "ERP" : "Desktop"} size="small" />
                            ))}
                            {(!t.features || t.features.length === 0) && <Typography sx={{ color: "#4a6080", fontSize: "11px" }}>—</Typography>}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <ClickableStatus
                            status={t.status}
                            onToggle={() => toggleStatus(t.id, t.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: "12px", color: "#4a6080" }}>
                            {t.createdAt?.toDate?.().toLocaleDateString() || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                            <ActionButton btnVariant="primary" size="small" onClick={() => navigate(`/doctors?tenantId=${t.id}`)}>Add Doctor</ActionButton>
                            <ActionButton btnVariant="warning" size="small" onClick={() => openEdit(t)}>Edit</ActionButton>
                            <ActionButton btnVariant="danger" size="small" onClick={() => setDeleteConfirm(t)}>Delete</ActionButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </StyledTableContainer>
          </div>
        </GlassPanel>
      </ContentWrapper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { ...dialogPaperSx, maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle sx={dialogTitleSx}>Create New Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="اسم العيادة / المنظمة" value={formData.name} onChange={v => setFormData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="العنوان" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={formData.city} onChange={v => setFormData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="الوصف" value={formData.description} onChange={v => setFormData(p => ({ ...p, description: v }))} />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>License Key *</InputLabel>
            <Select
              label="License Key *"
              value={formData.licenseKey}
              onChange={e => {
                const key = e.target.value;
                const lic = allLicenses.find(l => l.licenseKey === key);
                setFormData(p => ({
                  ...p,
                  licenseKey: key,
                  expiryDate: lic?.expiryDate || p.expiryDate,
                }));
              }}
              sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}
            >
              <MenuItem value="" sx={{ backgroundColor: "#0f1e36", color: "#4a6080", fontStyle: "italic" }}>
                — Select a license —
              </MenuItem>
              {allLicenses
                .filter(l => !tenants.some(t => t.licenseKey === l.licenseKey))
                .map(l => (
                  <MenuItem key={l.licenseKey} value={l.licenseKey} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 2 }}>
                      <span style={{ fontFamily: "monospace" }}>{l.licenseKey}</span>
                      <span style={{ color: "#4a6080", fontSize: "12px" }}>
                        {l.status} {l.expiryDate ? `· ${l.expiryDate}` : ""}
                      </span>
                    </Box>
                  </MenuItem>
                ))}
              {allLicenses.length === 0 && (
                <MenuItem disabled sx={{ backgroundColor: "#0f1e36", color: "#4a6080" }}>
                  No licenses available — create one in Licenses first
                </MenuItem>
              )}
            </Select>
          </FormControl>
          {field("Contact Email", "contactEmail", formData, setFormData, { type: "email" })}
          {field("Contact Phone", "contactPhone", formData, setFormData, { placeholder: "010xxxxxxxx" })}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <Select label="Plan" value={formData.plan} onChange={e => setFormData(p => ({ ...p, plan: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </Select>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5, ml: 1 }}>
              {formData.plan}: {PLAN_LIMITS[formData.plan]}
            </Typography>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Provider Type</InputLabel>
            <Select label="Provider Type" value={formData.providerType} onChange={e => setFormData(p => ({ ...p, providerType: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              <MenuItem value="CLINIC" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>👥 Clinic (Multi-Doctor)</MenuItem>
              <MenuItem value="INDIVIDUAL_DOCTOR" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>👨‍⚕️ Individual Doctor</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <Typography sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, mb: 1 }}>Features</Typography>
            <FormGroup row>
              <FormControlLabel
                control={<Checkbox checked={formData.features?.includes('desktop') || false} onChange={e => { const a = formData.features || []; setFormData(p => ({ ...p, features: e.target.checked ? [...a, 'desktop'] : a.filter(x => x !== 'desktop') })); }} sx={{ color: '#4a6080', '&.Mui-checked': { color: '#0fb8a6' } }} />}
                label={<Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>Desktop App</Typography>}
              />
              <FormControlLabel
                control={<Checkbox checked={formData.features?.includes('erp') || false} onChange={e => { const a = formData.features || []; setFormData(p => ({ ...p, features: e.target.checked ? [...a, 'erp'] : a.filter(x => x !== 'erp') })); }} sx={{ color: '#4a6080', '&.Mui-checked': { color: '#0fb8a6' } }} />}
                label={<Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>ERP Web</Typography>}
              />
            </FormGroup>
          </FormControl>
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => { setCreateOpen(false); setError(null); }} disabled={actionLoading === 'create'}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleCreate} disabled={actionLoading === 'create'}>{actionLoading === 'create' ? 'Creating...' : 'Create Tenant'}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { ...dialogPaperSx, maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle sx={dialogTitleSx}>Edit Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="اسم العيادة / المنظمة" value={editData.name} onChange={v => setEditData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="العنوان" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={editData.city} onChange={v => setEditData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="الوصف" value={editData.description} onChange={v => setEditData(p => ({ ...p, description: v }))} />
          {field("License Key", "licenseKey", editData, setEditData, { disabled: true })}
          {field("Expiry Date", "expiryDate", editData, setEditData, { type: "date", InputLabelProps: { shrink: true } })}
          {field("Contact Email", "contactEmail", editData, setEditData, { type: "email" })}
          {field("Contact Phone", "contactPhone", editData, setEditData)}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <Select label="Plan" value={editData.plan} onChange={e => setEditData(p => ({ ...p, plan: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </Select>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5, ml: 1 }}>
              {editData.plan}: {PLAN_LIMITS[editData.plan]}
            </Typography>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Provider Type</InputLabel>
            <Select label="Provider Type" value={editData.providerType} onChange={e => setEditData(p => ({ ...p, providerType: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              <MenuItem value="CLINIC" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>👥 Clinic (Multi-Doctor)</MenuItem>
              <MenuItem value="INDIVIDUAL_DOCTOR" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>👨‍⚕️ Individual Doctor</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <Typography sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, mb: 1 }}>Features</Typography>
            <FormGroup row>
              <FormControlLabel
                control={<Checkbox checked={editData.features?.includes('desktop') || false} onChange={e => { const a = editData.features || []; setEditData(p => ({ ...p, features: e.target.checked ? [...a, 'desktop'] : a.filter(x => x !== 'desktop') })); }} sx={{ color: '#4a6080', '&.Mui-checked': { color: '#0fb8a6' } }} />}
                label={<Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>Desktop App</Typography>}
              />
              <FormControlLabel
                control={<Checkbox checked={editData.features?.includes('erp') || false} onChange={e => { const a = editData.features || []; setEditData(p => ({ ...p, features: e.target.checked ? [...a, 'erp'] : a.filter(x => x !== 'erp') })); }} sx={{ color: '#4a6080', '&.Mui-checked': { color: '#0fb8a6' } }} />}
                label={<Typography sx={{ color: "#dde6f0", fontSize: "13px" }}>ERP Web</Typography>}
              />
            </FormGroup>
          </FormControl>
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setEditOpen(false)} disabled={actionLoading === 'edit'}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleEdit} disabled={actionLoading === 'edit'}>{actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Confirm Delete</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 1 }}>
            Delete <strong style={{ color: "#f87171" }}>{getLang(deleteConfirm?.name)}</strong>?
          </Typography>
          <Typography sx={{ color: "#4a6080", fontSize: "13px", mb: 3 }}>
            This action cannot be undone. All associated data will be permanently removed.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setDeleteConfirm(null)} disabled={actionLoading === 'delete'}>Cancel</ActionButton>
            <ActionButton btnVariant="danger" onClick={handleDelete} disabled={actionLoading === 'delete'}>{actionLoading === 'delete' ? 'Deleting...' : 'Delete'}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
