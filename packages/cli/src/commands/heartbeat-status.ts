import type { Configuration } from "@closeclaw/shared-types";

export interface HeartbeatStatusDeps {
  readConfig: () => Configuration | null;
}

export function runHeartbeatStatus(deps: HeartbeatStatusDeps): void {
  const config = deps.readConfig();
  if (!config) {
    console.error("Configuration not found. Run closeclaw onboard first.");
    return;
  }
  const hb = config.heartbeat;
  if (!hb || !hb.enabled) {
    console.log("Heartbeat: disabled");
    console.log("Run: closeclaw heartbeat configure");
    return;
  }
  console.log("Heartbeat: enabled");
  console.log(`  Interval: ${hb.every}`);
  console.log(`  Target: ${hb.target}`);
  if (hb.activeHours) {
    console.log(
      `  Active hours: ${hb.activeHours.start} - ${hb.activeHours.end}`,
    );
  }
  if (hb.timezone) {
    console.log(`  Timezone: ${hb.timezone}`);
  }
}
