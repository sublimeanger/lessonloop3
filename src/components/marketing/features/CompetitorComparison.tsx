import { motion } from "framer-motion";
import { Check, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type CellValue = true | false | string;

const competitors = ["LessonLoop", "My Music Staff", "Teachworks"] as const;

const rows: { feature: string; values: [CellValue, CellValue, CellValue] }[] = [
  { feature: "AI Assistant", values: [true, false, false] },
  { feature: "UK-Native (GBP/VAT)", values: [true, "Partial", "Partial"] },
  { feature: "Make-Up Matching", values: ["Auto", "Basic credits", false] },
  { feature: "Payment Plans", values: [true, false, false] },
  { feature: "Parent Portal", values: [true, true, true] },
  { feature: "Practice Tracking", values: [true, true, false] },
  { feature: "Stripe Payments", values: [true, true, true] },
  { feature: "Drag & Drop Calendar", values: [true, true, true] },
  { feature: "Bulk Invoicing", values: [true, true, true] },
  { feature: "Multi-Location", values: [true, true, true] },
  { feature: "Website Builder", values: ["Roadmap", true, "Plugins"] },
  { feature: "Mobile App", values: ["PWA", false, false] },
  { feature: "Modern UI", values: [true, "Legacy", "Legacy"] },
  { feature: "Free Trial", values: ["30 days", "30 days", "Free trial"] },
];

function CellValue({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-4 h-4 lg:w-5 lg:h-5 text-success mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs lg:text-sm text-muted-foreground text-center block">{value}</span>;
}

export function CompetitorComparison() {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, 8);

  return (
    <section className="py-16 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs lg:text-sm font-semibold mb-4">
            Comparison
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-3 lg:mb-4">
            How LessonLoop compares
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            See how we stack up against other music lesson management platforms.
          </p>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden lg:block max-w-4xl mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-border">
              <div className="p-4 lg:p-6">
                <p className="text-sm text-muted-foreground">Feature</p>
              </div>
              {competitors.map((name, i) => (
                <div
                  key={name}
                  className={cn("p-4 lg:p-6 text-center", i === 0 && "bg-primary/5")}
                >
                  <h3 className={cn("text-lg font-bold", i === 0 ? "text-primary" : "text-foreground")}>
                    {name}
                  </h3>
                </div>
              ))}
            </div>

            {/* Rows */}
            {rows.map((row, index) => (
              <div
                key={row.feature}
                className={cn(
                  "grid grid-cols-4 border-b border-border last:border-0",
                  index % 2 === 0 && "bg-muted/30"
                )}
              >
                <div className="p-3 lg:p-4 flex items-center">
                  <span className="text-xs lg:text-sm text-foreground">{row.feature}</span>
                </div>
                {row.values.map((val, i) => (
                  <div
                    key={i}
                    className={cn("p-3 lg:p-4 flex items-center justify-center", i === 0 && "bg-primary/5")}
                  >
                    <CellValue value={val} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mobile cards */}
        <div className="lg:hidden max-w-md mx-auto">
          <div className="bg-card border border-primary ring-1 ring-primary/20 rounded-xl p-4 sm:p-5">
            <h3 className="text-lg font-bold text-primary mb-1">LessonLoop</h3>
            <p className="text-xs text-muted-foreground mb-4">vs My Music Staff & Teachworks</p>

            <div className="space-y-2">
              {visibleRows.map((row) => (
                <div key={row.feature} className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{row.feature}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-12 flex justify-center">
                      <CellValue value={row.values[0]} />
                    </div>
                    <div className="w-8 flex justify-center opacity-50">
                      <CellValue value={row.values[1]} />
                    </div>
                    <div className="w-8 flex justify-center opacity-50">
                      <CellValue value={row.values[2]} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!showAll && rows.length > 8 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full mt-4 py-2 text-xs text-primary font-medium hover:underline"
              >
                Show all {rows.length} features
              </button>
            )}
            {showAll && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full mt-4 py-2 text-xs text-muted-foreground font-medium hover:underline"
              >
                Show less
              </button>
            )}

            <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground/60 justify-center">
              <span className="font-semibold text-primary/60">LL</span>
              <span>MMS</span>
              <span>TW</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-6 lg:mt-8 text-xs text-muted-foreground/60 flex items-center justify-center gap-1.5"
        >
          <Info className="w-3 h-3" />
          Comparison based on publicly available information as of February 2026. Features may have changed.
        </motion.p>
      </div>
    </section>
  );
}
