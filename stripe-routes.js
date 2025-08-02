// stripe-routes.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const { User } = require('./db');
const stripeService = require('./stripe-service');
const authMiddleware = require('./auth-middleware');

// Create checkout session for single search
router.post('/create-single-search-checkout', authMiddleware, async (req, res) => {
  try {
    const { searchQuery } = req.body;
    const user = req.user;
    
    // Create checkout session
    const session = await stripeService.createSingleSearchCheckout(user, searchQuery);
    
    res.json({ 
      success: true, 
      checkoutUrl: session.url,
      sessionId: session.id 
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create subscription checkout
router.post('/create-subscription-checkout', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    // Create checkout session
    const session = await stripeService.createSubscriptionCheckout(user);
    
    res.json({ 
      success: true, 
      checkoutUrl: session.url,
      sessionId: session.id 
    });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    res.status(500).json({ error: 'Failed to create subscription checkout' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await stripeService.cancelSubscription(user.stripeSubscriptionId);
    
    // Update user status
    user.subscriptionStatus = 'canceled';
    await user.save();
    
    res.json({ success: true, message: 'Subscription will be canceled at the end of the billing period' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get customer portal
router.post('/create-portal-session', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeCustomerId) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const session = await stripeService.createPortalSession(
      user.stripeCustomerId,
      `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/account`
    );
    
    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Check subscription status
router.get('/subscription-status', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || 'free',
      searchCredits: user.searchCredits || 0,
      featureAccess: user.featureAccess || getDefaultFeatureAccess(),
      subscriptionEndDate: user.subscriptionEndDate,
      purchasedSearches: user.purchasedSearches || []
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Verify payment success
// router.get('/verify-session/:sessionId', authMiddleware, async (req, res) => {
//   try {
//     const { sessionId } = req.params;
//     const session = await stripeService.retrieveCheckoutSession(sessionId);
    
//     res.json({
//       success: true,
//       status: session.payment_status,
//       metadata: session.metadata
//     });
//   } catch (error) {
//     console.error('Session verification error:', error);
//     res.status(500).json({ error: 'Failed to verify session' });
//   }
// });
// In your stripe routes file, create a separate route without auth middleware
router.post('/verify-checkout', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    // Verify the session with Stripe first
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    
    // Update user in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user with Stripe data
    user.stripeCustomerId = session.customer;
    user.subscriptionStatus = 'active';
    user.subscriptionTier = 'monthly'; // or whatever tier they purchased
    
    // Add billing history entry
    user.billingHistory.push({
      date: new Date(),
      amount: session.amount_total / 100, // Convert from cents
      description: 'Monthly subscription',
      stripeSessionId: sessionId,
      status: 'completed'
    });
    
    await user.save();
    
    // Set session for future requests
    req.session.userId = userId;
    await req.session.save(); // Explicitly save the session
    
    res.json({ 
      success: true, 
      message: 'Subscription activated successfully' 
    });
    
  } catch (error) {
    console.error('Verify checkout error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

function getDefaultFeatureAccess() {
  return {
    clinicalTrials: {
      topConditions: 3,
      trialAnalysis: true,
      viewAllTrials: true,
    },
    fdaData: {
      viewAllNDAs: false,
      timelineAccess: 'single',
      enforcementsAccess: false,
      adverseEventsAccess: false,
      labelingAccess: false
    },
    responseLetters: false,
    warningLetters: false,
    labeling: {
      latestChanges: 3,
      emaAccess: false
    },
    pubmed: {
      advancedSearch: false
    }
  };
}

module.exports = router;