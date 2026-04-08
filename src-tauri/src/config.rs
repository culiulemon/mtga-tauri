use crate::error::InvokeResponse;
use crate::error::OperationResult;
use crate::log_bus::LogBus;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGroup {
    pub name: String,
    pub provider: String,
    pub api_url: String,
    pub model_id: String,
    pub api_key: String,
    #[serde(default)]
    pub middle_route: String,
    #[serde(default)]
    pub middle_route_enabled: bool,
    #[serde(default)]
    pub target_model_id: String,
    #[serde(default)]
    pub model_discovery_strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalConfig {
    #[serde(default)]
    pub mapped_model_id: String,
    #[serde(default)]
    pub mtga_auth_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub config_groups: Vec<ConfigGroup>,
    #[serde(default)]
    pub global_config: GlobalConfig,
    #[serde(default)]
    pub warnings: Vec<String>,
}

pub struct LogCollector {
    logs: Vec<String>,
    log_bus: Option<LogBus>,
}

impl LogCollector {
    pub fn new(log_bus: Option<LogBus>) -> Self {
        Self {
            logs: Vec::new(),
            log_bus,
        }
    }

    pub fn log(&mut self, msg: impl Into<String>) {
        let text = msg.into();
        self.logs.push(text.clone());
        if let Some(ref bus) = self.log_bus {
            bus.push(text);
        }
    }

    pub fn into_response(self, result: OperationResult, default_msg: &str) -> InvokeResponse {
        InvokeResponse::from_result(result, self.logs, default_msg)
    }

    pub fn logs(&self) -> &[String] {
        &self.logs
    }
}

pub fn load_yaml_config(path: &str) -> Result<AppConfig, String> {
    let content = std::fs::read_to_string(path).map_err(|e| format!("读取配置文件失败: {}", e))?;
    let config: AppConfig =
        serde_yaml::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;
    Ok(config)
}

pub fn save_yaml_config(path: &str, config: &AppConfig) -> Result<(), String> {
    let content = serde_yaml::to_string(config).map_err(|e| format!("序列化配置失败: {}", e))?;
    std::fs::write(path, content).map_err(|e| format!("写入配置文件失败: {}", e))?;
    Ok(())
}
