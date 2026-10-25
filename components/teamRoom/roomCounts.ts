"use client";
/**
 * components/teamRoom/roomCounts.ts — the room's badges in one place, read by
 * the channel list, the Team board's side menu and the chat bubble
 * (lib/teamRoom/channels.ts roomCounts does the sums).
 */
import { useMemo } from "react";
import HEADLINES from "@/lib/patchNoteHeadlines.json";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { listChannels, patchBotPosts, roomCounts, rowBotPosts, jobBotPosts, type BotPost, type RoomCounts } from "@/lib/teamRoom/channels";
import { patchUnread, type PatchMeta } from "@/lib/teamRoom/extras";
import { newPushedJobs } from "@/lib/teamRoom/jobs";
import { useTeamRoom } from "@/lib/teamRoom/store";

export const PATCH_META: PatchMeta[] = HEADLINES.map((n) => ({ version: n.version, title: n.title, publishedAt: n.publishedAt }));

export function useRoomCounts(): RoomCounts {
  const s = useTeamRoom();
  const channels = useMemo(() => listChannels(s.channelRows), [s.channelRows]);
  return useMemo(() => roomCounts({
    messages: s.messages, me: s.me, reads: s.chRead, chatReadAt: s.read.chat, channels, dms: s.dms,
    patchToRead: s.me ? patchUnread(PATCH_META, s.me, s.acks, TEAM_ROOM.inboxFrom).length : 0,
    newJobs: newPushedJobs(s.jobs, s.tasks, s.me, s.seenJobs),
  }), [s.messages, s.me, s.chRead, s.read.chat, channels, s.dms, s.acks, s.jobs, s.tasks, s.seenJobs]);
}

/** Every bot post, by channel: the patch-notes bot, the jobs bot and any rows a future bot wrote. */
export function useBotPosts(): BotPost[] {
  const s = useTeamRoom();
  return useMemo(() => [...patchBotPosts(PATCH_META), ...jobBotPosts(s.jobs), ...rowBotPosts(s.botRows)], [s.jobs, s.botRows]);
}
