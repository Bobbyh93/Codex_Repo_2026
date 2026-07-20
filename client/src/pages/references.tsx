import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Textbook {
  title: string;
  subject: string;
  description: string;
  url: string;
}

const OPENRN_TEXTBOOKS: Textbook[] = [
  {
    title: "Nursing Fundamentals",
    subject: "Fundamentals",
    description:
      "Core nursing skills, safety, infection control, vital signs, hygiene, oxygenation, and patient care basics for beginning nursing students.",
    url: "https://wtcs.pressbooks.pub/nursingfundamentals/",
  },
  {
    title: "Clinical Nursing Skills",
    subject: "Fundamentals",
    description:
      "Hands-on procedural skills including medication administration, wound care, catheterization, IV therapy, and other essential clinical competencies.",
    url: "https://wtcs.pressbooks.pub/clinicalskills/",
  },
  {
    title: "Nursing Pharmacology",
    subject: "Pharmacology",
    description:
      "Drug classifications, mechanisms of action, adverse effects, and nursing implications across all major medication categories.",
    url: "https://wtcs.pressbooks.pub/pharmacology/",
  },
  {
    title: "Medical-Surgical Nursing",
    subject: "Med-Surg",
    description:
      "Adult health conditions across all major body systems — pathophysiology, assessment, nursing interventions, and patient education aligned to NCLEX categories.",
    url: "https://wtcs.pressbooks.pub/nursingmedicalsurgical/",
  },
  {
    title: "Nursing Mental Health",
    subject: "Mental Health",
    description:
      "Psychiatric disorders, therapeutic communication, psychopharmacology, and legal and ethical issues in mental health nursing.",
    url: "https://wtcs.pressbooks.pub/nursingmentalhealth/",
  },
  {
    title: "Nursing Maternal-Newborn",
    subject: "Maternal/Newborn",
    description:
      "Prenatal through postpartum care, newborn assessment, high-risk obstetrics, and complications of labor and birth.",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/",
  },
  {
    title: "Nursing Pediatrics",
    subject: "Pediatrics",
    description:
      "Growth and development, pediatric assessment, and management of childhood illnesses across body systems.",
    url: "https://wtcs.pressbooks.pub/nursingpediatrics/",
  },
  {
    title: "Nursing Management of Pain and Nutrition",
    subject: "Fundamentals",
    description:
      "Pain assessment, pharmacological and non-pharmacological pain management, nutritional assessment, and enteral and parenteral nutrition.",
    url: "https://wtcs.pressbooks.pub/painnutrition/",
  },
];

const SUBJECT_COLORS: Record<string, string> = {
  Fundamentals: "bg-teal-100 text-teal-800",
  Pharmacology: "bg-amber-100 text-amber-800",
  "Med-Surg": "bg-blue-100 text-blue-800",
  "Mental Health": "bg-purple-100 text-purple-800",
  "Maternal/Newborn": "bg-pink-100 text-pink-800",
  Pediatrics: "bg-orange-100 text-orange-800",
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
          All textbooks listed below are published by Open RN (Chippewa Valley Technical College) and are available
          free online under an open license. Use them alongside your personalized study plan to deepen your understanding
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
          These textbooks are developed by nursing faculty at Chippewa Valley Technical College and published under an
          open Creative Commons license. They are freely available to all nursing students at no cost.
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
