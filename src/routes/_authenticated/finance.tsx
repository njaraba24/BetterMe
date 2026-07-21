import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
});

type Entry = { id: string; type: "income" | "expense"; amount: number; category: string; note: string | null; date: string };

function categoryColor(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % 360;
  return `oklch(0.92 0.05 ${h})`;
}

function FinancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_entries").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Entry[]) ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_entries").insert({
        user_id: user!.id, type, amount: Number(amount), category: category.trim(), note: note.trim() || null,
        date: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: () => { setAmount(""); setCategory(""); setNote(""); qc.invalidateQueries({ queryKey: ["finance"] }); },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("finance_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  const ms = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const me = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const monthEntries = entries.filter((e) => e.date >= ms && e.date <= me);
  const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Card label="Income" value={income} color="text-success" />
        <Card label="Expenses" value={expense} color="text-destructive" />
        <Card label="Balance" value={income - expense} color="" />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (Number(amount) > 0) add.mutate(); }}
        className="mt-6 grid grid-cols-[110px_1fr_1fr_1.5fr_auto] gap-2">
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(["income", "expense"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`rounded px-2 py-1 capitalize ${type === t ? "bg-muted" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
        <Input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="icon" type="submit"><Plus className="h-4 w-4" /></Button>
      </form>

      <ul className="mt-6 divide-y rounded-lg border">
        {entries.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No transactions.</li>}
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            {e.type === "income"
              ? <ArrowUp className="h-4 w-4 text-success" />
              : <ArrowDown className="h-4 w-4 text-destructive" />}
            {e.category && (
              <span className="rounded px-2 py-0.5 text-xs text-foreground" style={{ background: categoryColor(e.category) }}>
                {e.category}
              </span>
            )}
            <span className="flex-1 truncate text-muted-foreground">{e.note}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(e.date), "MMM d")}</span>
            <span className={`w-20 text-right font-medium ${e.type === "income" ? "text-success" : "text-destructive"}`}>
              {e.type === "income" ? "+" : "−"}{Number(e.amount).toFixed(2)}
            </span>
            <button onClick={() => del.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value.toFixed(2)}</div>
    </div>
  );
}
