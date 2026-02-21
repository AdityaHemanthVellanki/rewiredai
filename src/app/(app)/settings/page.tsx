"use client";

import { Suspense, useState, useEffect } from "react";
import {
  User,
  Bell,
  Clock,
  Target,
  Link2,
  Loader2,
  Check,
  RefreshCw,
  Mail,
  Calendar,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Profile } from "@/types";

interface CanvasInfo {
  id: string;
  canvas_base_url: string;
  student_name: string | null;
  last_synced_at: string | null;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasInfo, setCanvasInfo] = useState<CanvasInfo | null>(null);

  const [isConnectingCanvas, setIsConnectingCanvas] = useState(false);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState(false);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState("https://umamherst.instructure.com");
  const [canvasToken, setCanvasToken] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setGoogleConnected(data.googleConnected);
          setGoogleEmail(data.googleEmail);
          setCanvasConnected(data.canvasConnected);
          setCanvasInfo(data.canvasInfo);
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        toast.success("Settings saved!");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function connectCanvas() {
    if (!canvasUrl || !canvasToken) {
      toast.error("Please enter your Canvas URL and access token.");
      return;
    }
    setIsConnectingCanvas(true);
    try {
      const res = await fetch("/api/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasUrl, accessToken: canvasToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCanvasConnected(true);
        setCanvasInfo({
          id: "",
          canvas_base_url: canvasUrl,
          student_name: data.studentName || null,
          last_synced_at: null,
        });
        setCanvasToken("");
        toast.success("Canvas connected!");
      } else {
        toast.error(data.error || "Failed to connect Canvas");
      }
    } catch {
      toast.error("Failed to connect Canvas");
    } finally {
      setIsConnectingCanvas(false);
    }
  }

  async function disconnectCanvas() {
    try {
      await fetch("/api/canvas/connect", { method: "DELETE" });
      setCanvasConnected(false);
      setCanvasInfo(null);
      toast.success("Canvas disconnected");
    } catch {
      toast.error("Failed to disconnect Canvas");
    }
  }

  async function syncCanvas() {
    setIsSyncingCanvas(true);
    try {
      const res = await fetch("/api/canvas/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const parts = [];
        if (data.coursesCreated) parts.push(`${data.coursesCreated} new courses`);
        if (data.assignmentsCreated) parts.push(`${data.assignmentsCreated} new assignments`);
        if (data.assignmentsUpdated) parts.push(`${data.assignmentsUpdated} assignments updated`);
        if (data.gradesImported) parts.push(`${data.gradesImported} grades imported`);
        toast.success(
          parts.length > 0
            ? `Synced! ${parts.join(", ")}.`
            : "Canvas is up to date — no new changes."
        );
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Failed to sync with Canvas");
    } finally {
      setIsSyncingCanvas(false);
    }
  }

  async function syncEmails() {
    setIsSyncingEmails(true);
    try {
      const res = await fetch("/api/google/emails", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.processed > 0) {
          toast.success(`Processed ${data.processed} new emails`);
        } else {
          toast.info(data.debug || "No new emails to process");
        }
      } else {
        toast.error(data.error || "Email sync failed");
      }
    } catch {
      toast.error("Failed to sync emails");
    } finally {
      setIsSyncingEmails(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Customize your Rewired experience and manage integrations.
        </p>
      </div>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-400" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google — auto-connected via login */}
          <div className="rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-muted-foreground">
                    {googleConnected
                      ? `Connected as ${googleEmail || "your Google account"}`
                      : "Sign in with Google to connect"}
                  </p>
                </div>
              </div>
              {googleConnected ? (
                <Badge className="bg-green-500/10 text-green-400">
                  <Check className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>

            {googleConnected && (
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={syncEmails}
                  disabled={isSyncingEmails}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isSyncingEmails ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Mail className="h-3 w-3" />
                  )}
                  Sync Emails
                </Button>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href="/schedule">
                    <Calendar className="h-3 w-3" />
                    View Calendar
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Canvas LMS */}
          <div className="rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white text-xs font-bold">
                  C
                </div>
                <div>
                  <p className="text-sm font-medium">Canvas LMS</p>
                  <p className="text-xs text-muted-foreground">
                    {canvasConnected
                      ? `Connected as ${canvasInfo?.student_name || "student"}`
                      : "Import courses, assignments, and grades"}
                  </p>
                </div>
              </div>
              {canvasConnected ? (
                <Badge className="bg-green-500/10 text-green-400">
                  <Check className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>

            {canvasConnected ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {canvasInfo?.canvas_base_url}
                  {canvasInfo?.last_synced_at &&
                    ` — Last synced: ${new Date(canvasInfo.last_synced_at).toLocaleString()}`}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={syncCanvas}
                    disabled={isSyncingCanvas}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {isSyncingCanvas ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    onClick={disconnectCanvas}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Input
                    value={canvasUrl}
                    onChange={(e) => setCanvasUrl(e.target.value)}
                    placeholder="https://your-school.instructure.com"
                    className="text-sm"
                  />
                  <Input
                    type="password"
                    value={canvasToken}
                    onChange={(e) => setCanvasToken(e.target.value)}
                    placeholder="Paste your Canvas access token"
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <a
                    href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    How to get a token
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    onClick={connectCanvas}
                    disabled={isConnectingCanvas || !canvasToken}
                    size="sm"
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isConnectingCanvas ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-white/20 text-[10px] font-bold">
                        C
                      </div>
                    )}
                    Connect
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-400" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 text-sm text-muted-foreground">Name</label>
            <Input
              value={profile.full_name || ""}
              onChange={(e) =>
                setProfile({ ...profile, full_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1 text-sm text-muted-foreground">
              Timezone
            </label>
            <Input
              value={profile.timezone}
              onChange={(e) =>
                setProfile({ ...profile, timezone: e.target.value })
              }
              placeholder="America/New_York"
            />
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-400" />
            Goals & Motivation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 text-sm text-muted-foreground">
              Your &quot;Why&quot; — Why are you in college?
            </label>
            <Textarea
              value={profile.personal_why || ""}
              onChange={(e) =>
                setProfile({ ...profile, personal_why: e.target.value })
              }
              placeholder="e.g., I want to be the first in my family to graduate..."
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 text-sm text-muted-foreground">
              GPA Target
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="4"
              value={profile.gpa_target || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  gpa_target: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              placeholder="3.5"
            />
          </div>
          <div>
            <label className="mb-1 text-sm text-muted-foreground">
              Semester Goals (one per line)
            </label>
            <Textarea
              value={(profile.semester_goals || []).join("\n")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  semester_goals: e.target.value
                    .split("\n")
                    .filter((g) => g.trim()),
                })
              }
              placeholder="Make the Dean's List&#10;Submit my research paper&#10;Get an internship"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Productivity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            Productivity Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 text-sm text-muted-foreground">
              Peak Productivity Hours (e.g., 10:00-13:00)
            </label>
            <Input
              value={(profile.productivity_peak_hours || []).join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  productivity_peak_hours: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="10:00-13:00, 19:00-22:00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                Sleep Time
              </label>
              <Input
                type="time"
                value={profile.sleep_window?.sleep || "23:00"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    sleep_window: {
                      ...profile.sleep_window,
                      sleep: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                Wake Time
              </label>
              <Input
                type="time"
                value={profile.sleep_window?.wake || "08:00"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    sleep_window: {
                      ...profile.sleep_window,
                      wake: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-400" />
            Nudge Intensity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(["gentle", "standard", "aggressive"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  setProfile({ ...profile, escalation_mode: mode })
                }
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  profile.escalation_mode === mode
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <p className="font-medium capitalize">{mode}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mode === "gentle" && "Friendly reminders, no pressure"}
                  {mode === "standard" && "Direct nudges, mild guilt trips"}
                  {mode === "aggressive" && "Full drill sergeant mode"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
