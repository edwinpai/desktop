/**
 * ToolUseCard - Collapsible card for tool use display
 *
 * Displays tool name and input with JSON syntax highlighting.
 * Uses react-markdown for code block rendering.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";

import type { ToolUseBlock } from "@/types/streaming";

// ============================================================================
// Component Props
// ============================================================================

interface ToolUseCardProps {
  /** Tool use block to display */
  toolUse: ToolUseBlock;

  /** Whether card is initially expanded */
  defaultExpanded?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Collapsible card displaying tool use information
 *
 * @example
 * ```tsx
 * <ToolUseCard
 *   toolUse={{
 *     id: 'toolu_abc123',
 *     name: 'get_weather',
 *     input: { location: 'San Francisco' }
 *   }}
 *   defaultExpanded={true}
 * />
 * ```
 */
export function ToolUseCard({
  toolUse,
  defaultExpanded = false,
  className = "",
}: ToolUseCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Format input as JSON
  const formattedInput = JSON.stringify(toolUse.input, null, 2);

  // Create markdown code block for syntax highlighting
  const markdownContent = `\`\`\`json\n${formattedInput}\n\`\`\``;

  return (
    <div
      className={`border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 ${className}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Tool icon */}
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>

          {/* Tool name */}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {toolUse.name}
          </span>

          {/* Tool ID (subtle) */}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {toolUse.id}
          </span>
        </div>

        {/* Expand/collapse icon */}
        <svg
          className={`w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {/* Input label */}
            <div className="mb-2 font-medium text-gray-900 dark:text-gray-100">
              Input:
            </div>

            {/* JSON input with syntax highlighting */}
            <div className="rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 overflow-x-auto prose prose-sm dark:prose-invert max-w-none p-3">
              <ReactMarkdown>{markdownContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Multi-Tool Display Component
// ============================================================================

interface ToolUseListProps {
  /** List of tool use blocks */
  toolUses: ToolUseBlock[];

  /** Additional CSS classes */
  className?: string;
}

/**
 * Display multiple tool use cards
 *
 * @example
 * ```tsx
 * <ToolUseList
 *   toolUses={[
 *     { id: '1', name: 'search', input: { query: 'weather' } },
 *     { id: '2', name: 'calculator', input: { expression: '2+2' } },
 *   ]}
 * />
 * ```
 */
export function ToolUseList({ toolUses, className = "" }: ToolUseListProps) {
  if (toolUses.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {toolUses.map((toolUse) => (
        <ToolUseCard key={toolUse.id} toolUse={toolUse} />
      ))}
    </div>
  );
}
