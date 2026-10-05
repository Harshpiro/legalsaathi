import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SummaryCard({ summary, docType }: { summary: string; docType?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Summary (Hindi + English)</span>
          {docType && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-normal uppercase">
              {docType}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Summary abhi taiyaar ho raha hai…</p>
        )}
      </CardContent>
    </Card>
  );
}
