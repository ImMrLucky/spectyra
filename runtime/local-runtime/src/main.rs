#[tokio::main]
async fn main() -> anyhow::Result<()> {
    spectyra_local_runtime::run().await
}
