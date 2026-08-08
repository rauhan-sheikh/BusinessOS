import { emailListRepository } from "../repositories/emailList.repository";
import type { EmailListInput } from "../schemas/emailList.schema";
import { emailListSchema } from "../schemas/emailList.schema";
import { ConflictError } from "@/shared/errors/conflict-error";

export class EmailListService {
  async addEmail(input: EmailListInput) {
    const validatedData = emailListSchema.parse(input);
    if (await emailListRepository.existsByEmail(validatedData.email)) {
      throw new ConflictError("Email already exists");
    }
    return emailListRepository.createEmail(validatedData);
  }
}

export const emailListService = new EmailListService();
