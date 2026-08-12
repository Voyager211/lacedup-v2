import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { signup } from './authFlows.api';
import { signupSchema, type SignupValues } from '@/lib/schemas';
import { errorMessage } from '@/api/client';
import Button from '@/components/Button';
import { TextField } from '@/components/form/TextField';
import PasswordField from '@/components/form/PasswordField';
import AuthHeading from './AuthHeading';

/**
 * Create an account.
 *
 * No user row exists when this succeeds - the details are held in the server
 * session until the emailed code is verified. That is why the next page needs
 * the email in the URL, and why losing the session sends the visitor back here.
 */
const SignupPage = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const password = watch('password', '');

  const onSubmit = async (values: SignupValues) => {
    try {
      await signup(values);
      navigate(`/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      const message = errorMessage(error, 'Could not create your account.');

      // The server distinguishes these two, so the message belongs on the
      // field the visitor has to change rather than at the top of the form.
      if (/email/i.test(message) && /use/i.test(message)) {
        setError('email', { message });
      } else if (/referral/i.test(message)) {
        setError('referralCode', { message });
      } else {
        setError('root', { message });
      }
    }
  };

  return (
    <>
      <AuthHeading
        title="Create an account"
        subtitle={
          <>
            Already have one?{' '}
            <Link to="/login" className="font-medium text-brand hover:underline">
              Sign in
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
          label="Full name"
          autoComplete="name"
          required
          error={errors.name?.message}
          {...register('name')}
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          showStrength
          value={password}
          hint="At least 8 characters, with a letter and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <TextField
          label="Referral code"
          hint="Optional — if a friend gave you one, you both get wallet credit"
          error={errors.referralCode?.message}
          {...register('referralCode')}
        />

        <Button type="submit" fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </>
  );
};

export default SignupPage;
