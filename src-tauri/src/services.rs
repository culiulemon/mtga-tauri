use crate::app_state::AppState;
use crate::cert::CertManager;
use crate::config::{AppConfig, LogCollector};
use crate::error::InvokeResponse;
use crate::error::OperationResult;

fn append_models_path(api_url: &str, version_prefix: &str) -> String {
    let url = api_url.trim_end_matches('/');
    let has_version = url.ends_with("/v1")
        || url.ends_with("/v2")
        || url.ends_with("/v3")
        || url.ends_with("/v4");
    if has_version {
        format!("{}/models", url)
    } else {
        format!("{}{}/models", url, version_prefix)
    }
}
use crate::hosts;
use crate::proxy::{self, ProxyConfig, ProxyStep};
use crate::system_prompt::SystemPromptStore;
use crate::update;
use crate::user_data;
use serde_json::{Value, json};
use tauri::Emitter;

pub struct Services;

impl Services {
    pub fn generate_certificates(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let cert_mgr = CertManager::new(resources);
        match cert_mgr.generate_all(&mut |msg| collector.log(msg)) {
            Ok(_) => collector.into_response(
                OperationResult::success_with_details(json!({"certs_generated": true})),
                "证书生成成功",
            ),
            Err(e) => collector.into_response(OperationResult::failure(&e), "证书生成失败"),
        }
    }

    pub fn install_ca_cert(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let cert_mgr = CertManager::new(resources);
        match cert_mgr.install_ca_cert(&mut |msg| collector.log(msg)) {
            Ok(_) => collector.into_response(OperationResult::success(), "CA 证书安装成功"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "CA 证书安装失败"),
        }
    }

