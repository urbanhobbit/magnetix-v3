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
  LogIn, Upload, Download, RefreshCw, CheckCircle, Users,
  Save, Plus, ChevronDown, ChevronRight, MessageSquare, BarChart2,
  LayoutList, LayoutGrid, FolderPlus, GripVertical, Pencil, Check, X, Trash2, FileText,
} from 'lucide-react';
import { cn } from './lib/utils';
import type {
  Session, L1Note, T2Coding, T2Group, T3Group, T3Item, T3Final, CodedItem,
} from '@shared/types';
import { MOCK_L1_NOTES, MOCK_T2_CODINGS } from '@shared/mockData';
import {
  createSession, listSessions, updateSessionStatus,
  getL1Notes, getT2Codings, saveT3Final, getT3Final,
  saveModeratorT2, getModeratorT2,
} from '@shared/firestoreService';

// ─── Rule-based categorization (same as submoderator) ────────────────────────

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
    if (rule.pattern.test(text)) return { category: rule.category, group: rule.group };
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
      items.push({ id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text: line, originalText: line, expertName: note.expertName, category, group });
    }
  }
  return items;
}

function groupItems(items: CodedItem[]): T2Group[] {
  const map = new Map<string, T2Group>();
  for (const item of items) {
    const key = item.group;
    if (!map.has(key)) map.set(key, { id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: key, category: item.category, items: [] });
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values());
}

// ─── Consensus computation ────────────────────────────────────────────────────

