import { useState, useEffect } from "react";
import {
  getAllTenants,
  createTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
} from "../services/firestoreService";
import { createBilingual, getLang, isBilingual, BilingualInput } from "../lib/i18n";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// ─── Design Tokens (same system as Licenses.jsx) ─────────────────────────────

const PageContainer = styled(Box)({
  minHeight: "100vh",
  backgroundColor: "#04091a",
  marginLeft: 220,             // sidebar width
  position: "relative",
  overflow: "hidden",
});

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

const StatusBadge = styled(Chip)(({ status }) => ({
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

// ─── Blank form state ────────────────────────────────────────────────────────

const BLANK = {
  name: createBilingual(),
  contactEmail: "",
  contactPhone: "",
  address: createBilingual(),
  city: createBilingual(),
  description: createBilingual(),
  plan: "BASIC",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Tenants() {
  const [tenants, setTenants]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [formData, setFormData]       = useState(BLANK);
  const [editData, setEditData]       = useState(BLANK);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      setTenants(await getAllTenants());
    } catch (e) {
      setError("Failed to load tenants.");
      console.error(e);
    } finally { setLoading(false); }
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.name.en) { setError("Tenant name (English) is required"); return; }
    try {
      setError(null);
      await createTenant(formData);
      setCreateOpen(false);
      setFormData(BLANK);
      load();
    } catch (e) {
      setError("Failed to create tenant: " + e.message);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (t) => {
    setEditTarget(t);
    setEditData({
      name: isBilingual(t.name) ? t.name : createBilingual(t.name || ""),
      contactEmail: t.contactEmail || "",
      contactPhone: t.contactPhone || "",
      address: isBilingual(t.address) ? t.address : createBilingual(t.address || ""),
      city: isBilingual(t.city) ? t.city : createBilingual(t.city || ""),
      description: isBilingual(t.description) ? t.description : createBilingual(t.description || ""),
      plan: t.plan || "BASIC",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget || !editData.name.en) return;
    try {
      setError(null);
      await updateTenant(editTarget.id, editData);
      setEditOpen(false);
      load();
    } catch (e) {
      setError("Failed to update tenant: " + e.message);
    }
  };

  // ── Toggle Status ─────────────────────────────────────────────────────────
  const toggleStatus = async (id, current) => {
    try {
      await updateTenantStatus(id, current === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      load();
    } catch {
      setError("Failed to update status");
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteTenant(deleteConfirm.id);
      setDeleteConfirm(null);
      load();
    } catch (e) {
      setError("Failed to delete tenant: " + e.message);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const active   = tenants.filter(t => t.status === "ACTIVE").length;
  const inactive = tenants.filter(t => t.status === "INACTIVE").length;

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
      {/* Background glows */}
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", background: "linear-gradient(135deg, #0fb8a6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(15,184,166,0.4)", fontSize: 20 }}>🏥</Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "18px" }}>Tenant Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>Manage clinics & organizations</Typography>
          </Box>
        </Box>
        <ActionButton variant="primary" onClick={() => setCreateOpen(true)}>+ New Tenant</ActionButton>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}

        {/* Stats Row */}
        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
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
          <StyledTableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant Name</TableCell>
                  <TableCell>Contact Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState>
                        <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>🏥</Typography>
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
                        {t.address && <Typography sx={{ fontSize: "11px", color: "#4a6080", mt: 0.25 }}>{getLang(t.address) || t.address}</Typography>}
                      </TableCell>
                      <TableCell>{t.contactEmail || "—"}</TableCell>
                      <TableCell>{t.contactPhone || "—"}</TableCell>
                      <TableCell>
                        <PlanBadge plan={t.plan} label={t.plan || "BASIC"} size="small" />
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
                          {t.createdAt?.toDate?.().toLocaleDateString() || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
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
        </GlassPanel>
      </ContentWrapper>

      {/* ── Create Dialog ────────────────────────────────────────────────────── */}
      <StyledDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="اسم العيادة / المنظمة" value={formData.name} onChange={v => setFormData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="العنوان" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={formData.city} onChange={v => setFormData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="الوصف" value={formData.description} onChange={v => setFormData(p => ({ ...p, description: v }))} />
          {field("Contact Email", "contactEmail", formData, setFormData, { type: "email" })}
          {field("Contact Phone", "contactPhone", formData, setFormData, { placeholder: "010xxxxxxxx" })}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={formData.plan} onChange={e => setFormData(p => ({ ...p, plan: e.target.value }))}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => { setCreateOpen(false); setError(null); }}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleCreate}>Create Tenant</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <StyledDialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Clinic / Organization Name" labelAr="اسم العيادة / المنظمة" value={editData.name} onChange={v => setEditData(p => ({ ...p, name: v }))} required />
          <BilingualInput label="Address" labelAr="العنوان" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={editData.city} onChange={v => setEditData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Description" labelAr="الوصف" value={editData.description} onChange={v => setEditData(p => ({ ...p, description: v }))} />
          {field("Contact Email", "contactEmail", editData, setEditData, { type: "email" })}
          {field("Contact Phone", "contactPhone", editData, setEditData)}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Plan</InputLabel>
            <StyledSelect label="Plan" value={editData.plan} onChange={e => setEditData(p => ({ ...p, plan: e.target.value }))}>
              {["BASIC", "PRO", "ENTERPRISE"].map(p => <MenuItem key={p} value={p} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{p}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setEditOpen(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleEdit}>Save Changes</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────────── */}
      <StyledDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 1 }}>
            Are you sure you want to delete <strong style={{ color: "#f87171" }}>{deleteConfirm?.name}</strong>?
          </Typography>
          <Typography sx={{ color: "#4a6080", fontSize: "13px", mb: 3 }}>
            This will permanently remove the tenant record. Linked doctors and licenses will not be deleted.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
            <ActionButton variant="danger" onClick={handleDelete}>Delete Tenant</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}