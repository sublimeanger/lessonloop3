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
  ClipboardCheck, Clock, AlertTriangle, XCircle, CheckCircle,
  Bell, BarChart3, Calendar, FileText, Zap, Shield,
  Receipt, Users, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "How do I mark attendance?", answer: "Open the daily register or click into any lesson. Mark each student as present, absent, late, or cancelled with one tap." },
  { question: "Can I record absence reasons?", answer: "Yes. Choose from categories like illness, holiday, or no-show. Add free-text notes for additional context." },
  { question: "Are parents notified of absences?", answer: "You can configure automatic notifications when a student is marked absent. Parents see attendance in their portal too." },
  { question: "Can I see attendance trends over time?", answer: "Yes. Attendance reports show per-student, per-teacher, and per-instrument trends across any date range." },
  { question: "Does attendance affect billing?", answer: "It can. When generating invoices from the schedule, you choose whether to bill for attended lessons only or all scheduled lessons." },
];

export default function FeatureAttendance() {
  usePageMeta(
    "Attendance Tracking for Music Lessons — Register, Reports & Alerts | LessonLoop",
    "Track music lesson attendance with a daily register, absence categorisation, parent notifications, and trend reports. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/attendance",
      ogTitle: "Attendance Tracking for Music Lessons | LessonLoop",
      ogDescription: "Daily register, absence categorisation, parent notifications, and attendance trend reports for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/attendance",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Attendance Tracking"
        description="Music lesson attendance tracking with daily register, absence categorisation, parent notifications, and trend reports."
        canonical="https://lessonloop.co.uk/features/attendance"
        breadcrumbName="Attendance"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Attendance Tracking"
        badgeIcon={ClipboardCheck}
        title="Attendance tracking that"
        titleAccent="takes seconds"
        subtitle="A daily register built for music teachers. Mark attendance in one tap, categorise absences, notify parents, and track trends — all connected to your schedule and billing."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Attendance shouldn't be guesswork"
        subtitle="Scribbled notes, forgotten marks, and no idea who's been absent three weeks in a row."
        painPoints={[
          { icon: Clock, title: "Takes too long", description: "Marking attendance in a spreadsheet or notebook after every lesson. It's tedious and easy to forget." },
          { icon: AlertTriangle, title: "No absence patterns", description: "You don't notice a student has missed four lessons in a row until a parent asks why they're being billed." },
          { icon: XCircle, title: "No parent visibility", description: "Parents don't know if their child was marked present or absent unless you tell them manually." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Attendance built into your workflow"
        subtitle="Mark attendance from the daily register or directly on any lesson. Everything flows into reports and billing automatically."
        features={[
          { icon: CheckCircle, title: "One-tap marking", description: "Present, absent, late, or cancelled — mark each student with a single tap from the daily register." },
          { icon: FileText, title: "Absence categorisation", description: "Record reasons like illness, holiday, or no-show. Add notes for context. Build a clear absence record." },
          { icon: Bell, title: "Parent notifications", description: "Automatically notify parents when their child is marked absent. They also see attendance in the portal." },
          { icon: BarChart3, title: "Attendance reports", description: "Per-student, per-teacher, and per-instrument trends. Spot patterns before they become problems." },
          { icon: Zap, title: "Batch attendance", description: "Mark attendance for group lessons or a full day in one go. Perfect for busy teaching days." },
          { icon: Shield, title: "Audit trail", description: "Every attendance mark is timestamped and linked to the teacher who recorded it. Full accountability." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Attendance in three taps"
        steps={[
          { step: "1", title: "Open the register", description: "The daily register shows today's lessons with all students. Open it before, during, or after teaching." },
          { step: "2", title: "Mark each student", description: "Tap present, absent, late, or cancelled. Add an absence reason if needed. Done in seconds." },
          { step: "3", title: "Review and report", description: "Attendance data flows into student profiles, reports, and billing. Parents see it in their portal." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Receipt, title: "Invoicing & Billing", description: "Choose to bill for attended lessons only or all scheduled lessons. Attendance drives accurate invoicing.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Users, title: "Parent Portal", description: "Parents see their child's attendance history in real time. No need for manual reports.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist who's been absent recently, or get a summary of attendance trends this term.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Never lose track of attendance again."
        headlineAccent="Start free today."
        subtitle="A daily register that takes seconds, not minutes. Connected to billing, parent notifications, and trend reports."
      />
    </MarketingLayout>
  );
}
