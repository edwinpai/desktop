/**
 * SubscriptionSettings Component
 *
 * Settings panel for managing active subscriptions.
 * Displays subscription status, expiration details, and renewal options.
 *
 * Features:
 * - Real-time subscription status display
 * - Expiration countdown and warnings
 * - Renewal flow for expiring/expired subscriptions
 * - Manual refresh capability
 * - Subscription cancellation/reset
 */

import React, { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionState, SubscriptionPlan } from '../types_contracts/subscription';

// ============================================================================
// Component Props
// ============================================================================

export interface SubscriptionSettingsProps {
  /** User's payment address */
  userAddress: string;
  /** Show detailed technical information */
  showTechnicalDetails?: boolean;
  /** Allow subscription reset/cancellation */
  allowReset?: boolean;
  /** Callback when user wants to renew */
  onRenew?: () => void;
  /** Custom plans for renewal */
  customPlans?: SubscriptionPlan[];
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatRelativeTime = (days: number): string => {
  if (days < 1) {
    const hours = Math.floor(days * 24);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${Math.floor(days)} day${Math.floor(days) !== 1 ? 's' : ''}`;
};

const getStateColor = (state: SubscriptionState): string => {
  switch (state) {
    case SubscriptionState.Active:
      return 'green';
    case SubscriptionState.Expiring:
      return 'orange';
    case SubscriptionState.Pending:
      return 'blue';
    case SubscriptionState.Expired:
    case SubscriptionState.Unsubscribed:
      return 'red';
    default:
      return 'gray';
  }
};

const getStateBadge = (state: SubscriptionState): string => {
  switch (state) {
    case SubscriptionState.Active:
      return 'Active';
    case SubscriptionState.Expiring:
      return 'Expiring Soon';
    case SubscriptionState.Pending:
      return 'Pending';
    case SubscriptionState.Expired:
      return 'Expired';
    case SubscriptionState.Unsubscribed:
      return 'Not Subscribed';
    default:
      return 'Unknown';
  }
};

// ============================================================================
// SubscriptionSettings Component
// ============================================================================

export const SubscriptionSettings: React.FC<SubscriptionSettingsProps> = ({
  userAddress,
  showTechnicalDetails = false,
  allowReset = false,
  onRenew,
  customPlans,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    status,
    isLoading,
    error,
    isActive,
    isPending,
    isExpiringSoon,
    lastRefresh,
    refresh,
    resetSubscription,
    getStatusMessage,
  } = useSubscription({
    userAddress,
    enableEvents: true,
  });

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReset = async () => {
    await resetSubscription();
    setShowResetConfirm(false);
  };

  const handleRenew = () => {
    onRenew?.();
  };

  // --------------------------------------------------------------------------
  // Render Sections
  // --------------------------------------------------------------------------

  const renderStatusBadge = () => {
    if (!status) return null;

    const color = getStateColor(status.state);
    const badge = getStateBadge(status.state);

    return (
      <div className={`subscription-status__badge subscription-status__badge--${color}`}>
        <span className="subscription-status__badge-dot" />
        {badge}
      </div>
    );
  };

  const renderStatusMessage = () => {
    const message = getStatusMessage();
    return <p className="subscription-status__message">{message}</p>;
  };

  const renderExpirationDetails = () => {
    if (!status?.expiresAt) return null;

    const expiresDate = formatDate(status.expiresAt);
    const daysRemaining = status.daysUntilExpiry
      ? formatRelativeTime(status.daysUntilExpiry)
      : 'Unknown';

    return (
      <div className="subscription-status__expiration">
        <div className="subscription-status__detail">
          <span className="subscription-status__label">Expires on:</span>
          <span className="subscription-status__value">{expiresDate}</span>
        </div>
        <div className="subscription-status__detail">
          <span className="subscription-status__label">Time remaining:</span>
          <span className="subscription-status__value">{daysRemaining}</span>
        </div>
      </div>
    );
  };

  const renderExpirationWarning = () => {
    if (!isExpiringSoon || !status?.daysUntilExpiry) return null;

    const days = Math.floor(status.daysUntilExpiry);

    return (
      <div className="subscription-status__warning">
        <div className="subscription-status__warning-icon">⚠️</div>
        <div className="subscription-status__warning-content">
          <h4>Your subscription is expiring soon</h4>
          <p>
            {days <= 1
              ? 'Your subscription expires in less than 24 hours.'
              : `Your subscription expires in ${days} days.`}
          </p>
          <p>Renew now to continue using EdwinPAI without interruption.</p>
        </div>
      </div>
    );
  };

  const renderTechnicalDetails = () => {
    if (!showTechnicalDetails || !status) return null;

    return (
      <div className="subscription-status__technical">
        <h4>Technical Details</h4>
        <div className="subscription-status__technical-grid">
          <div className="subscription-status__detail">
            <span className="subscription-status__label">State:</span>
            <span className="subscription-status__value">{status.state}</span>
          </div>
          <div className="subscription-status__detail">
            <span className="subscription-status__label">Source:</span>
            <span className="subscription-status__value">{status.source}</span>
          </div>
          <div className="subscription-status__detail">
            <span className="subscription-status__label">Last Updated:</span>
            <span className="subscription-status__value">
              {lastRefresh ? new Date(lastRefresh).toLocaleString() : 'Never'}
            </span>
          </div>
          {status.expiresAt && (
            <div className="subscription-status__detail">
              <span className="subscription-status__label">Expires At (Unix):</span>
              <span className="subscription-status__value">{status.expiresAt}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActions = () => {
    return (
      <div className="subscription-settings__actions">
        <button
          className="button button--secondary"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
        </button>

        {(isExpiringSoon || !isActive) && (
          <button className="button button--primary" onClick={handleRenew}>
            {status?.state === SubscriptionState.Expired ? 'Resubscribe' : 'Renew Subscription'}
          </button>
        )}

        {allowReset && (
          <button
            className="button button--danger"
            onClick={() => setShowResetConfirm(true)}
          >
            Reset Subscription
          </button>
        )}
      </div>
    );
  };

  const renderResetConfirmation = () => {
    if (!showResetConfirm) return null;

    return (
      <div className="subscription-settings__modal">
        <div className="subscription-settings__modal-content">
          <h3>Reset Subscription?</h3>
          <p>
            This will reset your subscription state. You will need to resubscribe to continue
            using EdwinPAI.
          </p>
          <p>
            <strong>This action cannot be undone.</strong>
          </p>
          <div className="subscription-settings__modal-actions">
            <button className="button button--danger" onClick={handleReset}>
              Confirm Reset
            </button>
            <button
              className="button button--secondary"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  if (isLoading && !status) {
    return (
      <div className="subscription-settings">
        <div className="subscription-settings__loading">
          <div className="subscription-settings__spinner" />
          <p>Loading subscription status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-settings">
        <div className="subscription-settings__error">
          <h3>Error Loading Subscription</h3>
          <p>{error}</p>
          <button className="button button--primary" onClick={handleRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-settings">
      <div className="subscription-settings__header">
        <h2>Subscription</h2>
        {renderStatusBadge()}
      </div>

      <div className="subscription-settings__content">
        {renderStatusMessage()}
        {renderExpirationWarning()}
        {renderExpirationDetails()}
        {renderTechnicalDetails()}
      </div>

      {renderActions()}
      {renderResetConfirmation()}
    </div>
  );
};

export default SubscriptionSettings;
