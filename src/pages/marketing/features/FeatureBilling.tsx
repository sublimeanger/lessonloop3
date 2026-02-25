import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import FeaturePageHero from "@/components/marketing/feature-page/FeaturePageHero";
import FeaturePageProblem from "@/components/marketing/feature-page/FeaturePageProblem";
import FeaturePageSolution from "@/components/marketing/feature-page/FeaturePageSolution";
import FeaturePageHowItWorks from "@/components/marketing/feature-page/FeaturePageHowItWorks";
import FeaturePageRelated from "@/components/marketing/feature-page/FeaturePageRelated";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  Receipt, PoundSterling, Clock, AlertTriangle, FileText, Zap,
  Calculator, Bell, CreditCard, Layers, RefreshCw,
  Calendar, MessageSquare, BarChart3,
} from "lucide-react";

const faqs = [
  { question: "Can I bill by term or by month?", answer: "Yes. LessonLoop supports termly billing runs, monthly invoicing, and per-lesson billing. Mix and match across different students." },
  { question: "Does LessonLoop handle VAT?", answer: "Yes. Set your VAT rate (or zero-rate for exempt teachers). VAT is calculated and shown on every invoice automatically." },
  { question: "Can I send payment reminders?", answer: "Absolutely. Automated reminders go out before and after due dates. You can also send manual nudges with one click." },
  { question: "What payment methods are supported?", answer: "LessonLoop generates invoices in GBP. Parents can pay via bank transfer, or you can connect Stripe for card payments." },
  { question: "Can I run bulk billing for the whole term?", answer: "Yes. Select a term, preview every invoice, and approve the batch. Hundreds of invoices generated in seconds." },
];

export default function FeatureBilling() {
  usePageMeta(
    "Music School Invoicing & Billing Software — GBP, VAT, Termly Runs | LessonLoop",
    "Automate music school invoicing with LessonLoop. GBP billing, UK VAT support, termly billing runs, payment tracking, and automated reminders. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/billing",
      ogTitle: "Music School Invoicing & Billing Software | LessonLoop",
      ogDescription: "GBP invoicing, UK VAT, termly billing runs, payment tracking, and automated reminders — built for UK music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/billing",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Music School Invoicing & Billing"
        description="Automated invoicing for music schools with GBP billing, UK VAT, termly billing runs, and payment tracking."
        canonical="https://lessonloop.co.uk/features/billing"
        breadcrumbName="Billing"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Invoicing & Billing"
        badgeIcon={Receipt}
        title="Music school billing that"
        titleAccent="runs itself"
        subtitle="Generate invoices from your schedule automatically. GBP native, UK VAT ready, with termly billing runs and payment reminders — so you get paid without chasing."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Chasing payments shouldn't be this hard"
        subtitle="Spreadsheets, manual calculations, and awkward payment conversations — billing is the part of teaching nobody signed up for."
        painPoints={[
          { icon: Clock, title: "Hours spent on invoices", description: "Manually calculating lesson counts, applying rates, and formatting invoices eats into your evenings and weekends." },
          { icon: AlertTriangle, title: "Missed payments pile up", description: "Without automated reminders, overdue invoices quietly stack up — and chasing feels uncomfortable." },
          { icon: PoundSterling, title: "Currency & VAT confusion", description: "Most tools default to USD. UK teachers need GBP invoicing with optional VAT — not workarounds." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Invoicing designed for music teachers"
        subtitle="LessonLoop turns your schedule into invoices automatically — with every UK-specific detail handled for you."
        features={[
          { icon: Zap, title: "Auto-generate from schedule", description: "Invoices are created directly from attended lessons. No manual data entry — your calendar is your billing source." },
          { icon: Layers, title: "Termly billing runs", description: "Select a term, preview the batch, and generate hundreds of invoices in seconds. Perfect for academies." },
          { icon: PoundSterling, title: "GBP & VAT native", description: "All amounts in pounds sterling. Set your VAT rate or mark as exempt. VAT is shown clearly on every invoice." },
          { icon: Bell, title: "Automated reminders", description: "Payment reminders sent before and after due dates. Customise the timing and message to match your style." },
          { icon: Calculator, title: "Rate cards & pricing", description: "Set per-lesson, per-term, or custom rates. Apply different rates by instrument, duration, or student." },
          { icon: CreditCard, title: "Payment tracking", description: "Mark payments as received, track partial payments, and see outstanding balances at a glance." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="From lessons to paid invoices in three steps"
        steps={[
          { step: "1", title: "Set your rates", description: "Create rate cards for different lesson types, durations, and instruments. Assign rates to students." },
          { step: "2", title: "Generate invoices", description: "Run a billing batch for a term or month. LessonLoop calculates everything from your schedule and attendance." },
          { step: "3", title: "Get paid automatically", description: "Invoices are sent to parents. Reminders go out on schedule. Payments are tracked in one dashboard." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Your schedule feeds directly into billing. Every lesson, cancellation, and make-up is accounted for.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: MessageSquare, title: "Parent Portal", description: "Parents view and pay invoices through their portal. No more email attachments.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
          { icon: BarChart3, title: "Reports", description: "Revenue reports, outstanding ageing, and payment summaries — all built from your billing data.", to: "/features/reports", linkText: "Explore reporting features" },
        ]}
      />

      <FeaturePageCTA
        headline="Stop chasing payments."
        headlineAccent="Start getting paid."
        subtitle="LessonLoop automates your invoicing so you can focus on teaching. GBP, VAT, and termly billing — built for UK music educators."
      />
    </MarketingLayout>
  );
}
