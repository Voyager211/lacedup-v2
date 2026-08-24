import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { requestPasswordReset } from './authFlows.api';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas';
import { errorMessage } from '@/api/client';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import AuthHeading from './AuthHeading';

/**
 * Request a reset code.
 *
 * The endpoint answers 404 for an address with no account, which tells an
 * attacker whether an email is registered. That is the server's existing
 * behaviour; changing it is a backend decision, so the message is surfaced as
 * sent rather than quietly masked here. Recorded in the README's open items.
 */
const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    try {
      await requestPasswordReset(email);
      navigate(`/reset-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setError('email', { message: errorMessage(error, 'Could not send a reset code.') });
    }
  };

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        subtitle="Enter your email and we'll send you a code to reset it."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" fullWidth loading={isSubmitting}>
          Send reset code
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
};

export default ForgotPasswordPage;
