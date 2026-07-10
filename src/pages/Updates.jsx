import { useState, useEffect } from "react";
import {
  getAppVersions,
  publishVersion,
  unpublishVersion,
  getReleaseHistory,
  deleteRelease,
  getClinicServers,
} from "../services/firestoreService";
import { debug } from "../lib/debug";
import { normalizeError } from "../lib/errorHandler";
import { useNotification } from "../contexts/NotificationContext";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel, IconButton, Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Trash2, History, PauseCircle, CloudUpload } from "lucide-react";

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: "#070f1e",
  marginLeft: 0,
  position: "relative",
  overflow: "hidden",
  transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: {
    marginLeft: "240px",
  },
}));
const TopBar = styled(Box)({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(15,184,166,0.12)" });
const ContentWrapper = styled(Box)({ padding: "24px", maxWidth: 1400, margin: "0 auto" });
const GlassPanel = styled(Box)({ backgroundColor: "rgba(11,22,40,0.6)", borderRadius: "16px", border: "1px solid rgba(15,184,166,0.12)", backdropFilter: "blur(12px)", overflow: "hidden" });
const StyledTableContainer = styled(Box)({ overflowX: "auto" });
const ActionButton = styled(Button)(({ variant }) => ({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px",
  ...(variant === "primary" ? { backgroundColor: "#0fb8a6", color: "#070f1e", "&:hover": { backgroundColor: "#0dd4bf", boxShadow: "0 4px 16px rgba(15,184,166,0.35)" } } : {}),
  ...(variant === "secondary" ? { borderColor: "rgba(15,184,166,0.30)", color: "#6a8aaa", backgroundColor: "rgba(15,184,166,0.06)", "&:hover": { backgroundColor: "rgba(15,184,166,0.12)" } } : {}),
  ...(variant === "warning" ? { borderColor: "rgba(251,191,36,0.30)", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.06)", "&:hover": { backgroundColor: "rgba(251,191,36,0.12)" } } : {}),
  ...(variant === "danger" ? { borderColor: "rgba(248,113,113,0.30)", color: "#f87171", backgroundColor: "rgba(248,113,113,0.06)", "&:hover": { backgroundColor: "rgba(248,113,113,0.12)" } } : {}),
}));
const StyledDialog = styled(Dialog)({ "& .MuiDialog-paper": { backgroundColor: "#0f1e36", borderRadius: "16px", border: "1px solid rgba(15,184,166,0.15)" } });
const StyledDialogField = styled(TextField)({
  "& .MuiOutlinedInput-root": { backgroundColor: "#0b1628", borderRadius: "10px", color: "#dde6f0", "& fieldset": { borderColor: "rgba(15,184,166,0.18)" }, "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" }, "&.Mui-focused fieldset": { borderColor: "#0fb8a6" } },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } },
  "& .MuiInputBase-input": { color: "#dde6f0" },
});
const StatusBadge = styled(Box)(({ status }) => ({
  display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: "12px",
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", cursor: "pointer",
  backgroundColor: status === "published" ? "rgba(34,197,94,0.12)" : status === "draft" ? "rgba(100,116,139,0.12)" : "rgba(248,113,113,0.12)",
  color: status === "published" ? "#22c55e" : status === "draft" ? "#64748b" : "#f87171",
  border: `1px solid ${status === "published" ? "rgba(34,197,94,0.25)" : status === "draft" ? "rgba(100,116,139,0.25)" : "rgba(248,113,113,0.25)"}`,
}));

const APP_META = {
  dr:     { label: "Doctor Client",  icon: "🩺", color: "#0fb8a6" },
  sec:    { label: "Secretary Client", icon: "📋", color: "#3b82f6" },
  server: { label: "Clinic Server",   icon: "🖥️", color: "#a78bfa" },
};

