import React, { useState, useEffect, useRef, memo } from 'react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onSearchChange: (value: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * High-performance 2s Debounced SearchBar Component.
 * - Typing characters updates input synchronously in 0ms (zero keyboard latency).
 * - Executes search only after user stops typing for 2 seconds (or hits Enter immediately).
 */
export const SearchBar: React.FC<SearchBarProps> = memo(({
  value,
  onSearchChange,
  isFocused,
  onFocus,
  onBlur,
  onClear,
  placeholder = "Tìm chat, tên khách, lệnh /top10, /vip... (chờ 2s hoặc nhấn Enter)",
  className = ""
}) => {
  const [inputText, setInputText] = useState(value);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedValRef = useRef(value);

  // Sync external value updates (e.g. commands like /top10 or clear)
  useEffect(() => {
    if (value !== lastSubmittedValRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setInputText(value);
      setIsDebouncing(false);
      lastSubmittedValRef.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInputText(nextVal);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If input is emptied, clear immediately
    if (!nextVal.trim()) {
      setIsDebouncing(false);
      lastSubmittedValRef.current = '';
      onSearchChange('');
      return;
    }

    setIsDebouncing(true);

    // Chờ không gõ phím trong vòng 2 giây (2000ms) rồi mới load tìm kiếm
    timerRef.current = setTimeout(() => {
      setIsDebouncing(false);
      lastSubmittedValRef.current = nextVal;
      onSearchChange(nextVal);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setIsDebouncing(false);
      lastSubmittedValRef.current = inputText;
      onSearchChange(inputText);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setInputText('');
    setIsDebouncing(false);
    lastSubmittedValRef.current = '';
    onSearchChange('');
    onClear();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative flex items-center bg-[#0e1621] rounded-full border border-white/10 shadow-inner ${className}`}>
      <span className="absolute left-3 text-gray-400 pointer-events-none flex items-center justify-center">
        {isDebouncing ? (
          <Loader2 size={18} className="animate-spin text-amber-400" />
        ) : (
          <SearchIcon size={18} />
        )}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-transparent text-white text-sm focus:outline-none placeholder-gray-400 font-medium"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
      />
      {(inputText || isFocused) && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute right-3 text-gray-400 hover:text-white bg-white/10 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
          aria-label="Xóa nội dung tìm kiếm"
        >
          ✕
        </button>
      )}
    </div>
  );
});
