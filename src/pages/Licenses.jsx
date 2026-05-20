import { useState, useEffect } from "react";
import {
  getAllLicenses,
  createLicense,
  updateLicenseStatus,
  updateLicenseExpiry,
  updateLicenseOnlineBooking,
} from "../services/firestoreService";
import { createBilingual, getLang, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
import logo from "../assets/logo.png";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledSelect = styled(Select)({
  backgroundColor: "#0f1e36", borderRadius: "10px",
  "& fieldset": { borderColor: "rgba(15,184,166,0.18)" },
  "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" },
  "&.Mui-focused fieldset": { borderColor: "#0fb8a6", boxShadow: "0 0 0 3px rgba(15,184,166,0.15)" },
  "& .MuiSelect-select": { color: "#dde6f0", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 },
  "& .MuiSvgIcon-root": { color: "#2dd4bf" },
});

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
  padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center",
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

const StatusBadge = styled(Chip)(({ status }) => ({
  borderRadius: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", height: "28px", minWidth: "80px",
  ...(status === "ACTIVE" ? {
    backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399",
    border: "1px solid rgba(52,211,153,0.28)", boxShadow: "0 0 8px rgba(52,211,153,0.15)",
  } : status === "EXPIRED" ? {
    backgroundColor: "rgba(239,68,68,0.14)", color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.28)", boxShadow: "0 0 8px rgba(239,68,68,0.15)",
  } : {
    backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171",
    border: "1px solid rgba(248,113,113,0.28)", boxShadow: "0 0 8px rgba(248,113,113,0.15)",
  }),
  "&:hover": { cursor: "pointer", filter: "brightness(1.2)" },
}));

const ActionButton = styled(Button)(({ variant }) => ({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px", transition: "all 0.2s ease",
  ...(variant === "primary" ? {
    background: "linear-gradient(to right, #0fb8a6, #0d9488)", color: "white", boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
    "&:hover": { background: "linear-gradient(to right, #0d9488, #0b7a72)", boxShadow: "0 6px 20px rgba(15,184,166,0.60)", transform: "translateY(-1px)" },
  } : variant === "warning" ? {
    backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.30)",
    "&:hover": { backgroundColor: "#f59e0b", color: "white", boxShadow: "0 4px 12px rgba(245,158,11,0.40)" },
  } : {
    backgroundColor: "rgba(15,184,166,0.07)", color: "#2dd4bf", border: "1px solid rgba(15,184,166,0.20)",
    "&:hover": { backgroundColor: "rgba(15,184,166,0.20)", borderColor: "#0fb8a6", color: "#eaf2ff" },
  }),
}));

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    backgroundColor: "#0b1628", borderRadius: "20px", border: "1px solid rgba(15,184,166,0.15)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.80), 0 0 0 1px rgba(15,184,166,0.08)", overflow: "hidden",
  },
  "& .MuiDialogTitle-root": {
    background: "linear-gradient(to right, #0d9488, #083040)", color: "white", fontSize: "18px", fontWeight: 700, padding: "20px 24px",
    position: "relative",
    "&::after": { content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(to right, transparent, rgba(15,184,166,0.5), transparent)" },
  },
});

const StyledDialogField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#0f1e36", borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(15,184,166,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "#0fb8a6", boxShadow: "0 0 0 3px rgba(15,184,166,0.15)" },
  },
  "& .MuiInputBase-input": { color: "#dde6f0", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "#0fb8a6" },
  "& .MuiFormHelperText-root": { color: "#4a6080", fontSize: "11px", marginTop: "6px" },
});

const EmptyState = styled(Box)({ textAlign: "center", padding: "48px 20px", color: "#3a5070" });

const UserPill = styled(Box)({
  display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px",
  backgroundColor: "rgba(15,184,166,0.08)", borderRadius: "20px",
  border: "1px solid rgba(15,184,166,0.15)", color: "#6a8aaa", fontSize: "13px",
});

const LogoutButton = styled(Button)({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px",
  borderColor: "rgba(248,113,113,0.30)", color: "#f87171", backgroundColor: "rgba(248,113,113,0.08)",
  "&:hover": { backgroundColor: "#f87171", color: "white", borderColor: "#f87171", boxShadow: "0 4px 12px rgba(248,113,113,0.35)" },
});

