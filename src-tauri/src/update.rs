use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub html_url: String,
    pub prerelease: bool,
    pub published_at: String,
}

pub async fn check_for_updates(
    repo: &str,
    current_version: &str,
) -> Result<Option<UpdateInfo>, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);

    let client = reqwest::Client::builder()
        .user_agent("mtga-tauri")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("请求 GitHub API 失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API 返回错误: {}", resp.status()));
    }

    let release: GitHubRelease = resp
        .json()
        .await
        .map_err(|e| format!("解析 GitHub 响应失败: {}", e))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let current_clean = current_version.trim_start_matches('v').to_string();

    if compare_versions(&latest_version, &current_clean) == std::cmp::Ordering::Greater {
        let notes_html = markdown_to_html(release.body.as_deref().unwrap_or(""));
        Ok(Some(UpdateInfo {
            version: release.tag_name.clone(),
            release_url: release.html_url.clone(),
            notes_html,
        }))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub release_url: String,
    pub notes_html: String,
}

fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u32> { v.split('.').filter_map(|s| s.parse().ok()).collect() };
    let va = parse(a);
    let vb = parse(b);
    for i in 0..va.len().max(vb.len()) {
        let ca = va.get(i).unwrap_or(&0);
        let cb = vb.get(i).unwrap_or(&0);
        match ca.cmp(cb) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

fn markdown_to_html(md: &str) -> String {
    let mut html = String::new();
    let mut in_code_block = false;
    let mut in_list = false;

    for line in md.lines() {
        if line.starts_with("```") {
            if in_code_block {
                html.push_str("</code></pre>");
                in_code_block = false;
            } else {
                html.push_str("<pre><code>");
                in_code_block = true;
            }
            continue;
        }

        if in_code_block {
            html.push_str(&html_escape(line));
            html.push('\n');
            continue;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_list {
                html.push_str("</ul>");
                in_list = false;
            }
            continue;
        }

        if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
            if !in_list {
                html.push_str("<ul>");
                in_list = true;
            }
            html.push_str(&format!("<li>{}</li>", html_escape(&trimmed[2..])));
            continue;
        }

        if in_list {
            html.push_str("</ul>");
            in_list = false;
        }

        if trimmed.starts_with("# ") {
            html.push_str(&format!("<h3>{}</h3>", html_escape(&trimmed[2..])));
        } else if trimmed.starts_with("## ") {
            html.push_str(&format!("<h4>{}</h4>", html_escape(&trimmed[3..])));
        } else if trimmed.starts_with("### ") {
            html.push_str(&format!("<h5>{}</h5>", html_escape(&trimmed[4..])));
        } else {
            html.push_str(&format!("<p>{}</p>", html_escape(trimmed)));
        }
    }

    if in_list {
        html.push_str("</ul>");
    }

    html
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
