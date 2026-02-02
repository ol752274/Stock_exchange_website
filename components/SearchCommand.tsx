'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { searchStocks } from '@/lib/actions/finnhub.actions';

const STOCKS = [
  { id: 1, symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Equity' },
  { id: 2, symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'Equity' },
  { id: 3, symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'Equity' },
  { id: 4, symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'Equity' },
  { id: 5, symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'Equity' },
];

interface SearchCommandProps {
  renderAs?: 'button' | 'text';
  label?: string;
  initialStocks?: Array<{ id?: number; symbol: string; name: string; exchange?: string; type?: string }>;
}

export default function SearchCommand({ renderAs = 'button', label = 'Add Stock', initialStocks = [] }: SearchCommandProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState(initialStocks);
  const isSearchMode = !!searchTerm.trim();
  const displayStocks = isSearchMode ? stocks : stocks?.slice(0, 10);
  // Cmd/Ctrl + K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  const handleSearch = () => {
    if (!isSearchMode) {
      setStocks(initialStocks);
      return;
    }
    setLoading(true);
    searchStocks(searchTerm.trim())
      .then((results) => {
        setStocks(results);
      })
      .catch((e) => {
        console.error('Error searching stocks:', e);
        setStocks([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  
  const debouncedSearch = useDebounce(handleSearch, 300);
  
  useEffect(() => {
    debouncedSearch();
  }, [searchTerm, debouncedSearch]);
  const handleSelectStock = () => {
    setOpen(false);
    setSearchTerm('');
  };

  const filteredStocks = STOCKS.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {renderAs === 'text' ? (
        <span onClick={() => setOpen(true)} className="search-text cursor-pointer">
          {label}
        </span>
      ) : (
        <Button onClick={() => setOpen(true)} className="search-btn">
          {label}
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen} className="search-dialog">
        <div className="search-field">
          <CommandInput
            placeholder="Search stocks (symbol or name)..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          {loading && <Loader2 className="search-loader" />}
        </div>
        <CommandList className="search-list">
          {loading ? (
            <CommandEmpty className="search-list-empty">Loading stocks...</CommandEmpty>
          ) : displayStocks?.length === 0 ? (
            <div className="search-list-indicator">
              {isSearchMode ? 'No results found' : 'No stocks available'}
            </div>
          ) : (
            <ul>
              <div className="search-count">
                {isSearchMode ? 'Search results' : 'Popular stocks'}
                {' '}({displayStocks?.length || 0})
              </div>
              {displayStocks?.map((stock) => (
                <li key={stock.symbol} className='search-item'>
                  <Link 
                    href={`/stock/${stock.symbol}`}
                    onClick={() => handleSelectStock()}
                    className='search-item-link'
                >
                  <TrendingUp className='h-4 w-4 text-gray-500'/>
                  <div className='flex-1'>
                    <div className='search-item-name'>
                      {stock.name}
                    </div>
                    <div className='text-sm text-gray-500'>
                      {stock.symbol} | {stock.exchange} | {stock.type}
                    </div>
                  </div>
                </Link>
              </li>
              ))}
            </ul>
          )}
        </CommandList>
      </CommandDialog>

      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
      >
        <span>🔍 Search</span>
        <kbd className="text-xs bg-gray-800 px-2 py-1 rounded">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
        </kbd>
      </button>
    </>
  );
}
