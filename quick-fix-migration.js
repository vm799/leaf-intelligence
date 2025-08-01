// quick-fix-migration.js - Fix the subscriptionStatus enum error
require('dotenv').config();
const { connectDB, User } = require('./db');

async function fixSubscriptionStatusEnum() {
  console.log('🔧 Fixing subscriptionStatus enum values...\n');
  
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Find users with invalid subscriptionStatus values
    const usersWithInvalidStatus = await User.find({
      subscriptionStatus: { 
        $nin: ['free', 'trialing', 'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid']
      }
    });
    
    console.log(`👥 Found ${usersWithInvalidStatus.length} users with invalid subscriptionStatus\n`);
    
    if (usersWithInvalidStatus.length === 0) {
      console.log('✅ All users have valid subscriptionStatus values!');
      process.exit(0);
    }
    
    // Show what we'll fix
    console.log('📋 Users to fix:');
    usersWithInvalidStatus.forEach(user => {
      console.log(`   ${user.username} (${user.email}): "${user.subscriptionStatus}" → "free"`);
    });
    
    console.log('\n🔄 Updating invalid subscriptionStatus values...\n');
    
    // Fix each user individually to handle any other issues
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithInvalidStatus) {
      try {
        // Map old values to new values
        let newStatus = 'free';
        
        switch (user.subscriptionStatus) {
          case 'free-trial':
            newStatus = 'trialing';
            break;
          case 'trial':
            newStatus = 'trialing';
            break;
          case 'active-subscription':
            newStatus = 'active';
            break;
          case 'cancelled':
            newStatus = 'canceled';
            break;
          case 'expired':
            newStatus = 'canceled';
            break;
          default:
            newStatus = 'free';
        }
        
        // Update the user
        user.subscriptionStatus = newStatus;
        
        // Also ensure subscriptionTier is valid
        if (!['free', 'single-search', 'monthly', 'team'].includes(user.subscriptionTier)) {
          user.subscriptionTier = 'free';
        }
        
        // Ensure all required fields exist
        if (!user.stripeCustomerId) user.stripeCustomerId = null;
        if (!user.stripeSubscriptionId) user.stripeSubscriptionId = null;
        if (!user.searchCredits) user.searchCredits = 0;
        if (!user.purchasedSearches) user.purchasedSearches = [];
        if (!user.billingHistory) user.billingHistory = [];
        
        // Set default feature access if missing
        if (!user.featureAccess) {
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
        }
        
        await user.save();
        console.log(`✅ Fixed ${user.username}: "${user.subscriptionStatus}" is now "${newStatus}"`);
        fixedCount++;
        
      } catch (error) {
        console.log(`❌ Error fixing ${user.username}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully fixed: ${fixedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    
    // Verify the fix worked
    const remainingInvalid = await User.countDocuments({
      subscriptionStatus: { 
        $nin: ['free', 'trialing', 'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid']
      }
    });
    
    if (remainingInvalid === 0) {
      console.log('\n🎉 All subscription status values are now valid!');
      console.log('✅ Your Stripe checkout should work now');
    } else {
      console.log(`\n⚠️  Still ${remainingInvalid} users with invalid status - may need manual intervention`);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Also fix any other enum issues
async function fixAllEnumIssues() {
  console.log('🔧 Comprehensive enum fix...\n');
  
  try {
    await connectDB();
    
    // Fix subscriptionStatus
    await User.updateMany(
      { subscriptionStatus: 'free-trial' },
      { $set: { subscriptionStatus: 'trialing' } }
    );
    
    await User.updateMany(
      { subscriptionStatus: 'trial' },
      { $set: { subscriptionStatus: 'trialing' } }
    );
    
    await User.updateMany(
      { subscriptionStatus: 'active-subscription' },
      { $set: { subscriptionStatus: 'active' } }
    );
    
    await User.updateMany(
      { subscriptionStatus: 'cancelled' },
      { $set: { subscriptionStatus: 'canceled' } }
    );
    
    await User.updateMany(
      { subscriptionStatus: 'expired' },
      { $set: { subscriptionStatus: 'canceled' } }
    );
    
    // Fix any invalid subscriptionStatus values
    await User.updateMany(
      { subscriptionStatus: { $nin: ['free', 'trialing', 'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid'] } },
      { $set: { subscriptionStatus: 'free' } }
    );
    
    // Fix subscriptionTier
    await User.updateMany(
      { subscriptionTier: { $nin: ['free', 'single-search', 'monthly', 'team'] } },
      { $set: { subscriptionTier: 'free' } }
    );
    
    // Add missing fields
    await User.updateMany(
      { stripeCustomerId: { $exists: false } },
      { $set: { stripeCustomerId: null } }
    );
    
    await User.updateMany(
      { searchCredits: { $exists: false } },
      { $set: { searchCredits: 0 } }
    );
    
    await User.updateMany(
      { purchasedSearches: { $exists: false } },
      { $set: { purchasedSearches: [] } }
    );
    
    await User.updateMany(
      { billingHistory: { $exists: false } },
      { $set: { billingHistory: [] } }
    );
    
    console.log('✅ All enum issues fixed with bulk operations');
    
    // Verify
    const invalidUsers = await User.countDocuments({
      $or: [
        { subscriptionStatus: { $nin: ['free', 'trialing', 'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid'] } },
        { subscriptionTier: { $nin: ['free', 'single-search', 'monthly', 'team'] } }
      ]
    });
    
    console.log(`📊 Users with invalid enum values: ${invalidUsers}`);
    
  } catch (error) {
    console.error('❌ Bulk fix failed:', error);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'fix':
    fixSubscriptionStatusEnum();
    break;
  case 'bulk':
    fixAllEnumIssues().then(() => process.exit(0));
    break;
  default:
    console.log('📋 Available commands:');
    console.log('  fix    - Fix subscriptionStatus enum values individually');
    console.log('  bulk   - Fix all enum issues with bulk operations (faster)');
    console.log('');
    console.log('Examples:');
    console.log('  node quick-fix-migration.js fix');
    console.log('  node quick-fix-migration.js bulk');
    process.exit(0);
}