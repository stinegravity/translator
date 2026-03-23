import prisma from '../server/src/infrastructure/db';

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, tier: true, emailVerified: true },
  });
  console.log('--- Current Users in DB ---');
  console.table(users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
