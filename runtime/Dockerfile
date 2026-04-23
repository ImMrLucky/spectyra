# Build context: the `runtime/` directory (see runtime/README.md).
FROM rust:1.83-bookworm AS build
WORKDIR /src
COPY core-rust ./core-rust
COPY local-runtime ./local-runtime
COPY Cargo.toml ./Cargo.toml
RUN cargo build --release -p spectyra_local_runtime

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/spectyra-runtime /usr/local/bin/spectyra-runtime
ENV RUST_BACKTRACE=1
EXPOSE 4269
ENTRYPOINT ["/usr/local/bin/spectyra-runtime"]
