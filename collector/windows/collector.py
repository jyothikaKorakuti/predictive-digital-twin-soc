"""
Predictive Digital Twin SOC - Windows Event Log Collector

Reads Windows Event Logs (Security, System, Application, Sysmon) using the
Windows Event Log API (via pywin32 / win32evtlog), parses each event into a
normalized JSON record, and forwards batches to the Supabase Edge Function
ingestion endpoint.

Usage:
    python collector.py --config config.json

The collector maintains a checkpoint file per channel so that on restart it
resumes from the last successfully-forwarded record number instead of
re-reading the entire log.

Requires: pywin32 (pip install pywin32), requests (pip install requests)
"""

import argparse
import json
import os
import sys
import time
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone

try:
    import win32evtlog
    import win32evtlogutil
    import win32con
    import winerror
except ImportError:
    print("ERROR: pywin32 is required. Install with: pip install pywin32")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests is required. Install with: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "ingest_url": "",
    "api_key": "",
    "hostname": "",
    "channels": ["Security", "System", "Application", "Microsoft-Windows-Sysmon/Operational"],
    "poll_interval": 5,
    "batch_size": 100,
    "checkpoint_dir": "checkpoints",
    "log_file": "collector.log",
    "log_level": "INFO",
}

# Windows EventIDs we care about (Security + Sysmon)
WATCHED_EVENT_IDS = {
    # Digital Twin SOC test events
    100, 101, 102, 103,
    # Security
    4624, 4625, 4634, 4648, 4672, 4688, 4697,
    4720, 4726, 4732, 1102,
    # Sysmon
    1, 3, 7, 11, 12, 13, 22,
}

