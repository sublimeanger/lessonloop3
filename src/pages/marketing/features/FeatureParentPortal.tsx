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
  Users, MessageSquare, AlertTriangle, Clock, Eye,
  CalendarDays, Receipt, Music, Bell, Shield, BookOpen,
  Calendar, Sparkles, CreditCard,
} from "lucide-react";

const faqs = [
  { question: "What can parents see in the portal?", answer: "Parents can view upcoming lessons, attendance history, invoices, payment status, practice assignments, and messages from teachers." },
  { question: "Can parents pay invoices through the portal?", answer: "Yes. Parents can view invoice details and make payments directly through the portal if Stripe is connected." },
  { question: "Is the parent portal secure?", answer: "Absolutely. Each parent has their own login. Row-level security ensures they only see data for their own children." },
  { question: "Can parents message teachers?", answer: "Yes. Built-in messaging keeps communication professional and in one place — no more scattered WhatsApp threads." },
  { question: "How do parents get access?", answer: "You invite parents by email. They receive a secure link, set a password, and are connected to their child's profile instantly." },
];

export default function FeatureParentPortal() {
  usePageMeta(
    "Parent Portal for Music Schools — Lessons, Invoices & Messaging | LessonLoop",
    "Give parents their own portal to view lessons, pay invoices, track practice, and message teachers. Secure, branded, and built for music schools. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/parent-portal",
      ogTitle: "Parent Portal for Music Schools | LessonLoop",
      ogDescription: "A secure portal where parents view lessons, pay invoices, track practice, and message teachers. Built for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/parent-portal",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Parent Portal"
        description="Secure parent portal for music schools — view lessons, pay invoices, track practice, and message teachers."
        canonical="https://lessonloop.co.uk/features/parent-portal"
        breadcrumbName="Parent Portal"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Parent Portal"
        badgeIcon={Users}
        title="Keep parents in the loop"
        titleAccent="without the chaos"
        subtitle="A secure, branded portal where parents view lessons, pay invoices, track practice, and message teachers — all without a single WhatsApp group."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Communication chaos costs you time"
        subtitle="WhatsApp messages at 10pm, lost emails, payment confusion — parents deserve better, and so do you."
        painPoints={[
          { icon: MessageSquare, title: "Scattered communication", description: "Messages across WhatsApp, email, and text. Important updates get buried, and you lose track of who said what." },
          { icon: AlertTriangle, title: "Invoice confusion", description: "Parents can't find invoices, don't know what's outstanding, and you end up re-sending the same PDF three times." },
          { icon: Clock, title: "Constant back-and-forth", description: "Questions about lesson times, practice assignments, and payments — all answered individually, over and over." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="One portal for everything parents need"
        subtitle="Give parents a single, secure place to stay informed — and take the pressure off your inbox."
        features={[
          { icon: CalendarDays, title: "Lesson schedule view", description: "Parents see all upcoming lessons, past attendance, and any schedule changes — always up to date." },
          { icon: Receipt, title: "Invoice & payment access", description: "View invoices, check payment status, and pay online. No more chasing or re-sending PDFs." },
          { icon: BookOpen, title: "Practice tracking", description: "Students and parents see practice assignments, log practice time, and track progress between lessons." },
          { icon: Bell, title: "Notifications", description: "Automatic alerts for lesson changes, new invoices, and practice reminders. Parents stay informed without you lifting a finger." },
          { icon: MessageSquare, title: "Built-in messaging", description: "Professional, threaded messaging between parents and teachers. Everything in one place, not scattered across apps." },
          { icon: Shield, title: "Secure & private", description: "Each parent sees only their own children. Row-level security and email-verified logins keep data safe." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Parents up and running in minutes"
        steps={[
          { step: "1", title: "Invite parents", description: "Add a guardian to a student profile and send an invite. They receive a secure email link instantly." },
          { step: "2", title: "Parents set up their account", description: "A simple sign-up flow. No app to download — it works in any browser on any device." },
          { step: "3", title: "Everything in one place", description: "Parents see lessons, invoices, practice, and messages. You stop answering the same questions on repeat." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Schedule changes update the parent portal in real time. No need to notify parents manually.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: CreditCard, title: "Invoicing & Billing", description: "Invoices appear in the parent portal automatically. Parents can view and pay without email.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Use AI to draft parent communications, summarise attendance, or flag overdue invoices.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Give parents the experience they deserve."
        headlineAccent="You'll love it too."
        subtitle="A professional parent portal that saves you hours of messaging, chasing, and explaining. Built into every LessonLoop plan."
      />
    </MarketingLayout>
  );
}
