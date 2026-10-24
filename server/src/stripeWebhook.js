
import { Router } from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { User } from './models.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const getId = value =>
  typeof value === 'string' ? value : value?.id || null;

const validStatuses = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete_expired',
  'paused'
];

async function syncSubscription(subscriptionId) {
  // Fetch current subscription state instead of trusting
  // the potentially outdated webhook event payload.
  const subscription = await stripe.subscriptions.retrieve(
    subscriptionId,
    { expand: ['items.data.price'] }
  );

  const customerId = getId(subscription.customer);
  const userId = subscription.metadata?.userId;

  // Match only an existing Stripe-linked user or the
  // authenticated user ID previously stored in Stripe metadata.
  let user = await User.findOne({
    stripeSubscriptionId: subscription.id
  });

  if (!user && customerId) {
    user = await User.findOne({
      stripeCustomerId: customerId
    });
  }

  if (
    !user &&
    userId &&
    mongoose.isValidObjectId(userId)
  ) {
    user = await User.findById(userId);
  }

  if (!user) {
    console.log(
      'Subscription has no matching ContextAI user:',
      subscription.id
    );
    return;
  }

  // Reject events that attempt to link a different customer
  // or subscription to an already-linked account.
  if (
    user.stripeCustomerId &&
    user.stripeCustomerId !== customerId
  ) {
    console.warn('Stripe customer mismatch:', subscription.id);
    return;
  }

  if (
    user.stripeSubscriptionId &&
    user.stripeSubscriptionId !== subscription.id
  ) {
    console.warn('Stripe subscription mismatch:', subscription.id);
    return;
  }

  // Only the configured ContextAI Pro price qualifies.
  const isProPrice = subscription.items.data.some(
    item => getId(item.price) === process.env.STRIPE_PRICE_ID
  );

  const status = validStatuses.includes(subscription.status)
    ? subscription.status
    : 'inactive';

  const isPro =
    isProPrice &&
    ['active', 'trialing'].includes(status);

  // Stripe API versions may expose the billing period
  // on subscription items rather than the subscription root.
  const periodEnd =
    subscription.current_period_end ??
    subscription.items.data
      .map(item => item.current_period_end)
      .filter(value => Number.isFinite(value))
      .sort((a, b) => b - a)[0];

  user.stripeCustomerId = customerId;
  user.stripeSubscriptionId = subscription.id;
  user.subscriptionStatus = status;
  user.plan = isPro ? 'pro' : 'free';

  user.subscriptionCurrentPeriodEnd = periodEnd
    ? new Date(periodEnd * 1000)
    : null;

console.log('Stripe cancellation debug:', {
  subscriptionId: subscription.id,
  status: subscription.status,
  cancelAtPeriodEnd: subscription.cancel_at_period_end,
  cancelAt: subscription.cancel_at,
  canceledAt: subscription.canceled_at
});

  
user.subscriptionCancelAtPeriodEnd =
  subscription.status !== 'canceled' &&
  (
    subscription.cancel_at_period_end === true ||
    (
      typeof subscription.cancel_at === 'number' &&
      subscription.cancel_at > Math.floor(Date.now() / 1000)
    )
  );



  await user.save();

  console.log(
    `Subscription synchronized: user=${user.id}, plan=${user.plan}, status=${status}`
  );
}

router.post('/', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({
      error: 'Missing Stripe signature'
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(
      'Stripe webhook verification failed:',
      error.message
    );

    return res.status(400).json({
      error: 'Invalid Stripe webhook signature'
    });
  }

  console.log('Verified Stripe event:', event.type);

  try {
    let subscriptionId = null;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.mode === 'subscription') {
        subscriptionId = getId(session.subscription);
      }
    }

    if (
      [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted'
      ].includes(event.type)
    ) {
      subscriptionId = event.data.object.id;
    }

    if (
      [
        'invoice.paid',
        'invoice.payment_failed'
      ].includes(event.type)
    ) {
      const invoice = event.data.object;

      subscriptionId =
        getId(invoice.parent?.subscription_details?.subscription) ||
        getId(invoice.subscription);
    }

    if (subscriptionId) {
      await syncSubscription(subscriptionId);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(
      'Stripe webhook processing failed:',
      error.message
    );

    // Non-2xx responses allow Stripe to retry failed events.
    return res.status(500).json({
      error: 'Webhook processing failed'
    });
  }
});

export default router;
