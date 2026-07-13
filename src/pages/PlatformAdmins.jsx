import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Dialog, DialogTitle, DialogContent,
  CircularProgress, Alert, Box, Typography, Chip, Skeleton,
} from "@mui/material";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, StyledTableContainer, ActionButton, StatCard, dialogPaperSx, dialogTitleSx, sharedFieldSx } from "./components/shared/PageShells";
import { Hamburger } from "../components/Sidebar";
import { useSidebar } from "../App";
import { useNotification } from "../contexts/NotificationContext";
import { getPlatformAdmins, addPlatformAdmin, removePlatformAdmin } from "../services/admin";
import { debug } from "../lib/debug";
import { normalizeError } from "../lib/errorHandler";
import { RefreshCw, Plus, Shield, Trash2 } from "lucide-react";

export default function PlatformAdmins() {
  const { toggle } = useSidebar();
  const { showNotification } = useNotification();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ email: "", displayName: "" });
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    debug.action("PlatformAdmins", "Loading admins...");
    try {
      setLoading(true); setError(null);
      const data = await getPlatformAdmins();
      setAdmins(data);
    } catch (e) {
      debug.error("PlatformAdmins.load", e);
      setError(normalizeError(e).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!formData.email) { setError("Email is required"); return; }
    setActionLoading("add");
    try {
      setError(null);
      await addPlatformAdmin({ email: formData.email, displayName: formData.displayName || formData.email });
      showNotification("Admin added", "success");
      setDialogOpen(false); setFormData({ email: "", displayName: "" });
      load();
    } catch (e) {
      setError(normalizeError(e).message);
    } finally { setActionLoading(null); }
  };

  const handleRemove = async (id, email) => {
    if (!window.confirm(`Remove ${email || id} from platform admins?`)) return;
    try {
      await removePlatformAdmin(id);
      showNotification("Admin removed", "success");
      load();
    } catch (e) {
      setError(normalizeError(e).message);
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
          <Skeleton sx={{ bgcolor: "#0c1a30", borderRadius: "14px", height: 80, width: 200, mb: 3 }} />
          <Skeleton sx={{ bgcolor: "#0c1a30", borderRadius: "16px", height: 400 }} />
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <title>Platform Admins — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />
      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Platform Admins</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>Manage administrator access</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <ActionButton btnVariant="secondary" size="small" onClick={load} disabled={loading}><RefreshCw size={14} /></ActionButton>
          <ActionButton btnVariant="primary" size="small" onClick={() => setDialogOpen(true)}><Plus size={14} /> Add Admin</ActionButton>
        </Box>
      </TopBar>
      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <StatCard>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>Total Admins</Typography>
            <Typography sx={{ color: "#60a5fa", fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{admins.length}</Typography>
          </StatCard>
        </Box>
        <GlassPanel>
          <StyledTableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell>Added</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box sx={{ textAlign: "center", py: 4, color: "#4a6080" }}>
                        <Shield size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <Typography>No platform admins yet</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : admins.map(a => (
                  <TableRow key={a.id}>
                    <TableCell><Typography sx={{ fontWeight: 600, color: "#eaf2ff", fontSize: "13px" }}>{a.email || "—"}</Typography></TableCell>
                    <TableCell>{a.displayName || "—"}</TableCell>
                    <TableCell><Chip label={a.role || "admin"} size="small" sx={{ fontWeight: 600, fontSize: "10px", backgroundColor: "rgba(99,102,241,0.14)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.28)" }} /></TableCell>
                    <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{a.lastLogin?.toDate?.().toLocaleString() || a.lastLogin || "—"}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{a.createdAt?.toDate?.().toLocaleDateString() || "—"}</Typography></TableCell>
                    <TableCell align="right"><ActionButton btnVariant="danger" size="small" onClick={() => handleRemove(a.id, a.email)}><Trash2 size={14} /></ActionButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </GlassPanel>
      </ContentWrapper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>Add Platform Admin</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <TextField fullWidth label="Email" margin="normal" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="admin@example.com" sx={sharedFieldSx} />
          <TextField fullWidth label="Display Name" margin="normal" value={formData.displayName} onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))} placeholder="Admin Name" sx={sharedFieldSx} />
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton btnVariant="secondary" onClick={() => { setDialogOpen(false); setError(null); }} disabled={actionLoading === "add"}>Cancel</ActionButton>
            <ActionButton btnVariant="primary" onClick={handleAdd} disabled={actionLoading === "add"}>{actionLoading === "add" ? "Adding..." : "Add Admin"}</ActionButton>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
