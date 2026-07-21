/*
# Seed Demo Data

Populates the database with a safe, clearly-labeled simulated demonstration environment.
All simulated data has is_simulated = true.
*/

-- Demo Organization
INSERT INTO organizations (id, name, industry, location, employee_count, risk_appetite, critical_services, network_ranges, description, is_simulated)
VALUES ('a0000000-0000-0000-0000-000000000001', 'ACME Corp (Demo)', 'Technology', 'London, UK', 250, 'medium', 'Web Portal, Internal ERP, File Services', '10.10.0.0/16, 192.168.1.0/24', 'Simulated demonstration organization for the Predictive Digital Twin SOC platform.', true)
ON CONFLICT (id) DO NOTHING;

-- Demo Assets
INSERT INTO assets (id, org_id, hostname, ip_address, mac_address, asset_type, os_name, os_version, open_ports, services, internet_exposed, network_segment, business_owner, technical_owner, criticality, patch_status, source, status, tags, is_simulated) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'emp-ws-01', '10.10.0.15', '00:1A:2B:3C:4D:01', 'workstation', 'Windows 11', '23H2', '[22,3389]', '["ssh","rdp"]', false, 'Corporate-Workstations', 'HR Department', 'IT Support', 'medium', 'patched', 'manual', 'active', '["employee","windows"]', true),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'admin-ws-01', '10.10.0.20', '00:1A:2B:3C:4D:02', 'workstation', 'Windows 11', '23H2', '[3389,5985]', '["rdp","winrm"]', false, 'Admin-Segment', 'IT Department', 'IT Security', 'critical', 'patched', 'manual', 'active', '["admin","windows"]', true),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'web-srv-01', '10.10.0.80', '00:1A:2B:3C:4D:03', 'web_server', 'Ubuntu', '22.04 LTS', '[80,443,22]', '["http","https","ssh"]', true, 'DMZ', 'Marketing', 'Web Team', 'high', 'pending', 'manual', 'active', '["linux","dmz","exposed"]', true),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'dc-01', '10.10.0.5', '00:1A:2B:3C:4D:04', 'domain_controller', 'Windows Server', '2022', '[53,88,135,139,389,445,3389]', '["dns","kerberos","ldap","smb","rdp"]', false, 'Core-Servers', 'IT Department', 'IT Infrastructure', 'critical', 'patched', 'manual', 'active', '["windows","ad","critical"]', true),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'db-srv-01', '10.10.0.90', '00:1A:2B:3C:4D:05', 'database', 'PostgreSQL', '15.3', '[5432]', '["postgresql"]', false, 'Core-Servers', 'Finance', 'DBA Team', 'critical', 'patched', 'manual', 'active', '["linux","database","critical"]', true),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'file-srv-01', '10.10.0.100', '00:1A:2B:3C:4D:06', 'server', 'Windows Server', '2022', '[445,3389]', '["smb","rdp"]', false, 'Core-Servers', 'All Departments', 'IT Infrastructure', 'high', 'pending', 'manual', 'active', '["windows","fileserver"]', true),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'fw-01', '10.10.0.1', '00:1A:2B:3C:4D:07', 'firewall', 'pfSense', '2.7', '[22,443]', '["ssh","https"]', true, 'Perimeter', 'IT Department', 'Network Team', 'critical', 'patched', 'manual', 'active', '["firewall","perimeter"]', true)
ON CONFLICT (id) DO NOTHING;

-- Network connections
INSERT INTO asset_connections (org_id, source_asset_id, target_asset_id, relationship, port, protocol, bidirectional, is_simulated) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'CONNECTED_TO', 443, 'tcp', true, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 'CAN_REACH', 5432, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'AUTHENTICATES_TO', 88, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'ADMIN_ON', 445, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 'TRUSTS', 5432, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006', 'CAN_REACH', 445, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'CAN_REACH', 445, 'tcp', false, true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'CAN_REACH', 389, 'tcp', false, true)
ON CONFLICT DO NOTHING;

