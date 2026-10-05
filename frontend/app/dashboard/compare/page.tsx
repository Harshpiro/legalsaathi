"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Scale,
  ArrowLeft,
  GitCompareArrows,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

interface DocSummary {
  _id: string;
  fileName: string;
  docType: string;
  status: string;
}

interface ComparisonResult {
  doc1: { id: string; fileName: string };
  doc2: { id: string; fileName: string };
  added: { clause: string; summary: string }[];
  removed: { clause: string; summary: string }[];
  modified: { before: string; after: string; impact: string }[];
  new_risks: { clause: string; reason: string; severity: string }[];
  verdict: string;
  verdict_en: string;
  risk_score_change: string;
}

const severityStyle: Record<string, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

export default function ComparePage() {
  const api = useApi();
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [doc1Id, setDoc1Id] = useState("");
  const [doc2Id, setDoc2Id] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load user's documents for selection
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/documents/list");
        setDocs(data.filter((d: DocSummary) => d.status === "done"));
      } finally {
        setDocsLoading(false);
      }
    })();
  }, [api]);

  const compare = useCallback(async () => {
    if (!doc1Id || !doc2Id || doc1Id === doc2Id) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await api.post("/api/documents/compare", {
        doc_id_1: doc1Id,
        doc_id_2: doc2Id,
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [api, doc1Id, doc2Id]);

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

      <main className="container py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <GitCompareArrows className="w-8 h-8 text-amber-500" />
            Document Comparison
          </h1>
          <p className="mt-2 text-slate-400">
            Do documents compare karo — AI differences, new risks, aur overall assessment dikhayega.
          </p>
        </div>

        {/* Document Selection */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                  Document A (Original)
                </label>
                <select
                  value={doc1Id}
                  onChange={(e) => setDoc1Id(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white"
                  disabled={docsLoading}
                >
                  <option value="">Select document...</option>
                  {docs.map((d) => (
                    <option key={d._id} value={d._id} disabled={d._id === doc2Id}>
                      {d.fileName} ({d.docType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-shrink-0 pt-5">
                <ArrowRight className="w-6 h-6 text-amber-500" />
              </div>

              <div className="flex-1 w-full">
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                  Document B (Updated)
                </label>
                <select
                  value={doc2Id}
                  onChange={(e) => setDoc2Id(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white"
                  disabled={docsLoading}
                >
                  <option value="">Select document...</option>
                  {docs.map((d) => (
                    <option key={d._id} value={d._id} disabled={d._id === doc1Id}>
                      {d.fileName} ({d.docType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-shrink-0 pt-5">
                <Button
                  onClick={compare}
                  disabled={!doc1Id || !doc2Id || doc1Id === doc2Id || loading}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Comparing…
                    </>
                  ) : (
                    <>
                      <GitCompareArrows className="w-4 h-4 mr-2" />
                      Compare
                    </>
                  )}
                </Button>
              </div>
            </div>

            {doc1Id === doc2Id && doc1Id && (
              <p className="text-xs text-amber-500 mt-2">⚠️ Alag alag documents select karein</p>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Comparison Results */}
        {result && (
          <div className="space-y-6">
            {/* Verdict Card */}
            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-amber-500/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    <CheckCircle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">Overall Assessment</h3>
                    <p className="text-sm text-white/80">{result.verdict}</p>
                    <p className="text-xs text-slate-400 mt-1">{result.verdict_en}</p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
                      Risk change: <span className="text-amber-400 font-bold">{result.risk_score_change}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Added Clauses */}
              <Card className="bg-slate-900/50 border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-emerald-400">
                    <Plus className="w-5 h-5" />
                    Added Clauses ({result.added.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.added.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Koi naya clause nahi mila</p>
                  ) : (
                    result.added.map((item, i) => (
                      <div key={i} className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                        <p className="font-medium text-emerald-300">{item.clause}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.summary}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Removed Clauses */}
              <Card className="bg-slate-900/50 border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-400">
                    <Minus className="w-5 h-5" />
                    Removed Clauses ({result.removed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.removed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Koi clause remove nahi hua</p>
                  ) : (
                    result.removed.map((item, i) => (
                      <div key={i} className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
                        <p className="font-medium text-red-300 line-through">{item.clause}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.summary}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Modified Clauses */}
            {result.modified.length > 0 && (
              <Card className="bg-slate-900/50 border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-amber-400">
                    <RefreshCw className="w-5 h-5" />
                    Modified Clauses ({result.modified.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.modified.map((item, i) => (
                    <div key={i} className="rounded-lg border border-amber-500/20 overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-slate-700">
                        <div className="p-3 bg-red-500/5">
                          <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">Before</p>
                          <p className="text-sm text-slate-300">{item.before}</p>
                        </div>
                        <div className="p-3 bg-emerald-500/5">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">After</p>
                          <p className="text-sm text-slate-300">{item.after}</p>
                        </div>
                      </div>
                      <div className="border-t border-slate-700 bg-slate-800/50 px-3 py-2">
                        <p className="text-xs text-amber-400">
                          <span className="font-semibold">Impact:</span> {item.impact}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* New Risks */}
            {result.new_risks.length > 0 && (
              <Card className="bg-slate-900/50 border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-400">
                    <ShieldAlert className="w-5 h-5" />
                    New Risks in Updated Document ({result.new_risks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.new_risks.map((risk, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-3 text-sm ${
                        severityStyle[risk.severity] || severityStyle.medium
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">Clause</span>
                        <span className="text-xs uppercase tracking-wide">{risk.severity}</span>
                      </div>
                      <p>{risk.clause}</p>
                      <p className="text-xs mt-1 opacity-80">
                        <span className="font-semibold">Kyun risky:</span> {risk.reason}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
