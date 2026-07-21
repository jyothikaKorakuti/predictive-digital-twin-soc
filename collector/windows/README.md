# Predictive Digital Twin SOC - Windows Event Log Collector

Collects Windows Event Logs (Security, System, Application, Sysmon) and forwards them to the SOC ingestion endpoint.

## Quick Start (PowerShell Installer)

1. Generate an API key from the SOC portal: **Integrations** page → **New API Key**.
2. Copy the collector files (`collector.py`, `config.json`, `requirements.txt`, `install.ps1`) to the target Windows machine.
3. Open PowerShell as Administrator and run:

```powershell
.\install.ps1 -IngestUrl "https://<your-project>.supabase.co/functions/v1/logs-ingest" -ApiKey "soc_your_key_here"
```

The installer will:
- Install Python dependencies (pywin32, requests)
- Write `config.json` with your endpoint and API key
- Enable required Windows audit policies (Logon, Process Creation, Account Management, etc.)
- Create a Scheduled Task (`SOC-Collector`) that runs at startup as SYSTEM
- Start the collector immediately

## Manual Installation

```cmd
pip install -r requirements.txt
python collector.py --config config.json
```

## Verifying Collection

Create a test event on the Windows machine:

```cmd
eventcreate /ID 100 /T INFORMATION /L APPLICATION /SO "SOC Test" /D "Collector test event"
```

Then check the **Live Logs** page in your SOC portal. The event should appear within ~5 seconds with `is_simulated = false`.

Note: The collector filters to watched EventIDs (4624, 4625, 4634, 4648, 4672, 4688, 4697, 4720, 4726, 4732, 1102, Sysmon 1/3/7/11/12/13/22). To test with `eventcreate`, use an Application log event — the collector reads the Application channel. For Security events, use audit policies.

## Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `ingest_url` | Supabase Edge Function URL | (required) |
| `api_key` | Collector API key from SOC portal | (required) |
| `hostname` | Override hostname (auto-detected if empty) | (auto) |
| `channels` | Windows event log channels to read | Security, System, Application |
| `poll_interval` | Seconds between reads | 5 |
| `batch_size` | Max events per batch | 100 |
| `checkpoint_dir` | Per-channel checkpoint files | checkpoints/ |
| `log_file` | Log file path | collector.log |
| `log_level` | DEBUG, INFO, WARNING, ERROR | INFO |

## Checkpointing

The collector saves the last processed record number per channel in `checkpoints/<channel>.ckpt`. On restart, it seeks to that record and only reads new events. This prevents duplicates — the ingestion endpoint also has a database-level dedup index on `(org_id, hostname, source_name, record_id)`.

## Supported Windows Event IDs

| EventID | Channel | Description |
|---------|---------|-------------|
| 4624 | Security | Successful logon |
| 4625 | Security | Failed logon |
| 4634 | Security | Logoff |
| 4648 | Security | Explicit credential logon |
| 4672 | Security | Privileged logon |
| 4688 | Security | Process created |
| 4697 | Security | Service installed |
| 4720 | Security | User account created |
| 4726 | Security | User account deleted |
| 4732 | Security | Member added to security group |
| 1102 | Security | Audit log cleared |
| 1 | Sysmon | Process created |
| 3 | Sysmon | Network connection |
| 7 | Sysmon | Image loaded (DLL) |
| 11 | Sysmon | File created |
| 12 | Sysmon | Registry object created |
| 13 | Sysmon | Registry value set |
| 22 | Sysmon | DNS query |

## Uninstall

```powershell
Unregister-ScheduledTask -TaskName "SOC-Collector" -Confirm:$false
Remove-Item -Recurse -Force "C:\ProgramData\SOC-Collector"
```
