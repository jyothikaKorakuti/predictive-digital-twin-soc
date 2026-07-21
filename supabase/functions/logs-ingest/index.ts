import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, X-Client-Info, Apikey",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Windows EventID -> normalized SOC severity + MITRE mapping
const EVENT_ID_MAP: Record<number, { severity: string; tactic?: string; technique?: string; action: string }> = {
  4624: { severity: "info", action: "Logon" },
  4625: { severity: "medium", tactic: "Credential Access", technique: "T1110", action: "Failed Logon" },
  4634: { severity: "info", action: "Logoff" },
  4648: { severity: "medium", tactic: "Credential Access", technique: "T1555", action: "Explicit Credential Logon" },
  4672: { severity: "low", action: "Privileged Logon" },
  4688: { severity: "info", action: "Process Created" },
  4697: { severity: "medium", tactic: "Persistence", technique: "T1543", action: "Service Installed" },
  4720: { severity: "medium", tactic: "Persistence", technique: "T1136", action: "User Account Created" },
  4726: { severity: "medium", tactic: "Defense Evasion", technique: "T1078", action: "User Account Deleted" },
  4732: { severity: "medium", tactic: "Persistence", technique: "T1098", action: "Member Added to Group" },
  1102: { severity: "critical", tactic: "Defense Evasion", technique: "T1070", action: "Audit Log Cleared" },
  // Sysmon
  1: { severity: "info", tactic: "Execution", technique: "T1059", action: "Process Created" },
  3: { severity: "low", tactic: "Command and Control", technique: "T1071", action: "Network Connection" },
  7: { severity: "low", tactic: "Defense Evasion", technique: "T1126", action: "Image Loaded DLL" },
  11: { severity: "info", tactic: "Collection", technique: "T1005", action: "File Created" },
  12: { severity: "low", action: "Registry Object Created" },
  13: { severity: "low", action: "Registry Value Set" },
  22: { severity: "low", tactic: "Command and Control", technique: "T1071", action: "DNS Query" },
};

// Suspicious PowerShell command-line patterns
const SUSPICIOUS_PSH_PATTERNS = [
  /-enc/i, /encodedcommand/i, /-e\s/i, /downloadstring/i, /invoke-expression/i,
  /iex\s/i, /net\.webclient/i, /start-bitstransfer/i, /frombase64string/i,
  /bypass/i, /-w\s+hidden/i, /noprofile/i, /hidden/i,
];

