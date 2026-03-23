import { auth } from '../server/src/infrastructure/auth';
import prisma from '../server/src/infrastructure/db';

async function upsertUser(email: string, password: string, name: string, tier: 'FREE' | 'PRO' | 'TEAM') {
  try {
    await auth.api.signUpEmail({
      body: { email, password, name },
    });
    console.log(`User ${email} registered.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error && (error.message as string).includes('already exists')) {
      console.log(`User ${email} already exists.`);
    } else {
      throw error;
    }
  }

  await prisma.user.update({
    where: { email },
    data: {
      tier,
      portalAccess: email === 'admin@kyerease.com',
      internalRole: email === 'admin@kyerease.com' ? 'ADMIN' : 'CUSTOMER',
      emailVerified: true,
    },
  });
  console.log(`User ${email} updated to ${tier} and verified.`);
}

async function main() {
  console.log('--- Seeding Test Accounts ---');
  
  await upsertUser('admin@kyerease.com', 'admin123', 'System Admin', 'FREE');
  await upsertUser('user@kyerease.com', 'user1234', 'Test Customer', 'PRO');

  console.log('\nSeed process complete!');
  console.log('Internal admin (internalRole=ADMIN, tier=FREE): admin@kyerease.com / admin123');
  console.log('Customer (PRO): user@kyerease.com / user1234');
}

main()
  .catch((e) => {
    console.error('Error creating admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
