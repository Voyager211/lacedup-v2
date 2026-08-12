import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  changePasswordSchema,
  emailSchema,
  loginSchema,
  nameSchema,
  newPasswordSchema,
  phoneSchema,
  signupSchema
} from './schemas';

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('emailSchema', () => {
  it('accepts a normal address', () => {
    expect(ok(emailSchema, 'someone@example.com')).toBe(true);
  });

  it('accepts newer TLDs the old allowlist rejected', () => {
    // validation.js checked the suffix against a hardcoded list of 14 TLDs, so
    // every one of these was refused. That was the bug this schema fixes.
    for (const email of ['dev@thing.io', 'hi@app.dev', 'a@studio.design', 'x@mail.co.uk']) {
      expect(ok(emailSchema, email)).toBe(true);
    }
  });

  it.each(['', 'not-an-email', 'missing@domain', '@example.com', 'spaces in@email.com'])(
    'rejects %s',
    (email) => {
      expect(ok(emailSchema, email)).toBe(false);
    }
  );

  it('trims and lowercases so duplicates cannot slip past', () => {
    expect(emailSchema.parse('  Someone@Example.COM  ')).toBe('someone@example.com');
  });
});

describe('nameSchema', () => {
  it.each(["O'Brien", 'Anne-Marie', 'José', 'Ravi Kumar', 'Jo'])('accepts %s', (name) => {
    // The old /^[a-zA-Z\s]+$/ rejected every one of these except the last two.
    expect(ok(nameSchema, name)).toBe(true);
  });

  it.each(['', 'A', '123', '<script>', '  '])('rejects %s', (name) => {
    expect(ok(nameSchema, name)).toBe(false);
  });

  it('requires a letter first, so a name cannot start with punctuation', () => {
    expect(ok(nameSchema, "'Brien")).toBe(false);
  });
});

describe('phoneSchema', () => {
  it.each(['9876543210', '6000000000'])('accepts %s', (phone) => {
    expect(ok(phoneSchema, phone)).toBe(true);
  });

  it.each(['1234567890', '987654321', '98765432101', '+919876543210', 'abcdefghij'])(
    'rejects %s',
    (phone) => {
      expect(ok(phoneSchema, phone)).toBe(false);
    }
  );
});

describe('newPasswordSchema', () => {
  it('accepts a password with a letter, a digit and enough length', () => {
    expect(ok(newPasswordSchema, 'correcthorse1')).toBe(true);
  });

  it.each([
    ['short1', 'too short'],
    ['alllettershere', 'no digit'],
    ['12345678', 'no letter']
  ])('rejects %s (%s)', (password) => {
    expect(ok(newPasswordSchema, password)).toBe(false);
  });
});

describe('loginSchema', () => {
  it('does not impose the new-password rules on an existing account', () => {
    // An account created under the old 6-character rule must still be able to
    // sign in - refusing to submit would lock the owner out entirely.
    expect(ok(loginSchema, { email: 'a@example.com', password: 'old123' })).toBe(true);
  });

  it('still requires a password to be entered', () => {
    expect(ok(loginSchema, { email: 'a@example.com', password: '' })).toBe(false);
  });
});

describe('signupSchema', () => {
  const valid = {
    name: 'Test Shopper',
    email: 'shopper@example.com',
    password: 'correcthorse1',
    confirmPassword: 'correcthorse1'
  };

  it('accepts a complete signup', () => {
    expect(ok(signupSchema, valid)).toBe(true);
  });

  it('reports a mismatch against the confirm field, not the password field', () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: 'somethingelse' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  it('treats the referral code as optional', () => {
    expect(ok(signupSchema, { ...valid, referralCode: '' })).toBe(true);
    expect(ok(signupSchema, { ...valid, referralCode: 'FRIEND50' })).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'oldpassword1',
    password: 'newpassword1',
    confirmPassword: 'newpassword1'
  };

  it('accepts a genuine change', () => {
    expect(ok(changePasswordSchema, valid)).toBe(true);
  });

  it('refuses a "change" to the same password', () => {
    expect(
      ok(changePasswordSchema, {
        currentPassword: 'samepassword1',
        password: 'samepassword1',
        confirmPassword: 'samepassword1'
      })
    ).toBe(false);
  });
});

describe('addressSchema', () => {
  const valid = {
    name: 'Test Shopper',
    phone: '9876543210',
    addressType: 'Home' as const,
    landMark: 'Near the park',
    city: 'Kochi',
    district: 'Ernakulam',
    state: 'Kerala',
    pincode: '682001'
  };

  it('accepts a complete address', () => {
    expect(ok(addressSchema, valid)).toBe(true);
  });

  it.each(['12345', '1234567', '082001', 'abcdef'])('rejects pincode %s', (pincode) => {
    expect(ok(addressSchema, { ...valid, pincode })).toBe(false);
  });

  it('allows an empty alternate phone but not a malformed one', () => {
    expect(ok(addressSchema, { ...valid, altPhone: '' })).toBe(true);
    expect(ok(addressSchema, { ...valid, altPhone: '123' })).toBe(false);
  });

  it('restricts the address type to the three the backend stores', () => {
    expect(ok(addressSchema, { ...valid, addressType: 'Warehouse' })).toBe(false);
  });
});
