export function useSystemPromptUi() {
  const getProviderLabel = (provider: string) => {
    const map: Record<string, string> = {
      openai_chat_completion: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini",
    };
    return map[provider] || provider;
  };

  const getModelLabel = (modelId: string) => {
    if (modelId.length > 30) return modelId.substring(0, 30) + "...";
    return modelId;
  };

  const getHashDisplay = (hash: string) => {
    return hash.substring(0, 8) + "...";
  };

  const getTextPreview = (text: string, maxLen = 60) => {
    if (!text) return "（空）";
    const single = text.replace(/\n/g, " ");
    if (single.length <= maxLen) return single;
    return single.substring(0, maxLen) + "...";
  };

  const getTimeDisplay = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return { getProviderLabel, getModelLabel, getHashDisplay, getTextPreview, getTimeDisplay };
}
