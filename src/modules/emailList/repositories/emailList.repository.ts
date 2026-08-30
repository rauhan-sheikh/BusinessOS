import { prisma } from "@/db";

export class EmailListRepository {
  async existsByEmail(email: string) {
    const emailList = await prisma.emailList.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });
    return !!emailList;
  }

  async createEmail(data: { email: string }) {
    return prisma.emailList.create({ data });
  }

  async ensureEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    return prisma.emailList.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized },
    });
  }
}

export const emailListRepository = new EmailListRepository();
