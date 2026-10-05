"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, ArrowRight, AlertTriangle } from "lucide-react";
import { useApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Deadline {
  _id: string;
  documentId: string;
  documentName: string;
  deadlineDate: string;
  eventLabel: string;
  eventLabelEn: string;
  urgency: string;
  daysRemaining: number;
}

function urgencyColor(urgency: string, days: number): string {
  if (days <= 1) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (days <= 7) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  if (urgency === "critical") return "text-red-400 bg-red-500/10 border-red-500/30";
  if (urgency === "important") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-blue-400 bg-blue-500/10 border-blue-500/30";
}

export function DeadlinesWidget() {
  const api = useApi();
  const [items, setItems] = useState<Deadline[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/deadlines", { params: { lookahead_days: 30 } });
        if (!cancelled) setItems((data.items || []).slice(0, 3));
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            <CalendarClock className="w-4 h-4 text-amber-500" />
          </div>
          <span>Upcoming deadlines</span>
        </CardTitle>
        <Link
          href="/dashboard/deadlines"
          className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {items === null && <p className="text-sm text-slate-400">Loading…</p>}
        {items && items.length === 0 && (
          <p className="text-sm text-slate-400">
            Koi upcoming deadline nahi. Document upload karo — dates auto-detect honge.
          </p>
        )}
        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((d) => (
              <li
                key={d._id}
                className={`flex items-center justify-between gap-3 rounded-md border p-3 ${urgencyColor(d.urgency, d.daysRemaining)}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {d.daysRemaining <= 1 && <AlertTriangle className="w-3.5 h-3.5" />}
                    <span className="truncate">{d.eventLabelEn || d.eventLabel}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs opacity-80">
                    {d.documentName} · {new Date(d.deadlineDate).toDateString()}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold">
                  {d.daysRemaining === 0 ? "Today" : `${d.daysRemaining}d`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
