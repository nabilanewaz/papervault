import React, { useState } from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export interface SearchFilters {
  source: 'all' | 'Semantic Scholar' | 'arXiv' | 'Papers With Code' | 'Uploaded';
  dateRange: 'all' | 'week' | 'month' | 'year';
  hasCode: boolean;
  status?: 'all' | 'to-read' | 'reading' | 'completed';
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
}

export function SearchBar({ onSearch, placeholder = "Search papers by title, author, or topic...", showFilters = true }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    source: 'all',
    dateRange: 'all',
    hasCode: false,
    status: 'all'
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const handleSearch = () => {
    onSearch(query, filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onSearch(query, newFilters);
  };

  const clearFilters = () => {
    const defaultFilters: SearchFilters = {
      source: 'all',
      dateRange: 'all',
      hasCode: false,
      status: 'all'
    };
    setFilters(defaultFilters);
    onSearch(query, defaultFilters);
  };

  const activeFilterCount = [
    filters.source !== 'all',
    filters.dateRange !== 'all',
    filters.hasCode,
    filters.status !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Main Search Input */}
      <div className="relative">
        <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="flex-1 flex items-center px-6">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full py-4 text-gray-800 placeholder-gray-400 bg-transparent outline-none text-lg"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  onSearch('', filters);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
          
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-full px-4 rounded-none border-l border-gray-200 relative"
                >
                  <SlidersHorizontal className="h-5 w-5 text-gray-500" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter Papers</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Source</DropdownMenuLabel>
                {['all', 'Semantic Scholar', 'arXiv', 'Papers With Code', 'Uploaded'].map((source) => (
                  <DropdownMenuCheckboxItem
                    key={source}
                    checked={filters.source === source}
                    onCheckedChange={() => handleFilterChange('source', source)}
                  >
                    {source === 'all' ? 'All Sources' : source}
                  </DropdownMenuCheckboxItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Status</DropdownMenuLabel>
                {['all', 'to-read', 'reading', 'completed'].map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={filters.status === status}
                    onCheckedChange={() => handleFilterChange('status', status)}
                  >
                    {status === 'all' ? 'All Status' : 
                     status === 'to-read' ? 'To Read' :
                     status === 'reading' ? 'Reading' : 'Completed'}
                  </DropdownMenuCheckboxItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.hasCode}
                  onCheckedChange={(checked) => handleFilterChange('hasCode', checked)}
                >
                  Has Code Repository
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            onClick={handleSearch}
            className="h-full px-8 rounded-none bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold"
          >
            Search
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {filters.source !== 'all' && (
            <Badge variant="secondary" className="bg-white/90 text-gray-700">
              Source: {filters.source}
              <button 
                onClick={() => handleFilterChange('source', 'all')}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="bg-white/90 text-gray-700">
              Status: {filters.status}
              <button 
                onClick={() => handleFilterChange('status', 'all')}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.hasCode && (
            <Badge variant="secondary" className="bg-white/90 text-gray-700">
              Has Code
              <button 
                onClick={() => handleFilterChange('hasCode', false)}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export { SearchFilters as SearchFiltersType };
