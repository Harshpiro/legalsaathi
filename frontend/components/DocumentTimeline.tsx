"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Clock,
  AlertTriangle,
  Calendar,
  Gavel,
  FileText,
  Timer,
  Bell,
  CheckCircle,
} from "lucide-react";

interface TimelineEvent {
  date: string;
  event: string;
  event_en: string;
  type: string;
  urgency: string;
  days_from_now: number | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  hearing: <Gavel className="w-4 h-4" />,
  deadline: <AlertTriangle className="w-4 h-4" />,
  filing: <FileText className="w-4 h-4" />,
  execution: <CheckCircle className="w-4 h-4" />,
  notice_period: <Timer className="w-4 h-4" />,
  agreement_start: <Calendar className="w-4 h-4" />,
  agreement_end: <Calendar className="w-4 h-4" />,
  incident: <Bell className="w-4 h-4" />,
};

const urgencyStyles: Record<string, { border: string; bg: string; text: string; dot: string; glow: string }> = {
  critical: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-500",
    glow: "shadow-red-500/30",
  },
  important: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-500",
    glow: "shadow-amber-500/30",
  },
  informational: {
    border: "border-slate-600/40",
    bg: "bg-slate-800/50",
    text: "text-slate-400",
    dot: "bg-slate-500",
    glow: "",
  },
};

function CountdownBadge({ days }: { days: number | null }) {
  if (days === null || days === undefined) return null;

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700">
        <CheckCircle className="w-3 h-3" />
        {Math.abs(days)} din pehle
      </span>
    );
  }

  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        AAJ!
      </span>
    );
  }

  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
        <Timer className="w-3 h-3" />
        {days} din baaki
      </span>
    );
  }

  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <Timer className="w-3 h-3" />
        {days} din baaki
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <Clock className="w-3 h-3" />
      {days} din baaki
    </span>
  );
}

interface DocumentTimelineProps {
  documentId: string;
}

export function DocumentTimeline({ documentId }: DocumentTimelineProps) {
  const api = useApi();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/documents/${documentId}/timeline`);
        setEvents(data.events || []);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Timeline load nahi hua");
      } finally {
        setLoading(false);
      }
    })();
  }, [api, documentId]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Dates aur deadlines nikaal raha hoon…</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="flex items-center justify-center h-[300px]">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <Calendar className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-muted-foreground">
            Is document mein koi specific dates ya deadlines nahi mile.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-5 h-5 text-amber-500" />
          Document Timeline
          <span className="text-xs font-normal text-muted-foreground ml-2">
            {events.length} events
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-amber-500/50 via-slate-700 to-slate-800" />

          <div className="space-y-4">
            {events.map((ev, i) => {
              const style = urgencyStyles[ev.urgency] || urgencyStyles.informational;
              const isPast = ev.days_from_now !== null && ev.days_from_now < 0;
              const isToday = ev.days_from_now === 0;
              const isFuture = ev.days_from_now !== null && ev.days_from_now > 0;

              return (
                <div key={i} className={`relative flex gap-4 ${isPast ? "opacity-60" : ""}`}>
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${style.border} ${style.bg} ${
                        isToday ? "animate-pulse" : ""
                      } ${isFuture ? `shadow-lg ${style.glow}` : ""}`}
                    >
                      <span className={style.text}>
                        {typeIcons[ev.type] || <Calendar className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Event content */}
                  <div
                    className={`flex-1 rounded-lg border p-3 ${style.border} ${style.bg} transition-all hover:scale-[1.01]`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {ev.date || "Date unknown"}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                          {ev.type.replace("_", " ")}
                        </span>
                      </div>
                      <CountdownBadge days={ev.days_from_now} />
                    </div>
                    <p className={`text-sm font-medium ${isPast ? "text-slate-500" : "text-white"}`}>
                      {ev.event}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{ev.event_en}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
