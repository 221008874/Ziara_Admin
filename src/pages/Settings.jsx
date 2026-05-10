import { useState, useEffect } from "react";
import { createBilingual, BilingualInput } from "../lib/i18n";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
import logo from "../assets/logo.png";
import {
  Box, Typography, TextField, Button, Switch,
  CircularProgress, Alert, Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// ─── Styled Components ────────────────────────────────────────────────────────

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
  borderBottom: "1px solid rgba(15,184,166,0.12)", padding: "16px 28px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.50)", position: "relative",
  "&::after": { content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(to right, transparent, #0fb8a6 35%, #3b82f6 65%, transparent)", opacity: 0.45 },
});

const ContentWrapper = styled(Box)({ padding: "24px 28px", maxWidth: 860, position: "relative", zIndex: 1 });

const SettingsCard = styled(Box)({
  background: "linear-gradient(to bottom, #0b1628, #081020)", borderRadius: "16px",
  border: "1px solid rgba(15,184,166,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
  padding: "28px 32px", marginBottom: "20px",
});

const CardTitle = styled(Typography)({
  color: "#eaf2ff", fontWeight: 700, fontSize: "15px", marginBottom: 4,
});

const CardDesc = styled(Typography)({
  color: "#4a6080", fontSize: "12px", marginBottom: "24px",
});

const SectionDivider = styled(Divider)({
  borderColor: "rgba(15,184,166,0.08)", margin: "20px 0",
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

const SaveButton = styled(Button)({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "13px", padding: "10px 28px",
  background: "linear-gradient(to right, #0fb8a6, #0d9488)", color: "white",
  boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
  "&:hover": { background: "linear-gradient(to right, #0d9488, #0b7a72)", transform: "translateY(-1px)", boxShadow: "0 6px 20px rgba(15,184,166,0.55)" },
  transition: "all 0.2s ease",
});

const ToggleRow = styled(Box)({
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "14px 0", borderBottom: "1px solid rgba(15,184,166,0.06)",
  "&:last-child": { borderBottom: "none" },
});

const StyledSwitch = styled(Switch)({
  "& .MuiSwitch-switchBase.Mui-checked": { color: "#0fb8a6" },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "rgba(15,184,166,0.40)" },
  "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.10)" },
});

const InfoPill = styled(Box)({
  display: "inline-flex", alignItems: "center", gap: 6,
  backgroundColor: "rgba(15,184,166,0.08)", border: "1px solid rgba(15,184,166,0.15)",
  borderRadius: "8px", padding: "4px 10px", color: "#2dd4bf", fontSize: "12px", fontWeight: 600,
});

// ─── Firestore helpers ────────────────────────────────────────────────────────

const SETTINGS_DOC = "saas_settings";
const SETTINGS_COL = "config";

const loadSettings = async () => {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

const saveSettings = async (data) => {
  const ref = doc(db, SETTINGS_COL, SETTINGS_DOC);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT = {
  appName: createBilingual("Smart Clinic", "عيادة ذكية"),
  supportEmail: "",
  supportPhone: "",
  defaultLicenseDays: 365,
  maxDevicesPerLicense: 1,
  allowSelfRegistration: false,
  enforceDeviceLock: true,
  autoExpireCheck: true,
  maintenanceMode: false,
  graceperiodDays: 7,
  webhookUrl: "",
  smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Settings() {
  const { toggle: toggleSidebar } = useSidebar();
  const [settings, setSettings] = useState(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        if (data) setSettings(s => ({ ...s, ...data }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true); setError(null); setSuccess(false);
      await saveSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally { setSaving(false); }
  };

  const set = (key) => (e) => setSettings(s => ({ ...s, [key]: e.target.value }));
  const toggle = (key) => () => setSettings(s => ({ ...s, [key]: !s[key] }));

  const field = (label, key, opts = {}) => (
    <StyledField fullWidth label={label} margin="dense" value={settings[key]} onChange={set(key)} {...opts} />
  );

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ position: "fixed", width: 500, height: 500, background: "radial-gradient(circle, rgba(15,184,166,0.04), transparent 70%)", top: -100, right: -100, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggleSidebar} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>SaaS Settings</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }} className="hide-on-mobile">Global configuration for Smart Clinic platform</Typography>
          </Box>
        </Box>
        <SaveButton onClick={handleSave} disabled={saving} sx={{ fontSize: { xs: "12px", sm: "13px" }, px: { xs: 2, sm: 4 } }}>
          {saving ? <CircularProgress size={16} sx={{ color: "white", mr: 1 }} /> : null}
          {saving ? "Saving..." : "Save Settings"}
        </SaveButton>
      </TopBar>

      <ContentWrapper>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(false)} sx={{ mb: 3, backgroundColor: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", borderRadius: "12px", "& .MuiAlert-icon": { color: "#34d399" } }}>Settings saved successfully.</Alert>}

        {/* ── General ───────────────────────────────────────────────────────── */}
        <SettingsCard>
          <CardTitle>🏥 General</CardTitle>
          <CardDesc>Platform identity and support contacts</CardDesc>
          <BilingualInput label="Platform Name" labelAr="اسم المنصة" value={settings.appName} onChange={v => setSettings(s => ({ ...s, appName: v }))} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {field("Support Email", "supportEmail", { type: "email" })}
            {field("Support Phone", "supportPhone", { placeholder: "010xxxxxxxx" })}
          </Box>
        </SettingsCard>

        {/* ── License Policy ────────────────────────────────────────────────── */}
        <SettingsCard>
          <CardTitle>🔑 License Policy</CardTitle>
          <CardDesc>Default rules applied when creating or renewing licenses</CardDesc>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
            {field("Default Duration (days)", "defaultLicenseDays", { type: "number", helperText: "e.g. 365 for 1 year" })}
            {field("Max Devices / License", "maxDevicesPerLicense", { type: "number", helperText: "1 = single device lock" })}
            {field("Grace Period (days)", "graceperiodDays", { type: "number", helperText: "Days after expiry before blocking" })}
          </Box>
        </SettingsCard>

        {/* ── Feature Flags ─────────────────────────────────────────────────── */}
        <SettingsCard>
          <CardTitle>🚦 Feature Flags</CardTitle>
          <CardDesc>Toggle platform-wide behaviour. Changes take effect immediately after saving.</CardDesc>
          {[
            { key: "enforceDeviceLock",     label: "Enforce Device Lock",       desc: "Block license use on unregistered MAC addresses" },
            { key: "autoExpireCheck",        label: "Auto Expiry Check",         desc: "Automatically mark licenses as EXPIRED on the expiry date" },
            { key: "allowSelfRegistration",  label: "Allow Self Registration",   desc: "Let new clinics sign up without admin approval" },
            { key: "maintenanceMode",        label: "Maintenance Mode",          desc: "Prevent all local clients from connecting" },
          ].map(row => (
            <ToggleRow key={row.key}>
              <Box>
                <Typography sx={{ color: "#dde6f0", fontSize: "14px", fontWeight: 600 }}>{row.label}</Typography>
                <Typography sx={{ color: "#4a6080", fontSize: "12px", mt: 0.25 }}>{row.desc}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <InfoPill sx={{ minWidth: 52, justifyContent: "center", ...(settings[row.key] ? { color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.20)" } : { color: "#f87171", backgroundColor: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.20)" }) }}>
                  {settings[row.key] ? "ON" : "OFF"}
                </InfoPill>
                <StyledSwitch checked={!!settings[row.key]} onChange={toggle(row.key)} />
              </Box>
            </ToggleRow>
          ))}
        </SettingsCard>

        {/* ── Webhook ───────────────────────────────────────────────────────── */}
        <SettingsCard>
          <CardTitle>🔗 Webhook</CardTitle>
          <CardDesc>POST notifications sent on license events (create, expire, invalid attempt)</CardDesc>
          {field("Webhook URL", "webhookUrl", { placeholder: "https://your-server.com/webhook", helperText: "Leave blank to disable" })}
        </SettingsCard>

        {/* ── SMTP ──────────────────────────────────────────────────────────── */}
        <SettingsCard>
          <CardTitle>📧 SMTP (Email Notifications)</CardTitle>
          <CardDesc>Used for sending expiry reminders and alerts</CardDesc>
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 2 }}>
            {field("SMTP Host", "smtpHost", { placeholder: "smtp.gmail.com" })}
            {field("Port", "smtpPort", { type: "number" })}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 0.5 }}>
            {field("SMTP Username", "smtpUser")}
            {field("SMTP Password", "smtpPass", { type: "password" })}
          </Box>
        </SettingsCard>

        {/* Save footer */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", pb: 4 }}>
          <SaveButton onClick={handleSave} disabled={saving} sx={{ px: 5 }}>
            {saving ? "Saving…" : "💾  Save All Settings"}
          </SaveButton>
        </Box>
      </ContentWrapper>
    </PageContainer>
  );
}