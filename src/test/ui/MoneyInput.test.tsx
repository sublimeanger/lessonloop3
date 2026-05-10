/**
 * LL-UI-MONEY-01: MoneyInput tests (s36).
 *
 * The MoneyInput component is the world-class fix for the s36 rate_amount
 * pound-vs-pence convention bug. Stores values as minor units (pence)
 * internally, lets users type intuitively (`35` or `35.00` both → £35.00),
 * and shows a live preview.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MoneyInput } from '@/components/ui/money-input';

afterEach(() => cleanup());

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('LL-UI-MONEY-01: MoneyInput', () => {
  it('typing "35" calls onChangeMinor(3500)', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '35' } });
    expect(onChange).toHaveBeenLastCalledWith(3500);
  });

  it('typing "35.00" calls onChangeMinor(3500)', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '35.00' } });
    expect(onChange).toHaveBeenLastCalledWith(3500);
  });

  it('typing "3500" calls onChangeMinor(350000) — intentional, not auto-truncated', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '3500' } });
    expect(onChange).toHaveBeenLastCalledWith(350000);
  });

  it('typing "35.5" calls onChangeMinor(3550)', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '35.5' } });
    expect(onChange).toHaveBeenLastCalledWith(3550);
  });

  it('strips non-numeric characters', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: 'abc35def' } });
    expect(onChange).toHaveBeenLastCalledWith(3500);
  });

  it('strips a second decimal point (keeps the first)', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '35.00.50' } });
    // "35.0050" → max 2 decimals → "35.00" → 3500
    expect(onChange).toHaveBeenLastCalledWith(3500);
  });

  it('limits decimal places to 2', () => {
    const onChange = vi.fn();
    render(<MoneyInput valueMinor={0} onChangeMinor={onChange} />);
    fireEvent.change(getInput(), { target: { value: '35.999' } });
    // Truncates to "35.99" → 3599
    expect(onChange).toHaveBeenLastCalledWith(3599);
  });

  it('initialises input from valueMinor prop', () => {
    render(<MoneyInput valueMinor={3500} onChangeMinor={vi.fn()} />);
    expect(getInput().value).toBe('35.00');
  });

  it('re-syncs raw text when valueMinor prop changes externally', () => {
    const { rerender } = render(
      <MoneyInput valueMinor={3500} onChangeMinor={vi.fn()} />,
    );
    expect(getInput().value).toBe('35.00');
    rerender(<MoneyInput valueMinor={5500} onChangeMinor={vi.fn()} />);
    expect(getInput().value).toBe('55.00');
  });

  it('preview hidden when valueMinor is 0', () => {
    render(<MoneyInput valueMinor={0} onChangeMinor={vi.fn()} />);
    expect(screen.queryByTestId('money-input-preview')).toBeNull();
  });

  it('preview shows formatted amount when valueMinor > 0', () => {
    render(<MoneyInput valueMinor={3550} onChangeMinor={vi.fn()} />);
    const preview = screen.getByTestId('money-input-preview');
    // formatCurrencyMinor trims trailing zeros: 3550 → "£35.5", 3500 → "£35"
    expect(preview.textContent).toMatch(/£35\.5/);
  });

  it('currency symbol matches currencyCode prop', () => {
    const { container } = render(
      <MoneyInput valueMinor={3500} onChangeMinor={vi.fn()} currencyCode="USD" />,
    );
    // Symbol span is the first child of the relative wrapper
    expect(container.textContent).toContain('$');
  });

  it('uses inputMode="decimal" for mobile-keyboard decimal access', () => {
    render(<MoneyInput valueMinor={0} onChangeMinor={vi.fn()} />);
    expect(getInput().getAttribute('inputmode')).toBe('decimal');
  });

  it('does NOT use type="number" (mobile keyboards hide decimal point on some platforms)', () => {
    render(<MoneyInput valueMinor={0} onChangeMinor={vi.fn()} />);
    expect(getInput().type).toBe('text');
  });
});
