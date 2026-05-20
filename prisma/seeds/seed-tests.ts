import { disconnectPrisma, prisma } from './client';
import { seedCategories, seedTests, seedUsers } from './actions';

async function main() {
  console.log('Seeding demo tests...');

  await seedUsers();
  await seedCategories();
  await seedTests();

  const testCount = await prisma.test.count();
  const questionCount = await prisma.question.count();
  const optionCount = await prisma.option.count();

  console.log(`Tests: ${testCount}`);
  console.log(`Questions: ${questionCount}`);
  console.log(`Options: ${optionCount}`);
  console.log('Demo test seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Demo test seed failed:', error);
    process.exit(1);
  })
  .finally(disconnectPrisma);