-- Vulnerabilities
INSERT INTO vulnerabilities (id, org_id, cve_id, title, description, cvss_score, cvss_severity, epss_score, exploit_available, patch_available, remediation, status, is_simulated) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CVE-2024-3094', 'XZ Utils Backdoor (liblzma)', 'Malicious code in xz/liblzma allowing SSH authentication bypass.', 10.0, 'critical', 0.95, true, true, 'Update xz-utils to patched version and rotate SSH keys.', 'open', true),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CVE-2023-23375', 'Windows Error Reporting LPE', 'Privilege escalation via Windows Error Reporting service.', 7.8, 'high', 0.42, false, true, 'Apply latest Windows security updates.', 'open', true),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CVE-2024-1086', 'Linux Kernel nf_tables LPE', 'Use-after-free in netfilter nf_tables enabling local privilege escalation.', 7.8, 'high', 0.71, true, true, 'Patch kernel to latest LTS version.', 'open', true),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'CVE-2023-50164', 'Apache Struts2 Path Traversal', 'Path traversal allowing RCE on Apache Struts2 applications.', 9.8, 'critical', 0.88, true, true, 'Upgrade Struts2 to 2.5.33 or later.', 'open', true),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'CVE-2024-21762', 'Fortinet FortiOS Out-of-Bounds Write', 'Out-of-bounds write allowing unauthenticated RCE on FortiOS.', 9.6, 'critical', 0.91, true, true, 'Upgrade FortiOS to patched release.', 'open', true)
ON CONFLICT (id) DO NOTHING;

