import Payment from '../models/Payment.js';
import PhotoShare from '../models/PhotoShare.js';

/**
 * Hourly maintenance jobs.
 *
 * NOTE: plan / trial expiry is NOT handled here anymore. Since CRM v2 the
 * effective plan status is computed on read (lib/planService.js →
 * computePlanStatus) from the organization's subscription, so there is no
 * denormalized status field to flip — the previous implementation wrote
 * `status: 'expired'` / queried `status: 'trial'`, values that are not in
 * the Organization schema enum and therefore never matched anything.
 */
class CronService {
  start() {
    console.log('⏳ Starting background CronService...');
    this.runMaintenance();

    // Run every hour
    this.timer = setInterval(() => this.runMaintenance(), 60 * 60 * 1000);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async runMaintenance() {
    await this.expireStalePayments();
    await this.markExpiredShares();
  }

  /**
   * Razorpay orders that were created but never paid (guest walked away,
   * payment link abandoned) should not sit in `created` forever — they skew
   * revenue reporting. Anything older than 24h is marked failed.
   */
  async expireStalePayments() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await Payment.updateMany(
        { status: 'created', createdAt: { $lt: cutoff } },
        { $set: { status: 'failed' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`🧹 Maintenance: expired ${result.modifiedCount} abandoned payment order(s).`);
      }
    } catch (error) {
      console.error('❌ CronService - expireStalePayments error:', error.message);
    }
  }

  /**
   * PhotoShare documents carry an `expiresAt` TTL index that deletes them
   * automatically; this flips the status flag first so status-based checks
   * (e.g. /api/share/deliver) behave correctly during the TTL lag window.
   */
  async markExpiredShares() {
    try {
      const now = new Date();
      const result = await PhotoShare.updateMany(
        { status: 'active', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`🧹 Maintenance: marked ${result.modifiedCount} photo share(s) as expired.`);
      }
    } catch (error) {
      console.error('❌ CronService - markExpiredShares error:', error.message);
    }
  }
}

export default new CronService();
