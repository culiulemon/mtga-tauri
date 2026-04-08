use parking_lot::Mutex;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct ResourceManager {
    user_data_dir: String,
    ca_dir: String,
    certs_dir: String,
    config_file: String,
    hosts_backup_file: String,
    logs_dir: String,
    system_prompts_file: String,
}

impl ResourceManager {
    pub fn new() -> Self {
        let user_data_dir = dirs::data_dir()
            .unwrap_or_default()
            .join("mtga")
            .to_string_lossy()
            .to_string();

        std::fs::create_dir_all(&user_data_dir).ok();

        let ca_dir = format!("{}/ca", user_data_dir);
        let certs_dir = format!("{}/certs", user_data_dir);
        let logs_dir = format!("{}/logs", user_data_dir);
        let config_file = format!("{}/config.yaml", user_data_dir);
        let hosts_backup_file = format!("{}/hosts_backup", user_data_dir);
        let system_prompts_file = format!("{}/system_prompts.yaml", user_data_dir);

        std::fs::create_dir_all(&ca_dir).ok();
        std::fs::create_dir_all(&certs_dir).ok();
        std::fs::create_dir_all(&logs_dir).ok();

        Self {
            user_data_dir,
            ca_dir,
            certs_dir,
            config_file,
            hosts_backup_file,
            logs_dir,
            system_prompts_file,
        }
    }

    pub fn user_data_dir(&self) -> &str {
        &self.user_data_dir
    }

    pub fn ca_dir(&self) -> &str {
        &self.ca_dir
    }

    pub fn certs_dir(&self) -> &str {
        &self.certs_dir
    }

    pub fn config_file(&self) -> &str {
        &self.config_file
    }

    pub fn hosts_backup_file(&self) -> &str {
        &self.hosts_backup_file
    }

    pub fn logs_dir(&self) -> &str {
        &self.logs_dir
    }

    pub fn system_prompts_file(&self) -> &str {
        &self.system_prompts_file
    }

    pub fn get_ca_key_path(&self) -> String {
        format!("{}/ca.key", self.ca_dir)
    }

    pub fn get_ca_cert_path(&self) -> String {
        format!("{}/ca.crt", self.ca_dir)
    }

    pub fn get_server_key_path(&self, domain: &str) -> String {
        format!("{}/{}.key", self.certs_dir, domain)
    }

    pub fn get_server_cert_path(&self, domain: &str) -> String {
        format!("{}/{}.crt", self.certs_dir, domain)
    }

    pub fn get_ca_metadata_path(&self) -> String {
        format!("{}/ca_metadata.json", self.ca_dir)
    }

    pub fn get_log_path(&self, filename: &str) -> String {
        format!("{}/{}", self.logs_dir, filename)
    }

    pub fn backup_dir(&self) -> String {
        format!("{}/backups", self.user_data_dir)
    }
}

#[derive(Clone)]
pub struct SharedResourceManager(Arc<ResourceManager>);

impl SharedResourceManager {
    pub fn new() -> Self {
        Self(Arc::new(ResourceManager::new()))
    }
}

impl std::ops::Deref for SharedResourceManager {
    type Target = ResourceManager;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub type AppResources = Arc<Mutex<Option<SharedResourceManager>>>;
