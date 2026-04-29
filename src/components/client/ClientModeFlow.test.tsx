import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientModeFlow } from './ClientModeFlow';
import type { DiscoveredPeer } from '@/types/api';

// Mock the hooks
vi.mock('@/hooks/useDiscovery');
vi.mock('@/hooks/useClientConnection');

type DiscoveryListMockProps = { peers: DiscoveredPeer[]; onSelect: (peer: DiscoveredPeer) => void; isScanning: boolean };
type ConnectionStatusMockProps = { status: string; gatewayName?: string | null; error?: string | null };

// Mock child components
vi.mock('./DiscoveryList', () => ({
  DiscoveryList: ({ peers, onSelect, isScanning }: DiscoveryListMockProps) => (
    <div data-testid="discovery-list">
      {isScanning && <div data-testid="scanning">Scanning...</div>}
      {peers.map((peer: DiscoveredPeer) => (
        <button key={peer.pubkey} onClick={() => onSelect(peer)}>
          {peer.petname}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./ConnectionStatus', () => ({
  ConnectionStatus: ({ status, gatewayName, error }: ConnectionStatusMockProps) => (
    <div data-testid="connection-status">
      <div data-testid="status">{status}</div>
      {gatewayName && <div data-testid="gateway-name">{gatewayName}</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
}));

const mockPeer: DiscoveredPeer = {
  pubkey: '03abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  petname: 'alice-gateway',
  address: '192.168.1.100:3000',
  isOnline: true,
  lastSeen: '2026-02-11T12:00:00Z',
  authorizationLevel: 'guest',
};

describe('ClientModeFlow', () => {
  let mockUseDiscovery: {
    peers: DiscoveredPeer[];
    isScanning: boolean;
    startScan: ReturnType<typeof vi.fn>;
    stopScan: ReturnType<typeof vi.fn>;
  };
  let mockUseClientConnection: {
    connect: ReturnType<typeof vi.fn>;
    connectionStatus: string;
    error: string | null;
  };

  beforeEach(async () => {
    mockUseDiscovery = {
      peers: [],
      isScanning: false,
      startScan: vi.fn(),
      stopScan: vi.fn(),
    };

    mockUseClientConnection = {
      connect: vi.fn().mockResolvedValue(true),
      connectionStatus: 'disconnected',
      error: null,
    };

    const { useDiscovery } = await import('@/hooks/useDiscovery');
    const { useClientConnection } = await import('@/hooks/useClientConnection');
    vi.mocked(useDiscovery).mockReturnValue(mockUseDiscovery as unknown as ReturnType<typeof useDiscovery>);
    vi.mocked(useClientConnection).mockReturnValue(mockUseClientConnection as unknown as ReturnType<typeof useClientConnection>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Rendering tests
  it('renders the wizard with progress indicator', () => {
    render(<ClientModeFlow />);
    expect(screen.getByText('Discover Gateways')).toBeInTheDocument();
    // Check all 4 steps in progress indicator
    const stepIndicators = screen.getAllByRole('generic').filter((el) =>
      el.className.includes('rounded-full')
    );
    expect(stepIndicators.length).toBeGreaterThanOrEqual(4);
  });

  it('starts on discover step', () => {
    render(<ClientModeFlow />);
    expect(screen.getByText('Discover Gateways')).toBeInTheDocument();
    expect(screen.getByTestId('discovery-list')).toBeInTheDocument();
  });

  it('calls startScan on mount', () => {
    render(<ClientModeFlow />);
    expect(mockUseDiscovery.startScan).toHaveBeenCalledTimes(1);
  });

  it('calls stopScan on unmount', () => {
    const { unmount } = render(<ClientModeFlow />);
    unmount();
    expect(mockUseDiscovery.stopScan).toHaveBeenCalled();
  });

  it('renders Cancel button on discover step', () => {
    render(<ClientModeFlow />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // Step navigation tests
  it('advances to select step when peer is selected', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];

    render(<ClientModeFlow />);

    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    await waitFor(() => {
      expect(screen.getByText('Confirm Gateway')).toBeInTheDocument();
    });
  });

  it('displays peer details on select step', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];

    render(<ClientModeFlow />);

    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    await waitFor(() => {
      expect(screen.getByText('alice-gateway')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.100:3000')).toBeInTheDocument();
      expect(screen.getByText(/03abcd/)).toBeInTheDocument();
    });
  });

  it('shows Back button on select step', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];

    render(<ClientModeFlow />);

    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  it('returns to discover step when Back is clicked on select step', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];

    render(<ClientModeFlow />);

    // Advance to select step
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    await waitFor(() => {
      expect(screen.getByText('Confirm Gateway')).toBeInTheDocument();
    });

    // Click Back
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Discover Gateways')).toBeInTheDocument();
    });
  });

  // Connection flow tests
  it('advances to auth step when Connect is clicked', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];
    mockUseClientConnection.connect = vi.fn().mockImplementation(async () => {
      mockUseClientConnection.connectionStatus = 'connecting';
      return true;
    });

    render(<ClientModeFlow />);

    // Select peer
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    // Click Connect
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    const connectButton = screen.getByRole('button', { name: /connect/i });
    await user.click(connectButton);

    // Wait for the auth step heading
    await waitFor(() => {
      expect(screen.queryByText('Confirm Gateway')).not.toBeInTheDocument();
    });
  });

  it('calls connect with correct parameters', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];

    render(<ClientModeFlow />);

    // Select peer and connect
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    const connectButton = screen.getByRole('button', { name: /connect/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(mockUseClientConnection.connect).toHaveBeenCalledWith({
        gatewayAddress: '192.168.1.100:3000',
        gatewayPubkey: mockPeer.pubkey,
      });
    });
  });

  it('advances to connect step on successful connection', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];
    mockUseClientConnection.connect.mockResolvedValue(true);

    render(<ClientModeFlow />);

    // Select peer and connect
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    const connectButton = await screen.findByRole('button', { name: /connect/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows Continue to Chat button on connect step', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];
    mockUseClientConnection.connect.mockResolvedValue(true);

    render(<ClientModeFlow />);

    // Select peer and connect
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    const connectButton = await screen.findByRole('button', { name: /connect/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to chat/i })).toBeInTheDocument();
    });
  });

  // Callback tests
  it('calls onComplete when Continue to Chat is clicked', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    mockUseDiscovery.peers = [mockPeer];
    mockUseClientConnection.connect.mockResolvedValue(true);

    render(<ClientModeFlow onComplete={onComplete} />);

    // Select peer and connect
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    const connectButton = await screen.findByRole('button', { name: /connect/i });
    await user.click(connectButton);

    const continueButton = await screen.findByRole('button', { name: /continue to chat/i });
    await user.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(mockUseDiscovery.stopScan).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<ClientModeFlow onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockUseDiscovery.stopScan).toHaveBeenCalled();
  });

  // Error handling tests
  it('displays ConnectionStatus with error on failed connection', async () => {
    const user = userEvent.setup();
    mockUseDiscovery.peers = [mockPeer];
    mockUseClientConnection.connect.mockResolvedValue(false);
    mockUseClientConnection.error = 'Connection timeout';

    render(<ClientModeFlow />);

    // Select peer and connect
    const peerButton = screen.getByRole('button', { name: /alice-gateway/i });
    await user.click(peerButton);

    const connectButton = await screen.findByRole('button', { name: /connect/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Connection timeout');
    });
  });

  // Edge cases
  it('handles empty peer list', () => {
    mockUseDiscovery.peers = [];
    render(<ClientModeFlow />);
    expect(screen.getByTestId('discovery-list')).toBeInTheDocument();
  });

  it('handles multiple peers', () => {
    const peer2: DiscoveredPeer = {
      ...mockPeer,
      pubkey: '02def456',
      petname: 'bob-gateway',
      address: '192.168.1.101:3000',
    };

    mockUseDiscovery.peers = [mockPeer, peer2];
    render(<ClientModeFlow />);

    expect(screen.getByRole('button', { name: /alice-gateway/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bob-gateway/i })).toBeInTheDocument();
  });
});
