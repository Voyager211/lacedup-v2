const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * The Razorpay client is created on first use rather than at module load.
 *
 * Constructing it eagerly meant a missing RAZORPAY_KEY_ID took down the whole
 * app at boot - and made this module (and everything that imports it, which
 * includes checkout and orders) impossible to require in a test without live
 * credentials.
 */
let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        'Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET'
      );
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
};

//  Create Razorpay Order
const createRazorpayOrder = async (orderId, amount) => {
  try {
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: orderId,
      payment_capture: 1,
      notes: { orderId }
    };

    const order = await getRazorpayInstance().orders.create(options);
    return order;
  } catch (error) {
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
};

//  Verify Payment Signature
const verifyPaymentSignature = (razorpayOrderId, paymentId, signature) => {
  try {
    const body = razorpayOrderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

//  Fetch Payment Details
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await getRazorpayInstance().payments.fetch(paymentId);
    return payment;
  } catch (error) {
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};

module.exports = {
  getRazorpayInstance,
  createRazorpayOrder,
  verifyPaymentSignature,
  getPaymentDetails
};
