/**
 * Permission / access control types (SPEC §8.1, §8.2, §8.3)
 *
 * Owner/Member/Guest permission levels with capability matrix.
 */

export type PermissionLevel = "owner" | "member" | "guest";

/**
 * Capability matrix per SPEC §8.1:
 *
 * | Level   | Chat | Channels | Configure Channels | Manage Users | Settings | Audit Logs |
 * |---------|------|----------|--------------------|--------------|----------|------------|
 * | Owner   |  ✓   |    ✓     |         ✓          |      ✓       |    ✓     |     ✓      |
 * | Member  |  ✓   |    ✓     |         ✗          |      ✗       |    ✗     |     ✗      |
 * | Guest   |  ✓   |    ✗     |         ✗          |      ✗       |    ✗     |     ✗      |
 */
export interface PermissionCapabilities {
  chat: boolean;
  useChannels: boolean;
  configureChannels: boolean;
  manageUsers: boolean;
  changeSettings: boolean;
  viewAuditLogs: boolean;
}

export const PERMISSION_MATRIX: Record<
  PermissionLevel,
  PermissionCapabilities
> = {
  owner: {
    chat: true,
    useChannels: true,
    configureChannels: true,
    manageUsers: true,
    changeSettings: true,
    viewAuditLogs: true,
  },
  member: {
    chat: true,
    useChannels: true,
    configureChannels: false,
    manageUsers: false,
    changeSettings: false,
    viewAuditLogs: false,
  },
  guest: {
    chat: true,
    useChannels: false,
    configureChannels: false,
    manageUsers: false,
    changeSettings: false,
    viewAuditLogs: false,
  },
} as const;

export interface AuthorizedUser {
  publicKey: string;
  permissionLevel: PermissionLevel;
  petname: string;
  addedAt: string;
  invitedBy: string | null;
}

export interface AuthorizedUsersStore {
  users: AuthorizedUser[];
}

export interface InvitationPayload {
  gatewayUrl: string;
  gatewayPublicKey: string;
  inviteToken: string;
  permissionLevel: "member" | "guest";
  expiresAt: string;
}

export interface OwnerPermissions extends PermissionCapabilities {
  chat: true;
  useChannels: true;
  configureChannels: true;
  manageUsers: true;
  changeSettings: true;
  viewAuditLogs: true;
}

export interface MemberPermissions extends PermissionCapabilities {
  chat: true;
  useChannels: true;
  configureChannels: false;
  manageUsers: false;
  changeSettings: false;
  viewAuditLogs: false;
}

export interface GuestPermissions extends PermissionCapabilities {
  chat: true;
  useChannels: false;
  configureChannels: false;
  manageUsers: false;
  changeSettings: false;
  viewAuditLogs: false;
}
