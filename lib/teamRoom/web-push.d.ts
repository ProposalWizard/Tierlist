/**
 * The few parts of the `web-push` package (pinned 3.6.7) the Team room uses
 * (lib/teamRoom/notifyServer.ts). The package ships no types of its own.
 */
declare module "web-push" {
  interface PushSubscription { endpoint: string; keys: { p256dh: string; auth: string } }
  interface RequestOptions {
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    timeout?: number;
    proxy?: string;
    headers?: Record<string, string>;
  }
  interface SendResult { statusCode: number; body: string; headers: Record<string, string> }
  class WebPushError extends Error { statusCode: number; body: string; endpoint: string }
  function sendNotification(sub: PushSubscription, payload?: string | Buffer | null, options?: RequestOptions): Promise<SendResult>;
  function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  const webpush: { sendNotification: typeof sendNotification; generateVAPIDKeys: typeof generateVAPIDKeys; WebPushError: typeof WebPushError };
  export default webpush;
  export { sendNotification, generateVAPIDKeys, WebPushError };
}
