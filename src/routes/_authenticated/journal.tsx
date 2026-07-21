import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Share2, X, Search, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getSeenSharedIds, markSharedSeen, subscribeSharedSeen } from "@/lib/seen-shares";
import { RichEditor } from "@/components/rich-editor";

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

type Page = {
  id: string; user_id: string; title: string; content: string;
  date: string; updated_at: string; tags: string[]; mood: string | null;
};
type Friendship = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" };
type Profile = { id: string; display_name: string; email: string };
type Share = { id: string; page_id: string; owner_id: string; shared_with_id: string };

const MOODS = ["😄", "🙂", "😐", "😔", "😣", "😴", "🔥", "💡"];

function JournalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPageId, setDraftPageId] = useState<string | null>(null);
  const [draftIsOwner, setDraftIsOwner] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<{
    pageId: string | null;
    isOwner: boolean;
    title: string;
    content: string;
    tags: string[];
    mood: string | null;
    dirty: boolean;
  }>({ pageId: null, isOwner: false, title: "", content: "", tags: [], mood: null, dirty: false });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["journal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_pages").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Page[]) ?? [];
    },
  });

  const q = search.trim().toLowerCase();
  const matches = (p: Page) => !q
    || p.title.toLowerCase().includes(q)
    || p.content.toLowerCase().includes(q)
    || (p.tags ?? []).some((t) => t.toLowerCase().includes(q));

  const myPages = pages.filter((p) => p.user_id === user?.id && matches(p));
  const sharedPages = pages.filter((p) => p.user_id !== user?.id && matches(p));

  const selected = pages.find((p) => p.id === selectedId) ?? null;
  const isOwner = selected?.user_id === user?.id;
  const parsedTags = useMemo(() => tagsInput.split(",").map((t) => t.trim()).filter(Boolean), [tagsInput]);
  const isDraftLoaded = !!selected && draftPageId === selected.id;
  const isDirty = isDraftLoaded && draftIsOwner && (
    title !== selected.title ||
    content !== selected.content ||
    JSON.stringify(parsedTags) !== JSON.stringify(selected.tags ?? []) ||
    (mood ?? null) !== (selected.mood ?? null)
  );

  latestDraftRef.current = {
    pageId: draftPageId,
    isOwner: draftIsOwner,
    title,
    content,
    tags: parsedTags,
    mood,
    dirty: isDirty,
  };

  const loadDraft = useCallback((page: Page | null) => {
    setDraftPageId(page?.id ?? null);
    setDraftIsOwner(page?.user_id === user?.id);
    setTitle(page?.title ?? "");
    setContent(page?.content ?? "");
    setTagsInput((page?.tags ?? []).join(", "));
    setMood(page?.mood ?? null);
    setSaveState(page ? "saved" : "idle");
  }, [user?.id]);

  useEffect(() => {
    if (!selected) {
      loadDraft(null);
      return;
    }
    if (draftPageId !== selected.id || !isDirty) {
      loadDraft(selected);
    }
  }, [selected?.id, selected?.updated_at]); // eslint-disable-line

  const [seenTick, setSeenTick] = useState(0);
  useEffect(() => subscribeSharedSeen(() => setSeenTick((n) => n + 1)), []);
  const seenSet = getSeenSharedIds();
  void seenTick;
  useEffect(() => {
    if (selectedId && selected && selected.user_id !== user?.id) {
      markSharedSeen(selectedId);
    }
  }, [selectedId, selected, user?.id]);

  const savePage = useCallback(async (
    pageId = latestDraftRef.current.pageId,
    nextTitle = latestDraftRef.current.title,
    nextContent = latestDraftRef.current.content,
    nextTags = latestDraftRef.current.tags,
    nextMood = latestDraftRef.current.mood,
    showToast = false,
  ) => {
    if (!pageId || !latestDraftRef.current.isOwner) return;
    setSaveState("saving");
    const { error } = await supabase.from("journal_pages")
      .update({ title: nextTitle, content: nextContent, tags: nextTags, mood: nextMood })
      .eq("id", pageId);
    if (error) {
      setSaveState("error");
      toast.error(error.message);
      return;
    }
    setSaveState("saved");
    if (showToast) toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["journal"] });
  }, [qc]);

  useEffect(() => {
    if (!draftPageId || !isDirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("idle");
    debounceRef.current = setTimeout(() => {
      savePage();
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draftPageId, isDirty, savePage]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const draft = latestDraftRef.current;
      if (draft.dirty && draft.pageId && draft.isOwner) {
        void supabase.from("journal_pages")
          .update({ title: draft.title, content: draft.content, tags: draft.tags, mood: draft.mood })
          .eq("id", draft.pageId);
      }
    };
  }, []);

  const selectPage = (id: string | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const draft = latestDraftRef.current;
    if (draft.dirty) void savePage(draft.pageId, draft.title, draft.content, draft.tags, draft.mood);
    loadDraft(pages.find((p) => p.id === id) ?? null);
    setSelectedId(id);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("journal_pages").insert({
        user_id: user!.id, title: "Untitled", content: "", date: format(new Date(), "yyyy-MM-dd"),
      }).select().single();
      if (error) throw error;
      return data as Page;
    },
    onSuccess: (p) => {
      qc.setQueryData<Page[]>(["journal"], (old = []) => [p, ...old.filter((page) => page.id !== p.id)]);
      loadDraft(p);
      setSelectedId(p.id);
      qc.invalidateQueries({ queryKey: ["journal"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("journal_pages").delete().eq("id", id); if (error) throw error; },
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ["journal"] }); if (selectedId === id) setSelectedId(null); },
  });

  const ownerIds = useMemo(() => Array.from(new Set(sharedPages.map((p) => p.user_id))), [sharedPages]);
  const { data: ownerProfiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles", ownerIds],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,email").in("id", ownerIds);
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });
  const ownerName = (id: string) => {
    const p = ownerProfiles.find((x) => x.id === id);
    return p?.display_name || p?.email || "Someone";
  };

  return (
    <div className="-mx-4 -my-6 sm:-mx-8 sm:-my-10 grid h-[calc(100vh-3rem)] sm:h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className={`flex-col border-r bg-muted/40 ${selected ? "hidden md:flex" : "flex"}`}>

        <div className="flex items-center justify-between border-b px-3 py-3">
          <h2 className="text-sm font-medium">Pages</h2>
          <Button size="icon" variant="ghost" onClick={() => create.mutate()}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto py-1">
          {myPages.length === 0 && <li className="px-3 py-4 text-xs text-muted-foreground">No pages.</li>}
          {myPages.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => selectPage(p.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${selectedId === p.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
              >
                {p.mood && <span className="text-sm">{p.mood}</span>}
                <span className="flex-1 truncate">{p.title || "Untitled"}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(p.date), "MMM d")}</span>
              </button>
            </li>
          ))}

          {sharedPages.length > 0 && (
            <>
              <li className="mt-3 flex items-center justify-between px-3 pb-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Shared with me
                </span>
                {sharedPages.filter((p) => !seenSet.has(p.id)).length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {sharedPages.filter((p) => !seenSet.has(p.id)).length}
                  </span>
                )}
              </li>
              {sharedPages.map((p) => {
                const unseen = !seenSet.has(p.id);
                return (
                <li key={p.id}>
                  <button
                    onClick={() => selectPage(p.id)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-sm ${selectedId === p.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      {unseen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className={`flex-1 truncate ${unseen ? "font-medium text-foreground" : ""}`}>{p.title || "Untitled"}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">by {ownerName(p.user_id)}</span>
                  </button>
                </li>
                );
              })}
            </>
          )}
        </ul>
      </aside>

      <section className={`flex-col overflow-y-auto ${selected ? "flex" : "hidden md:flex"}`}>
        {selected ? (
          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 py-6 sm:px-10 sm:py-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => selectPage(null)}
                  className="md:hidden rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  ← Pages
                </button>
                <div className="truncate text-xs text-muted-foreground">
                  {format(new Date(selected.date), "MMM d, yyyy")}
                  {!isOwner && <span className="ml-2">· by {ownerName(selected.user_id)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isOwner && (
                  <>
                    <span className="mr-1 text-xs text-muted-foreground">
                      {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : isDirty ? "Unsaved" : "Saved"}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => void savePage(undefined, undefined, undefined, undefined, undefined, true)} disabled={!isDirty || saveState === "saving"}>
                      <Save className="mr-1 h-4 w-4" /> Save
                    </Button>
                  </>
                )}
                {isOwner && (
                  <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Share2 className="mr-1 h-4 w-4" /> Share
                      </Button>
                    </DialogTrigger>
                    <ShareDialog pageId={selected.id} onClose={() => setShareOpen(false)} />
                  </Dialog>
                )}
                {isOwner && (
                  <button onClick={() => del.mutate(selected.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              readOnly={!isOwner}
              className="mt-4 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Mood:</span>
                {MOODS.map((m) => (
                  <button
                    key={m}
                    disabled={!isOwner}
                    onClick={() => setMood(mood === m ? null : m)}
                    className={`rounded px-1 text-base transition ${mood === m ? "bg-muted" : "opacity-60 hover:opacity-100"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-muted-foreground">Tags:</span>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  readOnly={!isOwner}
                  placeholder="comma, separated"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <RichEditor
              key={selected.id}
              value={content}
              onChange={setContent}
              editable={!!isOwner}
            />

            <Comments pageId={selected.id} />
          </div>

        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a page or create a new one.
          </div>
        )}
      </section>
    </div>
  );
}

function ShareDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: friendships = [] } = useQuery<Friendship[]>({
    queryKey: ["friendships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("friendships").select("*").eq("status", "accepted");
      if (error) throw error;
      return (data as Friendship[]) ?? [];
    },
  });

  const friendIds = friendships.map((f) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id));

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles", friendIds],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,email").in("id", friendIds);
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });

  const { data: shares = [] } = useQuery<Share[]>({
    queryKey: ["shares", pageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_shares").select("*").eq("page_id", pageId);
      if (error) throw error;
      return (data as Share[]) ?? [];
    },
  });

  const share = useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.from("journal_shares").insert({
        page_id: pageId, owner_id: user!.id, shared_with_id: friendId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shared"); qc.invalidateQueries({ queryKey: ["shares", pageId] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const unshare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase.from("journal_shares").delete().eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares", pageId] }),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Share this page</DialogTitle></DialogHeader>
      {friendIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no friends yet. Add one from the Friends page.</p>
      ) : (
        <ul className="divide-y">
          {friendIds.map((fid) => {
            const p = profiles.find((x) => x.id === fid);
            const existing = shares.find((s) => s.shared_with_id === fid);
            return (
              <li key={fid} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{p?.display_name || p?.email || "…"}</div>
                  <div className="text-xs text-muted-foreground">{p?.email}</div>
                </div>
                {existing ? (
                  <Button size="sm" variant="ghost" onClick={() => unshare.mutate(existing.id)}>
                    <X className="mr-1 h-4 w-4" /> Unshare
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => share.mutate(fid)} disabled={share.isPending}>Share</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </DialogContent>
  );
}

type CommentRow = { id: string; page_id: string; user_id: string; content: string; created_at: string };

function Comments({ pageId }: { pageId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [] } = useQuery<CommentRow[]>({
    queryKey: ["journal_comments", pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_comments")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as CommentRow[]) ?? [];
    },
  });

  const authorIds = useMemo(() => Array.from(new Set(comments.map((c) => c.user_id))), [comments]);
  const { data: authors = [] } = useQuery<Profile[]>({
    queryKey: ["profiles", "comment-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,email").in("id", authorIds);
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });
  const nameOf = (id: string) => {
    if (id === user?.id) return "You";
    const p = authors.find((x) => x.id === id);
    return p?.display_name || p?.email || "Someone";
  };

  const add = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) return;
      const { error } = await supabase.from("journal_comments").insert({
        page_id: pageId, user_id: user!.id, content: body,
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["journal_comments", pageId] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal_comments", pageId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Comments {comments.length > 0 && <span className="ml-1 text-muted-foreground/70">({comments.length})</span>}
      </h3>
      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="text-xs text-muted-foreground">No comments yet.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="group flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {nameOf(c.user_id).slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">{nameOf(c.user_id)}</span>
                <span className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                {c.user_id === user?.id && (
                  <button
                    onClick={() => del.mutate(c.id)}
                    className="ml-auto opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.content}</p>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || add.isPending}>Post</Button>
      </form>
    </div>
  );
}
