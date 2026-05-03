import { useEffect, useState, useRef } from "react";
import { Copy, Check } from "lucide-react";
import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from "shiki";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  children: string;
}

const CORE_LANGS: BundledLanguage[] = [
  "typescript",
  "javascript",
  "jsx",
  "tsx",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "json",
  "yaml",
  "toml",
  "xml",
  "html",
  "css",
  "scss",
  "bash",
  "sql",
  "graphql",
  "markdown",
  "dockerfile",
  "diff",
  "swift",
  "kotlin",
  "ruby",
  "php",
  "lua",
];

const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  rs: "rust",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  text: "plaintext",
};

const SUPPORTED_SET = new Set<string>([
  ...CORE_LANGS,
  ...Object.keys(LANG_ALIASES),
  "plaintext",
]);

function resolveLang(lang: string): string {
  const lower = lang.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

// Singleton highlighter — created once, reused across all CodeBlock instances
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: CORE_LANGS,
    });
  }
  return highlighterPromise;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<string>(children);
  const resolvedLang = resolveLang(language);

  useEffect(() => {
    codeRef.current = children;
    const code = children.replace(/\n$/, "");

    if (
      !SUPPORTED_SET.has(resolvedLang) &&
      !SUPPORTED_SET.has(language.toLowerCase())
    ) {
      const timeoutId = window.setTimeout(() => setHtml(null), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        const result = highlighter.codeToHtml(code, {
          lang: resolvedLang as BundledLanguage,
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
        });
        if (!cancelled && codeRef.current === children) {
          setHtml(result);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [children, resolvedLang, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group/code relative overflow-hidden rounded-md border border-border bg-slate-100 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 my-3">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-slate-200 px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {language}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="h-6 w-6 opacity-0 group-hover/code:opacity-100 transition-opacity"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Code content */}
      {html ? (
        <div
          className={cn(
            "overflow-x-auto bg-slate-100 text-sm text-slate-950 dark:bg-slate-950 dark:text-slate-100",
            "[&_pre]:!m-0 [&_pre]:p-4 [&_pre]:!bg-transparent",
            "[&_.shiki]:!bg-transparent [&_.shiki]:!text-slate-950 dark:[&_.shiki]:!text-slate-100",
            "[&_.shiki_span]:!text-slate-950 dark:[&_.shiki_span]:!text-slate-100",
            "[&_.dark]:hidden dark:[&_.light]:hidden dark:[&_.dark]:block",
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="m-0 overflow-x-auto bg-slate-100 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
          <code className="text-sm text-inherit">{children}</code>
        </pre>
      )}
    </div>
  );
}
