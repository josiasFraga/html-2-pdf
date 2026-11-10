import { BadRequestException } from '@nestjs/common';
import type { PDFOptions } from 'puppeteer';

export interface PageOptions {
  format?: 'A3' | 'A4' | 'custom';
  orientation?: 'portrait' | 'landscape';
  width?: string;
  height?: string;
  marginMm?: number;
}

export function resolveMargins(value: unknown): NonNullable<PDFOptions['margin']> {
  if (value === undefined) return { top: '0px', bottom: '0px', left: '10px', right: '10px' };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 50) {
    throw new BadRequestException('marginMm deve ser um numero entre 0 e 50.');
  }
  const margin = `${value}mm`;
  return { top: margin, bottom: margin, left: margin, right: margin };
}

function validateDimension(value: unknown, field: string): string {
  const match = typeof value === 'string'
    ? /^(\d+(?:\.\d+)?)(mm|cm|in|px)$/.exec(value)
    : null;
  if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0) {
    throw new BadRequestException(`${field} deve ser uma medida positiva com unidade mm, cm, in ou px (ex.: "180mm").`);
  }
  return match[0];
}

export function resolvePageOptions(options: {
  format?: unknown;
  orientation?: unknown;
  width?: unknown;
  height?: unknown;
}): PDFOptions {
  const format = options.format === undefined ? 'A4' : options.format;
  const orientation = options.orientation === undefined ? 'portrait' : options.orientation;
  if (format !== 'A3' && format !== 'A4' && format !== 'custom') {
    throw new BadRequestException('format deve ser A3, A4 ou custom.');
  }
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    throw new BadRequestException('orientation deve ser portrait (vertical) ou landscape (horizontal).');
  }
  const landscape = orientation === 'landscape';
  if (format === 'custom') {
    return {
      width: validateDimension(options.width, 'width'),
      height: validateDimension(options.height, 'height'),
      landscape,
    };
  }
  if (options.width !== undefined || options.height !== undefined) {
    throw new BadRequestException('width e height so podem ser enviados com format custom.');
  }
  return { format, landscape };
}
