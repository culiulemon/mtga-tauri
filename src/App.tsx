import { useState, useEffect } from "react";
import AppShell from "./components/AppShell";
import LogPanel from "./components/LogPanel";
import FooterActions from "./components/FooterActions";
import ConfigGroupPanel from "./components/panels/ConfigGroupPanel";
import GlobalConfigPanel from "./components/panels/GlobalConfigPanel";
import MainTabs from "./components/tabs/MainTabs";
import SystemPromptPanel from "./components/panels/SystemPromptPanel";
import SettingsPanel from "./components/panels/SettingsPanel";
import UpdateDialog from "./components/dialogs/UpdateDialog";
import ThemeSettingsDialog from "./components/dialogs/ThemeSettingsDialog";
import { useMtgaStore } from "./hooks/useMtgaStore";
import { useMtgaApi } from "./hooks/useMtgaApi";
import { useRuntime } from "./hooks/runtime";
import { useThemeConfig } from "./hooks/themeConfig";
import { listen } from "@tauri-apps/api/event";
import type { ProxyStep } from "./types/mtgaTypes";

const navigation = [
  { id: "config-group", name: "代理配置组", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { id: "global-config", name: "全局配置", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "main-tabs", name: "主要流程", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "system-prompts", name: "系统提示词", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "settings", name: "设置", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

export default function App() {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const { initRuntime, cleanup: runtimeCleanup } = useRuntime();
  const { initTheme } = useThemeConfig();
  const [activeTab, setActiveTab] = useState("config-group");
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [updateVersionLabel, setUpdateVersionLabel] = useState("");
  const [updateNotesHtml, setUpdateNotesHtml] = useState("");
  const [updateReleaseUrl, setUpdateReleaseUrl] = useState("");
  const [hasNewVersion, setHasNewVersion] = useState(false);

  useEffect(() => {
    initTheme();
    initRuntime();
    return () => {
      runtimeCleanup();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      unlisten = await listen<ProxyStep>("mtga:proxy-step", (event) => {
        store.addProxyStep(event.payload);
      });
    };
    setup();
    return () => unlisten?.();
  }, []);

  const checkUpdates = async () => {
    try {
      const resp = await api.checkUpdates();
      if (resp.logs) store.addLogs(resp.logs);
      if (resp.ok && resp.details) {
        const details = resp.details as Record<string, unknown>;
        if (details.status === "new_version") {
          setHasNewVersion(true);
          setUpdateVersionLabel(details.latest_version as string);
          setUpdateNotesHtml(details.release_notes as string);
          setUpdateReleaseUrl(details.release_url as string);
          setUpdateDialogOpen(true);
        }
      }
    } catch (e) {
      store.addLogs([`检查更新失败: ${e}`]);
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  const openUpdateRelease = async () => {
    if (!updateReleaseUrl) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(updateReleaseUrl);
    } catch {
      window.open(updateReleaseUrl, "_blank");
    }
  };

  return (
    <div>
      <AppShell
        left={
          <div className="flex items-stretch h-full min-h-0">
            <div className="w-38 border-r border-slate-200/50 flex flex-col p-3 shrink-0">
              <ul className="menu p-0 gap-1">
                {navigation.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`flex flex-row items-center justify-start gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 group border ${
                        activeTab === item.id
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/40 shadow-sm shadow-amber-500/10"
                          : "text-slate-500 border-transparent hover:bg-slate-200/40"
                      }`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 opacity-80 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                      </svg>
                      <span className="text-sm font-bold tracking-wide truncate">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-col gap-2 px-1">
                <div className="relative w-fit">
                  <div className="text-[11px] font-medium text-slate-400">
                    {store.appInfo?.version || ""}
                  </div>
                  {hasNewVersion && (
                    <span className="mtga-badge-new -top-1.5 -right-9">NEW</span>
                  )}
                </div>
                <button
                  className="btn btn-xs btn-outline rounded-lg border-slate-200 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-600 font-bold w-full"
                  onClick={checkUpdates}
                >
                  检查更新
                </button>
                <div className="text-[10px] text-slate-400/80 text-center mt-1">powered by BiFangKNT</div>
              </div>
            </div>

            <div className="flex-1 min-w-0 p-6 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {activeTab === "config-group" && <ConfigGroupPanel />}
                {activeTab === "global-config" && <GlobalConfigPanel />}
                {activeTab === "main-tabs" && <MainTabs />}
                {activeTab === "system-prompts" && <SystemPromptPanel />}
                {activeTab === "settings" && <SettingsPanel onOpenTheme={() => setThemeDialogOpen(true)} />}
              </div>
            </div>
          </div>
        }
        right={
          <div className="h-full flex flex-col p-6">
            <LogPanel />
          </div>
        }
        footer={<FooterActions />}
      />

      <UpdateDialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        versionLabel={updateVersionLabel}
        notesHtml={updateNotesHtml}
        releaseUrl={updateReleaseUrl}
        onOpenRelease={openUpdateRelease}
      />

      <ThemeSettingsDialog
        open={themeDialogOpen}
        onClose={() => setThemeDialogOpen(false)}
      />
    </div>
  );
}
