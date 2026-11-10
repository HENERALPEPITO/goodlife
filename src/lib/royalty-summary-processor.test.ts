import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processRoyaltySummary } from './royalty-summary-processor';

type WriteRecord = { table: string; op: 'insert' | 'upsert' | 'update' | 'delete' };

const writes: WriteRecord[] = [];

const mockTrackRows = [{ id: 'track-1', title: 'Song A' }];
const upsertSpy = vi.fn(async (rows: any[]) => ({ error: null, data: rows }));
let mockTracksRowCount = 1;

vi.mock('@/lib/supabaseAdmin', () => {
  const from = (table: string) => {
    const builder = {
      select: vi.fn((_columns?: string) => builder),
      eq: vi.fn((_col: string, _value: any) => builder),
      in: vi.fn(async (_col: string, _values: any[]) => {
        if (table === 'tracks') {
          return { data: mockTrackRows, error: null };
        }
        return { data: [], error: null };
      }),
      upsert: vi.fn(async (rows: any[]) => {
        writes.push({ table, op: 'upsert' });
        if (table === 'tracks') {
          mockTracksRowCount += Array.isArray(rows) ? rows.length : 1;
        }
        return upsertSpy(rows);
      }),
      insert: vi.fn(async () => {
        writes.push({ table, op: 'insert' });
        if (table === 'tracks') {
          mockTracksRowCount += 1;
        }
        return { data: null, error: null };
      }),
      update: vi.fn(async () => {
        writes.push({ table, op: 'update' });
        return { data: null, error: null };
      }),
      delete: vi.fn(async () => {
        writes.push({ table, op: 'delete' });
        return { data: null, error: null };
      }),
    };
    return builder;
  };

  return {
    getSupabaseAdmin: () => ({ from }),
  };
});

describe('processRoyaltySummary', () => {
  beforeEach(() => {
    writes.length = 0;
    upsertSpy.mockClear();
    mockTracksRowCount = mockTrackRows.length;
  });

  it('writes only to royalties_summary during royalties upload', async () => {
    const csv = [
      'Song Title,ISWC,Composer,Date,Territory,Source,Usage Count,Gross,Admin %,Net',
      'Song A,T-1,Composer A,2026-01-01,US,Spotify,100,100.00,10,90.00',
    ].join('\n');

    const result = await processRoyaltySummary({
      artistId: 'artist-1',
      year: 2026,
      quarter: 1,
      csvContent: csv,
    });

    expect(result.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(writes.every((w) => w.table === 'royalties_summary')).toBe(true);
  });

  it('does not create catalog records when track does not match', async () => {
    const csv = [
      'Song Title,ISWC,Composer,Date,Territory,Source,Usage Count,Gross,Admin %,Net',
      'Unknown Song,T-2,Composer B,2026-01-01,US,Spotify,50,40.00,10,36.00',
    ].join('\n');

    mockTrackRows.splice(0, mockTrackRows.length);

    const result = await processRoyaltySummary({
      artistId: 'artist-1',
      year: 2026,
      quarter: 1,
      csvContent: csv,
    });

    expect(result.success).toBe(true);
    expect(result.failedRows.length).toBe(0);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(writes.some((w) => w.table === 'tracks')).toBe(false);
  });

  it('keeps tracks row count unchanged for unmatched upload rows', async () => {
    const csv = [
      'Song Title,ISWC,Composer,Date,Territory,Source,Usage Count,Gross,Admin %,Net',
      'Not In Catalog,T-999,Composer Z,2026-02-01,PH,YouTube,5,9.00,10,8.10',
    ].join('\n');

    mockTrackRows.splice(0, mockTrackRows.length);
    mockTracksRowCount = 0;
    const beforeCount = mockTracksRowCount;

    const result = await processRoyaltySummary({
      artistId: 'artist-1',
      year: 2026,
      quarter: 1,
      csvContent: csv,
    });

    const afterCount = mockTracksRowCount;
    expect(result.success).toBe(true);
    expect(beforeCount).toBe(afterCount);
    expect(writes.filter((w) => w.table === 'tracks').length).toBe(0);
  });

  it('reads semicolon distributor statements (Amount as net, Exploitation Source Name, DD/MM dates)', async () => {
    const header = 'Distribution Number;Date From;Date To;Member Name;IPI;Song Title;Work Number;Song Code;ISWC;Song Composer(s);Territory;Exploitation Source Name;Exploitation Source Type;Exploitation Type;Usage Count;Mechanical Percentage Received;Performance Percentage Received;Gross Amount;P Income;M Income;Administration Amount;Amount;Artist;Production;Episode;Date From (MM/YYYY);Date To (MM/YYYY)';
    const csv = [
      header,
      '1026;01/04/2026;30/06/2026;GOOD LIFE MUSIC SL;1188979376;Song A;W1;W1;;GOOD LIFE MUSIC SL & X;AUSTRIA;Amazon;Amazon-AUSTRIA;digital;20;33.33;66.67;0.0406556689869;0.027;0.013;0.01219670069607;0.02845896829083;;;;01/07/2026;30/09/2026',
      '1026;01/04/2026;30/06/2026;GOOD LIFE MUSIC SL;1188979376;Song A;W1;W1;;GOOD LIFE MUSIC SL & X;BOLIVIA;Meta;Meta-BOLIVIA;digital;1;100;0;1.0754306588e-6;0;1.0754306588e-6;3.2262919764e-7;7.528014611599999e-7;;;;01/07/2026;30/09/2026',
    ].join('\n');

    mockTrackRows.splice(0, mockTrackRows.length, { id: 'track-1', title: 'Song A' });

    const result = await processRoyaltySummary({
      artistId: 'artist-1',
      year: 2026,
      quarter: 2,
      csvContent: csv,
    });

    expect(result.success).toBe(true);
    expect(result.failedRows.length).toBe(0);
    const [rows] = upsertSpy.mock.calls[0];
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.total_streams).toBe(21);
    expect(row.total_net).toBe('0.0284597211');
    expect(row.total_gross).toBe('0.0406567444');
    expect(row.top_platform).toBe('Amazon');
    expect(Object.keys(row.platform_distribution).sort()).toEqual(['Amazon', 'Meta']);
    expect(Object.keys(row.monthly_breakdown)).toEqual(['Apr']);
  });
});
