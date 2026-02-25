import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import CompareSchema from "@/components/marketing/compare/CompareSchema";
import CompareHero from "@/components/marketing/compare/CompareHero";
import CompareTable from "@/components/marketing/compare/CompareTable";
import CompareDifferentiators from "@/components/marketing/compare/CompareDifferentiators";
import CompareWhySwitch from "@/components/marketing/compare/CompareWhySwitch";
import CompareFAQ from "@/components/marketing/compare/CompareFAQ";
import CompareCTA from "@/components/marketing/compare/CompareCTA";
import { Sparkles, PoundSterling, Palette, CalendarDays, Shield, Users } from "lucide-react";

const COMPETITOR = "My Music Staff";

const rows = [
  { feature: "AI Assistant (LoopAssist)", lessonloop: true as const, competitor: false as const },
  { feature: "UK-Native (GBP / VAT)", lessonloop: true as const, competitor: "Partial" },
  { feature: "Automated Make-Up Matching", lessonloop: "Auto" as const, competitor: "Basic credits" },
  { feature: "Payment Plans / Installments", lessonloop: true as const, competitor: false as const },
  { feature: "Parent Portal", lessonloop: true as const, competitor: true as const },
  { feature: "Practice Tracking", lessonloop: true as const, competitor: true as const },
  { feature: "Stripe Payments", lessonloop: true as const, competitor: true as const },
  { feature: "Drag & Drop Calendar", lessonloop: true as const, competitor: true as const },
  { feature: "Bulk Invoicing", lessonloop: true as const, competitor: true as const },
  { feature: "Multi-Location Support", lessonloop: true as const, competitor: true as const },
  { feature: "UK Term Date Support", lessonloop: true as const, competitor: false as const },
  { feature: "Modern UI / Design", lessonloop: true as const, competitor: "Legacy" },
  { feature: "Mobile App", lessonloop: "PWA" as const, competitor: false as const },
  { feature: "Website Builder", lessonloop: "Roadmap" as const, competitor: true as const },
  { feature: "Resource Library", lessonloop: true as const, competitor: false as const },
  { feature: "Free Trial", lessonloop: "30 days" as const, competitor: "30 days" as const },
];

const differentiators = [
  { icon: Sparkles, title: "LoopAssist AI built in", description: "Ask questions, draft messages, propose schedule changes, and run billing — all from a conversational AI assistant that knows your data." },
  { icon: PoundSterling, title: "UK-first billing", description: "GBP default, optional VAT, UK bank holidays and term dates baked into recurring lessons and invoicing — not bolted on." },
  { icon: Palette, title: "Modern, intuitive interface", description: "A clean, responsive design built in 2025 — not a legacy interface from 2010 with incremental patches." },
  { icon: CalendarDays, title: "Smart make-up matching", description: "Automatically find available slots for rescheduled lessons instead of manually tracking credits." },
  { icon: Shield, title: "GDPR-first compliance", description: "Data stored in the UK/EU, designed with GDPR in mind from day one — not retrofitted to meet requirements." },
  { icon: Users, title: "Flexible team roles", description: "Owner, admin, teacher, finance, parent — granular permissions ensure everyone sees only what they need." },
];

const reasons = [
  { title: "The interface feels outdated", description: "My Music Staff's UI was designed years ago. Teachers tell us they want something modern, fast, and mobile-friendly." },
  { title: "UK billing is an afterthought", description: "Currency conversion headaches, no VAT support, and no awareness of UK term structures make billing harder than it should be." },
  { title: "No AI assistance", description: "My Music Staff doesn't offer an AI assistant. LessonLoop's LoopAssist handles queries, drafts, and action proposals." },
  { title: "Make-up tracking is manual", description: "Basic credit tracking doesn't help you find an actual reschedule slot. LessonLoop matches availability automatically." },
];

const faqs = [
  { question: "Can I import my data from My Music Staff?", answer: "Yes. You can export your student and lesson data from My Music Staff and import it into LessonLoop via CSV. Our team can help with migration." },
  { question: "Is LessonLoop more expensive than My Music Staff?", answer: "LessonLoop's Teacher plan starts at a comparable price point with more features included. Check our pricing page for current rates." },
  { question: "Does LessonLoop have a website builder like My Music Staff?", answer: "A website builder is on our roadmap. In the meantime, LessonLoop offers a public booking page you can embed on your existing website." },
  { question: "Will I lose any features by switching?", answer: "LessonLoop covers all core features (scheduling, billing, parent portal) and adds AI, make-up matching, payment plans, and UK-native billing." },
  { question: "Is there a free trial?", answer: "Yes — 30 days, no credit card required. You can explore every feature before committing." },
];

const otherComparisons = [
  { label: "LessonLoop vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
  { label: "LessonLoop vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
  { label: "LessonLoop vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
  { label: "LessonLoop vs Fons", to: "/compare/lessonloop-vs-fons" },
];

export default function VsMyMusicStaff() {
  usePageMeta(
    "LessonLoop vs My Music Staff — Best Alternative for UK Music Teachers",
    "Compare LessonLoop and My Music Staff side by side. See why UK music teachers choose LessonLoop for AI assistance, UK-native billing, modern UI, and smart make-up matching.",
    {
      canonical: "https://lessonloop.co.uk/compare/lessonloop-vs-my-music-staff",
      ogTitle: "LessonLoop vs My Music Staff | UK Music School Software Comparison",
      ogDescription: "Feature-by-feature comparison of LessonLoop and My Music Staff for music lesson management.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/compare/lessonloop-vs-my-music-staff",
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
        canonical="https://lessonloop.co.uk/compare/lessonloop-vs-my-music-staff"
        breadcrumbName="LessonLoop vs My Music Staff"
        faqs={faqs}
      />

      <CompareHero
        competitorName={COMPETITOR}
        headline="The modern My Music Staff alternative"
        headlineAccent="built for UK teachers"
        subtitle="My Music Staff has served music teachers well — but if you're in the UK and want AI assistance, modern design, and billing that understands GBP and VAT, LessonLoop is the upgrade."
      />

      <CompareTable competitorName={COMPETITOR} rows={rows} />

      <CompareDifferentiators competitorName={COMPETITOR} items={differentiators} />

      <CompareWhySwitch
        competitorName={COMPETITOR}
        reasons={reasons}
        migrationNote="Switching is easy — export from My Music Staff, import into LessonLoop. Our team can help with the transition."
      />

      <CompareFAQ competitorName={COMPETITOR} faqs={faqs} />

      <CompareCTA
        competitorName={COMPETITOR}
        headlineAccent="Try LessonLoop free for 30 days."
        otherComparisons={otherComparisons}
      />
    </MarketingLayout>
  );
}
