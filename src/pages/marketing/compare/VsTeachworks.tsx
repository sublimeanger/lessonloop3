import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import CompareSchema from "@/components/marketing/compare/CompareSchema";
import CompareHero from "@/components/marketing/compare/CompareHero";
import CompareTable from "@/components/marketing/compare/CompareTable";
import CompareDifferentiators from "@/components/marketing/compare/CompareDifferentiators";
import CompareWhySwitch from "@/components/marketing/compare/CompareWhySwitch";
import CompareFAQ from "@/components/marketing/compare/CompareFAQ";
import CompareCTA from "@/components/marketing/compare/CompareCTA";
import { Sparkles, PoundSterling, Zap, CalendarDays, Shield, GraduationCap } from "lucide-react";

const COMPETITOR = "Teachworks";

const rows = [
  { feature: "AI Assistant (LoopAssist)", lessonloop: true as const, competitor: false as const },
  { feature: "UK-Native (GBP / VAT)", lessonloop: true as const, competitor: "Partial" },
  { feature: "Automated Make-Up Matching", lessonloop: "Auto" as const, competitor: false as const },
  { feature: "Payment Plans / Installments", lessonloop: true as const, competitor: false as const },
  { feature: "Parent Portal", lessonloop: true as const, competitor: true as const },
  { feature: "Practice Tracking", lessonloop: true as const, competitor: false as const },
  { feature: "Stripe Payments", lessonloop: true as const, competitor: true as const },
  { feature: "Drag & Drop Calendar", lessonloop: true as const, competitor: true as const },
  { feature: "Bulk Invoicing", lessonloop: true as const, competitor: true as const },
  { feature: "Multi-Location Support", lessonloop: true as const, competitor: true as const },
  { feature: "UK Term Date Support", lessonloop: true as const, competitor: false as const },
  { feature: "Modern UI / Design", lessonloop: true as const, competitor: "Legacy" },
  { feature: "Resource Library", lessonloop: true as const, competitor: false as const },
  { feature: "Attendance Tracking", lessonloop: true as const, competitor: true as const },
  { feature: "Payroll Reports", lessonloop: true as const, competitor: true as const },
  { feature: "Free Trial", lessonloop: "30 days" as const, competitor: "Free trial" as const },
];

const differentiators = [
  { icon: Sparkles, title: "AI-powered assistance", description: "LoopAssist answers questions about your schedule, students, and finances — and proposes actions you can confirm with one click." },
  { icon: PoundSterling, title: "Built for UK music schools", description: "Native GBP, optional VAT, UK term calendars, and GDPR compliance — not an afterthought for international users." },
  { icon: Zap, title: "Faster, modern interface", description: "LessonLoop was built with modern web technology — responsive, fast, and designed for the way teachers work today." },
  { icon: CalendarDays, title: "Practice tracking included", description: "Assign practice, track completion, and share progress with parents — features Teachworks doesn't offer." },
  { icon: GraduationCap, title: "Grade & instrument tracking", description: "Track exam boards, grades, and multiple instruments per student with full history." },
  { icon: Shield, title: "GDPR-first data protection", description: "Designed for UK/EU data protection from the ground up, not adapted from North American privacy models." },
];

const reasons = [
  { title: "No practice tracking", description: "Teachworks focuses on scheduling and billing but doesn't help teachers assign or monitor student practice." },
  { title: "Feels complex to set up", description: "Teachers report that Teachworks has a steep learning curve. LessonLoop is designed to get you running in minutes." },
  { title: "UK billing support is limited", description: "Teachworks was built for the North American market. UK term billing, VAT, and GBP aren't native." },
  { title: "No AI features", description: "LessonLoop's LoopAssist gives you an intelligent assistant — Teachworks relies entirely on manual workflows." },
];

const faqs = [
  { question: "Can I import data from Teachworks?", answer: "Yes. Export your Teachworks data as CSV and import students, lessons, and contacts into LessonLoop. Our support team can assist." },
  { question: "Does LessonLoop support tutoring businesses like Teachworks?", answer: "Absolutely. LessonLoop supports multi-teacher agencies, payroll tracking, and team permissions — ideal for tutoring businesses of any size." },
  { question: "Does Teachworks have better integrations?", answer: "Teachworks offers WordPress plugins and some third-party integrations. LessonLoop focuses on core music teaching features with Google Calendar sync and Stripe payments built in." },
  { question: "Is LessonLoop suitable for large academies?", answer: "Yes. Our Agency plan supports unlimited teachers, multi-location management, API access, and dedicated account management." },
  { question: "Is there a free trial?", answer: "Yes — 30 days, no credit card required." },
];

const otherComparisons = [
  { label: "LessonLoop vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
  { label: "LessonLoop vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
  { label: "LessonLoop vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
  { label: "LessonLoop vs Fons", to: "/compare/lessonloop-vs-fons" },
];

export default function VsTeachworks() {
  usePageMeta(
    "LessonLoop vs Teachworks — Best Teachworks Alternative for UK Music Schools",
    "Compare LessonLoop and Teachworks for music lesson management. AI assistant, practice tracking, UK billing, and modern design — see why teachers switch.",
    {
      canonical: "https://lessonloop.co.uk/compare/lessonloop-vs-teachworks",
      ogTitle: "LessonLoop vs Teachworks | Music School Software Comparison",
      ogDescription: "Side-by-side comparison of LessonLoop and Teachworks features, pricing, and UK suitability.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/compare/lessonloop-vs-teachworks",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <CompareSchema
        competitorName={COMPETITOR}
        canonical="https://lessonloop.co.uk/compare/lessonloop-vs-teachworks"
        breadcrumbName="LessonLoop vs Teachworks"
        faqs={faqs}
      />
      <CompareHero
        competitorName={COMPETITOR}
        headline="The smarter Teachworks alternative"
        headlineAccent="for UK music schools"
        subtitle="Teachworks is powerful — but if you want AI assistance, practice tracking, and billing designed for UK music teachers, LessonLoop is the modern choice."
      />
      <CompareTable competitorName={COMPETITOR} rows={rows} />
      <CompareDifferentiators competitorName={COMPETITOR} items={differentiators} />
      <CompareWhySwitch competitorName={COMPETITOR} reasons={reasons} migrationNote="Export from Teachworks, import into LessonLoop — we'll help you every step of the way." />
      <CompareFAQ competitorName={COMPETITOR} faqs={faqs} />
      <CompareCTA competitorName={COMPETITOR} headlineAccent="Try LessonLoop free for 30 days." otherComparisons={otherComparisons} />
    </MarketingLayout>
  );
}
