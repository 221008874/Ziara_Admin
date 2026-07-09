// src/pages/admin/Doctors.jsx
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getAllDoctors,
  getAllTenants,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  deleteDoctor,
} from "../services/firestoreService";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { createBilingual, getLang, isBilingual, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Eye, EyeOff } from 'lucide-react';

// ─── Shared Styled Components ─────────────────────────────────────────────

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
    content: '""',
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "2px",
    background: "linear-gradient(to right, transparent, #0fb8a6 35%, #3b82f6 65%, transparent)",
    opacity: 0.45,
  },
});

const ContentWrapper = styled(Box)({
  padding: "24px 28px",
  position: "relative",
  zIndex: 1,
});

const GlassPanel = styled(Box)({
  background: "linear-gradient(to bottom, #0b1628, #081020)",
  borderRadius: "16px",
  border: "1px solid rgba(15,184,166,0.12)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
  overflow: "hidden",
});

const StyledTableContainer = styled(Box)({
  "& .MuiTable-root": { backgroundColor: "transparent" },
  "& .MuiTableHead-root": { backgroundColor: "#0c1a30" },
  "& .MuiTableCell-head": {
    color: "#2dd4bf",
    fontWeight: 700,
    fontSize: "11px",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(15,184,166,0.12)",
  },
  "& .MuiTableRow-root": {
    transition: "all 0.15s ease",
    borderBottom: "1px solid rgba(15,184,166,0.06)",
    "&:nth-of-type(odd)": { backgroundColor: "rgba(8,16,32,0.35)" },
    "&:hover": { backgroundColor: "rgba(15,184,166,0.09)" },
  },
  "& .MuiTableCell-body": {
    color: "#dde6f0",
    fontSize: "13px",
    padding: "14px 20px",
    borderBottom: "none",
  },
});

const StatusBadge = styled(Chip, { shouldForwardProp: (prop) => prop !== "status" })(({ status }) => ({
  borderRadius: "12px",
  fontSize: "10px",
  fontWeight: 700,
  height: "28px",
  minWidth: "80px",
  cursor: "pointer",
  ...(status === "ACTIVE"
    ? {
        backgroundColor: "rgba(52,211,153,0.14)",
        color: "#34d399",
        border: "1px solid rgba(52,211,153,0.28)",
      }
    : {
        backgroundColor: "rgba(248,113,113,0.14)",
        color: "#f87171",
        border: "1px solid rgba(248,113,113,0.28)",
      }),
  "&:hover": { filter: "brightness(1.2)" },
}));

const ActionButton = styled(Button)(({ variant: v }) => ({
  borderRadius: "9px",
  textTransform: "none",
  fontWeight: 600,
  fontSize: "12px",
  padding: "8px 18px",
  transition: "all 0.2s ease",
  ...(v === "primary"
    ? {
        background: "linear-gradient(to right, #0fb8a6, #0d9488)",
        color: "white",
        boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
        "&:hover": {
          background: "linear-gradient(to right, #0d9488, #0b7a72)",
          transform: "translateY(-1px)",
        },
      }
    : v === "warning"
      ? {
          backgroundColor: "rgba(245,158,11,0.12)",
          color: "#f59e0b",
          border: "1px solid rgba(245,158,11,0.30)",
          "&:hover": { backgroundColor: "#f59e0b", color: "white" },
        }
      : v === "danger"
        ? {
            backgroundColor: "rgba(248,113,113,0.10)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.25)",
            "&:hover": { backgroundColor: "#f87171", color: "white" },
          }
        : {
            backgroundColor: "rgba(15,184,166,0.07)",
            color: "#2dd4bf",
            border: "1px solid rgba(15,184,166,0.20)",
            "&:hover": { backgroundColor: "rgba(15,184,166,0.20)" },
          }),
}));

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    backgroundColor: "#0b1628",
    borderRadius: "20px",
    border: "1px solid rgba(15,184,166,0.15)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.80)",
  },
  "& .MuiDialogTitle-root": {
    background: "linear-gradient(to right, #0d9488, #083040)",
    color: "white",
    fontSize: "18px",
    fontWeight: 700,
    padding: "20px 24px",
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: "1px",
      background: "linear-gradient(to right, transparent, rgba(15,184,166,0.5), transparent)",
    },
  },
});

