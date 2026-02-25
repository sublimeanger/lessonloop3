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
  MessageSquare, Clock, AlertTriangle, Mail, Send,
  FileText, Bell, Users, Shield, Inbox, Archive,
  Calendar, Receipt, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "Can parents message teachers directly?", answer: "Yes. Parents send messages from the portal. Teachers receive them in their LessonLoop inbox. Everything stays in one professional thread." },
  { question: "Can I send bulk messages?", answer: "Yes. Use messaging templates to send announcements to all parents, a specific class, or selected guardians." },
  { question: "Are messages stored securely?", answer: "Yes. All messages are encrypted in transit and at rest. Messages are isolated per organisation with row-level security." },
  { question: "Can I use message templates?", answer: "Absolutely. Create reusable templates for common communications — term reminders, payment nudges, schedule changes, and more." },
  { question: "Do parents get email notifications for messages?", answer: "Yes. When a teacher sends a message, parents receive an email notification with a link to view it in the portal." },
];

export default function FeatureMessaging() {
  usePageMeta(
    "Messaging for Music Schools — Teacher-Parent Communication | LessonLoop",
    "Professional messaging between teachers and parents. Templates, threaded conversations, and email notifications — all built into LessonLoop. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/messaging",
      ogTitle: "Messaging for Music Schools | LessonLoop",
      ogDescription: "Professional teacher-parent messaging with templates, threaded conversations, and email notifications.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/messaging",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Messaging"
        description="Professional messaging for music schools — teacher-parent communication with templates, threads, and notifications."
        canonical="https://lessonloop.co.uk/features/messaging"
        breadcrumbName="Messaging"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Messaging"
        badgeIcon={MessageSquare}
        title="Professional communication"
        titleAccent="without the chaos"
        subtitle="Keep all teacher-parent communication in one place. Threaded messages, reusable templates, and email notifications — no more scattered WhatsApp groups."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Communication shouldn't mean chaos"
        subtitle="WhatsApp at 10pm, emails buried in spam, and text messages you forgot to reply to."
        painPoints={[
          { icon: AlertTriangle, title: "Messages everywhere", description: "WhatsApp, email, text, Facebook — parents message on whatever platform they prefer, and you lose track." },
          { icon: Clock, title: "Repetitive messages", description: "Typing the same term reminder, payment nudge, or schedule update for every parent individually." },
          { icon: Mail, title: "No professional boundary", description: "Personal phone number shared with parents. Messages at all hours. No separation between work and life." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Messaging designed for music schools"
        subtitle="One inbox for all parent communication. Professional, threaded, and connected to your schedule and billing."
        features={[
          { icon: Inbox, title: "Unified inbox", description: "All parent messages in one place. No more switching between apps. Read, reply, and track from LessonLoop." },
          { icon: Send, title: "Direct messaging", description: "Send messages to individual parents or guardians. Threaded conversations keep context clear." },
          { icon: FileText, title: "Message templates", description: "Create reusable templates for term reminders, payment nudges, cancellation notices, and more." },
          { icon: Users, title: "Bulk messaging", description: "Send announcements to all parents, a specific teacher's families, or a hand-picked group." },
          { icon: Bell, title: "Email notifications", description: "Parents receive email alerts for new messages. They click through to the portal to read and reply." },
          { icon: Shield, title: "Professional boundaries", description: "No personal phone numbers needed. Communication stays within the platform, with clear work-life separation." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Messaging in three steps"
        steps={[
          { step: "1", title: "Write or pick a template", description: "Compose a message from scratch or choose a saved template. Personalise with student or guardian names." },
          { step: "2", title: "Send to parents", description: "Send to one parent, a group, or everyone. Parents get an email notification with a portal link." },
          { step: "3", title: "Track and reply", description: "See read status and replies in your inbox. Threaded conversations keep everything organised." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Notify parents about schedule changes, cancellations, or new lesson times directly from the calendar.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Receipt, title: "Invoicing & Billing", description: "Send payment reminders alongside invoices. Parents see both in the portal.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist to draft a message, write a term update, or compose a payment reminder.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Communicate professionally."
        headlineAccent="Reclaim your evenings."
        subtitle="One inbox, message templates, and email notifications. Keep parent communication professional and in one place."
      />
    </MarketingLayout>
  );
}
