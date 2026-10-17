import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import TogetherImageProvider from '../services/ai/TogetherImageProvider.js';

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('orgaitemplates');
  const docs = await col.find({}).toArray();

  const provider = new TogetherImageProvider();
  const targetDir = path.join(process.cwd(), 'uploads', 'templates', 'assets');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const doc of docs) {
    const bg = doc.design?.background || doc.design?.bg;
    const style = bg?.style || doc.prompt || doc.name;
    const currentUrl = bg?.url || '';

    // Check if image is missing on disk or has broken S3 url
    const isS3 = currentUrl.includes('amazonaws.com') || currentUrl.includes('happypix-bucket');
    let fileName = bg?.assetId ? path.basename(bg.assetId) : `theme-${doc._id}.jpg`;
    if (!fileName.endsWith('.jpg') && !fileName.endsWith('.png')) fileName += '.jpg';
    const localFilePath = path.join(targetDir, fileName);

    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 1000) {
      console.log(`✅ Already exists on disk for "${doc.name}": ${fileName}`);
      const localUrl = `/uploads/templates/assets/${fileName}`;
      await col.updateOne({ _id: doc._id }, {
        $set: {
          'design.background.url': localUrl,
          'design.background.assetId': `templates/assets/${fileName}`,
          'assets.0.url': localUrl,
          'assets.0.assetId': `templates/assets/${fileName}`
        }
      });
      continue;
    }

    console.log(`🎨 Generating theme artwork for "${doc.name}" with prompt: "${style}"...`);
    try {
      const prompt = `photo booth template background artwork, ${style}, high resolution, clean elegant border design, no text, no photos, no faces`;
      const buffer = await provider.generateImage(prompt);
      fs.writeFileSync(localFilePath, buffer);
      console.log(`💾 Saved ${buffer.length} bytes to ${localFilePath}`);

      const localUrl = `/uploads/templates/assets/${fileName}`;
      await col.updateOne({ _id: doc._id }, {
        $set: {
          'design.background.url': localUrl,
          'design.background.assetId': `templates/assets/${fileName}`,
          'assets.0.url': localUrl,
          'assets.0.assetId': `templates/assets/${fileName}`
        }
      });
      console.log(`✨ Updated template "${doc.name}" with local URL: ${localUrl}`);
    } catch (err) {
      console.error(`⚠️ Failed to generate for "${doc.name}":`, err.message);
    }
  }

  console.log('🎉 Done regenerating template backgrounds!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
