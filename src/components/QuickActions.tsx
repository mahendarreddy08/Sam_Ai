import React, { useState } from "react";
import {
  Youtube,
  MessageSquare,
  Mail,
  Github,
  Bot,
  Search,
  ExternalLink,
  ChevronDown,
  PlusCircle,
  FileText,
  Timer as TimerIcon,
  Globe,
  Share2,
  HardDrive,
  X as CloseIcon,
} from "lucide-react";
import { WEBSITE_REGISTRY, WebsiteDestination, launchWebsite } from "../services/websiteLauncher";

interface QuickActionsProps {
  onExecuteAction: (action: any) => void;
  onAddTask: (title: string) => void;
  onAddNote: (title: string, content: string) => void;
  onStartTimer: (seconds: number, label: string) => void;
  onSearchWeb: (query: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onExecuteAction,
  onAddTask,
  onAddNote,
  onStartTimer,
  onSearchWeb,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  const [inputQuery, setInputQuery] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const handleLaunchSite = (destId: string) => {
    const dest = WEBSITE_REGISTRY[destId];
    if (!dest) return;

    const reqId = `quick-${destId}-${Date.now()}`;
    const result = launchWebsite(destId, { requestId: reqId });

    onExecuteAction({
      type: "safe_action",
      action: "launch_website",
      destinationId: dest.id,
      destinationUrl: result.url,
      title: dest.name,
      description: dest.description,
      domain: new URL(dest.url).hostname,
      isAllowed: true,
      buttonLabel: `Open ${dest.name} ↗`,
      popupBlocked: result.popupBlocked,
      requestId: reqId,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    onSearchWeb(inputQuery.trim());
    setInputQuery("");
    setSearchModalOpen(false);
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle.trim());
    setTaskTitle("");
    setTaskModalOpen(false);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;
    onAddNote(noteTitle.trim() || "Quick Note", noteContent.trim() || noteTitle.trim());
    setNoteTitle("");
    setNoteContent("");
    setNoteModalOpen(false);
  };

  // 6 Primary Quick Shortcuts
  const PRIMARY_SHORTCUTS = [
    {
      id: "youtube",
      name: "YouTube",
      icon: <Youtube size={14} className="text-rose-400" />,
      color: "hover:border-rose-500/50 hover:bg-rose-500/10",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: <MessageSquare size={14} className="text-emerald-400" />,
      color: "hover:border-emerald-500/50 hover:bg-emerald-500/10",
    },
    {
      id: "gmail",
      name: "Gmail",
      icon: <Mail size={14} className="text-amber-400" />,
      color: "hover:border-amber-500/50 hover:bg-amber-500/10",
    },
    {
      id: "github",
      name: "GitHub",
      icon: <Github size={14} className="text-slate-200" />,
      color: "hover:border-slate-400/50 hover:bg-slate-400/10",
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      icon: <Bot size={14} className="text-teal-400" />,
      color: "hover:border-teal-500/50 hover:bg-teal-500/10",
    },
    {
      id: "googlesearch",
      name: "Google",
      icon: <Search size={14} className="text-sky-400" />,
      color: "hover:border-sky-500/50 hover:bg-sky-500/10",
    },
  ];

  // Secondary destinations
  const SECONDARY_DESTINATIONS: WebsiteDestination[] = [
    WEBSITE_REGISTRY.instagram,
    WEBSITE_REGISTRY.facebook,
    WEBSITE_REGISTRY.linkedin,
    WEBSITE_REGISTRY.x,
    WEBSITE_REGISTRY.telegram,
    WEBSITE_REGISTRY.googledrive,
  ].filter(Boolean);

  return (
    <div className="w-full max-w-xl mx-auto px-4 z-20">
      <div className="flex items-center justify-between gap-1.5 p-1 rounded-2xl bg-slate-950/70 border border-white/[0.08] backdrop-blur-xl shadow-lg">
        {/* Horizontal Shortcut Chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 px-1 flex-1">
          {PRIMARY_SHORTCUTS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLaunchSite(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer shrink-0 active:scale-95 ${item.color}`}
              title={`Open ${item.name}`}
            >
              {item.icon}
              <span className="hidden xs:inline">{item.name}</span>
            </button>
          ))}

          {/* Quick Assistant Actions */}
          <div className="h-4 w-px bg-white/10 mx-1 shrink-0" />

          <button
            onClick={() => setSearchModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-950/40 hover:bg-sky-900/40 border border-sky-500/30 text-[11px] font-medium text-sky-300 hover:text-sky-100 transition cursor-pointer shrink-0 active:scale-95"
            title="Search the web"
          >
            <Search size={13} />
            <span>Search</span>
          </button>

          <button
            onClick={() => setTaskModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-[11px] font-medium text-emerald-300 hover:text-emerald-100 transition cursor-pointer shrink-0 active:scale-95"
            title="Create a new task"
          >
            <PlusCircle size={13} />
            <span>Task</span>
          </button>

          <button
            onClick={() => setNoteModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30 text-[11px] font-medium text-purple-300 hover:text-purple-100 transition cursor-pointer shrink-0 active:scale-95"
            title="Take a quick note"
          >
            <FileText size={13} />
            <span>Note</span>
          </button>

          <button
            onClick={() => onStartTimer(300, "5m Focus Timer")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/40 border border-amber-500/30 text-[11px] font-medium text-amber-300 hover:text-amber-100 transition cursor-pointer shrink-0 active:scale-95"
            title="Start 5 minute timer"
          >
            <TimerIcon size={13} />
            <span>5m Timer</span>
          </button>
        </div>

        {/* More Destinations Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-xl border text-slate-400 hover:text-white transition cursor-pointer shrink-0 ${
            isOpen
              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
              : "bg-slate-900/70 border-white/[0.08] hover:bg-slate-800"
          }`}
          title="More websites and destinations"
        >
          <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Expanded Registry Grid */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-2xl bg-slate-950/90 border border-white/[0.1] backdrop-blur-2xl shadow-2xl animate-fade-in space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
            <span>Validated Registry Destinations (12 Sites)</span>
            <span className="text-[10px] text-cyan-400">Strict Domain Whitelist</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(WEBSITE_REGISTRY).map((dest) => (
              <button
                key={dest.id}
                onClick={() => {
                  handleLaunchSite(dest.id);
                  setIsOpen(false);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-white/[0.06] hover:border-cyan-500/40 text-left transition group cursor-pointer active:scale-95"
              >
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                    {dest.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {dest.category}
                  </div>
                </div>
                <ExternalLink size={12} className="text-slate-500 group-hover:text-cyan-400 shrink-0 ml-1.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Live Web Search</h3>
              </div>
              <button
                onClick={() => setSearchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Query current news, tech updates, or search Google directly with verified citations.
            </p>
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Search Google or query S.A.M. (e.g., 'latest AI news')..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inputQuery.trim()}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition"
                >
                  Search Web
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">New Task</h3>
              </div>
              <button
                onClick={() => setTaskModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <form onSubmit={handleTaskSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task description (e.g. 'Review pull request', 'Study Telugu verbs')..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!taskTitle.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-white">New Note</h3>
              </div>
              <button
                onClick={() => setNoteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <form onSubmit={handleNoteSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note Title (e.g. 'Meeting Ideas', 'Algorithm notes')..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
              />
              <textarea
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your note content here..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!noteTitle.trim() && !noteContent.trim()}
                  className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-semibold text-xs transition"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
