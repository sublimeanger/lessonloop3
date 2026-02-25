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
  Calendar, Clock, Repeat, AlertTriangle, Users, MapPin,
  CalendarDays, RefreshCw, Bell, Eye, Layers, GripVertical,
  Receipt, MessageSquare, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "Can I set up recurring weekly lessons?", answer: "Yes. Create a lesson once and LessonLoop generates every occurrence across the term automatically, respecting closure dates and holidays." },
  { question: "Does LessonLoop detect scheduling conflicts?", answer: "Absolutely. Real-time conflict detection prevents double-booking teachers, rooms, or students before you save." },
  { question: "Can I manage multiple locations?", answer: "Yes. Each location has its own rooms, availability, and closure dates. Switch between them from one calendar view." },
  { question: "What happens when I reschedule a lesson?", answer: "Drag-and-drop or edit the lesson. LessonLoop updates the calendar, notifies parents, and syncs with Google Calendar if connected." },
  { question: "Does it work with UK term dates?", answer: "Yes. Define your own terms, half-terms, and bank holidays. Recurring lessons automatically skip closure dates." },
];

export default function FeatureScheduling() {
  usePageMeta(
    "Music Lesson Scheduling Software — Drag & Drop Calendar | LessonLoop",
    "Schedule music lessons with drag-and-drop ease. Recurring lessons, conflict detection, UK term dates, multi-location support, and Google Calendar sync. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/scheduling",
      ogTitle: "Music Lesson Scheduling Software | LessonLoop",
      ogDescription: "Drag-and-drop calendar built for music teachers. Recurring lessons, conflict detection, term dates, and Google Calendar sync.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/scheduling",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Music Lesson Scheduling"
        description="Drag-and-drop calendar for music teachers with recurring lessons, conflict detection, UK term dates, and multi-location support."
        canonical="https://lessonloop.co.uk/features/scheduling"
        breadcrumbName="Scheduling"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Scheduling"
        badgeIcon={Calendar}
        title="Music lesson scheduling that"
        titleAccent="actually works"
        subtitle="A drag-and-drop calendar built for the way music teachers really work — with recurring lessons, conflict detection, UK term dates, and multi-location support."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Scheduling shouldn't be your second job"
        subtitle="Most calendar tools weren't designed for music teaching. You end up working around them instead of with them."
        painPoints={[
          { icon: AlertTriangle, title: "Double bookings & conflicts", description: "Generic calendars don't understand teacher availability, room capacity, or student overlap — so clashes happen constantly." },
          { icon: Clock, title: "Hours lost to admin", description: "Setting up recurring lessons, handling reschedules, chasing confirmations — it all adds up to hours you should be teaching." },
          { icon: Repeat, title: "Term dates are manual", description: "UK term dates, half-terms, bank holidays — most tools ignore them entirely, leaving you to manually skip or cancel." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="A calendar designed for music teachers"
        subtitle="Every scheduling feature in LessonLoop was built from real teaching patterns — not generic project management."
        features={[
          { icon: GripVertical, title: "Drag-and-drop calendar", description: "Move lessons with a simple drag. Day, week, and month views with colour-coded lessons by teacher, instrument, or location." },
          { icon: Repeat, title: "Recurring lessons", description: "Set up weekly or fortnightly patterns once. LessonLoop generates every occurrence across the whole term automatically." },
          { icon: Eye, title: "Real-time conflict detection", description: "Instantly see clashes for teachers, rooms, and students before you save. No more double-booking." },
          { icon: CalendarDays, title: "UK term date support", description: "Define terms, half-terms, and closure dates. Recurring lessons automatically skip holidays and bank holidays." },
          { icon: MapPin, title: "Multi-location & rooms", description: "Manage multiple teaching venues, each with their own rooms, availability windows, and closure dates." },
          { icon: RefreshCw, title: "Google Calendar sync", description: "Two-way sync keeps your personal and teaching calendars aligned. Changes in LessonLoop appear in Google instantly." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Get your schedule running in minutes"
        steps={[
          { step: "1", title: "Set your availability", description: "Define when and where you teach. Set term dates, closure days, and room availability." },
          { step: "2", title: "Add your lessons", description: "Create one-off or recurring lessons. Assign students, teachers, and rooms. Conflicts are caught instantly." },
          { step: "3", title: "Teach with confidence", description: "Your calendar is always up to date. Reschedule with drag-and-drop. Parents are notified automatically." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Receipt, title: "Invoicing & Billing", description: "Lessons flow straight into invoices. Bill by term, month, or lesson count.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: MessageSquare, title: "Parent Portal", description: "Parents see upcoming lessons, receive updates, and confirm changes — all without email chains.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask your AI assistant to find gaps, suggest reschedule slots, or summarise your week.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Ready to take control of your schedule?"
        headlineAccent="Start free today."
        subtitle="Join UK music teachers who've ditched spreadsheets and sticky notes for a calendar that actually understands music teaching."
      />
    </MarketingLayout>
  );
}
