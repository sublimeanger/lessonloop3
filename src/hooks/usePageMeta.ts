import { useEffect } from "react";

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", description);
    }
    return () => {
      document.title = "LessonLoop — AI-Powered Music School Management for UK Teachers";
      if (meta) {
        meta.setAttribute("content", "Scheduling, invoicing, parent portal & AI assistant built for UK music educators. Try free for 30 days.");
      }
    };
  }, [title, description]);
}
