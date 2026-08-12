import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppDispatch } from '@/app/store';
import { signIn } from './authSlice';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import { useToast } from '@/components/toast';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import PasswordField from '@/components/form/PasswordField';
import AuthHeading from './AuthHeading';

/**
 * Sign in.
 *
 * `POST /login` is form-encoded rather than JSON because the EJS form still
 * posts to it. It answers `{ success: true }` on 200 and `{ error }` on 401.
 *
 * The `?error=` parameter is kept because the Google OAuth callback redirects
 * back here with it - a blocked account, or a failed OAuth handshake.
 */
const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // The guard stashes where the visitor was heading before it bounced them.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const oauthError = params.get('error');

  useEffect(() => {
    if (!oauthError) return;

    toast.error(
      oauthError === 'blocked'
        ? params.get('message') ?? 'That account has been blocked.'
        : 'Signing in with Google did not work. Try your email and password.'
    );
    // toast is recreated each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthError]);

  const onSubmit = async (values: LoginValues) => {
    try {
      await dispatch(signIn({ ...values, audience: 'user' })).unwrap();
      navigate(from ?? '/', { replace: true });
    } catch (error) {
      // The thunk rejects with an already-unpacked message, so this is the
      // server's own wording. Attached to the form rather than a field: the
      // server deliberately does not say which of the two was wrong, and
      // guessing would be misleading.
      setError('root', { message: String(error) });
    }
  };

  return (
    <>
      <AuthHeading
        title="Sign in"
        subtitle={
          <>
            New here?{' '}
            <Link to="/signup" className="font-medium text-brand hover:underline">
              Create an account
            </Link>
          </>
        }
      />

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
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-ink-muted hover:text-brand">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs uppercase tracking-widest text-ink-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/*
        A full page navigation, not a fetch: OAuth needs the browser to leave
        for Google and come back. The dev server proxies /google to the backend
        so this works the same in both environments.
      */}
      <a
        href="/google"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line font-medium text-ink transition-colors hover:bg-card"
      >
        Continue with Google
      </a>
    </>
  );
};

export default LoginPage;