function isSuspiciousPowerShell(cmd: string | null): boolean {
  if (!cmd) return false;
  const lower = cmd.toLowerCase();
  return SUSPICIOUS_PSH_PATTERNS.some((p) => p.test(lower));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing X-Api-Key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate API key
    const keyHash = await sha256(apiKey);
    const { data: agent, error: agentErr } = await supabase
      .from("collector_agents")
      .select("id, org_id, name, hostname, status, events_ingested")
      .eq("api_key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Invalid or revoked API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const events: Record<string, unknown>[] = body.events ?? [];
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: "events array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = agent.org_id as string;
    const collectorHostname = (agent.hostname as string) || body.hostname || "unknown";
    const collectorVersion = (body.version as string) || null;

    const rows: Record<string, unknown>[] = [];
    const alertsToCreate: Record<string, unknown>[] = [];
    let suspiciousPsCount = 0;
    let failedLoginCount = 0;

    for (const evt of events) {
      const eventId = (evt.event_id as number) ?? null;
      const recordId = (evt.record_id as number) ?? null;
      const provider = (evt.provider as string) ?? evt.source_name ?? null;
      const channel = (evt.channel as string) ?? null;
      const hostname = (evt.hostname as string) ?? collectorHostname;
      const sourceName = provider || `windows:${channel || "security"}`;
      const username = (evt.username as string) ?? null;
      const srcIp = (evt.src_ip as string) ?? null;
      const processName = (evt.process_name as string) ?? null;
      const commandLine = (evt.command_line as string) ?? null;
      const rawLog = (evt.raw_log as string) ?? JSON.stringify(evt);

      const mapping = eventId ? EVENT_ID_MAP[eventId] : null;
      let severity = (evt.severity as string) ?? mapping?.severity ?? "info";
      const mitreTactic = (evt.mitre_tactic as string) ?? mapping?.tactic ?? null;
      const mitreTechnique = (evt.mitre_technique as string) ?? mapping?.technique ?? null;
      const eventAction = (evt.event_action as string) ?? mapping?.action ?? "Windows Event";

      // Suspicious PowerShell escalation
      if (processName && processName.toLowerCase().includes("powershell") && isSuspiciousPowerShell(commandLine)) {
        severity = "high";
        suspiciousPsCount++;
      }

      if (eventId === 4625) failedLoginCount++;
      if (eventId === 1102) severity = "critical";

      rows.push({
        org_id: orgId,
        event_timestamp: evt.event_timestamp ?? evt.timestamp ?? new Date().toISOString(),
        source_name: sourceName,
        source_type: "windows_event",
        hostname,
        src_ip: srcIp,
        dst_ip: evt.dst_ip ?? null,
        src_port: evt.src_port ?? null,
        dst_port: evt.dst_port ?? null,
        username,
        event_category: channel,
        event_action: eventAction,
        process_name: processName,
        process_id: evt.process_id ?? null,
        parent_process: evt.parent_process ?? null,
        command_line: commandLine,
        file_path: evt.file_path ?? null,
        message: evt.message ?? `${eventAction} (EventID ${eventId}) on ${hostname}`,
        severity,
        raw_log: rawLog,
        parser_name: "windows-evt-v1",
        mitre_tactic: mitreTactic,
        mitre_technique: mitreTechnique,
        confidence: evt.confidence ?? 0.85,
        is_simulated: false,
        record_id: recordId,
        event_id: eventId,
        provider,
        channel,
        log_level: evt.log_level ?? null,
      });
    }

    // Insert events (dedup via unique index on org_id, hostname, source_name, record_id)
    let inserted = 0;
    let duplicates = 0;
    const insertedEventIds: string[] = [];

    // Batch insert
    const { data: insertedRows, error: insertErr } = await supabase
      .from("events")
      .insert(rows)
      .select("id, event_id, hostname, username, severity, message, command_line, process_name");

    if (insertErr) {
      // If batch insert fails (e.g. some duplicates), fall back to individual inserts
      for (const row of rows) {
        const { data: singleRow, error: singleErr } = await supabase
          .from("events")
          .insert(row)
          .select("id")
          .maybeSingle();
        if (singleErr) {
          duplicates++;
        } else if (singleRow) {
          inserted++;
          insertedEventIds.push(singleRow.id);
        }
      }
    } else if (insertedRows) {
      inserted = insertedRows.length;
      for (const r of insertedRows) insertedEventIds.push(r.id);
    }

    // Generate alerts for suspicious patterns
    // 1. Audit log cleared (1102)
    const auditClearEvents = (insertedRows ?? []).filter((e) => e.event_id === 1102);
    for (const e of auditClearEvents) {
      alertsToCreate.push({
        org_id: orgId,
        title: "Windows Audit Log Cleared",
        description: `Security audit log was cleared on ${e.hostname}. This may indicate defense evasion.`,
        severity: "critical",
        status: "new",
        source: "windows-evt-v1",
        event_ids: [e.id],
        affected_asset: e.hostname,
        username: e.username,
        mitre_tactic: "Defense Evasion",
        mitre_technique: "T1070",
        confidence: 0.95,
        evidence: [{ type: "event_id", value: 1102, message: e.message }],
        comments: [],
        is_simulated: false,
      });
    }

    // 2. Suspicious PowerShell
    const suspiciousPsEvents = (insertedRows ?? []).filter(
      (e) => e.process_name && e.process_name.toLowerCase().includes("powershell") && isSuspiciousPowerShell(e.command_line as string | null),
    );
    if (suspiciousPsEvents.length > 0) {
      alertsToCreate.push({
        org_id: orgId,
        title: "Suspicious PowerShell Execution",
        description: `Encoded/hidden PowerShell command detected on ${suspiciousPsEvents[0].hostname}. Possible obfuscated script execution.`,
        severity: "high",
        status: "new",
        source: "windows-evt-v1",
        event_ids: suspiciousPsEvents.map((e) => e.id),
        affected_asset: suspiciousPsEvents[0].hostname,
        username: suspiciousPsEvents[0].username,
        mitre_tactic: "Execution",
        mitre_technique: "T1059",
        confidence: 0.85,
        evidence: suspiciousPsEvents.map((e) => ({ type: "command_line", value: e.command_line, message: e.message })),
        comments: [],
        is_simulated: false,
      });
    }

    // 3. Repeated failed logins (5+ in batch from same host/user)
    const failedLoginEvents = (insertedRows ?? []).filter((e) => e.event_id === 4625);
    if (failedLoginEvents.length >= 5) {
      const byUser: Record<string, typeof failedLoginEvents> = {};
      for (const e of failedLoginEvents) {
        const key = e.username || "unknown";
        (byUser[key] ??= []).push(e);
      }
      for (const [user, evts] of Object.entries(byUser)) {
        if (evts.length >= 5) {
          alertsToCreate.push({
            org_id: orgId,
            title: `Repeated Failed Logins: ${user}`,
            description: `${evts.length} failed login attempts for "${user}" on ${evts[0].hostname}. Possible brute-force attack.`,
            severity: "high",
            status: "new",
            source: "windows-evt-v1",
            event_ids: evts.map((e) => e.id),
            affected_asset: evts[0].hostname,
            username: user,
            mitre_tactic: "Credential Access",
            mitre_technique: "T1110",
            confidence: 0.8,
            evidence: evts.map((e) => ({ type: "event_id", value: 4625, message: e.message })),
            comments: [],
            is_simulated: false,
          });
        }
      }
    }

    // 4. Privileged account changes (4720 user created, 4732 group member added)
    const userCreated = (insertedRows ?? []).filter((e) => e.event_id === 4720);
    for (const e of userCreated) {
      alertsToCreate.push({
        org_id: orgId,
        title: "New User Account Created",
        description: `A new user account was created on ${e.hostname}: ${e.username}. Verify this is an authorized change.`,
        severity: "medium",
        status: "new",
        source: "windows-evt-v1",
        event_ids: [e.id],
        affected_asset: e.hostname,
        username: e.username,
        mitre_tactic: "Persistence",
        mitre_technique: "T1136",
        confidence: 0.7,
        evidence: [{ type: "event_id", value: 4720, message: e.message }],
        comments: [],
        is_simulated: false,
      });
    }

    // Insert alerts
    let alertsCreated = 0;
    if (alertsToCreate.length > 0) {
      const { error: alertErr } = await supabase.from("alerts").insert(alertsToCreate);
      if (!alertErr) alertsCreated = alertsToCreate.length;
    }

    // Update agent last_seen and event count
    await supabase
      .from("collector_agents")
      .update({
        last_seen_at: new Date().toISOString(),
        events_ingested: (agent.events_ingested ?? 0) + inserted,
        version: collectorVersion,
      })
      .eq("id", agent.id);

    return new Response(
      JSON.stringify({
        accepted: inserted,
        duplicates: duplicates,
        alerts_created: alertsCreated,
        suspicious_powershell: suspiciousPsCount,
        failed_logins: failedLoginCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
