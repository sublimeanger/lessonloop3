import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogoWordmark } from "@/components/brand/Logo";

const footerLinks = {
  product: [
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
    { name: "Kickstarter", href: "/kickstarter" },
    { name: "Blog", href: "/blog" },
  ],
  company: [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ],
  legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
    { name: "Cookie Policy", href: "/cookies" },
    { name: "GDPR", href: "/gdpr" },
  ],
  support: [
    { name: "Help Centre", href: "/contact" },
    { name: "Contact Us", href: "/contact" },
  ],
};

// Social links removed — will be added when real accounts are set up

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const MarketingFooter = React.forwardRef<HTMLElement>(function MarketingFooter(_props, ref) {
  return (
    <footer ref={ref} className="relative bg-ink text-white overflow-hidden">
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink to-ink-dark pointer-events-none" />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-coral/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Main Footer Content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-16 lg:py-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Brand Column */}
            <motion.div variants={itemVariants} className="col-span-2 md:col-span-6 lg:col-span-4">
              <LogoWordmark variant="white" />
              <p className="mt-6 text-white/60 text-base leading-relaxed max-w-sm">
                Keeping every lesson in the loop. The complete platform for music educators to manage scheduling, billing, and student communication.
              </p>
              
              {/* LTP Music link */}
              <div className="mt-8">
                <a
                  href="https://ltpmusic.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-white/60 text-sm transition-colors"
                >
                  A product by LTP Music →
                </a>
              </div>
            </motion.div>

            {/* Product Links */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-2">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Product
              </h4>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-white/60 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Company Links */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-2">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Company
              </h4>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-white/60 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Support Links */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-2">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Support
              </h4>
              <ul className="space-y-3">
                {footerLinks.support.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-white/60 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Legal Links */}
            <motion.div variants={itemVariants} className="col-span-1 md:col-span-2 lg:col-span-2">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
                Legal
              </h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-white/60 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-8 border-t border-white/10"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} LessonLoop. All rights reserved.
            </p>
            <p className="text-white/40 text-sm flex items-center gap-2">
              Made with
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-coral"
              >
                ♥
              </motion.span>
              in the United Kingdom
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
});
