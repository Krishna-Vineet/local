import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from '../models/Payment.js';
import DigitalToken from '../models/DigitalToken.js';

dotenv.config();

async function checkDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    console.log('\n--- LATEST 3 PAYMENTS ---');
    const payments = await Payment.find().sort({ createdAt: -1 }).limit(3);
    payments.forEach(p => {
      console.log({
        id: p._id,
        razorpayOrderId: p.razorpayOrderId,
        amount: p.amount,
        printCount: p.printCount,
        digitalCopy: p.digitalCopy,
        photoUrls: p.photoUrls,
        compositeUrl: p.compositeUrl,
        status: p.status,
        createdAt: p.createdAt
      });
    });

    console.log('\n--- LATEST 3 DIGITAL TOKENS ---');
    const tokens = await DigitalToken.find().sort({ createdAt: -1 }).limit(3);
    tokens.forEach(t => {
      console.log({
        id: t._id,
        token: t.token,
        paymentId: t.paymentId,
        photoUrlsCount: t.photoUrls.length,
        compositeUrl: t.compositeUrl,
        createdAt: t.createdAt
      });
    });

  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

checkDb();
