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
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, Checkbox, FormControlLabel, FormGroup,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// â”€â”€â”€ Design Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: "#04091a",
  marginLeft: 0,
  position: "relative",
  overflow: "hidden",
  transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: {
    marginLeft: "240px",
  },
}));

const TopBar = styled(Box)({
  background: "linear-gradient(to right, #090f22, #0c1830)",
  borderBottom: "1px solid rgba(15,184,166,0.12)",
  padding: "16px 28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.50)",
  position: "relative",
  "&::after": {
    content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
    background: "linear-gradient(to right, transparent, #0fb8a6 35%, #3b82f6 65%, transparent)",
    opacity: 0.45,
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

const StatusBadge = styled(Chip, { shouldForwardProp: (prop) => prop !== "status" })(({ status }) => ({
  borderRadius: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", height: "28px", minWidth: "80px",
  cursor: "pointer",
  ...(status === "ACTIVE" ? {
    backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399",
    border: "1px solid rgba(52,211,153,0.28)", boxShadow: "0 0 8px rgba(52,211,153,0.15)",
  } : {
    backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171",
    border: "1px solid rgba(248,113,113,0.28)", boxShadow: "0 0 8px rgba(248,113,113,0.15)",
  }),
  "&:hover": { filter: "brightness(1.2)" },
}));

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

// â”€â”€â”€ Blank form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    debug.action('Tenants', `Toggling status: ${id} (${current} -> ${current === "ACTIVE" ? "INACTIVE" : "ACTIVE"})`);
    try {
      await updateTenantStatus(id, current === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      debug.action('Tenants', `Status updated: ${id}`);
      showNotification("Status updated", "success");
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
  const inactive = tenants.filter(t => t.status === "INACTIVE").length;
  const doctorCountByTenant = {};
  doctors.forEach(d => {
    if (d.tenantId && d.status === "ACTIVE") doctorCountByTenant[d.tenantId] = (doctorCountByTenant[d.tenantId] || 0) + 1;
  });

  const getPlanDoctorLimit = (plan) => ({ BASIC: 2, PRO: 10, ENTERPRISE: Infinity }[plan] || Infinity);

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const field = (label, key, obj, set, opts = {}) => (
    <StyledField
      fullWidth label={label} margin="normal"
      value={obj[key]}
      onChange={e => set(prev => ({ ...prev, [key]: e.target.value }))}
      {...opts}
    />
  );

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
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Tenant Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Manage clinics & organizations</Typography>
          </Box>
        </Box>
        <ActionButton variant="primary" onClick={() => { setCreateOpen(true); loadAvailableLicenses(); }} sx={{ fontSize: { xs: "11px", sm: "12px" }, px: { xs: 2, sm: 3 } }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>+ </Box>New Tenant
        </ActionButton>
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
            { label: "Inactive",      value: inactive,       color: "#f87171" },
            { label: "Pro",           value: tenants.filter(t => t.plan === "PRO").length,           color: "#60a5fa" },
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
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>ًںڈ¥</Typography>
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
                          {t.address && <Typography sx={{ fontSize: "11px", color: "#4a6080", mt: 0.25 }}>{getLang(t.address) || "â€”"}</Typography>}
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
                        <TableCell>{t.contactEmail || "â€”"}</TableCell>
                        <TableCell>{t.contactPhone || "â€”"}</TableCell>
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
                          <StatusBadge
                            status={t.status}
                            label={t.status}
                            size="small"
                            onClick={() => toggleStatus(t.id, t.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: "12px", color: "#4a6080" }}>
                            {t.createdAt?.toDate?.().toLocaleDateString() || "â€”"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                            <ActionButton variant="primary" size="small" onClick={() => navigate(`/doctors?tenantId=${t.id}`)}>Add Doctor</ActionButton>
                            <ActionButton variant="warning" size="small" onClick={() => openEdit(t)}>Edit</ActionButton>
                            <ActionButton variant="danger" size="small" onClick={() => setDeleteConfirm(t)}>Delete</ActionButton>
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

      <StyledDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth fullScreen={false} sx={{ "& .MuiDialog-paper": { maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle>Create New Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="ط§ط³ظ… ط§ظ„ط¹ظٹط§ط¯ط© / ط§ظ„ظ…ظ†ط¸ظ…ط©" value={formData.name} onChange={v => setFormData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="ط§ظ„ط¹ظ†ظˆط§ظ†" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="ط§ظ„ظ…ط¯ظٹظ†ط©" value={formData.city} onChange={v => setFormData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="ط§ظ„ظˆطµظپ" value={formData.description} onChange={v => setFormData(p => ({ ...p, description: v }))} />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>License Key *</InputLabel>
            <StyledSelect
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
            </StyledSelect>
          </FormControl>
          {field("Contact Email", "contactEmail", formData, setFormData, { type: "email" })}
          {field("Contact Phone", "contactPhone", formData, setFormData, { placeholder: "010xxxxxxxx" })}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={formData.plan} onChange={e => setFormData(p => ({ ...p, plan: e.target.value }))}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </StyledSelect>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5, ml: 1 }}>
              {formData.plan}: {PLAN_LIMITS[formData.plan]}
            </Typography>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Provider Type</InputLabel>
            <StyledSelect label="Provider Type" value={formData.providerType} onChange={e => setFormData(p => ({ ...p, providerType: e.target.value }))}>
              <MenuItem value="CLINIC" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>ًںڈ¥ Clinic (Multi-Doctor)</MenuItem>
              <MenuItem value="INDIVIDUAL_DOCTOR" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>ًں‘¨â€چâڑ•ï¸ڈ Individual Doctor</MenuItem>
            </StyledSelect>
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
            <ActionButton variant="secondary" onClick={() => { setCreateOpen(false); setError(null); }} disabled={actionLoading === 'create'}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleCreate} disabled={actionLoading === 'create'}>{actionLoading === 'create' ? 'Creating...' : 'Create Tenant'}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      <StyledDialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth sx={{ "& .MuiDialog-paper": { maxHeight: { xs: "100vh", sm: "none" } } }}>
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="ط§ط³ظ… ط§ظ„ط¹ظٹط§ط¯ط© / ط§ظ„ظ…ظ†ط¸ظ…ط©" value={editData.name} onChange={v => setEditData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="ط§ظ„ط¹ظ†ظˆط§ظ†" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="ط§ظ„ظ…ط¯ظٹظ†ط©" value={editData.city} onChange={v => setEditData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="ط§ظ„ظˆطµظپ" value={editData.description} onChange={v => setEditData(p => ({ ...p, description: v }))} />
          {field("License Key", "licenseKey", editData, setEditData, { disabled: true })}
          {field("Expiry Date", "expiryDate", editData, setEditData, { type: "date", InputLabelProps: { shrink: true } })}
          {field("Contact Email", "contactEmail", editData, setEditData, { type: "email" })}
          {field("Contact Phone", "contactPhone", editData, setEditData)}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={editData.plan} onChange={e => setEditData(p => ({ ...p, plan: e.target.value }))}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </StyledSelect>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5, ml: 1 }}>
              {editData.plan}: {PLAN_LIMITS[editData.plan]}
            </Typography>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Provider Type</InputLabel>
            <StyledSelect label="Provider Type" value={editData.providerType} onChange={e => setEditData(p => ({ ...p, providerType: e.target.value }))}>
              <MenuItem value="CLINIC" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>ًںڈ¥ Clinic (Multi-Doctor)</MenuItem>
              <MenuItem value="INDIVIDUAL_DOCTOR" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>ًں‘¨â€چâڑ•ï¸ڈ Individual Doctor</MenuItem>
            </StyledSelect>
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
            <ActionButton variant="secondary" onClick={() => setEditOpen(false)} disabled={actionLoading === 'edit'}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleEdit} disabled={actionLoading === 'edit'}>{actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      <StyledDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 1 }}>
            Delete <strong style={{ color: "#f87171" }}>{getLang(deleteConfirm?.name)}</strong>?
          </Typography>
          <Typography sx={{ color: "#4a6080", fontSize: "13px", mb: 3 }}>
            This action cannot be undone. All associated data will be permanently removed.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={actionLoading === 'delete'}>Cancel</ActionButton>
            <ActionButton variant="danger" onClick={handleDelete} disabled={actionLoading === 'delete'}>{actionLoading === 'delete' ? 'Deleting...' : 'Delete'}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}
