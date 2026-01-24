import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, PoundSterling, FileText, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export function ValueCalculator() {
  const [students, setStudents] = useState(30);
  
  // Calculate savings based on students
  const hoursPerWeek = Math.round(students * 0.15); // ~9 mins per student in admin
  const invoicesPerMonth = students;
  const monthlyValueSaved = Math.round(students * 8); // £8 value per student
  const yearlyValueSaved = monthlyValueSaved * 12;
  
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-coral/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
            <TrendingUp className="w-4 h-4" />
            Value Calculator
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            How much time will you save?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See the real impact LessonLoop has on your teaching practice
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          {/* Slider section */}
          <div className="bg-card border border-border rounded-3xl p-8 lg:p-10 shadow-lg mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Number of students
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag the slider to match your studio size
                </p>
              </div>
              <motion.div 
                key={students}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-4xl lg:text-5xl font-bold text-primary"
              >
                {students}
              </motion.div>
            </div>
            
            <Slider
              value={[students]}
              onValueChange={(value) => setStudents(value[0])}
              min={5}
              max={200}
              step={5}
              className="w-full"
            />
            
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>5 students</span>
              <span>200 students</span>
            </div>
          </div>
          
          {/* Results grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-teal/30 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-teal" />
              </div>
              <motion.div 
                key={hoursPerWeek}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-foreground mb-1"
              >
                {hoursPerWeek}
              </motion.div>
              <p className="text-sm text-muted-foreground">Hours saved per week</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-coral/30 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-coral/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-coral" />
              </div>
              <motion.div 
                key={invoicesPerMonth}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-foreground mb-1"
              >
                {invoicesPerMonth}
              </motion.div>
              <p className="text-sm text-muted-foreground">Invoices automated</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <PoundSterling className="w-6 h-6 text-primary" />
              </div>
              <motion.div 
                key={monthlyValueSaved}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-foreground mb-1"
              >
                £{monthlyValueSaved}
              </motion.div>
              <p className="text-sm text-muted-foreground">Value saved monthly</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-teal/10 to-primary/10 border border-teal/20 rounded-2xl p-6 text-center hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal to-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <motion.div 
                key={yearlyValueSaved}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-foreground mb-1"
              >
                £{yearlyValueSaved.toLocaleString()}
              </motion.div>
              <p className="text-sm text-muted-foreground">Yearly ROI</p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
