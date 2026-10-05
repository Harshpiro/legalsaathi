"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { useApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Scale,
  ArrowLeft,
  ArrowRight,
  FileSignature,
  Loader2,
  FileDown,
  Check,
  ChevronRight,
  FileText,
  Gavel,
  Shield,
  Megaphone,
  ScrollText,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  rti: <FileText className="w-6 h-6" />,
  rent_notice: <ScrollText className="w-6 h-6" />,
  consumer_complaint: <Megaphone className="w-6 h-6" />,
  police_complaint: <Shield className="w-6 h-6" />,
  legal_notice: <Gavel className="w-6 h-6" />,
};

const typeColors: Record<string, string> = {
  rti: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  rent_notice: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  consumer_complaint: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  police_complaint: "text-red-400 bg-red-500/10 border-red-500/20",
  legal_notice: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

interface TemplateType {
  type: string;
  name: string;
  name_hi: string;
  description: string;
  fields: { key: string; label: string; type: string; required?: boolean; options?: string[] }[];
}

type Step = "select" | "fill" | "preview" | "done";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownToPrintableHtml(markdown: string) {
  const html: string[] = [];
  let listType: "ol" | "ul" | null = null;

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  markdown.replace(/\r\n/g, "\n").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      html.push('<div class="doc-spacer"></div>');
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdown(numbered[2])}</li>`);
      return;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  });

  closeList();
  return html.join("\n");
}

function startsWithMarkdownTitle(markdown: string) {
  return /^#\s+.+/m.test(markdown.trimStart().split("\n")[0] || "");
}

export default function TemplatesPage() {
  const api = useApi();
  const [templates, setTemplates] = useState<TemplateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("select");
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<"hindi" | "english">("hindi");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");

  // Load template types
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/templates/types");
        setTemplates(data.templates || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const selectTemplate = useCallback((t: TemplateType) => {
    setSelectedType(t);
    setFormData({});
    setStep("fill");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedType) return;
    setGenerating(true);
    try {
      const { data } = await api.post("/api/templates/generate", {
        template_type: selectedType.type,
        language,
        fields: formData,
      });
      setGeneratedContent(data.content);
      setGeneratedTitle(data.title);
      setStep("preview");
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [api, selectedType, language, formData]);

  const downloadAsPdf = useCallback(() => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.open();
    const hasTitleInContent = startsWithMarkdownTitle(generatedContent);
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(generatedTitle || "Legal Document")}</title>
          <style>
            @page { size: A4; margin: 22mm 18mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              font-family: "Nirmala UI", "Mangal", "Noto Sans Devanagari", Arial, sans-serif;
              font-size: 11.5pt;
              line-height: 1.62;
              letter-spacing: 0;
            }
            h1, h2, h3 {
              font-family: "Nirmala UI", "Mangal", "Noto Sans Devanagari", Arial, sans-serif;
              color: #111827;
              line-height: 1.25;
              font-weight: 700;
              page-break-after: avoid;
            }
            h1 {
              text-align: center;
              font-size: 16pt;
              text-transform: uppercase;
              border-bottom: 1px solid #9ca3af;
              padding-bottom: 12px;
              margin: 0 0 22px;
            }
            h2 { font-size: 13pt; margin: 18px 0 9px; }
            h3 { font-size: 12pt; margin: 14px 0 7px; }
            p {
              margin: 0 0 10px;
              white-space: pre-wrap;
              overflow-wrap: anywhere;
            }
            ol, ul {
              margin: 0 0 14px 22px;
              padding: 0;
            }
            li {
              margin: 0 0 5px;
              padding-left: 5px;
            }
            strong { font-weight: 700; }
            .doc-spacer { height: 10px; }
            .footer {
              margin-top: 32px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font: 9pt Arial, sans-serif;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${hasTitleInContent ? "" : `<h1>${escapeHtml(generatedTitle || "Legal Document")}</h1>`}
          ${markdownToPrintableHtml(generatedContent)}
          <div class="footer">Generated by LegalSaathi</div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, [generatedContent, generatedTitle]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(generatedContent);
    setStep("done");
    setTimeout(() => setStep("preview"), 2000);
  }, [generatedContent]);

  const resetWizard = useCallback(() => {
    setStep("select");
    setSelectedType(null);
    setFormData({});
    setGeneratedContent("");
    setGeneratedTitle("");
  }, []);

  // Check if required fields are filled
  const requiredFilled = selectedType
    ? selectedType.fields
        .filter((f) => f.required)
        .every((f) => formData[f.key]?.trim())
    : false;

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
            <FileSignature className="w-8 h-8 text-amber-500" />
            Legal Template Generator
          </h1>
          <p className="mt-2 text-slate-400">
            Form bharo, AI draft banaye, download karo. Free vakeel ki service!
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: "select", label: "Template Chunein" },
            { key: "fill", label: "Details Bharein" },
            { key: "preview", label: "Preview & Download" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  step === s.key || (step === "done" && s.key === "preview")
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Select Template */}
        {step === "select" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              templates.map((t) => (
                <Card
                  key={t.type}
                  onClick={() => selectTemplate(t)}
                  className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-all group cursor-pointer"
                >
                  <CardContent className="pt-6">
                    <div className={`p-3 rounded-xl border w-fit mb-4 ${typeColors[t.type] || "text-slate-400 bg-slate-800 border-slate-700"} group-hover:scale-110 transition-transform`}>
                      {typeIcons[t.type] || <FileText className="w-6 h-6" />}
                    </div>
                    <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">{t.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{t.name_hi}</p>
                    <p className="text-sm text-slate-400 mt-2">{t.description}</p>
                    <p className="text-xs text-slate-600 mt-2">{t.fields.length} fields</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Step 2: Fill Form */}
        {step === "fill" && selectedType && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className={`p-2 rounded-lg border ${typeColors[selectedType.type]}`}>
                  {typeIcons[selectedType.type]}
                </span>
                {selectedType.name}
                <button type="button" onClick={resetWizard} className="ml-auto text-xs text-slate-500 hover:text-white">
                  ← Change template
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language toggle */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-muted-foreground">Language:</span>
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "hindi" | "english")}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                >
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                </select>
              </div>

              {selectedType.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <Textarea
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      rows={3}
                      className="bg-slate-800 border-slate-700"
                    />
                  ) : field.type === "select" ? (
                    <select
                      aria-label={field.label}
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="bg-slate-800 border-slate-700"
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={resetWizard}>Cancel</Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!requiredFilled || generating}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      AI draft bana raha hai…
                    </>
                  ) : (
                    <>
                      Generate Draft
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview & Download */}
        {(step === "preview" || step === "done") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{generatedTitle}</h2>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {step === "done" ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    "Copy Text"
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadAsPdf}>
                  <FileDown className="w-4 h-4 mr-1" />
                  Download PDF
                </Button>
                <Button
                  size="sm"
                  onClick={resetWizard}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  New Template
                </Button>
              </div>
            </div>

            <div className="legal-document-shell">
              <article className="legal-document-page">
                {!startsWithMarkdownTitle(generatedContent) && (
                  <h1>{generatedTitle || "Legal Document"}</h1>
                )}
                {/* Use the same renderer as the PDF download — react-markdown is
                    unreliable for `**bold**` next to Devanagari punctuation. */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: markdownToPrintableHtml(generatedContent),
                  }}
                />
              </article>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
