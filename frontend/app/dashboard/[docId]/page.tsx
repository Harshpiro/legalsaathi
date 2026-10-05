"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { apiUrl, useApi } from "@/lib/api";
import { SummaryCard } from "@/components/SummaryCard";
import { RiskList, Risk } from "@/components/RiskList";
import { ChatInterface } from "@/components/ChatInterface";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { DocumentTimeline } from "@/components/DocumentTimeline";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale, FileText, Network, Clock } from "lucide-react";

interface Doc {
  _id: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  docType: string;
  status: string;
  summary: string;
  risks: Risk[];
}

function absoluteFileUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/local-files/")) return `${apiUrl}${url}`;
  return url;
}

type TabKey = "summary" | "graph" | "timeline";

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "summary", label: "Summary & Risks", icon: <FileText className="w-4 h-4" /> },
  { key: "graph", label: "Knowledge Graph", icon: <Network className="w-4 h-4" /> },
  { key: "timeline", label: "Timeline", icon: <Clock className="w-4 h-4" /> },
];

export default function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const api = useApi();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get(`/api/documents/${docId}`);
        if (cancelled) return;
        setDoc(data);
        // Keep polling while backend is still processing the upload
        if (data.status === "processing" && !pollRef.current) {
          pollRef.current = setInterval(load, 3000);
        }
        if (data.status === "done" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.detail ?? e.message ?? "Failed to load");
      }
    }

    load();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [api, docId]);

  const fileHref = absoluteFileUrl(doc?.fileUrl);

  return (
    <div className="min-h-screen">
      <nav className="relative z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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

      <main className="container py-8">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {!doc && !error && <p className="text-sm text-muted-foreground">Loading document…</p>}
        {doc && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{doc.fileName}</h1>
              {fileHref && (
                <a href={fileHref} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    File kholein
                  </Button>
                </a>
              )}
            </div>

            {doc.status === "processing" && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground mb-6">
                Analysis chal raha hai… 10-30 second.
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content + Chat */}
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                {activeTab === "summary" && (
                  <>
                    <SummaryCard summary={doc.summary} docType={doc.docType} />
                    <RiskList risks={doc.risks || []} />
                  </>
                )}
                {activeTab === "graph" && (
                  <KnowledgeGraph documentId={doc._id} />
                )}
                {activeTab === "timeline" && (
                  <DocumentTimeline documentId={doc._id} />
                )}
              </div>
              <div className="lg:col-span-2">
                <ChatInterface documentId={doc._id} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
