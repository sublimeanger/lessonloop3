/**
 * Teacher colour palette for calendar colour-coding.
 * 8 distinct colours chosen for contrast in both light and dark modes.
 * Teachers are assigned deterministically by sorting alphabetically.
 */

export const TEACHER_COLOURS = [
  { name: 'Teal',    hex: '#0d9488', bg: 'bg-teal-500',    bgLight: 'bg-teal-100    dark:bg-teal-900/30',    text: 'text-teal-700    dark:text-teal-300',    border: 'border-teal-500' },
  { name: 'Rose',    hex: '#e11d48', bg: 'bg-rose-500',    bgLight: 'bg-rose-100    dark:bg-rose-900/30',    text: 'text-rose-700    dark:text-rose-300',    border: 'border-rose-500' },
  { name: 'Amber',   hex: '#d97706', bg: 'bg-amber-500',   bgLight: 'bg-amber-100   dark:bg-amber-900/30',   text: 'text-amber-700   dark:text-amber-300',   border: 'border-amber-500' },
  { name: 'Violet',  hex: '#7c3aed', bg: 'bg-violet-500',  bgLight: 'bg-violet-100  dark:bg-violet-900/30',  text: 'text-violet-700  dark:text-violet-300',  border: 'border-violet-500' },
  { name: 'Emerald', hex: '#059669', bg: 'bg-emerald-500', bgLight: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500' },
  { name: 'Sky',     hex: '#0284c7', bg: 'bg-sky-500',     bgLight: 'bg-sky-100     dark:bg-sky-900/30',     text: 'text-sky-700     dark:text-sky-300',     border: 'border-sky-500' },
  { name: 'Orange',  hex: '#ea580c', bg: 'bg-orange-500',  bgLight: 'bg-orange-100  dark:bg-orange-900/30',  text: 'text-orange-700  dark:text-orange-300',  border: 'border-orange-500' },
  { name: 'Fuchsia', hex: '#c026d3', bg: 'bg-fuchsia-500', bgLight: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-500' },
] as const;

export type TeacherColourEntry = (typeof TEACHER_COLOURS)[number];

export interface TeacherWithColour {
  id: string;
  name: string;
  userId: string | null;
  colour: TeacherColourEntry;
}

/**
 * Build a colour map from a list of teachers.
 * Teachers are sorted alphabetically and assigned colours in order (wrapping at 8).
 */
export function buildTeacherColourMap(
  teachers: { id: string; name: string; userId: string | null }[]
): Map<string, TeacherWithColour> {
  const sorted = [...teachers].sort((a, b) => a.name.localeCompare(b.name));
  const map = new Map<string, TeacherWithColour>();

  sorted.forEach((teacher, index) => {
    map.set(teacher.id, {
      ...teacher,
      colour: TEACHER_COLOURS[index % TEACHER_COLOURS.length],
    });
  });

  return map;
}

/**
 * Get a teacher's colour by their teacher_id (from the teachers table).
 * Returns a default grey if the teacher isn't in the map.
 */
export function getTeacherColour(
  colourMap: Map<string, TeacherWithColour>,
  teacherId: string | null | undefined
): TeacherColourEntry {
  if (!teacherId) return TEACHER_COLOURS[0];
  const entry = colourMap.get(teacherId);
  return entry?.colour ?? TEACHER_COLOURS[0];
}
