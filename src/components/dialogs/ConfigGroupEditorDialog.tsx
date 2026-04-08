import { useState, useEffect, useCallback } from "react";
import MtgaDialog from "@/components/ui/MtgaDialog";
import MtgaInput from "@/components/ui/MtgaInput";
import MtgaSelect from "@/components/ui/MtgaSelect";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import type { ConfigGroup, ProxyProvider } from "@/types/mtgaTypes";

interface ConfigGroupEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (group: ConfigGroup) => void;
  mode: "add" | "edit";
  initialData?: ConfigGroup;
  existingNames?: string[];
}

const PROVIDER_OPTIONS = [
  { label: "OpenAI Chat Completion", value: "openai_chat_completion" },
  { label: "OpenAI Response", value: "openai_response" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Gemini", value: "gemini" },
];

const DEFAULT_MIDDLE_ROUTES: Record<string, string> = {
  openai_chat_completion: "/v1",
  openai_response: "/v1",
  anthropic: "/v1",
  gemini: "/v1beta",
};

function getModelPlaceholder(provider: ProxyProvider): string {
  if (provider === "anthropic") return "例如：claude-sonnet-4-20250514";
  if (provider === "gemini") return "例如：gemini-2.5-pro";
  return "例如：gpt-4o";
}

function getDefaultApiUrl(provider: ProxyProvider): string {
  if (provider === "anthropic") return "https://api.anthropic.com";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com";
  return "https://api.openai.com";
}

export default function ConfigGroupEditorDialog({
  open,
  onClose,
  onSave,
  mode,
  initialData,
  existingNames = [],
}: ConfigGroupEditorDialogProps) {
  const api = useMtgaApi();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ProxyProvider>("openai_chat_completion");
  const [apiUrl, setApiUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [middleRoute, setMiddleRoute] = useState("");
  const [middleRouteEnabled, setMiddleRouteEnabled] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name ?? "");
        setProvider((initialData.provider as ProxyProvider) ?? "openai_chat_completion");
        setApiUrl(initialData.api_url ?? "");
        setModelId(initialData.model_id ?? "");
        setApiKey(initialData.api_key ?? "");
        setMiddleRoute(initialData.middle_route ?? "");
        setMiddleRouteEnabled(initialData.middle_route_enabled ?? false);
      } else {
        setName("");
        setProvider("openai_chat_completion");
        setApiUrl("https://api.openai.com");
        setModelId("");
        setApiKey("");
        setMiddleRoute("");
        setMiddleRouteEnabled(false);
      }
      setFormError("");
      setAvailableModels([]);
      setSaving(false);
    }
  }, [open, initialData]);

  const handleProviderChange = useCallback(
    (val: string | number) => {
      const newProvider = String(val) as ProxyProvider;
      setProvider(newProvider);
      if (!initialData || mode === "add") {
        setApiUrl(getDefaultApiUrl(newProvider));
        setModelId("");
      }
      setAvailableModels([]);
    },
    [initialData, mode],
  );

  const fetchModels = useCallback(async () => {
    if (modelLoading || !apiUrl) return;
    setModelLoading(true);
    try {
      const res = await api.configGroupModels({
        provider,
        apiUrl,
        apiKey,
        middleRoute: middleRouteEnabled ? middleRoute : "",
      });
      if (res.ok) {
        const details = res.details as Record<string, unknown> | undefined;
        const models = (details?.models ?? []) as string[];
        if (models) setAvailableModels(models);
      }
    } catch {
      /* ignore */
    } finally {
      setModelLoading(false);
    }
  }, [api, provider, apiUrl, apiKey, middleRoute, middleRouteEnabled, modelLoading]);

  const handleSave = useCallback(() => {
    setFormError("");
    if (!name.trim()) {
      setFormError("请输入配置组名称");
      return;
    }
    if (mode === "add" && existingNames.includes(name.trim())) {
      setFormError("配置组名称已存在");
      return;
    }
    if (!apiUrl.trim()) {
      setFormError("请输入 API URL");
      return;
    }
    if (!modelId.trim()) {
      setFormError("请输入实际模型 ID");
      return;
    }
    if (!apiKey.trim()) {
      setFormError("请输入 API Key");
      return;
    }

    setSaving(true);
    const group: ConfigGroup = {
      name: name.trim(),
      provider,
      api_url: apiUrl.trim(),
      model_id: modelId.trim(),
      api_key: apiKey.trim(),
      middle_route: middleRouteEnabled ? middleRoute.trim() : "",
      middle_route_enabled: middleRouteEnabled,
      target_model_id: "",
      model_discovery_strategy: availableModels.length > 0 ? "api_list" : "",
    };
    onSave(group);
    setSaving(false);
  }, [
    name,
    provider,
    apiUrl,
    modelId,
    apiKey,
    middleRoute,
    middleRouteEnabled,
    availableModels,
    formError,
    mode,
    existingNames,
    onSave,
  ]);

  const defaultMiddleRoute = DEFAULT_MIDDLE_ROUTES[provider] ?? "/v1";

  return (
    <MtgaDialog open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === "add" ? "新增配置组" : "修改配置组"}
          </h3>
          <p className="text-xs text-slate-500">配置代理目标与鉴权参数</p>
        </div>
        <span className="mtga-chip">配置编辑</span>
      </div>

      <div className="px-6 py-6 space-y-5">
        <MtgaInput
          value={name}
          onChange={setName}
          label="配置组名称"
          placeholder="例如：我的常用配置"
        />

        <MtgaSelect
          value={provider}
          onChange={handleProviderChange}
          label="提供商"
          options={PROVIDER_OPTIONS}
        />

        <MtgaInput
          value={apiUrl}
          onChange={setApiUrl}
          label="API URL"
          required
          placeholder="https://api.openai.com"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-xs"
                checked={middleRouteEnabled}
                onChange={(e) => setMiddleRouteEnabled(e.target.checked)}
              />
              <span className="label-text text-xs font-medium text-slate-500">修改中间路由</span>
            </label>
            {middleRouteEnabled && (
              <span className="text-[10px] text-slate-400">通常为 {defaultMiddleRoute}</span>
            )}
          </div>
          {middleRouteEnabled && (
            <MtgaInput
              value={middleRoute}
              onChange={setMiddleRoute}
              placeholder={defaultMiddleRoute}
              size="sm"
            />
          )}
        </div>

        <MtgaInput
          value={modelId}
          onChange={setModelId}
          label="实际模型ID"
          required
          showDropdown
          loading={modelLoading}
          options={availableModels}
          placeholder={getModelPlaceholder(provider)}
          onDropdown={fetchModels}
        />

        <MtgaInput
          value={apiKey}
          onChange={setApiKey}
          label="API Key"
          required
          type="password"
          placeholder="sk-..."
        />

        {formError && (
          <div className="alert alert-error py-2 px-3 rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs">{formError}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button className="mtga-btn-dialog-ghost flex-1" onClick={onClose}>
          取消
        </button>
        <button
          className={`mtga-btn-dialog-primary flex-1 ${saving ? "loading" : ""}`}
          disabled={saving}
          onClick={handleSave}
        >
          保存
        </button>
      </div>
    </MtgaDialog>
  );
}