function computeConsensus(codings: T2Coding[]): T3Group[] {
  if (codings.length === 0) return [];
  const total = codings.length;
  const groupNames = new Set<string>();
  for (const c of codings) for (const g of c.groups) groupNames.add(g.name);
  const t3Groups: T3Group[] = [];
  for (const groupName of groupNames) {
    const subModsWithGroup = codings.filter(c => c.groups.some(g => g.name === groupName));
    const groupConsensus = subModsWithGroup.length / total;
    const allItems: { text: string; expertName: string; subMod: string }[] = [];
    for (const c of subModsWithGroup) {
      const grp = c.groups.find(g => g.name === groupName)!;
      for (const item of grp.items) allItems.push({ text: item.text, expertName: item.expertName, subMod: c.subModName });
    }
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
    const category = subModsWithGroup[0].groups.find(g => g.name === groupName)?.category || 'Diğer';
    t3Groups.push({ id: `t3grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: groupName, category, items: t3Items, consensusScore: groupConsensus });
  }
  return t3Groups.sort((a, b) => b.consensusScore - a.consensusScore);
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

// ─── Coding board sub-components ─────────────────────────────────────────────

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

function GroupPanel({ group, colorIdx, onRename, onDelete, onDeleteItem, onAddItem }: {
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
        <button onClick={() => setCollapsed(c => !c)} className="shrink-0">{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
        {renaming ? (
          <div className="flex flex-1 gap-1">
            <input className="flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={nameText} onChange={e => setNameText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onRename(group.id, nameText); setRenaming(false); } if (e.key === 'Escape') setRenaming(false); }} autoFocus />
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
              <div className={cn('space-y-1.5 mt-2 min-h-[40px] rounded-lg', group.items.length === 0 && !addingItem && 'border-2 border-dashed border-gray-300 flex items-center justify-center py-3')}>
                {group.items.length === 0 && !addingItem ? <span className="text-xs text-gray-400">Buraya kart sürükleyin</span> : group.items.map(item => (
                  <div key={item.id} className="flex items-start gap-1">
                    <div className="flex-1"><SortableItemCard item={item} colorIdx={colorIdx} /></div>
                    <button onClick={() => onDeleteItem(group.id, item.id)} className="mt-1 p-0.5 text-red-300 hover:text-red-500 shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </SortableContext>
            <AnimatePresence>
              {addingItem && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 flex gap-1">
                  <input ref={addInputRef} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Yeni madde metni..." value={newItemText} onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); } }} />
                  <button onClick={commitAdd} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><Check size={12} /></button>
                  <button onClick={() => { setAddingItem(false); setNewItemText(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </motion.div>
              )}
            </AnimatePresence>
            {!addingItem && (
              <button onClick={() => { setAddingItem(true); setTimeout(() => addInputRef.current?.focus(), 50); }} className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition w-full px-1">
                <Plus size={11} /> Madde ekle
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UnassignedPool({ items }: { items: CodedItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  return (
    <div ref={setNodeRef} className={cn('rounded-xl border-2 border-dashed border-gray-300 p-2 min-h-[100px] transition-colors', isOver && 'border-blue-400 bg-blue-50')}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map(item => <SortableItemCard key={item.id} item={item} colorIdx={7} />)}
        </div>
      </SortableContext>
    </div>
  );
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

// ─── Consensus Grid ───────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-emerald-400';
  if (score >= 0.4) return 'bg-amber-400';
  if (score > 0)    return 'bg-rose-400';
  return 'bg-gray-100';
}

function ConsensusGrid({ groups, codings }: { groups: T3Group[]; codings: T2Coding[] }) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const subMods = codings.map(c => c.subModName);
  const total = codings.length;
  if (total === 0 || groups.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex-wrap">
        <span className="font-medium">Consensus:</span>
        {[['≥80%', 'bg-green-500'], ['60-79%', 'bg-emerald-400'], ['40-59%', 'bg-amber-400'], ['<40%', 'bg-rose-400']].map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm inline-block ${cls}`} />{label}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[200px] sticky left-0 bg-gray-50 z-10">Grup</th>
              <th className="px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-200 text-center min-w-[80px]">Consensus</th>
              {subMods.map(sm => (
                <th key={sm} className="px-3 py-2 font-medium text-gray-600 border-b border-r border-gray-200 text-center min-w-[90px] last:border-r-0">
                  <span className="block truncate max-w-[80px] mx-auto" title={sm}>{sm}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, i) => {
              const isExpanded = expandedGroup === group.id;
              const pct = Math.round(group.consensusScore * 100);
              return (
                <>
                  <tr key={group.id} className={cn('border-b border-gray-100 cursor-pointer hover:bg-violet-50 transition-colors', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')} onClick={() => setExpandedGroup(isExpanded ? null : group.id)}>
                    <td className={cn('px-4 py-2.5 border-r border-gray-200 sticky left-0 z-10', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-1 h-8 rounded-full shrink-0', scoreColor(group.consensusScore))} />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 leading-tight truncate">{group.name}</div>
                          <div className="text-xs text-gray-400">{group.category} · {group.items.length} madde</div>
                        </div>
                        <span className="ml-auto text-gray-300 shrink-0">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-r border-gray-200 text-center">
                      <span className={cn('inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold', group.consensusScore >= 0.8 ? 'bg-green-100 text-green-700' : group.consensusScore >= 0.6 ? 'bg-emerald-100 text-emerald-700' : group.consensusScore >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{pct}%</span>
                    </td>
                    {subMods.map(sm => {
                      const coding = codings.find(c => c.subModName === sm);
                      const grp = coding?.groups.find(g => g.name === group.name);
                      return (
                        <td key={sm} className="px-3 py-2.5 border-r border-gray-200 last:border-r-0 text-center">
                          {grp ? <div className="flex flex-col items-center gap-0.5"><span className="text-green-600 font-bold text-base leading-none">✓</span><span className="text-xs text-gray-400">{grp.items.length} madde</span></div> : <span className="text-gray-200 text-lg">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && group.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 bg-violet-50/40">
                      <td className="pl-10 pr-4 py-2 border-r border-gray-200 sticky left-0 bg-violet-50/40 z-10">
                        <p className="text-xs text-gray-700 leading-snug">{item.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.expertNames.join(', ')}</p>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200 text-center">
                        <span className={cn('inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium', item.consensusScore >= 0.8 ? 'bg-green-100 text-green-700' : item.consensusScore >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{Math.round(item.consensusScore * 100)}%</span>
                      </td>
                      {subMods.map(sm => (
                        <td key={sm} className="px-3 py-2 border-r border-gray-200 last:border-r-0 text-center">
                          {item.subModSources.includes(sm) ? <span className="text-green-500 text-sm">✓</span> : <span className="text-gray-200 text-sm">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── T3 Editing Board ────────────────────────────────────────────────────────

function T3ItemCard({ item, totalMods, isDragging }: { item: T3Item; totalMods: number; isDragging?: boolean }) {
  const pct = Math.round(item.consensusScore * 100);
  const color = item.consensusScore >= 0.8 ? 'bg-green-100 text-green-700 border-green-200' : item.consensusScore >= 0.5 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200';
  return (
    <div className={cn('rounded-lg border bg-white px-3 py-2 text-sm shadow-sm', isDragging && 'opacity-50')}>
      <p className="text-gray-800 leading-snug">{item.text}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium border', color)}>
          <Users size={9} /> {pct}%
        </span>
        <span className="text-xs text-gray-400">{item.expertNames.join(', ')}</span>
      </div>
    </div>
  );
}

function SortableT3ItemCard({ item, totalMods, colorIdx, onDelete }: { item: T3Item; totalMods: number; colorIdx: number; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn('flex items-start gap-1', isDragging && 'opacity-40')}>
      <button {...attributes} {...listeners} className="mt-1 cursor-grab text-gray-300 hover:text-gray-500 shrink-0"><GripVertical size={14} /></button>
      <div className="flex-1"><T3ItemCard item={item} totalMods={totalMods} /></div>
      <button onClick={onDelete} className="mt-1 p-0.5 text-red-300 hover:text-red-500 shrink-0"><X size={12} /></button>
    </div>
  );
}

function T3EditGroupPanel({ group, colorIdx, totalMods, onRename, onDelete, onDeleteItem, onAddItem }: {
  group: T3Group; colorIdx: number; totalMods: number;
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
  const pct = Math.round(group.consensusScore * 100);

  const commitAdd = () => {
    if (newItemText.trim()) { onAddItem(group.id, newItemText.trim()); setNewItemText(''); }
    setAddingItem(false);
  };

  return (
    <motion.div layout ref={setNodeRef} className={cn('rounded-xl border overflow-hidden transition-all', color.border, color.bg, isOver && 'ring-2 ring-blue-400 ring-offset-1')}>
      <div className={cn('flex items-center gap-2 px-3 py-2', color.header)}>
        <button onClick={() => setCollapsed(c => !c)} className="shrink-0">{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
        {renaming ? (
          <div className="flex flex-1 gap-1">
            <input className="flex-1 rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={nameText} onChange={e => setNameText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onRename(group.id, nameText); setRenaming(false); } if (e.key === 'Escape') setRenaming(false); }} autoFocus />
            <button onClick={() => { onRename(group.id, nameText); setRenaming(false); }} className="text-green-600"><Check size={14} /></button>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <span className={cn('font-semibold text-sm truncate block', color.text)}>{group.name}</span>
              <span className="text-xs text-gray-400">{group.category}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium', color.badge)}>{group.items.length}</span>
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium', group.consensusScore >= 0.8 ? 'bg-green-200 text-green-700' : group.consensusScore >= 0.5 ? 'bg-amber-200 text-amber-700' : 'bg-rose-200 text-rose-700')}>{pct}%</span>
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
              <div className={cn('space-y-1.5 mt-2 min-h-[40px] rounded-lg', group.items.length === 0 && !addingItem && 'border-2 border-dashed border-gray-300 flex items-center justify-center py-3')}>
                {group.items.length === 0 && !addingItem
                  ? <span className="text-xs text-gray-400">Buraya madde sürükleyin</span>
                  : group.items.map(item => (
                    <SortableT3ItemCard key={item.id} item={item} totalMods={totalMods} colorIdx={colorIdx}
                      onDelete={() => onDeleteItem(group.id, item.id)} />
                  ))}
              </div>
            </SortableContext>
            <AnimatePresence>
              {addingItem && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 flex gap-1">
                  <input ref={addInputRef} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Yeni madde metni..." value={newItemText} onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); } }} />
                  <button onClick={commitAdd} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><Check size={12} /></button>
                  <button onClick={() => { setAddingItem(false); setNewItemText(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </motion.div>
              )}
            </AnimatePresence>
            {!addingItem && (
              <button onClick={() => { setAddingItem(true); setTimeout(() => addInputRef.current?.focus(), 50); }} className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition w-full px-1">
                <Plus size={11} /> Madde ekle
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── T3 Report View ──────────────────────────────────────────────────────────

function T3ReportView({ final, onBack, onExport }: { final: T3Final; onBack: () => void; onExport: () => void }) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const maxScore = Math.max(...final.groups.map(g => g.consensusScore), 0.01);

  const scoreColor = (s: number) =>
    s >= 0.8 ? 'bg-green-500' : s >= 0.6 ? 'bg-emerald-400' : s >= 0.4 ? 'bg-amber-400' : 'bg-rose-400';
  const scoreBadge = (s: number) =>
    s >= 0.8 ? 'bg-green-100 text-green-700' : s >= 0.6 ? 'bg-emerald-100 text-emerald-700' : s >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  // top items across all groups sorted by consensusScore
  const topItems = final.groups
    .flatMap(g => g.items.map(i => ({ ...i, groupName: g.name })))
    .sort((a, b) => b.consensusScore - a.consensusScore)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700">←</button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" /> T3 Raporu
              </h1>
              <p className="text-xs text-gray-400">{final.moderatorName} · {new Date(final.savedAt).toLocaleString('tr')}</p>
            </div>
          </div>
          <button onClick={onExport} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
            <Download size={13} /> JSON İndir
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{final.groups.length}</div>
            <div className="text-xs text-gray-400 mt-1">Toplam Grup</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{final.groups.reduce((s, g) => s + g.items.length, 0)}</div>
            <div className="text-xs text-gray-400 mt-1">Toplam Madde</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{final.groups.filter(g => g.consensusScore >= 0.5).length}</div>
            <div className="text-xs text-gray-400 mt-1">≥%50 Consensus Grup</div>
          </div>
        </div>

        {/* Consensus bar chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Grup Consensus Dağılımı</h2>
          <div className="space-y-2.5">
            {[...final.groups].sort((a, b) => b.consensusScore - a.consensusScore).map(group => {
              const pct = Math.round(group.consensusScore * 100);
              const barW = Math.round((group.consensusScore / maxScore) * 100);
              return (
                <div key={group.id} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 text-right">
                    <span className="text-xs font-medium text-gray-700 truncate block">{group.name}</span>
                    <span className="text-xs text-gray-400">{group.items.length} madde</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barW}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={cn('h-3 rounded-full', scoreColor(group.consensusScore))}
                      />
                    </div>
                    <span className={cn('text-xs font-semibold rounded-full px-2 py-0.5 w-12 text-center', scoreBadge(group.consensusScore))}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">En Yüksek Consensus Maddeler (Top 10)</h2>
          <div className="space-y-2">
            {topItems.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <span className="text-xs font-bold text-gray-300 w-5 shrink-0 mt-0.5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{item.text}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">{item.groupName}</span>
                    <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', scoreBadge(item.consensusScore))}>
                      <Users size={9} className="inline mr-0.5" />{Math.round(item.consensusScore * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Group cards */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Gruplar & Maddeler</h2>
          <div className="space-y-3">
            {[...final.groups].sort((a, b) => b.consensusScore - a.consensusScore).map((group, i) => {
              const pct = Math.round(group.consensusScore * 100);
              const isOpen = expandedGroup === group.id;
              const color = COLORS[i % COLORS.length];
              return (
                <motion.div layout key={group.id} className={cn('rounded-xl border overflow-hidden shadow-sm', color.border, color.bg)}>
                  <div className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer', color.header)} onClick={() => setExpandedGroup(isOpen ? null : group.id)}>
                    <button className="shrink-0 text-gray-400">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-semibold text-sm', color.text)}>{group.name}</span>
                        <span className="text-xs text-gray-400 bg-white/60 rounded px-1.5 py-0.5">{group.category}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{group.items.length} madde</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 bg-white/50 rounded-full h-2 overflow-hidden">
                        <div className={cn('h-2 rounded-full', scoreColor(group.consensusScore))} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={cn('text-xs font-semibold rounded-full px-2 py-0.5', scoreBadge(group.consensusScore))}>{pct}%</span>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-3 space-y-1.5">
                          {group.items.map(item => (
                            <div key={item.id} className="flex items-start gap-2 rounded-lg border border-white/80 bg-white px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800">{item.text}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className={cn('text-xs font-medium rounded-full px-1.5 py-0.5', scoreBadge(item.consensusScore))}>
                                    {Math.round(item.consensusScore * 100)}%
                                  </span>
                                  <span className="text-xs text-gray-400">{item.expertNames.join(', ')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Discussion notes */}
        {final.notes && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" /> Tartışma Notları
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{final.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── T3 Group Panel (read-only list view) ────────────────────────────────────

function T3GroupPanel({ group, totalMods }: { group: T3Group; totalMods: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showItems, setShowItems] = useState(true);
  const alpha = Math.max(0.3, group.consensusScore);
  return (
    <motion.div layout className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none" style={{ backgroundColor: `rgba(109,40,217,${alpha * 0.12})`, borderLeft: `4px solid rgba(109,40,217,${alpha})` }} onClick={() => setCollapsed(c => !c)}>
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

type Step = 'login' | 'sessions' | 'manage' | 'code' | 'review' | 'done' | 'report';

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [reportData, setReportData] = useState<T3Final | null>(null);

  // Coding board state (moderatör T2 oluşturma)
  const [codeGroups, setCodeGroups] = useState<T2Group[]>([]);
  const [unassigned, setUnassigned] = useState<CodedItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // T3 editing board state
  const [t3ActiveId, setT3ActiveId] = useState<string | null>(null);
  const [showT3NewGroup, setShowT3NewGroup] = useState(false);
  const [t3NewGroupName, setT3NewGroupName] = useState('');
  const [reviewTab, setReviewTab] = useState<'consensus' | 'edit'>('consensus');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const offlineImportRef = useRef<HTMLInputElement>(null);
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
      const s: Session = { id: `session_${Date.now()}`, name: newSessionName.trim(), createdBy: modName, createdAt: new Date().toISOString(), status: 'l1' };
      setSessions(prev => [...prev, s]);
      setNewSessionName('');
    }
    setLoading(false);
  };

  const handleSelectSession = async (s: Session) => {
    setSelectedSession(s);
    setLoading(true);
    try { setL1Notes(await getL1Notes(s.id)); } catch { setL1Notes([]); }
    try {
      const codings = await getT2Codings(s.id);
      setT2Codings(codings);
      if (codings.length > 0) setT3Groups(computeConsensus(codings));
    } catch { setT2Codings([]); }
    setLoading(false);
    setStep('manage');
  };

  // ── Kodlama board helpers ────────────────────────────────────────────────

  const initCodingBoard = (notes: L1Note[]) => {
    const items = parseL1Notes(notes);
    setCodeGroups(groupItems(items));
    setUnassigned([]);
    setStep('code');
  };

  const allCodeItems = [...codeGroups.flatMap(g => g.items), ...unassigned];
  const activeItem = activeId ? allCodeItems.find(i => i.id === activeId) : null;

  function findContainer(itemId: string): string {
    for (const g of codeGroups) if (g.items.some(i => i.id === itemId)) return g.id;
    return 'unassigned';
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(active.id as string);
    let overContainer: string;
    if (codeGroups.some(g => g.id === over.id)) overContainer = over.id as string;
    else if (over.id === 'unassigned') overContainer = 'unassigned';
    else overContainer = findContainer(over.id as string);
    if (activeContainer === overContainer) return;
    let movedItem: CodedItem | undefined;
    setCodeGroups(prev => {
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
        setCodeGroups(newGroups);
        return newU;
      });
      return newGroups;
    });
  };

  // ── T3 board DnD ─────────────────────────────────────────────────────────

  const allT3Items = t3Groups.flatMap(g => g.items);
  const t3ActiveItem = t3ActiveId ? allT3Items.find(i => i.id === t3ActiveId) : null;

  function findT3Container(itemId: string): string {
    for (const g of t3Groups) if (g.items.some(i => i.id === itemId)) return g.id;
    return '';
  }

  const handleT3DragStart = (e: DragStartEvent) => setT3ActiveId(e.active.id as string);

  const handleT3DragEnd = (e: DragEndEvent) => {
    setT3ActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findT3Container(active.id as string);
    let overContainer: string;
    if (t3Groups.some(g => g.id === over.id)) overContainer = over.id as string;
    else overContainer = findT3Container(over.id as string);
    if (!overContainer || activeContainer === overContainer) return;
    setT3Groups(prev => {
      let movedItem: T3Item | undefined;
      const next = prev.map(g => {
        if (g.id === activeContainer) {
          const idx = g.items.findIndex(i => i.id === active.id);
          if (idx >= 0) { movedItem = g.items[idx]; return { ...g, items: g.items.filter(i => i.id !== active.id) }; }
        }
        return g;
      });
      if (!movedItem) return prev;
      return next.map(g => g.id === overContainer ? { ...g, items: [...g.items, movedItem!] } : g);
    });
  };

  // ── T2 kaydet (online) ───────────────────────────────────────────────────

  const handleSaveModeratorT2 = async (andExport = false) => {
    if (!selectedSession) return;
    setLoading(true);
    const coding: T2Coding = {
      sessionId: selectedSession.id,
      subModName: modName,
      codedAt: new Date().toISOString(),
      items: allCodeItems,
      groups: codeGroups,
    };
    try { await saveModeratorT2(coding); } catch (e) { console.error(e); }
    if (andExport) {
      const blob = new Blob([JSON.stringify(coding, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `t2_moderator_${selectedSession.id}.json`; a.click();
      URL.revokeObjectURL(url);
    }
    setLoading(false);
    setStep('manage');
  };

  // ── Offline JSON import/export ───────────────────────────────────────────

  const handleOfflineImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const notes: L1Note[] = Array.isArray(data) ? data : data.notes || data.l1Notes || [];
        initCodingBoard(notes);
      } catch { alert('Geçersiz JSON dosyası.'); }
    };
    reader.readAsText(f);
  };

  // ── AltMod T2 revizyonları import ────────────────────────────────────────

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
    const final: T3Final = { sessionId: selectedSession.id, moderatorName: modName, savedAt: new Date().toISOString(), groups: t3Groups, notes: discussionNotes };
    try {
      await saveT3Final(final);
      await updateSessionStatus(selectedSession.id, 'done');
    } catch (e) {
      console.error(e);
      localStorage.setItem(`t3_${selectedSession.id}`, JSON.stringify(final));
    }
    setReportData(final);
    setLoading(false);
    setStep('done');
  };

  const exportT3Json = (final: T3Final) => {
    const blob = new Blob([JSON.stringify(final, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `t3_final_${final.sessionId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewReport = async (s: Session) => {
    setLoading(true);
    try {
      const final = await getT3Final(s.id);
      if (final) { setReportData(final); setStep('report'); }
      else alert('Bu oturum için henüz T3 kaydı yok.');
    } catch { alert('T3 verisi yüklenemedi.'); }
    setLoading(false);
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={28} className="text-emerald-600" /></div>
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

            {/* T1 — Uzman Notları */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">T1 — Uzman Notları</h3>
                <span className="text-xs text-gray-400">{l1Notes.length > 0 ? `${l1Notes.length} uzman` : 'Not yok'}</span>
              </div>
              {l1Notes.length === 0 && <p className="text-sm text-gray-400 mb-3">Firestore'da bu oturum için henüz uzman notu bulunamadı.</p>}
              {l1Notes.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-3">
                  {l1Notes.map(note => (
                    <div key={note.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-emerald-700">{note.expertName}</span>
                        <span className="text-xs text-gray-300">{new Date(note.timestamp).toLocaleString('tr')}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* T2 oluşturma seçenekleri */}
              <div className="border-t border-gray-100 pt-3 mt-1">
                <p className="text-xs font-medium text-gray-500 mb-2">T2 Kodlaması Oluştur:</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => l1Notes.length > 0 ? initCodingBoard(l1Notes) : initCodingBoard(MOCK_L1_NOTES)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    <BarChart2 size={13} /> Online Kodla
                  </button>
                  <button
                    onClick={() => offlineImportRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
                  >
                    <Upload size={13} /> Offline JSON Yükle
                  </button>
                  <input ref={offlineImportRef} type="file" accept=".json" className="hidden" onChange={handleOfflineImport} />
                </div>
              </div>
            </div>

            {/* T2 — AltModeratör Revizyonları */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">T2 — AltModeratör Revizyonları</h3>
              <p className="text-sm text-gray-400 mb-3">
                {t2Codings.length > 0
                  ? `${t2Codings.length} altmoderatör: ${t2Codings.map(c => c.subModName).join(', ')}`
                  : 'Henüz revizyon yok. AltModeratörler Firestore\'dan otomatik alır.'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => t2FileRef.current?.click()} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition">
                  <Upload size={14} /> T2 JSON İmport
                </button>
                <input ref={t2FileRef} type="file" accept=".json" multiple className="hidden" onChange={handleT2Import} />
                <button onClick={loadMockT2} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition">
                  Mock T2 Yükle (test)
                </button>
                {t2Codings.length > 0 && (
                  <button onClick={() => setStep('review')} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition">
                    <BarChart2 size={14} /> Consensus Görünümü →
                  </button>
                )}
                {selectedSession?.status === 'done' && (
                  <button onClick={() => selectedSession && handleViewReport(selectedSession)} disabled={loading} className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                    {loading ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />} T3 Raporu Görüntüle
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Coding board (Moderatör T2 oluşturma) ────────────────────────────────

  if (step === 'code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">T2 Kodlama</h1>
            <p className="text-xs text-gray-400">{modName} · {selectedSession?.name} · {codeGroups.reduce((s, g) => s + g.items.length, 0) + unassigned.length} madde</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewGroup(s => !s)} className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition">
              <FolderPlus size={14} /> Yeni Grup
            </button>
            <button onClick={() => handleSaveModeratorT2(true)} disabled={loading} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition">
              <Download size={13} /> Offline Export
            </button>
            <button onClick={() => handleSaveModeratorT2(false)} disabled={loading} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Kaydet & Yayınla
            </button>
          </div>
        </div>

        {/* New group input */}
        <AnimatePresence>
          {showNewGroup && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex gap-2">
              <input className="flex-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Yeni grup adı..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newGroupName.trim()) { setCodeGroups(prev => [...prev, { id: `grp_${Date.now()}`, name: newGroupName.trim(), category: 'Özel', items: [] }]); setNewGroupName(''); setShowNewGroup(false); }
                  if (e.key === 'Escape') setShowNewGroup(false);
                }} autoFocus />
              <button onClick={() => { if (newGroupName.trim()) { setCodeGroups(prev => [...prev, { id: `grp_${Date.now()}`, name: newGroupName.trim(), category: 'Özel', items: [] }]); setNewGroupName(''); setShowNewGroup(false); } }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Ekle</button>
              <button onClick={() => setShowNewGroup(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-4 overflow-x-auto">
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Gruplar ({codeGroups.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {codeGroups.map((group, i) => (
                  <GroupPanel key={group.id} group={group} colorIdx={i}
                    onRename={(id, name) => setCodeGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g))}
                    onDelete={id => setCodeGroups(prev => prev.filter(g => g.id !== id))}
                    onDeleteItem={(groupId, itemId) => setCodeGroups(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g))}
                    onAddItem={(groupId, text) => setCodeGroups(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `item_custom_${Date.now()}`, text, originalText: text, expertName: modName, category: g.category, group: g.name }] } : g))}
                  />
                ))}
              </div>
            </div>
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

  // ── Review / Consensus ────────────────────────────────────────────────────

  if (step === 'review') {
    const filtered = filterThreshold > 0 ? t3Groups.filter(g => g.consensusScore >= filterThreshold / 100) : t3Groups;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep('manage')} className="text-sm text-gray-400 hover:text-gray-700">←</button>
                <h1 className="text-lg font-bold text-gray-900">Consensus & T3 Düzenleme</h1>
              </div>
              <p className="text-xs text-gray-400">{selectedSession?.name} · {t2Codings.length} altmod · {t3Groups.length} grup</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tab toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setReviewTab('consensus')} className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition', reviewTab === 'consensus' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                  <BarChart2 size={13} /> Consensus
                </button>
                <button onClick={() => setReviewTab('edit')} className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition border-l border-gray-200', reviewTab === 'edit' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                  <Pencil size={13} /> T3 Düzenle
                </button>
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

          {/* ── Consensus Tab ── */}
          {reviewTab === 'consensus' && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setViewMode('grid')} className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition', viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                    <LayoutGrid size={13} /> Matris
                  </button>
                  <button onClick={() => setViewMode('list')} className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition border-l border-gray-200', viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                    <LayoutList size={13} /> Liste
                  </button>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>Min %</span>
                  <input type="number" min={0} max={100} step={10} value={filterThreshold} onChange={e => setFilterThreshold(Number(e.target.value))} className="w-14 rounded border border-gray-200 px-2 py-1 text-xs" />
                </div>
              </div>
              {viewMode === 'grid' ? (
                <ConsensusGrid groups={filtered} codings={t2Codings} />
              ) : (
                <div className="space-y-3">
                  {filtered.map(g => <T3GroupPanel key={g.id} group={g} totalMods={t2Codings.length} />)}
                  {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><p>Eşik değerini düşürün veya T2 verisi yükleyin.</p></div>}
                </div>
              )}
            </>
          )}

          {/* ── T3 Edit Tab ── */}
          {reviewTab === 'edit' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                Grupları yeniden adlandırın, maddeleri gruplar arasında sürükleyin veya yeni grup ekleyin. Consensus skorları referans amaçlıdır; düzenleme sonrası "Kaydet & Tamamla" ile T3 kaydedilir.
              </div>

              {/* New group bar */}
              <AnimatePresence>
                {showT3NewGroup && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 flex gap-2">
                    <input className="flex-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Yeni grup adı..." value={t3NewGroupName} onChange={e => setT3NewGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && t3NewGroupName.trim()) {
                          setT3Groups(prev => [...prev, { id: `t3grp_${Date.now()}`, name: t3NewGroupName.trim(), category: 'Özel', items: [], consensusScore: 0 }]);
                          setT3NewGroupName(''); setShowT3NewGroup(false);
                        }
                        if (e.key === 'Escape') setShowT3NewGroup(false);
                      }} autoFocus />
                    <button onClick={() => { if (t3NewGroupName.trim()) { setT3Groups(prev => [...prev, { id: `t3grp_${Date.now()}`, name: t3NewGroupName.trim(), category: 'Özel', items: [], consensusScore: 0 }]); setT3NewGroupName(''); setShowT3NewGroup(false); } }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Ekle</button>
                    <button onClick={() => setShowT3NewGroup(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X size={14} /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => setShowT3NewGroup(s => !s)} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition w-fit">
                <FolderPlus size={14} /> Yeni Grup Ekle
              </button>

              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleT3DragStart} onDragEnd={handleT3DragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {t3Groups.map((group, i) => (
                    <T3EditGroupPanel key={group.id} group={group} colorIdx={i} totalMods={t2Codings.length}
                      onRename={(id, name) => setT3Groups(prev => prev.map(g => g.id === id ? { ...g, name } : g))}
                      onDelete={id => setT3Groups(prev => prev.filter(g => g.id !== id))}
                      onDeleteItem={(groupId, itemId) => setT3Groups(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g))}
                      onAddItem={(groupId, text) => setT3Groups(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `t3item_custom_${Date.now()}`, text, expertNames: [modName], consensusScore: 0, subModSources: [] }] } : g))}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {t3ActiveItem && <T3ItemCard item={t3ActiveItem} totalMods={t2Codings.length} isDragging />}
                </DragOverlay>
              </DndContext>
            </>
          )}

          {/* Discussion notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" /> Tartışma Notları
            </h3>
            <textarea className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" rows={5} placeholder="Açık tartışma notları, kararlar, gerekçeler..." value={discussionNotes} onChange={e => setDiscussionNotes(e.target.value)} />
          </div>
          <button onClick={handleSaveT3} disabled={loading || t3Groups.length === 0} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Kaydet & Tamamla
          </button>
        </div>
      </div>
    );
  }

  // ── Report (from saved T3) ───────────────────────────────────────────────

  if (step === 'report' && reportData) {
    return (
      <T3ReportView
        final={reportData}
        onBack={() => setStep('manage')}
        onExport={() => exportT3Json(reportData)}
      />
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (reportData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        {/* Success banner */}
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span className="text-sm font-semibold">T3 kaydedildi!</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportT3Json(reportData)} className="flex items-center gap-1 rounded-lg border border-white/30 px-3 py-1 text-xs font-medium hover:bg-emerald-700 transition">
              <Download size={12} /> JSON İndir
            </button>
            <button onClick={() => { setStep('sessions'); setSelectedSession(null); setT2Codings([]); setT3Groups([]); setDiscussionNotes(''); setReportData(null); }} className="text-xs text-emerald-200 hover:text-white ml-2">
              Yeni oturum →
            </button>
          </div>
        </div>
        <T3ReportView
          final={reportData}
          onBack={() => setStep('sessions')}
          onExport={() => exportT3Json(reportData)}
        />
      </div>
    );
  }

  return null;
}
