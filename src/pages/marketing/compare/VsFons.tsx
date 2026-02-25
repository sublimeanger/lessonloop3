import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import CompareSchema from "@/components/marketing/compare/CompareSchema";
import CompareHero from "@/components/marketing/compare/CompareHero";
import CompareTable from "@/components/marketing/compare/CompareTable";
import CompareDifferentiators from "@/components/marketing/compare/CompareDifferentiators";
import CompareWhySwitch from "@/components/marketing/compare/CompareWhySwitch";
import CompareFAQ from "@/components/marketing/compare/CompareFAQ";
import CompareCTA from "@/components/marketing/compare/CompareCTA";
import { Sparkles, Building2, Users, GraduationCap, Receipt, CalendarDays } from "lucide-react";

const COMPETITOR = "Fons";

const rows = [
  { feature: "AI Assistant (LoopAssist)", lessonloop: true as const, competitor: false as const },
  { feature: "UK-Native (GBP / VAT)", lessonloop: true as const, competitor: true as const },
  { feature: "Automated Make-Up Matching", lessonloop: "Auto" as const, competitor: false as const },
  { feature: "Payment Plans / Installments", lessonloop: true as const, competitor: false as const },
  { feature: "Parent Portal", lessonloop: true as const, competitor: "Client portal" },
  { feature: "Practice Tracking", lessonloop: true as const, competitor: false as const },
  { feature: "Stripe Payments", lessonloop: true as const, competitor: true as const },
  { feature: "Drag & Drop Calendar", lessonloop: true as const, competitor: true as const },
  { feature: "Bulk Invoicing", lessonloop: true as const, competitor: "Limited" },
  { feature: "Multi-Location Support", lessonloop: true as const, competitor: false as const },
  { feature: "UK Term Date Support", lessonloop: true as const, competitor: false as const },
  { feature: "Multi-Teacher / Academy Support", lessonloop: true as const, competitor: false as const },
  { feature: "Resource Library", lessonloop: true as const, competitor: false as const },
  { feature: "Attendance Tracking", lessonloop: true as const, competitor: "Basic" },
  { feature: "Payroll Reports", lessonloop: true as const, competitor: false as const },
  { feature: "Free Trial", lessonloop: "30 days" as const, competitor: "14 days" as const },
];

const differentiators = [
  { icon: Sparkles, title: "LoopAssist AI", description: "An intelligent assistant that understands your schedule, students, and finances — and proposes actions with your confirmation." },
  { icon: Building2, title: "Built for academies, not just solo teachers", description: "Fons is great for individual professionals. LessonLoop scales from solo teachers to multi-location academies with team roles and payroll." },
  { icon: GraduationCap, title: "Music-specific features", description: "Instrument tracking, grade management, exam boards, and practice assignments — features a generic booking app can't match." },
  { icon: CalendarDays, title: "UK term date support", description: "Define terms, half-terms, and closure dates. Recurring lessons skip holidays automatically." },
  { icon: Receipt, title: "Payment plans & installments", description: "Let parents spread costs over multiple payments with automatic tracking and reminders." },
  { icon: Users, title: "Dedicated parent portal", description: "Parents get their own portal with lesson schedules, invoices, practice logs, and messaging — not just a generic client view." },
];

const reasons = [
  { title: "Fons is a generic booking tool", description: "Fons serves personal trainers, tutors, and coaches. LessonLoop is purpose-built for music education with instrument, grade, and practice tracking." },
  { title: "No multi-teacher or academy support", description: "Fons is designed for solo professionals. If you have a team or multiple locations, you'll outgrow it quickly." },
  { title: "No practice tracking or resource sharing", description: "Music teachers need to assign practice and share resources. LessonLoop includes both; Fons doesn't." },
  { title: "Limited bulk billing", description: "Fons handles individual bookings well but lacks term-based bulk invoicing for music schools." },
];

const faqs = [
  { question: "Is Fons suitable for music schools?", answer: "Fons works well for solo practitioners across many industries, but it lacks music-specific features like instrument tracking, practice assignments, and term-based billing." },
  { question: "Can I use Fons for a multi-teacher academy?", answer: "Fons is designed for solo professionals. LessonLoop's Studio and Agency plans support multiple teachers, team permissions, and payroll." },
  { question: "Does Fons support GBP?", answer: "Yes, Fons supports GBP. However, it doesn't offer UK term date support, VAT integration, or UK-specific billing patterns." },
  { question: "Can I migrate from Fons to LessonLoop?", answer: "Yes. Export your client data from Fons and import it into LessonLoop. Our team can assist with the transition." },
  { question: "Which has a longer free trial?", answer: "LessonLoop offers 30 days free; Fons offers 14 days." },
];

const otherComparisons = [
  { label: "LessonLoop vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
  { label: "LessonLoop vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
  { label: "LessonLoop vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
  { label: "LessonLoop vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
];

export default function VsFons() {
  usePageMeta(
    "LessonLoop vs Fons — Best Fons Alternative for Music Teachers",
    "Compare LessonLoop and Fons for music lesson management. Multi-teacher support, practice tracking, AI assistant, and UK term billing. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/compare/lessonloop-vs-fons",
      ogTitle: "LessonLoop vs Fons | Music School Software Comparison",
      ogDescription: "Side-by-side comparison of LessonLoop and Fons for music teachers and academies.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/compare/lessonloop-vs-fons",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <CompareSchema competitorName={COMPETITOR} canonical="https://lessonloop.co.uk/compare/lessonloop-vs-fons" breadcrumbName="LessonLoop vs Fons" faqs={faqs} />
      <CompareHero competitorName={COMPETITOR} headline="More than a booking app —" headlineAccent="music school software" subtitle="Fons is a great booking tool for solo professionals. But music teachers need more — practice tracking, parent portals, term billing, and AI assistance. That's LessonLoop." />
      <CompareTable competitorName={COMPETITOR} rows={rows} />
      <CompareDifferentiators competitorName={COMPETITOR} items={differentiators} />
      <CompareWhySwitch competitorName={COMPETITOR} reasons={reasons} />
      <CompareFAQ competitorName={COMPETITOR} faqs={faqs} />
      <CompareCTA competitorName={COMPETITOR} headlineAccent="Try LessonLoop free for 30 days." otherComparisons={otherComparisons} />
    </MarketingLayout>
  );
}
