/**
 * SubscriptionSetup Component
 *
 * Onboarding flow for new subscriptions with plan selection and payment initiation.
 * Designed for first-time users without an active subscription.
 *
 * Features:
 * - Plan selection with feature comparison
 * - Plain language explanation (no crypto jargon)
 * - Fiat equivalent pricing display
 * - Payment initiation with progress tracking
 * - Error handling and retry logic
 */

import React, { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import {
  SubscriptionPlan,
  PaymentRequest,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../types_contracts/subscription';

// ============================================================================
// Component Props
// ============================================================================

export interface SubscriptionSetupProps {
  /** User's payment address */
  userAddress: string;
  /** Callback when setup is complete */
  onComplete?: () => void;
  /** Callback when user cancels setup */
  onCancel?: () => void;
  /** Custom plans (overrides default) */
  customPlans?: SubscriptionPlan[];
  /** Recipient address for payments */
  recipientAddress?: string;
}

// ============================================================================
// Setup Steps
// ============================================================================

enum SetupStep {
  Welcome = 'welcome',
  PlanSelection = 'plan_selection',
  PaymentConfirm = 'payment_confirm',
  Processing = 'processing',
  Success = 'success',
  Error = 'error',
}

// ============================================================================
// SubscriptionSetup Component
// ============================================================================

export const SubscriptionSetup: React.FC<SubscriptionSetupProps> = ({
  userAddress,
  onComplete,
  onCancel,
  customPlans,
  recipientAddress = '1EdwinPAISubscriptionServiceAddress',
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.Welcome);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { submitPayment, paymentInProgress, isLoading } = useSubscription({
    userAddress,
    enableEvents: true,
    onPaymentConfirmed: () => {
      setCurrentStep(SetupStep.Success);
    },
  });

  const plans = customPlans || DEFAULT_SUBSCRIPTION_PLANS;

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setCurrentStep(SetupStep.PaymentConfirm);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlan) return;

    setCurrentStep(SetupStep.Processing);
    setPaymentError(null);

    const paymentRequest: PaymentRequest = {
      planId: selectedPlan.id,
      userAddress,
      amountSatoshis: selectedPlan.costSatoshis,
      recipientAddress,
    };

    const result = await submitPayment(paymentRequest);

    if (result.success) {
      setCurrentStep(SetupStep.Success);
      setTimeout(() => onComplete?.(), 2000);
    } else {
      setPaymentError(result.error || 'Payment failed');
      setCurrentStep(SetupStep.Error);
    }
  };

  const handleRetry = () => {
    setPaymentError(null);
    setCurrentStep(SetupStep.PaymentConfirm);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleBack = () => {
    setPaymentError(null);
    if (currentStep === SetupStep.PaymentConfirm) {
      setCurrentStep(SetupStep.PlanSelection);
    } else if (currentStep === SetupStep.Error) {
      setCurrentStep(SetupStep.PaymentConfirm);
    }
  };

  // --------------------------------------------------------------------------
  // Render Steps
  // --------------------------------------------------------------------------

  const renderWelcome = () => (
    <div className="subscription-setup__welcome">
      <h2>Welcome to EdwinPAI</h2>
      <p className="subscription-setup__description">
        EdwinPAI uses a subscription model to provide unlimited context reasoning for your projects.
      </p>
      <p className="subscription-setup__description">
        To activate EdwinPAI, you need a subscription. This allows you to:
      </p>
      <ul className="subscription-setup__benefits">
        <li>Access unlimited context from your Obsidian vault</li>
        <li>Build complex applications with recursive reasoning</li>
        <li>Use advanced code generation features</li>
        <li>Get priority support and updates</li>
      </ul>
      <div className="subscription-setup__actions">
        <button
          className="button button--primary"
          onClick={() => setCurrentStep(SetupStep.PlanSelection)}
        >
          Choose a Plan
        </button>
        <button className="button button--secondary" onClick={handleCancel}>
          Not Now
        </button>
      </div>
    </div>
  );

  const renderPlanSelection = () => (
    <div className="subscription-setup__plans">
      <h2>Choose Your Plan</h2>
      <p className="subscription-setup__subtitle">
        Select the plan that best fits your needs. All plans include full access to EdwinPAI.
      </p>
      <div className="subscription-plans">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`subscription-plan ${plan.recommended ? 'subscription-plan--recommended' : ''}`}
            onClick={() => handlePlanSelect(plan)}
          >
            {plan.recommended && (
              <div className="subscription-plan__badge">Recommended</div>
            )}
            <h3 className="subscription-plan__name">{plan.name}</h3>
            <div className="subscription-plan__price">
              <span className="subscription-plan__price-usd">${plan.costUsd}</span>
              <span className="subscription-plan__price-period">/month</span>
            </div>
            <div className="subscription-plan__price-crypto">
              {plan.costSatoshis.toLocaleString()} satoshis
            </div>
            <ul className="subscription-plan__features">
              {plan.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <button className="button button--primary subscription-plan__button">
              Select {plan.name}
            </button>
          </div>
        ))}
      </div>
      <div className="subscription-setup__actions">
        <button className="button button--secondary" onClick={() => setCurrentStep(SetupStep.Welcome)}>
          Back
        </button>
      </div>
    </div>
  );

  const renderPaymentConfirm = () => (
    <div className="subscription-setup__confirm">
      <h2>Confirm Your Subscription</h2>
      {selectedPlan && (
        <div className="subscription-summary">
          <div className="subscription-summary__plan">
            <h3>{selectedPlan.name} Plan</h3>
            <p className="subscription-summary__price">
              ${selectedPlan.costUsd}/month
            </p>
            <p className="subscription-summary__crypto">
              {selectedPlan.costSatoshis.toLocaleString()} satoshis
            </p>
          </div>
          <div className="subscription-summary__details">
            <p><strong>Billing Period:</strong> {selectedPlan.billingPeriod} days</p>
            <p><strong>Payment Address:</strong> {userAddress.slice(0, 8)}...{userAddress.slice(-8)}</p>
          </div>
          <div className="subscription-summary__info">
            <p>
              By confirming, you authorize a payment of {selectedPlan.costSatoshis.toLocaleString()} satoshis
              (approximately ${selectedPlan.costUsd} USD) for your monthly subscription.
            </p>
            <p>
              Your subscription will be activated immediately after payment confirmation.
            </p>
          </div>
        </div>
      )}
      <div className="subscription-setup__actions">
        <button
          className="button button--primary"
          onClick={handleConfirmPayment}
          disabled={isLoading}
        >
          Confirm and Pay
        </button>
        <button className="button button--secondary" onClick={handleBack}>
          Back
        </button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="subscription-setup__processing">
      <div className="subscription-setup__spinner" />
      <h2>Processing Payment</h2>
      <p className="subscription-setup__description">
        {paymentInProgress
          ? 'Broadcasting your payment transaction...'
          : 'Waiting for confirmation...'}
      </p>
      <p className="subscription-setup__hint">
        This usually takes 10-30 seconds. Please do not close this window.
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div className="subscription-setup__success">
      <div className="subscription-setup__icon subscription-setup__icon--success">✓</div>
      <h2>Subscription Activated!</h2>
      <p className="subscription-setup__description">
        Your payment has been confirmed and your subscription is now active.
      </p>
      {selectedPlan && (
        <div className="subscription-summary">
          <p><strong>Plan:</strong> {selectedPlan.name}</p>
          <p><strong>Valid for:</strong> {selectedPlan.billingPeriod} days</p>
        </div>
      )}
      <div className="subscription-setup__actions">
        <button className="button button--primary" onClick={onComplete}>
          Start Using EdwinPAI
        </button>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="subscription-setup__error">
      <div className="subscription-setup__icon subscription-setup__icon--error">✗</div>
      <h2>Payment Failed</h2>
      <p className="subscription-setup__description">
        We encountered an error while processing your payment:
      </p>
      {paymentError && (
        <div className="subscription-setup__error-message">
          {paymentError}
        </div>
      )}
      <div className="subscription-setup__actions">
        <button className="button button--primary" onClick={handleRetry}>
          Try Again
        </button>
        <button className="button button--secondary" onClick={handleBack}>
          Choose Different Plan
        </button>
        <button className="button button--tertiary" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  return (
    <div className="subscription-setup">
      <div className="subscription-setup__container">
        {currentStep === SetupStep.Welcome && renderWelcome()}
        {currentStep === SetupStep.PlanSelection && renderPlanSelection()}
        {currentStep === SetupStep.PaymentConfirm && renderPaymentConfirm()}
        {currentStep === SetupStep.Processing && renderProcessing()}
        {currentStep === SetupStep.Success && renderSuccess()}
        {currentStep === SetupStep.Error && renderError()}
      </div>
    </div>
  );
};

export default SubscriptionSetup;
