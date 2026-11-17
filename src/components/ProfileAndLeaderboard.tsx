import React, { useEffect, useState } from 'react';
import { Award, Check, Edit3, Medal, Trophy } from 'lucide-react';
import type { LeaderboardEntry, MatchHistoryEntry, UserProfile } from '../shared/types';
import { AVATAR_OPTIONS } from '../utils/avatars';
import { ModalShell } from './GameModals';
import { PlayerAvatar } from './PlayerAvatar';

interface LeaderboardModalProps {
  onSelectPlayer: (uid: string) => void;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  onSelectPlayer,
  onClose,
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'all'>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/leaderboard?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load leaderboard');
        return r.json();
      })
      .then((data) => {
        if (active) {
          setEntries(data.entries || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to fetch leaderboard');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <ModalShell title="Verified Leaderboard" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/35 border border-amber-900/40">
          {(
            [
              { id: 'daily', label: 'Daily' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'all', label: 'All-Time' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPeriod(t.id)}
              className={`py-2 rounded-lg text-xs font-bold transition min-h-[38px] ${
                period === t.id ? 'bg-amber-500 text-[#1A0D07]' : 'text-amber-100/80 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-amber-200/70">
          Rankings are computed strictly from server-verified completed multiplayer matches.
        </p>

        {loading && (
          <div className="py-10 text-center text-xs text-amber-200/70">
            Loading verified rankings...
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="py-10 px-4 rounded-2xl bg-black/25 border border-amber-900/40 text-center space-y-2">
            <Trophy className="w-8 h-8 text-amber-400/70 mx-auto" />
            <div className="text-sm font-semibold text-amber-100">No Verified Matches Yet</div>
            <p className="text-xs text-amber-200/70">
              Complete an Online Match or Private Room game to claim the #1 rank on the leaderboard.
            </p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <button
                key={entry.uid}
                type="button"
                onClick={() => onSelectPlayer(entry.uid)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/25 hover:bg-white/5 border border-amber-900/40 text-left transition min-h-[56px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono-num text-sm font-bold text-amber-300 w-6 text-center">
                    #{entry.rank}
                  </span>
                  <PlayerAvatar avatarId={entry.avatar} name={entry.name} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-amber-50 truncate">
                      {entry.name}
                    </div>
                    <div className="text-[11px] text-amber-200/65 font-mono-num">
                      {entry.playerId} · {entry.winRate}% Win
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="font-mono-num text-sm font-bold text-amber-300">
                    {entry.wins} Wins
                  </div>
                  <div className="font-mono-num text-[11px] text-amber-200/65">
                    {entry.totalGames} Played
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

interface ProfileModalProps {
  targetUid: string;
  isSelf: boolean;
  localProfile: UserProfile | null;
  localMatchHistory: MatchHistoryEntry[];
  onUpdateProfile: (name: string, avatar: string) => Promise<void>;
  onOpenAuth: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  targetUid,
  isSelf,
  localProfile,
  localMatchHistory,
  onUpdateProfile,
  onOpenAuth,
  onClose,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(isSelf ? localProfile : null);
  const [serverHistory, setServerHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(!isSelf);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(localProfile?.name || '');
  const [editAvatar, setEditAvatar] = useState(localProfile?.avatar || 'royal');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/profile/${targetUid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setProfile(data.user);
          setEditName(data.user.name);
          setEditAvatar(data.user.avatar);
          setServerHistory(data.matchHistory || []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetUid]);

  const activeProfile = profile || (isSelf ? localProfile : null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdateProfile(editName, editAvatar);
      setProfile((prev) => (prev ? { ...prev, name: editName.trim(), avatar: editAvatar } : prev));
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !activeProfile) {
    return (
      <ModalShell title="Player Profile" onClose={onClose}>
        <div className="py-12 text-center text-xs text-amber-200/75">
          {loading ? 'Loading player profile...' : 'Profile unavailable'}
        </div>
      </ModalShell>
    );
  }

  const winRate =
    activeProfile.totalGames > 0
      ? Math.round((activeProfile.wins / activeProfile.totalGames) * 100)
      : 0;

  const combinedHistory = isSelf
    ? [...serverHistory, ...localMatchHistory].sort((a, b) => b.completedAt - a.completedAt).slice(0, 20)
    : serverHistory;

  return (
    <ModalShell title={isSelf ? 'My Profile' : 'Player Profile'} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <PlayerAvatar
              avatarId={editing ? editAvatar : activeProfile.avatar}
              name={activeProfile.name}
              size="lg"
            />
            <div className="min-w-0">
              <div className="text-base font-bold text-amber-50 truncate">
                {activeProfile.name}
              </div>
              <div className="text-xs font-mono-num text-amber-300/85">
                {activeProfile.playerId}
              </div>
              <div className="text-[11px] text-amber-200/65 mt-0.5">
                {activeProfile.authProvider === 'google' ? 'Google Account' : 'Guest Account'} · Demo Points: {activeProfile.coins}
              </div>
            </div>
          </div>

          {isSelf && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-amber-200 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Edit profile"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>

        {editing && isSelf && (
          <div className="p-4 rounded-2xl bg-black/30 border border-amber-500/40 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-amber-200/80 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                maxLength={20}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-amber-700/50 text-sm text-amber-50 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-200/80 mb-1.5">
                Choose Avatar
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setEditAvatar(av.id)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                      editAvatar === av.id
                        ? 'bg-amber-500/20 border-amber-400'
                        : 'bg-black/25 border-amber-900/40'
                    }`}
                  >
                    <PlayerAvatar avatarId={av.id} name={av.label} size="sm" />
                    <span className="text-[10px] text-amber-100 truncate w-full text-center">
                      {av.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {saveError && <p className="text-xs text-rose-300">{saveError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-semibold text-amber-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#1A0D07] text-xs font-bold flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Games', value: String(activeProfile.totalGames) },
            { label: 'Won', value: String(activeProfile.wins) },
            { label: 'Lost', value: String(activeProfile.losses) },
            { label: 'Win %', value: `${winRate}%` },
            { label: 'Rank', value: `#${activeProfile.rank || 1}` },
            { label: 'Demo Coins', value: String(activeProfile.coins) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-xl bg-black/25 border border-amber-900/40 text-center"
            >
              <div className="font-mono-num text-base font-bold text-amber-300">
                {stat.value}
              </div>
              <div className="text-[11px] text-amber-200/70 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {isSelf && activeProfile.authProvider === 'guest' && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-semibold transition"
          >
            Account Options · Upgrade Guest to Google
          </button>
        )}

        {/* Match History */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-amber-200/80 mb-2">
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Recent Match History</span>
            </span>
            <span>{combinedHistory.length} Matches</span>
          </div>

          {combinedHistory.length === 0 ? (
            <div className="py-6 rounded-xl bg-black/20 border border-amber-900/35 text-center text-xs text-amber-200/65">
              No completed matches yet. Start a match to record your history!
            </div>
          ) : (
            <div className="space-y-2">
              {combinedHistory.map((m) => {
                const won = m.winnerUid === activeProfile.uid;
                return (
                  <div
                    key={m.matchId}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/25 border border-amber-900/40 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-amber-50 flex items-center gap-1.5">
                        <Medal className={`w-3.5 h-3.5 ${won ? 'text-amber-400' : 'text-amber-100/40'}`} />
                        <span>{won ? 'Victory' : 'Defeat'}</span>
                        <span className="text-amber-200/60">· {m.mode.toUpperCase()} ({m.playerCount}P)</span>
                      </div>
                      <div className="text-[11px] text-amber-200/65 mt-0.5 truncate">
                        Winner: {m.winnerName} · {m.verified ? 'Verified Online' : 'Local AI'}
                      </div>
                    </div>
                    <span className="font-mono-num text-[11px] text-amber-200/60 shrink-0 pl-2">
                      {m.durationSeconds}s
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
