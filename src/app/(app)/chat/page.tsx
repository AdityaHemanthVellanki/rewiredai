"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const quickActions = [
  "What's due this week?",
  "Auto-schedule my study time",
  "Check my grades",
  "Sync my Canvas",
  "What should I focus on right now?",
  "Check my emails",
  "I'm stressed, help me plan",
  "What grade do I need on my next exam?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/agent/chat?history=true");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {
        // ignore
      }
      setIsInitialized(true);
    }
    loadHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            // Parse SSE lines
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    assistantMessage.content += parsed.content;
                    setMessages((prev) => [
                      ...prev.slice(0, -1),
                      { ...assistantMessage },
                    ]);
                  }
                } catch {
                  // Not JSON, treat as plain text
                  assistantMessage.content += data;
                  setMessages((prev) => [
                    ...prev.slice(0, -1),
                    { ...assistantMessage },
                  ]);
                }
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Try again?",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col md:h-[calc(100vh-3rem)]">
      {/* Chat messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {!isInitialized ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
              <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Chat with Rewired</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask me anything about your academic life. I&apos;m here to help.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="rounded-full border border-border/50 bg-card px-4 py-2 text-sm transition-colors hover:border-purple-500/30 hover:bg-purple-500/5"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-card border border-border/50"
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border/50 bg-card px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Quick actions below chat when there are messages */}
      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="shrink-0 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs transition-colors hover:border-purple-500/30"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/50 p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Rewired anything..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
