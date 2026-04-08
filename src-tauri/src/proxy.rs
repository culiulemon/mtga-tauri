use axum::Router;
use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub inbound_route: String,
    pub upstream_route: String,
    pub provider: String,
    pub api_url: String,
    pub api_key: String,
    pub target_model_id: String,
    pub mapped_model_id: String,
    pub mtga_auth_key: String,
    pub disable_ssl_strict: bool,
    pub force_stream: bool,
    pub stream_mode: String,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            inbound_route: "/v1".to_string(),
            upstream_route: "/v1".to_string(),
            provider: "openai_chat_completion".to_string(),
            api_url: "https://api.openai.com".to_string(),
            api_key: String::new(),
            target_model_id: String::new(),
            mapped_model_id: String::new(),
            mtga_auth_key: String::new(),
            disable_ssl_strict: false,
            force_stream: false,
            stream_mode: "true".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProxyStep {
    pub step: String,
    pub message: String,
    pub done: bool,
}

#[derive(Clone)]
pub struct ProxyAppState {
    pub config: ProxyConfig,
    pub client: Client,
    pub step_tx: mpsc::UnboundedSender<ProxyStep>,
}

#[derive(Debug, Clone, Default)]
pub struct ProxyServerHandle {
    pub running: Arc<RwLock<bool>>,
    pub axum_handle: Arc<RwLock<Option<axum_server::Handle>>>,
}

impl ProxyServerHandle {
    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    pub async fn stop(&self) {
        let handle_opt = self.axum_handle.read().await.clone();
        if let Some(handle) = handle_opt {
            handle.graceful_shutdown(Some(std::time::Duration::from_secs(5)));
        }
        *self.running.write().await = false;
    }
}

fn verify_auth(headers: &HeaderMap, expected_key: &str) -> bool {
    if expected_key.is_empty() {
        return true;
    }
    if let Some(auth) = headers.get("authorization") {
        if let Ok(auth_str) = auth.to_str() {
            return auth_str == format!("Bearer {}", expected_key);
        }
    }
    false
}

fn json_error(status: StatusCode, message: &str) -> Response {
    (status, axum::Json(json!({"error": message}))).into_response()
}

async fn handle_chat_completions(
    State(state): State<Arc<ProxyAppState>>,
    headers: HeaderMap,
    body: String,
) -> Response {
    if !verify_auth(&headers, &state.config.mtga_auth_key) {
        return json_error(StatusCode::UNAUTHORIZED, "Unauthorized");
    }

    let mut req_body: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => {
            return json_error(StatusCode::BAD_REQUEST, &format!("Invalid JSON: {}", e));
        }
    };

    if !state.config.mapped_model_id.is_empty() {
        if req_body.get("model").and_then(|m| m.as_str()) == Some(&state.config.mapped_model_id) {
            req_body["model"] = Value::String(state.config.target_model_id.clone());
        }
    }

    if state.config.force_stream {
        let stream_val = state.config.stream_mode == "true";
        req_body["stream"] = Value::Bool(stream_val);
    }

    let is_stream = req_body
        .get("stream")
        .and_then(|s| s.as_bool())
        .unwrap_or(false);

    let _ = state.step_tx.send(ProxyStep {
        step: "proxy".to_string(),
        message: format!(
            "转发请求: {} (stream={})",
            req_body
                .get("model")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown"),
            is_stream
        ),
        done: false,
    });

    match state.config.provider.as_str() {
        "anthropic" => handle_anthropic_completions(state, req_body, is_stream).await,
        "gemini" => handle_gemini_completions(state, req_body, is_stream).await,
        _ => handle_openai_completions(state, req_body, is_stream).await,
    }
}

