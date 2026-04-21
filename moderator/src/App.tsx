import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogIn, Upload, RefreshCw, CheckCircle, Users,
  Save, Plus, ChevronDown, ChevronRight, MessageSquare, BarChart2, Trash2,
} from 'lucide-react';
import { cn } from './lib/utils';
import type { Session, L1Note, T2Coding, T2Group, T3Group, T3Item, T3Final } from '@shared/types';
import { MOCK_T2_CODINGS } from '@shared/mockData';
import {
  createSession, listSessions, updateSessionStatus,
  saveL1Note, getL1Notes, getT2Codings, saveT3Final,
} from '@shared/firestoreService';

// ─── Consensus computation ────────────────────────────────────────────────────

function computeConsensus(codings: T2Coding[]): T3Group[] {
  if (codings.length === 0) return [];
  const total = codings.length;

  // Collect all group names across codings
  const groupNames = new Set<string>();
  for (const c of codings) for (const g of c.groups) groupNames.add(g.name);

  const t3Groups: T3Group[] = [];

  for (const groupName of groupNames) {
    // How many sub-mods have this group?
    const subModsWithGroup = codings.filter(c => c.groups.some(g => g.name === groupName));
    const groupConsensus = subModsWithGroup.length / total;

    // Collect all items from all sub-mods for this group
    const allItems: { text: string; expertName: string; subMod: string }[] = [];
    for (const c of subModsWithGroup) {
      const grp = c.groups.find(g => g.name === groupName)!;
      for (const item of grp.items) {
        allItems.push({ text: item.text, expertName: item.expertName, subMod: c.subModName });
      }
    }

    // Deduplicate items by normalized text, compute per-item consensus
    const itemMap = new Map<string, { text: string; expertNames: Set<string>; subMods: Set<string> }>();
    for (const it of allItems) {
      const key = it.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!itemMap.has(key)) itemMap.set(key, { text: it.text, expertNames: new Set(), subMods: new Set() });
      itemMap.get(key)!.expertNames.add(it.expertName);
      itemMap.get(key)!.subMods.add(it.subMod);
    }

    const t3Items: T3Item[] = Array.from(itemMap.values()).map(v => ({
      id: `t3item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: v.text,
      expertNames: Array.from(v.expertNames),
      consensusScore: v.subMods.size / total,
      subModSources: Array.from(v.subMods),
    })).sort((a, b) => b.consensusScore - a.consensusScore);

    // Get category from first sub-mod
    const category = subModsWithGroup[0].groups.find(g => g.name === groupName)?.category || 'Diğer';

    t3Groups.push({
      id: `t3grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: groupName,
      category,
      items: t3Items,
      consensusScore: groupConsensus,
    });
  }

  return t3Groups.sort((a, b) => b.consensusScore - a.consensusScore);
}

// ─── Consensus badge ──────────────────────────────────────────────────────────

function ConsensusBadge({ score, total }: { score: number; total: number }) {
  const count = Math.round(score * total);
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'bg-green-100 text-green-700' : score >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      <Users size={10} /> {count}/{total} · {pct}%
    </span>
  );
}

// ─── T3 Group Panel ───────────────────────────────────────────────────────────

