import { motion } from "framer-motion";
import { User, Building2, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const paths = [
  {
    icon: User,
    title: "Solo Teacher",
    subtitle: "1 teacher, your students, your rules",
    desc: "Manage your own schedule, invoicing, and parent communication. Everything you need, nothing you don't.",
    cta: "See Teacher Plan →",
    href: "/pricing",
    color: "from-teal to-teal-dark",
    ctaColor: "text-teal",
    popular: false,
  },
  {
    icon: Building2,
    title: "Music Studio",
    subtitle: "2–5 teachers, growing fast",
    desc: "Add teachers, manage rooms, and scale your studio with team permissions, payroll reports, and multi-location support.",
    cta: "See Studio Plan →",
    href: "/pricing",
    color: "from-coral to-coral-dark",
    ctaColor: "text-coral",
    popular: true,
  },
  {
    icon: Crown,
    title: "Music Academy",
    subtitle: "6+ teachers, multiple locations",
    desc: "Unlimited teachers, API access, SSO, and a dedicated account manager. Built for serious scale.",
    cta: "See Academy Plan →",
    href: "/pricing",
    color: "from-primary to-primary/80",
    ctaColor: "text-primary",
    popular: false,
  },
];

export function AudiencePaths() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            For Every Stage
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Built for every stage of your teaching journey
          </h2>
        </motion.div>

        {/* Three cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {paths.map((path, i) => (
            <motion.div
              key={path.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 lg:p-8 hover:shadow-lg transition-all ${
                path.popular
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : "border-border"
              }`}
            >
              {path.popular && (
                <span className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </span>
              )}

              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${path.color} flex items-center justify-center mb-5`}>
                <path.icon className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-xl font-bold text-foreground">{path.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{path.subtitle}</p>

              <p className="text-sm text-muted-foreground mt-3 flex-1 leading-relaxed">
                {path.desc}
              </p>

              <Link
                to={path.href}
                className={`inline-block mt-5 text-sm font-medium hover:underline ${path.ctaColor}`}
              >
                {path.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
