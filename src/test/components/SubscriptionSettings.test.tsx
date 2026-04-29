/**
 * SubscriptionSettings Component Tests
 *
 * Tests for subscription settings panel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriptionSettings } from '@/components/subscription/SubscriptionSettings';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { CheckSubscriptionResponse } from '@/types';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  RefreshCw: () => <div>RefreshIcon</div>,
  CheckCircle2: () => <div>CheckIcon</div>,
  AlertCircle: () => <div>AlertIcon</div>,
  XCircle: () => <div>XIcon</div>,
  Info: () => <div>InfoIcon</div>,
}));

describe('SubscriptionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store
    const { clearSubscription } = useSubscriptionStore.getState();
    clearSubscription();
  });

  describe('Active State', () => {
    beforeEach(() => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        vout: 0,
        verifiedAt: '2026-02-10T12:00:00Z',
        cachedProof: false,
        blockHeight: 850000,
        confirmations: 6,
      };

      mockInvoke.mockResolvedValue(response);
      useSubscriptionStore.getState().setSubscription(response);
    });

    it('should display Active status', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Subscription Status')).toBeInTheDocument();
    });

    it('should display success badge', () => {
      render(<SubscriptionSettings />);

      const badge = screen.getByText('Active');
      expect(badge).toHaveClass('bg-green-500');
    });

    it('should display transaction details', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Transaction ID')).toBeInTheDocument();
      expect(screen.getByText('Output Index')).toBeInTheDocument();
      expect(screen.getByText('Last Verified')).toBeInTheDocument();

      // Check truncated TXID is shown
      expect(screen.getByTitle(/1234567890abcdef/i)).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should show Cancel button for active subscription', () => {
      const onCancel = vi.fn();
      render(<SubscriptionSettings onCancel={onCancel} />);

      const cancelBtn = screen.getByRole('button', {
        name: /cancel subscription/i,
      });
      expect(cancelBtn).toBeInTheDocument();
    });

    it('should not show Renew button for active subscription', () => {
      const onRenew = vi.fn();
      render(<SubscriptionSettings onRenew={onRenew} />);

      expect(
        screen.queryByRole('button', { name: /renew|subscribe/i }),
      ).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(<SubscriptionSettings onCancel={onCancel} />);

      const cancelBtn = screen.getByRole('button', {
        name: /cancel subscription/i,
      });
      await user.click(cancelBtn);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cached State', () => {
    beforeEach(() => {
      const verifiedAt = new Date().toISOString();
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        txid: 'abc123',
        vout: 1,
        verifiedAt,
        cachedProof: true,
        blockHeight: 850000,
      };

      mockInvoke.mockResolvedValue(response);
      useSubscriptionStore.getState().setSubscription(response);
    });

    it('should display Cached status', () => {
      render(<SubscriptionSettings />);

      // Should have "Cached" in the status badge (there are multiple "Cached" texts)
      const badges = screen.getAllByText('Cached');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display warning badge', () => {
      render(<SubscriptionSettings />);

      // Find the status badge with warning color (there are two "Cached" texts)
      const badges = screen.getAllByText('Cached');
      const statusBadge = badges.find((badge) =>
        badge.className.includes('bg-yellow-500')
      );
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-yellow-500');
    });

    it('should display grace period countdown', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Grace Period Remaining')).toBeInTheDocument();

      // Should show hours remaining (close to 72h) - multiple elements may contain this
      const countdownElements = screen.getAllByText(/72h/i);
      expect(countdownElements.length).toBeGreaterThan(0);
    });

    it('should display cache indicator', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Proof Source')).toBeInTheDocument();
      // There are multiple "Cached" texts - verify at least one exists
      const cachedElements = screen.getAllByText('Cached');
      expect(cachedElements.length).toBeGreaterThan(0);
    });

    it('should show reconnect message', () => {
      render(<SubscriptionSettings />);

      expect(
        screen.getByText(/Attempting to reconnect and verify/i),
      ).toBeInTheDocument();
    });

    it('should show Cancel button for cached subscription', () => {
      const onCancel = vi.fn();
      render(<SubscriptionSettings onCancel={onCancel} />);

      expect(
        screen.getByRole('button', { name: /cancel subscription/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Expired State', () => {
    beforeEach(() => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Expired',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);
      useSubscriptionStore.getState().setSubscription(response);
    });

    it('should display Expired status', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('should display destructive badge', () => {
      render(<SubscriptionSettings />);

      const badge = screen.getByText('Expired');
      expect(badge).toHaveClass('bg-destructive');
    });

    it('should display expiration message', () => {
      render(<SubscriptionSettings />);

      expect(
        screen.getByText(/Your subscription has ended/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Renew now to restore/i)).toBeInTheDocument();
    });

    it('should show Renew button', () => {
      const onRenew = vi.fn();
      render(<SubscriptionSettings onRenew={onRenew} />);

      const renewBtn = screen.getByRole('button', { name: /renew/i });
      expect(renewBtn).toBeInTheDocument();
    });

    it('should not show Cancel button for expired subscription', () => {
      const onCancel = vi.fn();
      render(<SubscriptionSettings onCancel={onCancel} />);

      expect(
        screen.queryByRole('button', { name: /cancel/i }),
      ).not.toBeInTheDocument();
    });

    it('should call onRenew when renew button clicked', async () => {
      const user = userEvent.setup();
      const onRenew = vi.fn();

      render(<SubscriptionSettings onRenew={onRenew} />);

      const renewBtn = screen.getByRole('button', { name: /renew/i });
      await user.click(renewBtn);

      expect(onRenew).toHaveBeenCalledTimes(1);
    });
  });

  describe('GraceExceeded State', () => {
    beforeEach(() => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'GraceExceeded',
        txid: 'test',
        vout: 0,
        cachedProof: true,
        verifiedAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
      };

      mockInvoke.mockResolvedValue(response);
      useSubscriptionStore.getState().setSubscription(response);
    });

    it('should display Limited status', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Limited')).toBeInTheDocument();
    });

    it('should display limited mode message', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('Limited Mode Active')).toBeInTheDocument();
      expect(
        screen.getByText(/Connect to the internet to verify/i),
      ).toBeInTheDocument();
    });

    it('should show secondary badge', () => {
      render(<SubscriptionSettings />);

      const badge = screen.getByText('Limited');
      expect(badge).toHaveClass('bg-secondary');
    });
  });

  describe('NotFound State', () => {
    it('should display No Subscription status', () => {
      render(<SubscriptionSettings />);

      expect(screen.getByText('No Subscription')).toBeInTheDocument();
    });

    it('should display not found message', () => {
      render(<SubscriptionSettings />);

      expect(
        screen.getByText(/No active subscription found/i),
      ).toBeInTheDocument();
      // Multiple "Subscribe to unlock" texts - verify at least one exists
      const subscribeTexts = screen.getAllByText(/Subscribe to unlock/i);
      expect(subscribeTexts.length).toBeGreaterThan(0);
    });

    it('should show Subscribe button', () => {
      const onRenew = vi.fn();
      render(<SubscriptionSettings onRenew={onRenew} />);

      const subscribeBtn = screen.getByRole('button', { name: /subscribe/i });
      expect(subscribeBtn).toBeInTheDocument();
    });

    it('should not display transaction details', () => {
      render(<SubscriptionSettings />);

      expect(screen.queryByText('Transaction ID')).not.toBeInTheDocument();
      expect(screen.queryByText('Output Index')).not.toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('should display Refresh button', () => {
      render(<SubscriptionSettings />);

      const refreshBtn = screen.getByRole('button', { name: /refresh/i });
      expect(refreshBtn).toBeInTheDocument();
    });

    it('should call IPC on refresh', async () => {
      const user = userEvent.setup();
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      render(<SubscriptionSettings />);

      const refreshBtn = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_subscription', {
          forceRefresh: true,
        });
      });
    });

    it('should show Checking state while refreshing', () => {
      // Set the store to refreshing state directly
      useSubscriptionStore.getState().setRefreshing(true);

      render(<SubscriptionSettings />);

      // Should display "Checking..." when refreshing
      expect(screen.getByText('Checking...')).toBeInTheDocument();
    });

    it('should disable Refresh button while loading', () => {
      // Set the store to loading state directly
      useSubscriptionStore.getState().setLoading(true);

      render(<SubscriptionSettings />);

      const refreshBtn = screen.getByRole('button', { name: /refresh/i });
      
      // Button should be disabled when loading
      expect(refreshBtn).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator', () => {
      useSubscriptionStore.getState().setLoading(true);

      render(<SubscriptionSettings />);

      expect(
        screen.getByText(/Checking subscription status/i),
      ).toBeInTheDocument();
    });

    it('should show spinner during loading', () => {
      useSubscriptionStore.getState().setLoading(true);

      const { container } = render(<SubscriptionSettings />);

      // Check for spinner element (has animate-spin class)
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message', () => {
      useSubscriptionStore.getState().setError('Network connection failed');

      render(<SubscriptionSettings />);

      expect(screen.getByText('Error checking subscription')).toBeInTheDocument();
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });

    it('should style error with red border', () => {
      useSubscriptionStore.getState().setError('Test error');

      const { container } = render(<SubscriptionSettings />);

      const errorBox = container.querySelector('.border-red-500\\/20');
      expect(errorBox).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format ISO timestamps to locale string', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: 'test',
        vout: 0,
        verifiedAt: '2026-02-10T12:00:00Z',
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(screen.getByText('Last Verified')).toBeInTheDocument();
      // Exact format depends on locale, but should be present
      const verifiedText = screen.getByText(/2026/i);
      expect(verifiedText).toBeInTheDocument();
    });

    it('should display N/A for missing timestamps', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: 'test',
        vout: 0,
        cachedProof: false,
        // No verifiedAt
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      // With no verifiedAt, "Last Verified" row shouldn't appear
      expect(screen.queryByText('Last Verified')).not.toBeInTheDocument();
    });
  });

  describe('Grace Period Countdown', () => {
    it('should format time remaining in hours and minutes', () => {
      const verifiedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago

      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        txid: 'test',
        vout: 0,
        verifiedAt,
        cachedProof: true,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      // Should show ~70h remaining - may appear in multiple places
      const countdownElements = screen.getAllByText(/70h/i);
      expect(countdownElements.length).toBeGreaterThan(0);
    });

    it('should display minutes when less than 1 hour remaining', () => {
      // Set verified time to 71h 45m ago (15 minutes remaining)
      const verifiedAt = new Date(
        Date.now() - (71 * 60 + 45) * 60 * 1000,
      ).toISOString();

      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        txid: 'test',
        vout: 0,
        verifiedAt,
        cachedProof: true,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      // Should show minutes
      const countdown = screen.getByText(/\dm/i);
      expect(countdown).toBeInTheDocument();
    });
  });

  describe('Transaction ID Display', () => {
    it('should truncate long transaction IDs', () => {
      const longTxid =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: longTxid,
        vout: 0,
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      // Should have title attribute with full TXID
      const txidElement = screen.getByTitle(longTxid);
      expect(txidElement).toBeInTheDocument();
      expect(txidElement).toHaveClass('truncate');
    });

    it('should display transaction in monospace font', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: 'test-txid',
        vout: 0,
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      const txidElement = screen.getByTitle('test-txid');
      expect(txidElement).toHaveClass('font-mono');
    });
  });

  describe('Conditional Actions', () => {
    it('should not render Renew button if onRenew not provided', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Expired',
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(
        screen.queryByRole('button', { name: /renew/i }),
      ).not.toBeInTheDocument();
    });

    it('should not render Cancel button if onCancel not provided', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(
        screen.queryByRole('button', { name: /cancel/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Status Icons', () => {
    it('should display check icon for Active state', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(screen.getByText('CheckIcon')).toBeInTheDocument();
    });

    it('should display alert icon for Cached state', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(screen.getByText('AlertIcon')).toBeInTheDocument();
    });

    it('should display X icon for Expired state', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Expired',
        cachedProof: false,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(screen.getByText('XIcon')).toBeInTheDocument();
    });

    it('should display info icon for GraceExceeded state', () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'GraceExceeded',
        cachedProof: true,
      };

      useSubscriptionStore.getState().setSubscription(response);

      render(<SubscriptionSettings />);

      expect(screen.getByText('InfoIcon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<SubscriptionSettings onRenew={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should properly disable buttons when loading', () => {
      // Set the store to refreshing state directly
      useSubscriptionStore.getState().setRefreshing(true);

      render(<SubscriptionSettings />);

      const refreshBtn = screen.getByRole('button', { name: /refresh/i });
      
      // Button should be disabled and have disabled attribute
      expect(refreshBtn).toBeDisabled();
      expect(refreshBtn).toHaveAttribute('disabled');
    });
  });
});
