import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb+srv://info_db_user:happypix%402026@happypix.jaja6kb.mongodb.net/?appName=happypix');
  const res = await mongoose.connection.db.collection('organizations').updateMany(
    {},
    { $set: { trialEndsAt: new Date('2028-01-01'), status: 'trial' } }
  );
  console.log('Extended trial for all orgs:', res);
  process.exit(0);
}

run().catch(console.error);
