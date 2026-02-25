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
  MapPin, Clock, AlertTriangle, Building2, DoorOpen,
  CalendarDays, Users, Shield, Eye, Settings, Layers,
  Calendar, Receipt, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "Can I manage multiple teaching locations?", answer: "Yes. Create as many locations as you need, each with their own address, rooms, availability, and closure dates." },
  { question: "Can I assign teachers to specific locations?", answer: "Absolutely. Teachers can be assigned to one or more locations. Their availability is set per location." },
  { question: "Do rooms have their own availability?", answer: "Yes. Each room within a location can have its own availability windows and capacity. The scheduler respects room availability." },
  { question: "Can I set closure dates per location?", answer: "Yes. Set location-specific closure dates (e.g., building maintenance) or organisation-wide closures (e.g., bank holidays)." },
  { question: "Can I see utilisation per location?", answer: "Yes. Utilisation reports show how much each location and room is being used, helping you optimise space." },
];

export default function FeatureLocations() {
  usePageMeta(
    "Location & Room Management for Music Schools | LessonLoop",
    "Manage multiple teaching locations and rooms. Set availability, closure dates, and room capacity — all connected to your schedule. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/locations",
      ogTitle: "Location & Room Management for Music Schools | LessonLoop",
      ogDescription: "Multi-location management with rooms, availability, closure dates, and utilisation tracking for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/locations",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Location & Room Management"
        description="Multi-location and room management for music schools — availability, closure dates, capacity, and utilisation."
        canonical="https://lessonloop.co.uk/features/locations"
        breadcrumbName="Locations"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Locations & Rooms"
        badgeIcon={MapPin}
        title="Multiple locations,"
        titleAccent="one platform"
        subtitle="Manage every teaching venue, room, and availability window in one place. Closure dates, room capacity, and teacher assignments — all connected to your calendar."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Growing locations means growing complexity"
        subtitle="More venues, more rooms, more scheduling clashes. Without structure, expansion becomes chaos."
        painPoints={[
          { icon: AlertTriangle, title: "Room double-bookings", description: "Two teachers scheduled in the same room at the same time. It happens more than you'd like." },
          { icon: Clock, title: "Closure dates are manual", description: "One venue closed for maintenance, another open as normal. Tracking which closures apply where is error-prone." },
          { icon: Building2, title: "No overview across locations", description: "You can't see what's happening at each venue without checking multiple spreadsheets or calendars." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Locations and rooms built into the scheduler"
        subtitle="Every location, room, and availability window is connected to the calendar. The system prevents conflicts automatically."
        features={[
          { icon: Building2, title: "Multiple locations", description: "Add as many teaching venues as you need. Each has its own address, contact details, and settings." },
          { icon: DoorOpen, title: "Room management", description: "Create rooms within each location. Set capacity, availability windows, and equipment lists." },
          { icon: CalendarDays, title: "Location-specific closures", description: "Set closure dates per location or across the whole organisation. Lessons skip closures automatically." },
          { icon: Users, title: "Teacher assignment", description: "Assign teachers to locations. Their availability is scoped to the locations where they teach." },
          { icon: Eye, title: "Cross-location visibility", description: "Admins see all locations in one calendar view. Filter by venue, room, or teacher." },
          { icon: Layers, title: "Utilisation tracking", description: "See how much each room and location is used. Identify spare capacity or bottlenecks." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Locations set up in minutes"
        steps={[
          { step: "1", title: "Add locations", description: "Create each teaching venue with its address and details. Add rooms within each location." },
          { step: "2", title: "Set availability & closures", description: "Define when each room is available and set closure dates for holidays or maintenance." },
          { step: "3", title: "Schedule with confidence", description: "The calendar respects room availability and prevents clashes. Lessons skip closures automatically." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Scheduling", description: "Rooms and locations feed directly into the calendar. No double-bookings, no manual checks.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Receipt, title: "Reports", description: "Utilisation reports show how each location and room is performing across the term.", to: "/features/reports", linkText: "Explore reporting features" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which rooms have availability, or find the best location for a new lesson.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Scale to multiple locations with ease."
        headlineAccent="Start free today."
        subtitle="Rooms, availability, closure dates, and utilisation — all managed from one platform, connected to your calendar."
      />
    </MarketingLayout>
  );
}
