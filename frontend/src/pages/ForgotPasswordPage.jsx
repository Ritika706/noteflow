import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import Button from '../components/Button';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  // Steps: 'email' -> 'otp' -> 'password'
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function requestOtp(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password/request', { email });
      toastSuccess('OTP sent to your email!');
      setStep('otp');
    } catch (err) {
      toastError(err?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    if (otp.length !== 6) {
      toastError('Please enter a valid 6-digit OTP');
      return;
    }
    // Move to password step (verification happens on final submit)
    setStep('password');
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toastError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password/reset', { email, otp, newPassword });
      toastSuccess('Password updated successfully!');
      navigate('/auth?mode=login', { replace: true });
    } catch (err) {
      toastError(err?.response?.data?.message || 'Failed to reset password');
      // If OTP is wrong, go back to OTP step
      if (err?.response?.data?.message?.toLowerCase().includes('otp')) {
        setStep('otp');
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  }

  function resendOtp() {
    setOtp('');
    setStep('email');
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <Card className="glass p-6">
        <div className="mb-4">
          <div className="font-display text-2xl font-bold">Forgot password</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {step === 'email' && 'Enter your email to receive a 6-digit OTP.'}
            {step === 'otp' && 'Enter the OTP sent to your email.'}
            {step === 'password' && 'Set your new password.'}
          </div>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form className="space-y-4" onSubmit={requestOtp}>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                required
                autoFocus
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <form className="space-y-4" onSubmit={verifyOtp}>
            <div>
              <label className="text-sm font-medium">OTP</label>
              <Input
                className="mt-1 text-center text-2xl tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
              />
              <p className="mt-2 text-xs text-slate-500">
                OTP sent to <strong>{email}</strong>
              </p>
            </div>

            <Button className="w-full" type="submit" disabled={otp.length !== 6}>
              Verify OTP
            </Button>

            <button
              type="button"
              onClick={resendOtp}
              className="inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary/10"
            >
              Resend OTP
            </button>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 'password' && (
          <form className="space-y-4" onSubmit={resetPassword}>
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input
                className="mt-1"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                type="password"
                minLength={6}
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
            </div>

            <Button className="w-full" type="submit" disabled={loading || newPassword.length < 6}>
              {loading ? 'Updating…' : 'Reset Password'}
            </Button>

            <button
              type="button"
              onClick={() => setStep('otp')}
              className="inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary/10"
            >
              ← Back
            </button>
          </form>
        )}

        <Link
          to="/auth?mode=login"
          className="mt-4 inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary/10"
        >
          Back to login
        </Link>
      </Card>
    </div>
  );
}
