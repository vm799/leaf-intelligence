// stripe-webhook.js
const express = require('express');
const router = express.Router();
const { User } = require('./db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();
// Webhook endpoint - MUST use raw body
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// async function handleCheckoutComplete(session) {
//   const userId = session.metadata.userId;
//   const type = session.metadata.type;
  
//   const user = await User.findById(userId);
//   if (!user) {
//     console.error('User not found for checkout session:', session.id);
//     return;
//   }

//   if (type === 'single_search') {
//     // Add search credit
//     user.searchCredits = (user.searchCredits || 0) + 1;
//     user.purchasedSearches.push({
//       searchId: generateSearchId(),
//       purchaseDate: new Date(),
//       stripePaymentIntentId: session.payment_intent,
//       searchQuery: session.metadata.searchQuery,
//       expiresAt: null
//     });
    
//     // Add to billing history
//     user.billingHistory.push({
//       date: new Date(),
//       amount: session.amount_total / 100,
//       description: 'Single Search Purchase',
//       stripeInvoiceId: session.invoice,
//       status: 'completed'
//     });
    
//     // Log activity
//     if (user.activityLog) {
//       user.activityLog.push({
//         activity: 'purchase',
//         timestamp: new Date(),
//         details: {
//           type: 'single_search',
//           amount: session.amount_total / 100,
//           searchQuery: session.metadata.searchQuery
//         }
//       });
//     }
//   } else if (type === 'monthly_subscription') {
//     // Subscription will be handled by subscription events
//     user.stripeSubscriptionId = session.subscription;
//   }
  
//   await user.save();
// }


// Update your stripe-webhook.js handleCheckoutComplete function

async function handleCheckoutComplete(session) {
  const userId = session.metadata.userId;
  const type = session.metadata.type;
  
  const user = await User.findById(userId);
  if (!user) {
    console.error('User not found for checkout session:', session.id);
    return;
  }

  if (type === 'single_search') {
    // Add search credit
    user.searchCredits = (user.searchCredits || 0) + 1;
    
    // Update the subscription tier
    if (user.subscriptionTier === 'free' || user.subscriptionTier === 'free-trial') {
      user.subscriptionTier = 'single-search';
      user.subscriptionStatus = 'active';  // ✅ Changed from 'single-search-active' to 'active'
    }
    
    // Store the purchased search
    user.purchasedSearches.push({
      searchId: generateSearchId(),
      purchaseDate: new Date(),
      stripePaymentIntentId: session.payment_intent,
      searchQuery: session.metadata.searchQuery,
      expiresAt: null,
      used: false
    });
    
    // Add to billing history
    user.billingHistory.push({
      date: new Date(),
      amount: session.amount_total / 100,
      description: 'Single Search Purchase',
      stripeInvoiceId: session.invoice,
      status: 'completed'
    });
    
    // ✅ FIXED: Update feature access with the correct schema structure
    user.featureAccess = {
      clinicalTrials: {
        topConditions: 5,  // Give them 5 instead of 3
        trialAnalysis: true,
        viewAllTrials: true,
      },
      fdaData: {
        viewAllNDAs: true,  // Enable for single search buyers
        timelineAccess: 'single',
        enforcementsAccess: false,
        adverseEventsAccess: false,
        labelingAccess: true  // Enable labeling for single search
      },
      responseLetters: false,
      warningLetters: false,
      labeling: {
        latestChanges: 5,  // Give them 5 instead of 3
        emaAccess: true  // Enable EMA access for single search
      },
      pubmed: {
        advancedSearch: true  // Enable advanced search
      }
    };
    
    // Log activity
    if (!user.activityLog) user.activityLog = [];
    user.activityLog.push({
      activity: 'purchase',
      timestamp: new Date(),
      details: {
        type: 'single_search',
        amount: session.amount_total / 100,
        searchQuery: session.metadata.searchQuery,
        creditsAfterPurchase: user.searchCredits
      }
    });
    
    console.log(`✅ Single search purchase processed for user ${user.username}:`, {
      searchCredits: user.searchCredits,
      tier: user.subscriptionTier,
      status: user.subscriptionStatus
    });
  } else if (type === 'monthly_subscription') {
    // Handle subscription
    user.stripeSubscriptionId = session.subscription;
    user.subscriptionTier = 'monthly';
    user.subscriptionStatus = 'active';
  }
  
  await user.save();
}



async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  user.stripeSubscriptionId = subscription.id;
  user.subscriptionStatus = subscription.status;
  user.subscriptionTier = 'monthly';
  // user.subscriptionStartDate = new Date(subscription.current_period_start * 1000);
  // user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);

  if (subscription.current_period_start) {
  user.subscriptionStartDate = new Date(subscription.current_period_start * 1000);
} else {
  user.subscriptionStartDate = new Date(); // Default to now if missing
}

if (subscription.current_period_end) {
  user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
} else {
  user.subscriptionEndDate = null; // Or calculate based on start + duration
}
  
  // Update feature access for monthly subscription
  user.featureAccess = {
    clinicalTrials: {
      topConditions: -1, // Unlimited
      trialAnalysis: true,
      viewAllTrials: true,
    },
    fdaData: {
      viewAllNDAs: true,
      timelineAccess: 'all',
      enforcementsAccess: true,
      adverseEventsAccess: true,
      labelingAccess: true
    },
    responseLetters: true,
    warningLetters: true,
    labeling: {
      latestChanges: -1, // Unlimited
      emaAccess: true
    },
    pubmed: {
      advancedSearch: true
    }
  };
  
  await user.save();
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ stripeCustomerId: customerId });
  
  if (!user) {
    console.error('User not found for deleted subscription:', subscription.id);
    return;
  }

  user.subscriptionStatus = 'canceled';
  user.subscriptionTier = 'free';
  user.stripeSubscriptionId = null;
  
  // Reset feature access to free tier
  user.featureAccess = {
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
  
  await user.save();
}

async function handleInvoicePaymentSucceeded(invoice) {
  // Add to billing history
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (user) {
    user.billingHistory.push({
      date: new Date(),
      amount: invoice.amount_paid / 100,
      description: 'Monthly Subscription Payment',
      stripeInvoiceId: invoice.id,
      status: 'completed'
    });
    await user.save();
  }
}

async function handleInvoicePaymentFailed(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (user) {
    user.subscriptionStatus = 'past_due';
    await user.save();
  }
}

function generateSearchId() {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = router;