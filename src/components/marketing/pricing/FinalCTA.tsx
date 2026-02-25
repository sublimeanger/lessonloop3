import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, CreditCard } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-muted/50 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent blur-3xl" />
      
      <div className="container mx-auto px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-6">
            Ready to simplify your
            <br />
            <span className="bg-gradient-to-r from-teal via-primary to-coral bg-clip-text text-transparent">
              teaching business?
            </span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Join music educators across the UK who've reclaimed their time 
            and simplified their admin with LessonLoop. Every plan includes scheduling, 
            invoicing, parent portal, and LoopAssist AI.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link to="/signup">
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline"
                className="h-14 px-8 text-lg font-semibold"
              >
                Talk to Sales
              </Button>
            </Link>
          </div>
          
          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-success" />
              <span>30-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-success" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-success" />
              <span>Cancel anytime</span>
            </div>
          </div>
          <div className="mt-6">
            <Link to="/features" className="text-sm font-semibold text-primary hover:underline">
              Compare with other music school software →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
