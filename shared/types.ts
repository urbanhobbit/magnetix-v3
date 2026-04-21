// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  status: 'l1' | 'coding' | 'moderating' | 'done';
}

// T1: Raw expert notes from L1
export interface L1Note {
  id: string;
  expertName: string;
  text: string;
  timestamp: string;
}

// A single coded item (produced by SubModerator)
export interface CodedItem {
  id: string;
  text: string;          // cleaned/normalized text
  originalText: string;  // original from L1
  expertName: string;
  category: string;      // category assigned by sub-moderator
  group: string;         // group name within category
}

// T2: One sub-moderator's full coding output
export interface T2Coding {
  sessionId: string;
  subModName: string;
  codedAt: string;
  items: CodedItem[];
  groups: T2Group[];
}

export interface T2Group {
  id: string;
  name: string;
  category: string;
  items: CodedItem[];
}

// T3: Moderator's final consensus result
export interface T3Group {
  id: string;
  name: string;
  category: string;
  items: T3Item[];
  consensusScore: number; // 0-1: fraction of sub-mods that included this group
}

export interface T3Item {
  id: string;
  text: string;
  expertNames: string[];
  consensusScore: number; // fraction of sub-mods that included this item
  subModSources: string[]; // which sub-mods coded this
}

export interface T3Final {
  sessionId: string;
  moderatorName: string;
  savedAt: string;
  groups: T3Group[];
  notes: string; // moderator's discussion notes
}
