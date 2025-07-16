'use client';

import Link from 'next/link';

interface SymbolTagsProps {
  symbols: string[];
}

export function SymbolTags({ symbols }: SymbolTagsProps) {
  if (!symbols || symbols.length === 0) {
    return null;
  }

  return (
    <div id="symbols-list" className="symbols-list">
      {symbols.map(symbol => (
        <Link key={symbol} href={`/stock?symbol=${symbol}`} className="symbol-tag">
          {symbol}
        </Link>
      ))}
    </div>
  );
} 