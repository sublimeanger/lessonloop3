import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import UseCaseHero from "@/components/marketing/use-case/UseCaseHero";
import UseCasePainPoints from "@/components/marketing/use-case/UseCasePainPoints";
import UseCaseFeatures from "@/components/marketing/use-case/UseCaseFeatures";
import UseCaseTestimonial from "@/components/marketing/use-case/UseCaseTestimonial";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  Guitar, CalendarDays, CreditCard, Users, BookOpen, BarChart3,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, Smartphone, UserX,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/guitar-schools";

const FAQS = [
  { question: "Does LessonLoop support electric, acoustic, and bass guitar?", answer: "Yes. You can set up any instrument type and track students' progress on each individually." },
  { question: "Can I manage group guitar workshops?", answer: "Absolutely. Schedule group sessions, track individual attendance, and bill each student or family." },
  { question: "Does it work for a peripatetic guitar teacher?", answer: "Yes. Whether you teach at home, in schools, or across multiple venues, LessonLoop handles multi-location scheduling." },
  { question: "Can students share tabs and resources?", answer: "Teachers can upload tabs, sheet music, backing tracks, and videos to the resource library. Students access them through the portal." },
];

export default function ForGuitarSchools() {
  usePageMeta(
    "Guitar School Management Software | LessonLoop",
    "Manage guitar lessons, track student progress, automate invoicing, and communicate with families. Built for UK guitar teachers. Free trial.",
    {
      ogTitle: "Guitar School Management Software | LessonLoop",
      ogDescription: "Run your guitar school with LessonLoop — scheduling, billing, practice tracking, and a parent portal in one app.",
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
        name="Guitar School Management"
        description="Scheduling, billing, resource sharing, and parent communication software for guitar schools and teachers."
        canonical={CANONICAL}
        breadcrumbName="Guitar Schools"
        faqs={FAQS}
      />

      <UseCaseHero
        badge="For Guitar Schools"
        badgeIcon={Guitar}
        title="Guitar school management"
        titleAccent="that rocks"
        subtitle="Scheduling, billing, resource sharing, and practice tracking — so you can focus on helping students shred, not shuffle paperwork."
      />

      <UseCasePainPoints
        headline="Guitar teaching admin shouldn't be this hard"
        subtitle="You started teaching to share your passion — not to become a part-time accountant."
        painPoints={[
          { icon: AlertTriangle, title: "Scheduling nightmares", description: "Juggling lesson times across students, rooms, and your own gigging schedule." },
          { icon: Clock, title: "Invoicing by hand", description: "Creating invoices in Word, chasing payments by text, losing track of who's paid." },
          { icon: FileSpreadsheet, title: "Tabs everywhere", description: "Sharing resources via email, WhatsApp, and USB sticks — nothing is centralised." },
          { icon: Repeat, title: "Make-up lesson chaos", description: "Students cancel, you reschedule, then they cancel again. No system to track credits." },
          { icon: Smartphone, title: "Constant messages", description: "Parents texting at 10pm to reschedule. No boundaries, no central inbox." },
          { icon: UserX, title: "Student drop-off", description: "Without practice tracking, engagement dips and students quietly stop coming." },
        ]}
      />

      <UseCaseFeatures
        headline="Built for guitar teachers and schools"
        subtitle="Whether you're a solo teacher or run a multi-teacher school, LessonLoop has you covered."
        features={[
          { icon: CalendarDays, title: "Flexible scheduling", description: "Weekly recurring lessons, one-off workshops, and group sessions. Drag-and-drop simplicity.", link: { label: "Explore scheduling features", to: "/features/scheduling" } },
          { icon: CreditCard, title: "Automated invoicing", description: "Generate and send invoices in GBP. Automatic payment reminders and online payments.", link: { label: "See invoicing and billing", to: "/features/billing" } },
          { icon: BookOpen, title: "Resource library", description: "Upload tabs, chord charts, backing tracks, and videos. Students access them through the portal.", link: { label: "Explore resources", to: "/features/resources" } },
          { icon: Guitar, title: "Practice tracking", description: "Set weekly practice goals, track student logs, and share progress with parents.", link: { label: "See practice tracking", to: "/features/practice-tracking" } },
          { icon: Users, title: "Parent & student portal", description: "Families view schedules, download resources, pay invoices, and message you.", link: { label: "View the family portal", to: "/features/parent-portal" } },
          { icon: BarChart3, title: "Reports & insights", description: "Revenue summaries, attendance trends, and student engagement — data-driven teaching.", link: { label: "Explore reports", to: "/features/reports" } },
        ]}
      />

      <UseCaseTestimonial
        quote="I teach 40 guitar students across two venues. LessonLoop handles my scheduling, billing, and even shares tabs with students. Game changer."
        author="Dan R."
        role="Guitar Teacher, Manchester"
      />

      <FeaturePageCTA
        headline="Amplify your guitar school with"
        headlineAccent="LessonLoop"
        subtitle="Professional studio management for UK guitar teachers — scheduling, billing, and parent communication in one platform."
      />
    </MarketingLayout>
  );
}
