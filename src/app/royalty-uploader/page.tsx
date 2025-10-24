"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import Papa from "papaparse";
import { Upload, Edit, Trash2, LogOut } from "lucide-react";

interface RoyaltyRecord {
  id: string;
  song_title: string;
  iswc: string;
  song_composers: string;
  broadcast_date: string;
  territory: string;
  exploitation_source_name: string;
  usage_count: number;
  gross_amount: number;
  administration_percent: number;
  net_amount: number;
  created_at: string;
}

export default function RoyaltyUploaderPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [royalties, setRoyalties] = useState<RoyaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RoyaltyRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<RoyaltyRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoyaltyRecord>>({});

  useEffect(() => {
    if (user) {
      fetchRoyalties();
    }
  }, [user]);

  const fetchRoyalties = async () => {
    try {
      const { data, error } = await supabase
        .from('royalties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoyalties(data || []);
    } catch (error) {
      console.error('Error fetching royalties:', error);
      toast({
        title: "Error",
        description: "Failed to fetch royalty data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const results = Papa.parse(text, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Map CSV headers to database columns
          const headerMap: { [key: string]: string } = {
            'Song Title': 'song_title',
            'ISWC': 'iswc',
            'Song Composer(s)': 'song_composers',
            'Broadcast Date': 'broadcast_date',
            'Territory': 'territory',
            'Exploitation Source Name': 'exploitation_source_name',
            'Usage Count': 'usage_count',
            'Gross Amount': 'gross_amount',
            'Administration %': 'administration_percent',
            'Net Amount': 'net_amount'
          };
          return headerMap[header] || header.toLowerCase().replace(/\s+/g, '_');
        }
      });

      if (results.errors.length > 0) {
        throw new Error('CSV parsing failed');
      }

      // Transform data for database
      const records = results.data.map((row: any) => ({
        user_id: user?.id,
        song_title: row.song_title || '',
        iswc: row.iswc || '',
        song_composers: row.song_composers || '',
        broadcast_date: row.broadcast_date ? new Date(row.broadcast_date).toISOString().split('T')[0] : null,
        territory: row.territory || '',
        exploitation_source_name: row.exploitation_source_name || '',
        usage_count: parseInt(row.usage_count) || 0,
        gross_amount: parseFloat(row.gross_amount) || 0,
        administration_percent: parseFloat(row.administration_percent) || 0,
        net_amount: parseFloat(row.net_amount) || 0,
      }));

      const { error } = await supabase
        .from('royalties')
        .insert(records);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully uploaded ${records.length} royalty records`,
      });

      fetchRoyalties();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload CSV file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (record: RoyaltyRecord) => {
    setEditingRecord(record);
    setEditForm(record);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from('royalties')
        .update(editForm)
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      setEditingRecord(null);
      setEditForm({});
      fetchRoyalties();
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update record",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;

    try {
      const { error } = await supabase
        .from('royalties')
        .delete()
        .eq('id', deleteRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record deleted successfully",
      });

      setDeleteRecord(null);
      fetchRoyalties();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete record",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Royalty Management Dashboard</h1>
              <p className="text-sm text-gray-600">Upload and manage royalty data securely by account.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
              <Button
                variant="outline"
                onClick={() => signOut()}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Upload CSV File</h2>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading && (
              <div className="text-sm text-gray-600">Uploading...</div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Upload a CSV file with royalty data. Make sure it includes columns for Song Title, ISWC, Song Composer(s), Broadcast Date, Territory, Exploitation Source Name, Usage Count, Gross Amount, Administration %, and Net Amount.
          </p>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Royalty Records ({royalties.length})</h2>
          </div>
          
          {royalties.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No royalty records found. Upload a CSV file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Song Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISWC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Composers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broadcast Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Territory</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {royalties.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.song_title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.iswc}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.song_composers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.broadcast_date ? formatDate(record.broadcast_date) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.territory}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.exploitation_source_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.usage_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(record.gross_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.administration_percent}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(record.net_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteRecord(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>
              Update the royalty record details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Song Title</label>
              <Input
                value={editForm.song_title || ''}
                onChange={(e) => setEditForm({...editForm, song_title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISWC</label>
              <Input
                value={editForm.iswc || ''}
                onChange={(e) => setEditForm({...editForm, iswc: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Composers</label>
              <Input
                value={editForm.song_composers || ''}
                onChange={(e) => setEditForm({...editForm, song_composers: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast Date</label>
              <Input
                type="date"
                value={editForm.broadcast_date || ''}
                onChange={(e) => setEditForm({...editForm, broadcast_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
              <Input
                value={editForm.territory || ''}
                onChange={(e) => setEditForm({...editForm, territory: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <Input
                value={editForm.exploitation_source_name || ''}
                onChange={(e) => setEditForm({...editForm, exploitation_source_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage Count</label>
              <Input
                type="number"
                value={editForm.usage_count || ''}
                onChange={(e) => setEditForm({...editForm, usage_count: parseInt(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gross Amount</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.gross_amount || ''}
                onChange={(e) => setEditForm({...editForm, gross_amount: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Administration %</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.administration_percent || ''}
                onChange={(e) => setEditForm({...editForm, administration_percent: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Net Amount</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.net_amount || ''}
                onChange={(e) => setEditForm({...editForm, net_amount: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteRecord} onOpenChange={() => setDeleteRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this royalty record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecord(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
