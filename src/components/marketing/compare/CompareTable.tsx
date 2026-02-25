import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type CellValue = true | false | string;

interface CompareRow {
  feature: string;
  lessonloop: CellValue;
  competitor: CellValue;
}

interface CompareTableProps {
  competitorName: string;
  rows: CompareRow[];
}

function CellDisplay({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-4 h-4 lg:w-5 lg:h-5 text-success mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs lg:text-sm text-muted-foreground text-center block">{value}</span>;
}

export default function CompareTable({ competitorName, rows }: CompareTableProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, 10);

  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-14"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            Feature-by-feature comparison
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            See exactly where LessonLoop and {competitorName} differ.
          </p>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden lg:block max-w-3xl mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-4 lg:p-6">
                <p className="text-sm text-muted-foreground">Feature</p>
              </div>
              <div className="p-4 lg:p-6 text-center bg-primary/5">
                <h3 className="text-lg font-bold text-primary">LessonLoop</h3>
              </div>
              <div className="p-4 lg:p-6 text-center">
                <h3 className="text-lg font-bold text-foreground">{competitorName}</h3>
              </div>
            </div>

            {rows.map((row, index) => (
              <div
                key={row.feature}
                className={cn(
                  "grid grid-cols-3 border-b border-border last:border-0",
                  index % 2 === 0 && "bg-muted/30"
                )}
              >
                <div className="p-3 lg:p-4 flex items-center">
                  <span className="text-xs lg:text-sm text-foreground">{row.feature}</span>
                </div>
                <div className="p-3 lg:p-4 flex items-center justify-center bg-primary/5">
                  <CellDisplay value={row.lessonloop} />
                </div>
                <div className="p-3 lg:p-4 flex items-center justify-center">
                  <CellDisplay value={row.competitor} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mobile */}
        <div className="lg:hidden max-w-md mx-auto">
          <div className="bg-card border border-primary ring-1 ring-primary/20 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary">LessonLoop</h3>
              <span className="text-xs text-muted-foreground">vs {competitorName}</span>
            </div>

            <div className="space-y-2">
              {visibleRows.map((row) => (
                <div key={row.feature} className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{row.feature}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 flex justify-center">
                      <CellDisplay value={row.lessonloop} />
                    </div>
                    <div className="w-10 flex justify-center opacity-50">
                      <CellDisplay value={row.competitor} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!showAll && rows.length > 10 && (
              <button onClick={() => setShowAll(true)} className="w-full mt-4 py-2 text-xs text-primary font-medium hover:underline">
                Show all {rows.length} features
              </button>
            )}
            {showAll && rows.length > 10 && (
              <button onClick={() => setShowAll(false)} className="w-full mt-4 py-2 text-xs text-muted-foreground font-medium hover:underline">
                Show less
              </button>
            )}

            <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground/60 justify-center">
              <span className="font-semibold text-primary/60">LL</span>
              <span>{competitorName}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
