import { beforeEach, describe, expect, it, vi } from 'vitest';

type Write = { table: string; op: string; payload?: any };
const writes: Write[] = [];

const CSV = [
  'Distribution Number;Date From;Date To;Song Title;Territory;Exploitation Source Name;Usage Count;Gross Amount;Administration Amount;Amount;ISWC;Song Composer(s)',
  '1026;01/04/2026;30/06/2026;Song A;SPAIN;Spotify;10;1.00;0.30;0.70;;X',
  '1026;01/04/2026;30/06/2026;Not In Catalog;MEXICO;Amazon;5;0.50;0.15;0.35;;X',
].join('\n');

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'admin-1', user_metadata: { role: 'admin' } } },
        error: null,
      }),
    },
  }),
}));

vi.mock('@/lib/royalty-storage', () => ({
  downloadCsvFromStorage: async () => ({ success: true, data: new Blob([CSV]) }),
}));

vi.mock('@/lib/supabaseAdmin', () => {
  const from = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: async () => ({ data: table === 'tracks' ? [{ id: 'track-1', title: 'Song A' }] : [], error: null }),
      single: async () => ({ data: { id: 'upload-1' }, error: null }),
      insert: (payload: any) => {
        writes.push({ table, op: 'insert', payload });
        return builder;
      },
      update: (payload: any) => {
        writes.push({ table, op: 'update', payload });
        return builder;
      },
      upsert: async (payload: any) => {
        writes.push({ table, op: 'upsert', payload });
        return { data: payload, error: null };
      },
      delete: () => {
        writes.push({ table, op: 'delete' });
        return builder;
      },
      then: (resolve: any) => resolve({ data: null, error: null }),
    };
    return builder;
  };
  return { getSupabaseAdmin: () => ({ from }) };
});

import { POST } from './route';

function request(body: unknown) {
  return { json: async () => body } as any;
}

describe('POST /api/process-royalties-summary', () => {
  beforeEach(() => {
    writes.length = 0;
  });

  it('records the upload in csv_uploads and never writes to the track catalog', async () => {
    const res = await POST(request({
      artistId: 'artist-1',
      storagePath: 'admin-1/123-statement.csv',
      filename: 'statement.csv',
      fileSize: 1234,
      year: 2026,
      quarter: 2,
    }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.upload_id).toBe('upload-1');

    const tables = new Set(writes.map((w) => w.table));
    expect([...tables].sort()).toEqual(['csv_uploads', 'royalties_summary']);
    expect(writes.some((w) => w.table === 'tracks')).toBe(false);

    const created = writes.find((w) => w.table === 'csv_uploads' && w.op === 'insert');
    expect(created?.payload).toMatchObject({
      storage_path: 'admin-1/123-statement.csv',
      artist_id: 'artist-1',
      year: 2026,
      quarter: 2,
      processing_status: 'processing',
    });

    const completed = writes.find((w) => w.table === 'csv_uploads' && w.op === 'update');
    expect(completed?.payload).toMatchObject({ processing_status: 'completed', row_count: 2 });
  });
});
