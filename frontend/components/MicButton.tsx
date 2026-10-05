"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type MicState = "idle" | "listening" | "processing";

interface MicButtonProps {
  /** Called with the final transcript when speech recognition finishes. */
  onTranscript: (text: string) => void;
  /** Language synced from ChatInterface's language toggle. */
  language: "hindi" | "english";
  disabled?: boolean;
}

/**
 * Voice input button using Web Speech API.
 * Supports Hindi (hi-IN) and English (en-IN).
 * 3 visual states: idle → listening (pulse rings + waveform) → processing.
 */
export function MicButton({ onTranscript, language, disabled }: MicButtonProps) {
  const [state, setState] = useState<MicState>("idle");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  // Check browser support on mount
  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    stopListening();

    const recognition = new SR();
    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";

    recognition.lang = language === "hindi" ? "hi-IN" : "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final || interim;
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      // "no-speech" is expected after silence timeout
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setState("idle");
      }
    };

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim();
      if (text) {
        setState("processing");
        // Brief processing state to show visual feedback
        setTimeout(() => {
          onTranscript(text);
          setState("idle");
        }, 400);
      } else {
        setState("idle");
      }
      recognitionRef.current = null;
    };

    recognition.start();
  }, [language, onTranscript, stopListening]);

  const handleClick = useCallback(() => {
    if (state === "listening") {
      stopListening();
    } else if (state === "idle") {
      startListening();
    }
  }, [state, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  // Don't render if browser doesn't support speech recognition
  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={disabled || state === "processing"}
      className={`relative shrink-0 transition-all duration-300 ${
        state === "listening"
          ? "border-amber-500 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400"
          : state === "processing"
          ? "border-slate-600 text-slate-400"
          : "border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-500"
      }`}
      title={
        state === "listening"
          ? "Sunna band karo"
          : language === "hindi"
          ? "Hindi mein bolein"
          : "Speak in English"
      }
    >
      {/* Pulse rings when listening */}
      {state === "listening" && (
        <>
          <span className="mic-pulse-ring mic-pulse-ring-1" />
          <span className="mic-pulse-ring mic-pulse-ring-2" />
          <span className="mic-pulse-ring mic-pulse-ring-3" />
        </>
      )}

      {/* Waveform bars when listening */}
      {state === "listening" && (
        <span className="absolute inset-0 flex items-center justify-center gap-[2px] pointer-events-none">
          <span className="mic-waveform-bar mic-wave-1" />
          <span className="mic-waveform-bar mic-wave-2" />
          <span className="mic-waveform-bar mic-wave-3" />
          <span className="mic-waveform-bar mic-wave-4" />
          <span className="mic-waveform-bar mic-wave-5" />
        </span>
      )}

      {/* Icon */}
      {state === "processing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "listening" ? (
        <MicOff className="h-4 w-4 relative z-10" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
