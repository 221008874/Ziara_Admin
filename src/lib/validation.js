export const PHONE_REGEX = /^\+?\d{7,15}$/;

export function validatePhone(value) {
  if (!value) return "";
  return PHONE_REGEX.test(value.replace(/[\s\-()]/g, "")) ? "" : "Enter a valid phone number (7-15 digits)";
}

export const EGP_MOBILE_REGEX = /^01[0-25]\d{8}$/;

export function validateEgyptMobile(value) {
  if (!value) return "";
  const digits = value.replace(/[\s\-()]/g, "");
  if (!EGP_MOBILE_REGEX.test(digits)) {
    return "Enter a valid Egyptian mobile (01xxxxxxxxx)";
  }
  return "";
}
