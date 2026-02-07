import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Shield, 
  Users, 
  Headphones, 
  Key, 
  Zap,
  ArrowRight
} from "lucide-react";

const enterpriseFeatures = [
  { icon: Shield, label: "SSO & SAML integration" },
  { icon: Key, label: "API access & webhooks" },
  { icon: Users, label: "Unlimited teachers" },
  { icon: Headphones, label: "Dedicated account manager" },
  { icon: Zap, label: "Custom integrations" },
  { icon: Building2, label: "White-label options" },
];

export function EnterpriseCTA() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink-dark to-ink" />
      
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-teal/10 to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-coral/10 to-transparent blur-3xl" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(white 1px, transparent 1px),
                           linear-gradient(90deg, white 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="container mx-auto px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-semibold mb-6">
                <Building2 className="w-4 h-4" />
                Enterprise Solutions
              </div>
              
              <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
                Need a custom
                <br />
                <span className="bg-gradient-to-r from-teal to-coral bg-clip-text text-transparent">
                  solution?
                </span>
              </h2>
              
              <p className="text-lg text-white/70 mb-8">
                For large academies, agencies, and multi-location organizations, 
                we offer tailored solutions with dedicated support, custom integrations, 
                and enterprise-grade security.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link to="/contact">
                  <Button 
                    size="lg" 
                    className="bg-white text-ink hover:bg-white/90 font-semibold shadow-lg shadow-white/10"
                  >
                    Talk to Sales
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/contact?subject=demo">
                  <Button 
                    size="lg" 
                    className="border border-white/30 bg-transparent text-white hover:bg-white/10 font-semibold"
                  >
                    Book a Demo
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            {/* Features grid */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 gap-4"
            >
              {enterpriseFeatures.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal/20 to-primary/20 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-teal" />
                  </div>
                  <span className="text-sm font-medium text-white/90">
                    {feature.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
