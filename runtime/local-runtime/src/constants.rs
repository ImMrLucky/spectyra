pub const DEFAULT_BIND: &str = "127.0.0.1:4269";

pub fn runtime_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
