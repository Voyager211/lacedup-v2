import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { issueSession, endSession } from './auth.session';

const getLogin = (req: Request, res: Response) => {
    try {
        if (req.isAuthenticated()) return res.redirect('/admin/dashboard');
        res.render('admin/login', {
            title: 'Admin Login',
            layout: 'layouts/login-layout',
            message: req.flash('error'),
            formData: req.flash('formData')[0] || {}
        });
    } catch (error: any) {
        console.error('Error rendering login page:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postLogin = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Server-side validation before authentication
        const validationResult = validateLoginForm(req.body);

        if (!validationResult.isValid) {
            // Store form data to preserve user input
            req.flash('formData', {
                email: req.body.email ? req.body.email.trim() : '',
                remember: req.body.remember || false
            } as unknown as string);
            req.flash('error', validationResult.message ?? '');
            return res.redirect('/admin/login');
        }

        // Trim and sanitize input before authentication
        req.body.email = req.body.email.trim();
        req.body.password = req.body.password.trim();

        // The custom-callback form of authenticate: it verifies the credentials
        // but does not establish anything, leaving us to issue the JWT pair.
        passport.authenticate('local', async (err: any, user: any, info: any) => {
            try {
                if (err) {
                    console.error('Admin authentication error:', err);
                    return res.status(500).send('Internal Server Error');
                }

                if (!user) {
                    req.flash('error', info?.message || 'Invalid credentials');
                    return res.redirect('/admin/login');
                }

                // A valid shopper login must not become an admin session.
                if (user.role !== 'admin') {
                    req.flash('error', 'Not authorized as admin');
                    return res.redirect('/admin/login');
                }

                await issueSession(res, user, 'admin');
                req.session.role = 'admin';

                return res.redirect('/admin/dashboard');
            } catch (innerErr: any) {
                console.error('Error during login post-auth callback:', innerErr);
                return res.status(500).send('Internal Server Error');
            }
        })(req, res, next);
    } catch (error: any) {
        console.error('Error during postLogin handler:', error);
        next(error); // Let Express handle it or add custom fallback
    }
};




const logout = async (req: Request, res: Response) => {
    try {
        // Revoke the admin refresh token server-side, then clear both cookies.
        await endSession(res, req.cookies?.admin_rt, 'admin');

        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error('Session destroy error:', destroyErr);
                return res.status(500).send('Session Error');
            }

            res.redirect('/admin/login');
        });
    } catch (error: any) {
        console.error('Unexpected error in logout:', error);
        res.status(500).send('Internal Server Error');
    }
};

/**
 * Server-side validation for admin login form
 * @param {Object} formData - The form data from request body
 * @returns {Object} - Validation result with isValid boolean and message
 */
function validateLoginForm(formData: { email?: string; password?: string; remember?: unknown }) {
    const { email, password } = formData;

    // Check if email is provided
    if (!email || !email.trim()) {
        return { isValid: false, message: 'Email is required' };
    }

    // Check if password is provided
    if (!password || !password.trim()) {
        return { isValid: false, message: 'Password is required' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim();

    if (!emailRegex.test(trimmedEmail)) {
        return { isValid: false, message: 'Please enter a valid email address' };
    }

    // Validate password length
    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 6) {
        return { isValid: false, message: 'Password must be at least 6 characters' };
    }

    return { isValid: true };
}

export {
    getLogin,
    postLogin,
    logout
}