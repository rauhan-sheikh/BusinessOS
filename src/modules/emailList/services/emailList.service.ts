import { emailListRepository } from "../repositories/emailList.repository";
import type { EmailListInput } from "../schemas/emailList.schema";
import { emailListSchema } from "../schemas/emailList.schema";

export class EmailListService {
  /**
   * Records a newsletter subscription.
   *
   * Idempotent by design. This previously threw a 409 for an address already on
   * the list - and because Better Auth adds every registered user's address on
   * sign-up, the public unauthenticated endpoint became an account-existence
   * oracle: a 409 meant "this person has an account here". Subscribing twice
   * now looks exactly like subscribing once.
   */
  async subscribe(input: EmailListInput): Promise<void> {
    const validated = emailListSchema.parse(input);
    await emailListRepository.ensureEmail(validated.email);
  }

  /**
   * Adds an address discovered elsewhere (sign-up, invitation) to the list.
   * Never throws: failing to record a marketing address must not fail the
   * operation that produced it.
   */
  async ensureEmail(email: string) {
    if (!email || !email.includes("@")) return;
    try {
      await emailListRepository.ensureEmail(email);
    } catch (err) {
      console.error("Failed to ensure email in emailList:", err);
    }
  }
}

export const emailListService = new EmailListService();
