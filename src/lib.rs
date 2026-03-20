use std::env;
use std::fs;
use std::path::PathBuf;

use zed_extension_api as zed;
use zed_extension_api::settings::LspSettings;

struct LogosExtension;

impl LogosExtension {
    fn bundled_server_dir() -> zed::Result<PathBuf> {
        let dir = env::temp_dir().join("logos-zed-language-server");
        fs::create_dir_all(&dir)
            .map_err(|err| format!("failed to create bundled language server directory: {err}"))?;

        fs::write(
            dir.join("logos-language-server.js"),
            include_str!("../server/logos-language-server.js"),
        )
        .map_err(|err| format!("failed to write bundled language server script: {err}"))?;

        fs::write(
            dir.join("logos-data.js"),
            include_str!("../server/logos-data.js"),
        )
        .map_err(|err| format!("failed to write bundled language server data: {err}"))?;

        Ok(dir)
    }

    fn logos_language_server_command(&self) -> zed::Result<zed::Command> {
        let server_path = Self::bundled_server_dir()?.join("logos-language-server.js");

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path.to_string_lossy().to_string()],
            env: Default::default(),
        })
    }

    fn clangd_command(&self, worktree: &zed::Worktree) -> zed::Result<zed::Command> {
        let path = worktree
            .which("clangd")
            .ok_or_else(|| "clangd must be installed and available in PATH".to_string())?;

        Ok(zed::Command {
            command: path,
            args: vec![
                "--compile-commands-dir".to_string(),
                worktree.root_path(),
                "--background-index".to_string(),
                "--log=error".to_string(),
                "--header-insertion=iwyu".to_string(),
                "--import-insertions".to_string(),
                "--clang-tidy".to_string(),
                "--completion-style=detailed".to_string(),
                "-j=4".to_string(),
            ],
            env: Default::default(),
        })
    }
}

impl zed::Extension for LogosExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        match language_server_id.as_ref() {
            "logos_language_server" => self.logos_language_server_command(),
            "clangd" => self.clangd_command(worktree),
            other => Err(format!("unsupported language server: {other}")),
        }
    }

    fn language_server_initialization_options(
        &mut self,
        server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree(server_id.as_ref(), worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.initialization_options.clone())
            .unwrap_or_default();
        Ok(Some(settings))
    }

    fn language_server_workspace_configuration(
        &mut self,
        server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree(server_id.as_ref(), worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.settings.clone())
            .unwrap_or_default();
        Ok(Some(settings))
    }
}

zed::register_extension!(LogosExtension);
