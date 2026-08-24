import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import * as profileController from './profile.controller';
import { wantsJson } from '../../common/utils/wants-json.util';
import * as orderController from '../orders/order.controller';
import { currentUserId } from '../../common/utils/current-user.util';

const router = express.Router();

// Profile photos are held in memory and resized by sharp before being written.
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/** Accepts either auth path and backfills the session from req.user. */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = currentUserId(req);

  if (!userId) {
    // A request that arrived under /api wanted the API, whatever headers it
    // sent - a 302 to an HTML login page gives an XHR caller nothing to act on.
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  next();
};


router.post('/api/profile/edit', requireAuth, profileController.updateProfileData);

/**
 * @swagger
 * /profile/email:
 *   post:
 *     tags: [Profile]
 *     summary: Start an email change
 *     description: Sends an OTP to the current address; the change only applies once it is verified.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: OTP sent }
 *       400: { description: Email invalid or already in use }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/profile/email', requireAuth, profileController.updateEmail);

/**
 * @swagger
 * /profile/verify-email-update-otp:
 *   post:
 *     tags: [Profile]
 *     summary: Verify the email-change OTP
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: '123456' }
 *     responses:
 *       200: { description: Email updated }
 *       400: { description: OTP incorrect or expired }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/profile/verify-email-update-otp', requireAuth, profileController.verifyEmailUpdateOtp);

/**
 * @swagger
 * /profile/resend-email-update-otp:
 *   post:
 *     tags: [Profile]
 *     summary: Resend the email-change OTP
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: OTP resent }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/profile/resend-email-update-otp', requireAuth, profileController.resendEmailUpdateOtp);

router.post('/api/profile/verify-current-email', requireAuth, profileController.verifyCurrentEmail);
router.post('/api/profile/verify-email-otp', requireAuth, profileController.verifyEmailChangeOtp);
router.post('/api/profile/change-email', requireAuth, profileController.changeEmail);

router.post('/api/profile/change-password', requireAuth, profileController.updatePassword);


router.get('/orders', requireAuth, orderController.getUserOrders);

/**
 * @swagger
 * /profile/photo:
 *   post:
 *     tags: [Profile]
 *     summary: Upload a profile photo
 *     description: Accepts one image up to 5 MB; it is resized before being stored.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [profilePhoto]
 *             properties:
 *               profilePhoto: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Photo uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 photoUrl: { type: string }
 *       400: { description: Not an image, or larger than 5 MB }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   delete:
 *     tags: [Profile]
 *     summary: Remove the profile photo
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Photo removed, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post(
  '/api/profile/photo',
  requireAuth,
  upload.single('profilePhoto'),
  profileController.uploadProfilePhoto
);
router.delete('/api/profile/photo', requireAuth, profileController.deleteProfilePhoto);

/**
 * @swagger
 * /logout:
 *   get:
 *     tags: [Auth]
 *     summary: Log out
 *     description: Destroys the session and clears the cookie. Available as GET and POST.
 *     responses:
 *       302: { description: Redirected to the landing page }
 *   post:
 *     tags: [Auth]
 *     summary: Log out
 *     responses:
 *       302: { description: Redirected to the landing page }
 */
router.post('/logout', profileController.logout);
router.get('/logout', profileController.logout);

export = router;
