/**
 * Access Control Panel - User list with role management
 * Owner can grant/revoke Member/Guest access
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserAuthorization, AccessLevel } from "@/types/api";
import { ACCESS_CAPABILITIES } from "@/types/api";

interface AccessControlPanelProps {
  users: UserAuthorization[];
  currentUserLevel: AccessLevel;
  onUpdateLevel?: (pubkey: string, newLevel: AccessLevel) => Promise<void>;
  onRemoveUser?: (pubkey: string) => Promise<void>;
}

export function AccessControlPanel({
  users,
  currentUserLevel,
  onUpdateLevel,
  onRemoveUser,
}: AccessControlPanelProps) {
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);

  const canManageUsers = ACCESS_CAPABILITIES[currentUserLevel].canManageUsers;

  const handleLevelChange = async (pubkey: string, newLevel: AccessLevel) => {
    if (!onUpdateLevel) return;
    setUpdatingUser(pubkey);
    try {
      await onUpdateLevel(pubkey, newLevel);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleRemove = async (pubkey: string) => {
    if (!onRemoveUser) return;
    if (!confirm("Are you sure you want to remove this user?")) return;

    setRemovingUser(pubkey);
    try {
      await onRemoveUser(pubkey);
    } finally {
      setRemovingUser(null);
    }
  };

  if (users.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-muted-foreground/50 mb-4"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-sm text-muted-foreground">No authorized users</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create an invitation to add users
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const isOwner = user.level === "owner";
        const isUpdating = updatingUser === user.pubkey;
        const isRemoving = removingUser === user.pubkey;

        return (
          <Card key={user.pubkey} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate">{user.petname}</p>
                  <AccessBadge level={user.level} />
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {user.pubkey.slice(0, 16)}...{user.pubkey.slice(-8)}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Added {formatDate(user.authorizedAt)}</span>
                  <span>•</span>
                  <span>Last active {formatDate(user.lastActive)}</span>
                </div>
              </div>

              {canManageUsers && !isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={user.level}
                    onValueChange={(value) =>
                      handleLevelChange(user.pubkey, value as AccessLevel)
                    }
                    disabled={isUpdating || isRemoving}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(user.pubkey)}
                    disabled={isUpdating || isRemoving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {isRemoving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    ) : (
                      "Remove"
                    )}
                  </Button>
                </div>
              )}

              {isOwner && (
                <div className="shrink-0">
                  <p className="text-xs text-muted-foreground italic">
                    Cannot remove owner
                  </p>
                </div>
              )}
            </div>

            {/* Capability summary */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex gap-4 text-xs">
                <Capability
                  label="Read"
                  granted={ACCESS_CAPABILITIES[user.level].canRead}
                />
                <Capability
                  label="Write"
                  granted={ACCESS_CAPABILITIES[user.level].canWrite}
                />
                <Capability
                  label="Manage Users"
                  granted={ACCESS_CAPABILITIES[user.level].canManageUsers}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AccessBadge({ level }: { level: AccessLevel }) {
  const colors = {
    owner: "bg-purple-100 text-purple-700 border-purple-200",
    member: "bg-blue-100 text-blue-700 border-blue-200",
    guest: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[level]}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function Capability({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {granted ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-600"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground/30"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span
        className={granted ? "text-foreground" : "text-muted-foreground/50"}
      >
        {label}
      </span>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
