/**
 * Seeds the database on boot, but only if it is empty.
 *
 * Render's free tier has no shell and no pre-deploy command, so a fresh deployment
 * has nowhere to run the seed from. Doing it here means a new environment comes up
 * with data on its own, and an environment that already has data is left alone.
 *
 * Set SEED_ON_BOOT=false to turn this off.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

if (process.env.SEED_ON_BOOT === 'false') {
  console.log('Seed on boot is disabled.');
} else {
  const existing = await prisma.employee.count();
  if (existing > 0) {
    console.log(`Database already holds ${existing.toLocaleString()} employees; not seeding.`);
  } else {
    console.log('Empty database detected, seeding...');
    await prisma.$disconnect();
    await import('./seed.js');
  }
}

await prisma.$disconnect();
