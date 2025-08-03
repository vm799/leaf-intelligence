// // stripe-service.js - UPDATED for post-checkout verification
require('dotenv').config();
// stripe-service.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  constructor() {
    this.stripe = stripe;
    this.prices = {
      singleSearch: process.env.STRIPE_SINGLE_SEARCH_PRICE_ID,
      monthlySubscription: process.env.STRIPE_MONTHLY_PRICE_ID
    };
  }

  async createCustomer(user) {
    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user._id.toString(),
          username: user.username
        }
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }



  async createSingleSearchCheckout(user, searchQuery, returnUrl) {
    try {
      // Ensure customer exists
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
        
        // Update user with customer ID
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // const session = await this.stripe.checkout.sessions.create({
      //   payment_method_types: ['card'],
      //   line_items: [{
      //     price: this.prices.singleSearch,
      //     quantity: 1
      //   }],
      //   mode: 'payment',
      //   success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/search-success?session_id={CHECKOUT_SESSION_ID}&search=${encodeURIComponent(searchQuery)}`,
      //   cancel_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/pricing?canceled=true`,
      //   customer: customerId,
      //   metadata: {
      //     userId: user._id.toString(),
      //     searchQuery: searchQuery,
      //     type: 'single_search'
      //   }
      // });

          const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: this.prices.singleSearch,
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: returnUrl ? `${returnUrl}?canceled=true` : `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/leafintelligence.html?canceled=true`,
            customer: customerId,
            metadata: {
                userId: user._id.toString(),
                searchQuery: searchQuery,
                type: 'single_search'
            }
        });
      
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

async createSubscriptionCheckout(user, returnUrl) {
    try {
      // Ensure customer exists
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
        
        // Update user with customer ID
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // const session = await this.stripe.checkout.sessions.create({
      //   payment_method_types: ['card'],
      //   line_items: [{
      //     price: this.prices.monthlySubscription,
      //     quantity: 1
      //   }],
      //   mode: 'subscription',
      //   success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      //   cancel_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/pricing?canceled=true`,
      //   customer: customerId,
      //   metadata: {
      //     userId: user._id.toString(),
      //     type: 'monthly_subscription'
      //   },
      //   subscription_data: {
      //     // trial_period_days: 7,
      //     metadata: {
      //       userId: user._id.toString()
      //     }
      //   }
      // });

              const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: this.prices.monthlySubscription,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: returnUrl ? `${returnUrl}?canceled=true` : `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/leafintelligence.html?canceled=true`,
            customer: customerId,
            metadata: {
                userId: user._id.toString(),
                type: 'monthly_subscription'
            },
            subscription_data: {
                // trial_period_days: 7,
                metadata: {
                    userId: user._id.toString()
                }
            }
        });
      
      return session;
    } catch (error) {
      console.error('Error creating subscription checkout:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true }
      );
      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async createPortalSession(customerId, returnUrl) {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });
      return session;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  async retrieveCheckoutSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.error('Error retrieving checkout session:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// class StripeService {
//   constructor() {
//     this.stripe = stripe;
//     this.prices = {
//       singleSearch: process.env.STRIPE_SINGLE_SEARCH_PRICE_ID,
//       monthlySubscription: process.env.STRIPE_MONTHLY_PRICE_ID
//     };
//   }

//   // Email validation and normalization
//   validateAndNormalizeEmail(email) {
//     if (!email || typeof email !== 'string') {
//       throw new Error('Email is required and must be a string');
//     }

//     // Trim whitespace and normalize
//     const normalizedEmail = email.trim().toLowerCase();
    
//     // Remove any hidden/non-printable characters
//     const cleanEmail = normalizedEmail.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
//     // Basic email validation regex
//     const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
//     if (!emailRegex.test(cleanEmail)) {
//       throw new Error(`Invalid email format: ${cleanEmail}`);
//     }

//     return cleanEmail;
//   }

//   async createCustomer(user) {
//     try {
//       // Validate and normalize email
//       const normalizedEmail = this.validateAndNormalizeEmail(user.email);
      
//       console.log(`Creating Stripe customer with email: ${normalizedEmail}`);
      
//       const customer = await this.stripe.customers.create({
//         email: normalizedEmail,
//         name: user.username || user.name || undefined,
//         metadata: {
//           userId: user._id.toString(),
//           username: user.username || 'Unknown'
//         }
//       });
      
//       console.log(`Successfully created Stripe customer: ${customer.id}`);
//       return customer;
//     } catch (error) {
//       console.error('Error creating Stripe customer:', error);
      
//       // If it's an email validation error, provide specific guidance
//       if (error.message.includes('Invalid email format')) {
//         throw new Error(`Email validation failed: ${error.message}. Please check the email address and try again.`);
//       }
      
//       throw error;
//     }
//   }

//   async createSingleSearchCheckout(user, searchQuery) {
//     try {
//       // Ensure customer exists
//       let customerId = user.stripeCustomerId;
//       if (!customerId) {
//         const customer = await this.createCustomer(user);
//         customerId = customer.id;
        
//         // Update user with customer ID
//         user.stripeCustomerId = customerId;
//         await user.save();
//       }

//       const session = await this.stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         line_items: [{
//           price: this.prices.singleSearch,
//           quantity: 1
//         }],
//         mode: 'payment',
//         // UPDATED: Use unified checkout-success page
//         success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/pricing?canceled=true`,
//         customer: customerId,
//         metadata: {
//           userId: user._id.toString(),
//           searchQuery: searchQuery,
//           type: 'single_search'
//         }
//       });
      
//       return session;
//     } catch (error) {
//       console.error('Error creating checkout session:', error);
//       throw error;
//     }
//   }

//   async createSubscriptionCheckout(user) {
//     try {
//       // Ensure customer exists
//       let customerId = user.stripeCustomerId;
//       if (!customerId) {
//         const customer = await this.createCustomer(user);
//         customerId = customer.id;
        
//         // Update user with customer ID
//         user.stripeCustomerId = customerId;
//         await user.save();
//       }

//       const session = await this.stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         line_items: [{
//           price: this.prices.monthlySubscription,
//           quantity: 1
//         }],
//         mode: 'subscription',
//         // UPDATED: Use unified checkout-success page
//         success_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.FRONTEND_URL || 'https://www.syneticx.com'}/pricing?canceled=true`,
//         customer: customerId,
//         metadata: {
//           userId: user._id.toString(),
//           type: 'monthly_subscription'
//         },
//         subscription_data: {
//           trial_period_days: 7,
//           metadata: {
//             userId: user._id.toString()
//           }
//         }
//       });
      
//       return session;
//     } catch (error) {
//       console.error('Error creating subscription checkout:', error);
//       throw error;
//     }
//   }

//   async cancelSubscription(subscriptionId) {
//     try {
//       const subscription = await this.stripe.subscriptions.update(
//         subscriptionId,
//         { cancel_at_period_end: true }
//       );
//       return subscription;
//     } catch (error) {
//       console.error('Error canceling subscription:', error);
//       throw error;
//     }
//   }

//   async createPortalSession(customerId, returnUrl) {
//     try {
//       const session = await this.stripe.billingPortal.sessions.create({
//         customer: customerId,
//         return_url: returnUrl
//       });
//       return session;
//     } catch (error) {
//       console.error('Error creating portal session:', error);
//       throw error;
//     }
//   }

//   async retrieveCheckoutSession(sessionId) {
//     try {
//       const session = await this.stripe.checkout.sessions.retrieve(sessionId);
//       return session;
//     } catch (error) {
//       console.error('Error retrieving checkout session:', error);
//       throw error;
//     }
//   }
// }

// module.exports = new StripeService();