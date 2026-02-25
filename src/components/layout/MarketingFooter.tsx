import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogoWordmark } from "@/components/brand/Logo";
import { ArrowRight, Shield, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const footerLinks = {
  features: [
    { name: "All Features", href: "/features" },
    { name: "Scheduling", href: "/features/scheduling" },
    { name: "Billing & Invoicing", href: "/features/billing" },
    { name: "Parent Portal", href: "/features/parent-portal" },
    { name: "LoopAssist AI", href: "/features/loopassist" },
    { name: "Students", href: "/features/students" },
    { name: "Attendance", href: "/features/attendance" },
    { name: "Reports", href: "/features/reports" },
  ],
  useCases: [
    { name: "Music Academies", href: "/for/music-academies" },
    { name: "Solo Teachers", href: "/for/solo-teachers" },
    { name: "Piano Schools", href: "/for/piano-schools" },
    { name: "Guitar Schools", href: "/for/guitar-schools" },
    { name: "Performing Arts", href: "/for/performing-arts" },
    { name: "Built for the UK", href: "/uk" },
  ],
  compare: [
    { name: "vs My Music Staff", href: "/compare/lessonloop-vs-my-music-staff" },
    { name: "vs Teachworks", href: "/compare/lessonloop-vs-teachworks" },
    { name: "vs Opus 1", href: "/compare/lessonloop-vs-opus1" },
    { name: "vs Jackrabbit Music", href: "/compare/lessonloop-vs-jackrabbit-music" },
    { name: "vs Fons", href: "/compare/lessonloop-vs-fons" },
  ],
  company: [
    { name: "About", href: "/about" },
    { name: "Blog", href: "/blog" },
    { name: "Contact", href: "/contact" },
    { name: "Pricing", href: "/pricing" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Cookie Policy", href: "/cookies" },
    { name: "GDPR Compliance", href: "/gdpr" },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function FooterColumn({ title, links }: { title: string; links: { name: string; href: string }[] }) {
  return (
    <motion.div variants={itemVariants}>
      <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.name}>
            <Link
              to={link.href}
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export const MarketingFooter = React.forwardRef<HTMLElement>(function MarketingFooter(_props, ref) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("kickstarter_signups" as any).insert({ email, name: "Newsletter" });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "You're already subscribed!" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Subscribed! We'll keep you in the loop." });
        setEmail("");
      }
    } catch {
      toast({ title: "Something went wrong. Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer ref={ref} className="relative bg-[hsl(var(--ink))] text-white overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] opacity-[0.04] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", filter: "blur(80px)" }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] opacity-[0.04] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)", filter: "blur(80px)" }} />

      {/* Newsletter strip */}
      <div className="border-b border-white/[0.06]">
        <div className="container mx-auto px-5 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 max-w-5xl mx-auto">
            <div className="text-center lg:text-left">
              <h3 className="text-xl font-bold text-white mb-1">Stay in the loop</h3>
              <p className="text-white/40 text-sm">Product updates, teaching tips, and early access. No spam.</p>
            </div>
            <form onSubmit={handleNewsletter} className="flex w-full sm:w-auto gap-3">
              <Input
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 h-11 w-full sm:w-64"
              />
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] text-white font-semibold h-11 px-5 shrink-0"
              >
                {loading ? "…" : "Subscribe"}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-14 lg:py-20"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6">
            {/* Brand column — full width on mobile */}
            <motion.div variants={itemVariants} className="col-span-2 sm:col-span-3 lg:col-span-1 lg:row-span-1">
              <LogoWordmark variant="white" />
              <p className="mt-4 text-white/40 text-sm leading-relaxed max-w-xs">
                Keeping every lesson in the loop — scheduling, billing, and parent communication for music educators.
              </p>
              <a
                href="https://ltpmusic.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/25 hover:text-white/40 text-xs mt-4 inline-block transition-colors"
              >
                A product by LTP Music →
              </a>
            </motion.div>

            <FooterColumn title="Features" links={footerLinks.features} />
            <FooterColumn title="Use Cases" links={footerLinks.useCases} />
            <FooterColumn title="Compare" links={footerLinks.compare} />
            <FooterColumn title="Company" links={footerLinks.company} />
            <FooterColumn title="Legal" links={footerLinks.legal} />
          </div>
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-6 border-t border-white/[0.06]"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} LessonLoop. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-white/30 text-xs">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                United Kingdom
              </span>
              <span className="w-px h-3 bg-white/10 hidden sm:block" />
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                GDPR Compliant
              </span>
              <span className="w-px h-3 bg-white/10 hidden sm:block" />
              <span className="flex items-center gap-1.5">
                Made with
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-[hsl(var(--coral))]"
                >
                  ♥
                </motion.span>
                in the UK
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
});
