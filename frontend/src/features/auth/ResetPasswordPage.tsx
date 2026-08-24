import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPassword } from './authFlows.api';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/toast';
import Button from '@/components/Button';
import PasswordField from '@/components/form/PasswordField';
import AuthHeading from './AuthHeading';

/**
 * Set a new password.
 *
 * The endpoint's field is `newPassword`, not `password` - it is the only
 * password form in the app that differs, which is exactly the sort of thing
 * that gets missed when each page rolls its own request.
 *
 * It does not sign the visitor in, so they land on the login page afterwards.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const email = params.get('email');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  const password = watch('password', '');

  if (!email) return <Navigate to="/forgot-password" replace />;

  const onSubmit = async (values: ResetPasswordValues) => {
    try {
      await resetPassword(email, values.password, values.confirmPassword);
      toast.success('Password updated. Sign in with your new one.');
      navigate('/login', { replace: true });
    } catch (error) {
      setError('root', { message: errorMessage(error, 'Could not reset your password.') });
    }
  };

  return (
    <>
      <AuthHeading
        title="Set a new password"
        subtitle={
          <>
            For <span className="font-medium text-ink">{email}</span>.
          </>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        <PasswordField
          label="New password"
          autoComplete="new-password"
          required
          showStrength
          value={password}
          hint="At least 8 characters, with a letter and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  );
};

export default ResetPasswordPage;
