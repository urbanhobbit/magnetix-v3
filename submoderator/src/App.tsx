import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LogIn, Save, FolderPlus, Trash2, GripVertical,
  CheckCircle, RefreshCw, ChevronDown, ChevronRight, Pencil, Check, X, Database, Plus,
} from 'lucide-react';
import { cn } from './lib/utils';
import type { L1Note, T2Group, T2Coding, CodedItem } from '@shared/types';
import { MOCK_L1_NOTES } from '@shared/mockData';
import { saveT2Coding, listSessions, getModeratorT2 } from '@shared/firestoreService';
import type { Session } from '@shared/types';

// ─── Rule-based categorization ───────────────────────────────────────────────

const CATEGORY_RULES: { pattern: RegExp; category: string; group: string }[] = [
  { pattern: /barınma|konut|kira|elektrik|su fatura|ısınma|gıda|besin|beslenme|öğün|giyim|kıyafet|temel yaşam|maddi/i, category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
  { pattern: /eğitim|okul|ders|müfredat|öğretmen|rehberlik|akademik|sınav|okul öncesi|kapsayıcı/i, category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
  { pattern: /sağlık|hastalık|ilaç|rehabilitasyon|engelli|diş|göz|hijyen|bakım malzeme/i, category: 'Sağlık', group: 'Sağlık ve Psikososyal İyi Oluş' },
  { pattern: /psikosos|psikoloj|ruh sağlığı|danışmanlık|kriz|akran|sosyal etkileşim|ergenlik|menstrüasyon/i, category: 'Sağlık', group: 'Sağlık ve Psikososyal İyi Oluş' },
  { pattern: /internet|dijital|bilgisayar|tablet|teknoloji|yazılım|online|uzaktan eğitim|siber|stem|programlama/i, category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
  { pattern: /güvenlik|koruma|istismar|ihmal|şiddet|zorbalık|taciz|erken evlilik|çocuk işçi|afet|acil/i, category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
  { pattern: /hukuk|hak|kimlik|belge|ayrımcılık|katılım|meclis|şikayet|burs|kariyer|meslek/i, category: 'Haklar ve Katılım', group: 'Haklar, Katılım ve Gelecek' },
  { pattern: /aile|ebeveyn|bakımveren|tek ebeveyn|akraba|mülteci|göçmen|sosyal hizmet|sosyal yardım/i, category: 'Aile ve Sosyal Destek', group: 'Aile ve Bakımveren Desteği' },
  { pattern: /ulaşım|taşıma|servis|yol|toplu taşıma/i, category: 'Altyapı', group: 'Ulaşım ve Erişim' },
  { pattern: /oyun|spor|kültür|sanat|boş zaman|etkinlik|sosyal katılım/i, category: 'Sosyal', group: 'Sosyal Katılım ve Boş Zaman' },
];

function categorizeText(text: string): { category: string; group: string } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return { category: rule.category, group: rule.group };
    }
  }
  return { category: 'Diğer', group: 'Sınıflandırılmamış' };
}

function parseL1Notes(notes: L1Note[]): CodedItem[] {
  const seen = new Set<string>();
  const items: CodedItem[] = [];
  for (const note of notes) {
    const lines = note.text.split('\n').map((l: string) => l.replace(/^[-•*]\s*/, '').trim()).filter((l: string) => l.length > 3 && !/^[A-ZÇĞİÖŞÜa-zçğışöüA-Z ]+:$/.test(l));
    for (const line of lines) {
      const key = line.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      const { category, group } = categorizeText(line);
      items.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: line,
        originalText: line,
        expertName: note.expertName,
        category,
        group,
      });
    }
  }
  return items;
}

