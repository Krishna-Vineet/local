import fs from 'fs';
import path from 'path';
import Organization from '../models/Organization.js';

class CronService {
  start() {
    console.log('⏳ Starting background CronService...');
    // Run immediately on start
    this.checkExpirations();
    this.cleanupLocalUploads(7);
    
    // Then run every hour (60 * 60 * 1000 = 3600000 ms)
    setInterval(() => {
      this.checkExpirations();
      this.cleanupLocalUploads(7);
    }, 3600000);
  }

  /**
   * P3: 7-day cleanup cron job for local test photos and temporary files.
   * Cleans up temporary uploads, test files, and local session photos older than 7 days,
   * while strictly protecting persistent assets like templates and branding logos.
   */
  async cleanupLocalUploads(maxAgeDays = 7) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) return;

      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      let removedFiles = 0;
      let freedBytes = 0;

      // 1. Clean uploads/temp directory
      const tempDir = path.join(uploadsDir, 'temp');
      if (fs.existsSync(tempDir)) {
        const tempFiles = fs.readdirSync(tempDir);
        for (const file of tempFiles) {
          try {
            const filePath = path.join(tempDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile() && stat.mtimeMs < cutoffTime) {
              freedBytes += stat.size;
              fs.unlinkSync(filePath);
              removedFiles++;
            }
          } catch {
            // ignore individual file error
          }
        }
      }

      // 2. Clean temporary/test photos in uploads/photos older than 7 days
      const photosDir = path.join(uploadsDir, 'photos');
      if (fs.existsSync(photosDir)) {
        const sweepDir = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              sweepDir(fullPath);
              // Clean empty directory if empty
              try {
                if (fs.readdirSync(fullPath).length === 0) {
                  fs.rmdirSync(fullPath);
                }
              } catch {}
            } else if (entry.isFile()) {
              try {
                const stat = fs.statSync(fullPath);
                const isTestFile = entry.name.startsWith('test-') || entry.name.includes('demo') || entry.name.startsWith('temp-');
                if (stat.mtimeMs < cutoffTime || (isTestFile && stat.mtimeMs < (Date.now() - 24 * 60 * 60 * 1000))) {
                  freedBytes += stat.size;
                  fs.unlinkSync(fullPath);
                  removedFiles++;
                }
              } catch {}
            }
          }
        };
        sweepDir(photosDir);
      }

      if (removedFiles > 0) {
        const mb = (freedBytes / (1024 * 1024)).toFixed(2);
        console.log(`🧹 Disk Cleanup: Removed ${removedFiles} temporary files older than ${maxAgeDays} days (${mb} MB freed).`);
      }
    } catch (err) {
      console.error('❌ CronService - cleanupLocalUploads error:', err.message);
    }
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
