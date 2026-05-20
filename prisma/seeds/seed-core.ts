import { disconnectPrisma, prisma } from './client';
import { seedCategories, seedUsers } from './actions';

async function main() {
  console.log('Seeding core data...');

  const seededUsers = await seedUsers();
  const seededCategories = await seedCategories();

  console.log(`Users: ${seededUsers.length}`);
  console.log(`Categories: ${seededCategories.length}`);
  console.log('Core seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Core seed failed:', error);
    process.exit(1);
  })
  .finally(disconnectPrisma);
