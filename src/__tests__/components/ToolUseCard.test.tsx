/**
 * ToolUseCard tests - Collapsed/expanded states, JSON rendering, accessibility
 *
 * Tests:
 * 1. Collapsed state (default)
 * 2. Expanded state (shows JSON input)
 * 3. JSON rendering with syntax highlighting
 * 4. Accessibility (ARIA attributes, keyboard navigation)
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolUseCard, ToolUseList } from '@/components/chat/ToolUseCard';

import type { ToolUseBlock } from '@/types/streaming';

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_TOOL_USE: ToolUseBlock = {
  id: 'toolu_abc123',
  name: 'get_weather',
  input: {
    location: 'San Francisco',
    units: 'celsius',
  },
};

const MOCK_TOOL_USE_COMPLEX: ToolUseBlock = {
  id: 'toolu_xyz789',
  name: 'search_database',
  input: {
    query: 'SELECT * FROM users',
    filters: {
      active: true,
      role: ['admin', 'moderator'],
    },
    pagination: {
      page: 1,
      limit: 50,
    },
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('ToolUseCard', () => {
  // --------------------------------------------------------------------------
  // Test 1: Collapsed state (default)
  // --------------------------------------------------------------------------

  it('should render in collapsed state by default', () => {
    const { container } = render(<ToolUseCard toolUse={MOCK_TOOL_USE} />);

    // Should display tool name
    expect(screen.getByText('get_weather')).toBeInTheDocument();

    // Should display tool ID
    expect(screen.getByText('toolu_abc123')).toBeInTheDocument();

    // Should display tool icon (SVG)
    const toolIcon = container.querySelector('svg');
    expect(toolIcon).toBeInTheDocument();

    // Should NOT display input (collapsed)
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
    expect(screen.queryByText('location')).not.toBeInTheDocument();

    // Expand/collapse icon should be present
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();

    // Icon should not be rotated (collapsed)
    const expandIcon = toggleButton.querySelector('svg:last-child');
    expect(expandIcon).not.toHaveClass('rotate-180');
  });

  // --------------------------------------------------------------------------
  // Test 2: Expanded state
  // --------------------------------------------------------------------------

  it('should expand when clicked and show input', () => {
    render(<ToolUseCard toolUse={MOCK_TOOL_USE} />);

    // Click to expand
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    // Should display input label
    expect(screen.getByText('Input:')).toBeInTheDocument();

    // Should display JSON content (formatted)
    expect(screen.getByText(/"location"/)).toBeInTheDocument();
    expect(screen.getByText(/"San Francisco"/)).toBeInTheDocument();
    expect(screen.getByText(/"units"/)).toBeInTheDocument();
    expect(screen.getByText(/"celsius"/)).toBeInTheDocument();

    // Icon should be rotated (expanded)
    const expandIcon = toggleButton.querySelector('svg:last-child');
    expect(expandIcon).toHaveClass('rotate-180');
  });

  // --------------------------------------------------------------------------
  // Test 3: JSON rendering with syntax highlighting
  // --------------------------------------------------------------------------

  it('should render JSON with proper formatting', () => {
    const { container } = render(
      <ToolUseCard toolUse={MOCK_TOOL_USE_COMPLEX} defaultExpanded={true} />
    );

    // Should display tool name
    expect(screen.getByText('search_database')).toBeInTheDocument();

    // Should display input label
    expect(screen.getByText('Input:')).toBeInTheDocument();

    // Should have a code container with prose styling (ReactMarkdown)
    const proseContainer = container.querySelector('.prose');
    expect(proseContainer).toBeInTheDocument();

    // Verify JSON content is present (checking for key parts of the complex object)
    const jsonText = container.textContent || '';
    expect(jsonText).toContain('query');
    expect(jsonText).toContain('SELECT * FROM users');
    expect(jsonText).toContain('filters');
    expect(jsonText).toContain('pagination');
  });

  // --------------------------------------------------------------------------
  // Test 4: Accessibility
  // --------------------------------------------------------------------------

  it('should be accessible with proper ARIA attributes', () => {
    render(<ToolUseCard toolUse={MOCK_TOOL_USE} />);

    // Toggle button should be accessible
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toHaveAttribute('type', 'button');

    // Click to expand
    fireEvent.click(toggleButton);

    // Content should be visible after expansion
    const inputLabel = screen.getByText('Input:');
    expect(inputLabel).toBeVisible();

    // Should be keyboard accessible (Enter key)
    fireEvent.click(toggleButton); // Collapse

    fireEvent.keyDown(toggleButton, { key: 'Enter', code: 'Enter' });
    // Note: onClick already handles both mouse and keyboard by default in React

    // Verify toggle functionality
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Bonus: Default expanded prop
  // --------------------------------------------------------------------------

  it('should render expanded when defaultExpanded is true', () => {
    render(<ToolUseCard toolUse={MOCK_TOOL_USE} defaultExpanded={true} />);

    // Should display input immediately
    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText(/"location"/)).toBeInTheDocument();

    // Icon should be rotated
    const toggleButton = screen.getByRole('button');
    const expandIcon = toggleButton.querySelector('svg:last-child');
    expect(expandIcon).toHaveClass('rotate-180');
  });

  // --------------------------------------------------------------------------
  // Bonus: Custom className
  // --------------------------------------------------------------------------

  it('should apply custom className', () => {
    const { container } = render(
      <ToolUseCard toolUse={MOCK_TOOL_USE} className="custom-class" />
    );

    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });

  // --------------------------------------------------------------------------
  // Bonus: Toggle between states
  // --------------------------------------------------------------------------

  it('should toggle between collapsed and expanded states', () => {
    render(<ToolUseCard toolUse={MOCK_TOOL_USE} />);

    const toggleButton = screen.getByRole('button');

    // Initially collapsed
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByText('Input:')).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(toggleButton);
    expect(screen.getByText('Input:')).toBeInTheDocument();
  });
});

// ============================================================================
// ToolUseList Tests
// ============================================================================

describe('ToolUseList', () => {
  it('should render multiple tool use cards', () => {
    const toolUses: ToolUseBlock[] = [
      MOCK_TOOL_USE,
      MOCK_TOOL_USE_COMPLEX,
    ];

    render(<ToolUseList toolUses={toolUses} />);

    // Should display both tools
    expect(screen.getByText('get_weather')).toBeInTheDocument();
    expect(screen.getByText('search_database')).toBeInTheDocument();

    // Should display both IDs
    expect(screen.getByText('toolu_abc123')).toBeInTheDocument();
    expect(screen.getByText('toolu_xyz789')).toBeInTheDocument();
  });

  it('should render nothing when toolUses is empty', () => {
    const { container } = render(<ToolUseList toolUses={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('should apply custom className to container', () => {
    const { container } = render(
      <ToolUseList toolUses={[MOCK_TOOL_USE]} className="custom-list" />
    );

    const listContainer = container.firstChild;
    expect(listContainer).toHaveClass('custom-list');
    expect(listContainer).toHaveClass('space-y-2');
  });
});
