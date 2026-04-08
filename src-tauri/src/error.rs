use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default)]
    pub details: serde_json::Value,
}

impl OperationResult {
    pub fn success() -> Self {
        Self {
            ok: true,
            message: None,
            code: None,
            details: serde_json::Value::Null,
        }
    }

    pub fn success_with_details(details: serde_json::Value) -> Self {
        Self {
            ok: true,
            message: None,
            code: None,
            details,
        }
    }

    pub fn failure(message: &str) -> Self {
        Self {
            ok: false,
            message: Some(message.to_string()),
            code: None,
            details: serde_json::Value::Null,
        }
    }

    pub fn failure_with_code(message: &str, code: &str) -> Self {
        Self {
            ok: false,
            message: Some(message.to_string()),
            code: Some(code.to_string()),
            details: serde_json::Value::Null,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvokeResponse {
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default)]
    pub details: serde_json::Value,
    #[serde(default)]
    pub logs: Vec<String>,
}

impl InvokeResponse {
    pub fn from_result(result: OperationResult, logs: Vec<String>, default_msg: &str) -> Self {
        let message = result.message.unwrap_or_else(|| default_msg.to_string());
        Self {
            ok: result.ok,
            message,
            code: result.code,
            details: result.details,
            logs,
        }
    }
}
