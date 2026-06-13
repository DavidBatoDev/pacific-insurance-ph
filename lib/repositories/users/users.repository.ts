import type { ListParams, Paginated } from "../types";
import type { NewUser, User, UserUpdate } from "./user.entity";

/**
 * The Users repository port. Follows the same shape as the Clients repository:
 * entity + interface + supabase implementation + factory.
 */
export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(params?: ListParams): Promise<Paginated<User>>;
  create(input: NewUser): Promise<User>;
  update(id: string, input: UserUpdate): Promise<User>;
}