async fn handle_openai_completions(
    state: Arc<ProxyAppState>,
    req_body: Value,
    is_stream: bool,
) -> Response {
    let base = format!(
        "{}{}",
        state.config.api_url.trim_end_matches('/'),
        state.config.upstream_route
    );
    let upstream_url = format!("{}/chat/completions", base);

    let mut upstream_headers = reqwest::header::HeaderMap::new();
    upstream_headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", state.config.api_key))
            .unwrap_or(HeaderValue::from_static("")),
    );
    upstream_headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    if let Err(e) = state.step_tx.send(ProxyStep {
        step: "proxy".to_string(),
        message: format!("转发到 OpenAI: {}", upstream_url),
        done: false,
    }) {
        log::error!("发送步骤事件失败: {}", e);
    }

    match state
        .client
        .post(&upstream_url)
        .headers(upstream_headers)
        .json(&req_body)
        .send()
        .await
    {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::OK);
            let mut response_headers = HeaderMap::new();
            if let Some(content_type) = resp.headers().get("content-type") {
                response_headers.insert("content-type", content_type.clone());
            }

            if is_stream {
                let stream = resp.bytes_stream().map(|result| {
                    result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                });
                let body = Body::from_stream(stream);
                (status, response_headers, body).into_response()
            } else {
                match resp.json::<Value>().await {
                    Ok(body) => {
                        let needs_clean = body
                            .get("model")
                            .and_then(|m| m.as_str())
                            .is_some_and(|s| s.contains('/'));

                        if needs_clean {
                            let model_str =
                                body.get("model").and_then(|m| m.as_str()).unwrap_or("");
                            if let Some(idx) = model_str.find('/') {
                                let clean_model = model_str[idx + 1..].to_string();
                                let mut body = body;
                                body["model"] = Value::String(clean_model);
                                (status, response_headers, axum::Json(body)).into_response()
                            } else {
                                (status, response_headers, axum::Json(body)).into_response()
                            }
                        } else {
                            (status, response_headers, axum::Json(body)).into_response()
                        }
                    }
                    Err(e) => {
                        json_error(StatusCode::BAD_GATEWAY, &format!("解析上游响应失败: {}", e))
                    }
                }
            }
        }
        Err(e) => {
            let _ = state.step_tx.send(ProxyStep {
                step: "error".to_string(),
                message: format!("上游请求失败: {}", e),
                done: true,
            });
            json_error(StatusCode::BAD_GATEWAY, &format!("上游请求失败: {}", e))
        }
    }
}

async fn handle_anthropic_completions(
    state: Arc<ProxyAppState>,
    req_body: Value,
    is_stream: bool,
) -> Response {
    let anthropic_body = build_anthropic_request(&req_body, &state.config);

    let base = format!(
        "{}{}",
        state.config.api_url.trim_end_matches('/'),
        state.config.upstream_route
    );
    let upstream_url = format!("{}/messages", base);

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&state.config.api_key).unwrap_or(HeaderValue::from_static("")),
    );
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    match state
        .client
        .post(&upstream_url)
        .headers(headers)
        .json(&anthropic_body)
        .send()
        .await
    {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::OK);

            if is_stream {
                let upstream_stream = resp.bytes_stream();
                let mapped_stream = upstream_stream.map(move |result| {
                    result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                });
                let body = Body::from_stream(mapped_stream);
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    "content-type",
                    HeaderValue::from_static("text/event-stream"),
                );
                (status, resp_headers, body).into_response()
            } else {
                match resp.json::<Value>().await {
                    Ok(body) => {
                        let mut openai_response = json!({
                            "id": body.get("id").unwrap_or(&json!("chatcmpl-unknown")),
                            "object": "chat.completion",
                            "created": chrono::Utc::now().timestamp(),
                            "model": state.config.mapped_model_id.clone(),
                        });
                        if let Some(content) = body
                            .get("content")
                            .and_then(|c| c.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|item| item.get("text"))
                            .and_then(|t| t.as_str())
                        {
                            openai_response["choices"] = json!([{
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": content
                                },
                                "finish_reason": "stop"
                            }]);
                        }
                        openai_response["usage"] = body.get("usage").cloned().unwrap_or(
                            json!({"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
                        );
                        (status, axum::Json(openai_response)).into_response()
                    }
                    Err(e) => json_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("解析 Anthropic 响应失败: {}", e),
                    ),
                }
            }
        }
        Err(e) => json_error(
            StatusCode::BAD_GATEWAY,
            &format!("Anthropic 请求失败: {}", e),
        ),
    }
}

async fn handle_gemini_completions(
    state: Arc<ProxyAppState>,
    req_body: Value,
    _is_stream: bool,
) -> Response {
    let mut gemini_contents = Vec::new();
    if let Some(messages) = req_body.get("messages").and_then(|m| m.as_array()) {
        for msg in messages {
            let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
            let gemini_role = if role == "assistant" { "model" } else { "user" };
            let mut parts = Vec::new();
            if let Some(content) = msg.get("content") {
                if let Some(s) = content.as_str() {
                    parts.push(json!({"text": s}));
                }
            }
            gemini_contents.push(json!({"role": gemini_role, "parts": parts}));
        }
    }

    let gemini_body = json!({
        "contents": gemini_contents,
        "generationConfig": {
            "temperature": req_body.get("temperature").and_then(|t| t.as_f64()).unwrap_or(1.0),
            "maxOutputTokens": req_body.get("max_tokens").and_then(|m| m.as_i64()).unwrap_or(8192),
        }
    });

    let base = format!(
        "{}{}",
        state.config.api_url.trim_end_matches('/'),
        state.config.upstream_route
    );
    let upstream_url = format!(
        "{}/models/{}:generateContent?key={}",
        base, state.config.target_model_id, state.config.api_key
    );

    match state
        .client
        .post(&upstream_url)
        .header("Content-Type", "application/json")
        .json(&gemini_body)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(body) => {
                let mut openai_response = json!({
                    "id": "chatcmpl-gemini",
                    "object": "chat.completion",
                    "created": chrono::Utc::now().timestamp(),
                    "model": state.config.mapped_model_id.clone(),
                    "choices": [],
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                });

                if let Some(candidates) = body.get("candidates").and_then(|c| c.as_array()) {
                    let choices: Vec<Value> = candidates
                        .iter()
                        .filter_map(|candidate| {
                            let content = candidate
                                .get("content")
                                .and_then(|c| c.get("parts"))
                                .and_then(|p| p.as_array())
                                .and_then(|arr| arr.first())
                                .and_then(|part| part.get("text"))
                                .and_then(|t| t.as_str())
                                .unwrap_or("");
                            Some(json!({
                                "index": 0,
                                "message": {"role": "assistant", "content": content},
                                "finish_reason": "stop"
                            }))
                        })
                        .collect();
                    openai_response["choices"] = Value::Array(choices);
                }

                (StatusCode::OK, axum::Json(openai_response)).into_response()
            }
            Err(e) => json_error(
                StatusCode::BAD_GATEWAY,
                &format!("解析 Gemini 响应失败: {}", e),
            ),
        },
        Err(e) => json_error(StatusCode::BAD_GATEWAY, &format!("Gemini 请求失败: {}", e)),
    }
}

