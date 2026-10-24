//! The desktop wrapper. The game is the Vite build in ../dist; this shell
//! only opens a window on it. Fullscreen (F11) and integer scaling (1x-4x)
//! are handled by the web app itself, so they work the same in a browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Steward of Annwn");
}