-- Asset-Vulnerability mappings
INSERT INTO asset_vulnerabilities (asset_id, vulnerability_id, org_id, affected_service, status, is_simulated) VALUES
('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ssh', 'open', true),
('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'http', 'open', true),
('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'kernel', 'open', true),
('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'wer', 'open', true),
('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'wer', 'open', true),
('b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'https', 'open', true)
ON CONFLICT DO NOTHING;

-- MITRE ATT&CK Techniques
INSERT INTO mitre_techniques (technique_id, name, tactic, description, detection_guidance, mitigation_guidance) VALUES
('T1110', 'Brute Force', 'Credential Access', 'Adversaries attempt to guess credentials through rapid login attempts.', 'Monitor for multiple failed logins from single source. Alert on >5 failures in 5 minutes.', 'Enable account lockout, MFA, and rate limiting.'),
('T1078', 'Valid Accounts', 'Defense Evasion, Persistence, Privilege Escalation', 'Adversaries use stolen credentials to access systems.', 'Monitor for anomalous login times, locations, and impossible travel.', 'Implement MFA, credential rotation, and privileged access management.'),
('T1021', 'Remote Services', 'Lateral Movement', 'Adversaries use remote services like RDP, SSH, VNC to move laterally.', 'Monitor for unusual remote connections, especially to critical assets.', 'Restrict remote access via firewall, VPN, and jump hosts.'),
('T1059', 'Command and Scripting Interpreter', 'Execution', 'Adversaries execute commands via shells, PowerShell, or scripts.', 'Monitor for encoded commands, suspicious parent-child process chains.', 'Restrict script execution, enable script logging, use app locker.'),
('T1068', 'Exploitation for Privilege Escalation', 'Privilege Escalation', 'Adversaries exploit software vulnerabilities to elevate privileges.', 'Monitor for new privileged processes and unexpected privilege changes.', 'Patch systems, remove unnecessary software, enforce least privilege.'),
('T1190', 'Exploit Public-Facing Application', 'Initial Access', 'Adversaries exploit vulnerabilities in internet-facing applications.', 'Monitor web server logs for injection attempts and error patterns.', 'Patch web apps, use WAF, implement input validation.'),
('T1486', 'Data Encrypted for Impact', 'Impact', 'Adversaries encrypt data to disrupt availability.', 'Monitor for mass file modifications and encryption activity.', 'Maintain offline backups, deploy EDR, restrict execution.'),
('T1041', 'Exfiltration Over C2 Channel', 'Exfiltration', 'Adversaries exfiltrate data over command and control channels.', 'Monitor for unusual outbound traffic volumes and beaconing patterns.', 'Implement egress filtering, DLP, and network segmentation.'),
('T1053', 'Scheduled Task/Job', 'Execution, Persistence, Privilege Escalation', 'Adversaries create scheduled tasks for persistence.', 'Monitor for new scheduled task creation, especially via command line.', 'Restrict scheduled task creation rights, audit task changes.'),
('T1003', 'OS Credential Dumping', 'Credential Access', 'Adversaries dump credentials from memory or disk.', 'Monitor for LSASS access, credential store access, and dump tools.', 'Use credential guard, restrict debug privileges, deploy EDR.'),
('T1210', 'Exploitation of Remote Services', 'Lateral Movement', 'Adversaries exploit vulnerabilities in remote services to move laterally.', 'Monitor for exploit attempts against internal services.', 'Patch internal services, segment network, monitor internal traffic.'),
('T1071', 'Application Layer Protocol', 'Command and Control', 'Adversaries use application layer protocols for C2.', 'Monitor for anomalous DNS, HTTP, or TLS traffic patterns.', 'Use DNS filtering, TLS inspection, and traffic analysis.'),
('T1046', 'Network Service Scanning', 'Discovery', 'Adversaries scan networks to discover services and vulnerabilities.', 'Monitor for rapid connection attempts to multiple ports or hosts.', 'Implement network segmentation, IDS/IPS, and port scan detection.'),
('T1566', 'Phishing', 'Initial Access', 'Adversaries use phishing emails to gain initial access.', 'Monitor for suspicious emails, credential reuse, and anomalous logins.', 'Implement email filtering, user training, and MFA.')
ON CONFLICT (technique_id) DO NOTHING;

-- Detection Rules
INSERT INTO detection_rules (id, org_id, name, description, severity, rule_type, conditions, threshold, time_window, mitre_tactic, mitre_technique, enabled, match_count, is_simulated) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Multiple Failed Logins', 'Detects 5+ failed login attempts from a single source within 5 minutes.', 'high', 'threshold', '{"event_action":"failed_login","group_by":"src_ip"}', 5, 300, 'Credential Access', 'T1110', true, 3, true),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Successful Login After Failures', 'Detects successful login immediately following multiple failed attempts.', 'critical', 'sequence', '{"sequence":["failed_login","failed_login","successful_login"]}', 3, 600, 'Credential Access', 'T1078', true, 1, true),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Suspicious PowerShell Encoded Command', 'Detects encoded PowerShell command execution.', 'high', 'simple', '{"process_name":"powershell.exe","command_line_regex":"-enc|-EncodedCommand"}', 1, 0, 'Execution', 'T1059', true, 0, true),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'RDP Connection to Non-Standard Asset', 'Detects RDP connections to assets that do not normally receive RDP.', 'medium', 'simple', '{"dst_port":3389,"event_action":"connection"}', 1, 0, 'Lateral Movement', 'T1021', true, 2, true),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'New Privileged Account Created', 'Detects creation of new accounts with admin privileges.', 'high', 'simple', '{"event_action":"user_created","privilege":"admin"}', 1, 0, 'Persistence', 'T1053', true, 0, true),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Port Scan Detected', 'Detects connection attempts to many ports on a single host.', 'medium', 'threshold', '{"event_action":"connection","group_by":"src_ip","distinct_dst_ports":10}', 10, 60, 'Reconnaissance', 'T1046', true, 1, true)
ON CONFLICT (id) DO NOTHING;

-- Simulated log source
INSERT INTO log_sources (id, org_id, name, source_type, hostname, enabled, is_simulated) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'soc-collector', true, true)
ON CONFLICT (id) DO NOTHING;

-- Simulated Events
INSERT INTO events (org_id, event_timestamp, source_id, source_name, source_type, hostname, src_ip, dst_ip, src_port, dst_port, username, event_category, event_action, process_name, message, severity, raw_log, parser_name, mitre_tactic, mitre_technique, confidence, is_simulated, asset_id) VALUES
('a0000000-0000-0000-0000-000000000001', now() - interval '5 minutes', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54321, 22, 'root', 'authentication', 'failed_login', 'sshd', 'Failed password for root from 203.0.113.50 port 54321', 'medium', 'Jul 17 10:00:00 web-srv-01 sshd[1234]: Failed password for root from 203.0.113.50', 'syslog_parser', 'Credential Access', 'T1110', 0.85, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '4 minutes', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54322, 22, 'root', 'authentication', 'failed_login', 'sshd', 'Failed password for root from 203.0.113.50 port 54322', 'medium', 'Jul 17 10:01:00 web-srv-01 sshd[1235]: Failed password for root from 203.0.113.50', 'syslog_parser', 'Credential Access', 'T1110', 0.85, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '3 minutes', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54323, 22, 'root', 'authentication', 'failed_login', 'sshd', 'Failed password for root from 203.0.113.50 port 54323', 'medium', 'Jul 17 10:02:00 web-srv-01 sshd[1236]: Failed password for root from 203.0.113.50', 'syslog_parser', 'Credential Access', 'T1110', 0.85, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '2 minutes', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54324, 22, 'root', 'authentication', 'failed_login', 'sshd', 'Failed password for root from 203.0.113.50 port 54324', 'medium', 'Jul 17 10:03:00 web-srv-01 sshd[1237]: Failed password for root from 203.0.113.50', 'syslog_parser', 'Credential Access', 'T1110', 0.85, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '90 seconds', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54325, 22, 'admin', 'authentication', 'successful_login', 'sshd', 'Accepted password for admin from 203.0.113.50', 'high', 'Jul 17 10:03:30 web-srv-01 sshd[1238]: Accepted password for admin from 203.0.113.50', 'syslog_parser', 'Credential Access', 'T1078', 0.92, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '60 seconds', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.80', 54326, 443, 'admin', 'network', 'connection', 'curl', 'Outbound HTTPS connection to suspicious host 198.51.100.23', 'medium', 'Jul 17 10:03:45 web-srv-01 curl[1240]: connecting to 198.51.100.23', 'syslog_parser', 'Command and Control', 'T1071', 0.7, true, 'b0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000001', now() - interval '45 seconds', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'emp-ws-01', '10.10.0.15', '10.10.0.5', 49152, 88, 'jdoe', 'authentication', 'successful_login', 'kerberos', 'User jdoe authenticated to DC-01', 'info', 'Jul 17 10:04:00 emp-ws-01 kerberos[5678]: User jdoe authenticated to DC-01', 'syslog_parser', 'Defense Evasion', 'T1078', 0.3, true, 'b0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', now() - interval '30 seconds', 'e0000000-0000-0000-0000-000000000001', 'Demo Syslog Collector', 'simulated', 'web-srv-01', '203.0.113.50', '10.10.0.90', 54327, 5432, 'admin', 'network', 'connection', 'psql', 'Connection from web-srv-01 to db-srv-01 on port 5432', 'high', 'Jul 17 10:04:15 web-srv-01 psql[1241]: connecting to 10.10.0.90:5432', 'syslog_parser', 'Lateral Movement', 'T1210', 0.8, true, 'b0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Alerts
INSERT INTO alerts (id, org_id, title, description, severity, status, source, rule_id, asset_id, affected_asset, username, src_ip, mitre_tactic, mitre_technique, confidence, evidence, assigned_to, is_simulated) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Brute Force Attack Detected on web-srv-01', '5 failed SSH login attempts from 203.0.113.50 within 5 minutes targeting web-srv-01.', 'high', 'new', 'detection_engine', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'web-srv-01', 'root', '203.0.113.50', 'Credential Access', 'T1110', 0.9, '[{"event":"failed_login","count":5,"source_ip":"203.0.113.50"}]', null, true),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Successful Login After Brute Force', 'Successful login to web-srv-01 immediately following 5 failed attempts from 203.0.113.50.', 'critical', 'investigating', 'detection_engine', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'web-srv-01', 'admin', '203.0.113.50', 'Credential Access', 'T1078', 0.95, '[{"event":"failed_login","count":5},{"event":"successful_login","user":"admin"}]', 'soc-analyst', true),
('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Suspicious Lateral Movement to Database', 'Connection from compromised web-srv-01 to database server db-srv-01 on port 5432.', 'high', 'new', 'detection_engine', null, 'b0000000-0000-0000-0000-000000000003', 'web-srv-01', 'admin', '203.0.113.50', 'Lateral Movement', 'T1210', 0.8, '[{"event":"connection","dst":"10.10.0.90:5432"}]', null, true)
ON CONFLICT (id) DO NOTHING;

-- Incident
INSERT INTO incidents (id, org_id, title, description, severity, status, owner, related_assets, related_users, iocs, mitre_mapping, timeline, containment_actions, is_simulated) VALUES
('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Web Server Compromise via Brute Force', 'web-srv-01 was compromised through SSH brute force, followed by lateral movement attempt to db-srv-01.', 'critical', 'investigating', 'soc-analyst', '["web-srv-01","db-srv-01"]', '["admin","root"]', '["203.0.113.50","198.51.100.23"]', '[{"tactic":"Credential Access","technique":"T1110"},{"tactic":"Lateral Movement","technique":"T1210"}]', '[{"time":"T-5min","event":"5 failed SSH logins from 203.0.113.50"},{"time":"T-90s","event":"Successful login as admin"},{"time":"T-60s","event":"Outbound C2 connection"},{"time":"T-30s","event":"Lateral movement to db-srv-01"}]', 'Isolated web-srv-01 from network. Disabled compromised admin account.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO incident_alerts (incident_id, alert_id) VALUES
('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Recommendations
INSERT INTO recommendations (id, org_id, title, priority, reason, affected_asset, asset_id, expected_risk_reduction, implementation_effort, suggested_owner, status, validation_steps, is_simulated) VALUES
('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Patch XZ Utils Backdoor on web-srv-01', 'critical', 'CVE-2024-3094 allows SSH authentication bypass. Actively exploited vulnerability detected on web-srv-01.', 'web-srv-01', 'b0000000-0000-0000-0000-000000000003', 25, 'low', 'IT Security', 'open', 'Verify xz-utils version after patch. Run vulnerability scan to confirm remediation.', true),
('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Disable SSH root Login on web-srv-01', 'high', 'Root login over SSH was targeted by brute force attack. Disabling root login reduces attack surface.', 'web-srv-01', 'b0000000-0000-0000-0000-000000000003', 15, 'low', 'Web Team', 'open', 'Attempt SSH login as root - should be refused.', true),
('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Enable MFA for Admin Accounts', 'critical', 'Admin account was compromised through brute force. MFA would have prevented successful login.', 'admin-ws-01', 'b0000000-0000-0000-0000-000000000002', 30, 'medium', 'IT Security', 'open', 'Verify MFA prompt appears on next admin login.', true),
('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Segment DMZ from Core Network', 'high', 'Compromised web server was able to reach database server directly. Network segmentation would block this path.', 'fw-01', 'b0000000-0000-0000-0000-000000000007', 20, 'high', 'Network Team', 'in_progress', 'Attempt connection from DMZ to core - should be blocked by firewall.', true)
ON CONFLICT (id) DO NOTHING;

-- Risk Assessments
INSERT INTO risk_assessments (org_id, asset_id, scope, risk_score, risk_level, attack_probability, confidence, contributing_factors, recommended_actions, predicted_target, predicted_technique, model_version, is_simulated) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'asset', 78, 'high', 0.74, 0.8, '[{"factor":"Internet Exposed","weight":15,"value":true},{"factor":"Critical Vulnerabilities","weight":25,"value":2},{"factor":"Recent Alerts","weight":20,"value":3},{"factor":"Open Ports","weight":10,"value":3},{"factor":"Patch Status","weight":8,"value":"pending"}]', '["Patch XZ Utils vulnerability","Disable SSH root login","Enable WAF rules","Restrict outbound traffic"]', 'db-srv-01', 'T1210', 'rule-based-v1', true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'asset', 65, 'high', 0.55, 0.7, '[{"factor":"Criticality","weight":25,"value":"critical"},{"factor":"Trust Relationships","weight":20,"value":3},{"factor":"Exposed Services","weight":15,"value":7},{"factor":"Admin Access","weight":5,"value":true}]', '["Review admin access","Enable MFA","Monitor authentication logs"]', 'file-srv-01', 'T1021', 'rule-based-v1', true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'asset', 72, 'high', 0.6, 0.75, '[{"factor":"Criticality","weight":25,"value":"critical"},{"factor":"Reachable from DMZ","weight":20,"value":true},{"factor":"Database Service","weight":15,"value":true},{"factor":"Trust from DC","weight":12,"value":true}]', '["Segment network","Restrict DB access","Enable DB audit logging"]', 'file-srv-01', 'T1041', 'rule-based-v1', true),
('a0000000-0000-0000-0000-000000000001', null, 'organization', 68, 'high', 0.65, 0.78, '[{"factor":"Exposed Assets","weight":15,"value":2},{"factor":"Critical Vulnerabilities","weight":25,"value":3},{"factor":"Active Alerts","weight":20,"value":3},{"factor":"Open Incidents","weight":15,"value":1},{"factor":"Missing MFA","weight":10,"value":true}]', '["Patch critical vulnerabilities","Enable MFA","Segment network","Improve detection coverage"]', 'db-srv-01', 'T1210', 'rule-based-v1', true)
ON CONFLICT DO NOTHING;

-- Attack Paths
INSERT INTO attack_paths (org_id, start_asset_id, target_asset_id, path_nodes, path_edges, required_conditions, related_vulnerabilities, mitre_techniques, path_length, likelihood, estimated_impact, path_risk, recommended_control, is_simulated) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', '[{"id":"web-srv-01","type":"web_server","ip":"10.10.0.80"},{"id":"db-srv-01","type":"database","ip":"10.10.0.90"}]', '[{"from":"web-srv-01","to":"db-srv-01","port":5432,"relationship":"CAN_REACH"}]', '["SSH brute force success","DB service reachable from web server"]', '["CVE-2024-3094","CVE-2024-1086"]', '["T1110","T1210"]', 2, 0.74, 'Database compromise - data exfiltration or destruction', 82, 'Firewall rule blocking port 5432 between DMZ and core network', true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', '[{"id":"web-srv-01","type":"web_server","ip":"10.10.0.80"},{"id":"dc-01","type":"domain_controller","ip":"10.10.0.5"}]', '[{"from":"web-srv-01","to":"dc-01","port":389,"relationship":"CAN_REACH"}]', '["SSH brute force success","LDAP service exposed"]', '["CVE-2024-3094"]', '["T1110","T1021"]', 2, 0.62, 'Domain controller compromise - full domain takeover', 92, 'Restrict LDAP access from DMZ segment', true),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '[{"id":"emp-ws-01","type":"workstation","ip":"10.10.0.15"},{"id":"dc-01","type":"domain_controller","ip":"10.10.0.5"}]', '[{"from":"emp-ws-01","to":"dc-01","port":88,"relationship":"AUTHENTICATES_TO"}]', '["Phishing success","User credentials obtained"]', '[]', '["T1566","T1078"]', 2, 0.45, 'Domain controller access via stolen user credentials', 78, 'Enable MFA on all user accounts', true)
ON CONFLICT DO NOTHING;

-- Simulations
INSERT INTO simulations (id, org_id, scenario_name, entry_point, initial_asset_id, target_asset_id, assumptions, mitre_techniques, status, successful_steps, blocked_steps, estimated_impact, recommended_mitigations, business_impact, probability, started_by, is_simulated) VALUES
('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'SSH Brute Force to Database Compromise', 'Internet-exposed SSH on web-srv-01', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', '["SSH service exposed to internet","Weak password policy","No MFA on SSH","DB reachable from web server"]', '["T1110","T1078","T1210"]', 'completed', 3, 0, 'Database compromise with potential data exfiltration affecting 50K+ customer records', '["Disable SSH root login","Implement SSH key authentication","Segment DMZ from core","Enable database access logging"]', 'High - potential regulatory fines and reputation damage', 0.74, 'soc-analyst', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO simulation_steps (simulation_id, step_number, asset_id, asset_name, action, mitre_technique, probability, result, controls_encountered, description) VALUES
('40000000-0000-0000-0000-000000000001', 1, 'b0000000-0000-0000-0000-000000000003', 'web-srv-01', 'SSH Brute Force', 'T1110', 0.85, 'success', '[]', 'Brute force attack against SSH service succeeded after 5 attempts'),
('40000000-0000-0000-0000-000000000001', 2, 'b0000000-0000-0000-0000-000000000003', 'web-srv-01', 'Establish Persistence', 'T1053', 0.7, 'success', '[]', 'Created scheduled task for persistence on web-srv-01'),
('40000000-0000-0000-0000-000000000001', 3, 'b0000000-0000-0000-0000-000000000005', 'db-srv-01', 'Lateral Movement to Database', 'T1210', 0.74, 'success', '[]', 'Used compromised web server to connect to database on port 5432')
ON CONFLICT DO NOTHING;
