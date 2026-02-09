/**
 * Database Seeder — creates an owner account and sample products.
 * Run: npm run seed
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const Counter = require('../models/Counter');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mm_construction';

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB...');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Counter.deleteMany({});
    console.log('Cleared existing data.');

    // Create owner
    const owner = await User.create({
      name: 'M.M. Owner',
      email: 'owner@mmconstruction.com',
      password: 'owner123',
      phone: '9999999999',
      role: 'owner',
    });
    console.log(`✅ Owner created: ${owner.email} / owner123`);

    // Create staff
    const staff = await User.create({
      name: 'Staff Member',
      email: 'staff@mmconstruction.com',
      password: 'staff123',
      phone: '8888888888',
      role: 'staff',
    });
    console.log(`✅ Staff created: ${staff.email} / staff123`);

    // Seed products
    const products = [
      {
        name: 'MS Grill',
        category: 'Grill',
        baseRate: 85,
        unit: 'kg',
        fittingCharge: 15,
        fittingChargeType: 'per_kg',
        description: 'Mild Steel Window Grill',
        createdBy: owner._id,
      },
      {
        name: 'SS Grill',
        category: 'Grill',
        baseRate: 250,
        unit: 'kg',
        fittingCharge: 20,
        fittingChargeType: 'per_kg',
        description: 'Stainless Steel Grill',
        createdBy: owner._id,
      },
      {
        name: 'Rolling Shutter',
        category: 'Shutter',
        baseRate: 120,
        unit: 'sqft',
        fittingCharge: 2000,
        fittingChargeType: 'fixed',
        description: 'Motorized Rolling Shutter',
        createdBy: owner._id,
      },
      {
        name: 'MS Railing',
        category: 'Railing',
        baseRate: 90,
        unit: 'kg',
        fittingCharge: 12,
        fittingChargeType: 'per_kg',
        description: 'Mild Steel Staircase Railing',
        createdBy: owner._id,
      },
      {
        name: 'SS Railing',
        category: 'Railing',
        baseRate: 280,
        unit: 'rft',
        fittingCharge: 50,
        fittingChargeType: 'per_piece',
        description: 'Stainless Steel Railing with Glass',
        createdBy: owner._id,
      },
      {
        name: 'Iron Window',
        category: 'Window',
        baseRate: 95,
        unit: 'kg',
        fittingCharge: 15,
        fittingChargeType: 'per_kg',
        description: 'Standard Iron Window Frame',
        createdBy: owner._id,
      },
      {
        name: 'Main Gate',
        category: 'Gate',
        baseRate: 100,
        unit: 'kg',
        fittingCharge: 3000,
        fittingChargeType: 'fixed',
        description: 'Main Entrance Gate with Design',
        createdBy: owner._id,
      },
      {
        name: 'Sliding Gate',
        category: 'Gate',
        baseRate: 110,
        unit: 'kg',
        fittingCharge: 5000,
        fittingChargeType: 'fixed',
        description: 'Sliding Gate with Track',
        createdBy: owner._id,
      },
      {
        name: 'Custom Fabrication',
        category: 'Custom',
        baseRate: 80,
        unit: 'kg',
        fittingCharge: 0,
        fittingChargeType: 'fixed',
        description: 'Custom iron fabrication work',
        createdBy: owner._id,
      },
    ];

    await Product.insertMany(products);
    console.log(`✅ ${products.length} products seeded.`);

    console.log('\n🎉 Seed completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    process.exit(1);
  }
};

seedData();