export default function Licenses() {
  const { toggle } = useSidebar();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLicense, setEditLicense] = useState(null);
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ licenseKey: "", category: "doctor", doctorName: createBilingual(), phone: "", expiryDate: "", onlineBooking: false });

  useEffect(() => {
    debug.component('Licenses', 'Mounted');
    loadLicenses();
    return () => debug.component('Licenses', 'Unmounted');
  }, []);

  const loadLicenses = async () => {
    debug.action('Licenses', 'Loading licenses...');
    try {
      setLoading(true); setError(null);
      const data = await getAllLicenses();
      setLicenses(data);
      debug.action('Licenses', `Loaded ${data.length} licenses`);
    } catch (err) {
      debug.error('Licenses.load', err);
      setError("Failed to load licenses. Check console for details.");
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    debug.action('Licenses', 'Creating license', { key: formData.licenseKey, category: formData.category });
    if (!formData.licenseKey || !formData.expiryDate) {
      setError("License key and expiry date are required"); return;
    }
    try {
      setError(null);
      await createLicense(formData);
      debug.action('Licenses', 'License created', { key: formData.licenseKey });
      setOpenDialog(false);
      setFormData({ licenseKey: "", category: "doctor", doctorName: createBilingual(), phone: "", expiryDate: "", onlineBooking: false });
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.create', err);
      setError(err.message);
    }
  };

  const toggleStatus = async (docId, currentStatus) => {
    debug.action('Licenses', `Toggling status: ${docId} (${currentStatus} -> ${currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE"})`);
    try {
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateLicenseStatus(docId, newStatus);
      debug.action('Licenses', `Status updated: ${docId} -> ${newStatus}`);
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.toggleStatus', err);
      setError("Failed to update license status");
    }
  };

  const toggleOnlineBooking = async (docId, currentEnabled) => {
    debug.action('Licenses', `Toggling online booking: ${docId} (${currentEnabled} -> ${!currentEnabled})`);
    try {
      await updateLicenseOnlineBooking(docId, !currentEnabled);
      debug.action('Licenses', `Online booking updated: ${docId} -> ${!currentEnabled}`);
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.toggleOnlineBooking', err);
      setError("Failed to update online booking");
    }
  };

  const handleEditOpen = (lic) => {
    debug.action('Licenses', `Opening edit expiry dialog: ${lic.id}`, { key: lic.licenseKey, currentExpiry: lic.expiryDate });
    setEditLicense(lic);
    setNewExpiryDate(lic.expiryDate || "");
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!newExpiryDate || !editLicense) return;
    debug.action('Licenses', `Saving expiry: ${editLicense.id} -> ${newExpiryDate}`);
    try {
      setError(null);
      await updateLicenseExpiry(editLicense.id, newExpiryDate);
      debug.action('Licenses', `Expiry saved: ${editLicense.id} -> ${newExpiryDate}`);
      setEditDialogOpen(false);
      loadLicenses();
    } catch (err) {
      debug.error('Licenses.editExpiry', err);
      setError("Failed to update expiry: " + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("clinic_admin_logged");
    localStorage.removeItem("clinic_admin_user");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
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
          <UserPill className="hide-on-mobile"><span>👋</span>{localStorage.getItem("clinic_admin_user") || "Admin"}</UserPill>
          <LogoutButton variant="outlined" size="small" onClick={handleLogout} className="hide-on-mobile">Logout</LogoutButton>
          <ActionButton variant="primary" size="small" onClick={() => setOpenDialog(true)} sx={{ fontSize: { xs: "11px", sm: "12px" } }}>
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
                    <TableCell>Doctor</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Device MAC</TableCell>
                    <TableCell>Expiry</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Online Booking</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
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
                            {lic.deviceId || "Not bound"}
                          </Typography>
                        </TableCell>
                        <TableCell>{lic.expiryDate}</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={lic.status === "EXPIRED" ? "EXPIRED" : lic.status}
                            label={lic.status === "EXPIRED" ? "EXPIRED" : lic.status}
                            onClick={() => lic.status !== "EXPIRED" && toggleStatus(lic.id, lic.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={lic.onlineBooking ? "Enabled" : "Disabled"}
                            size="small"
                            onClick={() => toggleOnlineBooking(lic.id, lic.onlineBooking)}
                            sx={{
                              fontWeight: 600, fontSize: "10px", cursor: "pointer",
                              backgroundColor: lic.onlineBooking ? "rgba(34,197,94,0.14)" : "rgba(100,116,139,0.14)",
                              color: lic.onlineBooking ? "#22c55e" : "#64748b",
                              border: lic.onlineBooking ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(100,116,139,0.28)",
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <ActionButton variant="warning" size="small" onClick={() => handleEditOpen(lic)} sx={{ mr: 1 }}>
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

      <StyledDialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New License</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <StyledDialogField
            fullWidth
            label="License Key"
            margin="normal"
            value={formData.licenseKey}
            onChange={e => setFormData(p => ({ ...p, licenseKey: e.target.value }))}
            placeholder="LIC-2026-001"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Category</InputLabel>
            <StyledSelect label="Category" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
              <MenuItem value="doctor" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Individual Doctor</MenuItem>
              <MenuItem value="tenant" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>Tenant / Organization</MenuItem>
            </StyledSelect>
          </FormControl>
          <BilingualInput
            label={formData.category === "tenant" ? "Tenant Name" : "Doctor Name"}
            labelAr={formData.category === "tenant" ? "اسم المنشأة" : "اسم الطبيب"}
            value={formData.doctorName}
            onChange={v => setFormData(p => ({ ...p, doctorName: v }))}
          />
          <StyledDialogField
            fullWidth
            label="Phone"
            margin="normal"
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            placeholder="010xxxxxxxx"
          />
          <StyledDialogField
            fullWidth
            label="Expiry Date"
            margin="normal"
            type="date"
            value={formData.expiryDate}
            onChange={e => setFormData(p => ({ ...p, expiryDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
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
            <ActionButton variant="secondary" onClick={() => setOpenDialog(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleCreate}>Create License</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      <StyledDialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Expiry Date</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 2 }}>
            License: <strong>{editLicense?.licenseKey}</strong>
          </Typography>
          <StyledDialogField
            fullWidth
            label="New Expiry Date"
            type="date"
            value={newExpiryDate}
            onChange={e => setNewExpiryDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setEditDialogOpen(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleEditSave}>Save</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}