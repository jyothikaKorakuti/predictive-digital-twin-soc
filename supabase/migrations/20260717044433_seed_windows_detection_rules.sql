/*
# Seed Windows Event Detection Rules

## Purpose
Inserts pre-built detection rules for Windows Event Log collection into the
`detection_rules` table for the demo organization (ACME Corp).

## Rules Added
1. Repeated Failed Logins (4625) - 5+ failures in 5 min -> brute force
2. Successful Login After Failures (4624 after 4625) - credential compromise
3. Privileged Account Changes (4720, 4726, 4732) - account manipulation
4. Audit Log Cleared (1102) - defense evasion
5. Suspicious PowerShell Execution - encoded/hidden commands (simple rule)
6. Service Installation (4697) - persistence
7. Explicit Credential Use (4648) - lateral movement
8. Sysmon Network Connection (3) - C2 beaconing

## Notes
- Idempotent via NOT EXISTS check
- rule_type values constrained to: threshold, sequence, correlation, simple
- All rules have is_simulated = false (they apply to live data)
- MITRE ATT&CK mappings included
*/

INSERT INTO detection_rules (org_id, name, description, severity, rule_type, conditions, threshold, time_window, mitre_tactic, mitre_technique, enabled, is_simulated)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  t.name, t.description, t.severity, t.rule_type, t.conditions::jsonb, t.threshold, t.time_window, t.mitre_tactic, t.mitre_technique, true, false
FROM (VALUES
  ('Repeated Failed Logins',
   'Detects 5+ failed login attempts (EventID 4625) within 5 minutes from the same source, indicating a possible brute-force attack.',
   'high', 'threshold',
   '{"event_id": 4625, "source_type": "windows_event"}',
   5, 300,
   'Credential Access', 'T1110'),
  ('Successful Login After Failures',
   'Detects a successful login (4624) immediately following multiple failed attempts (4625), suggesting the attacker obtained valid credentials.',
   'high', 'correlation',
   '{"event_ids": [4625, 4624], "source_type": "windows_event", "sequence": true}',
   3, 600,
   'Initial Access', 'T1078'),
  ('Privileged Account Changes',
   'Detects user account creation (4720), deletion (4726), or group membership changes (4732) that may indicate persistence or privilege escalation.',
   'medium', 'threshold',
   '{"event_ids": [4720, 4726, 4732], "source_type": "windows_event"}',
   1, 3600,
   'Persistence', 'T1098'),
  ('Audit Log Cleared',
   'Detects clearing of the Windows Security audit log (EventID 1102), a classic defense evasion technique.',
   'critical', 'threshold',
   '{"event_id": 1102, "source_type": "windows_event"}',
   1, 60,
   'Defense Evasion', 'T1070'),
  ('Suspicious PowerShell Execution',
   'Detects PowerShell processes using encoded commands, hidden window flags, or download utilities - common obfuscation and payload delivery patterns.',
   'high', 'simple',
   '{"process_name": "powershell.exe", "patterns": ["-enc", "encodedcommand", "downloadstring", "iex", "frombase64string", "-w hidden"], "source_type": "windows_event"}',
   1, 60,
   'Execution', 'T1059'),
  ('Service Installation',
   'Detects installation of new Windows services (EventID 4697) which may be used for persistence or privilege escalation.',
   'medium', 'threshold',
   '{"event_id": 4697, "source_type": "windows_event"}',
   1, 3600,
   'Persistence', 'T1543'),
  ('Explicit Credential Use',
   'Detects explicit credential logons (EventID 4648) where a process logs on with different credentials, common in lateral movement.',
   'medium', 'threshold',
   '{"event_id": 4648, "source_type": "windows_event"}',
   1, 600,
   'Credential Access', 'T1555'),
  ('Sysmon Network Connection',
   'Detects outbound network connections from suspicious processes via Sysmon EventID 3, potential command-and-control beaconing.',
   'low', 'threshold',
   '{"event_id": 3, "source_type": "windows_event", "channel": "Microsoft-Windows-Sysmon/Operational"}',
   1, 60,
   'Command and Control', 'T1071')
) AS t(name, description, severity, rule_type, conditions, threshold, time_window, mitre_tactic, mitre_technique)
WHERE NOT EXISTS (
  SELECT 1 FROM detection_rules dr
  WHERE dr.org_id = 'a0000000-0000-0000-0000-000000000001'
    AND dr.name = t.name
);
