import { motion } from "framer-motion";
import { Download, Trash2, Clock, FileText, Users, Lock, Check } from "lucide-react";
import { Link } from "react-router-dom";

const gdprFeatures = [
  { icon: Download, title: "Subject Access Requests", desc: "One-click data export for any student, parent, or teacher. Download everything in a machine-readable format." },
  { icon: Trash2, title: "Right to Erasure", desc: "Soft-delete student records first (reversible for 30 days), then permanent anonymisation. No data lingers." },
  { icon: Clock, title: "Retention Policies", desc: "Configure how long inactive records are kept. Automatic flagging of records due for review." },
  { icon: FileText, title: "Audit Logging", desc: "Every data access, edit, and deletion is logged with timestamp and user. Full accountability trail." },
  { icon: Users, title: "Role-Based Access", desc: "Teachers see only their students. Admins control what each team member can access." },
  { icon: Lock, title: "Encryption", desc: "AES-256 encryption at rest, TLS 1.3 in transit. Bank-level security on every plan." },
];

const checklistItems = [
  "Data export (Subject Access Requests)",
  "Right to erasure & anonymisation",
  "Configurable retention policies",
  "Full audit logging",
  "Role-based access controls",
  "AES-256 encryption at rest",
  "TLS 1.3 encryption in transit",
  "UK-headquartered data processing",
];

export function UKGDPRDeepDive() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            GDPR compliance that's built in, not bolted on
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every music school in the UK handles sensitive data about children. LessonLoop was designed from day one to
            protect it.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto items-start">
          {/* Left: Feature list */}
          <div className="space-y-6">
            {gdprFeatures.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right: Dark compliance card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-ink p-8 text-white"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">GDPR Compliance</p>
                <p className="text-sm text-white/60">LessonLoop — verified</p>
              </div>
            </div>
            <ul className="space-y-3">
              {checklistItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <div className="text-center mt-10">
          <Link to="/gdpr" className="text-sm font-semibold text-primary hover:underline">
            Read our full GDPR policy →
          </Link>
        </div>
      </div>
    </section>
  );
}
