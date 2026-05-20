import { disconnectPrisma, prisma } from './seeds/client';
import {
  clearDatabase,
  seedCategories,
  seedDemoRecommendationData,
  seedTests,
  seedUsers,
} from './seeds/actions';

async function main() {
  console.log('Resetting and seeding database...');

  await clearDatabase();
  const seededUsers = await seedUsers();
  const seededCategories = await seedCategories();
  await seedTests();
  await seedDemoRecommendationData();

  const testCount = await prisma.test.count();
  const questionCount = await prisma.question.count();
  const optionCount = await prisma.option.count();
  const attemptCount = await prisma.attempt.count();
  const masteryCount = await prisma.userTagMastery.count();

  console.log(`Users: ${seededUsers.length}`);
  console.log(`Categories: ${seededCategories.length}`);
  console.log(`Tests: ${testCount}`);
  console.log(`Questions: ${questionCount}`);
  console.log(`Options: ${optionCount}`);
  console.log(`Demo attempts: ${attemptCount}`);
  console.log(`Demo tag masteries: ${masteryCount}`);
  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(disconnectPrisma);