const StyledField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#0f1e36",
    borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(15,184,166,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "#0fb8a6" },
  },
  "& .MuiInputBase-input": { color: "#dde6f0", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "#0fb8a6" },
});

const StyledSelect = styled(Select)({
  backgroundColor: "#0f1e36",
  borderRadius: "10px",
  color: "#dde6f0",
  fontSize: "14px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.35)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0fb8a6" },
  "& .MuiSvgIcon-root": { color: "#4a6080" },
});

const StatCard = styled(Box)({
  background: "linear-gradient(135deg, #0b1628, #081020)",
  border: "1px solid rgba(15,184,166,0.10)",
  borderRadius: "14px",
  padding: "18px 22px",
  flex: "1 1 0",
  minWidth: 0,
});

const EmptyState = styled(Box)({
  textAlign: "center",
  padding: "48px 20px",
});

// ─── Constants ────────────────────────────────────────────────────────────

const BLANK = {
  name: createBilingual(),
  phone: "",
  email: "",
  specialization: "",
  tenantId: "",
  providerId: "",
  tenantName: createBilingual(),
  licenseKey: "",
  photoUrl: "",
  password: "",
  confirmPassword: "",
  bio: createBilingual(),
  education: createBilingual(),
  city: createBilingual(),
  address: createBilingual(),
  yearsOfExperience: "",
  languages: [],
};

const SPECIALIZATIONS = [
  { value: "general_practice",    en: "General Practice",       ar: "طب عام" },
  { value: "internal_medicine",   en: "Internal Medicine",      ar: "طب باطني" },
  { value: "pediatrics",          en: "Pediatrics",             ar: "طب أطفال" },
  { value: "cardiology",          en: "Cardiology",             ar: "طب القلب" },
  { value: "dermatology",         en: "Dermatology",            ar: "طب جلدية" },
  { value: "orthopedics",         en: "Orthopedics",            ar: "جراحة عظام" },
  { value: "neurology",           en: "Neurology",              ar: "طب أعصاب" },
  { value: "ophthalmology",       en: "Ophthalmology",          ar: "طب عيون" },
  { value: "ent",                 en: "ENT",                    ar: "أنف وأذن وحنجرة" },
  { value: "psychiatry",          en: "Psychiatry",             ar: "طب نفسي" },
  { value: "dentistry",           en: "Dentistry",              ar: "طب أسنان" },
  { value: "gynecology",          en: "Gynecology",             ar: "نساء وتوليد" },
  { value: "general_surgery",     en: "General Surgery",        ar: "جراحة عامة" },
  { value: "urology",             en: "Urology",                ar: "جراحة مسالك" },
  { value: "anesthesia",          en: "Anesthesiology",         ar: "تخدير" },
  { value: "radiology",           en: "Radiology",              ar: "أشعة" },
  { value: "pathology",           en: "Pathology",              ar: "باثولوجيا" },
  { value: "other",               en: "Other",                  ar: "أخرى" },
];

// ─── Image Upload Component ───────────────────────────────────────────────

