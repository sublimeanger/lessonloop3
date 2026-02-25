import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import UseCaseHero from "@/components/marketing/use-case/UseCaseHero";
import UseCasePainPoints from "@/components/marketing/use-case/UseCasePainPoints";
import UseCaseFeatures from "@/components/marketing/use-case/UseCaseFeatures";
import UseCaseTestimonial from "@/components/marketing/use-case/UseCaseTestimonial";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import FeaturePageCTA from "@/components/marketing/feature-page/FeaturePageCTA";
import {
  Theater, CalendarDays, CreditCard, Users, MapPin, BarChart3,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, UserX, BookOpen,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/performing-arts";

const FAQS = [
  { question: "Does LessonLoop support drama, dance, and music together?", answer: "Yes. Add any instrument or discipline as a subject. Schedule drama, dance, singing, and instrumental lessons all in the same calendar." },
  { question: "Can I manage rehearsals and performances?", answer: "Schedule one-off or recurring events like rehearsals, showcases, and performances alongside regular lessons." },
  { question: "Does it handle different age groups?", answer: "Absolutely. Group students by age, level, or discipline. Schedule age-appropriate classes and bill families accordingly." },
  { question: "Is there a limit on the number of teachers?", answer: "No. Add as many teachers as you need, each with their own availability, subjects, and schedule." },
];

export default function ForPerformingArts() {
  usePageMeta(
    "Performing Arts School Software | LessonLoop",
    "Manage drama, dance, and music classes in one platform. Scheduling, billing, attendance, and parent portals for UK performing arts schools. Free trial.",
    {
      ogTitle: "Performing Arts School Software | LessonLoop",
      ogDescription: "LessonLoop helps performing arts schools schedule classes, manage billing, and communicate with families — all in one place.",
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
        name="Performing Arts School Software"
        description="Scheduling, billing, attendance, and parent communication for performing arts schools covering music, drama, and dance."
        canonical={CANONICAL}
        breadcrumbName="Performing Arts"
        faqs={FAQS}
      />

      <UseCaseHero
        badge="For Performing Arts"
        badgeIcon={Theater}
        title="One platform for every"
        titleAccent="performing art"
        subtitle="Music, drama, dance, and singing — schedule them all, bill families once, and keep everyone in the loop with a unified parent portal."
      />

      <UseCasePainPoints
        headline="Multi-discipline schools need multi-discipline tools"
        subtitle="Generic software can't handle the complexity of performing arts."
        painPoints={[
          { icon: AlertTriangle, title: "Cross-discipline clashes", description: "A student in piano and drama can't be in two rooms at once. Manual timetabling misses conflicts." },
          { icon: Clock, title: "Complex billing", description: "Different rates for different disciplines, group sizes, and term lengths. Invoicing takes days." },
          { icon: FileSpreadsheet, title: "Fragmented registers", description: "Attendance tracked differently for each department. No unified view of student engagement." },
          { icon: Repeat, title: "Rehearsal scheduling", description: "One-off rehearsals and performances don't fit neatly into weekly recurring lesson patterns." },
          { icon: UserX, title: "Staff coordination", description: "Drama teachers, dance instructors, and music tutors all need different schedules and room access." },
          { icon: MapPin, title: "Venue management", description: "Studios, rehearsal rooms, and performance halls each with their own availability and equipment." },
        ]}
      />

      <UseCaseFeatures
        headline="Purpose-built for performing arts"
        subtitle="Whether it's a Saturday school or a full-time academy, LessonLoop adapts to your structure."
        features={[
          { icon: CalendarDays, title: "Multi-discipline scheduling", description: "Schedule music, drama, dance, and singing in one calendar. Automatic conflict detection across disciplines.", link: { label: "Explore scheduling features", to: "/features/scheduling" } },
          { icon: CreditCard, title: "Unified billing", description: "One invoice per family, covering all their children's classes. Termly, monthly, or custom billing cycles.", link: { label: "See invoicing and billing", to: "/features/billing" } },
          { icon: Users, title: "Family portal", description: "Parents see every child's schedule, pay all invoices in one place, and message any teacher.", link: { label: "View the family portal", to: "/features/parent-portal" } },
          { icon: MapPin, title: "Venue & room management", description: "Manage studios, halls, and rehearsal spaces. Set capacity, equipment, and availability per room.", link: { label: "Manage locations", to: "/features/locations" } },
          { icon: BookOpen, title: "Attendance across disciplines", description: "Unified attendance tracking for every class type. Spot patterns, send absence notifications.", link: { label: "See attendance tracking", to: "/features/attendance" } },
          { icon: BarChart3, title: "Cross-department reports", description: "Revenue by discipline, attendance by department, teacher utilisation across the whole school.", link: { label: "Explore reports", to: "/features/reports" } },
        ]}
      />

      <UseCaseTestimonial
        quote="We offer piano, violin, drama, and ballet. Before LessonLoop, we had four separate systems. Now it's all in one place and parents couldn't be happier."
        author="Rachel W."
        role="Performing Arts Director, Birmingham"
      />

      <FeaturePageCTA
        headline="Give your performing arts school"
        headlineAccent="centre stage software"
        subtitle="Music, drama, dance — one platform to schedule, bill, and engage families across every discipline."
      />
    </MarketingLayout>
  );
}
