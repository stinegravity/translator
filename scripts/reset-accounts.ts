import prisma from '../server/src/infrastructure/db';
import { auth } from '../server/src/infrastructure/auth';

async function upsertUser(email: string, password: string, name: string, tier: 'FREE' | 'PRO' | 'TEAM') {
  try {
    // We attempt to sign up first. If better-auth throws 'already exists', we catch it.
    await auth.api.signUpEmail({
      body: { email, password, name },
    });
    console.log(`User ${email} created.`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message.includes('already exists') || ('code' in error && error.code === 'user_already_exists'))
    ) {
      console.log(`User ${email} already exists.`);
    } else {
      console.error(`Error creating user ${email}:`, error);
    }
  }

  // Mandatory update to ensure password and properties are set
  // Note: better-auth handles password hashing on signUp.
  // If user already exists, better-auth doesn't allow re-signUp with same email.
  // In a real test scenario, we might want to DELETE and RECREATE if we suspect a password mismatch.
  
  await prisma.user.update({
    where: { email },
    data: {
      tier,
      portalAccess: email === 'admin@kyerease.com',
      internalRole: email === 'admin@kyerease.com' ? 'ADMIN' : 'CUSTOMER',
      emailVerified: true,
      // We can't easily reset the hashed password via Prisma if we don't know the hash format,
      // but better-auth uses bcrypt by default.
    },
  });
}

async function main() {
  console.log('--- Reseeding Test Accounts with verified Password ---');
  
  // To be 100% sure we can log in, we delete them first if they exist
  try {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['admin@kyerease.com', 'user@kyerease.com'] }
      }
    });
    console.log('Old test accounts cleared.');
  } catch {
    console.log('No old accounts to clear.');
  }

  await upsertUser('admin@kyerease.com', 'admin123', 'System Admin', 'FREE');
  await upsertUser('user@kyerease.com', 'user1234', 'Test Customer', 'PRO');

  console.log('\nSeed process complete!');
  console.log('Internal admin (internalRole=ADMIN, tier=FREE): admin@kyerease.com / admin123');
  console.log('Customer (PRO): user@kyerease.com / user1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