    pub fn clear_ca_cert(state: &AppState, common_name: &str) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let cert_mgr = CertManager::new(resources);
        match cert_mgr.clear_ca_cert(common_name, &mut |msg| collector.log(msg)) {
            Ok(_) => collector.into_response(OperationResult::success(), "CA 证书清除完成"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "CA 证书清除失败"),
        }
    }

    pub fn hosts_modify(
        state: &AppState,
        mode: &str,
        domain: Option<&str>,
        ip: Option<&Value>,
    ) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let result = match mode {
            "add" => {
                if let Some(d) = domain {
                    let mut log = |msg: &str| collector.log(msg);
                    hosts::add_hosts_entry(d, ip, &mut log).map(|_| OperationResult::success())
                } else {
                    Err("缺少 domain 参数".to_string())
                }
            }
            "remove" => {
                if let Some(d) = domain {
                    let mut log = |msg: &str| collector.log(msg);
                    hosts::remove_hosts_entry(d, &mut log).map(|_| OperationResult::success())
                } else {
                    Err("缺少 domain 参数".to_string())
                }
            }
            "backup" => {
                let mut log = |msg: &str| collector.log(msg);
                hosts::backup_hosts_file(&resources, &mut log).map(|_| OperationResult::success())
            }
            "restore" => {
                let mut log = |msg: &str| collector.log(msg);
                hosts::restore_hosts_file(&resources, &mut log).map(|_| OperationResult::success())
            }
            _ => Err(format!("未知模式: {}", mode)),
        };

        match result {
            Ok(op) => collector.into_response(op, "hosts 操作成功"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "hosts 操作失败"),
        }
    }

    pub fn hosts_open(state: &AppState) -> InvokeResponse {
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));
        let mut log = |msg: &str| collector.log(msg);
        match hosts::open_hosts_file(&mut log) {
            Ok(_) => collector.into_response(OperationResult::success(), "已打开 hosts 文件"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "打开 hosts 文件失败"),
        }
    }

    pub async fn proxy_start(
        state: &AppState,
        app_handle: tauri::AppHandle,
        config_groups: &[crate::config::ConfigGroup],
        global_config: &crate::config::GlobalConfig,
        runtime_opts: &crate::app_state::RuntimeOptions,
    ) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus.clone()));

        if config_groups.is_empty() {
            collector.log("没有可用的配置组");
            return collector.into_response(
                OperationResult::failure_with_code("没有可用的配置组", "config_group_missing"),
                "启动失败",
            );
        }

        if global_config.mapped_model_id.is_empty() {
            collector.log("全局配置缺失：请设置映射模型 ID");
            return collector.into_response(
                OperationResult::failure_with_code("全局配置缺失", "global_config_missing"),
                "启动失败",
            );
        }

        let group = &config_groups[0];
        let target_model = if !group.target_model_id.is_empty() {
            group.target_model_id.clone()
        } else {
            group.model_id.clone()
        };

        let domain = match group.provider.as_str() {
            "anthropic" => "api.anthropic.com",
            "gemini" => "generativelanguage.googleapis.com",
            _ => "api.openai.com",
        };

        let cert_path = resources.get_server_cert_path(domain);
        let key_path = resources.get_server_key_path(domain);

        if !std::path::Path::new(&cert_path).exists() || !std::path::Path::new(&key_path).exists() {
            collector.log(&format!("证书文件不存在: {}", domain));
            return collector.into_response(
                OperationResult::failure("证书文件不存在，请先生成证书"),
                "启动失败",
            );
        }

        let upstream_route = if group.middle_route_enabled && !group.middle_route.is_empty() {
            let route = group.middle_route.trim_start_matches('/');
            let route_with_slash = format!("/{}", route);
            if group
                .api_url
                .trim_end_matches('/')
                .ends_with(&route_with_slash)
            {
                String::new()
            } else {
                route_with_slash
            }
        } else {
            match group.provider.as_str() {
                "anthropic" => "/v1".to_string(),
                "gemini" => "/v1beta".to_string(),
                _ => "/v1".to_string(),
            }
        };

        let proxy_config = ProxyConfig {
            inbound_route: "/v1".to_string(),
            upstream_route,
            provider: group.provider.clone(),
            api_url: group.api_url.clone(),
            api_key: group.api_key.clone(),
            target_model_id: target_model,
            mapped_model_id: global_config.mapped_model_id.clone(),
            mtga_auth_key: global_config.mtga_auth_key.clone(),
            disable_ssl_strict: runtime_opts.disable_ssl_strict,
            force_stream: runtime_opts.force_stream,
            stream_mode: runtime_opts.stream_mode.clone(),
        };

        let (step_tx, mut step_rx) = tokio::sync::mpsc::unbounded_channel::<ProxyStep>();

        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            while let Some(step) = step_rx.recv().await {
                let _ = app_handle_clone.emit("mtga:proxy-step", &step);
            }
        });

        match proxy::start_proxy_server(proxy_config, step_tx, cert_path, key_path, 443).await {
            Ok(handle) => {
                *state.proxy_handle.lock() = Some(handle);
                collector.log("代理服务器已启动");
                collector.into_response(
                    OperationResult::success_with_details(json!({"status": "started"})),
                    "代理服务器启动成功",
                )
            }
            Err(e) => collector.into_response(OperationResult::failure(&e), "代理服务器启动失败"),
        }
    }

    pub async fn proxy_stop(state: &AppState) -> InvokeResponse {
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let handle = state.proxy_handle.lock().clone();
        if let Some(handle) = handle {
            handle.stop().await;
            *state.proxy_handle.lock() = None;
            collector.log("代理服务器已停止");
            collector.into_response(OperationResult::success(), "代理服务器已停止")
        } else {
            collector.log("代理服务器未运行");
            collector.into_response(OperationResult::success(), "代理服务器未运行")
        }
    }

    pub async fn proxy_start_all(
        state: &AppState,
        app_handle: tauri::AppHandle,
        config_groups: &[crate::config::ConfigGroup],
        global_config: &crate::config::GlobalConfig,
        runtime_opts: &crate::app_state::RuntimeOptions,
    ) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus.clone()));

        collector.log("=== 开始一键启动全部服务 ===");

        let cert_mgr = CertManager::new(resources.clone());
        match cert_mgr.generate_all(&mut |msg| collector.log(msg)) {
            Ok(_) => {
                let _ = app_handle.emit(
                    "mtga:proxy-step",
                    ProxyStep {
                        step: "cert".to_string(),
                        message: "证书生成成功".to_string(),
                        done: false,
                    },
                );
            }
            Err(e) => {
                collector.log(&format!("证书生成失败: {}", e));
                let _ = app_handle.emit(
                    "mtga:proxy-step",
                    ProxyStep {
                        step: "cert".to_string(),
                        message: format!("证书生成失败: {}", e),
                        done: false,
                    },
                );
            }
        }

        match cert_mgr.install_ca_cert(&mut |msg| collector.log(msg)) {
            Ok(_) => {
                let _ = app_handle.emit(
                    "mtga:proxy-step",
                    ProxyStep {
                        step: "cert".to_string(),
                        message: "CA 证书安装成功".to_string(),
                        done: false,
                    },
                );
            }
            Err(e) => {
                collector.log(&format!("CA 证书安装失败: {}", e));
                let _ = app_handle.emit(
                    "mtga:proxy-step",
                    ProxyStep {
                        step: "cert".to_string(),
                        message: format!("CA 证书安装失败: {}", e),
                        done: false,
                    },
                );
            }
        }

        let domains = [
            "api.openai.com",
            "api.anthropic.com",
            "generativelanguage.googleapis.com",
        ];
        for domain in &domains {
            let mut log = |msg: &str| collector.log(msg);
            match hosts::add_hosts_entry(domain, None, &mut log) {
                Ok(_) => collector.log(&format!("hosts 条目已添加: {}", domain)),
                Err(e) => collector.log(&format!("hosts 条目添加失败 {}: {}", domain, e)),
            }
        }
        let _ = app_handle.emit(
            "mtga:proxy-step",
            ProxyStep {
                step: "hosts".to_string(),
                message: "hosts 文件修改完成".to_string(),
                done: false,
            },
        );

        if config_groups.is_empty() {
            collector.log("没有可用的配置组，跳过代理启动");
            return collector.into_response(
                OperationResult::failure_with_code("没有可用的配置组", "config_group_missing"),
                "一键启动完成（代理未启动）",
            );
        }

        if global_config.mapped_model_id.is_empty() {
            collector.log("全局配置缺失，跳过代理启动");
            return collector.into_response(
                OperationResult::failure_with_code("全局配置缺失", "global_config_missing"),
                "一键启动完成（代理未启动）",
            );
        }

        let _ = app_handle.emit(
            "mtga:proxy-step",
            ProxyStep {
                step: "proxy".to_string(),
                message: "正在启动代理服务器...".to_string(),
                done: false,
            },
        );

        let proxy_result = Self::proxy_start(
            state,
            app_handle.clone(),
            config_groups,
            global_config,
            runtime_opts,
        )
        .await;
        if proxy_result.ok {
            let _ = app_handle.emit(
                "mtga:proxy-step",
                ProxyStep {
                    step: "proxy".to_string(),
                    message: "代理服务器启动成功".to_string(),
                    done: false,
                },
            );
        }

        collector.log("=== 一键启动全部服务完成 ===");
        proxy_result
    }

    pub async fn config_group_test(
        state: &AppState,
        index: usize,
        config_groups: &[crate::config::ConfigGroup],
        _global_config: &crate::config::GlobalConfig,
    ) -> InvokeResponse {
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        if index >= config_groups.len() {
            return collector
                .into_response(OperationResult::failure("配置组索引超出范围"), "测活失败");
        }

        let group = &config_groups[index];
        let api_url = group.api_url.trim_end_matches('/');

        let version_prefix: &str = if group.middle_route_enabled && !group.middle_route.is_empty() {
            &group.middle_route
        } else {
            match group.provider.as_str() {
                "anthropic" => "/v1",
                "gemini" => "/v1beta",
                _ => "/v1",
            }
        };

        let upstream_url = match group.provider.as_str() {
            "anthropic" => format!("{}{}/messages", api_url, version_prefix),
            "gemini" => {
                let model = if !group.target_model_id.is_empty() {
                    &group.target_model_id
                } else {
                    &group.model_id
                };
                format!(
                    "{}{}/models/{}:generateContent?key={}",
                    api_url, version_prefix, model, group.api_key
                )
            }
            _ => append_models_path(api_url, version_prefix),
        };

        collector.log(&format!("正在测试配置组 [{}] {} ...", index, group.name));

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build();

        let client = match client {
            Ok(c) => c,
            Err(e) => {
                return collector.into_response(
                    OperationResult::failure(&format!("创建 HTTP 客户端失败: {}", e)),
                    "测活失败",
                );
            }
        };

        let result = match group.provider.as_str() {
            "anthropic" => {
                let resp = client
                    .post(&upstream_url)
                    .header("x-api-key", &group.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&json!({"model": if !group.target_model_id.is_empty() { &group.target_model_id } else { &group.model_id }, "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}))
                    .send()
                    .await;
                match resp {
                    Ok(r) => {
                        let status = r.status().as_u16();
                        if status >= 200 && status < 500 {
                            collector.log(&format!("连接成功 (HTTP {})", status));
                            OperationResult::success_with_details(
                                json!({"status": status, "reachable": true}),
                            )
                        } else {
                            collector.log(&format!("连接失败 (HTTP {})", status));
                            OperationResult::failure(&format!("HTTP {}", status))
                        }
                    }
                    Err(e) => {
                        collector.log(&format!("连接失败: {}", e));
                        OperationResult::failure(&e.to_string())
                    }
                }
            }
            "gemini" => {
                let resp = client.get(&upstream_url).send().await;
                match resp {
                    Ok(r) => {
                        let status = r.status().as_u16();
                        if status >= 200 && status < 500 {
                            collector.log(&format!("连接成功 (HTTP {})", status));
                            OperationResult::success_with_details(
                                json!({"status": status, "reachable": true}),
                            )
                        } else {
                            collector.log(&format!("连接失败 (HTTP {})", status));
                            OperationResult::failure(&format!("HTTP {}", status))
                        }
                    }
                    Err(e) => {
                        collector.log(&format!("连接失败: {}", e));
                        OperationResult::failure(&e.to_string())
                    }
                }
            }
            _ => {
                let resp = client
                    .get(&upstream_url)
                    .header("Authorization", format!("Bearer {}", group.api_key))
                    .send()
                    .await;
                match resp {
                    Ok(r) => {
                        let status = r.status().as_u16();
                        if status >= 200 && status < 500 {
                            collector.log(&format!("连接成功 (HTTP {})", status));
                            OperationResult::success_with_details(
                                json!({"status": status, "reachable": true}),
                            )
                        } else {
                            collector.log(&format!("连接失败 (HTTP {})", status));
                            OperationResult::failure(&format!("HTTP {}", status))
                        }
                    }
                    Err(e) => {
                        collector.log(&format!("连接失败: {}", e));
                        OperationResult::failure(&e.to_string())
                    }
                }
            }
        };

        collector.into_response(result, "测活完成")
    }

    pub async fn config_group_models(
        state: &AppState,
        provider: &str,
        api_url: &str,
        api_key: &str,
        middle_route: &str,
    ) -> InvokeResponse {
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let api_url = api_url.trim_end_matches('/');

        let version_prefix: &str = if !middle_route.is_empty() {
            middle_route
        } else {
            match provider {
                "anthropic" => "/v1",
                "gemini" => "/v1beta",
                _ => "/v1",
            }
        };

        let upstream_url = match provider {
            "anthropic" => format!("{}{}/messages", api_url, version_prefix),
            "gemini" => format!("{}{}/models?key={}", api_url, version_prefix, api_key),
            _ => append_models_path(api_url, version_prefix),
        };

        collector.log(&format!("正在获取模型列表: {} ...", provider));

        let client = match reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                return collector.into_response(
                    OperationResult::failure(&format!("创建客户端失败: {}", e)),
                    "获取模型列表失败",
                );
            }
        };

        let resp = match provider {
            "anthropic" => {
                client
                    .get("https://docs.anthropic.com/en/docs/about-clients/models")
                    .send()
                    .await
            }
            _ => {
                client
                    .get(&upstream_url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .send()
                    .await
            }
        };

        match resp {
            Ok(r) => match r.json::<Value>().await {
                Ok(body) => {
                    let models: Vec<String> = match provider {
                        "anthropic" => {
                            vec![
                                "claude-sonnet-4-20250514".to_string(),
                                "claude-3-5-haiku-20241022".to_string(),
                            ]
                        }
                        "gemini" => {
                            let mut list = Vec::new();
                            if let Some(models_arr) = body.get("models").and_then(|m| m.as_array())
                            {
                                for m in models_arr {
                                    if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                                        if let Some(display) =
                                            m.get("displayName").and_then(|d| d.as_str())
                                        {
                                            list.push(format!("{} ({})", display, name));
                                        } else {
                                            list.push(name.to_string());
                                        }
                                    }
                                }
                            }
                            list
                        }
                        _ => {
                            let mut list = Vec::new();
                            if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
                                for m in data {
                                    if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                                        list.push(id.to_string());
                                    }
                                }
                            }
                            list
                        }
                    };

                    collector.log(&format!("获取到 {} 个模型", models.len()));
                    collector.into_response(
                        OperationResult::success_with_details(json!({
                            "models": models,
                            "strategy_id": "api_list",
                        })),
                        "获取模型列表成功",
                    )
                }
                Err(e) => collector.into_response(
                    OperationResult::failure(&format!("解析响应失败: {}", e)),
                    "获取模型列表失败",
                ),
            },
            Err(e) => collector.into_response(
                OperationResult::failure(&format!("请求失败: {}", e)),
                "获取模型列表失败",
            ),
        }
    }

    pub fn system_prompts_list(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        let store = SystemPromptStore::new(resources);
        match store.list_items() {
            Ok(items) => collector.into_response(
                OperationResult::success_with_details(json!({ "items": items })),
                "系统提示词加载成功",
            ),
            Err(e) => collector.into_response(OperationResult::failure(&e), "系统提示词加载失败"),
        }
    }

    pub fn system_prompts_update(
        state: &AppState,
        hash: &str,
        edited_text: &str,
    ) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        let store = SystemPromptStore::new(resources);
        match store.update_prompt_delta(hash, edited_text) {
            Ok(_) => collector.into_response(OperationResult::success(), "系统提示词更新成功"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "系统提示词更新失败"),
        }
    }

    pub fn system_prompts_delete(state: &AppState, hashes: &[String]) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        let store = SystemPromptStore::new(resources);
        match store.delete_items(hashes) {
            Ok(count) => collector.into_response(
                OperationResult::success_with_details(json!({ "deleted_count": count })),
                &format!("已删除 {} 条系统提示词", count),
            ),
            Err(e) => collector.into_response(OperationResult::failure(&e), "系统提示词删除失败"),
        }
    }

    pub async fn check_updates(state: &AppState) -> InvokeResponse {
        let log_bus = state.ensure_log_bus();
        let mut collector = LogCollector::new(Some(log_bus));

        let current_version = env!("CARGO_PKG_VERSION");
        collector.log(&format!("当前版本: v{}", current_version));

        match update::check_for_updates("BiFangKNT/mtga-tauri", current_version).await {
            Ok(Some(info)) => {
                collector.log(&format!("发现新版本: {}", info.version));
                collector.into_response(
                    OperationResult::success_with_details(json!({
                        "status": "new_version",
                        "latest_version": info.version,
                        "release_notes": info.notes_html,
                        "release_url": info.release_url,
                    })),
                    "发现新版本",
                )
            }
            Ok(None) => {
                collector.log("已是最新版本");
                collector.into_response(
                    OperationResult::success_with_details(json!({
                        "status": "up_to_date",
                        "latest_version": format!("v{}", current_version),
                    })),
                    "已是最新版本",
                )
            }
            Err(e) => collector.into_response(OperationResult::failure(&e), "检查更新失败"),
        }
    }

    pub fn user_data_open_dir(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        match user_data::open_user_data_dir(&resources) {
            Ok(_) => collector.into_response(OperationResult::success(), "已打开用户数据目录"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "打开用户数据目录失败"),
        }
    }

    pub fn user_data_backup(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        match user_data::backup_user_data(&resources) {
            Ok(path) => collector.into_response(
                OperationResult::success_with_details(json!({ "backup_path": path })),
                "用户数据备份成功",
            ),
            Err(e) => collector.into_response(OperationResult::failure(&e), "用户数据备份失败"),
        }
    }

    pub fn user_data_restore_latest(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        match user_data::restore_latest_backup(&resources) {
            Ok(msg) => collector.into_response(
                OperationResult::success_with_details(json!({ "message": msg })),
                "用户数据还原成功",
            ),
            Err(e) => collector.into_response(OperationResult::failure(&e), "用户数据还原失败"),
        }
    }

    pub fn user_data_clear(state: &AppState) -> InvokeResponse {
        let resources = state.ensure_resources();
        let log_bus = state.ensure_log_bus();
        let collector = LogCollector::new(Some(log_bus));

        match user_data::clear_user_data(&resources) {
            Ok(_) => collector.into_response(OperationResult::success(), "用户数据已清除"),
            Err(e) => collector.into_response(OperationResult::failure(&e), "用户数据清除失败"),
        }
    }

    pub fn load_config(state: &AppState) -> Result<AppConfig, String> {
        let resources = state.ensure_resources();
        crate::config::load_yaml_config(resources.config_file())
    }

    pub fn save_config(state: &AppState, config: &AppConfig) -> Result<(), String> {
        let resources = state.ensure_resources();
        crate::config::save_yaml_config(resources.config_file(), config)
    }
}
