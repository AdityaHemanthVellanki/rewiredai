"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Upload,
  BookOpen,
  Loader2,
  Trash2,
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
        // Fetch assignments for each course
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
        toast.success(
          `Parsed ${data.deadlines_created} deadlines from syllabus!`
        );
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted-foreground">
            Manage your courses and upload syllabi for automatic deadline extraction.
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
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
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        newCourse.color === color
                          ? "border-white scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={handleAddCourse}
                disabled={isAdding || !newCourse.name.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isAdding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Add Course
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No courses yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first course to get started with deadline tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const courseAssignments = assignments[course.id] || [];
            const pending = courseAssignments.filter(
              (a) => a.status !== "completed"
            ).length;

            return (
              <Card key={course.id} className="relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full w-1"
                  style={{ backgroundColor: course.color }}
                />
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{course.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {course.code}
                      {course.professor && ` • ${course.professor}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteCourse(course.id)}
                    className="text-muted-foreground hover:text-destructive"
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
                    <Badge variant="secondary">
                      {pending} pending deadline{pending !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="secondary">
                      {courseAssignments.length} total
                    </Badge>
                  </div>

                  {/* Syllabus upload */}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/50 p-3 text-sm text-muted-foreground transition-colors hover:border-purple-500/30 hover:bg-purple-500/5">
                    {uploadingCourseId === course.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingCourseId === course.id
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
            );
          })}
        </div>
      )}
    </div>
  );
}
