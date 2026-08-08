import { prisma } from "@/db";
type CreateUserData = {
  fullName: string;
  email: string;
  username: string;
  passwordHash: string;
  phone?: string;
};
export class AuthRepository {
  async existsByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    return !!user;
  }
  async existsByUsername(username: string) {
    const user = await prisma.user.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
      },
    });
    return !!user;
  }

  async createUser(data: CreateUserData) {
    return prisma.user.create({ data });
  }
}

export const authRepository = new AuthRepository();