export default function Updates() {
  const { toggle } = useSidebar();
  const { showNotification } = useNotification();
  const [versions, setVersions] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAppId, setHistoryAppId] = useState(null);
  const [history, setHistory] = useState([]);
  const [formData, setFormData] = useState({
    appId: "dr", version: "", buildNumber: "", downloadUrl: "", msiUrl: "",
    releaseNotes: "", releaseDate: "", minVersion: "", forceUpdate: false,
    status: "published", fileSize: "", checksum: "",
  });

  const loadVersions = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getAppVersions();
      setVersions(data);
    } catch (err) {
      debug.error('Updates.load', err);
      setError(normalizeError(err).message);
    } finally { setLoading(false); }
  };

  const loadServers = async () => {
    try {
      const data = await getClinicServers();
      setServers(data);
    } catch (err) {
      debug.error('Updates.loadServers', err);
    }
  };

  useEffect(() => { loadVersions(); loadServers(); }, []);

  const handleOpenCreate = (appId) => {
    const existing = versions.find(v => v.appId === appId);
    setFormData({
      appId,
      version: "",
      buildNumber: "",
      downloadUrl: existing?.downloadUrl || "",
      msiUrl: existing?.msiUrl || "",
      releaseNotes: "",
      releaseDate: new Date().toISOString().split("T")[0],
      minVersion: existing?.version || "",
      forceUpdate: false,
      status: "published",
      fileSize: "",
      checksum: "",
    });
    setOpenDialog(true);
  };

  const handlePublish = async () => {
    if (!formData.version) { setError("Version is required"); return; }
    setPublishLoading(true);
    try {
      setError(null);
      await publishVersion(formData.appId, formData);
      showNotification("Update published successfully", "success");
      setOpenDialog(false);
      loadVersions();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleUnpublish = async (appId) => {
    try {
      await unpublishVersion(appId);
      showNotification("Update unpublished", "success");
      loadVersions();
    } catch (err) {
      setError(normalizeError(err).message);
    }
  };

  const handleOpenHistory = async (appId) => {
    setHistoryAppId(appId);
    try {
      const data = await getReleaseHistory(appId);
      setHistory(data);
    } catch (err) {
      debug.error('Updates.loadHistory', err);
      setHistory([]);
    }
    setHistoryOpen(true);
  };

  const handleDeleteRelease = async (version) => {
    try {
      await deleteRelease(historyAppId, version);
      showNotification("Release deleted", "success");
      setHistory(h => h.filter(r => r.id !== version));
      setDeleteConfirm(null);
    } catch (err) {
      setError(normalizeError(err).message);
    }
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

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "18px" }}>App Updates</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>Manage releases for all clients</Typography>
          </Box>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px" }}>{error}</Alert>}

        {/* App Cards */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3, mb: 4 }}>
          {versions.map((v) => {
            const meta = APP_META[v.appId] || { label: v.appId, icon: "📦", color: "#6a8aaa" };
            const currentVersion = v.version || "Not set";
            const status = v.status || "none";
            return (
              <GlassPanel key={v.appId} sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: "28px" }}>{meta.icon}</Typography>
                  <Box>
                    <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "15px" }}>{meta.label}</Typography>
                    <Typography sx={{ color: "#4a6080", fontSize: "11px", fontFamily: "monospace" }}>{v.appId}</Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ color: "#3a5070", fontSize: "11px", mb: 0.5 }}>Current Version</Typography>
                  <Typography sx={{ color: "#eaf2ff", fontFamily: "monospace", fontSize: "22px", fontWeight: 700 }}>{currentVersion}</Typography>
                </Box>

                {v.releaseDate && (
                  <Typography sx={{ color: "#4a6080", fontSize: "11px", mb: 2 }}>Released: {v.releaseDate}</Typography>
                )}

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <ActionButton variant="primary" size="small" onClick={() => handleOpenCreate(v.appId)}>
                    <CloudUpload size={14} style={{ marginRight: 4 }} /> Publish
                  </ActionButton>
                  {status === "published" && (
                    <ActionButton variant="warning" size="small" onClick={() => handleUnpublish(v.appId)}>
                      <PauseCircle size={14} style={{ marginRight: 4 }} /> Unpublish
                    </ActionButton>
                  )}
                  <ActionButton variant="secondary" size="small" onClick={() => handleOpenHistory(v.appId)}>
                    <History size={14} style={{ marginRight: 4 }} /> History
                  </ActionButton>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <StatusBadge status={status}>{status.toUpperCase()}</StatusBadge>
                  {v.forceUpdate && (
                    <Chip label="FORCE UPDATE" size="small" sx={{ ml: 1, backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171", border: "1px solid rgba(248,113,113,0.28)", fontSize: "9px", fontWeight: 700 }} />
                  )}
                </Box>
              </GlassPanel>
            );
          })}
        </Box>

        {/* Online servers table */}
        <GlassPanel sx={{ p: 3 }}>
          <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: "14px", mb: 2 }}>🖥️ Server Instances</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "#4a6080" }}>MAC Address</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>IP</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Port</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>License</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Version</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Status</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Last Seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: "#4a6080", textAlign: "center", py: 3 }}>
                      No server instances found.
                      <br />
                      <Typography component="span" sx={{ color: "#0fb8a6", fontSize: "12px" }}>
                        Servers appear here automatically when they connect online.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell sx={{ color: "#eaf2ff", fontFamily: "monospace", fontSize: "12px" }}>{s.macAddress || s.id || "—"}</TableCell>
                      <TableCell sx={{ color: "#6a8aaa" }}>{s.localIp || s.ipAddress || "—"}</TableCell>
                      <TableCell sx={{ color: "#6a8aaa" }}>{s.port || "—"}</TableCell>
                      <TableCell sx={{ color: "#34d399", fontFamily: "monospace", fontSize: "12px" }}>{s.licenseKey || "—"}</TableCell>
                      <TableCell sx={{ color: "#6a8aaa" }}>{s.version || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status || "offline"}>{(s.status || "offline").toUpperCase()}</StatusBadge>
                      </TableCell>
                      <TableCell sx={{ color: "#4a6080", fontSize: "12px" }}>
                        {s.lastSeen?.toDate?.().toLocaleString() || s.lastSeen || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        </GlassPanel>
      </ContentWrapper>

      {/* Publish Dialog */}
      <StyledDialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: "#eaf2ff", backgroundColor: "#0b1628" }}>
          Publish Update — {APP_META[formData.appId]?.icon} {APP_META[formData.appId]?.label}
        </DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <StyledDialogField fullWidth label="Version *" margin="normal" value={formData.version}
            onChange={e => setFormData(p => ({ ...p, version: e.target.value }))} placeholder="2.5.0" />
          <StyledDialogField fullWidth label="Build Number" margin="normal" type="number" value={formData.buildNumber}
            onChange={e => setFormData(p => ({ ...p, buildNumber: e.target.value }))} placeholder="2848" />
          <StyledDialogField fullWidth label="Download URL" margin="normal" value={formData.downloadUrl}
            onChange={e => setFormData(p => ({ ...p, downloadUrl: e.target.value }))} placeholder="https://..." />
          <StyledDialogField fullWidth label="MSI URL (legacy)" margin="normal" value={formData.msiUrl}
            onChange={e => setFormData(p => ({ ...p, msiUrl: e.target.value }))} placeholder="https://..." />
          <StyledDialogField fullWidth label="Release Date" margin="normal" type="date" value={formData.releaseDate}
            onChange={e => setFormData(p => ({ ...p, releaseDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <StyledDialogField fullWidth label="Min Required Version" margin="normal" value={formData.minVersion}
            onChange={e => setFormData(p => ({ ...p, minVersion: e.target.value }))} placeholder="2.4.0" />
          <StyledDialogField fullWidth label="File Size (bytes)" margin="normal" type="number" value={formData.fileSize}
            onChange={e => setFormData(p => ({ ...p, fileSize: e.target.value }))} placeholder="123456789" />
          <StyledDialogField fullWidth label="SHA-256 Checksum" margin="normal" value={formData.checksum}
            onChange={e => setFormData(p => ({ ...p, checksum: e.target.value }))} placeholder="sha256:..." />

          <StyledDialogField
            fullWidth margin="normal" multiline minRows={3}
            label="Release Notes" value={formData.releaseNotes}
            onChange={e => setFormData(p => ({ ...p, releaseNotes: e.target.value }))}
            placeholder="- Fixed login issue&#10;- Improved sync performance"
            sx={{ "& .MuiInputBase-input": { color: "#dde6f0", fontFamily: "monospace", fontSize: "12px" } }}
          />

          <FormControlLabel
            control={<Checkbox checked={formData.forceUpdate} onChange={e => setFormData(p => ({ ...p, forceUpdate: e.target.checked }))} sx={{ color: "#4a6080", "&.Mui-checked": { color: "#f87171" } }} />}
            label={<Typography sx={{ color: "#f87171", fontSize: "13px", fontWeight: 600 }}>Force Update (users cannot skip)</Typography>}
          />

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setOpenDialog(false)} disabled={publishLoading}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handlePublish} disabled={publishLoading}>
              {publishLoading ? "Publishing…" : "Publish"}
            </ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* History Dialog */}
      <StyledDialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: "#eaf2ff", backgroundColor: "#0b1628" }}>
          Release History — {APP_META[historyAppId]?.icon} {APP_META[historyAppId]?.label}
        </DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          {history.length === 0 ? (
            <Typography sx={{ color: "#4a6080", textAlign: "center", py: 4 }}>No release history found</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "#4a6080" }}>Version</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Date</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Notes</TableCell>
                  <TableCell sx={{ color: "#4a6080" }}>Status</TableCell>
                  <TableCell sx={{ color: "#4a6080" }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ color: "#eaf2ff", fontFamily: "monospace", fontWeight: 600 }}>{r.version}</TableCell>
                    <TableCell sx={{ color: "#6a8aaa", fontSize: "12px" }}>{r.releaseDate}</TableCell>
                    <TableCell sx={{ color: "#4a6080", fontSize: "12px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.releaseNotes || "—"}</TableCell>
                    <TableCell><StatusBadge status={r.status || "archived"}>{(r.status || "archived").toUpperCase()}</StatusBadge></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteConfirm(r.id)} sx={{ color: "#f87171" }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setHistoryOpen(false)}>Close</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
      {/* Delete Confirm Dialog */}
      <StyledDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "#eaf2ff", backgroundColor: "#0b1628" }}>Delete Release</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <Typography sx={{ color: "#dde6f0", mb: 3 }}>
            Delete <strong style={{ color: "#f87171" }}>{historyAppId} v{deleteConfirm}</strong>? This cannot be undone.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
            <ActionButton variant="danger" onClick={() => handleDeleteRelease(deleteConfirm)}>Delete</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}
