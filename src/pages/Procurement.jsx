import { useState, useEffect, useMemo } from "react";
import {
  getAllSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getAllItems,
  createPO, getPOs, getPOById, submitPO, approvePO, markOrdered, closePO, cancelPO, updatePO,
  createGoodsReceipt, completeGoodsReceipt, cancelGoodsReceipt, getGoodsReceiptsByPO, getGoodsReceiptById,
} from "../services/firestoreService";
import { getLang, isBilingual, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, Tabs, Tab,
  IconButton, Tooltip, LinearProgress,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { PAYMENT_TERMS, CURRENCIES } from "../lib/procurementValidation";

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: "100vh", backgroundColor: "#04091a", marginLeft: 0, position: "relative", overflow: "hidden",
  transition: "margin-left 0.3s ease",
  [theme.breakpoints.up("md")]: { marginLeft: "240px" },
}));

const TopBar = styled(Box)({
  background: "linear-gradient(to right, #090f22, #0c1830)",
  borderBottom: "1px solid rgba(15,184,166,0.12)", padding: "16px 28px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.50)", position: "relative",
  "&::after": { content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
    background: "linear-gradient(to right, transparent, #0fb8a6 35%, #3b82f6 65%, transparent)", opacity: 0.45 },
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

const StatusBadge = styled(Chip)(({ $status }) => ({
  borderRadius: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", height: "28px", minWidth: "80px",
  ...($status === "DRAFT" ? { backgroundColor: "rgba(100,116,139,0.14)", color: "#64748b", border: "1px solid rgba(100,116,139,0.28)" }
  : $status === "SUBMITTED" ? { backgroundColor: "rgba(96,165,250,0.14)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.28)" }
  : $status === "APPROVED" ? { backgroundColor: "rgba(45,212,191,0.14)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.28)" }
  : $status === "ORDERED" ? { backgroundColor: "rgba(129,140,248,0.14)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.28)" }
  : $status === "PARTIALLY_RECEIVED" ? { backgroundColor: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.28)" }
  : $status === "RECEIVED" || $status === "COMPLETED" ? { backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399", border: "1px solid rgba(52,211,153,0.28)" }
  : $status === "CLOSED" ? { backgroundColor: "rgba(234,242,255,0.14)", color: "#eaf2ff", border: "1px solid rgba(234,242,255,0.28)" }
  : $status === "CANCELLED" ? { backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171", border: "1px solid rgba(248,113,113,0.28)" }
  : { backgroundColor: "rgba(148,163,184,0.14)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.28)" }),
}));

const ActionButton = styled(Button)(({ $variant }) => ({
  borderRadius: "9px", textTransform: "none", fontWeight: 600, fontSize: "12px", padding: "8px 18px", transition: "all 0.2s ease",
  ...($variant === "primary" ? {
    background: "linear-gradient(to right, #0fb8a6, #0d9488)", color: "white", boxShadow: "0 4px 14px rgba(15,184,166,0.40)",
    "&:hover": { background: "linear-gradient(to right, #0d9488, #0b7a72)", transform: "translateY(-1px)" },
  } : $variant === "warning" ? {
    backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.30)",
    "&:hover": { backgroundColor: "#f59e0b", color: "white" },
  } : $variant === "danger" ? {
    backgroundColor: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)",
    "&:hover": { backgroundColor: "#f87171", color: "white" },
  } : $variant === "approve" ? {
    backgroundColor: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)",
    "&:hover": { backgroundColor: "#34d399", color: "white" },
  } : {
    backgroundColor: "rgba(15,184,166,0.07)", color: "#2dd4bf", border: "1px solid rgba(15,184,166,0.20)",
    "&:hover": { backgroundColor: "rgba(15,184,166,0.20)", borderColor: "#0fb8a6" },
  }),
}));

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": { backgroundColor: "#0b1628", borderRadius: "20px", border: "1px solid rgba(15,184,166,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.80)" },
  "& .MuiDialogTitle-root": { background: "linear-gradient(to right, #0d9488, #083040)", color: "white", fontSize: "18px", fontWeight: 700, padding: "20px 24px", position: "relative",
    "&::after": { content: '""', position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(to right, transparent, rgba(15,184,166,0.5), transparent)" },
  },
});

