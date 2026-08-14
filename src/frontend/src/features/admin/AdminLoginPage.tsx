import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDispatch } from '@/app/store';
import { signIn } from '@/features/auth/authSlice';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import PasswordField from '@/components/form/PasswordField';

/**
 * Admin sign in.
 *
 * Uses the admin audience, so it sets the admin_at / admin_rt cookie pair
 * rather than the shopper one. The two are independent - signing in here does
 * not sign anyone in on the storefront, and a shopper session will not satisfy
 * an admin route.
 *
 * Like the shopper login, `POST /admin/login` is form-encoded because the EJS
 * form still posts to it, and it refuses an account whose role is not admin.
 */
const AdminLoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const onSubmit = async (values: LoginValues) => {
    try {
      await dispatch(signIn({ ...values, audience: 'admin' })).unwrap();
      navigate(from ?? '/admin/dashboard', { replace: true });
    } catch (error) {
      setError('root', { message: String(error) });
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
        <header className="mb-6 text-center">
          <p className="font-display text-2xl tracking-wide text-ink">LACEDUP</p>
          <h1 className="mt-1 text-sm font-semibold uppercase tracking-widest text-ink-muted">
            Admin
          </h1>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {errors.root && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {errors.root.message}
            </p>
          )}

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordField
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
