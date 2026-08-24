import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import VerifyOtpPage from './VerifyOtpPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';

const ALICE = { _id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'user', isBlocked: false };

const renderPage = (element: React.ReactNode, initialEntry: string) => {
  const router = createMemoryRouter(
    [
      { path: '/login', element },
      { path: '/signup', element },
      { path: '/verify-otp', element },
      { path: '/forgot-password', element },
      { path: '/reset-otp', element: <p>reset otp page</p> },
      { path: '/reset-password', element },
      { path: '/', element: <p>storefront home</p> }
    ],
    { initialEntries: [initialEntry] }
  );

  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('LoginPage', () => {
  it('validates before it touches the network', async () => {
    renderPage(<LoginPage />, '/login');

    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it('accepts a short password, so old accounts are not locked out', async () => {
    // Accounts created under the old 6-character rule must still be able to
    // sign in - client-side length validation here would lock them out.
    mock.onPost('/login').reply(200, { success: true });
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderPage(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'old123');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText('storefront home')).toBeInTheDocument();
  });

  it('posts form-encoded, because the endpoint still serves the EJS form', async () => {
    mock.onPost('/login').reply(200, { success: true });
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderPage(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    await screen.findByText('storefront home');

    const request = mock.history.post.find((entry) => entry.url === '/login');
    expect(request?.headers?.['Content-Type']).toMatch(/x-www-form-urlencoded/);
    expect(String(request?.data)).toContain('alice%40example.com');
  });

  it('shows the server message on a rejected sign-in without blaming a field', async () => {
    mock.onPost('/login').reply(401, { error: 'Invalid credentials.' });

    renderPage(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.');
  });

  it('explains a rate limit rather than showing a raw server error', async () => {
    mock.onPost('/login').reply(429, { message: 'Too many requests' });

    renderPage(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a moment/i);
  });

  it('offers the Google flow as a real navigation, not a fetch', () => {
    renderPage(<LoginPage />, '/login');

    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute(
      'href',
      '/google'
    );
  });
});

describe('SignupPage', () => {
  /**
   * Walks the two steps the way a visitor does.
   *
   * Worth doing properly even though jsdom cannot see the step that is hidden:
   * the suite runs with `css: false`, so Tailwind's `hidden` has no effect and
   * every field is reachable whichever step is showing. Driving it through
   * Proceed is what makes these tests exercise the flow rather than a form
   * that only looks split.
   */
  const fillStepOne = async () => {
    await userEvent.type(screen.getByLabelText('Full Name'), 'Alice Example');
    await userEvent.type(screen.getByLabelText('Phone Number'), '9876543210');
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
  };

  const fill = async () => {
    await fillStepOne();
    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'correcthorse1');
  };

  it('does not advance past details that are not filled in', async () => {
    renderPage(<SignupPage />, '/signup');

    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
  });

  it('does not report the password fields before showing them', async () => {
    // Validating the whole schema on Proceed would mark the empty password
    // invalid - an error against a field the visitor has not been offered yet.
    // Asserted on aria-invalid rather than on text, because the strength meter
    // renders "Enter a password" whenever the field is empty, error or not.
    renderPage(<SignupPage />, '/signup');

    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('advances once the details are valid', async () => {
    renderPage(<SignupPage />, '/signup');

    await fillStepOne();
    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
  });

  it('keeps what was typed when going back a step', async () => {
    // The steps stay mounted precisely so this holds - unmounting the first
    // would drop the values react-hook-form is holding.
    renderPage(<SignupPage />, '/signup');

    await fillStepOne();
    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));
    await userEvent.click(screen.getByRole('button', { name: /back to your details/i }));

    expect(await screen.findByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('alice@example.com');
  });

  it('returns to the first step when the server rejects the email', async () => {
    // The field the visitor has to change lives on step one, so leaving them
    // on step two would show an error against nothing they can see.
    mock.onPost('/signup').reply(409, { error: 'Email already in use.' });

    renderPage(<SignupPage />, '/signup');

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText(/step 1 of 2/i)).toBeInTheDocument();
  });

  it('sends the visitor to verification, carrying the email', async () => {
    mock.onPost('/signup').reply(200, { success: true });

    const router = renderPage(<SignupPage />, '/signup');

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/verify-otp');
    });
    expect(router.state.location.search).toContain('alice%40example.com');
  });

  it('puts a taken-email error on the email field', async () => {
    mock.onPost('/signup').reply(409, { error: 'Email already in use.' });

    renderPage(<SignupPage />, '/signup');

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText('Email already in use.')).toBeInTheDocument();
  });

  it('puts a bad referral code on the referral field', async () => {
    mock.onPost('/signup').reply(400, { error: 'Invalid referral code. Please check and try again.' });

    renderPage(<SignupPage />, '/signup');

    await fillStepOne();
    await userEvent.type(screen.getByLabelText('Referral Code (Optional)'), 'NOPE');
    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText(/invalid referral code/i)).toBeInTheDocument();
  });

  it('catches a password mismatch before submitting', async () => {
    renderPage(<SignupPage />, '/signup');

    await fillStepOne();
    await userEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'somethingelse1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });
});

describe('VerifyOtpPage', () => {
  it('sends anyone arriving without an email back to signup', async () => {
    const router = renderPage(<VerifyOtpPage />, '/verify-otp');

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/signup');
    });
  });

  it('submits as soon as the sixth digit lands, then signs the visitor in', async () => {
    // The endpoint issues the session itself, so there is no second login step.
    mock.onPost('/verify-otp').reply(200, { success: true });
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderPage(<VerifyOtpPage />, '/verify-otp?email=alice%40example.com');

    await userEvent.type(screen.getAllByRole('textbox')[0]!, '123456');

    expect(await screen.findByText('storefront home')).toBeInTheDocument();
  });

  it('keeps the visitor on the page after a wrong code', async () => {
    mock.onPost('/verify-otp').reply(401, { error: 'Incorrect OTP. Try again.' });

    renderPage(<VerifyOtpPage />, '/verify-otp?email=alice%40example.com');

    await userEvent.type(screen.getAllByRole('textbox')[0]!, '123456');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect OTP. Try again.');
  });

  it('sends them back to signup when the code has expired', async () => {
    // 410 is not a retryable failure - the pending signup is gone.
    mock.onPost('/verify-otp').reply(410, { error: 'OTP expired. Please sign up again.' });

    const router = renderPage(<VerifyOtpPage />, '/verify-otp?email=alice%40example.com');

    await userEvent.type(screen.getAllByRole('textbox')[0]!, '123456');

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/signup');
    });
  });

  it('holds the resend button behind a cooldown', async () => {
    renderPage(<VerifyOtpPage />, '/verify-otp?email=alice%40example.com');

    expect(await screen.findByText(/resend available in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send a new code/i })).not.toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('moves on to the code entry step', async () => {
    mock.onPost('/forgot-password').reply(200, { success: true });

    const router = renderPage(<ForgotPasswordPage />, '/forgot-password');

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/reset-otp');
    });
  });

  it('reports an unknown address against the field', async () => {
    mock.onPost('/forgot-password').reply(404, { error: 'No account with that email.' });

    renderPage(<ForgotPasswordPage />, '/forgot-password');

    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

    expect(await screen.findByText('No account with that email.')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('sends anyone arriving without an email back to the start', async () => {
    const router = renderPage(<ResetPasswordPage />, '/reset-password');

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/forgot-password');
    });
  });

  it('posts newPassword, which is what this endpoint expects', async () => {
    // The only password form in the app whose field is not called `password`.
    mock.onPost('/reset-password').reply(200, { success: true });

    renderPage(<ResetPasswordPage />, '/reset-password?email=alice%40example.com');

    await userEvent.type(screen.getByLabelText('New password'), 'correcthorse1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));

    await vi.waitFor(() => {
      expect(mock.history.post).toHaveLength(1);
    });

    const body = JSON.parse(String(mock.history.post[0]?.data));
    expect(body).toMatchObject({
      email: 'alice@example.com',
      newPassword: 'correcthorse1',
      confirmPassword: 'correcthorse1'
    });
  });

  it('enforces the new-password rules', async () => {
    renderPage(<ResetPasswordPage />, '/reset-password?email=alice%40example.com');

    await userEvent.type(screen.getByLabelText('New password'), 'short1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });
});
