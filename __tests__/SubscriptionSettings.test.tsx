/**
 * SubscriptionSettings Component Tests
 *
 * Tests for the subscription settings panel component.
 * Covers status display, expiration warnings, and renewal flow.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubscriptionSettings } from '../components/SubscriptionSettings';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionState, SubscriptionStatus } from '../types_contracts/subscription';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../hooks/useSubscription');
const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;

jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockUserAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

const createMockStatus = (overrides?: Partial<SubscriptionStatus>): SubscriptionStatus => ({
  state: SubscriptionState.Active,
  isActive: true,
  expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
  daysUntilExpiry: 30,
  source: 'overlay',
  lastUpdated: Date.now(),
  ...overrides,
});

const mockRefresh = jest.fn();
const mockResetSubscription = jest.fn();

// ============================================================================
// Test Setup
// ============================================================================

const defaultMockReturn = {
  status: createMockStatus(),
  plans: [],
  isLoading: false,
  error: null,
  paymentInProgress: false,
  lastRefresh: Date.now(),
  refresh: mockRefresh,
  isActive: true,
  isPending: false,
  isExpiringSoon: false,
  submitPayment: jest.fn(),
  resetSubscription: mockResetSubscription,
  getStatusMessage: jest.fn(() => 'Subscription active. 30 days remaining.'),
  getPlan: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSubscription.mockReturnValue(defaultMockReturn);
});

// ============================================================================
// Tests
// ============================================================================

describe('SubscriptionSettings', () => {
  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Active Subscription', () => {
    it('renders subscription settings header', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Subscription')).toBeInTheDocument();
    });

    it('displays active status badge', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows status message', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText(/Subscription active. 30 days remaining./)).toBeInTheDocument();
    });

    it('displays expiration date', () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({ expiresAt }),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Expires on:')).toBeInTheDocument();
    });

    it('displays time remaining', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Time remaining:')).toBeInTheDocument();
      expect(screen.getByText(/30 days/)).toBeInTheDocument();
    });

    it('has refresh button', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when status is loading', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: null,
        isLoading: true,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Loading subscription status...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when there is an error', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch subscription',
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Error Loading Subscription')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch subscription')).toBeInTheDocument();
    });

    it('has try again button on error', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        error: 'Network error',
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      const tryAgainButton = screen.getByText('Try Again');
      expect(tryAgainButton).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Status Badge Tests
  // --------------------------------------------------------------------------

  describe('Status Badges', () => {
    it('shows active badge for active subscription', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows expiring soon badge for expiring subscription', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expiring,
          daysUntilExpiry: 5,
        }),
        isActive: true,
        isExpiringSoon: true,
        getStatusMessage: jest.fn(() => 'Subscription expiring soon. 5 days remaining.'),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    });

    it('shows pending badge for pending subscription', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Pending,
          isActive: false,
        }),
        isActive: false,
        isPending: true,
        getStatusMessage: jest.fn(() => 'Payment submitted. Waiting for confirmation...'),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows expired badge for expired subscription', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expired,
          isActive: false,
          expiresAt: Math.floor(Date.now() / 1000) - 1000,
        }),
        isActive: false,
        getStatusMessage: jest.fn(() => 'Subscription expired. Please renew.'),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('shows not subscribed badge for unsubscribed state', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Unsubscribed,
          isActive: false,
        }),
        isActive: false,
        getStatusMessage: jest.fn(() => 'No active subscription.'),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Not Subscribed')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Expiration Warning Tests
  // --------------------------------------------------------------------------

  describe('Expiration Warnings', () => {
    it('shows warning when subscription is expiring soon', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expiring,
          daysUntilExpiry: 5,
        }),
        isExpiringSoon: true,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Your subscription is expiring soon')).toBeInTheDocument();
      expect(screen.getByText(/expires in 5 days/)).toBeInTheDocument();
    });

    it('shows urgent warning when expiring in less than 24 hours', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expiring,
          daysUntilExpiry: 0.5,
        }),
        isExpiringSoon: true,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText(/expires in less than 24 hours/)).toBeInTheDocument();
    });

    it('does not show warning for active subscription with plenty of time', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.queryByText('Your subscription is expiring soon')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Action Tests
  // --------------------------------------------------------------------------

  describe('Actions', () => {
    it('calls refresh when refresh button is clicked', async () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      const refreshButton = screen.getByText('Refresh Status');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledWith(true);
      });
    });

    it('shows refreshing state while refreshing', async () => {
      mockRefresh.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      const refreshButton = screen.getByText('Refresh Status');
      fireEvent.click(refreshButton);

      expect(await screen.findByText('Refreshing...')).toBeInTheDocument();
    });

    it('shows renew button when subscription is expiring', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expiring,
          daysUntilExpiry: 5,
        }),
        isExpiringSoon: true,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Renew Subscription')).toBeInTheDocument();
    });

    it('shows resubscribe button when subscription is expired', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expired,
          isActive: false,
        }),
        isActive: false,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText('Resubscribe')).toBeInTheDocument();
    });

    it('calls onRenew when renew button is clicked', () => {
      const onRenew = jest.fn();
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({
          state: SubscriptionState.Expiring,
          daysUntilExpiry: 5,
        }),
        isExpiringSoon: true,
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} onRenew={onRenew} />);

      const renewButton = screen.getByText('Renew Subscription');
      fireEvent.click(renewButton);

      expect(onRenew).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Reset Functionality Tests
  // --------------------------------------------------------------------------

  describe('Reset Functionality', () => {
    it('shows reset button when allowReset is true', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} allowReset={true} />);

      expect(screen.getByText('Reset Subscription')).toBeInTheDocument();
    });

    it('does not show reset button when allowReset is false', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} allowReset={false} />);

      expect(screen.queryByText('Reset Subscription')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when reset is clicked', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} allowReset={true} />);

      const resetButton = screen.getByText('Reset Subscription');
      fireEvent.click(resetButton);

      expect(screen.getByText('Reset Subscription?')).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });

    it('calls resetSubscription when confirmed', async () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} allowReset={true} />);

      fireEvent.click(screen.getByText('Reset Subscription'));
      fireEvent.click(screen.getByText('Confirm Reset'));

      await waitFor(() => {
        expect(mockResetSubscription).toHaveBeenCalledTimes(1);
      });
    });

    it('closes dialog when cancel is clicked', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} allowReset={true} />);

      fireEvent.click(screen.getByText('Reset Subscription'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Reset Subscription?')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Technical Details Tests
  // --------------------------------------------------------------------------

  describe('Technical Details', () => {
    it('shows technical details when showTechnicalDetails is true', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} showTechnicalDetails={true} />);

      expect(screen.getByText('Technical Details')).toBeInTheDocument();
      expect(screen.getByText('State:')).toBeInTheDocument();
      expect(screen.getByText('Source:')).toBeInTheDocument();
    });

    it('does not show technical details when showTechnicalDetails is false', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} showTechnicalDetails={false} />);

      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();
    });

    it('displays correct technical information', () => {
      render(<SubscriptionSettings userAddress={mockUserAddress} showTechnicalDetails={true} />);

      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('overlay')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Time Formatting Tests
  // --------------------------------------------------------------------------

  describe('Time Formatting', () => {
    it('displays days correctly for multi-day period', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({ daysUntilExpiry: 15 }),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText(/15 days/)).toBeInTheDocument();
    });

    it('displays singular day correctly', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({ daysUntilExpiry: 1 }),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText(/1 day/)).toBeInTheDocument();
      expect(screen.queryByText(/1 days/)).not.toBeInTheDocument();
    });

    it('displays hours when less than 1 day remaining', () => {
      mockUseSubscription.mockReturnValue({
        ...defaultMockReturn,
        status: createMockStatus({ daysUntilExpiry: 0.5 }),
      });

      render(<SubscriptionSettings userAddress={mockUserAddress} />);

      expect(screen.getByText(/12 hours/)).toBeInTheDocument();
    });
  });
});
