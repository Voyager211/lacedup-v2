import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';
import { BACKEND_SRC } from './paths';

/**
 * OpenAPI spec, assembled from @swagger JSDoc blocks in the route files.
 *
 * The globs resolve from BACKEND_SRC rather than process.cwd(), for the same
 * reason as everything else in config/paths.ts. Both .ts and .js are scanned
 * while the JavaScript-to-TypeScript conversion is still in progress.
 */
const options: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'LacedUp API',
      version: '1.0.0',
      description:
        'REST API for the LacedUp storefront and admin panel.\n\n' +
        'Routes are mounted twice during the React migration: on their historic ' +
        'path (used by the EJS templates) and under `/api`. The `/api` mounts ' +
        'are the ones documented here.'
    },
    servers: [
      { url: '/api', description: 'API mount' },
      { url: '/', description: 'Legacy mount used by the EJS views' }
    ],
    tags: [
      { name: 'Auth', description: 'Signup, login, OTP and password reset' },
      { name: 'Catalog', description: 'Products, categories and brands' },
      { name: 'Shop', description: 'Storefront browsing and search' },
      { name: 'Cart', description: 'Shopping cart' },
      { name: 'Wishlist', description: 'Saved products' },
      { name: 'Addresses', description: 'User address book' },
      { name: 'Checkout', description: 'Checkout and payment' },
      { name: 'Orders', description: 'Order history, cancellation and returns' },
      { name: 'Coupons', description: 'Coupon lookup and application' },
      { name: 'Wallet', description: 'Wallet balance and transactions' },
      { name: 'Referrals', description: 'Referral codes and rewards' },
      { name: 'Reviews', description: 'Product reviews' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Content', description: 'Static pages' },
      { name: 'Admin', description: 'Admin panel endpoints' }
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'user.sid',
          description:
            'Session cookie issued on login. Admin routes use `admin.sid` instead. ' +
            'Replaced by a JWT cookie in a later phase.'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'integer', example: 1 },
            totalPages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean' },
            hasPrevPage: { type: 'boolean' }
          }
        },
        ProductVariant: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            size: { type: 'string', example: 'UK 9' },
            stock: { type: 'integer', example: 12 },
            basePrice: { type: 'number', example: 7999 },
            variantSpecificOffer: { type: 'number', example: 10 },
            sku: { type: 'string', example: 'NK-AIRMAX-UK9' }
          }
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            productName: { type: 'string', example: 'Air Max 90' },
            slug: { type: 'string', example: 'air-max-90' },
            description: { type: 'string' },
            brand: { type: 'string', description: 'Brand id, or the populated brand' },
            category: { type: 'string', description: 'Category id, or the populated category' },
            regularPrice: { type: 'number', example: 10999 },
            productOffer: { type: 'number', example: 15 },
            variants: { type: 'array', items: { $ref: '#/components/schemas/ProductVariant' } },
            totalStock: { type: 'integer' },
            mainImage: { type: 'string' },
            subImages: { type: 'array', items: { type: 'string' } },
            isListed: { type: 'boolean' },
            isDeleted: { type: 'boolean' }
          }
        },
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            variantId: { type: 'string' },
            sku: { type: 'string' },
            size: { type: 'string' },
            quantity: { type: 'integer', example: 1 },
            price: { type: 'number' },
            totalPrice: { type: 'number' }
          }
        },
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            variantId: { type: 'string' },
            sku: { type: 'string' },
            size: { type: 'string' },
            quantity: { type: 'integer' },
            price: { type: 'number' },
            totalPrice: { type: 'number' },
            status: {
              type: 'string',
              enum: [
                'Pending',
                'Processing',
                'Shipped',
                'Delivered',
                'Cancelled',
                'Returned',
                'Failed',
                'Partially Returned',
                'Partially Delivered',
                'Processing Return'
              ]
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            orderId: { type: 'string', example: 'ORD000123' },
            user: { type: 'string' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            paymentMethod: {
              type: 'string',
              enum: ['cod', 'card', 'upi', 'paypal', 'netbanking', 'wallet']
            },
            paymentStatus: { type: 'string', example: 'Pending' },
            subtotal: { type: 'number' },
            totalDiscount: { type: 'number' },
            shipping: { type: 'number' },
            totalAmount: { type: 'number' },
            status: { type: 'string', example: 'Pending' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Address: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            addressType: { type: 'string', example: 'Home' },
            name: { type: 'string' },
            city: { type: 'string' },
            landMark: { type: 'string' },
            state: { type: 'string' },
            pincode: { type: 'integer', example: 682001 },
            phone: { type: 'string' },
            altPhone: { type: 'string' },
            isDefault: { type: 'boolean' }
          }
        },
        Coupon: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'SAVE10' },
            name: { type: 'string' },
            discountType: { type: 'string', enum: ['percentage', 'fixed'] },
            discountValue: { type: 'number', example: 10 },
            minimumOrderValue: { type: 'number' },
            maximumDiscountAmount: { type: 'number', nullable: true },
            validFrom: { type: 'string', format: 'date-time' },
            validTo: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' }
          }
        },
        WalletTransaction: {
          type: 'object',
          properties: {
            transactionId: { type: 'string', example: 'TXN17012345678901' },
            type: { type: 'string', enum: ['credit', 'debit'] },
            amount: { type: 'number' },
            description: { type: 'string' },
            paymentMethod: {
              type: 'string',
              enum: ['razorpay', 'manual_credit', 'refund', 'payment_for_order', 'referral_reward']
            },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
            balanceAfter: { type: 'number' },
            date: { type: 'string', format: 'date-time' }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Not authenticated. JSON clients get 401; browsers are redirected to /login.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        ServerError: {
          description: 'Unexpected server error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        RateLimited: {
          description: 'Too many requests - see the limits on auth, OTP and payment routes',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        }
      }
    }
  },
  // Forward slashes deliberately: path.join emits backslashes on Windows and
  // the glob matcher silently matches nothing, producing an empty spec.
  apis: [
    `${BACKEND_SRC.replace(/\\/g, '/')}/modules/**/*.routes.ts`,
    `${BACKEND_SRC.replace(/\\/g, '/')}/modules/**/*.routes.js`
  ]
};

export const swaggerSpec = swaggerJsdoc(options) as Record<string, unknown>;
