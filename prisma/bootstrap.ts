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

  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { username: true }
  });

  if (existingAdmin) {
    console.log(`Administrator already exists: ${existingAdmin.username}`);
    return;
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });

  if (existingUsername) {
    throw new Error(`Username already exists and is not an administrator: ${username}`);
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.ADMIN
    }
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
