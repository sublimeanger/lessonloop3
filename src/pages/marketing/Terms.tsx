import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";

export default function Terms() {
  return (
    <MarketingLayout>
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Terms of Service
            </h1>
            <p className="text-muted-foreground mb-8">
              Last updated: January 2025
            </p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground mb-4">
                By accessing or using LessonLoop, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop is a scheduling, billing, and communication platform designed for music teachers, academies, and agencies. We provide tools to manage lessons, students, invoices, and parent communications.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground mb-4">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Acceptable Use</h2>
              <p className="text-muted-foreground mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to gain unauthorised access to any part of the service</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Upload malicious code or content</li>
                <li>Impersonate any person or entity</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Payment Terms</h2>
              <p className="text-muted-foreground mb-4">
                Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law or as explicitly stated in these terms.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Intellectual Property</h2>
              <p className="text-muted-foreground mb-4">
                The service and its original content, features, and functionality are owned by LessonLoop and are protected by international copyright, trademark, and other intellectual property laws.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                To the maximum extent permitted by law, LessonLoop shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Governing Law</h2>
              <p className="text-muted-foreground mb-4">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms, please contact us at legal@lessonloop.net.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
