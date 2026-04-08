use crate::resource_manager::SharedResourceManager;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemPromptItem {
    pub hash: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub source: String,
}

pub struct SystemPromptStore {
    resources: SharedResourceManager,
}

impl SystemPromptStore {
    pub fn new(resources: SharedResourceManager) -> Self {
        Self { resources }
    }

    pub fn list_items(&self) -> Result<Vec<SystemPromptItem>, String> {
        let path = self.resources.system_prompts_file();
        if !std::path::Path::new(&path).exists() {
            return Ok(Vec::new());
        }
        let content =
            std::fs::read_to_string(&path).map_err(|e| format!("读取系统提示词文件失败: {}", e))?;
        let data: HashMap<String, SystemPromptItem> =
            serde_yaml::from_str(&content).unwrap_or_default();
        Ok(data.into_values().collect())
    }

    pub fn update_prompt_delta(&self, hash_value: &str, edited_text: &str) -> Result<(), String> {
        let path = self.resources.system_prompts_file();
        let mut data: HashMap<String, SystemPromptItem> = if std::path::Path::new(&path).exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            serde_yaml::from_str(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        if let Some(item) = data.get_mut(hash_value) {
            item.content = edited_text.to_string();
            item.updated_at = chrono::Utc::now().to_rfc3339();
        } else {
            let item = SystemPromptItem {
                hash: hash_value.to_string(),
                content: edited_text.to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                updated_at: chrono::Utc::now().to_rfc3339(),
                source: "manual".to_string(),
            };
            data.insert(hash_value.to_string(), item);
        }

        let yaml =
            serde_yaml::to_string(&data).map_err(|e| format!("序列化系统提示词失败: {}", e))?;
        std::fs::write(&path, yaml).map_err(|e| format!("写入系统提示词文件失败: {}", e))?;
        Ok(())
    }

    pub fn delete_items(&self, hashes: &[String]) -> Result<usize, String> {
        let path = self.resources.system_prompts_file();
        let mut data: HashMap<String, SystemPromptItem> = if std::path::Path::new(&path).exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            serde_yaml::from_str(&content).unwrap_or_default()
        } else {
            return Ok(0);
        };

        let mut deleted_count = 0;
        for hash in hashes {
            if data.remove(hash).is_some() {
                deleted_count += 1;
            }
        }

        let yaml =
            serde_yaml::to_string(&data).map_err(|e| format!("序列化系统提示词失败: {}", e))?;
        std::fs::write(&path, yaml).map_err(|e| format!("写入系统提示词文件失败: {}", e))?;
        Ok(deleted_count)
    }
}
