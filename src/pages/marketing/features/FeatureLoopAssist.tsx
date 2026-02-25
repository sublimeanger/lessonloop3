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
  Sparkles, Brain, Clock, AlertTriangle, Search,
  MessageSquare, FileText, Zap, Shield, BarChart3,
  Calendar, Receipt, Users,
} from "lucide-react";

const faqs = [
  { question: "What can LoopAssist do?", answer: "LoopAssist can answer questions about your schedule, students, and invoices. It can draft emails, summarise attendance, propose invoice runs, and suggest reschedule slots — all from a chat interface." },
  { question: "Can LoopAssist take actions automatically?", answer: "No. LoopAssist proposes actions and shows you exactly what it wants to do. You review and confirm before anything happens. Every action is logged in the audit trail." },
  { question: "Is my data safe with AI?", answer: "Yes. LoopAssist only accesses data within your organisation. It never shares data across organisations, and all queries are processed securely." },
  { question: "Do I need to pay extra for LoopAssist?", answer: "LoopAssist is included in the Pro and Academy plans at no extra cost. It's not available on the Solo plan." },
  { question: "Can I use LoopAssist on mobile?", answer: "Yes. LoopAssist works in the chat panel on any device — desktop, tablet, or mobile." },
];

export default function FeatureLoopAssist() {
  usePageMeta(
    "LoopAssist AI — Smart Assistant for Music Teachers | LessonLoop",
    "Meet LoopAssist, the AI assistant built into LessonLoop. Ask questions, draft emails, get scheduling suggestions, and manage your music school with natural language. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/loopassist",
      ogTitle: "LoopAssist AI — Smart Assistant for Music Teachers | LessonLoop",
      ogDescription: "AI assistant built into LessonLoop. Ask questions about your schedule, draft emails, and manage your music school with natural language.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/loopassist",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="LoopAssist AI Assistant"
        description="AI assistant for music teachers — ask questions, draft emails, get scheduling suggestions, and manage your school with natural language."
        canonical="https://lessonloop.co.uk/features/loopassist"
        breadcrumbName="LoopAssist AI"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="LoopAssist AI"
        badgeIcon={Sparkles}
        title="Your AI assistant that"
        titleAccent="knows your school"
        subtitle="Ask questions in plain English. Get instant answers about your schedule, students, and invoices. Draft emails, find gaps, and manage your school — all from a simple chat."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="You're drowning in admin questions"
        subtitle="How many lessons did I teach last month? Who hasn't paid? When's my next free slot? Answering these shouldn't take 15 minutes each."
        painPoints={[
          { icon: Search, title: "Hunting for information", description: "Clicking through screens to find a student's attendance, an overdue invoice, or your schedule for next week. It adds up fast." },
          { icon: Clock, title: "Repetitive admin tasks", description: "Drafting the same reminder emails, summarising the week, calculating lesson counts — over and over again." },
          { icon: AlertTriangle, title: "Decision fatigue", description: "When should I reschedule this lesson? Who needs a reminder? What's my revenue this term? You need answers, not more screens." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="An AI assistant that works with your data"
        subtitle="LoopAssist reads your real schedule, student records, and invoice data — then gives you answers, drafts, and suggestions in seconds."
        features={[
          { icon: Search, title: "Ask anything", description: "\"Who has lessons tomorrow?\" \"What's outstanding this month?\" \"Show me Sarah's attendance.\" Just type naturally." },
          { icon: FileText, title: "Draft emails & messages", description: "Ask LoopAssist to draft a payment reminder, a cancellation notice, or a term welcome email. Edit and send." },
          { icon: Zap, title: "Propose actions", description: "LoopAssist can suggest invoice runs, reschedule slots, or attendance follow-ups. You review and confirm before anything happens." },
          { icon: Brain, title: "Contextual awareness", description: "LoopAssist knows your schedule, students, terms, and billing data. It gives answers specific to your school, not generic advice." },
          { icon: Shield, title: "Confirm before executing", description: "Every proposed action requires your approval. Nothing happens behind the scenes. Every action is logged in the audit trail." },
          { icon: BarChart3, title: "Quick insights", description: "Revenue this term, lessons delivered, cancellation rates — get summaries without opening a single report." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="AI that's simple to use"
        steps={[
          { step: "1", title: "Open the chat", description: "LoopAssist lives in a chat panel within LessonLoop. Click to open it anytime — desktop or mobile." },
          { step: "2", title: "Ask or request", description: "Type a question or request in plain English. LoopAssist reads your data and responds instantly." },
          { step: "3", title: "Review and confirm", description: "If LoopAssist proposes an action, you see exactly what it will do. Approve with one click, or edit first." },
        ]}
      />

      <FeaturePageRelated
        headline="LoopAssist works across"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Ask LoopAssist to find free slots, summarise your week, or check for conflicts.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Receipt, title: "Invoicing & Billing", description: "Get instant answers on outstanding invoices, revenue summaries, and payment status.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Users, title: "Parent Portal", description: "Draft parent communications, check who's been notified, and flag overdue families.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
        ]}
      />

      <FeaturePageCTA
        headline="Meet your new admin assistant."
        headlineAccent="It already knows your school."
        subtitle="LoopAssist is built into LessonLoop Pro and Academy plans. Ask questions, draft emails, and manage your school with AI — no extra cost."
      />
    </MarketingLayout>
  );
}
