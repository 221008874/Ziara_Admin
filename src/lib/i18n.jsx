// src/lib/i18n.jsx
//
// KEY FIX: BilingualInput is now FULLY CONTROLLED — no useState inside.
// The old version (with useState initialized from props) caused the
// "text typed in one field appears in another" bug because:
//   1. React reuses component instances between renders (no remount)
//   2. useState only runs its initialiser ONCE per mount
//   3. Multiple BilingualInput instances in one form shared stale state
//      when the parent reset formData to BLANK
//
// Solution: read directly from props.value every render, call onChange
// for every keystroke. Parent owns all state — zero duplication.

import { Box, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Always returns a FRESH object — never reuse a reference.
 * Pass en/ar to pre-fill; both default to "".
 */
export const createBilingual = (en = "", ar = "") => ({ en: String(en ?? ""), ar: String(ar ?? "") });

/** Returns true when value looks like a bilingual object. */
export const isBilingual = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) && ("en" in v || "ar" in v);

/**
 * Safely read one language from a bilingual value or plain string.
 * Falls back: requested lang → "en" → first key → empty string.
 */
export const getLang = (value, lang = "en") => {
  if (value == null) return "";
  if (isBilingual(value)) {
    return value[lang] ?? value.en ?? Object.values(value)[0] ?? "";
  }
  return String(value);
};

// ─── Styled field used by BilingualInput ─────────────────────────────────────

const BiField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "var(--bg-input)",
    borderRadius: "10px",
    "& fieldset": { borderColor: "rgba(28,138,126,0.18)" },
    "&:hover fieldset": { borderColor: "rgba(28,138,126,0.35)" },
    "&.Mui-focused fieldset": { borderColor: "var(--zy-teal-500)", boxShadow: "0 0 0 3px rgba(28,138,126,0.12)" },
  },
  "& .MuiInputBase-input": { color: "var(--text-secondary)", fontSize: "14px" },
  "& .MuiInputLabel-root": { color: "var(--text-dark)", fontSize: "12px", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "var(--zy-teal-500)" },
  "& .MuiFormHelperText-root": { color: "var(--zy-slate-300)", fontSize: "11px" },
});

// ─── BilingualInput ───────────────────────────────────────────────────────────

/**
 * Renders two text fields side-by-side: English (LTR) + Arabic (RTL).
 *
 * Props
 * ─────
 * label      English field label  (default "Name")
 * labelAr    Arabic field label   (default "الاسم")
 * value      { en: string, ar: string }  — owned by the parent
 * onChange   (newValue: { en, ar }) => void  — parent must call setState
 * required   adds asterisk to the English label
 * helperText shown under the English field
 * disabled   disables both inputs
 */
export function BilingualInput({
  label    = "Name",
  labelAr  = "الاسم",
  value,
  onChange,
  required   = false,
  helperText = undefined,
  disabled   = false,
}) {
  // Normalise whatever the parent hands us into a safe { en, ar } object.
  // We do NOT store this in local state — that's intentional.
  const safe = isBilingual(value)
    ? value
    : createBilingual(typeof value === "string" ? value : "");

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 1.5,
        my: 1,
      }}
    >
      {/* ── English ── */}
      <BiField
        label={required ? `${label} *` : label}
        value={safe.en}
        onChange={(e) => onChange({ ...safe, en: e.target.value })}
        disabled={disabled}
        helperText={helperText}
        fullWidth
        inputProps={{ dir: "ltr" }}
      />

      {/* ── Arabic ── */}
      <BiField
        label={labelAr}
        value={safe.ar}
        onChange={(e) => onChange({ ...safe, ar: e.target.value })}
        disabled={disabled}
        fullWidth
        inputProps={{
          dir: "rtl",
          style: { fontFamily: "'Cairo', 'Tajawal', sans-serif", textAlign: "right" },
        }}
        InputLabelProps={{
          style: { fontFamily: "'Cairo', 'Tajawal', sans-serif" },
        }}
      />
    </Box>
  );
}