import { createServer } from "node:http";
import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import type { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import {
  enqueueForSender,
  logAcceptedMessage,
  maybeSendPairingReply,
  runAgentResponse,
  resolvePermission,
  resolveCallbackDecision,
  type ToolProgressRef,
  type PermissionRef,
  type ApprovalRef,
  type OrchestrationPlanRef,
  type OrchestrationRunner,
} from "./gateway-agent-handler.js";
import type {
  WorkflowPlanCallbacks,
  WorkflowPlanRef,
} from "./workflow-plan-handler.js";
import {
  matchKeywordWorkflow,
  type KeywordTriggerCallback,
} from "./keyword-trigger.js";
import { routeRequest, type WebhookRouteConfig } from "./gateway-routes.js";
import { createDmPolicyEnforcer } from "./dm-policy-enforcer.js";
import {
  createPairingManager,
  type PairingManager,
} from "./pairing-manager.js";
import { listenWithPortFallback } from "./server-listen.js";

export type GatewayServerConfig = {
  port: number;
  authToken: string;
  adapters: BotAdapter[];
  pairingStorePath?: string;
  getDmSettings?: (platform: BotPlatform) => {
    dmPolicy: DmPolicy;
    allowedSenders?: string[];
  };
  messageProcessor?: {
    processMessage(
      platform: BotPlatform,
      senderId: string,
      text: string,
      senderDisplayName?: string,
    ): Promise<string>;
  };
  conversationStore?: {
    list(): Array<{
      platform: string;
      senderId: string;
      senderDisplayName?: string;
      messageCount: number;
      lastActivityAt: Date;
    }>;
  };
  toolProgressRef?: ToolProgressRef;
  permissionRef?: PermissionRef;
  approvalRef?: ApprovalRef;
  orchestrationPlanRef?: OrchestrationPlanRef;
  orchestrationRunner?: OrchestrationRunner;
  workflowStore?: {
    listWorkflows(
      platform: string,
      senderId: string,
    ): Array<{
      id: string;
      status: string;
      trigger: { type: string; value: string };
    }>;
  };
  onKeywordTrigger?: KeywordTriggerCallback;
  workflowPlanRef?: WorkflowPlanRef;
  workflowPlanCallbacks?: WorkflowPlanCallbacks;
};

export type GatewayServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
  address(): ReturnType<ReturnType<typeof createServer>["address"]>;
};

function parsePath(url: string | undefined): string {
  return url?.split("?")[0] ?? "";
}

function makeEnforcer(
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
  pm: PairingManager,
  platform: BotPlatform,
) {
  const { dmPolicy, allowedSenders } = resolver(platform);
  return createDmPolicyEnforcer({
    dmPolicy,
    allowedSenders,
    pairingManager: pm,
  });
}

function wireMessageHandlers(
  cfg: GatewayServerConfig,
  pairingManager: PairingManager,
): void {
  const resolver = cfg.getDmSettings;
  if (!resolver) return;
  for (const adapter of cfg.adapters) {
    const refs = {
      progress: cfg.toolProgressRef,
      permission: cfg.permissionRef,
      approval: cfg.approvalRef,
      orchestrationPlan: cfg.orchestrationPlanRef,
      orchestrationRunner: cfg.orchestrationRunner,
      workflowStore: cfg.workflowStore,
      onKeywordTrigger: cfg.onKeywordTrigger,
      workflowPlanRef: cfg.workflowPlanRef,
      workflowPlanCallbacks: cfg.workflowPlanCallbacks,
    };
    adapter.onMessage((msg: BotIncomingMessage) => {
      void handleAdapterMessage(
        adapter,
        pairingManager,
        msg,
        resolver,
        cfg.messageProcessor,
        refs,
      );
    });
    if (adapter.onCallbackQuery) {
      adapter.onCallbackQuery((query) => {
        const resolved = resolveCallbackDecision(query.senderId, query.data);
        if (resolved && adapter.answerCallbackQuery) {
          adapter.answerCallbackQuery(query.id, "Done").catch(() => {});
        }
      });
    }
  }
}

interface AdapterMsgRefs {
  progress?: ToolProgressRef;
  permission?: PermissionRef;
  approval?: ApprovalRef;
  orchestrationPlan?: OrchestrationPlanRef;
  orchestrationRunner?: OrchestrationRunner;
  workflowStore?: GatewayServerConfig["workflowStore"];
  onKeywordTrigger?: KeywordTriggerCallback;
  workflowPlanRef?: WorkflowPlanRef;
  workflowPlanCallbacks?: WorkflowPlanCallbacks;
}

async function handleAdapterMessage(
  adapter: BotAdapter,
  pm: PairingManager,
  msg: BotIncomingMessage,
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
  processor: GatewayServerConfig["messageProcessor"],
  refs: AdapterMsgRefs,
): Promise<void> {
  const enforcer = makeEnforcer(resolver, pm, msg.platform);
  const { allowed, pairingCode } = await enforcer.shouldAllow(
    msg.senderId,
    msg.platform,
  );
  if (!allowed)
    return maybeSendPairingReply(adapter, allowed, pairingCode, msg.senderId);
  if (resolvePermission(msg.senderId, msg.text)) return;
  logAcceptedMessage(msg);
  if (refs.workflowStore && refs.onKeywordTrigger) {
    const match = matchKeywordWorkflow(
      msg.text,
      refs.workflowStore,
      msg.platform,
      msg.senderId,
    );
    if (match) {
      await adapter.sendMessage(
        msg.senderId,
        `Running workflow **${match.trigger.value}**...`,
      );
      refs
        .onKeywordTrigger(match)
        .catch((err) =>
          console.error("[workflow] Keyword trigger error:", err),
        );
      return;
    }
  }
  if (!processor) return;
  enqueueForSender(`${msg.platform}:${msg.senderId}`, () =>
    runAgentResponse(
      adapter,
      processor,
      msg,
      refs.progress,
      refs.permission,
      refs.approval,
      refs.orchestrationPlan,
      refs.orchestrationRunner,
      refs.workflowPlanRef,
      refs.workflowPlanCallbacks,
    ),
  );
}

export function createGatewayServer(
  config: GatewayServerConfig,
): GatewayServer {
  const pairingManager = config.pairingStorePath
    ? createPairingManager(config.pairingStorePath)
    : undefined;
  if (pairingManager) wireMessageHandlers(config, pairingManager);
  const webhookCfg: WebhookRouteConfig | undefined = config.workflowStore
    ? { store: config.workflowStore, onTrigger: config.onKeywordTrigger }
    : undefined;
  const server = createServer((req, res) => {
    void routeRequest(
      req.method,
      parsePath(req.url),
      config.adapters,
      res,
      config.authToken,
      pairingManager,
      req,
      config.conversationStore,
      webhookCfg,
    ).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  const stop = () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  return {
    start: () => listenWithPortFallback(server, config.port),
    stop,
    address: () => server.address(),
  };
}
