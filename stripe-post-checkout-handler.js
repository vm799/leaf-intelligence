// post-checkout-handler.js - Complete Post-Checkout Verification System
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User } = require('./db');

class PostCheckoutHandler {
  
  // Main function to handle checkout verification and user updates
  static async verifyAndUpdateUser(sessionId, userId) {
    try {
      console.log(`🔍 Starting checkout verification for session: ${sessionId}, user: ${userId}`);
      
      // Step 1: Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'payment_intent']
      });
      
      console.log(`📊 Session details:`, {
        id: session.id,
        mode: session.mode,
        payment_status: session.payment_status,
        customer: session.customer,
        subscription: session.subscription?.id || null
      });
      
      // Step 2: Get the user from database
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      
      console.log(`👤 Found user: ${user.username} (${user.email})`);
      
      // Step 3: Verify the session belongs to this user
      if (session.metadata?.userId !== userId) {
        throw new Error('Session does not belong to this user');
      }
      
      // Step 4: Check payment was successful
      if (session.payment_status !== 'paid') {
        console.log(`❌ Payment not completed. Status: ${session.payment_status}`);
        return {
          success: false,
          message: `Payment not completed. Status: ${session.payment_status}`,
          status: session.payment_status
        };
      }
      
      console.log(`✅ Payment confirmed as successful`);
      
      // Step 5: Update customer ID if not set
      if (!user.stripeCustomerId && session.customer) {
        user.stripeCustomerId = session.customer;
        console.log(`💾 Saved Stripe customer ID: ${session.customer}`);
      }
      
      // Step 6: Process based on session mode
      let result;
      if (session.mode === 'subscription') {
        result = await this.handleSubscriptionPurchase(user, session);
      } else if (session.mode === 'payment') {
        result = await this.handleSinglePayment(user, session);
      } else {
        throw new Error(`Unknown session mode: ${session.mode}`);
      }
      
      // Step 7: Save all changes to database
      await user.save();
      
      console.log(`✅ User updated successfully after ${session.mode} purchase`);
      
