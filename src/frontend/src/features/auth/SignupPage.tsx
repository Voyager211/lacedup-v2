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
import { AuthDivider, FILLED_INPUT, GoogleButton } from './AuthBits';

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
      <AuthHeading title="Create your account" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        <TextField
          label="Full Name"
          autoComplete="name"
          required
          placeholder="Fullname"
          className={FILLED_INPUT}
          error={errors.name?.message}
          {...register('name')}
        />

        <TextField
          label="Phone Number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          placeholder="Phone"
          className={FILLED_INPUT}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="Email address"
          required
          className={FILLED_INPUT}
          error={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Referral Code (Optional)"
          placeholder="Enter referral code if you have one"
          hint="Enter a referral code to help a friend earn rewards"
          className={FILLED_INPUT}
          error={errors.referralCode?.message}
          {...register('referralCode')}
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          showStrength
          value={password}
          placeholder="Password"
          className={FILLED_INPUT}
          hint="At least 8 characters, with a letter and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          required
          placeholder="Confirm Password"
          className={FILLED_INPUT}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" variant="secondary" fullWidth loading={isSubmitting}>
          Sign Up
        </Button>
      </form>

      <AuthDivider />

      <GoogleButton>Sign up with Google</GoogleButton>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Log In
        </Link>
      </p>
    </>
  );
};

export default SignupPage;
