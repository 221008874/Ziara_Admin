import { useState, useEffect, useMemo } from "react";
import {
  getAllCategories, createCategory, updateCategory, deleteCategory,
  getAllItems, createItem, updateItem, deleteItem, getItemById,
  createMovement, getAllMovements, getMovementsByItem,
  createAdjustment, approveAdjustment, rejectAdjustment, getPendingAdjustments, getAllAdjustments,
  createStockCount, updateStockCountItems, completeStockCount, reconcileStockCount, getAllStockCounts,
} from "../services/firestoreService";
import {
  MOVEMENT_TYPES, ITEM_UNITS, ADJUSTMENT_REASONS, ITEM_STATUSES, CATEGORY_STATUSES,
  STOCK_COUNT_STATUSES, ADJUSTMENT_STATUSES, validateSKU, validateQuantity, validateInventoryItem, validateCategory,
} from "../lib/inventoryValidation";
import { getLang, isBilingual, BilingualInput } from "../lib/i18n";
import { debug } from "../lib/debug";
import { useSidebar } from "../App";
import { Hamburger } from "../components/Sidebar";
const logo = "/favicon.svg";
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent,
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Box, Typography, Chip, Tabs, Tab,
  IconButton, Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";

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
  ...($status === "ACTIVE" ? { backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399", border: "1px solid rgba(52,211,153,0.28)" }
  : $status === "INACTIVE" || $status === "SCHEDULED" ? { backgroundColor: "rgba(148,163,184,0.14)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.28)" }
  : $status === "DELETED" || $status === "REJECTED" ? { backgroundColor: "rgba(248,113,113,0.14)", color: "#f87171", border: "1px solid rgba(248,113,113,0.28)" }
  : $status === "OUT_OF_STOCK" ? { backgroundColor: "rgba(250,204,21,0.14)", color: "#eab308", border: "1px solid rgba(250,204,21,0.28)" }
  : $status === "PENDING" ? { backgroundColor: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.28)" }
  : $status === "COMPLETED" || $status === "APPROVED" ? { backgroundColor: "rgba(52,211,153,0.14)", color: "#34d399", border: "1px solid rgba(52,211,153,0.28)" }
  : $status === "RECONCILED" ? { backgroundColor: "rgba(99,102,241,0.14)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.28)" }
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

export default function Inventory() {
  const { toggle } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  const adminUser = localStorage.getItem("clinic_admin_logged") ? "admin" : "";
  const tenantId = localStorage.getItem("clinic_admin_tenantId") || "demo";

  // Data
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [stockCounts, setStockCounts] = useState([]);

  // Dialogs
  const [itemDialog, setItemDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [movementDialog, setMovementDialog] = useState(false);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [stockCountDialog, setStockCountDialog] = useState(false);

  // Form state
  const [itemForm, setItemForm] = useState({ name: { en: "", ar: "" }, SKU: "", unit: "", categoryId: "", itemCode: "", reorderLevel: 0, sellingPrice: 0, batchTracked: false, expiryTracked: false });
  const [categoryForm, setCategoryForm] = useState({ name: { en: "", ar: "" }, description: "", parentId: "", sortOrder: 0 });
  const [movementForm, setMovementForm] = useState({ itemId: "", type: "PURCHASE", quantity: 1, unitCost: 0, notes: "" });
  const [adjustmentForm, setAdjustmentForm] = useState({ itemId: "", reason: "MANUAL", actualQty: 0, notes: "" });
  const [stockCountForm, setStockCountForm] = useState({ countDate: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    debug.component("Inventory", "Mounted");
    loadAll();
    return () => debug.component("Inventory", "Unmounted");
  }, []);

  const loadAll = async () => {
    debug.action("Inventory", "Loading all data...");
    try {
      setLoading(true); setError(null);
      const [c, i, m, a, s] = await Promise.all([
        getAllCategories(tenantId).catch(() => []),
        getAllItems(tenantId).catch(() => []),
        getAllMovements(tenantId).catch(() => []),
        getAllAdjustments(tenantId).catch(() => []),
        getAllStockCounts(tenantId).catch(() => []),
      ]);
      setCategories(c); setItems(i); setMovements(m); setAdjustments(a); setStockCounts(s);
      debug.action("Inventory", `Loaded ${i.length} items, ${c.length} categories, ${m.length} movements`);
    } catch (e) {
      debug.error("Inventory.loadAll", e);
      setError("Failed to load inventory data");
    } finally { setLoading(false); }
  };

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => { m[c.id] = c; });
    return m;
  }, [categories]);

  // ─── Items ────────────────────────────────────────────────────────────────

  const handleCreateItem = async () => {
    const v = validateInventoryItem(itemForm);
    if (!v.valid) { setError(Object.values(v.errors).flat().join("; ")); return; }
    try {
      setError(null);
      await createItem({ ...itemForm, tenantId, createdBy: adminUser });
      setItemDialog(false);
      setItemForm({ name: { en: "", ar: "" }, SKU: "", unit: "", categoryId: "", itemCode: "", reorderLevel: 0, sellingPrice: 0, batchTracked: false, expiryTracked: false });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleEditItem = async () => {
    if (!editItem) return;
    try {
      setError(null);
      await updateItem(editItem.id, itemForm);
      setItemDialog(false);
      setEditItem(null);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const openEditItem = (item) => {
    setEditItem(item);
    setItemForm({
      name: isBilingual(item.name) ? item.name : { en: item.name || "", ar: "" },
      SKU: item.SKU || "",
      unit: item.unit || "",
      categoryId: item.categoryId || "",
      itemCode: item.itemCode || "",
      reorderLevel: item.reorderLevel || 0,
      sellingPrice: item.sellingPrice || 0,
      batchTracked: item.batchTracked || false,
      expiryTracked: item.expiryTracked || false,
    });
    setItemDialog(true);
  };

  const handleDeleteItem = async (item) => {
    try {
      setError(null);
      await deleteItem(item.id, { tenantId, performedBy: adminUser });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  // ─── Categories ────────────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    const v = validateCategory(categoryForm);
    if (!v.valid) { setError(Object.values(v.errors).flat().join("; ")); return; }
    try {
      setError(null);
      await createCategory({ ...categoryForm, tenantId, createdBy: adminUser });
      setCategoryDialog(false);
      setCategoryForm({ name: { en: "", ar: "" }, description: "", parentId: "", sortOrder: 0 });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleEditCategory = async () => {
    if (!editCategory) return;
    try {
      setError(null);
      await updateCategory(editCategory.id, categoryForm);
      setCategoryDialog(false);
      setEditCategory(null);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const openEditCategory = (cat) => {
    setEditCategory(cat);
    setCategoryForm({
      name: isBilingual(cat.name) ? cat.name : { en: cat.name || "", ar: "" },
      description: cat.description || "",
      parentId: cat.parentId || "",
      sortOrder: cat.sortOrder || 0,
    });
    setCategoryDialog(true);
  };

  const handleDeleteCategory = async (cat) => {
    try {
      setError(null);
      await deleteCategory(cat.id, tenantId);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  // ─── Movements ─────────────────────────────────────────────────────────────

  const handleCreateMovement = async () => {
    const qtyErr = validateQuantity(movementForm.quantity);
    if (qtyErr) { setError(qtyErr); return; }
    if (!movementForm.itemId) { setError("Item is required"); return; }
    try {
      setError(null);
      const qty = Number(movementForm.quantity);
      await createMovement({
        tenantId,
        itemId: movementForm.itemId,
        type: movementForm.type,
        quantity: movementForm.type === "CONSUMPTION" ? qty : qty,
        unitCost: movementForm.type === "PURCHASE" ? Number(movementForm.unitCost) : 0,
        notes: movementForm.notes,
        createdBy: adminUser,
      });
      setMovementDialog(false);
      setMovementForm({ itemId: "", type: "PURCHASE", quantity: 1, unitCost: 0, notes: "" });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  // ─── Adjustments ───────────────────────────────────────────────────────────

  const handleCreateAdjustment = async () => {
    if (!adjustmentForm.itemId) { setError("Item is required"); return; }
    try {
      setError(null);
      const item = items.find((i) => i.id === adjustmentForm.itemId);
      await createAdjustment({
        tenantId,
        itemId: adjustmentForm.itemId,
        reason: adjustmentForm.reason,
        expectedQty: item?.currentStock || 0,
        actualQty: Number(adjustmentForm.actualQty),
        notes: adjustmentForm.notes,
        createdBy: adminUser,
      });
      setAdjustmentDialog(false);
      setAdjustmentForm({ itemId: "", reason: "MANUAL", actualQty: 0, notes: "" });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleApproveAdjustment = async (adj) => {
    try {
      setError(null);
      await approveAdjustment(adj.id, adminUser);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleRejectAdjustment = async (adj) => {
    try {
      setError(null);
      await rejectAdjustment(adj.id);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  // ─── Stock Counts ──────────────────────────────────────────────────────────

  const handleCreateStockCount = async () => {
    if (!stockCountForm.countDate) { setError("Count date is required"); return; }
    try {
      setError(null);
      await createStockCount({ tenantId, countDate: stockCountForm.countDate, createdBy: adminUser });
      setStockCountDialog(false);
      setStockCountForm({ countDate: new Date().toISOString().split("T")[0] });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const handleReconcileStockCount = async (sc) => {
    try {
      setError(null);
      await reconcileStockCount(sc.id, adminUser);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const lowStockCount = items.filter((i) => i.status === "ACTIVE" && i.currentStock <= i.reorderLevel && i.reorderLevel > 0).length;
  const inboundThisMonth = movements.filter((m) => {
    const d = m.createdAt?.toDate?.();
    if (!d) return false;
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && (m.quantity > 0);
  }).reduce((sum, m) => sum + Math.abs(m.quantity), 0);

  if (loading) {
    return (
      <PageContainer sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#0fb8a6" }} size={48} thickness={3} />
      </PageContainer>
    );
  }

  const field = (label, key, obj, set, opts = {}) => (
    <StyledField fullWidth label={label} margin="normal" value={obj[key]} onChange={(e) => set((p) => ({ ...p, [key]: e.target.value }))} {...opts} />
  );

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
            <Typography sx={{ color: "#eaf2ff", fontWeight: 700, fontSize: { xs: "15px", sm: "18px" } }}>Inventory Management</Typography>
            <Typography sx={{ color: "#4a6080", fontSize: "11px", fontStyle: "italic" }}>Manage stock, categories, and movements</Typography>
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
            { label: "Total Items", value: items.filter((i) => i.status !== "DELETED").length, color: "#2dd4bf" },
            { label: "Low Stock", value: lowStockCount, color: lowStockCount > 0 ? "#f59e0b" : "#34d399" },
            { label: "Categories", value: categories.filter((c) => c.status !== "DELETED").length, color: "#60a5fa" },
            { label: "Inbound This Month", value: inboundThisMonth > 0 ? `${inboundThisMonth} units` : "0", color: "#34d399" },
          ].map((s) => (
            <StatCard key={s.label}>
              <Typography sx={{ color: "#4a6080", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ color: s.color, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{s.value}</Typography>
            </StatCard>
          ))}
        </Box>

        <GlassPanel>
          <StyledTabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Items (${items.filter(i => i.status !== "DELETED").length})`} />
            <Tab label={`Categories (${categories.filter(c => c.status !== "DELETED").length})`} />
            <Tab label={`Movements (${movements.length})`} />
            <Tab label={`Adjustments (${adjustments.length})`} />
            <Tab label={`Stock Counts (${stockCounts.length})`} />
          </StyledTabs>

          {/* ───── Items Tab ───── */}
          {tab === 0 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, alignItems: "center", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <StyledField size="small" placeholder="Search items..." sx={{ maxWidth: 280 }} value={""} onChange={() => {}} />
                <ActionButton $variant="primary" onClick={() => { setEditItem(null); setItemForm({ name: { en: "", ar: "" }, SKU: "", unit: "", categoryId: "", itemCode: "", reorderLevel: 0, sellingPrice: 0, batchTracked: false, expiryTracked: false }); setItemDialog(true); }}>+ New Item</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Stock</TableCell>
                      <TableCell>Reorder</TableCell>
                      <TableCell>Avg Cost</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.filter((i) => i.status !== "DELETED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <EmptyState>
                            <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📦</Typography>
                            <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No items yet</Typography>
                            <Typography sx={{ color: "#283848", fontSize: "13px" }}>Click "+ New Item" to add your first inventory item</Typography>
                          </EmptyState>
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.filter((i) => i.status !== "DELETED").map((item) => {
                        const stockStatus = item.currentStock <= 0 ? "#f87171" : item.currentStock <= item.reorderLevel && item.reorderLevel > 0 ? "#f59e0b" : "#34d399";
                        return (
                          <TableRow key={item.id}>
                            <TableCell><Typography sx={{ fontFamily: "monospace", color: "#34d399", fontWeight: 600 }}>{item.SKU}</Typography></TableCell>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>{getLang(item.name)}</Typography>
                              {item.name?.ar && <Typography sx={{ fontSize: "12px", color: "#9ecfca" }}>{item.name.ar}</Typography>}
                            </TableCell>
                            <TableCell>{catMap[item.categoryId] ? getLang(catMap[item.categoryId].name) : "—"}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell><Typography sx={{ color: stockStatus, fontWeight: 700 }}>{item.currentStock}</Typography></TableCell>
                            <TableCell>{item.reorderLevel > 0 ? item.reorderLevel : "—"}</TableCell>
                            <TableCell>{item.averageCost ? `${item.averageCost.toFixed(2)}` : "0.00"}</TableCell>
                            <TableCell>{item.sellingPrice ? `${item.sellingPrice.toFixed(2)}` : "—"}</TableCell>
                            <TableCell><StatusBadge $status={item.status} label={item.status} size="small" /></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                                <Tooltip title="Add Stock">
                                  <ActionButton $variant="primary" size="small" onClick={() => { setMovementForm({ ...movementForm, itemId: item.id, type: "PURCHASE" }); setMovementDialog(true); }}>+Stock</ActionButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <ActionButton $variant="secondary" size="small" onClick={() => openEditItem(item)}>Edit</ActionButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <ActionButton $variant="danger" size="small" onClick={() => handleDeleteItem(item)}>Del</ActionButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}

          {/* ───── Categories Tab ───── */}
          {tab === 1 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, alignItems: "center", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => { setEditCategory(null); setCategoryForm({ name: { en: "", ar: "" }, description: "", parentId: "", sortOrder: 0 }); setCategoryDialog(true); }}>+ New Category</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name (EN)</TableCell>
                      <TableCell>Name (AR)</TableCell>
                      <TableCell>Items Count</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Sort Order</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.filter((c) => c.status !== "DELETED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState>
                            <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📂</Typography>
                            <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No categories yet</Typography>
                          </EmptyState>
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.filter((c) => c.status !== "DELETED").map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell><Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>{cat.name?.en || "—"}</Typography></TableCell>
                          <TableCell><Typography sx={{ color: "#9ecfca" }}>{cat.name?.ar || "—"}</Typography></TableCell>
                          <TableCell>{items.filter((i) => i.categoryId === cat.id).length}</TableCell>
                          <TableCell><StatusBadge $status={cat.status} label={cat.status} size="small" /></TableCell>
                          <TableCell>{cat.sortOrder || 0}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <ActionButton $variant="warning" size="small" onClick={() => openEditCategory(cat)}>Edit</ActionButton>
                              <ActionButton $variant="danger" size="small" onClick={() => handleDeleteCategory(cat)}>Del</ActionButton>
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

          {/* ───── Movements Tab ───── */}
          {tab === 2 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, alignItems: "center", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => { setMovementForm({ itemId: "", type: "PURCHASE", quantity: 1, unitCost: 0, notes: "" }); setMovementDialog(true); }}>+ New Movement</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Stock Before → After</TableCell>
                      <TableCell>Unit Cost</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell>By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <EmptyState>
                            <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>🔄</Typography>
                            <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No movements yet</Typography>
                          </EmptyState>
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.slice(0, 100).map((m) => {
                        const isInbound = m.quantity > 0;
                        return (
                          <TableRow key={m.id}>
                            <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{m.createdAt?.toDate?.().toLocaleDateString() || "—"}</Typography></TableCell>
                            <TableCell><StatusBadge $status={m.type} label={m.type} size="small" /></TableCell>
                            <TableCell>{items.find((i) => i.id === m.itemId)?.SKU || m.itemId?.slice(0, 8) || "—"}</TableCell>
                            <TableCell><Typography sx={{ color: isInbound ? "#34d399" : "#f87171", fontWeight: 700 }}>{isInbound ? `+${m.quantity}` : m.quantity}</Typography></TableCell>
                            <TableCell>{m.stockBefore} → {m.stockAfter}</TableCell>
                            <TableCell>{m.unitCost ? `${m.unitCost.toFixed(2)}` : "—"}</TableCell>
                            <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.notes || "—"}</Typography></TableCell>
                            <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{m.createdBy?.slice(0, 8) || "—"}</Typography></TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}

          {/* ───── Adjustments Tab ───── */}
          {tab === 3 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, alignItems: "center", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => { setAdjustmentForm({ itemId: "", reason: "MANUAL", actualQty: 0, notes: "" }); setAdjustmentDialog(true); }}>+ New Adjustment</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Expected → Actual</TableCell>
                      <TableCell>Difference</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <EmptyState>
                            <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📐</Typography>
                            <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No adjustments yet</Typography>
                          </EmptyState>
                        </TableCell>
                      </TableRow>
                    ) : (
                      adjustments.map((adj) => (
                        <TableRow key={adj.id}>
                          <TableCell><Typography sx={{ fontSize: "12px", color: "#4a6080" }}>{adj.createdAt?.toDate?.().toLocaleDateString() || "—"}</Typography></TableCell>
                          <TableCell>{items.find((i) => i.id === adj.itemId)?.SKU || adj.itemId?.slice(0, 8) || "—"}</TableCell>
                          <TableCell><StatusBadge $status={adj.reason} label={adj.reason} size="small" /></TableCell>
                          <TableCell>{adj.expectedQty} → {adj.actualQty}</TableCell>
                          <TableCell><Typography sx={{ color: adj.difference >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{adj.difference >= 0 ? `+${adj.difference}` : adj.difference}</Typography></TableCell>
                          <TableCell><StatusBadge $status={adj.status} label={adj.status} size="small" /></TableCell>
                          <TableCell align="right">
                            {adj.status === "PENDING" && (
                              <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                                <ActionButton $variant="approve" size="small" onClick={() => handleApproveAdjustment(adj)}>Approve</ActionButton>
                                <ActionButton $variant="danger" size="small" onClick={() => handleRejectAdjustment(adj)}>Reject</ActionButton>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}

          {/* ───── Stock Counts Tab ───── */}
          {tab === 4 && (
            <Box>
              <Box sx={{ p: "16px 20px", display: "flex", gap: 2, alignItems: "center", borderBottom: "1px solid rgba(15,184,166,0.06)" }}>
                <ActionButton $variant="primary" onClick={() => { setStockCountForm({ countDate: new Date().toISOString().split("T")[0] }); setStockCountDialog(true); }}>+ Schedule Count</ActionButton>
              </Box>
              <StyledTableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Items Counted</TableCell>
                      <TableCell>Discrepancies</TableCell>
                      <TableCell>Reconciled</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockCounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState>
                            <Typography sx={{ fontSize: "40px", mb: 1, opacity: 0.3 }}>📋</Typography>
                            <Typography sx={{ color: "#4a6080", fontWeight: 600, fontSize: "15px", mb: 0.5 }}>No stock counts yet</Typography>
                            <Typography sx={{ color: "#283848", fontSize: "13px" }}>Schedule a physical stock count to track discrepancies</Typography>
                          </EmptyState>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockCounts.map((sc) => (
                        <TableRow key={sc.id}>
                          <TableCell><Typography sx={{ fontWeight: 600, color: "#eaf2ff" }}>{sc.countDate || "—"}</Typography></TableCell>
                          <TableCell><StatusBadge $status={sc.status} label={sc.status} size="small" /></TableCell>
                          <TableCell>{sc.items?.length || 0}</TableCell>
                          <TableCell>{sc.totalDiscrepancy || 0}</TableCell>
                          <TableCell>
                            <Typography sx={{ color: sc.reconciledAt ? "#34d399" : "#4a6080", fontSize: "12px" }}>
                              {sc.reconciledAt?.toDate?.().toLocaleDateString() || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {sc.status === "COMPLETED" && (
                              <ActionButton $variant="primary" size="small" onClick={() => handleReconcileStockCount(sc)}>Reconcile</ActionButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            </Box>
          )}
        </GlassPanel>
      </ContentWrapper>

      {/* ───── Item Dialog ───── */}
      <StyledDialog open={itemDialog} onClose={() => { setItemDialog(false); setEditItem(null); }} maxWidth="md" fullWidth>
        <DialogTitle>{editItem ? "Edit Item" : "New Item"}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Item Name" labelAr="اسم الصنف" value={itemForm.name} onChange={(v) => setItemForm((p) => ({ ...p, name: v }))} required />
          {field("SKU *", "SKU", itemForm, setItemForm, { placeholder: "e.g. MED-GAUZE-001" })}
          {field("Item Code", "itemCode", itemForm, setItemForm, { placeholder: "Optional internal code" })}
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Category *</InputLabel>
            <StyledSelect label="Category *" value={itemForm.categoryId} onChange={(e) => setItemForm((p) => ({ ...p, categoryId: e.target.value }))}>
              {categories.filter((c) => c.status !== "DELETED").map((c) => <MenuItem key={c.id} value={c.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{getLang(c.name)}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Unit *</InputLabel>
            <StyledSelect label="Unit *" value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))}>
              {ITEM_UNITS.map((u) => <MenuItem key={u} value={u} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{u}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          {field("Reorder Level", "reorderLevel", itemForm, setItemForm, { type: "number" })}
          {field("Selling Price", "sellingPrice", itemForm, setItemForm, { type: "number" })}
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => { setItemDialog(false); setEditItem(null); }}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={editItem ? handleEditItem : handleCreateItem}>{editItem ? "Save Changes" : "Create Item"}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── Category Dialog ───── */}
      <StyledDialog open={categoryDialog} onClose={() => { setCategoryDialog(false); setEditCategory(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editCategory ? "Edit Category" : "New Category"}</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <BilingualInput label="Category Name" labelAr="اسم الفئة" value={categoryForm.name} onChange={(v) => setCategoryForm((p) => ({ ...p, name: v }))} required />
          {field("Description", "description", categoryForm, setCategoryForm)}
          {field("Sort Order", "sortOrder", categoryForm, setCategoryForm, { type: "number" })}
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => { setCategoryDialog(false); setEditCategory(null); }}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={editCategory ? handleEditCategory : handleCreateCategory}>{editCategory ? "Save Changes" : "Create Category"}</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── Movement Dialog ───── */}
      <StyledDialog open={movementDialog} onClose={() => setMovementDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Movement</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Item *</InputLabel>
            <StyledSelect label="Item *" value={movementForm.itemId} onChange={(e) => setMovementForm((p) => ({ ...p, itemId: e.target.value }))}>
              {items.filter((i) => i.status === "ACTIVE").map((i) => <MenuItem key={i.id} value={i.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{i.SKU} — {getLang(i.name)}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Movement Type *</InputLabel>
            <StyledSelect label="Movement Type *" value={movementForm.type} onChange={(e) => setMovementForm((p) => ({ ...p, type: e.target.value }))}>
              {MOVEMENT_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{t}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          {field("Quantity *", "quantity", movementForm, setMovementForm, { type: "number" })}
          {movementForm.type === "PURCHASE" && field("Unit Cost", "unitCost", movementForm, setMovementForm, { type: "number" })}
          {field("Notes", "notes", movementForm, setMovementForm)}
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => setMovementDialog(false)}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreateMovement}>Create Movement</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── Adjustment Dialog ───── */}
      <StyledDialog open={adjustmentDialog} onClose={() => setAdjustmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Adjustment</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Item *</InputLabel>
            <StyledSelect label="Item *" value={adjustmentForm.itemId} onChange={(e) => setAdjustmentForm((p) => ({ ...p, itemId: e.target.value }))}>
              {items.filter((i) => i.status === "ACTIVE").map((i) => <MenuItem key={i.id} value={i.id} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{i.SKU} — {getLang(i.name)}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: "#3a5070", fontSize: "12px", fontWeight: 600, "&.Mui-focused": { color: "#0fb8a6" } }}>Reason *</InputLabel>
            <StyledSelect label="Reason *" value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((p) => ({ ...p, reason: e.target.value }))}>
              {ADJUSTMENT_REASONS.map((r) => <MenuItem key={r} value={r} sx={{ backgroundColor: "#0f1e36", color: "#dde6f0" }}>{r}</MenuItem>)}
            </StyledSelect>
          </FormControl>
          {adjustmentForm.itemId && (
            <StyledField fullWidth label="Expected Qty" margin="normal" value={items.find((i) => i.id === adjustmentForm.itemId)?.currentStock || 0} disabled />
          )}
          {field("Actual Qty *", "actualQty", adjustmentForm, setAdjustmentForm, { type: "number" })}
          {field("Notes", "notes", adjustmentForm, setAdjustmentForm)}
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => setAdjustmentDialog(false)}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreateAdjustment}>Create Adjustment</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>

      {/* ───── Stock Count Dialog ───── */}
      <StyledDialog open={stockCountDialog} onClose={() => setStockCountDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Schedule Stock Count</DialogTitle>
        <DialogContent sx={{ p: "24px", backgroundColor: "#0b1628" }}>
          {field("Count Date *", "countDate", stockCountForm, setStockCountForm, { type: "date", InputLabelProps: { shrink: true } })}
          <Box sx={{ mt: 3, display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            <ActionButton $variant="secondary" onClick={() => setStockCountDialog(false)}>Cancel</ActionButton>
            <ActionButton $variant="primary" onClick={handleCreateStockCount}>Schedule</ActionButton>
          </Box>
        </DialogContent>
      </StyledDialog>
    </PageContainer>
  );
}
