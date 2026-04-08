import { useState, useEffect, useCallback, useMemo } from "react";
import MtgaDialog from "@/components/ui/MtgaDialog";
import { useThemeConfig } from "@/hooks/themeConfig";
import type { ThemeConfig } from "@/types/mtgaTypes";

interface ThemeSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ColorField {
  key: keyof Pick<
    ThemeConfig,
    | "primary_color"
    | "accent_color"
    | "background_color"
    | "text_color"
    | "secondary_color"
    | "success_color"
    | "warning_color"
    | "error_color"
  >;
  label: string;
}

const COLOR_FIELDS: ColorField[] = [
  { key: "primary_color", label: "主色" },
  { key: "accent_color", label: "强调色" },
  { key: "background_color", label: "背景色" },
  { key: "text_color", label: "文字色" },
  { key: "secondary_color", label: "次要文字色" },
  { key: "success_color", label: "成功色" },
  { key: "warning_color", label: "警告色" },
  { key: "error_color", label: "错误色" },
];

const FONT_PRESETS = [
  "system-ui",
  "Arial",
  "Helvetica Neue",
  "Segoe UI",
  "Noto Sans SC",
  "Microsoft YaHei",
  "PingFang SC",
  "Source Han Sans SC",
  "Inter",
  "Roboto",
  "JetBrains Mono",
  "Fira Code",
];

export default function ThemeSettingsDialog({ open, onClose }: ThemeSettingsDialogProps) {
  const { themeConfig, updateTheme, resetTheme, defaultTheme } = useThemeConfig();
  const [draft, setDraft] = useState<ThemeConfig>(themeConfig);
  const [fontSearch, setFontSearch] = useState("");
  const [localFonts, setLocalFonts] = useState<string[]>([]);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({ ...themeConfig });
      setFontSearch("");
      setBgPreview(themeConfig.background_image ?? null);
      setShowFontPicker(false);
    }
  }, [open, themeConfig]);

  const loadLocalFonts = useCallback(async () => {
    try {
      if ("queryLocalFonts" in window) {
        const fonts = await (window as unknown as { queryLocalFonts: () => Promise<Array<{ family: string }>> }).queryLocalFonts();
        const families = [...new Set(fonts.map((f) => f.family))].sort();
        setLocalFonts(families);
      }
    } catch {
      setLocalFonts([]);
    }
  }, []);

  const filteredFonts = useMemo(() => {
    const search = fontSearch.toLowerCase().trim();
    const presets = FONT_PRESETS.filter((f) => !search || f.toLowerCase().includes(search));
    const system = localFonts.filter((f) => !FONT_PRESETS.includes(f) && (!search || f.toLowerCase().includes(search)));
    return { presets, system };
  }, [fontSearch, localFonts]);

  const handleColorChange = useCallback((key: ColorField["key"], value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFontSelect = useCallback((font: string) => {
    setDraft((prev) => ({ ...prev, font_family: font }));
    setShowFontPicker(false);
  }, []);

  const handleBgUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setBgPreview(dataUrl);
        setDraft((prev) => ({ ...prev, background_image: dataUrl }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const handleBgRemove = useCallback(() => {
    setBgPreview(null);
    setDraft((prev) => {
      const next = { ...prev };
      delete next.background_image;
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    updateTheme(draft);
    onClose();
  }, [draft, updateTheme, onClose]);

  const handleReset = useCallback(() => {
    const reset = { ...defaultTheme };
    setDraft(reset);
    setBgPreview(null);
    resetTheme();
  }, [defaultTheme, resetTheme]);

  const handleOpenFontPicker = useCallback(() => {
    if (localFonts.length === 0) {
      loadLocalFonts();
    }
    setShowFontPicker(true);
  }, [localFonts.length, loadLocalFonts]);

  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(themeConfig), [draft, themeConfig]);

  return (
    <MtgaDialog
      open={open}
      onClose={onClose}
      maxWidth="max-w-xl"
      header={
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">主题设置</h3>
            <p className="text-xs text-slate-400 mt-0.5">自定义界面外观与配色</p>
          </div>
          {hasChanges && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-full">
              未保存
            </span>
          )}
        </div>
      }
      footer={
        <>
          <button className="mtga-btn-ghost text-xs" onClick={handleReset}>
            恢复默认
          </button>
          <div className="flex-1" />
          <button className="mtga-btn-ghost text-xs" onClick={onClose}>
            取消
          </button>
          <button className="mtga-btn-primary text-xs" onClick={handleSave}>
            保存
          </button>
        </>
      }
    >
      <div className="p-6 space-y-6">
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3">配色方案</h4>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
                <div className="relative">
                  <input
                    type="color"
                    value={draft[key]}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm appearance-none [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-600">{label}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{draft[key]}</div>
                </div>
                <input
                  type="text"
                  value={draft[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-20 text-[10px] font-mono text-center bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50 focus:border-amber-400"
                  maxLength={7}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold text-slate-700 mb-3">字体</h4>
          <div className="relative">
            <button
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 transition-colors"
              onClick={handleOpenFontPicker}
            >
              <span
                className="text-sm text-slate-700 truncate"
                style={{ fontFamily: draft.font_family === "system-ui" ? undefined : draft.font_family }}
              >
                {draft.font_family}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFontPicker && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-hidden rounded-xl bg-white border border-slate-200 shadow-xl">
                <div className="p-2 border-b border-slate-100">
                  <input
                    type="text"
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    placeholder="搜索字体..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-48 p-1.5">
                  {filteredFonts.presets.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">预设</div>
                      {filteredFonts.presets.map((font) => (
                        <button
                          key={font}
                          className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                            draft.font_family === font
                              ? "bg-amber-100/80 text-amber-700 font-medium"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          style={{ fontFamily: font === "system-ui" ? undefined : font }}
                          onClick={() => handleFontSelect(font)}
                        >
                          {font}
                          {draft.font_family === font && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredFonts.system.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">系统字体</div>
                      {filteredFonts.system.map((font) => (
                        <button
                          key={font}
                          className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                            draft.font_family === font
                              ? "bg-amber-100/80 text-amber-700 font-medium"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          style={{ fontFamily: font === "system-ui" ? undefined : font }}
                          onClick={() => handleFontSelect(font)}
                        >
                          {font}
                          {draft.font_family === font && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredFonts.presets.length === 0 && filteredFonts.system.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-6">未找到匹配字体</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="text-xs text-slate-500" style={{ fontFamily: draft.font_family === "system-ui" ? undefined : draft.font_family }}>
              预览：The quick brown fox jumps over the lazy dog. 0123456789
            </div>
            <div className="text-xs text-slate-500 mt-1" style={{ fontFamily: draft.font_family === "system-ui" ? undefined : draft.font_family }}>
              中文预览：天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold text-slate-700 mb-3">背景图片</h4>
          {bgPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <div
                className="w-full h-32 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${bgPreview})` }}
              />
              <button
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                onClick={handleBgRemove}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-colors"
              onClick={handleBgUpload}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-slate-400">点击上传背景图片</span>
            </button>
          )}
          {bgPreview && (
            <button
              className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
              onClick={handleBgUpload}
            >
              更换图片
            </button>
          )}
        </div>
      </div>
    </MtgaDialog>
  );
}
