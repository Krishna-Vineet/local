import Organization from '../models/Organization.js';

class CronService {
  start() {
    console.log('⏳ Starting background CronService...');
    // Run immediately on start
    this.checkExpirations();
    
    // Then run every hour (60 * 60 * 1000 = 3600000 ms)
    setInterval(() => this.checkExpirations(), 3600000);
  }

  async checkExpirations() {
    try {
      const now = new Date();
      
      // 1. Check trials that have ended
      const expiredTrials = await Organization.updateMany(
        { 
          status: 'trial', 
          trialEndsAt: { $lt: now } 
        },
        { 
          $set: { status: 'expired' } 
        }
      );

      // 2. Check active plans that have expired (where planExpiresAt is not null)
      const expiredPlans = await Organization.updateMany(
        { 
          status: 'active', 
          planExpiresAt: { $ne: null, $lt: now } 
        },
        { 
          $set: { status: 'expired' } 
        }
      );

      if (expiredTrials.modifiedCount > 0 || expiredPlans.modifiedCount > 0) {
        console.log(`✅ Auto-Expiry: Expired ${expiredTrials.modifiedCount} trials and ${expiredPlans.modifiedCount} active plans.`);
      }
    } catch (error) {
      console.error('❌ CronService - checkExpirations error:', error);
    }
  }
}

export default new CronService();
