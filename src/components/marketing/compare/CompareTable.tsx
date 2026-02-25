import { motion } from "framer-motion";
import { Check, Minus, Crown } from "lucide-react";
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

function CellDisplay({ value, winner }: { value: CellValue; winner?: boolean }) {
  if (value === true)
    return (
      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center", winner ? "bg-[hsl(var(--emerald)/0.15)]" : "bg-[hsl(var(--emerald)/0.1)]")}>
        <Check className="w-3.5 h-3.5 text-[hsl(var(--emerald))]" />
      </span>
    );
  if (value === false)
    return (
      <span className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center">
        <Minus className="w-3.5 h-3.5 text-muted-foreground/40" />
      </span>
    );
  return <span className="text-xs font-medium text-muted-foreground text-center">{value}</span>;
}

export default function CompareTable({ competitorName, rows }: CompareTableProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, 10);

  // Count wins
  const llWins = rows.filter(r => r.lessonloop === true && r.competitor !== true).length;

  return (
    <section className="py-20 lg:py-28 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16"
        >
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Head to Head</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Feature-by-feature comparison
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See exactly where LessonLoop and {competitorName} differ.
          </p>
        </motion.div>

        {/* Score badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[hsl(var(--emerald)/0.1)] border border-[hsl(var(--emerald)/0.2)]">
            <Crown className="w-4 h-4 text-[hsl(var(--emerald))]" />
            <span className="text-sm font-bold text-[hsl(var(--emerald))]">
              LessonLoop leads in {llWins} of {rows.length} features
            </span>
          </div>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden lg:block max-w-3xl mx-auto"
        >
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-lg">
            {/* Header */}
            <div className="grid grid-cols-3">
              <div className="px-6 py-5 border-b border-border/40">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feature</p>
              </div>
              <div className="px-6 py-5 text-center border-b border-border/40 bg-primary/5 border-x border-primary/10">
                <h3 className="text-sm font-bold text-primary">LessonLoop</h3>
              </div>
              <div className="px-6 py-5 text-center border-b border-border/40">
                <h3 className="text-sm font-bold text-muted-foreground">{competitorName}</h3>
              </div>
            </div>

            {rows.map((row, index) => {
              const llBetter = row.lessonloop === true && row.competitor !== true;
              return (
                <div
                  key={row.feature}
                  className={cn(
                    "grid grid-cols-3 border-b border-border/20 last:border-0 transition-colors",
                    index % 2 === 0 ? "bg-card" : "bg-secondary/20",
                    llBetter && "bg-[hsl(var(--emerald)/0.03)]"
                  )}
                >
                  <div className="px-6 py-3.5 flex items-center">
                    <span className="text-sm text-foreground font-medium">{row.feature}</span>
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-center border-x border-primary/5 bg-primary/[0.02]">
                    <CellDisplay value={row.lessonloop} winner={llBetter} />
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-center">
                    <CellDisplay value={row.competitor} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Mobile */}
        <div className="lg:hidden max-w-md mx-auto">
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary">LessonLoop</h3>
              <span className="text-xs font-medium text-muted-foreground">vs {competitorName}</span>
            </div>

            <div className="divide-y divide-border/20">
              {visibleRows.map((row) => {
                const llBetter = row.lessonloop === true && row.competitor !== true;
                return (
                  <div key={row.feature} className={cn("flex items-center justify-between px-5 py-3", llBetter && "bg-[hsl(var(--emerald)/0.03)]")}>
                    <span className="text-xs font-medium text-foreground flex-1 min-w-0 mr-3">{row.feature}</span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <CellDisplay value={row.lessonloop} winner={llBetter} />
                      <div className="opacity-50">
                        <CellDisplay value={row.competitor} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!showAll && rows.length > 10 && (
              <button onClick={() => setShowAll(true)} className="w-full py-3 text-xs text-primary font-semibold hover:bg-primary/5 transition-colors border-t border-border/20">
                Show all {rows.length} features
              </button>
            )}
            {showAll && rows.length > 10 && (
              <button onClick={() => setShowAll(false)} className="w-full py-3 text-xs text-muted-foreground font-semibold hover:bg-secondary/30 transition-colors border-t border-border/20">
                Show less
              </button>
            )}

            <div className="px-5 py-2.5 bg-secondary/30 flex gap-4 text-[10px] text-muted-foreground/60 justify-center border-t border-border/20">
              <span className="font-bold text-primary/60">LL</span>
              <span>{competitorName}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
