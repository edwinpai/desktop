/**
 * useTalkMode — Voice conversation state machine
 *
 * Flow: idle -> listening -> processing -> speaking -> idle
 *
 * - listening:   MediaRecorder captures mic audio (webm/opus)
 * - processing:  Audio sent as attachment via chat.send; gateway transcribes + LLM responds
 * - speaking:    TTS converts reply to audio, useAudioPlayback plays it
 *
 * The gateway's media-understanding pipeline auto-transcribes audio attachments
 * before passing to the LLM, so we don't need client-side STT.
 */

import { useCallback, useRef, useState } from "react";

import { useAudioPlayback } from "./useAudioPlayback";

export type TalkPhase = "idle" | "listening" | "processing" | "speaking";

export interface UseTalkModeOpts {
  /** Send a chat message with attachments */
  onSendMessage: (
    message: string,
    opts?: {
      attachments?: Array<{
        type?: string;
        mimeType: string;
        fileName: string;
        content: string;
      }>;
    },
  ) => void;
  /** Call a gateway RPC method */
  request: <T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
  /** Gateway kind for audio playback routing */
  gatewayKind?: "local" | "docker" | "remote";
  /** Auto-play TTS for voice-initiated messages */
  autoTts?: boolean;
}

export function useTalkMode({
  onSendMessage,
  request,
  gatewayKind = "local",
  autoTts = true,
}: UseTalkModeOpts) {
  const [phase, setPhase] = useState<TalkPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const waitingForReplyRef = useRef(false);

  const {
    play,
    stop: stopPlayback,
    isPlaying,
  } = useAudioPlayback({
    gatewayKind,
    onError: (err) => setError(`Playback error: ${err.message}`),
  });

  const stopMic = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          // Too short, probably accidental — go back to idle
          setPhase("idle");
          return;
        }

        setPhase("processing");
        waitingForReplyRef.current = autoTts;

        // Convert to base64 and send as attachment
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        onSendMessage("", {
          attachments: [
            {
              type: "audio",
              mimeType: mimeType.split(";")[0] ?? "audio/webm",
              fileName: "voice.webm",
              content: base64,
            },
          ],
        });
      };

      recorder.start(250); // collect in 250ms chunks
      setPhase("listening");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("Permission denied") ||
        msg.includes("NotAllowedError")
      ) {
        setError("Microphone access denied. Check system permissions.");
      } else {
        setError(`Mic error: ${msg}`);
      }
      setPhase("idle");
    }
  }, [onSendMessage, autoTts]);

  const stopListening = useCallback(() => {
    stopMic();
    // Phase transition happens in recorder.onstop handler
  }, [stopMic]);

  /**
   * Called when a final chat response arrives.
   * If we're in talk mode and auto-TTS is on, convert the reply to speech.
   */
  const onReplyReceived = useCallback(
    async (replyText: string) => {
      if (!waitingForReplyRef.current) return;
      waitingForReplyRef.current = false;

      if (!replyText.trim()) {
        setPhase("idle");
        return;
      }

      setPhase("speaking");
      try {
        const result = await request<{
          audioPath?: string;
          outputFormat?: string;
        }>("tts.convert", { text: replyText });

        if (result.audioPath) {
          await play(result.audioPath, result.outputFormat);
        }
      } catch (err) {
        setError(
          `TTS error: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setPhase("idle");
      }
    },
    [request, play],
  );

  /** Toggle talk mode: start listening or stop current activity */
  const toggle = useCallback(() => {
    switch (phase) {
      case "idle":
        startListening();
        break;
      case "listening":
        stopListening();
        break;
      case "speaking":
        stopPlayback();
        setPhase("idle");
        break;
      case "processing":
        // Can't cancel processing, just wait
        break;
    }
  }, [phase, startListening, stopListening, stopPlayback]);

  /** Hard reset to idle */
  const cancel = useCallback(() => {
    stopMic();
    stopPlayback();
    waitingForReplyRef.current = false;
    setPhase("idle");
    setError(null);
  }, [stopMic, stopPlayback]);

  return {
    phase,
    error,
    isPlaying,
    toggle,
    cancel,
    startListening,
    stopListening,
    onReplyReceived,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte === undefined) {
      throw new Error("Unexpected missing byte while encoding audio");
    }
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
