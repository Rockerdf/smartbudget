import { useState, useEffect, useMemo } from "react";
import { DISMISSED_KEY, READ_KEY, fetchNotifications, loadIds, saveIds } from "../lib/notifications";
import type { AppNotification } from "../lib/notifications";

// Notifications are worked out from the user's own budget and savings goals
// (see lib/notifications.ts). Read/dismissed state is kept in this browser.
type Notification = AppNotification;

type FilterTab = "all" | "budget" | "savings";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "budget", label: "Budget" },
  { key: "savings", label: "Savings" },
];

function typeColor(type: Notification["type"]) {
  switch (type) {
    case "warning":
      return { bg: "#FEF3C7", icon: "#D97706", border: "#F59E0B" };
    case "success":
      return { bg: "#D1FAE5", icon: "#059669", border: "#10B981" };
    case "info":
      return { bg: "#DBEAFE", icon: "#2563EB", border: "#3B82F6" };
    case "error":
      return { bg: "#FEE2E2", icon: "#DC2626", border: "#EF4444" };
    case "security":
      return { bg: "#EDE9FE", icon: "#7C3AED", border: "#8B5CF6" };
  }
}

function TypeIcon({ type }: { type: Notification["type"] }) {
  const { bg, icon } = typeColor(type);
  return (
    <div
      style={{ backgroundColor: bg, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      {type === "warning" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === "success" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 4L12 14.01l-3-3" stroke={icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === "info" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={icon} strokeWidth="2" />
          <path d="M12 16v-4m0-4h.01" stroke={icon} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {type === "error" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={icon} strokeWidth="2" />
          <path d="M15 9l-6 6m0-6l6 6" stroke={icon} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {type === "security" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export default function Notifications({ navigate }: { navigate: (s: import("../App").Screen) => void }) {
  const [generated, setGenerated] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [readIds, setReadIds] = useState<string[]>(() => loadIds(READ_KEY));
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => loadIds(DISMISSED_KEY));

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then((list) => {
        if (cancelled) return;
        setGenerated(list);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "We could not load your notifications.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const notifications = useMemo<Notification[]>(
    () => generated
      .filter((n) => !dismissedIds.includes(n.id))
      .map((n) => ({ ...n, read: readIds.includes(n.id) })),
    [generated, readIds, dismissedIds],
  );
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    return n.category === activeFilter;
  });

  function updateRead(next: string[]) { setReadIds(next); saveIds(READ_KEY, next); }
  function updateDismissed(next: string[]) { setDismissedIds(next); saveIds(DISMISSED_KEY, next); }

  function markRead(id: string) {
    if (!readIds.includes(id)) updateRead([...readIds, id]);
  }

  function markAllRead() {
    updateRead(Array.from(new Set([...readIds, ...notifications.map((n) => n.id)])));
    setToast("All notifications marked as read.");
  }

  function deleteNotification(id: string) {
    updateDismissed([...dismissedIds, id]);
    setToast("Notification removed.");
  }

  function clearAll() {
    updateDismissed(Array.from(new Set([...dismissedIds, ...filtered.map((n) => n.id)])));
    setToast(activeFilter === "all" ? "All notifications cleared." : "Filtered notifications cleared.");
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1E293B",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#94A3B8" }}>
          <button
            onClick={() => navigate("dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB", fontSize: 13, padding: 0, fontWeight: 500 }}
          >
            Dashboard
          </button>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ color: "#64748B", fontWeight: 500 }}>Notifications</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0F172A" }}>Notification Center</h1>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "#2563EB",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "2px 9px",
                  lineHeight: "20px",
                  minWidth: 24,
                  textAlign: "center",
                  display: "inline-block",
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                backgroundColor: "#fff",
                color: unreadCount === 0 ? "#CBD5E1" : "#2563EB",
                cursor: unreadCount === 0 ? "default" : "pointer",
                transition: "background 0.15s",
              }}
            >
              Mark all read
            </button>
            <button
              onClick={clearAll}
              disabled={filtered.length === 0}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid #FEE2E2",
                backgroundColor: filtered.length === 0 ? "#F8FAFC" : "#FFF5F5",
                color: filtered.length === 0 ? "#CBD5E1" : "#DC2626",
                cursor: filtered.length === 0 ? "default" : "pointer",
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            backgroundColor: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            padding: 4,
            width: "fit-content",
          }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const tabCount = tab.key === "all"
              ? notifications.length
              : notifications.filter((n) => n.category === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: isActive ? "#2563EB" : "transparent",
                  color: isActive ? "#fff" : "#64748B",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
                {tabCount > 0 && (
                  <span
                    style={{
                      backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                      color: isActive ? "#fff" : "#64748B",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 6px",
                    }}
                  >
                    {tabCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        {loadError && (
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#991B1B", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px" }}>{loadError}</p>
        )}
        {loading && <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B" }}>Loading your notifications…</p>}
        {filtered.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 16,
              padding: "64px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#64748B" }}>No notifications here</p>
            <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
              {activeFilter === "all" ? "You're all caught up!" : `No ${activeFilter} notifications at this time.`}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((n) => {
              const colors = typeColor(n.type);
              return (
                <div
                  key={n.id}
                  style={{
                    backgroundColor: n.read ? "#fff" : "#FAFBFF",
                    border: "1px solid #E2E8F0",
                    borderLeft: n.read ? "1px solid #E2E8F0" : `4px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Icon */}
                  <TypeIcon type={n.type} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: n.read ? 600 : 700, color: "#0F172A", lineHeight: 1.3 }}>{n.title}</span>
                      {!n.read && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2563EB", flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>{n.body}</p>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{n.time}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        title="Mark as read"
                        style={{
                          padding: "5px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: "1px solid #DBEAFE",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      title="Delete notification"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                        color: "#94A3B8",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FEE2E2";
                        (e.currentTarget as HTMLButtonElement).style.color = "#DC2626";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#FECACA";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F8FAFC";
                        (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 14H6L5 6M10 11v6m4-6v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        {filtered.length > 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#CBD5E1", marginTop: 24 }}>
            Showing {filtered.length} notification{filtered.length !== 1 ? "s" : ""}
            {unreadCount > 0 ? ` · ${unreadCount} unread` : " · All caught up"}
          </p>
        )}
      </div>
    </div>
  );
}
