use crate::resource_manager::SharedResourceManager;
use std::fs;

pub fn open_user_data_dir(resources: &SharedResourceManager) -> Result<(), String> {
    let dir = resources.user_data_dir();
    open::that(dir).map_err(|e| format!("打开用户数据目录失败: {}", e))
}

pub fn backup_user_data(resources: &SharedResourceManager) -> Result<String, String> {
    let user_dir = resources.user_data_dir();
    let backup_dir = resources.backup_dir();

    fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("backup_{}", timestamp);
    let backup_path = format!("{}/{}", backup_dir, backup_name);

    let entries: Vec<_> = fs::read_dir(user_dir)
        .map_err(|e| format!("读取用户数据目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            !name_str.starts_with("backup_") && name_str != "backups" && name_str != "logs"
        })
        .collect();

    for entry in &entries {
        let src = entry.path();
        let dst = format!("{}/{}", backup_path, entry.file_name().to_string_lossy());
        if src.is_dir() {
            copy_dir_recursive(&src, &dst)?;
        } else {
            fs::copy(&src, &dst).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }

    Ok(backup_path)
}

pub fn restore_latest_backup(resources: &SharedResourceManager) -> Result<String, String> {
    let backup_dir = resources.backup_dir();
    let user_dir = resources.user_data_dir();

    if !std::path::Path::new(&backup_dir).exists() {
        return Err("备份目录不存在".to_string());
    }

    let mut backups: Vec<_> = fs::read_dir(&backup_dir)
        .map_err(|e| format!("读取备份目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .collect();

    backups.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    let latest = backups.into_iter().next().ok_or("未找到任何备份")?;
    let backup_path = latest.path();

    let entries: Vec<_> = fs::read_dir(&backup_path)
        .map_err(|e| format!("读取备份内容失败: {}", e))?
        .filter_map(|e| e.ok())
        .collect();

    for entry in &entries {
        let src = entry.path();
        let dst = format!("{}/{}", user_dir, entry.file_name().to_string_lossy());
        if src.is_dir() {
            let _ = fs::remove_dir_all(&dst);
            copy_dir_recursive(&src, &dst)?;
        } else {
            let _ = fs::remove_file(&dst);
            fs::copy(&src, &dst).map_err(|e| format!("还原文件失败: {}", e))?;
        }
    }

    Ok(format!("已从 {} 还原", backup_path.display()))
}

pub fn clear_user_data(resources: &SharedResourceManager) -> Result<(), String> {
    let user_dir = resources.user_data_dir();
    let preserve = ["backups", "logs"];

    let entries: Vec<_> = fs::read_dir(user_dir)
        .map_err(|e| format!("读取用户数据目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !preserve.contains(&name.as_str())
        })
        .collect();

    for entry in &entries {
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| format!("删除目录失败: {}", e))?;
        } else {
            fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))?;
        }
    }

    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dst: &str) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
    for entry in fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = format!("{}/{}", dst, entry.file_name().to_string_lossy());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }
    Ok(())
}
