
import { Router } from 'express';
import Stripe from 'stripe';
import { User } from './models.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create a Stripe subscription checkout session
router.post('/checkout', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (user.subscriptionStatus === 'active') {
      return res.status(409).json({
        error: 'You already have an active subscription'
      });
    }

    const clientUrl =
      process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',

      customer_email: user.stripeCustomerId
        ? undefined
        : user.email,

      customer: user.stripeCustomerId || undefined,

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],

      client_reference_id: String(user._id),

      subscription_data: {
        metadata: {
          userId: String(user._id)
        }
      },

      success_url:
        `${clientUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${clientUrl}/billing/cancel`
    });

    res.json({
      url: session.url
    });
  } catch (error) {
    next(error);
  }
});

 // Create a Stripe Customer Portal session
router.post('/portal', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        error: 'No Stripe billing account found'
      });
    }

    const clientUrl =
      process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: clientUrl
    });

    res.json({
      url: session.url
    });
  } catch (error) {
    next(error);
  }
});


export default router;
