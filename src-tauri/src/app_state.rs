use crate::log_bus::LogBus;
use crate::resource_manager::SharedResourceManager;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RuntimeOptions {
    pub debug_mode: bool,
    pub disable_ssl_strict: bool,
    pub force_stream: bool,
    pub stream_mode: String,
}

impl Default for RuntimeOptions {
    fn default() -> Self {
        Self {
            debug_mode: false,
            disable_ssl_strict: false,
            force_stream: false,
            stream_mode: "true".to_string(),
        }
    }
}

pub struct AppState {
    pub log_bus: parking_lot::Mutex<Option<LogBus>>,
    pub resources: parking_lot::Mutex<Option<SharedResourceManager>>,
    pub runtime_options: parking_lot::Mutex<RuntimeOptions>,
    pub proxy_handle: parking_lot::Mutex<Option<crate::proxy::ProxyServerHandle>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            log_bus: parking_lot::Mutex::new(None),
            resources: parking_lot::Mutex::new(None),
            runtime_options: parking_lot::Mutex::new(RuntimeOptions::default()),
            proxy_handle: parking_lot::Mutex::new(None),
        }
    }
}

impl AppState {
    pub fn ensure_resources(&self) -> SharedResourceManager {
        let mut res = self.resources.lock();
        if res.is_none() {
            *res = Some(SharedResourceManager::new());
        }
        res.clone().unwrap()
    }

    pub fn ensure_log_bus(&self) -> LogBus {
        let mut bus = self.log_bus.lock();
        if bus.is_none() {
            *bus = Some(LogBus::new());
        }
        bus.clone().unwrap()
    }

    pub fn get_runtime_options(&self) -> RuntimeOptions {
        self.runtime_options.lock().clone()
    }

    pub fn set_runtime_options(&self, opts: RuntimeOptions) {
        *self.runtime_options.lock() = opts;
    }
}
