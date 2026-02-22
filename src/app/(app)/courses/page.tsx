"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Upload,
  BookOpen,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Course, Assignment } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { motion, AnimatePresence } from "motion/react";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadingCourseId, setUploadingCourseId] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    name: "",
    code: "",
    professor: "",
    schedule: "",
    color: COLORS[0],
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
        const assignmentMap: Record<string, Assignment[]> = {};
        for (const course of data.courses || []) {
          const aRes = await fetch(`/api/assignments?course_id=${course.id}`);
          if (aRes.ok) {
            const aData = await aRes.json();
            assignmentMap[course.id] = aData.assignments || [];
          }
        }
        setAssignments(assignmentMap);
      }
    } catch {
      toast.error("Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddCourse() {
    if (!newCourse.name.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCourse),
      });
      if (res.ok) {
        toast.success("Course added!");
        setAddDialogOpen(false);
        setNewCourse({ name: "", code: "", professor: "", schedule: "", color: COLORS[0] });
        fetchCourses();
      }
    } catch {
      toast.error("Failed to add course");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteCourse(courseId: string) {
    try {
      const res = await fetch(`/api/courses?id=${courseId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Course deleted");
        fetchCourses();
      }
    } catch {
      toast.error("Failed to delete course");
    }
  }

  async function handleSyllabusUpload(courseId: string, file: File) {
    setUploadingCourseId(courseId);
    setUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("course_id", courseId);

      const res = await fetch("/api/syllabus/parse", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(courseId);
        toast.success(
          `Parsed ${data.deadlines_created} deadlines from syllabus!`
        );
        setTimeout(() => setUploadSuccess(null), 3000);
        fetchCourses();
      } else {
        toast.error("Failed to parse syllabus");
      }
    } catch {
      toast.error("Failed to upload syllabus");
    } finally {
      setUploadingCourseId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Courses"
          subtitle="Manage your courses and upload syllabi for automatic deadline extraction."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-skeleton h-[220px] rounded-xl border border-border/30 bg-white/[0.02]"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle="Manage your courses and upload syllabi for automatic deadline extraction."
        actions={
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 active-press">
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Course</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Course name (e.g., Organic Chemistry)"
                  value={newCourse.name}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, name: e.target.value })
                  }
                />
                <Input
                  placeholder="Course code (e.g., CHEM 201)"
                  value={newCourse.code}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, code: e.target.value })
                  }
                />
                <Input
                  placeholder="Professor name"
                  value={newCourse.professor}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, professor: e.target.value })
                  }
                />
                <Input
                  placeholder="Schedule (e.g., MWF 10:00-10:50)"
                  value={newCourse.schedule}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, schedule: e.target.value })
                  }
                />
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Color</p>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          setNewCourse({ ...newCourse, color })
                        }
                        className={`h-8 w-8 rounded-full transition-all duration-200 ${
                          newCourse.color === color
                            ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-background"
                            : "hover:scale-105 border-2 border-transparent"
                        }`}
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            newCourse.color === color
                              ? `0 0 12px ${color}60`
                              : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleAddCourse}
                  disabled={isAdding || !newCourse.name.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 active-press"
                >
                  {isAdding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Add Course
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {courses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="animate-glow-pulse flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/10">
                  <BookOpen className="h-10 w-10 text-purple-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">No courses yet</h3>
              <p className="mt-1 text-sm text-muted-foreground text-center max-w-xs">
                Add your first course to get started with deadline tracking and grade monitoring.
              </p>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="mt-6 bg-purple-600 hover:bg-purple-700 active-press"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Course
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {courses.map((course, index) => {
              const courseAssignments = assignments[course.id] || [];
              const pending = courseAssignments.filter(
                (a) => a.status !== "completed"
              ).length;

              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                    delay: index * 0.06,
                  }}
                >
                  <Card
                    className="group relative overflow-hidden hover-lift transition-all duration-200"
                    style={{
                      ["--tw-shadow-color" as string]: `${course.color}15`,
                    }}
                  >
                    {/* Color accent bar */}
                    <div
                      className="absolute left-0 top-0 h-full w-1 transition-all duration-300 group-hover:w-1.5"
                      style={{
                        background: `linear-gradient(to bottom, ${course.color}, ${course.color}80)`,
                      }}
                    />
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base">{course.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {course.code}
                          {course.professor && ` \u2022 ${course.professor}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="rounded-md p-1.5 text-muted-foreground/50 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:scale-110"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {course.schedule && (
                        <p className="text-xs text-muted-foreground">
                          {course.schedule}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="animate-fade-in transition-transform hover:scale-105"
                          style={{ animationDelay: `${index * 0.06 + 0.2}s` }}
                        >
                          {pending} pending deadline{pending !== 1 ? "s" : ""}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="animate-fade-in transition-transform hover:scale-105"
                          style={{ animationDelay: `${index * 0.06 + 0.3}s` }}
                        >
                          {courseAssignments.length} total
                        </Badge>
                      </div>

                      {/* Syllabus upload */}
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm transition-all duration-200 ${
                          uploadSuccess === course.id
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                            : "border-border/50 text-muted-foreground hover:border-purple-500/30 hover:bg-purple-500/5"
                        }`}
                      >
                        {uploadSuccess === course.id ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : uploadingCourseId === course.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 transition-transform group-hover:scale-110" />
                        )}
                        {uploadSuccess === course.id
                          ? "Syllabus parsed!"
                          : uploadingCourseId === course.id
                            ? "Parsing syllabus..."
                            : "Upload Syllabus PDF"}
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSyllabusUpload(course.id, file);
                          }}
                        />
                      </label>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
