# Component Tree

## Root Hierarchy

main.jsx
  StrictMode
    App
      BrowserRouter
        Routes
          /login -> Login
          /register -> AdminRegister
          / -> RequireAuth
            SidebarLayout (SidebarCtx.Provider)
              Sidebar
              main (MUI Box)
                Outlet
                  /tenants   -> Tenants
                  /doctors   -> Doctors
                  /licenses  -> Licenses
                  /updates   -> Updates
                  /settings  -> Settings
          * -> Navigate to /login

## Component Details

### App.jsx (Root)
- Imports: BrowserRouter, Routes, Route, Navigate, Outlet
- Imports: useState, useEffect, createContext, useContext
- Imports: onAuthStateChanged from firebase/auth, auth from ./firebase
- Creates: SidebarCtx (createContext)
- Exports: default App, Hamburger (re-export), useSidebar hook

### Sidebar.jsx (257 lines)
Location: src/components/Sidebar.jsx

Props: none (reads from SidebarCtx)

Internal State:
  - activeItem: string (currently active nav item)

Structure:
  Box (fixed, 240px)
    Drawer (mobile overlay)
      Stack (logo + brand)
        Logo image + "Smart Clinic" text
        Divider
        Nav items (6x NavLink with lucide-react icons)
          Dashboard    -> /tenants
          Clinics      -> /tenants
          Doctors      -> /doctors
          Licenses     -> /licenses
          Updates      -> /updates
          Settings     -> /settings
        Spacer
        Divider
        Admin info (from localStorage "clinic_admin_user")
        Logout button (signOut + clear localStorage + navigate /login)

Exports:
  default -> Sidebar
  named   -> Hamburger (icon button for mobile toggle)

### PageShells.jsx (273 lines)
Location: src/pages/components/shared/PageShells.jsx

Shared components used across pages:
  PageContainer    MUI Box (maxWidth 1400px, padding)
  TopBar           MUI Stack (title + action button)
  ContentWrapper   MUI Paper (rounded, padding)
  GlassPanel       MUI Box (frosted glass effect)
  StatCard         MUI Paper (icon + label + value, colored accent border)
  EmptyState       MUI Stack (icon, title, description, action button)
  ActionButton     MUI Button (with loading + icon support)
  StatusBadge      MUI Chip (colored by status value)
  ClickableStatus  StatusBadge wrapped in IconButton for toggle
  StyledTableContainer  TableContainer + Table + styling

MUI sx objects:
  dialogPaperSx    Standard dialog paper styling
  dialogTitleSx    Standard dialog title styling
  sharedFieldSx    Standard form field width (100%)

## Shared Patterns Across Pages

All CRUD pages (Tenants, Doctors, Licenses, Updates) follow this pattern:

  State:
    items[]           Data array
    loading           Boolean
    error             String or null
    createOpen        Dialog open state
    editOpen          Dialog open state
    deleteConfirm     Doc ID to delete
    formData          Create form values
    editData          Edit form values

  Lifecycle:
    useEffect -> fetch data on mount
    Create -> set formData -> validate -> firestoreService.create* -> refetch
    Edit  -> set editTarget -> populate form -> firestoreService.update* -> refetch
    Delete -> set deleteConfirm -> confirm -> firestoreService.delete* -> refetch

  States:
    loading  -> MUI Skeleton (StyledTableContainer with skeleton rows)
    empty    -> EmptyState component
    error    -> Alert with message + retry button
    loaded   -> Data table + stats

## MUI Components Used

  @mui/material:
    Box, Stack, Paper, Table, TableContainer, TableHead, TableBody,
    TableRow, TableCell, TablePagination, Button, IconButton,
    TextField, Select, MenuItem, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Switch, Skeleton, Alert, CircularProgress,
    Snackbar, Tooltip, LinearProgress, Avatar, Grid, Typography

  @mui/icons-material (via lucide-react instead):
    lucide-react used for all custom icons (no @mui/icons-material)
    Icons: LayoutDashboard, Building2, Stethoscope, Key, Package,
           Settings, LogOut, Menu, Plus, Edit3, Trash2, Search,
           ChevronLeft, ChevronRight, Check, X, AlertCircle, etc.
