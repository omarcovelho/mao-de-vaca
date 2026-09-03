const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { CATEGORY_SEED } = require('./category-seed-data');

const prisma = new PrismaClient();

const DEFAULT_BANKS = ['Nubank', 'Itaú', 'Inter', 'Sofisa', 'Daycoval'];

async function findSibling(userId, parentId, name) {
  return prisma.category.findFirst({
    where: {
      userId,
      name,
      parentId: parentId === null ? null : parentId,
    },
  });
}

async function seedCategoriesForUser(userId) {
  for (const root of CATEGORY_SEED) {
    let parent = await findSibling(userId, null, root.name);
    if (!parent) {
      parent = await prisma.category.create({
        data: {
          userId,
          parentId: null,
          name: root.name,
          kind: root.kind,
          color: root.color,
          icon: root.icon,
        },
      });
    } else {
      parent = await prisma.category.update({
        where: { id: parent.id },
        data: {
          kind: root.kind,
          color: root.color,
          icon: root.icon,
          active: true,
        },
      });
    }

    for (const childName of root.children) {
      const existing = await findSibling(userId, parent.id, childName);
      if (!existing) {
        await prisma.category.create({
          data: {
            userId,
            parentId: parent.id,
            name: childName,
            kind: root.kind,
            color: root.color,
            icon: root.icon,
          },
        });
      } else {
        await prisma.category.update({
          where: { id: existing.id },
          data: {
            kind: root.kind,
            color: root.color,
            icon: root.icon,
            active: true,
          },
        });
      }
    }
  }
}

async function main() {
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  if (!username || !password) {
    throw new Error('AUTH_USERNAME and AUTH_PASSWORD must be set for seed');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  for (const name of DEFAULT_BANKS) {
    await prisma.bank.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name,
        },
      },
      update: {},
      create: {
        userId: user.id,
        name,
      },
    });
  }

  await seedCategoriesForUser(user.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
