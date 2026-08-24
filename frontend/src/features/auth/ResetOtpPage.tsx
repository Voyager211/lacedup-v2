import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { resendResetOtp, verifyResetOtp } from './authFlows.api';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/toast';
import Button from '@/components/Button';
import OtpInput from '@/components/form/OtpInput';
import AuthHeading from './AuthHeading';
import { useCountdown } from './useCountdown';

const RESEND_COOLDOWN = 60;

/**
 * Verify the password-reset code.
 *
 * Structurally the same as the signup verification, but it does not sign
 * anyone in - it unlocks the reset form. The two were separate 260-line views
 * before; they now share <OtpInput> and useCountdown and differ only in what
 * happens on success.
 */
const ResetOtpPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const email = params.get('email');

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { remaining, isCoolingDown, start } = useCountdown(RESEND_COOLDOWN);

  useEffect(() => start(), [start]);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const submit = async (code: string) => {
    if (code.length !== 6 || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await verifyResetOtp(email, code);
      navigate(`/reset-password?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;

      if (status === 410) {
        toast.error('That code has expired. Request a new one.');
        navigate('/forgot-password', { replace: true });
        return;
      }

      setError(errorMessage(caught, 'That code was not right.'));
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await resendResetOtp(email);
      start();
      setError(null);
      toast.success('A new code is on its way');
    } catch (caught) {
      toast.fromError(caught, 'Could not send a new code.');
    }
  };

  return (
    <>
      <AuthHeading
        title="Enter your reset code"
        subtitle={
          <>
            We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
          </>
        }
      />

      <div className="space-y-5">
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={submit}
          disabled={submitting}
          error={error ?? undefined}
          label="Reset code"
        />

        <Button
          fullWidth
          loading={submitting}
          disabled={otp.length !== 6}
          onClick={() => submit(otp)}
        >
          Continue
        </Button>

        <div className="text-center text-sm text-ink-muted">
          {isCoolingDown ? (
            <span aria-live="polite">Resend available in {remaining}s</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="font-medium text-brand hover:underline"
            >
              Send a new code
            </button>
          )}
        </div>

        <p className="text-center text-sm text-ink-muted">
          <Link to="/forgot-password" className="font-medium text-brand hover:underline">
            Use a different email
          </Link>
        </p>
      </div>
    </>
  );
};

export default ResetOtpPage;
