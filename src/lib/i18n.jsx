import { Box, Typography } from "@mui/material";

/* eslint-disable react-refresh/only-export-components */

// ─── Bilingual field helpers (EN/AR) ──────────────────────────────────────

export const createBilingual = (en = "", ar = "") => ({ en, ar });

export const isBilingual = (v) =>
  v !== null && typeof v === "object" && "en" in v && "ar" in v;

export const getLang = (field, lang = "en") => {
  if (isBilingual(field)) return field[lang] || field.en || "";
  return typeof field === "string" ? field : "";
};

export const updateBilingual = (field, lang, value) => {
  if (isBilingual(field)) return { ...field, [lang]: value };
  return { en: lang === "en" ? value : getLang(field, "en"), ar: lang === "ar" ? value : getLang(field, "ar") };
};

// ─── MUI Bilingual Input (two side-by-side fields) ───────────────────────

export function BilingualInput({ label, labelAr, value, onChange, required, placeholder, placeholderAr, type, helperText }) {
  const enVal = getLang(value, "en");
  const arVal = getLang(value, "ar");

  const handleEn = (e) => onChange(updateBilingual(value, "en", e.target.value));
  const handleAr = (e) => onChange(updateBilingual(value, "ar", e.target.value));

  return (
    <Box sx={{ mt: 2, mb: 1 }}>
      <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: "#3a5070", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>
            {label} {required ? "*" : ""}
          </Typography>
          <input
            type={type || "text"}
            value={enVal}
            placeholder={placeholder || label}
            onChange={handleEn}
            required={required}
            style={{
              width: "100%", padding: "10px 14px", backgroundColor: "#0f1e36",
              border: "1px solid rgba(15,184,166,0.18)", borderRadius: "10px",
              color: "#dde6f0", fontSize: "14px", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: "#3a5070", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", mb: 0.5 }}>
            {labelAr || label} (العربية)
          </Typography>
          <input
            type={type || "text"}
            value={arVal}
            placeholder={placeholderAr || labelAr || label}
            onChange={handleAr}
            required={required}
            dir="rtl"
            style={{
              width: "100%", padding: "10px 14px", backgroundColor: "#0f1e36",
              border: "1px solid rgba(15,184,166,0.18)", borderRadius: "10px",
              color: "#dde6f0", fontSize: "14px", outline: "none", textAlign: "right",
              boxSizing: "border-box",
            }}
          />
        </Box>
      </Box>
      {helperText && (
        <Typography sx={{ color: "#4a6080", fontSize: "11px", mt: 0.5 }}>{helperText}</Typography>
      )}
    </Box>
  );
}
