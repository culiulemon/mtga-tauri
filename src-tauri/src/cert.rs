use crate::resource_manager::SharedResourceManager;
use rcgen::{BasicConstraints, CertificateParams, DnType, IsCa, KeyPair};

const CA_COMMON_NAME: &str = "MTGA_CA";
const CA_VALIDITY_DAYS: u32 = 36500;
const SERVER_CERT_VALIDITY_DAYS: u32 = 365;

pub struct CertManager {
    resources: SharedResourceManager,
}

impl CertManager {
    pub fn new(resources: SharedResourceManager) -> Self {
        Self { resources }
    }

    pub fn generate_ca_cert(&self, log_func: &mut dyn FnMut(&str)) -> Result<(), String> {
        log_func("开始生成 CA 证书...");

        let mut params = CertificateParams::default();
        params
            .distinguished_name
            .push(DnType::CommonName, CA_COMMON_NAME);
        params
            .distinguished_name
            .push(DnType::OrganizationName, "MTGA");
        params.distinguished_name.push(DnType::CountryName, "CN");

        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.key_usages.push(rcgen::KeyUsagePurpose::KeyCertSign);
        params.key_usages.push(rcgen::KeyUsagePurpose::CrlSign);

        let key_pair = KeyPair::generate().map_err(|e| format!("生成 CA 密钥对失败: {}", e))?;
        let cert = params
            .self_signed(&key_pair)
            .map_err(|e| format!("生成 CA 自签名证书失败: {}", e))?;

        let ca_key_path = self.resources.get_ca_key_path();
        let ca_cert_path = self.resources.get_ca_cert_path();

        std::fs::write(&ca_key_path, key_pair.serialize_pem())
            .map_err(|e| format!("写入 CA 私钥失败: {}", e))?;
        std::fs::write(&ca_cert_path, cert.pem())
            .map_err(|e| format!("写入 CA 证书失败: {}", e))?;

        log_func("CA 证书生成成功");
        Ok(())
    }

    pub fn generate_server_cert(
        &self,
        domain: &str,
        log_func: &mut dyn FnMut(&str),
    ) -> Result<(), String> {
        log_func(&format!("开始生成服务器证书: {}", domain));

        let ca_key_pem = std::fs::read_to_string(self.resources.get_ca_key_path())
            .map_err(|e| format!("读取 CA 私钥失败: {}", e))?;
        let ca_cert_pem = std::fs::read_to_string(self.resources.get_ca_cert_path())
            .map_err(|e| format!("读取 CA 证书失败: {}", e))?;

        let ca_key_pair =
            KeyPair::from_pem(&ca_key_pem).map_err(|e| format!("解析 CA 私钥失败: {}", e))?;

        let ca_params = CertificateParams::from_ca_cert_pem(&ca_cert_pem)
            .map_err(|e| format!("解析 CA 证书失败: {}", e))?;
        let ca_cert = ca_params
            .self_signed(&ca_key_pair)
            .map_err(|e| format!("重建 CA 证书失败: {}", e))?;

        let mut params = CertificateParams::default();
        params.distinguished_name.push(DnType::CommonName, domain);
        params
            .distinguished_name
            .push(DnType::OrganizationName, "MTGA");

        params.subject_alt_names.push(rcgen::SanType::DnsName(
            rcgen::Ia5String::try_from(domain.to_string())
                .map_err(|e| format!("无效域名: {}", e))?,
        ));

        params.is_ca = IsCa::NoCa;
        params
            .extended_key_usages
            .push(rcgen::ExtendedKeyUsagePurpose::ServerAuth);
        params
            .extended_key_usages
            .push(rcgen::ExtendedKeyUsagePurpose::ClientAuth);

        let key_pair = KeyPair::generate().map_err(|e| format!("生成服务器密钥对失败: {}", e))?;
        let cert = params
            .signed_by(&key_pair, &ca_cert, &ca_key_pair)
            .map_err(|e| format!("签署服务器证书失败: {}", e))?;

        let server_key_path = self.resources.get_server_key_path(domain);
        let server_cert_path = self.resources.get_server_cert_path(domain);

        std::fs::write(&server_key_path, key_pair.serialize_pem())
            .map_err(|e| format!("写入服务器私钥失败: {}", e))?;
        std::fs::write(&server_cert_path, cert.pem())
            .map_err(|e| format!("写入服务器证书失败: {}", e))?;

        log_func(&format!("服务器证书 {} 生成成功", domain));
        Ok(())
    }