const StyledField = styled(TextField)({
  "& .MuiOutlinedInput-root": { backgroundColor: "#0f1e36", borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(15,184,166,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(15,184,166,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "#0fb8a6" },
  },
  "& .MuiInputBase-input": { color: "#dde6f0", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "#3a5070", fontSize: "12px", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "#0fb8a6" },
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
  border: "1px solid rgba(15,184,166,0.10)", borderRadius: "14px", padding: "18px 22px", flex: "1 1 0", minWidth: 0,
});

const StyledTabs = styled(Tabs)({
  borderBottom: "1px solid rgba(15,184,166,0.12)",
  "& .MuiTab-root": { color: "#4a6080", fontWeight: 600, fontSize: "13px", textTransform: "none", minHeight: 48, "&.Mui-selected": { color: "#2dd4bf" } },
  "& .MuiTabs-indicator": { backgroundColor: "#2dd4bf", height: 3, borderRadius: "3px 3px 0 0" },
});

export default function Procurement() {
  const { toggle } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  const adminUser = localStorage.getItem("clinic_admin_logged") ? "admin" : "";
  const tenantId = localStorage.getItem("clinic_admin_tenantId") || "demo";

  const [pos, setPOs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poGRs, setPOGRs] = useState([]);

  const [poDialog, setPODialog] = useState(false);
  const [poDetailOpen, setPODetailOpen] = useState(false);
  const [supDialog, setSupDialog] = useState(false);
  const [editSup, setEditSup] = useState(null);
  const [grDialog, setGRDialog] = useState(false);

  const [poForm, setPOForm] = useState({ supplierId: "", expectedDate: "", notes: "", terms: "", items: [{ itemName: "", quantityOrdered: 1, unitCost: 0, inventoryItemId: "" }] });
  const [supForm, setSupForm] = useState({ name: { en: "", ar: "" }, contactPerson: "", email: "", phone: "", paymentTerms: "NET30" });
  const [grForm, setGRForm] = useState({ poId: "", receivedDate: new Date().toISOString().split("T")[0], referenceNumber: "", notes: "", items: [] });

  useEffect(() => {
    debug.component("Procurement", "Mounted");
    loadAll();
    return () => debug.component("Procurement", "Unmounted");
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true); setError(null);
      const [p, s, i] = await Promise.all([
        getPOs(tenantId).catch(() => []),
        getAllSuppliers(tenantId).catch(() => []),
        getAllItems(tenantId).catch(() => []),
      ]);
      setPOs(p); setSuppliers(s); setItems(i);
    } catch (e) {
      debug.error("Procurement.loadAll", e);
      setError("Failed to load procurement data");
    } finally { setLoading(false); }
  };

  const supMap = useMemo(() => {
    const m = {};
    suppliers.forEach((s) => { m[s.id] = s; });
    return m;
  }, [suppliers]);

  const activePOs = pos.filter((p) => !["CLOSED", "CANCELLED"].includes(p.status)).length;
  const pendingApproval = pos.filter((p) => p.status === "SUBMITTED").length;
  const pendingReceipt = pos.filter((p) => p.status === "ORDERED" || p.status === "PARTIALLY_RECEIVED").length;
  const activeSuppliers = suppliers.filter((s) => s.status === "ACTIVE").length;

  // ─── PO ────────────────────────────────────────────────────────────────

  const handleCreatePO = async () => {
    if (!poForm.supplierId) { setError("Supplier is required"); return; }
    if (poForm.items.length === 0) { setError("At least one item is required"); return; }
    try {
      setError(null);
      const supplier = suppliers.find((s) => s.id === poForm.supplierId);
      await createPO({ ...poForm, tenantId, supplierName: getLang(supplier?.name) || "", createdBy: adminUser });
      setPODialog(false);
      setPOForm({ supplierId: "", expectedDate: "", notes: "", terms: "", items: [{ itemName: "", quantityOrdered: 1, unitCost: 0, inventoryItemId: "" }] });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const addPOItem = () => {
    setPOForm((p) => ({ ...p, items: [...p.items, { itemName: "", quantityOrdered: 1, unitCost: 0, inventoryItemId: "" }] }));
  };

  const removePOItem = (idx) => {
    setPOForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const updatePOItem = (idx, field, value) => {
    setPOForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "inventoryItemId" && value) {
        const item = items.find((i) => i.id === value);
        if (item) {
          items[idx].itemName = item.name;
          items[idx].unit = item.unit;
        }
      }
      return { ...p, items };
    });
  };

  const selectItemForPO = (idx, itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setPOForm((p) => {
        const items = [...p.items];
        items[idx] = {
          ...items[idx],
          inventoryItemId: itemId,
          itemName: item.name,
          unit: item.unit,
          unitCost: item.averageCost || 0,
        };
        return { ...p, items };
      });
    }
  };

  const openPODetail = async (poId) => {
    try {
      const po = await getPOById(poId);
      setSelectedPO(po);
      const grs = await getGoodsReceiptsByPO(poId);
      setPOGRs(grs);
      setPODetailOpen(true);
    } catch (e) { setError(e.message); }
  };

  const handlePOAction = async (action, po) => {
    try {
      setError(null);
      if (action === "submit") await submitPO(po.id, adminUser);
      else if (action === "approve") await approvePO(po.id, adminUser);
      else if (action === "order") await markOrdered(po.id, adminUser);
      else if (action === "close") await closePO(po.id, adminUser);
      else if (action === "cancel") await cancelPO(po.id, "Cancelled", adminUser);
      loadAll();
      if (selectedPO?.id === po.id) openPODetail(po.id);
    } catch (e) { setError(e.message); }
  };

  // ─── Suppliers ─────────────────────────────────────────────────────────

  const handleCreateSupplier = async () => {
    if (!supForm.name?.en) { setError("Supplier name (English) is required"); return; }
    try {
      setError(null);
      if (editSup) {
        await updateSupplier(editSup.id, supForm, { tenantId, performedBy: adminUser });
      } else {
        await createSupplier({ ...supForm, tenantId, createdBy: adminUser });
      }
      setSupDialog(false); setEditSup(null);
      setSupForm({ name: { en: "", ar: "" }, contactPerson: "", email: "", phone: "", paymentTerms: "NET30" });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const openEditSupplier = (sup) => {
    setEditSup(sup);
    setSupForm({
      name: isBilingual(sup.name) ? sup.name : { en: sup.name || "", ar: "" },
      contactPerson: sup.contactPerson || "",
      email: sup.email || "",
      phone: sup.phone || "",
      paymentTerms: sup.paymentTerms || "NET30",
    });
    setSupDialog(true);
  };

  const handleDeleteSupplier = async (sup) => {
    try {
      setError(null);
      await deleteSupplier(sup.id, tenantId);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  // ─── Goods Receipts ─────────────────────────────────────────────────────

  const openGRDialog = (poId) => {
    const po = pos.find((p) => p.id === poId);
    if (!po) return;
    setGRForm({ poId, receivedDate: new Date().toISOString().split("T")[0], referenceNumber: "", notes: "", items: [] });
    setGRDialog(true);
  };

  const loadGRItems = async (poId) => {
    try {
      const po = await getPOById(poId);
      if (!po?.items) return;
      const grItems = po.items.map((item) => ({
        poItemId: item.id,
        quantityReceived: item.quantityPending,
        batchNumber: "",
        expiryDate: "",
        notes: "",
      }));
      setGRForm((p) => ({ ...p, items: grItems }));
    } catch (e) { setError(e.message); }
  };

  const updateGRItem = (idx, field, value) => {
    setGRForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...p, items };
    });
  };

  const handleCreateGR = async () => {
    if (!grForm.poId) { setError("PO is required"); return; }
    try {
      setError(null);
      await createGoodsReceipt({ ...grForm, tenantId, createdBy: adminUser });
      setGRDialog(false);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleCompleteGR = async (receiptId) => {
    try {
      setError(null);
      await completeGoodsReceipt(receiptId, adminUser);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const field = (label, key, obj, set, opts = {}) => (
    <StyledField fullWidth label={label} margin="normal" value={obj[key]} onChange={(e) => set((p) => ({ ...p, [key]: e.target.value }))} {...opts} />
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
      <Box sx={{ position: "fixed", width: 600, height: 600, background: "radial-gradient(circle, rgba(15,184,166,0.05), transparent 70%)", top: -200, right: 0, filter: "blur(60px)", pointerEvents: "none" }} />

      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Hamburger onClick={toggle} />
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logo} alt="Smart Clinic" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Procurement Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>Purchase orders, suppliers, and goods receipt</Typography>
          </Box>
        </Box>
      </TopBar>

      <ContentWrapper>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, backgroundColor: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: "12px", "& .MuiAlert-icon": { color: "#f87171" } }}>
            {error}
          </Alert>
        )}

        <Box className="stats-grid" sx={{ mb: 3 }}>
          {[
            { label: "Active POs", value: activePOs, color: "#2dd4bf" },
            { label: "Pending Approval", value: pendingApproval, color: pendingApproval > 0 ? "#60a5fa" : "#34d399" },
            { label: "Pending Receipt", value: pendingReceipt, color: pendingReceipt > 0 ? "#f59e0b" : "#34d399" },
            { label: "Active Suppliers", value: activeSuppliers, color: "#818cf8" },
          ].map((s) => (
            <StatCard key={s.label}>
              <Typography sx={{ color: "#4a6080", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ color: s.color, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{s.value}</Typography>
            </StatCard>
          ))}
        </Box>

        <GlassPanel>
          <StyledTabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Purchase Orders (${pos.length})`} />
            <Tab label={`Suppliers (${suppliers.filter((s) => s.status !== "DELETED").length})`} />
            <Tab label="Goods Receipts" />
          </StyledTabs>

          {/* ───── POs Tab ───── */}
          {tab === 0 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => setPODialog(true)}>+ New PO</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>PO #</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Order Date</TableCell>
                      <TableCell>Expected</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pos.length === 0 ? (
                      <TableRow><TableCell colSpan={8}><EmptyState><Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📋</Typography><Typography sx={{ color: "#4a6080", fontWeight: 600 }}>No purchase orders yet</Typography></EmptyState></TableCell></TableRow>
                    ) : (
                      pos.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell><Typography sx={{ fontFamily: "monospace", color: "#34d399", fontWeight: 600 }}>{po.poNumber}</Typography></TableCell>
                          <TableCell>{po.supplierName || supMap[po.supplierId]?.name?.en || "—"}</TableCell>
                          <TableCell><StatusBadge $status={po.status} label={po.status} size="small" /></TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>{po.totalAmount?.toFixed(2) || "0.00"}</TableCell>
                          <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{po.orderDate || "—"}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{po.expectedDate || "—"}</Typography></TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <ActionButton size="small" onClick={() => openPODetail(po.id)}>View</ActionButton>
                              {po.status === "DRAFT" && <><ActionButton $variant="primary" size="small" onClick={() => handlePOAction("submit", po)}>Submit</ActionButton><ActionButton $variant="danger" size="small" onClick={() => handlePOAction("cancel", po)}>Cancel</ActionButton></>}
                              {po.status === "SUBMITTED" && <><ActionButton $variant="approve" size="small" onClick={() => handlePOAction("approve", po)}>Approve</ActionButton><ActionButton $variant="danger" size="small" onClick={() => handlePOAction("cancel", po)}>Cancel</ActionButton></>}
                              {po.status === "APPROVED" && <ActionButton $variant="primary" size="small" onClick={() => handlePOAction("order", po)}>Order</ActionButton>}
                              {po.status === "ORDERED" && <ActionButton $variant="primary" size="small" onClick={() => openGRDialog(po.id)}>Receive</ActionButton>}
                              {po.status === "PARTIALLY_RECEIVED" && <ActionButton $variant="primary" size="small" onClick={() => openGRDialog(po.id)}>Receive More</ActionButton>}
                              {(po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED") && <ActionButton size="small" onClick={() => handlePOAction("close", po)}>Close</ActionButton>}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}

          {/* ───── Suppliers Tab ───── */}
          {tab === 1 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => { setEditSup(null); setSupForm({ name: { en: "", ar: "" }, contactPerson: "", email: "", phone: "", paymentTerms: "NET30" }); setSupDialog(true); }}>+ New Supplier</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name (EN)</TableCell>
                      <TableCell>Name (AR)</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Payment Terms</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suppliers.filter((s) => s.status !== "DELETED").length === 0 ? (
                      <TableRow><TableCell colSpan={8}><EmptyState><Typography sx={{ fontSize: 40, mb: 1, opacity: 0.3 }}>🏢</Typography><Typography sx={{ color: "#4a6080", fontWeight: 600 }}>No suppliers yet</Typography></EmptyState></TableCell></TableRow>
                    ) : (
                      suppliers.filter((s) => s.status !== "DELETED").map((sup) => (
                        <TableRow key={sup.id}>
                          <TableCell><Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>{sup.name?.en || "—"}</Typography></TableCell>
                          <TableCell><Typography sx={{ color: "#9ecfca" }}>{sup.name?.ar || "—"}</Typography></TableCell>
                          <TableCell>{sup.contactPerson || "—"}</TableCell>
                          <TableCell>{sup.phone || "—"}</TableCell>
                          <TableCell>{sup.email || "—"}</TableCell>
                          <TableCell><StatusBadge $status={sup.paymentTerms} label={sup.paymentTerms} size="small" /></TableCell>
                          <TableCell><StatusBadge $status={sup.status} label={sup.status} size="small" /></TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <ActionButton $variant="warning" size="small" onClick={() => openEditSupplier(sup)}>Edit</ActionButton>
                              <ActionButton $variant="danger" size="small" onClick={() => handleDeleteSupplier(sup)}>Del</ActionButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}

          {/* ───── Goods Receipts Tab ───── */}
          {tab === 2 && (
            <Box>
              <Box sx={{ p: "16px 20px", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <Typography sx={{ color: "#4a6080", fontSize: "13px" }}>Select a PO from the Purchase Orders tab to create a goods receipt</Typography>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Receipt #</TableCell>
                      <TableCell>PO #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Movements</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pos.map((po) => (
                      <TableRow key={`gr-${po.id}`} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgba(15,184,166,0.09)" } }}>
                        <TableCell colSpan={6}>
                          <Typography sx={{ color: "#4a6080", fontStyle: "italic", fontSize: "12px" }}>
                            Click "View" on PO #{po.poNumber} to see receipts, or use the "Receive" action
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pos.length === 0 && (
                      <TableRow><TableCell colSpan={6}><EmptyState><Typography sx={{ fontSize: 40, mb: 1, opacity: 0.3 }}>📦</Typography><Typography sx={{ color: "#4a6080", fontWeight: 600 }}>No goods receipts yet</Typography></EmptyState></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}
        </GlassPanel>
      </ContentWrapper>

      {/* ───── PO Dialog ───── */}
      <StyledDialog open={poDialog} onClose={() => setPODialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Purchase Order</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Supplier *</InputLabel>
            <StyledSelect label="Supplier *" value={poForm.supplierId} onChange={(e) => setPOForm((p) => ({ ...p, supplierId: e.target.value }))}>
              {suppliers.filter((s) => s.status === "ACTIVE").map((s) => <MenuItem key={s.id} value={s.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{getLang(s.name)}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          {field("Expected Date", "expectedDate", poForm, setPOForm, { type: "date", InputLabelProps: { shrink: true } })}
          {field("Notes", "notes", poForm, setPOForm)}
          {field("Terms", "terms", poForm, setPOForm)}

          <Typography sx={{ color: "#2dd4bf", fontSize: "13px", fontWeight: 700, mt: 3, mb: 1 }}>Line Items</Typography>
          {poForm.items.map((item, idx) => (
            <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center" }}>
              <FormControl sx={{ minWidth: 180 }}>
                <StyledSelect size="small" displayEmpty value={item.inventoryItemId || ""} onChange={(e) => selectItemForPO(idx, e.target.value)}>
                  <MenuItem value="" sx={{ backgroundColor: "#0f1e36", color: "#4a6080" }}>Ad-hoc item</MenuItem>
                  {items.filter((i) => i.status === "ACTIVE").map((i) => <MenuItem key={i.id} value={i.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{i.SKU} — {getLang(i.name)}</MenuItem>)}
                </StyledSelect>
              </FormControl>
              <StyledField size="small" label="Name" value={typeof item.itemName === "object" ? getLang(item.itemName) : item.itemName} onChange={(e) => updatePOItem(idx, "itemName", e.target.value)} sx={{ minWidth: 160 }} />
              <StyledField size="small" label="Qty" type="number" value={item.quantityOrdered} onChange={(e) => updatePOItem(idx, "quantityOrdered", Number(e.target.value))} sx={{ maxWidth: 80 }} />
              <StyledField size="small" label="Unit Cost" type="number" value={item.unitCost} onChange={(e) => updatePOItem(idx, "unitCost", Number(e.target.value))} sx={{ maxWidth: 100 }} />
              <Typography sx={{ color: "#34d399", fontSize: "13px", fontWeight: 600, minWidth: 70 }}>
                {(item.quantityOrdered * item.unitCost).toFixed(2)}
              </Typography>
              <IconButton size="small" onClick={() => removePOItem(idx)} sx={{ color: "#f87171" }}>✕</IconButton>
            </Box>
          ))}
          <ActionButton size="small" onClick={addPOItem}>+ Add Item</ActionButton>

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => setPODialog(false)}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreatePO}>Create PO</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── PO Detail Dialog ───── */}
      <StyledDialog open={poDetailOpen} onClose={() => { setPODetailOpen(false); setSelectedPO(null); }} maxWidth="md" fullWidth>
        <DialogTitle>PO {selectedPO?.poNumber || ""}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          {selectedPO && (
            <>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>Status: <StatusBadge $status={selectedPO.status} label={selectedPO.status} size="small" sx={{ ml: 1 }} /></Typography>
                <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>Supplier: <span style={{ color: "#dde6f0" }}>{selectedPO.supplierName}</span></Typography>
                <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>Total: <span style={{ color: "#34d399" }}>{selectedPO.totalAmount?.toFixed(2)}</span></Typography>
              </Box>

              <Typography sx={{ color: "#2dd4bf", fontSize: "13px", fontWeight: 700, mb: 1 }}>Items</Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Item</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>SKU</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Ordered</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Received</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Pending</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Progress</TableCell>
                    <TableCell sx={{ color: "#2dd4bf", fontSize: "10px" }}>Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPO.items?.map((item) => {
                    const pct = item.quantityOrdered > 0 ? Math.round((item.quantityReceived / item.quantityOrdered) * 100) : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell><Typography sx={{ color: "#dde6f0", fontSize: "12px" }}>{item.itemName}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontFamily: "monospace", fontSize: "12px" }}>{item.SKU || "—"}</Typography></TableCell>
                        <TableCell>{item.quantityOrdered}</TableCell>
                        <TableCell>{item.quantityReceived}</TableCell>
                        <TableCell>{item.quantityPending}</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, backgroundColor: "#0f1e36", borderRadius: 4, height: 6, "& .MuiLinearProgress-bar": { backgroundColor: pct >= 100 ? "#34d399" : "#60a5fa", borderRadius: 4 } }} />
                            <Typography sx={{ color: "#4a6080", fontSize: "11px", minWidth: 35 }}>{pct}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{(item.unitCost || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {poGRs.length > 0 && (
                <>
                  <Typography sx={{ color: "#2dd4bf", fontSize: "13px", fontWeight: 700, mb: 1 }}>Goods Receipts</Typography>
                  {poGRs.map((gr) => (
                    <Box key={gr.id} sx={{ display: "flex", gap: 2, mb: 1, p: 1.5, backgroundColor: "rgba(8,16,32,0.5)", borderRadius: 2 }}>
                      <Typography sx={{ fontFamily: "monospace", fontSize: "12px", color: "#34d399" }}>{gr.receiptNumber}</Typography>
                      <Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{gr.receivedDate}</Typography>
                      <StatusBadge $status={gr.status} label={gr.status} size="small" sx={{ height: 22, minWidth: 60, fontSize: "9px" }} />
                      {gr.status === "DRAFT" && <ActionButton size="small" onClick={() => handleCompleteGR(gr.id)}>Complete</ActionButton>}
                    </Box>
                  ))}
                </>
              )}

              <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                {selectedPO.status === "DRAFT" && <><ActionButton $variant="primary" size="small" onClick={() => handlePOAction("submit", selectedPO)}>Submit</ActionButton><ActionButton $variant="danger" size="small" onClick={() => handlePOAction("cancel", selectedPO)}>Cancel</ActionButton></>}
                {selectedPO.status === "SUBMITTED" && <><ActionButton $variant="approve" size="small" onClick={() => handlePOAction("approve", selectedPO)}>Approve</ActionButton><ActionButton $variant="danger" size="small" onClick={() => handlePOAction("cancel", selectedPO)}>Cancel</ActionButton></>}
                {selectedPO.status === "APPROVED" && <ActionButton $variant="primary" size="small" onClick={() => handlePOAction("order", selectedPO)}>Mark Ordered</ActionButton>}
                {selectedPO.status === "ORDERED" && <ActionButton $variant="primary" size="small" onClick={() => openGRDialog(selectedPO.id)}>Create Receipt</ActionButton>}
                {(selectedPO.status === "RECEIVED" || selectedPO.status === "PARTIALLY_RECEIVED") && <ActionButton size="small" onClick={() => handlePOAction("close", selectedPO)}>Close</ActionButton>}
              </Box>
            </>
          )}
        </DialogContent>
      </StyledDialog>

      {/* ───── Supplier Dialog ───── */}
      <StyledDialog open={supDialog} onClose={() => { setSupDialog(false); setEditSup(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editSup ? "Edit Supplier" : "New Supplier"}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Supplier Name" labelAr="اسم المورد" value={supForm.name} onChange={(v) => setSupForm((p) => ({ ...p, name: v }))} required />
          {field("Contact Person", "contactPerson", supForm, setSupForm)}
          {field("Email", "email", supForm, setSupForm, { type: "email" })}
          {field("Phone", "phone", supForm, setSupForm)}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Payment Terms</InputLabel>
            <StyledSelect label="Payment Terms" value={supForm.paymentTerms} onChange={(e) => setSupForm((p) => ({ ...p, paymentTerms: e.target.value }))}>
              {PAYMENT_TERMS.map((t) => <MenuItem key={t} value={t} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{t}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => { setSupDialog(false); setEditSup(null); }}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreateSupplier}>{editSup ? "Save Changes" : "Create Supplier"}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── GR Dialog ───── */}
      <StyledDialog open={grDialog} onClose={() => setGRDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Goods Receipt</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Purchase Order *</InputLabel>
            <StyledSelect label="Purchase Order *" value={grForm.poId} onChange={(e) => { setGRForm((p) => ({ ...p, poId: e.target.value })); loadGRItems(e.target.value); }}>
              {pos.filter((p) => p.status === "ORDERED" || p.status === "PARTIALLY_RECEIVED").map((po) => (
                <MenuItem key={po.id} value={po.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{po.poNumber} — {po.supplierName}</MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
          {field("Received Date", "receivedDate", grForm, setGRForm, { type: "date", InputLabelProps: { shrink: true } })}
          {field("Reference #", "referenceNumber", grForm, setGRForm, { placeholder: "Supplier invoice / DN number" })}
          {field("Notes", "notes", grForm, setGRForm)}

          {grForm.items.length > 0 && (
            <>
              <Typography sx={{ color: "#2dd4bf", fontSize: "13px", fontWeight: 700, mt: 2, mb: 1 }}>Receive Items</Typography>
              {grForm.items.map((item, idx) => {
                const po = pos.find((p) => p.id === grForm.poId);
                const poItem = po?.items?.[idx];
                return (
                  <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
                    <Typography sx={{ color: "#dde6f0", fontSize: "12px", minWidth: 140 }}>{poItem?.itemName || `Item ${idx + 1}`}</Typography>
                    <Typography sx={{ color: "#4a6080", fontSize: "11px", minWidth: 60 }}>Pending: {poItem?.quantityPending || 0}</Typography>
                    <StyledField size="small" label="Receive" type="number" value={item.quantityReceived} onChange={(e) => updateGRItem(idx, "quantityReceived", Number(e.target.value))} sx={{ maxWidth: 80 }} />
                  </Box>
                );
              })}
            </>
          )}

          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => setGRDialog(false)}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreateGR}>Create Receipt</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}
