"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Zap, Radio, MapPin } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useApi, apiUrl } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MicButton } from "@/components/MicButton";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface({ documentId }: { documentId: string }) {
  const api = useApi();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [language, setLanguage] = useState<"hindi" | "english">("hindi");
  const [selectedState, setSelectedState] = useState<string>("");
  const [availableStates, setAvailableStates] = useState<{key: string; name: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/chat/history/${documentId}`);
        setMessages(data.messages || []);
      } catch (e) {
        // first chat — no history yet, fine
      }
    })();
  }, [api, documentId]);

  // Load available states
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/jurisdiction/states");
        setAvailableStates(data.states || []);
      } catch {}
    })();
  }, [api]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamStatus]);

  async function send() {
    const question = input.trim();
    if (!question || sending) return;
    setSending(true);
    setStreamStatus(null);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");

    try {
      // Use SSE streaming endpoint
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (!DEV_MODE) {
        const token = await getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question,
          documentId,
          language,
          state: selectedState || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      // Add empty assistant message that we'll build up
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // Keep incomplete event in buffer

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;

          try {
            const payload = JSON.parse(line.slice(6));

            if (payload.type === "status") {
              setStreamStatus(payload.message);
            } else if (payload.type === "token") {
              assistantContent += payload.content;
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
              setStreamStatus(null);
            } else if (payload.type === "done") {
              setStreamStatus(null);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (e: any) {
      // Fallback to non-streaming endpoint
      try {
        const { data } = await api.post("/api/chat/ask", {
          question,
          documentId,
          language,
        });
        setMessages((m) => {
          // Remove the empty streaming message if it exists, or just add
          const filtered = m.filter((msg, i) => !(i === m.length - 1 && msg.role === "assistant" && msg.content === ""));
          return [...filtered, { role: "assistant", content: data.answer }];
        });
      } catch (fallbackErr: any) {
        setMessages((m) => {
          const filtered = m.filter((msg, i) => !(i === m.length - 1 && msg.role === "assistant" && msg.content === ""));
          return [
            ...filtered,
            { role: "assistant", content: `⚠️ ${fallbackErr?.response?.data?.detail ?? fallbackErr.message}` },
          ];
        });
      }
    } finally {
      setSending(false);
      setStreamStatus(null);
    }
  }

  return (
    <Card className="flex h-[600px] flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span>Chat — apne document se poochho</span>
          <Zap className="w-4 h-4 text-amber-500" />
        </CardTitle>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "hindi" | "english")}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          <option value="hindi">Hindi</option>
          <option value="english">English</option>
        </select>
      </CardHeader>
      {/* Jurisdiction selector */}
      <div className="px-6 pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs text-slate-300"
          >
            <option value="">All India (No state filter)</option>
            {availableStates.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Example: &ldquo;Eviction clause kya hai?&rdquo; ya &ldquo;Main rent kab badhaa sakta hoon?&rdquo;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          ))}
          {/* Streaming status indicator */}
          {streamStatus && (
            <div className="flex items-center gap-2 text-sm text-amber-500">
              <Radio className="h-4 w-4 animate-pulse" />
              <span className="animate-pulse">{streamStatus}</span>
            </div>
          )}
          {sending && !streamStatus && messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Apna sawaal likhein ya mic use karein…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex flex-col gap-1">
            <MicButton
              language={language}
              onTranscript={(text) => {
                setInput(text);
                // Auto-send after voice transcription
                setTimeout(() => {
                  const el = document.querySelector<HTMLButtonElement>("#chat-send-btn");
                  el?.click();
                }, 100);
              }}
              disabled={sending}
            />
            <Button id="chat-send-btn" onClick={send} disabled={sending || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