function T3GroupPanel({ group, totalMods, onUpdateNotes }: {
  group: T3Group;
  totalMods: number;
  onUpdateNotes: (groupId: string, notes: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showItems, setShowItems] = useState(true);
  const alpha = Math.max(0.3, group.consensusScore);

  return (
    <motion.div layout className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        style={{ backgroundColor: `rgba(109, 40, 217, ${alpha * 0.12})`, borderLeft: `4px solid rgba(109, 40, 217, ${alpha})` }}
        onClick={() => setCollapsed(c => !c)}
      >
        <button className="shrink-0 text-gray-400">{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{group.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{group.category}</span>
            <ConsensusBadge score={group.consensusScore} total={totalMods} />
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{group.items.length} madde</div>
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">
              {/* Items */}
              <button onClick={() => setShowItems(s => !s)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mt-3 mb-2">
                <BarChart2 size={12} /> {showItems ? 'Maddeleri Gizle' : 'Maddeleri Göster'} ({group.items.length})
              </button>
              <AnimatePresence>
                {showItems && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
                    {group.items.map(item => (
                      <div key={item.id} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{item.text}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <ConsensusBadge score={item.consensusScore} total={totalMods} />
                            <span className="text-xs text-gray-400">{item.expertNames.join(', ')}</span>
                          </div>
                          <div className="text-xs text-gray-300 mt-0.5">AltMod: {item.subModSources.join(', ')}</div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type Step = 'login' | 'sessions' | 'manage' | 'review' | 'done';

export default function App() {
  const [step, setStep] = useState<Step>('login');
  const [modName, setModName] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [l1Notes, setL1Notes] = useState<L1Note[]>([]);
  const [t2Codings, setT2Codings] = useState<T2Coding[]>([]);
  const [t3Groups, setT3Groups] = useState<T3Group[]>([]);
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [filterThreshold, setFilterThreshold] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const t2FileRef = useRef<HTMLInputElement>(null);

  const refreshSessions = async () => {
    setLoading(true);
    try { setSessions(await listSessions()); } catch { setSessions([]); }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!modName.trim()) return;
    await refreshSessions();
    setStep('sessions');
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    setLoading(true);
    try {
      const s = await createSession(newSessionName.trim(), modName);
      setSessions(prev => [...prev, s]);
      setNewSessionName('');
    } catch (e) {
      console.error(e);
      // Fallback: create locally
      const s: Session = { id: `session_${Date.now()}`, name: newSessionName.trim(), createdBy: modName, createdAt: new Date().toISOString(), status: 'l1' };
      setSessions(prev => [...prev, s]);
      setNewSessionName('');
    }
    setLoading(false);
  };

  const handleSelectSession = async (s: Session) => {
    setSelectedSession(s);
    setLoading(true);
    try {
      const notes = await getL1Notes(s.id);
      setL1Notes(notes);
    } catch { setL1Notes([]); }
    try {
      const codings = await getT2Codings(s.id);
      setT2Codings(codings);
      if (codings.length > 0) setT3Groups(computeConsensus(codings));
    } catch { setT2Codings([]); }
    setLoading(false);
    setStep('manage');
  };

  const handleT2Import = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as T2Coding;
        setT2Codings(prev => {
          const next = [...prev.filter(c => c.subModName !== data.subModName), data];
          setT3Groups(computeConsensus(next));
          return next;
        });
      } catch { alert('Geçersiz T2 JSON dosyası.'); }
    };
    reader.readAsText(f);
  };

  const loadMockT2 = () => {
    setT2Codings(MOCK_T2_CODINGS);
    setT3Groups(computeConsensus(MOCK_T2_CODINGS));
  };

  const handleSaveT3 = async () => {
    if (!selectedSession || t3Groups.length === 0) return;
    setLoading(true);
    const final: T3Final = {
      sessionId: selectedSession.id,
      moderatorName: modName,
      savedAt: new Date().toISOString(),
      groups: t3Groups,
      notes: discussionNotes,
    };
    try {
      await saveT3Final(final);
      await updateSessionStatus(selectedSession.id, 'done');
    } catch (e) {
      console.error(e);
      localStorage.setItem(`t3_${selectedSession.id}`, JSON.stringify(final));
    }
    // JSON download
    const blob = new Blob([JSON.stringify(final, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `t3_final_${selectedSession.id}.json`; a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
    setStep('done');
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MagnetiX</h1>
            <p className="text-gray-500 mt-1">Moderatör Girişi</p>
          </div>
          <div className="space-y-4">
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Moderatör adı..." value={modName} onChange={e => setModName(e.target.value)} onKeyDown={e => e.key === 'Enter' && modName.trim() && handleLogin()} autoFocus />
            <button onClick={handleLogin} disabled={!modName.trim() || loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />} Giriş Yap
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  if (step === 'sessions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Oturumlar</h2>
                <p className="text-sm text-gray-500">Moderatör: <span className="font-medium text-emerald-700">{modName}</span></p>
              </div>
              <button onClick={refreshSessions} className="p-2 text-gray-400 hover:text-gray-700"><RefreshCw size={16} /></button>
            </div>

            {/* Create session */}
            <div className="flex gap-2 mb-4">
              <input className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Yeni oturum adı..." value={newSessionName} onChange={e => setNewSessionName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSession()} />
              <button onClick={handleCreateSession} disabled={!newSessionName.trim() || loading} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                <Plus size={14} /> Oluştur
              </button>
            </div>

            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Henüz oturum yok. Yukarıdan oluşturun.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <button key={s.id} onClick={() => handleSelectSession(s)} className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <span className={cn('text-xs rounded-full px-2 py-0.5', s.status === 'done' ? 'bg-green-100 text-green-700' : s.status === 'moderating' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>{s.status}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">ID: {s.id} · {new Date(s.createdAt).toLocaleDateString('tr')}</div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Manage session ────────────────────────────────────────────────────────

  if (step === 'manage') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('sessions')} className="text-sm text-gray-400 hover:text-gray-700">← Oturumlar</button>
              <h2 className="text-xl font-bold text-gray-900">{selectedSession?.name}</h2>
            </div>

            {/* T1 section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">T1 — Uzman Notları</h3>
              <p className="text-sm text-gray-400 mb-1">
                {l1Notes.length > 0 ? `${l1Notes.length} not Firestore'dan yüklendi.` : 'Firestore\'da not bulunamadı.'}
              </p>
              <p className="text-xs text-gray-400">AltModeratörler bu oturumu seçtiğinde notları otomatik olarak alır.</p>
            </div>

            {/* T2 section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">T2 — AltModeratör Kodlamaları</h3>
              <p className="text-sm text-gray-400 mb-3">
                {t2Codings.length > 0
                  ? `${t2Codings.length} altmoderatör: ${t2Codings.map(c => c.subModName).join(', ')}`
                  : 'Henüz kodlama yok.'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => t2FileRef.current?.click()} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition">
                  <Upload size={14} /> T2 JSON İmport
                </button>
                <input ref={t2FileRef} type="file" accept=".json" multiple className="hidden" onChange={handleT2Import} />
                <button onClick={loadMockT2} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition">
                  Mock T2 Yükle (2 altmod)
                </button>
                {t2Codings.length > 0 && (
                  <button onClick={() => setStep('review')} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition">
                    <BarChart2 size={14} /> Consensus Görünümü →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Review / Consensus ────────────────────────────────────────────────────

  if (step === 'review') {
    const filtered = filterThreshold > 0
      ? t3Groups.filter(g => g.consensusScore >= filterThreshold / 100)
      : t3Groups;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep('manage')} className="text-sm text-gray-400 hover:text-gray-700">←</button>
                <h1 className="text-lg font-bold text-gray-900">Consensus Görünümü</h1>
              </div>
              <p className="text-xs text-gray-400">{selectedSession?.name} · {t2Codings.length} altmod · {t3Groups.length} grup · {t3Groups.reduce((s, g) => s + g.items.length, 0)} madde</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>Min %</span>
                <input type="number" min={0} max={100} step={10} value={filterThreshold} onChange={e => setFilterThreshold(Number(e.target.value))} className="w-14 rounded border border-gray-200 px-2 py-1 text-xs" />
              </div>
              <button onClick={handleSaveT3} disabled={loading || t3Groups.length === 0} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Kaydet & Tamamla
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{t2Codings.length}</div>
              <div className="text-xs text-gray-400">AltModeratör</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{t3Groups.length}</div>
              <div className="text-xs text-gray-400">Grup</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{t3Groups.filter(g => g.consensusScore >= 0.5).length}</div>
              <div className="text-xs text-gray-400">≥%50 Consensus</div>
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-3">
            {filtered.map(g => (
              <T3GroupPanel key={g.id} group={g} totalMods={t2Codings.length} onUpdateNotes={() => {}} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>Eşik değerini düşürün veya T2 verisi yükleyin.</p>
              </div>
            )}
          </div>

          {/* Discussion notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" /> Tartışma Notları
            </h3>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              rows={5}
              placeholder="Açık tartışma notları, kararlar, gerekçeler..."
              value={discussionNotes}
              onChange={e => setDiscussionNotes(e.target.value)}
            />
          </div>

          <button onClick={handleSaveT3} disabled={loading || t3Groups.length === 0} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Kaydet & Tamamla
          </button>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tamamlandı!</h2>
        <p className="text-gray-500 text-sm">T3 sonuçları kaydedildi ve indirildi.</p>
        <button onClick={() => { setStep('sessions'); setSelectedSession(null); setT2Codings([]); setT3Groups([]); setDiscussionNotes(''); }} className="mt-6 text-sm text-emerald-600 hover:underline">Başka oturuma geç</button>
      </motion.div>
    </div>
  );
}
