"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Scale,
  ArrowLeft,
  CalendarClock,
  AlertTriangle,
  Mail,
  Loader2,
  Trash2,
  Check,
  PlayCircle,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Deadline {
  _id: string;
  documentId: string;
  documentName: string;
  deadlineDate: string;
  eventLabel: string;
  eventLabelEn: string;
  eventType: string;
  urgency: string;
  status: string;
  daysRemaining: number;
  notificationsSent?: Record<string, string>;
}

interface NotifierHealth {
  enabled: boolean;
  smtpConfigured: boolean;
  intervalHours: number;
  lookaheadDays: number;
}

function severityClasses(urgency: string, days: number): string {
  if (days <= 1) return "border-red-500/40 bg-red-500/5 text-red-300";
  if (days <= 3) return "border-amber-500/40 bg-amber-500/5 text-amber-200";
  if (days <= 7) return "border-amber-500/30 bg-amber-500/5 text-amber-300/90";
  if (urgency === "critical") return "border-red-500/40 bg-red-500/5 text-red-300";
  if (urgency === "important") return "border-amber-500/30 bg-amber-500/5 text-amber-300/90";
  return "border-slate-700 bg-slate-900/40 text-slate-300";
}

export default function DeadlinesPage() {
  const api = useApi();
  const [items, setItems] = useState<Deadline[] | null>(null);
  const [health, setHealth] = useState<NotifierHealth | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const path = showAll ? "/api/deadlines/all" : "/api/deadlines";
      const { data } = await api.get(path, { params: { lookahead_days: 365 } });
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  }, [api, showAll]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/deadlines/health");
        setHealth(data);
      } catch {
        // ignore
      }
    })();
  }, [api]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      await api.post(`/api/deadlines/${id}/dismiss`);
      setItems((prev) => (prev || []).filter((d) => d._id !== id));
      showToast("Reminder dismiss kar diya.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api.delete(`/api/deadlines/${id}`);
      setItems((prev) => (prev || []).filter((d) => d._id !== id));
      showToast("Reminder delete ho gaya.");
    } finally {
      setBusyId(null);
    }
  }

  async function runScanNow() {
    setRunning(true);
    try {
      const { data } = await api.post("/api/deadlines/run-now");
      const s = data.summary || {};
      showToast(
        `Scan complete — checked ${s.checked || 0}, sent ${s.emails_sent || 0} email(s), ${s.expired || 0} expired.`,
      );
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Scan failed.");
    } finally {
      setRunning(false);
    }
  }

  async function sendTestEmail() {
    try {
      const { data } = await api.post("/api/deadlines/test-email");
      showToast(data.sent ? `Test email bhej diya: ${data.to}` : "SMTP fail — backend logs check karo.");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Test email failed.");
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="relative z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 hidden sm:flex">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </div>
            <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <Scale className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              LegalSaathi<span className="text-amber-500">.</span>
            </span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main className="container py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              <CalendarClock className="w-8 h-8 text-amber-500" />
              Deadlines & Reminders
            </h1>
            <p className="mt-2 text-slate-400 max-w-2xl">
              LegalSaathi har upload se important dates pick karta hai aur 7 din, 3 din,
              1 din pehle email reminder bhejta hai.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll((v) => !v)}
              className="border-slate-700 bg-slate-900/50"
            >
              {showAll ? "Show upcoming only" : "Show all (incl. expired)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runScanNow}
              disabled={running}
              className="border-slate-700 bg-slate-900/50"
            >
              {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1" />}
              Scan now
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestEmail}
              className="border-slate-700 bg-slate-900/50"
            >
              <Mail className="w-4 h-4 mr-1" /> Test email
            </Button>
          </div>
        </div>

        {health && (
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${health.enabled ? "bg-emerald-500" : "bg-slate-500"}`} />
                Notifier {health.enabled ? "ON" : "OFF"}
              </span>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${health.smtpConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
                SMTP {health.smtpConfigured ? "configured" : "not configured (no emails)"}
              </span>
              <span className="text-slate-400">
                Scan every <strong className="text-white">{health.intervalHours}h</strong>
              </span>
              <span className="text-slate-400">
                Lookahead <strong className="text-white">{health.lookaheadDays}d</strong>
              </span>
            </CardContent>
          </Card>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-amber-500/40 bg-slate-900/90 px-4 py-3 text-sm text-amber-200 shadow-lg backdrop-blur">
            {toast}
          </div>
        )}

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">
              {showAll ? "All reminders" : "Upcoming"} ({items?.length ?? "…"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items === null && <p className="text-sm text-slate-400">Loading…</p>}
            {items && items.length === 0 && (
              <p className="text-sm text-slate-400">
                Abhi koi reminder nahi. Koi document upload karo aur jiske andar dates honge unko track karenge.
              </p>
            )}
            {items && items.length > 0 && (
              <ul className="space-y-3">
                {items.map((d) => {
                  const days = d.daysRemaining;
                  const cls = severityClasses(d.urgency, days);
                  return (
                    <li
                      key={d._id}
                      className={`rounded-lg border p-4 ${cls} ${d.status !== "active" ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {days <= 1 && d.status === "active" && (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            <h3 className="font-semibold">
                              {d.eventLabelEn || d.eventLabel || "Untitled deadline"}
                            </h3>
                            <span className="text-xs uppercase opacity-60">{d.eventType}</span>
                          </div>
                          {d.eventLabel && d.eventLabelEn && d.eventLabel !== d.eventLabelEn && (
                            <p className="mt-1 text-xs opacity-80">{d.eventLabel}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
                            <span>
                              <strong>{new Date(d.deadlineDate).toDateString()}</strong>
                            </span>
                            <Link
                              href={`/dashboard/${d.documentId}`}
                              className="underline hover:no-underline"
                            >
                              {d.documentName}
                            </Link>
                            {d.notificationsSent && Object.keys(d.notificationsSent).length > 0 && (
                              <span>
                                Sent: {Object.keys(d.notificationsSent).join(", ")}
                              </span>
                            )}
                            <span>Status: <strong>{d.status}</strong></span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="rounded-full bg-slate-950/50 px-3 py-1 text-xs font-bold">
                            {days < 0 ? "expired" : days === 0 ? "Today" : `${days} day${days > 1 ? "s" : ""}`}
                          </span>
                          <div className="flex gap-1">
                            {d.status === "active" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => dismiss(d._id)}
                                disabled={busyId === d._id}
                                className="h-7 px-2 text-current hover:bg-white/10"
                                title="Dismiss"
                              >
                                {busyId === d._id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(d._id)}
                              disabled={busyId === d._id}
                              className="h-7 px-2 text-current hover:bg-red-500/20"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
