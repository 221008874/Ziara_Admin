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
    error: { bg: "rgba(248,113,113,0.14)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.28)" },
    warning: { bg: "rgba(245,158,11,0.14)", color: "var(--zy-warning)", border: "1px solid rgba(245,158,11,0.28)" },
    info: { bg: "rgba(59,130,246,0.14)", color: "var(--zy-info)", border: "1px solid rgba(59,130,246,0.28)" },
  };
  const style = map[s] || { bg: "rgba(100,116,139,0.14)", color: "var(--zy-slate-300)", border: "1px solid rgba(100,116,139,0.28)" };
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
            <Skeleton sx={{ bgcolor: "var(--bg-secondary)", width: 180 }} />
          </Box>
        </TopBar>
        <ContentWrapper>
          <Skeleton sx={{ bgcolor: "var(--bg-secondary)", borderRadius: "16px", height: 400 }} />
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <title>Error Logs — Smart Clinic Admin</title>
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(28,138,126,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />
      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box>
            <Typography sx={{ color: "var(--text-primary)", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Error Logs</Typography>
            <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "11px", fontStyle: "italic" }}>System errors and warnings</Typography>
          </Box>
        </Box>
        <ActionButton onClick={load} disabled={loading}><RefreshCw size={14} /> {loading ? "Loading..." : "Refresh"}</ActionButton>
      </TopBar>
      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)", borderRadius: "12px", "& .MuiAlert-icon": { color: "var(--danger)" } }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: "var(--text-dark)", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "var(--zy-teal-500)" } }}>Severity</InputLabel>
            <Select label="Severity" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} sx={{ backgroundColor: "var(--bg-input)", borderRadius: "10px", color: "var(--text-secondary)", fontSize: "14px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(28,138,126,0.18)" }, "& .MuiSvgIcon-root": { color: "var(--zy-slate-300)" } }}>
              <MenuItem value="" sx={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>All</MenuItem>
              <MenuItem value="error" sx={{ backgroundColor: "var(--bg-input)", color: "var(--danger)" }}>Error</MenuItem>
              <MenuItem value="warning" sx={{ backgroundColor: "var(--bg-input)", color: "var(--zy-warning)" }}>Warning</MenuItem>
              <MenuItem value="info" sx={{ backgroundColor: "var(--bg-input)", color: "var(--zy-info)" }}>Info</MenuItem>
            </Select>
          </FormControl>
          <Typography sx={{ color: "var(--zy-slate-300)", fontSize: "12px" }}>{logs.length} entries</Typography>
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
                      <Box sx={{ textAlign: "center", py: 4, color: "var(--zy-slate-300)" }}>
                        <Bug size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <Typography>No logs found</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{severityChip(log.severity)}</TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography sx={{ color: "var(--text-secondary)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message || log.error || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography sx={{ fontFamily: "monospace", fontSize: "11px", color: "var(--zy-slate-300)" }}>{log.tenantId || "—"}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontSize: "11px", color: "var(--zy-slate-300)" }}>{log.createdAt?.toDate?.().toLocaleString() || "—"}</Typography></TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
