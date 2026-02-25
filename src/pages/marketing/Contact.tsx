import { useState } from "react";
import { logger } from "@/lib/logger";
import { motion } from "framer-motion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import ContactSchema from "@/components/marketing/contact/ContactSchema";
import {
  MessageSquare, Clock, HelpCircle, Loader2, CheckCircle,
  ArrowRight, Mail, MapPin, Shield, Sparkles, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message too long"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const HELPFUL_LINKS = [
  { label: "Explore all features", to: "/features", description: "See what LessonLoop can do for your school" },
  { label: "View plans and pricing", to: "/pricing", description: "Simple, transparent pricing for every size" },
  { label: "Built for UK music schools", to: "/uk", description: "GBP, VAT, term dates, and GDPR compliance" },
  { label: "LoopAssist AI assistant", to: "/features/loopassist", description: "AI that understands your schedule" },
];

export default function Contact() {
  usePageMeta(
    "Contact LessonLoop — Get in Touch With Our Music School Software Team",
    "Have a question about LessonLoop? Contact our UK-based team for help with scheduling, billing, or getting started. We respond within 24 hours.",
    {
      canonical: "https://lessonloop.co.uk/contact",
      ogTitle: "Contact LessonLoop — We'd Love to Hear From You",
      ogDescription: "Get in touch with the LessonLoop team. Questions about music school management software? We typically respond within 24 hours.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/contact",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary",
      robots: "index, follow",
    }
  );
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof ContactFormData;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-contact-message', {
        body: { ...result.data, website: honeypot },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send message');
      }

      setIsSuccess(true);
      toast({ title: "Message sent! We'll get back to you soon." });
      setFormData({ firstName: "", lastName: "", email: "", subject: "", message: "" });
    } catch (error: any) {
      logger.error('Contact form error:', error);
      toast({ title: error.message || "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <ContactSchema />

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-16 sm:pt-32 lg:pt-40 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
              <MessageSquare className="w-4 h-4" />
              Get in Touch
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight mb-6">
              We'd love to{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                hear from you
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Whether you're a solo teacher or running a multi-location academy,
              our UK-based team typically responds within 24 hours.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ CONTACT INFO STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
            {[
              { icon: Mail, label: "hello@lessonloop.net", sublabel: "Email us anytime" },
              { icon: MapPin, label: "United Kingdom", sublabel: "UK-headquartered" },
              { icon: Clock, label: "Within 24 hours", sublabel: "Typical response" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-center sm:text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FORM + SIDEBAR ═══ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 max-w-6xl mx-auto">

            {/* Form — 3 cols */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">Send us a message</h2>
              <p className="text-muted-foreground mb-8">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>

              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-10 rounded-2xl border border-[hsl(var(--emerald)/0.3)] bg-[hsl(var(--emerald)/0.05)] text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-[hsl(var(--emerald)/0.15)] flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[hsl(var(--emerald))]" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground mb-6">
                    Thank you for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <Button variant="outline" onClick={() => setIsSuccess(false)}>
                    Send Another Message
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    style={{ position: 'absolute', left: '-9999px' }}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleChange("firstName", e.target.value)}
                        placeholder="John"
                        className={errors.firstName ? "border-destructive" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleChange("lastName", e.target.value)}
                        placeholder="Smith"
                        className={errors.lastName ? "border-destructive" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="john@example.com"
                      className={errors.email ? "border-destructive" : ""}
                      disabled={isSubmitting}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                    <Select
                      value={formData.subject}
                      onValueChange={(value) => handleChange("subject", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className={errors.subject ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General Enquiry">General Enquiry</SelectItem>
                        <SelectItem value="Sales Question">Sales Question</SelectItem>
                        <SelectItem value="Technical Support">Technical Support</SelectItem>
                        <SelectItem value="Partnership Opportunity">Partnership Opportunity</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      value={formData.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      placeholder="How can we help you?"
                      className={errors.message ? "border-destructive" : ""}
                      disabled={isSubmitting}
                    />
                    {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full font-semibold h-12"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    Your data is safe. We never share it with third parties.
                  </p>
                </form>
              )}
            </motion.div>

            {/* Sidebar — 2 cols */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Info card */}
              <div className="rounded-2xl border border-border/60 bg-[hsl(var(--ink))] p-6 shadow-lg overflow-hidden relative">
                <motion.div
                  className="absolute top-0 right-0 w-40 h-40 opacity-20 blur-2xl"
                  style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
                />
                <div className="relative space-y-5">
                  <h3 className="text-lg font-bold text-white">Helpful Information</h3>

                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-[hsl(var(--teal))]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Business Hours</h4>
                      <p className="text-xs text-white/50">Mon–Fri: 9:00–17:00 GMT</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-[hsl(var(--teal))]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Free 30-Day Trial</h4>
                      <p className="text-xs text-white/50">No credit card required to get started</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--teal))]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Quick Answers?</h4>
                      <p className="text-xs text-white/50">
                        Check our{" "}
                        <Link to="/pricing" className="text-[hsl(var(--teal))] hover:underline font-medium">
                          Pricing FAQ
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Helpful links */}
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <h3 className="text-sm font-bold text-foreground mb-4">Explore while you wait</h3>
                <div className="space-y-3">
                  {HELPFUL_LINKS.map((link, i) => (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                    >
                      <Link
                        to={link.to}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{link.label}</p>
                          <p className="text-xs text-muted-foreground">{link.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 ml-2 transition-colors" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <p className="text-sm font-bold text-foreground mb-2">Ready to get started?</p>
                <p className="text-xs text-muted-foreground mb-4">Try LessonLoop free for 30 days</p>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  Start free trial <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