    pub fn generate_all(&self, log_func: &mut dyn FnMut(&str)) -> Result<(), String> {
        self.generate_ca_cert(log_func)?;

        for domain in &[
            "api.openai.com",
            "api.anthropic.com",
            "generativelanguage.googleapis.com",
        ] {
            self.generate_server_cert(domain, log_func)?;
        }

        Ok(())
    }

    pub fn install_ca_cert(&self, log_func: &mut dyn FnMut(&str)) -> Result<(), String> {
        let ca_cert_path = self.resources.get_ca_cert_path();
        log_func("开始安装 CA 证书...");

        if cfg!(target_os = "windows") {
            let output = std::process::Command::new("certutil")
                .args(["-addstore", "-f", "ROOT", &ca_cert_path])
                .output()
                .map_err(|e| format!("执行 certutil 失败: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("安装 CA 证书失败: {}", stderr));
            }
            log_func("CA 证书已安装到系统信任存储");
        } else if cfg!(target_os = "macos") {
            let output = std::process::Command::new("sudo")
                .args([
                    "security",
                    "add-trusted-cert",
                    "-d",
                    "-r",
                    "trustRoot",
                    "-k",
                    "/Library/Keychains/System.keychain",
                    &ca_cert_path,
                ])
                .output()
                .map_err(|e| format!("执行 security 命令失败: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("安装 CA 证书失败: {}", stderr));
            }
            log_func("CA 证书已安装到系统钥匙串");
        } else {
            let output = std::process::Command::new("sudo")
                .args([
                    "cp",
                    &ca_cert_path,
                    "/usr/local/share/ca-certificates/mtga-ca.crt",
                ])
                .output()
                .map_err(|e| format!("复制 CA 证书失败: {}", e))?;

            if !output.status.success() {
                return Err("复制 CA 证书失败，请检查 sudo 权限".to_string());
            }

            let output = std::process::Command::new("sudo")
                .args(["update-ca-certificates"])
                .output()
                .map_err(|e| format!("更新 CA 证书束失败: {}", e))?;

            if !output.status.success() {
                return Err("更新 CA 证书束失败".to_string());
            }
            log_func("CA 证书已安装");
        }

        Ok(())
    }

    pub fn clear_ca_cert(
        &self,
        common_name: &str,
        log_func: &mut dyn FnMut(&str),
    ) -> Result<(), String> {
        log_func(&format!("开始清除 CA 证书: {}", common_name));

        if cfg!(target_os = "windows") {
            let output = std::process::Command::new("certutil")
                .args(["-store", "Root"])
                .output()
                .map_err(|e| format!("查询根证书存储失败: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains(common_name) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(hash) = parts.first() {
                        let del_output = std::process::Command::new("certutil")
                            .args(["-delstore", "Root", hash])
                            .output()
                            .map_err(|e| format!("删除证书失败: {}", e))?;
                        if del_output.status.success() {
                            log_func(&format!("已删除证书: {}", hash));
                        }
                    }
                }
            }
        } else if cfg!(target_os = "macos") {
            let output = std::process::Command::new("sudo")
                .args([
                    "security",
                    "delete-certificate",
                    "-c",
                    common_name,
                    "/Library/Keychains/System.keychain",
                ])
                .output()
                .map_err(|e| format!("删除 CA 证书失败: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log_func(&format!("删除 CA 证书警告: {}", stderr));
            }
        }

        log_func("CA 证书清除完成");
        Ok(())
    }

    pub fn has_ca_cert(&self) -> bool {
        let ca_cert_path = self.resources.get_ca_cert_path();
        std::path::Path::new(&ca_cert_path).exists()
    }
}
