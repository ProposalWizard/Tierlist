"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_LENGTH = 500;

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setStatus("idle");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert([
      {
        message: trimmed,
        page_url: window.location.href,
        ...(user ? { user_id: user.id } : {}),
      },
    ]);

    setSending(false);

    if (error) {
      setStatus("error");
    } else {
      setStatus("success");
      setMessage("");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto text-center">
      <p className="text-xs font-medium text-white mb-2">
        Any Feedback Good or Bad is Very Appreciated!
      </p>

      <textarea
        value={message}
        onChange={(e) => {
          if (e.target.value.length <= MAX_LENGTH) setMessage(e.target.value);
        }}
        placeholder="Report a bug or suggest an improvement..."
        rows={2}
        className="w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
      />

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white">
          {message.trim().length}/{MAX_LENGTH}
        </span>

        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Sending..." : "Send Feedback"}
        </button>
      </div>

      {status === "success" && (
        <p className="mt-1.5 text-xs text-green-400">Thanks for the feedback!</p>
      )}
      {status === "error" && (
        <p className="mt-1.5 text-xs text-red-400">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
