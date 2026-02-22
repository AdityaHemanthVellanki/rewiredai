"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { StudyBlock, Assignment } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { motion, AnimatePresence } from "motion/react";
import {
  addDays,
  startOfWeek,
  format,
  isSameDay,
  parseISO,
} from "date-fns";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

export default function SchedulePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_hour: "10",
    end_hour: "12",
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  // Current time position for the red line
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isCurrentWeek = weekDays.some((d) => isSameDay(d, now));

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  async function fetchData() {
    setIsLoading(true);
    const weekEnd = addDays(currentWeekStart, 7);
    try {
      const [sbRes, aRes, calRes] = await Promise.all([
        fetch(
          `/api/study-blocks?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`
        ),
        fetch(
          `/api/assignments?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`
        ),
        fetch(
          `/api/google/calendar?timeMin=${currentWeekStart.toISOString()}&timeMax=${weekEnd.toISOString()}`
        ),
      ]);

      if (sbRes.ok) {
        const data = await sbRes.json();
        setStudyBlocks(data.studyBlocks || []);
      }
      if (aRes.ok) {
        const data = await aRes.json();
        setAssignments(data.assignments || []);
      }
      if (calRes.ok) {
        const data = await calRes.json();
        setGoogleEvents(data.events || []);
      }
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddBlock() {
    try {
      const startTime = new Date(
        `${newBlock.date}T${newBlock.start_hour.padStart(2, "0")}:00:00`
      );
      const endTime = new Date(
        `${newBlock.date}T${newBlock.end_hour.padStart(2, "0")}:00:00`
      );

      const res = await fetch("/api/study-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBlock.title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        }),
      });

      if (res.ok) {
        toast.success("Study block added!");
        setAddDialogOpen(false);
        fetchData();
      }
    } catch {
      toast.error("Failed to add study block");
    }
  }

  const filteredGoogleEvents = googleEvents.filter(
    (ge) => {
      if (ge.summary?.startsWith("📚")) return false;
      return !studyBlocks.some((sb) => sb.google_event_id === ge.id);
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle="Your weekly view — classes, study blocks, and deadlines."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="active-press"
              onClick={() =>
                setCurrentWeekStart(addDays(currentWeekStart, -7))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(currentWeekStart, "MMM d")} —{" "}
              {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="active-press"
              onClick={() =>
                setCurrentWeekStart(addDays(currentWeekStart, 7))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="ml-2 bg-purple-600 hover:bg-purple-700 active-press">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Block
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Study Block</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="What are you studying?"
                    value={newBlock.title}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, title: e.target.value })
                    }
                  />
                  <Input
                    type="date"
                    value={newBlock.date}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, date: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 text-sm text-muted-foreground">
                        Start
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={newBlock.start_hour}
                        onChange={(e) =>
                          setNewBlock({ ...newBlock, start_hour: e.target.value })
                        }
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="mb-1 text-sm text-muted-foreground">
                        End
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={newBlock.end_hour}
                        onChange={(e) =>
                          setNewBlock({ ...newBlock, end_hour: e.target.value })
                        }
                        placeholder="12"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddBlock}
                    disabled={!newBlock.title.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 active-press"
                  >
                    Add Study Block
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
        className="flex gap-4 text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-blue-500/30 border border-blue-500/50" />
          <span>Classes / Calendar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-purple-500/30 border border-purple-500/50" />
          <span>Study Blocks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500/30 border border-red-500/50" />
          <span>Deadlines</span>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.15 }}
        >
          <Card className="hover-lift">
            <CardContent className="overflow-x-auto p-0">
              <div className="min-w-[800px]">
                {/* Day headers */}
                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
                  <div className="p-2" />
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-l border-border/50 p-2 text-center transition-colors ${
                          isToday ? "bg-purple-500/10" : ""
                        }`}
                      >
                        <p className="text-xs text-muted-foreground">
                          {format(day, "EEE")}
                        </p>
                        <p
                          className={`text-lg font-semibold ${
                            isToday ? "text-purple-400" : ""
                          }`}
                        >
                          {isToday ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 ring-2 ring-purple-500/30">
                              {format(day, "d")}
                            </span>
                          ) : (
                            format(day, "d")
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/30"
                    style={{ height: 60 }}
                  >
                    <div className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground">
                      {hour > 12 ? `${hour - 12}PM` : hour === 12 ? "12PM" : `${hour}AM`}
                    </div>
                    {weekDays.map((day) => {
                      const dayBlocks = studyBlocks.filter(
                        (sb) =>
                          isSameDay(parseISO(sb.start_time), day) &&
                          new Date(sb.start_time).getHours() === hour
                      );
                      const dayDeadlines = assignments.filter(
                        (a) =>
                          isSameDay(parseISO(a.due_date), day) &&
                          new Date(a.due_date).getHours() === hour
                      );
                      const dayGoogleEvents = filteredGoogleEvents.filter(
                        (ge) => {
                          const start = new Date(ge.start.dateTime);
                          return isSameDay(start, day) && start.getHours() === hour;
                        }
                      );

                      const isToday = isSameDay(day, new Date());
                      const showTimeLine = isCurrentWeek && isToday && hour === currentHour;

                      return (
                        <div
                          key={day.toISOString()}
                          className={`relative border-l border-border/30 transition-colors hover:bg-purple-500/[0.03] ${
                            isToday ? "bg-purple-500/5" : ""
                          }`}
                        >
                          {/* Current time indicator */}
                          {showTimeLine && (
                            <div
                              className="absolute left-0 right-0 z-20 h-0.5 bg-red-500"
                              style={{ top: `${(currentMinute / 60) * 100}%` }}
                            >
                              <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                            </div>
                          )}

                          {/* Google Calendar events — blue */}
                          {dayGoogleEvents.map((ge) => {
                            const startTime = new Date(ge.start.dateTime);
                            const endTime = new Date(ge.end.dateTime);
                            const durationHours =
                              (endTime.getTime() - startTime.getTime()) / 3600000;
                            return (
                              <div
                                key={ge.id}
                                className="absolute inset-x-1 rounded bg-blue-500/20 border border-blue-500/40 p-1 text-xs z-10 transition-all hover:bg-blue-500/30 hover:border-blue-500/60 hover:shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                                style={{ height: `${Math.max(durationHours * 60 - 4, 16)}px` }}
                              >
                                <span className="font-medium text-blue-300">
                                  {ge.summary || "Event"}
                                </span>
                              </div>
                            );
                          })}
                          {/* Study blocks — purple */}
                          {dayBlocks.map((sb) => {
                            const durationHours =
                              (new Date(sb.end_time).getTime() -
                                new Date(sb.start_time).getTime()) /
                              3600000;
                            return (
                              <div
                                key={sb.id}
                                className={`absolute inset-x-1 rounded border p-1 text-xs transition-all hover:shadow-[0_0_8px_rgba(139,92,246,0.15)] ${
                                  sb.status === "completed"
                                    ? "bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30 hover:border-purple-500/50"
                                }`}
                                style={{ height: `${durationHours * 60 - 4}px` }}
                              >
                                <span className={`font-medium ${sb.status === "completed" ? "text-emerald-300" : "text-purple-300"}`}>
                                  {sb.status === "completed" ? "✓ " : ""}{sb.title}
                                </span>
                              </div>
                            );
                          })}
                          {/* Deadlines — red */}
                          {dayDeadlines.map((a) => (
                            <div
                              key={a.id}
                              className="absolute inset-x-1 top-0 rounded bg-red-500/20 border border-red-500/30 p-1 text-xs transition-all hover:bg-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                            >
                              <span className="font-medium text-red-300">
                                DUE: {a.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
