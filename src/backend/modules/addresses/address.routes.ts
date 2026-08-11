import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as addressController from './address.controller';

const router = express.Router();

/**
 * Accepts either auth path this codebase currently has - passport's req.user or
 * a raw req.session.userId - and backfills the session from req.user so the
 * rest of the module can rely on one of them. Both paths are unified in the
 * JWT phase.
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session.userId || (req.user && req.user._id);

  if (!userId) {
    return res.redirect('/login');
  }

  if (!req.session.userId && req.user) {
    req.session.userId = String(req.user._id);
  }

  next();
};

/**
 * @swagger
 * /addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: Address book page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Address book markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /login when not signed in }
 */
router.get('/addresses', requireAuth, addressController.loadAddresses);

/**
 * @swagger
 * /api/addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: List the user's addresses
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: All addresses for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 addresses:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/api/addresses', requireAuth, addressController.getAddresses);

/**
 * @swagger
 * /api/addresses/paginated:
 *   get:
 *     tags: [Addresses]
 *     summary: List addresses, paginated
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: A page of addresses
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     addresses:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Address' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/api/addresses/paginated', requireAuth, addressController.getAddressesPaginated);

/**
 * @swagger
 * /api/address/{addressId}:
 *   get:
 *     tags: [Addresses]
 *     summary: Fetch a single address
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The address, content: { application/json: { schema: { $ref: '#/components/schemas/Address' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Addresses]
 *     summary: Update an address
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Address' }
 *     responses:
 *       200: { description: Address updated, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Validation failed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete an address
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Address deleted, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/address/:addressId', requireAuth, addressController.getAddress);

/**
 * @swagger
 * /api/address:
 *   post:
 *     tags: [Addresses]
 *     summary: Add an address
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressType, name, city, landMark, state, pincode, phone]
 *             properties:
 *               addressType: { type: string, example: Home }
 *               name: { type: string }
 *               city: { type: string }
 *               landMark: { type: string }
 *               state: { type: string }
 *               pincode: { type: integer, example: 682001 }
 *               phone: { type: string }
 *               altPhone: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201: { description: Address created, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Validation failed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/address', requireAuth, addressController.addAddress);

router.put('/api/address/:addressId', requireAuth, addressController.updateAddress);
router.delete('/api/address/:addressId', requireAuth, addressController.deleteAddress);

/**
 * @swagger
 * /api/address/{addressId}/default:
 *   patch:
 *     tags: [Addresses]
 *     summary: Make an address the default
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Default address updated, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/api/address/:addressId/default', requireAuth, addressController.setDefaultAddress);

/**
 * @swagger
 * /api/states-districts:
 *   get:
 *     tags: [Addresses]
 *     summary: Indian states and their districts
 *     description: Reference data for the address form. Public - no auth required.
 *     responses:
 *       200:
 *         description: States mapped to their districts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: array
 *                 items: { type: string }
 */
router.get('/api/states-districts', addressController.getStatesAndDistricts);

export = router;