      return {
        success: true,
        user: user,
        purchaseType: session.mode,
        amount: session.amount_total / 100,
        ...result
      };
      
    } catch (error) {
      console.error('❌ Checkout verification error:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }
  
  // Handle subscription purchase
  static async handleSubscriptionPurchase(user, session) {
    try {
      console.log(`📋 Processing subscription purchase...`);
      
      // Wait a moment for Stripe to fully create the subscription
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let subscription;
      
      // Get subscription from session or fetch latest
      if (session.subscription) {
        if (typeof session.subscription === 'string') {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        } else {
          subscription = session.subscription;
        }
      } else {
        // Fallback: get latest subscription for customer
        const subscriptions = await stripe.subscriptions.list({
          customer: session.customer,
          status: 'all',
          limit: 1
        });
        
        if (subscriptions.data.length === 0) {
          throw new Error('No subscription found after checkout');
        }
        
        subscription = subscriptions.data[0];
      }
      
      console.log(`📊 Subscription details:`, {
        id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      });
      
      // Update user subscription details
      user.stripeSubscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;
      user.subscriptionTier = 'monthly';
      user.subscriptionStartDate = new Date(subscription.current_period_start * 1000);
      user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      
      // Handle trial period
      if (subscription.trial_end) {
        user.trialEndDate = new Date(subscription.trial_end * 1000);
        console.log(`🆓 Trial period ends: ${user.trialEndDate}`);
      }
      
      // Grant premium features
      user.featureAccess = this.getPremiumFeatures();
      
      // Add to billing history
      if (!user.billingHistory) user.billingHistory = [];
      user.billingHistory.push({
        date: new Date(),
        amount: session.amount_total / 100,
        description: subscription.status === 'trialing' ? 'Monthly Subscription (Trial Started)' : 'Monthly Subscription',
        stripeSessionId: session.id,
        stripeSubscriptionId: subscription.id,
        status: 'completed'
      });
      
      // Add to activity log
      if (!user.activityLog) user.activityLog = [];
      user.activityLog.push({
        activity: 'subscription_created',
        timestamp: new Date(),
        details: {
          subscriptionId: subscription.id,
          status: subscription.status,
          amount: session.amount_total / 100,
          sessionId: session.id
        }
      });
      
      console.log(`✅ Subscription activated: ${subscription.id} (${subscription.status})`);
      
      return {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        isTrialing: subscription.status === 'trialing',
        trialEndDate: user.trialEndDate
      };
      
    } catch (error) {
      console.error('❌ Error processing subscription:', error);
      throw new Error(`Subscription processing failed: ${error.message}`);
    }
  }
  
  // Handle single payment (search credits)
  static async handleSinglePayment(user, session) {
    try {
      console.log(`💰 Processing single payment...`);
      
      // Add search credit
      const previousCredits = user.searchCredits || 0;
      user.searchCredits = previousCredits + 1;
      
      // Add to purchased searches
      if (!user.purchasedSearches) user.purchasedSearches = [];
      
      const searchRecord = {
        searchId: this.generateSearchId(),
        purchaseDate: new Date(),
        stripePaymentIntentId: session.payment_intent?.id || session.payment_intent,
        stripeSessionId: session.id,
        searchQuery: session.metadata?.searchQuery || 'Single Search Purchase',
        amount: session.amount_total / 100,
        expiresAt: null, // Single searches don't expire
        used: false
      };
      
      user.purchasedSearches.push(searchRecord);
      
      // Add to billing history
      if (!user.billingHistory) user.billingHistory = [];
      user.billingHistory.push({
        date: new Date(),
        amount: session.amount_total / 100,
        description: 'Single Search Purchase',
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent?.id || session.payment_intent,
        status: 'completed'
      });
      
      // Add to activity log
      if (!user.activityLog) user.activityLog = [];
      user.activityLog.push({
        activity: 'single_search_purchased',
        timestamp: new Date(),
        details: {
          amount: session.amount_total / 100,
          searchQuery: session.metadata?.searchQuery || 'Unknown',
          creditsAfter: user.searchCredits,
          sessionId: session.id
        }
      });
      
      console.log(`✅ Single search processed. Credits: ${previousCredits} → ${user.searchCredits}`);
      
      return {
        searchCreditsAdded: 1,
        totalSearchCredits: user.searchCredits,
        searchRecord: searchRecord
      };
      
    } catch (error) {
      console.error('❌ Error processing single payment:', error);
      throw new Error(`Single payment processing failed: ${error.message}`);
    }
  }
  
  // Get session status without updating user (for quick checks)
  static async getSessionStatus(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      return {
        success: true,
        status: session.payment_status,
        mode: session.mode,
        amount: session.amount_total / 100,
        customerEmail: session.customer_details?.email,
        created: new Date(session.created * 1000)
      };
    } catch (error) {
      console.error('❌ Error getting session status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Validate that session belongs to user (security check)
  static async validateSessionOwnership(sessionId, userId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Check metadata for user ID
      if (session.metadata?.userId !== userId) {
        return {
          valid: false,
          reason: 'Session does not belong to user'
        };
      }
      
      // Additional validation: check if user exists and has matching customer ID
      const user = await User.findById(userId);
      if (!user) {
        return {
          valid: false,
          reason: 'User not found'
        };
      }
      
      // If user already has a customer ID, verify it matches
      if (user.stripeCustomerId && user.stripeCustomerId !== session.customer) {
        return {
          valid: false,
          reason: 'Customer ID mismatch'
        };
      }
      
      return {
        valid: true,
        session: session,
        user: user
      };
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return {
        valid: false,
        reason: error.message
      };
    }
  }
  
  // Process pending checkouts (for users who may have closed browser)
  static async processPendingCheckouts(userId) {
    try {
      console.log(`🔍 Checking for pending checkouts for user: ${userId}`);
      
      const user = await User.findById(userId);
      if (!user || !user.stripeCustomerId) {
        return { processed: 0, sessions: [] };
      }
      
      // Get recent checkout sessions for this customer
      const sessions = await stripe.checkout.sessions.list({
        customer: user.stripeCustomerId,
        limit: 10
      });
      
      const processedSessions = [];
      let processed = 0;
      
      for (const session of sessions.data) {
        // Only process paid sessions from the last 24 hours
        const sessionAge = Date.now() - (session.created * 1000);
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        if (session.payment_status === 'paid' && sessionAge < oneDayMs) {
          // Check if we've already processed this session
          const alreadyProcessed = user.billingHistory?.some(
            bill => bill.stripeSessionId === session.id
          );
          
          if (!alreadyProcessed) {
            console.log(`🔄 Processing pending session: ${session.id}`);
            
            const result = await this.verifyAndUpdateUser(session.id, userId);
            if (result.success) {
              processedSessions.push(session.id);
              processed++;
            }
          }
        }
      }
      
      console.log(`✅ Processed ${processed} pending checkouts`);
      
      return {
        processed,
        sessions: processedSessions
      };
    } catch (error) {
      console.error('❌ Error processing pending checkouts:', error);
      return { processed: 0, sessions: [], error: error.message };
    }
  }
  
  // Helper function to get premium features
  static getPremiumFeatures() {
    return {
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
  
  // Helper function to generate search ID
  static generateSearchId() {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = PostCheckoutHandler;