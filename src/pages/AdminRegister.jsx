import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, CircularProgress,
  Stepper, Step, StepLabel, Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';

// ─── Styled Components ─────────────────────────────────────────────────

const RegisterWrapper = styled(Box)({
  minHeight: '100vh',
  backgroundColor: '#04091a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
});

const RegisterCard = styled(Paper)({
  width: '100%',
  maxWidth: '480px',
  backgroundColor: '#0b1628',
  borderRadius: '20px',
  border: '1px solid rgba(15,184,166,0.13)',
  padding: '32px',
});

// ✅ FIXED: Added missing StyledTextField definition
const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#0f1e36',
    borderRadius: '10px',
    color: '#dde6f0',
    transition: 'all 0.2s ease',
    '& fieldset': {
      borderColor: 'rgba(15,184,166,0.18)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(15,184,166,0.35)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#0fb8a6',
      boxShadow: '0 0 0 3px rgba(15,184,166,0.15)',
    },
  },
  '& .MuiInputBase-input': {
    fontSize: '14px',
    padding: '14px 16px',
  },
  '& .MuiInputLabel-root': {
    color: '#3a5070',
    fontSize: '12px',
    fontWeight: 600,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0fb8a6',
  },
  '& .MuiFormHelperText-root': {
    color: '#4a6080',
    fontSize: '11px',
  },
});

const RegisterButton = styled(Button)({
  background: 'linear-gradient(to right, #0fb8a6, #0d9488)',
  color: 'white',
  fontWeight: 700,
  padding: '14px 0',
  borderRadius: '10px',
  textTransform: 'none',
  fontSize: '14px',
  '&:hover': {
    background: 'linear-gradient(to right, #0d9488, #0b7a72)',
    transform: 'translateY(-1px)',
  },
  '&.Mui-disabled': {
    background: 'linear-gradient(to right, #0a5c52, #074038)',
    color: 'rgba(255,255,255,0.5)',
  },
});

// ─── Main Component ──────────────────────────────────────────────────────

export default function AdminRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '', 
    otp: '',
  });

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/register-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email,
          password: formData.password
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      
      setSuccess('Verification code sent! Check your email.');
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Register
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          otp: formData.otp,
          fullName: formData.fullName,
          password: formData.password,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      setSuccess('✅ Admin account created! Redirecting...');
      
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Account created! Please sign in with your new admin credentials.' 
          } 
        });
      }, 2000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegisterWrapper>
      <RegisterCard elevation={0}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 1, textAlign: 'center' }}>
          Register as Admin
        </Typography>
        <Typography sx={{ color: '#4a6080', mb: 3, textAlign: 'center' }}>
          Create a new admin account for Smart Clinic
        </Typography>

        <Stepper activeStep={step - 1} sx={{ mb: 4 }}>
          <Step><StepLabel>Request Code</StepLabel></Step>
          <Step><StepLabel>Verify & Register</StepLabel></Step>
        </Stepper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
        )}

        {/* Step 1: Email + Name + Password */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <StyledTextField
              label="Work Email *"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              required
              disabled={loading}
              fullWidth
              placeholder="admin@clinic.com"
            />
            <StyledTextField
              label="Full Name *"
              value={formData.fullName}
              onChange={handleChange('fullName')}
              required
              disabled={loading}
              fullWidth
              placeholder="Dr. Ahmed Mohamed"
            />
            <StyledTextField
              label="Password *"
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              required
              disabled={loading}
              fullWidth
              placeholder="Min 6 characters"
              helperText="Use a strong password"
            />
            <RegisterButton
              type="submit"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Send Verification Code'}
            </RegisterButton>
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button
                variant="text"
                onClick={() => navigate('/login')}
                sx={{ color: '#0fb8a6', fontWeight: 600, fontSize: '13px' }}
              >
                ← Back to Login
              </Button>
            </Box>
          </form>
        )}

        {/* Step 2: OTP Input */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Typography sx={{ color: '#dde6f0', mb: 1 }}>
              Enter the 6-digit code sent to <strong>{formData.email}</strong>
            </Typography>
            
            <StyledTextField
              label="Verification Code *"
              value={formData.otp}
              onChange={handleChange('otp')}
              required
              disabled={loading}
              inputProps={{ 
                maxLength: 6, 
                pattern: '[0-9]*', 
                inputMode: 'numeric',
                style: { textAlign: 'center', letterSpacing: '8px', fontSize: '20px' }
              }}
              fullWidth
            />
            
            <RegisterButton
              type="submit"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Verify & Create Account'}
            </RegisterButton>
            
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button
                variant="text"
                onClick={() => {
                  setStep(1);
                  setFormData(prev => ({ ...prev, otp: '' }));
                  setError(null);
                }}
                sx={{ color: '#0fb8a6', fontWeight: 600, fontSize: '13px' }}
              >
                ← Use different email
              </Button>
            </Box>
          </form>
        )}
      </RegisterCard>
    </RegisterWrapper>
  );
}