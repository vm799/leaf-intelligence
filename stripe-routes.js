// stripe-routes.js
require('dotenv').config();
// stripe-routes.js
const express = require('express');
const router = express.Router();
const { User } = require('./db');
const stripeService = require('./stripe-service');
const authMiddleware = require('./auth-middleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
// In stripe-routes.js, update the create-portal-session route
router.post('/create-portal-session', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'No Stripe customer found' 
      });
    }

    // Add configuration to the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/account`,
      configuration: process.env.STRIPE_PORTAL_CONFIG_ID || undefined, // Optional: use a specific config
    });

    res.json({ 
      success: true, 
      url: session.url 
    });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
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
router.get('/verify-session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripeService.retrieveCheckoutSession(sessionId);
    
    res.json({
      success: true,
      status: session.payment_status,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'Failed to verify session' });
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