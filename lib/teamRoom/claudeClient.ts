/**
 * lib/teamRoom/claudeClient.ts — SERVER ONLY. The one place the AI service is
 * called for the Team room's AI bots (lib/teamRoom/claudeBot.ts).
 *
 * The key is read from the server's settings (Vercel) and nowhere else. It is
 * never in the code, never sent to a browser and never written to a log.
 * The AI is given NO tools: it can only write words back.
 */
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_BOT, ownKeyName, type AiCall } from "./claudeBot";

/** The key for a bot: its owner's own key if they set one, else the shared one. Empty = that bot is off. */
export function keyFor(bot: string): { key: string | null; own: boolean } {
  const own = ownKeyName(bot) !== "ANTHROPIC_API_KEY" ? process.env[ownKeyName(bot)]?.trim() : "";
  if (own) return { key: own, own: true };
  return { key: process.env.ANTHROPIC_API_KEY?.trim() || null, own: false };
}

/** A plain reason, safe to show in the chat (never the service's own text, which could carry details). */
export class AiDown extends Error {
  constructor(public plain: string) { super(plain); }
}

/** The real call. One request, no tools, a short answer. */
export function realAi(key: string): AiCall {
  const client = new Anthropic({ apiKey: key, timeout: CLAUDE_BOT.timeoutMs, maxRetries: 1 });
  return async (req) => {
    try {
      const res = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        output_config: { effort: req.effort },
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      });
      // The answer is the text parts; the model's own thinking parts are left out.
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, stop: res.stop_reason };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiDown("the key in Vercel was refused. Check ANTHROPIC_API_KEY.");
      if (e instanceof Anthropic.RateLimitError) throw new AiDown("the AI service is busy. Ask again in a minute.");
      if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) throw new AiDown("the AI service did not accept the question.");
      if (e instanceof Anthropic.APIConnectionError) throw new AiDown("the AI service could not be reached. Ask again in a minute.");
      if (e instanceof Anthropic.APIError) throw new AiDown("the AI service had a problem. Ask again in a minute.");
      throw new AiDown("something went wrong on the site.");
    }
  };
}
