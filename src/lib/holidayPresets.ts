/**
 * Dynamic UK school holiday presets based on typical patterns.
 *
 * IMPORTANT: These are *approximate* dates. Actual dates vary by local authority,
 * region (England, Wales, Scotland, NI), and individual school.
 *
 * Academic year runs September → August.
 */

export interface HolidayRange {
  start: string; // yyyy-MM-dd
  end: string;
  reason: string;
}

export interface HolidayPreset {
  name: string;
  dates: HolidayRange[];
}

/**
 * Determine the academic year that contains the given date.
 * Academic year starts 1 Sep and ends 31 Aug.
 * Returns the calendar year in which September falls.
 */
function getAcademicYear(now: Date): number {
  return now.getMonth() >= 8 /* Sep=8 */ ? now.getFullYear() : now.getFullYear() - 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function d(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Generate approximate UK school holiday presets for a single academic year
 * starting in September of `startYear`.
 */
function generatePresetsForYear(startYear: number): HolidayPreset[] {
  const endYear = startYear + 1;
  const label = `${startYear}/${String(endYear).slice(2)}`;

  return [
    {
      name: `October Half Term ${startYear} (approx.)`,
      dates: [
        { start: d(startYear, 10, 21), end: d(startYear, 10, 25), reason: 'October Half Term' },
      ],
    },
    {
      name: `Christmas ${label} (approx.)`,
      dates: [
        { start: d(startYear, 12, 21), end: d(endYear, 1, 3), reason: 'Christmas Holiday' },
      ],
    },
    {
      name: `February Half Term ${endYear} (approx.)`,
      dates: [
        { start: d(endYear, 2, 17), end: d(endYear, 2, 21), reason: 'February Half Term' },
      ],
    },
    {
      name: `Easter ${endYear} (approx.)`,
      dates: [
        { start: d(endYear, 4, 7), end: d(endYear, 4, 18), reason: 'Easter Holiday' },
      ],
    },
    {
      name: `May Half Term ${endYear} (approx.)`,
      dates: [
        { start: d(endYear, 5, 26), end: d(endYear, 5, 30), reason: 'May Half Term' },
      ],
    },
    {
      name: `Summer ${endYear} (approx.)`,
      dates: [
        { start: d(endYear, 7, 21), end: d(endYear, 9, 1), reason: 'Summer Holiday' },
      ],
    },
  ];
}

/**
 * Returns holiday presets for the current academic year AND the next one.
 */
export function getUKHolidayPresets(): HolidayPreset[] {
  const academicYear = getAcademicYear(new Date());
  return [
    ...generatePresetsForYear(academicYear),
    ...generatePresetsForYear(academicYear + 1),
  ];
}
