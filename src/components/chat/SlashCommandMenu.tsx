import { useState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
}

const BUILT_IN_COMMANDS: SlashCommand[] = [
  { name: "/agent", description: "Switch agent", args: "[id]" },
  { name: "/model", description: "Switch model", args: "[provider/model]" },
  { name: "/session", description: "Switch session", args: "[key]" },
  { name: "/new", description: "Create new session" },
  { name: "/reset", description: "Reset current session" },
  { name: "/think", description: "Set thinking level", args: "[off|low|medium|high]" },
  { name: "/verbose", description: "Toggle verbose output", args: "[off|on|full]" },
  { name: "/reasoning", description: "Toggle reasoning display", args: "[off|on]" },
  { name: "/status", description: "Show gateway status" },
  { name: "/abort", description: "Abort active run" },
  { name: "/help", description: "Show available commands" },
];

interface SlashCommandMenuProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  visible: boolean;
  extraCommands?: SlashCommand[];
}

export function SlashCommandMenu({
  query,
  onSelect,
  onClose,
  visible,
  extraCommands = [],
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const allCommands = [...BUILT_IN_COMMANDS, ...extraCommands];
  const filtered = query
    ? allCommands.filter((cmd) =>
        cmd.name.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSelectedIndex(0), 0);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const item = menu.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-1 w-80 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md z-50"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent",
            i === selectedIndex && "bg-accent"
          )}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="font-mono font-medium text-primary">{cmd.name}</span>
          {cmd.args && (
            <span className="text-xs text-muted-foreground">{cmd.args}</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground truncate max-w-[150px]">
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  );
}

export { BUILT_IN_COMMANDS };
