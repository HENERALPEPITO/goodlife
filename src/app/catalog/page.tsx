"use client";
import { useEffect, useState } from "react";
import { Track } from "@/types";

export default function CatalogPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Track>>({ title: "", isrc: "", composers: "", releaseDate: "", platform: "Spotify", territory: "Global" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/catalog");
    const json = await res.json();
    setTracks(json.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTrack(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      await load();
      setForm({ title: "", isrc: "", composers: "", releaseDate: "", platform: "Spotify", territory: "Global" });
    }
  }

  async function deleteTrack(id: string) {
    await fetch(`/api/catalog/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>

      <form onSubmit={addTrack} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
        <input required placeholder="Song Title" className="px-3 py-2 rounded border bg-transparent" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="ISRC" className="px-3 py-2 rounded border bg-transparent" value={form.isrc || ""} onChange={(e) => setForm({ ...form, isrc: e.target.value })} />
        <input placeholder="Composers" className="px-3 py-2 rounded border bg-transparent" value={form.composers || ""} onChange={(e) => setForm({ ...form, composers: e.target.value })} />
        <input type="date" className="px-3 py-2 rounded border bg-transparent" value={form.releaseDate || ""} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
        <input placeholder="Platform" className="px-3 py-2 rounded border bg-transparent" value={form.platform || ""} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
        <input placeholder="Territory" className="px-3 py-2 rounded border bg-transparent" value={form.territory || ""} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
        <div className="md:col-span-3"><button className="px-3 py-2 text-sm rounded border hover:bg-zinc-100 dark:hover:bg-zinc-900">Add Track</button></div>
      </form>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">ISRC</th>
              <th className="p-3">Composers</th>
              <th className="p-3">Release Date</th>
              <th className="p-3">Platform</th>
              <th className="p-3">Territory</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={7}>Loading...</td></tr>
            ) : tracks.length === 0 ? (
              <tr><td className="p-3" colSpan={7}>No tracks</td></tr>
            ) : (
              tracks.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">{t.title}</td>
                  <td className="p-3">{t.isrc}</td>
                  <td className="p-3">{t.composers}</td>
                  <td className="p-3">{t.releaseDate}</td>
                  <td className="p-3">{t.platform}</td>
                  <td className="p-3">{t.territory}</td>
                  <td className="p-3 text-right">
                    <button className="text-red-600 hover:underline" onClick={() => deleteTrack(t.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


