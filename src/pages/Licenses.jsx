import { useState, useEffect } from "react";
import {
  getAllLicenses,
  createLicense,
  updateLicense,
  updateLicenseStatus,
  updateLicenseOnlineBooking,
  getAllTenants,
  triggerERPSync,
} from "../services/firestoreService";
import { createBilingual, getLang, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { validateEgyptMobile } from "../lib/validation";
import { normalizeError } from "../lib/errorHandler";
import { useNotification } from "../contexts/NotificationContext";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
import { Skeleton } from "@mui/material";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel,
} from "@mui/material";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, StyledTableContainer, ActionButton, ClickableStatus, EmptyState, dialogPaperSx, dialogTitleSx, sharedFieldSx } from "./components/shared/PageShells";

function getEffectiveStatus(lic) {
  if (!lic.expiryDate) return lic.status || "INACTIVE";
  let expiry;
  if (lic.expiryDate?.toDate) {
    expiry = lic.expiryDate.toDate();
  } else if (typeof lic.expiryDate === "string") {
    expiry = new Date(lic.expiryDate);
  } else if (lic.expiryDate instanceof Date) {
    expiry = lic.expiryDate;
  } else {
    return lic.status || "INACTIVE";
  }
  if (expiry < new Date()) return "EXPIRED";
  return lic.status || "INACTIVE";
}

