import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import { Cookie, Shield, Settings, BarChart3 } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const cookieTypes = [
  {
    icon: Shield,
    title: "Essential Cookies",
    description: "Required for the website to function properly. These cannot be disabled.",
    examples: "Authentication, session management, security tokens",
  },
  {
    icon: Settings,
    title: "Functional Cookies",
    description: "Enable enhanced functionality and personalisation.",
    examples: "Language preferences, timezone settings, UI customisation",
  },
  {
    icon: BarChart3,
    title: "Analytics Cookies",
    description: "Help us understand how visitors interact with our website.",
    examples: "Page views, feature usage, error tracking",
  },
];

export default function Cookies() {
  usePageMeta('Cookie Policy | LessonLoop', 'How LessonLoop uses cookies and similar technologies');
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
            <div className="flex items-center gap-3 mb-6">
              <Cookie className="w-10 h-10 text-primary" />
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                Cookie Policy
              </h1>
            </div>
            <p className="text-lg text-muted-foreground mb-8">
              Last updated: January 2025
            </p>

            <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">What Are Cookies?</h2>
              <p className="text-muted-foreground mb-4">
                Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and to provide information to the site owners.
              </p>

              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">How We Use Cookies</h2>
              <p className="text-muted-foreground mb-4">
                LessonLoop uses cookies to ensure our platform functions correctly, to remember your preferences, and to improve your experience.
              </p>
            </div>

            <h2 className="text-2xl font-semibold text-foreground mb-6">Types of Cookies We Use</h2>
            <div className="space-y-4 mb-12">
              {cookieTypes.map((type, index) => (
                <motion.div
                  key={type.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <type.icon className="w-8 h-8 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{type.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                      <p className="text-xs text-muted-foreground/70">
                        <span className="font-medium">Examples:</span> {type.examples}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 mb-12">
              <h2 className="text-xl font-semibold text-foreground mb-4">Managing Cookies</h2>
              <p className="text-muted-foreground mb-4">
                Most web browsers allow you to control cookies through their settings. You can usually find these settings in the "Options" or "Preferences" menu of your browser.
              </p>
              <p className="text-muted-foreground">
                Please note that disabling certain cookies may affect the functionality of our platform.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Third-Party Cookies</h2>
              <p className="text-sm text-muted-foreground">
                We may use third-party services that set their own cookies, such as payment processors (Stripe) and analytics tools. These third parties have their own privacy policies governing the use of cookies.
              </p>
            </div>

            <div className="mt-8 text-sm text-muted-foreground">
              <p>
                For more information about how we handle your data, please see our{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
