// src/lib/errorHandler.js
// Normalizes errors from various sources (Firebase, network, generic) into
// { message, code, details } for consistent handling across the app.

const FIREBASE_ERRORS = {
  "permission-denied":         { message: "Permission denied. Check Firebase rules.", code: "PERMISSION_DENIED" },
  notfound:                    { message: "Requested document not found.",            code: "NOT_FOUND" },
  "not-found":                 { message: "Requested document not found.",            code: "NOT_FOUND" },
  "resource-exhausted":        { message: "Firestore quota exceeded. Try again later.", code: "QUOTA_EXCEEDED" },
  "unauthenticated":           { message: "Authentication required. Please log in.",  code: "UNAUTHENTICATED" },
  "failed-precondition":       { message: "Operation failed precondition.",           code: "FAILED_PRECONDITION" },
  aborted:                     { message: "Operation aborted. Retry may help.",       code: "ABORTED" },
  "invalid-argument":          { message: "Invalid argument provided.",               code: "INVALID_ARGUMENT" },
  "already-exists":            { message: "Resource already exists.",                 code: "ALREADY_EXISTS" },
};

export function normalizeError(error) {
  if (!error) return { message: "An unknown error occurred.", code: "UNKNOWN", details: null };

  // Already normalized
  if (error && error.code && error.message && error.__normalized) {
    return error;
  }

  // Firebase Firestore errors (code format: "permission-denied", etc.)
  if (error.code && FIREBASE_ERRORS[error.code]) {
    return { ...FIREBASE_ERRORS[error.code], details: error, __normalized: true };
  }

  // Firebase Auth errors (code format: "auth/user-not-found")
  if (error.code && error.code.startsWith("auth/")) {
    const readable = error.code.replace("auth/", "").replace(/-/g, " ");
    return {
      message: readable.charAt(0).toUpperCase() + readable.slice(1) + ".",
      code: error.code,
      details: error,
      __normalized: true,
    };
  }

  // Network errors (TypeError: Failed to fetch)
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return { message: "Network error. Check your connection.", code: "NETWORK_ERROR", details: error, __normalized: true };
  }

  // Generic Error instance
  if (error instanceof Error) {
    return { message: error.message || "An error occurred.", code: error.code || "ERROR", details: error, __normalized: true };
  }

  // String error
  if (typeof error === "string") {
    return { message: error, code: "ERROR", details: null, __normalized: true };
  }

  // Fallback
  return { message: "An unexpected error occurred.", code: "UNKNOWN", details: error, __normalized: true };
}

export function isFirestoreError(error) {
  return error?.code && FIREBASE_ERRORS[error.code];
}

export function isNetworkError(error) {
  return error?.code === "NETWORK_ERROR";
}

export default normalizeError;
