import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import {
  Container, TextField, Button, Typography, Alert, Box, CircularProgress
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { keyframes } from "@mui/system";
const logo = "/favicon.svg";

const pulseRing = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1.3); opacity: 0; }
`;

const LoginWrapper = styled(Box)({
  minHeight: "100vh",
  backgroundColor: "#04091a",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
});

const BgCircle = styled(Box)({
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(60px)",
  opacity: 0.09,
});

const LoginCard = styled(Box)({
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: "420px",
  backgroundColor: "#0b1628",
  borderRadius: "20px",
  border: "1px solid rgba(15,184,166,0.13)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(15,184,166,0.05)",
  overflow: "hidden",
  "@media (max-width: 480px)": {
    borderRadius: "16px",
  },
});

const CardHeader = styled(Box)({
  background: "linear-gradient(to bottom, #0d9488 0%, #083040 60%, transparent 100%)",
  padding: "32px 32px 24px",
  textAlign: "center",
  position: "relative",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: "10%",
    right: "10%",
    height: "1px",
    background: "linear-gradient(to right, transparent, rgba(15,184,166,0.4), transparent)",
  },
});

const LogoRing = styled(Box)({
  width: "64px",
  height: "64px",
  margin: "0 auto 16px",
  borderRadius: "50%",
  border: "2px solid rgba(15,184,166,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: "-4px",
    borderRadius: "50%",
    border: "2px solid rgba(15,184,166,0.15)",
    animation: `${pulseRing} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
  },
});

const StyledTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#0f1e36",
    borderRadius: "10px",
    transition: "all 0.2s ease",
    "& fieldset": {
      borderColor: "rgba(15,184,166,0.18)",
      borderWidth: "1px",
    },
    "&:hover fieldset": {
      borderColor: "rgba(15,184,166,0.35)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "#0fb8a6",
      boxShadow: "0 0 0 3px rgba(15,184,166,0.15)",
    },
  },
  "& .MuiInputBase-input": {
    color: "#dde6f0",
    fontSize: "14px",
    padding: "14px 16px",
  },
  "& .MuiInputLabel-root": {
    color: "#3a5070",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#0fb8a6",
  },
});

const LoginButton = styled(Button)({
  background: "linear-gradient(to right, #0fb8a6, #0d9488)",
  color: "white",
  fontSize: "14px",
  fontWeight: 700,
  padding: "14px 0",
  borderRadius: "10px",
  textTransform: "none",
  letterSpacing: "0.5px",
  boxShadow: "0 4px 14px rgba(15,184,166,0.45)",
  transition: "all 0.3s ease",
  "&:hover": {
    background: "linear-gradient(to right, #0d9488, #0b7a72)",
    boxShadow: "0 6px 20px rgba(15,184,166,0.65)",
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  "&.Mui-disabled": {
    background: "linear-gradient(to right, #0a5c52, #074038)",
    color: "rgba(255,255,255,0.5)",
  },
});

// ← NEW: Styled link for registration
const RegisterLink = styled(Link)({
  color: "#0fb8a6",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  transition: "all 0.2s ease",
  "&:hover": {
    color: "#2dd4bf",
    textDecoration: "underline",
  },
});

const SecurityIndicator = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid rgba(15,184,166,0.1)",
});

const StatusDot = styled(Box)({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  backgroundColor: "#34d399",
  boxShadow: "0 0 8px rgba(52,211,153,0.6)",
});

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await userCredential.user.getIdToken(true);
      const tokenClaims = await userCredential.user.getIdTokenResult();
      console.log("🎫 Token claims:", tokenClaims.claims);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err.message.includes("invalid-credential")
          ? "Invalid email or password"
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginWrapper>
      {/* Decorative Background */}
      <BgCircle sx={{ width: 500, height: 500, background: "radial-gradient(circle, rgba(15,184,166,0.08), transparent 70%)", top: -100, right: -100 }} />
      <BgCircle sx={{ width: 400, height: 400, background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)", bottom: -100, left: -100 }} />
      
      <LoginCard>
        <CardHeader>
          <LogoRing>
            <img src={logo} alt="Smart Clinic" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }} />
          </LogoRing>
          <Typography variant="h4" sx={{ color: "white", fontWeight: 700, fontSize: { xs: "20px", sm: "24px" }, letterSpacing: "0.5px", mb: 0.5 }}>
            Admin Portal
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
            Secure License Management System
          </Typography>
        </CardHeader>

        <Box sx={{ p: "28px 32px 32px", display: "flex", flexDirection: "column", gap: 2.5 }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                backgroundColor: "rgba(248,113,113,0.1)", 
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#f87171",
                borderRadius: "10px",
                "& .MuiAlert-icon": { color: "#f87171" }
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <StyledTextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="admin@clinic.com"
              fullWidth
            />
            <StyledTextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              fullWidth
            />

            <LoginButton
              type="submit"
              fullWidth
              disabled={loading}
              sx={{ mt: 0.5 }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: "white" }} /> : "Sign In to Dashboard"}
            </LoginButton>
          </form>

          {/* ← NEW: Registration Link Section */}
          <Box sx={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            gap: 1,
            pt: 2,
            borderTop: "1px solid rgba(15,184,166,0.1)"
          }}>
            <Typography sx={{ color: "#4a6080", fontSize: "12px" }}>
              Don't have an admin account?
            </Typography>
            <RegisterLink to="/register">
              Register as Admin →
            </RegisterLink>
          </Box>

          <SecurityIndicator>
            <StatusDot />
            <Typography sx={{ color: "#3a5070", fontSize: "11px", fontStyle: "italic" }}>
              End-to-end encrypted connection
            </Typography>
          </SecurityIndicator>
        </Box>
      </LoginCard>
    </LoginWrapper>
  );
}