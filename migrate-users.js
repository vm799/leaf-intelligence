// migrate-users.js - Run this script to update existing users with new Stripe fields
require('dotenv').config();
const { connectDB, User, migrateExistingUsers } = require('./db');

async function runMigration() {
  console.log('🚀 Starting user migration for Stripe integration...\n');
  
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Get current user count
    const totalUsers = await User.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}\n`);
    
    // Check which users need migration
    const usersNeedingMigration = await User.countDocuments({
      $or: [
        { stripeCustomerId: { $exists: false } },
        { subscriptionTier: { $exists: false } },
        { searchCredits: { $exists: false } },
        { featureAccess: { $exists: false } }
      ]
    });
    
    console.log(`👥 Users needing migration: ${usersNeedingMigration}\n`);
    
    if (usersNeedingMigration === 0) {
      console.log('✅ All users already have the required fields!');
      process.exit(0);
    }
    
    // Show a sample of what will be updated
    const sampleUser = await User.findOne({
      $or: [
        { stripeCustomerId: { $exists: false } },
        { subscriptionTier: { $exists: false } }
      ]
    });
    
    if (sampleUser) {
      console.log('📋 Sample user before migration:');
      console.log(`   Username: ${sampleUser.username}`);
      console.log(`   Email: ${sampleUser.email}`);
      console.log(`   Has Stripe fields: ${!!sampleUser.stripeCustomerId}`);
      console.log(`   Subscription tier: ${sampleUser.subscriptionTier || 'undefined'}`);
      console.log(`   Search credits: ${sampleUser.searchCredits || 'undefined'}\n`);
    }
    
    // Run the migration
    console.log('🔄 Running migration...\n');
    await migrateExistingUsers();
    
    // Verify migration worked
    const updatedUser = await User.findById(sampleUser._id);
    console.log('\n📋 Sample user after migration:');
    console.log(`   Username: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Stripe Customer ID: ${updatedUser.stripeCustomerId || 'null'}`);
    console.log(`   Subscription tier: ${updatedUser.subscriptionTier}`);
    console.log(`   Search credits: ${updatedUser.searchCredits}`);
    console.log(`   Feature access: ${!!updatedUser.featureAccess}`);
    console.log(`   Billing history: ${updatedUser.billingHistory.length} entries`);
    
    // Final verification
    const remainingUsers = await User.countDocuments({
      $or: [
        { stripeCustomerId: { $exists: false } },
        { subscriptionTier: { $exists: false } },
        { searchCredits: { $exists: false } },
        { featureAccess: { $exists: false } }
      ]
    });
    
    console.log(`\n📊 Users still needing migration: ${remainingUsers}`);
    
    if (remainingUsers === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ All users now have Stripe integration fields');
      console.log('✅ All users set to free tier with default feature access');
      console.log('✅ Ready for post-checkout verification system');
    } else {
      console.log('\n⚠️  Some users may still need manual intervention');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Additional helper functions
async function checkSpecificUser(email) {
  try {
    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }
    
    console.log(`\n👤 User Details: ${user.username} (${user.email})`);
    console.log(`   Stripe Customer ID: ${user.stripeCustomerId || 'null'}`);
    console.log(`   Subscription ID: ${user.stripeSubscriptionId || 'null'}`);
    console.log(`   Subscription Tier: ${user.subscriptionTier || 'undefined'}`);
    console.log(`   Subscription Status: ${user.subscriptionStatus || 'undefined'}`);
    console.log(`   Search Credits: ${user.searchCredits || 0}`);
    console.log(`   Feature Access: ${user.featureAccess ? 'Present' : 'Missing'}`);
    console.log(`   Billing History: ${user.billingHistory ? user.billingHistory.length : 0} entries`);
    console.log(`   Purchased Searches: ${user.purchasedSearches ? user.purchasedSearches.length : 0} entries`);
    
    if (user.featureAccess) {
      console.log('\n🎛️  Feature Access Details:');
      console.log(`   Clinical Trials - Top Conditions: ${user.featureAccess.clinicalTrials?.topConditions}`);
      console.log(`   FDA Data - View All NDAs: ${user.featureAccess.fdaData?.viewAllNDAs}`);
      console.log(`   Response Letters: ${user.featureAccess.responseLetters}`);
      console.log(`   Warning Letters: ${user.featureAccess.warningLetters}`);
    }
    
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

async function resetUser(email) {
  try {
    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }
    
    console.log(`🔄 Resetting user: ${user.username} (${user.email})`);
    
    // Reset to free tier
    user.stripeCustomerId = null;
    user.stripeSubscriptionId = null;
    user.stripePaymentMethodId = null;
    user.subscriptionTier = 'free';
    user.subscriptionStatus = 'free';
    user.searchCredits = 0;
    user.purchasedSearches = [];
    user.billingHistory = [];
    user.subscriptionStartDate = null;
    user.subscriptionEndDate = null;
    user.trialEndDate = null;
    user.lastSubscriptionCheck = null;
    
    // Set default feature access
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
    console.log(`✅ User reset to free tier successfully`);
    
  } catch (error) {
    console.error('Error resetting user:', error);
  }
}

// Command line interface
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'migrate':
    runMigration();
    break;
  case 'check':
    if (!arg) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node migrate-users.js check user@example.com');
      process.exit(1);
    }
    checkSpecificUser(arg).then(() => process.exit(0));
    break;
  case 'reset':
    if (!arg) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node migrate-users.js reset user@example.com');
      process.exit(1);
    }
    resetUser(arg).then(() => process.exit(0));
    break;
  default:
    console.log('📋 Available commands:');
    console.log('  migrate              - Migrate all users with new Stripe fields');
    console.log('  check <email>        - Check specific user\'s Stripe fields');
    console.log('  reset <email>        - Reset user to free tier');
    console.log('');
    console.log('Examples:');
    console.log('  node migrate-users.js migrate');
    console.log('  node migrate-users.js check user@example.com');
    console.log('  node migrate-users.js reset user@example.com');
    process.exit(0);
}