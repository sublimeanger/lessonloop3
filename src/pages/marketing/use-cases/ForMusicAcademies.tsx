import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import UseCaseHero from "@/components/marketing/use-case/UseCaseHero";
import UseCasePainPoints from "@/components/marketing/use-case/UseCasePainPoints";
import UseCaseFeatures from "@/components/marketing/use-case/UseCaseFeatures";
import UseCaseTestimonial from "@/components/marketing/use-case/UseCaseTestimonial";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  Building2, Users, CalendarDays, CreditCard, BarChart3, MapPin,
  AlertTriangle, Clock, FileSpreadsheet, ShieldAlert, Repeat, UserCheck,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/music-academies";

const FAQS = [
  { question: "Can LessonLoop handle multiple locations?", answer: "Yes. Add unlimited locations, each with their own rooms, closure dates, and teacher assignments. All managed from one dashboard." },
  { question: "Does it support team billing and payroll?", answer: "Absolutely. Run bulk billing across all students, track teacher hours, and generate payroll reports by location or term." },
  { question: "What roles and permissions are available?", answer: "LessonLoop supports Owner, Admin, Teacher, Finance, and Parent roles, each with tailored dashboards and data access." },
  { question: "Is there a parent portal?", answer: "Yes. Parents can view schedules, pay invoices, track practice, and message teachers through a dedicated family portal." },
];

export default function ForMusicAcademies() {
  usePageMeta(
    "Music Academy Management Software | LessonLoop",
    "All-in-one scheduling, billing, and parent communication for multi-teacher music academies. Built for the UK. Free 30-day trial.",
    {
      ogTitle: "Music Academy Management Software | LessonLoop",
      ogDescription: "Run your music academy with LessonLoop — scheduling, invoicing, attendance, and parent portals in one platform.",
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
        name="Music Academy Management"
        description="All-in-one scheduling, billing, attendance, and parent communication software for multi-teacher music academies."
        canonical={CANONICAL}
        breadcrumbName="Music Academies"
        faqs={FAQS}
      />

      <UseCaseHero
        badge="For Music Academies"
        badgeIcon={Building2}
        title="Run your music academy with"
        titleAccent="clarity, not chaos"
        subtitle="Multi-teacher timetabling, automated invoicing, parent portals, and performance reports — everything a growing academy needs, in one place."
      />

      <UseCasePainPoints
        headline="Scaling an academy shouldn't mean scaling admin"
        subtitle="Sound familiar? These are the headaches LessonLoop eliminates."
        painPoints={[
          { icon: AlertTriangle, title: "Scheduling collisions", description: "Double-booked rooms and teacher clashes eat into lesson time and parent trust." },
          { icon: Clock, title: "Hours lost on invoicing", description: "Manual spreadsheets for termly billing across 50+ families is unsustainable." },
          { icon: FileSpreadsheet, title: "Scattered data", description: "Student notes in one app, finances in another, attendance on paper — nothing talks to anything." },
          { icon: ShieldAlert, title: "No role boundaries", description: "Everyone sees everything. Teachers access financials, parents email personal numbers." },
          { icon: Repeat, title: "Repetitive admin", description: "Copy-pasting reminders, re-entering term dates, manually chasing overdue payments." },
          { icon: UserCheck, title: "Onboarding new staff", description: "Training each new teacher on a patchwork of tools wastes weeks every hire." },
        ]}
      />

      <UseCaseFeatures
        headline="Everything your academy needs"
        subtitle="Purpose-built features that grow with you — from 5 teachers to 50."
        features={[
          { icon: CalendarDays, title: "Drag-and-drop scheduling", description: "Visual calendar with conflict detection, recurring lessons, and room allocation across locations.", link: { label: "Explore scheduling features", to: "/features/scheduling" } },
          { icon: CreditCard, title: "Automated billing runs", description: "Generate termly or monthly invoices for every family in minutes. GBP, VAT-ready.", link: { label: "See invoicing and billing", to: "/features/billing" } },
          { icon: Users, title: "Parent portal", description: "Parents view schedules, pay invoices, track practice, and message teachers — all self-serve.", link: { label: "View the parent portal", to: "/features/parent-portal" } },
          { icon: MapPin, title: "Multi-location management", description: "Separate rooms, closure dates, and teacher rosters per venue. One unified dashboard.", link: { label: "Manage locations", to: "/features/locations" } },
          { icon: BarChart3, title: "Revenue & utilisation reports", description: "Track income, outstanding balances, room utilisation, and teacher performance at a glance.", link: { label: "Explore reports", to: "/features/reports" } },
          { icon: Building2, title: "Roles & permissions", description: "Owner, Admin, Teacher, Finance, and Parent roles with tailored dashboards and data boundaries.", link: { label: "Learn about teacher management", to: "/features/teachers" } },
        ]}
      />

      <UseCaseTestimonial
        quote="LessonLoop replaced four separate tools for us. Our admin team saves over 10 hours a week and parents actually pay on time now."
        author="Sarah M."
        role="Academy Director, London"
      />

      <FeaturePageCTA
        headline="Ready to streamline your"
        headlineAccent="music academy?"
        subtitle="Join hundreds of UK academies using LessonLoop to schedule, bill, and communicate — without the admin overload."
      />
    </MarketingLayout>
  );
}
