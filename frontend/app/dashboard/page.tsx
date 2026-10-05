"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, GitCompareArrows, FileSignature, ArrowRight, Trash2, Loader2, CalendarClock } from "lucide-react";
import { DocumentUploader, UploadResult } from "@/components/DocumentUploader";
import { DeadlinesWidget } from "@/components/DeadlinesWidget";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface DocSummary {
  _id: string;
  fileName: string;
  fileType?: string;
  docType: string;
  status: string;
  summary?: string;
  createdAt?: string;
}

export default function DashboardPage() {
  const api = useApi();
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/documents/list");
      setDocs(data);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUploaded = useCallback(
    (_r: UploadResult) => {
      refresh();
    },
    [refresh],
  );

  const deleteDocument = useCallback(
    async (docId: string) => {
      if (confirmDeleteId !== docId) {
        setConfirmDeleteId(docId);
        return;
      }

      setDeletingId(docId);
      try {
        await api.delete(`/api/documents/${docId}`);
        setDocs((current) => current.filter((doc) => doc._id !== docId));
        setConfirmDeleteId(null);
      } finally {
        setDeletingId(null);
      }
    },
    [api, confirmDeleteId],
  );

  return (
    <div className="min-h-screen">
      <nav className="relative z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
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

      <main className="container space-y-8 py-8">
        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/compare">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-all group cursor-pointer h-full">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 group-hover:scale-110 transition-transform">
                  <GitCompareArrows className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">Compare Documents</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Do documents ka AI comparison karein</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 ml-auto transition-colors" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/templates">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-all group cursor-pointer h-full">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <FileSignature className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">Legal Templates</h3>
                  <p className="text-xs text-slate-400 mt-0.5">RTI, rent notice, complaint — AI draft banaye</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 ml-auto transition-colors" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/deadlines">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-all group cursor-pointer h-full">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <CalendarClock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">Deadlines</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Auto reminders 7d/3d/1d before any date</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 ml-auto transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Upcoming deadlines preview */}
        <DeadlinesWidget />

        <section>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Naya document upload karein</h1>
          <p className="mt-2 text-slate-400">
            PDF ya image OCR ke baad chunk hokar Qdrant mein jaayega, entities Neo4j mein, aur Hindi + English summary milegi.
          </p>
          <div className="mt-6">
            <DocumentUploader onUploaded={onUploaded} />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Tumhare documents</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Abhi koi document nahi hai.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {docs.map((d) => {
                const confirming = confirmDeleteId === d._id;
                const deleting = deletingId === d._id;

                return (
                <Link key={d._id} href={`/dashboard/${d._id}`} onMouseLeave={() => confirming && setConfirmDeleteId(null)}>
                  <Card className="relative bg-slate-900/50 border-slate-800 backdrop-blur-sm transition-colors hover:border-amber-500/50 group">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-3 text-base">
                        <span className="truncate text-white group-hover:text-amber-400 transition-colors">{d.fileName}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase text-slate-300 border border-slate-700">
                            {d.fileType?.startsWith("image/") ? "image" : d.docType || "other"}
                          </span>
                          <Button
                            type="button"
                            variant={confirming ? "destructive" : "ghost"}
                            size="sm"
                            disabled={deleting}
                            title={confirming ? "Click again to delete" : "Delete document"}
                            className={`h-8 px-2 ${confirming ? "" : "text-slate-500 hover:text-red-300 hover:bg-red-500/10"}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteDocument(d._id);
                            }}
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4" />
                                {confirming && <span className="ml-1 hidden sm:inline">Confirm</span>}
                              </>
                            )}
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-slate-400">
                        {d.summary || "(abhi process ho raha hai…)"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
