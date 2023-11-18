// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!wsdasd", name)
}

// #[tauri::command]
// fn get_files(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!wsdasd", name)
// }

// fn read_file_string(filepath: &str) -> Result<String, Box<dyn std::error::Error>> {
//     let data = fs::read_to_string(filepath)?;
//     Ok(data)
// }

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
