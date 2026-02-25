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
  Music2, Clock, AlertTriangle, BookOpen, Timer,
  Target, Trophy, Bell, BarChart3, Calendar,
  Users, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "Can students log their own practice?", answer: "Yes. Students (or parents on their behalf) can log practice sessions from the parent portal, including duration, what they practised, and notes." },
  { question: "Can teachers set practice assignments?", answer: "Absolutely. Teachers create practice assignments with descriptions, targets, and due dates. Students see them in the portal." },
  { question: "Can I see how much a student has practised?", answer: "Yes. Practice logs are visible on the student profile and in the parent portal. Teachers can review before each lesson." },
  { question: "Does practice tracking work on mobile?", answer: "Yes. The parent portal is fully responsive. Students and parents can log practice from any device." },
  { question: "Is practice tracking included in all plans?", answer: "Practice tracking is available on Pro and Academy plans." },
];

export default function FeaturePracticeTracking() {
  usePageMeta(
    "Practice Tracking for Music Students — Assignments, Logs & Progress | LessonLoop",
    "Set practice assignments, track student practice time, and monitor progress between lessons. Built into the parent portal. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/practice-tracking",
      ogTitle: "Practice Tracking for Music Students | LessonLoop",
      ogDescription: "Set practice assignments, track student practice time, and monitor progress between lessons. Built into the parent portal.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/practice-tracking",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Practice Tracking"
        description="Practice tracking for music students — assignments, logs, and progress monitoring between lessons."
        canonical="https://lessonloop.co.uk/features/practice-tracking"
        breadcrumbName="Practice Tracking"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Practice Tracking"
        badgeIcon={Music2}
        title="Bridge the gap"
        titleAccent="between lessons"
        subtitle="Set practice assignments, track student practice time, and monitor progress — all built into the parent portal so students and parents stay engaged between lessons."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="What happens between lessons matters"
        subtitle="You set homework, but have no idea if it was done. Students forget, parents don't know what to encourage, and progress stalls."
        painPoints={[
          { icon: AlertTriangle, title: "No accountability", description: "Students forget what they're supposed to practise. There's no record of what was assigned or completed." },
          { icon: Clock, title: "No visibility for parents", description: "Parents want to support their child's practice but don't know what was assigned or how much is expected." },
          { icon: BookOpen, title: "Progress is invisible", description: "Without tracking, you can't see trends in practice habits. Conversations about progress are based on gut feeling." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Practice tracking built for music education"
        subtitle="Assign practice, track time, and see progress — all connected to the student profile and parent portal."
        features={[
          { icon: Target, title: "Practice assignments", description: "Create assignments with descriptions, targets, and due dates. Students and parents see them instantly in the portal." },
          { icon: Timer, title: "Practice logging", description: "Students or parents log practice sessions with duration, what they worked on, and notes. Built into the portal." },
          { icon: Trophy, title: "Progress tracking", description: "See practice trends over time per student. Know who's putting in the work and who needs encouragement." },
          { icon: Bell, title: "Practice reminders", description: "Automated reminders nudge students and parents about upcoming practice goals and incomplete assignments." },
          { icon: BarChart3, title: "Teacher insights", description: "Review practice logs before each lesson. Know what a student has worked on and how much time they've spent." },
          { icon: Calendar, title: "Linked to lessons", description: "Assignments are connected to lesson dates. See what was assigned after each lesson and track completion." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Practice tracking made simple"
        steps={[
          { step: "1", title: "Set assignments", description: "After a lesson, create a practice assignment with what to practise, how long, and when it's due." },
          { step: "2", title: "Students log practice", description: "Students or parents log practice sessions in the portal — duration, focus area, and any notes." },
          { step: "3", title: "Review before the next lesson", description: "See the practice log before you teach. Know exactly what was done and adjust your lesson plan." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Users, title: "Parent Portal", description: "Practice assignments and logs live in the parent portal. Parents stay engaged in their child's learning.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
          { icon: Calendar, title: "Scheduling", description: "Practice assignments link to lesson dates. See what was assigned after each lesson.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which students haven't logged practice this week or summarise practice trends.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Make practice count."
        headlineAccent="Start tracking today."
        subtitle="Practice assignments, student logs, and progress insights — all built into LessonLoop's parent portal."
      />
    </MarketingLayout>
  );
}
