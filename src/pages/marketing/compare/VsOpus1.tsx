import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import CompareSchema from "@/components/marketing/compare/CompareSchema";
import CompareHero from "@/components/marketing/compare/CompareHero";
import CompareTable from "@/components/marketing/compare/CompareTable";
import CompareDifferentiators from "@/components/marketing/compare/CompareDifferentiators";
import CompareWhySwitch from "@/components/marketing/compare/CompareWhySwitch";
import CompareFAQ from "@/components/marketing/compare/CompareFAQ";
import CompareCTA from "@/components/marketing/compare/CompareCTA";
import { Sparkles, PoundSterling, Users, Building2, Receipt, CalendarDays } from "lucide-react";

const COMPETITOR = "Opus 1";

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
  { feature: "Multi-Location Support", lessonloop: true as const, competitor: "Limited" },
  { feature: "UK Term Date Support", lessonloop: true as const, competitor: false as const },
  { feature: "Modern UI / Design", lessonloop: true as const, competitor: true as const },
  { feature: "Resource Library", lessonloop: true as const, competitor: false as const },
  { feature: "Attendance Tracking", lessonloop: true as const, competitor: true as const },
  { feature: "Multi-Teacher Support", lessonloop: true as const, competitor: true as const },
  { feature: "Free Trial", lessonloop: "30 days" as const, competitor: "Free tier" as const },
];

const differentiators = [
  { icon: Sparkles, title: "LoopAssist AI", description: "An intelligent assistant that answers questions about your schedule, students, and finances — and can propose actions for you to confirm." },
  { icon: PoundSterling, title: "UK-native billing", description: "GBP, VAT, UK term billing, and bank holidays are built in — not adapted from a US-centric platform." },
  { icon: Building2, title: "True multi-location", description: "Manage multiple venues with individual rooms, availability, and closure dates from one dashboard." },
  { icon: Receipt, title: "Payment plans", description: "Split invoices into installments. Parents can pay over time without manual tracking." },
  { icon: Users, title: "Granular team roles", description: "Owner, admin, teacher, finance, parent — everyone sees exactly what they need." },
  { icon: CalendarDays, title: "Practice tracking", description: "Assign practice goals, track completions, and share progress with parents through the portal." },
];

const reasons = [
  { title: "Limited multi-location support", description: "Opus 1 works well for solo teachers and small studios, but struggles with complex multi-venue setups." },
  { title: "No AI features", description: "Opus 1 relies on traditional workflows. LessonLoop adds AI-powered assistance for scheduling, billing, and communications." },
  { title: "No practice tracking", description: "Teachers want to assign and track practice — LessonLoop includes this; Opus 1 doesn't." },
  { title: "UK billing not native", description: "UK term dates, VAT, and GBP support aren't first-class features in Opus 1." },
];

const faqs = [
  { question: "Is LessonLoop suitable for solo teachers like Opus 1?", answer: "Absolutely. Our Teacher plan is designed for solo music teachers with unlimited students, full scheduling, and billing features." },
  { question: "Does Opus 1 have a free tier?", answer: "Opus 1 offers a free tier with limited features. LessonLoop offers a full-featured 30-day free trial with no restrictions." },
  { question: "Can I migrate from Opus 1?", answer: "Yes. Export your data and import it into LessonLoop via CSV. Our support team is happy to help." },
  { question: "Which is better for growing academies?", answer: "LessonLoop's Studio and Agency plans are built for multi-teacher, multi-location academies — with payroll, permissions, and reporting." },
];

const otherComparisons = [
  { label: "LessonLoop vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
  { label: "LessonLoop vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
  { label: "LessonLoop vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
  { label: "LessonLoop vs Fons", to: "/compare/lessonloop-vs-fons" },
];

export default function VsOpus1() {
  usePageMeta(
    "LessonLoop vs Opus 1 — Best Opus 1 Alternative for UK Music Teachers",
    "Compare LessonLoop and Opus 1 for music lesson management. AI assistant, UK billing, practice tracking, and multi-location support. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/compare/lessonloop-vs-opus1",
      ogTitle: "LessonLoop vs Opus 1 | Music School Software Comparison",
      ogDescription: "Side-by-side comparison of LessonLoop and Opus 1 features for music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/compare/lessonloop-vs-opus1",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <CompareSchema competitorName={COMPETITOR} canonical="https://lessonloop.co.uk/compare/lessonloop-vs-opus1" breadcrumbName="LessonLoop vs Opus 1" faqs={faqs} />
      <CompareHero competitorName={COMPETITOR} headline="A powerful Opus 1 alternative" headlineAccent="with AI and UK billing" subtitle="Opus 1 is a solid choice for solo teachers — but when you need AI assistance, practice tracking, and UK-native billing, LessonLoop delivers more." />
      <CompareTable competitorName={COMPETITOR} rows={rows} />
      <CompareDifferentiators competitorName={COMPETITOR} items={differentiators} />
      <CompareWhySwitch competitorName={COMPETITOR} reasons={reasons} />
      <CompareFAQ competitorName={COMPETITOR} faqs={faqs} />
      <CompareCTA competitorName={COMPETITOR} headlineAccent="Start free for 30 days." otherComparisons={otherComparisons} />
    </MarketingLayout>
  );
}
