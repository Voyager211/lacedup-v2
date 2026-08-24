import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '@/app/store';
import { bootstrapSession } from './authSlice';
import { resendSignupOtp, verifySignupOtp } from './authFlows.api';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/toast';
import Button from '@/components/Button';
import OtpInput from '@/components/form/OtpInput';
import AuthHeading from './AuthHeading';
import { useCountdown } from './useCountdown';

const RESEND_COOLDOWN = 60;

/**
 * Verify the signup code.
 *
 * Two things worth knowing about this endpoint:
 *
 *  - On success it creates the account **and issues the session**, so the
 *    visitor is already signed in. Sending them to /login afterwards would ask
 *    them to authenticate twice; this bootstraps the session and drops them on
 *    the storefront.
 *  - 401 and 410 mean different things - a wrong code invites another go, an
 *    expired one means starting over - so they are not collapsed into one
 *    message.
 */
const VerifyOtpPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const email = params.get('email');

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { remaining, isCoolingDown, start } = useCountdown(RESEND_COOLDOWN);

  // The code is only valid for 60 seconds, so the cooldown starts on arrival.
  useEffect(() => start(), [start]);

  // Without an email there is no pending signup to verify against.
  if (!email) return <Navigate to="/signup" replace />;

  const submit = async (code: string) => {
    if (code.length !== 6 || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await verifySignupOtp(email, code);
      await dispatch(bootstrapSession('user'));
      toast.success('Welcome to LacedUp');
      navigate('/', { replace: true });
    } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;

      if (status === 410) {
        toast.error('That code has expired. Please sign up again.');
        navigate('/signup', { replace: true });
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
      await resendSignupOtp(email);
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
        title="Check your email"
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
          label="Verification code"
        />

        <Button
          fullWidth
          loading={submitting}
          disabled={otp.length !== 6}
          onClick={() => submit(otp)}
        >
          Verify
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
          Wrong address?{' '}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Start again
          </Link>
        </p>
      </div>
    </>
  );
};

export default VerifyOtpPage;
