/**
 * WhatsApp Channel Wizard (SPEC §9.1)
 *
 * QR code flow + session JSON upload for WhatsApp Business API integration.
 * Uses baileys-style session data format.
 */

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { WizardShell, type WizardStepConfig } from './WizardShell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useChannels } from '@/hooks/useChannels'
import type { ChannelWizardProps } from '@/types/channels'

export function WhatsAppWizard({ channel = 'whatsapp', onComplete, onCancel, existingConfig }: ChannelWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [sessionData, setSessionData] = useState(existingConfig?.credentials?.sessionData || '')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [validationMetadata, setValidationMetadata] = useState<{ status?: string; phoneNumber?: string }>()
  
  // Advanced settings state
  const [enabled, setEnabled] = useState(true)
  const [dmPolicy, setDmPolicy] = useState('pairing')
  const [groupPolicy, setGroupPolicy] = useState('open')
  const [historyLimit, setHistoryLimit] = useState(50)

  const { validateCredentials } = useChannels(false)

  // Step 1: Introduction
  const introStep: WizardStepConfig = {
    step: 'intro',
    title: 'Connect WhatsApp Business',
    description: 'Integrate WhatsApp Business API to receive and respond to messages',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This wizard will help you connect your WhatsApp Business account. You'll need:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>WhatsApp Business API access</li>
          <li>Session data from a paired device or QR code scan</li>
          <li>Active WhatsApp Business phone number</li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Session data is encrypted at rest using BRC-42 key derivation.
          </p>
        </div>
      </div>
    ),
  }

  // Step 2: Credential input
  const credentialsStep: WizardStepConfig = {
    step: 'credentials',
    title: 'Provide Session Data',
    description: 'Upload WhatsApp session JSON or paste session data',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session-upload">Upload Session JSON</Label>
          <Input
            id="session-upload"
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                  try {
                    const content = event.target?.result as string
                    // Validate it's valid JSON
                    JSON.parse(content)
                    setSessionData(content)
                    setError(undefined)
                  } catch {
                    setError('Invalid JSON file. Please upload a valid WhatsApp session file.')
                  }
                }
                reader.readAsText(file)
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Upload a .json file containing your WhatsApp session data
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or paste directly</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-data">Session Data (JSON)</Label>
          <Textarea
            id="session-data"
            placeholder='{"creds": {...}, "keys": {...}}'
            value={sessionData}
            onChange={(e) => {
              setSessionData(e.target.value)
              setError(undefined)
            }}
            rows={10}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Paste your WhatsApp session JSON data here
          </p>
        </div>
      </div>
    ),
    onValidate: async () => {
      if (!sessionData.trim()) {
        setError('Session data is required')
        return false
      }

      // Validate JSON format
      try {
        JSON.parse(sessionData)
      } catch {
        setError('Invalid JSON format. Please provide valid session data.')
        return false
      }

      return true
    },
  }

  // Step 3: Validation
  const validationStep: WizardStepConfig = {
    step: 'validation',
    title: 'Validate Connection',
    description: 'Testing your WhatsApp credentials',
    content: (
      <div className="space-y-4">
        {validationMetadata ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
              <span className="text-sm font-medium">Connection successful</span>
            </div>
            {validationMetadata.phoneNumber && (
              <div className="text-sm text-muted-foreground">
                Phone: <span className="font-mono">{validationMetadata.phoneNumber}</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Status: <span className="font-medium">{validationMetadata.status || 'Connected'}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Validating your credentials...</p>
        )}
      </div>
    ),
    onValidate: async () => {
      setLoading(true)
      setError(undefined)

      try {
        const credentials: Record<string, string> = {
          sessionData,
        }

        const result = await validateCredentials(channel, credentials)

        if (!result.valid) {
          setError(result.errorMessage || 'Validation failed')
          return false
        }

        // Extract metadata
        setValidationMetadata({
          status: result.metadata?.status,
          phoneNumber: result.metadata?.phoneNumber,
        })

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Validation failed')
        return false
      } finally {
        setLoading(false)
      }
    },
  }

  // Step 4: Advanced Settings (Optional)
  const advancedStep: WizardStepConfig = {
    step: 'advanced',
    title: 'Advanced Settings (Optional)',
    description: 'Configure channel behavior',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These settings are optional. You can always change them later in the channel settings.
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Channel</Label>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle the channel on/off without removing configuration
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dm-policy">DM Policy</Label>
          <Select value={dmPolicy} onValueChange={setDmPolicy}>
            <SelectTrigger id="dm-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pairing">Pairing</SelectItem>
              <SelectItem value="allowlist">Allowlist</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How to handle direct messages
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-policy">Group Policy</Label>
          <Select value={groupPolicy} onValueChange={setGroupPolicy}>
            <SelectTrigger id="group-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="allowlist">Allowlist</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How to handle group messages
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="history-limit">History Limit</Label>
          <Input
            id="history-limit"
            type="number"
            value={historyLimit}
            onChange={(e) => setHistoryLimit(parseInt(e.target.value, 10) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            Number of messages to keep in context window
          </p>
        </div>
      </div>
    ),
  }

  // Step 5: Confirmation
  const confirmationStep: WizardStepConfig = {
    step: 'confirmation',
    title: 'Configuration Complete',
    description: 'Your WhatsApp channel is ready',
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full" />
          <span className="font-medium">WhatsApp channel configured successfully</span>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Channel:</span>{' '}
            <span className="font-medium">WhatsApp Business</span>
          </div>
          {validationMetadata?.phoneNumber && (
            <div className="text-sm">
              <span className="text-muted-foreground">Phone:</span>{' '}
              <span className="font-mono">{validationMetadata.phoneNumber}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-muted-foreground">Status:</span>{' '}
            <span className="font-medium text-green-600 dark:text-green-400">Active</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          You can now receive and respond to WhatsApp messages through EdwinPAI.
        </p>
      </div>
    ),
    onValidate: async () => {
      setLoading(true)
      setError(undefined)

      try {
        // Save channel config via gateway config.patch
        const patch = {
          channels: {
            [channel]: {
              sessionData,
              enabled,
              dmPolicy,
              groupPolicy,
              historyLimit,
            },
          },
        }

        // Try config.patch via WebSocket first (works for remote gateways)
        try {
          const { patchGatewayConfig, resolveToken, inferGatewayKind } = await import('@/lib/gateway-context')
          const { readConfig } = await import('@/lib/config')
          const desktopConfig = await readConfig()
          const gwUrl = desktopConfig?.gatewayUrl || 'http://localhost:18789'
          const token = desktopConfig?.gatewayToken || await resolveToken()
          await patchGatewayConfig(
            { url: gwUrl, token: token || undefined, kind: inferGatewayKind(gwUrl) },
            patch,
          )
        } catch {
          // Fallback: try local IPC
          const { invoke } = await import('@tauri-apps/api/core')
          const configResponse = await invoke<{ config: Record<string, unknown> }>('get_edwinpai_config')
          const currentConfig = configResponse.config as Record<string, unknown>
          const updatedConfig = {
            ...currentConfig,
            channels: {
              ...((currentConfig.channels ?? {}) as Record<string, unknown>),
              [channel]: {
                sessionData,
                enabled,
                dmPolicy,
                groupPolicy,
                historyLimit,
              },
            },
          }
          await invoke('update_edwinpai_config', { config: updatedConfig })
        }

        onComplete?.({ enabled, sessionData } as unknown as import("@/types/channels").ChannelConfig)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save configuration')
        return false
      } finally {
        setLoading(false)
      }
    },
    nextLabel: 'Save & Enable',
  }

  const steps = [introStep, credentialsStep, validationStep, advancedStep, confirmationStep]

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
      setError(undefined)
    }
  }

  return (
    <WizardShell
      title="WhatsApp Integration"
      icon={<MessageCircle className="w-10 h-10 text-green-600" />}
      steps={steps}
      currentStepIndex={currentStepIndex}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={() => onCancel?.()}
      error={error}
      loading={loading}
    />
  )
}
