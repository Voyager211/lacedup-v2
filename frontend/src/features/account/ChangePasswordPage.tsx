import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useChangePasswordMutation } from './account.api';
import { AccountLayout } from './AccountNav';
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/schemas';
import Button from '@/components/Button';
import PasswordField from '@/components/form/PasswordField';
import { useToast } from '@/components/toast';

/**
 * Change password.
 *
 * 830 lines in EJS, 450 of them a hand-rolled strength meter and validator.
 * Both live in shared components now, so this is the form and the request.
 */
const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [changePassword] = useChangePasswordMutation();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  const password = watch('password', '');

  const onSubmit = async (values: ChangePasswordValues) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.password
      }).unwrap();

      toast.success('Password changed');
      navigate('/profile');
    } catch (caught) {
      // A wrong current password is the common case and belongs on that field
      // rather than at the top of the form.
      const message = String(
        (caught as { data?: { message?: string } })?.data?.message ?? 'Could not change your password.'
      );

      if (/current/i.test(message)) setError('currentPassword', { message });
      else setError('root', { message });
    }
  };

  return (
    <AccountLayout title="Change password">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="max-w-md space-y-4 rounded-lg border border-line bg-white p-6"
      >
        {errors.root && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        <PasswordField
          label="Current password"
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

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

        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </form>
    </AccountLayout>
  );
};

export default ChangePasswordPage;
