import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { TRIAL_DAYS } from "@/lib/pricing-config";

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
                By accessing or using LessonLoop at lessonloop.net ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop is a scheduling, billing, and communication platform designed for music teachers, academies, and agencies in the United Kingdom. We provide tools to manage:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Lesson scheduling and calendar management</li>
                <li>Student and guardian records</li>
                <li>Invoice generation and payment tracking</li>
                <li>Parent/guardian communication portal</li>
                <li>Practice tracking and assignments</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground mb-4">
                To use LessonLoop, you must create an account. You may register using:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Email and password</li>
                <li>Google Sign-In (OAuth 2.0)</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop integrates with third-party services to enhance functionality:
              </p>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">4.1 Google Services</h3>
              <p className="text-muted-foreground mb-4">
                We use Google APIs for authentication and calendar integration. By using these features, you also agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>
                  <a 
                    href="https://policies.google.com/terms" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Terms of Service
                  </a>
                </li>
                <li>
                  <a 
                    href="https://policies.google.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Privacy Policy
                  </a>
                </li>
              </ul>
              <p className="text-muted-foreground mb-4">
                You can disconnect Google services at any time from your account settings without affecting your core LessonLoop functionality.
              </p>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">4.2 Payment Processing</h3>
              <p className="text-muted-foreground mb-4">
                We use Stripe to process subscription payments. Your payment information is handled directly by Stripe and is subject to their terms and privacy policy.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorised access to any part of the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Upload malicious code or content</li>
                <li>Impersonate any person or entity</li>
                <li>Use the Service to send spam or unsolicited communications</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Data and Privacy</h2>
              <p className="text-muted-foreground mb-4">
                Your use of the Service is also governed by our{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                , which describes how we collect, use, and protect your data. You are responsible for ensuring you have appropriate consent to store student and guardian data within LessonLoop.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Subscription and Payment</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop offers subscription plans with different features and limits:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li><strong>Free trial:</strong> {TRIAL_DAYS} days of full access to evaluate the Service</li>
                <li><strong>Paid plans:</strong> Billed monthly or annually in GBP</li>
                <li><strong>Cancellation:</strong> You may cancel at any time; access continues until the end of your billing period</li>
                <li><strong>Refunds:</strong> Fees are non-refundable except as required by law</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Intellectual Property</h2>
              <p className="text-muted-foreground mb-4">
                The Service and its original content, features, and functionality are owned by LessonLoop and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-muted-foreground mb-4">
                You retain ownership of any content you upload to the Service. By uploading content, you grant us a licence to use it solely to provide the Service to you.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Termination</h2>
              <p className="text-muted-foreground mb-4">
                We may terminate or suspend your account immediately, without prior notice, if you breach these Terms. Upon termination:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Your right to use the Service will cease immediately</li>
                <li>You may request export of your data within 30 days</li>
                <li>We may delete your data after 30 days unless legally required to retain it</li>
              </ul>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                To the maximum extent permitted by law, LessonLoop shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">11. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground mb-4">
                The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">12. Changes to Terms</h2>
              <p className="text-muted-foreground mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through the Service. Your continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">13. Governing Law</h2>
              <p className="text-muted-foreground mb-4">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">14. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                <li>Email: legal@lessonloop.net</li>
                <li>Website: lessonloop.net/contact</li>
              </ul>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  By using LessonLoop, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
