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
  TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip,
  Checkbox, FormControlLabel, IconButton, Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, ActionButton, dialogPaperSx, sharedFieldSx } from "./components/shared/PageShells";
import { Trash2, History, PauseCircle, CloudUpload } from "lucide-react";

const StatusBadge = styled(Box)(({ status }) => ({
  display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: "12px",
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", cursor: "pointer",
  backgroundColor: status === "published" ? "rgba(34,197,94,0.12)" : status === "draft" ? "rgba(100,116,139,0.12)" : "rgba(248,113,113,0.12)",
  color: status === "published" ? "var(--zy-success)" : status === "draft" ? "var(--zy-slate-300)" : "var(--danger)",
  border: `1px solid ${status === "published" ? "rgba(34,197,94,0.25)" : status === "draft" ? "rgba(100,116,139,0.25)" : "rgba(248,113,113,0.25)"}`,
}));

const APP_META = {
  dr:     { label: "Doctor Client",  icon: "🩺", color: "var(--zy-teal-500)" },
  sec:    { label: "Secretary Client", icon: "📋", color: "var(--zy-info)" },
  server: { label: "Clinic Server",   icon: "🖥️", color: "var(--zy-teal-100)" },
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
        <CircularProgress sx={{ color: "var(--zy-teal-500)" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <title>App Updates — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(28,138,126,0.05), transparent 70%)", top: -200, right: -200, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "18px" }}>App Updates</Typography>
            <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", fontStyle: "italic" }}>Manage releases for all clients</Typography>
          </Box>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)", borderRadius: "12px" }}>{error}</Alert>}

        {/* App Cards */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3, mb: 4 }}>
          {versions.map((v) => {
            const meta = APP_META[v.appId] || { label: v.appId, icon: "📦", color: "var(--text-muted)" };
            const currentVersion = v.version || "Not set";
            const status = v.status || "none";
            return (
              <GlassPanel key={v.appId} sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: "28px" }}>{meta.icon}</Typography>
                  <Box>
                    <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "15px" }}>{meta.label}</Typography>
                    <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", fontFamily: "monospace" }}>{v.appId}</Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ color: "var(--text-dark)", fontSize: "11px", mb: 0.5 }}>Current Version</Typography>
                  <Typography sx={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "22px", fontWeight: 700 }}>{currentVersion}</Typography>
                </Box>

                {v.releaseDate && (
                  <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", mb: 2 }}>Released: {v.releaseDate}</Typography>
                )}

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <ActionButton btnVariant="primary" size="small" onClick={() => handleOpenCreate(v.appId)}>
                    <CloudUpload size={14} style={{ marginRight: 4 }} /> Publish
                  </ActionButton>
                  {status === "published" && (
                    <ActionButton btnVariant="warning" size="small" onClick={() => handleUnpublish(v.appId)}>
                      <PauseCircle size={14} style={{ marginRight: 4 }} /> Unpublish
                    </ActionButton>
                  )}
                  <ActionButton btnVariant="secondary" size="small" onClick={() => handleOpenHistory(v.appId)}>
                    <History size={14} style={{ marginRight: 4 }} /> History
                  </ActionButton>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <StatusBadge status={status}>{status.toUpperCase()}</StatusBadge>
                  {v.forceUpdate && (
                    <Chip label="FORCE UPDATE" size="small" sx={{ ml: 1, backgroundColor: "rgba(248,113,113,0.14)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.28)", fontSize: "9px", fontWeight: 700 }} />
                  )}
                </Box>
              </GlassPanel>
            );
          })}
        </Box>

        {/* Online servers table */}
        <GlassPanel sx={{ p: 3 }}>
          <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px", mb: 2 }}>🖥️ Server Instances</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>MAC Address</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>IP</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Port</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>License</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Version</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Status</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Last Seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: "var(--zy-slate-300)", textAlign: "center", py: 3 }}>
                      No server instances found.
                      <br />
                      <Typography component="span" sx={{ color: "var(--zy-teal-500)", fontSize: "12px" }}>
                        Servers appear here automatically when they connect online.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell sx={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "12px" }}>{s.macAddress || s.id || "—"}</TableCell>
                      <TableCell sx={{ color: "var(--text-muted)" }}>{s.localIp || s.ipAddress || "—"}</TableCell>
                      <TableCell sx={{ color: "var(--text-muted)" }}>{s.port || "—"}</TableCell>
                      <TableCell sx={{ color: "var(--success)", fontFamily: "monospace", fontSize: "12px" }}>{s.licenseKey || "—"}</TableCell>
                      <TableCell sx={{ color: "var(--text-muted)" }}>{s.version || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status || "offline"}>{(s.status || "offline").toUpperCase()}</StatusBadge>
                      </TableCell>
                      <TableCell sx={{ color: "var(--zy-slate-300)", fontSize: "12px" }}>
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
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: "var(--text-primary)", backgroundColor: "var(--bg-secondary)" }}>
          Publish Update — {APP_META[formData.appId]?.icon} {APP_META[formData.appId]?.label}
        </DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "var(--bg-secondary)" }}>
          <TextField fullWidth label="Version *" margin="normal" value={formData.version}
            onChange={e => setFormData(p => ({ ...p, version: e.target.value }))} placeholder="2.5.0" sx={sharedFieldSx} />
          <TextField fullWidth label="Build Number" margin="normal" type="number" value={formData.buildNumber}
            onChange={e => setFormData(p => ({ ...p, buildNumber: e.target.value }))} placeholder="2848" sx={sharedFieldSx} />
          <TextField fullWidth label="Download URL" margin="normal" value={formData.downloadUrl}
            onChange={e => setFormData(p => ({ ...p, downloadUrl: e.target.value }))} placeholder="https://..." sx={sharedFieldSx} />
          <TextField fullWidth label="MSI URL (legacy)" margin="normal" value={formData.msiUrl}
            onChange={e => setFormData(p => ({ ...p, msiUrl: e.target.value }))} placeholder="https://..." sx={sharedFieldSx} />
          <TextField fullWidth label="Release Date" margin="normal" type="date" value={formData.releaseDate}
            onChange={e => setFormData(p => ({ ...p, releaseDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={sharedFieldSx} />
          <TextField fullWidth label="Min Required Version" margin="normal" value={formData.minVersion}
            onChange={e => setFormData(p => ({ ...p, minVersion: e.target.value }))} placeholder="2.4.0" sx={sharedFieldSx} />
          <TextField fullWidth label="File Size (bytes)" margin="normal" type="number" value={formData.fileSize}
            onChange={e => setFormData(p => ({ ...p, fileSize: e.target.value }))} placeholder="123456789" sx={sharedFieldSx} />
          <TextField fullWidth label="SHA-256 Checksum" margin="normal" value={formData.checksum}
            onChange={e => setFormData(p => ({ ...p, checksum: e.target.value }))} placeholder="sha256:..." sx={sharedFieldSx} />

          <TextField
            fullWidth margin="normal" multiline minRows={3}
            label="Release Notes" value={formData.releaseNotes}
            onChange={e => setFormData(p => ({ ...p, releaseNotes: e.target.value }))}
            placeholder="- Fixed login issue&#10;- Improved sync performance"
            sx={{ ...sharedFieldSx, "& .MuiInputBase-input": { color: "var(--text-secondary)", fontFamily: "monospace", fontSize: "12px" } }}
          />

          <FormControlLabel
            control={<Checkbox checked={formData.forceUpdate} onChange={e => setFormData(p => ({ ...p, forceUpdate: e.target.checked }))} sx={{ color: "var(--zy-slate-300)", "&.Mui-checked": { color: "var(--danger)" } }} />}
            label={<Typography sx={{ color: "var(--danger)", fontSize: "13px", fontWeight: 600 }}>Force Update (users cannot skip)</Typography>}
          />

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setOpenDialog(false)} disabled={publishLoading}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handlePublish} disabled={publishLoading}>
              {publishLoading ? "Publishing…" : "Publish"}
            </ActionButton>
          </Box>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: "var(--text-primary)", backgroundColor: "var(--bg-secondary)" }}>
          Release History — {APP_META[historyAppId]?.icon} {APP_META[historyAppId]?.label}
        </DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "var(--bg-secondary)" }}>
          {history.length === 0 ? (
            <Typography sx={{ color: "var(--zy-slate-300)", textAlign: "center", py: 4 }}>No release history found</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Version</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Date</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Notes</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }}>Status</TableCell>
                  <TableCell sx={{ color: "var(--zy-slate-300)" }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 600 }}>{r.version}</TableCell>
                    <TableCell sx={{ color: "var(--text-muted)", fontSize: "12px" }}>{r.releaseDate}</TableCell>
                    <TableCell sx={{ color: "var(--zy-slate-300)", fontSize: "12px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.releaseNotes || "—"}</TableCell>
                    <TableCell><StatusBadge status={r.status || "archived"}>{(r.status || "archived").toUpperCase()}</StatusBadge></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteConfirm(r.id)} sx={{ color: "var(--danger)" }}>
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
            <ActionButton btnVariant="secondary" onClick={() => setHistoryOpen(false)}>Close</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: "var(--text-primary)", backgroundColor: "var(--bg-secondary)" }}>Delete Release</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "var(--bg-secondary)" }}>
          <Typography sx={{ color: "var(--text-secondary)", mb: 3 }}>
            Delete <strong style={{ color: "var(--danger)" }}>{historyAppId} v{deleteConfirm}</strong>? This cannot be undone.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</ActionButton>
            <ActionButton btnVariant="danger" onClick={() => handleDeleteRelease(deleteConfirm)}>Delete</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
