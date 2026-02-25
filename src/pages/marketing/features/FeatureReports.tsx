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
  BarChart3, Clock, AlertTriangle, PoundSterling, TrendingUp,
  FileText, Download, PieChart, Users, CalendarDays, Filter,
  Calendar, Receipt, Sparkles,
} from "lucide-react";

const faqs = [
  { question: "What reports are available?", answer: "Revenue, outstanding invoices, payroll, lessons delivered, cancellation rates, teacher utilisation, and attendance trends." },
  { question: "Can I export reports?", answer: "Yes. Export any report as PDF or CSV for your records, accountant, or board meetings." },
  { question: "Can I filter reports by date range?", answer: "Absolutely. Filter by term, month, custom date range, teacher, location, or instrument." },
  { question: "Are reports real-time?", answer: "Yes. Reports pull from your live data. Revenue, attendance, and lesson counts are always up to date." },
  { question: "Can teachers see reports?", answer: "Teachers see their own payroll and lesson delivery reports. Revenue and financial reports are restricted to owners and admins." },
];

export default function FeatureReports() {
  usePageMeta(
    "Reports for Music Schools — Revenue, Attendance & Payroll | LessonLoop",
    "Real-time reports for music schools. Revenue, outstanding invoices, payroll, attendance, and utilisation — with PDF/CSV export. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/reports",
      ogTitle: "Reports for Music Schools | LessonLoop",
      ogDescription: "Revenue, outstanding invoices, payroll, attendance, and utilisation reports — all real-time with PDF/CSV export.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/reports",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Reports & Analytics"
        description="Real-time reports for music schools — revenue, outstanding invoices, payroll, attendance, and teacher utilisation."
        canonical="https://lessonloop.co.uk/features/reports"
        breadcrumbName="Reports"
        faqs={faqs}
      />

      <FeaturePageHero
        badge="Reports & Analytics"
        badgeIcon={BarChart3}
        title="Know exactly how your school is"
        titleAccent="performing"
        subtitle="Revenue, outstanding invoices, payroll, attendance, and utilisation — real-time reports built from your actual schedule and billing data."
      />

      <FeaturePageProblem
        eyebrow="THE PROBLEM"
        headline="Running blind costs you money"
        subtitle="Without clear reports, you can't see what's working, what's overdue, or where you're losing income."
        painPoints={[
          { icon: AlertTriangle, title: "No revenue visibility", description: "How much did you earn this term? How much is outstanding? Without reports, you're guessing." },
          { icon: Clock, title: "Manual calculations", description: "Adding up lessons, calculating teacher pay, and tallying invoices in spreadsheets — every single month." },
          { icon: PoundSterling, title: "Money slipping through", description: "Overdue invoices go unnoticed. Cancellation patterns aren't tracked. Revenue leaks you can't see." },
        ]}
      />

      <FeaturePageSolution
        eyebrow="THE SOLUTION"
        headline="Reports that answer the questions that matter"
        subtitle="Every report is built from your real data — schedule, attendance, invoices, and payments. Always up to date, always accurate."
        features={[
          { icon: PoundSterling, title: "Revenue reports", description: "See total revenue by term, month, teacher, or instrument. Compare periods and spot trends." },
          { icon: TrendingUp, title: "Outstanding ageing", description: "Invoices overdue by 7, 30, 60, or 90+ days. Know exactly who owes what and for how long." },
          { icon: Users, title: "Payroll reports", description: "Teacher earnings calculated from delivered lessons and pay rates. Export for your payroll provider." },
          { icon: CalendarDays, title: "Lessons delivered", description: "Count lessons by teacher, student, instrument, or location. Track delivery against expectations." },
          { icon: PieChart, title: "Utilisation & cancellations", description: "See room utilisation, teacher capacity, and cancellation rates. Optimise your schedule." },
          { icon: Filter, title: "Flexible filters", description: "Filter any report by date range, term, teacher, location, or instrument. Drill down to the detail you need." },
        ]}
      />

      <FeaturePageHowItWorks
        headline="Insights in seconds"
        steps={[
          { step: "1", title: "Open reports", description: "Navigate to the reports section. All reports are pre-built and ready — no configuration needed." },
          { step: "2", title: "Filter and explore", description: "Choose your date range, teacher, location, or instrument. Reports update instantly." },
          { step: "3", title: "Export and share", description: "Download as PDF or CSV. Share with your accountant, co-owner, or board." },
        ]}
      />

      <FeaturePageRelated
        headline="Reports are powered by"
        features={[
          { icon: Receipt, title: "Invoicing & Billing", description: "Revenue and outstanding reports are built directly from your invoice and payment data.", to: "/features/billing", linkText: "Explore automated billing" },
          { icon: Calendar, title: "Scheduling", description: "Lessons delivered and utilisation reports come from your actual calendar data.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
          { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist for quick summaries — revenue this term, outstanding totals, or cancellation trends.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
        ]}
      />

      <FeaturePageCTA
        headline="Stop guessing. Start knowing."
        headlineAccent="Real-time reports, always."
        subtitle="Revenue, payroll, attendance, and utilisation — all calculated from your real data. No spreadsheets required."
      />
    </MarketingLayout>
  );
}
