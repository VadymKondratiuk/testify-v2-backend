import { disconnectPrisma, prisma } from './client';
import {
  seedCategories,
  seedDemoRecommendationData,
  seedTests,
  seedUsers,
} from './actions';

async function main() {
  console.log('Seeding demo recommendation data...');

  await seedUsers();
  await seedCategories();
  await seedTests();
  await seedDemoRecommendationData();

  const attemptCount = await prisma.attempt.count();
  const masteryCount = await prisma.userTagMastery.count();
  const snapshotCount = await prisma.recommendationSnapshot.count();

  console.log(`Demo attempts: ${attemptCount}`);
  console.log(`Demo tag masteries: ${masteryCount}`);
  console.log(`Recommendation snapshots: ${snapshotCount}`);
  console.log('Recommendation seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Recommendation seed failed:', error);
    process.exit(1);
  })
  .finally(disconnectPrisma);
