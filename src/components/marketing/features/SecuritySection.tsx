import { motion } from "framer-motion";
import { Shield, Lock, Eye, FileText, Server, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const securityFeatures = [
  {
    icon: Shield,
    title: "GDPR Compliant",
    description: "Full compliance with UK and EU data protection regulations. Your data, your rights.",
    color: "teal",
  },
  {
    icon: Lock,
    title: "Bank-Level Encryption",
    description: "256-bit SSL encryption for all data in transit. AES-256 for data at rest.",
    color: "coral",
  },
  {
    icon: Server,
    title: "UK Data Residency",
    description: "All data stored in UK data centres. Never leaves the jurisdiction.",
    color: "teal",
  },
  {
    icon: Eye,
    title: "Audit Logging",
    description: "Complete history of who did what, when. Full transparency for compliance.",
    color: "coral",
  },
  {
    icon: Download,
    title: "Data Export",
    description: "Download all your data anytime. Full portability, no lock-in.",
    color: "teal",
  },
  {
    icon: FileText,
    title: "Data Retention Controls",
    description: "Configure retention policies. Automatic anonymisation of old records.",
    color: "coral",
  },
];

const certifications = [
  { name: "GDPR", description: "UK & EU Compliant" },
  { name: "Encryption", description: "AES-256 at rest, TLS in transit" },
  { name: "Hosting", description: "Enterprise-grade hosting" },
];

export function SecuritySection() {
  return (
    <section id="security" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-teal uppercase tracking-wider">
                Security & Compliance
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Your data is safe.
              <br />
              <span className="text-muted-foreground">We guarantee it.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              We take security seriously. From encryption to compliance, 
              LessonLoop is built to protect your data and give you peace of mind.
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-4 mb-8">
              {certifications.map((cert) => (
                <motion.div
                  key={cert.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3 px-4 py-3 bg-muted rounded-xl"
                >
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{cert.name}</p>
                    <p className="text-xs text-muted-foreground">{cert.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              Questions about security? Contact our team at{" "}
              <a href="mailto:security@lessonloop.net" className="text-primary hover:underline">
                security@lessonloop.net
              </a>
            </p>
          </motion.div>

          {/* Right: Feature grid */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              {securityFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                    feature.color === "teal" ? "bg-teal/10" : "bg-coral/10"
                  )}>
                    <feature.icon className={cn(
                      "w-5 h-5",
                      feature.color === "teal" ? "text-teal" : "text-coral"
                    )} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
