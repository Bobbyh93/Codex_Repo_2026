import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { currentOpenRnBooks, OPEN_RN_LICENSE, OPEN_RN_PUBLISHER } from "@shared/open-rn-sources";

interface Textbook {
  title: string;
  subject: string;
  description: string;
  url: string;
}

// Single source of truth: shared/open-rn-sources.ts (verified against the publisher's catalog).
const OPENRN_TEXTBOOKS: Textbook[] = currentOpenRnBooks().map((book) => ({
  title: book.title,
  subject: book.subject,
  description: book.description,
  url: book.readUrl as string,
}));

const SUBJECT_COLORS: Record<string, string> = {
  Fundamentals: "bg-teal-100 text-teal-800",
  Pharmacology: "bg-amber-100 text-amber-800",
  "Med-Surg": "bg-blue-100 text-blue-800",
  "Mental Health": "bg-purple-100 text-purple-800",
  "Maternal/Newborn": "bg-pink-100 text-pink-800",
  Pediatrics: "bg-orange-100 text-orange-800",
  "Clinical Skills": "bg-sky-100 text-sky-800",
  Management: "bg-slate-100 text-slate-800",
  "Health Promotion": "bg-green-100 text-green-800",
};

function subjectBadge(subject: string) {
  return SUBJECT_COLORS[subject] ?? "bg-gray-100 text-gray-700";
}

export default function ReferencesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-10">

        <div className="mb-2">
          <Link href="/">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              ← Back to Study Plan
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2 mt-4">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Open RN Textbook References</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          All textbooks listed below are Open RN titles published by {OPEN_RN_PUBLISHER} and are available
          free online under a {OPEN_RN_LICENSE} license. Use them alongside your personalized study plan to deepen your understanding
          of high-priority topics.
        </p>

        <div className="space-y-4">
          {OPENRN_TEXTBOOKS.map((book) => (
            <Card key={book.title} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-base font-semibold text-gray-900">{book.title}</h2>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${subjectBadge(book.subject)}`}>
                        {book.subject}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{book.description}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap shrink-0" asChild>
                    <a href={book.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Read Free
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-gray-100 bg-gray-50 px-5 py-4 text-sm text-muted-foreground">
          <span className="font-semibold text-gray-700">About Open RN: </span>
          These textbooks are developed by nursing faculty at Wisconsin technical colleges and published by WisTech Open
          under a Creative Commons Attribution ({OPEN_RN_LICENSE}) license, except where otherwise noted on individual
          figures. They are freely available to all nursing students at no cost.
        </div>

        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm">← Return to Study Plan</Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