fn build_anthropic_request(original: &Value, config: &ProxyConfig) -> Value {
    let mut req = json!({
        "model": config.target_model_id,
        "max_tokens": 4096,
    });
    if let Some(messages) = original.get("messages") {
        let mut system_content = String::new();
        let mut filtered = Vec::new();
        if let Some(msgs) = messages.as_array() {
            for msg in msgs {
                if msg.get("role") == Some(&Value::String("system".to_string())) {
                    if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                        system_content.push_str(content);
                    }
                } else {
                    filtered.push(msg.clone());
                }
            }
        }
        req["messages"] = Value::Array(filtered);
        if !system_content.is_empty() {
            req["system"] = Value::String(system_content);
        }
    }
    if let Some(stream) = original.get("stream") {
        req["stream"] = stream.clone();
    }
    req
}

async fn handle_models(State(state): State<Arc<ProxyAppState>>) -> Response {
    let response = json!({
        "object": "list",
        "data": [{
            "id": state.config.mapped_model_id.clone(),
            "object": "model",
            "owned_by": "mtga-proxy",
            "permission": [],
            "root": state.config.mapped_model_id.clone(),
            "parent": null
        }]
    });
    axum::Json(response).into_response()
}

pub async fn start_proxy_server(
    config: ProxyConfig,
    step_tx: mpsc::UnboundedSender<ProxyStep>,
    cert_path: String,
    key_path: String,
    port: u16,
) -> Result<ProxyServerHandle, String> {
    let _ = step_tx.send(ProxyStep {
        step: "proxy".to_string(),
        message: "正在启动代理服务器...".to_string(),
        done: false,
    });

    let tls_config = tokio::time::timeout(
        tokio::time::Duration::from_secs(10),
        axum_server::tls_rustls::RustlsConfig::from_pem_file(&cert_path, &key_path),
    )
    .await
    .map_err(|_| format!("TLS 证书加载超时 (cert: {}, key: {})", cert_path, key_path))?
    .map_err(|e| {
        format!(
            "TLS 证书加载失败 (cert: {}, key: {}): {}",
            cert_path, key_path, e
        )
    })?;

    let _ = step_tx.send(ProxyStep {
        step: "proxy".to_string(),
        message: "TLS 证书加载成功".to_string(),
        done: false,
    });

    let client = Client::builder()
        .danger_accept_invalid_certs(config.disable_ssl_strict)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let state = Arc::new(ProxyAppState {
        config,
        client,
        step_tx: step_tx.clone(),
    });

    let inbound_route = state.config.inbound_route.clone();
    let app = Router::new()
        .route(&format!("{}/models", inbound_route), get(handle_models))
        .route(
            &format!("{}/chat/completions", inbound_route),
            post(handle_chat_completions),
        )
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let handle = ProxyServerHandle::default();
    let running = handle.running.clone();
    let axum_handle = handle.axum_handle.clone();

    *running.write().await = true;

    let step_tx_clone = step_tx.clone();
    tokio::spawn(async move {
        let srv_handle = axum_server::Handle::new();
        *axum_handle.write().await = Some(srv_handle.clone());

        let _ = step_tx_clone.send(ProxyStep {
            step: "proxy".to_string(),
            message: format!("代理服务器正在监听: https://0.0.0.0:{}", port),
            done: false,
        });

        let server = axum_server::bind_rustls(addr, tls_config)
            .handle(srv_handle)
            .serve(app.into_make_service());

        if let Err(e) = server.await {
            log::error!("代理服务器错误: {}", e);
            let _ = step_tx_clone.send(ProxyStep {
                step: "proxy".to_string(),
                message: format!("代理服务器运行错误: {}", e),
                done: false,
            });
        }

        *running.write().await = false;
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(handle)
}
