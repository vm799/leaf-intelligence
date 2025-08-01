// post-checkout-routes.js - Route handlers for post-checkout verification
const express = require('express');
const router = express.Router();
const PostCheckoutHandler = require('./stripe-post-checkout-handler');
const authMiddleware = require('./auth-middleware');

// Main verification endpoint - called when user returns from Stripe
router.post('/verify-checkout', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id.toString();
    
    console.log(`🔍 Checkout verification request - Session: ${sessionId}, User: ${userId}`);
    
    // Validate input
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    // Security check: validate session belongs to user
    const validation = await PostCheckoutHandler.validateSessionOwnership(sessionId, userId);
    if (!validation.valid) {
      console.log(`❌ Session validation failed: ${validation.reason}`);
      return res.status(403).json({
        success: false,
        error: 'Invalid session',
        details: validation.reason
      });
    }
    
    // Process the checkout
    const result = await PostCheckoutHandler.verifyAndUpdateUser(sessionId, userId);
    
    if (result.success) {
      console.log(`✅ Checkout processed successfully for user: ${req.user.username}`);
      
      // Return user-friendly response
      res.json({
        success: true,
        message: 'Checkout verified and account updated successfully',
        purchaseType: result.purchaseType,
        amount: result.amount,
        user: {
          subscriptionTier: result.user.subscriptionTier,
          subscriptionStatus: result.user.subscriptionStatus,
          searchCredits: result.user.searchCredits,
          featureAccess: result.user.featureAccess,
          subscriptionEndDate: result.user.subscriptionEndDate,
          trialEndDate: result.user.trialEndDate
        },
        details: {
          subscriptionId: result.subscriptionId,
          isTrialing: result.isTrialing,
          searchCreditsAdded: result.searchCreditsAdded,
          totalSearchCredits: result.totalSearchCredits
        }
      });
    } else {
      console.log(`❌ Checkout verification failed: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error,
        message: 'Checkout verification failed'
      });
    }
  } catch (error) {
    console.error('❌ Checkout verification route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to verify checkout'
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
    res.redirect(`/checkout-success?session_id=${sessionId}`);
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