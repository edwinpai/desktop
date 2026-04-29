/**
 * useChannels Hook (SPEC §9)
 *
 * State management for channel configurations.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ChannelConfig, ChannelName, ChannelSettings } from '@/types/channels'
import * as channelsApi from '@/lib/channels'

export interface UseChannelsReturn {
  channels: ChannelConfig[]
  loading: boolean
  error: string | null
  refreshChannels: () => Promise<void>
  createChannel: (
    channel: ChannelName,
    configuredBy: string,
    credentials: Record<string, string>,
    settings: ChannelSettings
  ) => Promise<ChannelConfig>
  updateChannel: (
    channel: ChannelName,
    enabled?: boolean,
    credentials?: Record<string, string>,
    settings?: ChannelSettings
  ) => Promise<ChannelConfig>
  deleteChannel: (channel: ChannelName) => Promise<void>
  toggleChannel: (channel: ChannelName, enabled: boolean) => Promise<ChannelConfig>
  validateCredentials: (
    channel: ChannelName,
    credentials: Record<string, string>
  ) => Promise<channelsApi.ValidationResult>
}

/**
 * Hook for managing channel configurations
 *
 * @param autoLoad - Whether to load channels on mount (default: true)
 */
export function useChannels(autoLoad = true): UseChannelsReturn {
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshChannels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const channelsList = await channelsApi.listChannels()
      setChannels(channelsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const createChannel = useCallback(
    async (
      channel: ChannelName,
      configuredBy: string,
      credentials: Record<string, string>,
      settings: ChannelSettings
    ) => {
      setError(null)
      try {
        const newChannel = await channelsApi.createChannel(channel, configuredBy, credentials, settings)
        await refreshChannels()
        return newChannel
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    },
    [refreshChannels]
  )

  const updateChannel = useCallback(
    async (
      channel: ChannelName,
      enabled?: boolean,
      credentials?: Record<string, string>,
      settings?: ChannelSettings
    ) => {
      setError(null)
      try {
        const updatedChannel = await channelsApi.updateChannel(channel, enabled, credentials, settings)
        await refreshChannels()
        return updatedChannel
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    },
    [refreshChannels]
  )

  const deleteChannel = useCallback(
    async (channel: ChannelName) => {
      setError(null)
      try {
        await channelsApi.deleteChannel(channel)
        await refreshChannels()
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    },
    [refreshChannels]
  )

  const toggleChannel = useCallback(
    async (channel: ChannelName, enabled: boolean) => {
      setError(null)
      try {
        const updatedChannel = await channelsApi.toggleChannel(channel, enabled)
        await refreshChannels()
        return updatedChannel
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    },
    [refreshChannels]
  )

  const validateCredentials = useCallback(
    async (channel: ChannelName, credentials: Record<string, string>) => {
      setError(null)
      try {
        return await channelsApi.validateChannelCredentials(channel, credentials)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    },
    []
  )

  // Auto-load channels on mount
  useEffect(() => {
    if (autoLoad) {
      refreshChannels()
    }
  }, [autoLoad, refreshChannels])

  return {
    channels,
    loading,
    error,
    refreshChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    toggleChannel,
    validateCredentials,
  }
}
