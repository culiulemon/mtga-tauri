import { useState, useRef, useEffect, type ReactNode } from "react";

interface MtgaInputProps {
  value: string | number;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  readonly?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  error?: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  showDropdown?: boolean;
  options?: string[];
  clearable?: boolean;
  onSelect?: (value: string) => void;
  onDropdown?: () => void;
  inputClass?: string;
}

export default function MtgaInput({
  value,
  onChange,
  label,
  description,
  placeholder,
  type = "text",
  required,
  disabled,
  loading,
  readonly,
  size = "md",
  error,
  icon,
  trailingIcon,
  showDropdown,
  options = [],
  clearable = true,
  onSelect,
  onDropdown,
  inputClass,
}: MtgaInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const isPositioned = useRef(false);

  const sizeClasses = {
    xs: "px-2 py-1 h-7 text-xs",
    sm: "px-3 py-1.5 h-8 text-sm",
    md: "px-3.5 py-2 h-10 text-sm",
    lg: "px-4 py-2.5 h-12 text-base",
  };

  const updatePosition = () => {
    if (!containerRef.current || !dropdownOpen) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const hasSpaceBelow = spaceBelow > 250;

    setDropdownStyle({
      position: "fixed",
      top: hasSpaceBelow ? `${rect.bottom + 6}px` : "auto",
      bottom: !hasSpaceBelow ? `${window.innerHeight - rect.top + 6}px` : "auto",
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: "9999",
    });
    requestAnimationFrame(() => { isPositioned.current = true; });
  };

  useEffect(() => {
    if (dropdownOpen) {
      isPositioned.current = false;
      setIsFiltering(false);
      setDropdownStyle({});
      requestAnimationFrame(updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    } else {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      isPositioned.current = false;
      setIsFiltering(false);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredOptions = isFiltering
    ? options.filter((opt) => opt.toLowerCase().includes(String(value).toLowerCase().trim()))
    : options;

  const handleToggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || loading) return;
    if (!dropdownOpen) onDropdown?.();
    setDropdownOpen(!dropdownOpen);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    onSelect?.(val);
    setDropdownOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsFiltering(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (showDropdown && options.length > 0) {
      setDropdownOpen(true);
      setIsFiltering(true);
    }
  };

  return (
    <div className="form-control w-full">
      {label && (
        <div className="label py-1">
          <span className={`label-text font-medium flex items-center gap-0.5 ${size === "xs" ? "text-xs" : "text-sm"} ${error ? "text-error" : "text-slate-600"}`}>
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className={`relative flex items-center group transition-all duration-150 ease-out border rounded-xl shadow-sm ${
          error
            ? "border-error/50 bg-error/5"
            : "border-slate-200 bg-slate-100/70 focus-within:bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20"
        } ${disabled || loading ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:bg-white"}`}
      >
        {icon && (
          <div className={`absolute left-3 flex items-center justify-center pointer-events-none transition-colors duration-150 ${size === "xs" ? "w-4" : "w-5"} ${error ? "text-error/70" : "text-slate-400 group-hover:text-primary/60 group-focus-within:text-primary"}`}>
            {icon}
          </div>
        )}

        <input
          value={value}
          type={type}
          placeholder={placeholder}
          disabled={disabled || loading}
          readOnly={readonly}
          className={`w-full bg-transparent outline-none transition-all duration-150 border-none focus:ring-0 ${sizeClasses[size]} ${icon ? "pl-10" : "pl-3.5"} ${inputClass}`}
          onChange={handleInputChange}
        />

        {clearable && value && !disabled && !readonly && (
          <button
            type="button"
            className="absolute btn btn-ghost btn-circle btn-xs text-slate-400 hover:text-error hover:bg-error/10 transition-all duration-200 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 right-2.5"
            onClick={handleClear}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {showDropdown && (
          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
            <div className="h-1/2 w-px bg-slate-200 mx-1 group-hover:bg-primary/20 group-focus-within:bg-primary/30 transition-colors" />
            <button
              type="button"
              className={`btn btn-ghost btn-circle btn-xs text-slate-400 hover:text-primary transition-all duration-200 ${dropdownOpen ? "rotate-180 text-primary bg-primary/10" : ""}`}
              onClick={handleToggleDropdown}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {trailingIcon && (
          <div className={`absolute right-2 flex items-center justify-center px-1 ${size === "xs" ? "w-4" : "w-5"} text-slate-400`}>
            {trailingIcon}
          </div>
        )}
      </div>

      {showDropdown && dropdownOpen && isPositioned.current && (
        <div style={dropdownStyle} className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300 origin-top fixed">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2">
                <span className="loading loading-spinner loading-md text-primary" />
                <span className="text-[10px] text-slate-500 font-medium">加载中...</span>
              </div>
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-slate-400 text-xs">暂无匹配数据</p>
            </div>
          ) : (
            <ul className="flex flex-col flex-nowrap p-1 max-h-[240px] overflow-auto w-full">
              {filteredOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-primary/5 hover:text-primary transition-all duration-200 text-sm w-full ${value === opt ? "bg-primary/10 text-primary font-medium" : ""}`}
                    onClick={() => handleSelect(opt)}
                  >
                    <span className="truncate flex-1 text-left">{opt}</span>
                    {value === opt && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(description || error) && (
        <div className="label py-1 min-h-[24px]">
          <span className={`label-text-alt transition-all duration-300 ease-out flex items-center gap-1 ${error ? "text-error font-medium text-[11px]" : "text-slate-400"}`}>
            {error && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {error || description}
          </span>
        </div>
      )}
    </div>
  );
}
