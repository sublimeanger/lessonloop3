import { motion } from "framer-motion";
import { Check, X, Info } from "lucide-react";
import { Link } from "react-router-dom";

type CellValue = true | false | "partial" | "basic";

interface Row {
  feature: string;
  lessonloop: CellValue;
  mms: CellValue;
  teachworks: CellValue;
  opus1: CellValue;
}

const rows: Row[] = [
  { feature: "GBP native", lessonloop: true, mms: "partial", teachworks: "partial", opus1: false },
  { feature: "UK VAT auto-calculation", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "Termly billing", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "UK bank holidays built in", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "GDPR compliance by design", lessonloop: true, mms: "basic", teachworks: "basic", opus1: "basic" },
  { feature: "Data export (SAR)", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "Audit logging", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "British English", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "DD/MM/YYYY dates", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "GMT/BST timezone", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "AI assistant (LoopAssist)", lessonloop: true, mms: false, teachworks: false, opus1: false },
  { feature: "UK-headquartered", lessonloop: true, mms: false, teachworks: false, opus1: false },
];

function CellIcon({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-5 h-5 text-success mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs text-muted-foreground capitalize">{value}</span>;
}

export function UKCompetitorContrast() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            How UK music school software should work
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most music school software is built for the US market. Here's what that means for UK teachers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto overflow-x-auto"
        >
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Feature</th>
                <th className="text-center py-3 px-4 font-semibold text-foreground">LessonLoop 🇬🇧</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">My Music Staff 🇨🇦</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Teachworks 🇨🇦</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Opus1 🇺🇸</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-foreground">{row.feature}</td>
                  <td className="py-3 px-4 text-center"><CellIcon value={row.lessonloop} /></td>
                  <td className="py-3 px-4 text-center"><CellIcon value={row.mms} /></td>
                  <td className="py-3 px-4 text-center"><CellIcon value={row.teachworks} /></td>
                  <td className="py-3 px-4 text-center"><CellIcon value={row.opus1} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <div className="max-w-5xl mx-auto mt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Comparison based on publicly available information as of February 2025. Features may have changed.
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
            <Link
              to="/compare/lessonloop-vs-my-music-staff"
              className="text-sm font-semibold text-primary hover:underline"
            >
              LessonLoop vs My Music Staff — full comparison →
            </Link>
            <Link
              to="/compare/lessonloop-vs-teachworks"
              className="text-sm font-semibold text-primary hover:underline"
            >
              LessonLoop vs Teachworks — full comparison →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
