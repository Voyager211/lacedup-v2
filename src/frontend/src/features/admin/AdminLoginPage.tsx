import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDispatch } from '@/app/store';
import { signIn } from '@/features/auth/authSlice';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import PasswordField from '@/components/form/PasswordField';
import Logo from '@/components/Logo';
import { FILLED_INPUT } from '@/features/auth/AuthBits';

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
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
        {/*
          No side photograph here, unlike the shopper pages - just the mark
          above the form, on a dark band so the white artwork reads without
          being inverted.
        */}
        <header className="flex justify-center bg-ink px-8 py-7">
          <Logo onDark width={190} />
        </header>

        <div className="p-8">
          {/* Named on the page, not just to screen readers: this login looks
              identical to the shopper one, and typing shopper credentials into
              it fails with a message about the account's role. */}
          <h1 className="mb-5 text-center font-heading text-lg font-semibold text-ink">
            Admin Login
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {errors.root && (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <TextField
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              className={FILLED_INPUT}
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordField
              label="Password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className={FILLED_INPUT}
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" variant="secondary" fullWidth loading={isSubmitting}>
              Log In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
