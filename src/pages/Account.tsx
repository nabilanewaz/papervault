import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { paperService } from '@/services/paperService';
import { collectionService, Collection } from '@/services/collectionService';
import { localStorageService } from '@/services/localStorageService';
import { Paper } from '@/types/paper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, User, Mail, BookOpen, CheckCircle, Clock, BookMarked,
  Code, Folder, HardDrive, LogOut, Trash2, ExternalLink, Download,
  Edit2, Save, X, Shield, Calendar, TrendingUp, BarChart3,
  FileText, Star, Wifi, WifiOff,
} from 'lucide-react';
import { isSupabaseOffline } from '@/lib/supabase';
import { indexedDBService } from '@/services/indexedDBService';

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return (email?.[0] ?? 'U').toUpperCase();
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Paper['status'] }) {
  const map: Record<Paper['status'], { label: string; className: string }> = {
    'to-read':  { label: 'To Read',   className: 'bg-blue-100 text-blue-700' },
    'reading':  { label: 'Reading',   className: 'bg-amber-100 text-amber-700' },
    'completed':{ label: 'Completed', className: 'bg-green-100 text-green-700' },
  };
  const { label, className } = map[status] ?? map['to-read'];
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>{label}</span>;
}

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [paperFilter, setPaperFilter] = useState<'all' | 'to-read' | 'reading' | 'completed'>('all');

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const storageInfo = localStorageService.getStorageInfo();
  const offline = isSupabaseOffline();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        paperService.getAllPapers(),
        collectionService.getAllCollections(),
      ]);
      setPapers(p);
      setCollections(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    load();
  }, [user, load, navigate]);

  useEffect(() => {
    setNameInput(user?.name ?? '');
  }, [user]);

  const stats = {
    total:     papers.length,
    toRead:    papers.filter(p => p.status === 'to-read').length,
    reading:   papers.filter(p => p.status === 'reading').length,
    completed: papers.filter(p => p.status === 'completed').length,
    withCode:  papers.filter(p => p.has_code || p.code_url).length,
    withPdf:   papers.filter(p => p.pdf_url).length,
  };

  const mostRecentPaper = papers.length
    ? papers.reduce((a, b) => (a.updated_at ?? '') > (b.updated_at ?? '') ? a : b)
    : null;

  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const filteredPapers = paperFilter === 'all'
    ? papers
    : papers.filter(p => p.status === paperFilter);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out successfully' });
    navigate('/');
  };

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    // Update local user record
    const stored = localStorage.getItem('research_auth_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        localStorage.setItem('research_auth_user', JSON.stringify({ ...u, name: nameInput.trim() }));
      } catch { /* ignore */ }
    }
    toast({ title: 'Display name updated' });
    setEditingName(false);
    // Reload page to reflect name change via AuthContext
    window.location.reload();
  };

  const handleChangePassword = () => {
    if (passwordInput.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return;
    }
    if (passwordInput !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    toast({ title: 'Password change requires re-authentication', description: 'Please sign out and sign back in to reset your password.', variant: 'destructive' });
    setEditingPassword(false);
    setPasswordInput('');
    setConfirmPassword('');
  };

  const handleClearAllData = () => {
    if (!confirm('This will permanently delete all your locally-stored papers and settings. This cannot be undone. Continue?')) return;
    localStorage.clear();
    toast({ title: 'All local data cleared' });
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
          </Button>
          <span className="font-semibold text-lg tracking-wide">My Account</span>
          <div className="flex items-center gap-1 text-xs text-white/60">
            {offline ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
            {offline ? 'Offline' : 'Online'}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Profile card */}
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
              {/* Avatar */}
              <div className="h-20 w-20 rounded-full bg-indigo-700 border-4 border-white flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                {getInitials(user.name, user.email)}
              </div>
              <div className="flex-1 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{user.name || 'Unnamed User'}</h1>
                  <Badge variant="outline" className={`text-xs ${user.isLocal ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-green-300 text-green-700 bg-green-50'}`}>
                    {user.isLocal ? 'Local Account' : 'Cloud Account'}
                  </Badge>
                </div>
                <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {user.email}
                </p>
              </div>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="papers">Papers ({stats.total})</TabsTrigger>
            <TabsTrigger value="collections">Collections ({collections.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 mt-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: BookOpen,    label: 'Total',     value: stats.total,     color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { icon: BookMarked,  label: 'To Read',   value: stats.toRead,    color: 'text-blue-600',   bg: 'bg-blue-50' },
                { icon: Clock,       label: 'Reading',   value: stats.reading,   color: 'text-amber-600',  bg: 'bg-amber-50' },
                { icon: CheckCircle, label: 'Completed', value: stats.completed, color: 'text-green-600',  bg: 'bg-green-50' },
                { icon: Code,        label: 'Has Code',  value: stats.withCode,  color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: FileText,    label: 'Has PDF',   value: stats.withPdf,   color: 'text-rose-600',   bg: 'bg-rose-50' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <Card key={label} className="border-0 shadow-sm text-center">
                  <CardContent className="py-4 px-2">
                    <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Completion progress */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" /> Reading Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{stats.completed} of {stats.total} papers completed</span>
                  <span className="font-semibold">{completionPct}%</span>
                </div>
                <Progress value={completionPct} className="h-2" />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'To Read',   value: stats.toRead,    pct: stats.total ? (stats.toRead / stats.total) * 100 : 0,    color: 'bg-blue-400' },
                    { label: 'Reading',   value: stats.reading,   pct: stats.total ? (stats.reading / stats.total) * 100 : 0,   color: 'bg-amber-400' },
                    { label: 'Completed', value: stats.completed, pct: stats.total ? (stats.completed / stats.total) * 100 : 0, color: 'bg-green-400' },
                  ].map(({ label, value, pct, color }) => (
                    <div key={label} className="text-center p-2 bg-gray-50 rounded-lg">
                      <div className={`h-1.5 rounded-full ${color} mb-2`} style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }} />
                      <p className="text-lg font-bold text-gray-800">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Account info + most recent paper */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-500" /> Account Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium">{user.name || '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium truncate max-w-[60%] text-right">{user.email}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account type</span>
                    <span className="font-medium">{user.isLocal ? 'Local / Offline' : 'Cloud (Supabase)'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Collections</span>
                    <span className="font-medium">{collections.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-500" /> Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last active paper</span>
                    <span className="font-medium truncate max-w-[55%] text-right text-indigo-600">
                      {mostRecentPaper
                        ? mostRecentPaper.title.split(' ').slice(0, 5).join(' ') + (mostRecentPaper.title.split(' ').length > 5 ? '…' : '')
                        : '—'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last updated</span>
                    <span className="font-medium">{formatDate(mostRecentPaper?.updated_at)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Papers with code</span>
                    <span className="font-medium">{stats.withCode}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">PDFs available</span>
                    <span className="font-medium">{stats.withPdf}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Storage */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-indigo-500" /> Local Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{formatBytes(storageInfo.used)} used</span>
                  <span>of {formatBytes(storageInfo.available)}</span>
                </div>
                <Progress value={storageInfo.percentage} className="h-2" />
                <p className="text-xs text-gray-400">{storageInfo.percentage}% of browser local storage used</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Papers ───────────────────────────────────────── */}
          <TabsContent value="papers" className="mt-4 space-y-4">
            {/* Status filter pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'to-read', 'reading', 'completed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPaperFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    paperFilter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? `All (${stats.total})` :
                   f === 'to-read' ? `To Read (${stats.toRead})` :
                   f === 'reading' ? `Reading (${stats.reading})` :
                   `Completed (${stats.completed})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading papers…</div>
            ) : filteredPapers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No papers in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPapers.map(paper => (
                  <Card key={paper.id} className="border-0 shadow-sm hover:shadow-md transition">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 leading-snug">
                              {paper.title}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {paper.authors.slice(0, 3).join(', ')}
                            {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                            {paper.year && ` · ${paper.year}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <StatusBadge status={paper.status} />
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{paper.source}</span>
                            {paper.has_code && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                                <Code className="h-2.5 w-2.5" /> Has Code
                              </span>
                            )}
                            {paper.citations && paper.citations > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 flex items-center gap-1">
                                <Star className="h-2.5 w-2.5" /> {paper.citations.toLocaleString()}
                              </span>
                            )}
                            {paper.collection_id && (() => {
                              const col = collections.find(c => c.id === paper.collection_id);
                              return col ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 flex items-center gap-1">
                                  <Folder className="h-2.5 w-2.5" /> {col.name}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {paper.pdf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600"
                              title="Download PDF"
                              onClick={async () => {
                                if (paper.pdf_url!.startsWith('idb://')) {
                                  const blob = await indexedDBService.getPDF(paper.pdf_url!.replace('idb://', ''));
                                  if (!blob) return;
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url; a.download = `${paper.title}.pdf`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } else {
                                  window.open(paper.pdf_url!, '_blank');
                                }
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {paper.url && (
                            <a href={paper.url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Collections ──────────────────────────────────── */}
          <TabsContent value="collections" className="mt-4 space-y-3">
            {collections.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No collections yet</p>
                <p className="text-sm mt-1">Create collections from the main library to organize your papers.</p>
              </div>
            ) : (
              collections.map(col => {
                const colPapers = papers.filter(p => p.collection_id === col.id);
                const completed = colPapers.filter(p => p.status === 'completed').length;
                const pct = colPapers.length > 0 ? Math.round((completed / colPapers.length) * 100) : 0;
                return (
                  <Card key={col.id} className="border-0 shadow-sm hover:shadow-md transition">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: col.color || '#6366f1' }}
                        >
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-900">{col.name}</h3>
                            <span className="text-sm text-gray-500 flex-shrink-0">{colPapers.length} papers</span>
                          </div>
                          {col.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{col.description}</p>
                          )}
                          {colPapers.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{completed} completed</span>
                                <span>{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── Settings ─────────────────────────────────────── */}
          <TabsContent value="settings" className="mt-4 space-y-5">
            {/* Profile settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-500" /> Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-600">Display Name</Label>
                  {editingName ? (
                    <div className="flex gap-2">
                      <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        placeholder="Your name"
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveName}><Save className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{user.name || 'Not set'}</span>
                      <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email (read-only) */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-600">Email Address</Label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-700">{user.email}</span>
                  </div>
                </div>

                {/* Account type */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-600">Account Type</Label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{user.isLocal ? 'Local Account (Offline Mode)' : 'Cloud Account (Supabase)'}</span>
                    <Badge variant="outline" className={`ml-auto text-xs ${user.isLocal ? 'text-amber-600 border-amber-300' : 'text-green-600 border-green-300'}`}>
                      {user.isLocal ? 'Offline' : 'Synced'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password (local accounts only) */}
            {user.isLocal && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-500" /> Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingPassword ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-gray-600">New Password</Label>
                        <Input
                          type="password"
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          placeholder="Min. 6 characters"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-gray-600">Confirm Password</Label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleChangePassword}>Save Password</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPassword(false); setPasswordInput(''); setConfirmPassword(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingPassword(true)}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" /> Change Password
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Storage */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-indigo-500" /> Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{formatBytes(storageInfo.used)} of {formatBytes(storageInfo.available)}</span>
                  <span className="font-semibold">{storageInfo.percentage}%</span>
                </div>
                <Progress value={storageInfo.percentage} className="h-2" />
                <p className="text-xs text-gray-400">Browser local storage — your papers and settings are saved here.</p>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-0 shadow-sm border-red-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-4 p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-red-800">Sign Out</p>
                    <p className="text-xs text-red-600 mt-0.5">You can sign back in anytime.</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-100 flex-shrink-0" onClick={handleSignOut}>
                    <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-4 p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-red-800">Clear All Local Data</p>
                    <p className="text-xs text-red-600 mt-0.5">Permanently deletes all papers, settings, and your account from this device.</p>
                  </div>
                  <Button size="sm" variant="destructive" className="flex-shrink-0" onClick={handleClearAllData}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
