/**
 * Identity Store (Phase 1)
 *
 * Zustand store for managing BSV identity state with persistence.
 * Stores petname, avatar SVG, and short ID for the user's identity.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Identity } from "@/types/identity";

interface IdentityState {
  identity: Identity | null;
  lastUpdated: string | null;

  // Actions
  setIdentity: (identity: Identity) => void;
  clearIdentity: () => void;
  updateIdentity: (partial: Partial<Identity>) => void;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      identity: null,
      lastUpdated: null,

      setIdentity: (identity: Identity) =>
        set({
          identity,
          lastUpdated: new Date().toISOString(),
        }),

      clearIdentity: () =>
        set({
          identity: null,
          lastUpdated: null,
        }),

      updateIdentity: (partial: Partial<Identity>) =>
        set((state) => ({
          identity: state.identity ? { ...state.identity, ...partial } : null,
          lastUpdated: new Date().toISOString(),
        })),
    }),
    {
      name: "edwinpai-identity-storage",
      version: 1,
    }
  )
);
