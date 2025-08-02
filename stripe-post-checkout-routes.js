// post-checkout-routes.js - Route handlers for post-checkout verification
const express = require('express');
const router = express.Router();
const PostCheckoutHandler = require('./stripe-post-checkout-handler');
const authMiddleware = require('./auth-middleware');

// Main verification endpoint - called when user returns from Stripe
// router.post('/verify-checkout', authMiddleware, async (req, res) => {
//   try {
//     const { sessionId } = req.body;
//     const userId = req.user._id.toString();
    
//     console.log(`🔍 Checkout verification request - Session: ${sessionId}, User: ${userId}`);
    
//     // Validate input
//     if (!sessionId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Session ID is required'
//       });
//     }
    
//     // Security check: validate session belongs to user
//     const validation = await PostCheckoutHandler.validateSessionOwnership(sessionId, userId);
//     if (!validation.valid) {
//       console.log(`❌ Session validation failed: ${validation.reason}`);
//       return res.status(403).json({
//         success: false,
//         error: 'Invalid session',
//         details: validation.reason
//       });
//     }
    
//     // Process the checkout
//     const result = await PostCheckoutHandler.verifyAndUpdateUser(sessionId, userId);
    
//     if (result.success) {
//       console.log(`✅ Checkout processed successfully for user: ${req.user.username}`);
      
//       // Return user-friendly response
//       res.json({
//         success: true,
//         message: 'Checkout verified and account updated successfully',
//         purchaseType: result.purchaseType,
//         amount: result.amount,
//         user: {
//           subscriptionTier: result.user.subscriptionTier,
//           subscriptionStatus: result.user.subscriptionStatus,
//           searchCredits: result.user.searchCredits,
//           featureAccess: result.user.featureAccess,
//           subscriptionEndDate: result.user.subscriptionEndDate,
//           trialEndDate: result.user.trialEndDate
//         },
//         details: {
//           subscriptionId: result.subscriptionId,
//           isTrialing: result.isTrialing,
//           searchCreditsAdded: result.searchCreditsAdded,
//           totalSearchCredits: result.totalSearchCredits
//         }
//       });
//     } else {
//       console.log(`❌ Checkout verification failed: ${result.error}`);
//       res.status(400).json({
//         success: false,
//         error: result.error,
//         message: 'Checkout verification failed'
//       });
//     }
//   } catch (error) {
//     console.error('❌ Checkout verification route error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       message: 'Failed to verify checkout'
//     });
//   }
// });

function generateSearchId() {
  return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}


// 2. Add the verify-checkout endpoint
app.post('/verify-checkout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Get userId from either the request body or the auth header
    let userId = req.body.userId;
    
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          userId = decoded.userId;
        } catch (e) {
          console.error('Error decoding auth token:', e);
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID not found in request' 
      });
    }
    
    console.log(`🔍 Verifying checkout session: ${sessionId} for user: ${userId}`);
    
    // Retrieve the session from Stripe
    const stripeService = require('./stripe-service');
    const session = await stripeService.retrieveCheckoutSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // Verify the session belongs to this user
    if (session.metadata.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Session does not belong to this user' 
      });
    }
    
    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment not completed' 
      });
    }
    
    // Update user in MongoDB
    const { User } = require('./db');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Process based on purchase type
    const purchaseType = session.metadata.type;
    
    if (purchaseType === 'single_search') {
      // Add search credit
      user.searchCredits = (user.searchCredits || 0) + 1;
      
      // Add to purchased searches
      user.purchasedSearches.push({
        searchId: generateSearchId(),
        purchaseDate: new Date(),
        stripePaymentIntentId: session.payment_intent,
        searchQuery: session.metadata.searchQuery || 'New Search',
        expiresAt: null
      });
      
      // Add to billing history
      user.billingHistory.push({
        date: new Date(),
        amount: session.amount_total / 100,
        description: 'Single Search Purchase',
        stripeInvoiceId: session.invoice,
        status: 'completed'
      });
      
    } else if (purchaseType === 'monthly_subscription') {
      // Update subscription details
      user.subscriptionTier = 'monthly';
      user.stripeSubscriptionId = session.subscription;
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = new Date();
      
      // Update feature access
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
    }
    
    // Save user
    await user.save();
    
    console.log(`✅ User ${userId} updated successfully after checkout`);
    
    // Return updated user data
    res.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        subscriptionTier: user.subscriptionTier,
        searchCredits: user.searchCredits,
        featureAccess: user.featureAccess
      },
      purchaseType: purchaseType
    });
    
  } catch (error) {
    console.error('Error in verify-checkout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify checkout: ' + error.message 
    });
  }
});

