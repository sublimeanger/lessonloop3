import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import UseCaseHero from "@/components/marketing/use-case/UseCaseHero";
import UseCasePainPoints from "@/components/marketing/use-case/UseCasePainPoints";
import UseCaseFeatures from "@/components/marketing/use-case/UseCaseFeatures";
import UseCaseTestimonial from "@/components/marketing/use-case/UseCaseTestimonial";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  User, CalendarDays, CreditCard, Clock, Smartphone, MessageSquare,
  AlertTriangle, FileSpreadsheet, BanknoteIcon, Brain, Sparkles, BookOpen,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/solo-teachers";

const FAQS = [
  { question: "Is LessonLoop free for solo teachers?", answer: "LessonLoop offers a generous free tier and a 30-day trial of all premium features. Solo teachers can run their entire studio on the free plan." },
  { question: "Do I need technical skills to set up LessonLoop?", answer: "Not at all. Sign up, add your students, set your schedule, and you're ready. Onboarding takes under 10 minutes." },
  { question: "Can parents book lessons directly?", answer: "Yes. Share your public booking page and parents can request trial lessons or regular slots based on your availability." },
  { question: "Does it handle invoicing and payments?", answer: "Yes — generate professional invoices in GBP, track payments, send reminders, and accept online payments via Stripe." },
];

export default function ForSoloTeachers() {
  usePageMeta(
    "Software for Private Music Teachers | LessonLoop",
    "Schedule lessons, send invoices, and manage students — all from one app built for solo music teachers in the UK. Free to start.",
    {
      ogTitle: "Software for Private Music Teachers | LessonLoop",
      ogDescription: "LessonLoop helps private music teachers schedule, invoice, and communicate with families — without the admin overhead.",
      ogType: "website",
      ogUrl: CANONICAL,
      ogSiteName: "LessonLoop",
      twitterCard: "summary_large_image",
      canonical: CANONICAL,
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <UseCaseSchema
        name="Solo Music Teacher Software"
        description="Scheduling, invoicing, and student management software designed for private music teachers."
        canonical={CANONICAL}
        breadcrumbName="Solo Teachers"
        faqs={FAQS}
      />

      <UseCaseHero
        badge="For Solo Teachers"
        badgeIcon={User}
        title="Teach more, admin less —"
        titleAccent="your studio, simplified"
        subtitle="Professional scheduling, instant invoicing, and a parent portal that makes you look like an academy — even if it's just you."
      />

      <UseCasePainPoints
        headline="The solo teacher juggling act"
        subtitle="You went into teaching for the music, not the spreadsheets."
        painPoints={[
          { icon: AlertTriangle, title: "Chasing payments", description: "Reminding parents to pay feels awkward. Late payments pile up and cash flow suffers." },
          { icon: Clock, title: "Evenings lost to admin", description: "Scheduling, rescheduling, texting confirmations, creating invoices — every evening." },
          { icon: FileSpreadsheet, title: "Scattered systems", description: "Google Calendar for bookings, Excel for invoices, WhatsApp for messages. Nothing connects." },
          { icon: BanknoteIcon, title: "No financial overview", description: "You know you're busy, but can't easily see monthly income, outstanding fees, or trends." },
          { icon: Brain, title: "Mental load", description: "Remembering who cancelled, who needs a make-up, which parent hasn't been invoiced yet." },
          { icon: Smartphone, title: "Always on the phone", description: "Parents text at all hours. No boundaries between teaching and administration." },
        ]}
      />

      <UseCaseFeatures
        headline="Everything a solo teacher needs"
        subtitle="Run a professional studio without hiring a receptionist."
        features={[
          { icon: CalendarDays, title: "Simple, visual scheduling", description: "Drag-and-drop calendar with recurring lessons, availability slots, and automatic conflict detection.", link: { label: "Explore scheduling features", to: "/features/scheduling" } },
          { icon: CreditCard, title: "One-click invoicing", description: "Generate monthly or termly invoices in GBP. Automatic reminders chase payments for you.", link: { label: "See invoicing and billing", to: "/features/billing" } },
          { icon: MessageSquare, title: "Built-in messaging", description: "Message parents from LessonLoop instead of your personal phone. Templates save time.", link: { label: "Explore messaging features", to: "/features/messaging" } },
          { icon: BookOpen, title: "Practice tracking", description: "Set assignments, track student practice logs, and share progress with parents.", link: { label: "See practice tracking", to: "/features/practice-tracking" } },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask your AI assistant to draft emails, summarise student progress, or suggest schedule optimisations.", link: { label: "Meet LoopAssist AI", to: "/features/loopassist" } },
          { icon: User, title: "Public booking page", description: "Share a branded booking link. New enquiries pick a time and you approve — no back-and-forth texts." },
        ]}
      />

      <UseCaseTestimonial
        quote="I used to spend my Sundays doing invoices. Now LessonLoop does it in one click and parents pay through the portal. I've got my weekends back."
        author="James T."
        role="Private Piano Teacher, Bristol"
      />

      <FeaturePageCTA
        headline="Focus on teaching,"
        headlineAccent="not paperwork"
        subtitle="Join thousands of UK music teachers using LessonLoop to run a professional studio — free to start, no credit card required."
      />
    </MarketingLayout>
  );
}