function ImageUploadField({ obj, set, setError }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(obj.photoUrl || "");

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    debug.action('Doctors.upload', `File selected: ${file.name}, size: ${(file.size / 1024).toFixed(1)}KB, type: ${file.type}`);

    if (!file.type.startsWith("image/")) {
      setError && setError("Please select an image file (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError && setError("Image must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      setError && setError(null);
      const url = await uploadImageToCloudinary(file, "doctors/profiles");
      set(p => ({ ...p, photoUrl: url }));
      setPreview(url);
    } catch (err) {
      setError && setError("Image upload failed: " + err.message);
      setPreview(obj.photoUrl || "");
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPreview("");
    set(p => ({ ...p, photoUrl: "" }));
  };

  return (
    <Box sx={{ mt: 2, mb: 1 }}>
      <Typography sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, mb: 1 }}>
        Profile Photo
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {preview ? (
          <Box sx={{ position: "relative" }}>
            <img
              src={preview}
              alt="Preview"
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(15,184,166,0.3)" }}
            />
            <button
              onClick={clearPhoto}
              style={{
                position: "absolute", top: -4, right: -4,
                background: "#f87171", color: "white", border: "none",
                borderRadius: "50%", width: 22, height: 22,
                cursor: "pointer", fontSize: 12, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
              type="button"
            >×</button>
          </Box>
        ) : (
          <Box sx={{
            width: 80, height: 80, borderRadius: "50%",
            backgroundColor: "#0f1e36", border: "2px dashed rgba(15,184,166,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#4a6080", fontSize: 24,
          }}>
            👤
          </Box>
        )}
        <Box>
          <Button
            component="label"
            variant="outlined"
            disabled={uploading}
            sx={{
              borderColor: "rgba(15,184,166,0.3)", color: "#2dd4bf",
              textTransform: "none", fontSize: "12px",
              "&:hover": { borderColor: "#0fb8a6", backgroundColor: "rgba(15,184,166,0.08)" },
            }}
          >
            {uploading ? (
              <CircularProgress size={14} sx={{ color: "#0fb8a6", mr: 1 }} thickness={5} />
            ) : null}
            {uploading ? "Uploading..." : preview ? "Change Photo" : "Upload Photo"}
            <input type="file" accept="image/*" hidden onChange={handleFileChange} />
          </Button>
          <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5 }}>
            JPG, PNG, WebP. Max 5MB.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Password Field Component ─────────────────────────────────────────────

function PasswordField({ obj, set, isEdit = false, error, setError }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Must contain at least one uppercase letter (A-Z)";
    if (!/[a-z]/.test(pwd)) return "Must contain at least one lowercase letter (a-z)";
    if (!/[0-9]/.test(pwd)) return "Must contain at least one number (0-9)";
    return null;
  };

  const handlePasswordChange = (value) => {
    set(p => ({ ...p, password: value }));
    if (error && !validatePassword(value)) {
      setError(null);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, mb: 1 }}>
        {isEdit ? "Set New Password (optional)" : "Initial Password *"}
      </Typography>

      <Box sx={{ position: "relative", mb: 1 }}>
        <StyledField
          fullWidth
          type={showPassword ? "text" : "password"}
          placeholder={isEdit ? "Leave blank to keep current password" : "Enter initial password"}
          value={obj.password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          error={!isEdit && obj.password && !!validatePassword(obj.password)}
          helperText={!isEdit && obj.password ? validatePassword(obj.password) : ""}
          sx={{
            "& .MuiOutlinedInput-root": {
              paddingRight: "40px !important",
              backgroundColor: isEdit ? "#0a1525" : "#0f1e36",
            },
          }}
        />
        <IconButton
          size="small"
          onClick={() => setShowPassword(!showPassword)}
          sx={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            color: "#4a6080", "&:hover": { color: "#0fb8a6" },
          }}
          type="button"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </IconButton>
      </Box>

      {!isEdit && obj.password && (
        <Box sx={{ mb: 2, pl: 1 }}>
          {[
            { test: (p) => p.length >= 8, label: "At least 8 characters" },
            { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter (A-Z)" },
            { test: (p) => /[a-z]/.test(p), label: "One lowercase letter (a-z)" },
            { test: (p) => /[0-9]/.test(p), label: "One number (0-9)" },
          ].map((req, i) => (
            <Typography
              key={i}
              sx={{
                fontSize: "10px",
                color: req.test(obj.password) ? "#34d399" : "#4a6080",
                display: "flex", alignItems: "center", gap: 0.5,
                "&::before": {
                  content: req.test(obj.password) ? '"✓"' : '"○"',
                  color: req.test(obj.password) ? "#34d399" : "#4a6080",
                  marginRight: "2px",
                },
              }}
            >
              {req.label}
            </Typography>
          ))}
        </Box>
      )}

      {!isEdit && (
        <Box sx={{ position: "relative", mt: 1 }}>
          <StyledField
            fullWidth
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm password"
            value={obj.confirmPassword}
            onChange={(e) => set(p => ({ ...p, confirmPassword: e.target.value }))}
            error={obj.confirmPassword && obj.password !== obj.confirmPassword}
            helperText={obj.confirmPassword && obj.password !== obj.confirmPassword ? "Passwords do not match" : ""}
            sx={{ "& .MuiOutlinedInput-root": { paddingRight: "40px !important" } }}
          />
          <IconButton
            size="small"
            onClick={() => setShowConfirm(!showConfirm)}
            sx={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              color: "#4a6080", "&:hover": { color: "#0fb8a6" },
            }}
            type="button"
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </IconButton>
        </Box>
      )}

      {isEdit && (
        <Typography sx={{ color: "#283848", fontSize: "11px", mt: 0.5, fontStyle: "italic" }}>
          Leave blank to keep the current password. Enter a new password to change it.
        </Typography>
      )}
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function Doctors() {
  const { toggle } = useSidebar();
  const [searchParams] = useSearchParams();
  const urlTenantId = searchParams.get("tenantId");
  const [doctors, setDoctors] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formData, setFormData] = useState(BLANK);
  const [editData, setEditData] = useState(BLANK);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);
  const autoOpened = useRef(false);

  const load = async () => {
    debug.action('Doctors', 'Loading doctors and tenants...');
    try {
      setLoading(true);
      setError(null);
      const [docs, tens] = await Promise.all([getAllDoctors(), getAllTenants()]);
      setDoctors(docs);
      setTenants(tens);
      debug.action('Doctors', `Loaded ${docs.length} doctors, ${tens.length} tenants`);
    } catch (e) {
      debug.error('Doctors.load', e);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    debug.component('Doctors', 'Mounted');
    load();
    return () => debug.component('Doctors', 'Unmounted');
  }, []);

  // Auto-select tenant from URL query param (e.g. from Tenants page "Add Doctor" button)
  useEffect(() => {
    if (autoOpened.current) return;
    if (urlTenantId && tenants.length > 0) {
      const t = tenants.find(t => t.id === urlTenantId);
      if (t) {
        autoOpened.current = true;
        setFormData(p => ({
          ...p,
          tenantId: urlTenantId,
          providerId: urlTenantId,
          tenantName: isBilingual(t.name) ? { ...t.name } : createBilingual(getLang(t.name)),
          licenseKey: t.licenseKey || "",
        }));
        setTenantFilter(urlTenantId);
        setCreateOpen(true);
      }
    }
  }, [urlTenantId, tenants]);

  const handleCreate = async () => {
    if (!formData.name.en) {
      setError("Doctor name is required");
      return;
    }
    if (!formData.tenantId && !formData.licenseKey) {
      setError("License key is required for individual doctors");
      return;
    }
    if (!formData.email) {
      setError("Email is required for doctor login");
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      setError("Password is required for new doctors");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const pwdError = (() => {
      const p = formData.password;
      if (p.length < 8) return "Password must be at least 8 characters";
      if (!/[A-Z]/.test(p)) return "Must contain at least one uppercase letter";
      if (!/[a-z]/.test(p)) return "Must contain at least one lowercase letter";
      if (!/[0-9]/.test(p)) return "Must contain at least one number";
      return null;
    })();
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setActionLoading('create');
    debug.action('Doctors', 'Creating doctor', { email: formData.email, tenant: formData.tenantId });
    try {
      setError(null);
      const { confirmPassword: _cp, ...doctorData } = formData;
      await createDoctor(doctorData);
      debug.action('Doctors', 'Doctor created', { email: formData.email });
      setCreateOpen(false);
      setFormData(BLANK);
      load();
    } catch (e) {
      debug.error('Doctors.create', e);
      setError("Failed to create doctor: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (d) => {
    setEditTarget(d);
    setEditData({
      name: isBilingual(d.name) ? d.name : createBilingual(d.name || ""),
      phone: d.phone || "",
      email: d.email || "",
      specialization: d.specialization || "",
      tenantId: d.tenantId || "",
      providerId: d.providerId || d.tenantId || "",
      tenantName: isBilingual(d.tenantName) ? d.tenantName : createBilingual(d.tenantName || ""),
      licenseKey: d.licenseKey || "",
      photoUrl: d.photoUrl || "",
      password: "",
      confirmPassword: "",
      bio: isBilingual(d.bio) ? d.bio : createBilingual(d.bio || ""),
      education: isBilingual(d.education) ? d.education : createBilingual(d.education || ""),
      city: isBilingual(d.city) ? d.city : createBilingual(d.city || ""),
      address: isBilingual(d.address) ? d.address : createBilingual(d.address || ""),
      yearsOfExperience: d.yearsOfExperience || "",
      languages: d.languages || [],
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget || !editData.name.en) return;

    if (editData.password) {
      if (editData.password !== editData.confirmPassword) {
        setError("New passwords do not match");
        return;
      }
      const pwdError = (() => {
        const p = editData.password;
        if (p.length < 8) return "Password must be at least 8 characters";
        if (!/[A-Z]/.test(p)) return "Must contain at least one uppercase letter";
        if (!/[a-z]/.test(p)) return "Must contain at least one lowercase letter";
        if (!/[0-9]/.test(p)) return "Must contain at least one number";
        return null;
      })();
      if (pwdError) {
        setError(pwdError);
        return;
      }
    }

    setActionLoading('edit');
    debug.action('Doctors', 'Updating doctor', { id: editTarget.id, email: editData.email });
    try {
      setError(null);
      const updateData = { ...editData };
      if (!updateData.password) {
        delete updateData.password;
        delete updateData.confirmPassword;
      } else {
        delete updateData.confirmPassword;
      }
      await updateDoctor(editTarget.id, updateData);
      debug.action('Doctors', 'Doctor updated', { id: editTarget.id });
      setEditOpen(false);
      load();
    } catch (e) {
      debug.error('Doctors.update', e);
      setError("Failed to update doctor: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (id, current) => {
    debug.action('Doctors', `Toggling status: ${id} (${current} -> ${current === "ACTIVE" ? "INACTIVE" : "ACTIVE"})`);
    setActionLoading(`status-${id}`);
    try {
      await updateDoctorStatus(id, current === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      debug.action('Doctors', `Status updated: ${id}`);
      load();
    } catch (e) {
      debug.error('Doctors.toggleStatus', e);
      setError("Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    debug.action('Doctors', 'Deleting doctor', { id: deleteConfirm.id });
    setActionLoading('delete');
    try {
      await deleteDoctor(deleteConfirm.id);
      debug.action('Doctors', 'Doctor deleted', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      load();
    } catch (e) {
      debug.error('Doctors.delete', e);
      setError("Failed to delete doctor: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const visible = tenantFilter === "ALL"
    ? doctors
    : doctors.filter(d => d.tenantId === tenantFilter);

  const active = doctors.filter(d => d.status === "ACTIVE").length;

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const fieldEl = (label, key, obj, set, opts = {}) => (
    <StyledField
      fullWidth
      label={label}
      margin="normal"
      value={obj[key]}
      onChange={e => set(p => ({ ...p, [key]: e.target.value }))}
      {...opts}
    />
  );

  const renderTenantSelect = (obj, set) => (
    <FormControl fullWidth margin="normal">
      <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>
        Tenant (Clinic)
      </InputLabel>
      <StyledSelect
        label="Tenant (Clinic)"
        value={obj.tenantId || ""}
        onChange={e => {
          const t = tenants.find(t => t.id === e.target.value);
          set(p => ({ ...p, tenantId: e.target.value || "", providerId: e.target.value || "", tenantName: t ? (isBilingual(t.name) ? { ...t.name } : createBilingual(getLang(t.name))) : createBilingual(), licenseKey: t?.licenseKey || "" }));
        }}
      >
        <MenuItem value="" sx={{ backgroundColor: "#0f1e36", color: "#6b7e9b", fontStyle: "italic" }}>
          — No Tenant (Individual) —
        </MenuItem>
        {tenants.map(t => (
          <MenuItem key={t.id} value={t.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
            {getLang(t.name) || t.name}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  );

  const renderSpecSelect = (obj, set) => (
    <FormControl fullWidth margin="normal">
      <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>
        Specialization / التخصص
      </InputLabel>
      <StyledSelect
        label="Specialization / التخصص"
        value={obj.specialization}
        onChange={e => set(p => ({ ...p, specialization: e.target.value }))}
      >
        {SPECIALIZATIONS.map(s => (
          <MenuItem key={s.value} value={s.value} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
            <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
              <Typography sx={{ fontSize: "13px", fontWeight: 600 }}>{s.en}</Typography>
              <Typography sx={{ fontSize: "11px", color: "#9ecfca", fontFamily: "sans-serif" }}>{s.ar}</Typography>
            </Box>
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  );

  return (
    <PageContainer>
      <Box sx={{
        position: "fixed", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(59,130,246,0.04), transparent 70%)",
        top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none",
      }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>
              Doctor Management
            </Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">
              Manage doctors across all tenants
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <StyledSelect
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              displayEmpty
              sx={{ height: 38, fontSize: "12px" }}
            >
              <MenuItem value="ALL" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
                All Tenants
              </MenuItem>
              {tenants.map(t => (
                <MenuItem key={t.id} value={t.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>
                  {getLang(t.name)}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
          <ActionButton
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={actionLoading === 'create'}
          >
            {actionLoading === 'create' ? (
              <CircularProgress size={14} sx={{ color: "white", mr: 1 }} />
            ) : "+ "}
            {actionLoading === 'create' ? "Adding..." : "New Doctor"}
          </ActionButton>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{
              mb: 3,
              backgroundColor: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#f87171",
              borderRadius: "12px",
              "& .MuiAlert-icon": { color: "#f87171" },
            }}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          {[
            { label: "Total Doctors", value: doctors.length, color: "#60a5fa" },
            { label: "Active", value: active, color: "#34d399" },
            { label: "Inactive", value: doctors.length - active, color: "#f87171" },
            { label: "Tenants", value: tenants.length, color: "#2dd4bf" },
          ].map(s => (
            <StatCard key={s.label}>
              <Typography sx={{
                color: "#4a6080",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                mb: 0.5,
              }}>
                {s.label}
              </Typography>
              <Typography sx={{ color: s.color, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>
                {s.value}
              </Typography>
            </StatCard>
          ))}
        </Box>

        <GlassPanel>
          <div className="table-responsive">
            <StyledTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Specialization</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>License Key</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState>
                          <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>👨‍⚕️</Typography>
                          <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>
                            No doctors found
                          </Typography>
                          <Typography sx={{ color: "#283848", fontSize: "13px" }}>
                            {tenantFilter !== "ALL"
                              ? "No doctors for this tenant."
                              : "Click \"+ New Doctor\" to add one."}
                          </Typography>
                        </EmptyState>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            {d.photoUrl ? (
                              <img
                                src={d.photoUrl}
                                alt=""
                                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                              />
                            ) : (
                              <Box sx={{
                                width: 32, height: 32, borderRadius: "50%",
                                backgroundColor: "#0f1e36",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, color: "#4a6080",
                              }}>
                                {getLang(d.name)?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                              </Box>
                            )}
                            <Box>
                              <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>
                                Dr. {getLang(d.name)}
                              </Typography>
                              {getLang(d.name, "ar") && getLang(d.name, "ar") !== getLang(d.name, "en") && (
                                <Typography sx={{ fontSize: "11px", color: "#9ecfca", mt: 0.25, fontFamily: "sans-serif" }}>
                                  {getLang(d.name, "ar")}
                                </Typography>
                              )}
                              {d.email && (
                                <Typography sx={{ fontSize: "11px", color: "#4a6080", mt: 0.25 }}>
                                  {d.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{
                            fontSize: "12px",
                            color: "#9ecfca",
                            backgroundColor: "rgba(15,184,166,0.08)",
                            border: "1px solid rgba(15,184,166,0.12)",
                            borderRadius: 6,
                            px: 1, py: 0.25,
                            display: "inline-block",
                          }}>
                            {getLang(d.tenantName) || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const spec = SPECIALIZATIONS.find(s => s.value === d.specialization);
                            if (spec) {
                              return (
                                <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                                  <Typography sx={{ fontSize: "13px", color: "#dde6f0" }}>{spec.en}</Typography>
                                  <Typography sx={{ fontSize: "11px", color: "#9ecfca", fontFamily: "sans-serif" }}>{spec.ar}</Typography>
                                </Box>
                              );
                            }
                            return d.specialization || "—";
                          })()}
                        </TableCell>
                        <TableCell>{d.phone || "—"}</TableCell>
                        <TableCell>
                          <Typography sx={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: d.licenseKey ? "#34d399" : "#4a6080",
                          }}>
                            {d.licenseKey || "Not assigned"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={d.status}
                            label={d.status}
                            size="small"
                            onClick={() => toggleStatus(d.id, d.status)}
                            disabled={actionLoading === `status-${d.id}`}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                            <ActionButton
                              variant="warning"
                              size="small"
                              onClick={() => openEdit(d)}
                              disabled={actionLoading === 'edit' || actionLoading === 'delete'}
                            >
                              Edit
                            </ActionButton>
                            <ActionButton
                              variant="danger"
                              size="small"
                              onClick={() => setDeleteConfirm(d)}
                              disabled={actionLoading === 'edit' || actionLoading === 'delete'}
                            >
                              Delete
                            </ActionButton>
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

      <StyledDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Doctor</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <ImageUploadField obj={formData} set={setFormData} error={error} setError={setError} />
          <BilingualInput label="Full Name" labelAr="الاسم الكامل" value={formData.name} onChange={v => setFormData(p => ({ ...p, name: v }))} required />
          {renderTenantSelect(formData, setFormData)}
          {renderSpecSelect(formData, setFormData)}
          <BilingualInput label="Bio" labelAr="نبذة" value={formData.bio} onChange={v => setFormData(p => ({ ...p, bio: v }))} helperText="Brief description of the doctor" />
          <BilingualInput label="Education" labelAr="المؤهلات" value={formData.education} onChange={v => setFormData(p => ({ ...p, education: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={formData.city} onChange={v => setFormData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Address" labelAr="العنوان" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} />
          {fieldEl("Phone", "phone", formData, setFormData, { placeholder: "010xxxxxxxx" })}
          {fieldEl("Email *", "email", formData, setFormData, { type: "email" })}
          {fieldEl("Years of Experience", "yearsOfExperience", formData, setFormData, { type: "number" })}

          <PasswordField
            obj={formData}
            set={setFormData}
            isEdit={false}
            error={error}
            setError={setError}
          />

          {formData.tenantId ? (
            <TextField
              fullWidth
              margin="normal"
              label="License Key (from tenant)"
              value={formData.licenseKey}
              disabled
              sx={{ "& .MuiInputBase-root": { backgroundColor: "#0d1a2e", color: "#34d399" }, "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 }, "& .Mui-disabled": { WebkitTextFillColor: "#34d399 !important" } }}
            />
          ) : (
            fieldEl("License Key *", "licenseKey", formData, setFormData, {
              placeholder: "LIC-2026-001",
            })
          )}

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton
              variant="secondary"
              onClick={() => { setCreateOpen(false); setError(null); }}
              disabled={actionLoading === 'create'}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleCreate}
              disabled={actionLoading === 'create'}
            >
              {actionLoading === 'create' ? (
                <>
                  <CircularProgress size={14} sx={{ color: "white", mr: 1 }} />
                  Adding...
                </>
              ) : "Add Doctor"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      <StyledDialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Doctor</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <ImageUploadField obj={editData} set={setEditData} error={error} setError={setError} />
          <BilingualInput label="Full Name" labelAr="الاسم الكامل" value={editData.name} onChange={v => setEditData(p => ({ ...p, name: v }))} required />
          {renderTenantSelect(editData, setEditData)}
          {renderSpecSelect(editData, setEditData)}
          <BilingualInput label="Bio" labelAr="نبذة" value={editData.bio} onChange={v => setEditData(p => ({ ...p, bio: v }))} />
          <BilingualInput label="Education" labelAr="المؤهلات" value={editData.education} onChange={v => setEditData(p => ({ ...p, education: v }))} />
          <BilingualInput label="City" labelAr="المدينة" value={editData.city} onChange={v => setEditData(p => ({ ...p, city: v }))} />
          <BilingualInput label="Address" labelAr="العنوان" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
          {fieldEl("Phone", "phone", editData, setEditData)}
          {fieldEl("Email", "email", editData, setEditData, { type: "email" })}
          {fieldEl("Years of Experience", "yearsOfExperience", editData, setEditData, { type: "number" })}

          <PasswordField
            obj={editData}
            set={setEditData}
            isEdit={true}
            error={error}
            setError={setError}
          />

          {fieldEl("License Key", "licenseKey", editData, setEditData)}

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={actionLoading === 'edit'}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleEdit}
              disabled={actionLoading === 'edit'}
            >
              {actionLoading === 'edit' ? (
                <>
                  <CircularProgress size={14} sx={{ color: "white", mr: 1 }} />
                  Saving...
                </>
              ) : "Save Changes"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      <StyledDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 1 }}>
            Delete <strong style={{ color: "#f87171" }}>Dr. {getLang(deleteConfirm?.name)}</strong>?
          </Typography>
          <Typography sx={{ color: "#4a6080", fontSize: "13px", mb: 3 }}>
            This action cannot be undone.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton
              variant="secondary"
              onClick={() => setDeleteConfirm(null)}
              disabled={actionLoading === 'delete'}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
            >
              {actionLoading === 'delete' ? (
                <>
                  <CircularProgress size={14} sx={{ color: "white", mr: 1 }} />
                  Deleting...
                </>
              ) : "Delete"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}