import { motion } from "framer-motion";
import { User, Building2, Crown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const paths = [
  {
    icon: User,
    title: "Solo Teacher",
    desc: "Manage your own students, schedule, and invoicing. Everything you need, nothing you don't.",
    cta: "See Teacher Plan",
    href: "/pricing",
    popular: false,
  },
  {
    icon: Building2,
    title: "Music Studio",
    subtitle: "2–5 teachers",
    desc: "Add teachers, manage rooms, and scale your studio with team permissions and payroll reports.",
    cta: "See Studio Plan",
    href: "/pricing",
    popular: true,
  },
  {
    icon: Crown,
    title: "Music Academy",
    subtitle: "6+ teachers",
    desc: "Multi-location, unlimited teachers, API access, and a dedicated account manager.",
    cta: "See Academy Plan",
    href: "/pricing",
    popular: false,
  },
];

export function AudiencePaths() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Built for every stage of your teaching journey
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {paths.map((path, i) => (
            <motion.div
              key={path.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={path.href}
                className="group relative flex flex-col h-full p-7 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                {path.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Popular
                  </Badge>
                )}

                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <path.icon className="w-6 h-6 text-primary" />
                </div>

                <h3 className="text-xl font-bold text-foreground">
                  {path.title}
                </h3>
                {path.subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{path.subtitle}</p>
                )}

                <p className="text-sm text-muted-foreground mt-3 flex-1 leading-relaxed">
                  {path.desc}
                </p>

                <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                  {path.cta}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
