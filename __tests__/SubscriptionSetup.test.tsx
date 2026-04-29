/**
 * SubscriptionSetup Component Tests
 *
 * Tests for the subscription onboarding flow component.
 * Covers plan selection, payment initiation, and error handling.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubscriptionSetup } from '../components/SubscriptionSetup';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlan } from '../types_contracts/subscription';

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

const mockPlans: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    costSatoshis: 100000,
    costUsd: 50,
    billingPeriod: 30,
    features: ['Feature 1', 'Feature 2'],
  },
  {
    id: 'premium',
    name: 'Premium',
    costSatoshis: 200000,
    costUsd: 100,
    billingPeriod: 30,
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    recommended: true,
  },
];

const mockSubmitPayment = jest.fn();

// ============================================================================
// Test Setup
// ============================================================================

const defaultMockReturn = {
  status: null,
  plans: mockPlans,
  isLoading: false,
  error: null,
  paymentInProgress: false,
  lastRefresh: null,
  refresh: jest.fn(),
  isActive: false,
  isPending: false,
  isExpiringSoon: false,
  submitPayment: mockSubmitPayment,
  resetSubscription: jest.fn(),
  getStatusMessage: jest.fn(() => 'Not subscribed'),
  getPlan: jest.fn((id) => mockPlans.find((p) => p.id === id)),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSubscription.mockReturnValue(defaultMockReturn);
  mockSubmitPayment.mockResolvedValue({ success: true, txid: 'mock-txid' });
});

// ============================================================================
// Tests
// ============================================================================

describe('SubscriptionSetup', () => {
  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Welcome Step', () => {
    it('renders welcome message on initial load', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      expect(screen.getByText('Welcome to EdwinPAI')).toBeInTheDocument();
      expect(screen.getByText(/EdwinPAI uses a subscription model/)).toBeInTheDocument();
      expect(screen.getByText('Choose a Plan')).toBeInTheDocument();
    });

    it('displays subscription benefits', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      expect(screen.getByText(/Access unlimited context/)).toBeInTheDocument();
      expect(screen.getByText(/Build complex applications/)).toBeInTheDocument();
    });

    it('has cancel button that calls onCancel callback', () => {
      const onCancel = jest.fn();
      render(<SubscriptionSetup userAddress={mockUserAddress} onCancel={onCancel} />);

      const cancelButton = screen.getByText('Not Now');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plan Selection Step', () => {
    it('shows plan selection when choosing a plan', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      const choosePlanButton = screen.getByText('Choose a Plan');
      fireEvent.click(choosePlanButton);

      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    it('displays all available plans', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));

      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
    });

    it('shows recommended badge on recommended plan', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));

      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('displays plan pricing in both USD and satoshis', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));

      expect(screen.getByText('$50')).toBeInTheDocument();
      expect(screen.getByText(/100,000 satoshis/)).toBeInTheDocument();
    });

    it('displays plan features', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));

      expect(screen.getByText('Feature 1')).toBeInTheDocument();
      expect(screen.getByText('Feature 2')).toBeInTheDocument();
    });

    it('allows going back to welcome step', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Back'));

      expect(screen.getByText('Welcome to EdwinPAI')).toBeInTheDocument();
    });
  });

  describe('Payment Confirmation Step', () => {
    it('shows payment confirmation when plan is selected', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));

      expect(screen.getByText('Confirm Your Subscription')).toBeInTheDocument();
    });

    it('displays selected plan details', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));

      expect(screen.getByText('Basic Plan')).toBeInTheDocument();
      expect(screen.getByText('$50/month')).toBeInTheDocument();
    });

    it('shows billing period information', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));

      expect(screen.getByText(/30 days/)).toBeInTheDocument();
    });

    it('displays truncated payment address', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));

      expect(screen.getByText(/1A1zP1eP...DivfNa/)).toBeInTheDocument();
    });

    it('allows going back to plan selection', () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Back'));

      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Payment Flow Tests
  // --------------------------------------------------------------------------

  describe('Payment Processing', () => {
    it('calls submitPayment when confirming payment', async () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(mockSubmitPayment).toHaveBeenCalledWith({
          planId: 'basic',
          userAddress: mockUserAddress,
          amountSatoshis: 100000,
          recipientAddress: expect.any(String),
        });
      });
    });

    it('shows processing state during payment', async () => {
      mockSubmitPayment.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      expect(await screen.findByText('Processing Payment')).toBeInTheDocument();
      expect(screen.getByText(/Broadcasting your payment/)).toBeInTheDocument();
    });

    it('shows success state when payment succeeds', async () => {
      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(screen.getByText('Subscription Activated!')).toBeInTheDocument();
      });
    });

    it('calls onComplete callback after successful payment', async () => {
      const onComplete = jest.fn();
      render(<SubscriptionSetup userAddress={mockUserAddress} onComplete={onComplete} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(screen.getByText('Subscription Activated!')).toBeInTheDocument();
      });

      // onComplete should be called after a short delay
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('shows error state when payment fails', async () => {
      mockSubmitPayment.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      });

      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
      });
    });

    it('allows retrying after payment failure', async () => {
      mockSubmitPayment.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Try Again'));

      expect(screen.getByText('Confirm Your Subscription')).toBeInTheDocument();
    });

    it('allows choosing different plan after error', async () => {
      mockSubmitPayment.mockResolvedValue({
        success: false,
        error: 'Error',
      });

      render(<SubscriptionSetup userAddress={mockUserAddress} />);

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Choose Different Plan'));

      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Custom Props Tests
  // --------------------------------------------------------------------------

  describe('Custom Props', () => {
    it('uses custom plans when provided', () => {
      const customPlans: SubscriptionPlan[] = [
        {
          id: 'custom',
          name: 'Custom Plan',
          costSatoshis: 150000,
          costUsd: 75,
          billingPeriod: 30,
          features: ['Custom Feature'],
        },
      ];

      render(
        <SubscriptionSetup userAddress={mockUserAddress} customPlans={customPlans} />
      );

      fireEvent.click(screen.getByText('Choose a Plan'));

      expect(screen.getByText('Custom Plan')).toBeInTheDocument();
      expect(screen.queryByText('Basic')).not.toBeInTheDocument();
    });

    it('uses custom recipient address when provided', async () => {
      const customRecipient = '1CustomRecipientAddress';

      render(
        <SubscriptionSetup
          userAddress={mockUserAddress}
          recipientAddress={customRecipient}
        />
      );

      fireEvent.click(screen.getByText('Choose a Plan'));
      fireEvent.click(screen.getByText('Select Basic'));
      fireEvent.click(screen.getByText('Confirm and Pay'));

      await waitFor(() => {
        expect(mockSubmitPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientAddress: customRecipient,
          })
        );
      });
    });
  });
});
