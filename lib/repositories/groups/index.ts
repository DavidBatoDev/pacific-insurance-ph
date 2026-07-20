import type { GroupsRepository } from "./groups.repository";
import { SupabaseGroupsRepository } from "./groups.repository.supabase";

let instance: GroupsRepository | null = null;

/** Resolve the Group Accounts repository. */
export function getGroupsRepository(): GroupsRepository {
  if (!instance) {
    instance = new SupabaseGroupsRepository();
  }
  return instance;
}

export type { GroupsRepository } from "./groups.repository";
export type {
  GroupAccount,
  GroupMember,
  NewGroupAccount,
  NewGroupMember,
} from "./group.entity";
