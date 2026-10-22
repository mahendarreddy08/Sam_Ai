import React, { useState } from "react";
import { Task, Note, ActiveTimer, WeatherInfo, UserMemoryItem, DailyBriefing } from "../types";
import {
  X,
  CheckSquare,
  Plus,
  Trash2,
  Bookmark,
  Timer as TimerIcon,
  Cloud,
  Sun,
  CloudRain,
  Search,
  Check,
  RefreshCw,
  Brain,
  Newspaper,
  Download,
  Upload,
  Edit2,
  Info,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface ToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  notes: Note[];
  timers: ActiveTimer[];
  weather: WeatherInfo | null;
  memory: UserMemoryItem[];
  briefing: DailyBriefing | null;
  isCloudConnected: boolean;
  lastSyncedAt: string | null;
  onAddTask: (title: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddNote: (title: string, content: string) => void;
  onDeleteNote: (id: string) => void;
  onAddTimer: (durationSeconds: number, label: string) => void;
  onDeleteTimer: (id: string) => void;
  onRefreshWeather: (location?: string) => void;
  onRefreshBriefing: () => void;
  onAddMemory: (key: string, value: string, category: "preference" | "profile" | "project" | "fact") => void;
  onUpdateMemory?: (id: string, value: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearMemory: () => void;
  onExportBackup: () => void;
  onRestoreBackup?: (backupData: any) => void;
  onTriggerCommand?: (command: string) => void;
}

export const ToolsDrawer: React.FC<ToolsDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  notes,
  timers,
  weather,
  memory,
  briefing,
  isCloudConnected,
  lastSyncedAt,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onDeleteNote,
  onAddTimer,
  onDeleteTimer,
  onRefreshWeather,
  onRefreshBriefing,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearMemory,
  onExportBackup,
  onRestoreBackup,
  onTriggerCommand,
}) => {
  const [activeTab, setActiveTab] = useState<"tasks" | "notes" | "timers" | "memory" | "knowledge" | "actions" | "weather" | "briefing">("tasks");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newTimerMins, setNewTimerMins] = useState("5");
  const [newTimerLabel, setNewTimerLabel] = useState("Timer");
  const [weatherSearch, setWeatherSearch] = useState("");
  const [newMemoryKey, setNewMemoryKey] = useState("");
  const [newMemoryValue, setNewMemoryValue] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<"preference" | "profile" | "project" | "fact">("fact");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryValue, setEditMemoryValue] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // RAG Knowledge State
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [totalRagChunks, setTotalRagChunks] = useState<number>(0);
  const [ragLoading, setRagLoading] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>("");
  const [newDocContent, setNewDocContent] = useState<string>("");
  const [ragQueryInput, setRagQueryInput] = useState<string>("");
  const [ragQueryMatches, setRagQueryMatches] = useState<any[]>([]);

  // Load RAG documents when knowledge tab is selected or opened
  const loadRagDocs = async () => {
    setRagLoading(true);
    try {
      const res = await fetch("/api/rag/documents");
      if (res.ok) {
        const data = await res.json();
        setRagDocs(data.documents || []);
        setTotalRagChunks(data.totalChunks || 0);
      }
    } catch (e) {
      console.warn("Failed to load RAG docs:", e);
    } finally {
      setRagLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && activeTab === "knowledge") {
      loadRagDocs();
    }
  }, [isOpen, activeTab]);

  const handleIngestDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          content: newDocContent.trim(),
          tags: ["custom", "user-upload"],
        }),
      });
      if (res.ok) {
        setNewDocTitle("");
        setNewDocContent("");
        await loadRagDocs();
      }
    } catch (e) {
      console.error("Ingestion failed:", e);
    } finally {
      setRagLoading(false);
    }
  };

  const handleTestRagQuery = async () => {
    if (!ragQueryInput.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQueryInput.trim(), topK: 3, minScore: 0.35 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRagQueryMatches(data.results || []);
      }
    } catch (e) {
      console.error("RAG test query failed:", e);
    } finally {
      setRagLoading(false);
    }
  };

  const handleDeleteRagDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/rag/document/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        await loadRagDocs();
      }
    } catch (e) {
      console.error("Delete doc failed:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Productivity, RAG & Actions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800/80 bg-slate-900/30 overflow-x-auto scrollbar-none">
          {(["tasks", "notes", "timers", "memory", "knowledge", "actions", "weather", "briefing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[58px] py-2.5 text-[11px] font-medium capitalize transition cursor-pointer border-b-2 text-center ${
                activeTab === tab
                  ? "border-cyan-400 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "knowledge" ? "RAG" : tab === "actions" ? "Actions" : tab === "briefing" ? "Briefing" : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TASKS TAB */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskTitle.trim()) {
                      onAddTask(newTaskTitle.trim());
                      setNewTaskTitle("");
                    }
                  }}
                  placeholder="Add a new task..."
                  className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    if (newTaskTitle.trim()) {
                      onAddTask(newTaskTitle.trim());
                      setNewTaskTitle("");
                    }
                  }}
                  className="px-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition cursor-pointer flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No active tasks. Say "Add task: ..." or type above.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between group hover:border-slate-700 transition"
                    >
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="flex items-center gap-2.5 flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                            task.completed
                              ? "bg-emerald-500 border-emerald-500 text-slate-950"
                              : "border-slate-600 hover:border-cyan-400"
                          }`}
                        >
                          {task.completed && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span
                          className={`text-xs ${
                            task.completed ? "line-through text-slate-500" : "text-slate-200"
                          }`}
                        >
                          {task.title}
                        </span>
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Write note contents..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                />
                <button
                  onClick={() => {
                    if (newNoteTitle.trim() || newNoteContent.trim()) {
                      onAddNote(newNoteTitle.trim() || "Quick Note", newNoteContent.trim());
                      setNewNoteTitle("");
                      setNewNoteContent("");
                    }
                  }}
                  className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  Save Note
                </button>
              </div>

              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No notes yet. Tell S.A.M. "Take a note..." or add one above.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 group hover:border-slate-700 transition space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-300">{note.title}</span>
                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{note.content}</p>
                      <span className="text-[10px] text-slate-500 block pt-1">{note.createdAt}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TIMERS TAB */}
          {activeTab === "timers" && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTimerLabel}
                    onChange={(e) => setNewTimerLabel(e.target.value)}
                    placeholder="Timer Label (e.g. Tea, Sprint)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={newTimerMins}
                    onChange={(e) => setNewTimerMins(e.target.value)}
                    placeholder="Mins"
                    className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => {
                    const mins = parseInt(newTimerMins, 10) || 5;
                    onAddTimer(mins * 60, newTimerLabel.trim() || `${mins}m Timer`);
                  }}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Start Countdown Timer
                </button>
              </div>

              <div className="space-y-2">
                {timers.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No active timers. Say "Set a 5 minute timer" or add above.
                  </p>
                ) : (
                  timers.map((timer) => (
                    <div
                      key={timer.id}
                      className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <TimerIcon
                          size={16}
                          className={timer.isRunning ? "text-amber-400 animate-pulse" : "text-slate-500"}
                        />
                        <div>
                          <div className="text-xs font-semibold text-white">{timer.label}</div>
                          <div className="text-xs font-mono text-amber-300">
                            {Math.floor(timer.remainingSeconds / 60)}:
                            {(timer.remainingSeconds % 60).toString().padStart(2, "0")}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteTimer(timer.id)}
                        className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                        title="Delete Timer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MEMORY TAB (Long-Term User Memory) */}
          {activeTab === "memory" && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Brain size={13} className="text-purple-400" />
                  <span>Long-Term Personal Memory</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Facts, preferences, and project context saved here persist across conversations so S.A.M. remembers you. You have full control to inspect, add, or delete any entry.
                </p>
              </div>

              {/* Add Memory Item */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newMemoryKey}
                    onChange={(e) => setNewMemoryKey(e.target.value)}
                    placeholder="Key (e.g. user_name, project)"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <select
                    value={newMemoryCategory}
                    onChange={(e: any) => setNewMemoryCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="profile">Profile</option>
                    <option value="preference">Preference</option>
                    <option value="project">Project</option>
                    <option value="fact">Fact</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={newMemoryValue}
                  onChange={(e) => setNewMemoryValue(e.target.value)}
                  placeholder="Value (e.g. Mahendar, Learning Python & AI)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => {
                    if (newMemoryKey.trim() && newMemoryValue.trim()) {
                      onAddMemory(newMemoryKey.trim(), newMemoryValue.trim(), newMemoryCategory);
                      setNewMemoryKey("");
                      setNewMemoryValue("");
                    }
                  }}
                  className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Commit Memory
                </button>
              </div>

              {/* Memory List */}
              <div className="space-y-2">
                {memory.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No memories saved yet. Say "Remember that I'm learning Python" or add an entry above.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] text-slate-400 font-medium">Saved Context ({memory.length})</span>
                      <button
                        onClick={onClearMemory}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    {memory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between group hover:border-purple-500/40 transition"
                      >
                        {editingMemoryId === item.id ? (
                          <div className="flex-1 flex items-center gap-2 mr-2">
                            <input
                              type="text"
                              value={editMemoryValue}
                              onChange={(e) => setEditMemoryValue(e.target.value)}
                              className="flex-1 bg-slate-950 border border-purple-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (onUpdateMemory && editMemoryValue.trim()) {
                                  onUpdateMemory(item.id, editMemoryValue.trim());
                                }
                                setEditingMemoryId(null);
                              }}
                              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-[10px] font-semibold text-white cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMemoryId(null)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 truncate mr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                                  {item.category}
                                </span>
                                <span className="text-xs font-semibold text-white">{item.key}</span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 truncate">{item.value}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingMemoryId(item.id);
                                  setEditMemoryValue(item.value);
                                }}
                                className="text-slate-500 hover:text-purple-400 transition p-1 cursor-pointer"
                                title="Edit Memory Value"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => onDeleteMemory(item.id)}
                                className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                                title="Delete Memory"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* KNOWLEDGE (RAG) TAB */}
          {activeTab === "knowledge" && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                    <Brain size={15} />
                    <span>RAG Semantic Knowledge Base</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40">
                    {totalRagChunks} chunks indexed
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Real semantic retrieval powered by dense embeddings and cosine similarity. Uploaded documents are automatically chunked, indexed, and cited with <span className="text-indigo-300 font-mono">[Source: title]</span>.
                </p>
              </div>

              {/* Ingest Document Card */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Plus size={14} className="text-cyan-400" />
                  <span>Ingest Knowledge Document</span>
                </div>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Document Title (e.g. 'Project Roadmap 2026')..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Paste document text or reference guidelines here..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
                <button
                  onClick={handleIngestDocument}
                  disabled={ragLoading || !newDocTitle.trim() || !newDocContent.trim()}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {ragLoading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>Index into Knowledge Base</span>
                </button>
              </div>

              {/* Semantic Test Query */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Search size={14} className="text-cyan-400" />
                  <span>Test Retrieval Query</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ragQueryInput}
                    onChange={(e) => setRagQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTestRagQuery();
                    }}
                    placeholder="Ask a project or architecture question..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleTestRagQuery}
                    disabled={ragLoading || !ragQueryInput.trim()}
                    className="px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                  >
                    Query
                  </button>
                </div>

                {ragQueryMatches.length > 0 && (
                  <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Top Retrieved Chunks:</span>
                    {ragQueryMatches.map((m, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-950/80 border border-indigo-500/20 text-[11px]">
                        <div className="flex justify-between items-center text-indigo-300 font-medium">
                          <span className="truncate">{m.docTitle}</span>
                          <span className="text-[10px] font-mono text-cyan-400">
                            {Math.round(m.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-slate-300 text-[10px] mt-1 line-clamp-2">{m.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Indexed Documents List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span>Indexed Documents ({ragDocs.length})</span>
                  <button onClick={loadRagDocs} className="hover:text-cyan-400 cursor-pointer">
                    <RefreshCw size={12} className={ragLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                {ragDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex-1 truncate mr-2">
                      <span className="font-medium text-slate-200 block truncate">{doc.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {doc.chunkCount} chunks · {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {doc.id.startsWith("doc-sam-") ? (
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40 shrink-0">
                        System Seed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteRagDoc(doc.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SAFE ACTIONS TAB */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <ShieldCheck size={16} />
                  <span>Controlled Tool & Action Registry</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Allows S.A.M. to trigger verified actions through structured LLM function calling with strict domain whitelisting. Prevents arbitrary execution and avoids unverified native process claims.
                </p>
              </div>

              {/* Quick Action Commands to Test */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white px-1 block">Try Voice & Action Commands:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Open YouTube", cmd: "Sam, open YouTube" },
                    { label: "Search Python Tutorials", cmd: "Search Google for Python tutorials" },
                    { label: "Open Google", cmd: "Open Google" },
                    { label: "Open Instagram", cmd: "Open Instagram" },
                    { label: "Open GitHub", cmd: "Open GitHub" },
                    { label: "Telugu: యూట్యూబ్ ఓపెన్ చేయ్", cmd: "యూట్యూబ్ ఓపెన్ చెయ్యి" },
                    { label: "Hindi: गूगल सर्च करो", cmd: "गूगल पर सर्च करो" },
                    { label: "Test App Sandboxing", cmd: "Open calculator app" },
                  ].map((act, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (onTriggerCommand) {
                          onTriggerCommand(act.cmd);
                          onClose();
                        }
                      }}
                      className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer group active:scale-95"
                    >
                      <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 flex items-center justify-between">
                        <span>{act.label}</span>
                        <ExternalLink size={11} className="opacity-60 group-hover:opacity-100" />
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-mono">
                        "{act.cmd}"
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Whitelist Transparency */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                <span className="font-semibold text-white block">Approved Domain Whitelist:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "google.com",
                    "youtube.com",
                    "instagram.com",
                    "facebook.com",
                    "github.com",
                    "wikipedia.org",
                    "linkedin.com",
                    "reddit.com",
                    "x.com",
                    "stackoverflow.com",
                    "coursera.org",
                  ].map((domain, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-950 text-cyan-300 border border-cyan-800/30"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              {/* Native App Sandbox Policy Card */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/20 text-xs space-y-1.5">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Info size={14} />
                  <span>Desktop & Native Application Sandboxing Policy</span>
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  As a web application running inside an AI Studio browser iframe sandbox, direct execution of installed native desktop executables (e.g. <span className="font-mono text-slate-200">.exe</span>, shell scripts) or Android OS intents is restricted by browser security policies and Content Security Policy.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  S.A.M. never claims to have launched an installed desktop or phone app when it cannot do so. Instead, verified web portals or in-chat solutions are provided.
                </p>
              </div>
            </div>
          )}

          {/* WEATHER TAB */}
          {activeTab === "weather" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={weatherSearch}
                  onChange={(e) => setWeatherSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && weatherSearch.trim()) {
                      onRefreshWeather(weatherSearch.trim());
                      setWeatherSearch("");
                    }
                  }}
                  placeholder="Search city (e.g., Hyderabad, Delhi, London)..."
                  className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    if (weatherSearch.trim()) {
                      onRefreshWeather(weatherSearch.trim());
                      setWeatherSearch("");
                    }
                  }}
                  className="px-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition cursor-pointer flex items-center justify-center"
                >
                  <Search size={14} />
                </button>
              </div>

              {weather ? (
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{weather.location}</h4>
                      <p className="text-xs text-cyan-300 capitalize">{weather.condition}</p>
                    </div>
                    <button
                      onClick={() => onRefreshWeather()}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-950 border border-slate-800 transition cursor-pointer"
                      title="Refresh"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  <div className="text-2xl font-bold font-mono text-white">
                    {weather.temperatureC}°C
                    <span className="text-sm font-normal text-slate-400 ml-2">
                      ({weather.temperatureF}°F)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <div>Feels like: {weather.feelsLikeC}°C</div>
                    <div>Wind: {weather.windSpeedKmh} km/h</div>
                    <div>Humidity: {weather.humidity}%</div>
                    {weather.maxTempC && (
                      <div>High / Low: {weather.maxTempC}° / {weather.minTempC}°</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500 py-8">
                  Loading weather information...
                </p>
              )}
            </div>
          )}

          {/* BRIEFING TAB (Automatic Data Refresh & Live Tech News) */}
          {activeTab === "briefing" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Newspaper size={14} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Daily Tech & AI Briefing</span>
                </div>
                <button
                  onClick={onRefreshBriefing}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
                  title="Refresh Tech Stories"
                >
                  <RefreshCw size={11} className={briefing?.status === "idle" ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
              </div>

              {briefing?.lastSuccessfulRefresh && (
                <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Last Refreshed:</span>
                  <span className="font-mono text-cyan-300">
                    {new Date(briefing.lastSuccessfulRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {briefing && briefing.items && briefing.items.length > 0 ? (
                <div className="space-y-2.5">
                  {briefing.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-900/70 border border-white/[0.08] hover:border-cyan-500/30 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-white hover:text-cyan-300 transition line-clamp-2"
                        >
                          {item.title}
                        </a>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 shrink-0"
                          title="Open Original Source"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{item.source} · {item.score} pts</span>
                        <span>{new Date(item.retrievedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                  <p>No cached briefing available.</p>
                  <button
                    onClick={onRefreshBriefing}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-medium cursor-pointer"
                  >
                    Fetch Latest Headlines
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer: Cloud Sync Status & Backup Export (Priority 7) */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isCloudConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"
              }`}
            />
            <span className="text-[10px] font-mono text-slate-400">
              {isCloudConnected ? "Firestore Cloud: Active" : "Local Storage Mode"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onExportBackup}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/[0.08] text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Export JSON Backup of Tasks, Notes, and Memory"
            >
              <Download size={12} className="text-cyan-400" />
              <span>Export</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onRestoreBackup) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const parsed = JSON.parse(ev.target?.result as string);
                      onRestoreBackup(parsed);
                    } catch (err) {
                      console.error("Backup parse error:", err);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }
              }}
            />

            {onRestoreBackup && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-purple-200 hover:text-white border border-purple-800/60 text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Restore Tasks, Notes, & Memory from JSON Backup File"
              >
                <Upload size={12} className="text-purple-400" />
                <span>Restore</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

