import { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";

const NotificationCtx = createContext(null);

const DURATIONS = { success: 3000, error: 6000, info: 4000, warning: 5000 };

export function NotificationProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [duration, setDuration] = useState(4000);

  const showNotification = useCallback((msg, sev = "info", opts = {}) => {
    setMessage(msg);
    setSeverity(sev);
    setDuration(opts.duration ?? DURATIONS[sev] ?? 4000);
    setOpen(true);
  }, []);

  const handleClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setOpen(false);
  }, []);

  return (
    <NotificationCtx.Provider value={{ showNotification }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ "& .MuiSnackbar-root": { bottom: { xs: 72, sm: 24 } } }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          sx={{
            minWidth: 280, borderRadius: "10px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            fontWeight: 500, fontSize: "13px",
            ...(severity === "success" && {
              backgroundColor: "#0d6832",
              color: "#d1fae5",
              "& .MuiAlert-icon": { color: "#34d399" },
            }),
            ...(severity === "error" && {
              backgroundColor: "#7f1d1d",
              color: "#fecaca",
              "& .MuiAlert-icon": { color: "#f87171" },
            }),
            ...(severity === "info" && {
              backgroundColor: "#0e3a5c",
              color: "#bae6fd",
              "& .MuiAlert-icon": { color: "#38bdf8" },
            }),
            ...(severity === "warning" && {
              backgroundColor: "#5c3d0e",
              color: "#fde68a",
              "& .MuiAlert-icon": { color: "#fbbf24" },
            }),
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationCtx.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationCtx);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}

export default NotificationProvider;
