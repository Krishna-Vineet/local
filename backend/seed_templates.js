import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Template from './models/Template.js';
import Organization from './models/Organization.js';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const templates = [
  {
    name: 'Single Portrait (P1-46-T01-V)',
    orientation: 'portrait',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1200, height: 1800 },
    photoSlots: [
      { id: 'slot-1', x: 60, y: 90, width: 1080, height: 1440 }
    ],
    background: { color: '#ffffff' }
  },
  {
    name: 'Duo Portrait (P1-46-T02-V)',
    orientation: 'portrait',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1200, height: 1800 },
    photoSlots: [
      { id: 'slot-1', x: 60, y: 90, width: 1080, height: 700 },
      { id: 'slot-2', x: 60, y: 830, width: 1080, height: 700 }
    ],
    background: { color: '#ffffff' }
  },
  {
    name: 'Classic Strip (P2-46-T04-V)',
    orientation: 'portrait',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1200, height: 1800 },
    photoSlots: [
      // Left strip
      { id: 'slot-1-l', x: 30, y: 45, width: 510, height: 340 },
      { id: 'slot-2-l', x: 30, y: 415, width: 510, height: 340 },
      { id: 'slot-3-l', x: 30, y: 785, width: 510, height: 340 },
      { id: 'slot-4-l', x: 30, y: 1155, width: 510, height: 340 },
      // Right strip (duplicate of same photos)
      { id: 'slot-1-r', x: 660, y: 45, width: 510, height: 340 },
      { id: 'slot-2-r', x: 660, y: 415, width: 510, height: 340 },
      { id: 'slot-3-r', x: 660, y: 785, width: 510, height: 340 },
      { id: 'slot-4-r', x: 660, y: 1155, width: 510, height: 340 }
    ],
    background: { color: '#ffffff' }
  },
  {
    name: 'Single Landscape (P1-46-T01-H)',
    orientation: 'landscape',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1800, height: 1200 },
    photoSlots: [
      { id: 'slot-1', x: 90, y: 60, width: 1620, height: 1080 }
    ],
    background: { color: '#ffffff' }
  },
  {
    name: 'Duo Landscape (P1-46-T02-H)',
    orientation: 'landscape',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1800, height: 1200 },
    photoSlots: [
      { id: 'slot-1', x: 90, y: 60, width: 780, height: 1080 },
      { id: 'slot-2', x: 930, y: 60, width: 780, height: 1080 }
    ],
    background: { color: '#ffffff' }
  },
  {
    name: 'Grid 4 Landscape (P1-46-T04-H)',
    orientation: 'landscape',
    source: 'uploaded',
    status: 'published',
    canvas: { width: 1800, height: 1200 },
    photoSlots: [
      { id: 'slot-1', x: 60, y: 60, width: 810, height: 510 },
      { id: 'slot-2', x: 930, y: 60, width: 810, height: 510 },
      { id: 'slot-3', x: 60, y: 630, width: 810, height: 510 },
      { id: 'slot-4', x: 930, y: 630, width: 810, height: 510 }
    ],
    background: { color: '#ffffff' }
  }
];

const seedTemplates = async () => {
  await connectDB();
  try {
    const org = await Organization.findOne();
    if (!org) {
      console.log('No organization found, run seed_admin.js first');
      process.exit(1);
    }

    console.log('Clearing old global/organization templates...');
    await Template.deleteMany({ organizationId: org._id, category: 'Architecture' });

    console.log('Seeding Architecture V1 templates...');
    for (const t of templates) {
      const template = new Template({
        ...t,
        organizationId: org._id,
        category: 'Architecture',
        visibility: 'organization'
      });
      await template.save();
      console.log(`Created: ${template.name}`);
    }

    console.log('Templates seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding templates:', error);
    process.exit(1);
  }
};

seedTemplates();