// 3. Add endpoint to get session details (for checkout-success.html)
app.get('/session-details/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const stripeService = require('./stripe-service');
    const session = await stripeService.retrieveCheckoutSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // Return minimal session details
    res.json({
      success: true,
      userId: session.metadata.userId,
      type: session.metadata.type,
      paymentStatus: session.payment_status
    });
    
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get session details' 
    });
  }
});
// Quick session status check (doesn't update user)
router.get('/session-status/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id.toString();
    
    console.log(`📊 Session status check - Session: ${sessionId}, User: ${userId}`);
    
    // Validate session belongs to user
    const validation = await PostCheckoutHandler.validateSessionOwnership(sessionId, userId);
    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid session'
      });
    }
    
    // Get session status
    const status = await PostCheckoutHandler.getSessionStatus(sessionId);
    
    res.json(status);
  } catch (error) {
    console.error('❌ Session status route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status'
    });
  }
});


// Add this new route to stripe-post-checkout-routes.js (add it before the module.exports line)

// Non-authenticated endpoint to get session details (including user ID from metadata)
// Non-authenticated endpoint to get session details (including user ID from metadata)
router.get('/session-details/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`🔍 Getting session details for: ${sessionId}`);
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    // Retrieve full session to get metadata directly from Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Return session details including user ID from metadata
    res.json({
      success: true,
      userId: session.metadata?.userId,
      customerId: session.customer,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      mode: session.mode,
      amount: session.amount_total / 100,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      created: new Date(session.created * 1000)
    });
    
  } catch (error) {
    console.error('❌ Session details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session details'
    });
  }
});

// Process any pending checkouts for user
router.post('/process-pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    console.log(`🔄 Processing pending checkouts for user: ${req.user.username}`);
    
    const result = await PostCheckoutHandler.processPendingCheckouts(userId);
    
    res.json({
      success: true,
      message: `Processed ${result.processed} pending checkout(s)`,
      processed: result.processed,
      sessions: result.sessions,
      error: result.error || null
    });
  } catch (error) {
    console.error('❌ Process pending route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process pending checkouts'
    });
  }
});

// Success page endpoint - handles redirects from Stripe
router.get('/success', async (req, res) => {
  try {
    const { session_id: sessionId, userId } = req.query;
    
    console.log(`✅ Success page accessed - Session: ${sessionId}, User: ${userId}`);
    
    // Basic validation
    if (!sessionId) {
      return res.redirect('/pricing?error=missing_session');
    }
    
    // If we have userId, we can auto-process
    if (userId) {
      try {
        const result = await PostCheckoutHandler.verifyAndUpdateUser(sessionId, userId);
        if (result.success) {
          // Redirect based on purchase type
          if (result.purchaseType === 'subscription') {
            return res.redirect(`/dashboard?welcome=subscription&session=${sessionId}`);
          } else {
            return res.redirect(`/dashboard?welcome=search&session=${sessionId}&credits=${result.totalSearchCredits}`);
          }
        }
      } catch (error) {
        console.error('❌ Auto-processing failed:', error);
        // Continue to manual processing page
      }
    }
    
    // Redirect to a page that will handle verification via JavaScript
    res.redirect(`/checkout-success.html?session_id=${sessionId}`);
  } catch (error) {
    console.error('❌ Success page error:', error);
    res.redirect('/pricing?error=processing_failed');
  }
});

// Cancel page endpoint
router.get('/cancel', (req, res) => {
  console.log(`❌ User canceled checkout`);
  res.redirect('/pricing?canceled=true');
});

// Debug endpoint to manually verify a session (admin only)
router.post('/debug-verify/:sessionId', async (req, res) => {
  try {
    // Check admin authorization
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    console.log(`🐛 Debug verification - Session: ${sessionId}, User: ${userId}`);
    
    const result = await PostCheckoutHandler.verifyAndUpdateUser(sessionId, userId);
    
    res.json({
      debug: true,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Debug verify error:', error);
    res.status(500).json({
      debug: true,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;