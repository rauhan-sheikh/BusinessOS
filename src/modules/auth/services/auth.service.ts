import { authRepository } from "../repositories/auth.repository";
import type { RegisterInput } from "../schemas/register.schema";
import { registerSchema } from "../schemas/register.schema";
import argon2 from "argon2";
import { ConflictError } from "@/shared/errors/conflict-error";

export class AuthService {
  async register(input: RegisterInput) {
    const validatedData = registerSchema.parse(input);
    if (await authRepository.existsByEmail(validatedData.email)) {
      throw new ConflictError("Email already exists");
    }
    if (await authRepository.existsByUsername(validatedData.username)) {
      throw new ConflictError("Username already exists");
    }
    const passwordHash = await argon2.hash(validatedData.password);
    const { password, ...userData } = validatedData;
    const user = await authRepository.createUser({
      ...userData,
      passwordHash,
    });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
    };
  }
}

export const authService = new AuthService();
