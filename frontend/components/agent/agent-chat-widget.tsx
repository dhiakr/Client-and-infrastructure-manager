"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bot, CheckCircle2, Loader2, Send, Sparkles, TriangleAlert, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { cn } from "@/lib/cn";
import { chatWithAgent, getErrorMessage, isUnauthorizedError } from "@/services/api";
import type { AgentAction, AgentActionResult, AgentChatResponse } from "@/types/api";

type WidgetMessage =
  | {
      id: string;
      role: "user";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      imageAlt?: string;
      imageSrc?: string;
      prompt?: string;
      response?: AgentChatResponse;
      text: string;
      tone?: "default" | "error";
    };

function createMessageId() {
  return `${Date.now()}-${Math.random()}`;
}

function formatActionLabel(action: AgentAction) {
  return action.action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatActionParams(params: Record<string, unknown>) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (!entries.length) return "No parameters";

  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" • ");
}

function getStatusTone(status: AgentChatResponse["status"]) {
  if (status === "executed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "requires_confirmation") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)]";
}

function getResultTone(result: AgentActionResult["status"]) {
  if (result === "deleted" || result === "removed") {
    return "border-rose-200 bg-rose-50";
  }

  if (result === "updated" || result === "resolved") {
    return "border-amber-200 bg-amber-50";
  }

  return "border-emerald-200 bg-emerald-50";
}

export function AgentChatWidget() {
  const { signOut, token, user } = useSession();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>(() => [
    {
      id: createMessageId(),
      imageAlt: "Operations assistant placeholder",
      imageSrc: "/Jim.jpg",
      role: "assistant",
      text: "",
    },
  ]);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, open]);

  if (!user || !token) return null;

  async function runAgent(
    prompt: string,
    mode: "plan" | "execute",
    options?: { confirmed?: boolean; appendUserMessage?: boolean }
  ) {
    if (!token) return;

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    const appendUserMessage = options?.appendUserMessage ?? true;

    if (appendUserMessage) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          role: "user",
          text: trimmedPrompt,
        },
      ]);
      setInput("");
    }

    setOpen(true);
    setPending(true);

    try {
      const response = await chatWithAgent(token, {
        confirmed: options?.confirmed,
        message: trimmedPrompt,
        mode,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          prompt: trimmedPrompt,
          response,
          role: "assistant",
          text: response.assistant_message,
        },
      ]);

      if (response.status === "executed") {
        pushToast({
          title: "Agent execution finished",
          description: response.assistant_message,
          tone: "success",
        });
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      const message = getErrorMessage(error);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          prompt: trimmedPrompt,
          role: "assistant",
          text: message,
          tone: "error",
        },
      ]);
      pushToast({
        title: "Agent request failed",
        description: message,
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }

  function handleComposerSubmit(mode: "plan" | "execute") {
    void runAgent(input, mode);
  }

  function handleConfirm(prompt: string) {
    void runAgent(prompt, "execute", { appendUserMessage: false, confirmed: true });
  }

  const assistantBannerText = "A feature nobody asked for but it's cool to have.";

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <Card className="pointer-events-auto flex h-[min(42rem,calc(100vh-5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[2rem] border-[color:var(--border-strong)] shadow-[0_28px_70px_rgba(15,23,42,0.2)]">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-white shadow-[0_14px_28px_rgba(11,99,246,0.22)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    Operations Assistant
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Backend agent for {user.role === "admin" ? "admin" : "scoped"} actions
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-[color:var(--muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)]"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={messageViewportRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isImageMessage = !isUser && Boolean(message.imageSrc);

              return (
                <div
                  key={message.id}
                  className={cn("flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-3xl border px-4 py-3 shadow-sm",
                      isImageMessage
                        ? "overflow-hidden border-transparent bg-white/70 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                        : isUser
                          ? "border-(--primary) bg-(--primary) text-white"
                          : message.tone === "error"
                            ? "border-rose-200 bg-rose-50 text-rose-900"
                            : "border-(--border) bg-(--surface) text-foreground"
                    )}
                  >
                    {message.role === "assistant" && message.imageSrc ? (
                      <div className="overflow-hidden rounded-[1.125rem]">
                        <Image
                          src={message.imageSrc}
                          alt={message.imageAlt ?? "Assistant image"}
                          width={320}
                          height={200}
                          className="h-auto w-full"
                          priority
                        />
                      </div>
                    ) : null}

                    {message.text ? <p className="text-sm leading-6">{message.text}</p> : null}

                    {message.role === "assistant" && message.response ? (
                      <div className="mt-3 space-y-3">
                        <div
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                            getStatusTone(message.response.status)
                          )}
                        >
                          {message.response.status === "planned"
                            ? "Plan ready"
                            : message.response.status === "requires_confirmation"
                              ? "Needs confirmation"
                              : "Executed"}
                        </div>

                        {message.response.plan.notes.length ? (
                          <Alert
                            description={
                              <ul className="space-y-1">
                                {message.response.plan.notes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            }
                            title="Planner notes"
                            tone="info"
                          />
                        ) : null}

                        {message.response.plan.actions.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                              Planned actions
                            </p>
                            {message.response.plan.actions.map((action, index) => (
                              <div
                                key={`${message.id}-${index}-${action.action}`}
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
                              >
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {formatActionLabel(action)}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                                  {formatActionParams(action.params)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {message.response.results.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">
                              Execution results
                            </p>
                            {message.response.results.map((result, index) => (
                              <div
                                key={`${message.id}-result-${index}-${result.action}`}
                                className={cn(
                                  "rounded-2xl border px-3 py-2",
                                  getResultTone(result.status)
                                )}
                              >
                                <p className="text-sm font-semibold text-slate-900">
                                  {result.message}
                                </p>
                                {result.reference?.name ? (
                                  <p className="mt-1 text-xs text-slate-600">
                                    {result.reference.name}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {message.response.status === "requires_confirmation" && message.prompt ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(message.prompt!)}
                              disabled={pending}
                            >
                              {pending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Confirm and run
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {pending ? (
              <div className="flex justify-start">
                <div className="flex max-w-[90%] items-center gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Working on your request...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
            <Textarea
              className="min-h-28 resize-none"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask the backend agent to create or manage workspace records..."
              value={input}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                <TriangleAlert className="h-3.5 w-3.5" />
                Deletes and project moves require confirmation.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={() => handleComposerSubmit("plan")}
                  disabled={!input.trim() || pending}
                >
                  Plan
                </Button>
                <Button
                  size="sm"
                  icon={
                    pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )
                  }
                  onClick={() => handleComposerSubmit("execute")}
                  disabled={!input.trim() || pending}
                >
                  Run
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="pointer-events-auto flex items-end gap-3">
        {bannerVisible ? (
          <div className="flex w-[min(18rem,calc(100vw-6.5rem))] items-start gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-white/92 px-4 py-3 text-sm leading-5 text-[color:var(--foreground)] shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <p className="flex-1">{assistantBannerText}</p>
            <button
              type="button"
              className="rounded-xl p-1 text-[color:var(--muted)] transition hover:bg-slate-100 hover:text-[color:var(--foreground)]"
              onClick={() => setBannerVisible(false)}
              aria-label="Dismiss assistant banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow-[0_20px_40px_rgba(11,99,246,0.3)] transition hover:border-[color:var(--primary-strong)] hover:bg-[color:var(--primary-strong)]"
          onClick={() => setOpen((currentValue) => !currentValue)}
          aria-label={open ? "Close operations assistant" : "Open operations assistant"}
        >
          {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
