// server.js - Updated for ClinicalTrials.gov API v2
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Papa = require('papaparse');
const { DOMParser } = require('xmldom');
const morgan = require('morgan');
const path = require('path');
const Bottleneck = require('bottleneck');
const fs = require('fs');
const DataIntegration = require('./data-integration');
const emaRoutes = require('./ema-routes');
const cheerio = require('cheerio');
const https = require('https');
const fsextra = require('fs-extra');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const handlebars = require('handlebars');
const sharp = require('sharp');
const { fromPath } = require('pdf2pic');
const csv = require('csv-parser');
const { handlePubMedSearch } = require('./pubmed.js');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
// const { handleDailyMedRequest } = require('./dailymed.js'); // Path to where you saved the code
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const { OpenAI } = require('openai');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { connectDB } = require('./db');
const { User } = require('./db');
const { Lead } = require('./db');
const pubmedRoutes = require('./pubmed-routes.js');
const biomarkerRoutes = require('./bioserver.js');
const dotenv = require('dotenv')
const { UserSession } = require('./db');
const mongoose = require('mongoose');
const { router: drugWatchRouter, initializeDrugWatchService } = require('./watch.js');
const fdaRoutes = require('./devices'); // Adjust path as needed
const pharmaceuticalRouter = require('./labelling.js'); // Adjust path as needed
const emaMongoRouter = require('./ema-mongo-routes.js');
const { createPerfectCompanyMatcher, PharmaceuticalCompanyMatcher } = require('./pharmaceutical-matcher');
const {
  DrugClassification, 
  FDAGuidance, 
  FDAApproval, 
  DailyMed, 
  OrangeBook,
  WarningLetters, 
  PubMed, 
  TreatmentEffectCalculator 
} = DataIntegration;
const stripeRoutes = require('./stripe-routes');
const stripeWebhook = require('./stripe-webhook');
// Add these imports at the top
// const PostCheckoutHandler = require('./stripe-post-checkout-handler');
// const postCheckoutRoutes = require('./stripe-post-checkout-routes');


const FDA_DRUGSFDA_URL = 'https://api.fda.gov/drug/drugsfda.json';
const FDA_LABEL_URL = 'https://api.fda.gov/drug/label.json';
const FDA_ENFORCEMENT_URL = 'https://api.fda.gov/drug/enforcement.json';
const DRUGS_FDA_DOCS_BASE = 'https://www.accessdata.fda.gov/drugsatfda_docs';
const DAILYMED_API_URL = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const ORANGE_BOOK_API_URL = 'https://api.fda.gov/drug/orangebook.json'; // Live FDA Orange Book API
const GUIDANCE_API_URL = 'https://api.fda.gov/guidance/guidances.json'; // Live FDA Guidance API
const emailuser = process.env.smtppassword
const emailhost = process.env.smtphost

require('dotenv').config();
// Add this at the beginning of your server.js file, after the initial require statements 
// but before defining the Express app

// Security middleware to block malicious requests
const securityMiddleware = (req, res, next) => {
  // List of suspicious file extensions and patterns to block
  const suspiciousPatterns = [
    '.php', 'wp-', 'shell', 'admin', 'cgi-bin', 'filemanager', '.well-known',
    'wp-admin', 'wp-content', 'wp-includes', 'autoload', 'xmrlpc'
  ];
  
  const url = req.url.toLowerCase();
  
  // Check if the URL contains any suspicious patterns
  if (suspiciousPatterns.some(pattern => url.includes(pattern))) {
    // Log the blocked request for monitoring
    console.log(`Blocked suspicious request: ${req.method} ${req.url} from ${req.ip}`);
    
    // Instead of serving the same content for all, return 403 Forbidden
    return res.status(403).send('Access Denied');
  }
  
  // Allow the request to continue if not suspicious
  next();
};

// Then add this right after you create your Express app

// const customDomain = 'syneticx.com';

// const httpsAgent = new https.Agent({
//   rejectUnauthorized: true, // Keep validation on
//   checkServerIdentity: (host, cert) => {
//     // Only allow your specific domain to bypass strict validation if needed
//     if (host === customDomain) {
//       return undefined; // Allow connection
//     }
    
//     // For all other hosts, use default certificate validation
//     return https.checkServerIdentity(host, cert);
//   }
// });

// Create Express app
const app = express();
// (after const app = express(); line)
// app.use(securityMiddleware);
const PORT = process.env.PORT || 3000;
connectDB();

const allowedOrigins = [
  'https://www.syneticx.com', // Replace with your actual frontend domain
  'https://syneticx.com',
  'http://localhost:3000', // For local development
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // If your app uses cookies or authentication
  })
);

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'your-mongodb-connection-string',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // require https in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));
// Initialize OpenAI client
const openai = new OpenAI({

  apiKey: process.env.OPENAI_API_KEY

});

// app.use((req, res, next) => {
//   // Security headers
//   res.setHeader('X-Content-Type-Options', 'nosniff');
//   res.setHeader('X-Frame-Options', 'DENY');
//   res.setHeader('X-XSS-Protection', '1; mode=block');
//   res.setHeader('Content-Security-Policy', "default-src 'self'");
//   next();
// });
app.use('/stripe', stripeWebhook);
// Add the new routes
// app.use('/api/stripe', postCheckoutRoutes);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
// Custom delay function (returns a promise that resolves after a specified time)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Rate limiter configuration (tracks requests without rejecting)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 , // 15 minutes
  max: 1000, // Max 100 requests per IP in the window
  standardHeaders: true, // Include RateLimit-* headers
  legacyHeaders: false, // Disable older X-RateLimit headers
  skipFailedRequests: true, // Don't count failed requests
  handler: async (req, res, next, options) => {
    // Instead of rejecting, delay the request
    const retryAfterMs = req.rateLimit.resetTime - Date.now(); // Time until window resets
    console.log(`Rate limit hit for IP ${req.ip}, delaying for ${retryAfterMs}ms`);
    await delay(retryAfterMs + 100); // Wait until the window resets (+ buffer)
    next(); // Process the request after delay
  },
});

// Apply rate limiter to all routes
app.use(apiLimiter);

// Cache for FDA and EMA approvals
const approvalCache = {
  fda: {},
  ema: {}
};

app.use('/api/stripe', stripeRoutes);



const usersFile = path.join(__dirname, 'users.json');

// Initialize users file if it doesn't exist
function initializeUsersFile(callback) {
  fs.access(usersFile, fs.constants.F_OK, (err) => {
      if (err) {
          // File doesn't exist, create it
          fs.writeFile(usersFile, JSON.stringify([]), (writeErr) => {
              if (writeErr) {
                  console.error('Error creating users file:', writeErr);
                  return callback(writeErr);
              }
              callback(null);
          });
      } else {
          callback(null);
      }
  });
}

// Add these routes near your other static file serving routes
app.get('/search-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search-success.html'));
});

app.get('/subscription-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription-success.html'));
});


async function checkSearchAccess(user, searchQuery) {
  // Monthly subscribers have unlimited access
  if (user.subscriptionTier === 'monthly' && user.subscriptionStatus === 'active') {
    return { hasAccess: true, reason: 'subscription' };
  }
  
  // Check if user has search credits
  if (user.searchCredits > 0) {
    return { hasAccess: true, reason: 'credits' };
  }
  
  // Check if user already purchased this specific search
  const purchasedSearch = user.purchasedSearches?.find(
    s => s.searchQuery.toLowerCase() === searchQuery.toLowerCase()
  );
  
  if (purchasedSearch) {
    return { hasAccess: true, reason: 'purchased', searchId: purchasedSearch.searchId };
  }
  
  // Check feature-specific access for free tier
  return { hasAccess: false, reason: 'payment_required' };
}

// Check user's access level for frontend
// Check user's access level for frontend
app.get('/api/check-access', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.json({ 
        hasAccess: false, 
        subscriptionTier: 'free',
        featureAccess: getDefaultFeatureAccess() 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ 
        hasAccess: false, 
        subscriptionTier: 'free',
        featureAccess: getDefaultFeatureAccess() 
      });
    }
    
    res.json({
      hasAccess: user.subscriptionTier !== 'free',
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || 'free',
      searchCredits: user.searchCredits || 0,
      featureAccess: user.featureAccess || getDefaultFeatureAccess(),
      purchasedSearches: user.purchasedSearches || []
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({ error: 'Failed to check access' });
  }
});

function generateSearchId() {
  return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// // Add these routes near your other static file serving routes
// app.get('/checkout-success', (req, res) => {
//   // Make sure the file exists in the correct location
//   res.sendFile(path.join(__dirname, 'public', 'checkout-success.html'));
  
//   // Check if file exists
//   if (fs.existsSync(filePath)) {
//     res.sendFile(filePath);
//   } else {
//     // File doesn't exist, serve a simple success page
//     console.log(`❌ checkout-success.html not found at: ${filePath}`);
//     res.send(`
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <title>Payment Successful</title>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <script src="https://cdn.tailwindcss.com"></script>
//       </head>
//       <body class="bg-gray-50 min-h-screen flex items-center justify-center">
//         <div class="bg-white p-8 rounded-lg shadow-lg text-center">
//           <h1 class="text-2xl font-bold text-green-600 mb-4">Payment Successful!</h1>
//           <p class="text-gray-600 mb-6">Your purchase is being processed...</p>
//           <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <script>
//             // Redirect to home page after 3 seconds
//             setTimeout(() => {
//               const urlParams = new URLSearchParams(window.location.search);
//               const sessionId = urlParams.get('session_id');
//               if (sessionId) {
//                 // Try to verify the session via API
//                 fetch('/api/stripe/verify-checkout', {
//                   method: 'POST',
//                   headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': 'Bearer ' + btoa(JSON.stringify({userId: localStorage.getItem('currentUserId')}))
//                   },
//                   body: JSON.stringify({sessionId})
//                 }).then(() => {
//                   window.location.href = '/?success=true';
//                 }).catch(() => {
//                   window.location.href = '/?success=true';
//                 });
//               } else {
//                 window.location.href = '/?success=true';
//               }
//             }, 3000);
//           </script>
//         </div>
//       </body>
//       </html>
//     `);
//   }
// });

// // 4. UPDATE YOUR EXISTING SUCCESS ROUTES TO REDIRECT
// app.get('/search-success', (req, res) => {
//   const sessionId = req.query.session_id;
//   if (sessionId) {
//     res.redirect(`/checkout-success.html?session_id=${sessionId}`);
//   } else {
//     res.redirect('/checkout-success.html');
//   }
// });

// app.get('/subscription-success', (req, res) => {
//   const sessionId = req.query.session_id;
//   if (sessionId) {
//     res.redirect(`/checkout-success.html?session_id=${sessionId}`);
//   } else {
//     res.redirect('/checkout-success.html');
//   }
// });
// // 5. ADD WEBHOOK DISABLE ROUTE (to stop webhook errors)
// app.post('/webhook', (req, res) => {
//   console.log('⚠️ Webhook endpoint called but webhooks are disabled');
//   res.status(200).send('OK');
// });

// // 6. ADD DEBUG ENDPOINT FOR TESTING AUTH
// app.get('/api/debug/auth-test', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     const userId = req.query.userId;
//     const bodyUserId = req.body?.userId;
    
//     res.json({
//       debug: true,
//       authHeader: authHeader ? 'Present' : 'Missing',
//       queryUserId: userId ? 'Present' : 'Missing',
//       bodyUserId: bodyUserId ? 'Present' : 'Missing',
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 7. ADD MANUAL VERIFICATION ENDPOINT FOR TESTING
// app.post('/api/admin/manual-verify', async (req, res) => {
//   try {
//     const { sessionId, userEmail } = req.body;
    
//     if (!sessionId || !userEmail) {
//       return res.status(400).json({
//         error: 'sessionId and userEmail are required'
//       });
//     }
    
//     // Find user by email
//     const user = await User.findOne({ email: userEmail });
//     if (!user) {
//       return res.status(404).json({
//         error: 'User not found'
//       });
//     }
    
//     console.log(`🔧 Manual verification: ${sessionId} for ${userEmail}`);
    
//     // Use the post-checkout handler
//     const PostCheckoutHandler = require('./stripe-post-checkout-handler');
//     const result = await PostCheckoutHandler.verifyAndUpdateUser(sessionId, user._id);
    
//     res.json({
//       manual: true,
//       result: result,
//       user: {
//         email: user.email,
//         subscriptionTier: user.subscriptionTier,
//         searchCredits: user.searchCredits
//       }
//     });
    
//   } catch (error) {
//     console.error('Manual verification error:', error);
//     res.status(500).json({
//       error: error.message,
//       stack: error.stack
//     });
//   }
// });
// ===== USER PREFERENCES ENDPOINT =====
// Add this to your clinicaltrials.js server file

// Update user preferences (dark mode, etc.)
app.post('/api/user/preferences', async (req, res) => {
  try {
    const { userId, darkModeEnabled } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update preferences
    if (darkModeEnabled !== undefined) {
      user.darkModeEnabled = darkModeEnabled;
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      preferences: {
        darkModeEnabled: user.darkModeEnabled
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get complete user profile with subscription info
app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-passwordHash -salt');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate usage percentage
    let usagePercentage = 0;
    if (user.subscriptionTier === 'monthly') {
      // For monthly subscribers, calculate based on searches this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const searchesThisMonth = user.activityLog?.filter(
        log => log.activity === 'search' && new Date(log.timestamp) >= startOfMonth
      ).length || 0;
      
      // Assuming a soft limit of 1000 searches per month for display purposes
      usagePercentage = Math.min(Math.round((searchesThisMonth / 1000) * 100), 100);
    } else if (user.searchCredits) {
      // For pay-per-search users
      const totalCredits = user.purchasedSearches?.length || 1;
      const usedCredits = totalCredits - user.searchCredits;
      usagePercentage = Math.round((usedCredits / totalCredits) * 100);
    }
    
    // Format billing period
    let billingPeriod = user.billingPeriod;
    if (user.subscriptionEndDate) {
      const start = new Date();
      const end = new Date(user.subscriptionEndDate);
      billingPeriod = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (!billingPeriod) {
      // Generate current month for free users
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      billingPeriod = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      usage: usagePercentage,
      billingPeriod: billingPeriod,
      subscriptionStatus: user.subscriptionStatus || 'free',
      subscriptionTier: user.subscriptionTier || 'free',
      darkModeEnabled: user.darkModeEnabled || false,
      searchCredits: user.searchCredits || 0,
      subscriptionEndDate: user.subscriptionEndDate,
      featureAccess: user.featureAccess || getDefaultFeatureAccess()
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Helper function for default feature access
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

// Form 483 Search Endpoint
app.get('/api/form483/search', async (req, res) => {
  try {
    const { term, field = 'Legal_Name', page = 1, perPage = 50 } = req.query;
    
    if (!term) {
      return res.json({ 
        success: true, 
        results: [],
        pagination: {
          page: 1,
          perPage: 50,
          total: 0,
          totalPages: 0
        }
      });
    }

    console.log(`🔍 Form 483 search: term="${term}", field="${field}"`);

    // Build search query based on your actual MongoDB field names
    const searchQueries = [];
    
    // Create regex for flexible matching
    const searchRegex = new RegExp(term, 'i');
    
    // Map frontend field names to MongoDB field names
    const fieldMapping = {
      'company': 'Legal_Name',
      'companyName': 'Legal_Name',
      'legalName': 'Legal_Name',
      'feiNumber': 'FEI_Number'
    };
    
    const actualField = fieldMapping[field] || field;
    
    // Build query based on field
    if (actualField === 'Legal_Name') {
      searchQueries.push({ Legal_Name: searchRegex });
    } else if (actualField === 'FEI_Number') {
      searchQueries.push({ FEI_Number: term });
    } else {
      // Search in Legal_Name by default
      searchQueries.push({ Legal_Name: searchRegex });
    }

    // Build the final query
    const query = searchQueries.length > 1 ? { $or: searchQueries } : searchQueries[0];

    // Get total count for pagination
    const total = await Form483Model.countDocuments(query);
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const itemsPerPage = parseInt(perPage);
    const skip = (pageNum - 1) * itemsPerPage;
    const totalPages = Math.ceil(total / itemsPerPage);

    // Execute search with pagination
    const results = await Form483Model
      .find(query)
      .sort({ Record_Date: -1 }) // Sort by Record_Date
      .skip(skip)
      .limit(itemsPerPage)
      .lean();

    console.log(`✅ Form 483 search found ${results.length} results (page ${pageNum} of ${totalPages})`);

    // Transform results to match frontend expectations
    const transformedResults = results.map(doc => ({
      _id: doc._id,
      legalName: doc.Legal_Name,
      companyName: doc.Legal_Name, // Use Legal_Name as company name
      feiNumber: doc.FEI_Number,
      recordDate: doc.Record_Date,
      recordType: doc.Record_Type,
      publishDate: doc.Publish_Date,
      download: doc.Download,
      recordId: doc.Record_ID,
      // Include original field names too for compatibility
      Legal_Name: doc.Legal_Name,
      FEI_Number: doc.FEI_Number,
      Record_Date: doc.Record_Date,
      Record_Type: doc.Record_Type
    }));

    // Return results in expected format
    res.json({
      success: true,
      results: transformedResults,
      pagination: {
        page: pageNum,
        perPage: itemsPerPage,
        total: total,
        totalPages: totalPages
      }
    });

  } catch (error) {
    console.error('Form 483 search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Search failed', 
      results: []
    });
  }
});



// app.get('/api/form483/search', async (req, res) => {
//   try {
//     const { term, field = 'Legal_Name', page = 1, perPage = 50, debug = false } = req.query;
    
//     if (!term) {
//       return res.status(400).json({ success: false, error: 'Search term required' });
//     }

//     if (debug) console.log(`🔍 Form 483 MongoDB search: "${term}" in field "${field}"`);

//     // MULTIPLE SEARCH STRATEGIES - This is the key fix!
//     const searchStrategies = [];
//     const termLower = term.toLowerCase().trim();
    
//     // Strategy 1: Exact match (case-insensitive)
//     searchStrategies.push({
//       [field]: { $regex: new RegExp(`^${escapeRegex(term)}$`, 'i') }
//     });
    
//     // Strategy 2: Contains match
//     searchStrategies.push({
//       [field]: { $regex: new RegExp(escapeRegex(term), 'i') }
//     });
    
//     // Strategy 3: Word boundary match (for partial company names)
//     const words = term.split(/\s+/).filter(w => w.length > 2);
//     if (words.length > 0) {
//       for (const word of words) {
//         searchStrategies.push({
//           [field]: { $regex: new RegExp(`\\b${escapeRegex(word)}`, 'i') }
//         });
//       }
//     }
    
//     // Strategy 4: Try alternative field names based on your schema
//     const alternativeFields = ['Legal_Name', 'legalName', 'Legal Name'];
//     for (const altField of alternativeFields) {
//       if (altField !== field) {
//         searchStrategies.push({
//           [altField]: { $regex: new RegExp(escapeRegex(term), 'i') }
//         });
//       }
//     }
    
//     // Strategy 5: Clean company name matching (remove common suffixes)
//     const cleanedTerm = term.replace(/\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL)\.?$/gi, '').trim();
//     if (cleanedTerm !== term && cleanedTerm.length > 3) {
//       searchStrategies.push({
//         [field]: { $regex: new RegExp(escapeRegex(cleanedTerm), 'i') }
//       });
//     }

//     // Build the final MongoDB query using $or
//     const mongoQuery = { $or: searchStrategies };
    
//     if (debug) {
//       console.log('MongoDB Query:', JSON.stringify(mongoQuery, null, 2));
//     }
    
//     // Get total count for pagination
//     const total = await db.collection('483s').countDocuments(mongoQuery);
    
//     // Calculate pagination
//     const pageNum = parseInt(page);
//     const itemsPerPage = parseInt(perPage);
//     const skip = (pageNum - 1) * itemsPerPage;
//     const totalPages = Math.ceil(total / itemsPerPage);

//     // Execute search with sorting by Record_Date (most recent first)
//     const results = await db.collection('483s')
//       .find(mongoQuery)
//       .sort({ Record_Date: -1 })
//       .skip(skip)
//       .limit(itemsPerPage)
//       .toArray();

//     if (debug) {
//       console.log(`✅ Found ${results.length} Form 483 results (total: ${total})`);
//       if (results.length > 0) {
//         console.log('Sample result:', {
//           Legal_Name: results[0].Legal_Name,
//           Record_Date: results[0].Record_Date,
//           Record_Type: results[0].Record_Type
//         });
//       }
//     }

//     // Add relevance scoring to results
//     const scoredResults = results.map(doc => {
//       const relevanceScore = calculateForm483Relevance(term, doc);
//       return {
//         ...doc,
//         relevanceScore,
//         searchTerm: term,
//         matchedField: field
//       };
//     });

//     // Sort by relevance score (highest first), then by date
//     scoredResults.sort((a, b) => {
//       const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
//       if (scoreDiff !== 0) return scoreDiff;
//       return new Date(b.Record_Date || 0) - new Date(a.Record_Date || 0);
//     });

//     // Transform results to match frontend expectations
//     const transformedResults = scoredResults.map(doc => ({
//       _id: doc._id,
//       legalName: doc.Legal_Name,           // Map to expected field
//       companyName: doc.Legal_Name,         // Map to expected field
//       feiNumber: doc.FEI_Number,
//       recordDate: doc.Record_Date,
//       recordType: doc.Record_Type,
//       publishDate: doc.Publish_Date,
//       download: doc.Download,
//       recordId: doc.Record_ID,
//       relevanceScore: doc.relevanceScore,
      
//       // Keep original fields for compatibility
//       Legal_Name: doc.Legal_Name,
//       FEI_Number: doc.FEI_Number,
//       Record_Date: doc.Record_Date,
//       Record_Type: doc.Record_Type,
//       Publish_Date: doc.Publish_Date,
//       Download: doc.Download,
//       Record_ID: doc.Record_ID
//     }));

//     console.log(`✅ Form 483 search completed: ${transformedResults.length} results for "${term}"`);

//     res.json({
//       success: true,
//       results: transformedResults,
//       pagination: {
//         page: pageNum,
//         perPage: itemsPerPage,
//         total: total,
//         totalPages: totalPages
//       },
//       searchInfo: {
//         term: term,
//         field: field,
//         strategiesUsed: searchStrategies.length,
//         totalInDatabase: 1851 // Your collection size
//       }
//     });

//   } catch (error) {
//     console.error('Form 483 MongoDB search error:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Search failed: ' + error.message,
//       results: []
//     });
//   }
// });


// Helper function to calculate relevance for Form 483 records
function calculateForm483Relevance(searchTerm, doc) {
  const term = searchTerm.toLowerCase();
  const legalName = (doc.Legal_Name || '').toLowerCase();
  
  // Exact match = 1.0
  if (legalName === term) return 1.0;
  
  // Legal name contains search term = 0.9
  if (legalName.includes(term)) return 0.9;
  
  // Search term contains legal name (shorter company name) = 0.8
  if (term.includes(legalName) && legalName.length > 3) return 0.8;
  
  // Word-based matching
  const termWords = term.split(/\s+/).filter(w => w.length > 2);
  const nameWords = legalName.split(/\s+/).filter(w => w.length > 2);
  
  let matchingWords = 0;
  for (const tWord of termWords) {
    for (const nWord of nameWords) {
      if (tWord.includes(nWord) || nWord.includes(tWord)) {
        matchingWords++;
        break;
      }
    }
  }
  
  if (matchingWords > 0) {
    return (matchingWords / termWords.length) * 0.7;
  }
  
  return 0.1; // Minimal score for any match that got through MongoDB query
}

// Regex escape helper
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Debug endpoint to check Form 483 data structure
app.get('/api/form483/debug', async (req, res) => {
  try {
    // Get total count
    const totalCount = await Form483Model.countDocuments();
    
    // Get sample records to see structure
    const samples = await Form483Model
      .find({})
      .limit(10)
      .lean();
    
    // Get unique company names (first 50)
    const uniqueCompanies = await Form483Model
      .distinct('Legal_Name');
    
    // Get field names from first document
    const firstDoc = samples[0] || {};
    const fieldNames = Object.keys(firstDoc);
    
    res.json({
      success: true,
      totalForm483s: totalCount,
      fieldNames: fieldNames,
      sampleRecords: samples.map(s => ({
        Legal_Name: s.Legal_Name,
        FEI_Number: s.FEI_Number,
        Record_Date: s.Record_Date,
        Record_Type: s.Record_Type
      })),
      sampleCompanyNames: uniqueCompanies.slice(0, 20),
      searchableFields: ['Legal_Name', 'FEI_Number']
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get specific Form 483 by ID
app.get('/api/fda/form483/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const form483 = await Form483Model.findById(id).lean();
    
    if (!form483) {
      return res.status(404).json({ success: false, error: 'Form 483 not found' });
    }
    
    // Transform to match frontend expectations
    const transformed = {
      _id: form483._id,
      legalName: form483.Legal_Name,
      companyName: form483.Legal_Name,
      feiNumber: form483.FEI_Number,
      recordDate: form483.Record_Date,
      recordType: form483.Record_Type,
      publishDate: form483.Publish_Date,
      download: form483.Download,
      recordId: form483.Record_ID,
      ...form483 // Include all original fields
    };
    
    res.json({
      success: true,
      data: transformed
    });
  } catch (error) {
    console.error('Error fetching Form 483 details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const CGMPGuidanceSchema = new mongoose.Schema({
  filename: String,
  question: String,
  answer: String,
  text_snippet: String,
  summary: String,
  category: { type: String, index: true },
  keywords: [String],
  drug_mentions: [String],
  regulations: [String],
  risk_level: String,
  uploadedAt: Date,
  dataSource: String
});



// Also update your Form483Schema to match your MongoDB structure
const Form483Schema = new mongoose.Schema({
  Record_Date: { type: Date, index: true },
  FEI_Number: { type: String, index: true },
  Legal_Name: { type: String, index: true },
  Record_Type: String,
  Publish_Date: Date,
  Download: String,
  Record_ID: String,
  // Keep your additional fields
  parsedObservations: [String],
  drugMentions: [String],
  violations: [String]
}, {
  collection: '483s' // Explicitly set collection name
});

// Update the model (if not already done)
const Form483Model = mongoose.model('483s', Form483Schema, '483s');


const CGMPGuidance = mongoose.model('cgmp_guidance', CGMPGuidanceSchema);


// // API ENDPOINTS
// app.get('/api/debug/test-companies', async (req, res) => {
//   try {
//     const testCompanies = ['ENDO', 'EUGIA', 'FRESENIUS', 'GLAND', 'HIKMA', 'HOSPIRA', 'JANSSEN'];
    
//     console.log('🧪 Testing companies in database...');
    
//     const results = {};
    
//     for (const company of testCompanies) {
//       // Test Form 483s
//       const form483Count = await Form483Model.countDocuments({ 
//         legalName: new RegExp(company, 'i') 
//       });
      
//       const sampleForm483s = await Form483Model.find({ 
//         legalName: new RegExp(company, 'i') 
//       }).limit(3).lean();
      
//       // Test Warning Letters
//       const warningLetterCount = warningLetters ? 
//         warningLetters.filter(wl => 
//           wl.companyName?.toLowerCase().includes(company.toLowerCase())
//         ).length : 0;
      
//       results[company] = {
//         form483s: {
//           count: form483Count,
//           samples: sampleForm483s.map(f => ({
//             legalName: f.legalName,
//             recordDate: f.recordDate,
//             feiNumber: f.feiNumber,
//             hasObservations: !!f.parsedObservations?.length,
//             hasDrugMentions: !!f.drugMentions?.length,
//             hasViolations: !!f.violations?.length
//           }))
//         },
//         warningLetters: {
//           count: warningLetterCount
//         }
//       };
//     }
    
//     res.json({
//       success: true,
//       data: results,
//       summary: {
//         totalForm483s: Object.values(results).reduce((sum, r) => sum + r.form483s.count, 0),
//         totalWarningLetters: Object.values(results).reduce((sum, r) => sum + r.warningLetters.count, 0),
//         companiesWithData: Object.keys(results).filter(c => 
//           results[c].form483s.count > 0 || results[c].warningLetters.count > 0
//         )
//       }
//     });
//   } catch (error) {
//     console.error('Debug test error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // Enhanced extractDrugMentions function
// const enhancedExtractDrugMentions = (text) => {
//   if (!text) return [];
  
//   const drugMentions = new Set();
  
//   // Enhanced drug patterns
//   const drugPatterns = [
//     // Specific drug names (add more as needed)
//     /\b(ketamine|fentanyl|morphine|oxycodone|hydrocodone|codeine|tramadol|methadone)\b/gi,
//     /\b(insulin|metformin|lisinopril|atorvastatin|amlodipine|losartan|levothyroxine)\b/gi,
//     /\b(amoxicillin|azithromycin|ciprofloxacin|doxycycline|cephalexin|clindamycin)\b/gi,
//     /\b(ibuprofen|acetaminophen|aspirin|naproxen|diclofenac|celecoxib)\b/gi,
//     /\b(sertraline|fluoxetine|citalopram|escitalopram|paroxetine|venlafaxine)\b/gi,
//     /\b(omeprazole|pantoprazole|lansoprazole|esomeprazole|ranitidine)\b/gi,
//     /\b(warfarin|rivaroxaban|apixaban|dabigatran|enoxaparin)\b/gi,
    
//     // Drug suffixes and patterns
//     /\b\w*(?:mab|nib|tide|cycline|statin|pril|sartan|azole|amine|cillin)\b/gi,
    
//     // API mentions with context
//     /(?:API|active\s+(?:pharmaceutical\s+)?ingredient)[:\s]+([a-zA-Z][a-zA-Z0-9\s\-]{2,30})/gi,
    
//     // Drug product mentions
//     /(?:drug\s+product|pharmaceutical\s+product)[:\s]+([a-zA-Z][a-zA-Z0-9\s\-]{2,30})/gi,
    
//     // Batch/lot mentions
//     /(?:batch|lot)\s+(?:of\s+)?([a-zA-Z][a-zA-Z0-9\s\-]{2,20})/gi,
    
//     // Tablet/capsule mentions
//     /([a-zA-Z][a-zA-Z0-9\s\-]{2,20})\s+(?:tablets?|capsules?|injection|cream|ointment|solution|suspension)\b/gi
//   ];
  
//   drugPatterns.forEach(pattern => {
//     let match;
//     while ((match = pattern.exec(text)) !== null) {
//       const drug = (match[1] || match[0])?.trim();
//       if (drug && drug.length > 2 && drug.length < 50 && !/^\d+$/.test(drug)) {
//         // Clean up the drug name
//         const cleanDrug = drug
//           .replace(/[^\w\s\-]/g, '')
//           .trim()
//           .toLowerCase();
        
//         if (cleanDrug.length > 2) {
//           drugMentions.add(cleanDrug.charAt(0).toUpperCase() + cleanDrug.slice(1));
//         }
//       }
//     }
//   });
  
//   return Array.from(drugMentions).slice(0, 10); // Limit to top 10
// };

// // Enhanced extractViolations function
// const enhancedExtractViolations = (text) => {
//   if (!text) return [];
  
//   const violations = new Set();
//   const lowerText = text.toLowerCase();
  
//   // Enhanced violation patterns with priorities
//   const violationPatterns = [
//     // High priority violations
//     { pattern: /data\s+integrity/gi, type: 'Data Integrity', priority: 1 },
//     { pattern: /contamination/gi, type: 'Contamination Control', priority: 1 },
//     { pattern: /sterility/gi, type: 'Sterility Assurance', priority: 1 },
//     { pattern: /microbiological/gi, type: 'Microbiological Controls', priority: 1 },
    
//     // Medium priority violations
//     { pattern: /quality\s+control/gi, type: 'Quality Control', priority: 2 },
//     { pattern: /validation/gi, type: 'Validation', priority: 2 },
//     { pattern: /documentation/gi, type: 'Documentation', priority: 2 },
//     { pattern: /capa/gi, type: 'CAPA System', priority: 2 },
//     { pattern: /investigation/gi, type: 'Investigation Procedures', priority: 2 },
    
//     // Standard violations
//     { pattern: /manufacturing\s+practice/gi, type: 'Manufacturing Practices', priority: 3 },
//     { pattern: /stability/gi, type: 'Stability Testing', priority: 3 },
//     { pattern: /labeling/gi, type: 'Labeling', priority: 3 },
//     { pattern: /adverse\s+event/gi, type: 'Adverse Event Reporting', priority: 3 },
//     { pattern: /deviation/gi, type: 'Deviation Handling', priority: 3 },
//     { pattern: /specification/gi, type: 'Specification Compliance', priority: 3 },
//     { pattern: /raw\s+material/gi, type: 'Raw Material Control', priority: 3 },
//     { pattern: /finished\s+product/gi, type: 'Finished Product Testing', priority: 3 },
//     { pattern: /environmental\s+monitoring/gi, type: 'Environmental Monitoring', priority: 3 },
//     { pattern: /cleaning\s+validation/gi, type: 'Cleaning Validation', priority: 3 },
//     { pattern: /process\s+validation/gi, type: 'Process Validation', priority: 3 },
//     { pattern: /method\s+validation/gi, type: 'Method Validation', priority: 3 },
//     { pattern: /quality\s+assurance/gi, type: 'Quality Assurance', priority: 3 },
//     { pattern: /out\s+of\s+specification|oos/gi, type: 'OOS Results', priority: 2 },
//     { pattern: /batch\s+record/gi, type: 'Batch Records', priority: 3 },
//     { pattern: /cgmp|gmp/gi, type: 'CGMP Compliance', priority: 2 },
//     { pattern: /misbranding/gi, type: 'Misbranding', priority: 2 },
//     { pattern: /adulteration/gi, type: 'Adulteration', priority: 1 }
//   ];
  
//   violationPatterns.forEach(({ pattern, type, priority }) => {
//     const matches = text.match(pattern);
//     if (matches) {
//       violations.add(type);
//     }
//   });
  
//   return Array.from(violations);
// };
// // Get comprehensive regulatory data for companies
// app.post('/api/fda/comprehensive-regulatory-data', async (req, res) => {
//   try {
//     const { companies = [], dateRange = {} } = req.body;
    
//     if (!companies || companies.length === 0) {
//       return res.status(400).json({ success: false, error: 'Companies list is required' });
//     }
    
//     console.log('🔍 Fetching comprehensive regulatory data for:', companies);
    
//     // Create more flexible regex patterns for company matching
//     const companyRegexes = companies.map(company => {
//       // Handle partial matches and common variations
//       const cleanCompany = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//       return new RegExp(cleanCompany, 'i');
//     });
    
//     // Get Form 483s with better matching
//     console.log('📋 Searching Form 483s...');
//     const form483Query = {
//       $or: companyRegexes.map(regex => ({ legalName: regex }))
//     };
    
//     if (dateRange.start || dateRange.end) {
//       form483Query.recordDate = {};
//       if (dateRange.start) form483Query.recordDate.$gte = new Date(dateRange.start);
//       if (dateRange.end) form483Query.recordDate.$lte = new Date(dateRange.end);
//     }
    
//     const form483s = await Form483Model.find(form483Query).lean();
//     console.log(`📊 Found ${form483s.length} Form 483s`);
    
//     // Get Warning Letters with better matching
//     console.log('📄 Searching Warning Letters...');
//     let filteredWarningLetters = [];
//     if (warningLetters && Array.isArray(warningLetters)) {
//       filteredWarningLetters = warningLetters.filter(wl => {
//         if (!wl.companyName) return false;
        
//         return companies.some(company => {
//           const wlCompany = wl.companyName.toLowerCase();
//           const searchCompany = company.toLowerCase();
          
//           // Multiple matching strategies
//           return (
//             wlCompany.includes(searchCompany) ||
//             searchCompany.includes(wlCompany) ||
//             wlCompany.split(' ').some(word => searchCompany.includes(word)) ||
//             searchCompany.split(' ').some(word => wlCompany.includes(word))
//           );
//         });
//       });
//     }
//     console.log(`📊 Found ${filteredWarningLetters.length} Warning Letters`);
    
//     // Apply date filter to warning letters
//     if (dateRange.start || dateRange.end) {
//       filteredWarningLetters = filteredWarningLetters.filter(wl => {
//         const wlDate = new Date(wl.letterIssueDate);
//         if (dateRange.start && wlDate < new Date(dateRange.start)) return false;
//         if (dateRange.end && wlDate > new Date(dateRange.end)) return false;
//         return true;
//       });
//     }
    
//     // Process warning letters with enhanced extraction
//     console.log('⚗️ Processing Warning Letters data...');
//     const processedWarningLetters = filteredWarningLetters.map(wl => ({
//       ...wl,
//       drugMentions: enhancedExtractDrugMentions(wl.fullContent || wl.content || ''),
//       violations: enhancedExtractViolations(wl.fullContent || wl.content || '')
//     }));
    
//     // Process Form 483s with enhanced extraction
//     console.log('⚗️ Processing Form 483s data...');
//     const processedForm483s = form483s.map(f => {
//       const observationsText = Array.isArray(f.parsedObservations) ? 
//         f.parsedObservations.join(' ') : (f.parsedObservations || '');
      
//       return {
//         ...f,
//         drugMentions: f.drugMentions?.length > 0 ? 
//           f.drugMentions : enhancedExtractDrugMentions(observationsText),
//         violations: f.violations?.length > 0 ? 
//           f.violations : enhancedExtractViolations(observationsText)
//       };
//     });
    
//     // Aggregate all drug mentions with counts
//     console.log('📊 Aggregating drug mentions...');
//     const drugMentionCounts = {};
//     [...processedWarningLetters, ...processedForm483s].forEach(item => {
//       if (item.drugMentions && Array.isArray(item.drugMentions)) {
//         item.drugMentions.forEach(drug => {
//           drugMentionCounts[drug] = (drugMentionCounts[drug] || 0) + 1;
//         });
//       }
//     });
    
//     // Aggregate violations with counts
//     console.log('📊 Aggregating violations...');
//     const violationCounts = {};
//     [...processedWarningLetters, ...processedForm483s].forEach(item => {
//       if (item.violations && Array.isArray(item.violations)) {
//         item.violations.forEach(violation => {
//           violationCounts[violation] = (violationCounts[violation] || 0) + 1;
//         });
//       }
//     });
    
//     // Calculate company-specific data with better matching
//     console.log('🏢 Calculating company-specific data...');
//     const companiesData = companies.map(company => {
//       // Find matching warning letters
//       const companyWLs = processedWarningLetters.filter(wl => {
//         const wlCompany = (wl.companyName || '').toLowerCase();
//         const searchCompany = company.toLowerCase();
        
//         return (
//           wlCompany.includes(searchCompany) ||
//           searchCompany.includes(wlCompany) ||
//           wlCompany.split(' ').some(word => searchCompany.includes(word))
//         );
//       });
      
//       // Find matching Form 483s
//       const companyF483s = processedForm483s.filter(f => {
//         const legalName = (f.legalName || '').toLowerCase();
//         const searchCompany = company.toLowerCase();
        
//         return (
//           legalName.includes(searchCompany) ||
//           searchCompany.includes(legalName) ||
//           legalName.split(' ').some(word => searchCompany.includes(word))
//         );
//       });
      
//       // Calculate risk level
//       const recentDate = new Date();
//       recentDate.setMonth(recentDate.getMonth() - 12); // Last 12 months
      
//       const recentWLs = companyWLs.filter(wl => 
//         new Date(wl.letterIssueDate) > recentDate
//       ).length;
      
//       const recentF483s = companyF483s.filter(f => 
//         new Date(f.recordDate) > recentDate
//       ).length;
      
//       let riskLevel = 'low';
//       if (companyWLs.length > 2 || (recentWLs > 0 && recentF483s > 1)) {
//         riskLevel = 'high';
//       } else if (recentWLs > 0 || recentF483s > 0 || companyWLs.length > 0) {
//         riskLevel = 'medium';
//       }
      
//       console.log(`Company ${company}: WLs=${companyWLs.length}, 483s=${companyF483s.length}, Risk=${riskLevel}`);
      
//       return {
//         name: company,
//         warningLetterCount: companyWLs.length,
//         form483Count: companyF483s.length,
//         inspectionCount: 0, // Will be populated from inspection data if available
//         riskLevel,
//         recentActivity: {
//           warningLetters: recentWLs,
//           form483s: recentF483s
//         },
//         lastWarningLetter: companyWLs.length > 0 ? 
//           companyWLs.sort((a, b) => new Date(b.letterIssueDate) - new Date(a.letterIssueDate))[0].letterIssueDate : null,
//         lastForm483: companyF483s.length > 0 ? 
//           companyF483s.sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate))[0].recordDate : null
//       };
//     });
    
//     // Calculate escalation metrics
//     console.log('📈 Calculating escalation metrics...');
//     let escalationCount = 0;
//     const escalationDetails = [];
    
//     processedForm483s.forEach(f483 => {
//       const f483Date = new Date(f483.recordDate);
//       const matchingWL = processedWarningLetters.find(wl => {
//         const wlDate = new Date(wl.letterIssueDate);
//         const companyMatch = 
//           wl.companyName?.toLowerCase().includes(f483.legalName?.toLowerCase()) ||
//           f483.legalName?.toLowerCase().includes(wl.companyName?.toLowerCase());
//         const dateMatch = wlDate > f483Date && (wlDate - f483Date) / (1000 * 60 * 60 * 24) <= 365;
//         return companyMatch && dateMatch;
//       });
      
//       if (matchingWL) {
//         escalationCount++;
//         escalationDetails.push({
//           form483: f483,
//           warningLetter: matchingWL,
//           daysBetween: Math.floor((new Date(matchingWL.letterIssueDate) - f483Date) / (1000 * 60 * 60 * 24))
//         });
//       }
//     });
    
//     const escalationRate = processedForm483s.length > 0 ? 
//       (escalationCount / processedForm483s.length * 100).toFixed(1) : 0;
    
//     // Prepare final response
//     const responseData = {
//       warningLetters: processedWarningLetters,
//       form483s: processedForm483s,
//       inspections: [], // Will be populated separately if needed
//       companies: companiesData,
//       metrics: {
//         totalWarningLetters: processedWarningLetters.length,
//         totalForm483s: processedForm483s.length,
//         totalInspections: 0,
//         companiesAffected: companies.length,
//         escalationRate: escalationRate,
//         escalationCount: escalationCount,
//         escalationDetails: escalationDetails
//       },
//       commonViolations: Object.entries(violationCounts)
//         .sort((a, b) => b[1] - a[1])
//         .slice(0, 10)
//         .map(([violation, count]) => ({ type: violation, count })),
//       drugMentions: Object.entries(drugMentionCounts)
//         .sort((a, b) => b[1] - a[1])
//         .slice(0, 15)
//         .map(([name, mentions]) => ({ 
//           name, 
//           mentions, 
//           category: 'Pharmaceutical' 
//         })),
//       cgmpGuidance: [] // Will be populated if CGMP guidance is needed
//     };
    
//     console.log('✅ Response prepared:', {
//       warningLetters: responseData.warningLetters.length,
//       form483s: responseData.form483s.length,
//       companies: responseData.companies.length,
//       violations: responseData.commonViolations.length,
//       drugMentions: responseData.drugMentions.length
//     });
    
//     res.json({
//       success: true,
//       data: responseData
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching comprehensive regulatory data:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// // Get detailed company regulatory profile
// app.get('/api/fda/company-profile/:companyName', async (req, res) => {
//   try {
//     const { companyName } = req.params;
    
//     // Create regex for flexible matching
//     const companyRegex = new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
//     // Get all data for the company
//     const [form483s, warningLetterData, cgmpGuidance] = await Promise.all([
//       Form483Model.find({ legalName: companyRegex }).lean(),
//       Promise.resolve(warningLetters.filter(wl => 
//         wl.companyName?.toLowerCase().includes(companyName.toLowerCase())
//       )),
//       CGMPGuidance.find({
//         $or: [
//           { drug_mentions: { $in: [companyName] } },
//           { summary: companyRegex }
//         ]
//       }).limit(10).lean()
//     ]);
    
//     // Get inspection data
//     const inspectionResponse = await new Promise((resolve) => {
//       const mockReq = { query: {} };
//       const mockRes = {
//         json: (data) => resolve(data),
//         status: () => ({ json: (data) => resolve(data) })
//       };
//       req.app._router.stack.find(r => r.route?.path === '/api/inspection-data').route.stack[0].handle(mockReq, mockRes);
//     });
    
//     const companyInspections = inspectionResponse.historicalInspections.filter(i =>
//       i["Firm Name"]?.toLowerCase().includes(companyName.toLowerCase())
//     );
    
//     // Build timeline of all events
//     const timeline = [];
    
//     // Add Form 483s to timeline
//     form483s.forEach(f => {
//       timeline.push({
//         type: 'form483',
//         date: f.recordDate,
//         title: 'Form 483 Issued',
//         details: {
//           feiNumber: f.feiNumber,
//           recordId: f.recordId,
//           download: f.download
//         },
//         severity: 'medium'
//       });
//     });
    
//     // Add Warning Letters to timeline
//     warningLetterData.forEach(wl => {
//       timeline.push({
//         type: 'warningLetter',
//         date: new Date(wl.letterIssueDate),
//         title: 'Warning Letter Issued',
//         details: {
//           letterId: wl.letterId,
//           subject: wl.subject,
//           issuingOffice: wl.issuingOffice
//         },
//         severity: 'high'
//       });
//     });
    
//     // Add Inspections to timeline
//     companyInspections.forEach(i => {
//       timeline.push({
//         type: 'inspection',
//         date: new Date(i["Inspection End Date"]),
//         title: `Inspection - ${i["Inspection Classification"]}`,
//         details: {
//           district: i["District"],
//           projectArea: i["Project Area"],
//           classification: i["Inspection Classification"]
//         },
//         severity: i["Inspection Classification"] === 'OAI' ? 'high' : 
//                  i["Inspection Classification"] === 'VAI' ? 'medium' : 'low'
//       });
//     });
    
//     // Sort timeline by date
//     timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    
//     // Extract facility information
//     const facilities = new Set();
//     companyInspections.forEach(i => {
//       if (i["City"] && i["State"]) {
//         facilities.add({
//           city: i["City"],
//           state: i["State"],
//           country: i["Country/Area"],
//           zip: i["Zip"]
//         });
//       }
//     });
    
//     // Calculate escalation paths
//     const escalationPaths = [];
//     form483s.forEach(f => {
//       const form483Date = new Date(f.recordDate);
//       const subsequentWL = warningLetterData.find(wl => {
//         const wlDate = new Date(wl.letterIssueDate);
//         return wlDate > form483Date && (wlDate - form483Date) / (1000 * 60 * 60 * 24) <= 365;
//       });
      
//       if (subsequentWL) {
//         escalationPaths.push({
//           form483: f,
//           warningLetter: subsequentWL,
//           daysBetween: Math.floor(
//             (new Date(subsequentWL.letterIssueDate) - form483Date) / (1000 * 60 * 60 * 24)
//           )
//         });
//       }
//     });
    
//     res.json({
//       success: true,
//       data: {
//         company: companyName,
//         summary: {
//           warningLetters: warningLetterData.length,
//           form483s: form483s.length,
//           inspections: companyInspections.length,
//           escalationPaths: escalationPaths.length
//         },
//         timeline,
//         facilities: Array.from(facilities),
//         escalationPaths,
//         warningLetters: warningLetterData,
//         form483s,
//         inspections: companyInspections,
//         cgmpGuidance
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching company profile:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // Search CGMP guidance based on violations or drugs
// app.post('/api/fda/cgmp-guidance/search', async (req, res) => {
//   try {
//     const { violations = [], drugMentions = [], keywords = [], limit = 10 } = req.body;
    
//     const searchQuery = { $or: [] };
    
//     if (violations.length > 0) {
//       searchQuery.$or.push({ keywords: { $in: violations } });
//     }
    
//     if (drugMentions.length > 0) {
//       searchQuery.$or.push({ drug_mentions: { $in: drugMentions } });
//     }
    
//     if (keywords.length > 0) {
//       searchQuery.$or.push({
//         $or: [
//           { question: { $in: keywords.map(k => new RegExp(k, 'i')) } },
//           { answer: { $in: keywords.map(k => new RegExp(k, 'i')) } },
//           { summary: { $in: keywords.map(k => new RegExp(k, 'i')) } }
//         ]
//       });
//     }
    
//     if (searchQuery.$or.length === 0) {
//       return res.json({ success: true, data: [] });
//     }
    
//     const guidance = await CGMPGuidance
//       .find(searchQuery)
//       .limit(limit)
//       .sort({ risk_level: -1 })
//       .lean();
    
//     res.json({
//       success: true,
//       data: guidance
//     });
//   } catch (error) {
//     console.error('Error searching CGMP guidance:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // Get Form 483 details with parsed observations
// app.get('/api/fda/form483/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const form483 = await Form483Model.findById(id).lean();
    
//     if (!form483) {
//       return res.status(404).json({ success: false, error: 'Form 483 not found' });
//     }
    
//     // If observations aren't parsed yet, you could trigger PDF parsing here
//     // For now, return what we have
    
//     res.json({
//       success: true,
//       data: form483
//     });
//   } catch (error) {
//     console.error('Error fetching Form 483 details:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// app.post('/api/fda/comprehensive-search', async (req, res) => {
//   try {
//     const { companies = [] } = req.body;
    
//     if (!companies || companies.length === 0) {
//       return res.status(400).json({ success: false, error: 'Companies required' });
//     }
    
//     console.log('🔍 Comprehensive search for:', companies);
    
//     // ENHANCED COMPANY MATCHING STRATEGIES
//     const generateSearchPatterns = (company) => {
//       const patterns = [];
//       const cleaned = company.trim();
      
//       // Original name
//       patterns.push(cleaned);
      
//       // Remove common suffixes
//       const withoutSuffixes = cleaned.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO|PHARMA|PHARMACEUTICALS|PHARMS|USA|OPERATIONS|MANUFACTURING|MFG|LABS|LABORATORIES)\.?$/i, '').trim();
//       if (withoutSuffixes !== cleaned && withoutSuffixes.length > 2) {
//         patterns.push(withoutSuffixes);
//       }
      
//       // Individual words (for compound names)
//       const words = cleaned.split(/\s+/).filter(w => w.length > 3);
//       patterns.push(...words);
      
//       // Remove duplicates
//       return [...new Set(patterns)];
//     };
    
//     // Generate all search patterns
//     const allPatterns = companies.flatMap(generateSearchPatterns);
//     console.log('🔍 Search patterns:', allPatterns);
    
//     // SEARCH FORM 483s
//     const form483Patterns = allPatterns.map(pattern => ({
//       legalName: { $regex: pattern, $options: 'i' }
//     }));
    
//     const form483s = await Form483Model.find({
//       $or: form483Patterns
//     }).lean();
    
//     console.log(`📋 Found ${form483s.length} Form 483s`);
    
//     // SEARCH WARNING LETTERS
//     let warningLetters = [];
//     if (window.warningLetters && Array.isArray(window.warningLetters)) {
//       warningLetters = window.warningLetters.filter(wl => {
//         if (!wl.companyName) return false;
        
//         const wlCompany = wl.companyName.toLowerCase();
//         return allPatterns.some(pattern => 
//           wlCompany.includes(pattern.toLowerCase()) || 
//           pattern.toLowerCase().includes(wlCompany)
//         );
//       });
//     }
    
//     console.log(`📄 Found ${warningLetters.length} Warning Letters`);
    
//     // GET INSPECTION DATA
//     let inspections = [];
//     try {
//       // Call your existing inspection endpoint internally
//       const inspectionData = await new Promise((resolve, reject) => {
//         // Simulate internal API call - replace with your actual logic
//         fetch('/api/inspection-data')
//           .then(response => response.json())
//           .then(data => resolve(data))
//           .catch(err => reject(err));
//       });
      
//       if (inspectionData.historicalInspections) {
//         inspections = inspectionData.historicalInspections.filter(inspection => {
//           const firmName = (inspection["Firm Name"] || '').toLowerCase();
//           return allPatterns.some(pattern => 
//             firmName.includes(pattern.toLowerCase()) || 
//             pattern.toLowerCase().includes(firmName)
//           );
//         });
//       }
//     } catch (error) {
//       console.error('Inspection data fetch failed:', error);
//     }
    
//     console.log(`🏭 Found ${inspections.length} Inspections`);
    
//     // MATCH DATA TO COMPANIES
//     const companyResults = companies.map(company => {
//       const patterns = generateSearchPatterns(company);
      
//       // Find matching records
//       const companyForm483s = form483s.filter(f => 
//         patterns.some(pattern => 
//           (f.legalName || '').toLowerCase().includes(pattern.toLowerCase())
//         )
//       );
      
//       const companyWarningLetters = warningLetters.filter(wl => 
//         patterns.some(pattern => 
//           (wl.companyName || '').toLowerCase().includes(pattern.toLowerCase())
//         )
//       );
      
//       const companyInspections = inspections.filter(inspection => 
//         patterns.some(pattern => 
//           ((inspection["Firm Name"] || '').toLowerCase().includes(pattern.toLowerCase()))
//         )
//       );
      
//       // Calculate risk level
//       const recentDate = new Date();
//       recentDate.setMonth(recentDate.getMonth() - 12);
      
//       const recentWarnings = companyWarningLetters.filter(wl => 
//         new Date(wl.letterIssueDate) > recentDate
//       ).length;
      
//       const recent483s = companyForm483s.filter(f => 
//         new Date(f.recordDate) > recentDate
//       ).length;
      
//       let riskLevel = 'low';
//       if (companyWarningLetters.length > 2 || (recentWarnings > 0 && recent483s > 1)) {
//         riskLevel = 'high';
//       } else if (recentWarnings > 0 || recent483s > 0 || companyWarningLetters.length > 0) {
//         riskLevel = 'medium';
//       }
      
//       return {
//         name: company,
//         warningLetterCount: companyWarningLetters.length,
//         form483Count: companyForm483s.length,
//         inspectionCount: companyInspections.length,
//         riskLevel,
//         warningLetters: companyWarningLetters,
//         form483s: companyForm483s,
//         inspections: companyInspections
//       };
//     });
    
//     // AGGREGATE VIOLATIONS AND DRUGS
//     const allWarningLetters = warningLetters;
//     const allForm483s = form483s;
    
//     // Extract violations
//     const violationCounts = {};
//     [...allWarningLetters, ...allForm483s].forEach(item => {
//       const text = (item.fullContent || item.subject || item.parsedObservations?.join(' ') || '').toLowerCase();
      
//       const violations = [
//         'data integrity', 'contamination', 'quality control', 'validation',
//         'documentation', 'manufacturing practices', 'sterility', 'labeling',
//         'cgmp compliance', 'investigation procedures', 'capa system'
//       ];
      
//       violations.forEach(violation => {
//         if (text.includes(violation)) {
//           violationCounts[violation] = (violationCounts[violation] || 0) + 1;
//         }
//       });
//     });
    
//     // Extract drug mentions (improved)
//     const drugCounts = {};
//     const knownDrugs = [
//       'ketamine', 'fentanyl', 'morphine', 'oxycodone', 'insulin', 'metformin',
//       'amoxicillin', 'ibuprofen', 'acetaminophen', 'propofol', 'midazolam'
//     ];
    
//     [...allWarningLetters, ...allForm483s].forEach(item => {
//       const text = (item.fullContent || item.subject || item.parsedObservations?.join(' ') || '').toLowerCase();
      
//       knownDrugs.forEach(drug => {
//         if (text.includes(drug)) {
//           drugCounts[drug] = (drugCounts[drug] || 0) + 1;
//         }
//       });
//     });
    
//     const response = {
//       success: true,
//       data: {
//         companies: companyResults,
//         metrics: {
//           totalWarningLetters: allWarningLetters.length,
//           totalForm483s: allForm483s.length,
//           totalInspections: inspections.length,
//           companiesAffected: companies.length,
//           escalationRate: '0%' // Calculate if needed
//         },
//         commonViolations: Object.entries(violationCounts)
//           .sort((a, b) => b[1] - a[1])
//           .slice(0, 10)
//           .map(([type, count]) => ({ type, count })),
//         drugMentions: Object.entries(drugCounts)
//           .sort((a, b) => b[1] - a[1])
//           .slice(0, 10)
//           .map(([name, mentions]) => ({ name, mentions, category: 'Pharmaceutical' })),
//         warningLetters: allWarningLetters,
//         form483s: allForm483s,
//         inspections: inspections
//       }
//     };
    
//     console.log('✅ Response prepared:', {
//       companies: response.data.companies.length,
//       warningLetters: response.data.warningLetters.length,
//       form483s: response.data.form483s.length,
//       inspections: response.data.inspections.length
//     });
    
//     res.json(response);
    
//   } catch (error) {
//     console.error('Comprehensive search error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// Import the perfect pharmaceutical matcher at the top
// const { createPerfectCompanyMatcher, PharmaceuticalCompanyMatcher } = require('./pharmaceutical-matcher');

// API ENDPOINTS (keeping all existing endpoints with perfect matching)
app.get('/api/debug/test-companies', async (req, res) => {
  try {
    const testCompanies = ['ENDO', 'EUGIA', 'FRESENIUS', 'GLAND', 'HIKMA', 'HOSPIRA', 'JANSSEN'];
    
    console.log('🧪 Testing companies in database with perfect matching...');
    
    const results = {};
    
    for (const company of testCompanies) {
      // Create perfect matcher for this company
      const matcher = createPerfectCompanyMatcher([company]);
      
      // Test Form 483s with perfect matching
      const allTestForm483s = await Form483Model.find({
        legalName: { $exists: true, $ne: null }
      }).lean();
      
      const matchedForm483s = allTestForm483s.filter(f => matcher(f.legalName));
      
      // Test Warning Letters with perfect matching
      const warningLetterCount = warningLetters ? 
        warningLetters.filter(wl => matcher(wl.companyName)).length : 0;
      
      results[company] = {
        form483s: {
          count: matchedForm483s.length,
          samples: matchedForm483s.slice(0, 3).map(f => ({
            legalName: f.legalName,
            recordDate: f.recordDate,
            feiNumber: f.feiNumber,
            hasObservations: !!f.parsedObservations?.length,
            hasDrugMentions: !!f.drugMentions?.length,
            hasViolations: !!f.violations?.length
          }))
        },
        warningLetters: {
          count: warningLetterCount
        }
      };
    }
    
    res.json({
      success: true,
      data: results,
      summary: {
        totalForm483s: Object.values(results).reduce((sum, r) => sum + r.form483s.count, 0),
        totalWarningLetters: Object.values(results).reduce((sum, r) => sum + r.warningLetters.count, 0),
        companiesWithData: Object.keys(results).filter(c => 
          results[c].form483s.count > 0 || results[c].warningLetters.count > 0
        )
      }
    });

// HELPER FUNCTION: Direct inspection data fetching (avoiding async issues with CSV reading)
async function getInspectionDataDirectly() {
  const fs = require('fs');
  const csv = require('csv-parser');
  const path = require('path');
  
  // Define paths to CSV files
  const file1Path = path.join(__dirname, './e18f4f87-a73a-42c6-ae4e-9a3b76245bdc.csv');
  // const file2Path = path.join(__dirname, 'data/NonClinical_Labs_Inspections_List_(10-1-2000_through_10-1-2024).csv');
  
  const recentInspections = [];
  const historicalInspections = [];
  const projectAreasSet = new Set();
  
  // Helper function to read a CSV file and process its rows
  const readCSV = (filePath, dataArray, processRow) => {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .on('error', (err) => {
          console.warn(`Warning: Could not read CSV file (${filePath}):`, err.message);
          resolve([]); // Return empty array as fallback
        })
        .pipe(csv())
        .on('data', (row) => {
          const processedRow = processRow(row);
          if (processedRow) dataArray.push(processedRow);
        })
        .on('end', () => {
          resolve(dataArray);
        });
    });
  };
  
  // Process recent inspections (file 1)
  const processRecentInspections = async () => {
    await readCSV(file1Path, recentInspections, (row) => {
      return {
        "Record Date": row["Record Date"],
        "Legal Name": row["Legal Name"],
        "Record Type": row["Record Type"],
        "FEI Number": row["FEI Number"],
        "Download": row["Download"]
      };
    });
  };
  
  // Process historical inspections (file 2)
  const processHistoricalInspections = async () => {
    await readCSV(file2Path, historicalInspections, (row) => {
      const processedRow = {
        "District": row["District"],
        "Firm Name": row["Firm Name"],
        "City": row["City"],
        "State": row["State"],
        "Zip": row["Zip"],
        "Country/Area": row["Country/Area"],
        "Inspection End Date": row["Inspection End Date"],
        "Project Area": row["Project Area"],
        "Center/Program Area": row["Center/Program Area"],
        "Inspection Classification": row["Inspection Classification"]
      };
      
      // Add to project areas collection
      if (processedRow["Project Area"]) {
        projectAreasSet.add(processedRow["Project Area"]);
      }
      
      return processedRow;
    });
  };
  
  // Process both files synchronously
  try {
    await Promise.all([processRecentInspections(), processHistoricalInspections()]);
    
    // If no data was loaded, provide empty arrays
    if (recentInspections.length === 0 && historicalInspections.length === 0) {
      console.warn('No inspection data loaded from CSV files');
    }
    
    return {
      recentInspections: recentInspections,
      historicalInspections: historicalInspections,
      projectAreas: Array.from(projectAreasSet)
    };
  } catch (error) {
    console.error('Error processing inspection CSV data:', error);
    return {
      recentInspections: [],
      historicalInspections: [],
      projectAreas: []
    };
  }
}
  } catch (error) {
    console.error('Debug test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced extractDrugMentions function (keeping existing)
const enhancedExtractDrugMentions = (text) => {
  if (!text) return [];
  
  const drugMentions = new Set();
  
  // Enhanced drug patterns
  const drugPatterns = [
    // Specific drug names (add more as needed)
    /\b(ketamine|fentanyl|morphine|oxycodone|hydrocodone|codeine|tramadol|methadone)\b/gi,
    /\b(insulin|metformin|lisinopril|atorvastatin|amlodipine|losartan|levothyroxine)\b/gi,
    /\b(amoxicillin|azithromycin|ciprofloxacin|doxycycline|cephalexin|clindamycin)\b/gi,
    /\b(ibuprofen|acetaminophen|aspirin|naproxen|diclofenac|celecoxib)\b/gi,
    /\b(sertraline|fluoxetine|citalopram|escitalopram|paroxetine|venlafaxine)\b/gi,
    /\b(omeprazole|pantoprazole|lansoprazole|esomeprazole|ranitidine)\b/gi,
    /\b(warfarin|rivaroxaban|apixaban|dabigatran|enoxaparin)\b/gi,
    
    // Drug suffixes and patterns
    /\b\w*(?:mab|nib|tide|cycline|statin|pril|sartan|azole|amine|cillin)\b/gi,
    
    // API mentions with context
    /(?:API|active\s+(?:pharmaceutical\s+)?ingredient)[:\s]+([a-zA-Z][a-zA-Z0-9\s\-]{2,30})/gi,
    
    // Drug product mentions
    /(?:drug\s+product|pharmaceutical\s+product)[:\s]+([a-zA-Z][a-zA-Z0-9\s\-]{2,30})/gi,
    
    // Batch/lot mentions
    /(?:batch|lot)\s+(?:of\s+)?([a-zA-Z][a-zA-Z0-9\s\-]{2,20})/gi,
    
    // Tablet/capsule mentions
    /([a-zA-Z][a-zA-Z0-9\s\-]{2,20})\s+(?:tablets?|capsules?|injection|cream|ointment|solution|suspension)\b/gi
  ];
  
  drugPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const drug = (match[1] || match[0])?.trim();
      if (drug && drug.length > 2 && drug.length < 50 && !/^\d+$/.test(drug)) {
        // Clean up the drug name
        const cleanDrug = drug
          .replace(/[^\w\s\-]/g, '')
          .trim()
          .toLowerCase();
        
        if (cleanDrug.length > 2) {
          drugMentions.add(cleanDrug.charAt(0).toUpperCase() + cleanDrug.slice(1));
        }
      }
    }
  });
  
  return Array.from(drugMentions).slice(0, 10); // Limit to top 10
};

// Enhanced extractViolations function (keeping existing)
const enhancedExtractViolations = (text) => {
  if (!text) return [];
  
  const violations = new Set();
  const lowerText = text.toLowerCase();
  
  // Enhanced violation patterns with priorities
  const violationPatterns = [
    // High priority violations
    { pattern: /data\s+integrity/gi, type: 'Data Integrity', priority: 1 },
    { pattern: /contamination/gi, type: 'Contamination Control', priority: 1 },
    { pattern: /sterility/gi, type: 'Sterility Assurance', priority: 1 },
    { pattern: /microbiological/gi, type: 'Microbiological Controls', priority: 1 },
    
    // Medium priority violations
    { pattern: /quality\s+control/gi, type: 'Quality Control', priority: 2 },
    { pattern: /validation/gi, type: 'Validation', priority: 2 },
    { pattern: /documentation/gi, type: 'Documentation', priority: 2 },
    { pattern: /capa/gi, type: 'CAPA System', priority: 2 },
    { pattern: /investigation/gi, type: 'Investigation Procedures', priority: 2 },
    
    // Standard violations
    { pattern: /manufacturing\s+practice/gi, type: 'Manufacturing Practices', priority: 3 },
    { pattern: /stability/gi, type: 'Stability Testing', priority: 3 },
    { pattern: /labeling/gi, type: 'Labeling', priority: 3 },
    { pattern: /adverse\s+event/gi, type: 'Adverse Event Reporting', priority: 3 },
    { pattern: /deviation/gi, type: 'Deviation Handling', priority: 3 },
    { pattern: /specification/gi, type: 'Specification Compliance', priority: 3 },
    { pattern: /raw\s+material/gi, type: 'Raw Material Control', priority: 3 },
    { pattern: /finished\s+product/gi, type: 'Finished Product Testing', priority: 3 },
    { pattern: /environmental\s+monitoring/gi, type: 'Environmental Monitoring', priority: 3 },
    { pattern: /cleaning\s+validation/gi, type: 'Cleaning Validation', priority: 3 },
    { pattern: /process\s+validation/gi, type: 'Process Validation', priority: 3 },
    { pattern: /method\s+validation/gi, type: 'Method Validation', priority: 3 },
    { pattern: /quality\s+assurance/gi, type: 'Quality Assurance', priority: 3 },
    { pattern: /out\s+of\s+specification|oos/gi, type: 'OOS Results', priority: 2 },
    { pattern: /batch\s+record/gi, type: 'Batch Records', priority: 3 },
    { pattern: /cgmp|gmp/gi, type: 'CGMP Compliance', priority: 2 },
    { pattern: /misbranding/gi, type: 'Misbranding', priority: 2 },
    { pattern: /adulteration/gi, type: 'Adulteration', priority: 1 }
  ];
  
  violationPatterns.forEach(({ pattern, type, priority }) => {
    const matches = text.match(pattern);
    if (matches) {
      violations.add(type);
    }
  });
  
  return Array.from(violations);
};

// Get comprehensive regulatory data for companies with PERFECT MATCHING
app.post('/api/fda/comprehensive-regulatory-data', async (req, res) => {
  try {
    const { companies = [], dateRange = {} } = req.body;
    
    if (!companies || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'Companies list is required' });
    }
    
    console.log('🔍 Fetching comprehensive regulatory data with PERFECT MATCHING for:', companies);
    
    // CREATE PERFECT MATCHER
    const matcher = createPerfectCompanyMatcher(companies);
    
    // Get Form 483s with perfect matching
    console.log('📋 Searching Form 483s...');
    const allAvailableForm483s = await Form483Model.find({
      legalName: { $exists: true, $ne: null, $ne: "" }
    }).lean();
    
    const matchedForm483s = allAvailableForm483s.filter(f => matcher(f.legalName));
    console.log(`📊 Found ${matchedForm483s.length} Form 483s with perfect matching`);
    
    // Get Warning Letters with perfect matching
    console.log('📄 Searching Warning Letters...');
    let matchedWarningLetters = [];
    if (warningLetters && Array.isArray(warningLetters)) {
      matchedWarningLetters = warningLetters.filter(wl => matcher(wl.companyName));
    }
    console.log(`📊 Found ${matchedWarningLetters.length} Warning Letters with perfect matching`);
    
    // Apply date filtering
    if (dateRange.start || dateRange.end) {
      console.log('📅 Applying date filters...');
      
      if (dateRange.start || dateRange.end) {
        matchedWarningLetters = matchedWarningLetters.filter(wl => {
          const wlDate = new Date(wl.letterIssueDate);
          if (dateRange.start && wlDate < new Date(dateRange.start)) return false;
          if (dateRange.end && wlDate > new Date(dateRange.end)) return false;
          return true;
        });
      }
    }
    
    // Process warning letters with enhanced extraction
    console.log('⚗️ Processing Warning Letters data...');
    const processedWarningLetters = matchedWarningLetters.map(wl => ({
      ...wl,
      drugMentions: enhancedExtractDrugMentions(wl.fullContent || wl.content || ''),
      violations: enhancedExtractViolations(wl.fullContent || wl.content || '')
    }));
    
    // Process Form 483s with enhanced extraction
    console.log('⚗️ Processing Form 483s data...');
    const processedForm483s = matchedForm483s.map(f => {
      const observationsText = Array.isArray(f.parsedObservations) ? 
        f.parsedObservations.join(' ') : (f.parsedObservations || '');
      
      return {
        ...f,
        drugMentions: f.drugMentions?.length > 0 ? 
          f.drugMentions : enhancedExtractDrugMentions(observationsText),
        violations: f.violations?.length > 0 ? 
          f.violations : enhancedExtractViolations(observationsText)
      };
    });
    
    // Aggregate all drug mentions with counts
    console.log('📊 Aggregating drug mentions...');
    const drugMentionCounts = {};
    [...processedWarningLetters, ...processedForm483s].forEach(item => {
      if (item.drugMentions && Array.isArray(item.drugMentions)) {
        item.drugMentions.forEach(drug => {
          drugMentionCounts[drug] = (drugMentionCounts[drug] || 0) + 1;
        });
      }
    });
    
    // Aggregate violations with counts
    console.log('📊 Aggregating violations...');
    const violationCounts = {};
    [...processedWarningLetters, ...processedForm483s].forEach(item => {
      if (item.violations && Array.isArray(item.violations)) {
        item.violations.forEach(violation => {
          violationCounts[violation] = (violationCounts[violation] || 0) + 1;
        });
      }
    });
    
    // Calculate company-specific data with perfect matching
    console.log('🏢 Calculating company-specific data...');
    const companiesData = companies.map(company => {
      // Use perfect matcher for individual company matching
      const companyMatcher = createPerfectCompanyMatcher([company]);
      
      // Find matching warning letters
      const companyWLs = processedWarningLetters.filter(wl => companyMatcher(wl.companyName));
      
      // Find matching Form 483s
      const companyF483s = processedForm483s.filter(f => companyMatcher(f.legalName));
      
      // Calculate risk level
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 12); // Last 12 months
      
      const recentWLs = companyWLs.filter(wl => 
        new Date(wl.letterIssueDate) > recentDate
      ).length;
      
      const recentF483s = companyF483s.filter(f => 
        new Date(f.recordDate) > recentDate
      ).length;
      
      let riskLevel = 'low';
      if (companyWLs.length > 2 || (recentWLs > 0 && recentF483s > 1)) {
        riskLevel = 'high';
      } else if (recentWLs > 0 || recentF483s > 0 || companyWLs.length > 0) {
        riskLevel = 'medium';
      }
      
      console.log(`Company ${company}: WLs=${companyWLs.length}, 483s=${companyF483s.length}, Risk=${riskLevel}`);
      
      return {
        name: company,
        warningLetterCount: companyWLs.length,
        form483Count: companyF483s.length,
        inspectionCount: inspectionCounts[company] || 0, // Use calculated inspection count
        riskLevel,
        recentActivity: {
          warningLetters: recentWLs,
          form483s: recentF483s
        },
        lastWarningLetter: companyWLs.length > 0 ? 
          companyWLs.sort((a, b) => new Date(b.letterIssueDate) - new Date(a.letterIssueDate))[0].letterIssueDate : null,
        lastForm483: companyF483s.length > 0 ? 
          companyF483s.sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate))[0].recordDate : null
      };
    });
    
    // Calculate escalation metrics with perfect matching
    console.log('📈 Calculating escalation metrics...');
    let escalationCount = 0;
    const escalationDetails = [];
    
    processedForm483s.forEach(f483 => {
      const f483Date = new Date(f483.recordDate);
      const f483Matcher = createPerfectCompanyMatcher([f483.legalName]);
      
      const matchingWL = processedWarningLetters.find(wl => {
        const wlDate = new Date(wl.letterIssueDate);
        const companyMatch = f483Matcher(wl.companyName);
        const dateMatch = wlDate > f483Date && (wlDate - f483Date) / (1000 * 60 * 60 * 24) <= 365;
        return companyMatch && dateMatch;
      });
      
      if (matchingWL) {
        escalationCount++;
        escalationDetails.push({
          form483: f483,
          warningLetter: matchingWL,
          daysBetween: Math.floor((new Date(matchingWL.letterIssueDate) - f483Date) / (1000 * 60 * 60 * 24))
        });
      }
    });
    
    const escalationRate = processedForm483s.length > 0 ? 
      (escalationCount / processedForm483s.length * 100).toFixed(1) : 0;
    
    // Prepare final response (keeping exact same structure for frontend compatibility)
    const responseData = {
      warningLetters: processedWarningLetters,
      form483s: processedForm483s,
      inspections: [], // Will be populated separately if needed
      companies: companiesData,
      metrics: {
        totalWarningLetters: processedWarningLetters.length,
        totalForm483s: processedForm483s.length,
        totalInspections: matchedInspections.length,
        companiesAffected: companies.length,
        escalationRate: escalationRate,
        escalationCount: escalationCount,
        escalationDetails: escalationDetails
      },
      commonViolations: Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([violation, count]) => ({ type: violation, count })),
      drugMentions: Object.entries(drugMentionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, mentions]) => ({ 
          name, 
          mentions, 
          category: 'Pharmaceutical' 
        })),
      cgmpGuidance: [] // Will be populated if CGMP guidance is needed
    };
    
    console.log('✅ Response prepared with perfect matching:', {
      warningLetters: responseData.warningLetters.length,
      form483s: responseData.form483s.length,
      companies: responseData.companies.length,
      violations: responseData.commonViolations.length,
      drugMentions: responseData.drugMentions.length
    });
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Error fetching comprehensive regulatory data with perfect matching:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get detailed company regulatory profile with PERFECT MATCHING
app.get('/api/fda/company-profile/:companyName', async (req, res) => {
  try {
    const { companyName } = req.params;
    
    console.log(`🔍 Getting company profile for: ${companyName} with perfect matching`);
    
    // Create perfect matcher for this specific company
    const matcher = createPerfectCompanyMatcher([companyName]);
    
    // Get all Form 483s and filter with perfect matching
    const allCompanyForm483s = await Form483Model.find({
      legalName: { $exists: true, $ne: null }
    }).lean();
    
    const form483s = allCompanyForm483s.filter(f => matcher(f.legalName));
    
    // Get Warning Letters with perfect matching
    const warningLetterData = warningLetters ? 
      warningLetters.filter(wl => matcher(wl.companyName)) : [];
    
    // Get CGMP Guidance
    const cgmpGuidance = await CGMPGuidance.find({
      $or: [
        { drug_mentions: { $in: [companyName] } },
        { summary: new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    }).limit(10).lean();
    
    // Get inspection data (keeping your existing logic)
    const inspectionResponse = await new Promise((resolve) => {
      const mockReq = { query: {} };
      const mockRes = {
        json: (data) => resolve(data),
        status: () => ({ json: (data) => resolve(data) })
      };
      req.app._router.stack.find(r => r.route?.path === '/api/inspection-data').route.stack[0].handle(mockReq, mockRes);
    });
    
    // Filter inspections with perfect matching
    const companyInspections = inspectionResponse.historicalInspections.filter(i =>
      matcher(i["Firm Name"])
    );
    
    // Build timeline of all events (keeping existing logic)
    const timeline = [];
    
    // Add Form 483s to timeline
    form483s.forEach(f => {
      timeline.push({
        type: 'form483',
        date: f.recordDate,
        title: 'Form 483 Issued',
        details: {
          feiNumber: f.feiNumber,
          recordId: f.recordId,
          download: f.download
        },
        severity: 'medium'
      });
    });
    
    // Add Warning Letters to timeline
    warningLetterData.forEach(wl => {
      timeline.push({
        type: 'warningLetter',
        date: new Date(wl.letterIssueDate),
        title: 'Warning Letter Issued',
        details: {
          letterId: wl.letterId,
          subject: wl.subject,
          issuingOffice: wl.issuingOffice
        },
        severity: 'high'
      });
    });
    
    // Add Inspections to timeline
    companyInspections.forEach(i => {
      timeline.push({
        type: 'inspection',
        date: new Date(i["Inspection End Date"]),
        title: `Inspection - ${i["Inspection Classification"]}`,
        details: {
          district: i["District"],
          projectArea: i["Project Area"],
          classification: i["Inspection Classification"]
        },
        severity: i["Inspection Classification"] === 'OAI' ? 'high' : 
                 i["Inspection Classification"] === 'VAI' ? 'medium' : 'low'
      });
    });
    
    // Sort timeline by date
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Extract facility information
    const facilities = new Set();
    companyInspections.forEach(i => {
      if (i["City"] && i["State"]) {
        facilities.add({
          city: i["City"],
          state: i["State"],
          country: i["Country/Area"],
          zip: i["Zip"]
        });
      }
    });
    
    // Calculate escalation paths with perfect matching
    const escalationPaths = [];
    form483s.forEach(f => {
      const form483Date = new Date(f.recordDate);
      const form483Matcher = createPerfectCompanyMatcher([f.legalName]);
      
      const subsequentWL = warningLetterData.find(wl => {
        const wlDate = new Date(wl.letterIssueDate);
        const companyMatch = form483Matcher(wl.companyName);
        return companyMatch && wlDate > form483Date && (wlDate - form483Date) / (1000 * 60 * 60 * 24) <= 365;
      });
      
      if (subsequentWL) {
        escalationPaths.push({
          form483: f,
          warningLetter: subsequentWL,
          daysBetween: Math.floor(
            (new Date(subsequentWL.letterIssueDate) - form483Date) / (1000 * 60 * 60 * 24)
          )
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        company: companyName,
        summary: {
          warningLetters: warningLetterData.length,
          form483s: form483s.length,
          inspections: companyInspections.length,
          escalationPaths: escalationPaths.length
        },
        timeline,
        facilities: Array.from(facilities),
        escalationPaths,
        warningLetters: warningLetterData,
        form483s,
        inspections: companyInspections,
        cgmpGuidance
      }
    });
  } catch (error) {
    console.error('Error fetching company profile with perfect matching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search CGMP guidance based on violations or drugs (keeping existing)
app.post('/api/fda/cgmp-guidance/search', async (req, res) => {
  try {
    const { violations = [], drugMentions = [], keywords = [], limit = 10 } = req.body;
    
    const searchQuery = { $or: [] };
    
    if (violations.length > 0) {
      searchQuery.$or.push({ keywords: { $in: violations } });
    }
    
    if (drugMentions.length > 0) {
      searchQuery.$or.push({ drug_mentions: { $in: drugMentions } });
    }
    
    if (keywords.length > 0) {
      searchQuery.$or.push({
        $or: [
          { question: { $in: keywords.map(k => new RegExp(k, 'i')) } },
          { answer: { $in: keywords.map(k => new RegExp(k, 'i')) } },
          { summary: { $in: keywords.map(k => new RegExp(k, 'i')) } }
        ]
      });
    }
    
    if (searchQuery.$or.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const guidance = await CGMPGuidance
      .find(searchQuery)
      .limit(limit)
      .sort({ risk_level: -1 })
      .lean();
    
    res.json({
      success: true,
      data: guidance
    });
  } catch (error) {
    console.error('Error searching CGMP guidance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Form 483 details with parsed observations (keeping existing)
app.get('/api/fda/form483/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const form483 = await Form483Model.findById(id).lean();
    
    if (!form483) {
      return res.status(404).json({ success: false, error: 'Form 483 not found' });
    }
    
    res.json({
      success: true,
      data: form483
    });
  } catch (error) {
    console.error('Error fetching Form 483 details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATED: Main comprehensive search with PERFECT MATCHING
app.post('/api/fda/comprehensive-search', async (req, res) => {
  try {
    const { companies = [] } = req.body;
    
    if (!companies || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'Companies required' });
    }
    
    console.log('🔍 Comprehensive search with PERFECT MATCHING for:', companies);
    
    // CREATE PERFECT MATCHER
    const matcher = createPerfectCompanyMatcher(companies);
    
    // SEARCH FORM 483s with perfect matching
    console.log('📋 Searching Form 483s with perfect matching...');
    const allDatabaseForm483s = await Form483Model.find({
      legalName: { $exists: true, $ne: null, $ne: "" }
    }).lean();
    
    const form483s = allDatabaseForm483s.filter(f => matcher(f.legalName));
    console.log(`📋 Found ${form483s.length} Form 483s with perfect matching`);
    
    // SEARCH WARNING LETTERS with perfect matching
    console.log('📄 Searching Warning Letters with perfect matching...');
    let warningLetters = [];
    if (window.warningLetters && Array.isArray(window.warningLetters)) {
      warningLetters = window.warningLetters.filter(wl => matcher(wl.companyName));
    }
    console.log(`📄 Found ${warningLetters.length} Warning Letters with perfect matching`);
    
    // GET INSPECTION DATA with perfect matching
    let inspections = [];
    let inspectionCounts = {};
    
    try {
      // Get inspection data directly from your existing function
      const inspectionData = await getInspectionDataDirectly();
      
      if (inspectionData.historicalInspections) {
        // Filter all inspections with perfect matching
        const matchedHistoricalInspections = inspectionData.historicalInspections.filter(inspection => 
          matcher(inspection["Firm Name"]) || matcher(inspection["Legal Name"])
        );
        
        const matchedRecentInspections = inspectionData.recentInspections ? 
          inspectionData.recentInspections.filter(inspection => 
            matcher(inspection["Legal Name"]) || matcher(inspection["Firm Name"])
          ) : [];
        
        inspections = [...matchedHistoricalInspections, ...matchedRecentInspections];
        
        // Calculate individual company inspection counts
        companies.forEach(company => {
          const companyMatcher = createPerfectCompanyMatcher([company]);
          
          const historicalCount = inspectionData.historicalInspections.filter(i => 
            companyMatcher(i["Firm Name"]) || companyMatcher(i["Legal Name"])
          ).length;
          
          const recentCount = inspectionData.recentInspections ? 
            inspectionData.recentInspections.filter(i => 
              companyMatcher(i["Legal Name"]) || companyMatcher(i["Firm Name"])
            ).length : 0;
          
          inspectionCounts[company] = historicalCount + recentCount;
        });
      }
    } catch (error) {
      console.error('Inspection data fetch failed:', error);
      // Initialize all counts to 0
      companies.forEach(company => {
        inspectionCounts[company] = 0;
      });
    }
    
    console.log(`🏭 Found ${inspections.length} Inspections with perfect matching`);
    
    // MATCH DATA TO COMPANIES with perfect matching
    const companyResults = companies.map(company => {
      const companyMatcher = createPerfectCompanyMatcher([company]);
      
      // Find matching records with perfect matching
      const companyForm483s = form483s.filter(f => companyMatcher(f.legalName));
      const companyWarningLetters = warningLetters.filter(wl => companyMatcher(wl.companyName));
      const companyInspections = inspections.filter(inspection => 
        companyMatcher(inspection["Firm Name"]) || companyMatcher(inspection["Legal Name"])
      );
      
      // Use the calculated inspection count from inspectionCounts
      const inspectionCount = inspectionCounts[company] || 0;
      
      // Calculate risk level
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 12);
      
      const recentWarnings = companyWarningLetters.filter(wl => 
        new Date(wl.letterIssueDate) > recentDate
      ).length;
      
      const recent483s = companyForm483s.filter(f => 
        new Date(f.recordDate) > recentDate
      ).length;
      
      let riskLevel = 'low';
      if (companyWarningLetters.length > 2 || (recentWarnings > 0 && recent483s > 1)) {
        riskLevel = 'high';
      } else if (recentWarnings > 0 || recent483s > 0 || companyWarningLetters.length > 0) {
        riskLevel = 'medium';
      }
      
      return {
        name: company,
        warningLetterCount: companyWarningLetters.length,
        form483Count: companyForm483s.length,
        inspectionCount: inspectionCount, // Use calculated count
        riskLevel,
        warningLetters: companyWarningLetters,
        form483s: companyForm483s,
        inspections: companyInspections
      };
    });
    
    // AGGREGATE VIOLATIONS AND DRUGS (keeping existing logic)
    const allWarningLetters = warningLetters;
    const allForm483s = form483s;
    
    // Extract violations
    const violationCounts = {};
    [...allWarningLetters, ...allForm483s].forEach(item => {
      const text = (item.fullContent || item.subject || item.parsedObservations?.join(' ') || '').toLowerCase();
      
      const violations = [
        'data integrity', 'contamination', 'quality control', 'validation',
        'documentation', 'manufacturing practices', 'sterility', 'labeling',
        'cgmp compliance', 'investigation procedures', 'capa system'
      ];
      
      violations.forEach(violation => {
        if (text.includes(violation)) {
          violationCounts[violation] = (violationCounts[violation] || 0) + 1;
        }
      });
    });
    
    // Extract drug mentions (improved)
    const drugCounts = {};
    const knownDrugs = [
      'ketamine', 'fentanyl', 'morphine', 'oxycodone', 'insulin', 'metformin',
      'amoxicillin', 'ibuprofen', 'acetaminophen', 'propofol', 'midazolam'
    ];
    
    [...allWarningLetters, ...allForm483s].forEach(item => {
      const text = (item.fullContent || item.subject || item.parsedObservations?.join(' ') || '').toLowerCase();
      
      knownDrugs.forEach(drug => {
        if (text.includes(drug)) {
          drugCounts[drug] = (drugCounts[drug] || 0) + 1;
        }
      });
    });
    
    // Prepare response (keeping exact same structure for frontend compatibility)
    const response = {
      success: true,
      data: {
        companies: companyResults,
        metrics: {
          totalWarningLetters: allWarningLetters.length,
          totalForm483s: allForm483s.length,
          totalInspections: inspections.length,
          companiesAffected: companies.length,
          escalationRate: '0%' // Calculate if needed
        },
        commonViolations: Object.entries(violationCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([type, count]) => ({ type, count })),
        drugMentions: Object.entries(drugCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, mentions]) => ({ name, mentions, category: 'Pharmaceutical' })),
        warningLetters: allWarningLetters,
        form483s: allForm483s,
        inspections: inspections
      }
    };
    
    console.log('✅ Response prepared with perfect matching:', {
      companies: response.data.companies.length,
      warningLetters: response.data.warningLetters.length,
      form483s: response.data.form483s.length,
      inspections: response.data.inspections.length
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('Comprehensive search error with perfect matching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADD NEW DEBUG ENDPOINT FOR PERFECT MATCHING TESTING
app.post('/api/debug/test-perfect-matching', async (req, res) => {
  try {
    const { companies = [], testCompanies = [] } = req.body;
    
    console.log('🧪 Testing perfect matching...');
    
    // Create the matcher
    const matcher = createPerfectCompanyMatcher(companies);
    const debugMatcher = new PharmaceuticalCompanyMatcher();
    
    // Test against provided test companies or use defaults
    const defaultTestCompanies = [
      'Pfizer Inc',
      'Pfizer Manufacturing LLC',
      'Janssen Pharmaceuticals',
      'Johnson & Johnson',
      'J&J Innovation',
      'Novartis AG',
      'Sandoz Inc',
      'Anti-Pfizer Legal Services', // Should NOT match
      'Random Company Inc' // Should NOT match
    ];
    
    const companiesToTest = testCompanies.length > 0 ? testCompanies : defaultTestCompanies;
    
    // Test each company
    const results = companiesToTest.map(testCompany => {
      const isMatch = matcher(testCompany);
      const confidence = debugMatcher.getMatchWithConfidence(testCompany, companies);
      
      return {
        company: testCompany,
        matches: isMatch,
        confidence: confidence.confidence,
        reason: confidence.reason
      };
    });
    
    // Get actual database counts
    const actualForm483Count = await Form483Model.countDocuments({
      legalName: { $exists: true }
    });
    
    const actualWarningLetterCount = warningLetters ? warningLetters.length : 0;
    
    // Test with actual database
    const allDebugForm483s = await Form483Model.find({
      legalName: { $exists: true, $ne: null }
    }).limit(100).lean(); // Limit for testing
    
    const matchedForm483s = allDebugForm483s.filter(f => matcher(f.legalName));
    const matchedWarningLetters = warningLetters ? 
      warningLetters.filter(wl => matcher(wl.companyName)).slice(0, 50) : [];
    
    res.json({
      success: true,
      searchTerms: companies,
      testResults: results,
      databaseTest: {
        totalForm483s: actualForm483Count,
        totalWarningLetters: actualWarningLetterCount,
        matchedForm483s: matchedForm483s.length,
        matchedWarningLetters: matchedWarningLetters.length,
        sampleMatches: {
          form483s: matchedForm483s.slice(0, 5).map(f => f.legalName),
          warningLetters: matchedWarningLetters.slice(0, 5).map(wl => wl.companyName)
        }
      }
    });
    
  } catch (error) {
    console.error('Debug test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
// // Login endpoint
// app.post('/api/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;
    
//     // Find user by username
//     const user = await User.findOne({ username });
    
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid username or password' });
//     }
    
//     // Verify password
//     const isPasswordValid = User.verifyPassword(password, user.passwordHash, user.salt);
    
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: 'Invalid username or password' });
//     }
    
//     // Convert to plain object and remove sensitive data
//     const userObj = user.toObject();
//     const { passwordHash, salt, ...safeUser } = userObj;
    
//     res.json({ user: safeUser });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Signup endpoint
// app.post('/api/signup', async (req, res) => {
//   try {
//     const { username, email, password } = req.body;
    
//     // Check if username or email already exists
//     const existingUsername = await User.findOne({ username });
//     if (existingUsername) {
//       return res.status(400).json({ message: 'Username already exists' });
//     }
    
//     const existingEmail = await User.findOne({ email });
//     if (existingEmail) {
//       return res.status(400).json({ message: 'Email already exists' });
//     }
    
//     // Hash password
//     const { hash: passwordHash, salt } = User.hashPassword(password);
    
//     // Create new user
//     const newUser = new User({
//       username,
//       email,
//       passwordHash,
//       salt,
//       role: 'user',
//       usage: 0,
//       billingPeriod: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
//       subscriptionStatus: 'free-trial',
//       darkModeEnabled: false
//     });
    
//     // Save user to database
//     await newUser.save();
    
//     // Send welcome email
//     const emailSent = await sendWelcomeEmail(newUser);
    
//     // Convert to plain object and remove sensitive data
//     const userObj = newUser.toObject();
//     const { passwordHash: ph, salt: s, ...safeUser } = userObj;
    
//     res.json({ user: safeUser });
//   } catch (error) {
//     console.error('Signup error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });




// // Route for FDA 510(k) data
// app.get('/api/TEG/fda/510k', async (req, res) => {
//   try {
//     const searchTerm = req.query.search || 'TEG 6S';
//     const limit = req.query.limit || 100;
    
//     const response = await axios.get(`https://api.fda.gov/device/510k.json`, {
//       params: {
//         search: `device_name:${searchTerm}`,
//         limit: limit
//       }
//     });
    
//     res.json(response.data);
//   } catch (error) {
//     console.error('Error fetching FDA data:', error.message);
//     res.status(500).json({ 
//       error: 'Failed to fetch FDA data',
//       details: error.message
//     });
//   }
// });

// Initialize drug watch service
initializeDrugWatchService();

// Use the drug watch routes
app.use('/api', drugWatchRouter);
app.use('/api/biomarkers', biomarkerRoutes);
app.use('/api/device', fdaRoutes);
app.use('/api/pharmaceutical-labels', pharmaceuticalRouter);
app.use('/api/ema', emaMongoRouter);

// Grok API Configuration
const GROK_API = 'https://api.grok.ai/v1';
const GROK_URL = process.env.grok
// Configure axios for Grok API calls
const grokAPI = axios.create({
  baseURL: GROK_URL,
  headers: {
    'Authorization': `Bearer ${GROK_API}`,
    'Content-Type': 'application/json'
  }
});


// app.post('/api/studies/advanced-search-v2', async (req, res) => {
//   try {
//     console.log('🔍 API v2: Advanced clinical trials search request received');
//     console.log('🔍 API v2: Request payload:', JSON.stringify(req.body, null, 2));
        
//     // The frontend now sends the exact API v2 structure, so we can pass it through directly
//     const apiPayload = req.body;
        
//     // Validate that we have at least one query parameter
//     const hasQueryParams = Object.keys(apiPayload).some(key => 
//       key.startsWith('query.') && apiPayload[key]
//     );
        
//     if (!hasQueryParams) {
//       console.log('❌ API v2: No query parameters found');
//       return res.status(400).json({
//         success: false,
//         error: 'At least one query parameter (query.*) must be provided',
//         data: { studies: [], totalCount: 0 }
//       });
//     }
        
//     // Define the ClinicalTrials.gov API v2 base URL
//     const CLINICAL_TRIALS_API_V2 = 'https://clinicaltrials.gov/api/v2';
        
//     // Build the base query parameters for the API request
//     const baseQueryParams = new URLSearchParams();
        
//     // Add all parameters from the payload to query string (except pagination params)
//     Object.keys(apiPayload).forEach(key => {
//       const value = apiPayload[key];
      
//       // Skip pagination parameters - we'll handle these ourselves
//       if (key === 'pageSize' || key === 'pageToken') {
//         return;
//       }
            
//       if (value !== null && value !== undefined && value !== '') {
//         if (Array.isArray(value)) {
//           // For arrays, join with commas (API v2 format)
//           if (value.length > 0) {
//             baseQueryParams.append(key, value.join(','));
//           }
//         } else {
//           baseQueryParams.append(key, value.toString());
//         }
//       }
//     });

//     // Set maximum page size and enable total count for first request
//     baseQueryParams.set('pageSize', '1000'); // Maximum allowed by API
//     baseQueryParams.set('countTotal', 'true');
        
//     console.log('🔍 API v2: Base params for pagination:', baseQueryParams.toString());
        
//     // Initialize variables for pagination
//     let allStudies = [];
//     let totalCount = 0;
//     let pageToken = null;
//     let pageNumber = 1;
//     let hasMorePages = true;
        
//     // Fetch all pages
//     while (hasMorePages) {
//       // Create query params for this page
//       const currentQueryParams = new URLSearchParams(baseQueryParams);
      
//       // Add page token for subsequent pages
//       if (pageToken) {
//         currentQueryParams.set('pageToken', pageToken);
//         // Don't count total again for subsequent pages
//         currentQueryParams.delete('countTotal');
//       }
      
//       const apiUrl = `${CLINICAL_TRIALS_API_V2}/studies?${currentQueryParams.toString()}`;
//       console.log(`🔍 API v2: Fetching page ${pageNumber} - URL: ${apiUrl}`);
            
//       try {
//         const response = await axios.get(apiUrl, {
//           headers: {
//             'Accept': 'application/json',
//             'Cache-Control': 'no-cache',
//             'User-Agent': 'Clinical-Research-Tool/1.0'
//           },
//           timeout: 30000 // 30 second timeout
//         });
            
//         console.log(`🔍 API v2: Page ${pageNumber} response status:`, response.status);
//         console.log(`🔍 API v2: Studies in page ${pageNumber}:`, response.data.studies?.length || 0);
            
//         // Add studies from this page to our collection
//         if (response.data.studies && response.data.studies.length > 0) {
//           allStudies = allStudies.concat(response.data.studies);
//         }
            
//         // Store total count from first page
//         if (pageNumber === 1 && response.data.totalCount !== undefined) {
//           totalCount = response.data.totalCount;
//           console.log(`🔍 API v2: Total count from API: ${totalCount}`);
//         }
            
//         // Check if there are more pages
//         if (response.data.nextPageToken) {
//           pageToken = response.data.nextPageToken;
//           pageNumber++;
          
//           // Safety check to prevent infinite loops (optional)
//           if (pageNumber > 1000) {
//             console.log('⚠️ API v2: Reached maximum page limit (1000), stopping pagination');
//             hasMorePages = false;
//           }
//         } else {
//           hasMorePages = false;
//           console.log(`🔍 API v2: No more pages. Fetched ${pageNumber} pages total.`);
//         }
            
//       } catch (pageError) {
//         console.error(`❌ API v2: Error fetching page ${pageNumber}:`, pageError.message);
        
//         // If we have some studies already, we can still return them
//         if (allStudies.length > 0) {
//           console.log(`⚠️ API v2: Returning ${allStudies.length} studies collected before error`);
//           break;
//         } else {
//           // Re-throw error if we haven't collected any studies yet
//           throw pageError;
//         }
//       }
//     }
        
//     console.log(`🔍 API v2: Final results - Total studies collected: ${allStudies.length}`);
//     console.log(`🔍 API v2: API reported total count: ${totalCount}`);
        
//     // Use the collected count if API didn't provide totalCount
//     const finalTotalCount = totalCount || allStudies.length;
        
//     // Return all collected studies
//     res.json({
//       success: true,
//       data: {
//         studies: allStudies,
//         totalCount: finalTotalCount,
//         pagesProcessed: pageNumber,
//         nextPageToken: null // Always null since we fetched everything
//       },
//       apiResponse: {
//         status: 200,
//         timestamp: new Date().toISOString(),
//         note: `Aggregated results from ${pageNumber} page(s)`
//       }
//     });
        
//   } catch (error) {
//     console.error("❌ API v2: Advanced clinical trials search error:", error);
        
//     // Provide detailed error information
//     let errorMessage = error.message;
//     let errorDetails = {};
        
//     if (error.response) {
//       // API returned an error response
//       errorMessage = `ClinicalTrials.gov API error: ${error.response.status} ${error.response.statusText}`;
//       errorDetails = {
//         status: error.response.status,
//         statusText: error.response.statusText,
//         data: error.response.data
//       };
//       console.error("❌ API v2: API response error:", error.response.data);
//     } else if (error.request) {
//       // Network error
//       errorMessage = 'Network error: Could not reach ClinicalTrials.gov API';
//       errorDetails = { request: 'No response received' };
//     }
        
//     res.status(500).json({
//       success: false,
//       error: errorMessage,
//       details: errorDetails,
//       data: { studies: [], totalCount: 0 }
//     });
//   }
// });



app.post('/api/studies/advanced-search-v2', async (req, res) => {
  try {
    console.log('🔍 Advanced search v2 request received:', req.body);
    
    // IMPORTANT: Parameters come directly in req.body, not nested
    const queryParams = { ...req.body };
    
    // VALIDATION: Clean up parameters before sending to API
    
    // Ensure required format parameters
    if (!queryParams.format) {
      queryParams.format = 'json';
    }
    
    // FIXED: Ensure fields is properly formatted (comma-separated string)
    if (Array.isArray(queryParams.fields)) {
      queryParams.fields = queryParams.fields.join(',');
    }
    if (!queryParams.fields) {
      queryParams.fields = 'protocolSection,derivedSection,hasResults';
    }
    
    // FIXED: Clean up sort parameter
    if (Array.isArray(queryParams.sort)) {
      if (queryParams.sort.length === 0) {
        delete queryParams.sort;
      } else {
        queryParams.sort = queryParams.sort.join(',');
      }
    }
    
    // Remove empty or undefined parameters
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === undefined || 
          queryParams[key] === null || 
          queryParams[key] === '' ||
          (Array.isArray(queryParams[key]) && queryParams[key].length === 0)) {
        delete queryParams[key];
      }
    });
    
    // Log cleaned parameters
    console.log('🔍 Cleaned parameters for ClinicalTrials.gov API v2:', queryParams);
    
    // VALIDATION: Check for known problematic parameters
    const problematicParams = [];
    if (Array.isArray(queryParams.fields)) {
      problematicParams.push('fields is array (should be string)');
    }
    if (queryParams['fields[]']) {
      problematicParams.push('fields[] parameter detected (should be fields)');
      delete queryParams['fields[]'];
    }
    
    if (problematicParams.length > 0) {
      console.warn('⚠️ Fixed problematic parameters:', problematicParams);
    }
    
    // Make request to ClinicalTrials.gov API v2
    const apiUrl = 'https://clinicaltrials.gov/api/v2/studies';
    console.log('🔍 Making request to:', apiUrl);
    console.log('🔍 With parameters:', queryParams);
    
    const response = await axios.get(apiUrl, {
      params: queryParams,
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Clinical Research Tool/1.0',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ ClinicalTrials.gov API response received:', {
      status: response.status,
      studyCount: response.data?.studies?.length || 0,
      totalCount: response.data?.totalCount || 0
    });
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('❌ ClinicalTrials.gov API error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: error.config?.params
    });
    
    // Provide detailed error information
    const errorResponse = {
      success: false,
      error: `ClinicalTrials.gov API error: ${error.response?.status || 'Unknown error'}`,
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      data: {
        studies: [],
        totalCount: 0
      }
    };
    
    // If it's a parameter error, provide helpful info
    if (error.response?.status === 400) {
      errorResponse.details.originalRequest = error.config?.params;
      errorResponse.details.hint = 'Check parameter format - fields should be comma-separated string, not array';
    }
    
    res.status(500).json(errorResponse);
  }
});

// ALTERNATIVE: Simpler version with minimal processing
app.post('/api/studies/advanced-search-v2-simple', async (req, res) => {
  try {
    console.log('🔍 Simple advanced search v2 request:', req.body);
    
    // Minimal parameter processing
    const params = { ...req.body };
    
    // Only fix the known issue with fields parameter
    if (Array.isArray(params.fields)) {
      params.fields = params.fields.join(',');
    }
    
    // Remove empty values
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });
    
    console.log('🔍 Sending to ClinicalTrials.gov:', params);
    
    const response = await axios.get('https://clinicaltrials.gov/api/v2/studies', {
      params: params
    });
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      data: { studies: [], totalCount: 0 }
    });
  }
});

app.get('/api/test/advanced-search', async (req, res) => {
  try {
    console.log('🧪 TEST: Advanced search test endpoint called');
    
    // Test the fetchClinicalTrials function directly
    const testParams = {
      drug: 'aspirin',
      condition: null,
      hasResults: false,
      yearsBack: 5,
      sinceDate: null,
      searchRelated: false,
      page: 1,
      pageSize: 10,
      fetchAll: false,
      status: null
    };
    
    console.log('🧪 TEST: Calling fetchClinicalTrials with params:', testParams);
    
    const result = await fetchClinicalTrials(testParams);
    
    console.log('🧪 TEST: fetchClinicalTrials result:', {
      success: result.success,
      studyCount: result.data?.studies?.length || 0,
      error: result.error
    });
    
    res.json({
      testEndpoint: 'working',
      fetchClinicalTrialsResult: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🧪 TEST: Error in test endpoint:', error);
    res.status(500).json({
      testEndpoint: 'error',
      error: error.message,
      stack: error.stack
    });
  }
});


// Add to clinicaltrials.js

app.post('/api/studies/advanced-search', async (req, res) => {
  try {
    console.log('🔍 Advanced clinical trials search request received');
    
    const {
      queries = [],
      filters = {},
      timeRange = {},
      studyTypes = [],
      phases = [],
      enrollment = {},
      geography = {},
      sponsor = {},
      fetchAll = true,
      pageSize = 100
    } = req.body;

    console.log('Advanced search parameters:', req.body);

    // Process main search terms
    let interventionTerms = [];
    let conditionTerms = [];
    let generalTerms = [];

    queries.forEach(query => {
      if (query.value && query.value.trim()) {
        switch (query.field) {
          case 'drug':
          case 'intervention':
            interventionTerms.push(query.value.trim());
            break;
          case 'condition':
          case 'disease':
            conditionTerms.push(query.value.trim());
            break;
          default:
            generalTerms.push(query.value.trim());
            break;
        }
      }
    });

    // Build parameters for fetchClinicalTrials function
    const searchParams = {
      drug: interventionTerms.length > 0 ? interventionTerms.join(' ') : null,
      condition: conditionTerms.length > 0 ? conditionTerms.join(' ') : null,
      hasResults: filters.hasResults,
      yearsBack: timeRange.yearsBack || 5,
      sinceDate: timeRange.sinceDate || null,
      searchRelated: filters.searchRelated,
      fetchAll: fetchAll,
      pageSize: pageSize,
      status: filters.status
    };

    // Build advanced query for complex filters
    let advancedQuery = [];

    // Add study phases
    if (phases && phases.length > 0) {
      const phaseQuery = phases.map(phase => `AREA[Phase]${phase}`).join(' OR ');
      advancedQuery.push(`(${phaseQuery})`);
    }

    // Add study types  
    if (studyTypes && studyTypes.length > 0) {
      const typeQuery = studyTypes.map(type => `AREA[StudyType]${type}`).join(' OR ');
      advancedQuery.push(`(${typeQuery})`);
    }

    // Add enrollment criteria
    if (enrollment.min || enrollment.max) {
      if (enrollment.min && enrollment.max) {
        advancedQuery.push(`AREA[EnrollmentCount]RANGE[${enrollment.min},${enrollment.max}]`);
      } else if (enrollment.min) {
        advancedQuery.push(`AREA[EnrollmentCount]RANGE[${enrollment.min},MAX]`);
      } else if (enrollment.max) {
        advancedQuery.push(`AREA[EnrollmentCount]RANGE[MIN,${enrollment.max}]`);
      }
    }

    // Add geographical filters
    if (geography.countries && geography.countries.length > 0) {
      const countryQuery = geography.countries.map(country => `AREA[LocationCountry]${country}`).join(' OR ');
      advancedQuery.push(`(${countryQuery})`);
    }

    // Add sponsor filters
    if (sponsor.type) {
      advancedQuery.push(`AREA[LeadSponsorClass]${sponsor.type}`);
    }
    if (sponsor.name) {
      advancedQuery.push(`AREA[LeadSponsorName]${sponsor.name}`);
    }

    // Combine advanced query parts
    if (advancedQuery.length > 0) {
      // Combine with existing date filters if they exist
      const existingAdvanced = searchParams.advanced || '';
      searchParams.advanced = existingAdvanced ? 
        `(${existingAdvanced}) AND (${advancedQuery.join(' AND ')})` : 
        advancedQuery.join(' AND ');
    }

    console.log('Final search parameters for fetchClinicalTrials:', searchParams);

    // Use the existing fetchClinicalTrials function
    const searchResults = await fetchClinicalTrials(searchParams);

    // Return the results in the expected format
    res.json(searchResults);

  } catch (error) {
    console.error("Advanced clinical trials search error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: { studies: [], totalCount: 0 }
    });
  }
});

// ==========================================
// BACKEND: PubMed Advanced Search API (clinicaltrials.js)
// ==========================================

// Add this to your clinicaltrials.js backend file

// PubMed E-utilities API constants
const PUBMED_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_API_KEY = process.env.NCBI_API_KEY || ''; // Optional: Add your API key

/**
 * Advanced PubMed Search Endpoint
 * POST /api/pubmed/advanced-search
 */
// app.post('/api/pubmed/advanced-search', async (req, res) => {
//   try {
//     console.log('🔍 PubMed: Advanced search request received');
    
//     const {
//       term,
//       db = 'pubmed',
//       retmode = 'json',
//       rettype = 'abstract',
//       retmax = 100,
//       retstart = 0,
//       sort = 'relevance',
//       filters = {}
//     } = req.body;

//     console.log('🔍 PubMed: Search parameters:', {
//       term: term,
//       retmax: retmax,
//       sort: sort,
//       filtersCount: Object.keys(filters).length
//     });

//     if (!term || term.trim() === '') {
//       return res.status(400).json({
//         success: false,
//         error: 'Search term is required for PubMed search',
//         data: { articles: [], totalCount: 0 }
//       });
//     }

//     // Step 1: Search for article IDs using esearch (this returns JSON correctly)
//     const searchParams = new URLSearchParams({
//       db: db,
//       term: term.trim(),
//       retmax: retmax.toString(),
//       retstart: retstart.toString(),
//       retmode: 'json',  // This works for esearch
//       sort: sort
//     });

//     if (process.env.NCBI_API_KEY) {
//       searchParams.append('api_key', process.env.NCBI_API_KEY);
//     }

//     console.log('🔍 PubMed: Step 1 - Searching for article IDs...');
//     const searchUrl = `${PUBMED_EUTILS_BASE}/esearch.fcgi?${searchParams.toString()}`;
//     console.log('🔍 Search URL:', searchUrl);
    
//     const searchResponse = await fetch(searchUrl, {
//       headers: {
//         'Accept': 'application/json',
//         'User-Agent': 'Clinical-Research-Tool/1.0'
//       },
//       timeout: 10000
//     });
    
//     if (!searchResponse.ok) {
//       throw new Error(`PubMed esearch API error: ${searchResponse.status} ${searchResponse.statusText}`);
//     }
    
//     const searchData = await searchResponse.json();
//     console.log('🔍 PubMed: Search response:', searchData);
    
//     const idList = searchData.esearchresult?.idlist || [];
//     const totalCount = parseInt(searchData.esearchresult?.count || 0);
    
//     console.log(`🔍 PubMed: Found ${idList.length} article IDs, total count: ${totalCount}`);
    
//     if (idList.length === 0) {
//       return res.json({
//         success: true,
//         data: {
//           articles: [],
//           totalCount: 0
//         }
//       });
//     }

//     // Step 2: Fetch article details using esummary (NOT efetch for JSON)
//     // ❌ WRONG: Using efetch with retmode=json (doesn't work reliably)
//     // ✅ CORRECT: Using esummary with retmode=json (always works)
    
//     const detailsParams = new URLSearchParams({
//       db: 'pubmed',
//       id: idList.join(','),
//       retmode: 'json'  // esummary supports JSON mode properly
//     });

//     if (process.env.NCBI_API_KEY) {
//       detailsParams.append('api_key', process.env.NCBI_API_KEY);
//     }

//     console.log('🔍 PubMed: Step 2 - Fetching article details...');
//     const detailsUrl = `${PUBMED_EUTILS_BASE}/esummary.fcgi?${detailsParams.toString()}`;
//     console.log('🔍 Details URL:', detailsUrl);
    
//     const detailsResponse = await fetch(detailsUrl, {
//       headers: {
//         'Accept': 'application/json',
//         'User-Agent': 'Clinical-Research-Tool/1.0'
//       },
//       timeout: 10000
//     });
    
//     if (!detailsResponse.ok) {
//       throw new Error(`PubMed esummary API error: ${detailsResponse.status} ${detailsResponse.statusText}`);
//     }
    
//     const detailsData = await detailsResponse.json();
//     console.log('🔍 PubMed: Details response received');
    
//     // Step 3: Format articles from esummary data
//     const articles = [];
    
//     idList.forEach(pmid => {
//       const summary = detailsData.result?.[pmid];
      
//       if (summary && summary.title) {
//         const article = formatPubMedSummary(summary, pmid);
//         articles.push(article);
//       }
//     });

//     console.log(`✅ PubMed: Formatted ${articles.length} articles`);

//     // Return in the exact format your frontend expects
//     res.json({
//       success: true,
//       data: {
//         articles: articles,
//         totalCount: totalCount
//       }
//     });

//   } catch (error) {
//     console.error("❌ PubMed: Advanced search error:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message,
//       data: { articles: [], totalCount: 0 }
//     });
//   }
// });

// Helper function to format PubMed summary data

// app.post('/api/pubmed/advanced-search', async (req, res) => {
//   try {
//     console.log('🔍 PubMed: Advanced search request received');
    
//     const {
//       term,
//       db = 'pubmed',
//       retmode = 'json',
//       rettype = 'abstract',
//       retmax = 100,
//       retstart = 0,
//       sort = 'relevance',
//       filters = {}
//     } = req.body;

//     console.log('🔍 PubMed: Search parameters:', {
//       term: term,
//       retmax: retmax,
//       retstart: retstart,
//       sort: sort,
//       filters: filters
//     });

//     // Validate required parameters
//     if (!term || term.trim() === '') {
//       return res.status(400).json({
//         success: false,
//         error: 'Search term is required',
//         data: { articles: [], totalCount: 0 }
//       });
//     }

//     // Step 1: Search for article IDs using esearch
//     const searchParams = new URLSearchParams({
//       db: db,
//       term: term.trim(),
//       retmax: retmax.toString(),
//       retstart: retstart.toString(),
//       retmode: 'json',
//       sort: sort === 'date' ? 'pub_date' : sort,
//       datetype: 'pdat'
//     });

//     // Add API key if available
//     if (NCBI_API_KEY) {
//       searchParams.append('api_key', NCBI_API_KEY);
//     }

//     console.log('🔍 PubMed: Step 1 - Searching for article IDs...');
//     const searchUrl = `${PUBMED_EUTILS_BASE}/esearch.fcgi?${searchParams.toString()}`;
    
//     try {
//       const searchResponse = await axios.get(searchUrl, {
//         headers: {
//           'Accept': 'application/json',
//           'User-Agent': 'Clinical-Research-Tool/1.0'
//         },
//         timeout: 15000 // 15 second timeout
//       });
      
//       const searchData = searchResponse.data;
//       const idList = searchData.esearchresult?.idlist || [];
//       const totalCount = parseInt(searchData.esearchresult?.count || 0);
      
//       console.log(`🔍 PubMed: Found ${idList.length} IDs out of ${totalCount} total`);

//       if (idList.length === 0) {
//         return res.json({
//           success: true,
//           data: {
//             articles: [],
//             totalCount: 0
//           }
//         });
//       }

//       // Step 2: Fetch article summaries using esummary
//       console.log('🔍 PubMed: Step 2 - Fetching article summaries...');
//       const summaryParams = new URLSearchParams({
//         db: db,
//         id: idList.join(','),
//         retmode: 'json'
//       });

//       if (NCBI_API_KEY) {
//         summaryParams.append('api_key', NCBI_API_KEY);
//       }

//       const summaryUrl = `${PUBMED_EUTILS_BASE}/esummary.fcgi?${summaryParams.toString()}`;
      
//       const summaryResponse = await axios.get(summaryUrl, {
//         headers: {
//           'Accept': 'application/json',
//           'User-Agent': 'Clinical-Research-Tool/1.0'
//         },
//         timeout: 20000 // 20 second timeout
//       });

//       const summaryData = summaryResponse.data.result || {};
      
//       // Step 3: Fetch full abstracts in smaller batches to avoid timeouts
//       console.log('🔍 PubMed: Step 3 - Fetching full abstracts...');
//       const abstracts = {};
//       const batchSize = 20; // Process 20 articles at a time
      
//       for (let i = 0; i < idList.length; i += batchSize) {
//         const batchIds = idList.slice(i, i + batchSize);
//         console.log(`🔍 PubMed: Fetching abstracts for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(idList.length/batchSize)}`);
        
//         try {
//           const abstractParams = new URLSearchParams({
//             db: db,
//             id: batchIds.join(','),
//             rettype: 'abstract',
//             retmode: 'xml'
//           });

//           if (NCBI_API_KEY) {
//             abstractParams.append('api_key', NCBI_API_KEY);
//           }

//           const abstractUrl = `${PUBMED_EUTILS_BASE}/efetch.fcgi?${abstractParams.toString()}`;
          
//           const abstractResponse = await axios.get(abstractUrl, {
//             headers: {
//               'Accept': 'application/xml',
//               'User-Agent': 'Clinical-Research-Tool/1.0'
//             },
//             timeout: 30000 // 30 second timeout per batch
//           });

//           // Parse XML abstracts
//           try {
//             const parsedXML = await parseXML(abstractResponse.data, {
//               explicitArray: false,
//               ignoreAttrs: true
//             });
            
//             const pubmedArticles = parsedXML.PubmedArticleSet?.PubmedArticle || [];
//             const articlesArray = Array.isArray(pubmedArticles) ? pubmedArticles : [pubmedArticles];
            
//             articlesArray.forEach(article => {
//               try {
//                 const pmid = article.MedlineCitation?.PMID;
                
//                 if (pmid) {
//                   // Extract abstract text
//                   const abstractObj = article.MedlineCitation?.Article?.Abstract;
//                   let fullAbstract = '';
                  
//                   if (abstractObj?.AbstractText) {
//                     if (Array.isArray(abstractObj.AbstractText)) {
//                       // Structured abstract with multiple sections
//                       fullAbstract = abstractObj.AbstractText
//                         .map(section => {
//                           if (typeof section === 'string') {
//                             return section;
//                           } else if (section._) {
//                             // Handle labeled sections
//                             const label = section.$.Label || '';
//                             return label ? `${label}: ${section._}` : section._;
//                           }
//                           return '';
//                         })
//                         .filter(text => text)
//                         .join(' ');
//                     } else {
//                       // Simple abstract
//                       fullAbstract = abstractObj.AbstractText;
//                     }
//                   }
                  
//                   abstracts[pmid] = fullAbstract;
                  
//                   // Extract keywords (MeSH terms)
//                   const meshHeadings = article.MedlineCitation?.MeshHeadingList?.MeshHeading;
//                   if (meshHeadings) {
//                     const keywords = (Array.isArray(meshHeadings) ? meshHeadings : [meshHeadings])
//                       .map(heading => heading.DescriptorName?._)
//                       .filter(Boolean);
                    
//                     if (summaryData[pmid]) {
//                       summaryData[pmid].keywords = keywords;
//                     }
//                   }
//                 }
//               } catch (articleError) {
//                 console.error(`Error processing article: ${articleError.message}`);
//               }
//             });
//           } catch (parseError) {
//             console.error(`Error parsing XML for batch: ${parseError.message}`);
//             // Continue with partial results
//           }
          
//           // Add a small delay between batches to avoid rate limiting
//           if (i + batchSize < idList.length) {
//             await new Promise(resolve => setTimeout(resolve, 100));
//           }
          
//         } catch (batchError) {
//           console.error(`Error fetching abstract batch: ${batchError.message}`);
//           // Continue with other batches
//         }
//       }
      
//       console.log(`✅ PubMed: Extracted abstracts for ${Object.keys(abstracts).length} articles`);

//       // Step 4: Format articles with both summary and abstract data
//       const articles = [];
      
//       idList.forEach(pmid => {
//         try {
//           const summary = summaryData[pmid];
          
//           if (summary && summary.title) {
//             const article = formatPubMedArticle(summary, pmid, abstracts[pmid] || '');
//             if (article) {
//               articles.push(article);
//             }
//           }
//         } catch (formatError) {
//           console.error(`Error formatting article ${pmid}: ${formatError.message}`);
//         }
//       });

//       console.log(`✅ PubMed: Successfully formatted ${articles.length} articles`);

//       // Return results
//       res.json({
//         success: true,
//         data: {
//           articles: articles,
//           totalCount: totalCount,
//           hasMore: totalCount > (retstart + retmax),
//           nextStart: retstart + retmax
//         }
//       });

//     } catch (apiError) {
//       console.error('❌ PubMed API Error:', apiError.message);
      
//       // Check if it's a rate limit error
//       if (apiError.response?.status === 429) {
//         return res.status(429).json({
//           success: false,
//           error: 'Rate limit exceeded. Please try again in a few seconds.',
//           data: { articles: [], totalCount: 0 }
//         });
//       }
      
//       throw apiError;
//     }

//   } catch (error) {
//     console.error('❌ PubMed: Advanced search error:', error);
    
//     // Log more details for debugging
//     if (error.response) {
//       console.error('Response status:', error.response.status);
//       console.error('Response data:', error.response.data);
//     }
    
//     res.status(500).json({
//       success: false,
//       error: error.message || 'An error occurred while searching PubMed',
//       data: { articles: [], totalCount: 0 }
//     });
//   }
// });



app.post('/api/pubmed/advanced-search', async (req, res) => {
  try {
    const { term, retmax = 20, sort = 'relevance' } = req.body;
    
    if (!term) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    console.log(`🔍 PubMed: Searching for: ${term}`);

    // Step 1: Search for article IDs using esearch
    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: term,
      retmax: retmax,
      retmode: 'json',
      sort: sort
    });

    if (process.env.NCBI_API_KEY) {
      searchParams.append('api_key', process.env.NCBI_API_KEY);
    }

    const searchUrl = `${PUBMED_EUTILS_BASE}/esearch.fcgi?${searchParams.toString()}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`PubMed search failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const idList = searchData.esearchresult.idlist || [];
    const totalCount = parseInt(searchData.esearchresult.count) || 0;

    console.log(`🔍 PubMed: Found ${idList.length} article IDs, total count: ${totalCount}`);
    
    if (idList.length === 0) {
      return res.json({
        success: true,
        data: {
          articles: [],
          totalCount: 0
        }
      });
    }

    // Step 2: Get basic details using esummary
    const detailsParams = new URLSearchParams({
      db: 'pubmed',
      id: idList.join(','),
      retmode: 'json'
    });

    if (process.env.NCBI_API_KEY) {
      detailsParams.append('api_key', process.env.NCBI_API_KEY);
    }

    const detailsUrl = `${PUBMED_EUTILS_BASE}/esummary.fcgi?${detailsParams.toString()}`;
    const detailsResponse = await fetch(detailsUrl);
    
    if (!detailsResponse.ok) {
      throw new Error(`PubMed details fetch failed: ${detailsResponse.status}`);
    }
    
    const detailsData = await detailsResponse.json();
    
    // Step 3: Fetch abstracts using efetch (XML format for abstracts)
    const abstractParams = new URLSearchParams({
      db: 'pubmed',
      id: idList.join(','),
      rettype: 'abstract',
      retmode: 'xml'
    });

    if (process.env.NCBI_API_KEY) {
      abstractParams.append('api_key', process.env.NCBI_API_KEY);
    }

    const abstractUrl = `${PUBMED_EUTILS_BASE}/efetch.fcgi?${abstractParams.toString()}`;
    const abstractResponse = await fetch(abstractUrl);
    
    if (!abstractResponse.ok) {
      console.warn(`PubMed abstracts fetch failed: ${abstractResponse.status}`);
      // Continue without abstracts rather than failing completely
    }
    
    let abstractsData = {};
    if (abstractResponse.ok) {
      const xmlData = await abstractResponse.text();
      abstractsData = await parseAbstractXML(xmlData);
    }

    // Step 4: Format articles with abstracts
    const articles = [];
    
    idList.forEach(pmid => {
      const summary = detailsData.result?.[pmid];
      
      if (summary && summary.title) {
        const article = formatPubMedSummaryWithAbstract(summary, pmid, abstractsData[pmid]);
        articles.push(article);
      }
    });

    console.log(`✅ PubMed: Formatted ${articles.length} articles with abstracts`);

    // Return in the exact format your frontend expects
    res.json({
      success: true,
      data: {
        articles: articles,
        totalCount: totalCount
      }
    });

  } catch (error) {
    console.error("❌ PubMed: Advanced search error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: { articles: [], totalCount: 0 }
    });
  }
});

// Helper function to parse XML abstracts
async function parseAbstractXML(xmlData) {
  const xml2js = require('xml2js');
  const parser = new xml2js.Parser();
  
  try {
    const result = await parser.parseStringPromise(xmlData);
    const abstracts = {};
    
    const articles = result.PubmedArticleSet?.PubmedArticle || [];
    
    articles.forEach(article => {
      const pmid = article.MedlineCitation?.[0]?.PMID?.[0]._ || article.MedlineCitation?.[0]?.PMID?.[0];
      const abstractSections = article.MedlineCitation?.[0]?.Article?.[0]?.Abstract?.[0]?.AbstractText || [];
      
      if (pmid && abstractSections.length > 0) {
        // Join all abstract sections
        const abstractText = abstractSections.map(section => {
          // Handle structured abstracts with labels
          if (section.$ && section.$.Label) {
            return `${section.$.Label}: ${section._}`;
          }
          // Handle plain text abstracts
          return typeof section === 'string' ? section : (section._ || section);
        }).join(' ');
        
        abstracts[pmid] = abstractText;
      }
    });
    
    return abstracts;
  } catch (error) {
    console.error('Error parsing abstract XML:', error);
    return {};
  }
}

// Updated helper function to format PubMed summary data WITH abstracts
function formatPubMedSummaryWithAbstract(summary, pmid, abstract) {
  try {
    // Extract authors
    const authors = (summary.authors || [])
      .filter(author => author.authtype === 'Author')
      .map(author => author.name || '')
      .slice(0, 5);

    // Extract publication date
    const pubDate = summary.pubdate || summary.epubdate || '';

    // Extract journal name
    const journal = summary.source || summary.fulljournalname || '';

    // Extract title
    const title = summary.title || 'Untitled';

    // Extract DOI
    const articleIds = summary.articleids || [];
    const doi = articleIds.find(id => id.idtype === 'doi')?.value || '';
    
    // Extract PMCID if available
    const pmcId = articleIds.find(id => id.idtype === 'pmc')?.value || '';

    return {
      pmid: pmid,
      title: title,
      authors: authors,
      journal: journal,
      pubDate: pubDate,
      abstract: abstract || 'No abstract available', // NOW WE HAVE REAL ABSTRACTS!
      keywords: summary.keywords || [],
      doi: doi,
      pmcId: pmcId,
      citationCount: summary.pmc_refcount || 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      fullTextUrl: pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : '',
      isOpenAccess: !!pmcId,
      publicationType: summary.pubtype || [],
      volume: summary.volume || '',
      issue: summary.issue || '',
      pages: summary.pages || '',
      language: summary.lang || ['eng']
    };

  } catch (error) {
    console.error(`Error formatting article ${pmid}:`, error);
    return {
      pmid: pmid,
      title: 'Error loading article',
      authors: [],
      journal: '',
      pubDate: '',
      abstract: 'Error loading abstract',
      keywords: [],
      doi: '',
      citationCount: 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    };
  }
}
function formatPubMedArticle(summary, pmid, fullAbstract) {
  try {
    // Extract authors safely
    const authors = [];
    if (summary.authors && Array.isArray(summary.authors)) {
      summary.authors.forEach(author => {
        if (author.name) {
          authors.push(author.name);
        }
      });
    }
    
    // Limit authors to first 10
    const limitedAuthors = authors.slice(0, 10);

    // Extract publication date
    const pubDate = summary.pubdate || summary.epubdate || summary.sortpubdate || '';

    // Extract journal name
    const journal = summary.source || summary.fulljournalname || '';

    // Extract title
    const title = summary.title || 'Untitled';

    // Extract identifiers
    const articleIds = summary.articleids || [];
    const doi = articleIds.find(id => id.idtype === 'doi')?.value || '';
    const pmcId = articleIds.find(id => id.idtype === 'pmc')?.value || '';

    // Build the article object
    return {
      pmid: pmid,
      title: title,
      authors: limitedAuthors,
      journal: journal,
      pubDate: pubDate,
      abstract: fullAbstract || summary.abstract || '',
      keywords: summary.keywords || [],
      doi: doi,
      pmcId: pmcId,
      citationCount: summary.pmcrefcount || 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      fullTextUrl: pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : '',
      isOpenAccess: !!pmcId,
      meshTerms: summary.keywords || []
    };
  } catch (error) {
    console.error(`Error formatting article ${pmid}:`, error);
    return null;
  }
}


function formatPubMedSummary(summary, pmid) {
  try {
    // Extract authors
    const authors = (summary.authors || [])
      .filter(author => author.authtype === 'Author')
      .map(author => author.name || '')
      .slice(0, 5); // Limit to first 5 authors

    // Extract publication date
    const pubDate = summary.pubdate || summary.epubdate || '';

    // Extract journal name
    const journal = summary.source || summary.fulljournalname || '';

    // Extract title
    const title = summary.title || 'Untitled';

    // Extract DOI
    const articleIds = summary.articleids || [];
    const doi = articleIds.find(id => id.idtype === 'doi')?.value || '';
    
    // Extract PMCID if available
    const pmcId = articleIds.find(id => id.idtype === 'pmc')?.value || '';

    return {
      pmid: pmid,
      title: title,
      authors: authors,
      journal: journal,
      pubDate: pubDate,
      abstract: summary.abstract || '', // Basic abstract from summary
      keywords: summary.keywords || [],
      doi: doi,
      pmcId: pmcId,
      citationCount: summary.pmc_refcount || 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      fullTextUrl: pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : '',
      isOpenAccess: !!pmcId,
      publicationType: summary.pubtype || [],
      volume: summary.volume || '',
      issue: summary.issue || '',
      pages: summary.pages || '',
      language: summary.lang || ['eng']
    };

  } catch (error) {
    console.error(`Error formatting article ${pmid}:`, error);
    return {
      pmid: pmid,
      title: 'Error loading article',
      authors: [],
      journal: '',
      pubDate: '',
      abstract: '',
      keywords: [],
      doi: '',
      citationCount: 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    };
  }
}

// Optional: If you need full abstracts, add this separate endpoint
app.get('/api/pubmed/abstract/:pmid', async (req, res) => {
  try {
    const pmid = req.params.pmid;
    
    // Use efetch for getting full abstract (in XML format)
    const params = new URLSearchParams({
      db: 'pubmed',
      id: pmid,
      rettype: 'abstract',
      retmode: 'xml'  // Use XML for efetch
    });

    if (process.env.NCBI_API_KEY) {
      params.append('api_key', process.env.NCBI_API_KEY);
    }

    const url = `${PUBMED_EUTILS_BASE}/efetch.fcgi?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlData = await response.text();
    
    // Parse XML to extract abstract (you'll need xml2js or similar)
    // For now, return raw XML or implement XML parsing
    
    res.json({
      success: true,
      pmid: pmid,
      abstractXml: xmlData
    });
    
  } catch (error) {
    console.error(`Error fetching abstract for ${req.params.pmid}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Extract and format author names
 */
function extractAuthors(authorsData) {
  if (!authorsData || !Array.isArray(authorsData)) {
    return ['Unknown'];
  }
  
  return authorsData.map(author => {
    if (typeof author === 'string') {
      return author;
    } else if (author.name) {
      return author.name;
    } else {
      return 'Unknown Author';
    }
  }).filter(name => name !== 'Unknown Author').slice(0, 10); // Limit to 10 authors
}

/**
 * Format publication date
 */
function formatPubDate(pubdate) {
  if (!pubdate) return 'Unknown';
  
  try {
    // PubMed dates can be in various formats
    if (pubdate.includes(' ')) {
      // Format: "2023 Jan 15" or "2023 Jan"
      return pubdate;
    } else if (pubdate.length === 4) {
      // Format: "2023"
      return pubdate;
    } else {
      // Try to parse as date
      const date = new Date(pubdate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
    
    return pubdate;
  } catch (error) {
    return pubdate || 'Unknown';
  }
}

/**
 * Extract DOI from article data
 */
function extractDOI(elocationid, articleids) {
  // Check elocationid first
  if (elocationid && elocationid.includes('doi:')) {
    return elocationid.replace('doi:', '').trim();
  }
  
  // Check articleids array
  if (articleids && Array.isArray(articleids)) {
    for (const id of articleids) {
      if (id.idtype === 'doi') {
        return id.value;
      }
    }
  }
  
  return '';
}

/**
 * Extract publication type
 */
function extractPublicationType(pubtype) {
  if (!pubtype || !Array.isArray(pubtype)) {
    return 'Article';
  }
  
  // Return the first non-generic publication type
  const genericTypes = ['Journal Article', 'Article'];
  const specificType = pubtype.find(type => !genericTypes.includes(type));
  
  return specificType || pubtype[0] || 'Article';
}

/**
 * Extract language
 */
function extractLanguage(langArray) {
  if (!langArray || !Array.isArray(langArray)) {
    return 'eng';
  }
  
  return langArray[0] || 'eng';
}

/**
 * Extract keywords
 */
function extractKeywords(keywordsData) {
  if (!keywordsData || !Array.isArray(keywordsData)) {
    return [];
  }
  
  return keywordsData.slice(0, 10); // Limit to 10 keywords
}

/**
 * Check if article is open access
 */
function checkOpenAccess(articleids) {
  if (!articleids || !Array.isArray(articleids)) {
    return false;
  }
  
  // Check for PMC ID (indicates open access)
  return articleids.some(id => id.idtype === 'pmc');
}

/**
 * Extract MeSH terms
 */
function extractMeshTerms(meshData) {
  if (!meshData || !Array.isArray(meshData)) {
    return [];
  }
  
  return meshData.map(mesh => {
    if (mesh.descriptorname) {
      return mesh.descriptorname;
    }
    return null;
  }).filter(term => term !== null).slice(0, 15); // Limit to 15 MeSH terms
}

/**
 * Test endpoint for PubMed API connection
 * GET /api/test/pubmed-connection
 */
app.get('/api/test/pubmed-connection', async (req, res) => {
  try {
    console.log('🧪 Testing PubMed E-utilities API connection...');
    
    // Simple test search for "aspirin"
    const testParams = new URLSearchParams({
      db: 'pubmed',
      term: 'aspirin',
      retmax: '5',
      retmode: 'json'
    });
    
    if (NCBI_API_KEY) {
      testParams.append('api_key', NCBI_API_KEY);
    }
    
    const testUrl = `${PUBMED_EUTILS_BASE}/esearch.fcgi?${testParams.toString()}`;
    console.log('🧪 Test URL:', testUrl.replace(/api_key=[^&]*&?/, ''));
    
    const response = await axios.get(testUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Clinical-Research-Tool-Test/1.0'
      },
      timeout: 10000
    });
    
    const resultsCount = response.data.esearchresult?.count || 0;
    const pmids = response.data.esearchresult?.idlist || [];
    
    res.json({
      success: true,
      message: 'PubMed E-utilities API connection successful',
      testQuery: 'aspirin',
      resultsFound: parseInt(resultsCount, 10),
      samplePMIDs: pmids.slice(0, 3),
      apiKey: NCBI_API_KEY ? 'Configured' : 'Not configured',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🧪 PubMed test failed:', error);
    res.status(500).json({
      success: false,
      message: 'PubMed E-utilities API connection failed',
      error: error.message,
      apiKey: NCBI_API_KEY ? 'Configured' : 'Not configured',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Enhanced existing PubMed search endpoint for backward compatibility
 * GET /api/pubmed
 */
app.get('/api/pubmed', async (req, res) => {
  try {
    const term = req.query.term;
    if (!term) {
      return res.status(400).json({ 
        success: false,
        error: 'Search term is required' 
      });
    }
    
    console.log(`🔍 PubMed: Legacy search for: ${term}`);
    
    // Convert to advanced search format
    const advancedPayload = {
      term: term,
      retmax: req.query.retmax || 20,
      sort: req.query.sort || 'relevance'
    };
    
    // Forward to advanced search endpoint
    const advancedResponse = await axios.post(`http://localhost:${process.env.PORT || 3000}/api/pubmed/advanced-search`, advancedPayload);
    
    // Format response for backward compatibility
    const articles = advancedResponse.data.data?.articles || [];
    
    res.json({
      articles: articles,
      totalResults: advancedResponse.data.data?.totalCount || articles.length,
      searchTerm: term,
      legacy: true
    });
    
  } catch (error) {
    console.error('PubMed legacy API error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      articles: [],
      totalResults: 0
    });
  }
});

/**
 * Utility endpoint to get PubMed article details by PMID
 * GET /api/pubmed/article/:pmid
 */
app.get('/api/pubmed/article/:pmid', async (req, res) => {
  try {
    const pmid = req.params.pmid;
    
    if (!pmid || !/^\d+$/.test(pmid)) {
      return res.status(400).json({
        success: false,
        error: 'Valid PMID is required'
      });
    }
    
    console.log(`🔍 PubMed: Fetching article details for PMID: ${pmid}`);
    
    const summaryParams = new URLSearchParams({
      db: 'pubmed',
      id: pmid,
      retmode: 'json',
      rettype: 'abstract'
    });
    
    if (NCBI_API_KEY) {
      summaryParams.append('api_key', NCBI_API_KEY);
    }
    
    const summaryUrl = `${PUBMED_EUTILS_BASE}/esummary.fcgi?${summaryParams.toString()}`;
    
    const response = await axios.get(summaryUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Clinical-Research-Tool/1.0'
      },
      timeout: 10000
    });
    
    const articleData = response.data.result?.[pmid];
    
    if (!articleData) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    const formattedArticle = formatPubMedArticle(articleData, pmid);
    
    res.json({
      success: true,
      data: formattedArticle
    });
    
  } catch (error) {
    console.error(`Error fetching PMID ${req.params.pmid}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ BACKEND: PubMed advanced search endpoints loaded');
console.log('  - POST /api/pubmed/advanced-search (new advanced endpoint)');
console.log('  - GET /api/pubmed (legacy compatibility)');
console.log('  - GET /api/pubmed/article/:pmid (single article details)');
console.log('  - GET /api/test/pubmed-connection (connection test)');


/**
 * Advanced FDA Search
 * POST /api/advanced/fda
 */
app.post('/api/advanced/fda', async (req, res) => {
  try {
    const { queries, filters, timeline } = req.body;

    console.log('💊 Advanced FDA search initiated');

    // Build FDA-specific queries for each endpoint
    const fdaResults = await Promise.all([
      searchAdvancedFDADrugs(queries, filters),
      searchAdvancedFDALabels(queries, filters),
      searchAdvancedFDAEnforcement(queries, filters)
    ]);

    // Combine and deduplicate results
    const combinedResults = combineAndDeduplicateFDAResults(fdaResults);

    res.json({
      success: true,
      data: {
        endpoints: {
          drugsfda: fdaResults[0],
          label: fdaResults[1],
          enforcement: fdaResults[2]
        },
        combinedResults
      },
      searchConfig: { queries, filters, timeline },
      metadata: {
        searchType: 'advanced_fda',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    handleApiError(error, res);
  }
});

// Helper functions for advanced query building
function buildAdvancedClinicalTrialsQuery(queries, filters) {
  return queries.map(query => {
    const field = mapClinicalTrialsField(query.field);
    const operator = mapOperator(query.operator);
    return `${field}${operator}"${query.value}"`;
  }).join(` ${queries[0]?.connector || 'AND'} `);
}

function buildAdvancedPubMedQuery(queries, proximity) {
  let queryString = queries.map(query => {
    const field = mapPubMedField(query.field);
    return `("${query.value}"${field})`;
  }).join(` ${queries[0]?.connector || 'AND'} `);

  // Apply proximity search if configured
  if (proximity?.type === 'words') {
    queryString = applyProximitySearch(queryString, proximity.distance);
  }

  return queryString;
}

function mapClinicalTrialsField(field) {
  const fieldMap = {
    'drug': 'query.intr',
    'condition': 'query.cond',
    'intervention': 'query.intr',
    'outcome': 'query.outc',
    'sponsor': 'query.spons',
    'title': 'query.titles'
  };
  return fieldMap[field] || 'query.term';
}

function mapPubMedField(field) {
  const fieldMap = {
    '[Title]': '[Title]',
    '[Abstract]': '[Abstract]',
    '[Author]': '[Author]',
    '[MeSH Terms]': '[MeSH Terms]',
    '[All Fields]': ''
  };
  return fieldMap[field] || '';
}

/**
 * Master Advanced Search Endpoint
 * POST /api/advanced/search
 */
app.post('/api/advanced/search', async (req, res) => {
  try {
    const {
      main,              // Primary search queries
      clinicalTrials,    // CT-specific config
      pubmed,           // PubMed-specific config
      fda,              // FDA-specific config
      timeline,         // Timeline configuration
      proximity,        // Proximity settings
      aiEnhancements    // AI features
    } = req.body;

    console.log('🚀 Master advanced search initiated');

    const searchPromises = [];
    const enabledDatabases = [];

    // Execute enabled database searches in parallel
    if (clinicalTrials) {
      enabledDatabases.push('clinicalTrials');
      searchPromises.push(
        axios.post('/api/advanced/clinical-trials', {
          queries: [...main, ...clinicalTrials.queries],
          filters: clinicalTrials.filters,
          timeline,
          proximity,
          aiEnhancements
        })
      );
    }

    if (pubmed) {
      enabledDatabases.push('pubmed');
      searchPromises.push(
        axios.post('/api/advanced/pubmed', {
          queries: [...main, ...pubmed.queries],
          filters: pubmed.filters,
          timeline,
          proximity
        })
      );
    }

    if (fda) {
      enabledDatabases.push('fda');
      searchPromises.push(
        axios.post('/api/advanced/fda', {
          queries: [...main, ...fda.queries],
          filters: fda.filters,
          timeline
        })
      );
    }

    // Wait for all searches to complete
    const results = await Promise.allSettled(searchPromises);

    // Format response
    const response = {
      success: true,
      databases: {},
      summary: {
        enabledDatabases,
        searchTimestamp: new Date().toISOString(),
        totalResultsFound: 0
      }
    };

    // Process results from each database
    enabledDatabases.forEach((dbName, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        response.databases[dbName] = result.value.data;
        response.summary.totalResultsFound += (result.value.data.data?.totalCount || 0);
      } else {
        response.databases[dbName] = {
          success: false,
          error: result.reason.message
        };
      }
    });

    res.json(response);

  } catch (error) {
    console.error('Master advanced search error:', error);
    res.status(500).json({
      success: false,
      error: 'Advanced search failed',
      details: error.message
    });
  }
});
// Route for FDA 510(k) data
app.get('/api/TEG/fda/510k', async (req, res) => {
  try {
    const searchTerm = req.query.search || 'TEG 6S';
    const limit = req.query.limit || 100;
    
    const response = await axios.get(`https://api.fda.gov/device/510k.json`, {
      params: {
        search: `device_name:"${searchTerm}"`,
        limit: limit
      }
    });
    
    // Filter results to only include TEG 6S related devices
    const filteredResults = response.data.results.filter(item => 
      item.device_name && 
      item.device_name.toLowerCase().includes('teg 6s')
    );
    
    res.json({
      meta: response.data.meta,
      results: filteredResults
    });
  } catch (error) {
    console.error('Error fetching FDA data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch FDA data',
      details: error.message
    });
  }
});

// Route for PubMed data
app.get('/api/TEG/pubmed', async (req, res) => {
  try {
    const searchTerm = req.query.search || 'TEG 6S';
    const limit = req.query.limit || 100;
    
    // First, search for article IDs
    const searchResponse = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`, {
      params: {
        db: 'pubmed',
        term: searchTerm,
        retmax: limit,
        retmode: 'json',
        sort: 'relevance'
      }
    });
    
    if (!searchResponse.data.esearchresult.idlist || searchResponse.data.esearchresult.idlist.length === 0) {
      return res.json({
        esearchresult: searchResponse.data.esearchresult,
        results: []
      });
    }
    
    // Then, fetch details for those IDs
    const idList = searchResponse.data.esearchresult.idlist.join(',');
    const detailsResponse = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`, {
      params: {
        db: 'pubmed',
        id: idList,
        retmode: 'json'
      }
    });
    
    // Process and extract relevant information
    const results = Object.values(detailsResponse.data.result).filter(item => item.uid).map(item => {
      // Determine if article is related to neonates or pediatrics based on title and content
      const isNeonatal = 
        item.title.toLowerCase().includes('neonate') || 
        item.title.toLowerCase().includes('neonatal') || 
        item.title.toLowerCase().includes('premature') || 
        item.title.toLowerCase().includes('infant');
        
      const isPediatric = !isNeonatal && (
        item.title.toLowerCase().includes('pediatric') || 
        item.title.toLowerCase().includes('children') || 
        item.title.toLowerCase().includes('adolescent')
      );
      
      return {
        pmid: item.uid,
        title: item.title,
        abstract: item.abstract || 'Abstract not available',
        authors: (item.authors || []).map(author => ({
          name: author.name,
          affiliation: author.affiliation || ''
        })),
        journal: item.fulljournalname || item.source,
        publication_date: item.pubdate,
        keywords: item.keywords || [],
        patient_type: isNeonatal ? 'neonatal' : (isPediatric ? 'pediatric' : 'adult')
      };
    });
    
    res.json({
      esearchresult: searchResponse.data.esearchresult,
      results
    });
  } catch (error) {
    console.error('Error fetching PubMed data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch PubMed data',
      details: error.message
    });
  }
});

// Route for PubMed neonatal data
app.get('/api/TEG/pubmed/neonatal', async (req, res) => {
  try {
    const searchTerm = req.query.search || '(TEG 6S) AND (neonate OR neonatal OR neonates OR premature OR infant OR infants)';
    const limit = req.query.limit || 100;
    
    // Use the PubMed search with neonatal-specific terms
    const searchResponse = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`, {
      params: {
        db: 'pubmed',
        term: searchTerm,
        retmax: limit,
        retmode: 'json',
        sort: 'relevance'
      }
    });
    
    if (!searchResponse.data.esearchresult.idlist || searchResponse.data.esearchresult.idlist.length === 0) {
      return res.json({
        esearchresult: searchResponse.data.esearchresult,
        results: []
      });
    }
    
    // Then, fetch details for those IDs
    const idList = searchResponse.data.esearchresult.idlist.join(',');
    const detailsResponse = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`, {
      params: {
        db: 'pubmed',
        id: idList,
        retmode: 'json'
      }
    });
    
    // Process and extract relevant information
    const results = Object.values(detailsResponse.data.result).filter(item => item.uid).map(item => {
      return {
        pmid: item.uid,
        title: item.title,
        abstract: item.abstract || 'Abstract not available',
        authors: (item.authors || []).map(author => ({
          name: author.name,
          affiliation: author.affiliation || ''
        })),
        journal: item.fulljournalname || item.source,
        publication_date: item.pubdate,
        keywords: item.keywords || [],
        patient_type: 'neonatal'
      };
    });
    
    res.json({
      esearchresult: searchResponse.data.esearchresult,
      results
    });
  } catch (error) {
    console.error('Error fetching PubMed neonatal data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch PubMed neonatal data',
      details: error.message
    });
  }
});

// Route for clinical trials data
app.get('/api/TEG/clinical-trials', async (req, res) => {
  try {
    const searchTerm = req.query.search || 'TEG 6S';
    const limit = req.query.limit || 100;
    
    // Use the ClinicalTrials.gov API
    const response = await axios.get(`https://clinicaltrials.gov/api/query/study_fields`, {
      params: {
        expr: searchTerm,
        fields: 'NCTId,BriefTitle,OfficialTitle,OverallStatus,StudyType,Condition,Intervention,StartDate,CompletionDate,EnrollmentCount,LocationCountry,EligibilityCriteria,MinimumAge,MaximumAge,Sponsor',
        fmt: 'json',
        max_rnk: limit
      }
    });
    
    if (!response.data.StudyFieldsResponse.StudyFields || response.data.StudyFieldsResponse.StudyFields.length === 0) {
      return res.json({
        results: []
      });
    }
    
    // Process and extract relevant information
    const results = response.data.StudyFieldsResponse.StudyFields.map(study => {
      // Determine age groups based on MinimumAge and MaximumAge
      const ageGroups = [];
      
      const minAge = study.MinimumAge[0] || '';
      const maxAge = study.MaximumAge[0] || '';
      
      if (minAge.includes('newborn') || minAge.includes('0 days') || minAge.includes('0 month')) {
        ageGroups.push('Newborn');
      }
      
      if (minAge.includes('month') || (parseInt(minAge) < 2 && minAge.includes('year'))) {
        ageGroups.push('Infant');
      }
      
      if ((parseInt(minAge) >= 2 && parseInt(minAge) <= 12 && minAge.includes('year')) || 
          (parseInt(maxAge) >= 2 && parseInt(maxAge) <= 12 && maxAge.includes('year'))) {
        ageGroups.push('Child');
      }
      
      if ((parseInt(minAge) >= 13 && parseInt(minAge) <= 17 && minAge.includes('year')) || 
          (parseInt(maxAge) >= 13 && parseInt(maxAge) <= 17 && maxAge.includes('year'))) {
        ageGroups.push('Adolescent');
      }
      
      if ((parseInt(minAge) >= 18 && parseInt(minAge) <= 64 && minAge.includes('year')) || 
          (parseInt(maxAge) >= 18 && parseInt(maxAge) <= 64 && maxAge.includes('year'))) {
        ageGroups.push('Adult');
      }
      
      if ((parseInt(minAge) >= 65 && minAge.includes('year')) || 
          (parseInt(maxAge) >= 65 && maxAge.includes('year'))) {
        ageGroups.push('Older Adult');
      }
      
      if (ageGroups.length === 0) {
        ageGroups.push('Not Specified');
      }
      
      // Determine patient type
      let patientType = 'Adult';
      if (ageGroups.includes('Newborn') || ageGroups.includes('Infant')) {
        patientType = 'Neonatal';
      } else if (ageGroups.includes('Child') || ageGroups.includes('Adolescent')) {
        patientType = 'Pediatric';
      }
      
      return {
        nct_id: study.NCTId[0],
        title: study.BriefTitle[0] || study.OfficialTitle[0] || 'Untitled',
        status: study.OverallStatus[0] || 'Unknown',
        study_type: study.StudyType[0] || 'Unknown',
        conditions: study.Condition || [],
        interventions: study.Intervention || [],
        sponsors: study.Sponsor || [],
        start_date: study.StartDate[0] || 'Unknown',
        completion_date: study.CompletionDate[0] || 'Unknown',
        enrollment: study.EnrollmentCount[0] || 0,
        url: `https://clinicaltrials.gov/study/${study.NCTId[0]}`,
        age_groups: ageGroups,
        patient_type: patientType
      };
    });
    
    // Filter results to only include TEG 6S related trials
    const filteredResults = results.filter(item => 
      item.title.toLowerCase().includes('teg 6s') || 
      item.interventions.some(intervention => 
        intervention.toLowerCase().includes('teg 6s') || 
        intervention.toLowerCase().includes('thromboelastography')
      )
    );
    
    res.json({
      results: filteredResults
    });
  } catch (error) {
    console.error('Error fetching clinical trials data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch clinical trials data',
      details: error.message
    });
  }
});

// Route for clinical trials neonatal data
app.get('/api/TEG/clinical-trials/neonatal', async (req, res) => {
  try {
    const searchTerm = req.query.search || '(TEG 6S) AND (neonate OR neonatal OR neonates OR premature OR infant OR infants)';
    const limit = req.query.limit || 100;
    
    const response = await axios.get(`https://clinicaltrials.gov/api/query/study_fields`, {
      params: {
        expr: searchTerm,
        fields: 'NCTId,BriefTitle,OfficialTitle,OverallStatus,StudyType,Condition,Intervention,StartDate,CompletionDate,EnrollmentCount,LocationCountry,EligibilityCriteria,MinimumAge,MaximumAge,Sponsor',
        fmt: 'json',
        max_rnk: limit
      }
    });
    
    if (!response.data.StudyFieldsResponse.StudyFields || response.data.StudyFieldsResponse.StudyFields.length === 0) {
      return res.json({
        results: []
      });
    }
    
    // Process trials similar to the clinical trials endpoint, but only include neonatal studies
    const allResults = response.data.StudyFieldsResponse.StudyFields.map(study => {
      // Similar processing to the clinical trials endpoint...
      const ageGroups = [];
      
      const minAge = study.MinimumAge[0] || '';
      const maxAge = study.MaximumAge[0] || '';
      
      if (minAge.includes('newborn') || minAge.includes('0 days') || minAge.includes('0 month')) {
        ageGroups.push('Newborn');
      }
      
      if (minAge.includes('month') || (parseInt(minAge) < 2 && minAge.includes('year'))) {
        ageGroups.push('Infant');
      }
      
      // Other age groups...
      
      return {
        nct_id: study.NCTId[0],
        title: study.BriefTitle[0] || study.OfficialTitle[0] || 'Untitled',
        status: study.OverallStatus[0] || 'Unknown',
        study_type: study.StudyType[0] || 'Unknown',
        conditions: study.Condition || [],
        interventions: study.Intervention || [],
        sponsors: study.Sponsor || [],
        start_date: study.StartDate[0] || 'Unknown',
        completion_date: study.CompletionDate[0] || 'Unknown',
        enrollment: study.EnrollmentCount[0] || 0,
        url: `https://clinicaltrials.gov/study/${study.NCTId[0]}`,
        age_groups: ageGroups,
        patient_type: ageGroups.includes('Newborn') || ageGroups.includes('Infant') ? 'Neonatal' : 'Other'
      };
    });
    
    // Filter for neonatal studies and TEG 6S
    const filteredResults = allResults.filter(item => 
      (item.patient_type === 'Neonatal' || 
       item.title.toLowerCase().includes('neonate') || 
       item.title.toLowerCase().includes('neonatal') || 
       item.title.toLowerCase().includes('premature') || 
       item.title.toLowerCase().includes('infant')) && 
      (item.title.toLowerCase().includes('teg 6s') || 
       item.interventions.some(intervention => 
         intervention.toLowerCase().includes('teg 6s') || 
         intervention.toLowerCase().includes('thromboelastography')
       ))
    );
    
    res.json({
      results: filteredResults
    });
  } catch (error) {
    console.error('Error fetching clinical trials neonatal data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch clinical trials neonatal data',
      details: error.message
    });
  }
});

// Route for AI insights
app.post('/api/TEG/ai/insights', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        error: 'No question provided'
      });
    }
    
    // Build prompt for Grok
    const prompt = `Based on the latest medical research, please provide insights on the following question about the TEG 6S hemostasis system: "${question}"\n\nFocus specifically on neonatal applications and citrated blood samples where relevant. Structure your response with:\n1. Key Insights (technical analysis)\n2. Summary (practical implications)\n3. Clinical Recommendations (actionable advice)`;
    
    // Call Grok API
    const response = await grokAPI.post('/chat/completions', {
      model: "grok-1", // Use Grok's model
      messages: [
        { role: "system", content: "You are a medical research assistant with expertise in hematology and diagnostic devices." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    // Parse response - Grok uses a different structure compared to OpenAI's completion API
    // We're assuming Grok returns a structure similar to ChatGPT with message content
    const completionText = response.data.choices[0].message.content.trim();
    
    // Split into sections
    const insights = completionText.split("Summary")[0].replace("Key Insights", "").trim();
    const summary = completionText.split("Summary")[1].split("Clinical Recommendations")[0].trim();
    const recommendations = completionText
      .split("Clinical Recommendations")[1]
      .trim()
      .split("\n")
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, "").trim());
    
    res.json({
      insights,
      summary,
      recommendations
    });
  } catch (error) {
    console.error('Error generating AI insights:', error.message);
    res.status(500).json({
      error: 'Failed to generate AI insights',
      details: error.message
    });
  }
});

// Route for AI summary of selected items
app.post('/api/TEG/ai/summary', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'No items provided for summarization'
      });
    }
    
    // Build prompt for Grok
    let prompt = `Please provide a comprehensive summary of the following research items related to the TEG 6S hemostasis system:\n\n`;
    
    // Add FDA items
    const fdaItems = items.filter(item => item.type === 'fda');
    if (fdaItems.length > 0) {
      prompt += `FDA Clearances:\n`;
      fdaItems.forEach(item => {
        prompt += `- ${item.data.device_name || 'TEG 6S Device'} (${item.data.k_number || 'No K Number'}): ${item.data.decision_description || 'No decision description'}\n`;
      });
      prompt += `\n`;
    }
    
    // Add PubMed items
    const pubmedItems = items.filter(item => item.type === 'pubmed');
    if (pubmedItems.length > 0) {
      prompt += `PubMed Articles:\n`;
      pubmedItems.forEach(item => {
        prompt += `- Title: ${item.data.title}\n`;
        prompt += `  Abstract: ${item.data.abstract}\n\n`;
      });
    }
    
    // Add Clinical Trials items
    const trialItems = items.filter(item => item.type === 'clinical-trial');
    if (trialItems.length > 0) {
      prompt += `Clinical Trials:\n`;
      trialItems.forEach(item => {
        prompt += `- Title: ${item.data.title}\n`;
        prompt += `  Status: ${item.data.status}\n`;
        prompt += `  Type: ${item.data.study_type}\n`;
        prompt += `  Conditions: ${item.data.conditions.join(', ')}\n\n`;
      });
    }
    
    prompt += `Focus specifically on neonatal applications and the use of citrated blood samples where relevant. Highlight key findings, gaps in the research, and implications for clinical practice.`;
    
    // Call Grok API
    const response = await grokAPI.post('/chat/completions', {
      model: "grok-1", // Use Grok's model
      messages: [
        { role: "system", content: "You are a medical research assistant with expertise in hematology and diagnostic devices." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    // Parse response - assuming Grok returns a structure similar to ChatGPT
    const summary = response.data.choices[0].message.content.trim();
    
    res.json({
      summary
    });
  } catch (error) {
    console.error('Error generating AI summary:', error.message);
    res.status(500).json({
      error: 'Failed to generate AI summary',
      details: error.message
    });
  }
});


app.use(pubmedRoutes);

// Record new session or update existing session
app.post('/api/tracking/track', async (req, res) => {
  try {
    const data = req.body;
    
    // Try to find existing session
    let session = await UserSession.findOne({ sessionId: data.sessionId });
    
    if (session) {
      // Update existing session
      session.timeSpent = data.timeSpent;
      session.mousePositions = [...session.mousePositions, ...data.mousePositions];
      session.clicks = [...session.clicks, ...data.clicks];
      
      if (data.scrollPositions) {
        session.scrollPositions = [...session.scrollPositions, ...data.scrollPositions];
      }
      
      if (data.scrollDepth && data.scrollDepth > session.scrollDepth) {
        session.scrollDepth = data.scrollDepth;
      }
      
      if (data.isFinal) {
        session.isFinal = true;
        session.endTime = new Date();
      }
      
      await session.save();
    } else {
      // Create new session
      // Extract userId from authentication if available
      const userId = req.user ? req.user._id : null;
      
      session = new UserSession({
        sessionId: data.sessionId,
        userId,
        pageUrl: data.pageUrl,
        referrer: data.referrer,
        startTime: new Date(data.startTime),
        timeSpent: data.timeSpent,
        screenWidth: data.screenWidth,
        screenHeight: data.screenHeight,
        userAgent: data.userAgent,
        mousePositions: data.mousePositions || [],
        clicks: data.clicks || [],
        scrollPositions: data.scrollPositions || [],
        scrollDepth: data.scrollDepth || 0,
        isFinal: data.isFinal || false
      });
      
      await session.save();
    }
    
    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Error recording session data:', error);
    res.status(500).send({ success: false, error: 'Error saving tracking data' });
  }
});

// Get heatmap data for a specific page
app.get('/api/tracking/heatmap', async (req, res) => {
  try {
    const { pageUrl, startDate, endDate } = req.query;
    
    if (!pageUrl) {
      return res.status(400).send({ success: false, error: 'Page URL is required' });
    }
    
    const query = { pageUrl };
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Find relevant sessions
    const sessions = await UserSession.find(query);
    
    // Extract click data for heatmap
    const clickData = sessions.flatMap(session => 
      session.clicks.map(click => ({
        x: click.x,
        y: click.y,
        elementClicked: click.target.tagName,
        elementId: click.target.id,
        elementClass: click.target.className
      }))
    );
    
    // Extract mouse movement data
    const movementData = sessions.flatMap(session => 
      session.mousePositions.map(pos => ({
        x: pos.x,
        y: pos.y
      }))
    );
    
    // Calculate average time spent on page
    const totalSessions = sessions.length;
    const totalTimeSpent = sessions.reduce((sum, session) => sum + session.timeSpent, 0);
    const averageTimeSpent = totalSessions > 0 ? totalTimeSpent / totalSessions : 0;
    
    res.status(200).send({
      success: true,
      clickData,
      movementData,
      averageTimeSpent,
      sessionCount: totalSessions
    });
    
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).send({ success: false, error: 'Error fetching heatmap data' });
  }
});

// Get session analytics summary
app.get('api/tracking/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Get all sessions that match the criteria
    const sessions = await UserSession.find(query);
    
    // Calculate analytics
    const totalSessions = sessions.length;
    const pageViews = {};
    const deviceTypes = { desktop: 0, tablet: 0, mobile: 0 };
    let totalTimeSpent = 0;
    
    sessions.forEach(session => {
      // Count page views
      if (!pageViews[session.pageUrl]) {
        pageViews[session.pageUrl] = 0;
      }
      pageViews[session.pageUrl]++;
      
      // Count device types
      deviceTypes[session.deviceType]++;
      
      // Sum time spent
      totalTimeSpent += session.timeSpent;
    });
    
    // Sort pages by most visited
    const topPages = Object.entries(pageViews)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count);
    
    const averageTimeSpent = totalSessions > 0 ? totalTimeSpent / totalSessions : 0;
    
    res.status(200).send({
      success: true,
      totalSessions,
      topPages: topPages.slice(0, 10), // Top 10 pages
      deviceBreakdown: deviceTypes,
      averageTimePerSession: averageTimeSpent
    });
    
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).send({ success: false, error: 'Error fetching analytics data' });
  }
});



// Set cutoff date for leads (May 9, 2025)
const LEAD_CUTOFF_DATE = new Date('2025-05-09T00:00:00.000Z');

// API Routes for Users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash -salt');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -salt');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// API Routes for user statistics
app.get('/api/admin/stats/users', async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get users by subscription status
    const subscriptionStats = await User.aggregate([
      { $group: { _id: '$subscriptionStatus', count: { $sum: 1 } } }
    ]);
    
    // Get average usage
    const usageStats = await User.aggregate([
      { $group: { _id: null, avgUsage: { $avg: '$usage' }, totalUsage: { $sum: '$usage' } } }
    ]);
    
    // Get new users in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    
    // Get active users (logged in within the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } });
    
    // Get drug search statistics
    const drugSearchStats = await User.aggregate([
      { $unwind: "$activityLog" },
      { $match: { 
        "activityLog.activity": "search",
        "activityLog.details.searchType": "drug_only" 
      }},
      { $group: { 
        _id: "$activityLog.details.terms.drug", 
        count: { $sum: 1 },
        users: { $addToSet: "$_id" }
      }},
      { $project: {
        drug: "$_id",
        count: 1,
        uniqueUsers: { $size: "$users" }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get daily active users for the last 30 days
    const dailyActiveUsers = await User.aggregate([
      { $unwind: "$loginDates" },
      { $match: { loginDates: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$loginDates" } 
          }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
res.json({
  totalUsers,
  subscriptionStats,
  usageStats: usageStats[0] || { avgUsage: 0, totalUsage: 0 },
  newUsers,
  activeUsers,
  drugSearchStats,
  dailyActiveUsers,
  metrics: {
    totalUsers: "Total number of registered users in the database",
    newUsers: "Number of users who registered within the last 30 days",
    activeUsers: "Number of users who have logged in at least once in the past 7 days",
    avgUsage: "Average number of actions (API calls, searches, etc.) per user",
    totalUsage: "Sum of all usage counts across all users",
    subscriptionStats: "Distribution of users across different subscription types",
    drugSearchStats: "Most frequently searched drugs with counts and unique users"
  }
});
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// API Routes for Leads
app.get('/api/admin/leads', async (req, res) => {
  try {
    // Only return leads after the cutoff date
    const leads = await Lead.find({ createdAt: { $gte: LEAD_CUTOFF_DATE } });
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/stats/leads', async (req, res) => {
  try {
    // Only count leads after the cutoff date
    const totalLeads = await Lead.countDocuments({ createdAt: { $gte: LEAD_CUTOFF_DATE } });
    
    // Get leads by status (only after cutoff)
    const statusStats = await Lead.aggregate([
      { $match: { createdAt: { $gte: LEAD_CUTOFF_DATE } } },
      { $group: { _id: '$leadStatus', count: { $sum: 1 } } }
    ]);
    
    // Get leads by source (only after cutoff)
    const sourceStats = await Lead.aggregate([
      { $match: { createdAt: { $gte: LEAD_CUTOFF_DATE } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    // Get new leads in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newLeads = await Lead.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo, $gte: LEAD_CUTOFF_DATE } 
    });
    
    // Get leads by revenue range (only after cutoff)
    const revenueStats = await Lead.aggregate([
      { $match: { createdAt: { $gte: LEAD_CUTOFF_DATE } } },
      { $group: { _id: '$companyRevenueRange', count: { $sum: 1 } } }
    ]);
    
    // Get leads by day (last 30 days)
    const dailyLeads = await Lead.aggregate([
      { $match: { 
        createdAt: { $gte: thirtyDaysAgo, $gte: LEAD_CUTOFF_DATE } 
      }},
      { 
        $group: { 
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
  totalLeads,
  statusStats,
  sourceStats,
  newLeads,
  revenueStats,
  dailyLeads,
  metrics: {
    totalLeads: "Total number of leads captured after May 9, 2025",
    newLeads: "Number of leads captured within the last 30 days",
    statusStats: "Distribution of leads across different status categories",
    sourceStats: "Breakdown of leads by acquisition channel or source",
    revenueStats: "Distribution of leads by company revenue range"
  }
});
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// Login endpoint with tracking
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Verify password
    const isPasswordValid = User.verifyPassword(password, user.passwordHash, user.salt);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Get current date info for tracking
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const thisMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Update login tracking info
    const updates = {
      lastLogin: now,
      $inc: {} // For incrementing counters
    };
    
    // Initialize tracking arrays if they don't exist
    if (!user.loginDates) {
      updates.loginDates = [];
    }
    if (!user.dailyLogins) {
      updates.dailyLogins = {};
    }
    if (!user.monthlyLogins) {
      updates.monthlyLogins = {};
    }
    
    // Increment login counters
    updates.$inc[`dailyLogins.${today}`] = 1;
    updates.$inc[`monthlyLogins.${thisMonth}`] = 1;
    
    // Add login timestamp to history (limit to 100 most recent)
    updates.$push = {
      loginDates: {
        $each: [now],
        $slice: -100 // Keep only last 100 logins
      }
    };
    
    // Update user with new tracking data
    await User.findByIdAndUpdate(user._id, updates, { new: true });
    
    // Convert to plain object and remove sensitive data
    const userObj = user.toObject();
    const { passwordHash, salt, ...safeUser } = userObj;
    
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Signup endpoint with tracking initialization
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if username or email already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Hash password
    const { hash: passwordHash, salt } = User.hashPassword(password);
    
    // Current date for tracking initialization
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Create new user with tracking fields
    const newUser = new User({
      username,
      email,
      passwordHash,
      salt,
      role: 'user',
      usage: 0,
      billingPeriod: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      subscriptionStatus: 'free-trial',
      darkModeEnabled: false,
      // New tracking fields
      lastLogin: now,
      loginDates: [now],
      dailyLogins: { [today]: 1 },
      monthlyLogins: { [thisMonth]: 1 },
      activityLog: []
    });
    
    // Save user to database
    await newUser.save();
    
    // Send welcome email
    const emailSent = await sendWelcomeEmail(newUser);
    
    // Convert to plain object and remove sensitive data
    const userObj = newUser.toObject();
    const { passwordHash: ph, salt: s, ...safeUser } = userObj;
    
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// New endpoint to log user activity
app.post('/api/log-activity', async (req, res) => {
  try {
    const { userId, activity, details } = req.body;
    
    if (!userId || !activity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create activity entry
    const activityEntry = {
      timestamp: new Date(),
      activity,
      details: details || {}
    };
    
    // Initialize activityLog array if it doesn't exist
    if (!user.activityLog) {
      user.activityLog = [];
    }
    
    // Add new activity to log (limit to 1000 most recent)
    user.activityLog.push(activityEntry);
    if (user.activityLog.length > 1000) {
      user.activityLog.shift(); // Remove oldest entry if over limit
    }
    
    // Save updated user
    await user.save();
    
    res.json({ success: true, message: 'Activity logged' });
  } catch (error) {
    console.error('Activity logging error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Load the email template (you should save the HTML template from earlier artifact in a file)
const emailTemplatePath = path.join(__dirname, 'templates', 'welcome-email.html');
let emailTemplate;
try {
  const emailTemplateSource = fs.readFileSync(emailTemplatePath, 'utf-8');
  emailTemplate = handlebars.compile(emailTemplateSource);
} catch (error) {
  console.error('Error loading email template:', error);
}

// Utility to calculate trial end date (30 days from now)
const calculateTrialEndDate = () => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  return endDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};



// Function to send welcome email
const sendWelcomeEmail = async (user) => {
  // Set up email transporter with your credentials
const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.smtphost,
//     pass: process.env.smtppassword
//   }
// });
        host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });

        // this.emailTransporter = nodemailer.createTransport({


  if (!emailTemplate) {
    console.error('Email template not loaded');
    return false;
  }

  try {
    // Generate the HTML for the email using the template
    const trialEndDate = calculateTrialEndDate();
    const htmlToSend = emailTemplate({
      username: user.username,
      email: user.email,
      trialEndDate
    });

    // Set up the email options
    const mailOptions = {
      from: '"Regulatory AI Dashboard" <syneticslz@gmail.com>',
      to: user.email,
      subject: 'Welcome to Your Regulatory AI Dashboard',
      html: htmlToSend
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', user.email, 'MessageID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};


// Input validation middleware
const FDAvalidateDrugName = (req, res, next) => {
  const { drugName } = req.params;
  if (!drugName || typeof drugName !== 'string' || drugName.length > 100) {
    return res.status(400).json({ error: 'Invalid drug name' });
  }
  next();
};

app.get('/config', (req, res) => {
  res.json({
    apiUrl: process.env.PUBLIC_API_URL || 'http://localhost:3000/api', // Fallback for local testing
  });
});

// // Load and parse the EMA medicine data CSV file
// let emaMedicines = [];
// try {
//   const csvFilePath = path.join(__dirname, 'medicines.csv');
//   // Use utf8 encoding instead of cp1252 since Node.js doesn't directly support cp1252
//   const csvData = fs.readFileSync(csvFilePath, { encoding: 'utf8' });
//   const parsedData = Papa.parse(csvData, {
//     header: true,
//     skipEmptyLines: true,
//     // Tell Papa Parse to be more flexible with parsing
//     delimiter: ',', // Explicitly set delimiter
//     dynamicTyping: false, // Keep everything as strings
//     encoding: 'utf8'
//   });
//   emaMedicines = parsedData.data;
//   console.log(`Loaded ${emaMedicines.length} medicines from EMA data`);
// } catch (error) {
//   console.error('Error loading EMA medicine data:', error.message);
//   process.exit(1);
// }

let emaMedicines = [];
try {
  const csvFilePath = path.join(__dirname, 'medicines.csv');
  const fileStream = fs.createReadStream(csvFilePath, { encoding: 'utf8' });

  Papa.parse(fileStream, {
    header: true,
    skipEmptyLines: true,
    delimiter: ',',
    dynamicTyping: false,
    encoding: 'utf8',
    step: (result, parser) => {
      // Process each row incrementally
      emaMedicines.push(result.data);
      // Optional: Pause parsing if memory is a concern
      if (emaMedicines.length % 1000 === 0) {
        parser.pause();
        setTimeout(() => parser.resume(), 100); // Brief pause to allow GC
      }
    },
    complete: () => {
      console.log(`Loaded ${emaMedicines.length} medicines from EMA data`);
    },
    error: (error) => {
      console.error('Error parsing EMA medicine data:', error.message);
      process.exit(1);
    },
  });
} catch (error) {
  console.error('Error loading EMA medicine data:', error.message);
  process.exit(1);
}


let warningLetters = [];
try {
  const wdata = fs.readFileSync(path.join(__dirname, 'output/wl.json'), 'utf8');
  warningLetters = JSON.parse(wdata);
  console.log(`Loaded ${warningLetters.length} warning letters from file.`);
} catch (error) {
  console.error('Error loading warning letters data:', error);
  process.exit(1);
}

// Set up logging
const logDirectory = path.join(__dirname, 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Create a write stream for logging
const accessLogStream = fs.createWriteStream(
  path.join(logDirectory, 'access.log'),
  { flags: 'a' }
);

// Setup request logging
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Also log to console

// Detailed request logger middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Log request details
  const requestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: req.headers,
  };
  
  // console.log('📥 REQUEST:', JSON.stringify(requestLog, null, 2));
  
  // Capture the response
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log response details (but limit large responses)
    const responseBody = typeof body === 'string' ? 
      (body.length > 1000 ? body.substring(0, 1000) + '... (truncated)' : body) : 
      'Non-string response (likely JSON)';
    
    const responseLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseSize: Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body), 'utf8'),
    };
    
    // console.log('📤 RESPONSE:', JSON.stringify(responseLog, null, 2));
    
    // Also log to file
    fs.appendFileSync(
      path.join(logDirectory, 'detailed.log'),
      JSON.stringify({
        request: requestLog,
        response: responseLog
      }) + '\n'
    );
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Constants
const CLINICAL_TRIALS_API_BASE = 'https://clinicaltrials.gov/api/v2';
const DEFAULT_PAGE_SIZE = 20;
// Local Orange Book Data
let orangeBookData = {
  products: [],
  patents: [],
  exclusivity: []
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Returns the result of the function
 */
async function retryRequest(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but just in case
  throw lastError;
}


// Load Orange Book JSON files on startup
function loadOrangeBookData() {
  try {
    const files = {
      products: 'products_data.json',
      patents: 'patent_data.json',
      exclusivity: 'exclusivity_data.json'
    };

    Object.keys(files).forEach(key => {
      const filePath = path.join(__dirname, files[key]);
      if (fs.existsSync(filePath)) {
        const jsonData = fs.readFileSync(filePath, 'utf8');
        orangeBookData[key] = JSON.parse(jsonData);
        console.log(`Loaded ${orangeBookData[key].length} ${key} from ${files[key]}`);
      } else {
        console.warn(`Warning: ${files[key]} not found. Starting with empty ${key} dataset.`);
        orangeBookData[key] = [];
      }
    });
  } catch (error) {
    console.error('Error loading Orange Book data:', error);
    orangeBookData = { products: [], patents: [], exclusivity: [] };
  }
}

/**
 * Helper function to handle API errors
 */
const handleApiError = (error, res) => {
  console.error('❌ API Error:', error.message);
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error('Status:', error.response.status);
    console.error('Headers:', error.response.headers);
    console.error('Data:', error.response.data);
    
    return res.status(error.response.status).json({
      error: true,
      message: 'Error fetching data from Clinical Trials API',
      details: error.response.data,
      status: error.response.status
    });
  } else if (error.request) {
    // The request was made but no response was received
    console.error('Request:', error.request);
    
    return res.status(503).json({
      error: true,
      message: 'No response received from Clinical Trials API',
      details: 'The request was made but no response was received'
    });
  } else {
    // Something happened in setting up the request that triggered an Error
    return res.status(500).json({
      error: true,
      message: 'Error setting up request to Clinical Trials API',
      details: error.message
    });
  }
};

/**
 * Middleware to validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  let { page, pageSize } = req.query;
  
  // Validate and convert to numbers
  page = parseInt(page) || 1;
  pageSize = parseInt(pageSize) || DEFAULT_PAGE_SIZE;
  
  // Ensure values are within reasonable range
  if (page < 1) page = 1;
  if (pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > 1000) pageSize = 1000; // API maximum
  
  // Attach to request for later use
  req.pagination = { page, pageSize };
  
  next();
};

//######################################################################################################################################
//#######################################################################################################################################
// Required packages - make sure to install these
// npm install pdf-lib pdf-parse axios multer fs-extra sharp pdf2pic canvas


// Required packages
// const fs = require('fs');
// const path = require('path');
// const axios = require('axios');
// const multer = require('multer');
// const cheerio = require('cheerio');
// const https = require('https');
// const { PDFDocument } = require('pdf-lib');
// const pdfParse = require('pdf-parse');
// const sharp = require('sharp');
// const { fromPath } = require('pdf2pic');

// Create an HTTPS agent with relaxed SSL options


// Configure storage for uploaded PDF files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'temp-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
}).single('pdf');

// Grok API configuration - in production use environment variables

const GROK_API_KEY = process.env.grok;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';







// // Contact form backend handler
// app.post('/api/contact', async (req, res) => {
//   try {
//     const { 
//       name, 
//       company, 
//       email, 
//       phone, 
//       message 
//     } = req.body;
    
//     console.log(`Received contact form submission from ${name} at ${email}`);
    
//     // Validate required fields
//     if (!name || !email || !message) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Please provide name, email and message' 
//       });
//     }
    
//     // Basic email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Please provide a valid email address' 
//       });
//     }
    
//     // Create email transporter (using the same one from your previous code)
//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: 'syneticslz@gmail.com',
//         pass: 'gble ksdb ntdq hqlx'
//       }
//     });
    
//     // Prepare HTML email
//     const htmlEmail = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="utf-8">
//         <title>New Contact Form Submission</title>
//         <style>
//           body {
//             font-family: Arial, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 800px;
//             margin: 0 auto;
//             padding: 20px;
//           }
//           .header {
//             border-bottom: 2px solid #3b82f6;
//             padding-bottom: 10px;
//             margin-bottom: 20px;
//           }
//           .header h1 {
//             color: #1e40af;
//             margin-bottom: 5px;
//           }
//           .content {
//             margin: 20px 0;
//           }
//           .data-item {
//             margin-bottom: 15px;
//           }
//           .label {
//             font-weight: bold;
//             color: #4b5563;
//           }
//           .footer {
//             margin-top: 30px;
//             font-size: 12px;
//             color: #666;
//             border-top: 1px solid #ddd;
//             padding-top: 15px;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <h1>New Contact Form Submission</h1>
//           <p>From SyneticX website</p>
//         </div>
        
//         <div class="content">
//           <div class="data-item">
//             <p class="label">Name:</p>
//             <p>${name}</p>
//           </div>
          
//           <div class="data-item">
//             <p class="label">Company:</p>
//             <p>${company || 'Not provided'}</p>
//           </div>
          
//           <div class="data-item">
//             <p class="label">Email:</p>
//             <p>${email}</p>
//           </div>
          
//           <div class="data-item">
//             <p class="label">Phone:</p>
//             <p>${phone || 'Not provided'}</p>
//           </div>
          
//           <div class="data-item">
//             <p class="label">Message:</p>
//             <p>${message}</p>
//           </div>
//         </div>
        
//         <div class="footer">
//           <p>This message was sent from the contact form on the SyneticX website on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.</p>
//         </div>
//       </body>
//       </html>
//     `;
    
//     // Send email to yourself
//     await transporter.sendMail({
//       from: `"SyneticX Website" <syneticslz@gmail.com>`,
//       to: 'syneticslz@gmail.com', // Your email where you want to receive messages
//       replyTo: email, // Set reply-to as the contact's email for easy replies
//       subject: `New Contact: ${name} from ${company || 'Unknown Company'}`,
//       html: htmlEmail
//     });
    
//     // Send confirmation email to the user
//     await transporter.sendMail({
//       from: `"SyneticX" <syneticslz@gmail.com>`,
//       to: email,
//       subject: `Thanks for contacting SyneticX`,
//       html: `
//         <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Thank You for Contacting SyneticX</title>
//     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
//     <style>
//         /* Base styles */
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }
        
//         body {
//             font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
//             line-height: 1.6;
//             color: #4b5563;
//             background-color: #f9fafb;
//             margin: 0;
//             padding: 0;
//         }
        
//         .email-container {
//             max-width: 600px;
//             margin: 30px auto;
//             background-color: #ffffff;
//             border-radius: 8px;
//             overflow: hidden;
//             box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
//         }
        
//         .email-header {
//             background: linear-gradient(to right, #3b82f6, #8b5cf6);
//             color: white;
//             padding: 28px 24px;
//             text-align: center;
//         }
        
//         .logo-text {
//             font-size: 24px;
//             font-weight: 700;
//             margin: 0;
//             color: white;
//         }
        
//         .email-body {
//             padding: 32px 24px;
//         }
        
//         .greeting {
//             font-size: 18px;
//             font-weight: 600;
//             color: #111827;
//             margin-bottom: 16px;
//         }
        
//         .message {
//             margin-bottom: 20px;
//         }
        
//         .signature {
//             margin-top: 28px;
//         }
        
//         .signature-name {
//             font-weight: 600;
//             color: #111827;
//         }
        
//         .email-footer {
//             background-color: #f9fafb;
//             padding: 20px 24px;
//             text-align: center;
//             font-size: 14px;
//             color: #6b7280;
//             border-top: 1px solid #e5e7eb;
//         }
        
//         .footer-text {
//             margin-bottom: 10px;
//         }
        
//         .automated-message {
//             font-size: 12px;
//             color: #9ca3af;
//             margin-top: 12px;
//         }
//     </style>
// </head>
// <body>
//     <div class="email-container">
//         <div class="email-header">
//             <h1 class="logo-text">SyneticX</h1>
//         </div>
        
//         <div class="email-body">
//             <p class="greeting">Hello ${name},</p>
            
//             <p class="message">
//                 Thank you for contacting SyneticX. We've received your message and one of our team members will get back to you shortly.
//             </p>
            
//             <p class="message">
//                 We appreciate your interest in our AI-powered market intelligence solutions and look forward to discussing how we can help optimize your business decisions.
//             </p>
            
//             <div class="signature">
//                 <p class="signature-name">Best regards,</p>
//                 <p>The SyneticX Team</p>
//             </div>
//         </div>
        
//         <div class="email-footer">
//             <p class="footer-text">© 2025 SyneticX. All rights reserved.</p>
//             <p class="automated-message">This is an automated message, please do not reply directly to this email.</p>
//         </div>
//     </div>
// </body>
// </html>
//       `
//     });
    
//     res.json({ success: true, message: 'Your message has been sent successfully. We\'ll be in touch soon!' });
//   } catch (error) {
//     console.error('Contact form submission error:', error);
//     res.status(500).json({ success: false, error: 'Failed to send your message. Please try again later.' });
//   }
// });

app.post('/api/contact', async (req, res) => {
  try {
    const { 
      name, 
      company, 
      email, 
      phone, 
      message 
    } = req.body;
    
    console.log(`Received contact form submission from ${name} at ${email}`);
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide name, email and message' 
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid email address' 
      });
    }
    
    // Split name into first and last name (best effort)
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Create lead in database
    const { Lead } = require('./db'); // Adjust path as needed
    
    const newLead = new Lead({
      firstName,
      lastName,
      email,
      company,
      phone,
      message,
      source: 'contact_form'
    });
    
    await newLead.save();
    console.log(`Created lead in database with ID: ${newLead._id}`);
    const emailuser = process.env.smtppassword
const emailhost = process.env.smtphost
    // Create email transporter
    const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    // user: process.env.smtphost,
    // pass: process.env.smtppassword
    //   }
    // });
            host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });
    
    // Prepare HTML email
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Contact Form Submission</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e40af;
            margin-bottom: 5px;
          }
          .content {
            margin: 20px 0;
          }
          .data-item {
            margin-bottom: 15px;
          }
          .label {
            font-weight: bold;
            color: #4b5563;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>New Contact Form Submission</h1>
          <p>From SyneticX website</p>
        </div>
        
        <div class="content">
          <div class="data-item">
            <p class="label">Name:</p>
            <p>${name}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Company:</p>
            <p>${company || 'Not provided'}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Email:</p>
            <p>${email}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Phone:</p>
            <p>${phone || 'Not provided'}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Message:</p>
            <p>${message}</p>
          </div>
        </div>
        
        <div class="footer">
          <p>This message was sent from the contact form on the SyneticX website on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.</p>
          <p>A lead record has been created in the database with ID: ${newLead._id}</p>
        </div>
      </body>
      </html>
    `;
    
    // Send email to yourself
    await transporter.sendMail({
      from: `"SyneticX Website" <syneticslz@gmail.com>`,
      to: 'syneticslz@gmail.com', // Your email where you want to receive messages
      replyTo: email, // Set reply-to as the contact's email for easy replies
      subject: `New Contact: ${name} from ${company || 'Unknown Company'}`,
      html: htmlEmail
    });
    
    // Send confirmation email to the user
    await transporter.sendMail({
      from: `"SyneticX" <syneticslz@gmail.com>`,
      to: email,
      subject: `Thanks for contacting SyneticX`,
      html: `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Contacting SyneticX</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #4b5563;
            background-color: #f9fafb;
            margin: 0;
            padding: 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        
        .email-header {
            background: linear-gradient(to right, #3b82f6, #8b5cf6);
            color: white;
            padding: 28px 24px;
            text-align: center;
        }
        
        .logo-text {
            font-size: 24px;
            font-weight: 700;
            margin: 0;
            color: white;
        }
        
        .email-body {
            padding: 32px 24px;
        }
        
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 16px;
        }
        
        .message {
            margin-bottom: 20px;
        }
        
        .signature {
            margin-top: 28px;
        }
        
        .signature-name {
            font-weight: 600;
            color: #111827;
        }
        
        .email-footer {
            background-color: #f9fafb;
            padding: 20px 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer-text {
            margin-bottom: 10px;
        }
        
        .automated-message {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1 class="logo-text">SyneticX</h1>
        </div>
        
        <div class="email-body">
            <p class="greeting">Hello ${name},</p>
            
            <p class="message">
                Thank you for contacting SyneticX. We've received your message and one of our team members will get back to you shortly.
            </p>
            
            <p class="message">
                We appreciate your interest in our AI-powered market intelligence solutions and look forward to discussing how we can help optimize your business decisions.
            </p>
            
            <div class="signature">
                <p class="signature-name">Best regards,</p>
                <p>The SyneticX Team</p>
            </div>
        </div>
        
        <div class="email-footer">
            <p class="footer-text">© 2025 SyneticX. All rights reserved.</p>
            <p class="automated-message">This is an automated message, please do not reply directly to this email.</p>
        </div>
    </div>
</body>
</html>
      `
    });
    
    res.json({ success: true, message: 'Your message has been sent successfully. We\'ll be in touch soon!' });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ success: false, error: 'Failed to send your message. Please try again later.' });
  }
});







// Google Meet Link (replace with your actual link)
const GOOGLE_MEET_LINK = process.env.GOOGLE_MEET_LINK 

// In-memory storage (replace with database in production)
const registrations = [];

// Helper function to generate calendar links
function generateCalendarLinks() {
  const startDate = '20250731T190000Z'; // July 31, 2025 2:00 PM EST in EST
  const endDate = '20250731T194500Z';   // 45 minutes later
  const title = encodeURIComponent('Cracking the FDA Code Webinar');
  const description = encodeURIComponent(`Join us for this exclusive webinar on regulatory intelligence. Meeting Link: ${GOOGLE_MEET_LINK}`);
  
  const googleCalendar = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${encodeURIComponent(GOOGLE_MEET_LINK)}`;
  
  const outlookCalendar = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}&location=${encodeURIComponent(GOOGLE_MEET_LINK)}`;
  
  return { googleCalendar, outlookCalendar };
}

// Email templates
const getConfirmationEmailHTML = (userData, calendarLinks) => {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webinar Confirmation</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3b82f6, #a855f7); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .event-details { background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #3b82f6; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 5px; font-weight: bold; }
        .button:hover { background: #2563eb; }
        .calendar-buttons { text-align: center; margin: 30px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .checkmark { width: 60px; height: 60px; background: #22c55e; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
        .meet-link { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .meet-link a { color: #059669; font-weight: bold; text-decoration: none; font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="checkmark">
                <svg width="30" height="30" fill="white" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
            </div>
            <h1>You're Registered!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">Cracking the FDA Code Webinar</p>
        </div>
        
        <div class="content">
            <p>Hi ${userData.fullName},</p>
            
            <p>🎉 <strong>Congratulations!</strong> Your seat is reserved for our exclusive webinar on regulatory intelligence.</p>
            
            <div class="event-details">
                <h3 style="margin-top: 0; color: #1f2937;">📅 Event Details</h3>
                <p><strong>Event:</strong> Cracking the FDA Code: How Regulatory Intelligence Helps Pharma Leaders Move Faster in 2025</p>
                <p><strong>Date:</strong> Wednesday, July 31st, 2025</p>
                <p><strong>Time:</strong> 2:00 PM EST / 11:00 AM PST</p>
                <p><strong>Duration:</strong> 45 minutes + Live Q&A</p>
                <p><strong>Platform:</strong> Google Meet</p>
            </div>
            
            <div class="meet-link">
                <h4 style="margin-top: 0; color: #059669;">🔗 Join the Webinar</h4>
                <a href="${GOOGLE_MEET_LINK}" target="_blank">${GOOGLE_MEET_LINK}</a>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Save this link - you'll need it to join the webinar!</p>
            </div>
            
            <div class="calendar-buttons">
                <h4>Add to Your Calendar:</h4>
                <a href="${calendarLinks.googleCalendar}" class="button" target="_blank">📅 Google Calendar</a>
                <a href="${calendarLinks.outlookCalendar}" class="button" target="_blank">📅 Outlook</a>
            </div>
            
            <h3>What to Expect:</h3>
            <ul>
                <li>✅ Reduce submission risks by up to 40%</li>
                <li>✅ Predict trial costs with AI analytics</li>
                <li>✅ Stay ahead of regulatory changes</li>
                <li>✅ Track competitor activities in real-time</li>
                <li>✅ Live Q&A with our expert panel</li>
            </ul>
            
            <h3>Your Expert Panel:</h3>
            <p><strong>Rohan Mehmi</strong> - Co-Founder, SyneticX</p>
            <p><strong>Alexander Macgregor</strong> - Co-Founder, SyneticX</p>
            <p><strong>Mark Paxton</strong> - Regulatory Expert, Founder of White Oak AI Law</p>
            
            <p style="margin-top: 30px;">If you have any questions before the webinar, feel free to reply to this email.</p>
            
            <p>Looking forward to seeing you there!</p>
            
            <p>Best regards,<br>
            <strong>The SyneticX Team</strong></p>
        </div>
        
        <div class="footer">
            <p>© 2025 SyneticX. All rights reserved.</p>
            <p>Questions? Reply to this email or contact us at support@syneticx.com</p>
        </div>
    </div>
</body>
</html>
  `;
};



// Webinar registration endpoint
app.post('/api/webinar/register', async (req, res) => {
  try {
    const { fullName, email, company, jobTitle, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;

const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.smtphost,
//     pass: process.env.smtppassword
//   }
// });
        host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });

    // Basic validation
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if already registered
    const existingRegistration = registrations.find(reg => reg.email === email);
    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered for the webinar'
      });
    }

    // Create registration record
    const registration = {
      id: Date.now().toString(),
      fullName,
      email,
      company: company || '',
      jobTitle: jobTitle || '',
      registrationDate: new Date().toISOString(),
      utm_source: utm_source || '',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      utm_content: utm_content || '',
      utm_term: utm_term || '',
      emailSent: false
    };

    // Generate calendar links
    const calendarLinks = generateCalendarLinks();

    // Send confirmation email
    const mailOptions = {
      from: `"SyneticX Webinar" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: '🎉 You\'re In! FDA Code Webinar Details Inside',
      html: getConfirmationEmailHTML(registration, calendarLinks),
      text: `Hi ${fullName},

You're registered for "Cracking the FDA Code" webinar!

Event Details:
- Date: Wednesday, July 31st, 2025
- Time: 2:00 PM EST / 11:00 AM PST
- Duration: 45 minutes + Q&A
- Platform: Google Meet

Meeting Link: ${GOOGLE_MEET_LINK}

Add to Calendar:
- Google: ${calendarLinks.googleCalendar}
- Outlook: ${calendarLinks.outlookCalendar}

Looking forward to seeing you there!

Best regards,
The SyneticX Team`
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    // Mark email as sent and save registration
    registration.emailSent = true;
    registrations.push(registration);

    console.log(`New registration: ${fullName} (${email})`);

    // Return success response
    res.json({
      success: true,
      message: 'Registration successful! Check your email for confirmation.',
      data: {
        registrationId: registration.id,
        calendarLinks,
        meetingLink: GOOGLE_MEET_LINK
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Get registration stats (optional admin endpoint)
app.get('/api/webinar/stats', (req, res) => {
  res.json({
    totalRegistrations: registrations.length,
    emailsSent: registrations.filter(r => r.emailSent).length,
    recentRegistrations: registrations.slice(-10)
  });
});



// Book a demo route
app.post('/api/demo', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      company, 
      companyRevenueRange,
      agreeToTerms
    } = req.body;
    
    console.log(`Received demo booking from ${firstName} ${lastName} at ${email}`);
    // Create email transporter
const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.smtphost,
//     pass: process.env.smtppassword
//   }
// });
        host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide first name, last name and email' 
      });
    }
    
    // Ensure terms agreement
    if (!agreeToTerms) {
      return res.status(400).json({ 
        success: false, 
        error: 'You must agree to the Privacy Policy and Terms of Service' 
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid email address' 
      });
    }
    
    // Save lead to database
    const newLead = new Lead({
      firstName,
      lastName,
      email,
      company,
      companyRevenueRange,
      source: 'demo_form',
      agreeToTerms: true
    });
    
    await newLead.save();
    
    // Prepare notification email to admin
    const adminHtmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Demo Request</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e40af;
            margin-bottom: 5px;
          }
          .content {
            margin: 20px 0;
          }
          .data-item {
            margin-bottom: 15px;
          }
          .label {
            font-weight: bold;
            color: #4b5563;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          .priority-high {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>New Demo Request</h1>
          <p>From SyneticX website</p>
        </div>
        
        <div class="content">
          <div class="data-item ${companyRevenueRange === 'Over $100M' ? 'priority-high' : ''}">
            <p class="label">Name:</p>
            <p>${firstName} ${lastName}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Company:</p>
            <p>${company || 'Not provided'}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Email:</p>
            <p>${email}</p>
          </div>
          
          <div class="data-item">
            <p class="label">Company Revenue Range:</p>
            <p>${companyRevenueRange || 'Not specified'}</p>
          </div>
        </div>
        
        <div class="footer">
          <p>This demo request was submitted on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.</p>
        </div>
      </body>
      </html>
    `;
    
    // Send notification email to admin
    await transporter.sendMail({
      from: `"SyneticX Demo Requests" <syneticslz@gmail.com>`,
      to: 'syneticslz@gmail.com',
      replyTo: email,
      subject: `New Demo Request: ${firstName} ${lastName} from ${company || 'Unknown Company'}`,
      html: adminHtmlEmail
    });
    
    // Send confirmation email to the user
    await transporter.sendMail({
      from: `"SyneticX" <syneticslz@gmail.com>`,
      to: email,
      subject: `Your SyneticX Demo Request - Next Steps`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thank You for Requesting a Demo with SyneticX</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                /* Base styles */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.6;
                    color: #4b5563;
                    background-color: #f9fafb;
                    margin: 0;
                    padding: 0;
                }
                
                .email-container {
                    max-width: 600px;
                    margin: 30px auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                }
                
                .email-header {
                    background: linear-gradient(to right, #3b82f6, #8b5cf6);
                    color: white;
                    padding: 28px 24px;
                    text-align: center;
                }
                
                .logo-text {
                    font-size: 24px;
                    font-weight: 700;
                    margin: 0;
                    color: white;
                }
                
                .email-body {
                    padding: 32px 24px;
                }
                
                .greeting {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 16px;
                }
                
                .message {
                    margin-bottom: 20px;
                }
                
                .next-steps {
                    background-color: #f3f4f6;
                    border-radius: 6px;
                    padding: 20px;
                    margin: 24px 0;
                }
                
                .next-steps-title {
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 12px;
                }
                
                .step {
                    margin-bottom: 12px;
                }
                
                .step-number {
                    font-weight: 600;
                    color: #3b82f6;
                }
                
                .signature {
                    margin-top: 28px;
                }
                
                .signature-name {
                    font-weight: 600;
                    color: #111827;
                }
                
                .email-footer {
                    background-color: #f9fafb;
                    padding: 20px 24px;
                    text-align: center;
                    font-size: 14px;
                    color: #6b7280;
                    border-top: 1px solid #e5e7eb;
                }
                
                .footer-text {
                    margin-bottom: 10px;
                }
                
                .automated-message {
                    font-size: 12px;
                    color: #9ca3af;
                    margin-top: 12px;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="email-header">
                    <h1 class="logo-text">SyneticX</h1>
                </div>
                
                <div class="email-body">
                    <p class="greeting">Hello ${firstName},</p>
                    
                    <p class="message">
                        Thank you for requesting a personalized demo of SyneticX's AI-powered market intelligence solutions. We're excited to show you how our platform can help optimize your business decisions.
                    </p>
                    
                    <div class="next-steps">
                        <p class="next-steps-title">What happens next?</p>
                        
                        <p class="step">
                            <span class="step-number">1.</span> Our team is reviewing your request and will reach out within 1 business day to schedule your personalized demo.
                        </p>
                        
                        <p class="step">
                            <span class="step-number">2.</span> During the demo, we'll tailor the presentation to focus on the features most relevant to your business needs.
                        </p>
                        
                        <p class="step">
                            <span class="step-number">3.</span> After the demo, we'll provide you with additional resources and a special offer to get started with SyneticX.
                        </p>
                    </div>
                    
                    <p class="message">
                        If you have any questions before your demo, feel free to reply to this email or call us at (555) 123-4567.
                    </p>
                    
                    <div class="signature">
                        <p class="signature-name">Looking forward to connecting,</p>
                        <p>The SyneticX Team</p>
                    </div>
                </div>
                
                <div class="email-footer">
                    <p class="footer-text">© 2025 SyneticX. All rights reserved.</p>
                    <p class="automated-message">This is an automated confirmation of your demo request.</p>
                </div>
            </div>
        </body>
        </html>
      `
    });
    
    res.json({ success: true, message: 'Your demo request has been submitted. We\'ll be in touch soon to schedule your personalized demo!' });
  } catch (error) {
    console.error('Demo booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to book your demo. Please try again later.' });
  }
});

// Handle LinkedIn ad campaign leads
app.post('/api/linkedin-lead', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email,
      company,
      campaign,
      // LinkedIn might send additional params that we can capture
      ...linkedinParams
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Incomplete lead data' 
      });
    }
    
    // Save lead to database
    const newLead = new Lead({
      firstName,
      lastName,
      email,
      company,
      source: 'linkedin_ad',
      campaign,
      linkedinData: linkedinParams
    });
    
    await newLead.save();
    
    // Send notification email to admin about the LinkedIn lead
    await transporter.sendMail({
      from: `"SyneticX Lead Generation" <syneticslz@gmail.com>`,
      to: 'syneticslz@gmail.com',
      subject: `New LinkedIn Lead: ${firstName} ${lastName} from ${company || 'Unknown Company'}`,
      html: `
        <h2>New LinkedIn Campaign Lead</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || 'Not provided'}</p>
        <p><strong>Campaign:</strong> ${campaign || 'Not specified'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <hr>
        <p>This lead was automatically captured from your LinkedIn advertising campaign.</p>
      `
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('LinkedIn lead capture error:', error);
    res.status(500).json({ success: false });
  }
});



// Email summary for warning letters and inspections
app.post('/api/wl/email-summary', async (req, res) => {
  try {
    const { 
      email, 
      includeContent, 
      includeAI, 
      message, 
      companies 
    } = req.body;
    
    console.log(`Sending warning letters summary email to ${email} for companies: ${companies?.join(', ') || 'All'}`);
    
    // Get data for the email
    let warningLettersData = [];
    let inspectionsData = { recentInspections: [], historicalInspections: [] };
    let aiAnalysis = null;
    
    // Fetch warning letters data if companies are specified
    if (companies && companies.length > 0) {
      // Get warning letters for specified companies
      warningLettersData = await getWarningLettersForCompanies(companies);
      
      // Get inspection data for specified companies
      inspectionsData = await getInspectionsForCompanies(companies);
      
      // Generate AI analysis if requested
      if (includeAI) {
        aiAnalysis = await generateAnalysis(companies, warningLettersData, inspectionsData);
      }
    } else {
      // Get recent warning letters (limit to 50)
      warningLettersData = await getRecentWarningLetters(50);
      
      // Generate general AI analysis if requested
      if (includeAI) {
        aiAnalysis = await generateGeneralAnalysis(warningLettersData);
      }
    }
    
    // Create email content
    let emailContent = '';
    
    // Add user message if provided
    if (message) {
      emailContent += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #3b82f6;">
          <p style="font-style: italic;">${message}</p>
        </div>
      `;
    }
    
    // Add AI analysis if available and requested
    if (includeAI && aiAnalysis) {
      emailContent += `
        <div style="margin-bottom: 25px; padding: 15px; background-color: #f0f7ff; border-radius: 8px; border: 1px solid #bfdbfe;">
          <h2 style="color: #1e40af; margin-top: 0;">AI Analysis</h2>
          ${aiAnalysis.summary ? `
            <div style="margin-bottom: 15px;">
              <h3 style="color: #1e3a8a; font-size: 16px;">Summary</h3>
              <p>${aiAnalysis.summary}</p>
            </div>
          ` : ''}
          
          ${aiAnalysis.correlation ? `
            <div style="margin-bottom: 15px;">
              <h3 style="color: #1e3a8a; font-size: 16px;">Form 483 to Warning Letter Correlation</h3>
              <p>${aiAnalysis.correlation}</p>
            </div>
          ` : ''}
          
          ${aiAnalysis.marketOpportunities ? `
            <div style="margin-bottom: 15px;">
              <h3 style="color: #1e3a8a; font-size: 16px;">Market Opportunities</h3>
              <p>${aiAnalysis.marketOpportunities}</p>
            </div>
          ` : ''}
          
          ${aiAnalysis.recommendations ? `
            <div style="margin-bottom: 15px;">
              <h3 style="color: #1e3a8a; font-size: 16px;">Recommendations</h3>
              <p>${aiAnalysis.recommendations}</p>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Add warning letters data if requested
    if (includeContent && warningLettersData.length > 0) {
      emailContent += `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e40af;">Warning Letters (${warningLettersData.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Company</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Issue Date</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Issuing Office</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Subject</th>
              </tr>
            </thead>
            <tbody>
              ${warningLettersData.map(letter => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px;">${letter.companyName}</td>
                  <td style="padding: 8px;">${formatDate(letter.letterIssueDate)}</td>
                  <td style="padding: 8px;">${letter.issuingOffice || 'Unknown'}</td>
                  <td style="padding: 8px;">${letter.subject || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    // Add inspection data if requested
    if (includeContent && (inspectionsData.recentInspections.length > 0 || inspectionsData.historicalInspections.length > 0)) {
      emailContent += `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e40af;">Recent Form 483s (${inspectionsData.recentInspections.length})</h2>
          ${inspectionsData.recentInspections.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Date</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Legal Name</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Record Type</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">FEI Number</th>
                </tr>
              </thead>
              <tbody>
                ${inspectionsData.recentInspections.map(inspection => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px;">${formatDate(inspection["Record Date"])}</td>
                    <td style="padding: 8px;">${inspection["Legal Name"]}</td>
                    <td style="padding: 8px;">${inspection["Record Type"]}</td>
                    <td style="padding: 8px;">${inspection["FEI Number"]}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #6b7280;">No recent Form 483s found</p>'}
          
          <h2 style="color: #1e40af;">Historical Inspections (${inspectionsData.historicalInspections.length})</h2>
          ${inspectionsData.historicalInspections.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Firm Name</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Location</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Inspection Date</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Classification</th>
                </tr>
              </thead>
              <tbody>
                ${inspectionsData.historicalInspections.map(inspection => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px;">${inspection["Firm Name"]}</td>
                    <td style="padding: 8px;">${inspection["City"] || ''}, ${inspection["State"] || ''}</td>
                    <td style="padding: 8px;">${formatDate(inspection["Inspection End Date"])}</td>
                    <td style="padding: 8px;">${inspection["Inspection Classification"] || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #6b7280;">No historical inspections found</p>'}
        </div>
      `;
    }
    
    // Prepare subject line
    const subject = companies && companies.length > 0
      ? `FDA Regulatory Summary for ${companies.join(', ')}`
      : 'FDA Regulatory Summary';
    

      const emailuser = process.env.smtppassword
const emailhost = process.env.smtphost

    // Create email transporter
    const transporter = nodemailer.createTransport({
              host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });
    //   service: 'gmail',
    //   auth: {

    // user: process.env.smtphost,
    // pass: process.env.smtppassword
    //   }
    // });
    
    // Prepare HTML email
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FDA Regulatory Summary</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e40af;
            margin-bottom: 5px;
          }
          .header h2 {
            color: #1e3a8a;
            margin-top: 0;
          }
          .content {
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FDA Regulatory Summary</h1>
          <h2>${companies && companies.length > 0 ? companies.join(', ') : 'Recent FDA Activity'}</h2>
        </div>
        
        <p>Hello,</p>
        
        <p>Here is the FDA regulatory summary you requested${companies && companies.length > 0 ? ` for ${companies.join(', ')}` : ''}:</p>
        
        <div class="content">
          ${emailContent}
        </div>
        
        <div class="footer">
          <p>This summary was generated automatically based on FDA data as of ${new Date().toLocaleDateString()}.</p>
          <p><strong>Disclaimer:</strong> This information is provided for informational purposes only and should not be used for regulatory decision making. Always consult official FDA documentation and regulatory professionals.</p>
        </div>
      </body>
      </html>
    `;
    
    // Send email
    await transporter.sendMail({
      from: `"FDA Data Portal" <syneticslz@gmail.com>`,
      to: email,
      subject: subject,
      html: htmlEmail
    });
    
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze companies endpoint
app.post('/api/wl/analyze-companies', async (req, res) => {
  try {
    const { companies, includeWL = true, include483 = true } = req.body;
    
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'Companies parameter must be a non-empty array' });
    }
    
    // Get warning letters and inspections data for the companies
    const warningLetters = await getWarningLettersForCompanies(companies);
    const inspections = await getInspectionsForCompanies(companies);
    
    // Generate analysis using Grok API
    const analysis = await generateAnalysis(companies, warningLetters, inspections);
    
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate summary endpoint
app.post('/api/wl/generate-summary', async (req, res) => {
  try {
    const { includeWL = true, include483 = true, includeMarketAnalysis = true } = req.body;
    
    // Get recent warning letters (limit to 100)
    const warningLetters = await getRecentWarningLetters(100);
    
    // Generate analysis using Grok API
    const analysis = await generateGeneralAnalysis(warningLetters, includeMarketAnalysis);
    
    res.json(analysis);
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get warning letters for specific companies
async function getWarningLettersForCompanies(companies) {
  const results = [];
  
  // Fetch warning letters for each company
  for (const company of companies) {
    try {
      // Query your database or API for warning letters for this company
      const response = await axios.get(`/api/wl/search?term=${encodeURIComponent(company)}&field=company&limit=50`);
      
      if (response.data && response.data.results) {
        // Add source company to each letter
        const letterWithSource = response.data.results.map(letter => ({
          ...letter,
          sourceCompany: company
        }));
        
        // Add to results, avoiding duplicates
        for (const letter of letterWithSource) {
          const letterExists = results.some(existing => existing.id === letter.id);
          if (!letterExists) {
            results.push(letter);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not fetch warning letters for ${company}:`, error.message);
    }
  }
  
  return results;
}

// Helper function to get inspections for specific companies
async function getInspectionsForCompanies(companies) {
  try {
    // Fetch all inspections data
    const response = await axios.get('/api/inspection-data');
    const data = response.data;
    
    // Create regex patterns for each company for more precise matching
    const companyPatterns = companies.map(company => 
      new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    );
    
    // Filter for the requested companies
    const filteredData = {
      recentInspections: data.recentInspections.filter(inspection => 
        companyPatterns.some(pattern => 
          pattern.test(inspection["Legal Name"] || '')
        )
      ),
      historicalInspections: data.historicalInspections.filter(inspection => 
        companyPatterns.some(pattern => 
          pattern.test(inspection["Firm Name"] || '')
        )
      ),
      projectAreas: data.projectAreas
    };
    
    return filteredData;
  } catch (error) {
    console.warn('Warning: Could not fetch inspection data:', error.message);
    return { recentInspections: [], historicalInspections: [], projectAreas: [] };
  }
}

// Helper function to get recent warning letters
async function getRecentWarningLetters(limit = 50) {
  try {
    // Query your database or API for recent warning letters
    const response = await axios.get(`/api/wl/search?limit=${limit}`);
    
    if (response.data && response.data.results) {
      return response.data.results;
    }
    
    return [];
  } catch (error) {
    console.warn('Warning: Could not fetch recent warning letters:', error.message);
    return [];
  }
}

// Function to generate analysis using Grok API for specific companies
async function generateAnalysis(companies, warningLetters, inspections) {
  try {
    // Define the Grok API endpoint
    const endpoint = 'https://api.grok.ai/v1/generate';
    
    // Prepare data for the prompt
    const form483Data = inspections.recentInspections.filter(
      item => item["Record Type"] === "Form 483"
    );
    
    // Build prompt for the Grok API
    const prompt = `
You are an expert FDA regulatory analyst. Analyze the following data about warning letters and Form 483s issued to pharmaceutical companies.

Companies being analyzed: ${companies.join(', ')}

Warning Letters (${warningLetters.length}):
${warningLetters.map(letter => `
- Company: ${letter.companyName}
- Issue Date: ${formatDate(letter.letterIssueDate)}
- Issuing Office: ${letter.issuingOffice || 'Unknown'}
- Subject: ${letter.subject || 'N/A'}
${letter.excerpt ? `- Excerpt: ${letter.excerpt}` : ''}
`).join('\n')}

Form 483s (${form483Data.length}):
${form483Data.map(inspection => `
- Company: ${inspection["Legal Name"]}
- Date: ${formatDate(inspection["Record Date"])}
- FEI Number: ${inspection["FEI Number"]}
`).join('\n')}

Historical Inspections (${inspections.historicalInspections.length}):
${inspections.historicalInspections.slice(0, 10).map(inspection => `
- Company: ${inspection["Firm Name"]}
- Location: ${inspection["City"] || ''}, ${inspection["State"] || ''}
- Inspection Date: ${formatDate(inspection["Inspection End Date"])}
- Project Area: ${inspection["Project Area"] || 'Unknown'}
- Classification: ${inspection["Inspection Classification"] || 'N/A'}
`).join('\n')}
${inspections.historicalInspections.length > 10 ? `... and ${inspections.historicalInspections.length - 10} more inspections` : ''}

Please provide:
1. A concise summary of the regulatory issues facing these companies
2. An analysis of the correlation between Form 483s and warning letters for these companies
3. Recommendations for how companies can prevent similar issues

Your response should be thorough but concise, focusing on patterns and insights rather than just restating the data.
    `;
    
    // Call the Grok API
    const response = await axios.post(endpoint, {
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Process the response
    const grokText = response.data.choices[0]?.text || '';
    
    // Parse the analysis into sections
    const analysis = {
      summary: extractSection(grokText, 'summary', 'correlation'),
      correlation: extractSection(grokText, 'correlation', 'recommendations'),
      recommendations: extractSection(grokText, 'recommendations')
    };
    
    return analysis;
  } catch (error) {
    console.error('Error generating analysis with Grok API:', error);
    
    // Return fallback analysis if API fails
    return {
      summary: "Based on the available data, these companies have faced regulatory scrutiny primarily in areas of quality control, data integrity, and manufacturing processes. The pattern of observations suggests systematic issues that require comprehensive remediation approaches.",
      correlation: "There appears to be a correlation between Form 483 observations and subsequent warning letters, typically with a 3-6 month delay if issues are not adequately addressed. The most significant violations in Form 483s frequently become central themes in warning letters.",
      recommendations: "Companies should: 1) Implement robust CAPA systems, 2) Ensure thorough documentation of manufacturing processes, 3) Invest in data integrity systems, 4) Create cross-functional teams to address observations quickly, and 5) Perform regular self-audits to identify issues before FDA inspections."
    };
  }
}

// Function to generate general market analysis using Grok API
async function generateGeneralAnalysis(warningLetters, includeMarketAnalysis = true) {
  try {
    // Define the Grok API endpoint
    const endpoint = 'https://api.grok.ai/v1/generate';
    
    // Build prompt for the Grok API
    const prompt = `
You are an expert FDA regulatory analyst. Analyze the following data about recent warning letters issued to pharmaceutical companies.

Recent Warning Letters (${warningLetters.length}):
${warningLetters.slice(0, 20).map(letter => `
- Company: ${letter.companyName}
- Issue Date: ${formatDate(letter.letterIssueDate)}
- Issuing Office: ${letter.issuingOffice || 'Unknown'}
- Subject: ${letter.subject || 'N/A'}
${letter.excerpt ? `- Excerpt: ${letter.excerpt}` : ''}
`).join('\n')}
${warningLetters.length > 20 ? `... and ${warningLetters.length - 20} more warning letters` : ''}

Please provide:
1. A concise summary of current regulatory trends based on these warning letters
${includeMarketAnalysis ? '2. Analysis of potential market opportunities these regulatory actions might create\n3. Recommended actions for companies looking to capitalize on these market opportunities' : ''}

Your response should be thorough but concise, focusing on patterns and insights rather than just restating the data.
    `;
    
    // Call the Grok API
    const response = await axios.post(endpoint, {
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Process the response
    const grokText = response.data.choices[0]?.text || '';
    
    // Parse the analysis into sections
    const analysis = {
      summary: extractSection(grokText, 'summary', includeMarketAnalysis ? 'market opportunities' : null),
      marketOpportunities: includeMarketAnalysis ? extractSection(grokText, 'market opportunities', 'recommended actions') : null,
      recommendedActions: includeMarketAnalysis ? extractSection(grokText, 'recommended actions') : null
    };
    
    return analysis;
  } catch (error) {
    console.error('Error generating analysis with Grok API:', error);
    
    // Return fallback analysis if API fails
    return {
      summary: "Recent FDA warning letters indicate increased regulatory focus on data integrity, aseptic processing controls, and validation of manufacturing processes. There's a noticeable trend toward stricter enforcement of cGMP requirements, especially for facilities involved in producing critical medications and sterile products.",
      marketOpportunities: includeMarketAnalysis ? "Companies with strong compliance records may find opportunities to fill supply gaps created by competitors' regulatory challenges. The most significant opportunities appear in sterile injectables, complex generics, and testing/validation services sectors where regulatory hurdles have created market constraints." : null,
      recommendedActions: includeMarketAnalysis ? "Companies should consider: 1) Acquiring or expanding capacity in areas affected by competitor warning letters, 2) Developing consulting services focused on remediation of commonly cited deficiencies, 3) Implementing enhanced quality systems that exceed minimum regulatory requirements, 4) Pursuing expedited review pathways for products facing shortage conditions." : null
    };
  }
}

// Helper function to extract sections from Grok API response
function extractSection(text, sectionName, nextSectionName = null) {
  const sectionPattern = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.\\s*)?${sectionName}\\s*:?\\s*\\n`, 'i');
  const match = text.match(sectionPattern);
  
  if (!match) return null;
  
  const startIndex = match.index + match[0].length;
  let endIndex;
  
  if (nextSectionName) {
    const nextSectionPattern = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.\\s*)?${nextSectionName}\\s*:?\\s*\\n`, 'i');
    const nextMatch = text.match(nextSectionPattern);
    endIndex = nextMatch ? nextMatch.index : text.length;
  } else {
    endIndex = text.length;
  }
  
  return text.substring(startIndex, endIndex).trim();
}

// Helper function to format dates
function formatDate(dateString) {
  if (!dateString) return 'Unknown Date';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}




// Helper function to parse Form 483 PDFs
async function parseForm483Pdf(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const data = await pdfParse(response.data);
    return data.text; // Extracted text from PDF
  } catch (error) {
    console.error(`Error parsing PDF from ${url}:`, error.message);
    return 'Unable to parse PDF content';
  }
}

// New endpoint for warning letter-specific summary
app.post('/api/generate-warning-letter-summary', async (req, res) => {
  try {
    const { companies, warningLetters, form483s, maxTokens = 3000, temperature = 0.7 } = req.body;
    const grokApiKey = GROK_API_KEY;
    const grokApiUrl = GROK_API_URL;

    // Validate inputs
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'companies are required' });
    }
    if (!warningLetters || !form483s) {
      return res.status(400).json({ success: false, error: 'warningLetters and form483s are required' });
    }

    console.log(`Generating Grok warning letter summary for companies: ${companies.join(', ')}`);

    // Parse Form 483 PDFs to extract observations
    const form483sWithObservations = await Promise.all(form483s.map(async (form) => {
      const observations = form["Download"] ? await parseForm483Pdf(form["Download"]) : 'No observations available';
      return {
        ...form,
        observations: observations.substring(0, 1000) + (observations.length > 1000 ? '...' : '') // Limit length
      };
    }));

    // Construct detailed prompt for Grok AI
    const prompt = `
      You are tasked with generating an in-depth, professional HTML summary of FDA warning letters and Form 483s for the following pharmaceutical companies: ${companies.join(', ')}. The analysis must be comprehensive, drug-agnostic, and focus on regulatory compliance issues and competitive opportunities. Address the following requirements in detail:

      1. **Link Form 483s to Warning Letters**: Identify specific instances where a Form 483 preceded a warning letter for the same company, including dates, time gaps (in days), and nature of issues. Discuss the severity and implications of these progressions.
      2. **Analyze Form 483-to-Warning Letter Ratio**: Calculate the percentage of Form 483s that escalated to warning letters for each company and overall. Assess regulatory risk (e.g., low, moderate, high) based on escalation rates and issue severity.
      3. **Highlight Manufacturing Issues**: Identify and categorize manufacturing deficiencies from warning letters and Form 483 observations. Provide detailed descriptions, including root causes (if available), impact on operations, and potential market effects. Note limitations if Form 483 observations are incomplete.
      4. **Provide Competitive Insights**: Offer detailed, actionable opportunities for competitors, such as:
         - Offering alternative manufacturing or supply solutions for non-compliant companies.
         - Forming partnerships or compliance consulting services.
         - Targeting customers of non-compliant companies with targeted campaigns.
         - Strategies for compliant companies (e.g., innovation, cost optimization, monitoring).
      5. **Regulatory Trends and Risk Assessment**: Analyze trends in regulatory actions (e.g., increasing scrutiny, common issue types) and assess long-term risks for each company based on their compliance history.

      **Data Provided**:
      - **Warning Letters**: ${JSON.stringify(warningLetters.map(wl => ({
        companyName: wl.companyName,
        letterId: wl.letterId,
        letterIssueDate: wl.letterIssueDate,
        subject: wl.subject,
        fullContent: wl.fullContent?.substring(0, 500) + '...' || 'N/A',
        companyUrl: wl.companyUrl
      })))}
      - **Form 483s**: ${JSON.stringify(form483sWithObservations.map(f => ({
        legalName: f["Legal Name"],
        recordDate: f["Record Date"],
        feiNumber: f["FEI Number"],
        download: f["Download"],
        observations: f.observations
      })))}

      **Output Requirements**:
      - Generate a fully structured HTML summary using Tailwind CSS (CDN: https://cdn.tailwindcss.com) for styling.
      - Include detailed per-company sections and an overall market analysis, with subheadings for regulatory profile, escalation risk, progression, manufacturing issues, competitive opportunities, and trends.
      - Use live, verified links to warning letters (e.g., https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/[letterId]) and Form 483s (use the Download URL).
      - Add a footer with source attribution (e.g., FDA.gov) and timestamp (current date: ${new Date().toISOString()}).
      - Ensure responsive design, clear typography, hover effects, and professional layout with vibrant colors and smooth animations.
      - Verify all data for accuracy and relevance to the companies’ regulatory profiles.

      **Example Structure**:
      <div class="container mx-auto p-4">
        <h1 class="text-3xl font-bold mb-4">Regulatory Compliance Summary</h1>
        <!-- Per-Company Sections -->
        <div class="mt-6">
          <h2 class="text-2xl font-semibold mb-2">Company: [Company Name]</h2>
          <p><strong>Regulatory Profile:</strong> X Form 483s, Y Warning Letters</p>
          <p><strong>Escalation Risk:</strong> Z% of Form 483s escalated ([Risk Level])</p>
          <p><strong>Progression:</strong> <a href="[link]" class="text-blue-600 hover:underline">Form 483 (date)</a> led to <a href="[link]" class="text-blue-600 hover:underline">Warning Letter (date)</a></p>
          <p><strong>Manufacturing Issues:</strong> [Detailed Issues]</p>
          <p><strong>Competitive Opportunities:</strong> [Detailed Strategies]</p>
          <p><strong>Regulatory Trends:</strong> [Trends and Risks]</p>
        </div>
        <!-- Overall Analysis -->
        <div class="mt-6">
          <h2 class="text-2xl font-semibold mb-2">Overall Market Analysis</h2>
          <p><strong>Market Regulatory Profile:</strong> X Form 483s, Y Warning Letters</p>
          <p><strong>Market-Wide Opportunities:</strong> [Detailed Strategies]</p>
          <p><strong>Industry Trends:</strong> [Trends and Risks]</p>
        </div>
        <!-- Footer -->
        <footer class="mt-6 text-sm text-gray-600">
          <p>Sources: <a href="https://www.fda.gov" class="text-blue-600 hover:underline">FDA.gov</a></p>
          <p>Generated on: [Timestamp]</p>
        </footer>
      </div>
    `;

    // Call Grok API
    const response = await axios.post(grokApiUrl, {
      model: "grok-2",
      messages: [
        {
          role: "system",
          content: `You are an advanced AI assistant specializing in FDA regulatory information analysis for pharmaceutical companies. Your task is to create in-depth, visually appealing, and responsive HTML summaries of FDA warning letters and Form 483s, prioritizing critical regulatory insights, manufacturing issues, and actionable competitive opportunities. Use Tailwind CSS for modern UI design with vibrant colors, smooth animations, and professional layout. Ensure all summaries include live, verified links to source documents (e.g., FDA warning letters, Form 483 PDFs) for professional verification. The design must be fully responsive, with hover effects, clear typography, and intuitive navigation. Verify all data for accuracy as of the current date (${new Date().toISOString().split('T')[0]}) and include a footer with source attribution and timestamp.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    }, {
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Extract the HTML summary
    const summary = response.data.choices[0].message.content.trim();

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Grok API error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});





app.post('/api/openai-generate-warning-letter-summary', async (req, res) => {
  const { companies, warningLetters, form483s, maxTokens = 3000, temperature = 0.3 } = req.body;

  if (!companies || !warningLetters || !form483s) {
    return res.status(400).json({ success: false, error: 'Missing required data' });
  }

  try {
    // Combine all inputs into a structured prompt
    const formattedPrompt = `
You are a regulatory AI designed to analyze FDA 483s, Warning Letters, and inspection reports. Based on the following:

**Companies:** ${companies.join(', ')}

**Warning Letters:**
${JSON.stringify(warningLetters, null, 2)}

**Form 483s (Inspections):**
${JSON.stringify(form483s, null, 2)}

Cross-reference these with known compliance risks. Return:
✅ Tailwind-compatible HTML summary  
✅ Cards for critical findings  
✅ Tables for violations by company  
✅ Trends, key risks, and clear, concise summaries ready to inject into the UI.

Respond only with Tailwind-formatted HTML. Do not include additional explanation.
    `.trim();

    // Step 1: Create a thread
    const thread = await openai.beta.threads.create();

    // Step 2: Send message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: formattedPrompt
    });

    // Step 3: Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      instructions: 'Provide only Tailwind-formatted HTML summary ready for frontend display.'
    });

    // Step 4: Poll for completion
    let runStatus = run.status;
    let result;
    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled') {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusCheck = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      runStatus = statusCheck.status;
    }

    if (runStatus !== 'completed') {
      throw new Error('AI processing failed or was cancelled.');
    }

    // Step 5: Retrieve AI response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const aiMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!aiMessage || !aiMessage.content || !aiMessage.content[0]?.text?.value) {
      throw new Error('No valid AI response received');
    }

    res.json({
      success: true,
      summary: aiMessage.content[0].text.value
    });

  } catch (err) {
    console.error('AI Summary Generation Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function searchDrugsForConditionfromdrug(condition) {
  try {
    // Step 1: Normalize condition name for search
    const normalizedCondition = encodeURIComponent(condition.trim().toLowerCase());

    // Step 2: Use RxNorm API to find drugs (we'll search for drugs by condition indirectly)
    // RxNorm doesn't directly map conditions, so we'll use a web search to find drug names first
    const searchUrl = `https://www.drugs.com/search.php?searchterm=${normalizedCondition}`;
    const searchResponse = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // Parse HTML with Cheerio to extract drug names
    const $ = cheerio.load(searchResponse.data);
    const drugs = [];
    $('.ddc-search-results .ddc-media').each((i, element) => {
      const drugName = $(element).find('.ddc-media-content a').text().trim();
      const drugLink = 'https://www.drugs.com' + $(element).find('.ddc-media-content a').attr('href');
      if (drugName) {
        drugs.push({ name: drugName, source: drugLink });
      }
    });

    // Step 3: Enrich drug data with RxNorm API
    const enrichedDrugs = [];
    for (const drug of drugs) {
      try {
        const rxnormUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drug.name)}`;
        const rxnormResponse = await axios.get(rxnormUrl);
        const rxcui = rxnormResponse.data.idGroup.rxnormId ? rxnormResponse.data.idGroup.rxnormId[0] : null;

        if (rxcui) {
          // Fetch additional details (e.g., drug class)
          const drugInfoUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allProperties.json`;
          const drugInfoResponse = await axios.get(drugInfoUrl);
          const properties = drugInfoResponse.data.propConceptGroup?.propConcept || [];
          const drugClass = properties.find(prop => prop.propName === 'RxClass')?.propValue || 'Unknown';

          enrichedDrugs.push({
            name: drug.name,
            rxcui: rxcui,
            drugClass: drugClass,
            condition: condition,
            source: drug.source,
            retrievedAt: new Date().toISOString()
          });
        } else {
          enrichedDrugs.push({
            name: drug.name,
            rxcui: null,
            drugClass: 'Unknown',
            condition: condition,
            source: drug.source,
            retrievedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Error fetching RxNorm data for ${drug.name}:`, error.message);
        enrichedDrugs.push({
          name: drug.name,
          rxcui: null,
          drugClass: 'Unknown',
          condition: condition,
          source: drug.source,
          retrievedAt: new Date().toISOString()
        });
      }
    }

    console.log("drugs : ", enrichedDrugs)
    return enrichedDrugs;
  } catch (error) {
    console.error('Error searching drugs:', error.message);
    throw new Error('Failed to fetch drug data');
  }
}


// Express route to handle condition-to-drugs query
app.post('/api/conditions/drugs', async (req, res) => {
  const { condition } = req.body;

  if (!condition || typeof condition !== 'string') {
    return res.status(400).json({ error: 'Condition name is required and must be a string' });
  }

  try {
    const drugs = await searchDrugsForConditionfromdrug(condition);
    res.json({
      condition,
      drugs,
      total: drugs.length,
      requestId: uuidv4(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drugs', details: error.message });
  }
});

/**
 * Generate FDA summary using OpenAI
 * POST /api/generate-summary
 */
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { prompt, maxTokens, temperature, drugName } = req.body;

    // const GROK_API_URL = ''; // Updated to correct base URL


    const grokApiKey = process.env.grok;
    const grokApiUrl = 'https://api.x.ai/v1/chat/completions'; // Your Grok chat completions URL
    

    
    console.log(`Generating Grok summary for ${drugName}`);
    
    // Prepare the request for Grok API - FIXED to include model field
    const response = await axios.post(grokApiUrl, {
      model: "grok-2", // Add the required model field - update to your specific Grok model name if different
      messages: [
        // {
        //   role: "system",
        //   content: "You are a specialized AI assistant focused on FDA regulatory information analysis. Your task is to create detailed, well-structured HTML summaries of FDA data for pharmaceutical drugs. Focus on critical safety information, organized presentation, and actionable insights."
        // },

        { role: "system", 
          content: "You are an advanced AI assistant specializing in FDA regulatory information analysis for pharmaceutical drugs. Your task is to create visually appealing, highly structured, and responsive HTML summaries of FDA data, prioritizing critical safety information, dosing details, and actionable insights. Enhance the user experience with modern UI design, including vibrant colors, smooth animations, and a professional layout using Tailwind CSS and custom styles. Incorporate a dedicated section for research insights, ensuring all information is 100% accurate with verified, working links to credible sources (e.g., FDA.gov, DailyMed, peer-reviewed journals). Ensure the design is fully responsive across devices, with hover effects, clear typography, and intuitive navigation. Verify all data for accuracy as of the current date and include a footer with source attribution and update timestamp. every metric or data you show in this must be backed up with a live link please that my clients can use to verify the data. Please make sure the links work Please start straight with the code and finish at the end of the code, dont say anthing before of after that souldnt be added to the final dashboard as i will port teh response directly into a website please." 

        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: maxTokens || 1500,
      temperature: temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Extract the response content from Grok API
    const summary = response.data.choices[0].message.content.trim();
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Grok API error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * Email the FDA summary to the user
 * POST /api/email-summary
 */
app.post('/api/email-summary', async (req, res) => {
  try {
    const { email, name, subject, content, drugName } = req.body;
    
    console.log(`Sending summary email to ${email} for ${drugName}`);
    const emailuser = process.env.smtppassword
    const emailhost = process.env.smtphost

    // Create email transporter
    const transporter = nodemailer.createTransport({
      // Your email service configuration
              host:  'smtp.gmail.com',
        port:  587,
        secure: false,
          auth: {
    user: process.env.smtphost,
    pass: process.env.smtppassword
  }
      });
    //   service: 'gmail',
    //   auth: {
    // user: process.env.smtphost,
    // pass: process.env.smtppassword
    //   }
    // });
    
    // Clean up the HTML content to ensure it's email-friendly
    let cleanContent = content;
    
    // Replace Tailwind classes with inline styles for email compatibility
    cleanContent = cleanContent.replace(/class="[^"]*"/g, (match) => {
      let styles = '';
      
      // Convert common Tailwind classes to inline styles
      if (match.includes('text-xl')) styles += 'font-size: 1.25rem; ';
      if (match.includes('font-semibold')) styles += 'font-weight: 600; ';
      if (match.includes('mb-4')) styles += 'margin-bottom: 1rem; ';
      if (match.includes('text-gray-600')) styles += 'color: #4b5563; ';
      if (match.includes('text-gray-700')) styles += 'color: #374151; ';
      if (match.includes('text-blue-800')) styles += 'color: #1e40af; ';
      if (match.includes('bg-blue-50')) styles += 'background-color: #eff6ff; ';
      if (match.includes('p-4')) styles += 'padding: 1rem; ';
      if (match.includes('rounded-lg')) styles += 'border-radius: 0.5rem; ';
      if (match.includes('border')) styles += 'border: 1px solid #e5e7eb; ';
      if (match.includes('border-blue-200')) styles += 'border-color: #bfdbfe; ';
      if (match.includes('grid')) styles += 'display: block; '; // Grids don't work well in email
      
      return styles ? `style="${styles}"` : '';
    });
    
    // Prepare HTML email
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FDA Summary for ${drugName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e40af;
            margin-bottom: 5px;
          }
          .header h2 {
            color: #1e3a8a;
            margin-top: 0;
          }
          .content {
            background-color: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FDA Regulatory Summary</h1>
          <h2>${drugName}</h2>
        </div>
        
        <p>Hello ${name || 'there'},</p>
        
        <p>Here is the FDA regulatory summary you requested for ${drugName}:</p>
        
        <div class="content">
          ${cleanContent}
        </div>
        
        <div class="footer">
          <p>This summary was generated automatically based on FDA data as of ${new Date().toLocaleDateString()}.</p>
          <p><strong>Disclaimer:</strong> This information is provided for informational purposes only and should not be used for clinical decision making. Always consult official FDA documentation and healthcare professionals.</p>
        </div>
      </body>
      </html>
    `;
    
    // Send email
    await transporter.sendMail({
      from: `"FDA Data Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject || `FDA Regulatory Summary for ${drugName}`,
      html: htmlEmail
    });
    
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});




const DB_FILE = 'db.json';

// GET endpoint to read db.json
app.get('/api/db', (req, res) => {
  fs.readFile(DB_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading db.json:', err);
      // If file doesn't exist, create it with a default database
      if (err.code === 'ENOENT') {
        const defaultDb = { searches: {}, lastUpdated: new Date().toISOString() };
        fs.writeFile(DB_FILE, JSON.stringify(defaultDb, null, 2), (writeErr) => {
          if (writeErr) {
            console.error('Error creating db.json:', writeErr);
            return res.status(500).json({ error: 'Failed to create database' });
          }
          console.log('Created db.json with default database');
          return res.json(defaultDb);
        });
      } else {
        return res.status(500).json({ error: 'Failed to read database' });
      }
    } else {
      try {
        const parsedData = JSON.parse(data);
        res.json(parsedData);
      } catch (parseErr) {
        console.error('Error parsing db.json:', parseErr);
        res.status(500).json({ error: 'Invalid database format' });
      }
    }
  });
});

// POST endpoint to write to db.json
app.post('/api/db', (req, res) => {
  const data = req.body;
  // Validate input
  if (!data || typeof data !== 'object' || !data.searches) {
    return res.status(400).json({ error: 'Invalid database structure' });
  }
  fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error writing db.json:', err);
      return res.status(500).json({ error: 'Failed to write database' });
    }
    console.log('Successfully wrote to db.json');
    res.json({ success: true });
  });
});





//////////////////////////////////////// PUB ///////////////////////////////////////////////////////////////////////

// // PubMed E-utilities API constantsconst 
// EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
// const RESULTS_PER_PAGE = 10;
// const NCBI_API_KEY = process.env.NCBI_API_KEY || ''; // Optional: Add your API key if you have one

// // Helper function to parse PubMed XML
// const parseXML = require('xml2js').parseString;

// // PubMed search API endpoint
// app.get('/api/pubmed', async (req, res) => {
//   try {
//     const term = req.query.term;
//     const page = parseInt(req.query.page) || 1;
//     const sortBy = req.query.sortBy || 'relevance';
//     const fullTextOnly = req.query.fullTextOnly === 'true';
    
//     if (!term) {
//       return res.status(400).json({ error: 'Search term is required' });
//     }
    
//     // Calculate start index for pagination
//     const start = (page - 1) * RESULTS_PER_PAGE;
    
//     // Build the search query
//     let searchQuery = term;
//     if (fullTextOnly) {
//       searchQuery += ' AND free full text[filter]';
//     }
    
//     // Sort parameter
//     let sortParam = '';
//     if (sortBy === 'date') {
//       sortParam = '&sort=pub+date+desc';
//     } else if (sortBy === 'citationCount') {
//       sortParam = '&sort=relevance';  // PubMed doesn't directly sort by citations, use relevance as fallback
//     }
    
//     // First, search for IDs using esearch
//     const apiKeyParam = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : '';
//     const searchUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${RESULTS_PER_PAGE}&retstart=${start}${sortParam}&retmode=json${apiKeyParam}`;
    
//     const searchResponse = await axios.get(searchUrl);
//     const searchData = searchResponse.data.esearchresult;
//     const totalResults = parseInt(searchData.count) || 0;
//     const ids = searchData.idlist || [];
    
//     if (ids.length === 0) {
//       return res.json({ articles: [], totalResults: 0 });
//     }
    
//     // Then, fetch details for the IDs using esummary
//     const fetchUrl = `${EUTILS_BASE_URL}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${apiKeyParam}`;
//     const fetchResponse = await axios.get(fetchUrl);
//     const summaryData = fetchResponse.data.result;
    
//     // Process the summaries to format articles
//     const articles = ids.map(pmid => {
//       const summary = summaryData[pmid];
      
//       if (!summary) {
//         return null;
//       }
      
//       // Extract authors
//       const authors = (summary.authors || [])
//         .filter(author => author.authtype === 'Author')
//         .map(author => author.name || '');
      
//       // Extract publication date
//       const pubDate = summary.pubdate || '';
      
//       // Extract journal name
//       const journal = summary.source || '';
      
//       // Extract title
//       const title = summary.title || '';
      
//       // Extract DOI
//       const articleIds = summary.articleids || [];
//       const doi = articleIds.find(id => id.idtype === 'doi')?.value || '';
      
//       return {
//         pmid,
//         title,
//         authors,
//         journal,
//         pubDate,
//         abstract: '', // We'll need to fetch abstracts separately
//         keywords: [], // Keywords typically not in summary
//         doi,
//         citationCount: null, // Not provided by PubMed API
//         fullTextUrl: fullTextOnly ? `https://www.ncbi.nlm.nih.gov/pmc/articles/pmid/${pmid}/` : ''
//       };
//     }).filter(Boolean); // Remove any null entries
    
//     // Optionally fetch abstracts for these articles
//     const abstractsUrl = `${EUTILS_BASE_URL}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml${apiKeyParam}`;
//     const abstractsResponse = await axios.get(abstractsUrl);
    
//     // Parse XML to extract abstracts
//     parseXML(abstractsResponse.data, (err, result) => {
//       if (err) {
//         // If we can't parse abstracts, just return the articles without them
//         return res.json({
//           articles,
//           totalResults
//         });
//       }
      
//       try {
//         // Try to extract abstracts from the XML structure
//         const pubmedArticles = result.PubmedArticleSet?.PubmedArticle || [];
        
//         pubmedArticles.forEach((article, index) => {
//           const abstract = article.MedlineCitation?.[0]?.Article?.[0]?.Abstract?.[0]?.AbstractText || [];
          
//           // Join all abstract sections
//           const abstractText = abstract.map(text => {
//             // If text has attributes, it's a structured abstract
//             if (text.$ && text.$.Label) {
//               return `${text.$.Label}: ${text._}`;
//             }
//             return text;
//           }).join(' ');
          
//           // Extract keywords if available
//           const keywordsList = article.MedlineCitation?.[0]?.MeshHeadingList?.[0]?.MeshHeading || [];
//           const keywords = keywordsList.map(heading => {
//             return heading.DescriptorName?.[0]._ || '';
//           }).filter(Boolean);
          
//           // Update the article with abstract and keywords
//           if (articles[index]) {
//             articles[index].abstract = abstractText || 'No abstract available';
//             articles[index].keywords = keywords;
//           }
//         });
        
//         res.json({
//           articles,
//           totalResults
//         });
//       } catch (error) {
//         // If error parsing detailed XML, return what we have
//         console.error('Error parsing PubMed abstracts:', error);
//         res.json({
//           articles,
//           totalResults
//         });
//       }
//     });
    
//   } catch (error) {
//     console.error('PubMed API error:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch PubMed data',
//       message: error.message 
//     });
//   }
// });
// ===== FDA COMPLETE RESPONSE LETTERS BACKEND IMPLEMENTATION =====
// Add this to your clinicaltrials.js server file



// FDA Complete Response Letter Schema (already provided by user)
const LetterSchema = new mongoose.Schema({
  ndaNumber: String,
  applicationName: String,
  company: {
    name: String,
    contact: String,
    address: String
  },
  letterType: String,
  date: String,
  clinicalFindings: [String],
  studiesReferenced: [String],
  fdaOffice: String,
  fdaContact: String,
  signature: String,
  summary: String,
  rawText: String,
  aiSummary: String,
  aiAnalysis: String,
  aiIndex: [String]
});

const Letter = mongoose.model('Letter', LetterSchema);

// ===== API ROUTES =====
// Enhanced FDA endpoint with recent events filtering
app.get('/api/fda/recent-events/:drugName', async (req, res) => {
  const { drugName } = req.params;
  const days = parseInt(req.query.days) || 365;
  
  try {
    // Use your existing FDA data fetching logic
    const fdaData = await fetchFDAData(drugName);
    
    // Filter for recent events
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentEvents = [];
    
    // Filter enforcement actions by date
    if (fdaData.endpoints.enforcement?.data) {
      fdaData.endpoints.enforcement.data.forEach(enforcement => {
        const reportDate = parseDate(enforcement.report_date);
        if (reportDate && reportDate > cutoffDate) {
          recentEvents.push({
            type: 'enforcement',
            date: reportDate.toISOString().split('T')[0],
            title: `Enforcement: ${enforcement.product_description?.substring(0, 50)}`,
            details: enforcement
          });
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        events: recentEvents,
        count: recentEvents.length,
        period: `${days} days`,
        compound: drugName
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
/**
 * Search FDA Complete Response Letters
 * POST /api/fda/response-letters/search
 */
app.post('/api/fda/response-letters/search', async (req, res) => {
  try {
    const { query, page = 1, limit = 12 } = req.body;
    
    console.log(`🔍 Searching FDA Response Letters for: "${query}"`);
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const searchTerms = query.trim();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit))); // Max 50 per page
    const skip = (pageNum - 1) * limitNum;

    // Build search criteria using MongoDB text search and regex patterns
    const searchCriteria = {
      $or: [
        // Text search on key fields
        { applicationName: { $regex: searchTerms, $options: 'i' } },
        { ndaNumber: { $regex: searchTerms, $options: 'i' } },
        { 'company.name': { $regex: searchTerms, $options: 'i' } },
        { letterType: { $regex: searchTerms, $options: 'i' } },
        { fdaOffice: { $regex: searchTerms, $options: 'i' } },
        { summary: { $regex: searchTerms, $options: 'i' } },
        { aiSummary: { $regex: searchTerms, $options: 'i' } },
        { aiAnalysis: { $regex: searchTerms, $options: 'i' } },
        
        // Search in arrays
        { clinicalFindings: { $elemMatch: { $regex: searchTerms, $options: 'i' } } },
        { studiesReferenced: { $elemMatch: { $regex: searchTerms, $options: 'i' } } },
        { aiIndex: { $elemMatch: { $regex: searchTerms, $options: 'i' } } }
      ]
    };

    // Execute search with pagination
    const [letters, totalCount] = await Promise.all([
      Letter.find(searchCriteria)
        .sort({ date: -1 }) // Sort by most recent first
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better performance
      Letter.countDocuments(searchCriteria)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const pagination = {
      currentPage: pageNum,
      totalPages,
      totalCount,
      pageSize: limitNum,
      hasNextPage,
      hasPrevPage
    };

    console.log(`📄 Found ${totalCount} FDA Response Letters (Page ${pageNum}/${totalPages})`);

    res.json({
      success: true,
      letters,
      pagination,
      query: searchTerms
    });

  } catch (error) {
    console.error('Error searching FDA Response Letters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search FDA Response Letters',
      details: error.message
    });
  }
});

/**
 * Get specific FDA Complete Response Letter by ID
 * GET /api/fda/response-letters/:id
 */
app.get('/api/fda/response-letters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid letter ID'
      });
    }

    const letter = await Letter.findById(id);
    
    if (!letter) {
      return res.status(404).json({
        success: false,
        error: 'Letter not found'
      });
    }

    console.log(`📄 Retrieved FDA Response Letter: ${letter.ndaNumber || id}`);

    res.json({
      success: true,
      letter
    });

  } catch (error) {
    console.error('Error retrieving FDA Response Letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve FDA Response Letter',
      details: error.message
    });
  }
});

/**
 * Search FDA Complete Response Letters by NDA Number
 * GET /api/fda/response-letters/nda/:ndaNumber
 */
app.get('/api/fda/response-letters/nda/:ndaNumber', async (req, res) => {
  try {
    const { ndaNumber } = req.params;
    
    const letters = await Letter.find({ 
      ndaNumber: { $regex: ndaNumber, $options: 'i' } 
    }).sort({ date: -1 });

    console.log(`📄 Found ${letters.length} FDA Response Letters for NDA: ${ndaNumber}`);

    res.json({
      success: true,
      letters,
      ndaNumber,
      count: letters.length
    });

  } catch (error) {
    console.error('Error searching FDA Response Letters by NDA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search FDA Response Letters by NDA',
      details: error.message
    });
  }
});

/**
 * Search FDA Complete Response Letters by Company
 * GET /api/fda/response-letters/company/:companyName
 */
app.get('/api/fda/response-letters/company/:companyName', async (req, res) => {
  try {
    const { companyName } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const searchCriteria = {
      'company.name': { $regex: companyName, $options: 'i' }
    };

    const [letters, totalCount] = await Promise.all([
      Letter.find(searchCriteria)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum),
      Letter.countDocuments(searchCriteria)
    ]);

    const pagination = {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
      pageSize: limitNum,
      hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
      hasPrevPage: pageNum > 1
    };

    console.log(`📄 Found ${totalCount} FDA Response Letters for company: ${companyName}`);

    res.json({
      success: true,
      letters,
      pagination,
      companyName
    });

  } catch (error) {
    console.error('Error searching FDA Response Letters by company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search FDA Response Letters by company',
      details: error.message
    });
  }
});

/**
 * Get FDA Complete Response Letters statistics
 * GET /api/fda/response-letters/stats
 */
app.get('/api/fda/response-letters/stats', async (req, res) => {
  try {
    console.log('📊 Generating FDA Response Letters statistics...');

    const [
      totalLetters,
      lettersByType,
      lettersByOffice,
      recentLetters,
      topCompanies
    ] = await Promise.all([
      // Total count
      Letter.countDocuments(),
      
      // Group by letter type
      Letter.aggregate([
        { $group: { _id: '$letterType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Group by FDA office
      Letter.aggregate([
        { $group: { _id: '$fdaOffice', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Recent letters (last 30 days)
      Letter.countDocuments({
        date: { 
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() 
        }
      }),
      
      // Top companies by letter count
      Letter.aggregate([
        { $group: { _id: '$company.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const stats = {
      totalLetters,
      lettersByType: lettersByType.map(item => ({
        type: item._id || 'Unknown',
        count: item.count
      })),
      lettersByOffice: lettersByOffice.map(item => ({
        office: item._id || 'Unknown',
        count: item.count
      })),
      recentLetters,
      topCompanies: topCompanies.map(item => ({
        company: item._id || 'Unknown',
        count: item.count
      }))
    };

    console.log(`📊 Generated stats for ${totalLetters} FDA Response Letters`);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error generating FDA Response Letters statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate statistics',
      details: error.message
    });
  }
});

/**
 * Advanced search with filters
 * POST /api/fda/response-letters/search/advanced
 */
app.post('/api/fda/response-letters/search/advanced', async (req, res) => {
  try {
    const {
      query,
      letterType,
      fdaOffice,
      companyName,
      dateFrom,
      dateTo,
      hasClinicalFindings,
      hasStudiesReferenced,
      page = 1,
      limit = 12,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.body;

    console.log(`🔍 Advanced search FDA Response Letters with filters`);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build search criteria
    const searchCriteria = {};

    // Text search
    if (query && query.trim()) {
      searchCriteria.$or = [
        { applicationName: { $regex: query, $options: 'i' } },
        { ndaNumber: { $regex: query, $options: 'i' } },
        { 'company.name': { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } },
        { aiSummary: { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by letter type
    if (letterType) {
      searchCriteria.letterType = { $regex: letterType, $options: 'i' };
    }

    // Filter by FDA office
    if (fdaOffice) {
      searchCriteria.fdaOffice = { $regex: fdaOffice, $options: 'i' };
    }

    // Filter by company
    if (companyName) {
      searchCriteria['company.name'] = { $regex: companyName, $options: 'i' };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      searchCriteria.date = {};
      if (dateFrom) searchCriteria.date.$gte = dateFrom;
      if (dateTo) searchCriteria.date.$lte = dateTo;
    }

    // Filter by presence of clinical findings
    if (hasClinicalFindings !== undefined) {
      if (hasClinicalFindings) {
        searchCriteria.clinicalFindings = { $exists: true, $ne: [] };
      } else {
        searchCriteria.$or = [
          { clinicalFindings: { $exists: false } },
          { clinicalFindings: { $size: 0 } }
        ];
      }
    }

    // Filter by presence of referenced studies
    if (hasStudiesReferenced !== undefined) {
      if (hasStudiesReferenced) {
        searchCriteria.studiesReferenced = { $exists: true, $ne: [] };
      } else {
        searchCriteria.$or = [
          { studiesReferenced: { $exists: false } },
          { studiesReferenced: { $size: 0 } }
        ];
      }
    }

    // Build sort criteria
    const sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute search
    const [letters, totalCount] = await Promise.all([
      Letter.find(searchCriteria)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Letter.countDocuments(searchCriteria)
    ]);

    const pagination = {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
      pageSize: limitNum,
      hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
      hasPrevPage: pageNum > 1
    };

    console.log(`📄 Advanced search found ${totalCount} FDA Response Letters`);

    res.json({
      success: true,
      letters,
      pagination,
      filters: {
        query,
        letterType,
        fdaOffice,
        companyName,
        dateFrom,
        dateTo,
        hasClinicalFindings,
        hasStudiesReferenced
      }
    });

  } catch (error) {
    console.error('Error in advanced search FDA Response Letters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform advanced search',
      details: error.message
    });
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Function to integrate FDA Response Letters search with existing search context
 * Call this from your existing search functions to automatically populate the Response Letters tab
 */
async function searchFDAResponseLettersForContext(drugName, companyName = '') {
  try {
    if (!drugName && !companyName) return { letters: [], count: 0 };

    const searchQuery = [drugName, companyName].filter(Boolean).join(' ');
    
    const letters = await Letter.find({
      $or: [
        { applicationName: { $regex: searchQuery, $options: 'i' } },
        { 'company.name': { $regex: searchQuery, $options: 'i' } },
        { aiIndex: { $elemMatch: { $regex: searchQuery, $options: 'i' } } }
      ]
    })
    .sort({ date: -1 })
    .limit(20)
    .lean();

    return {
      letters,
      count: letters.length,
      searchQuery
    };

  } catch (error) {
    console.error('Error searching FDA Response Letters for context:', error);
    return { letters: [], count: 0 };
  }
}

// ===== INTEGRATION WITH EXISTING SEARCH =====

/**
 * Modify your existing drug search endpoint to include FDA Response Letters
 * Add this to your existing search function or create a new comprehensive search endpoint
 */
app.post('/api/comprehensive-search', async (req, res) => {
  try {
    const { drugName, companyName } = req.body;
    
    console.log(`🔍 Comprehensive search for: ${drugName} ${companyName}`);

    // Your existing search logic here...
    // const clinicalTrialsData = await searchClinicalTrials(drugName);
    // const fdaData = await searchFDAData(drugName);
    
    // Add FDA Response Letters search
    const responseLettersData = await searchFDAResponseLettersForContext(drugName, companyName);

    res.json({
      success: true,
      data: {
        // clinicalTrials: clinicalTrialsData,
        // fda: fdaData,
        responseLetters: responseLettersData
      }
    });

  } catch (error) {
    console.error('Error in comprehensive search:', error);
    res.status(500).json({
      success: false,
      error: 'Comprehensive search failed',
      details: error.message
    });
  }
});

console.log('✅ FDA Complete Response Letters routes initialized');



// PubMed E-utilities API constants
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const RESULTS_PER_PAGE = 10;
const nAPI_KEY = process.env.NCBI_API_KEY || ''; // Optional: Add your API key if you have one
const xml2js = require('xml2js'); 

// PubMed search API endpoint
/**
 * Endpoint to get PubMed publications
 */
// app.get('/api/pubmed', async (req, res) => {
//   try {
//     const term = req.query.term;
//     if (!term) {
//       return res.status(400).json({ error: 'Search term is required' });
//     }
    
//     console.log(`🔍 Fetching PubMed publications for: ${term}`);
    
//     // Call your existing function
//     const publications = await PubMed.searchPublications(term);
    
//     // Format response to match what frontend expects
//     res.json({
//       articles: publications, // Your publications array goes directly here
//       totalResults: publications.length // Or the actual total count if available
//     });
//   } catch (error) {
//     console.error('PubMed API error:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch PubMed data',
//       message: error.message 
//     });
//   }
// });

//////////////////////////////////////// 483 ///////////////////////////////////




// app.get('/api/inspection-data', (req, res) => {
//   try {
//     // Define paths to CSV files
//     const file1Path = path.join(__dirname, 'data/e18f4f87-a73a-42c6-ae4e-9a3b76245bdc.csv');
//     const file2Path = path.join(__dirname, 'data/NonClinical_Labs_Inspections_List_(10-1-2000_through_10-1-2024).csv');
    
//     const recentInspections = [];
//     const historicalInspections = [];
//     const projectAreasSet = new Set();
    
//     // Helper function to read a CSV file and process its rows
//     const readCSV = (filePath, dataArray, processRow) => {
//       return new Promise((resolve, reject) => {
//         fs.createReadStream(filePath)
//           .on('error', (err) => {
//             console.warn(`Warning: Could not read CSV file (${filePath}):`, err.message);
//             resolve([]); // Return empty array as fallback
//           })
//           .pipe(csv())
//           .on('data', (row) => {
//             const processedRow = processRow(row);
//             if (processedRow) dataArray.push(processedRow);
//           })
//           .on('end', () => {
//             resolve(dataArray);
//           });
//       });
//     };
    
//     // Process recent inspections (file 1)
//     const processRecentInspections = async () => {
//       await readCSV(file1Path, recentInspections, (row) => {
//         // Process the row according to expected structure
//         return {
//           "Record Date": row["Record Date"],
//           "Legal Name": row["Legal Name"],
//           "Record Type": row["Record Type"],
//           "FEI Number": row["FEI Number"],
//           "Download": row["Download"]
//         };
//       });
//     };
    
// // Process historical inspections (file 2)
// const processHistoricalInspections = async () => {
//   await readCSV(file2Path, historicalInspections, (row) => {
//     // Match the exact structure from the provided CSV
//     const processedRow = {
//       "District": row["District"],
//       "Firm Name": row["Firm Name"],
//       "City": row["City"],
//       "State": row["State"],
//       "Zip": row["Zip"],
//       "Country/Area": row["Country/Area"],
//       "Inspection End Date": row["Inspection End Date"],
//       "Project Area": row["Project Area"],
//       "Center/Program Area": row["Center/Program Area"],
//       "Inspection Classification": row["Inspection Classification"]
//     };
    
//     // Add to project areas collection
//     if (processedRow["Project Area"]) {
//       projectAreasSet.add(processedRow["Project Area"]);
//     }
//     console.log(processedRow)
//     return processedRow;
//   });
// };
//     // Process both files and return response
//     Promise.all([processRecentInspections(), processHistoricalInspections()])
//       .then(() => {
//         // If no data was loaded, provide sample data
//         if (recentInspections.length === 0) {
//           recentInspections.push({
//             "Record Date": "2023-01-01",
//             "Legal Name": "Sample Pharmaceutical",
//             "Record Type": "Form 483",
//             "FEI Number": 12345
//           });
//         }
        
//         if (historicalInspections.length === 0) {
//           historicalInspections.push({
//             "District": "Sample District",
//             "Firm Name": "Sample Labs",
//             "City": "Sample City",
//             "State": "CA", 
//             "Zip": "90210",
//             "Country/Area": "United States",
//             "Inspection End Date": "10/15/2022",
//             "Project Area": "Quality Control",
//             "Center/Program Area": "CDER",
//             "Inspection Classification": "NAI"
//           });
          
//           projectAreasSet.add("Quality Control");
//           projectAreasSet.add("Manufacturing");
//         }
        
//         res.json({
//           recentInspections: recentInspections,
//           historicalInspections: historicalInspections,
//           projectAreas: Array.from(projectAreasSet)
//         });
//       })
//       .catch(err => {
//         console.error("Error processing CSV data:", err);
//         res.status(500).json({ error: 'Failed to process CSV data', details: err.message });
//       });
    
//   } catch (error) {
//     console.error('Error in API endpoint:', error);
//     res.status(500).json({ error: 'Failed to process inspection data', details: error.message });
//   }
// });

// ===================================================================
// FDA INSPECTION API INTEGRATION - Add to your existing clinicaltrials.js
// Add this code to your existing server file (after your warning letters routes)
// ===================================================================

// Helper function to fetch all pages from FDA API
async function fetchAllPages(endpoint, requestBody, headers, maxRows = null) {
  const allResults = [];
  let currentStart = 1;
  const pageSize = 5000; // FDA API maximum
  let hasMoreData = true;
  let totalFetched = 0;

  while (hasMoreData) {
    try {
      // Update request with current pagination
      const paginatedRequest = {
        ...requestBody,
        start: currentStart,
        rows: pageSize,
        returntotalcount: currentStart === 1 // Only get total count on first request
      };

      console.log(`Fetching ${endpoint} - page starting at row ${currentStart}`);

      const response = await axios.post(endpoint, paginatedRequest, { headers });

      if (response.data.statuscode === 400 && response.data.result) {
        const results = response.data.result;
        allResults.push(...results);
        totalFetched += results.length;

        // Check if we have a total count to know when to stop
        const totalRecords = response.data.totalrecordcount;
        
        // Determine if there's more data to fetch
        if (results.length < pageSize) {
          // We got less than a full page, so we're done
          hasMoreData = false;
        } else if (totalRecords && totalFetched >= totalRecords) {
          // We've fetched all available records
          hasMoreData = false;
        } else if (maxRows && totalFetched >= maxRows) {
          // We've reached the maximum requested rows
          hasMoreData = false;
        } else {
          // Move to next page
          currentStart += pageSize;
        }

        console.log(`Fetched ${results.length} records (total so far: ${totalFetched})`);
      } else {
        console.error(`Unexpected response status: ${response.data.statuscode}`);
        break;
      }
    } catch (error) {
      console.error(`Error fetching page at start=${currentStart}:`, error.message);
      throw error;
    }
  }

  console.log(`Total records fetched from ${endpoint}: ${allResults.length}`);
  return allResults;
}

// Main FDA inspection data endpoint - supports company search
// Fixed FDA inspection data endpoint
// Fixed FDA inspection data endpoint
// FIXED FDA inspection data endpoint with correct column names
app.get('/api/inspection-data', async (req, res) => {
  try {
    const { company, feiNumber } = req.query;
    
    if (!process.env.FDA_API_USER || !process.env.FDA_API_KEY) {
      console.error('FDA API credentials not configured');
      return res.status(500).json({
        error: 'FDA API credentials not configured',
        details: 'Please set FDA_API_USER and FDA_API_KEY in your .env file'
      });
    }

    const FDA_API_BASE_URL = 'https://api-datadashboard.fda.gov/v1';
    const FDA_API_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization-User': process.env.FDA_API_USER,
      'Authorization-Key': process.env.FDA_API_KEY
    };

    const recentInspections = [];
    const historicalInspections = [];
    const projectAreasSet = new Set();
    
    // Helper function to fetch all pages
    async function fetchAllPages(endpoint, requestBody, headers) {
      const allResults = [];
      let currentPage = 1;
      const perPage = 1000;
      let hasMore = true;

      while (hasMore) {
        try {
          const pageRequestBody = {
            ...requestBody,
            start: (currentPage - 1) * perPage + 1,
            rows: perPage
          };

          console.log(`Fetching ${endpoint} - page starting at row ${pageRequestBody.start}`);
          
          const response = await axios.post(endpoint, pageRequestBody, { headers });
          
          if (response.data.statuscode === 400 && response.data.result) {
            const pageResults = response.data.result;
            allResults.push(...pageResults);
            
            console.log(`Found ${pageResults.length} results (batch ${currentPage})`);
            
            if (pageResults.length < perPage) {
              hasMore = false;
            } else {
              currentPage++;
            }
          } else {
            console.log('No more results or unexpected response format');
            hasMore = false;
          }
        } catch (error) {
          console.error(`Error fetching page at start=${(currentPage - 1) * perPage + 1}:`, error.message);
          if (error.response?.data) {
            console.error('FDA API Error:', error.response.data);
          }
          hasMore = false;
        }
      }

      console.log(`Found ${allResults.length} total results`);
      return allResults;
    }
    
    // Build filters with fuzzy matching
    const buildFilters = (baseFilters = {}) => {
      const filters = { ...baseFilters };
      
      if (company) {
        const companyVariations = generateCompanyVariations(company);
        filters.LegalName = companyVariations;
        console.log('Searching with company variations:', companyVariations);
      }
      
      if (feiNumber) {
        filters.FEINumber = [parseInt(feiNumber)];
      }
      
      return filters;
    };

    // Generate company name variations
    function generateCompanyVariations(companyName) {
      const variations = new Set();
      const base = companyName.trim();
      
      variations.add(base);
      
      const withoutSuffixes = base
        .replace(/\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL|GLOBAL|GROUP|HOLDINGS)\.?$/gi, '')
        .trim();
      
      if (withoutSuffixes !== base && withoutSuffixes.length > 2) {
        variations.add(withoutSuffixes);
      }
      
      // Add wildcards for partial matching
      variations.add(`${withoutSuffixes}*`);
      variations.add(`*${withoutSuffixes}*`);
      
      const firstWord = base.split(/\s+/)[0];
      if (firstWord.length > 3) {
        variations.add(firstWord);
        variations.add(`${firstWord}*`);
      }
      
      if (base.includes('PHARMS')) {
        variations.add(base.replace(/PHARMS/gi, 'PHARMACEUTICALS'));
      }
      
      return Array.from(variations);
    }

    try {
      // Build filters for citations
      const citationFilters = buildFilters({
        "InspectionEndDateFrom": [new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
      });
      
      // FIXED: Citations endpoint columns
      const citationsRequestBody = {
        "sort": "InspectionEndDate",
        "sortorder": "DESC",
        "filters": citationFilters,
        "columns": [
          "InspectionEndDate",
          "FEINumber",
          "LegalName",
          "CitationID",
          "InspectionID",
          "ShortDescription",
          "LongDescription"
        ]
      };

      console.log('Fetching citations...');
      
      let allCitations = [];
      try {
        allCitations = await fetchAllPages(
          `${FDA_API_BASE_URL}/inspections_citations`,
          citationsRequestBody,
          FDA_API_HEADERS
        );
      } catch (citationError) {
        console.log('Citations endpoint failed, will try classifications only');
      }

      // Process citations data
      allCitations.forEach(row => {
        recentInspections.push({
          "Record Date": row.InspectionEndDate,
          "Legal Name": row.LegalName,
          "Record Type": "Citation",
          "FEI Number": row.FEINumber,
          "Download": row.CitationID,
          "Description": row.ShortDescription || row.LongDescription || "N/A"
        });
      });

      // Build filters for classifications
      const classificationFilters = buildFilters({});
      
      // FIXED: Classifications endpoint columns - removed invalid fields
      const classificationsRequestBody = {
        "sort": "InspectionEndDate",
        "sortorder": "DESC",
        "filters": classificationFilters,
        "columns": [
          "LegalName",
          "City",
          "State",
          "CountryName",
          "InspectionEndDate",
          "ProductType",
          "Classification",
          "FEINumber",
          "InspectionID"
          // REMOVED: "DistrictName", "Zip", "Program" - these are not valid
        ]
      };

      console.log('Fetching classifications...');
      const allClassifications = await fetchAllPages(
        `${FDA_API_BASE_URL}/inspections_classifications`,
        classificationsRequestBody,
        FDA_API_HEADERS
      );

      // Process classifications data
      allClassifications.forEach(row => {
        const processedRow = {
          "District": "N/A", // Not available in this endpoint
          "Firm Name": row.LegalName,
          "City": row.City,
          "State": row.State,
          "Zip": "N/A", // Not available in this endpoint
          "Country/Area": row.CountryName,
          "Inspection End Date": row.InspectionEndDate,
          "Project Area": row.ProductType || "N/A", // Using ProductType instead of Program
          "Center/Program Area": row.ProductType || "N/A",
          "Inspection Classification": row.Classification,
          "FEI Number": row.FEINumber
        };
        
        historicalInspections.push(processedRow);
        
        if (row.ProductType) {
          projectAreasSet.add(row.ProductType);
        }
      });

      console.log(`Total recent inspections (citations): ${recentInspections.length}`);
      console.log(`Total historical inspections (classifications): ${historicalInspections.length}`);
      console.log(`Total unique project areas: ${projectAreasSet.size}`);

      // If no results found, try alternative search
      if (recentInspections.length === 0 && historicalInspections.length === 0 && company) {
        console.log('No results found with exact match, trying broader search...');
        
        const firstWord = company.trim().split(/\s+/)[0];
        const broaderFilters = {
          LegalName: [firstWord, `${firstWord}*`, `*${firstWord}*`]
        };
        
        const broaderRequestBody = {
          ...classificationsRequestBody,
          filters: broaderFilters,
          rows: 100
        };
        
        try {
          const broaderResults = await fetchAllPages(
            `${FDA_API_BASE_URL}/inspections_classifications`,
            broaderRequestBody,
            FDA_API_HEADERS
          );
          
          if (broaderResults.length > 0) {
            console.log(`Found ${broaderResults.length} results with broader search`);
            broaderResults.forEach(row => {
              const processedRow = {
                "District": "N/A",
                "Firm Name": row.LegalName,
                "City": row.City,
                "State": row.State,
                "Zip": "N/A",
                "Country/Area": row.CountryName,
                "Inspection End Date": row.InspectionEndDate,
                "Project Area": row.ProductType || "N/A",
                "Center/Program Area": row.ProductType || "N/A",
                "Inspection Classification": row.Classification,
                "FEI Number": row.FEINumber
              };
              
              historicalInspections.push(processedRow);
              
              if (row.ProductType) {
                projectAreasSet.add(row.ProductType);
              }
            });
          }
        } catch (broaderError) {
          console.error('Broader search also failed:', broaderError.message);
        }
      }

    } catch (apiError) {
      console.error('FDA API Error:', apiError.response?.data || apiError.message);
      
      return res.status(500).json({
        error: 'FDA API request failed',
        details: apiError.response?.data || apiError.message,
        suggestion: 'Try searching with just the first word of the company name',
        searchTerm: company
      });
    }

    // Return response
    res.json({
      recentInspections: recentInspections,
      historicalInspections: historicalInspections,
      projectAreas: Array.from(projectAreasSet),
      summary: {
        totalRecent: recentInspections.length,
        totalHistorical: historicalInspections.length,
        searchCriteria: {
          company: company || null,
          feiNumber: feiNumber || null
        }
      }
    });

  } catch (error) {
    console.error('Error in API endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process inspection data', 
      details: error.message 
    });
  }
});

// Health check endpoint for FDA API
app.get('/api/fda-api-status', async (req, res) => {
  try {
    const FDA_API_BASE_URL = 'https://api-datadashboard.fda.gov/v1';
    const FDA_API_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization-User': process.env.FDA_API_USER,
      'Authorization-Key': process.env.FDA_API_KEY
    };

    // Test with a minimal request
    const response = await axios.post(
      `${FDA_API_BASE_URL}/inspections_classifications`,
      {
        "start": 1,
        "rows": 1,
        "sort": "",
        "sortorder": "",
        "filters": {},
        "columns": ["FEINumber"]
      },
      { headers: FDA_API_HEADERS }
    );

    res.json({
      status: 'connected',
      fdaApiStatus: response.data.statuscode,
      message: response.data.message,
      authConfigured: !!(process.env.FDA_API_USER && process.env.FDA_API_KEY)
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.response?.data?.message || error.message,
      authConfigured: !!(process.env.FDA_API_USER && process.env.FDA_API_KEY),
      details: error.response?.data
    });
  }
});

// Company search endpoint - returns company names and FEI numbers
app.get('/api/search-companies', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long'
      });
    }

    const FDA_API_BASE_URL = 'https://api-datadashboard.fda.gov/v1';
    const FDA_API_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization-User': process.env.FDA_API_USER,
      'Authorization-Key': process.env.FDA_API_KEY
    };

    // Search for companies in classifications
    const searchRequest = {
      "start": 1,
      "rows": 100, // Limit results for search
      "sort": "LegalName",
      "sortorder": "ASC",
      "filters": {
        "LegalName": [query]
      },
      "columns": ["LegalName", "FEINumber", "City", "State", "CountryName"]
    };

    console.log(`Searching for companies matching: "${query}"`);

    const response = await axios.post(
      `${FDA_API_BASE_URL}/inspections_classifications`,
      searchRequest,
      { headers: FDA_API_HEADERS }
    );

    if (response.data.statuscode === 400 && response.data.result) {
      // Remove duplicates based on FEI Number
      const uniqueCompanies = new Map();
      response.data.result.forEach(company => {
        if (!uniqueCompanies.has(company.FEINumber)) {
          uniqueCompanies.set(company.FEINumber, {
            legalName: company.LegalName,
            feiNumber: company.FEINumber,
            location: `${company.City || ''}, ${company.State || ''} ${company.CountryName || ''}`.trim()
          });
        }
      });

      res.json({
        results: Array.from(uniqueCompanies.values()),
        count: uniqueCompanies.size,
        query: query
      });
    } else {
      res.json({
        results: [],
        count: 0,
        query: query
      });
    }

  } catch (error) {
    console.error('Company search error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to search companies',
      details: error.message
    });
  }
});

// Get specific company details
app.get('/api/company/:feiNumber', async (req, res) => {
  try {
    const { feiNumber } = req.params;
    
    const FDA_API_BASE_URL = 'https://api-datadashboard.fda.gov/v1';
    const FDA_API_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization-User': process.env.FDA_API_USER,
      'Authorization-Key': process.env.FDA_API_KEY
    };

    // Get all information for a specific FEI Number
    const [citations, classifications] = await Promise.all([
      // Get citations
      axios.post(
        `${FDA_API_BASE_URL}/inspections_citations`,
        {
          "start": 1,
          "rows": 5000,
          "sort": "InspectionEndDate",
          "sortorder": "DESC",
          "filters": {
            "FEINumber": [parseInt(feiNumber)]
          },
          "columns": []
        },
        { headers: FDA_API_HEADERS }
      ),
      // Get classifications
      axios.post(
        `${FDA_API_BASE_URL}/inspections_classifications`,
        {
          "start": 1,
          "rows": 5000,
          "sort": "InspectionEndDate",
          "sortorder": "DESC",
          "filters": {
            "FEINumber": [parseInt(feiNumber)]
          },
          "columns": []
        },
        { headers: FDA_API_HEADERS }
      )
    ]);

    const companyData = {
      feiNumber: feiNumber,
      companyName: '',
      citations: [],
      inspections: [],
      summary: {
        totalInspections: 0,
        totalCitations: 0,
        latestInspection: null,
        inspectionTypes: new Set()
      }
    };

    // Process citations
    if (citations.data.statuscode === 400 && citations.data.result) {
      companyData.citations = citations.data.result;
      companyData.summary.totalCitations = citations.data.result.length;
      if (citations.data.result.length > 0) {
        companyData.companyName = citations.data.result[0].LegalName;
      }
    }

    // Process classifications
    if (classifications.data.statuscode === 400 && classifications.data.result) {
      companyData.inspections = classifications.data.result;
      companyData.summary.totalInspections = classifications.data.result.length;
      
      if (classifications.data.result.length > 0) {
        companyData.companyName = companyData.companyName || classifications.data.result[0].LegalName;
        companyData.summary.latestInspection = classifications.data.result[0].InspectionEndDate;
        
        classifications.data.result.forEach(inspection => {
          if (inspection.Classification) {
            companyData.summary.inspectionTypes.add(inspection.Classification);
          }
        });
      }
    }

    companyData.summary.inspectionTypes = Array.from(companyData.summary.inspectionTypes);

    res.json(companyData);

  } catch (error) {
    console.error('Company details error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get company details',
      details: error.message
    });
  }
});


/////////////////////////////////////WL///////////////////////////////////////////////
app.get('/api/wl/stats', (req, res) => {
  try {
    // Count total letters
    const totalLetters = warningLetters.length;

    // Find date range
    const dates = warningLetters
      .map(letter => letter.letterIssueDate)
      .filter(date => date && date.trim() !== '')
      .sort();

    const dateRange = {
      earliest: dates[0] || 'Unknown',
      latest: dates[dates.length - 1] || 'Unknown'
    };

    // Count by issuing office
    const officeCount = {};
    warningLetters.forEach(letter => {
      const office = letter.issuingOffice || 'Unknown';
      officeCount[office] = (officeCount[office] || 0) + 1;
    });

    // Get top issuing offices
    const topOffices = Object.entries(officeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([office, count]) => ({ office, count }));

    // Get recent letters
    const recentLetters = warningLetters
      .sort((a, b) => {
        const dateA = new Date(a.letterIssueDate || 0);
        const dateB = new Date(b.letterIssueDate || 0);
        return dateB - dateA;
      })
      .slice(0, 10)
      .map(letter => ({
        id: letter.id || letter.letterId,
        letterIssueDate: letter.letterIssueDate,
        companyName: letter.companyName,
        subject: letter.subject
      }));

    res.json({
      totalLetters,
      dateRange,
      topOffices,
      recentLetters
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Search for warning letters
app.get('/api/wl/search', (req, res) => {
  try {
    const {
      term = '',
      field = 'all',
      dateFrom = '',
      dateTo = '',
      page = 1,
      perPage = 20
    } = req.query;

    const pageNum = parseInt(page);
    const itemsPerPage = parseInt(perPage);

    // Filter letters based on search criteria
    let filteredLetters = [...warningLetters];

    // Filter by search term
    if (term.trim()) {
      const searchTerm = term.toLowerCase();
      
      if (field === 'company') {
        filteredLetters = filteredLetters.filter(letter => 
          letter.companyName && letter.companyName.toLowerCase().includes(searchTerm)
        );
      } else if (field === 'subject') {
        filteredLetters = filteredLetters.filter(letter => 
          letter.subject && letter.subject.toLowerCase().includes(searchTerm)
        );
      } else if (field === 'content') {
        filteredLetters = filteredLetters.filter(letter => 
          letter.fullContent && letter.fullContent.toLowerCase().includes(searchTerm)
        );
      } else {
        // Search all fields
        filteredLetters = filteredLetters.filter(letter => 
          (letter.companyName && letter.companyName.toLowerCase().includes(searchTerm)) ||
          (letter.subject && letter.subject.toLowerCase().includes(searchTerm)) ||
          (letter.fullContent && letter.fullContent.toLowerCase().includes(searchTerm))
        );
      }
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredLetters = filteredLetters.filter(letter => {
        if (!letter.letterIssueDate) return false;
        return new Date(letter.letterIssueDate) >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredLetters = filteredLetters.filter(letter => {
        if (!letter.letterIssueDate) return false;
        return new Date(letter.letterIssueDate) <= toDate;
      });
    }

    // Sort by date (most recent first)
    filteredLetters.sort((a, b) => {
      const dateA = new Date(a.letterIssueDate || 0);
      const dateB = new Date(b.letterIssueDate || 0);
      return dateB - dateA;
    });

    // Calculate pagination
    const totalResults = filteredLetters.length;
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    
    // Slice the results for current page
    const startIndex = (pageNum - 1) * itemsPerPage;
    const paginatedLetters = filteredLetters.slice(startIndex, startIndex + itemsPerPage);

    // Format results for response
    const results = paginatedLetters.map(letter => ({
      id: letter.id || letter.letterId,
      letterId: letter.letterId,
      letterIssueDate: letter.letterIssueDate,
      companyName: letter.companyName,
      issuingOffice: letter.issuingOffice,
      subject: letter.subject,
      companyUrl: letter.companyUrl,
      excerpt: letter.excerpt || (letter.fullContent ? letter.fullContent.substring(0, 200) + '...' : '')
    }));

    res.json({
      results,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalResults,
        perPage: itemsPerPage
      }
    });
  } catch (error) {
    console.error('Error searching letters:', error);
    res.status(500).json({ error: 'Failed to search warning letters' });
  }
});

// Get a specific warning letter
app.get('/api/wl/letter/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find letter by ID
    const letter = warningLetters.find(l => 
      l.id === id || l.letterId === id
    );

    if (!letter) {
      return res.status(404).json({ error: 'Warning letter not found' });
    }

    res.json(letter);
  } catch (error) {
    console.error('Error getting letter details:', error);
    res.status(500).json({ error: 'Failed to get letter details' });
  }
});

// Advanced search with multiple terms
app.post('/api/wl/advanced-search', (req, res) => {
  try {
    const { terms, operator = 'AND', page = 1, perPage = 20 } = req.body;
    
    if (!terms || !Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ error: 'Search terms are required' });
    }

    const pageNum = parseInt(page);
    const itemsPerPage = parseInt(perPage);

    // Perform search
    let filteredLetters = [...warningLetters];

    if (operator.toUpperCase() === 'AND') {
      // ALL terms must match
      terms.forEach(term => {
        const searchTerm = term.toLowerCase();
        filteredLetters = filteredLetters.filter(letter => 
          (letter.companyName && letter.companyName.toLowerCase().includes(searchTerm)) ||
          (letter.subject && letter.subject.toLowerCase().includes(searchTerm)) ||
          (letter.fullContent && letter.fullContent.toLowerCase().includes(searchTerm))
        );
      });
    } else {
      // ANY term can match (OR)
      filteredLetters = filteredLetters.filter(letter => 
        terms.some(term => {
          const searchTerm = term.toLowerCase();
          return (letter.companyName && letter.companyName.toLowerCase().includes(searchTerm)) ||
            (letter.subject && letter.subject.toLowerCase().includes(searchTerm)) ||
            (letter.fullContent && letter.fullContent.toLowerCase().includes(searchTerm));
        })
      );
    }

    // Sort by date (most recent first)
    filteredLetters.sort((a, b) => {
      const dateA = new Date(a.letterIssueDate || 0);
      const dateB = new Date(b.letterIssueDate || 0);
      return dateB - dateA;
    });

    // Calculate pagination
    const totalResults = filteredLetters.length;
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    
    // Slice the results for current page
    const startIndex = (pageNum - 1) * itemsPerPage;
    const paginatedLetters = filteredLetters.slice(startIndex, startIndex + itemsPerPage);

    // Format results for response
    const results = paginatedLetters.map(letter => ({
      id: letter.id || letter.letterId,
      letterId: letter.letterId,
      letterIssueDate: letter.letterIssueDate,
      companyName: letter.companyName,
      issuingOffice: letter.issuingOffice,
      subject: letter.subject,
      companyUrl: letter.companyUrl,
      excerpt: letter.excerpt || (letter.fullContent ? letter.fullContent.substring(0, 200) + '...' : '')
    }));

    res.json({
      results,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalResults,
        perPage: itemsPerPage
      }
    });
  } catch (error) {
    console.error('Error performing advanced search:', error);
    res.status(500).json({ error: 'Failed to perform advanced search' });
  }
});

// Get distinct issuing offices for dropdown selection
app.get('/api/wl/issuing-offices', (req, res) => {
  try {
    const offices = new Set();
    
    warningLetters.forEach(letter => {
      if (letter.issuingOffice && letter.issuingOffice.trim() !== '') {
        offices.add(letter.issuingOffice);
      }
    });
    
    const sortedOffices = Array.from(offices).sort();
    
    res.json(sortedOffices);
  } catch (error) {
    console.error('Error getting issuing offices:', error);
    res.status(500).json({ error: 'Failed to get issuing offices' });
  }
});
////////////////////////////////////////////////////////////WL///////////////////////////////////////////////////

app.use('/api/ema', emaRoutes);

// Add this route to fetch PDF document links from FDA website
// app.get('/api/fda-pdfs/:appNo', async (req, res) => {
//   try {
//     const appNo = req.params.appNo;
//     const url = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNo}`;
    
//     // Fetch HTML content
//     const html = await fetchHtml(url);
//     if (!html) {
//       return res.status(500).json({
//         error: 'Failed to fetch HTML content'
//       });
//     }
    
//     // Extract PDF links
//     const pdfLinks = extractPdfLinks(html);
    
//     if (pdfLinks.length === 0) {
//       return res.status(404).json({
//         message: 'No PDF links found',
//         total: 0,
//         results: []
//       });
//     }
    
//     // Return JSON response with PDF names and links
//     res.json({
//       message: 'PDF links retrieved successfully',
//       total: pdfLinks.length,
//       results: pdfLinks.map(link => ({
//         name: link.name,
//         url: link.url,
//         type: link.type
//       }))
//     });
    
//   } catch (error) {
//     console.error('API Error:', error);
//     res.status(500).json({
//       error: 'An error occurred while processing the request',
//       details: error.message
//     });
//   }
// });
// Grok API route - corrected version
app.post('/api/ai/grok-analysis', async (req, res) => {
  try {
    const { prompt, analysisType } = req.body;
    
    console.log('🤖 Grok AI analysis request received for:', analysisType);
    
    // Validate API key
    if (!process.env.grok) {
      return res.status(500).json({
        error: 'Grok API key is not configured',
        message: 'Please set the GROK_API_KEY environment variable'
      });
    }
    
    // Call Grok API with correct configuration
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.grok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are a regulatory affairs expert specializing in Phase III clinical trial analysis. 
                     Provide structured, actionable insights focusing on:
                     1. Drug formulation consistency across trials
                     2. US vs EU regulatory pathway differences  
                     3. Treatment effect patterns and statistical significance
                     4. Enrollment strategy effectiveness
                     5. Primary endpoint appropriateness for Target Product Profile development
                     
                     Return responses as structured JSON that can be easily parsed and integrated into clinical trial analysis tools.`
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        model: "grok-2", // Use available Grok model
        stream: false,
        temperature: 0.1
      })
    });

    // Check if response is ok
    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error('Grok API Error Details:', errorText);
      
      throw new Error(`Grok API error: ${grokResponse.status} - ${grokResponse.statusText}`);
    }

    const grokResult = await grokResponse.json();
    
    // Validate response structure
    if (!grokResult.choices || !grokResult.choices[0]) {
      throw new Error('Invalid response structure from Grok API');
    }
    
    // Parse Grok response
    let analysisData;
    try {
      analysisData = JSON.parse(grokResult.choices[0].message.content);
    } catch (parseError) {
      // If JSON parsing fails, create structured response from text
      const textResponse = grokResult.choices[0].message.content;
      analysisData = {
        enrichedTrials: [],
        drugFormulations: [],
        regulatoryInsights: textResponse,
        summary: "AI analysis completed with text response"
      };
    }

    // Enhance the response with additional analysis
    const enhancedResponse = {
      ...analysisData,
      timestamp: new Date().toISOString(),
      analysisType: analysisType,
      confidence: 'high',
      recommendations: extractRecommendations(analysisData)
    };

    console.log('✅ Grok analysis completed successfully');
    res.json(enhancedResponse);

  } catch (error) {
    console.error('❌ Grok AI analysis error:', error);
    res.status(500).json({
      error: 'AI analysis failed',
      message: error.message,
      fallbackData: {
        enrichedTrials: [],
        drugFormulations: [],
        regulatoryInsights: 'AI analysis temporarily unavailable',
        summary: 'Error occurred during analysis'
      }
    });
  }
});

// Helper function to extract recommendations
function extractRecommendations(analysisData) {
  // Add logic to extract recommendations from analysis data
  const recommendations = [];
  
  if (analysisData.regulatoryInsights) {
    recommendations.push({
      category: 'regulatory',
      priority: 'high',
      insight: 'Review regulatory pathway alignment'
    });
  }
  
  return recommendations;
}



// API endpoint for analyzing chemistry reviews
app.post('/api/analyze-chemistry-reviews', async (req, res) => {
  const { reviews } = req.body;
  
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ error: 'Valid reviews array is required' });
  }
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Process each review document
    console.log(`Processing ${reviews.length} chemistry reviews`);
    
    // Limit to max 5 documents to prevent timeouts
    const limitedReviews = reviews.slice(0, 5);
    
    // Collect all text content
    let allTexts = [];
    let processedCount = 0;
    
    for (const review of limitedReviews) {
      try {
        // Generate a unique filename
        const pdfFilename = `chem-review-${Date.now()}-${processedCount}.pdf`;
        const pdfPath = path.join(tempDir, pdfFilename);
        
        // Download the PDF
        console.log(`Downloading PDF from: ${review.url}`);
        const response = await axios({
          method: 'get',
          url: review.url,
          responseType: 'stream',
          timeout: 60000, // 60 seconds timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // Save the PDF to disk
        const writer = fs.createWriteStream(pdfPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        // Extract text content from the PDF
        const text = await extractTextFromPDF(pdfPath);
        
        // Add metadata and text to our collection
        allTexts.push({
          productName: review.productName,
          applicationNumber: review.applicationNumber,
          documentName: review.name,
          text: text.substring(0, 4000) // Limit text size for each document
        });
        
        // Clean up the temp file
        try {
          fs.unlinkSync(pdfPath);
        } catch (error) {
          console.error('Error cleaning up file:', error);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`Error processing review ${review.name}:`, error);
        // Continue with next document even if one fails
      }
    }
    
    if (allTexts.length === 0) {
      throw new Error('Failed to process any of the provided documents');
    }
    
    // Analyze all text content together with the Grok API
    const summary = await analyzeChemistryReviewsWithGrokAPI(allTexts);
    
    res.json({
      success: true,
      summary: summary,
      processedCount: processedCount,
      totalProvided: reviews.length
    });
    
  } catch (error) {
    console.error('Chemistry reviews analysis error:', error);
    res.status(500).json({ 
      error: 'Error analyzing chemistry reviews',
      details: error.message
    });
  }
});

// Function to analyze chemistry reviews with Grok API
async function analyzeChemistryReviewsWithGrokAPI(reviewTexts) {
  try {
    // Build a context string with information about each document
    let contextString = "I have analyzed the following chemistry review documents from FDA submissions:\n\n";
    
    reviewTexts.forEach((review, index) => {
      contextString += `Document ${index + 1}: ${review.productName} (${review.applicationNumber}) - ${review.documentName}\n`;
      
      // Add a brief excerpt from each document
      const excerpt = review.text.substring(0, 300).replace(/\n+/g, ' ').trim() + '...';
      contextString += `Excerpt: ${excerpt}\n\n`;
    });
    
    // Build a combined text with the most relevant parts of each document
    let combinedText = "";
    reviewTexts.forEach((review, index) => {
      combinedText += `\n\n--- DOCUMENT ${index + 1}: ${review.productName} (${review.applicationNumber}) ---\n\n`;
      combinedText += review.text.substring(0, 4000); // Limit each document's text
    });
    
    // Truncate if too long
    const maxLength = 12000;
    const truncatedText = combinedText.length > maxLength 
      ? combinedText.substring(0, maxLength) + '...[truncated]' 
      : combinedText;
    
    const payload = {
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that specializes in analyzing FDA chemistry review documents. Create a comprehensive summary that synthesizes information from multiple chemistry reviews, focusing on: 1) Chemical composition and formulation details, 2) Manufacturing processes, 3) Analytical methods and specifications, 4) Stability data and shelf life, 5) Key quality control considerations, and 6) Any significant chemistry-related findings. Format your response with clear markdown headings and bullet points where appropriate."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `${contextString}\n\nBased on these chemistry review documents, provide a comprehensive summary that synthesizes the key chemistry, manufacturing, and controls information. The full text content is below:\n\n${truncatedText}` 
            }
          ]
        }
      ],
      model: "grok-2-latest",
      stream: false,
      temperature: 0
    };
    
    console.log('Sending request to Grok API for chemistry review analysis...');
    
    const response = await axios.post(GROK_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      timeout: 90000 // 90 second timeout for processing multiple documents
    });
    
    console.log('Received response from Grok API for chemistry review analysis');
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    } else {
      console.error('Invalid response structure from Grok API:', JSON.stringify(response.data));
      throw new Error('Invalid response from Grok API');
    }
    
  } catch (error) {
    console.error('Grok API Error for chemistry reviews:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    // Fall back to a basic analysis if API fails
    return fallbackChemistryAnalysis(reviewTexts, error);
  }
}

// Fallback function for chemistry reviews when API calls fail
function fallbackChemistryAnalysis(reviewTexts, error) {
  const productNames = reviewTexts.map(r => r.productName).join(', ');
  const appNumbers = reviewTexts.map(r => r.applicationNumber).join(', ');
  
  return `
## Chemistry Reviews Analysis Summary

**Note: This is a fallback analysis due to an error in the AI processing system.**
Error details: ${error.message}

### Overview
This summary is based on chemistry review documents for the following products:
- ${productNames}

### Application Information
- Application Numbers: ${appNumbers}
- Total Documents Analyzed: ${reviewTexts.length}

### Limited Chemistry Analysis
The documents appear to contain information about drug chemistry, manufacturing processes, and controls that would typically include details about formulation, stability, and quality control measures.

For a complete analysis, please try again later or consult the original documents directly.
`;
}


// Route for analyzing FDA documents by URL
app.post('/api/analyze-fda-doc', async (req, res) => {
  const { pdfUrl } = req.body;
  
  if (!pdfUrl || !pdfUrl.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Valid PDF URL is required' });
  }
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique filename
    const pdfFilename = `fda-doc-${Date.now()}.pdf`;
    const pdfPath = path.join(tempDir, pdfFilename);
    
    // Download the PDF
    console.log(`Downloading PDF from: ${pdfUrl}`);
    const response = await axios({
      method: 'get',
      url: pdfUrl,
      responseType: 'stream',
      timeout: 60000, // 60 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Save the PDF to disk
    const writer = fs.createWriteStream(pdfPath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Extract text content only from the PDF
    const text = await extractTextFromPDF(pdfPath);
    
    // Analyze the text content
    const summary = await analyzeTextWithGrokAPI(text);
    
    // Clean up the temp file
    try {
      fs.unlinkSync(pdfPath);
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
    
    res.json({
      success: true,
      summary: summary,
      documentUrl: pdfUrl,
      textLength: text.length
    });
    
  } catch (error) {
    console.error('FDA document analysis error:', error);
    res.status(500).json({ 
      error: 'Error analyzing FDA document',
      details: error.message
    });
  }
});

// Simplified function to extract text from PDF
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text || '';
    
    console.log(`Extracted ${text.length} characters of text from PDF.`);
    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return 'Error extracting text from PDF';
  }
}

// Function to send text to Grok API
async function analyzeTextWithGrokAPI(text) {
  try {
    // Truncate text if too long (Grok API may have limits)
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
    const grokApiKey = process.env.grok;
    const grokApiUrl = 'https://api.x.ai/v1/chat/completions';

    // const payload = {
    //   messages: [
    //     {
    //       role: "system",
    //       content: "You are an AI assistant that specializes in analyzing FDA documents. Provide a clear, concise summary of the key information in the document, focusing on: 1) Drug name and active ingredients, 2) Approved indications, 3) Important safety information, 4) Dosage recommendations, 5) Contraindications, and 6) Any special populations or warnings. Format your response with clear markdown headings."
    //     },
    //     {
    //       role: "user",
    //       content: [
    //         { 
    //           type: "text", 
    //           text: `Analyze and summarize this FDA document content:\n\n${truncatedText}` 
    //         }
    //       ]
    //     }
    //   ],
    //   model: "grok-2-latest",
    //   stream: false,
    //   temperature: 0
    // };
    
    console.log('Sending request to Grok API...');
    
    // const response = await axios.post('https://api.x.ai/v1/chat/completions', payload, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${grokApiKey}`
    //   },
    //   timeout: 60000 // 60 second timeout
    // });

      const response = await axios.post(grokApiUrl, {
      model: "grok-2", // Add the required model field - update to your specific Grok model name if different
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that specializes in analyzing FDA documents. Provide a clear, concise summary of the key information in the document, focusing on: 1) Drug name and active ingredients, 2) Approved indications, 3) Important safety information, 4) Dosage recommendations, 5) Contraindications, and 6) Any special populations or warnings. Format your response with clear markdown headings."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `
You are an expert FDA regulatory affairs consultant with 20+ years of experience AND an FDA document analyst. Analyze this FDA document and provide BOTH:

1. REGULATORY ANALYSIS (as an expert RA consultant):
- Which regulatory arguments worked and which didn't
- What caused friction or required negotiation
- Historical precedents that could impact future submissions
- Specific FDA positions on similar cases
- Strategic recommendations based on precedent analysis
- Negotiation points and friction areas in FDA submissions
- Patterns in FDA decision-making

2. DOCUMENT SUMMARY (clear and concise):
- Drug name and active ingredients
- Approved indications
- Important safety information
- Dosage recommendations
- Contraindications
- Special populations or warnings

              
              
              
              Analyze and summarize this FDA document content:\n\n${truncatedText}` 
            }
          ]
        }
      ],
      max_tokens:  1500,
      temperature:  0.7
    }, {
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Received response from Grok API');
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    } else {
      console.error('Invalid response structure from Grok API:', JSON.stringify(response.data));
      throw new Error('Invalid response from Grok API');
    }
    
  } catch (error) {
    console.error('Grok API Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    // Fall back to a basic analysis if API fails
    return fallbackAnalysis(text, error);
  }
}

// Fallback function for when API calls fail
function fallbackAnalysis(text, error) {
  // Extract basic information from text
  const textSample = text.substring(0, 1000);
  
  let drugName = "Not identified";
  const drugNameMatch = text.match(/([A-Z][a-z]+|[A-Z]{2,})®|([A-Z][a-z]+|[A-Z]{2,})™|([A-Z][a-z]+|[A-Z]{2,})[\s\(][Tt]ablets|([A-Z][a-z]+|[A-Z]{2,})[\s\(][Cc]apsules/);
  if (drugNameMatch) {
    drugName = drugNameMatch[0];
  }
  
  return `
## FDA Document Analysis

**Note: This is a fallback analysis due to an error in the AI processing system.**
Error details: ${error.message}

### Basic Information Extracted
- **Drug Name (estimated)**: ${drugName}
- **Document Type**: FDA Document
- **Text Length**: ${text.length} characters

### Limited Analysis
The document appears to be an FDA regulatory document that would typically contain information about drug indications, safety information, dosing guidelines, and other regulatory content.

For a complete analysis, please try again later or consult the original document directly.
`;
}




// Replace with your Assistant ID
const ASSISTANT_ID = 'asst_abpUoLCXqB62X8rDNOJxe50M';

// API route to generate visualization
app.post('/api/generate-visualization', async (req, res) => {
  console.log("=== API ENDPOINT CALLED: /api/generate-visualization ===");
  console.log("Request body type:", typeof req.body);
  console.log("Request body keys:", Object.keys(req.body));
  
  try {
    const { trialData } = req.body;
    console.log("Trial data present:", !!trialData);
    
    if (!trialData) {
      console.log("ERROR: No trial data provided in request");
      return res.status(400).json({ error: 'Trial data is required' });
    }
    
    // Log sample of trial data (not too large to flood logs)
    console.log("Trial data sample:", JSON.stringify(trialData).substring(0, 200) + "...");
    
    // Check OpenAI setup
    console.log("OpenAI API key present:", !!process.env.OPENAI_API_KEY);
    console.log("Assistant ID:", ASSISTANT_ID);
    
    // Create a thread
    console.log("Creating thread...");
    let thread;
    try {
      thread = await openai.beta.threads.create();
      console.log("Thread created successfully:", thread.id);
    } catch (threadError) {
      console.error("ERROR creating thread:", threadError);
      return res.status(400).json({ 
        error: `Thread creation failed: ${threadError.message}`,
        details: threadError
      });
    }
    
    // Add a message to the thread
    console.log("Adding message to thread...");
    try {
      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: `Generate a visualization dashboard for this clinical trial data using vanilla HTML, JavaScript, and Tailwind CSS. The code should be suitable for direct insertion into a div via innerHTML. Here's the trial data:\n\n${JSON.stringify(trialData, null, 2)}`
      });
      console.log("Message added successfully:", message.id);
    } catch (messageError) {
      console.error("ERROR creating message:", messageError);
      return res.status(400).json({ 
        error: `Message creation failed: ${messageError.message}`,
        details: messageError
      });
    }
    
    // Run the assistant
    console.log("Creating run with assistant...");
    let run;
    try {
      run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: ASSISTANT_ID,
      });
      console.log("Run created successfully:", run.id, "with status:", run.status);
    } catch (runError) {
      console.error("ERROR creating run:", runError);
      return res.status(400).json({ 
        error: `Run creation failed: ${runError.message}`,
        details: runError
      });
    }
    
    // Poll for completion
    console.log("Polling for run completion...");
    let completedRun;
    try {
      completedRun = await pollRunStatus(thread.id, run.id);
      console.log("Run completed with status:", completedRun.status);
    } catch (pollError) {
      console.error("ERROR polling run status:", pollError);
      return res.status(400).json({ 
        error: `Run polling failed: ${pollError.message}`,
        details: pollError
      });
    }
    
    if (completedRun.status !== 'completed') {
      console.log("Run did not complete successfully. Final status:", completedRun.status);
      return res.status(500).json({ 
        error: 'Assistant run failed', 
        status: completedRun.status 
      });
    }
    
    // Get the assistant's response
    console.log("Retrieving messages from thread...");
    let messages;
    try {
      messages = await openai.beta.threads.messages.list(thread.id);
      console.log("Messages retrieved successfully. Count:", messages.data.length);
    } catch (messagesError) {
      console.error("ERROR retrieving messages:", messagesError);
      return res.status(400).json({ 
        error: `Messages retrieval failed: ${messagesError.message}`,
        details: messagesError
      });
    }
    
    const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
    console.log("Assistant messages count:", assistantMessages.length);
    
    if (assistantMessages.length === 0) {
      console.log("ERROR: No assistant messages found in the thread");
      return res.status(500).json({ error: 'No response from assistant' });
    }
    
    const latestMessage = assistantMessages[0];
    console.log("Latest message ID:", latestMessage.id);
    console.log("Message content types:", latestMessage.content.map(c => c.type).join(', '));
    
    // Parse the content to extract HTML and JavaScript
    let html = '';
    let javascript = '';
    
    for (const content of latestMessage.content) {


      if (content.type === 'text') {
        const text = content.text.value;
        console.log(text)
        console.log("Text content length:", text.length);
        console.log("Text content preview:", text.substring(0, 100) + "...");
        
        // Extract HTML code blocks
        const htmlMatches = text.match(/```html\n([\s\S]*?)\n```/g);
        console.log("HTML matches found:", !!htmlMatches, htmlMatches ? htmlMatches.length : 0);
        
        if (htmlMatches) {
          html = htmlMatches.map(match => match.replace(/```html\n/, '').replace(/\n```/, '')).join('\n');
          console.log("Extracted HTML length:", html.length);
        }
        
        // Extract JavaScript code blocks
        const jsMatches = text.match(/```javascript\n([\s\S]*?)\n```/g);
        console.log("JavaScript matches found:", !!jsMatches, jsMatches ? jsMatches.length : 0);
        
        if (jsMatches) {
          javascript = jsMatches.map(match => match.replace(/```javascript\n/, '').replace(/\n```/, '')).join('\n');
          console.log("Extracted JavaScript length:", javascript.length);
        }
      }
    }
    
    console.log("Sending response back to client...");
    console.log("HTML content present:", !!html && html.length > 0);
    console.log("JavaScript content present:", !!javascript && javascript.length > 0);
    console.log("returned html :", html, "js : ", javascript)
    res.json({ html, javascript });
    console.log("Response sent successfully");
    
  } catch (error) {
    console.error("UNHANDLED ERROR in generate-visualization endpoint:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Add logging to the pollRunStatus function as well
async function pollRunStatus(threadId, runId, maxAttempts = 60) {
  console.log(`Started polling run status for thread ${threadId}, run ${runId}`);
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Poll attempt ${attempts}/${maxAttempts}`);
    
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);
      console.log(`Current run status: ${run.status}`);
      
      if (['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) {
        console.log(`Run reached terminal status: ${run.status}`);
        return run;
      }
      
      // If the run requires action (e.g., function calling), handle it here
      if (run.status === 'requires_action') {
        console.log("Run requires action, but no action handling is implemented");
        // You would implement function calling handling here if needed
      }
      
      // Wait for 1 second before checking again
      console.log("Waiting 1 second before next poll attempt...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`ERROR during poll attempt ${attempts}:`, error);
      throw new Error(`Failed to poll run status: ${error.message}`);
    }
  }
  
  console.log(`Polling timed out after ${maxAttempts} attempts`);
  throw new Error('Timed out waiting for run to complete');
}
// // Route for analyzing PDF files uploaded directly
// app.post('/api/analyze-pdf', (req, res) => {
//   upload(req, res, async function (err) {
//     if (err) {
//       return res.status(400).json({ error: err.message });
//     }
    
//     if (!req.file) {
//       return res.status(400).json({ error: 'No PDF file uploaded' });
//     }
    
//     try {
//       const filePath = req.file.path;
      
//       // Extract both text and images from PDF
//       const { text, images } = await extractFromPDF(filePath);
      
//       // If no images found, just analyze the text
//       if (images.length === 0) {
//         const summary = await analyzeTextWithGrokAPI(text);
        
//         // Clean up the temp file
//         try {
//           fs.unlinkSync(filePath);
//         } catch (error) {
//           console.error('Error removing file:', error);
//         }
        
//         return res.json({
//           success: true,
//           summary: summary,
//           imageCount: 0
//         });
//       }
      
//       // If we have images, analyze them with the text context
//       const summary = await analyzeWithGrokAPI(text, images);
      
//       // Clean up the temp file and temp images
//       try {
//         fs.unlinkSync(filePath);
//         images.forEach(img => {
//           if (img.startsWith('file://')) {
//             const imgPath = img.replace('file://', '');
//             if (fs.existsSync(imgPath)) {
//               fs.unlinkSync(imgPath);
//             }
//           }
//         });
//       } catch (error) {
//         console.error('Error cleaning up files:', error);
//       }
      
//       res.json({
//         success: true,
//         summary: summary,
//         imageCount: images.length
//       });
      
//     } catch (error) {
//       console.error('PDF analysis error:', error);
//       res.status(500).json({ 
//         error: 'Error analyzing PDF',
//         details: error.message
//       });
//     }
//   });
// });

// // Route for analyzing FDA documents by URL
// app.post('/api/analyze-fda-doc', async (req, res) => {
//   const { pdfUrl } = req.body;
  
//   if (!pdfUrl || !pdfUrl.toLowerCase().endsWith('.pdf')) {
//     return res.status(400).json({ error: 'Valid PDF URL is required' });
//   }
  
//   try {
//     // Create temp directory if it doesn't exist
//     const tempDir = path.join(__dirname, 'temp-uploads');
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir, { recursive: true });
//     }
    
//     // Generate a unique filename
//     const pdfFilename = `fda-doc-${Date.now()}.pdf`;
//     const pdfPath = path.join(tempDir, pdfFilename);
    
//     // Download the PDF
//     console.log(`Downloading PDF from: ${pdfUrl}`);
//     const response = await axios({
//       method: 'get',
//       url: pdfUrl,
//       responseType: 'stream',
//       timeout: 60000, // 60 seconds timeout
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
//       }
//     });
    
//     // Save the PDF to disk
//     const writer = fs.createWriteStream(pdfPath);
//     response.data.pipe(writer);
    
//     await new Promise((resolve, reject) => {
//       writer.on('finish', resolve);
//       writer.on('error', reject);
//     });
    
//     // Extract content from the PDF
//     const { text, images } = await extractFromPDF(pdfPath);
    
//     // Analyze the content
//     let summary;
//     if (images.length > 0) {
//       summary = await analyzeWithGrokAPI(text, images);
//     } else {
//       summary = await analyzeTextWithGrokAPI(text);
//     }
    
//     // Clean up the temp file and temp images
//     try {
//       fs.unlinkSync(pdfPath);
//       images.forEach(img => {
//         if (img.startsWith('file://')) {
//           const imgPath = img.replace('file://', '');
//           if (fs.existsSync(imgPath)) {
//             fs.unlinkSync(imgPath);
//           }
//         }
//       });
//     } catch (error) {
//       console.error('Error cleaning up files:', error);
//     }
    
//     res.json({
//       success: true,
//       summary: summary,
//       documentUrl: pdfUrl,
//       imageCount: images.length,
//       textLength: text.length
//     });
    
//   } catch (error) {
//     console.error('FDA document analysis error:', error);
//     res.status(500).json({ 
//       error: 'Error analyzing FDA document',
//       details: error.message
//     });
//   }
// });

// // Function to fetch the HTML content from the URL
// async function fetchHtml(url) {
//   try {
//     const response = await axios.get(url, { 
//       httpsAgent,
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
//       }
//     });
//     return response.data;
//   } catch (error) {
//     console.error(`Error fetching URL: ${error.message}`);
//     return null;
//   }
// }

// // Function to extract PDF links from the HTML content
// function extractPdfLinks(html) {
//   const $ = cheerio.load(html);
//   const links = [];
  
//   $('a').each((index, element) => {
//     const href = $(element).attr('href');
//     const text = $(element).text().trim();
    
//     if (href && (
//       href.includes('.pdf') || 
//       href.includes('drugsatfda_docs') ||
//       text.includes('PDF') ||
//       text.includes('Review') ||
//       text.includes('Label') ||
//       text.includes('Letter')
//     )) {
//       let fullUrl = href;
//       if (href.startsWith('/')) {
//         fullUrl = `https://www.accessdata.fda.gov${href}`;
//       } else if (!href.startsWith('http')) {
//         fullUrl = `https://www.accessdata.fda.gov/${href}`;
//       }
      
//       links.push({
//         name: text || 'No description',
//         url: fullUrl,
//         type: determineType(text, href)
//       });
//     }
//   });
  
//   return links;
// }

// // Function to determine the type of link
// function determineType(text, href) {
//   text = text.toLowerCase();
//   href = href.toLowerCase();
  
//   if (text.includes('review') || href.includes('review')) {
//     return 'Review';
//   } else if (text.includes('label') || href.includes('label') || href.includes('lbl')) {
//     return 'Label';
//   } else if (text.includes('letter') || href.includes('letter') || href.includes('ltr')) {
//     return 'Letter';
//   } else {
//     return 'Other';
//   }
// }

// // Function to extract text and images from a PDF
// async function extractFromPDF(pdfPath) {
//   // Extract text content
//   let text = '';
//   try {
//     const dataBuffer = fs.readFileSync(pdfPath);
//     const pdfData = await pdfParse(dataBuffer);
//     text = pdfData.text || '';
    
//     // Load the PDF to get the page count
//     const pdfDoc = await PDFDocument.load(dataBuffer);
//     const pageCount = pdfDoc.getPageCount();
    
//     console.log(`PDF has ${pageCount} pages. Extracted ${text.length} characters of text.`);
    
//     // Set up image extraction options
//     const options = {
//       density: 150,           // Medium density for balance of quality/speed
//       quality: 80,            // JPEG quality
//       format: "png",          // Output format
//       width: 1200,            // Target width in pixels
//       height: 1600,           // Target height in pixels
//       saveFilename: `page`,   // Output filename prefix
//       savePath: path.dirname(pdfPath),
//       page: null              // Indicates we'll do specific pages
//     };
    
//     // Create the PDF conversion instance
//     const convert = fromPath(pdfPath, options);
    
//     // Limit to processing first 3 pages for performance
//     const pagesToProcess = Math.min(pageCount, 3);
//     console.log(`Processing ${pagesToProcess} pages from PDF with ${pageCount} total pages`);
    
//     // Array to hold our image paths
//     const images = [];
    
//     // Convert pages to images
//     for (let i = 1; i <= pagesToProcess; i++) {
//       try {
//         console.log(`Converting page ${i} to image...`);
//         const result = await convert.convert(i);
        
//         // result.path contains the path to the saved image
//         const imgPath = result.path;
        
//         // Resize image for faster processing and API compatibility
//         try {
//           await sharp(imgPath)
//             .resize(800) // Resize to max width of 800px while maintaining aspect ratio
//             .toFile(`${imgPath.replace('.png', '')}-resized.png`);
          
//           // Use the resized version
//           const resizedPath = `${imgPath.replace('.png', '')}-resized.png`;
          
//           // For API usage, we use file:// protocol
//           images.push(`file://${resizedPath}`);
          
//           // Clean up the original large image
//           try {
//             fs.unlinkSync(imgPath);
//           } catch (error) {
//             console.error(`Error removing original image: ${error.message}`);
//           }
//         } catch (resizeError) {
//           console.error('Error resizing image:', resizeError);
//           // If resize fails, use the original
//           images.push(`file://${imgPath}`);
//         }
        
//       } catch (error) {
//         console.error(`Error converting page ${i} to image:`, error);
//       }
//     }
    
//     return { text, images };
    
//   } catch (error) {
//     console.error('Error in PDF extraction:', error);
//     return { text: text || 'Error extracting text', images: [] };
//   }
// }

// // Function to convert file paths to base64
// async function convertImagesToBase64(imagePaths) {
//   const base64Images = [];
  
//   for (const imgPath of imagePaths) {
//     if (imgPath.startsWith('file://')) {
//       const filePath = imgPath.replace('file://', '');
//       if (fs.existsSync(filePath)) {
//         try {
//           const data = fs.readFileSync(filePath);
//           const base64 = `data:image/png;base64,${data.toString('base64')}`;
//           base64Images.push(base64);
//         } catch (error) {
//           console.error('Error converting image to base64:', error);
//         }
//       }
//     } else {
//       base64Images.push(imgPath); // If already a data URL
//     }
//   }
  
//   return base64Images;
// }

// // Function to send text to Grok API
// async function analyzeTextWithGrokAPI(text) {
//   try {
//     // Truncate text if too long (Grok API may have limits)
//     const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
    
//     const payload = {
//       messages: [
//         {
//           role: "system",
//           content: "You are an AI assistant that specializes in analyzing FDA documents. Provide a clear, concise summary of the key information in the document, focusing on: 1) Drug name and active ingredients, 2) Approved indications, 3) Important safety information, 4) Dosage recommendations, 5) Contraindications, and 6) Any special populations or warnings. Format your response with clear markdown headings."
//         },
//         {
//           role: "user",
//           content: [
//             { 
//               type: "text", 
//               text: `Analyze and summarize this FDA document content:\n\n${truncatedText}` 
//             }
//           ]
//         }
//       ],
//       model: "grok-2-latest", // Update this to the latest Grok model
//       stream: false,
//       temperature: 0
//     };
    
//     const response = await axios.post(GROK_API_URL, payload, {
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer xai-${GROK_API_KEY}`
//       },
//       timeout: 60000 // 60 second timeout
//     });
    
//     if (response.data && response.data.choices && response.data.choices[0]) {
//       return response.data.choices[0].message.content;
//     } else {
//       throw new Error('Invalid response from Grok API');
//     }
    
//   } catch (error) {
//     console.error('Grok API Error:', error);
//     // Fall back to a basic analysis if API fails
//     return fallbackAnalysis(text, error);
//   }
// }

// // Function to send text and images to Grok API
// async function analyzeWithGrokAPI(text, images) {
//   try {
//     // Truncate text if too long
//     const truncatedText = text.length > 5000 ? text.substring(0, 5000) + '...' : text;
    
//     // Convert file paths to base64
//     const base64Images = await convertImagesToBase64(images.slice(0, 3)); // Limit to 3 images
    
//     // Build the message content with both text and images
//     const content = [
//       { 
//         type: "text", 
//         text: `Analyze and summarize this FDA document with text and images. Focus on: 1) Drug name and active ingredients, 2) Approved indications, 3) Important safety information, 4) Dosage recommendations, 5) Contraindications, and 6) Any special populations or warnings. Format your response with clear markdown headings.\n\n${truncatedText}` 
//       }
//     ];
    
//     // Add images
//     base64Images.forEach(img => {
//       content.push({
//         type: "image_url",
//         image_url: { url: img }
//       });
//     });
    
//     const payload = {
//       messages: [
//         {
//           role: "system",
//           content: "You are an AI assistant that specializes in analyzing FDA documents. Provide a clear, concise summary of the key information in the document, focusing on the most important clinical information."
//         },
//         {
//           role: "user",
//           content: content
//         }
//       ],
//       model: "grok-2-latest", // Update this to the latest Grok model
//       stream: false,
//       temperature: 0
//     };
    
//     const response = await axios.post(GROK_API_URL, payload, {
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer xai-${GROK_API_KEY}`
//       },
//       timeout: 120000 // 120 second timeout for image processing
//     });
    
//     if (response.data && response.data.choices && response.data.choices[0]) {
//       return response.data.choices[0].message.content;
//     } else {
//       throw new Error('Invalid response from Grok API');
//     }
    
//   } catch (error) {
//     console.error('Grok API Error (with images):', error);
//     // Try text-only analysis if image analysis fails
//     try {
//       return await analyzeTextWithGrokAPI(text);
//     } catch (textError) {
//       console.error('Fallback text analysis failed:', textError);
//       return fallbackAnalysis(text, error);
//     }
//   }
// }

// // Fallback function for when API calls fail
// function fallbackAnalysis(text, error) {
//   // Extract basic information from text
//   const textSample = text.substring(0, 1000);
  
//   let drugName = "Not identified";
//   const drugNameMatch = text.match(/([A-Z][a-z]+|[A-Z]{2,})®|([A-Z][a-z]+|[A-Z]{2,})™|([A-Z][a-z]+|[A-Z]{2,})[\s\(][Tt]ablets|([A-Z][a-z]+|[A-Z]{2,})[\s\(][Cc]apsules/);
//   if (drugNameMatch) {
//     drugName = drugNameMatch[0];
//   }
  
//   return `
// ## FDA Document Analysis

// **Note: This is a fallback analysis due to an error in the AI processing system.**
// Error details: ${error.message}

// ### Basic Information Extracted
// - **Drug Name (estimated)**: ${drugName}
// - **Document Type**: FDA Document
// - **Text Length**: ${text.length} characters

// ### Limited Analysis
// The document appears to be an FDA regulatory document that would typically contain information about drug indications, safety information, dosing guidelines, and other regulatory content.

// For a complete analysis, please try again later or consult the original document directly.
// `;
// }

// // OpenAI fallback (if you want to implement a backup service)
// async function openAIFallback(text) {
//   try {
//     // This assumes you have the OpenAI package installed
//     // npm install openai
//     const { OpenAI } = require('openai');
    
//     const openai = new OpenAI({
//       apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
//     });
    
//     const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
    
//     const response = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         {
//           role: "system",
//           content: "You are an AI assistant that specializes in analyzing FDA documents. Provide a clear, concise summary of the key information in the document, focusing on: 1) Drug name and active ingredients, 2) Approved indications, 3) Important safety information, 4) Dosage recommendations, 5) Contraindications, and 6) Any special populations or warnings. Format your response with clear headings."
//         },
//         {
//           role: "user",
//           content: `Analyze and summarize this FDA document content:\n\n${truncatedText}`
//         }
//       ],
//       temperature: 0
//     });
    
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error('OpenAI API Error:', error);
//     return `Error generating summary with fallback API: ${error.message}`;
//   }
// }


// Create an HTTPS agent with relaxed SSL options
// const httpsAgent = new https.Agent({
//   rejectUnauthorized: false
// });


// // Function to fetch the HTML content from the URL
// async function fetchHtml(url) {
//   try {
//     const response = await axios.get(url, { 
//       httpsAgent,
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
//       }
//     });
//     return response.data;
//   } catch (error) {
//     console.error(`Error fetching URL: ${error.message}`);
//     return null;
//   }
// }

// // Function to extract PDF links from the HTML content
// function extractPdfLinks(html) {
//   const $ = cheerio.load(html);
//   const links = [];
  
//   $('a').each((index, element) => {
//     const href = $(element).attr('href');
//     const text = $(element).text().trim();
    
//     if (href && (
//       href.includes('.pdf') || 
//       href.includes('drugsatfda_docs') ||
//       text.includes('PDF') ||
//       text.includes('Review') ||
//       text.includes('Label') ||
//       text.includes('Letter')
//     )) {
//       let fullUrl = href;
//       if (href.startsWith('/')) {
//         fullUrl = `https://www.accessdata.fda.gov${href}`;
//       } else if (!href.startsWith('http')) {
//         fullUrl = `https://www.accessdata.fda.gov/${href}`;
//       }
      
//       links.push({
//         name: text || 'No description',
//         url: fullUrl,
//         type: determineType(text, href)
//       });
//     }
//   });
  
//   return links;
// }

// // Function to determine the type of link
// function determineType(text, href) {
//   text = text.toLowerCase();
//   href = href.toLowerCase();
  
//   if (text.includes('review') || href.includes('review')) {
//     return 'Review';
//   } else if (text.includes('label') || href.includes('label') || href.includes('lbl')) {
//     return 'Label';
//   } else if (text.includes('letter') || href.includes('letter') || href.includes('ltr')) {
//     return 'Letter';
//   } else {
//     return 'Other';
//   }
// }

// // API endpoint
// app.get('/api/fda-pdfs/:appNo', async (req, res) => {
//   try {
//     const appNoInput = req.params.appNo;
//     // Strip "NDA" prefix if present
//     const appNo = appNoInput.startsWith('NDA') ? appNoInput.substring(3) : appNoInput;
//     const url = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNo}`;
//     console.log(url)
//     // Fetch HTML content
//     const html = await fetchHtml(url);
//     if (!html) {
//       return res.status(500).json({
//         error: 'Failed to fetch HTML content'
//       });
//     }
    
//     // Extract PDF links
//     const pdfLinks = extractPdfLinks(html);
    
//     if (pdfLinks.length === 0) {
//       return res.status(404).json({
//         message: 'No PDF links found',
//         total: 0,
//         results: []
//       });
//     }
    
//     // Return JSON response with PDF names and links
//     res.json({
//       message: 'PDF links retrieved successfully',
//       total: pdfLinks.length,
//       results: pdfLinks.map(link => ({
//         name: link.name,
//         url: link.url,
//         type: link.type
//       }))
//     });
    
//   } catch (error) {
//     console.error('API Error:', error);
//     res.status(500).json({
//       error: 'An error occurred while processing the request',
//       details: error.message
//     });
//   }
// });

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const limiter = new Bottleneck({
  minTime: 2000, // 2 seconds between requests
  maxConcurrent: 30,
});

// Path to cache file
const CACHE_FILE = path.join(__dirname, 'cache.json');

// Initialize axios with a custom User-Agent
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'MyFDAScraper/1.0 (contact: your-email@example.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  timeout: 15000,
  maxRedirects: 5,
});

// Assume httpsAgent is defined elsewhere in your codebase
// If not, you may need to configure it, e.g.:


// Wrap axios requests with rate limiter
const rateLimitedFetch = limiter.wrap(axiosInstance.get);
const rateLimitedHead = limiter.wrap(axiosInstance.head);

async function readCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, initialize empty cache
      return {};
    }
    console.error('Error reading cache:', error.message);
    return {};
  }
}

async function writeCache(cacheData) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to cache:', error.message);
  }
}

async function getFromCache(key) {
  const cache = await readCache();
  return cache[key] || null;
}

async function setInCache(key, value) {
  const cache = await readCache();
  cache[key] = value;
  await writeCache(cache);
}

app.get('/api/fda-pdfs/:appNo', async (req, res) => {
  try {
    const appNoInput = req.params.appNo;
    const appNo = appNoInput.startsWith('NDA') ? appNoInput.substring(3) : appNoInput;
    const cacheKey = `fda-pdfs-${appNo}`;

    // Check cache first
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`Serving from cache: ${cacheKey}`);
      return res.json(cachedResult);
    }

    // Try the DAF URL first
    const dafUrl = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNo}`;
    console.log(`Fetching primary URL: ${dafUrl}`);

    // Fetch HTML content
    let html = await fetchHtml(dafUrl);

    // If that fails or has no results, try the direct TOC URL
    if (!html || html.includes('No matching records found')) {
      const year = new Date().getFullYear();
      const tocUrl = `https://www.accessdata.fda.gov/drugsatfda_docs/nda/${year}/${appNo}s000TOC.cfm`;
      console.log(`No results from primary URL, trying TOC URL: ${tocUrl}`);
      html = await fetchHtml(tocUrl);
    }

    if (!html) {
      return res.status(500).json({
        error: 'Failed to fetch HTML content',
        message: 'Could not retrieve content from FDA databases for this application number.',
      });
    }

    // Extract PDF links
    let pdfLinks = await extractPdfLinks(html);

    // If still no PDFs, try some variations of the TOC URL
    if (pdfLinks.length === 0) {
      const yearsToTry = [new Date().getFullYear() - 1, new Date().getFullYear() - 2];
      for (const year of yearsToTry) {
        const alternateTocUrl = `https://www.accessdata.fda.gov/drugsatfda_docs/nda/${year}/${appNo}Orig1s000TOC.cfm`;
        console.log(`Trying alternate TOC URL: ${alternateTocUrl}`);
        const alternateHtml = await fetchHtml(alternateTocUrl);
        if (alternateHtml) {
          const alternateLinks = await processTocPage(alternateHtml, alternateTocUrl);
          if (alternateLinks.length > 0) {
            pdfLinks = alternateLinks;
            break;
          }
        }
      }
    }

    // Group results by document type
    const groupedResults = {};
    pdfLinks.forEach((link) => {
      const type = link.type;
      if (!groupedResults[type]) {
        groupedResults[type] = [];
      }
      groupedResults[type].push({
        name: link.name,
        url: link.url,
      });
    });

    // If still no PDFs found
    if (pdfLinks.length === 0) {
      return res.status(404).json({
        message: `No PDF documents found for application number ${appNo}`,
        total: 0,
        results: [],
      });
    }

    // Prepare response
    const response = {
      message: 'PDF links retrieved successfully',
      total: pdfLinks.length,
      groupedResults: groupedResults,
      results: pdfLinks.map((link) => ({
        name: link.name,
        url: link.url,
        type: link.type,
      })),
    };

    // Cache the response
    await setInCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('API Error:', error);
    if (error.response && error.response.status === 429) {
      console.log('Rate limit exceeded, retrying after delay...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return res.redirect(req.originalUrl);
    }
    res.status(500).json({
      error: 'An error occurred while processing the request',
      details: error.message,
    });
  }
});

// Function to fetch the HTML content from the URL
async function fetchHtml(url) {
  try {
    const cacheKey = `html-${url}`;
    const cachedHtml = await getFromCache(cacheKey);
    if (cachedHtml) {
      console.log(`Serving HTML from cache: ${url}`);
      return cachedHtml;
    }

    const response = await rateLimitedFetch(url, {
      httpsAgent, // Assumed to be defined
    });

    // Check for error messages in the HTML
    if (
      response.data &&
      (response.data.includes('No matching records found') ||
        response.data.includes('Page Not Found') ||
        response.data.includes('Error 404'))
    ) {
      console.log(`Page found but contains error message: ${url}`);
      return null;
    }

    await setInCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching URL: ${url}`);
    console.error(`Error details: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    }
    return null;
  }
}

// Function to extract PDF links from the HTML content
async function extractPdfLinks(html) {
  const $ = cheerio.load(html);
  let links = [];

  // Process regular links
  $('a').each((index, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();

    // Skip if href is undefined or empty
    if (!href) return;

    // Skip known bad links and patterns
    if (
      href.includes('#collapse') ||
      href.includes('warning-letters') ||
      href.includes('javascript:') ||
      href.includes('accessdata.fda.gov/#') ||
      href === '#' ||
      href === '' ||
      href === 'javascript:void(0)'
    ) {
      return;
    }

    // Check if it's a PDF link or a link to a review/label/letter
    if (
      href.includes('.pdf') ||
      href.includes('drugsatfda_docs') ||
      text.includes('PDF') ||
      text.includes('Review') ||
      text.includes('Label') ||
      text.includes('Letter')
    ) {
      let fullUrl = makeFullUrl(href);

      // Validate URL format to avoid malformed URLs
      if (!isValidUrl(fullUrl)) {
        console.log(`Skipping invalid URL: ${fullUrl}`);
        return;
      }

      links.push({
        name: text || 'No description',
        url: fullUrl,
        type: determineType(text, href),
      });
    }
  });

  // Look for TOC links and process them
  const tocLinks = links.filter((link) =>
    link.url.includes('TOC.cfm') ||
    link.url.includes('toc.cfm') ||
    (link.url.includes('drugsatfda_docs') && link.type === 'Review')
  );

  if (tocLinks.length > 0) {
    for (const tocLink of tocLinks) {
      console.log(`Found TOC/review page link: ${tocLink.url}`);
      const tocHtml = await fetchHtml(tocLink.url);
      if (tocHtml) {
        const tocPdfLinks = await processTocPage(tocHtml, tocLink.url);
        links = links.concat(tocPdfLinks);
      }
    }
  }

  // Filter out duplicate URLs and invalid/broken links
  const uniqueLinks = [];
  const seenUrls = new Set();

  for (const link of links) {
    if (
      link.url.includes('#collapse') ||
      link.url.includes('accessdata.fda.gov/#') ||
      !isValidUrl(link.url)
    ) {
      continue;
    }

    if (!seenUrls.has(link.url)) {
      seenUrls.add(link.url);
      uniqueLinks.push(link);
    }
  }

  return uniqueLinks;
}

// Process TOC page and extract PDF links
async function processTocPage(html, url) {
  const $ = cheerio.load(html);
  const links = [];

  // Get the base URL to construct absolute URLs
  let baseUrl = '';
  let currentPath = '';

  if (url) {
    try {
      const urlObj = new URL(url);
      baseUrl = urlObj.origin;
      currentPath = urlObj.pathname.split('/').slice(0, -1).join('/');
    } catch (error) {
      console.error(`Error parsing URL ${url}: ${error.message}`);
      baseUrl = 'https://www.accessdata.fda.gov';
      currentPath = '/drugsatfda_docs/nda';
    }
  } else {
    baseUrl = 'https://www.accessdata.fda.gov';
    currentPath = '/drugsatfda_docs/nda';
  }

  // Find all links to PDFs
  $('a[href$=".pdf"]').each((index, element) => {
    const relativeUrl = $(element).attr('href');
    const title = $(element).text().trim();

    // Skip if empty or doesn't end with PDF
    if (!relativeUrl || !relativeUrl.toLowerCase().endsWith('.pdf')) {
      return;
    }

    // Skip problematic URLs
    if (
      relativeUrl.includes('#collapse') ||
      relativeUrl.includes('accessdata.fda.gov/#') ||
      relativeUrl === '#' ||
      relativeUrl === '' ||
      relativeUrl === 'javascript:void(0)'
    ) {
      return;
    }

    // Construct absolute URL
    let absoluteUrl;
    if (relativeUrl.startsWith('http')) {
      absoluteUrl = relativeUrl;
    } else if (relativeUrl.startsWith('/')) {
      absoluteUrl = `${baseUrl}${relativeUrl}`;
    } else {
      absoluteUrl = `${baseUrl}${currentPath}/${relativeUrl}`;
    }

    // Validate the URL
    if (!isValidUrl(absoluteUrl)) {
      console.log(`Skipping invalid URL from TOC page: ${absoluteUrl}`);
      return;
    }

    // Get parent context for categorization
    let category = '';
    const parentPanel = $(element).closest('.panel');
    if (parentPanel.length) {
      const panelHeading = parentPanel.find('.panel-heading').text().trim();
      if (panelHeading) {
        category = panelHeading;
      }
    }

    if (!category) {
      let prevElement = $(element).prev('h1, h2, h3, h4, h5, p, li');
      if (prevElement.length) {
        category = prevElement.text().trim();
      } else {
        const parentContext = $(element).closest('li, p');
        if (parentContext.length) {
          category = parentContext.text().trim().replace(title, '').trim();
        }
      }
    }

    // Map the category to a standardized type
    const type = standardizeType(category, title, relativeUrl);

    links.push({
      name: title || 'No description',
      url: absoluteUrl,
      type: type,
      originalCategory: category,
    });
  });

  return links;
}

// Function to make a full URL from a relative URL
function makeFullUrl(href) {
  if (href.startsWith('http')) {
    return href;
  } else if (href.startsWith('/')) {
    return `https://www.accessdata.fda.gov${href}`;
  } else {
    return `https://www.accessdata.fda.gov/${href}`;
  }
}

// Function to determine the type of link
function determineType(text, href) {
  text = text.toLowerCase();
  href = href.toLowerCase();

  if (text.includes('approval') || text.includes('approv')) {
    return 'Approval Letter';
  } else if (text.includes('review') || href.includes('review')) {
    if (text.includes('chemistry') || href.includes('chemr')) {
      return 'Chemistry Review';
    } else if (text.includes('clinical') || href.includes('clinicalr')) {
      return 'Clinical Review';
    } else if (text.includes('pharm') || href.includes('pharmr')) {
      return 'Pharmacology Review';
    } else if (text.includes('biopharm') || href.includes('biopharmr')) {
      return 'Biopharmaceutics Review';
    } else if (text.includes('micro') || href.includes('micror')) {
      return 'Microbiology Review';
    } else if (text.includes('statistical') || href.includes('statr')) {
      return 'Statistical Review';
    } else if (text.includes('medical') || href.includes('medr')) {
      return 'Medical Review';
    } else {
      return 'Review';
    }
  } else if (text.includes('label') || href.includes('label') || href.includes('lbl')) {
    if (text.includes('printed')) {
      return 'Printed Label';
    } else {
      return 'Label';
    }
  } else if (text.includes('letter') || href.includes('letter') || href.includes('ltr')) {
    return 'Letter';
  } else if (text.includes('correspondence') || href.includes('corres')) {
    return 'Correspondence';
  } else if (text.includes('admin') || href.includes('admin')) {
    return 'Administrative Document';
  } else {
    return 'Other';
  }
}

// Function to standardize type based on category, title, and URL
function standardizeType(category, title, url) {
  const combinedText = (category + ' ' + title + ' ' + url).toLowerCase();

  const typeMapping = [
    { terms: ['approval letter', 'approv'], type: 'Approval Letter' },
    { terms: ['chemistry review', 'chemr'], type: 'Chemistry Review' },
    { terms: ['clinical pharm', 'biopharm'], type: 'Clinical Pharmacology Biopharmaceutics Review' },
    { terms: ['micro review', 'microbiology'], type: 'Microbiology Review' },
    { terms: ['printed label', 'print lbl'], type: 'Printed Labeling' },
    { terms: ['label review', 'labeling review'], type: 'Labeling Reviews' },
    { terms: ['administrative', 'admin', 'correspondence', 'corres'], type: 'Administrative Document & Correspondence' },
    { terms: ['statistical review', 'stats'], type: 'Statistical Review' },
    { terms: ['medical review', 'medr'], type: 'Medical Review' },
    { terms: ['pharmacology', 'toxicology'], type: 'Pharmacology Review' },
    { terms: ['letter'], type: 'Letter' },
  ];

  for (const mapping of typeMapping) {
    if (mapping.terms.some((term) => combinedText.includes(term))) {
      return mapping.type;
    }
  }

  if (combinedText.includes('review')) {
    return 'Review';
  } else if (combinedText.includes('label')) {
    return 'Label';
  }

  return 'Other';
}

// Function to validate URL format
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Function to validate URLs before adding them to the results
async function validateUrl(url) {
  try {
    const response = await rateLimitedHead(url, {
      httpsAgent,
      timeout: 5000,
    });
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    console.error(`URL validation failed for ${url}: ${error.message}`);
    return false;
  }
}

// app.get('/api/fda-pdfs/:appNo', async (req, res) => {
//   try {
//     const appNoInput = req.params.appNo;
//     // Strip "NDA" prefix if present
//     const appNo = appNoInput.startsWith('NDA') ? appNoInput.substring(3) : appNoInput;
    
//     // Try the DAF URL first
//     const dafUrl = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNo}`;
//     console.log(`Fetching primary URL: ${dafUrl}`);
    
//     // Fetch HTML content
//     let html = await fetchHtml(dafUrl);
    
//     // If that fails or has no results, try the direct TOC URL
//     if (!html || html.includes('No matching records found')) {
//       const year = new Date().getFullYear(); // Current year as a fallback
//       const tocUrl = `https://www.accessdata.fda.gov/drugsatfda_docs/nda/${year}/${appNo}s000TOC.cfm`;
//       console.log(`No results from primary URL, trying TOC URL: ${tocUrl}`);
//       html = await fetchHtml(tocUrl);
//     }
    
//     if (!html) {
//       return res.status(500).json({
//         error: 'Failed to fetch HTML content',
//         message: 'Could not retrieve content from FDA databases for this application number.'
//       });
//     }
    
//     // Extract PDF links
//     let pdfLinks = await extractPdfLinks(html);
    
//     // If still no PDFs, try some variations of the TOC URL
//     if (pdfLinks.length === 0) {
//       const yearsToTry = [new Date().getFullYear() - 1, new Date().getFullYear() - 2]; // Try previous years
      
//       for (const year of yearsToTry) {
//         const alternateTocUrl = `https://www.accessdata.fda.gov/drugsatfda_docs/nda/${year}/${appNo}Orig1s000TOC.cfm`;
//         console.log(`Trying alternate TOC URL: ${alternateTocUrl}`);
//         const alternateHtml = await fetchHtml(alternateTocUrl);
        
//         if (alternateHtml) {
//           const alternateLinks = await processTocPage(alternateHtml, alternateTocUrl);
//           if (alternateLinks.length > 0) {
//             pdfLinks = alternateLinks;
//             break;
//           }
//         }
//       }
//     }
    
//     // Group results by document type for better organization
//     const groupedResults = {};
//     pdfLinks.forEach(link => {
//       const type = link.type;
//       if (!groupedResults[type]) {
//         groupedResults[type] = [];
//       }
//       groupedResults[type].push({
//         name: link.name,
//         url: link.url
//       });
//     });
    
//     // If still no PDFs found
//     if (pdfLinks.length === 0) {
//       return res.status(404).json({
//         message: `No PDF documents found for application number ${appNo}`,
//         total: 0,
//         results: []
//       });
//     }
    
//     // Return JSON response with PDF names and links
//     res.json({
//       message: 'PDF links retrieved successfully',
//       total: pdfLinks.length,
//       groupedResults: groupedResults,
//       results: pdfLinks.map(link => ({
//         name: link.name,
//         url: link.url,
//         type: link.type
//       }))
//     });
    
//   } catch (error) {
//     console.error('API Error:', error);
//     res.status(500).json({
//       error: 'An error occurred while processing the request',
//       details: error.message
//     });
//   }
// });

// // Function to fetch the HTML content from the URL
// async function fetchHtml(url) {
//   try {
//     const response = await axios.get(url, {
//       httpsAgent,
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//         'Accept': 'text/html,application/xhtml+xml,application/xml',
//         'Accept-Language': 'en-US,en;q=0.9'
//       },
//       timeout: 15000, // 15 seconds timeout
//       maxRedirects: 5
//     });
    
//     // Check for error messages in the HTML
//     if (response.data && 
//         (response.data.includes('No matching records found') ||
//          response.data.includes('Page Not Found') ||
//          response.data.includes('Error 404'))) {
//       console.log(`Page found but contains error message: ${url}`);
//       return null;
//     }
    
//     return response.data;
//   } catch (error) {
//     console.error(`Error fetching URL: ${url}`);
//     console.error(`Error details: ${error.message}`);
    
//     // If the error has a response, log some details
//     if (error.response) {
//       console.error(`Status: ${error.response.status}`);
//       console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
//     }
    
//     return null;
//   }
// }

// // Function to extract PDF links from the HTML content
// async function extractPdfLinks(html) {
//   const $ = cheerio.load(html);
//   let links = [];
  
//   // Process regular links
//   $('a').each((index, element) => {
//     const href = $(element).attr('href');
//     const text = $(element).text().trim();
    
//     // Skip if href is undefined or empty
//     if (!href) return;
    
//     // Skip known bad links and patterns
//     if (href.includes('#collapse') || 
//         href.includes('warning-letters') ||
//         href.includes('javascript:') ||
//         href.includes('accessdata.fda.gov/#') ||
//         href === '#' ||
//         href === '' ||
//         href === 'javascript:void(0)') {
//       return;
//     }
    
//     // Check if it's a PDF link or a link to a review/label/letter
//     if (href.includes('.pdf') || 
//         href.includes('drugsatfda_docs') ||
//         text.includes('PDF') ||
//         text.includes('Review') ||
//         text.includes('Label') ||
//         text.includes('Letter')) {
      
//       let fullUrl = makeFullUrl(href);
      
//       // Validate URL format to avoid malformed URLs
//       if (!isValidUrl(fullUrl)) {
//         console.log(`Skipping invalid URL: ${fullUrl}`);
//         return;
//       }
      
//       links.push({
//         name: text || 'No description',
//         url: fullUrl,
//         type: determineType(text, href)
//       });
//     }
//   });
  
//   // Look for TOC links and process them
//   const tocLinks = links.filter(link => 
//     link.url.includes('TOC.cfm') || 
//     link.url.includes('toc.cfm') ||
//     (link.url.includes('drugsatfda_docs') && link.type === 'Review')
//   );
  
//   if (tocLinks.length > 0) {
//     for (const tocLink of tocLinks) {
//       console.log(`Found TOC/review page link: ${tocLink.url}`);
//       const tocHtml = await fetchHtml(tocLink.url);
//       if (tocHtml) {
//         const tocPdfLinks = await processTocPage(tocHtml, tocLink.url);
//         links = links.concat(tocPdfLinks);
//       }
//     }
//   }
  
//   // Filter out duplicate URLs and invalid/broken links
//   const uniqueLinks = [];
//   const seenUrls = new Set();
  
//   for (const link of links) {
//     // Skip links with obviously broken URLs
//     if (link.url.includes('#collapse') || 
//         link.url.includes('accessdata.fda.gov/#') ||
//         !isValidUrl(link.url)) {
//       continue;
//     }
    
//     if (!seenUrls.has(link.url)) {
//       seenUrls.add(link.url);
//       uniqueLinks.push(link);
//     }
//   }
  
//   return uniqueLinks;
// }

// // Function to validate URL format
// function isValidUrl(string) {
//   try {
//     new URL(string);
//     return true;
//   } catch (_) {
//     return false;
//   }
// }

// // Process TOC page and extract PDF links using enhanced scraper logic
// async function processTocPage(html, url) {
//   const $ = cheerio.load(html);
//   const links = [];
  
//   // Get the base URL to construct absolute URLs
//   let baseUrl = '';
//   let currentPath = '';
  
//   if (url) {
//     try {
//       const urlObj = new URL(url);
//       baseUrl = urlObj.origin;
//       currentPath = urlObj.pathname.split('/').slice(0, -1).join('/');
//     } catch (error) {
//       console.error(`Error parsing URL ${url}: ${error.message}`);
//       // Fall back to default behavior
//       baseUrl = 'https://www.accessdata.fda.gov';
//       currentPath = '/drugsatfda_docs/nda';
//     }
//   } else {
//     baseUrl = 'https://www.accessdata.fda.gov';
//     currentPath = '/drugsatfda_docs/nda';
//   }
  
//   // Find all links to PDFs
//   $('a[href$=".pdf"]').each((index, element) => {
//     const relativeUrl = $(element).attr('href');
//     const title = $(element).text().trim();
    
//     // Skip if empty or doesn't end with PDF
//     if (!relativeUrl || !relativeUrl.toLowerCase().endsWith('.pdf')) {
//       return;
//     }
    
//     // Skip problematic URLs
//     if (relativeUrl.includes('#collapse') || 
//         relativeUrl.includes('accessdata.fda.gov/#') ||
//         relativeUrl === '#' ||
//         relativeUrl === '' ||
//         relativeUrl === 'javascript:void(0)') {
//       return;
//     }
    
//     // Construct absolute URL - handling different formats of relative URLs
//     let absoluteUrl;
//     if (relativeUrl.startsWith('http')) {
//       // Already absolute
//       absoluteUrl = relativeUrl;
//     } else if (relativeUrl.startsWith('/')) {
//       // Root-relative URL
//       absoluteUrl = `${baseUrl}${relativeUrl}`;
//     } else {
//       // Document-relative URL
//       absoluteUrl = `${baseUrl}${currentPath}/${relativeUrl}`;
//     }
    
//     // Validate the URL
//     if (!isValidUrl(absoluteUrl)) {
//       console.log(`Skipping invalid URL from TOC page: ${absoluteUrl}`);
//       return;
//     }
    
//     // Get parent context for categorization
//     let category = '';
    
//     // Try to determine the category from the panel heading or other context
//     const parentPanel = $(element).closest('.panel');
//     if (parentPanel.length) {
//       const panelHeading = parentPanel.find('.panel-heading').text().trim();
//       if (panelHeading) {
//         category = panelHeading;
//       }
//     }
    
//     // If no category from panel, try to get context from nearby elements
//     if (!category) {
//       // Check previous heading or paragraph
//       let prevElement = $(element).prev('h1, h2, h3, h4, h5, p, li');
//       if (prevElement.length) {
//         category = prevElement.text().trim();
//       } else {
//         // Try parent li or p
//         const parentContext = $(element).closest('li, p');
//         if (parentContext.length) {
//           category = parentContext.text().trim().replace(title, '').trim();
//         }
//       }
//     }
    
//     // Map the category to a standardized type
//     const type = standardizeType(category, title, relativeUrl);
    
//     links.push({
//       name: title || 'No description',
//       url: absoluteUrl,
//       type: type,
//       originalCategory: category // Keep original for debugging
//     });
//   });
  
//   return links;
// }

// // Function to make a full URL from a relative URL
// function makeFullUrl(href) {
//   if (href.startsWith('http')) {
//     return href;
//   } else if (href.startsWith('/')) {
//     return `https://www.accessdata.fda.gov${href}`;
//   } else {
//     return `https://www.accessdata.fda.gov/${href}`;
//   }
// }

// // Function to determine the type of link
// function determineType(text, href) {
//   text = text.toLowerCase();
//   href = href.toLowerCase();
  
//   if (text.includes('approval') || text.includes('approv')) {
//     return 'Approval Letter';
//   } else if (text.includes('review') || href.includes('review')) {
//     if (text.includes('chemistry') || href.includes('chemr')) {
//       return 'Chemistry Review';
//     } else if (text.includes('clinical') || href.includes('clinicalr')) {
//       return 'Clinical Review';
//     } else if (text.includes('pharm') || href.includes('pharmr')) {
//       return 'Pharmacology Review';
//     } else if (text.includes('biopharm') || href.includes('biopharmr')) {
//       return 'Biopharmaceutics Review';
//     } else if (text.includes('micro') || href.includes('micror')) {
//       return 'Microbiology Review';
//     } else if (text.includes('statistical') || href.includes('statr')) {
//       return 'Statistical Review';
//     } else if (text.includes('medical') || href.includes('medr')) {
//       return 'Medical Review';
//     } else {
//       return 'Review';
//     }
//   } else if (text.includes('label') || href.includes('label') || href.includes('lbl')) {
//     if (text.includes('printed')) {
//       return 'Printed Label';
//     } else {
//       return 'Label';
//     }
//   } else if (text.includes('letter') || href.includes('letter') || href.includes('ltr')) {
//     return 'Letter';
//   } else if (text.includes('correspondence') || href.includes('corres')) {
//     return 'Correspondence';
//   } else if (text.includes('admin') || href.includes('admin')) {
//     return 'Administrative Document';
//   } else {
//     return 'Other';
//   }
// }

// // Function to standardize type based on category, title and URL
// function standardizeType(category, title, url) {
//   const combinedText = (category + ' ' + title + ' ' + url).toLowerCase();
  
//   // Map of key terms to standardized document types
//   const typeMapping = [
//     { terms: ['approval letter', 'approv'], type: 'Approval Letter' },
//     { terms: ['chemistry review', 'chemr'], type: 'Chemistry Review' },
//     { terms: ['clinical pharm', 'biopharm'], type: 'Clinical Pharmacology Biopharmaceutics Review' },
//     { terms: ['micro review', 'microbiology'], type: 'Microbiology Review' },
//     { terms: ['printed label', 'print lbl'], type: 'Printed Labeling' },
//     { terms: ['label review', 'labeling review'], type: 'Labeling Reviews' },
//     { terms: ['administrative', 'admin', 'correspondence', 'corres'], type: 'Administrative Document & Correspondence' },
//     { terms: ['statistical review', 'stats'], type: 'Statistical Review' },
//     { terms: ['medical review', 'medr'], type: 'Medical Review' },
//     { terms: ['pharmacology', 'toxicology'], type: 'Pharmacology Review' },
//     { terms: ['letter'], type: 'Letter' }
//   ];
  
//   // Find the first matching type
//   for (const mapping of typeMapping) {
//     if (mapping.terms.some(term => combinedText.includes(term))) {
//       return mapping.type;
//     }
//   }
  
//   // Default types based on partial matches
//   if (combinedText.includes('review')) {
//     return 'Review';
//   } else if (combinedText.includes('label')) {
//     return 'Label';
//   }
  
//   return 'Other';
// }

// // Function to validate URLs before adding them to the results
// async function validateUrl(url) {
//   try {
//     const response = await axios.head(url, {
//       httpsAgent,
//       timeout: 5000
//     });
//     return response.status >= 200 && response.status < 400;
//   } catch (error) {
//     console.error(`URL validation failed for ${url}: ${error.message}`);
//     return false;
//   }
// }
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// app.get('/api/fda/drug/:drugName', async (req, res) => {
//   console.log("194")
//   const { drugName } = req.params;
//   const searchType = req.query.type || 'brand';
  
//   let searchParam;
//   switch (searchType) {
//     case 'generic': searchParam = 'openfda.generic_name'; break;
//     case 'indication': searchParam = 'openfda.indication'; break;
//     case 'brand': default: searchParam = 'openfda.brand_name'; break;
//   }
  
//   try {
//     const response = await axios.get(`${FDA_DRUGSFDA_URL}?search=${searchParam}:"${drugName}"&limit=100`);
//     const results = response.data.results || [];
//     if (!results.length) return res.json({ error: 'No results found' });
    
//     const categorizedDrugs = {};
    
//     for (const drug of results) {
//       const appNumber = drug.application_number;
//       const products = drug.products || [];
//       const submissions = drug.submissions || [];
      
//       // Improved approval date extraction logic
//       let approvalDate = 'Unknown';
      
//       // First try to find ORIG-1 or submission number 1
//       const originalApproval = submissions.find(s => 
//         (s.submission_number === '1' || s.submission_number === 'ORIG-1') && 
//         (s.submission_status === 'AP' || s.submission_status === 'Approved')
//       );
      
//       // If not found, look for any approval
//       if (originalApproval) {
//         approvalDate = originalApproval.submission_status_date;
//       } else {
//         const anyApproval = submissions.find(s => 
//           s.submission_status === 'AP' || s.submission_status === 'Approved'
//         );
//         if (anyApproval) {
//           approvalDate = anyApproval.submission_status_date;
//         }
//       }
      
//       // If still no date found, try web scraping as fallback
//       if (!approvalDate || approvalDate === 'Unknown') {
//         approvalDate = await scrapeApprovalDate(appNumber) || 'Unknown';
//       }

//       for (const product of products) {
//         if (!product.brand_name) continue;
        
//         const brandName = product.brand_name.toLowerCase();
//         const activeIngredients = product.active_ingredients || [];
//         const strength = activeIngredients.map(ing => `${ing.name} ${ing.strength}`).join(', ') || 'Unknown';
        
//         if (!categorizedDrugs[brandName]) categorizedDrugs[brandName] = {};
//         if (!categorizedDrugs[brandName][strength]) categorizedDrugs[brandName][strength] = [];
        
//         // Instead of constructing links here, we'll indicate they should be fetched on demand
//         categorizedDrugs[brandName][strength].push({
//           brandName: product.brand_name,
//           drug: drug,
//           applicationNumber: appNumber,
//           approvalDate,
//           submissions: submissions.map(s => ({
//             submissionNumber: s.submission_number,
//             status: s.submission_status,
//             date: s.submission_status_date,
//             type: s.submission_type
//           })),
//           // Just store a flag to indicate we need to get documents for this application
//           hasDocuments: true,
//           fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
//           sponsorName: drug.sponsor_name,
//           activeIngredients,
//           manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
//           dosageForm: product.dosage_form,
//           route: product.route,
//           marketingStatus: product.marketing_status,
//         });
//       }
//     }
    
//     res.json(categorizedDrugs);
//   } catch (error) {
//     handleApiError(error, res, 'Error fetching drug data');
//   }
// });


// app.get('/api/fda/drug/:drugName', async (req, res) => {
//   console.log("Fetching comprehensive FDA drug data");
//   const { drugName } = req.params;
//   const searchType = req.query.type || 'brand';

//   try {
//     // Initialize result structure
//     const results = { 
//       endpoints: {}, 
//       combinedResults: []
//     };

//     // Define all FDA drug endpoints we'll query
//     const endpoints = {
//       drugsFda: "https://api.fda.gov/drug/drugsfda.json",
//       label: "https://api.fda.gov/drug/label.json",
//       ndc: "https://api.fda.gov/drug/ndc.json",
//       enforcement: "https://api.fda.gov/drug/enforcement.json",
//       event: "https://api.fda.gov/drug/event.json"
//     };

//     // Define search variations based on the drug name
//     const searchVariations = [
//       `*${drugName}*`,
//       // You can add variations here like manufacturer names if needed
//     ];

//     // Process each endpoint
//     for (const [endpointName, baseUrl] of Object.entries(endpoints)) {
//       let endpointSuccess = false;
      
//       // Try each search variation
//       for (const variation of searchVariations) {
//         if (endpointSuccess) continue; // Skip if we already have data
        
//         try {
//           // Build search query based on endpoint
//           let searchQuery;
          
//           switch (endpointName) {
//             case "drugsFda":
//               searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+sponsor_name:"${variation}"`;
//               break;
//             case "label":
//               searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+openfda.manufacturer_name:"${variation}"`;
//               break;
//             case "ndc":
//               searchQuery = `search=brand_name:"${variation}"+OR+generic_name:"${variation}"+OR+labeler_name:"${variation}"`;
//               break;
//             case "enforcement":
//               searchQuery = `search=product_description:"${variation}"`;
//               break;
//             case "event":
//               searchQuery = `search=patient.drug.medicinalproduct:"${variation}"+OR+patient.drug.openfda.brand_name:"${variation}"+OR+patient.drug.openfda.generic_name:"${variation}"`;
//               break;
//             default:
//               searchQuery = `search=${variation}`;
//           }
          
//           // Make the API request with increased limit
//           const url = `${baseUrl}?${searchQuery}&limit=100`;
//           console.log(`Trying FDA ${endpointName} with search term: ${variation}`);
          
//           const response = await axios.get(url, { timeout: 15000 });
          
//           if (response.data && response.data.results && Array.isArray(response.data.results) && response.data.results.length > 0) {
//             console.log(`Success! Found FDA data from ${endpointName} for ${variation}`);
//             results.endpoints[endpointName] = {
//               status: "success",
//               count: response.data.results.length,
//               data: response.data.results,
//               searchTerm: variation
//             };
            
//             // Process the results based on endpoint type
//             const processedResults = processEndpointResults(endpointName, response.data.results, variation);
//             results.combinedResults = [...results.combinedResults, ...processedResults];
            
//             endpointSuccess = true;
//             break; // Exit the variations loop for this endpoint
//           }
//         } catch (error) {
//           console.warn(`Failed FDA ${endpointName} request for ${variation}: ${error.message}`);
//         }
//       }
      
//       // If no success with any variation, record the failure
//       if (!endpointSuccess) {
//         results.endpoints[endpointName] = {
//           status: "error",
//           error: "No data found across all search variations",
//           statusCode: "404",
//           data: []
//         };
//       }
//     }
    
//     // If no results found across all endpoints, add placeholder data
//     if (results.combinedResults.length === 0) {
//       results.combinedResults = [{
//         source: "placeholder",
//         name: drugName,
//         description: `No FDA data found for ${drugName} across all endpoints`,
//         date: "Unknown",
//         status: "Unknown"
//       }];
//     }

//     // Process drugsFda data into categorized format (as in your original code)
//     const categorizedDrugs = {};
    
//     if (results.endpoints.drugsFda && results.endpoints.drugsFda.status === "success") {
//       for (const drug of results.endpoints.drugsFda.data) {
//         const appNumber = drug.application_number;
//         const products = drug.products || [];
//         const submissions = drug.submissions || [];
        
//         // Improved approval date extraction logic
//         let approvalDate = 'Unknown';
        
//         // First try to find ORIG-1 or submission number 1
//         const originalApproval = submissions.find(s =>
//           (s.submission_number === '1' || s.submission_number === 'ORIG-1') &&
//           (s.submission_status === 'AP' || s.submission_status === 'Approved')
//         );
        
//         // If not found, look for any approval
//         if (originalApproval) {
//           approvalDate = originalApproval.submission_status_date;
//         } else {
//           const anyApproval = submissions.find(s =>
//             s.submission_status === 'AP' || s.submission_status === 'Approved'
//           );
//           if (anyApproval) {
//             approvalDate = anyApproval.submission_status_date;
//           }
//         }
        
//         for (const product of products) {
//           if (!product.brand_name) continue;
          
//           const brandName = product.brand_name.toLowerCase();
//           const activeIngredients = product.active_ingredients || [];
//           const strength = activeIngredients.map(ing => `${ing.name} ${ing.strength}`).join(', ') || 'Unknown';
          
//           if (!categorizedDrugs[brandName]) categorizedDrugs[brandName] = {};
//           if (!categorizedDrugs[brandName][strength]) categorizedDrugs[brandName][strength] = [];
          
//           categorizedDrugs[brandName][strength].push({
//             brandName: product.brand_name,
//             applicationNumber: appNumber,
//             approvalDate,
//             submissions: submissions.map(s => ({
//               submissionNumber: s.submission_number,
//               status: s.submission_status,
//               date: s.submission_status_date,
//               type: s.submission_type
//             })),
//             hasDocuments: true,
//             fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
//             sponsorName: drug.sponsor_name,
//             activeIngredients,
//             manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
//             dosageForm: product.dosage_form,
//             route: product.route,
//             marketingStatus: product.marketing_status,
//           });
//         }
//       }
//     }

//     // Return both the raw endpoint results and the categorized drugs
//     res.json({
//       raw: results,
//       categorized: categorizedDrugs
//     });

//   } catch (error) {
//     console.error('Error fetching FDA drug data:', error);
//     res.status(500).json({ 
//       error: 'Error fetching drug data',
//       message: error.message 
//     });
//   }
// });




// Helper function to retry failed API requests
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for ${url}`);
      const response = await axios.get(url, { 
        timeout: 30000,
        ...options
      });
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      
      // If we have response details, log them
      if (error.response) {
        console.warn(`Status: ${error.response.status}, Data:`, error.response.data);
      }
      
      // Check if it's a rate limiting error or server error
      if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
        const backoffTime = 2000 * attempt; // Increase backoff time with each attempt
        console.warn(`Rate limiting or server error detected. Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else if (attempt < maxRetries) {
        // For other errors, wait a shorter time
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If we get here, all attempts failed
  throw lastError;
}

// Helper function to process results from different endpoints
// IMPORTANT: Define this before route handlers
function processEndpointResults(endpointName, results, searchTerm) {
  const processed = [];
  
  try {
    switch (endpointName) {
      case "drugsFda":
        // Process drug application data
        results.forEach(drug => {
          const products = drug.products || [];
          
          products.forEach(product => {
            processed.push({
              source: "drugsFda",
              type: "application",
              name: product.brand_name || drug.application_number,
              applicationNumber: drug.application_number,
              sponsorName: drug.sponsor_name,
              approvalType: drug.application_type,
              productType: product.dosage_form,
              status: product.marketing_status,
              description: `${product.brand_name || 'Unknown'} (${product.dosage_form || 'Unknown Dosage Form'})`
            });
          });
        });
        break;
        
      case "label":
        // Process drug labeling information
        results.forEach(label => {
          const brandName = label.openfda?.brand_name?.[0] || 'Unknown';
          const genericName = label.openfda?.generic_name?.[0] || 'Unknown';
          
          processed.push({
            source: "label",
            type: "label",
            name: brandName,
            genericName: genericName,
            manufacturerName: label.openfda?.manufacturer_name?.[0] || 'Unknown',
            description: label.indications_and_usage?.[0] || 'No indication information',
            warnings: label.warnings?.[0] || 'No warnings information',
            adverseReactions: label.adverse_reactions?.[0] || 'No adverse reactions information',
            dosageAdministration: label.dosage_and_administration?.[0] || 'No dosage information'
          });
        });
        break;
        
      case "ndc":
        // Process National Drug Code information
        results.forEach(ndc => {
          processed.push({
            source: "ndc",
            type: "product",
            name: ndc.brand_name || ndc.generic_name || 'Unknown',
            ndcCode: ndc.product_ndc,
            genericName: ndc.generic_name || 'Unknown',
            dosageForm: ndc.dosage_form,
            routeOfAdmin: ndc.route?.[0] || 'Unknown',
            packageDescription: ndc.packaging?.[0]?.description || 'No packaging information',
            labelerName: ndc.labeler_name,
            productType: ndc.product_type,
            description: `${ndc.brand_name || ndc.generic_name || 'Unknown'} (${ndc.dosage_form || 'Unknown Form'})`
          });
        });
        break;
        
      case "enforcement":
        // Process enforcement reports (recalls)
        results.forEach(report => {
          processed.push({
            source: "enforcement",
            type: "recall",
            name: report.openfda?.brand_name?.[0] || report.product_description || 'Unknown',
            recallNumber: report.recall_number,
            recallInitiationDate: report.recall_initiation_date,
            recallReason: report.reason_for_recall,
            status: report.status,
            classification: report.classification,
            description: report.product_description || 'No product description'
          });
        });
        break;
        
      case "event":
        // Process adverse event reports
        results.forEach(event => {
          // Find the drug matching our search term in the report
          const drugReports = event.patient?.drug || [];
          const relevantDrugs = drugReports.filter(drug => 
            (drug.medicinalproduct || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
            (drug.openfda?.brand_name?.[0] || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
            (drug.openfda?.generic_name?.[0] || '').toLowerCase().includes((searchTerm || '').toLowerCase())
          );
          
          if (relevantDrugs.length > 0) {
            const drug = relevantDrugs[0]; // Use the first matching drug
            
            processed.push({
              source: "event",
              type: "adverseEvent",
              name: drug.medicinalproduct || drug.openfda?.brand_name?.[0] || 'Unknown',
              genericName: drug.openfda?.generic_name?.[0] || 'Unknown',
              reportDate: event.receiptdate,
              seriousOutcomes: event.serious ? 'Yes' : 'No',
              reactions: event.patient?.reaction?.map(r => r.reactionmeddrapt || 'Unknown reaction').join(', ') || 'No reactions reported',
              description: `Adverse event report for ${drug.medicinalproduct || drug.openfda?.brand_name?.[0] || 'Unknown drug'}`
            });
          }
        });
        break;
        
      default:
        // Generic processing for other endpoints
        results.forEach(result => {
          processed.push({
            source: endpointName,
            name: result.openfda?.brand_name?.[0] || result.brand_name || result.generic_name || 'Unknown',
            description: `Data from ${endpointName} endpoint`,
            raw: result
          });
        });
    }
  } catch (error) {
    console.error(`Error in processEndpointResults for ${endpointName}:`, error);
    // Return an empty array if processing fails rather than throwing an error
  }
  
  return processed;
}

// Middleware to validate drug name parameter
const validateDrugNamenew = (req, res, next) => {
  const { drugName } = req.params;
  
  if (!drugName || drugName.trim() === '') {
    return res.status(400).json({
      error: 'Invalid drug name',
      message: 'Drug name parameter cannot be empty',
      approved: false
    });
  }
  
  next();
};

// FDA API status check endpoint
app.get('/api/fda/status', async (req, res) => {
  try {
    console.log("Checking FDA API endpoints status");
    
    const endpoints = {
      drugsFda: "https://api.fda.gov/drug/drugsfda.json",
      label: "https://api.fda.gov/drug/label.json",
      ndc: "https://api.fda.gov/drug/ndc.json",
      enforcement: "https://api.fda.gov/drug/enforcement.json",
      event: "https://api.fda.gov/drug/event.json"
    };
    
    const status = {};
    
    for (const [name, url] of Object.entries(endpoints)) {
      try {
        const checkUrl = `${url}?limit=1`;
        const startTime = Date.now();
        const response = await axios.get(checkUrl, { timeout: 10000 });
        const endTime = Date.now();
        
        status[name] = {
          status: "available",
          responseTime: `${endTime - startTime}ms`,
          statusCode: response.status
        };
      } catch (error) {
        status[name] = {
          status: "error",
          error: error.message,
          statusCode: error.response?.status || "unknown"
        };
      }
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      endpoints: status
    });
  } catch (error) {
    console.error('Error checking FDA API status:', error);
    res.status(500).json({ 
      error: 'Error checking FDA API status',
      message: error.message 
    });
  }
});

// Main drug search endpoint
app.get('/api/fda/drug/:drugName', validateDrugNamenew, async (req, res) => {
  console.log("Fetching comprehensive FDA drug data");
  const { drugName } = req.params;
  const searchType = req.query.type || 'brand';

  try {
    // Check if FDA API is available first
    try {
      console.log("Checking FDA API availability...");
      const checkUrl = "https://api.fda.gov/drug/label.json?limit=1";
      await axios.get(checkUrl, { timeout: 10000 });
      console.log("FDA API is available.");
    } catch (apiCheckError) {
      console.error("FDA API appears to be unavailable:", apiCheckError.message);
      return res.status(503).json({
        error: 'FDA API unavailable',
        message: 'The FDA API is currently unavailable. Please try again later.'
      });
    }

    // Initialize result structure
    const results = { 
      endpoints: {}, 
      combinedResults: []
    };

    // Define all FDA drug endpoints we'll query
    const endpoints = {
      drugsFda: "https://api.fda.gov/drug/drugsfda.json",
      label: "https://api.fda.gov/drug/label.json",
      ndc: "https://api.fda.gov/drug/ndc.json",
      enforcement: "https://api.fda.gov/drug/enforcement.json",
      event: "https://api.fda.gov/drug/event.json"
    };

    // Define search variations based on the drug name
    const searchVariations = [
      `${drugName}`,
      `*${drugName}*`,
      // You can add variations here like manufacturer names if needed
    ];

    // Process each endpoint
    for (const [endpointName, baseUrl] of Object.entries(endpoints)) {
      let endpointSuccess = false;
      
      // Try each search variation
      for (const variation of searchVariations) {
        if (endpointSuccess) continue; // Skip if we already have data
        
        try {
          // Build search query based on endpoint
          let searchQuery;
          
          switch (endpointName) {
            case "drugsFda":
              // searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+sponsor_name:"${variation}"`;
searchQuery = `search=${variation}`;
              // searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+sponsor_name:"${variation}"+OR+products.brand_name:"${variation}"+OR+products.active_ingredients.name:"${variation}"`;
              break;
            case "label":
              searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+openfda.manufacturer_name:"${variation}"`;
              break;
            case "ndc":
              searchQuery = `search=brand_name:"${variation}"+OR+generic_name:"${variation}"+OR+labeler_name:"${variation}"`;
              break;
            case "enforcement":
              searchQuery = `search=product_description:"${variation}"`;
              break;
            case "event":
              searchQuery = `search=patient.drug.medicinalproduct:"${variation}"+OR+patient.drug.openfda.brand_name:"${variation}"+OR+patient.drug.openfda.generic_name:"${variation}"`;
              break;
            default:
              searchQuery = `search=${variation}`;
          }
          
          // Fetch all results using pagination
          let allResults = [];
          let skip = 0;
          const BATCH_SIZE = 100; // Reduced batch size to avoid overloading API
          let hasMoreResults = true;
          
          while (hasMoreResults) {
            // Make the API request with pagination
            const url = `${baseUrl}?${searchQuery}&limit=${BATCH_SIZE}&skip=${skip}`;
            console.log(`Fetching FDA ${endpointName} with search term: ${variation}, skip: ${skip}`);
            
            try {
              const response = await fetchWithRetry(url, { timeout: 30000 });
              
              const batchResults = response.data.results || [];
              if (batchResults.length > 0) {
                allResults = [...allResults, ...batchResults];
                console.log(`Retrieved batch of ${batchResults.length} results. Total so far: ${allResults.length}`);
                
                // Check if we've reached the end or if there might be more results
                if (batchResults.length < BATCH_SIZE) {
                  hasMoreResults = false; // End of results
                } else {
                  skip += BATCH_SIZE; // Move to next batch
                }
              } else {
                hasMoreResults = false; // No results in this batch
              }
              
              // Safety check to prevent excessive requests (FDA API has rate limits)
              if (allResults.length >= 500) {
                console.warn(`Reached 500 results for ${endpointName}, stopping pagination to prevent excessive requests`);
                break;
              }
            } catch (error) {
              console.error(`Failed FDA ${endpointName} request for ${variation} after multiple retries: ${error.message}`);
              hasMoreResults = false; // Stop trying after repeated failures
            }
          }
          
          if (allResults.length > 0) {
            console.log(`Success! Found ${allResults.length} FDA records from ${endpointName} for ${variation}`);
            results.endpoints[endpointName] = {
              status: "success",
              count: allResults.length,
              data: allResults,
              searchTerm: variation
            };
            
            try {
              // Process the results based on endpoint type
              const processedResults = processEndpointResults(endpointName, allResults, variation);
              console.log(`Successfully processed ${processedResults.length} results from ${endpointName}`);
              results.combinedResults = [...results.combinedResults, ...processedResults];
            } catch (processingError) {
              console.error(`Error processing ${endpointName} results:`, processingError);
              // Continue with unprocessed results
            }
            
            endpointSuccess = true;
            break; // Exit the variations loop for this endpoint
          }
        } catch (error) {
          console.warn(`Failed FDA ${endpointName} request for ${variation}: ${error.message}`);
          
          // Check if it's a rate limiting error
          if (error.response && (error.response.status === 429 || error.response.status === 503)) {
            console.warn('Rate limiting detected. Waiting before continuing...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          }
        }
      }
      
      // If no success with any variation, record the failure
      if (!endpointSuccess) {
        results.endpoints[endpointName] = {
          status: "error",
          error: "No data found across all search variations",
          statusCode: "404",
          data: []
        };
      }
    }
    
    // If no results found across all endpoints, add placeholder data
    if (results.combinedResults.length === 0) {
      results.combinedResults = [{
        source: "placeholder",
        name: drugName,
        description: `No FDA data found for ${drugName} across all endpoints`,
        date: "Unknown",
        status: "Unknown"
      }];
    }

    // Process drugsFda data into categorized format
  
    
    // if (results.endpoints.drugsFda && results.endpoints.drugsFda.status === "success") {
    //   for (const drug of results.endpoints.drugsFda.data) {
    //     const appNumber = drug.application_number;
    //     const products = drug.products || [];
    //     const submissions = drug.submissions || [];
        
    //     // Improved approval date extraction logic
    //     let approvalDate = 'Unknown';
        
    //     // First try to find ORIG-1 or submission number 1
    //     const originalApproval = submissions.find(s =>
    //       (s.submission_number === '1' || s.submission_number === 'ORIG-1') &&
    //       (s.submission_status === 'AP' || s.submission_status === 'Approved')
    //     );
        
    //     // If not found, look for any approval
    //     if (originalApproval) {
    //       approvalDate = originalApproval.submission_status_date;
    //     } else {
    //       const anyApproval = submissions.find(s =>
    //         s.submission_status === 'AP' || s.submission_status === 'Approved'
    //       );
    //       if (anyApproval) {
    //         approvalDate = anyApproval.submission_status_date;
    //       }
    //     }
        
    //     for (const product of products) {
    //       if (!product.brand_name) continue;
          
    //       const brandName = product.brand_name.toLowerCase();
    //       const activeIngredients = product.active_ingredients || [];
    //       const strength = activeIngredients.map(ing => `${ing.name} ${ing.strength}`).join(', ') || 'Unknown';
          
    //       if (!categorizedDrugs[brandName]) categorizedDrugs[brandName] = {};
    //       if (!categorizedDrugs[brandName][strength]) categorizedDrugs[brandName][strength] = [];
          
    //       categorizedDrugs[brandName][strength].push({
    //         brandName: product.brand_name,
    //         applicationNumber: appNumber,
    //         approvalDate,
    //         submissions: submissions.map(s => ({
    //           submissionNumber: s.submission_number,
    //           status: s.submission_status,
    //           date: s.submission_status_date,
    //           type: s.submission_type
    //         })),
    //         hasDocuments: true,
    //         fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
    //         sponsorName: drug.sponsor_name,
    //         activeIngredients,
    //         manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
    //         dosageForm: product.dosage_form,
    //         route: product.route,
    //         marketingStatus: product.marketing_status,
    //       });
    //     }
    //   }
    // }

    // Add metadata about the request
    
const categorizedDrugs = {};

if (results.endpoints.drugsFda && results.endpoints.drugsFda.status === "success") {
  console.log(`Processing ${results.endpoints.drugsFda.data.length} drug applications from FDA...`);
  
  for (const drug of results.endpoints.drugsFda.data) {
    const appNumber = drug.application_number;
    const products = drug.products || [];
    const submissions = drug.submissions || [];
    
    // Get all submission statuses, not just approvals
    let approvalDate = 'Unknown';
    let currentStatus = 'Unknown';
    let hasApproval = false;
    let hasCRL = false;
    let hasWithdrawn = false;
    let isPending = false;
    
    // Find the earliest approval date if any
    const approvalSubmissions = submissions.filter(s => 
      s.submission_status === 'AP' || s.submission_status === 'Approved'
    );
    
    if (approvalSubmissions.length > 0) {
      hasApproval = true;
      // Sort by date to find the earliest approval
      const sortedApprovals = approvalSubmissions
        .filter(s => s.submission_status_date)
        .sort((a, b) => new Date(a.submission_status_date) - new Date(b.submission_status_date));
      
      if (sortedApprovals.length > 0) {
        approvalDate = sortedApprovals[0].submission_status_date;
      }
    }
    
    // Check for other statuses
    submissions.forEach(submission => {
      const status = submission.submission_status;
      
      if (status === 'CR' || status === 'CRL') {
        hasCRL = true;
      } else if (status === 'WD' || status === 'Withdrawn') {
        hasWithdrawn = true;
      } else if (status === 'RV' || status === 'RF' || status === 'Received' || status === 'P' || status === 'Pending') {
        isPending = true;
      }
    });
    
    // Determine current status based on most recent submission
    const mostRecentSubmission = submissions
      .filter(s => s.submission_status_date)
      .sort((a, b) => new Date(b.submission_status_date) - new Date(a.submission_status_date))[0];
    
    if (mostRecentSubmission) {
      currentStatus = mostRecentSubmission.submission_status;
    }
    
    // Process ALL products without any filtering
    if (products.length === 0) {
      // Even if no products, still include the application
      const brandName = drug.openfda?.brand_name?.[0] || 'unknown';
      const strength = 'No strength data';
      
      if (!categorizedDrugs[brandName.toLowerCase()]) categorizedDrugs[brandName.toLowerCase()] = {};
      if (!categorizedDrugs[brandName.toLowerCase()][strength]) categorizedDrugs[brandName.toLowerCase()][strength] = [];
      
      categorizedDrugs[brandName.toLowerCase()][strength].push({
        brandName: brandName,
        applicationNumber: appNumber,
        approvalDate,
        currentStatus,
        hasApproval,
        hasCRL,
        hasWithdrawn,
        isPending,
        submissions: submissions.map(s => ({
          submissionNumber: s.submission_number,
          status: s.submission_status,
          date: s.submission_status_date,
          type: s.submission_type,
          description: s.submission_public_notes || s.submission_property_type?.join(', ') || ''
        })),
        hasDocuments: true,
        fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
        sponsorName: drug.sponsor_name,
        activeIngredients: [],
        manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
        dosageForm: 'N/A',
        route: 'N/A',
        marketingStatus: 'Unknown',
      });
    } else {
      // Process all products
      for (const product of products) {
        // Include ALL products, even without brand name
        const brandName = product.brand_name || drug.openfda?.brand_name?.[0] || 'Unknown Brand';
        const activeIngredients = product.active_ingredients || [];
        const strength = activeIngredients.length > 0 
          ? activeIngredients.map(ing => `${ing.name} ${ing.strength}`).join(', ') 
          : 'No strength data';
        
        if (!categorizedDrugs[brandName.toLowerCase()]) categorizedDrugs[brandName.toLowerCase()] = {};
        if (!categorizedDrugs[brandName.toLowerCase()][strength]) categorizedDrugs[brandName.toLowerCase()][strength] = [];
        
        categorizedDrugs[brandName.toLowerCase()][strength].push({
          brandName: brandName,
          applicationNumber: appNumber,
          approvalDate,
          currentStatus,
          hasApproval,
          hasCRL,
          hasWithdrawn,
          isPending,
          submissions: submissions.map(s => ({
            submissionNumber: s.submission_number,
            status: s.submission_status,
            date: s.submission_status_date,
            type: s.submission_type,
            description: s.submission_public_notes || s.submission_property_type?.join(', ') || ''
          })),
          hasDocuments: true,
          fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
          sponsorName: drug.sponsor_name,
          activeIngredients,
          manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
          dosageForm: product.dosage_form || 'Not specified',
          route: product.route || 'Not specified',
          marketingStatus: product.marketing_status || 'Unknown',
        });
      }
    }
  }
  
  console.log(`Processed applications into ${Object.keys(categorizedDrugs).length} drug brands`);
}

    const metadata = {
      query: drugName,
      timestamp: new Date().toISOString(),
      endpointsQueried: Object.keys(endpoints).length,
      totalResults: results.combinedResults.length,
      resultBreakdown: Object.entries(results.endpoints).map(([name, data]) => ({
        endpoint: name,
        status: data.status,
        count: data.status === "success" ? data.count : 0
      }))
    };

    // Return both the raw endpoint results and the categorized drugs
    res.json({
      metadata,
      raw: results,
      categorized: categorizedDrugs
    });

  } catch (error) {
    console.error('Error fetching FDA drug data:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Error fetching drug data',
      message: error.message 
    });
  }
});


// Main device search endpoint
app.get('/api/fda/device/:deviceName', validateDeviceName, async (req, res) => {
  console.log("Fetching comprehensive FDA device data");
  const { deviceName } = req.params;
  const searchType = req.query.type || 'brand';

  try {
    // Check if FDA API is available first
    try {
      console.log("Checking FDA API availability...");
      const checkUrl = "https://api.fda.gov/device/510k.json?limit=1";
      await axios.get(checkUrl, { timeout: 10000 });
      console.log("FDA API is available.");
    } catch (apiCheckError) {
      console.error("FDA API appears to be unavailable:", apiCheckError.message);
      return res.status(503).json({
        error: 'FDA API unavailable',
        message: 'The FDA API is currently unavailable. Please try again later.'
      });
    }

    // Initialize result structure
    const results = { 
      endpoints: {}, 
      combinedResults: []
    };

    // Define all FDA device endpoints we'll query
    const endpoints = {
      classification: "https://api.fda.gov/device/classification.json",
      registrationlisting: "https://api.fda.gov/device/registrationlisting.json",
      enforcement: "https://api.fda.gov/device/enforcement.json",
      event: "https://api.fda.gov/device/event.json",
      recall: "https://api.fda.gov/device/recall.json",
      pma: "https://api.fda.gov/device/pma.json",
      '510k': "https://api.fda.gov/device/510k.json",
      covid19serology: "https://api.fda.gov/device/covid19serology.json",
      udi: "https://api.fda.gov/device/udi.json"
    };

    // Define search variations based on the device name
    const searchVariations = [
      `${deviceName}`,
      `*${deviceName}*`,
      // You can add variations here like manufacturer names if needed
    ];

    // Process each endpoint
    for (const [endpointName, baseUrl] of Object.entries(endpoints)) {
      let endpointSuccess = false;
      
      // Try each search variation
      for (const variation of searchVariations) {
        if (endpointSuccess) continue; // Skip if we already have data
        
        try {
          // Build search query based on endpoint
          let searchQuery;
          
          switch (endpointName) {
            case "classification":
              searchQuery = `search=device_name:"${variation}"+OR+medical_specialty_description:"${variation}"`;
              break;
            case "registrationlisting":
              searchQuery = `search=products.name:"${variation}"+OR+products.device_name:"${variation}"+OR+registration.owner_operator.name:"${variation}"`;
              break;
            case "enforcement":
              searchQuery = `search=product_description:"${variation}"+OR+firm_legal_name:"${variation}"`;
              break;
            case "event":
              searchQuery = `search=device.brand_name:"${variation}"+OR+device.generic_name:"${variation}"+OR+device.manufacturer_d_name:"${variation}"`;
              break;
            case "recall":
              searchQuery = `search=product_description:"${variation}"+OR+product_code:"${variation}"+OR+firm_name:"${variation}"`;
              break;
            case "pma":
              searchQuery = `search=device_name:"${variation}"+OR+applicant:"${variation}"+OR+trade_name:"${variation}"`;
              break;
            case "510k":
              searchQuery = `search=device_name:"${variation}"+OR+applicant:"${variation}"+OR+k_number:"${variation}"`;
              break;
            case "covid19serology":
              searchQuery = `search=device_name:"${variation}"+OR+manufacturer_name:"${variation}"`;
              break;
            case "udi":
              searchQuery = `search=device_name:"${variation}"+OR+brand_name:"${variation}"+OR+company_name:"${variation}"`;
              break;
            default:
              searchQuery = `search=${variation}`;
          }
          
          // Fetch all results using pagination
          let allResults = [];
          let skip = 0;
          const BATCH_SIZE = 100; // Reduced batch size to avoid overloading API
          let hasMoreResults = true;
          
          while (hasMoreResults) {
            // Make the API request with pagination
            const url = `${baseUrl}?${searchQuery}&limit=${BATCH_SIZE}&skip=${skip}`;
            console.log(`Fetching FDA ${endpointName} with search term: ${variation}, skip: ${skip}`);
            
            try {
              const response = await fetchWithRetry(url, { timeout: 30000 });
              
              const batchResults = response.data.results || [];
              if (batchResults.length > 0) {
                allResults = [...allResults, ...batchResults];
                console.log(`Retrieved batch of ${batchResults.length} results. Total so far: ${allResults.length}`);
                
                // Check if we've reached the end or if there might be more results
                if (batchResults.length < BATCH_SIZE) {
                  hasMoreResults = false; // End of results
                } else {
                  skip += BATCH_SIZE; // Move to next batch
                }
              } else {
                hasMoreResults = false; // No results in this batch
              }
              
              // Safety check to prevent excessive requests (FDA API has rate limits)
              if (allResults.length >= 500) {
                console.warn(`Reached 500 results for ${endpointName}, stopping pagination to prevent excessive requests`);
                break;
              }
            } catch (error) {
              console.error(`Failed FDA ${endpointName} request for ${variation} after multiple retries: ${error.message}`);
              hasMoreResults = false; // Stop trying after repeated failures
            }
          }
          
          if (allResults.length > 0) {
            console.log(`Success! Found ${allResults.length} FDA records from ${endpointName} for ${variation}`);
            results.endpoints[endpointName] = {
              status: "success",
              count: allResults.length,
              data: allResults,
              searchTerm: variation
            };
            
            try {
              // Process the results based on endpoint type
              const processedResults = processDeviceEndpointResults(endpointName, allResults, variation);
              console.log(`Successfully processed ${processedResults.length} results from ${endpointName}`);
              results.combinedResults = [...results.combinedResults, ...processedResults];
            } catch (processingError) {
              console.error(`Error processing ${endpointName} results:`, processingError);
              // Continue with unprocessed results
            }
            
            endpointSuccess = true;
            break; // Exit the variations loop for this endpoint
          }
        } catch (error) {
          console.warn(`Failed FDA ${endpointName} request for ${variation}: ${error.message}`);
          
          // Check if it's a rate limiting error
          if (error.response && (error.response.status === 429 || error.response.status === 503)) {
            console.warn('Rate limiting detected. Waiting before continuing...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          }
        }
      }
      
      // If no success with any variation, record the failure
      if (!endpointSuccess) {
        results.endpoints[endpointName] = {
          status: "error",
          error: "No data found across all search variations",
          statusCode: "404",
          data: []
        };
      }
    }
    
    // If no results found across all endpoints, add placeholder data
    if (results.combinedResults.length === 0) {
      results.combinedResults = [{
        source: "placeholder",
        name: deviceName,
        description: `No FDA device data found for ${deviceName} across all endpoints`,
        date: "Unknown",
        status: "Unknown"
      }];
    }

    // Process 510k data into categorized format
    const categorizedDevices = {};
    
    // Process 510k clearances
    if (results.endpoints['510k'] && results.endpoints['510k'].status === "success") {
      for (const device of results.endpoints['510k'].data) {
        const deviceName = device.device_name || 'Unknown Device';
        const applicant = device.applicant || 'Unknown Applicant';
        const clearanceDate = device.decision_date || device.date_received || 'Unknown';
        const kNumber = device.k_number || 'Unknown';
        
        if (!categorizedDevices[deviceName]) categorizedDevices[deviceName] = {};
        if (!categorizedDevices[deviceName][applicant]) categorizedDevices[deviceName][applicant] = [];
        
        categorizedDevices[deviceName][applicant].push({
          deviceName: device.device_name,
          applicant: device.applicant,
          kNumber: device.k_number,
          clearanceDate: device.decision_date,
          decisionCode: device.decision_code,
          decisionDescription: device.decision_description,
          productCode: device.product_code,
          dateReceived: device.date_received,
          hasDocuments: true,
          fdaPage: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${kNumber}`,
          advisoryCommittee: device.advisory_committee,
          reviewAdvisoryCommittee: device.review_advisory_committee,
          deviceClass: device.device_class,
          regulationNumber: device.regulation_number,
          substantialEquivalence: device.statement_or_summary,
          type: "510k"
        });
      }
    }
    
    // Process PMA data
    if (results.endpoints.pma && results.endpoints.pma.status === "success") {
      for (const device of results.endpoints.pma.data) {
        const deviceName = device.device_name || device.trade_name || 'Unknown Device';
        const applicant = device.applicant || 'Unknown Applicant';
        const approvalDate = device.decision_date || device.date_received || 'Unknown';
        const pmaNumber = device.pma_number || 'Unknown';
        
        if (!categorizedDevices[deviceName]) categorizedDevices[deviceName] = {};
        if (!categorizedDevices[deviceName][applicant]) categorizedDevices[deviceName][applicant] = [];
        
        categorizedDevices[deviceName][applicant].push({
          deviceName: device.device_name,
          tradeName: device.trade_name,
          applicant: device.applicant,
          pmaNumber: device.pma_number,
          approvalDate: device.decision_date,
          decisionCode: device.decision_code,
          productCode: device.product_code,
          dateReceived: device.date_received,
          expeditedReview: device.expedited_review_flag,
          hasDocuments: true,
          fdaPage: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=${pmaNumber}`,
          advisoryCommittee: device.advisory_committee,
          type: "PMA"
        });
      }
    }

    // Add metadata about the request
    const metadata = {
      query: deviceName,
      timestamp: new Date().toISOString(),
      endpointsQueried: Object.keys(endpoints).length,
      totalResults: results.combinedResults.length,
      resultBreakdown: Object.entries(results.endpoints).map(([name, data]) => ({
        endpoint: name,
        status: data.status,
        count: data.status === "success" ? data.count : 0
      }))
    };

    // Return both the raw endpoint results and the categorized devices
    res.json({
      metadata,
      raw: results,
      categorized: categorizedDevices
    });

  } catch (error) {
    console.error('Error fetching FDA device data:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Error fetching device data',
      message: error.message 
    });
  }
});

// Helper function for device validation
function validateDeviceName(req, res, next) {
  const { deviceName } = req.params;
  
  if (!deviceName || deviceName.trim().length < 2) {
    return res.status(400).json({
      error: 'Invalid device name',
      message: 'Please provide a valid device name (minimum 2 characters)'
    });
  }
  
  // Sanitize the device name to prevent potential injection
  req.params.deviceName = deviceName.trim().replace(/[^\w\s\-\.]/g, '');
  next();
}

// Process endpoint-specific results for devices
function processDeviceEndpointResults(endpointName, results, searchTerm) {
  const processedResults = [];
  
  try {
    switch (endpointName) {
      case "510k":
        for (const item of results) {
          processedResults.push({
            source: "510k",
            name: item.device_name || "Unknown Device",
            description: `510(k) submission ${item.k_number} - ${item.device_name || "Unknown Device"}`,
            applicant: item.applicant || "Unknown",
            date: item.decision_date || item.date_received || "Unknown",
            status: item.decision_description || "Unknown",
            id: item.k_number || "",
            additionalInfo: {
              productCode: item.product_code,
              deviceClass: item.device_class
            }
          });
        }
        break;
        
      case "pma":
        for (const item of results) {
          processedResults.push({
            source: "pma",
            name: item.device_name || item.trade_name || "Unknown Device",
            description: `PMA submission ${item.pma_number} - ${item.device_name || item.trade_name || "Unknown Device"}`,
            applicant: item.applicant || "Unknown",
            date: item.decision_date || item.date_received || "Unknown",
            status: item.decision_code || "Unknown",
            id: item.pma_number || "",
            additionalInfo: {
              productCode: item.product_code,
              expedited: item.expedited_review_flag === "Y" ? "Yes" : "No"
            }
          });
        }
        break;
        
      case "classification":
        for (const item of results) {
          processedResults.push({
            source: "classification",
            name: item.device_name || "Unknown Device",
            description: `Device Classification - ${item.device_name || "Unknown Device"}`,
            date: "N/A",
            status: `Class ${item.device_class || "Unknown"}`,
            id: item.product_code || "",
            additionalInfo: {
              regulationNumber: item.regulation_number,
              medicalSpecialty: item.medical_specialty_description,
              regulationText: item.regulation_text
            }
          });
        }
        break;
        
      case "registrationlisting":
        for (const item of results) {
          const products = item.products || [];
          for (const product of products) {
            processedResults.push({
              source: "registrationlisting",
              name: product.name || product.device_name || "Unknown Device",
              description: `Listed Device - ${product.name || product.device_name || "Unknown Device"}`,
              applicant: item.registration?.owner_operator?.name || "Unknown",
              date: item.registration?.initial_importer_flag === "Y" ? "Importer" : "Manufacturer",
              status: product.proprietary_name || "Unknown",
              id: product.registration_number || "",
              additionalInfo: {
                productCode: product.product_code,
                ownerOperatorNumber: item.registration?.owner_operator?.owner_operator_number
              }
            });
          }
        }
        break;
        
      case "enforcement":
        for (const item of results) {
          processedResults.push({
            source: "enforcement",
            name: item.product_description || "Unknown Device",
            description: `Enforcement - ${item.product_description || "Unknown Device"}`,
            applicant: item.firm_legal_name || item.recalling_firm || "Unknown",
            date: item.recall_initiation_date || item.event_date_initiated || "Unknown",
            status: item.status || "Unknown",
            id: item.recall_number || "",
            additionalInfo: {
              classification: item.classification,
              codeInfo: item.code_info,
              reasonForRecall: item.reason_for_recall
            }
          });
        }
        break;
        
      case "event":
        for (const item of results) {
          const deviceInfo = item.device || {};
          processedResults.push({
            source: "event",
            name: deviceInfo.brand_name || deviceInfo.generic_name || "Unknown Device",
            description: `Adverse Event - ${deviceInfo.brand_name || deviceInfo.generic_name || "Unknown Device"}`,
            applicant: deviceInfo.manufacturer_d_name || "Unknown",
            date: item.date_received || item.date_of_event || "Unknown",
            status: item.type_of_report || "Unknown",
            id: item.report_number || "",
            additionalInfo: {
              productProblem: item.product_problem_code,
              eventType: item.event_type,
              deviceCategory: deviceInfo.device_category
            }
          });
        }
        break;
        
      case "recall":
        for (const item of results) {
          processedResults.push({
            source: "recall",
            name: item.product_description || "Unknown Device",
            description: `Recall - ${item.product_description || "Unknown Device"}`,
            applicant: item.firm_name || "Unknown",
            date: item.recall_initiation_date || "Unknown",
            status: item.status || "Unknown",
            id: item.recall_number || "",
            additionalInfo: {
              classification: item.classification,
              productCode: item.product_code,
              terminationDate: item.termination_date || "Ongoing"
            }
          });
        }
        break;
        
      case "covid19serology":
        for (const item of results) {
          processedResults.push({
            source: "covid19serology",
            name: item.device_name || "Unknown Device",
            description: `COVID-19 Serology Device - ${item.device_name || "Unknown Device"}`,
            applicant: item.manufacturer_name || "Unknown",
            date: item.date_eua_authorized || "Unknown",
            status: item.status || "Unknown",
            id: item.eua_id || "",
            additionalInfo: {
              testPerformance: item.test_performance,
              targetedAntigen: item.targeted_antigen
            }
          });
        }
        break;
        
      case "udi":
        for (const item of results) {
          processedResults.push({
            source: "udi",
            name: item.device_name || item.brand_name || "Unknown Device",
            description: `UDI - ${item.device_name || item.brand_name || "Unknown Device"}`,
            applicant: item.company_name || "Unknown",
            date: "N/A",
            status: item.commercial_distribution_status || "Unknown",
            id: item.identifier || "",
            additionalInfo: {
              deviceClass: item.device_class,
              productCode: item.product_code,
              versionModelNumber: item.version_or_model_number
            }
          });
        }
        break;
        
      default:
        for (const item of results) {
          processedResults.push({
            source: endpointName,
            name: item.device_name || item.trade_name || item.product_description || "Unknown Device",
            description: `${endpointName} data for ${searchTerm}`,
            date: "Unknown",
            status: "Unknown",
            id: "",
            additionalInfo: {}
          });
        }
    }
  } catch (error) {
    console.error(`Error in processDeviceEndpointResults for ${endpointName}:`, error);
  }
  
  return processedResults;
}

// Helper function to fetch with retry
async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);
      lastError = error;
      
      // Don't retry on certain error codes
      if (error.response) {
        const status = error.response.status;
        if (status === 404 || status === 400) {
          throw error; // Don't retry on 404 (not found) or 400 (bad request)
        }
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random factor between 0.85 and 1.15
        delay = delay * 2 * jitter;
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// // Helper function to process results from different endpoints
// function processEndpointResults(endpointName, results, searchTerm) {
//   const processed = [];
  
//   switch (endpointName) {
//     case "drugsFda":
//       // Process drug application data
//       results.forEach(drug => {
//         const products = drug.products || [];
        
//         products.forEach(product => {
//           processed.push({
//             source: "drugsFda",
//             type: "application",
//             name: product.brand_name || drug.application_number,
//             applicationNumber: drug.application_number,
//             sponsorName: drug.sponsor_name,
//             approvalType: drug.application_type,
//             productType: product.dosage_form,
//             status: product.marketing_status,
//             description: `${product.brand_name || 'Unknown'} (${product.dosage_form || 'Unknown Dosage Form'})`
//           });
//         });
//       });
//       break;
      
//     case "label":
//       // Process drug labeling information
//       results.forEach(label => {
//         const brandName = label.openfda?.brand_name?.[0] || 'Unknown';
//         const genericName = label.openfda?.generic_name?.[0] || 'Unknown';
        
//         processed.push({
//           source: "label",
//           type: "label",
//           name: brandName,
//           genericName: genericName,
//           manufacturerName: label.openfda?.manufacturer_name?.[0] || 'Unknown',
//           description: label.indications_and_usage?.[0] || 'No indication information',
//           warnings: label.warnings?.[0] || 'No warnings information',
//           adverseReactions: label.adverse_reactions?.[0] || 'No adverse reactions information',
//           dosageAdministration: label.dosage_and_administration?.[0] || 'No dosage information'
//         });
//       });
//       break;
      
//     case "ndc":
//       // Process National Drug Code information
//       results.forEach(ndc => {
//         processed.push({
//           source: "ndc",
//           type: "product",
//           name: ndc.brand_name || ndc.generic_name || 'Unknown',
//           ndcCode: ndc.product_ndc,
//           genericName: ndc.generic_name || 'Unknown',
//           dosageForm: ndc.dosage_form,
//           routeOfAdmin: ndc.route?.[0] || 'Unknown',
//           packageDescription: ndc.packaging?.[0]?.description || 'No packaging information',
//           labelerName: ndc.labeler_name,
//           productType: ndc.product_type,
//           description: `${ndc.brand_name || ndc.generic_name || 'Unknown'} (${ndc.dosage_form || 'Unknown Form'})`
//         });
//       });
//       break;
      
//     case "enforcement":
//       // Process enforcement reports (recalls)
//       results.forEach(report => {
//         processed.push({
//           source: "enforcement",
//           type: "recall",
//           name: report.openfda?.brand_name?.[0] || report.product_description || 'Unknown',
//           recallNumber: report.recall_number,
//           recallInitiationDate: report.recall_initiation_date,
//           recallReason: report.reason_for_recall,
//           status: report.status,
//           classification: report.classification,
//           description: report.product_description || 'No product description'
//         });
//       });
//       break;
      
//     case "event":
//       // Process adverse event reports
//       results.forEach(event => {
//         // Find the drug matching our search term in the report
//         const drugReports = event.patient?.drug || [];
//         const relevantDrugs = drugReports.filter(drug => 
//           (drug.medicinalproduct || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
//           (drug.openfda?.brand_name?.[0] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
//           (drug.openfda?.generic_name?.[0] || '').toLowerCase().includes(searchTerm.toLowerCase())
//         );
        
//         if (relevantDrugs.length > 0) {
//           const drug = relevantDrugs[0]; // Use the first matching drug
          
//           processed.push({
//             source: "event",
//             type: "adverseEvent",
//             name: drug.medicinalproduct || drug.openfda?.brand_name?.[0] || 'Unknown',
//             genericName: drug.openfda?.generic_name?.[0] || 'Unknown',
//             reportDate: event.receiptdate,
//             seriousOutcomes: event.serious ? 'Yes' : 'No',
//             reactions: event.patient?.reaction?.map(r => r.reactionmeddrapt || 'Unknown reaction').join(', ') || 'No reactions reported',
//             description: `Adverse event report for ${drug.medicinalproduct || drug.openfda?.brand_name?.[0] || 'Unknown drug'}`
//           });
//         }
//       });
//       break;
      
//     default:
//       // Generic processing for other endpoints
//       results.forEach(result => {
//         processed.push({
//           source: endpointName,
//           name: result.openfda?.brand_name?.[0] || result.brand_name || result.generic_name || 'Unknown',
//           description: `Data from ${endpointName} endpoint`,
//           raw: result
//         });
//       });
//   }
  
//   return processed;
// }


// app.get('/api/fda/drug/:drugName', async (req, res) => {
//   console.log("Fetching comprehensive FDA drug data");
//   const { drugName } = req.params;
//   const searchType = req.query.type || 'brand';

//   try {
//     // Initialize result structure
//     const results = { 
//       endpoints: {}, 
//       combinedResults: []
//     };

//     // Define all FDA drug endpoints we'll query
//     const endpoints = {
//       drugsFda: "https://api.fda.gov/drug/drugsfda.json",
//       label: "https://api.fda.gov/drug/label.json",
//       ndc: "https://api.fda.gov/drug/ndc.json",
//       enforcement: "https://api.fda.gov/drug/enforcement.json",
//       event: "https://api.fda.gov/drug/event.json"
//     };

//     // Define search variations based on the drug name
//     const searchVariations = [
//       `*${drugName}*`,
//       // You can add variations here like manufacturer names if needed
//     ];

//     // Process each endpoint
//     for (const [endpointName, baseUrl] of Object.entries(endpoints)) {
//       let endpointSuccess = false;
      
//       // Try each search variation
//       for (const variation of searchVariations) {
//         if (endpointSuccess) continue; // Skip if we already have data
        
//         try {
//           // Build search query based on endpoint
//           let searchQuery;
          
//           switch (endpointName) {
//             case "drugsFda":
//               searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+sponsor_name:"${variation}"`;
//               break;
//             case "label":
//               searchQuery = `search=openfda.brand_name:"${variation}"+OR+openfda.generic_name:"${variation}"+OR+openfda.manufacturer_name:"${variation}"`;
//               break;
//             case "ndc":
//               searchQuery = `search=brand_name:"${variation}"+OR+generic_name:"${variation}"+OR+labeler_name:"${variation}"`;
//               break;
//             case "enforcement":
//               searchQuery = `search=product_description:"${variation}"`;
//               break;
//             case "event":
//               searchQuery = `search=patient.drug.medicinalproduct:"${variation}"+OR+patient.drug.openfda.brand_name:"${variation}"+OR+patient.drug.openfda.generic_name:"${variation}"`;
//               break;
//             default:
//               searchQuery = `search=${variation}`;
//           }
          
//           // Fetch all results using pagination
//           let allResults = [];
//           let skip = 0;
//           const BATCH_SIZE = 500; // FDA API maximum batch size
//           let hasMoreResults = true;
          
//           while (hasMoreResults) {
//             // Make the API request with pagination
//             const url = `${baseUrl}?${searchQuery}&limit=${BATCH_SIZE}&skip=${skip}`;
//             console.log(`Fetching FDA ${endpointName} with search term: ${variation}, skip: ${skip}`);
            
//             const response = await axios.get(url, { timeout: 30000 }); // Increased timeout for larger batches
            
//             const batchResults = response.data.results || [];
//             if (batchResults.length > 0) {
//               allResults = [...allResults, ...batchResults];
//               console.log(`Retrieved batch of ${batchResults.length} results. Total so far: ${allResults.length}`);
              
//               // Check if we've reached the end or if there might be more results
//               if (batchResults.length < BATCH_SIZE) {
//                 hasMoreResults = false; // End of results
//               } else {
//                 skip += BATCH_SIZE; // Move to next batch
//               }
//             } else {
//               hasMoreResults = false; // No results in this batch
//             }
            
//             // Safety check to prevent excessive requests (FDA API has rate limits)
//             if (allResults.length >= 500) {
//               console.warn(`Reached 5000 results for ${endpointName}, stopping pagination to prevent excessive requests`);
//               break;
//             }
//           }
          
//           if (allResults.length > 0) {
//             console.log(`Success! Found ${allResults.length} FDA records from ${endpointName} for ${variation}`);
//             results.endpoints[endpointName] = {
//               status: "success",
//               count: allResults.length,
//               data: allResults,
//               searchTerm: variation
//             };
            
//             // Process the results based on endpoint type
//             const processedResults = processEndpointResults(endpointName, allResults, variation);
//             results.combinedResults = [...results.combinedResults, ...processedResults];
            
//             endpointSuccess = true;
//             break; // Exit the variations loop for this endpoint
//           }
//         } catch (error) {
//           console.warn(`Failed FDA ${endpointName} request for ${variation}: ${error.message}`);
          
//           // Check if it's a rate limiting error
//           if (error.response && (error.response.status === 429 || error.response.status === 503)) {
//             console.warn('Rate limiting detected. Waiting before continuing...');
//             await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
//           }
//         }
//       }
      
//       // If no success with any variation, record the failure
//       if (!endpointSuccess) {
//         results.endpoints[endpointName] = {
//           status: "error",
//           error: "No data found across all search variations",
//           statusCode: "404",
//           data: []
//         };
//       }
//     }
    
//     // If no results found across all endpoints, add placeholder data
//     if (results.combinedResults.length === 0) {
//       results.combinedResults = [{
//         source: "placeholder",
//         name: drugName,
//         description: `No FDA data found for ${drugName} across all endpoints`,
//         date: "Unknown",
//         status: "Unknown"
//       }];
//     }

//     // Process drugsFda data into categorized format
//     const categorizedDrugs = {};
    
//     if (results.endpoints.drugsFda && results.endpoints.drugsFda.status === "success") {
//       for (const drug of results.endpoints.drugsFda.data) {
//         const appNumber = drug.application_number;
//         const products = drug.products || [];
//         const submissions = drug.submissions || [];
        
//         // Improved approval date extraction logic
//         let approvalDate = 'Unknown';
        
//         // First try to find ORIG-1 or submission number 1
//         const originalApproval = submissions.find(s =>
//           (s.submission_number === '1' || s.submission_number === 'ORIG-1') &&
//           (s.submission_status === 'AP' || s.submission_status === 'Approved')
//         );
        
//         // If not found, look for any approval
//         if (originalApproval) {
//           approvalDate = originalApproval.submission_status_date;
//         } else {
//           const anyApproval = submissions.find(s =>
//             s.submission_status === 'AP' || s.submission_status === 'Approved'
//           );
//           if (anyApproval) {
//             approvalDate = anyApproval.submission_status_date;
//           }
//         }
        
//         for (const product of products) {
//           if (!product.brand_name) continue;
          
//           const brandName = product.brand_name.toLowerCase();
//           const activeIngredients = product.active_ingredients || [];
//           const strength = activeIngredients.map(ing => `${ing.name} ${ing.strength}`).join(', ') || 'Unknown';
          
//           if (!categorizedDrugs[brandName]) categorizedDrugs[brandName] = {};
//           if (!categorizedDrugs[brandName][strength]) categorizedDrugs[brandName][strength] = [];
          
//           categorizedDrugs[brandName][strength].push({
//             brandName: product.brand_name,
//             applicationNumber: appNumber,
//             approvalDate,
//             submissions: submissions.map(s => ({
//               submissionNumber: s.submission_number,
//               status: s.submission_status,
//               date: s.submission_status_date,
//               type: s.submission_type
//             })),
//             hasDocuments: true,
//             fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
//             sponsorName: drug.sponsor_name,
//             activeIngredients,
//             manufacturerName: drug.openfda?.manufacturer_name?.[0] || drug.sponsor_name,
//             dosageForm: product.dosage_form,
//             route: product.route,
//             marketingStatus: product.marketing_status,
//           });
//         }
//       }
//     }

//     // Add metadata about the request
//     const metadata = {
//       query: drugName,
//       timestamp: new Date().toISOString(),
//       endpointsQueried: Object.keys(endpoints).length,
//       totalResults: results.combinedResults.length,
//       resultBreakdown: Object.entries(results.endpoints).map(([name, data]) => ({
//         endpoint: name,
//         status: data.status,
//         count: data.status === "success" ? data.count : 0
//       }))
//     };

//     // Return both the raw endpoint results and the categorized drugs
//     res.json({
//       metadata,
//       raw: results,
//       categorized: categorizedDrugs
//     });

//   } catch (error) {
//     console.error('Error fetching FDA drug data:', error);
//     res.status(500).json({ 
//       error: 'Error fetching drug data',
//       message: error.message 
//     });
//   }
// });




app.get('/api/fda/condition/:conditionName', async (req, res) => {
  console.log("Fetching FDA drug data by condition");
  const { conditionName } = req.params;

  try {
    // Initialize result structure
    const results = { 
      endpoints: {}, 
      combinedResults: []
    };

    // Define FDA endpoints (focus on 'label' first, others optional)
    const endpoints = {
      label: "https://api.fda.gov/drug/label.json",
      drugsFda: "https://api.fda.gov/drug/drugsfda.json" // Optional for additional details
    };

    // Process the 'label' endpoint first to get drugs by condition
    const labelBaseUrl = endpoints.label;
    const conditionSearchQuery = `search=indications_and_usage:"${conditionName}"`;
    const labelUrl = `${labelBaseUrl}?${conditionSearchQuery}&limit=100`;
    console.log(`Trying FDA label endpoint with condition: ${conditionName}`);

    const labelResponse = await axios.get(labelUrl, { timeout: 15000 });

    if (labelResponse.data && labelResponse.data.results && labelResponse.data.results.length > 0) {
      console.log(`Success! Found ${labelResponse.data.results.length} drugs for ${conditionName}`);
      results.endpoints.label = {
        status: "success",
        count: labelResponse.data.results.length,
        data: labelResponse.data.results,
        searchTerm: conditionName
      };

      // Extract drug names and details from label endpoint
      const drugs = labelResponse.data.results.map(result => ({
        brandName: result.openfda?.brand_name?.[0] || "Unknown",
        genericName: result.openfda?.generic_name?.[0] || "Unknown",
        indications: result.indications_and_usage?.[0] || "No indication details",
        manufacturer: result.openfda?.manufacturer_name?.[0] || result.sponsor_name || "Unknown"
      }));
      results.combinedResults = drugs;

      // Optionally fetch additional details from drugsFda using drug names
      if (endpoints.drugsFda) {
        const drugNames = drugs.map(d => d.brandName).filter(Boolean);
        for (const drugName of drugNames) {
          const drugSearchQuery = `search=openfda.brand_name:"${drugName}"`;
          const drugsFdaUrl = `${endpoints.drugsFda}?${drugSearchQuery}&limit=10`;
          try {
            const drugsFdaResponse = await axios.get(drugsFdaUrl, { timeout: 15000 });
            if (drugsFdaResponse.data && drugsFdaResponse.data.results) {
              results.endpoints.drugsFda = results.endpoints.drugsFda || { status: "success", data: [] };
              results.endpoints.drugsFda.data.push(...drugsFdaResponse.data.results);

              // Process drugsFda data into categorized format (from your original code)
              const categorizedDrugs = {};
              for (const drug of drugsFdaResponse.data.results) {
                const appNumber = drug.application_number;
                const products = drug.products || [];
                let approvalDate = "Unknown";
                const submissions = drug.submissions || [];
                const approval = submissions.find(s => s.submission_status === "AP" || s.submission_status === "Approved");
                if (approval) approvalDate = approval.submission_status_date;

                for (const product of products) {
                  if (!product.brand_name) continue;
                  const brandName = product.brand_name.toLowerCase();
                  const strength = product.active_ingredients?.map(ing => `${ing.name} ${ing.strength}`).join(", ") || "Unknown";
                  if (!categorizedDrugs[brandName]) categorizedDrugs[brandName] = {};
                  if (!categorizedDrugs[brandName][strength]) categorizedDrugs[brandName][strength] = [];

                  categorizedDrugs[brandName][strength].push({
                    brandName: product.brand_name,
                    applicationNumber: appNumber,
                    approvalDate,
                    fdaPage: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNumber.replace(/[^0-9]/g, '')}`,
                    sponsorName: drug.sponsor_name,
                    dosageForm: product.dosage_form,
                    route: product.route,
                    marketingStatus: product.marketing_status
                  });
                }
              }
              results.categorized = categorizedDrugs;
            }
          } catch (error) {
            console.warn(`Failed to fetch drugsFda data for ${drugName}: ${error.message}`);
          }
        }
      }
    } else {
      results.endpoints.label = {
        status: "error",
        error: `No drugs found for condition ${conditionName}`,
        statusCode: "404",
        data: []
      };
      results.combinedResults = [{
        source: "placeholder",
        condition: conditionName,
        description: `No FDA data found for condition ${conditionName}`,
      }];
    }

    // Return the results
    res.json({
      raw: results,
      categorized: results.categorized || {}
    });

  } catch (error) {
    console.error(`Error fetching FDA data for condition ${conditionName}:`, error);
    res.status(500).json({ 
      error: "Error fetching condition data",
      message: error.message 
    });
  }
});


// Middleware to validate drug name parameter
const validateDrugName = (req, res, next) => {
  const { drugName } = req.params;
  
  if (!drugName || drugName.trim() === '') {
    return res.status(400).json({
      error: 'Invalid drug name',
      message: 'Drug name parameter cannot be empty',
      approved: false
    });
  }
  
  next();
};

// Search function to find drugs in EMA data
function searchDrugByName(drugName) {
  // Normalize the search term
  const normalizedDrugName = drugName.toLowerCase().trim();
  
  // Search in different fields
  return emaMedicines.filter(medicine => {
    // Check in Name of medicine
    if (medicine['Name of medicine'] && 
        medicine['Name of medicine'].toLowerCase().includes(normalizedDrugName)) {
      return true;
    }
    
    // Check in INN / common name
    if (medicine['International non-proprietary name (INN) / common name'] && 
        medicine['International non-proprietary name (INN) / common name'].toLowerCase().includes(normalizedDrugName)) {
      return true;
    }
    
    // Check in Active substance
    if (medicine['Active substance'] && 
        medicine['Active substance'].toLowerCase().includes(normalizedDrugName)) {
      return true;
    }
    
    return false;
  });
}

// Function to format EMA data in a structure similar to FDA API response
function formatEmaApprovalResponse(drugResults) {
  if (!drugResults || drugResults.length === 0) {
    return {
      approved: false,
      approvalDate: null,
      indications: [],
      marketingStatus: [],
      details: null
    };
  }
  
  // Get the first (most relevant) result
  const drugInfo = drugResults[0];
  
  // Determine approval status based on Medicine status
  const isApproved = drugInfo['Medicine status'] === 'Authorised';
  
  // Format the response
  const approvalStatus = {
    approved: isApproved,
    approvalDate: drugInfo['Marketing authorisation date'] || null,
    indications: [],
    marketingStatus: [],
    details: null
  };
  
  // Extract active substances as indications (similar to FDA API)
  if (drugInfo['Active substance']) {
    const substances = drugInfo['Active substance'].split(';');
    approvalStatus.indications = substances.map(s => s.trim());
  }
  
  // Set marketing status based on Medicine status
  approvalStatus.marketingStatus = [drugInfo['Medicine status']];
  
  // Add additional details
  approvalStatus.details = {
    applicationNumbers: [drugInfo['EMA product number'] || 'Unknown'],
    sponsorName: drugInfo['Marketing authorisation developer / applicant / holder'] || 'Unknown',
    therapeuticIndication: drugInfo['Therapeutic indication'] || 'Not specified'
  };
  
  return approvalStatus;
}

// API endpoint for EMA drug approval status
app.get('/api/ema-approval/:drugName', validateDrugName, (req, res) => {
  try {
    const { drugName } = req.params;
    
    // Check cache first
    if (approvalCache.ema[drugName]) {
      return res.json(approvalCache.ema[drugName]);
    }
    
    // Search for the drug in the EMA data
    const drugResults = searchDrugByName(drugName);
    
    // Format the response
    const approvalStatus = formatEmaApprovalResponse(drugResults);
    
    // Cache the result
    approvalCache.ema[drugName] = approvalStatus;
    
    res.json(approvalStatus);
  } catch (error) {
    console.error('Error with EMA API:', error.message);
    res.status(500).json({ 
      error: 'Error fetching EMA approval data',
      message: error.message,
      approved: false 
    });
  }
});



// FDA API endpoint (unchanged)
app.get('/api/fda-approval/:drugName', FDAvalidateDrugName, async (req, res) => {
  try {
    const { drugName } = req.params;

    if (approvalCache.fda[drugName]) {
      return res.json(approvalCache.fda[drugName]);
    }

    const url = `https://api.fda.gov/drug/drugsfda.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}" OR openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=5`;
    const response = await axios.get(url);

    let approvalStatus = {
      approved: false,
      approvalDate: null,
      indications: [],
      marketingStatus: [],
      details: null
    };

    if (response.data && response.data.results && response.data.results.length > 0) {
      approvalStatus.approved = true;
      const products = response.data.results.flatMap(r => r.products || []);
      if (products.length > 0) {
        approvalStatus.marketingStatus = [...new Set(products.map(p => p.marketing_status))];
        const appDates = response.data.results
          .filter(r => r.application_number && r.submissions)
          .flatMap(r => r.submissions
            .filter(s => s.submission_status === 'AP' && s.submission_status_date)
            .map(s => ({ date: s.submission_status_date, app: r.application_number }))
          );
        if (appDates.length > 0) {
          appDates.sort((a, b) => new Date(b.date) - new Date(a.date));
          approvalStatus.approvalDate = appDates[0].date;
        }
        approvalStatus.indications = [
          ...new Set(
            response.data.results
              .filter(r => r.products)
              .flatMap(r => r.products
                .filter(p => p.active_ingredients)
                .map(p => p.active_ingredients.map(i => i.name))
              )
              .flat()
          )
        ];
        approvalStatus.details = {
          applicationNumbers: [...new Set(response.data.results.map(r => r.application_number))],
          sponsorName: response.data.results[0].sponsor_name || 'Unknown'
        };
      }
    }

    approvalCache.fda[drugName] = approvalStatus;
    res.json(approvalStatus);
  } catch (error) {
    console.error('Error with FDA API:', error.message);
    res.status(500).json({ 
      error: 'Error fetching FDA approval data',
      message: error.message,
      approved: false 
    });
  }
});



// Combined endpoint (unchanged)
app.get('/api/drug-approval/:drugName', FDAvalidateDrugName, async (req, res) => {
  try {
    const { drugName } = req.params;
    const [fdaResponse, emaResponse] = await Promise.all([
      axios.get(`http://localhost:${PORT}/api/fda-approval/${drugName}`),
      axios.get(`http://localhost:${PORT}/api/ema-approval/${drugName}`)
    ]);

    res.json({
      drug: drugName,
      fda: fdaResponse.data,
      ema: emaResponse.data
    });
  } catch (error) {
    console.error('Error checking approvals:', error.message);
    res.status(500).json({ 
      error: 'Error checking drug approvals',
      message: error.message 
    });
  }
});

/**
 * DailyMed API search endpoint
 * 
 * This endpoint searches for drug information from the DailyMed API
 * based on a drug name provided in the URL parameter
 */

/**
 * DailyMed API search endpoint
 * 
 * This endpoint searches for drug information from the DailyMed API
 * based on a drug name provided in the URL parameter
 */

/**
 * Enhanced DailyMed API search endpoint
 * 
 * This endpoint searches for drug information from the DailyMed API
 * and formats it properly for the frontend display
 */

/**
 * DailyMed API search endpoint
 * 
 * This endpoint searches for drug information from the DailyMed API
 * and formats it properly for the frontend display
 */

// Add the DailyMed route
// app.get('/api/fda/dailymed/:drugName', handleDailyMedRequest);

// Drug API route
app.get('/api/fda/dailymed', async (req, res) => {
  const drugName = req.query.name;
  const maxResults = req.query.maxResults ? parseInt(req.query.maxResults) : 1000; // Default to 1000 max results
  
  if (!drugName) {
    return res.status(400).json({ error: 'Drug name is required' });
  }
  
  try {
    const drugsData = await getAllDrugDataByName(drugName, maxResults);
    
    if (drugsData && drugsData.length > 0) {
      return res.status(200).json(drugsData);
    } else {
      return res.status(404).json({ error: `No data found for drug: ${drugName}` });
    }
  } catch (error) {
    console.error(`Error processing request for ${drugName}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Main function to get all drug data by name
async function getAllDrugDataByName(drugName, maxResults = 1000) {
  try {
    // Step 1: Search for the drug to get all SPL IDs
    const splIds = await searchAndGetAllSplIds(drugName, maxResults);
    
    if (!splIds || splIds.length === 0) {
      console.error(`No results found for drug name: ${drugName}`);
      return [];
    }
    
    console.log(`Found ${splIds.length} SPL IDs for ${drugName}`);
    
    // Step 2: Get detailed data for each SPL ID
    const drugsDataPromises = splIds.map(splId => getDrugDataById(splId));
    const drugsData = await Promise.all(drugsDataPromises);
    
    // Filter out any null results
    return drugsData.filter(data => data !== null);
    
  } catch (error) {
    console.error(`Error getting data for ${drugName}:`, error);
    throw error;
  }
}

// Function to search DailyMed and return all matching SPL IDs with pagination
async function searchAndGetAllSplIds(drugName, maxResults = 1000) {
  try {
    const encodedQuery = encodeURIComponent(drugName);
    let allSplIds = [];
    let pageNum = 1;
    const pageSize = 100; // DailyMed API default page size
    let hasMoreResults = true;
    
    while (hasMoreResults && allSplIds.length < maxResults) {
      const splIds = await fetchSplIdsPage(encodedQuery, pageNum, pageSize);
      
      if (splIds.length === 0) {
        hasMoreResults = false;
      } else {
        allSplIds = [...allSplIds, ...splIds];
        pageNum++;
      }
      
      console.log(`Fetched page ${pageNum-1}, retrieved ${splIds.length} SPL IDs, total: ${allSplIds.length}`);
    }
    
    return allSplIds.slice(0, maxResults);
  } catch (error) {
    console.error('Error in searchAndGetAllSplIds:', error);
    throw error;
  }
}

// Helper function to fetch a single page of SPL IDs
function fetchSplIdsPage(encodedQuery, pageNum, pageSize) {
  return new Promise((resolve, reject) => {
    // DailyMed API pagination parameters: page and pagesize
    const requestUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.xml?drug_name=${encodedQuery}&page=${pageNum}&pagesize=${pageSize}`;
    
    console.log(`Fetching page ${pageNum} with URL: ${requestUrl}`);
    
    https.get(requestUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP error! Status: ${response.statusCode}`));
        return;
      }
      
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, "text/xml");
          
          // Get all SPL IDs from the search results
          const splElements = xmlDoc.getElementsByTagName('setid');
          const splIds = [];
          
          for (let i = 0; i < splElements.length; i++) {
            const splId = splElements[i].textContent.trim();
            if (splId) {
              splIds.push(splId);
            }
          }
          
          resolve(splIds);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Function to get detailed drug data using SPL ID
function getDrugDataById(splId) {
  return new Promise((resolve, reject) => {
    const requestUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${splId}.xml`;
    
    https.get(requestUrl, (response) => {
      if (response.statusCode !== 200) {
        console.warn(`HTTP error for SPL ID ${splId}! Status: ${response.statusCode}`);
        resolve(null); // Don't reject, just return null for this ID
        return;
      }
      
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, "text/xml");
          
          // Extract the relevant information
          const drugInfo = extractDrugInfo(xmlDoc, splId);
          resolve(drugInfo);
        } catch (error) {
          console.warn(`Error parsing data for SPL ID ${splId}:`, error);
          resolve(null); // Don't reject, just return null for this ID
        }
      });
    }).on('error', (error) => {
      console.warn(`Network error for SPL ID ${splId}:`, error);
      resolve(null); // Don't reject, just return null for this ID
    });
  });
}

// Function to extract drug information from the XML document
function extractDrugInfo(xmlDoc, splId) {
  try {
    // Helper function to safely get text content
    const getTextContent = (element) => {
      if (!element) return null;
      return element.textContent.trim();
    };
    
    // Helper function to get all matching elements and extract their text content
    const getAllTextContent = (elements) => {
      const result = [];
      for (let i = 0; i < elements.length; i++) {
        const text = elements[i].textContent.trim();
        if (text) result.push(text);
      }
      return result;
    };
    
    // Extract basic information
    const titleElements = xmlDoc.getElementsByTagName('title');
    let title = "Unknown";
    
    // Look for the document title, which is typically one of the first title elements
    for (let i = 0; i < Math.min(5, titleElements.length); i++) {
      const text = getTextContent(titleElements[i]);
      if (text && text.length > 10) { // Assuming a meaningful title has at least 10 chars
        title = text;
        break;
      }
    }
    
    // Try to get more specific product name
    const productNameElements = xmlDoc.getElementsByTagName('name');
    let productName = null;
    
    for (let i = 0; i < productNameElements.length; i++) {
      const parent = productNameElements[i].parentNode;
      if (parent && (parent.nodeName === 'manufacturedProduct' || parent.nodeName === 'product')) {
        productName = getTextContent(productNameElements[i]);
        if (productName) break;
      }
    }
    
    if (!productName) {
      for (let i = 0; i < Math.min(3, productNameElements.length); i++) {
        productName = getTextContent(productNameElements[i]);
        if (productName) break;
      }
    }
    
    // Extract manufacturer (may be in different places in the XML)
    let manufacturer = null;
    const manufacturerOrgElements = xmlDoc.getElementsByTagName('manufacturerOrganization');
    for (let i = 0; i < manufacturerOrgElements.length; i++) {
      const nameElement = manufacturerOrgElements[i].getElementsByTagName('name')[0];
      if (nameElement) {
        manufacturer = getTextContent(nameElement);
        break;
      }
    }
    
    // If no manufacturer found, try alternative approach
    if (!manufacturer) {
      const orgElements = xmlDoc.getElementsByTagName('organization');
      for (let i = 0; i < orgElements.length; i++) {
        const nameElement = orgElements[i].getElementsByTagName('name')[0];
        if (nameElement) {
          manufacturer = getTextContent(nameElement);
          break;
        }
      }
    }
    
    // Extract active ingredients
    const ingredientElements = xmlDoc.getElementsByTagName('ingredient');
    const activeIngredients = [];
    
    for (let i = 0; i < ingredientElements.length; i++) {
      const ingredient = ingredientElements[i];
      const classCode = ingredient.getAttribute('classCode');
      
      if (classCode === 'ACTIB' || classCode === 'ACTIM') {
        const substanceElements = ingredient.getElementsByTagName('ingredientSubstance');
        if (substanceElements.length > 0) {
          const nameElement = substanceElements[0].getElementsByTagName('name')[0];
          if (nameElement) {
            activeIngredients.push(getTextContent(nameElement));
          }
        }
      }
    }
    
    // Extract dosage forms
    const formCodeElements = xmlDoc.getElementsByTagName('formCode');
    const dosageForms = [];
    
    for (let i = 0; i < formCodeElements.length; i++) {
      const displayName = formCodeElements[i].getAttribute('displayName');
      if (displayName && !dosageForms.includes(displayName)) {
        dosageForms.push(displayName);
      }
    }
    
    // Extract sections
    const sectionElements = xmlDoc.getElementsByTagName('section');
    let indications = "Not specified";
    let warnings = "Not specified";
    let dosage = "Not specified";
    let contraindications = "Not specified";
    let adverseReactions = "Not specified";
    let drugInteractions = "Not specified";
    
    for (let i = 0; i < sectionElements.length; i++) {
      const section = sectionElements[i];
      const titleElement = section.getElementsByTagName('title')[0];
      
      if (!titleElement) continue;
      
      const title = getTextContent(titleElement);
      const textElement = section.getElementsByTagName('text')[0];
      
      if (!textElement) continue;
      
      const text = getTextContent(textElement);
      
      if (title && text) {
        if (title.includes('INDICATIONS AND USAGE') || title.includes('USES')) {
          indications = text;
        } else if (title.includes('WARNINGS') || title.includes('BOXED WARNING')) {
          warnings = text;
        } else if (title.includes('DOSAGE AND ADMINISTRATION') || title.includes('DOSAGE')) {
          dosage = text;
        } else if (title.includes('CONTRAINDICATIONS')) {
          contraindications = text;
        } else if (title.includes('ADVERSE REACTIONS') || title.includes('SIDE EFFECTS')) {
          adverseReactions = text;
        } else if (title.includes('DRUG INTERACTIONS')) {
          drugInteractions = text;
        }
      }
    }
    
    // Extract document effective time (when the label was approved/updated)
    const effectiveTimeElements = xmlDoc.getElementsByTagName('effectiveTime');
    let effectiveTime = null;
    
    for (let i = 0; i < effectiveTimeElements.length; i++) {
      const valueElement = effectiveTimeElements[i].getAttribute('value');
      if (valueElement) {
        // Format YYYYMMDD to YYYY-MM-DD
        if (valueElement.length === 8) {
          effectiveTime = `${valueElement.substring(0, 4)}-${valueElement.substring(4, 6)}-${valueElement.substring(6, 8)}`;
          break;
        } else {
          effectiveTime = valueElement;
          break;
        }
      }
    }
    
    // Return structured data
    return {
      splId: splId,
      title: title,
      productName: productName || title,
      manufacturer: manufacturer || "Unknown",
      activeIngredients: activeIngredients.length > 0 ? activeIngredients : ["Unknown"],
      dosageForms: dosageForms.length > 0 ? dosageForms : ["Unknown"],
      indications: indications,
      warnings: warnings,
      dosage: dosage,
      contraindications: contraindications,
      adverseReactions: adverseReactions,
      drugInteractions: drugInteractions,
      effectiveTime: effectiveTime || "Unknown",
      labelUrl: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${splId}`
    };
  } catch (error) {
    console.error("Error extracting drug info:", error);
    return {
      splId: splId,
      error: "Failed to extract complete information"
    };
  }
}




// app.get('/api/fda/dailymed/:drug', async (req, res) => {
//   try {
//     const drugName = req.params.drug;
    
//     // Base URL for DailyMed API
//     const baseUrl = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
    
//     console.log(`[DailyMed] Searching for: ${drugName}`);
    
//     // Search for drug by name - explicitly request JSON format
//     const searchUrl = `${baseUrl}/drugnames.json?drug_name=${encodeURIComponent(drugName)}`;
    
//     const response = await fetch(searchUrl);
    
//     if (!response.ok) {
//       console.error(`[DailyMed] API error: ${response.status}`);
//       return res.json({ 
//         label_info: [] 
//       });
//     }
    
//     const data = await response.json();
//     console.log(`[DailyMed] Found ${data.data?.length || 0} results`);
    
//     // If no results found
//     if (!data.data || data.data.length === 0) {
//       return res.json({ 
//         label_info: [] 
//       });
//     }
    
//     // Transform the data to match frontend expectations
//     const labelInfo = [];
//     const processedSetIds = new Set(); // Track unique setIds to avoid duplicates
    
//     for (const drugInfo of data.data) {
//       // Skip if no setid or we've already processed this setId
//       if (!drugInfo.setid || processedSetIds.has(drugInfo.setid)) {
//         continue;
//       }
      
//       processedSetIds.add(drugInfo.setid);
      
//       // Create an entry with drug search information
//       const entry = {
//         title: drugInfo.drug_name || "Unknown Drug",
//         published: "N/A",
//         setId: drugInfo.setid,
//         // Use the correct URL format for direct link to drug info
//         labelUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${drugInfo.setid}`,
//         // Add direct PDF download link
//         pdfUrl: `https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=${drugInfo.setid}`
//       };
      
//       // Add to our results
//       labelInfo.push(entry);
//     }
    
//     // Return the data in the format expected by the frontend
//     console.log(`[DailyMed] Returning ${labelInfo.length} formatted results`);
//     return res.json({
//       label_info: labelInfo
//     });
    
//   } catch (error) {
//     console.error('[DailyMed] Error:', error);
//     return res.json({ 
//       label_info: [],
//       error: true,
//       message: error.message
//     });
//   }
// });

// Optional: Additional endpoint to get all available information for a drug by setId
app.get('/api/fda/dailymed/details/:setId', async (req, res) => {
  try {
    const setId = req.params.setId;
    const baseUrl = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
    
    // Get detailed SPL information
    const splUrl = `${baseUrl}/spls/${setId}.json`;
    const splResponse = await fetch(splUrl);
    
    if (!splResponse.ok) {
      throw new Error(`DailyMed API returned status: ${splResponse.status}`);
    }
    
    const splData = await splResponse.json();
    
    // Get NDC codes
    const ndcUrl = `${baseUrl}/spls/${setId}/ndcs.json`;
    const ndcResponse = await fetch(ndcUrl);
    const ndcData = ndcResponse.ok ? await ndcResponse.json() : { data: [] };
    
    // Get packaging information
    const packagingUrl = `${baseUrl}/spls/${setId}/packaging.json`;
    const packagingResponse = await fetch(packagingUrl);
    const packagingData = packagingResponse.ok ? await packagingResponse.json() : { data: [] };
    
    // Get version history
    const historyUrl = `${baseUrl}/spls/${setId}/history.json`;
    const historyResponse = await fetch(historyUrl);
    const historyData = historyResponse.ok ? await historyResponse.json() : { data: [] };
    
    // Return all collected data
    res.json({
      success: true,
      spl: splData.data,
      ndcs: ndcData.data,
      packaging: packagingData.data,
      history: historyData.data,
      pdfLink: `https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=${setId}`,
      zipLink: `https://dailymed.nlm.nih.gov/dailymed/downloadzipfile.cfm?setId=${setId}`
    });
    
  } catch (error) {
    console.error('Error fetching detailed drug information:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching detailed drug information',
      error: error.message
    });
  }
});

// app.get('/api/fda/dailymed/:ingredient', async (req, res) => {
//   console.log("497")
//   const { ingredient } = req.params;
  
//   try {
//     // For better results, clean up the ingredient name 
//     // by removing any dosage information or parentheses
//     const cleanIngredient = ingredient
//       .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses and their content
//       .replace(/\d+\s*mg|\d+\s*mcg|\d+\s*mL/gi, '') // Remove dosages
//       .trim();
    
//     const response = await axios.get(`${DAILYMED_API_URL}/spls.json?ingredient=${encodeURIComponent(cleanIngredient)}`);
//     const data = response.data;
    
//     if (!data.data || data.data.length === 0) {
//       return res.json({ error: 'No DailyMed data found' });
//     }
    
//     const labelInfo = await Promise.all(
//       data.data.slice(0, 5).map(async (label) => {
//         try {
//           // Use proper Accept header to avoid 415 errors
//           const detailsResponse = await axios.get(`${DAILYMED_API_URL}/spls/${label.setid}.json`, {
//             headers: { 
//               'Accept': 'application/json',
//               'Content-Type': 'application/json'
//             }
//           });
//           const details = detailsResponse.data;
          
//           // Format the published date properly
//           let formattedDate = label.published;
//           try {
//             if (label.published) {
//               const pubDate = new Date(label.published);
//               if (!isNaN(pubDate.getTime())) {
//                 // Format as YYYY-MM-DD
//                 formattedDate = pubDate.toISOString().split('T')[0];
//               }
//             }
//           } catch (e) {
//             console.error("Error formatting DailyMed date:", e);
//           }
          
//           return {
//             setId: label.setid,
//             title: details.title || label.title,
//             published: formattedDate,
//             labelUrl: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${label.setid}`,
//             packageUrl: details.packaging_uris?.[0] 
//               ? `https://dailymed.nlm.nih.gov/dailymed/image.cfm?setid=${label.setid}&type=img`
//               : null,
//             activeIngredients: details.active_ingredients || [],
//             ndc: details.package_ndc?.join(', ') || 'N/A',
//             rxcui: details.rxcui || 'N/A',
//             // Add more useful information if available
//             manufacturer: details.labeler || 'N/A',
//             dosageForm: details.dosage_forms_and_strengths || 'N/A'
//           };
//         } catch (error) {
//           console.error(`Error fetching details for label ${label.setid}:`, error.message);
          
//           // Format the published date even when detail fetch fails
//           let formattedDate = label.published;
//           try {
//             if (label.published) {
//               const pubDate = new Date(label.published);
//               if (!isNaN(pubDate.getTime())) {
//                 formattedDate = pubDate.toISOString().split('T')[0];
//               }
//             }
//           } catch (e) {
//             console.error("Error formatting DailyMed date:", e);
//           }
          
//           // Return basic info when detailed fetch fails
//           return {
//             setId: label.setid,
//             title: label.title,
//             published: formattedDate,
//             labelUrl: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${label.setid}`
//           };
//         }
//       })
//     );
    
//     res.json({ label_info: labelInfo });
//   } catch (error) {
//     handleApiError(error, res, 'Error fetching DailyMed data');
//   }
// });



// app.get('/api/fda/orangebook/search', (req, res) => {
//   console.log("849")
//   const { q: query } = req.query;

//   if (!query) {
//     return res.status(400).json({ error: 'Query parameter is required' });
//   }

//   const searchTerm = query.toLowerCase();
//   const results = {
//     products: [],
//     patents: [],
//     exclusivity: []
//   };

//   // Search Products
//   results.products = orangeBookData.products.filter(product =>
//     Object.values(product).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     )
//   );

//   // Search Patents
//   results.patents = orangeBookData.patents.filter(patent =>
//     Object.values(patent).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     )
//   );

//   // Search Exclusivity
//   results.exclusivity = orangeBookData.exclusivity.filter(exclusivity =>
//     Object.values(exclusivity).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     )
//   );

//   res.json({
//     results: {
//       products: results.products.slice(0, 50), // Limit results for performance
//       patents: results.patents.slice(0, 50),
//       exclusivity: results.exclusivity.slice(0, 50)
//     },
//     total: {
//       products: results.products.length,
//       patents: results.patents.length,
//       exclusivity: results.exclusivity.length
//     }
//   });
// });



// app.get('/api/fda/orangebook/search', (req, res) => {
//   console.log("Orange Book search endpoint called");
//   const { q: query } = req.query;
  
//   if (!query) {
//     return res.status(400).json({ error: 'Query parameter is required' });
//   }
  
//   const searchTerm = query.toLowerCase();
//   let results = {
//     products: [],
//     patents: [],
//     exclusivity: []
//   };
  
//   // Step 1: Search Products first
//   results.products = orangeBookData.products.filter(product =>
//     Object.values(product).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     )
//   );
  
//   // Step 2: Create a map of Application Number and Product Number combinations
//   const appProductMap = new Set();
  
//   // Add all found products to the map
//   results.products.forEach(product => {
//     if (product.Appl_No && product.Product_No) {
//       appProductMap.add(`${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`);
//     }
//   });
  
//   // Step 3: Find related patents
//   results.patents = orangeBookData.patents.filter(patent => {
//     // First check if the patent data directly matches the search term
//     const directMatch = Object.values(patent).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     );
    
//     // Then check if this patent is related to any of our found products
//     const relatedMatch = appProductMap.has(`${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}`);
    
//     return directMatch || relatedMatch;
//   });
  
//   // Step 4: Find related exclusivity data
//   results.exclusivity = orangeBookData.exclusivity.filter(exclusivity => {
//     // First check if the exclusivity data directly matches the search term
//     const directMatch = Object.values(exclusivity).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     );
    
//     // Then check if this exclusivity is related to any of our found products
//     const relatedMatch = appProductMap.has(`${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}`);
    
//     return directMatch || relatedMatch;
//   });
  
//   // Step 5: Enrich products with their related patent and exclusivity information
//   const enrichedProducts = results.products.map(product => {
//     const productKey = `${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`;
    
//     // Find related patents for this product
//     const relatedPatents = results.patents.filter(patent => 
//       `${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}` === productKey
//     );
    
//     // Find related exclusivity data for this product
//     const relatedExclusivity = results.exclusivity.filter(exclusivity => 
//       `${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}` === productKey
//     );
    
//     return {
//       ...product,
//       related_patents: relatedPatents,
//       related_exclusivity: relatedExclusivity
//     };
//   });
//   console.log(results)
//   // Respond with the enrichsed data
//   res.json({
//     results: {
//       products: enrichedProducts.slice(0, 50), // Limit results for performance but include related data
//       patents: results.patents.slice(0, 50),
//       exclusivity: results.exclusivity.slice(0, 50)
//     },
//     total: {
//       products: results.products.length,
//       patents: results.patents.length,
//       exclusivity: results.exclusivity.length
//     }
//   });
// });



app.get('/api/fda/orangebook/search', (req, res) => {
  console.log("Orange Book search endpoint called with pagination");
  const { q: query, page = 1, limit = 50 } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  const searchTerm = query.toLowerCase();
  const pageNum = parseInt(page);
  const itemsPerPage = parseInt(limit);
  
  let results = {
    products: [],
    patents: [],
    exclusivity: [],
    companies: []
  };
  
  // Step 1: Search Products first
  results.products = orangeBookData.products.filter(product =>
    Object.values(product).some(val =>
      String(val).toLowerCase().includes(searchTerm)
    )
  );
  
  // Step 2: Create a map of Application Number and Product Number combinations
  const appProductMap = new Set();
  
  // FIX: Complete the forEach statement
  results.products.forEach(product => {
    if (product.Appl_No && product.Product_No) {
      appProductMap.add(`${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`);
    }
  });
  
  // Step 3: Find related patents
  results.patents = orangeBookData.patents.filter(patent => {
    const directMatch = Object.values(patent).some(val =>
      String(val).toLowerCase().includes(searchTerm)
    );
    const relatedMatch = appProductMap.has(`${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}`);
    return directMatch || relatedMatch;
  });
  
  // Step 4: Find related exclusivity data
  results.exclusivity = orangeBookData.exclusivity.filter(exclusivity => {
    const directMatch = Object.values(exclusivity).some(val =>
      String(val).toLowerCase().includes(searchTerm)
    );
    const relatedMatch = appProductMap.has(`${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}`);
    return directMatch || relatedMatch;
  });
  
  // Step 5: Extract unique company names
  const uniqueCompanies = new Set();
  results.products.forEach(product => {
    if (product.Applicant_Full_Name) {
      uniqueCompanies.add(product.Applicant_Full_Name);
    }
  });
  results.companies = Array.from(uniqueCompanies);
  
  // Step 6: Enrich products with related data (do this before pagination)
  const enrichedProducts = results.products.map(product => {
    const productKey = `${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`;
    
    const relatedPatents = results.patents.filter(patent => 
      `${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}` === productKey
    );
    
    const relatedExclusivity = results.exclusivity.filter(exclusivity => 
      `${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}` === productKey
    );
    
    return {
      ...product,
      related_patents: relatedPatents,
      related_exclusivity: relatedExclusivity
    };
  });
  
  // Calculate pagination
  const totalProducts = enrichedProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (pageNum - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  // Paginate products only, keep all patents and exclusivity for accurate counts
  const paginatedProducts = enrichedProducts.slice(startIndex, endIndex);
  
  // Step 7: Respond with paginated data
  res.json({
    results: {
      products: paginatedProducts,
      patents: results.patents,
      exclusivity: results.exclusivity,
      companies: results.companies
    },
    total: {
      products: totalProducts,
      patents: results.patents.length,
      exclusivity: results.exclusivity.length,
      companies: results.companies.length
    },
    pagination: {
      currentPage: pageNum,
      totalPages: totalPages,
      itemsPerPage: itemsPerPage,
      totalItems: totalProducts,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  });
});


// app.get('/api/fda/orangebook/search', (req, res) => {
//   console.log("Orange Book search endpoint called");
//   const { q: query } = req.query;
  
//   if (!query) {
//     return res.status(400).json({ error: 'Query parameter is required' });
//   }
  
//   const searchTerm = query.toLowerCase();
//   let results = {
//     products: [],
//     patents: [],
//     exclusivity: [],
//     companies: [] // Add companies to results
//   };
  
//   // Step 1: Search Products first
//   results.products = orangeBookData.products.filter(product =>
//     Object.values(product).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     )
//   );
  
//   // Step 2: Collect unique company names
//   const companySet = new Set();
//   results.products.forEach(product => {
//     if (product.Applicant) { // Adjust field name based on your data structure
//       companySet.add(product.Applicant);
//     }
//   });
//   results.companies = Array.from(companySet);
  
//   // Step 3: Create a map of Application Number and Product Number combinations
//   const appProductMap = new Set();
//   results.products.forEach(product => {
//     if (product.Appl_No && product.Product_No) {
//       appProductMap.add(`${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`);
//     }
//   });
  
//   // Step 4: Find related patents
//   results.patents = orangeBookData.patents.filter(patent => {
//     const directMatch = Object.values(patent).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     );
//     const relatedMatch = appProductMap.has(`${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}`);
//     return directMatch || relatedMatch;
//   });
  
//   // Step 5: Find related exclusivity data
//   results.exclusivity = orangeBookData.exclusivity.filter(exclusivity => {
//     const directMatch = Object.values(exclusivity).some(val =>
//       String(val).toLowerCase().includes(searchTerm)
//     );
//     const relatedMatch = appProductMap.has(`${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}`);
//     return directMatch || relatedMatch;
//   });
  
//   // Step 6: Enrich products with their related patent and exclusivity information
//   const enrichedProducts = results.products.map(product => {
//     const productKey = `${product.Appl_Type}-${product.Appl_No}-${product.Product_No}`;
    
//     const relatedPatents = results.patents.filter(patent => 
//       `${patent.Appl_Type}-${patent.Appl_No}-${patent.Product_No}` === productKey
//     );
    
//     const relatedExclusivity = results.exclusivity.filter(exclusivity => 
//       `${exclusivity.Appl_Type}-${exclusivity.Appl_No}-${exclusivity.Product_No}` === productKey
//     );
    
//     return {
//       ...product,
//       related_patents: relatedPatents,
//       related_exclusivity: relatedExclusivity
//     };
//   });
  
//   // Step 7: Respond with enriched data including companies
//   res.json({
//     results: {
//       products: enrichedProducts.slice(0, 50),
//       patents: results.patents.slice(0, 50),
//       exclusivity: results.exclusivity.slice(0, 50),
//       companies: results.companies.slice(0, 50) // Include company names
//     },
//     total: {
//       products: results.products.length,
//       patents: results.patents.length,
//       exclusivity: results.exclusivity.length,
//       companies: results.companies.length
//     }
//   });
// });














//######################################################################################################################################
//#######################################################################################################################################
app.get('/api/drugs/similar/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Finding similar drugs for: ${drugName}`);
    
    const similarDrugs = await DrugClassification.findSimilarDrugsByName(drugName);
    
    res.json({
      success: true,
      data: similarDrugs
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get FDA guidance related to a drug
 */
app.get('/api/fda/guidance/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Fetching FDA guidance for: ${drugName}`);
    
    const guidance = await FDAGuidance.searchGuidanceDocuments(drugName);
    res.json({
      success: true,
      data: guidance
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get FDA approval information
 */
app.get('/api/fda/approval/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Fetching FDA approval info for: ${drugName}`);
    
    const approvalInfo = await FDAApproval.getApprovalInfo(drugName);
    
    res.json({
      success: true,
      data: approvalInfo
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get DailyMed labeling information
 */
// app.get('/api/dailymed/:drugName', async (req, res) => {
//   try {
//     const { drugName } = req.params;
//     console.log(`🔍 Fetching DailyMed info for: ${drugName}`);
    
//     const labelInfo = await DailyMed.getLabelInfo(drugName);
    
//     res.json({
//       success: true,
//       data: labelInfo
//     });
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });

/**
 * Endpoint to get Orange Book patent information
 */
app.get('/api/orangebook/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Fetching Orange Book info for: ${drugName}`);
    
    const patentInfo = await OrangeBook.getPatentInfo(drugName);
    
    res.json({
      success: true,
      data: patentInfo
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get FDA warning letters
 */
app.get('/api/fda/warnings/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    console.log(`🔍 Searching FDA warning letters for: ${searchTerm}`);
    
    const warnings = await WarningLetters.searchWarningLetters(searchTerm);
    
    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

// /**
//  * Endpoint to get PubMed publications
//  */
// app.get('/api/pubmed/:drugName', async (req, res) => {
//   try {
//     const { drugName } = req.params;
//     console.log(`🔍 Fetching PubMed publications for: ${drugName}`);
    
//     const publications = await PubMed.searchPublications(drugName);
    
//     res.json({
//       success: true,
//       data: publications
//     });
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });
// app.get('/api/pubmed', handlePubMedSearch);
/**
 * Endpoint to calculate treatment effect and variability
 */
app.get('/api/treatment-effect/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Calculating treatment effect for: ${drugName}`);
    
    const effectData = await TreatmentEffectCalculator.calculateTreatmentEffect(drugName);
    
    res.json({
      success: true,
      data: effectData
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Comprehensive endpoint to get all drug information at once
 */
app.get('/api/drug-complete/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    console.log(`🔍 Fetching comprehensive information for: ${drugName}`);
    
    // Execute all requests in parallel for efficiency
    const [
      similarDrugs,
      guidance,
      approvalInfo,
      labelInfo,
      patentInfo,
      warnings,
      publications,
      treatmentEffect
    ] = await Promise.all([
      DrugClassification.findSimilarDrugsByName(drugName),
      FDAGuidance.searchGuidanceDocuments(drugName),
      FDAApproval.getApprovalInfo(drugName),
      DailyMed.getLabelInfo(drugName),
      OrangeBook.getPatentInfo(drugName),
      WarningLetters.searchWarningLetters(drugName),
      PubMed.searchPublications(drugName),
      TreatmentEffectCalculator.calculateTreatmentEffect(drugName)
    ]);
    
    // Search for clinical trials for this drug
    const trialsResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
      params: {
        'query.intr': drugName,
        'countTotal': true,
        'pageSize': 20,
        'format': 'json'
      }
    });
    
    // Extract clinical trial summaries
    const trials = {
      count: trialsResponse.data.totalCount || 0,
      studies: trialsResponse.data.studies || []
    };
    
    // Combine all data into a comprehensive response
    const completeData = {
      drugName,
      similarDrugs,
      guidance,
      approvalInfo,
      labelInfo,
      patentInfo,
      warnings,
      publications,
      treatmentEffect,
      trials
    };
    
    res.json({
      success: true,
      data: completeData
    });
  } catch (error) {
    handleApiError(error, res);
  }
});


/**
 * Main endpoint to search studies with various parameters
 */
// app.get('/api/studies/search', validatePagination, async (req, res) => {
//   try {
//     const { 
//       query, condition, intervention, status, phase, sponsor, 
//       title, location, patientData, sort, countTotal, fields,
//       advanced
//     } = req.query;
    
//     const { page, pageSize } = req.pagination;
    
//     console.log(`🔍 Searching for studies with query: ${query || 'None specified'}`);
    
//     // Build parameters for API request
//     const params = new URLSearchParams();
    
//     // Add query parameters
//     if (condition) params.append('query.cond', condition);
//     if (intervention) params.append('query.intr', intervention);
//     if (title) params.append('query.titles', title);
//     if (location) params.append('query.locn', location);
//     if (sponsor) params.append('query.spons', sponsor);
//     if (query) params.append('query.term', query);
//     if (patientData) params.append('query.patient', patientData);
    
//     // Add filter parameters
//     if (status) {
//       if (Array.isArray(status)) {
//         params.append('filter.overallStatus', status.join(','));
//       } else {
//         params.append('filter.overallStatus', status);
//       }
//     }
    
//     // Add advanced filter
//     if (advanced) params.append('filter.advanced', advanced);
    
//     // Add pagination
//     params.append('pageSize', pageSize);
//     if (req.query.pageToken) {
//       params.append('pageToken', req.query.pageToken);
//     }
    
//     // Add sorting
//     if (sort) {
//       if (Array.isArray(sort)) {
//         params.append('sort', sort.join(','));
//       } else {
//         params.append('sort', sort);
//       }
//     }
    
//     // Add count total
//     if (countTotal) params.append('countTotal', true);
    
//     // Add fields
//     if (fields) {
//       if (Array.isArray(fields)) {
//         params.append('fields', fields.join(','));
//       } else {
//         params.append('fields', fields);
//       }
//     } else {
//       // Default fields if none specified - comprehensive data
//       params.append('fields', 'protocolSection,derivedSection,hasResults');
//     }
    
//     // Format parameter
//     params.append('format', 'json');
    
//     // Make the API request
//     const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//       params: params
//     });
    
//     // Format pagination for frontend
//     const totalCount = response.data.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / pageSize);
//     const hasNextPage = !!response.data.nextPageToken;
    
//     const paginationInfo = {
//       currentPage: page,
//       pageSize,
//       totalCount,
//       totalPages,
//       hasNextPage,
//       nextPageToken: response.data.nextPageToken
//     };
    
//     res.json({
//       success: true,
//       data: response.data,
//       pagination: paginationInfo
//     });
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });

// Add an endpoint to collect all drug names from a search
app.get('/api/collect-names/:name', async (req, res) => {
  try {
    const drugName = req.params.name;
    console.log(`Collecting all names for drug: ${drugName}`);
    
    // Use the existing drug search function
    const results = {
      originalQuery: drugName,
      sources: {
        rxnorm: { names: [], links: [] },
        fda: { names: [], links: [] },
        pubchem: { names: [], links: [] },
        chembl: { names: [], links: [] },
        clinicaltrials: { names: [], links: [] }
      }
    };

    // Run all searches in parallel
    await Promise.all([
      searchRxNorm(drugName, results),
      searchFDA(drugName, results),
      searchPubChem(drugName, results),
      searchChEMBL(drugName, results),
      searchClinicalTrials(drugName, results)
    ]);
    
    // Extract all the unique drug names from the search results
    const allNames = new Set();
    const namesBySource = {};
    
    for (const [sourceName, sourceData] of Object.entries(results.sources)) {
      namesBySource[sourceName] = [];
      
      if (sourceData.names && sourceData.names.length > 0) {
        for (const nameObj of sourceData.names) {
          // Skip error and info messages
          if (nameObj.type === 'Error' || nameObj.type === 'Info' || 
              !nameObj.name || typeof nameObj.name !== 'string') {
            continue;
          }
          
          // Skip very short names (likely not useful for searches)
          if (nameObj.name.trim().length < 3) {
            continue;
          }
          
          // Add to the source-specific list
          namesBySource[sourceName].push({
            name: nameObj.name,
            type: nameObj.type
          });
          
          // Add to the unique set
          allNames.add(nameObj.name);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        originalQuery: drugName,
        uniqueNameCount: allNames.size,
        uniqueNames: Array.from(allNames),
        namesBySource: namesBySource
      }
    });
  } catch (error) {
    console.error('Error collecting drug names:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while collecting drug names',
      message: error.message
    });
  }
});

// Clinical Trials Aggregation endpoint
app.post('/api/aggregate-trials', async (req, res) => {
  try {
    const { drugNames } = req.body;
    
    if (!drugNames || !Array.isArray(drugNames) || drugNames.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of drug names' 
      });
    }
    
    // Remove duplicates and empty strings
    const uniqueDrugNames = [...new Set(drugNames.filter(name => 
      name && typeof name === 'string' && name.trim() !== ''
    ))];
    
    if (uniqueDrugNames.length === 0) {
      return res.status(400).json({ 
        error: 'No valid drug names provided' 
      });
    }
    
    // Limit the total number of names to prevent overloading
    const maxDrugNames = 50;
    const limitedDrugNames = uniqueDrugNames.slice(0, maxDrugNames);
    const wasTruncated = limitedDrugNames.length < uniqueDrugNames.length;
    
    // Perform the search
    const results = await searchAllTrialsForDrugNames(limitedDrugNames);
    
    // Return the results
    res.json({
      success: true,
      data: {
        trials: results.trials,
        errors: results.errors,
        stats: {
          totalDrugNamesProvided: uniqueDrugNames.length,
          totalDrugNamesSearched: limitedDrugNames.length,
          wasTruncated,
          totalUniqueTrials: results.totalUniqueTrials
        }
      }
    });
  } catch (error) {
    console.error('Error in aggregate trials endpoint:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      message: error.message
    });
  }
});

// Fixed RxNorm API function - Following official API documentation
async function searchRxNorm(drugName, results) {
  try {
    // Step 1: Get RxCUI for the drug using CORRECT endpoint format
    // According to docs: GET /REST/rxcui.json?name=yourName&search=0or1or2or9
    const rxcuiResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json`, {
      params: {
        name: drugName,
        search: 2  // "Exact or Normalized" search (try exact first, then normalized)
      }
    });
    
    // Check if we got valid data
    if (rxcuiResponse.data && rxcuiResponse.data.idGroup && rxcuiResponse.data.idGroup.rxnormId) {
      const rxcui = rxcuiResponse.data.idGroup.rxnormId[0];
      
      // Add the standard name to results
      if (rxcuiResponse.data.idGroup.name) {
        results.sources.rxnorm.names.push({
          name: rxcuiResponse.data.idGroup.name,
          type: 'Standard Name'
        });
        
        results.sources.rxnorm.links.push({
          url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rxcui}`,
          description: 'View in RxNav'
        });
      }
      
      // Step 2: Get related names using CORRECT endpoint format
      // According to docs: GET /REST/rxcui/rxcui/allrelated.json
      const relatedResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allrelated.json`);
      
      if (relatedResponse.data && relatedResponse.data.allRelatedGroup && relatedResponse.data.allRelatedGroup.conceptGroup) {
        for (const group of relatedResponse.data.allRelatedGroup.conceptGroup) {
          if (group.conceptProperties) {
            for (const property of group.conceptProperties) {
              results.sources.rxnorm.names.push({
                name: property.name,
                type: group.tty || 'Related Term',
                id: property.rxcui
              });
            }
          }
        }
      }
    } else {
      // No RxCUI found - try approximate search as fallback
      console.log(`No exact/normalized match found for "${drugName}", trying approximate search...`);
      
      try {
        const approximateResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json`, {
          params: {
            name: drugName,
            search: 9  // Approximate search
          }
        });
        
        if (approximateResponse.data && approximateResponse.data.idGroup && approximateResponse.data.idGroup.rxnormId) {
          const rxcui = approximateResponse.data.idGroup.rxnormId[0];
          results.sources.rxnorm.names.push({
            name: `Approximate match found (RxCUI: ${rxcui})`,
            type: 'Approximate Match'
          });
        } else {
          results.sources.rxnorm.names.push({
            name: `No RxNorm data found for "${drugName}"`,
            type: 'No Results'
          });
        }
      } catch (approxError) {
        results.sources.rxnorm.names.push({
          name: `No RxNorm data found for "${drugName}"`,
          type: 'No Results'
        });
      }
    }
  } catch (error) {
    console.error('Error searching RxNorm:', error.message);
    
    // Log more specific error details for debugging
    if (error.response) {
      console.error('RxNorm API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        params: error.config?.params
      });
    }
    
    results.sources.rxnorm.names.push({
      name: "Error searching RxNorm database",
      type: "Error",
      details: error.response?.status === 400 ? 'Bad Request - Check API parameters' : error.message
    });
  }
}

// FDA API function
// async function searchFDA(drugName, results) {
//   try {
//     // Search by generic name
//     const fdaGenericResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(drugName)}&limit=5`);
    
//     if (fdaGenericResponse.data && fdaGenericResponse.data.results) {
//       processFDAResults(fdaGenericResponse.data.results, results);
//     }
    
//     // Search by brand name
//     const fdaBrandResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(drugName)}&limit=5`);
    
//     if (fdaBrandResponse.data && fdaBrandResponse.data.results) {
//       processFDAResults(fdaBrandResponse.data.results, results);
//     }
//   } catch (error) {
//     if (error.response && error.response.status === 404) {
//       // No results found is a normal condition
//       results.sources.fda.names.push({
//         name: "No FDA records found",
//         type: "Info"
//       });
//     } else {
//       console.error('Error searching FDA:', error.message);
//       results.sources.fda.names.push({
//         name: "Error searching FDA database",
//         type: "Error"
//       });
//     }
//   }
// }

// 1. UPDATED: Modified searchFDA function to prepare labeling data
async function searchFDA(drugName, results) {
  try {
    console.log(`🔍 Searching FDA labeling for: ${drugName}`);
    
    // Multiple search strategies to improve hit rate
    const searchStrategies = [
      // Strategy 1: Search by generic name (exact match)
      {
        query: `search=openfda.generic_name.exact:"${drugName}"`,
        description: 'Generic name (exact)'
      },
      // Strategy 2: Search by brand name (exact match)
      {
        query: `search=openfda.brand_name.exact:"${drugName}"`,
        description: 'Brand name (exact)'
      },
      // Strategy 3: Search by substance name
      {
        query: `search=openfda.substance_name:"${drugName}"`,
        description: 'Substance name'
      },
      // Strategy 4: Broader search across multiple name fields
      {
        query: `search=openfda.generic_name:"${drugName}"+OR+openfda.brand_name:"${drugName}"+OR+openfda.substance_name:"${drugName}"`,
        description: 'Multi-field search'
      }
    ];

    let totalResults = 0;
    let hasBoxedWarning = false;
    let labelInfo = [];
    let labelingData = []; // NEW: Store labeling data for the labeling section

    // Try each search strategy until we get results
    for (const strategy of searchStrategies) {
      try {
        const url = `https://api.fda.gov/drug/label.json?${strategy.query}&limit=10`;
        console.log(`📡 Trying strategy: ${strategy.description}`);
        console.log(`🔗 URL: ${url}`);
        
        const response = await axios.get(url, { 
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; FDA-API-Client/1.0)'
          }
        });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
          console.log(`✅ Found ${response.data.results.length} results with strategy: ${strategy.description}`);
          totalResults += response.data.results.length;
          
          // Process each label result
          response.data.results.forEach((label, index) => {
            // Check for boxed warning
            const hasLabelBoxedWarning = !!(label.boxed_warning && label.boxed_warning.length > 0);
            if (hasLabelBoxedWarning) {
              hasBoxedWarning = true;
              console.log(`⚠️ BOXED WARNING FOUND in result ${index + 1}`);
            }
            
            // NEW: Create labeling data object for the labeling section
            const labelData = {
              setid: label.set_id || `fda_${Date.now()}_${index}`,
              type: 'FDA',
              source: 'FDA Drug Labeling',
              productName: label.openfda?.brand_name?.[0] || label.openfda?.generic_name?.[0] || drugName,
              indication: (label.indications_and_usage && label.indications_and_usage[0]) || 'Not specified',
              route: (label.openfda?.route && label.openfda.route[0]) || 'Not specified',
              manufacturerName: (label.openfda?.manufacturer_name && label.openfda.manufacturer_name[0]) || 'Not specified',
              lastUpdated: label.effective_time || new Date().toISOString(),
              boxedWarning: hasLabelBoxedWarning, // This is the key field!
              
              // Additional FDA-specific data for detailed view
              warnings: (label.warnings && label.warnings[0]) || 'See full labeling',
              adverseReactions: (label.adverse_reactions && label.adverse_reactions[0]) || 'See full labeling',
              contraindications: (label.contraindications && label.contraindications[0]) || 'See full labeling',
              dosageAndAdministration: (label.dosage_and_administration && label.dosage_and_administration[0]) || 'See full labeling',
              
              // Boxed warning content (if available)
              boxedWarningContent: hasLabelBoxedWarning ? (label.boxed_warning[0] || 'Boxed warning present - see full labeling') : null,
              
              // Raw label data for advanced processing
              rawLabel: label
            };
            
            labelingData.push(labelData);
            
            // Extract names from the label (your existing logic)
            if (label.openfda) {
              // Add generic names
              if (label.openfda.generic_name) {
                label.openfda.generic_name.forEach(name => {
                  results.sources.fda.names.push({
                    name: name,
                    type: 'Generic Name',
                    hasBoxedWarning: hasLabelBoxedWarning
                  });
                });
              }
              
              // Add brand names
              if (label.openfda.brand_name) {
                label.openfda.brand_name.forEach(name => {
                  results.sources.fda.names.push({
                    name: name,
                    type: 'Brand Name',
                    hasBoxedWarning: hasLabelBoxedWarning
                  });
                });
              }
              
              // Add substance names
              if (label.openfda.substance_name) {
                label.openfda.substance_name.forEach(name => {
                  results.sources.fda.names.push({
                    name: name,
                    type: 'Substance Name',
                    hasBoxedWarning: hasLabelBoxedWarning
                  });
                });
              }
              
              // Add manufacturer info
              if (label.openfda.manufacturer_name) {
                results.sources.fda.names.push({
                  name: `Manufactured by: ${label.openfda.manufacturer_name[0]}`,
                  type: 'Manufacturer'
                });
              }
              
              // Add application number link
              if (label.openfda.application_number && label.openfda.application_number[0]) {
                const appNum = label.openfda.application_number[0];
                results.sources.fda.links.push({
                  url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNum.replace(/[^0-9]/g, '')}`,
                  description: `FDA Application: ${appNum}`
                });
              }
            }
            
            // Store label info for further processing
            labelInfo.push({
              hasBoxedWarning: hasLabelBoxedWarning,
              hasWarnings: !!label.warnings,
              hasContraindications: !!label.contraindications,
              indications: label.indications_and_usage || [],
              effectiveTime: label.effective_time
            });
          });
          
          // Break after first successful strategy
          break;
        }
        
      } catch (strategyError) {
        console.log(`❌ Strategy failed: ${strategy.description} - ${strategyError.message}`);
        // Continue to next strategy
        continue;
      }
    }
    
    // Add summary information
    if (totalResults > 0) {
      results.sources.fda.names.push({
        name: `Found ${totalResults} FDA label(s)`,
        type: 'Summary',
        hasBoxedWarning: hasBoxedWarning
      });
      
      if (hasBoxedWarning) {
        results.sources.fda.names.push({
          name: "⚠️ CONTAINS BOXED WARNING",
          type: 'Safety Alert',
          hasBoxedWarning: true
        });
      }
      
      // Add warnings summary
      const warningCount = labelInfo.filter(l => l.hasWarnings).length;
      if (warningCount > 0) {
        results.sources.fda.names.push({
          name: `${warningCount} label(s) with warnings`,
          type: 'Warning Info'
        });
      }
      
    } else {
      // No results found with any strategy
      results.sources.fda.names.push({
        name: "No FDA labeling records found",
        type: "No Results"
      });
      console.log(`❌ No FDA labeling found for "${drugName}" with any search strategy`);
    }
    
    // NEW: Store labeling data in results for the labeling section
    results.labelingData = labelingData;
    
  } catch (error) {
    console.error('Error searching FDA labeling:', error.message);
    
    // Log detailed error information
    if (error.response) {
      console.error('FDA API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      });
    }
    
    results.sources.fda.names.push({
      name: "Error searching FDA labeling database",
      type: "Error",
      details: error.response?.status === 400 ? 'Bad Request - Check search parameters' : error.message
    });
  }
}

// 2. NEW: Function to update the labeling section with boxed warning data
function updateLabelingSectionWithBoxedWarnings(fdaResults) {
  console.log('🏷️ Updating labeling section with FDA results...');
  
  // Check if labeling section exists and has the needed elements
  const labellingSection = document.getElementById('LabellingSection');
  if (!labellingSection) {
    console.log('❌ Labeling section not found');
    return;
  }
  
  // Get the labeling data from FDA results
  const labelingData = fdaResults.labelingData || [];
  
  if (labelingData.length === 0) {
    console.log('❌ No labeling data found in FDA results');
    return;
  }
  
  console.log(`📊 Found ${labelingData.length} labeling records to display`);
  
  // Update the labeling module with the new data
  if (window.PharmaLabellingModule && typeof window.PharmaLabellingModule.displayResults === 'function') {
    // Use the existing labeling module
    window.PharmaLabellingModule.displayResults({
      labels: labelingData,
      summary: {
        totalLabels: labelingData.length,
        fdaLabels: labelingData.filter(l => l.type === 'FDA').length,
        boxedWarnings: labelingData.filter(l => l.boxedWarning).length,
        lastAnalyzed: new Date().toISOString()
      }
    });
  } else {
    // Fallback: manually update the labeling section
    console.log('⚠️ PharmaLabellingModule not available, using fallback method');
    updateLabelingSectionFallback(labelingData);
  }
}

// 3. NEW: Fallback function to update labeling section manually
function updateLabelingSectionFallback(labelingData) {
  // Update summary counts
  const totalLabelsEl = document.querySelector('#LabellingSection [data-element="totalLabels"]');
  const boxedWarningsEl = document.querySelector('#LabellingSection [data-element="boxedWarnings"]');
  
  if (totalLabelsEl) totalLabelsEl.textContent = labelingData.length;
  if (boxedWarningsEl) boxedWarningsEl.textContent = labelingData.filter(l => l.boxedWarning).length;
  
  // Show the labeling section
  const labellingSection = document.getElementById('LabellingSection');
  if (labellingSection) {
    labellingSection.classList.remove('hidden');
  }
  
  console.log(`✅ Updated labeling section with ${labelingData.length} labels, ${labelingData.filter(l => l.boxedWarning).length} with boxed warnings`);
}

// function processFDAResults(fdaResults, results) {
//   for (const drug of fdaResults) {
//     if (drug.openfda) {
//       // Add generic names
//       if (drug.openfda.generic_name) {
//         for (const name of drug.openfda.generic_name) {
//           results.sources.fda.names.push({
//             name: name,
//             type: 'Generic Name'
//           });
//         }
//       }
      
//       // Add brand names
//       if (drug.openfda.brand_name) {
//         for (const name of drug.openfda.brand_name) {
//           results.sources.fda.names.push({
//             name: name,
//             type: 'Brand Name'
//           });
//         }
//       }
      
//       // Add substance names
//       if (drug.openfda.substance_name) {
//         for (const name of drug.openfda.substance_name) {
//           results.sources.fda.names.push({
//             name: name,
//             type: 'Substance Name'
//           });
//         }
//       }
      
//       // Add application number for link
//       if (drug.openfda.application_number && drug.openfda.application_number[0]) {
//         const appNum = drug.openfda.application_number[0];
//         results.sources.fda.links.push({
//           url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNum.replace(/[^0-9]/g, '')}`,
//           description: `FDA Application: ${appNum}`
//         });
//       }
//     }
//   }
// }

// PubChem API function
async function searchPubChem(drugName, results) {
  try {
    // Step 1: Find the compound ID
    const pubchemResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`);
    
    if (pubchemResponse.data && pubchemResponse.data.IdentifierList && pubchemResponse.data.IdentifierList.CID) {
      const cid = pubchemResponse.data.IdentifierList.CID[0];
      
      // Step 2: Get synonyms
      const synonymsResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
      
      if (synonymsResponse.data && synonymsResponse.data.InformationList && synonymsResponse.data.InformationList.Information) {
        const info = synonymsResponse.data.InformationList.Information[0];
        
        if (info.Synonym) {
          // Filter out long and messy names
          const filteredSynonyms = info.Synonym.filter(syn => 
            syn.length < 100 && !syn.includes('UNII') && !syn.includes('CHEBI') && !syn.includes('DTXSID')
          );
          
          // Take just the first 30 synonyms to avoid overwhelming
          const trimmedSynonyms = filteredSynonyms.slice(0, 30);
          
          for (const synonym of trimmedSynonyms) {
            results.sources.pubchem.names.push({
              name: synonym,
              type: 'Synonym'
            });
          }
          
          // Add a link to the PubChem compound page
          results.sources.pubchem.links.push({
            url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
            description: 'View in PubChem'
          });
        }
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      results.sources.pubchem.names.push({
        name: "No PubChem records found",
        type: "Info"
      });
    } else {
      console.error('Error searching PubChem:', error.message);
      results.sources.pubchem.names.push({
        name: "Error searching PubChem database",
        type: "Error"
      });
    }
  }
}
function processFDAResults(fdaResults, results) {
  let hasAnyBoxedWarning = false;
  let labelingData = results.labelingData || []; // Initialize labeling data array if not exists
  
  for (const drug of fdaResults) {
    // Check for boxed warning in this drug
    const hasBoxedWarning = !!(drug.boxed_warning && drug.boxed_warning.length > 0);
    if (hasBoxedWarning) {
      hasAnyBoxedWarning = true;
      console.log('⚠️ BOXED WARNING detected in FDA result');
    }
    
    if (drug.openfda) {
      // Add generic names WITH boxed warning flag
      if (drug.openfda.generic_name) {
        for (const name of drug.openfda.generic_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Generic Name',
            hasBoxedWarning: hasBoxedWarning // NEW: Add boxed warning flag
          });
        }
      }
      
      // Add brand names WITH boxed warning flag
      if (drug.openfda.brand_name) {
        for (const name of drug.openfda.brand_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Brand Name',
            hasBoxedWarning: hasBoxedWarning // NEW: Add boxed warning flag
          });
        }
      }
      
      // Add substance names WITH boxed warning flag
      if (drug.openfda.substance_name) {
        for (const name of drug.openfda.substance_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Substance Name',
            hasBoxedWarning: hasBoxedWarning // NEW: Add boxed warning flag
          });
        }
      }
      
      // Add manufacturer info
      if (drug.openfda.manufacturer_name) {
        results.sources.fda.names.push({
          name: `Manufactured by: ${drug.openfda.manufacturer_name[0]}`,
          type: 'Manufacturer'
        });
      }
      
      // Add application number for link
      if (drug.openfda.application_number && drug.openfda.application_number[0]) {
        const appNum = drug.openfda.application_number[0];
        results.sources.fda.links.push({
          url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNum.replace(/[^0-9]/g, '')}`,
          description: `FDA Application: ${appNum}`
        });
      }
    }
    
    // NEW: Create labeling data for the labeling section
    const labelData = {
      setid: drug.set_id || `fda_${Date.now()}_${Math.random()}`,
      type: 'FDA',
      source: 'FDA Drug Labeling',
      productName: drug.openfda?.brand_name?.[0] || drug.openfda?.generic_name?.[0] || 'Unknown Product',
      indication: (drug.indications_and_usage && drug.indications_and_usage[0]) || 'Not specified',
      route: (drug.openfda?.route && drug.openfda.route[0]) || 'Not specified',
      manufacturerName: (drug.openfda?.manufacturer_name && drug.openfda.manufacturer_name[0]) || 'Not specified',
      lastUpdated: drug.effective_time || new Date().toISOString(),
      boxedWarning: hasBoxedWarning, // This is the key field for the labeling section!
      
      // Additional FDA-specific data for detailed view
      warnings: (drug.warnings && drug.warnings[0]) || 'See full labeling',
      adverseReactions: (drug.adverse_reactions && drug.adverse_reactions[0]) || 'See full labeling',
      contraindications: (drug.contraindications && drug.contraindications[0]) || 'See full labeling',
      dosageAndAdministration: (drug.dosage_and_administration && drug.dosage_and_administration[0]) || 'See full labeling',
      
      // Boxed warning content (if available)
      boxedWarningContent: hasBoxedWarning ? (drug.boxed_warning[0] || 'Boxed warning present - see full labeling') : null,
      
      // Raw label data for advanced processing
      rawLabel: drug
    };
    
    labelingData.push(labelData);
  }
  
  // NEW: Add summary information about boxed warnings
  if (hasAnyBoxedWarning) {
    results.sources.fda.names.push({
      name: "⚠️ CONTAINS BOXED WARNING",
      type: 'Safety Alert',
      hasBoxedWarning: true
    });
  }
  
  // Store labeling data back in results
  results.labelingData = labelingData;
  
  console.log(`📊 Processed ${fdaResults.length} FDA results, ${labelingData.filter(l => l.boxedWarning).length} with boxed warnings`);
}
// ChEMBL API function
async function searchChEMBL(drugName, results) {
  try {
    // First attempt: Search by exact molecule name
    let foundMolecules = [];
    try {
      const exactNameResponse = await axios.get(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?pref_name__iexact=${encodeURIComponent(drugName)}`);
      if (exactNameResponse.data && exactNameResponse.data.molecules && exactNameResponse.data.molecules.length > 0) {
        foundMolecules = exactNameResponse.data.molecules;
      }
    } catch (exactError) {
      console.log('No exact match in ChEMBL:', exactError.message);
    }
    
    // Second attempt: Try searching by synonym if no exact match found
    if (foundMolecules.length === 0) {
      try {
        const synonymResponse = await axios.get(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?molecule_synonyms__synonym__icontains=${encodeURIComponent(drugName)}`);
        if (synonymResponse.data && synonymResponse.data.molecules && synonymResponse.data.molecules.length > 0) {
          foundMolecules = synonymResponse.data.molecules;
        }
      } catch (synonymError) {
        console.log('No synonym match in ChEMBL:', synonymError.message);
      }
    }
    
    // Third attempt: Try a more general search by name contains
    if (foundMolecules.length === 0) {
      try {
        const containsResponse = await axios.get(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?pref_name__icontains=${encodeURIComponent(drugName)}`);
        if (containsResponse.data && containsResponse.data.molecules && containsResponse.data.molecules.length > 0) {
          foundMolecules = containsResponse.data.molecules;
        }
      } catch (containsError) {
        console.log('No contains match in ChEMBL:', containsError.message);
      }
    }
    
    // Final attempt: Try a free text search
    if (foundMolecules.length === 0) {
      try {
        const searchResponse = await axios.get(`https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=${encodeURIComponent(drugName)}`);
        if (searchResponse.data && searchResponse.data.molecules && searchResponse.data.molecules.length > 0) {
          foundMolecules = searchResponse.data.molecules;
        }
      } catch (searchError) {
        console.log('No search match in ChEMBL:', searchError.message);
      }
    }
    
    // Process results if we found any molecules
    if (foundMolecules.length > 0) {
      processChEMBLResults(foundMolecules, results);
    } else {
      // No results found after all attempts
      results.sources.chembl.names.push({
        name: "No ChEMBL records found",
        type: "Info"
      });
    }
  } catch (error) {
    console.error('Error searching ChEMBL:', error.message);
    results.sources.chembl.names.push({
      name: "Error searching ChEMBL database",
      type: "Error"
    });
  }
}

function processChEMBLResults(molecules, results) {
  // Keep track of processed names to avoid duplicates
  const processedNames = new Set();
  
  for (const molecule of molecules) {
    // Add preferred name
    if (molecule.pref_name && !processedNames.has(molecule.pref_name.toLowerCase())) {
      processedNames.add(molecule.pref_name.toLowerCase());
      results.sources.chembl.names.push({
        name: molecule.pref_name,
        type: 'Preferred Name'
      });
    }
    
    // Add molecule synonyms
    if (molecule.molecule_synonyms && molecule.molecule_synonyms.length > 0) {
      for (const synonym of molecule.molecule_synonyms) {
        if (synonym.synonym && !processedNames.has(synonym.synonym.toLowerCase())) {
          processedNames.add(synonym.synonym.toLowerCase());
          results.sources.chembl.names.push({
            name: synonym.synonym,
            type: synonym.syn_type || 'Synonym'
          });
        }
      }
    }
    
    // Add research codes if available
    if (molecule.research_codes && molecule.research_codes.length > 0) {
      for (const code of molecule.research_codes) {
        if (code && !processedNames.has(code.toLowerCase())) {
          processedNames.add(code.toLowerCase());
          results.sources.chembl.names.push({
            name: code,
            type: 'Research Code'
          });
        }
      }
    }
    
    // Add trade names if available
    if (molecule.trade_names && molecule.trade_names.length > 0) {
      for (const tradeName of molecule.trade_names) {
        if (tradeName && !processedNames.has(tradeName.toLowerCase())) {
          processedNames.add(tradeName.toLowerCase());
          results.sources.chembl.names.push({
            name: tradeName,
            type: 'Trade Name'
          });
        }
      }
    }
    
    // Add cross references if available
    if (molecule.cross_references && molecule.cross_references.length > 0) {
      for (const xref of molecule.cross_references) {
        if (xref.xref_id && !processedNames.has(xref.xref_id.toLowerCase())) {
          processedNames.add(xref.xref_id.toLowerCase());
          results.sources.chembl.names.push({
            name: xref.xref_id,
            type: xref.xref_src || 'Cross Reference'
          });
        }
      }
    }
    
    // Add link to ChEMBL
    if (molecule.molecule_chembl_id) {
      results.sources.chembl.links.push({
        url: `https://www.ebi.ac.uk/chembl/compound_report_card/${molecule.molecule_chembl_id}/`,
        description: `View in ChEMBL: ${molecule.molecule_chembl_id}`
      });
    }
  }
}

// ClinicalTrials.gov function
async function searchClinicalTrials(drugName, results) {
  try {
    // Using the v2 API as specified in the docs
    const response = await axios.get(`https://clinicaltrials.gov/api/v2/studies`, {
      params: {
        'query.term': drugName,
        'fields': 'NCTId,BriefTitle,InterventionName,InterventionOtherName,InterventionDescription,InterventionType',
        'pageSize': 10,
        'format': 'json'
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.data && response.data.studies && response.data.studies.length > 0) {
      const studies = response.data.studies;
      const processedNames = new Set(); // To avoid duplicates
      
      for (const study of studies) {
        // Add link to the clinical trial
        if (study.protocolSection && study.protocolSection.identificationModule && study.protocolSection.identificationModule.nctId) {
          const nctId = study.protocolSection.identificationModule.nctId;
          const title = study.protocolSection.identificationModule.briefTitle || nctId;
          
          results.sources.clinicaltrials.links.push({
            url: `https://clinicaltrials.gov/study/${nctId}`,
            description: title
          });
        }
        
        // Extract intervention information
        if (study.protocolSection && study.protocolSection.armsInterventionsModule && 
            study.protocolSection.armsInterventionsModule.interventions) {
            
          const interventions = study.protocolSection.armsInterventionsModule.interventions;
          
          for (const intervention of interventions) {
            // Check intervention name
            if (intervention.interventionName) {
              const name = intervention.interventionName;
              const normalizedDrugName = drugName.toLowerCase();
              const normalizedName = name.toLowerCase();
              
              // Only add if related to the drug
              if (normalizedName.includes(normalizedDrugName) || 
                  normalizedDrugName.includes(normalizedName)) {
                
                if (!processedNames.has(normalizedName)) {
                  processedNames.add(normalizedName);
                  results.sources.clinicaltrials.names.push({
                    name: name,
                    type: 'Intervention Name'
                  });
                }
              }
              
              // Check other names
              if (intervention.interventionOtherNames) {
                for (const otherName of intervention.interventionOtherNames) {
                  const normalizedOtherName = otherName.toLowerCase();
                  
                  if ((normalizedOtherName.includes(normalizedDrugName) || 
                      normalizedDrugName.includes(normalizedOtherName)) && 
                      !processedNames.has(normalizedOtherName)) {
                    
                    processedNames.add(normalizedOtherName);
                    results.sources.clinicaltrials.names.push({
                      name: otherName,
                      type: 'Other Intervention Name'
                    });
                  }
                }
              }
            }
          }
        }
      }
      
      // If no names were found
      if (results.sources.clinicaltrials.names.length === 0) {
        results.sources.clinicaltrials.names.push({
          name: "No relevant intervention names found in clinical trials",
          type: "Info"
        });
      }
    } else {
      results.sources.clinicaltrials.names.push({
        name: "No ClinicalTrials.gov records found",
        type: "Info"
      });
    }
  } catch (error) {
    console.error('Error searching ClinicalTrials.gov:', error.message);
    results.sources.clinicaltrials.names.push({
      name: "Error searching ClinicalTrials.gov. Try with a different drug name.",
      type: "Error"
    });
  }
}

// Function to search for clinical trials using all collected drug names
// Function to search for clinical trials using all collected drug names
async function searchAllTrialsForDrugNames(drugNames) {
  // Store all unique trials to avoid duplicates
  const uniqueTrials = new Map();
  const errors = [];
  let totalSearched = 0;
  
  console.log(`Searching trials for ${drugNames.length} drug names...`);
  
  // Search in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < drugNames.length; i += batchSize) {
    const batch = drugNames.slice(i, i + batchSize);
    const searchPromises = batch.map(drugName => searchTrialsForName(drugName));
    
    // Wait for all searches in current batch to complete
    const batchResults = await Promise.allSettled(searchPromises);
    
    // Process results from this batch
    batchResults.forEach((result, index) => {
      const drugName = batch[index];
      totalSearched++;
      
      if (result.status === 'fulfilled') {
        const { trials, error } = result.value;
        
        if (error) {
          errors.push({ drugName, error });
        } else if (trials && trials.length > 0) {
          // Add each trial to our map, using NCT ID as the key
          trials.forEach(trial => {
            if (!uniqueTrials.has(trial.nctId)) {
              // Add relevance info to know which drug names matched this trial
              if (!trial.matchedDrugNames) {
                trial.matchedDrugNames = [];
              }
              trial.matchedDrugNames.push(drugName);
              uniqueTrials.set(trial.nctId, trial);
            } else {
              // Update the existing trial to include this drug name match
              const existingTrial = uniqueTrials.get(trial.nctId);
              if (!existingTrial.matchedDrugNames.includes(drugName)) {
                existingTrial.matchedDrugNames.push(drugName);
              }
            }
          });
        }
      } else {
        errors.push({ drugName, error: result.reason.message });
      }
      
      // Log progress for long-running searches
      if (totalSearched % 10 === 0 || totalSearched === drugNames.length) {
        console.log(`Processed ${totalSearched} of ${drugNames.length} drug names...`);
      }
    });
  }

  console.log(`Search completed. Found ${uniqueTrials.size} unique trials.`);
  
  return {
    trials: Array.from(uniqueTrials.values()),
    errors: errors,
    totalDrugNames: drugNames.length,
    totalUniqueTrials: uniqueTrials.size
  };
}

// Helper function to search clinical trials for a single drug name
async function searchTrialsForName(drugName) {
  try {
    if (!drugName || typeof drugName !== 'string' || drugName.trim() === '') {
      return { trials: [], error: 'Invalid drug name' };
    }
    
    const sanitizedName = drugName.trim();
    
    // Use multiple search approaches to maximize results
    let allTrials = [];
    let errors = [];
    
    // Approach 1: Standard search by term
    try {
      // Use the ClinicalTrials.gov API v2
      const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
        params: {
          'query.term': sanitizedName,
          'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
          'pageSize': 50, // Increased from 20 to 50 to find more results
          'format': 'json'
        },
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.data && response.data.studies && Array.isArray(response.data.studies)) {
        allTrials = allTrials.concat(response.data.studies);
      }
    } catch (error) {
      console.error(`Error in standard search for ${drugName}:`, error.message);
      errors.push(`Standard search error: ${error.message}`);
    }
    
    // Approach 2: Try a more specific intervention search
    try {
      const interventionResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
        params: {
          'query.intr': sanitizedName,
          'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
          'pageSize': 50,
          'format': 'json'
        },
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (interventionResponse.data && interventionResponse.data.studies && Array.isArray(interventionResponse.data.studies)) {
        // Add unique studies from this search
        for (const study of interventionResponse.data.studies) {
          if (study.protocolSection && study.protocolSection.identificationModule && study.protocolSection.identificationModule.nctId) {
            const nctId = study.protocolSection.identificationModule.nctId;
            if (!allTrials.some(t => t.protocolSection?.identificationModule?.nctId === nctId)) {
              allTrials.push(study);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error in intervention search for ${drugName}:`, error.message);
      errors.push(`Intervention search error: ${error.message}`);
    }
    
    if (allTrials.length === 0 && errors.length > 0) {
      return { trials: [], error: errors.join('; ') };
    }
    
    // Process and format the trials
    const trials = allTrials.map(study => {
      const protocolSection = study.protocolSection || {};
      const identificationModule = protocolSection.identificationModule || {};
      const statusModule = protocolSection.statusModule || {};
      const designModule = protocolSection.designModule || {};
      const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
      const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
      const descriptionModule = protocolSection.descriptionModule || {};
      
      // Get interventions
      const interventions = [];
      if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
        armsInterventionsModule.interventions.forEach(intervention => {
          interventions.push({
            name: intervention.interventionName,
            type: intervention.interventionType,
            description: intervention.interventionDescription
          });
        });
      }
      
      return {
        nctId: identificationModule.nctId,
        title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
        status: statusModule.overallStatus || 'UNKNOWN',
        phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
        summary: descriptionModule.briefSummary ? 
                 descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
                 : 'No summary available',
        startDate: statusModule.startDate || 'Not specified',
        completionDate: statusModule.completionDate || 'Not specified',
        studyType: designModule.studyType || 'Not specified',
        sponsor: sponsorCollaboratorsModule.leadSponsor ? 
                sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
                : 'Not specified',
        enrollment: designModule.enrollmentInfo ? 
                   designModule.enrollmentInfo.count || 'Not specified' 
                   : 'Not specified',
        interventions: interventions,
        url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`
      };
    });
    
    return { trials, error: null };
  } catch (error) {
    console.error(`Error searching trials for ${drugName}:`, error.message);
    return { trials: [], error: error.message };
  }
}

// Helper function to search clinical trials for a single drug name
async function searchTrialsForName(drugName) {
  try {
    if (!drugName || typeof drugName !== 'string' || drugName.trim() === '') {
      return { trials: [], error: 'Invalid drug name' };
    }
    
    const sanitizedName = drugName.trim();
    
    // Use the ClinicalTrials.gov API v2
    const response = await axios.get(`https://clinicaltrials.gov/api/v2/studies`, {
      params: {
        'query.term': sanitizedName,
        'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
        'pageSize': 20,
        'format': 'json'
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.data || !response.data.studies || !Array.isArray(response.data.studies)) {
      return { trials: [], error: 'Invalid response format from ClinicalTrials.gov' };
    }
    
    // Process and format the trials
    const trials = response.data.studies.map(study => {
      const protocolSection = study.protocolSection || {};
      const identificationModule = protocolSection.identificationModule || {};
      const statusModule = protocolSection.statusModule || {};
      const designModule = protocolSection.designModule || {};
      const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
      const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
      
      // Get interventions
      const interventions = [];
      if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
        armsInterventionsModule.interventions.forEach(intervention => {
          interventions.push({
            name: intervention.interventionName,
            type: intervention.interventionType,
            description: intervention.interventionDescription
          });
        });
      }
      
      return {
        nctId: identificationModule.nctId,
        title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
        status: statusModule.overallStatus || 'UNKNOWN',
        phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
        summary: identificationModule.briefSummary ? 
                 identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '') 
                 : 'No summary available',
        startDate: statusModule.startDate || 'Not specified',
        completionDate: statusModule.completionDate || 'Not specified',
        studyType: designModule.studyType || 'Not specified',
        sponsor: sponsorCollaboratorsModule.leadSponsor ? 
                sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
                : 'Not specified',
        enrollment: designModule.enrollmentInfo ? 
                   designModule.enrollmentInfo.count || 'Not specified' 
                   : 'Not specified',
        interventions: interventions,
        url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`
      };
    });
    
    return { trials, error: null };
  } catch (error) {
    console.error(`Error searching trials for ${drugName}:`, error.message);
    return { trials: [], error: error.message };
  }
}

// app.get('/api/studies/search', validatePagination, async (req, res) => {
//   try {
//     const {
//       query, condition, intervention, status, phase, sponsor,
//       title, location, patientData, sort, countTotal, fields,
//       advanced, fetchAll
//     } = req.query;
    
//     const { page, pageSize } = req.pagination;
    
//     console.log(`🔍 Searching for studies with query: ${query || 'None specified'}`);
    
//     // If intervention is provided, default to searching by all drug names
//     // unless skipNameLookup is explicitly set to 'true'
//     let searchByDrugNames = intervention;
//     let drugNames = [];
    
//     // If we should search by drug names, get all alternate names first
//     if (searchByDrugNames) {
//       try {
//         console.log(`Finding alternate names for drug: ${intervention}`);
        
//         // Get all alternate names from various drug databases
//         const drugNamesResponse = await collectDrugNames(intervention);
        
//         if (drugNamesResponse.success && drugNamesResponse.uniqueNames.length > 0) {
//           drugNames = drugNamesResponse.uniqueNames;
//           console.log(`Found ${drugNames.length} alternate names for ${intervention}`);
//         } else {
//           // If we couldn't find alternate names, just use the original intervention
//           drugNames = [intervention];
//           console.log(`No alternate names found, using original name: ${intervention}`);
//         }
//       } catch (error) {
//         console.error('Error fetching drug names:', error);
//         // In case of error, fall back to the original intervention name
//         drugNames = [intervention];
//       }
//     }
    
//     // If we're searching across multiple drug names
//     if (searchByDrugNames && drugNames.length > 0) {
//       console.log(`Searching for studies across ${drugNames.length} drug names`);
      
//       // Store all unique studies to avoid duplicates
//       const studiesMap = new Map();
//       const studySourceNames = new Map(); // Track which drug name matched which study
      
//       // Search in small batches to avoid overwhelming the API
//       const batchSize = 5;
//       for (let i = 0; i < drugNames.length; i += batchSize) {
//         const batch = drugNames.slice(i, i + batchSize);
//         console.log(`Processing drug names batch ${i/batchSize + 1}/${Math.ceil(drugNames.length/batchSize)}`);
        
//         const batchPromises = batch.map(drugName => {
//           return searchForDrugStudies(drugName, {
//             condition, status, phase, sponsor, title, location, 
//             patientData, sort, fields, advanced
//           });
//         });
        
//         // Wait for all searches in current batch to complete
//         const batchResults = await Promise.allSettled(batchPromises);
        
//         // Process results from this batch
//         batchResults.forEach((result, index) => {
//           const drugName = batch[index];
          
//           if (result.status === 'fulfilled' && result.value.studies) {
//             const studies = result.value.studies;
            
//             // Add each study to our map, using NCT ID as the key
//             studies.forEach(study => {
//               const nctId = study.protocolSection?.identificationModule?.nctId;
              
//               if (nctId && !studiesMap.has(nctId)) {
//                 studiesMap.set(nctId, study);
//                 studySourceNames.set(nctId, [drugName]);
//               } else if (nctId) {
//                 // Add this drug name as another source for an existing study
//                 const currentSources = studySourceNames.get(nctId) || [];
//                 if (!currentSources.includes(drugName)) {
//                   currentSources.push(drugName);
//                   studySourceNames.set(nctId, currentSources);
//                 }
//               }
//             });
            
//             console.log(`Found ${studies.length} studies for drug name: ${drugName}`);
//           } else if (result.status === 'rejected') {
//             console.error(`Error searching for studies with drug name ${drugName}:`, 
//               result.reason?.message || 'Unknown error');
//           }
//         });
        
//         // Optional: Add delay between batches to prevent rate limiting
//         if (i + batchSize < drugNames.length) {
//           await new Promise(resolve => setTimeout(resolve, 500));
//         }
//       }
      
//       // Convert studies map to array
//       let allStudies = Array.from(studiesMap.values());
      
//       // Add matchInfo to each study - which drug names matched this study
//       allStudies = allStudies.map(study => {
//         const nctId = study.protocolSection?.identificationModule?.nctId;
//         const matchedDrugNames = studySourceNames.get(nctId) || [];
        
//         // Add a new section to the study with match information
//         return {
//           ...study,
//           drugNameMatches: {
//             originalDrugName: intervention,
//             matchedDrugNames: matchedDrugNames
//           }
//         };
//       });
      
//       console.log(`Total unique studies found across all drug names: ${allStudies.length}`);
      
//       // Apply pagination if needed
//       let paginatedStudies = allStudies;
//       let paginationInfo = {
//         currentPage: 1,
//         pageSize: allStudies.length,
//         totalCount: allStudies.length,
//         totalPages: 1,
//         hasNextPage: false
//       };
      
//       if (fetchAll !== 'true') {
//         const startIndex = (page - 1) * pageSize;
//         const endIndex = startIndex + pageSize;
//         paginatedStudies = allStudies.slice(startIndex, endIndex);
        
//         // Update pagination info
//         paginationInfo = {
//           currentPage: page,
//           pageSize,
//           totalCount: allStudies.length,
//           totalPages: Math.ceil(allStudies.length / pageSize),
//           hasNextPage: endIndex < allStudies.length
//         };
//       }
      
//       return res.json({
//         success: true,
//         data: {
//           studies: paginatedStudies,
//           totalCount: allStudies.length,
//           drugNames: drugNames,
//           originalDrugName: intervention
//         },
//         pagination: paginationInfo
//       });
//     }
    
//     // Standard search if not doing the drug name search (no intervention provided)
//     // Build parameters for API request
//     const params = new URLSearchParams();
    
//     // Add query parameters
//     if (condition) params.append('query.cond', condition);
//     if (intervention && !searchByDrugNames) params.append('query.intr', intervention);
//     if (title) params.append('query.titles', title);
//     if (location) params.append('query.locn', location);
//     if (sponsor) params.append('query.spons', sponsor);
//     if (query) params.append('query.term', query);
//     if (patientData) params.append('query.patient', patientData);
    
//     // Add filter parameters
//     if (status) {
//       if (Array.isArray(status)) {
//         params.append('filter.overallStatus', status.join(','));
//       } else {
//         params.append('filter.overallStatus', status);
//       }
//     }
    
//     // Add advanced filter
//     if (advanced) params.append('filter.advanced', advanced);
    
//     // Add pagination
//     params.append('pageSize', pageSize);
//     if (req.query.pageToken) {
//       params.append('pageToken', req.query.pageToken);
//     }
    
//     // Add sorting
//     if (sort) {
//       if (Array.isArray(sort)) {
//         params.append('sort', sort.join(','));
//       } else {
//         params.append('sort', sort);
//       }
//     }
    
//     // Add count total
//     if (countTotal) params.append('countTotal', true);
    
//     // Add fields
//     if (fields) {
//       if (Array.isArray(fields)) {
//         params.append('fields', fields.join(','));
//       } else {
//         params.append('fields', fields);
//       }
//     } else {
//       // Default fields if none specified - comprehensive data
//       params.append('fields', 'protocolSection,derivedSection,hasResults');
//     }
    
//     // Format parameter
//     params.append('format', 'json');
    
//     // Check if we need to fetch all studies
//     if (fetchAll === 'true') {
//       const allStudies = [];
//       let currentParams = new URLSearchParams(params.toString());
//       let hasMorePages = true;
//       let nextPageToken = null;
      
//       while (hasMorePages) {
//         if (nextPageToken) {
//           currentParams.set('pageToken', nextPageToken);
//         }
        
//         console.log(`Fetching page with token: ${nextPageToken || 'initial'}`);
        
//         const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//           params: currentParams
//         });
        
//         const studies = response.data.studies || [];
//         allStudies.push(...studies);
        
//         nextPageToken = response.data.nextPageToken;
//         hasMorePages = !!nextPageToken;
        
//         // Optional: Add delay between requests to prevent rate limiting
//         if (hasMorePages) {
//           await new Promise(resolve => setTimeout(resolve, 300));
//         }
//       }
      
//       return res.json({
//         success: true,
//         data: {
//           studies: allStudies,
//           totalCount: allStudies.length
//         },
//         pagination: {
//           currentPage: 1,
//           pageSize: allStudies.length,
//           totalCount: allStudies.length,
//           totalPages: 1,
//           hasNextPage: false
//         }
//       });
//     }
    
//     // Standard paginated response when fetchAll is not true
//     const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//       params: params
//     });
    
//     // Format pagination for frontend
//     const totalCount = response.data.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / pageSize);
//     const hasNextPage = !!response.data.nextPageToken;
    
//     const paginationInfo = {
//       currentPage: page,
//       pageSize,
//       totalCount,
//       totalPages,
//       hasNextPage,
//       nextPageToken: response.data.nextPageToken
//     };
    
//     res.json({
//       success: true,
//       data: response.data,
//       pagination: paginationInfo
//     });
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });

// REAL REAL // Backend route with enhanced pagination support
// app.get('/api/studies/search', validatePagination, async (req, res) => {
//   try {
//     const {
//       query, condition, intervention, status, phase, sponsor,
//       title, location, patientData, sort, countTotal, fields,
//       advanced, fetchAll
//     } = req.query;
    
//     const { page, pageSize } = req.pagination;
    
//     console.log(`🔍 Searching for studies with query: ${query || 'None specified'}`);
    
//     // Build parameters for API request
//     const params = new URLSearchParams();
    
//     // Add query parameters
//     if (condition) params.append('query.cond', condition);
//     if (intervention) params.append('query.intr', intervention);
//     if (title) params.append('query.titles', title);
//     if (location) params.append('query.locn', location);
//     if (sponsor) params.append('query.spons', sponsor);
//     if (query) params.append('query.term', query);
//     if (patientData) params.append('query.patient', patientData);
    
//     // Add filter parameters
//     if (status) {
//       if (Array.isArray(status)) {
//         params.append('filter.overallStatus', status.join(','));
//       } else {
//         params.append('filter.overallStatus', status);
//       }
//     }
    
//     // Add advanced filter
//     if (advanced) params.append('filter.advanced', advanced);
    
//     // Add pagination
//     params.append('pageSize', pageSize);
//     if (req.query.pageToken) {
//       params.append('pageToken', req.query.pageToken);
//     }
    
//     // Add sorting
//     if (sort) {
//       if (Array.isArray(sort)) {
//         params.append('sort', sort.join(','));
//       } else {
//         params.append('sort', sort);
//       }
//     }
    
//     // Add count total
//     if (countTotal) params.append('countTotal', true);
    
//     // Add fields
//     if (fields) {
//       if (Array.isArray(fields)) {
//         params.append('fields', fields.join(','));
//       } else {
//         params.append('fields', fields);
//       }
//     } else {
//       // Default fields if none specified - comprehensive data
//       params.append('fields', 'protocolSection,derivedSection,hasResults');
//     }
    
//     // Format parameter
//     params.append('format', 'json');
    
//     // Check if we need to fetch all studies
//     if (fetchAll === 'true') {
//       const allStudies = [];
//       let currentParams = new URLSearchParams(params.toString());
//       let hasMorePages = true;
//       let nextPageToken = null;
      
//       while (hasMorePages) {
//         if (nextPageToken) {
//           currentParams.set('pageToken', nextPageToken);
//         }
        
//         console.log(`Fetching page with token: ${nextPageToken || 'initial'}`);
        
//         const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//           params: currentParams
//         });
        
//         const studies = response.data.studies || [];
//         allStudies.push(...studies);
        
//         nextPageToken = response.data.nextPageToken;
//         hasMorePages = !!nextPageToken;
        
//         // Optional: Add delay between requests to prevent rate limiting
//         if (hasMorePages) {
//           await new Promise(resolve => setTimeout(resolve, 300));
//         }
//       }
      
//       return res.json({
//         success: true,
//         data: {
//           studies: allStudies,
//           totalCount: allStudies.length
//         },
//         pagination: {
//           currentPage: 1,
//           pageSize: allStudies.length,
//           totalCount: allStudies.length,
//           totalPages: 1,
//           hasNextPage: false
//         }
//       });
//     }
    
//     // Standard paginated response when fetchAll is not true
//     const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//       params: params
//     });
    
//     // Format pagination for frontend
//     const totalCount = response.data.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / pageSize);
//     const hasNextPage = !!response.data.nextPageToken;
    
//     const paginationInfo = {
//       currentPage: page,
//       pageSize,
//       totalCount,
//       totalPages,
//       hasNextPage,
//       nextPageToken: response.data.nextPageToken
//     };
    
//     res.json({
//       success: true,
//       data: response.data,
//       pagination: paginationInfo
//     });
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });





// // Function to search for clinical trials using all collected drug names
// // Function to search for clinical trials using all collected drug names
// async function searchAllTrialsForDrugNames(drugNames) {
//   // Store all unique trials to avoid duplicates
//   const uniqueTrials = new Map();
//   const errors = [];
//   let totalSearched = 0;
  
//   console.log(`Searching trials for ${drugNames.length} drug names...`);
  
//   // Search in batches to avoid overwhelming the API
//   const batchSize = 5;
//   for (let i = 0; i < drugNames.length; i += batchSize) {
//     const batch = drugNames.slice(i, i + batchSize);
//     const searchPromises = batch.map(drugName => searchTrialsForName(drugName));
    
//     // Wait for all searches in current batch to complete
//     const batchResults = await Promise.allSettled(searchPromises);
    
//     // Process results from this batch
//     batchResults.forEach((result, index) => {
//       const drugName = batch[index];
//       totalSearched++;
      
//       if (result.status === 'fulfilled') {
//         const { trials, error } = result.value;
        
//         if (error) {
//           errors.push({ drugName, error });
//         } else if (trials && trials.length > 0) {
//           // Add each trial to our map, using NCT ID as the key
//           trials.forEach(trial => {
//             if (!uniqueTrials.has(trial.nctId)) {
//               // Add relevance info to know which drug names matched this trial
//               if (!trial.matchedDrugNames) {
//                 trial.matchedDrugNames = [];
//               }
//               trial.matchedDrugNames.push(drugName);
//               uniqueTrials.set(trial.nctId, trial);
//             } else {
//               // Update the existing trial to include this drug name match
//               const existingTrial = uniqueTrials.get(trial.nctId);
//               if (!existingTrial.matchedDrugNames.includes(drugName)) {
//                 existingTrial.matchedDrugNames.push(drugName);
//               }
//             }
//           });
//         }
//       } else {
//         errors.push({ drugName, error: result.reason.message });
//       }
      
//       // Log progress for long-running searches
//       if (totalSearched % 10 === 0 || totalSearched === drugNames.length) {
//         console.log(`Processed ${totalSearched} of ${drugNames.length} drug names...`);
//       }
//     });
//   }

//   console.log(`Search completed. Found ${uniqueTrials.size} unique trials.`);
  
//   return {
//     trials: Array.from(uniqueTrials.values()),
//     errors: errors,
//     totalDrugNames: drugNames.length,
//     totalUniqueTrials: uniqueTrials.size
//   };
// }

// // Helper function to search clinical trials for a single drug name

// // Helper function to search clinical trials for a single drug name
// async function searchTrialsForName(drugName) {
//   try {
//     if (!drugName || typeof drugName !== 'string' || drugName.trim() === '') {
//       return { trials: [], error: 'Invalid drug name' };
//     }
    
//     const sanitizedName = drugName.trim();
    
//     // Use multiple search approaches to maximize results
//     let allTrials = [];
//     let errors = [];
    
//     // Approach 1: Standard search by term
//     try {
//       // Use the ClinicalTrials.gov API v2
//       const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//         params: {
//           'query.term': sanitizedName,
//           'fields': 'protocolSection,resultsSection,hasResults',
//           // 'fetchAll': 'false', // Match backend parameter
//           // 'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
//           'pageSize': 100,
//           'format': 'json'
//         },
//         headers: {
//           'Accept': 'application/json'
//         }
//       });
      
//       if (response.data && response.data.studies && Array.isArray(response.data.studies)) {
//         allTrials = allTrials.concat(response.data.studies);
//       }
//     } catch (error) {
//       console.error(`Error in standard search for ${drugName}:`, error.message);
//       errors.push(`Standard search error: ${error.message}`);
//     }
    
//     // Approach 2: Try a more specific intervention search
//     try {
//       const interventionResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//         params: {
//           'query.intr': sanitizedName,
//           'fields': 'protocolSection,resultsSection,hasResults',
//           // 'fetchAll': 'false', // Match backend parameter
//           // 'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
//           'pageSize': 100,
//           'format': 'json'
//         },
//         headers: {
//           'Accept': 'application/json'
//         }
//       });
      
//       if (interventionResponse.data && interventionResponse.data.studies && Array.isArray(interventionResponse.data.studies)) {
//         // Add unique studies from this search
//         for (const study of interventionResponse.data.studies) {
//           if (study.protocolSection && study.protocolSection.identificationModule && study.protocolSection.identificationModule.nctId) {
//             const nctId = study.protocolSection.identificationModule.nctId;
//             if (!allTrials.some(t => t.protocolSection?.identificationModule?.nctId === nctId)) {
//               allTrials.push(study);
//             }
//           }
//         }
//       }
//     } catch (error) {
//       console.error(`Error in intervention search for ${drugName}:`, error.message);
//       errors.push(`Intervention search error: ${error.message}`);
//     }
    
//     // Approach 3: Explicitly search for completed trials
//     try {
//       const completedTrialsResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//         params: {
//           'query.term': sanitizedName,
//           'filter.overallStatus': 'COMPLETED',
//           'fields': 'protocolSection,resultsSection,hasResults',
//           // 'fetchAll': 'false', // Match backend parameter
//           // 'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
//           'pageSize': 100,
//           'format': 'json'
//         },
//         headers: {
//           'Accept': 'application/json'
//         }
//       });
      
//       if (completedTrialsResponse.data && completedTrialsResponse.data.studies && Array.isArray(completedTrialsResponse.data.studies)) {
//         // Add unique completed studies
//         for (const study of completedTrialsResponse.data.studies) {
//           if (study.protocolSection && study.protocolSection.identificationModule && study.protocolSection.identificationModule.nctId) {
//             const nctId = study.protocolSection.identificationModule.nctId;
//             if (!allTrials.some(t => t.protocolSection?.identificationModule?.nctId === nctId)) {
//               allTrials.push(study);
//             }
//           }
//         }
//       }
//     } catch (error) {
//       console.error(`Error in completed trials search for ${drugName}:`, error.message);
//       errors.push(`Completed trials search error: ${error.message}`);
//     }
    
//     // Approach 4: Search for completed trials with intervention filter
//     try {
//       const completedIntervResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//         params: {
//           'query.intr': sanitizedName,
//           'filter.overallStatus': 'COMPLETED',
//           'fields': 'protocolSection,resultsSection,hasResults',
//           // 'fetchAll': 'false', // Match backend parameter
//           // 'fields': 'NCTId,BriefTitle,OfficialTitle,OverallStatus,BriefSummary,StartDate,CompletionDate,Phase,StudyType,LeadSponsorName,InterventionName,InterventionType,EnrollmentCount',
//           'pageSize': 100,
//           'format': 'json'
//         },
//         headers: {
//           'Accept': 'application/json'
//         }
//       });
      
//       if (completedIntervResponse.data && completedIntervResponse.data.studies && Array.isArray(completedIntervResponse.data.studies)) {
//         // Add unique completed studies with intervention match
//         for (const study of completedIntervResponse.data.studies) {
//           if (study.protocolSection && study.protocolSection.identificationModule && study.protocolSection.identificationModule.nctId) {
//             const nctId = study.protocolSection.identificationModule.nctId;
//             if (!allTrials.some(t => t.protocolSection?.identificationModule?.nctId === nctId)) {
//               allTrials.push(study);
//             }
//           }
//         }
//       }
//     } catch (error) {
//       console.error(`Error in completed trials with intervention search for ${drugName}:`, error.message);
//       errors.push(`Completed intervention search error: ${error.message}`);
//     }
    
//     if (allTrials.length === 0 && errors.length > 0) {
//       return { trials: [], error: errors.join('; ') };
//     }
    
//     console.log(`Found ${allTrials.length} total trials for ${drugName} after all search approaches`);
    
//     // Process and format the trials
//     const trials = allTrials.map(study => {
//       const protocolSection = study.protocolSection || {};
//       const identificationModule = protocolSection.identificationModule || {};
//       const statusModule = protocolSection.statusModule || {};
//       const designModule = protocolSection.designModule || {};
//       const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
//       const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
//       const descriptionModule = protocolSection.descriptionModule || {};
//       const conditionsModule = protocolSection.conditionsModule || {};
      
//       // Get interventions
//       const interventions = [];
//       if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
//         armsInterventionsModule.interventions.forEach(intervention => {
//           interventions.push({
//             name: intervention.name,
//             type: intervention.type,
//             description: intervention.description
//           });
//         });
//       }
      
//       // Extract conditions - IMPORTANT for timeline generation
//       const conditions = conditionsModule.conditions || [];
      
//       return {
//         nctId: identificationModule.nctId,
//         title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
//         status: statusModule.overallStatus || 'UNKNOWN',
//         phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
//         summary: descriptionModule.briefSummary ? 
//                  descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
//                  : (identificationModule.briefSummary ?
//                     identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '')
//                     : 'No summary available'),
//         startDate: statusModule.startDate || 'Not specified',
//         completionDate: statusModule.completionDate || 'Not specified',
//         studyType: designModule.studyType || 'Not specified',
//         sponsor: sponsorCollaboratorsModule.leadSponsor ? 
//                 sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
//                 : 'Not specified',
//         enrollment: designModule.enrollmentInfo ? 
//                    designModule.enrollmentInfo.count || 'Not specified' 
//                    : 'Not specified',
//         interventions: interventions,
//         url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`,
//         // Add conditions array
//         conditions: conditions,
//         // Preserve hasResults flag
//         hasResults: study.hasResults
//       };
//     });
    
//     return { trials, error: null };
//   } catch (error) {
//     console.error(`Error searching trials for ${drugName}:`, error.message);
//     return { trials: [], error: error.message };
//   }
// }


// // Update the API route to preserve the exact same structure for both paths

// app.get('/api/studies/search', validatePagination, async (req, res) => {
//   try {
//     const {
//       query, condition, intervention, status, phase, sponsor,
//       title, location, patientData, sort, countTotal, fields,
//       advanced, fetchAll
//     } = req.query;
    
//     drugName = intervention

//     const { page, pageSize } = req.pagination;
    
//     console.log(`🔍 Searching for studies with query: ${query || 'None specified'}`);

//     // If drugName is provided, get related drugs and fetch studies for each
//     if (drugName) {
//       console.log(`🔍 Drug name provided: ${drugName}. Fetching related drugs.`);
      
//       // Call function to get related drugs
//       const relatedDrugs = await getRelatedDrugs(drugName);
//       console.log(`Found ${relatedDrugs.length} related drugs for ${drugName}`);
      
//       // Combine the original drug with related drugs
//       const allDrugsToQuery = [drugName, ...relatedDrugs];
      
//       // Use the searchAllTrialsForDrugNames function to handle multiple drug searching
//       console.log(`Searching clinical trials for ${allDrugsToQuery.length} drug names...`);
      
//       // IMPORTANT: Instead of using the searchAllTrialsForDrugNames function that returns simplified data,
//       // we'll use the ClinicalTrials.gov API directly to get the full data structure

//       // Store all unique trials to avoid duplicates
//       const uniqueTrials = new Map();
//       const errors = [];
      
//       // Search in batches to avoid overwhelming the API
//       const batchSize = 5;
//       for (let i = 0; i < allDrugsToQuery.length; i += batchSize) {
//         const batch = allDrugsToQuery.slice(i, i + batchSize);
        
//         // For each drug name, do a full API search to get complete data
//         for (const drugToSearch of batch) {
//           try {
//             console.log(`Searching for ${drugToSearch}...`);
            
//             // Build parameters for API request - same as standard route
//             const params = new URLSearchParams();
            
//             // Add drug name as intervention search
//             params.append('query.intr', drugToSearch);
            
//             // Add fields - get complete data structure just like standard route
//             params.append('fields', 'protocolSection,derivedSection,hasResults');
            
//             // Get a large number of results per page
//             params.append('pageSize', '100');
            
//             // Format parameter
//             params.append('format', 'json');
            
//             // Make the API request
//             const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//               params: params
//             });
            
//             const studies = response.data.studies || [];
//             console.log(`Found ${studies.length} studies for ${drugToSearch}`);
            
//             // Add each study to our map, using NCT ID as the key
//             studies.forEach(study => {
//               const nctId = study.protocolSection?.identificationModule?.nctId;
//               if (nctId && !uniqueTrials.has(nctId)) {
//                 // Add relevance info to know which drug names matched this trial
//                 if (!study.matchedDrugNames) {
//                   study.matchedDrugNames = [];
//                 }
//                 study.matchedDrugNames.push(drugToSearch);
//                 uniqueTrials.set(nctId, study);
//               } else if (nctId) {
//                 // Update the existing trial to include this drug name match
//                 const existingTrial = uniqueTrials.get(nctId);
//                 if (!existingTrial.matchedDrugNames.includes(drugToSearch)) {
//                   existingTrial.matchedDrugNames.push(drugToSearch);
//                 }
//               }
//             });
            
//             // Also try a term search to catch more results
//             params.delete('query.intr');
//             params.append('query.term', drugToSearch);
            
//             const termResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//               params: params
//             });
            
//             const termStudies = termResponse.data.studies || [];
//             console.log(`Found ${termStudies.length} additional studies for ${drugToSearch} via term search`);
            
//             // Add each study from term search
//             termStudies.forEach(study => {
//               const nctId = study.protocolSection?.identificationModule?.nctId;
//               if (nctId && !uniqueTrials.has(nctId)) {
//                 // Add relevance info
//                 if (!study.matchedDrugNames) {
//                   study.matchedDrugNames = [];
//                 }
//                 study.matchedDrugNames.push(drugToSearch);
//                 uniqueTrials.set(nctId, study);
//               } else if (nctId) {
//                 // Update the existing trial
//                 const existingTrial = uniqueTrials.get(nctId);
//                 if (!existingTrial.matchedDrugNames.includes(drugToSearch)) {
//                   existingTrial.matchedDrugNames.push(drugToSearch);
//                 }
//               }
//             });
            
//           } catch (error) {
//             console.error(`Error searching for ${drugToSearch}:`, error.message);
//             errors.push({ drugName: drugToSearch, error: error.message });
//           }
          
//           // Add a small delay between requests
//           await new Promise(resolve => setTimeout(resolve, 300));
//         }
//       }
      
//       // Get the trial results
//       const allStudies = Array.from(uniqueTrials.values());
//       console.log(`Found ${allStudies.length} unique studies for all drug names`);
      
//       // Add queriedDrugs to each study (this doesn't change the structure)
//       allStudies.forEach(study => {
//         study.queriedDrugs = study.matchedDrugNames || [];
//       });
      
//       // Calculate pagination
//       const effectivePageSize = fetchAll === 'true' ? allStudies.length : pageSize;
//       const totalPages = Math.ceil(allStudies.length / effectivePageSize);
      
//       // If not fetching all, apply manual pagination
//       let paginatedStudies = allStudies;
//       if (fetchAll !== 'true') {
//         const startIdx = (page - 1) * pageSize;
//         const endIdx = startIdx + pageSize;
//         paginatedStudies = allStudies.slice(startIdx, endIdx);
//       }
      
//       // Return in the same format as the standard route
//       return res.json({
//         success: true,
//         data: {
//           studies: paginatedStudies,
//           totalCount: allStudies.length,
//           queriedDrugs: allDrugsToQuery
//         },
//         pagination: {
//           currentPage: fetchAll === 'true' ? 1 : page,
//           pageSize: effectivePageSize,
//           totalCount: allStudies.length,
//           totalPages: fetchAll === 'true' ? 1 : totalPages,
//           hasNextPage: fetchAll === 'true' ? false : (page < totalPages)
//         }
//       });
//     } else {


//       // Original code path when no drugName is provided
//       // Build parameters for API request
//       const params = new URLSearchParams();
      
//       // Add query parameters
//       if (condition) params.append('query.cond', condition);
//       if (intervention) params.append('query.intr', intervention);
//       if (title) params.append('query.titles', title);
//       if (location) params.append('query.locn', location);
//       if (sponsor) params.append('query.spons', sponsor);
//       if (query) params.append('query.term', query);
//       if (patientData) params.append('query.patient', patientData);
      
//       // Add filter parameters
//       if (status) {
//         if (Array.isArray(status)) {
//           params.append('filter.overallStatus', status.join(','));
//         } else {
//           params.append('filter.overallStatus', status);
//         }
//       }
      
//       // Add advanced filter
//       if (advanced) params.append('filter.advanced', advanced);
      
//       // Add pagination
//       params.append('pageSize', pageSize);
//       if (req.query.pageToken) {
//         params.append('pageToken', req.query.pageToken);
//       }
      
//       // Add sorting
//       if (sort) {
//         if (Array.isArray(sort)) {
//           params.append('sort', sort.join(','));
//         } else {
//           params.append('sort', sort);
//         }
//       }
      
//       // Add count total
//       if (countTotal) params.append('countTotal', true);
      
//       // Add fields
//       if (fields) {
//         if (Array.isArray(fields)) {
//           params.append('fields', fields.join(','));
//         } else {
//           params.append('fields', fields);
//         }
//       } else {
//         // Default fields if none specified - comprehensive data
//         params.append('fields', 'protocolSection,derivedSection,hasResults');
//       }
      
//       // Format parameter
//       params.append('format', 'json');
      
//       // Check if we need to fetch all studies
//       if (fetchAll === 'true') {
//         const allStudies = [];
//         let currentParams = new URLSearchParams(params.toString());
//         let hasMorePages = true;
//         let nextPageToken = null;
        
//         while (hasMorePages) {
//           if (nextPageToken) {
//             currentParams.set('pageToken', nextPageToken);
//           }
          
//           console.log(`Fetching page with token: ${nextPageToken || 'initial'}`);
          
//           const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//             params: currentParams
//           });
          
//           const studies = response.data.studies || [];
//           allStudies.push(...studies);
          
//           nextPageToken = response.data.nextPageToken;
//           hasMorePages = !!nextPageToken;
          
//           // Optional: Add delay between requests to prevent rate limiting
//           if (hasMorePages) {
//             await new Promise(resolve => setTimeout(resolve, 300));
//           }
//         }
//         if (allStudies.length < 5) {
//           console.log(`🔍 Drug name provided: ${drugName}. Fetching related drugs.`);
          
//           // Call function to get related drugs
//           const relatedDrugs = await getRelatedDrugs(drugName);
//           console.log(`Found ${relatedDrugs.length} related drugs for ${drugName}`);
          
//           // Combine the original drug with related drugs
//           const allDrugsToQuery = [drugName, ...relatedDrugs];
          
//           // Use the searchAllTrialsForDrugNames function to handle multiple drug searching
//           console.log(`Searching clinical trials for ${allDrugsToQuery.length} drug names...`);
          
//           // IMPORTANT: Instead of using the searchAllTrialsForDrugNames function that returns simplified data,
//           // we'll use the ClinicalTrials.gov API directly to get the full data structure
    
//           // Store all unique trials to avoid duplicates
//           const uniqueTrials = new Map();
//           const errors = [];
          
//           // Search in batches to avoid overwhelming the API
//           const batchSize = 5;
//           for (let i = 0; i < allDrugsToQuery.length; i += batchSize) {
//             const batch = allDrugsToQuery.slice(i, i + batchSize);
            
//             // For each drug name, do a full API search to get complete data
//             for (const drugToSearch of batch) {
//               try {
//                 console.log(`Searching for ${drugToSearch}...`);
                
//                 // Build parameters for API request - same as standard route
//                 const params = new URLSearchParams();
                
//                 // Add drug name as intervention search
//                 params.append('query.intr', drugToSearch);
                
//                 // Add fields - get complete data structure just like standard route
//                 params.append('fields', 'protocolSection,derivedSection,hasResults');
                
//                 // Get a large number of results per page
//                 params.append('pageSize', '100');
                
//                 // Format parameter
//                 params.append('format', 'json');
                
//                 // Make the API request
//                 const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//                   params: params
//                 });
                
//                 const studies = response.data.studies || [];
//                 console.log(`Found ${studies.length} studies for ${drugToSearch}`);
                
//                 // Add each study to our map, using NCT ID as the key
//                 studies.forEach(study => {
//                   const nctId = study.protocolSection?.identificationModule?.nctId;
//                   if (nctId && !uniqueTrials.has(nctId)) {
//                     // Add relevance info to know which drug names matched this trial
//                     if (!study.matchedDrugNames) {
//                       study.matchedDrugNames = [];
//                     }
//                     study.matchedDrugNames.push(drugToSearch);
//                     uniqueTrials.set(nctId, study);
//                   } else if (nctId) {
//                     // Update the existing trial to include this drug name match
//                     const existingTrial = uniqueTrials.get(nctId);
//                     if (!existingTrial.matchedDrugNames.includes(drugToSearch)) {
//                       existingTrial.matchedDrugNames.push(drugToSearch);
//                     }
//                   }
//                 });
                
//                 // Also try a term search to catch more results
//                 params.delete('query.intr');
//                 params.append('query.term', drugToSearch);
                
//                 const termResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//                   params: params
//                 });
                
//                 const termStudies = termResponse.data.studies || [];
//                 console.log(`Found ${termStudies.length} additional studies for ${drugToSearch} via term search`);
                
//                 // Add each study from term search
//                 termStudies.forEach(study => {
//                   const nctId = study.protocolSection?.identificationModule?.nctId;
//                   if (nctId && !uniqueTrials.has(nctId)) {
//                     // Add relevance info
//                     if (!study.matchedDrugNames) {
//                       study.matchedDrugNames = [];
//                     }
//                     study.matchedDrugNames.push(drugToSearch);
//                     uniqueTrials.set(nctId, study);
//                   } else if (nctId) {
//                     // Update the existing trial
//                     const existingTrial = uniqueTrials.get(nctId);
//                     if (!existingTrial.matchedDrugNames.includes(drugToSearch)) {
//                       existingTrial.matchedDrugNames.push(drugToSearch);
//                     }
//                   }
//                 });
                
//               } catch (error) {
//                 console.error(`Error searching for ${drugToSearch}:`, error.message);
//                 errors.push({ drugName: drugToSearch, error: error.message });
//               }
              
//               // Add a small delay between requests
//               await new Promise(resolve => setTimeout(resolve, 300));
//             }
//           }
          
//           // Get the trial results
//           const allStudies = Array.from(uniqueTrials.values());
//           console.log(`Found ${allStudies.length} unique studies for all drug names`);
          
//           // Add queriedDrugs to each study (this doesn't change the structure)
//           allStudies.forEach(study => {
//             study.queriedDrugs = study.matchedDrugNames || [];
//           });
          
//           // Calculate pagination
//           const effectivePageSize = fetchAll === 'true' ? allStudies.length : pageSize;
//           const totalPages = Math.ceil(allStudies.length / effectivePageSize);
          
//           // If not fetching all, apply manual pagination
//           let paginatedStudies = allStudies;
//           if (fetchAll !== 'true') {
//             const startIdx = (page - 1) * pageSize;
//             const endIdx = startIdx + pageSize;
//             paginatedStudies = allStudies.slice(startIdx, endIdx);
//           }
          
//           // Return in the same format as the standard route
//           return res.json({
//             success: true,
//             data: {
//               studies: paginatedStudies,
//               totalCount: allStudies.length,
//               queriedDrugs: allDrugsToQuery
//             },
//             pagination: {
//               currentPage: fetchAll === 'true' ? 1 : page,
//               pageSize: effectivePageSize,
//               totalCount: allStudies.length,
//               totalPages: fetchAll === 'true' ? 1 : totalPages,
//               hasNextPage: fetchAll === 'true' ? false : (page < totalPages)
//             }
//           });
//         } else {
        
//         return res.json({
//           success: true,
//           data: {
//             studies: allStudies,
//             totalCount: allStudies.length
//           },
//           pagination: {
//             currentPage: 1,
//             pageSize: allStudies.length,
//             totalCount: allStudies.length,
//             totalPages: 1,
//             hasNextPage: false
//           }
//         });
//       }
//       }
      
//       // Standard paginated response when fetchAll is not true
//       const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
//         params: params
//       });
      
//       // Format pagination for frontend
//       const totalCount = response.data.totalCount || 0;
//       const totalPages = Math.ceil(totalCount / pageSize);
//       const hasNextPage = !!response.data.nextPageToken;
      
//       const paginationInfo = {
//         currentPage: page,
//         pageSize,
//         totalCount,
//         totalPages,
//         hasNextPage,
//         nextPageToken: response.data.nextPageToken
//       };
      
//       res.json({
//         success: true,
//         data: response.data,
//         pagination: paginationInfo
//       });
//     }
//   } catch (error) {
//     handleApiError(error, res);
//   }
// });











/**
 * Enhanced function to fetch clinical trials for specified search parameters
 * Automatically searches for equivalent drug names when fewer than 10 trials are found
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.drug - Drug name (intervention)
 * @param {string} params.condition - Medical condition
 * @param {boolean} params.hasResults - Filter to only trials with results
 * @param {number} params.yearsBack - Limit search to trials started within this many years
 * @param {string} params.sinceDate - Only include trials updated since this date (YYYY-MM-DD)
 * @param {boolean} params.searchRelated - Whether to search for related drugs (default: auto when <10 trials)
 * @param {number} params.page - Page number for pagination
 * @param {number} params.pageSize - Number of results per page
 * @param {boolean} params.fetchAll - Whether to fetch all pages (overrides page/pageSize)
 * @param {string} params.status - Filter by trial status
 * @returns {Promise<Object>} - Search results and pagination info
 */
async function fetchClinicalTrials(params) {
  try {
    // Extract and normalize parameters
    const {
      drug = null,
      condition = null,
      hasResults = null,
      yearsBack = 5,
      sinceDate = null,
      searchRelated = undefined, // Default undefined to enable auto-detection
      page = 1,
      pageSize = 10,
      fetchAll = false,
      status = null
    } = params;

    console.log(`Starting clinical trials search with params:`, params);

    // Calculate date range for filtering
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);
    
    // Format date as YYYY-MM-DD for the API
    const formattedStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    
    // Format sinceDate if provided
    let formattedSinceDate = null;
    if (sinceDate) {
      const since = new Date(sinceDate);
      formattedSinceDate = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
    }

    // Store all unique trials to avoid duplicates
    const uniqueTrials = new Map();
    const errors = [];
    let totalTrialsFound = 0;
    
    // Initialize array for all drugs to search, including related ones
    let drugsToSearch = [];
    
    // Flag to track if we need to search for related drugs automatically
    let shouldSearchRelated = searchRelated === true;
    
    // If drug is provided, perform an initial search
    if (drug) {
      drugsToSearch = [drug]; // Start with just the original drug
      console.log(`Initial search for drug: ${drug}`);
      
      // Special handling for drug + condition combination
      if (condition) {
        console.log(`Searching for trials with both drug "${drug}" and condition "${condition}"`);
        
        // Base search params for drug + condition
        const searchParams = {
          intervention: drug,
          condition: condition,
          fields: "protocolSection,derivedSection,hasResults",
          pageSize: 100
        };
        
        // Add optional filters
        if (hasResults !== null) searchParams.hasResults = hasResults;
        if (status) searchParams.status = status;
        
        // Add date filters using advanced search
        searchParams.advanced = `AREA[StartDate]RANGE[${formattedStartDate},MAX]${
          formattedSinceDate ? ` AND AREA[LastUpdatePostDate]RANGE[${formattedSinceDate},MAX]` : ''
        }`;
        
        // Perform search
        const combinedResults = await fetchAllPagesOfStudies(searchParams, fetchAll);
        
        // Store trials with both drug and condition
        combinedResults.studies.forEach(study => {
          const nctId = study.protocolSection?.identificationModule?.nctId;
          if (nctId && !uniqueTrials.has(nctId)) {
            // Add metadata about which search found this
            study.searchMetadata = {
              matchedDrug: drug,
              matchedCondition: condition
            };
            uniqueTrials.set(nctId, study);
          }
        });
        
        totalTrialsFound = combinedResults.studies.length;
        console.log(`Found ${totalTrialsFound} trials matching both drug "${drug}" and condition "${condition}"`);
        
        // If fewer than 10 trials found and searchRelated isn't explicitly false, auto-search related drugs
        if (totalTrialsFound < 10 && searchRelated !== false) {
          console.log(`Fewer than 10 trials found. Will automatically search for related drugs.`);
          shouldSearchRelated = true;
        }
      } else {
        // Drug-only search
        console.log(`Performing drug-only search for: ${drug}`);
        
        // Base search params for drug-only search
        const searchParams = {
          intervention: drug,
          fields: "protocolSection,derivedSection,hasResults",
          pageSize: 100
        };
        
        // Add optional filters
        if (hasResults !== null) searchParams.hasResults = hasResults;
        if (status) searchParams.status = status;
        
        // Add date filters
        searchParams.advanced = `AREA[StartDate]RANGE[${formattedStartDate},MAX]${
          formattedSinceDate ? ` AND AREA[LastUpdatePostDate]RANGE[${formattedSinceDate},MAX]` : ''
        }`;
        
        // Perform search
        const drugResults = await fetchAllPagesOfStudies(searchParams, true);
        
        console.log(`Found ${drugResults.studies.length} trials for drug "${drug}"`);
        
        // Store unique trials
        drugResults.studies.forEach(study => {
          const nctId = study.protocolSection?.identificationModule?.nctId;
          if (nctId && !uniqueTrials.has(nctId)) {
            // Add metadata about which drug matched
            study.searchMetadata = {
              matchedDrug: drug,
              isOriginalDrug: true // Flag to indicate this is the original drug
            };
            uniqueTrials.set(nctId, study);
          }
        });
        
        totalTrialsFound = drugResults.studies.length;
        
        // If fewer than 10 trials found and searchRelated isn't explicitly false, auto-search related drugs
        if (totalTrialsFound < 10 && searchRelated !== false) {
          console.log(`Fewer than 10 trials found (${totalTrialsFound}). Will automatically search for related drugs.`);
          shouldSearchRelated = true;
        }
      }
      
      // If we should search for related drugs (either explicitly requested or auto-triggered)
      if (shouldSearchRelated) {
        try {
          console.log(`Getting related drugs for: ${drug}`);
          const relatedDrugs = await getRelatedDrugs(drug);
          
          if (relatedDrugs && relatedDrugs.length > 0) {
            // Add related drugs to the search list
            drugsToSearch = [...drugsToSearch, ...relatedDrugs];
            console.log(`Will search for ${drugsToSearch.length} drugs total (original + ${relatedDrugs.length} related).`);
            
            // Process related drugs in batches to avoid overwhelming the API
            const batchSize = 5;
            // Start from index 1 as we already searched the original drug
            for (let i = 1; i < drugsToSearch.length; i += batchSize) {
              const batch = drugsToSearch.slice(i, i + batchSize);
              console.log(`Processing batch ${Math.floor(i/batchSize) + 1} with ${batch.length} drugs`);
              
              // Sequential processing to be gentler on the API
              for (const drugName of batch) {
                try {
                  console.log(`Searching for trials with related drug: ${drugName}`);
                  
                  // Base search params for related drug search
                  const searchParams = {
                    intervention: drugName,
                    fields: "protocolSection,derivedSection,hasResults",
                    pageSize: 100
                  };
                  
                  // Add condition if it was provided in the original search
                  if (condition) searchParams.condition = condition;
                  
                  // Add optional filters
                  if (hasResults !== null) searchParams.hasResults = hasResults;
                  if (status) searchParams.status = status;
                  
                  // Add date filters
                  searchParams.advanced = `AREA[StartDate]RANGE[${formattedStartDate},MAX]${
                    formattedSinceDate ? ` AND AREA[LastUpdatePostDate]RANGE[${formattedSinceDate},MAX]` : ''
                  }`;
                  
                  // Perform search
                  const relatedDrugResults = await fetchAllPagesOfStudies(searchParams, true);
                  
                  console.log(`Found ${relatedDrugResults.studies.length} trials for related drug "${drugName}"`);
                  
                  // Store unique trials
                  relatedDrugResults.studies.forEach(study => {
                    const nctId = study.protocolSection?.identificationModule?.nctId;
                    if (nctId && !uniqueTrials.has(nctId)) {
                      // Add metadata about which related drug matched
                      study.searchMetadata = {
                        matchedDrug: drugName,
                        isRelatedDrug: true,
                        relatedTo: drug
                      };
                      if (condition) {
                        study.searchMetadata.matchedCondition = condition;
                      }
                      uniqueTrials.set(nctId, study);
                    } else if (nctId) {
                      // Update existing trial to note this related drug also matched
                      const existingTrial = uniqueTrials.get(nctId);
                      if (!existingTrial.searchMetadata) {
                        existingTrial.searchMetadata = {};
                      }
                      
                      // Convert single matchedDrug to array if needed
                      if (existingTrial.searchMetadata.matchedDrug && !existingTrial.searchMetadata.matchedDrugs) {
                        existingTrial.searchMetadata.matchedDrugs = [existingTrial.searchMetadata.matchedDrug];
                        delete existingTrial.searchMetadata.matchedDrug;
                      }
                      
                      // Initialize matchedDrugs array if it doesn't exist
                      if (!existingTrial.searchMetadata.matchedDrugs) {
                        existingTrial.searchMetadata.matchedDrugs = [];
                      }
                      
                      // Add the current drug if not already in the array
                      if (!existingTrial.searchMetadata.matchedDrugs.includes(drugName)) {
                        existingTrial.searchMetadata.matchedDrugs.push(drugName);
                      }
                    }
                  });
                  
                  // Add to total trials count for logging
                  totalTrialsFound += relatedDrugResults.studies.length;
                  
                  // Add a small delay between requests to prevent rate limiting
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                } catch (error) {
                  console.error(`Error searching for related drug "${drugName}":`, error.message);
                  errors.push({ drugName, error: error.message });
                }
              }
            }
          } else {
            console.log(`No related drugs found for "${drug}".`);
          }
        } catch (relatedError) {
          console.error(`Error getting related drugs for "${drug}":`, relatedError.message);
          errors.push({ drug, error: `Failed to get related drugs: ${relatedError.message}` });
        }
      }
      
    } else if (condition) {
      // Condition-only search (no changes needed here)
      console.log(`Performing condition-only search for: ${condition}`);
      
      // Base search params for condition-only search
      const searchParams = {
        condition: condition,
        fields: "protocolSection,derivedSection,hasResults",
        pageSize: 100
      };
      
      // Add optional filters
      if (hasResults !== null) searchParams.hasResults = hasResults;
      if (status) searchParams.status = status;
      
      // Add date filters
      searchParams.advanced = `AREA[StartDate]RANGE[${formattedStartDate},MAX]${
        formattedSinceDate ? ` AND AREA[LastUpdatePostDate]RANGE[${formattedSinceDate},MAX]` : ''
      }`;
      
      // Perform search
      const conditionResults = await fetchAllPagesOfStudies(searchParams, fetchAll);
      
      // Store unique trials
      conditionResults.studies.forEach(study => {
        const nctId = study.protocolSection?.identificationModule?.nctId;
        if (nctId && !uniqueTrials.has(nctId)) {
          // Add metadata about which condition matched
          study.searchMetadata = {
            matchedCondition: condition
          };
          uniqueTrials.set(nctId, study);
        }
      });
      
      totalTrialsFound = conditionResults.studies.length;
      console.log(`Found ${totalTrialsFound} trials for condition "${condition}"`);
    } else {
      throw new Error("At least one of 'drug' or 'condition' must be provided");
    }

    // Convert results map to array for pagination
    const allTrials = Array.from(uniqueTrials.values());
    
    console.log(`Final count: ${allTrials.length} unique trials found across all searches.`);
    
    // If we're fetching all results, return everything
    if (fetchAll) {
      return {
        success: true,
        data: {
          studies: allTrials,
          totalCount: allTrials.length,
          queriedDrugs: drugsToSearch,
          queriedCondition: condition
        },
        pagination: {
          currentPage: 1,
          pageSize: allTrials.length,
          totalCount: allTrials.length,
          totalPages: 1,
          hasNextPage: false
        },
        errors: errors.length > 0 ? errors : undefined
      };
    }
    
    // Otherwise, apply pagination manually
    const totalPages = Math.ceil(allTrials.length / pageSize);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedTrials = allTrials.slice(startIdx, endIdx);
    
    return {
      success: true,
      data: {
        studies: paginatedTrials,
        totalCount: allTrials.length,
        queriedDrugs: drugsToSearch,
        queriedCondition: condition
      },
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: allTrials.length,
        totalPages: totalPages,
        hasNextPage: page < totalPages
      },
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error("Error in fetchClinicalTrials:", error);
    return {
      success: false,
      error: error.message,
      data: { studies: [], totalCount: 0 }
    };
  }
}

/**
 * Update the search trials for name function to use the enhanced clinical trials function
 * 
 * @param {string} drugName - Name of the drug to search for
 * @returns {Promise<Object>} - Trials and error info
 */
async function searchTrialsForName(drugName) {
  try {
    if (!drugName || typeof drugName !== 'string' || drugName.trim() === '') {
      return { trials: [], error: 'Invalid drug name' };
    }
    
    const sanitizedName = drugName.trim();
    
    // Use the enhanced fetchClinicalTrials function
    // Set searchRelated=undefined to enable automatic detection
    const searchResults = await fetchClinicalTrials({
      drug: sanitizedName,
      fetchAll: true,
      searchRelated: undefined // Automatically search related drugs if < 10 trials found
    });
    
    // Format results to match the expected output format
    if (!searchResults.success) {
      return { trials: [], error: searchResults.error };
    }
    
    // Transform studies to the expected format
    const formattedTrials = searchResults.data.studies.map(study => {
      const protocolSection = study.protocolSection || {};
      const identificationModule = protocolSection.identificationModule || {};
      const statusModule = protocolSection.statusModule || {};
      const designModule = protocolSection.designModule || {};
      const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
      const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
      const descriptionModule = protocolSection.descriptionModule || {};
      const conditionsModule = protocolSection.conditionsModule || {};
      
      // Get interventions
      const interventions = [];
      if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
        armsInterventionsModule.interventions.forEach(intervention => {
          interventions.push({
            name: intervention.name,
            type: intervention.type,
            description: intervention.description
          });
        });
      }
      
      // Extract conditions
      const conditions = conditionsModule.conditions || [];
      
      // Extract matched drug info from searchMetadata
      let matchedDrugName = sanitizedName; // Default to the original search drug
      
      if (study.searchMetadata) {
        if (study.searchMetadata.matchedDrug) {
          matchedDrugName = study.searchMetadata.matchedDrug;
        } else if (study.searchMetadata.matchedDrugs && study.searchMetadata.matchedDrugs.length > 0) {
          matchedDrugName = study.searchMetadata.matchedDrugs.join(', ');
        }
      }
      
      return {
        nctId: identificationModule.nctId,
        title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
        status: statusModule.overallStatus || 'UNKNOWN',
        phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
        summary: descriptionModule.briefSummary ? 
                 descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
                 : (identificationModule.briefSummary ?
                    identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '')
                    : 'No summary available'),
        startDate: statusModule.startDate || 'Not specified',
        completionDate: statusModule.completionDate || 'Not specified',
        studyType: designModule.studyType || 'Not specified',
        sponsor: sponsorCollaboratorsModule.leadSponsor ? 
                sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
                : 'Not specified',
        enrollment: designModule.enrollmentInfo ? 
                   designModule.enrollmentInfo.count || 'Not specified' 
                   : 'Not specified',
        interventions: interventions,
        url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`,
        conditions: conditions,
        hasResults: study.hasResults,
        matchedDrug: matchedDrugName,
        isRelatedDrug: study.searchMetadata && study.searchMetadata.isRelatedDrug === true
      };
    });
    
    return { trials: formattedTrials, error: null };
  } catch (error) {
    console.error(`Error searching trials for ${drugName}:`, error.message);
    return { trials: [], error: error.message };
  }
}

/**
 * Update the searchAllTrialsForDrugNames function to use the enhanced functionality
 * 
 * @param {string[]} drugNames - Array of drug names to search for
 * @returns {Promise<Object>} - Combined search results
 */
async function searchAllTrialsForDrugNames(drugNames) {
  try {
    if (!Array.isArray(drugNames) || drugNames.length === 0) {
      return {
        trials: [],
        errors: [{ error: 'No valid drug names provided' }],
        totalDrugNames: 0,
        totalUniqueTrials: 0
      };
    }
    
    console.log(`Searching trials for ${drugNames.length} drug names...`);
    
    // Store all unique trials and errors
    const uniqueTrials = new Map();
    const errors = [];
    
    // Process each drug name, potentially with related names for low-result drugs
    for (let i = 0; i < drugNames.length; i++) {
      const drugName = drugNames[i];
      console.log(`Processing drug ${i+1}/${drugNames.length}: ${drugName}`);
      
      try {
        // Use the enhanced fetchClinicalTrials function for each drug
        const searchResults = await fetchClinicalTrials({
          drug: drugName,
          fetchAll: true,
          searchRelated: undefined // Auto-search related drugs if needed
        });
        
        if (searchResults.success && searchResults.data.studies.length > 0) {
          // Track which drug names matched each trial
          searchResults.data.studies.forEach(study => {
            const nctId = study.protocolSection?.identificationModule?.nctId;
            if (nctId) {
              if (!uniqueTrials.has(nctId)) {
                // Add metadata about the drug match if not already present
                if (!study.matchedDrugNames) {
                  study.matchedDrugNames = [];
                }
                if (study.searchMetadata && study.searchMetadata.matchedDrug) {
                  study.matchedDrugNames.push(study.searchMetadata.matchedDrug);
                } else {
                  study.matchedDrugNames.push(drugName);
                }
                uniqueTrials.set(nctId, study);
              } else {
                // Update existing trial to include this drug name match
                const existingTrial = uniqueTrials.get(nctId);
                if (!existingTrial.matchedDrugNames) {
                  existingTrial.matchedDrugNames = [];
                }
                
                // Add the matched drug from metadata or use the original drug name
                const drugToAdd = (study.searchMetadata && study.searchMetadata.matchedDrug) ? 
                                  study.searchMetadata.matchedDrug : drugName;
                                  
                if (!existingTrial.matchedDrugNames.includes(drugToAdd)) {
                  existingTrial.matchedDrugNames.push(drugToAdd);
                }
              }
            }
          });
          
          console.log(`Added ${searchResults.data.studies.length} trials for drug "${drugName}"`);
        } else if (searchResults.error) {
          errors.push({ drugName, error: searchResults.error });
        }
      } catch (error) {
        console.error(`Error searching for drug "${drugName}":`, error.message);
        errors.push({ drugName, error: error.message });
      }
      
      // Add a small delay between processing each drug to prevent rate limiting
      if (i < drugNames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Get the array of unique trials
    const trialsArray = Array.from(uniqueTrials.values());
    
    console.log(`Search completed. Found ${trialsArray.length} unique trials.`);
    
    // Format the trials to match expected output
    const formattedTrials = trialsArray.map(study => {
      const protocolSection = study.protocolSection || {};
      const identificationModule = protocolSection.identificationModule || {};
      const statusModule = protocolSection.statusModule || {};
      const designModule = protocolSection.designModule || {};
      const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
      const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
      const descriptionModule = protocolSection.descriptionModule || {};
      const conditionsModule = protocolSection.conditionsModule || {};
      
      // Get interventions
      const interventions = [];
      if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
        armsInterventionsModule.interventions.forEach(intervention => {
          interventions.push({
            name: intervention.name,
            type: intervention.type,
            description: intervention.description
          });
        });
      }
      
      // Extract conditions
      const conditions = conditionsModule.conditions || [];
      
      return {
        nctId: identificationModule.nctId,
        title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
        status: statusModule.overallStatus || 'UNKNOWN',
        phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
        summary: descriptionModule.briefSummary ? 
                 descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
                 : (identificationModule.briefSummary ?
                    identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '')
                    : 'No summary available'),
        startDate: statusModule.startDate || 'Not specified',
        completionDate: statusModule.completionDate || 'Not specified',
        studyType: designModule.studyType || 'Not specified',
        sponsor: sponsorCollaboratorsModule.leadSponsor ? 
                sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
                : 'Not specified',
        enrollment: designModule.enrollmentInfo ? 
                   designModule.enrollmentInfo.count || 'Not specified' 
                   : 'Not specified',
        interventions: interventions,
        url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`,
        conditions: conditions,
        hasResults: study.hasResults,
        matchedDrugNames: study.matchedDrugNames || []
      };
    });
    
    return {
      trials: formattedTrials,
      errors: errors,
      totalDrugNames: drugNames.length,
      totalUniqueTrials: formattedTrials.length
    };
  } catch (error) {
    console.error("Error in searchAllTrialsForDrugNames:", error);
    return {
      trials: [],
      errors: [{ error: error.message }],
      totalDrugNames: drugNames.length,
      totalUniqueTrials: 0
    };
  }
}



/**
 * General search route that supports searching for any terms including medical devices
 * and allows filtering by patient populations
 */
/**
 * Improved general search route that supports exact phrase matching for medical devices
 */
/**
 * General search route that uses proper ClinicalTrials.gov API v2 parameters
 */
app.get('/api/studies/general-search', validatePagination, async (req, res) => {
  try {
    // Parse query parameters using proper naming - critical for the v2 API
    const {
      'query.term': searchTerm,       // Using the correct parameter name for search term
      'query.patient': patientPopulation,  // Using the correct parameter name for patient population
      exactMatch = 'true',            // Default to exact match
      'filter.overallStatus': status,
      aggFilters: hasResults,
      'filter.advanced': advancedFilter,
      pageToken,
    } = req.query;
    
    const { page, pageSize } = req.pagination;
    
    console.log(`🔍 General search request using v2 API for term: "${searchTerm}", population: "${patientPopulation}"`);
    
    // Define the API base URL for v2
    const CLINICAL_TRIALS_API_BASE = 'https://clinicaltrials.gov/api/v2';
    
    // Create query parameters following the v2 API format
    // This is critical - we pass through the properly named parameters directly
    const queryParams = {
      format: 'json',
      pageSize: pageSize || 100,
      countTotal: true,
      fields: "protocolSection,derivedSection,hasResults"
    };
    
    // Pass through the search term as-is with proper parameter name
    if (searchTerm) {
      queryParams['query.term'] = searchTerm;
    }
    
    // Pass through the patient population as-is with proper parameter name
    if (patientPopulation) {
      queryParams['query.patient'] = patientPopulation;
    }
    
    // Pass through the status filter if provided
    if (status) {
      queryParams['filter.overallStatus'] = status;
    }
    
    // Pass through the advanced filter if provided
    if (advancedFilter) {
      queryParams['filter.advanced'] = advancedFilter;
    }
    
    // Pass through hasResults filter if provided
    if (hasResults) {
      queryParams.aggFilters = hasResults;
    }
    
    // Pass through pageToken if provided for pagination
    if (pageToken) {
      queryParams.pageToken = pageToken;
    }
    
    console.log(`Fetching from ClinicalTrials.gov API with params:`, queryParams);
    
    // Make the API request to ClinicalTrials.gov
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
      params: queryParams,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    // Send the response directly back to the client
    // This simplifies things by not adding extra filtering which can break the search
    res.json(response.data);
    
  } catch (error) {
    console.error("General search API error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Also update the API handler to use the enhanced functionality
/**
 * API handler for the /api/studies/search endpoint
 * Provides backward compatibility with existing code
 */
app.get('/api/studies/search', validatePagination, async (req, res) => {
  try {
    const {
      query, condition, intervention, status, phase, sponsor,
      title, location, patientData, sort, countTotal, fields,
      advanced, fetchAll, searchRelated, yearsBack, sinceDate
    } = req.query;
    
    const { page, pageSize } = req.pagination;
    
    console.log(`🔍 Search request received with params:`, req.query);
    
    // Use the enhanced fetchClinicalTrials function with translated parameters
    const searchResults = await fetchClinicalTrials({
      drug: intervention,
      condition: condition,
      hasResults: req.query.hasResults === 'true',
      yearsBack: yearsBack ? parseInt(yearsBack, 10) : 5,
      sinceDate: sinceDate || null,
      searchRelated: searchRelated === 'true' ? true : 
                    searchRelated === 'false' ? false : undefined, // Undefined enables auto-detection
      page: page,
      pageSize: pageSize,
      fetchAll: fetchAll === 'true',
      status: status
    });
    
    // Return response in the expected format
    res.json(searchResults);
    
  } catch (error) {
    console.error("API search error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to fetch all pages of studies for a given search
 * 
 * @param {Object} searchParams - Parameters for the API call
 * @param {boolean} fetchAll - Whether to fetch all pages
 * @returns {Promise<Object>} - All studies and pagination info
 */
/**
 * Helper function to fetch all pages of studies for a given search
 * 
 * @param {Object} searchParams - Parameters for the API call
 * @param {boolean} fetchAll - Whether to fetch all pages
 * @returns {Promise<Object>} - All studies and pagination info
 */
async function fetchAllPagesOfStudies(searchParams, fetchAll = false) {
  const allStudies = [];
  let nextPageToken = null;
  let hasMorePages = true;
  let pageNumber = 1;
  
  // Define the API base URL
  const CLINICAL_TRIALS_API_BASE = 'https://clinicaltrials.gov/api/v2';
  
  while (hasMorePages) {
    // Create a new params object for the updated API
    const queryParams = {
      format: 'json',
      pageSize: searchParams.pageSize || 100,
      countTotal: true,
      fields: searchParams.fields || 'protocolSection,derivedSection,hasResults'
    };
    
    // Add pagination token if not on the first page
    if (nextPageToken) {
      queryParams.pageToken = nextPageToken;
    }
    
    // Convert the advanced search parameter to the new format
    if (searchParams.advanced) {
      queryParams['filter.advanced'] = searchParams.advanced;
    }
    
    // Convert other search parameters to the new format
    if (searchParams.intervention) {
      queryParams['query.intr'] = searchParams.intervention;
    }
    
    if (searchParams.condition) {
      queryParams['query.cond'] = searchParams.condition;
    }
    
    // Handle has results filter
    if (searchParams.hasResults !== null && searchParams.hasResults !== undefined) {
      // Directly map this to a filter parameter in the new API
      queryParams['aggFilters'] = searchParams.hasResults ? 'results:with' : '';
    }
    
    // Handle status filter if provided
    if (searchParams.status) {
      if (Array.isArray(searchParams.status)) {
        queryParams['filter.overallStatus'] = searchParams.status.join(',');
      } else {
        queryParams['filter.overallStatus'] = searchParams.status;
      }
    }
    
    console.log(`Fetching page ${pageNumber} with params:`, queryParams);
    
    try {
      const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
        params: queryParams,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      // Extract studies from the response
      const studies = response.data.studies || [];
      console.log(`Received ${studies.length} studies on page ${pageNumber}`);
      
      // Add studies to our collection
      allStudies.push(...studies);
      
      // Get next page token
      nextPageToken = response.data.nextPageToken;
      
      // Determine if we should continue
      hasMorePages = !!nextPageToken && (fetchAll || pageNumber < (searchParams.maxPages ? parseInt(searchParams.maxPages, 10) : 10));
      
      // Increment page counter
      pageNumber++;
      
      // Add a small delay between requests to prevent rate limiting
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error.message);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
      // Break the loop on error
      hasMorePages = false;
    }
  }
  
  return { 
    studies: allStudies, 
    totalPages: pageNumber - 1 
  };
}
/**
 * API handler for the /api/studies/search endpoint
 * Provides backward compatibility with existing code
 */
// app.get('/api/studies/search', validatePagination, async (req, res) => {
//   try {
//     const {
//       query, condition, intervention, status, phase, sponsor,
//       title, location, patientData, sort, countTotal, fields,
//       advanced, fetchAll, searchRelated, yearsBack, sinceDate
//     } = req.query;
    
//     const { page, pageSize } = req.pagination;
    
//     console.log(`🔍 Search request received with params:`, req.query);
    
//     // Use the new fetchClinicalTrials function with translated parameters
//     const searchResults = await fetchClinicalTrials({
//       drug: intervention,
//       condition: condition,
//       hasResults: req.query.hasResults === 'true',
//       yearsBack: yearsBack ? parseInt(yearsBack, 10) : 5,
//       sinceDate: sinceDate || null,
//       searchRelated: searchRelated === 'true',
//       page: page,
//       pageSize: pageSize,
//       fetchAll: fetchAll === 'true',
//       status: status
//     });
    
//     // Return response in the expected format
//     res.json(searchResults);
    
//   } catch (error) {
//     console.error("API search error:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// /**
//  * Function to search clinical trials for a specific drug
//  * Maintained for backward compatibility
//  * 
//  * @param {string} drugName - Name of the drug to search for
//  * @returns {Promise<Object>} - Trials and error info
//  */
// async function searchTrialsForName(drugName) {
//   try {
//     if (!drugName || typeof drugName !== 'string' || drugName.trim() === '') {
//       return { trials: [], error: 'Invalid drug name' };
//     }
    
//     const sanitizedName = drugName.trim();
    
//     // Use the new fetchClinicalTrials function
//     const searchResults = await fetchClinicalTrials({
//       drug: sanitizedName,
//       fetchAll: true
//     });
    
//     // Format results to match the expected output format
//     if (!searchResults.success) {
//       return { trials: [], error: searchResults.error };
//     }
    
//     // Transform studies to the expected format
//     const formattedTrials = searchResults.data.studies.map(study => {
//       const protocolSection = study.protocolSection || {};
//       const identificationModule = protocolSection.identificationModule || {};
//       const statusModule = protocolSection.statusModule || {};
//       const designModule = protocolSection.designModule || {};
//       const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
//       const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
//       const descriptionModule = protocolSection.descriptionModule || {};
//       const conditionsModule = protocolSection.conditionsModule || {};
      
//       // Get interventions
//       const interventions = [];
//       if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
//         armsInterventionsModule.interventions.forEach(intervention => {
//           interventions.push({
//             name: intervention.name,
//             type: intervention.type,
//             description: intervention.description
//           });
//         });
//       }
      
//       // Extract conditions
//       const conditions = conditionsModule.conditions || [];
      
//       return {
//         nctId: identificationModule.nctId,
//         title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
//         status: statusModule.overallStatus || 'UNKNOWN',
//         phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
//         summary: descriptionModule.briefSummary ? 
//                  descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
//                  : (identificationModule.briefSummary ?
//                     identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '')
//                     : 'No summary available'),
//         startDate: statusModule.startDate || 'Not specified',
//         completionDate: statusModule.completionDate || 'Not specified',
//         studyType: designModule.studyType || 'Not specified',
//         sponsor: sponsorCollaboratorsModule.leadSponsor ? 
//                 sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
//                 : 'Not specified',
//         enrollment: designModule.enrollmentInfo ? 
//                    designModule.enrollmentInfo.count || 'Not specified' 
//                    : 'Not specified',
//         interventions: interventions,
//         url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`,
//         conditions: conditions,
//         hasResults: study.hasResults
//       };
//     });
    
//     return { trials: formattedTrials, error: null };
//   } catch (error) {
//     console.error(`Error searching trials for ${drugName}:`, error.message);
//     return { trials: [], error: error.message };
//   }
// }

// /**
//  * Function to search for trials for multiple drug names
//  * Maintained for backward compatibility
//  * 
//  * @param {string[]} drugNames - Array of drug names to search for
//  * @returns {Promise<Object>} - Combined search results
//  */
// async function searchAllTrialsForDrugNames(drugNames) {
//   try {
//     if (!Array.isArray(drugNames) || drugNames.length === 0) {
//       return {
//         trials: [],
//         errors: [{ error: 'No valid drug names provided' }],
//         totalDrugNames: 0,
//         totalUniqueTrials: 0
//       };
//     }
    
//     console.log(`Searching trials for ${drugNames.length} drug names...`);
    
//     // Use the new fetchClinicalTrials function
//     const searchResults = await fetchClinicalTrials({
//       drug: drugNames[0], // Use first drug as primary
//       searchRelated: false, // Don't auto-search related
//       fetchAll: true
//     });
    
//     // Store all unique trials and errors
//     const uniqueTrials = new Map();
//     const errors = [];
    
//     // Process initial search results
//     if (searchResults.success) {
//       searchResults.data.studies.forEach(study => {
//         const nctId = study.protocolSection?.identificationModule?.nctId;
//         if (nctId) {
//           // Add metadata about the drug match
//           if (!study.matchedDrugNames) {
//             study.matchedDrugNames = [drugNames[0]];
//           }
//           uniqueTrials.set(nctId, study);
//         }
//       });
//     } else if (searchResults.error) {
//       errors.push({ drugName: drugNames[0], error: searchResults.error });
//     }
    
//     // If more than one drug name, process the rest
//     if (drugNames.length > 1) {
//       // Process drugs in batches to avoid overwhelming the API
//       const batchSize = 5;
//       for (let i = 1; i < drugNames.length; i += batchSize) {
//         const batch = drugNames.slice(i, i + batchSize);
//         console.log(`Processing batch of ${batch.length} additional drugs`);
        
//         // Sequential processing to be gentler on the API
//         for (const drugName of batch) {
//           try {
//             const drugResults = await fetchClinicalTrials({
//               drug: drugName,
//               fetchAll: true
//             });
            
//             if (drugResults.success) {
//               drugResults.data.studies.forEach(study => {
//                 const nctId = study.protocolSection?.identificationModule?.nctId;
//                 if (nctId && !uniqueTrials.has(nctId)) {
//                   // Add metadata about which drug name matched this trial
//                   if (!study.matchedDrugNames) {
//                     study.matchedDrugNames = [];
//                   }
//                   study.matchedDrugNames.push(drugName);
//                   uniqueTrials.set(nctId, study);
//                 } else if (nctId) {
//                   // Update the existing trial to include this drug name match
//                   const existingTrial = uniqueTrials.get(nctId);
//                   if (!existingTrial.matchedDrugNames) {
//                     existingTrial.matchedDrugNames = [];
//                   }
//                   if (!existingTrial.matchedDrugNames.includes(drugName)) {
//                     existingTrial.matchedDrugNames.push(drugName);
//                   }
//                 }
//               });
//             } else if (drugResults.error) {
//               errors.push({ drugName, error: drugResults.error });
//             }
            
//             // Add a small delay between requests
//             await new Promise(resolve => setTimeout(resolve, 300));
            
//           } catch (error) {
//             console.error(`Error searching for drug "${drugName}":`, error.message);
//             errors.push({ drugName, error: error.message });
//           }
//         }
//       }
//     }
    
//     // Get the array of unique trials
//     const trialsArray = Array.from(uniqueTrials.values());
    
//     console.log(`Search completed. Found ${trialsArray.length} unique trials.`);
    
//     // Format the trials to match expected output
//     const formattedTrials = trialsArray.map(study => {
//       const protocolSection = study.protocolSection || {};
//       const identificationModule = protocolSection.identificationModule || {};
//       const statusModule = protocolSection.statusModule || {};
//       const designModule = protocolSection.designModule || {};
//       const sponsorCollaboratorsModule = protocolSection.sponsorCollaboratorsModule || {};
//       const armsInterventionsModule = protocolSection.armsInterventionsModule || {};
//       const descriptionModule = protocolSection.descriptionModule || {};
//       const conditionsModule = protocolSection.conditionsModule || {};
      
//       // Get interventions
//       const interventions = [];
//       if (armsInterventionsModule.interventions && Array.isArray(armsInterventionsModule.interventions)) {
//         armsInterventionsModule.interventions.forEach(intervention => {
//           interventions.push({
//             name: intervention.name,
//             type: intervention.type,
//             description: intervention.description
//           });
//         });
//       }
      
//       // Extract conditions
//       const conditions = conditionsModule.conditions || [];
      
//       return {
//         nctId: identificationModule.nctId,
//         title: identificationModule.briefTitle || identificationModule.officialTitle || 'No title available',
//         status: statusModule.overallStatus || 'UNKNOWN',
//         phase: designModule.phases ? designModule.phases.join(', ') : 'Not specified',
//         summary: descriptionModule.briefSummary ? 
//                  descriptionModule.briefSummary.substring(0, 300) + (descriptionModule.briefSummary.length > 300 ? '...' : '') 
//                  : (identificationModule.briefSummary ?
//                     identificationModule.briefSummary.substring(0, 300) + (identificationModule.briefSummary.length > 300 ? '...' : '')
//                     : 'No summary available'),
//         startDate: statusModule.startDate || 'Not specified',
//         completionDate: statusModule.completionDate || 'Not specified',
//         studyType: designModule.studyType || 'Not specified',
//         sponsor: sponsorCollaboratorsModule.leadSponsor ? 
//                 sponsorCollaboratorsModule.leadSponsor.name || 'Not specified' 
//                 : 'Not specified',
//         enrollment: designModule.enrollmentInfo ? 
//                    designModule.enrollmentInfo.count || 'Not specified' 
//                    : 'Not specified',
//         interventions: interventions,
//         url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`,
//         conditions: conditions,
//         hasResults: study.hasResults,
//         matchedDrugNames: study.matchedDrugNames || []
//       };
//     });
    
//     return {
//       trials: formattedTrials,
//       errors: errors,
//       totalDrugNames: drugNames.length,
//       totalUniqueTrials: formattedTrials.length
//     };
//   } catch (error) {
//     console.error("Error in searchAllTrialsForDrugNames:", error);
//     return {
//       trials: [],
//       errors: [{ error: error.message }],
//       totalDrugNames: drugNames.length,
//       totalUniqueTrials: 0
//     };
//   }
// }
/**
 * Function to get related drugs for a given drug name using multiple pharmaceutical databases
 * @param {string} drugName - The name of the drug to find related drugs for
 * @returns {Promise<string[]>} - Array of related drug names
 */
async function getRelatedDrugs(drugName) {
  try {
    console.log(`Getting related drugs for: ${drugName}`);
    
    // Object to store all results from various drug databases
    const results = {
      originalQuery: drugName,
      sources: {
        rxnorm: { names: [], links: [] },
        fda: { names: [], links: [] },
        pubchem: { names: [], links: [] }
      }
    };

    // Execute searches individually to prevent a failure in one from stopping the others
    try {
      await searchRxNorm(drugName, results);
      console.log(`RxNorm search completed with ${results.sources.rxnorm.names.length} names`);
    } catch (rxError) {
      console.error('RxNorm search failed:', rxError.message);
      results.sources.rxnorm.names.push({
        name: "Error searching RxNorm database",
        type: "Error"
      });
    }
    
    try {
      await searchFDA(drugName, results);
      console.log(`FDA search completed with ${results.sources.fda.names.length} names`);
    } catch (fdaError) {
      console.error('FDA search failed:', fdaError.message);
      results.sources.fda.names.push({
        name: "Error searching FDA database",
        type: "Error"
      });
    }
    
    try {
      await searchPubChem(drugName, results);
      console.log(`PubChem search completed with ${results.sources.pubchem.names.length} names`);
    } catch (pubchemError) {
      console.error('PubChem search failed:', pubchemError.message);
      results.sources.pubchem.names.push({
        name: "Error searching PubChem database",
        type: "Error"
      });
    }
    
    // Extract all the unique drug names from the search results
    const allNames = new Set();
    
    for (const [sourceName, sourceData] of Object.entries(results.sources)) {
      if (sourceData.names && sourceData.names.length > 0) {
        for (const nameObj of sourceData.names) {
          // Skip error and info messages
          if (nameObj.type === 'Error' || nameObj.type === 'Info' || 
              !nameObj.name || typeof nameObj.name !== 'string') {
            continue;
          }
          
          // Skip very short names (likely not useful for searches)
          if (nameObj.name.trim().length < 3) {
            continue;
          }
          
          // Add to the unique set
          allNames.add(nameObj.name);
        }
      }
    }
    
    // Convert the Set to Array and remove the original drug name
    let relatedDrugs = Array.from(allNames).filter(name => 
      name.toLowerCase() !== drugName.toLowerCase()
    );
    
    // // Filter out problematic drug names that are likely to cause errors
    // relatedDrugs = relatedDrugs.filter(name => {
    //   // Skip chemical structure identifiers, too complex for search
    //   if (name.includes('-') && /\d/.test(name) && name.length > 10) {
    //     return false;
    //   }
      
    //   // Skip CAS registry numbers and similar identifiers
    //   if (/^\d+-\d+-\d+$/.test(name)) {
    //     return false;
    //   }
      
    //   // Skip SMILES strings or other complex chemical notations
    //   if (name.includes('(') && name.includes(')') && name.length > 30) {
    //     return false;
    //   }
      
    //   // Skip chemical formula-like strings with numbers and brackets
    //   if (/^[A-Z0-9\(\)\[\]\{\}]+$/.test(name) && /\d/.test(name)) {
    //     return false;
    //   }
      
    //   // Skip database IDs
    //   if (/^[A-Z]+\d+$/.test(name) || /^[A-Z]+-\d+$/.test(name)) {
    //     return false;
    //   }
      
    //   // Skip long, complex names that are likely full IUPAC names
    //   if (name.length > 50) {
    //     return false;
    //   }
      
    //   // Skip names with unusual characters that might break URLs
    //   if (/[^\w\s\-\(\)]/i.test(name)) {
    //     return false;
    //   }
      
    //   return true;
    // });
    
    // Prioritize shorter, simpler names (more likely to be common names)
    relatedDrugs.sort((a, b) => a.length - b.length);
    
    // Limit to a reasonable number of drug names to prevent overwhelming the API
    const maxDrugs = 10;
    if (relatedDrugs.length > maxDrugs) {
      console.log(`Limiting from ${relatedDrugs.length} to ${maxDrugs} related drugs to prevent API overload`);
      relatedDrugs = relatedDrugs.slice(0, maxDrugs);
    }
    
    console.log(`Found ${relatedDrugs.length} related drugs for ${drugName}: ${relatedDrugs.join(', ')}`);
    
    return relatedDrugs;
  } catch (error) {
    console.error(`Error in main getRelatedDrugs function for ${drugName}:`, error);
    // Return empty array in case of error to continue with at least the original drug
    return [];
  }
}

// RxNorm API functions
async function searchRxNorm(drugName, results) {
  try {
    // Step 1: Get RxCUI for the drug
    const rxcuiResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}&search=1`);
    
    if (rxcuiResponse.data && rxcuiResponse.data.idGroup && rxcuiResponse.data.idGroup.rxnormId) {
      const rxcui = rxcuiResponse.data.idGroup.rxnormId[0];
      
      // Add the standard name to results
      if (rxcuiResponse.data.idGroup.name) {
        results.sources.rxnorm.names.push({
          name: rxcuiResponse.data.idGroup.name,
          type: 'Standard Name'
        });
      }
      
      // Step 2: Get related names
      const relatedResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allrelated.json`);
      
      if (relatedResponse.data && relatedResponse.data.allRelatedGroup && relatedResponse.data.allRelatedGroup.conceptGroup) {
        for (const group of relatedResponse.data.allRelatedGroup.conceptGroup) {
          if (group.conceptProperties) {
            for (const property of group.conceptProperties) {
              results.sources.rxnorm.names.push({
                name: property.name,
                type: group.tty || 'Related Term',
                id: property.rxcui
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error searching RxNorm:', error.message);
    results.sources.rxnorm.names.push({
      name: "Error searching RxNorm database",
      type: "Error"
    });
  }
}

// FDA API function
async function searchFDA(drugName, results) {
  try {
    // Search by generic name
    const fdaGenericResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(drugName)}&limit=5`);
    
    if (fdaGenericResponse.data && fdaGenericResponse.data.results) {
      processFDAResults(fdaGenericResponse.data.results, results);
    }
    
    // Search by brand name
    const fdaBrandResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(drugName)}&limit=5`);
    
    if (fdaBrandResponse.data && fdaBrandResponse.data.results) {
      processFDAResults(fdaBrandResponse.data.results, results);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // No results found is a normal condition
      results.sources.fda.names.push({
        name: "No FDA records found",
        type: "Info"
      });
    } else {
      console.error('Error searching FDA:', error.message);
      results.sources.fda.names.push({
        name: "Error searching FDA database",
        type: "Error"
      });
    }
  }
}

function processFDAResults(fdaResults, results) {
  for (const drug of fdaResults) {
    if (drug.openfda) {
      // Add generic names
      if (drug.openfda.generic_name) {
        for (const name of drug.openfda.generic_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Generic Name'
          });
        }
      }
      
      // Add brand names
      if (drug.openfda.brand_name) {
        for (const name of drug.openfda.brand_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Brand Name'
          });
        }
      }
      
      // Add substance names
      if (drug.openfda.substance_name) {
        for (const name of drug.openfda.substance_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Substance Name'
          });
        }
      }
    }
  }
}

// PubChem API function
async function searchPubChem(drugName, results) {
  try {
    // Step 1: Find the compound ID
    const pubchemResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`);
    
    if (pubchemResponse.data && pubchemResponse.data.IdentifierList && pubchemResponse.data.IdentifierList.CID) {
      const cid = pubchemResponse.data.IdentifierList.CID[0];
      
      // Step 2: Get synonyms
      const synonymsResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
      
      if (synonymsResponse.data && synonymsResponse.data.InformationList && synonymsResponse.data.InformationList.Information) {
        const info = synonymsResponse.data.InformationList.Information[0];
        
        if (info.Synonym) {
          // Filter out long and messy names
          const filteredSynonyms = info.Synonym.filter(syn => 
            syn.length < 100 && !syn.includes('UNII') && !syn.includes('CHEBI') && !syn.includes('DTXSID')
          );
          
          // Take just the first 30 synonyms to avoid overwhelming
          const trimmedSynonyms = filteredSynonyms.slice(0, 30);
          
          for (const synonym of trimmedSynonyms) {
            results.sources.pubchem.names.push({
              name: synonym,
              type: 'Synonym'
            });
          }
        }
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      results.sources.pubchem.names.push({
        name: "No PubChem records found",
        type: "Info"
      });
    } else {
      console.error('Error searching PubChem:', error.message);
      results.sources.pubchem.names.push({
        name: "Error searching PubChem database",
        type: "Error"
      });
    }
  }
}

// ChEMBL functions removed as requested
/**
 * 
 * Endpoint to get details of a specific study by NCT ID
 */
app.get('/api/studies/:nctId', async (req, res) => {
  try {
    const { nctId } = req.params;
    const { fields } = req.query;
    
    console.log(`🔍 Fetching study details for: ${nctId}`);
    
    // Build parameters
    const params = new URLSearchParams();
    params.append('format', 'json');
    
    // Add specific fields if requested
    if (fields) {
      if (Array.isArray(fields)) {
        params.append('fields', fields.join(','));
      } else {
        params.append('fields', fields);
      }
    }
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies/${nctId}`, {
      params: params
    });
    // console.log(response)
    // fs.writeFile(
    //   `xxclinical_trial_${nctId}.json`,
    //   JSON.stringify(response.data, null, 2),
    //   (err) => {  // Callback function is required here
    //     if (err) {
    //       console.error('Error saving file:', err);
    //     } else {
    //       console.log(`Data successfully saved to clinical_trial_${nctId}.json`);
    //     }
    //   }
    // );
    // console.log(`Data successfully saved to clinical_trial_${nctId}.json`);
    // console.log(response.data.protocolSection.designModule.enrollmentInfo.count)
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get data model metadata
 */
app.get('/api/metadata', async (req, res) => {
  try {
    console.log('🔍 Fetching data model metadata');
    
    const params = new URLSearchParams();
    params.append('includeIndexedOnly', true);
    params.append('includeHistoricOnly', false);
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies/metadata`, {
      params: params
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get search areas
 */
app.get('/api/search-areas', async (req, res) => {
  try {
    console.log('🔍 Fetching search areas');
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies/search-areas`);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get enum values
 */
app.get('/api/enums', async (req, res) => {
  try {
    console.log('🔍 Fetching enum values');
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies/enums`);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get field values statistics
 */
app.get('/api/stats/field-values', async (req, res) => {
  try {
    const { types, fields } = req.query;
    console.log('🔍 Fetching field values statistics');
    
    const params = new URLSearchParams();
    
    if (types) {
      if (Array.isArray(types)) {
        params.append('types', types.join(','));
      } else {
        params.append('types', types);
      }
    }
    
    if (fields) {
      if (Array.isArray(fields)) {
        params.append('fields', fields.join(','));
      } else {
        params.append('fields', fields);
      }
    }
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/stats/field/values`, {
      params: params
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get field sizes statistics
 */
app.get('/api/stats/field-sizes', async (req, res) => {
  try {
    const { fields } = req.query;
    console.log('🔍 Fetching field sizes statistics');
    
    const params = new URLSearchParams();
    
    if (fields) {
      if (Array.isArray(fields)) {
        params.append('fields', fields.join(','));
      } else {
        params.append('fields', fields);
      }
    }
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/stats/field/sizes`, {
      params: params
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get study size statistics
 */
app.get('/api/stats/sizes', async (req, res) => {
  try {
    console.log('🔍 Fetching study size statistics');
    
    const response = await axios.get(`${CLINICAL_TRIALS_API_BASE}/stats/size`);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * Endpoint to get success rates and comparison data
 * (This aggregates data from multiple endpoints to calculate success rates)
 */

// Add to server.js after your existing endpoints

/**
 * Endpoint to get drug comparison data
 */
app.get('/api/drugs/compare/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    
    // Get drug's trial data (using existing API)
    const trialsResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
      params: {
        'query.intr': drugName,
        'countTotal': true,
        'pageSize': 100,
        'format': 'json'
      }
    });
    
    // Get treatment effect information
    const treatmentEffect = await TreatmentEffectCalculator.calculateTreatmentEffect(drugName);
    
    // Merge the data together
    const enhancedData = {
      trials: trialsResponse.data,
      treatmentEffect: treatmentEffect
    };
    
    res.json({
      success: true,
      data: enhancedData
    });
  } catch (error) {
    handleApiError(error, res);
  }
});
  /**
   * Endpoint to find similar drugs based on classifications
   */
  app.get('/api/drugs/similar/:drugName', async (req, res) => {
    try {
      const { drugName } = req.params;
      
      // In a real implementation, this would use a drug classification database
      // For now, return a simplified mock response
      
      // Simplified mapping for common drug classes
      const similarDrugsMap = {
        'olanzapine': ['risperidone', 'quetiapine', 'aripiprazole', 'ziprasidone'],
        'risperidone': ['olanzapine', 'quetiapine', 'aripiprazole', 'paliperidone'],
        'fluoxetine': ['sertraline', 'paroxetine', 'citalopram', 'escitalopram'],
        'metformin': ['sitagliptin', 'glipizide', 'glyburide', 'pioglitazone'],
        'atorvastatin': ['rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin']
      };
      
      // Find similar drugs
      let similarDrugs = [];
      
      // Try direct match
      if (similarDrugsMap[drugName.toLowerCase()]) {
        similarDrugs = similarDrugsMap[drugName.toLowerCase()].map(drug => ({ drugName: drug }));
      } else {
        // Try partial match
        for (const [key, drugs] of Object.entries(similarDrugsMap)) {
          if (key.includes(drugName.toLowerCase()) || drugName.toLowerCase().includes(key)) {
            similarDrugs = drugs.map(drug => ({ drugName: drug }));
            break;
          }
        }
      }
      
      // If no match, provide generic fallbacks
      if (similarDrugs.length === 0) {
        similarDrugs = [
          { drugName: 'aspirin' },
          { drugName: 'acetaminophen' },
          { drugName: 'ibuprofen' }
        ];
      }
      
      res.json({
        success: true,
        data: similarDrugs
      });
    } catch (error) {
      handleApiError(error, res);
    }
  });

  
  app.get('/api/analysis/success-rates', async (req, res) => {
    try {
      const { condition, intervention, phase } = req.query;
      
      console.log(`🔍 Analyzing success rates for ${condition || intervention || 'all studies'}`);
      
      // Build a query to get completed studies with results
      const completedParams = new URLSearchParams();
      completedParams.append('filter.overallStatus', 'COMPLETED');
      completedParams.append('countTotal', 'true');
      completedParams.append('pageSize', '1'); // Just need the count
      
      // Add condition or intervention filters if provided
      if (condition) completedParams.append('query.cond', condition);
      if (intervention) completedParams.append('query.intr', intervention);
      if (phase) completedParams.append('filter.advanced', `AREA[Phase]${phase}`);
      
      // Get total completed studies
      const completedResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
        params: completedParams
      });
      
      // Build a query to get studies with results
      const withResultsParams = new URLSearchParams();
      withResultsParams.append('filter.overallStatus', 'COMPLETED');
      withResultsParams.append('filter.advanced', 'AREA[HasResults]true');
      withResultsParams.append('countTotal', 'true');
      withResultsParams.append('pageSize', '1'); // Just need the count
      
      // Add condition or intervention filters if provided
      if (condition) withResultsParams.append('query.cond', condition);
      if (intervention) withResultsParams.append('query.intr', intervention);
      if (phase) withResultsParams.append('filter.advanced', `AREA[Phase]${phase}`);
      
      // Get completed studies with results
      const withResultsResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/studies`, {
        params: withResultsParams
      });
      
      // Calculate success rates and other metrics
      const totalCompletedStudies = completedResponse.data.totalCount || 0;
      const totalWithResults = withResultsResponse.data.totalCount || 0;
      const successRate = totalCompletedStudies > 0 ? (totalWithResults / totalCompletedStudies) * 100 : 0;
      
      // Get treatment effect data if an intervention is specified
      let treatmentEffect = null;
      if (intervention) {
        treatmentEffect = await TreatmentEffectCalculator.calculateTreatmentEffect(intervention);
      }
      
      // Get FDA guidance if condition or intervention is specified
      let guidance = null;
      if (condition || intervention) {
        guidance = await FDAGuidance.searchGuidanceDocuments(condition || intervention);
      }
      
      // Now get enrollment statistics for these studies
      const enrollmentParams = new URLSearchParams();
      enrollmentParams.append('fields', 'EnrollmentCount');
      enrollmentParams.append('types', 'INTEGER');
      
      const enrollmentResponse = await axios.get(`${CLINICAL_TRIALS_API_BASE}/stats/field/values`, {
        params: enrollmentParams
      });
      
      // Format the response
      res.json({
        success: true,
        data: {
          overview: {
            totalCompletedStudies,
            totalWithResults,
            successRate: successRate.toFixed(2),
            filter: {
              condition,
              intervention,
              phase
            }
          },
          enrollmentStats: enrollmentResponse.data,
          treatmentEffect: treatmentEffect,
          guidance: guidance
        }
      });
    } catch (error) {
      handleApiError(error, res);
    }
  });


// REPLACE the existing timeline functions in your clinicaltrials.js with these FIXED versions

// Enhanced drug timeline endpoint - REPLACE existing
// REPLACE the existing timeline route with this PROGRESSIVE LOADING version

// Enhanced drug timeline endpoint with progressive loading
app.get('/api/fda/drug/:drugName/timeline', validateDrugNamenew, async (req, res) => {
  console.log("Fetching comprehensive FDA drug timeline with progressive loading");
  const { drugName } = req.params;

  try {
    // Check if FDA API is available first
    try {
      console.log("Checking FDA API availability...");
      const checkUrl = "https://api.fda.gov/drug/label.json?limit=1";
      await axios.get(checkUrl, { timeout: 10000 });
      console.log("FDA API is available.");
    } catch (apiCheckError) {
      console.error("FDA API appears to be unavailable:", apiCheckError.message);
      return res.status(503).json({
        error: 'FDA API unavailable',
        message: 'The FDA API is currently unavailable. Please try again later.'
      });
    }

    // Set up Server-Sent Events for progressive loading
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial status
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: 'Starting timeline analysis...',
      step: 1,
      totalSteps: 4
    })}\n\n`);

    // Step 1: Get main drug data quickly
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: 'Extracting main drug applications...',
      step: 1,
      totalSteps: 4
    })}\n\n`);

    const mainDrugData = await getMainDrugDataForTimeline(drugName);
    
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: `Found ${mainDrugData.applications.length} applications, extracting compounds...`,
      step: 2,
      totalSteps: 4
    })}\n\n`);

    // Step 2: Get compounds quickly
    const compounds = await extractAllCompoundsForTimelineFixed(drugName, mainDrugData);
    
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: `Found ${compounds.length} compounds, building timelines...`,
      step: 3,
      totalSteps: 4
    })}\n\n`);

    // Send initial structure
    res.write(`data: ${JSON.stringify({
      type: 'initial',
      searchTerm: drugName,
      totalCompounds: compounds.length,
      compounds: compounds
    })}\n\n`);

    // Step 3: Build timelines progressively - send each as it completes
    const completedTimelines = {};
    let completedCount = 0;

    // Process compounds in parallel but send results as they complete
    const timelinePromises = compounds.map(async (compound, index) => {
      try {
        console.log(`Building timeline for compound: ${compound.name}`);
        
        // Send loading status for this compound
        res.write(`data: ${JSON.stringify({
          type: 'compound_loading',
          compoundName: compound.name,
          message: `Building timeline for ${compound.name}...`
        })}\n\n`);

        const timeline = await buildCompoundTimelineDataFixed(compound, mainDrugData);
        
        completedCount++;
        completedTimelines[compound.name] = {
          compound: compound,
          timeline: timeline,
          totalEvents: timeline.length
        };

        // Send completed compound timeline immediately
        res.write(`data: ${JSON.stringify({
          type: 'compound_complete',
          compoundName: compound.name,
          timeline: {
            compound: compound,
            timeline: timeline,
            totalEvents: timeline.length
          },
          progress: {
            completed: completedCount,
            total: compounds.length,
            percentage: Math.round((completedCount / compounds.length) * 100)
          }
        })}\n\n`);

        console.log(`Completed timeline for ${compound.name}: ${timeline.length} events`);
        
      } catch (error) {
        console.error(`Error building timeline for ${compound.name}:`, error);
        
        // Send error for this compound but continue with others
        res.write(`data: ${JSON.stringify({
          type: 'compound_error',
          compoundName: compound.name,
          error: `Failed to build timeline: ${error.message}`
        })}\n\n`);
      }
    });

    // Wait for all timelines to complete
    await Promise.all(timelinePromises);

    // Step 4: Send final summary
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: 'Generating summary...',
      step: 4,
      totalSteps: 4
    })}\n\n`);

    const summary = generateTimelineSummaryDataFixed(completedTimelines);

    // Send final complete data
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      summary: summary,
      timestamp: new Date().toISOString(),
      totalCompounds: compounds.length,
      completedCompounds: Object.keys(completedTimelines).length
    })}\n\n`);

    // Close the connection
    res.end();

  } catch (error) {
    console.error('Error fetching FDA timeline:', error);
    
    // Send error and close
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Error fetching FDA timeline',
      message: error.message
    })}\n\n`);
    
    res.end();
  }
});

// Add a fallback JSON endpoint for clients that don't support SSE
app.get('/api/fda/drug/:drugName/timeline-simple', validateDrugNamenew, async (req, res) => {
  console.log("Fetching FDA drug timeline (simple mode)");
  const { drugName } = req.params;

  try {
    // Check if FDA API is available first
    const checkUrl = "https://api.fda.gov/drug/label.json?limit=1";
    await axios.get(checkUrl, { timeout: 10000 });

    // Get main drug data
    const mainDrugData = await getMainDrugDataForTimeline(drugName);
    const compounds = await extractAllCompoundsForTimelineFixed(drugName, mainDrugData);

    // Build timelines for first 2 compounds only (for speed)
    const timelines = {};
    const maxCompounds = Math.min(compounds.length, 2);
    
    for (let i = 0; i < maxCompounds; i++) {
      const compound = compounds[i];
      console.log(`Building timeline for compound: ${compound.name}`);
      const timeline = await buildCompoundTimelineDataFixed(compound, mainDrugData);
      timelines[compound.name] = {
        compound: compound,
        timeline: timeline,
        totalEvents: timeline.length
      };
    }

    const summary = generateTimelineSummaryDataFixed(timelines);

    res.json({
      searchTerm: drugName,
      totalCompounds: compounds.length,
      compounds: compounds,
      timelines: timelines,
      summary: summary,
      timestamp: new Date().toISOString(),
      note: maxCompounds < compounds.length ? `Showing first ${maxCompounds} compounds for faster loading` : null
    });

  } catch (error) {
    console.error('Error fetching FDA timeline:', error);
    res.status(500).json({ 
      error: 'Error fetching FDA timeline',
      message: error.message 
    });
  }
});

// FIXED: Get main drug data with better extraction
// COMPLETELY REWRITTEN - Using the ACTUAL FDA data structure you showed

// FIXED: Get main drug data using REAL FDA fields
async function getMainDrugDataForTimeline(drugName) {
  console.log(`Getting main drug data for: ${drugName} using REAL FDA structure`);
  const mainData = {
    applications: [],
    approvals: [],
    applicationNumbers: new Set(),
    allCompounds: new Set()
  };

  try {
    // Search drugsFda endpoint for main data
    const searchStrategies = [
      `search=openfda.brand_name:"${drugName}"`,
      `search=openfda.generic_name:"${drugName}"`,
      `search=openfda.substance_name:"${drugName}"`,
      `search=sponsor_name:"${drugName}"`,
      // Broader searches
      `search=openfda.brand_name:*${drugName}*`,
      `search=openfda.generic_name:*${drugName}*`
    ];

    for (const searchQuery of searchStrategies) {
      try {
        const url = `https://api.fda.gov/drug/drugsfda.json?${searchQuery}&limit=100`;
        console.log(`Trying: ${searchQuery}`);
        
        const response = await axios.get(url, { timeout: 15000 });
        
        if (response.data?.results?.length > 0) {
          console.log(`✅ Found ${response.data.results.length} results from drugsFda`);
          
          response.data.results.forEach(result => {
            const appNumber = result.application_number;
            if (appNumber) {
              mainData.applicationNumbers.add(appNumber);
              
              // Extract compound names from openfda
              if (result.openfda) {
                if (result.openfda.brand_name) result.openfda.brand_name.forEach(name => mainData.allCompounds.add(name));
                if (result.openfda.generic_name) result.openfda.generic_name.forEach(name => mainData.allCompounds.add(name));
                if (result.openfda.substance_name) result.openfda.substance_name.forEach(name => mainData.allCompounds.add(name));
              }
              
              // Extract compound names from products
              if (result.products && Array.isArray(result.products)) {
                result.products.forEach(product => {
                  if (product.brand_name) mainData.allCompounds.add(product.brand_name);
                  if (product.active_ingredients) {
                    product.active_ingredients.forEach(ingredient => {
                      if (ingredient.name) mainData.allCompounds.add(ingredient.name);
                    });
                  }
                });
              }
              
              // Extract SUBMISSIONS (not approvals - there are no approval_date fields!)
              if (result.submissions && Array.isArray(result.submissions)) {
                result.submissions.forEach(submission => {
                  // Use submission_status_date as the key date
                  if (submission.submission_status_date) {
                    const submissionEvent = {
                      applicationNumber: appNumber,
                      submissionDate: submission.submission_status_date,
                      submissionType: submission.submission_type,
                      submissionNumber: submission.submission_number,
                      submissionStatus: submission.submission_status,
                      sponsor: result.sponsor_name,
                      submissionClassCode: submission.submission_class_code,
                      submissionClassDescription: submission.submission_class_code_description
                    };
                    
                    // Treat approved original submissions as "approvals"
                    if (submission.submission_type === 'ORIG' && submission.submission_status === 'AP') {
                      mainData.approvals.push({
                        ...submissionEvent,
                        approvalDate: submission.submission_status_date,
                        brandName: result.products?.[0]?.brand_name,
                        genericName: result.products?.[0]?.active_ingredients?.[0]?.name,
                        dosageForm: result.products?.[0]?.dosage_form,
                        route: result.products?.[0]?.route,
                        marketingStatus: result.products?.[0]?.marketing_status
                      });
                    }
                    
                    mainData.applications.push(submissionEvent);
                  }
                });
              }
            }
          });
          
          // If we found results, we can break (unless we want to combine multiple searches)
          if (response.data.results.length > 0) break;
        }
      } catch (error) {
        console.warn(`❌ Error with search "${searchQuery}":`, error.message);
      }
    }

    mainData.applicationNumbers = Array.from(mainData.applicationNumbers);
    mainData.allCompounds = Array.from(mainData.allCompounds);
    
    console.log(`📊 Main data extracted:`);
    console.log(`   - ${mainData.applications.length} submissions`);
    console.log(`   - ${mainData.approvals.length} approvals (ORIG submissions with AP status)`);
    console.log(`   - ${mainData.allCompounds.length} compounds found`);
    console.log(`   - Compounds: ${mainData.allCompounds.join(', ')}`);
    
  } catch (error) {
    console.warn('❌ Error getting main drug data:', error.message);
  }

  return mainData;
}

// FIXED: Enhanced compound extraction with better search
async function extractAllCompoundsForTimelineFixed(drugName, mainDrugData) {
  console.log(`Extracting RELEVANT compounds for: ${drugName}`);
  const compounds = new Map();
  
  // Start with compounds from main drug data (most relevant)
  mainDrugData.allCompounds.forEach(compoundName => {
    if (compoundName && compoundName.trim()) {
      addCompoundFixed(compounds, compoundName, compoundName, null, null, null, null, 'main search');
    }
  });

  // Generate focused search terms (not hundreds of variations)
  const focusedSearchTerms = generateFocusedSearchTerms(drugName);
  console.log(`Using focused search terms: ${focusedSearchTerms.join(', ')}`);

  // Search endpoints with focused terms only
  for (const searchTerm of focusedSearchTerms.slice(0, 5)) { // Limit to 5 search terms max
    await searchEndpointForCompounds(compounds, 'label', searchTerm);
    await searchEndpointForCompounds(compounds, 'ndc', searchTerm);
  }

  // CRITICAL: Filter compounds to only the most relevant ones
  const filteredCompounds = filterRelevantCompounds(compounds, drugName);
  
  console.log(`Filtered to ${filteredCompounds.length} relevant compounds:`, filteredCompounds.map(c => c.name));
  
  return filteredCompounds;
}




// Generate related search terms for better compound discovery
function generateRelatedSearchTerms(drugName) {
  const baseName = drugName.toLowerCase();
  const terms = [baseName];
  
  // Add common variations for ketamine
  if (baseName.includes('ketamine')) {
    terms.push(
      'esketamine',
      's-ketamine',
      'ketalar',
      'spravato',
      'ketamine hydrochloride',
      'ketamine hcl',
      's-ketamine hydrochloride'
    );
  }
  
  // Add generic variations
  terms.push(
    `${baseName} hydrochloride`,
    `${baseName} hcl`,
    `${baseName}*`,
    `*${baseName}*`
  );
  
  return [...new Set(terms)]; // Remove duplicates
}

// REPLACE the generateFocusedSearchTerms function with this UNIVERSAL version

// Generate focused search terms that work for ANY drug
function generateFocusedSearchTerms(drugName) {
  const baseName = drugName.toLowerCase().trim();
  const terms = new Set([baseName]); // Use Set to avoid duplicates
  
  // 1. Add common pharmaceutical variations for ANY drug
  terms.add(`${baseName} hydrochloride`);
  terms.add(`${baseName} hcl`);
  terms.add(`${baseName} sodium`);
  terms.add(`${baseName} sulfate`);
  terms.add(`${baseName} phosphate`);
  
  // 2. Handle multi-word drug names intelligently
  const words = baseName.split(/\s+/);
  if (words.length > 1) {
    // Add each significant word (skip common words)
    const skipWords = ['and', 'or', 'with', 'plus', 'the', 'a', 'an'];
    words.forEach(word => {
      if (word.length > 3 && !skipWords.includes(word)) {
        terms.add(word);
        terms.add(`${word} hydrochloride`);
        terms.add(`${word} hcl`);
      }
    });
    
    // Add first word + common suffixes
    const firstWord = words[0];
    if (firstWord.length > 3) {
      terms.add(`${firstWord} sodium`);
      terms.add(`${firstWord} sulfate`);
    }
  }
  
  // 3. Handle common drug name patterns
  // If it ends with common suffixes, also search without them
  const suffixesToTry = ['hydrochloride', 'hcl', 'sodium', 'sulfate', 'phosphate', 'tartrate', 'citrate', 'acetate'];
  suffixesToTry.forEach(suffix => {
    if (baseName.endsWith(suffix)) {
      const baseDrug = baseName.replace(new RegExp(`\\s*${suffix}$`, 'i'), '').trim();
      if (baseDrug.length > 2) {
        terms.add(baseDrug);
        // Add other salt forms of the same base drug
        suffixesToTry.forEach(otherSuffix => {
          if (otherSuffix !== suffix) {
            terms.add(`${baseDrug} ${otherSuffix}`);
          }
        });
      }
    }
  });
  
  // 4. Handle abbreviations and expansions
  const abbreviationMap = {
    'hcl': 'hydrochloride',
    'hydrochloride': 'hcl',
    'na': 'sodium',
    'sodium': 'na',
    'k': 'potassium',
    'potassium': 'k',
    'ca': 'calcium',
    'calcium': 'ca',
    'mg': 'magnesium',
    'magnesium': 'mg'
  };
  
  Object.entries(abbreviationMap).forEach(([abbrev, full]) => {
    if (baseName.includes(abbrev)) {
      const expanded = baseName.replace(new RegExp(`\\b${abbrev}\\b`, 'gi'), full);
      terms.add(expanded);
    }
  });
  
  // 5. Add wildcard variations for partial matching
  if (baseName.length > 4) {
    terms.add(`${baseName}*`);
    terms.add(`*${baseName}*`);
  }
  
  // 6. Handle special cases dynamically
  // Look for brand name patterns (often capitalized or unique)
  if (/^[A-Z][a-z]+$/.test(drugName)) {
    // Likely a brand name, add generic-sounding variations
    terms.add(`${baseName} tablets`);
    terms.add(`${baseName} injection`);
    terms.add(`${baseName} capsules`);
  }
  
  // 7. Remove very short or very long terms
  const filteredTerms = Array.from(terms).filter(term => 
    term.length >= 3 && 
    term.length <= 50 && 
    term.trim() !== '' &&
    !term.includes('undefined') &&
    !term.includes('null')
  );
  
  // 8. Sort by relevance (exact match first, then shorter terms)
  const sortedTerms = filteredTerms.sort((a, b) => {
    if (a === baseName) return -1;
    if (b === baseName) return 1;
    return a.length - b.length;
  });
  
  // 9. Limit to reasonable number of search terms
  const finalTerms = sortedTerms.slice(0, 8); // Max 8 search terms
  
  console.log(`Generated search terms for "${drugName}":`, finalTerms);
  return finalTerms;
}

// ALSO UPDATE: Enhanced compound filtering that works for any drug
function filterRelevantCompounds(compounds, drugName) {
  const compoundsList = Array.from(compounds.values());
  const drugNameLower = drugName.toLowerCase().trim();
  const drugWords = drugNameLower.split(/\s+/);
  
  // Score compounds by relevance for ANY drug
  const scoredCompounds = compoundsList.map(compound => {
    let score = 0;
    const nameL = compound.name.toLowerCase().trim();
    const nameWords = nameL.split(/\s+/);
    
    // EXACT MATCHES (highest priority)
    if (nameL === drugNameLower) score += 100;
    
    // PARTIAL MATCHES
    if (nameL.includes(drugNameLower)) score += 50;
    if (drugNameLower.includes(nameL)) score += 40;
    
    // WORD-BASED MATCHING (works for any drug)
    drugWords.forEach(drugWord => {
      if (drugWord.length > 2) {
        if (nameWords.includes(drugWord)) score += 30;
        if (nameL.includes(drugWord)) score += 20;
      }
    });
    
    // PHARMACEUTICAL INDICATORS (real drugs)
    if (compound.applicationNumbers.length > 0) score += 25;
    if (compound.manufacturers.length > 0) score += 15;
    if (compound.brandNames.length > 0) score += 10;
    
    // DOSAGE FORM INDICATORS (real drugs)
    const dosageForms = ['tablet', 'capsule', 'injection', 'solution', 'cream', 'ointment', 'drops'];
    if (dosageForms.some(form => nameL.includes(form))) score += 15;
    
    // CONCENTRATION/STRENGTH INDICATORS (real drugs)
    if (/\d+\s*(mg|mcg|g|ml|%)/i.test(compound.name)) score += 10;
    
    // NEGATIVE SCORING (reduce irrelevant compounds)
    
    // Very long compound names (often combinations)
    if (compound.name.length > 60) score -= 20;
    if (compound.name.length > 100) score -= 40;
    
    // Multiple comma-separated ingredients (combinations)
    const commaCount = (compound.name.match(/,/g) || []).length;
    if (commaCount > 2) score -= 15;
    if (commaCount > 5) score -= 30;
    
    // Homeopathic/herbal indicators
    const homeopathicKeywords = [
      'sus scrofa', 'bos taurus', 'whole', 'leaf', 'root', 'seed', 'flower', 'bark', 
      'pollen', 'extract', 'tincture', 'potency', '30x', '100x', 'mother tincture'
    ];
    homeopathicKeywords.forEach(keyword => {
      if (nameL.includes(keyword)) score -= 25;
    });
    
    // Obviously unrelated compounds
    const unrelatedKeywords = [
      'immune system booster', 'weight loss', 'diet', 'supplement', 'vitamin',
      'mineral', 'herbal', 'natural', 'organic'
    ];
    unrelatedKeywords.forEach(keyword => {
      if (nameL.includes(keyword)) score -= 30;
    });
    
    return { compound, score };
  });
  
  // Sort by score and take only the most relevant ones
  const sortedCompounds = scoredCompounds
    .sort((a, b) => b.score - a.score)
    .slice(0, 12) // Increased to 12 for better coverage
    .filter(item => item.score > 5) // Only compounds with reasonable scores
    .map(item => item.compound);
  
  console.log(`Compound scoring results for "${drugName}":`);
  scoredCompounds.slice(0, 20).forEach((item, index) => {
    const status = item.score > 5 ? '✅' : '❌';
    console.log(`  ${status} ${item.compound.name} (score: ${item.score})`);
  });
  
  return sortedCompounds;
}

// ENHANCED: Better compound extraction that works for any drug name pattern
function extractCompoundsFromResultDataFixed(result, compounds, source) {
  // Extract from OpenFDA fields
  if (result.openfda) {
    const openfda = result.openfda;
    
    // Brand names
    if (openfda.brand_name) {
      openfda.brand_name.forEach(brand => {
        if (brand && brand.length > 1) {
          addCompoundFixed(compounds, brand, brand, null, null, 
            openfda.manufacturer_name?.[0], 
            openfda.application_number?.[0],
            null, source
          );
        }
      });
    }
    
    // Generic names
    if (openfda.generic_name) {
      openfda.generic_name.forEach(generic => {
        if (generic && generic.length > 1) {
          addCompoundFixed(compounds, generic, null, generic, null,
            openfda.manufacturer_name?.[0],
            openfda.application_number?.[0],
            null, source
          );
        }
      });
    }
    
    // Substance names
    if (openfda.substance_name) {
      openfda.substance_name.forEach(substance => {
        if (substance && substance.length > 1) {
          addCompoundFixed(compounds, substance, null, null, substance,
            openfda.manufacturer_name?.[0],
            openfda.application_number?.[0],
            null, source
          );
        }
      });
    }
  }

  // Extract from direct fields
  if (result.brand_name && result.brand_name.length > 1) {
    addCompoundFixed(compounds, result.brand_name, result.brand_name, result.generic_name, result.substance_name,
      result.labeler_name || result.manufacturer_name,
      result.application_number,
      result.sponsor_name, source
    );
  }

  if (result.generic_name && result.generic_name.length > 1 && result.generic_name !== result.brand_name) {
    addCompoundFixed(compounds, result.generic_name, result.brand_name, result.generic_name, result.substance_name,
      result.labeler_name || result.manufacturer_name,
      result.application_number,
      result.sponsor_name, source
    );
  }

  // Extract from products array (drugsFda endpoint)
  if (result.products && Array.isArray(result.products)) {
    result.products.forEach(product => {
      if (product.brand_name && product.brand_name.length > 1) {
        addCompoundFixed(compounds, product.brand_name, product.brand_name, product.generic_name, null,
          result.sponsor_name,
          result.application_number,
          result.sponsor_name, source
        );
      }
      
      // Also extract active ingredients
      if (product.active_ingredients && Array.isArray(product.active_ingredients)) {
        product.active_ingredients.forEach(ingredient => {
          if (ingredient.name && ingredient.name.length > 2) {
            addCompoundFixed(compounds, ingredient.name, product.brand_name, ingredient.name, ingredient.name,
              result.sponsor_name,
              result.application_number,
              result.sponsor_name, source
            );
          }
        });
      }
    });
  }
}

// UPDATED: Add compound function with source tracking
function addCompoundFixed(compounds, name, brand, generic, substance, manufacturer, applicationNumber, sponsor, source) {
  if (!name || name.toLowerCase() === 'unknown' || name.length < 2) return;
  
  const key = name.toLowerCase().trim();
  if (!compounds.has(key)) {
    compounds.set(key, {
      name: name,
      brandNames: [],
      genericNames: [],
      substanceNames: [],
      manufacturers: [],
      applicationNumbers: [],
      sponsors: [],
      sources: []
    });
  }
  
  const compound = compounds.get(key);
  if (brand && !compound.brandNames.includes(brand)) compound.brandNames.push(brand);
  if (generic && !compound.genericNames.includes(generic)) compound.genericNames.push(generic);
  if (substance && !compound.substanceNames.includes(substance)) compound.substanceNames.push(substance);
  if (manufacturer && !compound.manufacturers.includes(manufacturer)) compound.manufacturers.push(manufacturer);
  if (applicationNumber && !compound.applicationNumbers.includes(applicationNumber)) compound.applicationNumbers.push(applicationNumber);
  if (sponsor && !compound.sponsors.includes(sponsor)) compound.sponsors.push(sponsor);
  if (source && !compound.sources.includes(source)) compound.sources.push(source);
}



// OPTIMIZED: Faster compound search with timeouts
async function searchEndpointForCompounds(compounds, endpointName, searchTerm) {
  try {
    let searchQuery;
    let baseUrl;
    
    switch (endpointName) {
      case 'label':
        baseUrl = "https://api.fda.gov/drug/label.json";
        searchQuery = `search=openfda.brand_name:"${searchTerm}"+OR+openfda.generic_name:"${searchTerm}"`;
        break;
      case 'ndc':
        baseUrl = "https://api.fda.gov/drug/ndc.json";
        searchQuery = `search=brand_name:"${searchTerm}"+OR+generic_name:"${searchTerm}"`;
        break;
      default:
        return;
    }

    const url = `${baseUrl}?${searchQuery}&limit=20`; // Reduced limit
    const response = await axios.get(url, { timeout: 5000 }); // Reduced timeout
    
    if (response.data?.results?.length > 0) {
      console.log(`Found ${response.data.results.length} results from ${endpointName} for "${searchTerm}"`);
      
      // Only process first 10 results to avoid overload
      response.data.results.slice(0, 10).forEach(result => {
        extractCompoundsFromResultDataFixed(result, compounds, endpointName);
      });
    }
  } catch (error) {
    // Don't log every timeout/404 as an error since we're doing focused searches
    if (!error.message.includes('404') && !error.message.includes('timeout')) {
      console.warn(`Error searching ${endpointName} for "${searchTerm}":`, error.message);
    }
  }
}

// FIXED: Enhanced date parsing function
function parseAndValidateDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Handle different date formats
    let parsedDate;
    
    if (typeof dateString === 'string') {
      // Handle YYYYMMDD format (common in FDA data)
      if (/^\d{8}$/.test(dateString)) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        parsedDate = new Date(`${year}-${month}-${day}`);
      } 
      // Handle YYYY-MM-DD format
      else if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        parsedDate = new Date(dateString);
      }
      // Handle other formats
      else {
        parsedDate = new Date(dateString);
      }
    } else {
      parsedDate = new Date(dateString);
    }
    
    // Validate the date
    if (isNaN(parsedDate.getTime())) {
      console.warn(`Invalid date: ${dateString}`);
      return null;
    }
    
    // Check if date is reasonable (after 1950, before 2030)
    const year = parsedDate.getFullYear();
    if (year < 1950 || year > 2030) {
      console.warn(`Date out of reasonable range: ${dateString} -> ${year}`);
      return null;
    }
    
    return parsedDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    
  } catch (error) {
    console.warn(`Error parsing date "${dateString}":`, error.message);
    return null;
  }
}


// FIXED: Build timeline with better date handling and more comprehensive data
// QUICK FIX - Replace the buildCompoundTimelineDataFixed function with this corrected version

// FIXED: Build timeline using the REAL data structure (CORRECTED VARIABLE NAMES)
async function buildCompoundTimelineDataFixed(compound, mainDrugData) {
  console.log(`🔨 Building timeline for: ${compound.name}`);
  const timeline = [];
  
  // 1. Add APPROVALS (ORIG submissions with AP status)
  mainDrugData.approvals.forEach(approval => {
    const isMatch = approval.brandName === compound.name || 
                   approval.genericName === compound.name ||
                   compound.applicationNumbers.includes(approval.applicationNumber);
    
    if (isMatch && approval.approvalDate) {
      const parsedDate = parseAndValidateDateFixed(approval.approvalDate);
      if (parsedDate) {
        timeline.push({
          date: parsedDate,
          type: 'approval',
          category: 'Drug Approval',
          title: `${approval.brandName || compound.name} FDA Approval`,
          description: `Original application approved for ${approval.brandName || compound.name}`,
          details: {
            applicationNumber: approval.applicationNumber,
            sponsor: approval.sponsor,
            dosageForm: approval.dosageForm,
            route: approval.route,
            marketingStatus: approval.marketingStatus,
            submissionNumber: approval.submissionNumber,
            originalDate: approval.approvalDate
          },
          source: 'drugsFda',
          importance: 'critical'
        });
      }
    }
  });

  // 2. Add SUBMISSIONS (all submissions including supplements) - FIXED VARIABLE NAME
  mainDrugData.applications.forEach(submission => {
    const isMatch = compound.applicationNumbers.includes(submission.applicationNumber);
    
    if (isMatch && submission.submissionDate && submission.submissionType !== 'ORIG') {
      // Skip ORIG since we already added as approval
      const parsedDate = parseAndValidateDateFixed(submission.submissionDate);
      if (parsedDate) {
        timeline.push({
          date: parsedDate,
          type: 'submission',
          category: 'Regulatory Submission',
          title: `${submission.submissionType} Submission`,
          description: `${submission.submissionClassDescription || submission.submissionType} submission`,
          details: {
            submissionType: submission.submissionType,
            submissionNumber: submission.submissionNumber,
            applicationNumber: submission.applicationNumber,
            sponsor: submission.sponsor,
            submissionStatus: submission.submissionStatus,
            submissionClassCode: submission.submissionClassCode,
            submissionClassDescription: submission.submissionClassDescription,
            originalDate: submission.submissionDate
          },
          source: 'drugsFda',
          importance: submission.submissionStatus === 'AP' ? 'high' : 'medium'
        });
      }
    }
  });

  // 3. Get enforcement data using REAL structure
  await getEnforcementDataForTimelineFixed(compound, timeline);
  
  // 4. Get adverse events (grouped by year)
  await getAdverseEventsDataForTimelineFixed(compound, timeline);

  // Remove duplicates and sort
  const uniqueTimeline = removeDuplicateEvents(timeline);
  uniqueTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(`✅ Timeline for ${compound.name}: ${uniqueTimeline.length} events`);
  return uniqueTimeline;
}


// FIXED: Enhanced date parsing for FDA format (YYYYMMDD)
function parseAndValidateDateFixed(dateString) {
  if (!dateString) return null;
  
  try {
    let parsedDate;
    
    if (typeof dateString === 'string') {
      // Handle YYYYMMDD format (most common in FDA data)
      if (/^\d{8}$/.test(dateString)) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));
        console.log(`📅 Parsed FDA date ${dateString} -> ${parsedDate.toISOString().split('T')[0]}`);
      } 
      // Handle YYYY-MM-DD format
      else if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        parsedDate = new Date(dateString);
      }
      // Handle other formats
      else {
        parsedDate = new Date(dateString);
      }
    } else {
      parsedDate = new Date(dateString);
    }
    
    // Validate the date
    if (isNaN(parsedDate.getTime())) {
      console.warn(`❌ Invalid date: ${dateString}`);
      return null;
    }
    
    // Check if date is reasonable (after 1970, before 2030)
    const year = parsedDate.getFullYear();
    if (year < 1970 || year > 2030) {
      console.warn(`❌ Date out of range: ${dateString} -> ${year}`);
      return null;
    }
    
    return parsedDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    
  } catch (error) {
    console.warn(`❌ Error parsing date "${dateString}":`, error.message);
    return null;
  }
}
async function getEnforcementDataForTimelineFixed(compound, timeline) {
  try {
    // Only search for the main compound name, not all variations
    const searchTerms = [compound.name].slice(0, 1); // Just one search

    for (const term of searchTerms) {
      try {
        const searchQuery = `search=product_description:"${term}"`;
        const url = `https://api.fda.gov/drug/enforcement.json?${searchQuery}&limit=10`; // Reduced limit
        
        const response = await axios.get(url, { timeout: 5000 }); // Much shorter timeout
        
        if (response.data?.results?.length > 0) {
          console.log(`📋 Found ${response.data.results.length} enforcement records for ${term}`);
          
          response.data.results.slice(0, 5).forEach(item => { // Only process first 5
            const recallDate = item.recall_initiation_date || item.report_date;
            
            if (recallDate) {
              const parsedDate = parseAndValidateDateFixed(recallDate);
              if (parsedDate) {
                timeline.push({
                  date: parsedDate,
                  type: 'recall',
                  category: 'Recall/Enforcement',
                  title: `Product Recall - ${item.classification || 'Classification Unknown'}`,
                  description: `${item.reason_for_recall || 'Recall reason not specified'}`,
                  details: {
                    recallNumber: item.recall_number,
                    reasonForRecall: item.reason_for_recall,
                    productDescription: item.product_description,
                    recallingFirm: item.recalling_firm,
                    classification: item.classification,
                    status: item.status,
                    originalRecallDate: recallDate
                  },
                  source: 'enforcement',
                  importance: getRecallImportanceFixed(item.classification)
                });
              }
            }
          });
          break; // Stop after first successful search
        }
      } catch (error) {
        // Don't log timeout errors since we're using aggressive timeouts
        if (!error.message.includes('timeout') && !error.message.includes('404')) {
          console.warn(`❌ Error getting enforcement for ${term}:`, error.message);
        }
      }
    }
  } catch (error) {
    // Silent fail for enforcement to prevent blocking
  }
}



// Helper function for recall importance
function getRecallImportanceFixed(classification) {
  if (!classification) return 'medium';
  
  const classStr = classification.toLowerCase();
  if (classStr.includes('class i')) return 'critical';
  if (classStr.includes('class ii')) return 'high';
  if (classStr.includes('class iii')) return 'medium';
  return 'medium';
}

// FIXED: Adverse events with proper grouping
async function getAdverseEventsDataForTimelineFixed(compound, timeline) {
  try {
    // Only search main compound name
    const term = compound.name;
    
    try {
      const searchQuery = `search=patient.drug.medicinalproduct:"${term}"`;
      const url = `https://api.fda.gov/drug/event.json?${searchQuery}&limit=50`; // Reduced limit
      
      const response = await axios.get(url, { timeout: 8000 }); // Shorter timeout
      
      if (response.data?.results?.length > 0) {
        console.log(`⚠️ Found ${response.data.results.length} adverse events for ${term}`);
        
        // Quick grouping by year
        const eventsByYear = {};
        
        response.data.results.slice(0, 30).forEach(event => { // Only process first 30
          if (event.receiptdate) {
            const parsedDate = parseAndValidateDateFixed(event.receiptdate);
            if (parsedDate) {
              const year = new Date(parsedDate).getFullYear();
              
              if (!eventsByYear[year]) {
                eventsByYear[year] = { totalCount: 0, seriousCount: 0, deathCount: 0 };
              }
              
              eventsByYear[year].totalCount++;
              if (event.serious) eventsByYear[year].seriousCount++;
              if (event.seriousnessdeaths) eventsByYear[year].deathCount++;
            }
          }
        });

        // Only add the most significant years
        Object.entries(eventsByYear).forEach(([year, data]) => {
          if (data.seriousCount > 0 && parseInt(year) >= 2015) { // Only recent significant events
            timeline.push({
              date: `${year}-06-30`,
              type: 'adverse_event',
              category: 'Adverse Events',
              title: `${data.totalCount} Adverse Event Reports (${year})`,
              description: `${data.seriousCount} serious events${data.deathCount > 0 ? `, ${data.deathCount} deaths` : ''} reported`,
              details: {
                year: year,
                totalReports: data.totalCount,
                seriousReports: data.seriousCount,
                deathReports: data.deathCount
              },
              source: 'event',
              importance: data.deathCount > 0 ? 'critical' : (data.seriousCount > 5 ? 'high' : 'medium')
            });
          }
        });
      }
    } catch (error) {
      // Silent fail for adverse events to prevent blocking
      if (!error.message.includes('timeout') && !error.message.includes('aborted')) {
        console.warn(`❌ Error getting adverse events for ${term}:`, error.message);
      }
    }
  } catch (error) {
    // Silent fail
  }
}
// FIXED: Enhanced label changes with better filtering
async function getLabelChangesDataForTimelineFixed(compound, timeline) {
  try {
    // Search by application number first (most accurate)
    for (const appNumber of compound.applicationNumbers.slice(0, 2)) {
      try {
        const searchQuery = `search=openfda.application_number:"${appNumber}"`;
        const url = `https://api.fda.gov/drug/label.json?${searchQuery}&limit=20`;
        
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data?.results?.length > 0) {
          console.log(`Found ${response.data.results.length} labels for app ${appNumber}`);
          
          // Only process recent or significant label changes
          const significantLabels = response.data.results.filter(label => {
            const hasSignificantContent = label.boxed_warning || 
                                        label.warnings || 
                                        label.contraindications ||
                                        (label.effective_time && 
                                         new Date(parseAndValidateDate(label.effective_time) || 0) > new Date('2015-01-01'));
            return hasSignificantContent;
          });

          significantLabels.slice(0, 3).forEach(label => {
            if (label.effective_time) {
              const parsedDate = parseAndValidateDate(label.effective_time);
              if (parsedDate) {
                const hasBoxedWarning = !!label.boxed_warning;
                const hasWarnings = !!label.warnings;
                
                timeline.push({
                  date: parsedDate,
                  type: 'label_change',
                  category: 'Label Update',
                  title: hasBoxedWarning ? 'Critical Label Update - Boxed Warning' : 'Significant Label Update',
                  description: `Important safety labeling ${hasBoxedWarning ? 'with boxed warning' : 'revision'}`,
                  details: {
                    hasBoxedWarning: hasBoxedWarning,
                    hasWarnings: hasWarnings,
                    hasContraindications: !!label.contraindications,
                    manufacturer: label.openfda?.manufacturer_name?.[0],
                    applicationNumber: appNumber,
                    originalEffectiveTime: label.effective_time
                  },
                  source: 'label',
                  importance: hasBoxedWarning ? 'critical' : 'medium'
                });
              }
            }
          });
          break; // Stop after first successful search
        }
      } catch (error) {
        if (!error.message.includes('404')) {
          console.warn(`Error getting labels for app ${appNumber}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn('Error in label changes extraction:', error.message);
  }
}

// Get enforcement data using smart search
async function getEnforcementDataForTimeline(compound, applicationNumbers, timeline) {
  try {
    // Search by product description (most likely to work)
    const searchTerms = [compound.name, ...compound.brandNames, ...compound.genericNames].filter(term => term);
    
    for (const term of searchTerms.slice(0, 2)) { // Limit to avoid too many requests
      try {
        const searchQuery = `search=product_description:"${term}"`;
        const url = `https://api.fda.gov/drug/enforcement.json?${searchQuery}&limit=20`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data?.results?.length > 0) {
          response.data.results.forEach(item => {
            if (item.recall_initiation_date) {
              timeline.push({
                date: item.recall_initiation_date,
                type: 'recall',
                category: 'Recall/Enforcement',
                title: `Product Recall Initiated`,
                description: `Recall of ${compound.name} - ${item.reason_for_recall}`,
                details: {
                  recallNumber: item.recall_number,
                  reasonForRecall: item.reason_for_recall,
                  productDescription: item.product_description,
                  recallingFirm: item.recalling_firm,
                  classification: item.classification,
                  status: item.status
                },
                source: 'enforcement',
                importance: 'high'
              });
            }
          });
          break; // Stop after first successful search
        }
      } catch (error) {
        // Enforcement endpoint often returns 404, which is normal
        console.log(`No enforcement data found for ${term}`);
      }
    }
  } catch (error) {
    console.warn('Error getting enforcement data:', error.message);
  }
}

// Get adverse events data (grouped to reduce clutter)
async function getAdverseEventsDataForTimeline(compound, timeline) {
  try {
    const searchTerms = [compound.name].slice(0, 1); // Just use main name
    
    for (const term of searchTerms) {
      try {
        const searchQuery = `search=patient.drug.medicinalproduct:"${term}"`;
        const url = `https://api.fda.gov/drug/event.json?${searchQuery}&limit=100`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data?.results?.length > 0) {
          // Group events by year to reduce clutter
          const eventsByYear = {};
          response.data.results.forEach(item => {
            if (item.receiptdate) {
              const year = item.receiptdate.substring(0, 4);
              if (!eventsByYear[year]) {
                eventsByYear[year] = { events: [], seriousCount: 0, totalCount: 0 };
              }
              eventsByYear[year].events.push(item);
              eventsByYear[year].totalCount++;
              if (item.serious) eventsByYear[year].seriousCount++;
            }
          });

          // Only add significant years (years with serious events or high counts)
          Object.entries(eventsByYear).forEach(([year, yearData]) => {
            if (yearData.seriousCount > 0 || yearData.totalCount > 10) {
              const reactions = yearData.events
                .flatMap(event => event.patient?.reaction || [])
                .map(reaction => reaction.reactionmeddrapt)
                .filter(Boolean)
                .slice(0, 5); // Top 5 reactions

              timeline.push({
                date: `${year}-01-01`,
                type: 'adverse_event',
                category: 'Adverse Events',
                title: `${yearData.totalCount} Adverse Event Report(s) in ${year}`,
                description: `${yearData.seriousCount} serious events reported for ${compound.name}`,
                details: {
                  year: year,
                  totalReports: yearData.totalCount,
                  seriousReports: yearData.seriousCount,
                  topReactions: reactions
                },
                source: 'event',
                importance: yearData.seriousCount > 5 ? 'high' : 'medium'
              });
            }
          });
          break; // Stop after first successful search
        }
      } catch (error) {
        console.log(`No adverse events found for ${term}`);
      }
    }
  } catch (error) {
    console.warn('Error getting adverse events data:', error.message);
  }
}

// Get label changes data (only significant ones)
async function getLabelChangesDataForTimeline(compound, applicationNumbers, timeline) {
  try {
    // Search by application number first (most accurate)
    for (const appNumber of applicationNumbers.slice(0, 2)) {
      try {
        const searchQuery = `search=openfda.application_number:"${appNumber}"`;
        const url = `https://api.fda.gov/drug/label.json?${searchQuery}&limit=10`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data?.results?.length > 0) {
          // Only add recent label changes or those with significant content
          response.data.results.slice(0, 3).forEach((item, index) => {
            if (item.effective_time && index < 3) { // Limit to 3 most recent
              const hasSignificantContent = item.boxed_warning || item.warnings || 
                                          (item.effective_time && new Date(item.effective_time) > new Date('2020-01-01'));
              
              if (hasSignificantContent) {
                timeline.push({
                  date: item.effective_time,
                  type: 'label_change',
                  category: 'Label Update',
                  title: 'Significant Label Update',
                  description: `Important label revision for ${compound.name}`,
                  details: {
                    hasBoxedWarning: !!item.boxed_warning,
                    hasWarnings: !!item.warnings,
                    manufacturer: item.openfda?.manufacturer_name?.[0],
                    applicationNumber: appNumber
                  },
                  source: 'label',
                  importance: item.boxed_warning ? 'high' : 'medium'
                });
              }
            }
          });
          break; // Stop after first successful search
        }
      } catch (error) {
        console.log(`No label data found for application ${appNumber}`);
      }
    }
  } catch (error) {
    console.warn('Error getting label changes data:', error.message);
  }
}

// Remove duplicate events
function removeDuplicateEvents(timeline) {
  const seen = new Set();
  return timeline.filter(event => {
    const key = `${event.date}-${event.type}-${event.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// FIXED: Helper function to generate timeline summary
function generateTimelineSummaryDataFixed(timelines) {
  const summary = {
    totalEvents: 0,
    totalApprovals: 0,
    totalRecalls: 0,
    totalLabelChanges: 0,
    totalAdverseEvents: 0,
    totalSubmissions: 0,
    oldestEvent: null,
    newestEvent: null,
    compoundsSummary: {}
  };

  let allDates = [];

  Object.entries(timelines).forEach(([compoundName, data]) => {
    const timeline = data.timeline;
    summary.totalEvents += timeline.length;
    
    const compoundSummary = {
      totalEvents: timeline.length,
      approvals: timeline.filter(e => e.type === 'approval').length,
      submissions: timeline.filter(e => e.type === 'submission').length,
      recalls: timeline.filter(e => e.type === 'recall').length,
      labelChanges: timeline.filter(e => e.type === 'label_change').length,
      adverseEvents: timeline.filter(e => e.type === 'adverse_event').length,
      firstEvent: timeline[0]?.date || null,
      lastEvent: timeline[timeline.length - 1]?.date || null
    };

    summary.totalApprovals += compoundSummary.approvals;
    summary.totalSubmissions += compoundSummary.submissions;
    summary.totalRecalls += compoundSummary.recalls;
    summary.totalLabelChanges += compoundSummary.labelChanges;
    summary.totalAdverseEvents += compoundSummary.adverseEvents;
    
    summary.compoundsSummary[compoundName] = compoundSummary;
    
    // Collect all dates
    timeline.forEach(event => {
      if (event.date && event.date !== 'Invalid Date') {
        allDates.push(event.date);
      }
    });
  });

  // Find oldest and newest events
  if (allDates.length > 0) {
    allDates.sort();
    summary.oldestEvent = allDates[0];
    summary.newestEvent = allDates[allDates.length - 1];
  }

  return summary;
}

  
// Catch-all route to serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Logs are being saved to ${logDirectory}`);
  console.log(`📄 API Documentation:`);
  console.log(`   - GET /api/studies/search - Search studies with various parameters`);
  console.log(`   - GET /api/studies/:nctId - Get specific study details`);
  console.log(`   - GET /api/metadata - Get data model metadata`);
  console.log(`   - GET /api/search-areas - Get search areas`);
  console.log(`   - GET /api/enums - Get enum values`);
  console.log(`   - GET /api/stats/field-values - Get field values statistics`);
  console.log(`   - GET /api/stats/field-sizes - Get field sizes statistics`);
  console.log(`   - GET /api/stats/sizes - Get study size statistics`);
  console.log(`   - GET /api/analysis/success-rates - Get success rates and comparison data`);
  loadOrangeBookData()

  initializeUsersFile((err) => {
      if (err) {
          console.error('Failed to initialize users file:', err);
          return;
      }
  });
  // searchDrugsForConditionfromdrug("hypertension")
  // getRelatedDrugs('Liafensine')
});

// Export for testing
module.exports = app;