function groupItems(items: CodedItem[]): T2Group[] {
  const map = new Map<string, T2Group>();
  for (const item of items) {
    const key = item.group;
    if (!map.has(key)) {
      map.set(key, {
        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: key,
        category: item.category,
        items: [],
      });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values());
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', text: 'text-blue-800', badge: 'bg-blue-200 text-blue-800' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100', text: 'text-emerald-800', badge: 'bg-emerald-200 text-emerald-800' },
  { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100', text: 'text-amber-800', badge: 'bg-amber-200 text-amber-800' },
  { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100', text: 'text-purple-800', badge: 'bg-purple-200 text-purple-800' },
  { bg: 'bg-rose-50', border: 'border-rose-200', header: 'bg-rose-100', text: 'text-rose-800', badge: 'bg-rose-200 text-rose-800' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-cyan-100', text: 'text-cyan-800', badge: 'bg-cyan-200 text-cyan-800' },
  { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-100', text: 'text-orange-800', badge: 'bg-orange-200 text-orange-800' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', header: 'bg-indigo-100', text: 'text-indigo-800', badge: 'bg-indigo-200 text-indigo-800' },
];

// ─── Sortable Item Card ───────────────────────────────────────────────────────

function ItemCard({ item, colorIdx, isDragging }: { item: CodedItem; colorIdx: number; isDragging?: boolean }) {
  const color = COLORS[colorIdx % COLORS.length];
  return (
    <div className={cn('rounded-lg border bg-white px-3 py-2 text-sm shadow-sm', color.border, isDragging && 'opacity-50')}>
      <p className="text-gray-800 leading-snug">{item.text}</p>
      <p className="text-xs text-gray-400 mt-1">{item.expertName}</p>
    </div>
  );
}

function SortableItemCard({ item, colorIdx }: { item: CodedItem; colorIdx: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn('flex items-start gap-1', isDragging && 'opacity-40')}>
      <button {...attributes} {...listeners} className="mt-1 cursor-grab text-gray-300 hover:text-gray-500 shrink-0"><GripVertical size={14} /></button>
      <div className="flex-1"><ItemCard item={item} colorIdx={colorIdx} /></div>
    </div>
  );
}

// ─── Group Panel ─────────────────────────────────────────────────────────────

function GroupPanel({
  group, colorIdx, onRename, onDelete, onDeleteItem, onAddItem,
}: {
  group: T2Group; colorIdx: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteItem: (groupId: string, itemId: string) => void;
  onAddItem: (groupId: string, text: string) => void;
}) {
  const color = COLORS[colorIdx % COLORS.length];
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameText, setNameText] = useState(group.name);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  const commitAdd = () => {
    if (newItemText.trim()) { onAddItem(group.id, newItemText.trim()); setNewItemText(''); }
    setAddingItem(false);
  };

  return (
    <motion.div layout ref={setNodeRef} className={cn('rounded-xl border overflow-hidden transition-all', color.border, color.bg, isOver && 'ring-2 ring-blue-400 ring-offset-1')}>
      <div className={cn('flex items-center gap-2 px-3 py-2', color.header)}>
        <button onClick={() => setCollapsed(c => !c)} className="shrink-0">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {renaming ? (
          <div className="flex flex-1 gap-1">
            <input className="flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={nameText} onChange={e => setNameText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onRename(group.id, nameText); setRenaming(false); } if (e.key === 'Escape') setRenaming(false); }} autoFocus />
            <button onClick={() => { onRename(group.id, nameText); setRenaming(false); }} className="text-green-600"><Check size={14} /></button>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className={cn('font-semibold text-sm truncate block', color.text)}>{group.name}</span>
              <span className="text-xs text-gray-400">{group.category}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium', color.badge)}>{group.items.length}</span>
              <button onClick={() => { setAddingItem(true); setCollapsed(false); setTimeout(() => addInputRef.current?.focus(), 50); }} className="p-0.5 text-gray-400 hover:text-emerald-600" title="Yeni madde ekle"><Plus size={12} /></button>
              <button onClick={() => { setNameText(group.name); setRenaming(true); }} className="p-0.5 text-gray-400 hover:text-gray-700"><Pencil size={12} /></button>
              <button onClick={() => onDelete(group.id)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
            </div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-2 pb-2">
            <SortableContext items={group.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className={cn('space-y-1.5 mt-2 min-h-[40px] rounded-lg', group.items.length === 0 && !addingItem && 'border-2 border-dashed border-gray-300 flex items-center justify-center py-3', isOver && group.items.length === 0 && 'border-blue-400 bg-blue-50')}>
                {group.items.length === 0 && !addingItem ? (
                  <span className="text-xs text-gray-400">Buraya kart sürükleyin</span>
                ) : group.items.map(item => (
                  <div key={item.id} className="flex items-start gap-1">
                    <div className="flex-1">
                      <SortableItemCard item={item} colorIdx={colorIdx} />
                    </div>
                    <button onClick={() => onDeleteItem(group.id, item.id)} className="mt-1 p-0.5 text-red-300 hover:text-red-500 shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </SortableContext>
            {/* Inline add item */}
            <AnimatePresence>
              {addingItem && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 flex gap-1">
                  <input
                    ref={addInputRef}
                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="Yeni madde metni..."
                    value={newItemText}
                    onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); } }}
                  />
                  <button onClick={commitAdd} className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700"><Check size={12} /></button>
                  <button onClick={() => { setAddingItem(false); setNewItemText(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </motion.div>
              )}
            </AnimatePresence>
            {!addingItem && (
              <button onClick={() => { setAddingItem(true); setTimeout(() => addInputRef.current?.focus(), 50); }} className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition w-full px-1">
                <Plus size={11} /> Madde ekle
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type Step = 'login' | 'sessions' | 'code' | 'done';

export default function App() {
  const [step, setStep] = useState<Step>('login');
  const [subModName, setSubModName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<T2Group[]>([]);
  const [unassigned, setUnassigned] = useState<CodedItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadAndParse = (notes: L1Note[]) => {
    const items = parseL1Notes(notes);
    const grps = groupItems(items);
    setGroups(grps);
    setUnassigned([]);
    setStep('code');
  };

  const handleLogin = async () => {
    if (!subModName.trim()) return;
    setLoading(true);
    try {
      const s = await listSessions();
      setSessions(s);
    } catch { setSessions([]); }
    setLoading(false);
    setStep('sessions');
  };

  const handleSelectSession = async (s: Session) => {
    setSessionId(s.id);
    setSessionName(s.name);
    setLoading(true);
    try {
      const modT2 = await getModeratorT2(s.id);
      if (modT2 && modT2.groups.length > 0) {
        // Moderatörün T2'sini al, gruplara dönüştür
        setGroups(modT2.groups);
        setUnassigned([]);
        setStep('code');
      } else {
        // Moderatör henüz kodlamamış — mock ile devam et (test)
        loadAndParse(MOCK_L1_NOTES);
      }
    } catch {
      loadAndParse(MOCK_L1_NOTES);
    }
    setLoading(false);
  };

  // ── Login ────────────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Database size={28} className="text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MagnetiX</h1>
            <p className="text-gray-500 mt-1">AltModeratör Girişi</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adınız</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="AltModeratör adı..."
                value={subModName}
                onChange={e => setSubModName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && subModName.trim() && handleLogin()}
                autoFocus
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={!subModName.trim() || loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />} Giriş Yap
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  if (step === 'sessions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Oturum Seç</h2>
              <p className="text-sm text-gray-500">Hoş geldin, <span className="font-medium text-violet-700">{subModName}</span></p>
            </div>
            <button onClick={handleLogin} className="p-2 text-gray-400 hover:text-gray-700"><RefreshCw size={16} /></button>
          </div>

          {loading && <p className="text-sm text-gray-400 text-center py-4">Yükleniyor...</p>}

          {!loading && sessions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Henüz oturum yok. Moderatörden oturum oluşturmasını isteyin.</p>
          )}

          {!loading && sessions.length > 0 && (
            <div className="space-y-2">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-violet-300 hover:bg-violet-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className={cn('text-xs rounded-full px-2 py-0.5', s.status === 'done' ? 'bg-green-100 text-green-700' : s.status === 'moderating' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>{s.status}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString('tr')} · {s.createdBy}</div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Kodlama Kaydedildi!</h2>
          <p className="text-gray-500 text-sm">Moderatör sizin çalışmanızı görebilecek.</p>
          <p className="text-gray-400 text-xs mt-4">AltMod: <span className="font-medium">{subModName}</span> · Oturum: <span className="font-medium">{sessionId}</span></p>
          <button onClick={() => { setStep('sessions'); setGroups([]); setUnassigned([]); }} className="mt-6 text-sm text-violet-600 hover:underline">Yeni kodlama yap</button>
        </motion.div>
      </div>
    );
  }

  // ── DnD helpers ──────────────────────────────────────────────────────────

  const allItems = [...groups.flatMap(g => g.items), ...unassigned];
  const activeItem = activeId ? allItems.find(i => i.id === activeId) : null;

  function findContainer(itemId: string): string {
    for (const g of groups) {
      if (g.items.some(i => i.id === itemId)) return g.id;
    }
    return 'unassigned';
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    let overContainer: string;
    if (groups.some(g => g.id === over.id)) overContainer = over.id as string;
    else if (over.id === 'unassigned') overContainer = 'unassigned';
    else overContainer = findContainer(over.id as string);

    if (activeContainer === overContainer) return;

    let movedItem: CodedItem | undefined;

    setGroups(prev => {
      let newGroups = prev.map(g => {
        if (g.id === activeContainer) {
          const idx = g.items.findIndex(i => i.id === active.id);
          if (idx >= 0) { movedItem = g.items[idx]; return { ...g, items: g.items.filter(i => i.id !== active.id) }; }
        }
        return g;
      });
      setUnassigned(prevU => {
        let newU = [...prevU];
        if (activeContainer === 'unassigned') {
          const idx = newU.findIndex(i => i.id === active.id);
          if (idx >= 0) { movedItem = newU[idx]; newU = newU.filter(i => i.id !== active.id); }
        }
        if (!movedItem) return prevU;
        if (overContainer === 'unassigned') return [...newU, movedItem];
        newGroups = newGroups.map(g => g.id === overContainer ? { ...g, items: [...g.items, movedItem!] } : g);
        setGroups(newGroups);
        return newU;
      });
      return newGroups;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const coding: T2Coding = {
      sessionId,
      subModName,
      codedAt: new Date().toISOString(),
      items: allItems,
      groups,
    };
    try {
      await saveT2Coding(coding);
    } catch (e) {
      console.error('Firestore save error', e);
      localStorage.setItem(`t2_${sessionId}_${subModName.replace(/\s+/g, '_')}`, JSON.stringify(coding));
    }
    // Always download JSON
    const blob = new Blob([JSON.stringify(coding, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `t2_${sessionId}_${subModName.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
    setStep('done');
  };

  // ── Code board ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">AltModeratör Kodlama</h1>
          <p className="text-xs text-gray-400">{subModName} · Oturum: {sessionId} · {groups.reduce((s, g) => s + g.items.length, 0) + unassigned.length} madde</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowNewGroup(s => !s); }}
            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition"
          >
            <FolderPlus size={14} /> Yeni Grup
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet & Gönder
          </button>
        </div>
      </div>

      {/* New group input */}
      <AnimatePresence>
        {showNewGroup && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-violet-50 border-b border-violet-100 px-4 py-2 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-violet-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Yeni grup adı..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newGroupName.trim()) {
                  setGroups(prev => [...prev, { id: `grp_custom_${Date.now()}`, name: newGroupName.trim(), category: 'Özel', items: [] }]);
                  setNewGroupName(''); setShowNewGroup(false);
                }
                if (e.key === 'Escape') setShowNewGroup(false);
              }}
              autoFocus
            />
            <button onClick={() => { if (newGroupName.trim()) { setGroups(prev => [...prev, { id: `grp_custom_${Date.now()}`, name: newGroupName.trim(), category: 'Özel', items: [] }]); setNewGroupName(''); setShowNewGroup(false); } }} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">Ekle</button>
            <button onClick={() => setShowNewGroup(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 p-4 overflow-x-auto">
          {/* Groups */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Gruplar ({groups.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {groups.map((group, i) => (
                <GroupPanel
                  key={group.id}
                  group={group}
                  colorIdx={i}
                  onRename={(id, name) => setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g))}
                  onDelete={id => setGroups(prev => prev.filter(g => g.id !== id))}
                  onDeleteItem={(groupId, itemId) => setGroups(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g))}
                  onAddItem={(groupId, text) => setGroups(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `item_custom_${Date.now()}`, text, originalText: text, expertName: subModName, category: g.category, group: g.name }] } : g))}
                />
              ))}
            </div>
          </div>

          {/* Unassigned pool */}
          {unassigned.length > 0 && (
            <div className="w-72 shrink-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Atanmamış ({unassigned.length})</h3>
              <UnassignedPool items={unassigned} />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeItem && <ItemCard item={activeItem} colorIdx={0} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function UnassignedPool({ items }: { items: CodedItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  return (
    <div ref={setNodeRef} className={cn('rounded-xl border-2 border-dashed border-gray-300 p-2 min-h-[100px] transition-colors', isOver && 'border-blue-400 bg-blue-50')}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map(item => (
            <SortableItemCard key={item.id} item={item} colorIdx={7} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
