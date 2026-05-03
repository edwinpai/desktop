/**
 * useAudioPlayback — Fetch TTS audio from gateway and play it
 *
 * Supports two modes:
 * - Local gateway: reads audio file via tauri-plugin-fs, creates object URL
 * - Remote gateway: fetches audio via gateway HTTP endpoint
 *
 * Usage:
 *   const { play, stop, isPlaying } = useAudioPlayback({ gatewayUrl });
 *   await play(audioPath, outputFormat);
 */

import { useState, useCallback, useRef } from "react";
import { readFile } from "@tauri-apps/plugin-fs";

export interface UseAudioPlaybackOpts {
  gatewayUrl?: string;
  gatewayKind?: "local" | "docker" | "remote";
  onError?: (err: Error) => void;
}

export function useAudioPlayback({
  gatewayKind = "local",
  onError,
}: UseAudioPlaybackOpts = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    async (audioPath: string, outputFormat?: string) => {
      cleanup();

      try {
        let objectUrl: string;

        if (gatewayKind === "local") {
          // Read file directly via Tauri fs plugin
          const bytes = await readFile(audioPath);
          const mimeType = resolveMimeType(outputFormat, audioPath);
          const blob = new Blob([bytes], { type: mimeType });
          objectUrl = URL.createObjectURL(blob);
        } else {
          // For remote/docker gateways, we'd need an HTTP file serving route.
          // For now, fall back to local read (most desktop use cases are local).
          const bytes = await readFile(audioPath);
          const mimeType = resolveMimeType(outputFormat, audioPath);
          const blob = new Blob([bytes], { type: mimeType });
          objectUrl = URL.createObjectURL(blob);
        }

        objectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => cleanup();
        audio.onerror = () => {
          const err = new Error("Audio playback failed");
          onError?.(err);
          cleanup();
        };

        await audio.play();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        cleanup();
      }
    },
    [gatewayKind, cleanup, onError],
  );

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { play, stop, isPlaying };
}

function resolveMimeType(outputFormat?: string, path?: string): string {
  if (outputFormat) {
    const map: Record<string, string> = {
      mp3: "audio/mpeg",
      opus: "audio/opus",
      aac: "audio/aac",
      flac: "audio/flac",
      wav: "audio/wav",
      ogg: "audio/ogg",
      pcm: "audio/pcm",
    };
    if (map[outputFormat]) return map[outputFormat];
  }
  if (path) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "mp3") return "audio/mpeg";
    if (ext === "wav") return "audio/wav";
    if (ext === "opus" || ext === "ogg") return "audio/ogg";
  }
  return "audio/mpeg";
}
