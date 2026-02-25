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
  Users, UserPlus, Search, AlertTriangle, FileText, Music,
  GraduationCap, Phone, Shield, Tag, Link2, History,
  Calendar, Receipt, MessageSquare,
} from "lucide-react";

const faqs = [
  { question: "Can I store guardian/parent contact details?", answer: "Yes. Each student can have one or more guardians linked to their profile, each with their own email, phone, and portal access." },
  { question: "Can I track which instruments a student learns?", answer: "Absolutely. Assign one or more instruments per student, each with their own grade level and exam board." },
  { question: "Can I import students from a spreadsheet?", answer: "Yes. LessonLoop has a CSV import tool that maps your columns to student fields. Import hundreds of students in minutes." },
  { question: "Is student data GDPR compliant?", answer: "Yes. All student data is isolated per organisation with row-level security. You can export or delete student data at any time to comply with data requests." },
  { question: "Can I add custom notes to a student profile?", answer: "Yes. Each student profile has a notes section for lesson observations, medical notes, or anything else you need to remember." },
];

export default function FeatureStudents() {
  usePageMeta(
    "Student Management for Music Schools — Profiles, Instruments & Grades | LessonLoop",
    "Manage music students with detailed profiles, instrument tracking, grade history, guardian links, and GDPR-compliant records. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/students",
      ogTitle: "Student Management for Music Schools | LessonLoop",
      ogDescription: "Detailed student profiles with instrument tracking, grade history, guardian links, and GDPR-compliant records.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/students",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Student Management"
        description="Music student management with detailed profiles, instrument tracking, grade history, and guardian links."
        canonical="https://lessonloop.co.uk/features/students"
        breadcrumbName="Students"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Student Management"
        badgeIcon={Users}
        title="Every student, every detail,"
        titleAccent="one place"
        subtitle="Rich student profiles with instruments, grades, guardian links, lesson history, and notes — so you always know exactly where each student is on their musical journey."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Student info scattered everywhere"
        subtitle="Spreadsheets, notebooks, email threads — finding the right information about a student shouldn't require detective work."
        painPoints={[
          { icon: Search, title: "Can't find what you need", description: "Grade levels in one spreadsheet, contact details in another, lesson notes in your head. Nothing is connected." },
          { icon: AlertTriangle, title: "Guardian details out of date", description: "Phone numbers change, emails bounce, and you only find out when you need to reach someone urgently." },
          { icon: FileText, title: "No lesson history at a glance", description: "How many lessons has this student had this term? What did you cover last week? Impossible to answer quickly." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Student profiles built for music teachers"
        subtitle="Everything you need to know about a student — instruments, grades, guardians, attendance, and notes — in one connected profile."
        features={[
          { icon: Music, title: "Instruments & grades", description: "Track which instruments each student learns, their current grade, exam board, and full grade change history." },
          { icon: GraduationCap, title: "Grade progression", description: "See a student's grade journey over time. Record exam results and track progress towards the next level." },
          { icon: Phone, title: "Guardian links", description: "Link one or more guardians to each student. Store contact details and manage portal access from the student profile." },
          { icon: History, title: "Lesson & attendance history", description: "See every lesson a student has attended, missed, or cancelled — with dates, teachers, and notes." },
          { icon: Tag, title: "Custom notes & tags", description: "Add lesson observations, medical notes, or custom tags. Filter and search students by any field." },
          { icon: Shield, title: "GDPR-compliant records", description: "All data isolated per organisation. Export or delete student data anytime for subject access requests." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Student records set up in minutes"
        steps={[
          { step: "1", title: "Add or import students", description: "Create students one by one or bulk-import from CSV. Map your columns and import hundreds in minutes." },
          { step: "2", title: "Assign instruments & guardians", description: "Link instruments, set grade levels, and connect guardians. Everything is linked from day one." },
          { step: "3", title: "Teach with full context", description: "Before every lesson, see the student's history, grade, notes, and attendance — all in one view." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Students are linked to lessons. See a student's full schedule from their profile.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Receipt, title: "Invoicing & Billing", description: "Rate cards are assigned per student. Invoices are generated from their lesson attendance.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: MessageSquare, title: "Parent Portal", description: "Guardians linked to students get portal access to view lessons, invoices, and practice.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
        ]}
      />

      <FeaturePageCTA
        headline="Know every student inside out."
        headlineAccent="Start organising today."
        subtitle="Rich student profiles that connect instruments, grades, guardians, and lesson history — all in one place."
      />
    </MarketingLayout>
  );
}
