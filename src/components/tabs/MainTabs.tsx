import CertTab from "./CertTab";
import HostsTab from "./HostsTab";
import ProxyTab from "./ProxyTab";
import { useState } from "react";

const tabs = [
  { id: "cert", name: "证书管理" },
  { id: "hosts", name: "Hosts" },
  { id: "proxy", name: "代理" },
];

export default function MainTabs() {
  const [activeTab, setActiveTab] = useState("proxy");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="mtga-card-title">主要流程</h2>
          <p className="mtga-card-subtitle">证书、Hosts 与代理服务器</p>
        </div>
      </div>
      <div role="tablist" className="tabs tabs-bordered">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            className={`tab ${activeTab === tab.id ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div>
        {activeTab === "cert" && <CertTab />}
        {activeTab === "hosts" && <HostsTab />}
        {activeTab === "proxy" && <ProxyTab />}
      </div>
    </div>
  );
}
