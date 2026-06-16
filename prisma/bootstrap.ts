import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existingUsername = await prisma.user.findUnique({ where: { username } });

  if (existingUsername) {
    await prisma.user.update({
      where: { username },
      data: {
        passwordHash,
        role: Role.ADMIN,
        isActive: true
      }
    });
    console.log(`Updated administrator: ${username}`);
    return;
  }

  await prisma.user.create({
    data: { username, passwordHash, role: Role.ADMIN }
  });
  console.log(`Created administrator: ${username}`);
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
