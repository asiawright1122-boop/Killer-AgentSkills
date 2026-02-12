import React, { useState, useEffect, useCallback } from 'react';
// Editor removed
// import Editor from './MDXEditor';

interface AdminAppProps {
  apiBaseUrl?: string;
}

interface Skill {
  id?: string;
  name: string;
  owner: string;
  repo: string;
  description: string | Record<string, string>;
  category?: string;
  source?: string;
  stars?: number;
}

// ── AdminApp ────────────────────────────────────────────────────────────────────

export default function AdminApp({ apiBaseUrl = '/api/admin' }: AdminAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'skills', label: 'Skills' },
    { id: 'docs', label: 'Docs' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-6 hidden md:block">
        <div className="font-bold text-xl text-cyan-600 dark:text-cyan-400 mb-10">
          Killer-Skills <span className="text-slate-400 text-sm">Admin</span>
        </div>
        <nav className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {activeTab === 'dashboard' && <DashboardPanel />}
        {activeTab === 'skills' && <SkillsPanel apiBaseUrl={apiBaseUrl} />}
        {activeTab === 'docs' && <DocsPanel />}
        {activeTab === 'settings' && <SettingsPanel apiBaseUrl={apiBaseUrl} />}
      </main>
    </div>
  );
}


// ── Dashboard Panel ─────────────────────────────────────────────────────────────

function DashboardPanel() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/growth')
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Skills" value={stats?.totalSkills ?? 0} />
        <StatCard label="Categories" value={stats?.totalCategories ?? 0} />
        <StatCard label="Total Stars" value={stats?.totalStars ?? 0} />
        <StatCard label="Recent (30d)" value={stats?.recentSkills ?? 0} />
      </div>
      {stats?.sources && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Sources</h2>
          <div className="flex gap-6">
            <span className="text-sm text-slate-600 dark:text-slate-400">Verified: {stats.sources.verified}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">Featured: {stats.sources.featured}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">Cache: {stats.sources.cache}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ── Skills Panel ────────────────────────────────────────────────────────────────

function SkillsPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadSkills = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/skills`)
      .then((r) => r.json())
      .then((data) => setSkills(data.skills || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiBaseUrl]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleAction = async (action: string, skillId: string) => {
    setActionLoading(skillId);
    try {
      const res = await fetch(`${apiBaseUrl}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, skillId }),
      });
      if (res.ok) loadSkills();
    } catch (e) {
      console.error(`Action ${action} failed:`, e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Skills Management</h1>
        <button onClick={loadSkills} className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          Refresh
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Skill</th>
              <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Source</th>
              <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Stars</th>
              <th className="text-right px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {skills.map((skill) => {
              const id = `${skill.owner}/${skill.repo}`;
              const desc = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';
              return (
                <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{skill.name}</div>
                    <div className="text-xs text-slate-500">{id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{skill.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${skill.source === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        skill.source === 'featured' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                      {skill.source || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{skill.stars ?? 0}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleAction('approve', id)}
                      disabled={actionLoading === id}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction('delete', id)}
                      disabled={actionLoading === id}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {skills.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No skills found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── Docs Panel ──────────────────────────────────────────────────────────────────

function DocsPanel() {
  const [markdown, setMarkdown] = useState('# Documentation\n\nEdit your documentation here using the Markdown editor.\n\n- Feature 1\n- Feature 2\n');

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Documentation Editor</h1>
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-4">
        <textarea
          className="w-full h-full font-mono text-sm bg-transparent resize-none focus:outline-none"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Type markdown here..."
        />
      </div>
    </div>
  );
}

// ── Settings Panel ──────────────────────────────────────────────────────────────

function SettingsPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/sync`, { method: 'POST' });
      const data = await res.json();
      setSyncResult(data.success ? `✅ ${data.message}` : `❌ ${data.error || data.message}`);
    } catch (e) {
      setSyncResult('❌ Sync request failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Settings</h1>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Cache Sync</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Trigger a manual sync of the skills cache from the source repository.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {syncResult && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{syncResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
