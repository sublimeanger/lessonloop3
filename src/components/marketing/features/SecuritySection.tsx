import { motion } from "framer-motion";
import { Shield, Lock, Eye, FileText, Server, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const securityFeatures = [
  { icon: Shield, title: "GDPR Compliant", description: "Full compliance with UK and EU data protection regulations. Your data, your rights." },
  { icon: Lock, title: "Bank-Level Encryption", description: "256-bit SSL encryption for all data in transit. AES-256 for data at rest." },
  { icon: Server, title: "UK Data Residency", description: "All data stored in UK data centres. Never leaves the jurisdiction." },
  { icon: Eye, title: "Audit Logging", description: "Complete history of who did what, when. Full transparency for compliance." },
  { icon: Download, title: "Data Export", description: "Download all your data anytime. Full portability, no lock-in." },
  { icon: FileText, title: "Data Retention Controls", description: "Configure retention policies. Automatic anonymisation of old records." },
];

export function SecuritySection() {
  return (
    <section id="security" className="py-24 lg:py-36 relative overflow-hidden">
      {/* Dark cinematic background */}
      <div className="absolute inset-0 bg-[hsl(var(--ink))]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-gradient-to-br from-teal/8 via-transparent to-primary/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Centered shield hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center mx-auto mb-8 shadow-xl shadow-teal/20"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>

          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            Your data is safe.{" "}
            <span className="text-white/40">We guarantee it.</span>
          </h2>

          <p className="text-lg text-white/50">
            LessonLoop is GDPR compliant and built with UK data protection 
            at its core — from bank-level encryption to complete audit logging.
          </p>
        </motion.div>

        {/* 3-column feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-12">
          {securityFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-6 hover:border-teal/30 transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-teal/15 flex items-center justify-center mx-auto mb-4 group-hover:bg-teal/20 transition-colors">
                <feature.icon className="w-6 h-6 text-teal" />
              </div>
              <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4"
        >
          {[
            { name: "GDPR", description: "UK & EU Compliant" },
            { name: "Encryption", description: "AES-256 at rest, TLS in transit" },
            { name: "Hosting", description: "Enterprise-grade hosting" },
          ].map((cert) => (
            <div
              key={cert.name}
              className="flex items-center gap-3 px-5 py-3 bg-white/[0.04] border border-white/[0.06] rounded-full"
            >
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{cert.name}</p>
                <p className="text-xs text-white/40">{cert.description}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8 text-sm text-white/30"
        >
          Questions about security? Contact our team at{" "}
          <a href="mailto:security@lessonloop.net" className="text-teal hover:underline">
            security@lessonloop.net
          </a>
        </motion.p>
      </div>
    </section>
  );
}