export default function Licenses() {
  const { toggle } = useSidebar();
  const { showNotification } = useNotification();
  const [licenses, setLicenses] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLicense, setEditLicense] = useState(null);
  const [editForm, setEditForm] = useState({ category: "doctor", doctorName: "", phone: "", expiryDate: "", onlineBooking: false });
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ licenseKey: "", category: "doctor", doctorName: createBilingual(), phone: "", expiryDate: "", onlineBooking: false });
  const [actionLoading, setActionLoading] = useState(null);

  const loadLicenses = async () => {
    debug.action('Licenses', 'Loading licenses...');
    try {
      setLoading(true); setError(null);
      const [data, tenantData] = await Promise.all([getAllLicenses(), getAllTenants()]);
      setLicenses(data);
      setTenants(tenantData);
      debug.action('Licenses', `Loaded ${data.length} licenses, ${tenantData.length} tenants`);
    } catch (err) {
      debug.error('Licenses.load', err);
      const n = normalizeError(err);
      setError(n.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    debug.component('Licenses', 'Mounted');
    loadLicenses();
    return () => debug.component('Licenses', 'Unmounted');
  }, []);

  const handleCreate = async () => {
    debug.action('Licenses', 'Creating license', { key: formData.licenseKey, category: formData.category });
    if (!formData.licenseKey || !formData.expiryDate) {
      setError("License key and expiry date are required"); return;
    }
    const licPhoneErr = validateEgyptMobile(formData.phone);
    if (formData.phone && licPhoneErr) { setError(`Phone: ${licPhoneErr}`); return; }
    setActionLoading('create');
    try {
      setError(null);
      await createLicense(formData);
      debug.action('Licenses', 'License created', { key: formData.licenseKey });
      showNotification("License created successfully", "success");
      setOpenDialog(false);
      setFormData({ licenseKey: "", category: "doctor", doctorName: createBilingual(), phone: "", expiryDate: "", onlineBooking: false });
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.create', err);
      const n = normalizeError(err);
      setError(n.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (docId, currentStatus) => {
    debug.action('Licenses', `Toggling status: ${docId} (${currentStatus} -> ${currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE"})`);
    setActionLoading(`status-${docId}`);
    try {
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateLicenseStatus(docId, newStatus);
      debug.action('Licenses', `Status updated: ${docId} -> ${newStatus}`);
      showNotification(`License ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`, "success");
      triggerERPSync().then(r => { if (!r.success) showNotification(r.message, "warning"); });
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.toggleStatus', err);
      const n = normalizeError(err);
      setError(n.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleOnlineBooking = async (docId, currentEnabled) => {
    debug.action('Licenses', `Toggling online booking: ${docId} (${currentEnabled} -> ${!currentEnabled})`);
    setActionLoading(`booking-${docId}`);
    try {
      await updateLicenseOnlineBooking(docId, !currentEnabled);
      debug.action('Licenses', `Online booking updated: ${docId} -> ${!currentEnabled}`);
      showNotification(`Online booking ${currentEnabled ? "disabled" : "enabled"}`, "success");
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.toggleOnlineBooking', err);
      const n = normalizeError(err);
      setError(n.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditOpen = (lic) => {
    debug.action('Licenses', `Opening edit dialog: ${lic.id}`, { key: lic.licenseKey });
    setEditLicense(lic);
    setEditForm({
      category: lic.category || "doctor",
      doctorName: lic.doctorName || createBilingual(),
      phone: lic.phone || "",
      expiryDate: lic.expiryDate || "",
      onlineBooking: Boolean(lic.onlineBooking),
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editLicense) return;
    const licEditPhoneErr = validateEgyptMobile(editForm.phone);
    if (editForm.phone && licEditPhoneErr) { setError(`Phone: ${licEditPhoneErr}`); return; }
    debug.action('Licenses', `Saving license: ${editLicense.id}`, editForm);
    setActionLoading('edit');
    try {
      setError(null);
      await updateLicense(editLicense.id, editForm);
      debug.action('Licenses', `License saved: ${editLicense.id}`);
      showNotification("License updated successfully", "success");
      triggerERPSync().then(r => { if (!r.success) showNotification(r.message, "warning"); });
      setEditDialogOpen(false);
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.edit', err);
      const n = normalizeError(err);
      setError(n.message);
    } finally {
      setActionLoading(null);
    }
  };

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
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            {[1,2,3].map(i => <Skeleton key={i} sx={{ bgcolor: "#0c1a30", borderRadius: "14px", height: 80, flex: 1 }} />)}
          </Box>
          <Skeleton sx={{ bgcolor: "#0c1a30", borderRadius: "16px", height: 400 }} />
        </ContentWrapper>
      </PageContainer>
    );
  }

  // Build license → tenant lookup
  const licenseTenantMap = {};
  tenants.forEach(t => {
    if (t.licenseKey) licenseTenantMap[t.licenseKey] = t;
  });

  return (
    <PageContainer>
      <title>Licenses — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: -200, filter: "blur(60px)", pointerEvents: "none" }} />
      <Box sx={{ position: "fixed", width: 500, height: 500, background: "radial-gradient(circle, rgba(59,130,246,0.04), transparent 70%)", bottom: -150, left: -150, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" }, letterSpacing: "0.3px" }}>License Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Smart Clinic Admin Console</Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
          <Box className="hide-on-mobile" sx={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", backgroundColor: "rgba(15,184,166,0.08)", borderRadius: "20px", border: "1px solid rgba(15,184,166,0.15)", color: "#6a8aaa", fontSize: "13px" }}><span>👋</span>{localStorage.getItem("clinic_admin_user") || "Admin"}</Box>
          <ActionButton btnVariant="secondary" size="small" onClick={loadLicenses} disabled={loading} className="hide-on-mobile">Refresh</ActionButton>
          <ActionButton btnVariant="primary" size="small" onClick={() => setOpenDialog(true)} sx={{ fontSize: { xs: "11px", sm: "12px" } }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>+ </Box>New License
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}

        <GlassPanel>
          <div className="table-responsive">
            <StyledTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>License Key</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Device Fingerprint</TableCell>
                    <TableCell>Expiry</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Online Booking</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <EmptyState>
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📋</Typography>
                          <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No licenses found</Typography>
                          <Typography sx={{ color: "#283848", fontSize: "13px" }}>Click "+ New License" to create your first license</Typography>
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  ) : (
                    licenses.map((lic) => (
                      <TableRow key={lic.id}>
                        <TableCell>
                          <Typography sx={{ fontFamily: "monospace", color: "#eaf2ff", fontWeight: 600, letterSpacing: "0.5px" }}>{lic.licenseKey}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={lic.category === "tenant" ? "Tenant" : lic.category === "doctor" ? "Doctor" : "—"}
                            size="small"
                            sx={{
                              fontWeight: 600, fontSize: "10px",
                              backgroundColor: lic.category === "tenant" ? "rgba(59,130,246,0.14)" : "rgba(15,184,166,0.14)",
                              color: lic.category === "tenant" ? "#60a5fa" : "#2dd4bf",
                              border: lic.category === "tenant" ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(15,184,166,0.28)",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {licenseTenantMap[lic.licenseKey] ? (
                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                              <Typography sx={{ fontWeight: 600, color: "#eaf2ff", fontSize: "13px" }}>
                                {getLang(licenseTenantMap[lic.licenseKey].name)}
                              </Typography>
                              <Typography sx={{ fontSize: "10px", color: licenseTenantMap[lic.licenseKey].status === "ACTIVE" ? "#34d399" : "#f87171", fontFamily: "monospace" }}>
                                {licenseTenantMap[lic.licenseKey].status}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                            <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>
                              {getLang(lic.doctorName) || "—"}
                            </Typography>
                            {(() => { const ar = getLang(lic.doctorName, "ar"); const en = getLang(lic.doctorName, "en"); return ar && ar !== en ? <Typography sx={{ fontSize: "11px", color: "#9ecfca", fontFamily: "sans-serif" }}>{ar}</Typography> : null; })()}
                          </Box>
                        </TableCell>
                        <TableCell>{lic.phone || "—"}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontFamily: "monospace", color: lic.deviceId ? "#34d399" : "#6a8aaa", fontSize: "12px" }}>
                            {lic.deviceFingerprint || "Not bound"}
                          </Typography>
                        </TableCell>
                        <TableCell>{lic.expiryDate?.toDate ? lic.expiryDate.toDate().toLocaleDateString() : lic.expiryDate || "—"}</TableCell>
                        <TableCell>
                          <ClickableStatus
                            status={getEffectiveStatus(lic)}
                            onToggle={() => getEffectiveStatus(lic) !== "EXPIRED" && toggleStatus(lic.id, lic.status)}
                            loading={actionLoading === `status-${lic.id}`}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={lic.onlineBooking ? "Enabled" : "Disabled"}
                            size="small"
                            onClick={() => actionLoading !== `booking-${lic.id}` && toggleOnlineBooking(lic.id, lic.onlineBooking)}
                            sx={{
                              fontWeight: 600, fontSize: "10px", cursor: "pointer",
                              backgroundColor: lic.onlineBooking ? "rgba(34,197,94,0.14)" : "rgba(100,116,139,0.14)",
                              color: lic.onlineBooking ? "#22c55e" : "#64748b",
                              border: lic.onlineBooking ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(100,116,139,0.28)",
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <ActionButton btnVariant="warning" size="small" onClick={() => handleEditOpen(lic)} sx={{ mr: 1 }}>
                            Edit Expiry
                          </ActionButton>
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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Create New License</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <TextField
            fullWidth
            label="License Key"
            margin="normal"
            value={formData.licenseKey}
            onChange={e => setFormData(p => ({ ...p, licenseKey: e.target.value }))}
            placeholder="LIC-2026-001"
            sx={sharedFieldSx}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Category</InputLabel>
            <Select label="Category" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              <MenuItem value="doctor" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Individual Doctor</MenuItem>
              <MenuItem value="tenant" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Tenant / Organization</MenuItem>
            </Select>
          </FormControl>
          <BilingualInput
            label={formData.category === "tenant" ? "Tenant Name" : "Doctor Name"}
            labelAr={formData.category === "tenant" ? "اسم المنشأة" : "اسم الطبيب"}
            value={formData.doctorName}
            onChange={v => setFormData(p => ({ ...p, doctorName: v }))}
          />
          <TextField
            fullWidth
            label="Phone"
            margin="normal"
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            placeholder="010xxxxxxxx"
            sx={sharedFieldSx}
          />
          <TextField
            fullWidth
            label="Expiry Date"
            margin="normal"
            type="date"
            value={formData.expiryDate}
            onChange={e => setFormData(p => ({ ...p, expiryDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={sharedFieldSx}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.onlineBooking}
                onChange={e => setFormData(p => ({ ...p, onlineBooking: e.target.checked }))}
                sx={{ color: "#4a6080", "&.Mui-checked": { color: "#0fb8a6" } }}
              />
            }
            label={<Typography sx={{ color: "#9ecfca", fontSize: "13px" }}>Enable Online Booking</Typography>}
            sx={{ mt: 1 }}
          />
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setOpenDialog(false)} disabled={actionLoading === 'create'}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleCreate} disabled={actionLoading === 'create'}>{actionLoading === 'create' ? 'Creating...' : 'Create License'}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Edit License — {editLicense?.licenseKey}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Category</InputLabel>
            <Select label="Category" value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              <MenuItem value="doctor" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Individual Doctor</MenuItem>
              <MenuItem value="tenant" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Tenant / Organization</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth label="Name" margin="normal"
            value={editForm.doctorName?.en || editForm.doctorName || ""}
            onChange={e => setEditForm(p => ({ ...p, doctorName: typeof p.doctorName === "object" ? { ...p.doctorName, en: e.target.value } : e.target.value }))}
            sx={sharedFieldSx}
          />
          <TextField
            fullWidth label="Phone" margin="normal"
            value={editForm.phone}
            onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="010xxxxxxxx"
            sx={sharedFieldSx}
          />
          <TextField
            fullWidth label="Expiry Date" margin="normal"
            type="date"
            value={editForm.expiryDate}
            onChange={e => setEditForm(p => ({ ...p, expiryDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={sharedFieldSx}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={editForm.onlineBooking}
                onChange={e => setEditForm(p => ({ ...p, onlineBooking: e.target.checked }))}
                sx={{ color: "#4a6080", "&.Mui-checked": { color: "#0fb8a6" } }}
              />
            }
            label={<Typography sx={{ color: "#9ecfca", fontSize: "13px" }}>Enable Online Booking</Typography>}
            sx={{ mt: 1 }}
          />
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setEditDialogOpen(false)} disabled={actionLoading === 'edit'}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleEditSave} disabled={actionLoading === 'edit'}>{actionLoading === 'edit' ? 'Saving...' : 'Save'}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
