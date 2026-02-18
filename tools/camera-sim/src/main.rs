//! Camera simulator for Kodama E2E integration testing.
//!
//! Connects to a running Kodama server via Iroh QUIC and sends
//! synthetic video, audio, and telemetry frames.
//!
//! Usage:
//!   cargo run -p camera-sim -- <server-public-key> [--cameras N]

use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use tracing::info;
use tracing_subscriber::EnvFilter;

use kodama::capture::{
    encode_telemetry, start_test_audio, start_test_source, GpsData, TelemetryData,
    TestAudioConfig, TestSourceConfig,
};
use kodama::transport::Relay;
use kodama::{Channel, Frame, FrameFlags, SourceId};

use iroh::PublicKey;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("camera_sim=info".parse().unwrap())
                .add_directive("kodama=info".parse().unwrap()),
        )
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: camera-sim <server-public-key> [--cameras N]");
        eprintln!();
        eprintln!("  server-public-key: Base32 public key from server startup logs");
        eprintln!("  --cameras N:       Number of simulated cameras (default: 2)");
        std::process::exit(1);
    }

    let server_key_str = &args[1];
    let num_cameras: usize = args
        .iter()
        .position(|a| a == "--cameras")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(2);

    info!("Starting {} simulated camera(s)", num_cameras);
    info!("Server public key: {}", server_key_str);

    let mut handles = Vec::new();

    for i in 0..num_cameras {
        let key_str = server_key_str.to_string();
        let handle = tokio::spawn(async move {
            if let Err(e) = run_camera(i, &key_str).await {
                tracing::error!("Camera {} error: {}", i, e);
            }
        });
        handles.push(handle);
        // Stagger camera connections
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    info!("All cameras started. Press Ctrl+C to stop.");

    // Wait for Ctrl+C
    tokio::signal::ctrl_c().await?;
    info!("Shutting down...");

    Ok(())
}

async fn run_camera(camera_idx: usize, server_key_str: &str) -> Result<()> {
    let camera_name = format!("SimCam-{:02}", camera_idx);
    info!("[{}] Initializing...", camera_name);

    // Ephemeral key — each run gets fresh camera IDs
    let relay = Relay::new(None).await.context("Failed to create relay")?;
    let source_id = SourceId::from_node_id_bytes(relay.public_key().as_bytes());
    info!("[{}] Source ID: {}", camera_name, source_id);

    // Connect to server
    info!("[{}] Connecting to server...", camera_name);
    let server_key: PublicKey = server_key_str
        .parse()
        .context("Invalid server public key")?;
    let conn = relay
        .connect(server_key)
        .await
        .context("Failed to connect to server")?;
    info!("[{}] Connected!", camera_name);

    // Open frame stream
    let sender = conn
        .open_frame_stream()
        .await
        .context("Failed to open frame stream")?;
    info!("[{}] Frame stream opened", camera_name);

    let start = Instant::now();

    // Start test video source (real H.264 frames)
    let mut video_rx = start_test_source(TestSourceConfig { fps: 15 });

    // Start test audio source (sine wave)
    let mut audio_rx = start_test_audio(TestAudioConfig {
        sample_rate: 48000,
        channels: 1,
        tone_frequency: 440.0 + (camera_idx as f32 * 110.0), // Different pitch per camera
        buffer_duration_ms: 20,
    });

    // Telemetry interval
    let mut telemetry_interval = tokio::time::interval(Duration::from_secs(2));

    let mut frame_count: u64 = 0;

    info!("[{}] Streaming video/audio/telemetry...", camera_name);

    loop {
        tokio::select! {
            Some(video_data) = video_rx.recv() => {
                let is_keyframe = kodama::capture::h264::contains_keyframe(&video_data);
                let frame = Frame {
                    source: source_id,
                    channel: Channel::Video,
                    flags: if is_keyframe { FrameFlags::keyframe() } else { FrameFlags::default() },
                    timestamp_us: start.elapsed().as_micros() as u64,
                    payload: video_data,
                };
                if sender.send(&frame).await.is_err() {
                    tracing::warn!("[{}] Frame send failed, reconnecting...", camera_name);
                    break;
                }
                frame_count += 1;
                if frame_count % 150 == 0 {
                    info!("[{}] Sent {} frames", camera_name, frame_count);
                }
            }
            Some(audio_data) = audio_rx.recv() => {
                let frame = Frame {
                    source: source_id,
                    channel: Channel::Audio,
                    flags: FrameFlags::default(),
                    timestamp_us: start.elapsed().as_micros() as u64,
                    payload: audio_data,
                };
                let _ = sender.send(&frame).await;
            }
            _ = telemetry_interval.tick() => {
                // Simulated GPS locations (spread around San Francisco)
                let base_coords: [(f64, f64); 4] = [
                    (37.7749, -122.4194),  // SF downtown
                    (37.7849, -122.4094),  // North Beach
                    (37.7649, -122.4294),  // Mission
                    (37.7549, -122.4394),  // Sunset
                ];
                let (base_lat, base_lon) = base_coords[camera_idx % base_coords.len()];
                // Add slight drift over time
                let drift = (start.elapsed().as_secs() as f64) * 0.00001;
                let telemetry = TelemetryData {
                    cpu_usage: 25.0 + (camera_idx as f32 * 10.0) + ((start.elapsed().as_secs() % 20) as f32),
                    cpu_temp: Some(45.0 + camera_idx as f32 * 5.0),
                    memory_usage: 55.0 + camera_idx as f32 * 8.0,
                    disk_usage: 30.0,
                    network_tx_bytes: start.elapsed().as_secs() * 50_000,
                    network_rx_bytes: start.elapsed().as_secs() * 10_000,
                    uptime_secs: start.elapsed().as_secs(),
                    load_average: [1.2, 0.9, 0.7],
                    gps: Some(GpsData {
                        latitude: base_lat + drift,
                        longitude: base_lon + drift,
                        altitude: Some(10.0 + camera_idx as f64 * 5.0),
                        speed: Some(0.5),
                        heading: Some(camera_idx as f64 * 90.0),
                        fix_mode: 3,
                    }),
                    motion_level: Some(0.0),
                };

                let payload = encode_telemetry(&telemetry)
                    .expect("Failed to encode telemetry");

                let frame = Frame {
                    source: source_id,
                    channel: Channel::Telemetry,
                    flags: FrameFlags::default(),
                    timestamp_us: start.elapsed().as_micros() as u64,
                    payload,
                };
                let _ = sender.send(&frame).await;
            }
        }
    }

    Ok(())
}