# EventID -> human-readable action name
EVENT_ACTIONS = {
    100: "SOC Test Information",
    101: "SOC Test Warning",
    102: "SOC Test Error",
    103: "SOC Proof Error",

    4624: "Logon",
    4625: "Failed Logon",
    4634: "Logoff",
    4648: "Explicit Credential Logon",
    4672: "Privileged Logon",
    4688: "Process Created",
    4697: "Service Installed",
    4720: "User Account Created",
    4726: "User Account Deleted",
    4732: "Member Added to Group",
    1102: "Audit Log Cleared",
    1: "Process Created (Sysmon)",
    3: "Network Connection (Sysmon)",
    7: "Image Loaded DLL (Sysmon)",
    11: "File Created (Sysmon)",
    12: "Registry Object Created (Sysmon)",
    13: "Registry Value Set (Sysmon)",
    22: "DNS Query (Sysmon)",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def setup_logging(log_file: str, level: str = "INFO"):
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=fmt,
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

logger = logging.getLogger("collector")

# ---------------------------------------------------------------------------
# Checkpointing
# ---------------------------------------------------------------------------

def load_checkpoint(checkpoint_dir: str, channel: str) -> int:
    """Return the last processed record number for a channel, or 0."""
    path = Path(checkpoint_dir) / f"{channel}.ckpt"
    if not path.exists():
        return 0
    try:
        return int(path.read_text().strip())
    except (ValueError, OSError):
        return 0

def save_checkpoint(checkpoint_dir: str, channel: str, record_number: int):
    path = Path(checkpoint_dir) / f"{channel}.ckpt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(record_number))

# ---------------------------------------------------------------------------
# Event Parsing
# ---------------------------------------------------------------------------

def parse_event(log_type: str, event, hostname: str) -> dict | None:
    """Convert a win32evtlog event object into a normalized JSON record."""
    try:
        event_id = event.EventID & 0x1FFFFFFF  # mask out severity/type bits
    except Exception:
        event_id = None

    # Skip events we don't track (reduces noise + bandwidth)
    if event_id is not None and event_id not in WATCHED_EVENT_IDS:
        return None

    # Time generated
    try:
        time_generated = event.TimeGenerated
        ts = time_generated.isoformat() if hasattr(time_generated, "isoformat") else str(time_generated)
    except Exception:
        ts = datetime.now(timezone.utc).isoformat()

    # Insertion strings (the structured data Windows puts in the event)
    try:
        insertion_strings = event.StringInserts
    except Exception:
        insertion_strings = []

    # Build a human-readable message from insertion strings
    msg_parts = []
    if insertion_strings:
        for s in insertion_strings:
            if isinstance(s, str) and s.strip():
                msg_parts.append(s.strip())
    message = " | ".join(msg_parts) if msg_parts else ""

    # Extract username, source IP, process info from insertion strings
    username = None
    src_ip = None
    destination_ip = None
    source_port = None
    destination_port = None
    protocol = None
    process_name = None
    command_line = None
    # For 4624/4625: insertion strings are [TargetUserName, Domain, LogonType, ...]
    if event_id in (4624, 4625) and len(msg_parts) >= 2:
        username = msg_parts[0]
        # Try to find an IP in the insertion strings
        for part in msg_parts:
            if part and any(c.isdigit() for c in part) and "." in part and part.replace(".", "").replace("-", "").isdigit():
                src_ip = part
                break

    # For 4688 (process creation): insertion strings are [ProcessName, CommandLine, ...]
    if event_id == 4688 and len(msg_parts) >= 2:
        process_name = msg_parts[0]
        command_line = msg_parts[1] if len(msg_parts) > 1 else None

    # Detect Sysmon whether the configured channel is "Sysmon" or the full
    # "Microsoft-Windows-Sysmon/Operational" channel name.
    source_name = str(getattr(event, "SourceName", "") or "")
    is_sysmon = "sysmon" in log_type.lower() or "sysmon" in source_name.lower()

    # Sysmon Event ID 1 - Process creation
    if is_sysmon and event_id == 1:
        # Standard Sysmon Event ID 1 insertion-string positions:
        # Image=4, CommandLine=10, User=12
        process_name = msg_parts[4] if len(msg_parts) > 4 else None
        command_line = msg_parts[10] if len(msg_parts) > 10 else None
        username = msg_parts[12] if len(msg_parts) > 12 else None

    # Sysmon Event ID 3 - Network connection
    if is_sysmon and event_id == 3:
        try:
            # Standard Sysmon Event ID 3 insertion-string positions:
            # Image=4, User=5, Protocol=6, SourceIp=9, SourcePort=11,
            # DestinationIp=14, DestinationPort=16
            process_name = msg_parts[4] if len(msg_parts) > 4 else None
            username = msg_parts[5] if len(msg_parts) > 5 else None
            protocol = msg_parts[6].lower() if len(msg_parts) > 6 else None
            src_ip = msg_parts[9] if len(msg_parts) > 9 else None

            if len(msg_parts) > 11:
                try:
                    source_port = int(msg_parts[11])
                except (TypeError, ValueError):
                    source_port = None

            destination_ip = msg_parts[14] if len(msg_parts) > 14 else None

            if len(msg_parts) > 16:
                try:
                    destination_port = int(msg_parts[16])
                except (TypeError, ValueError):
                    destination_port = None

        except (IndexError, TypeError) as exc:
            logger.warning("Could not parse Sysmon Event ID 3: %s", exc)

    action = EVENT_ACTIONS.get(event_id, f"Windows Event ({event_id})")

    record = {
        "event_id": event_id,
        "record_id": event.RecordNumber if hasattr(event, "RecordNumber") else None,
        "provider": event.SourceName if hasattr(event, "SourceName") else log_type,
        "channel": log_type,
        "hostname": hostname,
        "event_timestamp": ts,
        "event_action": action,
        "message": message or f"{action} on {hostname}",
        "username": username,
        "src_ip": src_ip,
        "destination_ip": destination_ip,
        "source_port": source_port,
        "destination_port": destination_port,
        "protocol": protocol,
        "process_name": process_name,
        "command_line": command_line,
        "log_level": getattr(event, "EventType", None),
        "raw_log": json.dumps({
            "event_id": event_id,
            "record_number": getattr(event, "RecordNumber", None),
            "source": getattr(event, "SourceName", None),
            "computer": getattr(event, "ComputerName", hostname),
            "event_type": getattr(event, "EventType", None),
            "event_category": getattr(event, "EventCategory", None),
            "insertion_strings": msg_parts,
        }),
    }

    # Clean None values to reduce payload
    return {k: v for k, v in record.items() if v is not None}

# ---------------------------------------------------------------------------
# Log Reading
# ---------------------------------------------------------------------------

def read_channel(channel: str, hostname: str, last_record: int, batch_size: int):
    events = []

    print(f"\n===== Reading {channel} =====")
    print(f"Checkpoint: {last_record}")

    try:
        hand = win32evtlog.OpenEventLog(hostname, channel)
    except Exception as e:
        print(f"OpenEventLog failed: {e}")
        return events

    flags = (
        win32evtlog.EVENTLOG_BACKWARDS_READ
        | win32evtlog.EVENTLOG_SEQUENTIAL_READ
    )

    while True:
        try:
            records = win32evtlog.ReadEventLog(hand, flags, 0)
        except Exception as e:
            print("ReadEventLog exception:", e)
            break

        if not records:
            print("No more records.")
            break

        print(f"Read {len(records)} records")

        for event in records:
            event_id = event.EventID & 0xFFFF

            print(
                f"Record={event.RecordNumber} "
                f"EventID={event_id} "
                f"Source={event.SourceName}"
            )

            parsed = parse_event(channel, event, hostname or event.ComputerName)

            if parsed:
                print("Matched Event:", parsed["event_id"])
                events.append(parsed)

            if len(events) >= batch_size:
                break

        if len(events) >= batch_size:
            break

    win32evtlog.CloseEventLog(hand)

    print(f"Collected {len(events)} matching events\n")

    return events

# ---------------------------------------------------------------------------
# Forwarding
# ---------------------------------------------------------------------------

def forward_batch(ingest_url: str, api_key: str, events: list[dict], hostname: str, version: str = "1.0.0") -> bool:
    if not events:
        return True

    payload = {
        "hostname": hostname,
        "version": version,
        "events": events,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": api_key,
    }

    try:
        resp = requests.post(ingest_url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            logger.info(
                f"Forwarded {len(events)} events -> accepted={data.get('accepted', '?')} "
                f"dupes={data.get('duplicates', '?')} alerts={data.get('alerts_created', '?')}"
            )
            return True
        else:
            logger.error(f"Ingestion failed ({resp.status_code}): {resp.text}")
            return False
    except requests.RequestException as e:
        logger.error(f"Network error forwarding events: {e}")
        return False

# ---------------------------------------------------------------------------
# Main Loop
# ---------------------------------------------------------------------------

def get_hostname() -> str:
    import socket
    return socket.gethostname()

def run(config_path: str):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    # Merge with defaults
    for k, v in DEFAULT_CONFIG.items():
        config.setdefault(k, v)

    setup_logging(config["log_file"], config.get("log_level", "INFO"))

    ingest_url = config["ingest_url"]
    api_key = config["api_key"]
    hostname = config.get("hostname") or get_hostname()
    channels = config["channels"]
    poll_interval = config["poll_interval"]
    batch_size = config["batch_size"]
    checkpoint_dir = config["checkpoint_dir"]

    if not ingest_url or not api_key:
        logger.error("ingest_url and api_key are required in config")
        sys.exit(1)

    logger.info(f"Starting Windows Event Log Collector on {hostname}")
    logger.info(f"Ingestion endpoint: {ingest_url}")
    logger.info(f"Channels: {channels}")
    logger.info(f"Poll interval: {poll_interval}s, Batch size: {batch_size}")

    # Ensure checkpoint dir exists
    Path(checkpoint_dir).mkdir(parents=True, exist_ok=True)

    while True:
        for channel in channels:
            last_record = load_checkpoint(checkpoint_dir, channel)
            events = read_channel(channel, None, last_record, batch_size)

            if events:
                success = forward_batch(ingest_url, api_key, events, hostname)
                if success:
                    # Update checkpoint to the highest record number seen
                    max_record = max(
                        (e.get("record_id", 0) or 0) for e in events
                    )
                    save_checkpoint(checkpoint_dir, channel, max_record)
                else:
                    # On failure, don't advance checkpoint so events are retried
                    logger.warning(f"Retaining checkpoint for {channel} (forward failed)")
            else:
                logger.debug(f"No new events on {channel}")

        time.sleep(poll_interval)

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Windows Event Log Collector for Predictive Digital Twin SOC")
    parser.add_argument("--config", default="config.json", help="Path to config.json")
    args = parser.parse_args()

    if not os.path.exists(args.config):
        # Generate a default config for the user to fill in
        with open(args.config, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        print(f"Created default config at {args.config} - fill in ingest_url and api_key, then re-run.")
        sys.exit(0)

    try:
        run(args.config)
    except KeyboardInterrupt:
        logger.info("Collector stopped by user")
        sys.exit(0)

if __name__ == "__main__":
    main()