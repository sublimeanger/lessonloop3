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
  UserCheck, Clock, AlertTriangle, Users, CalendarDays,
  Music, MapPin, PoundSterling, Shield, Eye, BarChart3,
  Calendar, Receipt, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "Can teachers set their own availability?", answer: "Yes. Each teacher defines their weekly availability blocks by day, time, and location. Admins can view and adjust availability across the team." },
  { question: "Can I assign teachers to specific locations?", answer: "Absolutely. Teachers can be assigned to one or more locations, each with their own availability and room access." },
  { question: "Does LessonLoop track teacher pay?", answer: "Yes. Set hourly or per-lesson pay rates for each teacher. Payroll reports calculate earnings automatically from delivered lessons." },
  { question: "Can teachers see only their own schedule?", answer: "Yes. Role-based access ensures teachers see only their own students, lessons, and schedules. Admins see everything." },
  { question: "Can I invite teachers to join LessonLoop?", answer: "Yes. Send an email invite with the teacher role. They sign up, set their availability, and start seeing their schedule immediately." },
];

export default function FeatureTeachers() {
  usePageMeta(
    "Teacher Management for Music Schools — Availability, Payroll & Profiles | LessonLoop",
    "Manage music teachers with availability scheduling, payroll tracking, role-based access, and multi-location assignment. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/teachers",
      ogTitle: "Teacher Management for Music Schools | LessonLoop",
      ogDescription: "Availability scheduling, payroll tracking, role-based access, and multi-location assignment for music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/teachers",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Teacher Management"
        description="Music teacher management with availability scheduling, payroll tracking, role-based access, and multi-location support."
        canonical="https://lessonloop.co.uk/features/teachers"
        breadcrumbName="Teachers"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Teacher Management"
        badgeIcon={UserCheck}
        title="Manage your teaching team"
        titleAccent="with clarity"
        subtitle="Availability scheduling, payroll tracking, role-based access, and multi-location assignment — everything you need to run a team of music teachers."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Managing teachers shouldn't mean more admin"
        subtitle="Coordinating availability, calculating pay, and making sure everyone sees the right information — it's a full-time job on its own."
        painPoints={[
          { icon: Clock, title: "Availability chaos", description: "Tracking who teaches when, where, and for how long — across multiple locations — using spreadsheets or WhatsApp messages." },
          { icon: AlertTriangle, title: "Payroll is manual", description: "Counting lessons, calculating hours, applying different rates — all done by hand every month. Errors are inevitable." },
          { icon: Users, title: "No role separation", description: "Teachers can see other teachers' schedules, student details, or billing info they shouldn't have access to." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Teacher tools built for music schools"
        subtitle="LessonLoop gives every teacher their own profile, schedule, and role-based view — while giving admins full visibility."
        features={[
          { icon: CalendarDays, title: "Availability management", description: "Teachers set weekly availability by day, time, and location. The scheduler respects these automatically." },
          { icon: PoundSterling, title: "Pay rates & payroll", description: "Set hourly or per-lesson pay rates. Payroll reports calculate earnings from delivered lessons automatically." },
          { icon: MapPin, title: "Multi-location assignment", description: "Assign teachers to one or more locations. Each location has its own rooms and availability windows." },
          { icon: Eye, title: "Role-based access", description: "Teachers see only their own students and schedule. Admins and owners see the full picture across the team." },
          { icon: Music, title: "Instrument specialisations", description: "Record which instruments each teacher covers. Match teachers to students by instrument and availability." },
          { icon: BarChart3, title: "Performance insights", description: "Track lessons delivered, cancellation rates, and utilisation per teacher. Spot trends and support your team." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Your team set up in minutes"
        steps={[
          { step: "1", title: "Invite teachers", description: "Send an email invite with the teacher role. Teachers sign up and set their own availability." },
          { step: "2", title: "Assign locations & rates", description: "Link teachers to locations, set pay rates, and assign instrument specialisations." },
          { step: "3", title: "Schedule with confidence", description: "The calendar respects availability, prevents conflicts, and teachers see only their own schedule." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Teacher availability feeds directly into the calendar. No more double-booking or scheduling outside hours.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Receipt, title: "Invoicing & Billing", description: "Payroll reports are generated from delivered lessons — matching teacher pay rates to actual teaching.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which teachers have capacity, who's delivered the most lessons, or who needs cover.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Run your teaching team smoothly."
        headlineAccent="Start free today."
        subtitle="Availability, payroll, and role-based access — everything you need to manage a team of music teachers in one platform."
      />
    </MarketingLayout>
  );
}
