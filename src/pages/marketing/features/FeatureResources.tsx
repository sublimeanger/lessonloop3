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
  FolderOpen, Clock, AlertTriangle, Upload, FileText,
  Music, Users, Tag, Download, Shield, Search,
  Calendar, MessageSquare, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "What file types can I upload?", answer: "PDFs, images, audio files, and documents. Upload sheet music, practice recordings, worksheets, or any teaching material." },
  { question: "Can students access resources from the portal?", answer: "Yes. Resources shared with a student appear in their parent portal. Parents and students can download them anytime." },
  { question: "Can I organise resources by instrument or level?", answer: "Yes. Tag resources by instrument, grade level, or custom categories. Filter and search to find what you need." },
  { question: "Is there a storage limit?", answer: "Storage limits depend on your plan. Solo includes basic storage, Pro and Academy include expanded limits." },
  { question: "Can multiple teachers share resources?", answer: "Yes. Resources can be shared at the organisation level. Teachers can access and assign shared materials to their students." },
];

export default function FeatureResources() {
  usePageMeta(
    "Teaching Resources & File Sharing for Music Schools | LessonLoop",
    "Upload, organise, and share teaching resources with students and parents. Sheet music, worksheets, and recordings — all in one place. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/resources",
      ogTitle: "Teaching Resources & File Sharing | LessonLoop",
      ogDescription: "Upload and share sheet music, worksheets, and recordings with students through the parent portal.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/resources",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Teaching Resources"
        description="Upload, organise, and share teaching resources — sheet music, worksheets, and recordings — with students through the parent portal."
        canonical="https://lessonloop.co.uk/features/resources"
        breadcrumbName="Resources"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Teaching Resources"
        badgeIcon={FolderOpen}
        title="All your teaching materials,"
        titleAccent="organised and shared"
        subtitle="Upload sheet music, worksheets, recordings, and teaching materials. Organise by instrument and level. Share with students through the parent portal."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Teaching materials shouldn't live in email attachments"
        subtitle="Files scattered across email, Google Drive, WhatsApp, and USB sticks. Students lose them. You re-send them. Repeatedly."
        painPoints={[
          { icon: AlertTriangle, title: "Files everywhere", description: "Sheet music in email, recordings on WhatsApp, worksheets on a USB. Nothing is in one place." },
          { icon: Clock, title: "Re-sending constantly", description: "\"Can you send that piece again?\" — the most common parent message. You dig through old emails every time." },
          { icon: Search, title: "Can't find what you need", description: "Hundreds of files with no organisation. Finding the right piece for the right student takes too long." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="A resource library built for music teachers"
        subtitle="Upload once, organise by instrument and level, share with students instantly. Materials appear in the parent portal."
        features={[
          { icon: Upload, title: "Easy uploads", description: "Drag and drop files — PDFs, images, audio, documents. Upload sheet music, worksheets, or recordings in seconds." },
          { icon: Tag, title: "Organised by instrument & level", description: "Tag resources by instrument, grade level, or custom categories. Filter and search across your whole library." },
          { icon: Users, title: "Share with students", description: "Assign resources to individual students or groups. They appear instantly in the parent portal." },
          { icon: Download, title: "Student downloads", description: "Students and parents can download resources from the portal anytime. No more re-sending files." },
          { icon: Music, title: "Built for music", description: "Designed for the file types music teachers actually use — sheet music PDFs, practice recordings, and more." },
          { icon: Shield, title: "Secure storage", description: "Files stored securely with access controls. Students only see resources shared with them." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Resources shared in seconds"
        steps={[
          { step: "1", title: "Upload files", description: "Drag and drop your teaching materials. Tag by instrument, level, or custom category." },
          { step: "2", title: "Assign to students", description: "Share resources with individual students or groups. They appear in the parent portal immediately." },
          { step: "3", title: "Students access anytime", description: "Students and parents download materials from the portal. No more email attachments or lost files." },
        ]}
      />

      <FeaturePageRelated
        headline="Works hand-in-hand with"
        features={[
          { icon: Calendar, title: "Practice Tracking", description: "Assign resources alongside practice assignments. Students see what to practise and have the materials to do it.", to: "/features/practice-tracking", linkText: "Explore practice tracking" },
          { icon: MessageSquare, title: "Parent Portal", description: "Resources appear in the parent portal. Parents and students can browse and download anytime.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist to find resources by instrument or level, or check which students have materials assigned.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Stop re-sending files."
        headlineAccent="Start sharing smarter."
        subtitle="Upload, organise, and share teaching materials with students — all from one platform, accessible through the parent portal."
      />
    </MarketingLayout>
  );
}
