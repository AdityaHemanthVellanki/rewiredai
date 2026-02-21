"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  addDays,
  startOfWeek,
  format,
  isSameDay,
  parseISO,
} from "date-fns";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am - 10pm

export default function SchedulePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  async function fetchData() {
    setIsLoading(true);
    const weekEnd = addDays(currentWeekStart, 7);
    try {
      const [sbRes, aRes] = await Promise.all([
        fetch(
          `/api/study-blocks?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`
        ),
        fetch(
          `/api/assignments?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Your weekly view — classes, study blocks, and deadlines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCurrentWeekStart(addDays(currentWeekStart, -7))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(currentWeekStart, "MMM d")} —{" "}
            {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCurrentWeekStart(addDays(currentWeekStart, 7))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="ml-2 bg-purple-600 hover:bg-purple-700">
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
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Add Study Block
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="min-w-[800px]">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
                <div className="p-2" />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`border-l border-border/50 p-2 text-center ${
                      isSameDay(day, new Date())
                        ? "bg-purple-500/10"
                        : ""
                    }`}
                  >
                    <p className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        isSameDay(day, new Date()) ? "text-purple-400" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                ))}
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

                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative border-l border-border/30 ${
                          isSameDay(day, new Date()) ? "bg-purple-500/5" : ""
                        }`}
                      >
                        {dayBlocks.map((sb) => {
                          const durationHours =
                            (new Date(sb.end_time).getTime() -
                              new Date(sb.start_time).getTime()) /
                            3600000;
                          return (
                            <div
                              key={sb.id}
                              className="absolute inset-x-1 rounded bg-purple-500/20 border border-purple-500/30 p-1 text-xs"
                              style={{ height: `${durationHours * 60 - 4}px` }}
                            >
                              <span className="font-medium text-purple-300">
                                {sb.title}
                              </span>
                            </div>
                          );
                        })}
                        {dayDeadlines.map((a) => (
                          <div
                            key={a.id}
                            className="absolute inset-x-1 top-0 rounded bg-red-500/20 border border-red-500/30 p-1 text-xs"
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
      )}
    </div>
  );
}
