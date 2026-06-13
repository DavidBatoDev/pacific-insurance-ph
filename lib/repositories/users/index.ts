import type { UsersRepository } from "./users.repository";
import { SupabaseUsersRepository } from "./users.repository.supabase";

let instance: UsersRepository | null = null;

/** Resolve the Users repository (swappable behind the {@link UsersRepository} interface). */
export function getUsersRepository(): UsersRepository {
  if (!instance) {
    instance = new SupabaseUsersRepository();
  }
  return instance;
}

export type { UsersRepository } from "./users.repository";
export type { User, NewUser, UserUpdate } from "./user.entity";
