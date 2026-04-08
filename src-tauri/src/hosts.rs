use crate::resource_manager::SharedResourceManager;

const HOSTS_ENTRY_MARKER: &str = "# Added by MTGA";
const DEFAULT_HOSTS_IPS: &[&str] = &["127.0.0.1", "::1"];

pub fn get_hosts_file_path() -> String {
    if cfg!(target_os = "windows") {
        let system_root = std::env::var("SYSTEMROOT").unwrap_or_else(|_| r"C:\Windows".to_string());
        format!(r"{}\System32\drivers\etc\hosts", system_root)
    } else {
        "/etc/hosts".to_string()
    }
}

pub fn detect_file_encoding(path: &str) -> String {
    if let Ok(bytes) = std::fs::read(path) {
        match String::from_utf8(bytes) {
            Ok(_) => return "utf-8".to_string(),
            Err(_) => return "gbk".to_string(),
        }
    }
    "utf-8".to_string()
}

fn read_hosts_content(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("读取 hosts 文件失败: {}", e))
}

fn write_hosts_content(path: &str, content: &str) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if let Ok(meta) = std::fs::metadata(path) {
                let attrs = meta.file_attributes();
                if attrs & 0x01 != 0 {
                    let _ = std::process::Command::new("attrib")
                        .args(["-R", path])
                        .output();
                }
            }
        }
    }
    std::fs::write(path, content).map_err(|e| format!("写入 hosts 文件失败: {}", e))
}

fn build_hosts_block(domain: &str, ip_list: &[&str]) -> String {
    let entries: Vec<String> = ip_list
        .iter()
        .map(|ip| format!("{} {}", ip, domain))
        .collect();
    format!("{}\n{}\n", HOSTS_ENTRY_MARKER, entries.join("\n"))
}

fn normalize_ip_list<'a>(ip: Option<&'a serde_json::Value>) -> Vec<String> {
    match ip {
        None => DEFAULT_HOSTS_IPS.iter().map(|s| s.to_string()).collect(),
        Some(serde_json::Value::String(s)) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                DEFAULT_HOSTS_IPS.iter().map(|s| s.to_string()).collect()
            } else {
                vec![trimmed.to_string()]
            }
        }
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| {
                !s.is_empty()
                    && (DEFAULT_HOSTS_IPS.iter().any(|d| *d == s.as_str())
                        || s.parse::<std::net::IpAddr>().is_ok())
            })
            .collect(),
        _ => DEFAULT_HOSTS_IPS.iter().map(|s| s.to_string()).collect(),
    }
}

fn remove_hosts_block(content: &str, domain: &str) -> String {
    let mut result = String::new();
    let mut skip = false;
    for line in content.lines() {
        if line.contains(HOSTS_ENTRY_MARKER) && line.contains(domain) {
            skip = true;
            continue;
        }
        if skip {
            if line.trim().is_empty() || line.contains(domain) {
                continue;
            }
            skip = false;
        }
        result.push_str(line);
        result.push('\n');
    }
    result
}

pub fn add_hosts_entry(
    domain: &str,
    ip_list: Option<&serde_json::Value>,
    log_func: &mut dyn FnMut(&str),
) -> Result<(), String> {
    let hosts_file = get_hosts_file_path();
    log_func(&format!(
        "开始添加 hosts 条目: {} -> {}",
        domain,
        DEFAULT_HOSTS_IPS.join(", ")
    ));

    if !std::path::Path::new(&hosts_file).exists() {
        return Err(format!("hosts 文件不存在: {}", hosts_file));
    }

    let content = read_hosts_content(&hosts_file)?;
    let ips = normalize_ip_list(ip_list);
    let ips_ref: Vec<&str> = ips.iter().map(|s| s.as_str()).collect();
    let block = build_hosts_block(domain, &ips_ref);

    if content.contains(&block) {
        log_func("hosts 文件已包含目标记录，无需修改");
        return Ok(());
    }

    let new_content = remove_hosts_block(&content, domain);
    let final_content = if new_content.trim_end().is_empty() {
        block
    } else {
        format!("{}\n\n{}", new_content.trim_end(), block)
    };

    write_hosts_content(&hosts_file, &final_content)?;
    log_func("hosts 文件修改成功！");
    Ok(())
}

pub fn remove_hosts_entry(domain: &str, log_func: &mut dyn FnMut(&str)) -> Result<(), String> {
    let hosts_file = get_hosts_file_path();
    log_func(&format!("开始删除 hosts 条目: {}", domain));

    if !std::path::Path::new(&hosts_file).exists() {
        return Err(format!("hosts 文件不存在: {}", hosts_file));
    }

    let content = read_hosts_content(&hosts_file)?;
    let new_content = remove_hosts_block(&content, domain);

    if new_content == content {
        log_func(&format!("hosts 文件中未找到 {} 条目", domain));
        return Ok(());
    }

    write_hosts_content(&hosts_file, &new_content)?;
    log_func(&format!("已删除 {} 的 hosts 条目", domain));
    Ok(())
}

pub fn backup_hosts_file(
    resources: &SharedResourceManager,
    log_func: &mut dyn FnMut(&str),
) -> Result<(), String> {
    let hosts_file = get_hosts_file_path();
    let backup_file = resources.hosts_backup_file();

    log_func("开始备份 hosts 文件...");
    std::fs::copy(&hosts_file, &backup_file).map_err(|e| format!("备份 hosts 文件失败: {}", e))?;
    log_func(&format!("hosts 文件已备份到: {}", backup_file));
    Ok(())
}

pub fn restore_hosts_file(
    resources: &SharedResourceManager,
    log_func: &mut dyn FnMut(&str),
) -> Result<(), String> {
    let hosts_file = get_hosts_file_path();
    let backup_file = resources.hosts_backup_file();

    log_func("开始还原 hosts 文件...");
    if !std::path::Path::new(&backup_file).exists() {
        return Err(format!("备份文件不存在: {}", backup_file));
    }

    std::fs::copy(&backup_file, &hosts_file).map_err(|e| format!("还原 hosts 文件失败: {}", e))?;
    log_func("hosts 文件已还原");
    Ok(())
}

pub fn open_hosts_file(log_func: &mut dyn FnMut(&str)) -> Result<(), String> {
    let hosts_file = get_hosts_file_path();
    open::that(&hosts_file).map_err(|e| format!("打开 hosts 文件失败: {}", e))?;
    log_func("已打开 hosts 文件");
    Ok(())
}
