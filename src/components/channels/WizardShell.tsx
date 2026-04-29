/**
 * Channel Integration Wizard Shell (SPEC §9.1)
 *
 * Common wizard pattern for all channel integrations:
 * 1. Introduction - explain what the channel does
 * 2. Credential input - platform-specific credential gathering
 * 3. Validation - test connection with credentials
 * 4. Confirmation - show success state
 */

import { useState, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

export type WizardStep = 'intro' | 'credentials' | 'validation' | 'advanced' | 'confirmation'

export interface WizardStepConfig {
  step: WizardStep
  title: string
  description: string
  content: ReactNode
  /** Validation function called when "Next" is clicked */
  onValidate?: () => Promise<boolean>
  /** Custom next button label */
  nextLabel?: string
  /** Hide next button */
  hideNext?: boolean
  /** Hide back button */
  hideBack?: boolean
}

export interface WizardShellProps {
  /** Wizard title */
  title: string
  /** Channel icon */
  icon: ReactNode
  /** Wizard steps configuration */
  steps: WizardStepConfig[]
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Called when user clicks Back */
  onBack: () => void
  /** Called when user clicks Next (after validation passes) */
  onNext: () => void
  /** Called when user clicks Cancel */
  onCancel: () => void
  /** Error message to display */
  error?: string
  /** Loading state during validation */
  loading?: boolean
}

export function WizardShell({
  title,
  icon,
  steps,
  currentStepIndex,
  onBack,
  onNext,
  onCancel,
  error,
  loading,
}: WizardShellProps) {
  const [validating, setValidating] = useState(false)

  const currentStep = steps[currentStepIndex]
  const progress = ((currentStepIndex + 1) / steps.length) * 100
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  const handleNext = async () => {
    if (!currentStep) return

    // Run validation if provided
    if (currentStep.onValidate) {
      setValidating(true)
      try {
        const isValid = await currentStep.onValidate()
        if (!isValid) {
          setValidating(false)
          return
        }
      } catch {
        setValidating(false)
        return
      }
      setValidating(false)
    }

    onNext()
  }

  if (!currentStep) return null

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step header */}
        <div>
          <h3 className="text-lg font-semibold">{currentStep.title}</h3>
          <CardDescription>{currentStep.description}</CardDescription>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step content */}
        <div className="py-4">{currentStep.content}</div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {!isFirstStep && !currentStep.hideBack && (
            <Button variant="outline" onClick={onBack} disabled={loading || validating}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading || validating}>
            Cancel
          </Button>

          {!currentStep.hideNext && (
            <Button onClick={handleNext} disabled={loading || validating}>
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Validating...
                </>
              ) : isLastStep ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {currentStep.nextLabel || 'Finish'}
                </>
              ) : (
                <>
                  {currentStep.nextLabel || 'Next'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
