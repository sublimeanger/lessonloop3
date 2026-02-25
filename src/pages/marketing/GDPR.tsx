import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import { Shield, Download, Trash2, Eye, Lock, Mail } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const rights = [
  {
    icon: Eye,
    title: "Right to Access",
    description: "You can request a copy of all personal data we hold about you.",
  },
  {
    icon: Download,
    title: "Right to Portability",
    description: "You can request your data in a machine-readable format to transfer elsewhere.",
  },
  {
    icon: Trash2,
    title: "Right to Erasure",
    description: "You can request deletion of your personal data under certain circumstances.",
  },
  {
    icon: Lock,
    title: "Right to Restrict Processing",
    description: "You can request we limit how we use your data in certain situations.",
  },
];

export default function GDPR() {
  usePageMeta(
    'GDPR Compliance — How LessonLoop Protects Your Data Rights | UK GDPR',
    'Learn how LessonLoop complies with UK GDPR. Understand your data rights including access, portability, erasure, and restriction of processing.',
    {
      canonical: "https://lessonloop.co.uk/gdpr",
      ogTitle: "GDPR Compliance | LessonLoop",
      ogDescription: "Your data rights and how LessonLoop complies with UK GDPR and the Data Protection Act 2018.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/gdpr",
      ogSiteName: "LessonLoop",
      robots: "index, follow, noarchive",
    }
  );

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lessonloop.co.uk/" },
      { "@type": "ListItem", position: 2, name: "GDPR Compliance", item: "https://lessonloop.co.uk/gdpr" },
    ],
  };

  return (
    <MarketingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-10 h-10 text-primary" />
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                GDPR Compliance
              </h1>
            </div>
            <p className="text-lg text-muted-foreground mb-8">
              LessonLoop is fully committed to protecting your data rights under the UK General Data Protection Regulation (UK GDPR).
            </p>

            <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Our Commitment</h2>
              <p className="text-muted-foreground mb-4">
                As a UK-based company, we comply with the UK GDPR and Data Protection Act 2018. We process your data lawfully, fairly, and transparently.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Data is collected for specified, explicit, and legitimate purposes</li>
                <li>We minimise data collection to what is necessary</li>
                <li>We keep data accurate and up to date</li>
                <li>Data is retained only as long as necessary</li>
                <li>We implement appropriate security measures</li>
              </ul>
            </div>

            <h2 className="text-2xl font-semibold text-foreground mb-6">Your Data Rights</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-12">
              {rights.map((right, index) => (
                <motion.div
                  key={right.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <right.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{right.title}</h3>
                  <p className="text-sm text-muted-foreground">{right.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 lg:p-8">
              <div className="flex items-start gap-4">
                <Mail className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Exercise Your Rights</h2>
                  <p className="text-muted-foreground mb-4">
                    To make a data request or exercise any of your rights, please contact our Data Protection team. We will respond within 30 days.
                  </p>
                  <a 
                    href="mailto:dpo@lessonloop.net" 
                    className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
                  >
                    dpo@lessonloop.net
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Processing</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-sm font-semibold text-foreground">Data Category</th>
                      <th className="py-3 pr-4 text-sm font-semibold text-foreground">Purpose</th>
                      <th className="py-3 text-sm font-semibold text-foreground">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-muted-foreground">
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Account information</td>
                      <td className="py-3 pr-4">Service delivery</td>
                      <td className="py-3">Contract performance</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Student data</td>
                      <td className="py-3 pr-4">Lesson management</td>
                      <td className="py-3">Legitimate interest</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Payment details</td>
                      <td className="py-3 pr-4">Billing and invoicing</td>
                      <td className="py-3">Contract performance</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Usage analytics</td>
                      <td className="py-3 pr-4">Service improvement</td>
                      <td className="py-3">Legitimate interest</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
