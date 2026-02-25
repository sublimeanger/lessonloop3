import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import UseCaseHero from "@/components/marketing/use-case/UseCaseHero";
import UseCasePainPoints from "@/components/marketing/use-case/UseCasePainPoints";
import UseCaseFeatures from "@/components/marketing/use-case/UseCaseFeatures";
import UseCaseTestimonial from "@/components/marketing/use-case/UseCaseTestimonial";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  Music, CalendarDays, CreditCard, GraduationCap, Users, BookOpen,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, UserX, MapPin,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/piano-schools";

const FAQS = [
  { question: "Can I track ABRSM and Trinity grades?", answer: "Yes. LessonLoop supports all UK exam boards including ABRSM, Trinity, LCM, and RSL. Track current grade, target grade, and exam dates per student." },
  { question: "Does it handle group piano lessons?", answer: "Absolutely. Schedule group lessons with multiple students, track individual attendance, and bill each family separately." },
  { question: "Can parents see their child's practice?", answer: "Yes. Teachers set assignments and students log practice through the parent portal. Parents see progress charts and notes." },
  { question: "Is it suitable for a small piano school?", answer: "Perfect for it. Whether you have 2 pianos or 20, LessonLoop scales with your studio." },
];

export default function ForPianoSchools() {
  usePageMeta(
    "Piano School Management Software | LessonLoop",
    "Schedule piano lessons, track grades, automate billing, and keep parents informed. Music school software built for UK piano teachers. Free trial.",
    {
      ogTitle: "Piano School Management Software | LessonLoop",
      ogDescription: "Run your piano school with LessonLoop — scheduling, grade tracking, invoicing, and parent portals in one platform.",
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
        name="Piano School Management"
        description="Scheduling, grade tracking, invoicing, and parent communication software for piano schools."
        canonical={CANONICAL}
        breadcrumbName="Piano Schools"
        faqs={FAQS}
      />

      <UseCaseHero
        badge="For Piano Schools"
        badgeIcon={Music}
        title="Piano school management"
        titleAccent="in perfect harmony"
        subtitle="Grade tracking, room scheduling, termly billing, and a parent portal — everything your piano school needs to hit the right notes."
      />

      <UseCasePainPoints
        headline="Running a piano school has its own challenges"
        subtitle="These admin headaches shouldn't stand between you and great teaching."
        painPoints={[
          { icon: AlertTriangle, title: "Room & piano clashes", description: "When multiple teachers share studios, double-bookings waste everyone's time." },
          { icon: Clock, title: "Grade tracking on paper", description: "ABRSM levels, exam dates, and targets scattered across notebooks and emails." },
          { icon: FileSpreadsheet, title: "Termly billing complexity", description: "Different rates for different durations, siblings, and scholarship students." },
          { icon: Repeat, title: "Make-up lesson chaos", description: "Tracking who's owed a make-up and finding a slot that works is a full-time job." },
          { icon: UserX, title: "No-shows without notice", description: "Students miss lessons without warning, and there's no system to track patterns." },
          { icon: MapPin, title: "Multi-room juggling", description: "Assigning the right piano to the right lesson at the right time across rooms." },
        ]}
      />

      <UseCaseFeatures
        headline="Built for the way piano schools work"
        subtitle="Features designed around the realities of piano teaching and studio management."
        features={[
          { icon: CalendarDays, title: "Room-aware scheduling", description: "Assign pianos and rooms per lesson. Conflict detection prevents double-bookings automatically.", link: { label: "Explore scheduling features", to: "/features/scheduling" } },
          { icon: GraduationCap, title: "Grade & exam tracking", description: "Track ABRSM, Trinity, and LCM grades per student. Log exam dates and results.", link: { label: "See student management", to: "/features/students" } },
          { icon: CreditCard, title: "Flexible billing", description: "Termly, monthly, or per-lesson billing. Sibling discounts and scholarship rates built in.", link: { label: "See invoicing and billing", to: "/features/billing" } },
          { icon: BookOpen, title: "Practice assignments", description: "Set weekly pieces and exercises. Students log practice, parents see progress.", link: { label: "Explore practice tracking", to: "/features/practice-tracking" } },
          { icon: Users, title: "Parent portal", description: "Families view schedules, pay invoices, and message teachers — reducing admin emails.", link: { label: "View the family portal", to: "/features/parent-portal" } },
          { icon: Music, title: "Attendance & make-ups", description: "Mark attendance per lesson, track absences, and manage make-up credits automatically.", link: { label: "See attendance tracking", to: "/features/attendance" } },
        ]}
      />

      <UseCaseTestimonial
        quote="We run 6 piano studios across 3 rooms. LessonLoop means no more scheduling spreadsheets and parents love the portal. It's transformed our admin."
        author="Helen K."
        role="Piano School Owner, Edinburgh"
      />

      <FeaturePageCTA
        headline="Give your piano school the software"
        headlineAccent="it deserves"
        subtitle="Join UK piano schools using LessonLoop to schedule, bill, and communicate — beautifully."
      />
    </MarketingLayout>
  );
}
