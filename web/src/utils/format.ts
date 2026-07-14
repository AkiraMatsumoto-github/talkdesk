import type { Thread } from "../api/types";

export function formatBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${size}B`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "7/10 14:02" / 当日は "14:02" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = `${d.getHours()}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

/** "7/15" （dateはISO日付 or ISO日時） */
export function formatShortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function isOverdue(thread: Thread): boolean {
  if (thread.type !== "request" || !thread.dueDate || thread.status === "done") return false;
  const due = new Date(`${thread.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

/** 投稿から24時間以内か（FR-H7） */
export function within24h(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}
