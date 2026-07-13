import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, Skeleton,
} from "@mui/material";
import { PageContainer, TopBar, ContentWrapper, GlassPanel, StyledTableContainer, ActionButton } from "./components/shared/PageShells";
import { Hamburger } from "../components/Sidebar";
import { useSidebar } from "../App";
import { getErrorLogs } from "../services/admin";
import { debug } from "../lib/debug";
import { normalizeError } from "../lib/errorHandler";
import { RefreshCw, Bug } from "lucide-react";

const severityChip = (severity) => {
  const s = (severity || "unknown").toLowerCase();
  const map = {
    error: { bg: "rgba(248,113,113,0.14)", color: "#f87171", border: "1px solid rgba(248,113,113,0.28)" },
    warning: { bg: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.28)" },
    info: { bg: "rgba(59,130,246,0.14)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.28)" },
  };
  const style = map[s] || { bg: "rgba(100,116,139,0.14)", color: "#64748b", border: "1px solid rgba(100,116,139,0.28)" };
  return <Chip label={severity || "unknown"} size="small" sx={{ fontWeight: 600, fontSize: "10px", backgroundColor: style.bg, color: style.color, border: style.border }} />;
};

export default function ErrorLogs() {
  const { toggle } = useSidebar();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("");

  const load = async () => {
    debug.action("ErrorLogs", "Loading error logs...");
    try {
      setLoading(true); setError(null);
      const filters = { limit: 100 };
      if (severityFilter) filters.severity = severityFilter;
      const data = await getErrorLogs(filters);
      setLogs(data);
    } catch (e) {
      debug.error("ErrorLogs.load", e);
      setError(normalizeError(e).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [severityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <Skeleton sx={{ bgcolor: "#0c1a30", borderRadius: "16px", height: 400 }} />
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <title>Error Logs — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />
      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Error Logs</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>System errors and warnings</Typography>
          </Box>
        </Box>
        <ActionButton onClick={load} disabled={loading}><RefreshCw size={14} /> {loading ? "Loading..." : "Refresh"}</ActionButton>
      </TopBar>
      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Severity</InputLabel>
            <Select label="Severity" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} sx={{ backgroundColor: "#0f1e36", borderRadius: "10px", color: "#dde6f0", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(15,184,166,0.18)" }, "& .MuiSvgIcon-root": { color: "#4a6080" } }}>
              <MenuItem value="" sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>All</MenuItem>
              <MenuItem value="error" sx={{ backgroundColor: "#0f1e36", color: "#f87171" }}>Error</MenuItem>
              <MenuItem value="warning" sx={{ backgroundColor: "#0f1e36", color: "#f59e0b" }}>Warning</MenuItem>
              <MenuItem value="info" sx={{ backgroundColor: "#0f1e36", color: "#60a5fa" }}>Info</MenuItem>
            </Select>
          </FormControl>
          <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>{logs.length} entries</Typography>
        </Box>
        <GlassPanel>
          <StyledTableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Severity</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Tenant ID</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Box sx={{ textAlign: "center", py: 4, color: "#4a6080" }}>
                        <Bug size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <Typography>No logs found</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{severityChip(log.severity)}</TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography sx={{ color: "#dde6f0", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message || log.error || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography sx={{ fontFamily: "monospace", fontSize: "11px", color: "#4a6080" }}>{log.tenantId || "—"}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "11px", color: "#4a6080" }}>{log.createdAt?.toDate?.().toLocaleString() || "—"}</Typography></TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "11px", color: "#6a8aaa", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.stack || log.details || "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </GlassPanel>
      </ContentWrapper>
    </PageContainer>
  );
}
