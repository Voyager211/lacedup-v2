import { useState } from 'react';
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
 * The fields on the first step.
 *
 * Split at the password deliberately: everything before it is about who you
 * are, everything after is about securing the account, so the break falls on a
 * seam a visitor already recognises rather than an arbitrary midpoint.
 */
const STEP_ONE = ['name', 'phone', 'email', 'referralCode'] as const;

/**
 * Create an account.
 *
 * No user row exists when this succeeds - the details are held in the
 * PendingSignup collection, keyed by email, until the emailed code is
 * verified. That is why the next page needs the email in the URL. It used to
 * be held in the server session, where losing the session stranded the
 * visitor; since Phase 5 the record is found by the email they send back.
 */
const SignupPage = () => {
  const navigate = useNavigate();

  /**
   * Six fields plus a strength meter made a card twice the height of the login
   * one, so the form is two steps. Both cards now come out about the same
   * height, which matters because the photograph beside them is cropped to
   * fit - see AuthLayout.
   */
  const [step, setStep] = useState<1 | 2>(1);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setError,
    setFocus,
    formState: { errors, isSubmitting }
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const password = watch('password', '');

  /**
   * Validates only the fields on this step before advancing.
   *
   * Without the field list `trigger()` would validate the whole schema and
   * report the empty password fields, which the visitor has not been shown yet.
   */
  const proceed = async () => {
    if (!(await trigger([...STEP_ONE]))) return;

    setStep(2);
  };

  const back = () => {
    setStep(1);
    // Returning to a step whose fields are all filled leaves nothing focused,
    // so the keyboard user would land back at the top of the document.
    setTimeout(() => setFocus('name'), 0);
  };

  const onSubmit = async (values: SignupValues) => {
    try {
      await signup(values);
      navigate(`/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      const message = errorMessage(error, 'Could not create your account.');

      // The server distinguishes these two, so the message belongs on the
      // field the visitor has to change rather than at the top of the form.
      // Both live on step one, so send them back to see it.
      if (/email/i.test(message) && /use/i.test(message)) {
        setStep(1);
        setError('email', { message });
      } else if (/referral/i.test(message)) {
        setStep(1);
        setError('referralCode', { message });
      } else {
        setError('root', { message });
      }
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" />

      <p className="-mt-4 mb-4 text-center text-sm text-ink-muted" aria-live="polite">
        Step {step} of 2 — {step === 1 ? 'your details' : 'choose a password'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        {/*
          Both steps stay mounted, with the inactive one hidden. Unmounting
          would drop the values react-hook-form is holding for fields the
          visitor has already filled, so going back would clear their answers.
        */}
        <div className={step === 1 ? 'space-y-3.5' : 'hidden'}>
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
            className={FILLED_INPUT}
            error={errors.referralCode?.message}
            {...register('referralCode')}
          />

          {/* type="button", or it would submit the half-filled form. */}
          <Button type="button" variant="secondary" fullWidth onClick={proceed}>
            Proceed
          </Button>
        </div>

        <div className={step === 2 ? 'space-y-3.5' : 'hidden'}>
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

          <button
            type="button"
            onClick={back}
            className="w-full text-center text-sm text-ink-muted transition-colors hover:text-brand"
          >
            Back to your details
          </button>
        </div>
      </form>

      {/* Only on the first step: signing in with Google replaces the form. */}
      {step === 1 && (
        <>
          <AuthDivider />

          <GoogleButton>Sign up with Google</GoogleButton>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand hover:underline">
              Log In
            </Link>
          </p>
        </>
      )}
    </>
  );
};

export default SignupPage;
