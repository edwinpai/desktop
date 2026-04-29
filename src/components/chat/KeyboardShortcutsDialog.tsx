import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string;
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "Cmd" : "Ctrl";

const categories: ShortcutCategory[] = [
  {
    name: "Chat",
    shortcuts: [
      { keys: `${mod}+Enter`, description: "Send message" },
      { keys: "Shift+Enter", description: "New line in input" },
      { keys: "Escape", description: "Stop streaming / Close dialog" },
      { keys: `${mod}+K`, description: "Search messages" },
      { keys: `${mod}+Shift+F`, description: "Toggle focus mode" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: "?", description: "Show keyboard shortcuts" },
      { keys: `${mod}+,`, description: "Open settings" },
    ],
  },
  {
    name: "Sessions",
    shortcuts: [
      { keys: `${mod}+N`, description: "New session" },
    ],
  },
];

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-mono font-medium rounded border border-border bg-muted text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <ShortcutKey>{part}</ShortcutKey>
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts for EdwinPAI Desktop.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-medium text-foreground mb-2">
                {category.name}
              </h3>
              <div className="space-y-1.5">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
