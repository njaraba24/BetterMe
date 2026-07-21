import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({ text: z.string().min(1).max(500) });

export const parseTaskNL = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const today = new Date().toISOString().slice(0, 10);
    const system = `You extract a task from a short natural language phrase.
Today is ${today}. Respond ONLY with strict JSON:
{"title": string, "due_date": string|null (YYYY-MM-DD), "priority": "low"|"medium"|"high"}
Infer due_date from words like "today", "tomorrow", "friday", "next monday", "in 3 days", "at 7am".
Priority defaults to "medium". Use "high" for urgent/asap/important, "low" for someday/whenever.
Title is a short imperative (strip the date/time words).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI gateway ${res.status}: ${errText.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; due_date?: string | null; priority?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { title: data.text };
    }
    const priority = (["low", "medium", "high"] as const).includes(parsed.priority as never)
      ? (parsed.priority as "low" | "medium" | "high")
      : "medium";
    return {
      title: (parsed.title ?? data.text).slice(0, 200),
      due_date: parsed.due_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date) ? parsed.due_date : null,
      priority,
    };
  });
