import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownSidebarProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onResize?: (width: number) => void;
  initialWidth?: number;
}

const MIN_WIDTH = 250;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 400;

export function MarkdownSidebar({
  content,
  isOpen,
  onClose,
  onResize,
  initialWidth = DEFAULT_WIDTH,
}: MarkdownSidebarProps) {
  const [width, setWidth] = useState(
    Math.min(Math.max(initialWidth, MIN_WIDTH), MAX_WIDTH),
  );
  const isDragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      const clamped = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);
      setWidth(clamped);
      onResize?.(clamped);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize]);

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "fixed top-0 right-0 h-full bg-background border-l shadow-lg z-50",
        "flex flex-col transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-medium">Preview</h3>
        <button
          onClick={onClose}
          className="rounded-sm p-1 opacity-70 hover:opacity-100 hover:bg-muted transition-opacity"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono text-foreground">
          {content}
        </pre>
      </div>
    </div>
  );
}
