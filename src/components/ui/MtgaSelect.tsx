import { useState, useRef, useEffect } from "react";

interface Option {
  label: string;
  value: string | number;
}

interface MtgaSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: (Option | string)[];
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  error?: string;
}

export default function MtgaSelect({
  value,
  onChange,
  options,
  label,
  description,
  required,
  disabled,
  size = "md",
  error,
}: MtgaSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [dropdownStyle, setDropdownStyle] = useState<Record<string, string>>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  const selectedLabel =
    normalizedOptions.find((opt) => opt.value === value)?.label || "";

  const sizeClasses = {
    xs: { trigger: "h-7 px-2 text-xs", item: "py-1 px-2 text-xs" },
    sm: { trigger: "h-8 px-3 text-sm", item: "py-1.5 px-3 text-sm" },
    md: { trigger: "h-10 px-3.5 text-sm", item: "py-2 px-3.5 text-sm" },
    lg: { trigger: "h-12 px-4 text-base", item: "py-2.5 px-4 text-base" },
  };

  const updatePosition = () => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 6;
    const maxPanelHeight = 240;
    const availableBottom = window.innerHeight - rect.bottom - 8;
    const availableTop = rect.top - 8;
    const renderOnTop =
      availableBottom < maxPanelHeight && availableTop > availableBottom;
    setPlacement(renderOnTop ? "top" : "bottom");

    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
    const maxHeight = Math.max(
      120,
      Math.min(maxPanelHeight, renderOnTop ? availableTop - gap : availableBottom - gap)
    );

    setDropdownStyle({
      position: "fixed",
      left: `${left}px`,
      width: `${width}px`,
      zIndex: "1000",
      maxHeight: `${maxHeight}px`,
      top: renderOnTop ? "auto" : `${rect.bottom + gap}px`,
      bottom: renderOnTop ? `${window.innerHeight - rect.top + gap}px` : "auto",
    });
    requestAnimationFrame(() => setIsPositioned(true));
  };

  useEffect(() => {
    if (isOpen) {
      setIsPositioned(false);
      requestAnimationFrame(updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    } else {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      setIsPositioned(false);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = containerRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insidePanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="form-control inline-block relative w-full">
      {label && (
        <div className="label py-1">
          <span className={`label-text font-medium flex items-center gap-0.5 ${size === "xs" ? "text-xs" : "text-sm"} ${error ? "text-error" : "text-slate-600"}`}>
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </span>
        </div>
      )}

      <div
        ref={triggerRef}
        className={`relative flex items-center group transition-all duration-200 ease-out border rounded-xl shadow-sm cursor-pointer select-none ${sizeClasses[size].trigger} ${
          error
            ? "border-error/50 bg-error/5"
            : "border-slate-200 bg-white/50"
        } ${
          isOpen
            ? "border-primary ring-4 ring-primary/20 bg-white"
            : "hover:border-primary/40 hover:bg-white"
        } ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`truncate flex-1 font-medium ${selectedLabel ? "text-slate-700" : "text-slate-400"}`}>
          {selectedLabel || "请选择"}
        </span>
        <div className={`ml-2 text-slate-400 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180 text-primary" : "group-hover:text-primary/60"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && isPositioned && (
        <div
          ref={panelRef}
          className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 fixed"
          style={dropdownStyle}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-4 py-3 text-center text-slate-400 text-xs">暂无选项</div>
          ) : (
            <ul className="overflow-y-auto" style={{ maxHeight: "inherit" }}>
              {normalizedOptions.map((opt) => (
                <li key={String(opt.value)}>
                  <div
                    className={`cursor-pointer transition-colors duration-150 flex items-center justify-between antialiased ${sizeClasses[size].item} ${
                      value === opt.value
                        ? "bg-primary/10 text-slate-900 font-bold"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(description || error) && (
        <div className="label py-1 min-h-[24px]">
          <span className={`label-text-alt transition-all duration-300 ease-out ${error ? "text-error font-medium" : "text-slate-400"}`}>
            {error || description}
          </span>
        </div>
      )}
    </div>
  );
}
