import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogIn, Send, CheckCircle, RefreshCw, Users } from 'lucide-react';
import { cn } from './lib/utils';
import { createSession, listSessions, saveL1Note } from '@shared/firestoreService';
import type { Session } from '@shared/types';

export default function App() {
  const [step, setStep] = useState<'login' | 'session' | 'write' | 'done'>('login');
  const [expertName, setExpertName] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 'session') {
      listSessions()
        .then(setSessions)
        .catch(() => setSessions([]));
    }
  }, [step]);

  const handleLogin = () => {
    if (!expertName.trim()) return;
    setStep('session');
  };

  const handleSelectSession = (s: Session) => {
    setSessionId(s.id);
    setSessionName(s.name);
    setStep('write');
  };

  const handleSubmit = async () => {
    if (!noteText.trim()) return;
    setLoading(true);
    setError('');
    try {
      await saveL1Note(sessionId, expertName, noteText.trim());
      setStep('done');
    } catch (e) {
      console.error(e);
      // Fallback: localStorage
      try {
        const key = `l1_${sessionId}_${expertName.replace(/\s+/g, '_')}`;
        localStorage.setItem(key, JSON.stringify({ expertName, text: noteText.trim(), timestamp: new Date().toISOString() }));
        setStep('done');
      } catch {
        setError('Kaydedilemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Login ──────────────────────────────────────────────────────────────────

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MagnetiX</h1>
            <p className="text-gray-500 mt-1">Uzman Girişi — L1</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adınız</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Uzman adı girin..."
                value={expertName}
                onChange={e => setExpertName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={!expertName.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <LogIn size={16} /> Giriş Yap
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Session select ─────────────────────────────────────────────────────────

  if (step === 'session') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oturum Seçin</h2>
          <p className="text-sm text-gray-500 mb-6">Merhaba, <span className="font-medium text-blue-700">{expertName}</span></p>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Henüz oturum yok.</p>
              <p className="text-xs mt-1">Moderatör tarafından oturum başlatılmalı.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.filter(s => s.status === 'l1' || s.status === 'coding').map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Oluşturan: {s.createdBy} · {new Date(s.createdAt).toLocaleDateString('tr')}</div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setSessions([]); listSessions().then(setSessions).catch(() => {}); }}
            className="mt-4 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <RefreshCw size={12} /> Yenile
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Write note ────────────────────────────────────────────────────────────

  if (step === 'write') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Çocukların İhtiyaçları</h2>
              <p className="text-sm text-gray-500 mt-0.5">Oturum: <span className="font-medium">{sessionName}</span> · Uzman: <span className="font-medium text-blue-700">{expertName}</span></p>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Çocukların ihtiyaçlarını yazın
            </label>
            <p className="text-xs text-gray-400 mb-2">Her ihtiyacı ayrı bir satıra yazabilirsiniz. Özgürce ifade edin.</p>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={12}
              placeholder="Örnek:&#10;- Psikolojik danışmanlık hizmeti&#10;- Okul öncesi eğitime erişim&#10;- Güvenli oyun alanları&#10;..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!noteText.trim() || loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Kaydediliyor...' : 'Gönder'}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Teşekkürler!</h2>
        <p className="text-gray-500 text-sm">Görüşleriniz başarıyla kaydedildi.</p>
        <p className="text-gray-400 text-xs mt-4">Oturum: <span className="font-medium">{sessionName}</span></p>
      </motion.div>
    </div>
  );
}
