import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import CompareSchema from "@/components/marketing/compare/CompareSchema";
import CompareHero from "@/components/marketing/compare/CompareHero";
import CompareTable from "@/components/marketing/compare/CompareTable";
import CompareDifferentiators from "@/components/marketing/compare/CompareDifferentiators";
import CompareWhySwitch from "@/components/marketing/compare/CompareWhySwitch";
import CompareFAQ from "@/components/marketing/compare/CompareFAQ";
import CompareCTA from "@/components/marketing/compare/CompareCTA";
import { Sparkles, PoundSterling, Zap, Music, Shield, Receipt } from "lucide-react";

const COMPETITOR = "Jackrabbit Music";

const rows = [
  { feature: "AI Assistant (LoopAssist)", lessonloop: true as const, competitor: false as const },
  { feature: "UK-Native (GBP / VAT)", lessonloop: true as const, competitor: false as const },
  { feature: "Automated Make-Up Matching", lessonloop: "Auto" as const, competitor: "Manual" },
  { feature: "Payment Plans / Installments", lessonloop: true as const, competitor: false as const },
  { feature: "Parent Portal", lessonloop: true as const, competitor: true as const },
  { feature: "Practice Tracking", lessonloop: true as const, competitor: false as const },
  { feature: "Stripe Payments", lessonloop: true as const, competitor: "Custom gateway" },
  { feature: "Drag & Drop Calendar", lessonloop: true as const, competitor: true as const },
  { feature: "Bulk Invoicing", lessonloop: true as const, competitor: true as const },
  { feature: "Multi-Location Support", lessonloop: true as const, competitor: true as const },
  { feature: "UK Term Date Support", lessonloop: true as const, competitor: false as const },
  { feature: "Modern UI / Design", lessonloop: true as const, competitor: "Legacy" },
  { feature: "Resource Library", lessonloop: true as const, competitor: false as const },
  { feature: "Class & Group Lessons", lessonloop: true as const, competitor: true as const },
  { feature: "Custom Reporting", lessonloop: true as const, competitor: true as const },
  { feature: "Free Trial", lessonloop: "30 days" as const, competitor: "14 days" as const },
];

const differentiators = [
  { icon: Sparkles, title: "AI assistant included", description: "LoopAssist answers questions, drafts messages, and proposes schedule changes — no equivalent exists in Jackrabbit Music." },
  { icon: PoundSterling, title: "Designed for UK schools", description: "Jackrabbit Music is US-focused. LessonLoop offers native GBP, VAT support, UK term dates, and GDPR compliance." },
  { icon: Zap, title: "Simple, modern design", description: "Jackrabbit Music can feel overwhelming with its enterprise features. LessonLoop is fast, clean, and easy to learn." },
  { icon: Music, title: "Music-first focus", description: "Jackrabbit serves dance, gymnastics, and swim schools too. LessonLoop is purpose-built for music education." },
  { icon: Receipt, title: "Payment plans", description: "Let parents split term fees into manageable installments — automatically tracked." },
  { icon: Shield, title: "GDPR compliance", description: "UK/EU data hosting and GDPR-first design. Jackrabbit Music operates under US data regulations." },
];

const reasons = [
  { title: "It's built for the US market", description: "USD pricing, US tax models, and no UK term date awareness make Jackrabbit Music a poor fit for UK music schools." },
  { title: "The interface feels enterprise-heavy", description: "Jackrabbit Music was built for large multi-activity businesses. Music teachers find it over-complicated for their needs." },
  { title: "No AI or practice tracking", description: "LessonLoop offers both AI assistance and practice tracking — Jackrabbit Music offers neither." },
  { title: "Payment processing is limited", description: "Jackrabbit uses its own payment gateway. LessonLoop integrates Stripe for modern, flexible payments." },
];

const faqs = [
  { question: "Is Jackrabbit Music suitable for UK schools?", answer: "Jackrabbit Music primarily serves the US market with USD billing and US-centric features. UK schools may find LessonLoop's native GBP and VAT support a better fit." },
  { question: "Does Jackrabbit Music support music lessons specifically?", answer: "Jackrabbit serves multiple activity types (dance, swim, gymnastics, music). LessonLoop is purpose-built for music education with instrument tracking, grade management, and practice logs." },
  { question: "Can I migrate from Jackrabbit Music?", answer: "Yes. Export your data from Jackrabbit and import it into LessonLoop via CSV. Our support team can help with the transition." },
  { question: "Which has a longer free trial?", answer: "LessonLoop offers a 30-day free trial compared to Jackrabbit Music's 14-day trial." },
];

const otherComparisons = [
  { label: "LessonLoop vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
  { label: "LessonLoop vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
  { label: "LessonLoop vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
  { label: "LessonLoop vs Fons", to: "/compare/lessonloop-vs-fons" },
];

export default function VsJackrabbitMusic() {
  usePageMeta(
    "LessonLoop vs Jackrabbit Music — Best Alternative for UK Music Schools",
    "Compare LessonLoop and Jackrabbit Music for music lesson management. UK-native billing, AI assistant, practice tracking, and modern UI. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/compare/lessonloop-vs-jackrabbit-music",
      ogTitle: "LessonLoop vs Jackrabbit Music | Music School Software Comparison",
      ogDescription: "Side-by-side comparison of LessonLoop and Jackrabbit Music for UK music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/compare/lessonloop-vs-jackrabbit-music",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <CompareSchema competitorName={COMPETITOR} canonical="https://lessonloop.co.uk/compare/lessonloop-vs-jackrabbit-music" breadcrumbName="LessonLoop vs Jackrabbit Music" faqs={faqs} />
      <CompareHero competitorName={COMPETITOR} headline="The UK-first Jackrabbit Music alternative" headlineAccent="for music teachers" subtitle="Jackrabbit Music is built for US multi-activity businesses. LessonLoop is purpose-built for UK music schools — with AI, modern design, and native GBP billing." />
      <CompareTable competitorName={COMPETITOR} rows={rows} />
      <CompareDifferentiators competitorName={COMPETITOR} items={differentiators} />
      <CompareWhySwitch competitorName={COMPETITOR} reasons={reasons} />
      <CompareFAQ competitorName={COMPETITOR} faqs={faqs} />
      <CompareCTA competitorName={COMPETITOR} headlineAccent="Try LessonLoop free for 30 days." otherComparisons={otherComparisons} />
    </MarketingLayout>
  );
}
