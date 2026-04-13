import { Agent as HttpsAgent } from "node:https";
import { get as httpsGet } from "node:https";

const dohCache = new Map<string, { ip: string; expiresAt: number }>();
const DOH_CACHE_TTL_MS = 120_000;

function resolveViaDoh(hostname: string): Promise<string> {
  const cached = dohCache.get(hostname);
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.ip);
  return new Promise((resolve, reject) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`;
    httpsGet(url, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(body) as {
            Answer?: Array<{ type: number; data: string }>;
          };
          const aRecord = json.Answer?.find((r) => r.type === 1);
          if (!aRecord) {
            reject(new Error(`DoH: no A record for ${hostname}`));
            return;
          }
          dohCache.set(hostname, {
            ip: aRecord.data,
            expiresAt: Date.now() + DOH_CACHE_TTL_MS,
          });
          resolve(aRecord.data);
        } catch {
          reject(new Error(`DoH: failed to parse response for ${hostname}`));
        }
      });
    }).on("error", (err) => reject(err));
  });
}

export function createPublicDnsAgent(): HttpsAgent {
  return new HttpsAgent({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      resolveViaDoh(hostname).then(
        (ip) => {
          const all =
            typeof options === "object" &&
            options !== null &&
            "all" in options &&
            options.all;
          if (all) {
            callback(null, [{ address: ip, family: 4 }] as never);
          } else {
            callback(null, ip, 4);
          }
        },
        (err) => callback(err),
      );
    },
  });
}
