import type {
  GroupAccount,
  GroupMember,
  NewGroupAccount,
  NewGroupMember,
} from "./group.entity";

/** The Group Accounts repository port. */
export interface GroupsRepository {
  findById(id: string): Promise<GroupAccount | null>;
  list(): Promise<GroupAccount[]>;
  create(input: NewGroupAccount): Promise<GroupAccount>;
  update(id: string, input: Partial<NewGroupAccount>): Promise<GroupAccount>;
  membersOf(groupId: string): Promise<GroupMember[]>;
  addMember(input: NewGroupMember): Promise<GroupMember>;
  /** Flip all Pending e-cards to Issued; returns how many were issued. */
  issuePendingEcards(groupId: string): Promise<number>;
}
