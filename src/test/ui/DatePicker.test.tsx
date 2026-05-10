/**
 * LL-UI-DOB: DatePicker longRange-mode tests (s35).
 *
 * Verifies the opt-in longRange prop:
 *   - default mode unchanged (no dropdowns, no preset defaultMonth)
 *   - longRange renders Month + Year dropdowns
 *   - longRange opens on ~10 years ago when value is empty
 *   - fromYear/toYear overrides drive the year option range
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DatePicker } from '@/components/ui/date-picker';

afterEach(() => cleanup());

function openPicker() {
  // The trigger is a button; clicking it opens the popover (radix).
  fireEvent.click(screen.getByRole('button'));
}

describe('LL-UI-DOB: DatePicker default mode (backwards compat)', () => {
  it('renders no native select dropdowns by default', () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    openPicker();
    expect(document.querySelectorAll('select').length).toBe(0);
  });

  it('renders the trigger with placeholder when value is empty', () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Pick a date" />);
    expect(screen.getByRole('button')).toHaveTextContent('Pick a date');
  });

  it('renders the formatted ISO value when value is set', () => {
    render(<DatePicker value="1990-03-15" onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('15 Mar 1990');
  });
});

describe('LL-UI-DOB: DatePicker longRange mode', () => {
  it('renders Month + Year native select dropdowns when longRange is true', () => {
    render(<DatePicker value="" onChange={vi.fn()} longRange />);
    openPicker();
    // react-day-picker 8.10 renders the dropdowns as native <select> elements.
    // Two selects expected: month + year.
    expect(document.querySelectorAll('select').length).toBeGreaterThanOrEqual(2);
  });

  it('defaults fromYear to current-100 and toYear to current+5 when only longRange is set', () => {
    const currentYear = new Date().getFullYear();
    render(<DatePicker value="" onChange={vi.fn()} longRange />);
    openPicker();
    const selects = document.querySelectorAll('select');
    // The year dropdown is the one whose option values look like 4-digit ISO years.
    const yearSelect = Array.from(selects).find((s) => {
      const first = s.querySelector('option');
      return first && /^\d{4}$/.test(first.value);
    });
    expect(yearSelect).toBeTruthy();
    const yearOptions = Array.from(yearSelect!.querySelectorAll('option'));
    const years = yearOptions.map((o) => parseInt(o.value, 10));
    expect(Math.min(...years)).toBe(currentYear - 100);
    expect(Math.max(...years)).toBe(currentYear + 5);
  });

  it('respects custom fromYear / toYear overrides', () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        longRange
        fromYear={1950}
        toYear={2010}
      />,
    );
    openPicker();
    const selects = document.querySelectorAll('select');
    const yearSelect = Array.from(selects).find((s) => {
      const first = s.querySelector('option');
      return first && /^\d{4}$/.test(first.value);
    });
    expect(yearSelect).toBeTruthy();
    const years = Array.from(yearSelect!.querySelectorAll('option')).map((o) =>
      parseInt(o.value, 10),
    );
    expect(Math.min(...years)).toBe(1950);
    expect(Math.max(...years)).toBe(2010);
  });

  it('opens on a month ~10 years ago when no value is set', () => {
    render(<DatePicker value="" onChange={vi.fn()} longRange />);
    openPicker();
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const expectedYear = tenYearsAgo.getFullYear();
    // The currently-displayed year shows as the selected <option> in the year dropdown.
    const selects = document.querySelectorAll('select');
    const yearSelect = Array.from(selects).find((s) => {
      const first = s.querySelector('option');
      return first && /^\d{4}$/.test(first.value);
    });
    expect(yearSelect).toBeTruthy();
    expect(parseInt((yearSelect as HTMLSelectElement).value, 10)).toBe(expectedYear);
  });

  it('opens on the selected month when a value is provided (longRange does not override)', () => {
    render(<DatePicker value="1990-03-15" onChange={vi.fn()} longRange />);
    openPicker();
    const selects = document.querySelectorAll('select');
    const yearSelect = Array.from(selects).find((s) => {
      const first = s.querySelector('option');
      return first && /^\d{4}$/.test(first.value);
    });
    expect(yearSelect).toBeTruthy();
    expect(parseInt((yearSelect as HTMLSelectElement).value, 10)).toBe(1990);
  });
});
