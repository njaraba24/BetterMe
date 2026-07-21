import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};
type Profile = { id: string; display_name: string; email: string };

function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: friendships = [] } = useQuery<Friendship[]>({
    queryKey: ["friendships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("friendships").select("*");
      if (error) throw error;
      return (data as Friendship[]) ?? [];
    },
  });

  const otherIds = Array.from(
    new Set(friendships.map((f) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id))),
  );

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles", otherIds],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email")
        .in("id", otherIds);
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });

  const profileFor = (id: string) => profiles.find((p) => p.id === id);

  const send = useMutation({
    mutationFn: async (targetEmail: string) => {
      const trimmed = targetEmail.trim().toLowerCase();
      if (!trimmed) throw new Error("Enter an email");
      if (trimmed === user?.email?.toLowerCase()) throw new Error("You can't add yourself");
      const { data: found, error: findErr } = await supabase.rpc("find_user_id_by_email", {
        _email: trimmed,
      });
      if (findErr) throw findErr;
      if (!found) throw new Error("No Better Me user with that email");
      const existing = friendships.find(
        (f) =>
          (f.requester_id === user!.id && f.addressee_id === found) ||
          (f.addressee_id === user!.id && f.requester_id === found),
      );
      if (existing) throw new Error(existing.status === "accepted" ? "Already friends" : "Request already exists");
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user!.id, addressee_id: found, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmail("");
      toast.success("Friend request sent");
      qc.invalidateQueries({ queryKey: ["friendships"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) {
        const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friendships").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    onError: (e) => toast.error(e.message),
  });

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user?.id);
  const accepted = friendships.filter((f) => f.status === "accepted");

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add friends by email to share journal pages.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate(email);
        }}
        className="mt-6 flex gap-2"
      >
        <Input
          type="email"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={send.isPending}>
          <UserPlus className="mr-1 h-4 w-4" /> Add friend
        </Button>
      </form>

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Incoming requests ({incoming.length})
          </h2>
          <ul className="mt-2 divide-y rounded-lg border">
            {incoming.map((f) => {
              const p = profileFor(f.requester_id);
              return (
                <li key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{p?.display_name || p?.email || "…"}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respond.mutate({ id: f.id, accept: true })}>
                      <Check className="mr-1 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: f.id, accept: false })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Sent requests</h2>
          <ul className="mt-2 divide-y rounded-lg border">
            {outgoing.map((f) => {
              const p = profileFor(f.addressee_id);
              return (
                <li key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm">{p?.display_name || p?.email || "…"}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Friends ({accepted.length})
        </h2>
        {accepted.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No friends yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {accepted.map((f) => {
              const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
              const p = profileFor(otherId);
              return (
                <li key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{p?.display_name || p?.email || "…"}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove friend"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
