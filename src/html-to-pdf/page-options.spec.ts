import { BadRequestException } from '@nestjs/common';
import { resolvePageOptions, resolveMargins } from './page-options';

describe('PDF page options', () => {
  it('preserves legacy margins unless explicitly configured', () => {
    expect(resolveMargins(undefined)).toEqual({ top: '0px', bottom: '0px', left: '10px', right: '10px' });
    expect(resolveMargins(0)).toEqual({ top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' });
    expect(resolveMargins(5)).toEqual({ top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' });
  });
  it.each([null, '0', -1, 51, NaN, Infinity])('rejects invalid margins %j', (margin) => {
    expect(() => resolveMargins(margin)).toThrow(BadRequestException);
  });
  it('defaults to A4 portrait', () => {
    expect(resolvePageOptions({})).toEqual({ format: 'A4', landscape: false });
  });

  it('accepts A3 landscape', () => {
    expect(resolvePageOptions({ format: 'A3', orientation: 'landscape' }))
      .toEqual({ format: 'A3', landscape: true });
  });

  it.each(['mm', 'cm', 'in', 'px'])('accepts positive custom dimensions in %s without a format', (unit) => {
    expect(resolvePageOptions({ format: 'custom', width: `18.5${unit}`, height: `25${unit}` }))
      .toEqual({ width: `18.5${unit}`, height: `25${unit}`, landscape: false });
  });

  it.each([
    { format: 'A5' },
    { format: null },
    { orientation: 'horizontal' },
    { orientation: null },
    { width: '180mm', height: '250mm' },
    { format: 'A3', width: '180mm' },
    { format: 'custom' },
    { format: 'custom', width: '180mm' },
    { format: 'custom', height: '250mm' },
    ...[null, 180, '', '0mm', '-1mm', '10', '1e3mm', 'NaNmm', '10pt', '10%', 'Infinitymm'].map((value) => ({
      format: 'custom', width: value, height: '250mm',
    })),
    { format: 'custom', width: '180mm', height: '0cm' },
  ])('rejects invalid page options: %j', (options) => {
    expect(() => resolvePageOptions(options)).toThrow(BadRequestException);
  });
});
