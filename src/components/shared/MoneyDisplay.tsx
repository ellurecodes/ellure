import React from 'react';
import { formatInr, formatForeign } from '../../domain/money';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface MoneyDisplayProps {
  paise: number;
  className?: string;
  showSign?: boolean;
  showPaise?: 'auto' | 'always' | 'never';
  compact?: boolean;
  colorScheme?: 'neutral' | 'income' | 'expense' | 'verified' | 'uncertain' | 'auto';
  foreignAmountMinor?: number;
  foreignCurrency?: string;
}

export function MoneyDisplay({
  paise,
  className,
  showSign = false,
  showPaise = 'auto',
  compact = false,
  colorScheme = 'neutral',
  foreignAmountMinor,
  foreignCurrency,
}: MoneyDisplayProps) {
  let schemeColor = 'text-foreground';

  if (colorScheme === 'auto') {
    if (paise > 0) schemeColor = 'text-income';
    else if (paise < 0) schemeColor = 'text-expense';
  } else if (colorScheme === 'income' || colorScheme === 'verified') {
    schemeColor = 'text-income';
  } else if (colorScheme === 'expense') {
    schemeColor = 'text-expense';
  } else if (colorScheme === 'uncertain') {
    schemeColor = 'text-amber-500';
  }

  const formattedInr = formatInr(paise, { showSign, showPaise, compact });

  return (
    <span
      className={twMerge(
        clsx('tabular-nums font-medium inline-flex items-baseline space-x-1.5', schemeColor, className)
      )}
    >
      <span>{formattedInr}</span>
      {foreignAmountMinor !== undefined && foreignCurrency && foreignCurrency !== 'INR' && (
        <span className="text-[0.75em] opacity-75 font-normal">
          ({formatForeign(foreignAmountMinor, foreignCurrency)})
        </span>
      )}
    </span>
  );
}
