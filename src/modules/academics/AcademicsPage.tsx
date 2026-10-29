import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Subject, AcademicTask, TaskType, TaskPriority } from '../../domain/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { EmptyState } from '../../components/shared/EmptyState';
import { useToast } from '../../components/ui/Toast';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { useUserData } from '../../hooks/useUserData';

export function AcademicsPage() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'subjects' | 'planner'>('tasks');
  const [taskView, setTaskView] = useState<'today' | 'upcoming' | 'overdue' | 'all'>('today');
  const { success, error, toastWithUndo } = useToast();

  const { currentUser, subjects, academicTasks: tasks } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => !t.deletedAt)
      .filter(t => {
        if (taskView === 'today') return t.dueDate === todayStr;
        if (taskView === 'upcoming') return t.dueDate > todayStr && t.status !== 'done';
        if (taskView === 'overdue') return t.dueDate < todayStr && t.status !== 'done';
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, taskView, todayStr]);

  // Completion metrics
  const completionRate = useMemo(() => {
    const active = tasks.filter(t => !t.deletedAt);
    if (active.length === 0) return 0;
    const completed = active.filter(t => t.status === 'done').length;
    return Math.round((completed / active.length) * 100);
  }, [tasks]);

  // Modal Dialogs
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<AcademicTask | null>(null);

  // Task Form State
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('assignment');
  const [taskDueDate, setTaskDueDate] = useState(todayStr);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskMinutes, setTaskMinutes] = useState('60');
  const [taskNotes, setTaskNotes] = useState('');

  // Subject Form State
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subInstructor, setSubInstructor] = useState('');
  const [subCredits, setSubCredits] = useState('3');
  const [subColor, setSubColor] = useState('#3b82f6');

  // Handle Toggle Task Done
  const handleToggleDone = async (t: AcademicTask) => {
    const isNowDone = t.status !== 'done';
    const now = new Date().toISOString();
    await db.academicTasks.update(t.id, {
      status: isNowDone ? 'done' : 'todo',
      completedAt: isNowDone ? now : undefined,
      updatedAt: now,
    });

    if (isNowDone) {
      toastWithUndo(`Completed: "${t.title}"`, async () => {
        await db.academicTasks.update(t.id, { status: 'todo', completedAt: undefined, updatedAt: now });
      });
    }
  };

  // Handle Create Task
  const handleCreateTask = async () => {
    let targetSubjectId = taskSubjectId || subjects[0]?.id;
    const now = new Date().toISOString();

    if (!targetSubjectId) {
      // Auto-create default general subject so student task adding is never blocked
      const fallbackSubId = `sub_core_${currentUser?.id || Date.now()}`;
      await db.subjects.add({
        id: fallbackSubId,
        userId: currentUser?.id,
        code: 'CORE101',
        name: 'General Coursework',
        instructor: 'Faculty',
        credits: 3,
        color: '#3b82f6',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      targetSubjectId = fallbackSubId;
    }

    if (!taskTitle.trim()) {
      error('Title required', 'Please provide a task title.');
      return;
    }

    const newTask: AcademicTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      subjectId: targetSubjectId,
      title: taskTitle.trim(),
      type: taskType,
      dueDate: taskDueDate,
      priority: taskPriority,
      estimatedMinutes: parseInt(taskMinutes) || 60,
      status: 'todo',
      notes: taskNotes,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.academicTasks.add(newTask);
    success('Academic task added', `${newTask.title} (Due: ${newTask.dueDate})`);
    setIsAddTaskOpen(false);
    resetTaskForm();
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskNotes('');
    setTaskMinutes('60');
  };

  // Handle Create Subject
  const handleCreateSubject = async () => {
    if (!subCode.trim() || !subName.trim()) {
      error('Incomplete form', 'Course code and name are required.');
      return;
    }
    const now = new Date().toISOString();
    const newSub: Subject = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      code: subCode.trim().toUpperCase(),
      name: subName.trim(),
      instructor: subInstructor.trim(),
      credits: parseInt(subCredits) || 3,
      color: subColor,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.subjects.add(newSub);
    success('Course added', `${newSub.code}: ${newSub.name}`);
    setIsAddSubjectOpen(false);
    setSubCode('');
    setSubName('');
    setSubInstructor('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Academics Command</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semester course management • Assignments • Lab records • Study planner
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setIsAddSubjectOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Course
          </Button>
          <Button size="sm" onClick={() => setIsAddTaskOpen(true)} disabled={subjects.length === 0}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={t => setActiveTab(t as any)}
        tabs={[
          { id: 'tasks', label: 'Academic Tasks', icon: <ListTodo className="w-4 h-4" />, badge: tasks.filter(t => !t.deletedAt && t.status !== 'done').length },
          { id: 'subjects', label: 'Courses / Subjects', icon: <GraduationCap className="w-4 h-4" />, badge: subjects.length },
          { id: 'planner', label: 'Study Hours & Progress', icon: <Clock className="w-4 h-4" /> },
        ]}
      />

      {/* TAB 1: ACADEMIC TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4 animate-fade-in">
          {/* Sub-view switcher */}
          <div className="flex items-center space-x-2 bg-muted/50 p-1 rounded-xl w-fit">
            {(['today', 'upcoming', 'overdue', 'all'] as const).map(view => (
              <button
                key={view}
                onClick={() => setTaskView(view)}
                className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-all ${
                  taskView === view
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title={`No ${taskView} tasks`}
              description="Keep on top of your submissions, lab records, and exams."
              actionLabel="Add Academic Task"
              onAction={() => setIsAddTaskOpen(true)}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map(task => {
                const subject = subjects.find(s => s.id === task.subjectId);
                const isOverdue = task.dueDate < todayStr && task.status !== 'done';
                const isDone = task.status === 'done';

                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border bg-card transition-all ${
                      isDone ? 'opacity-60 border-border' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleDone(task)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-border hover:border-primary'
                        }`}
                        aria-label="Toggle task completion"
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {task.title}
                          </span>
                          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                          <Badge variant="outline" className="text-[10px]">
                            {task.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {subject ? `${subject.code}: ${subject.name}` : 'Course'} • Due: {task.dueDate} • {task.estimatedMinutes} mins
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          task.priority === 'urgent'
                            ? 'destructive'
                            : task.priority === 'high'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {task.priority}
                      </Badge>

                      <button
                        onClick={() => setDeletingTask(task)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBJECTS / COURSES */}
      {activeTab === 'subjects' && (
        <div className="space-y-4 animate-fade-in">
          {subjects.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="w-6 h-6" />}
              title="No courses registered"
              description="Add your semester subjects to associate assignments, labs, and study plans."
              actionLabel="Add First Course"
              onAction={() => setIsAddSubjectOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subjects.map(sub => {
                const subTasks = tasks.filter(t => !t.deletedAt && t.subjectId === sub.id);
                const doneCount = subTasks.filter(t => t.status === 'done').length;
                const percent = subTasks.length > 0 ? Math.round((doneCount / subTasks.length) * 100) : 0;

                return (
                  <Card key={sub.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="bg-primary/10 text-primary">{sub.code}</Badge>
                        <h4 className="text-sm font-semibold text-foreground mt-1.5">{sub.name}</h4>
                        {sub.instructor && (
                          <p className="text-xs text-muted-foreground mt-0.5">Prof. {sub.instructor}</p>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{sub.credits} Credits</span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Task Completion</span>
                        <span className="font-semibold tabular-nums">{percent}% ({doneCount}/{subTasks.length})</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STUDY HOURS & PLANNER */}
      {activeTab === 'planner' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <span className="text-xs text-muted-foreground">Overall Completion Rate</span>
              <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{completionRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Academic submissions completed</p>
            </Card>

            <Card className="p-4">
              <span className="text-xs text-muted-foreground">Active Courses</span>
              <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{subjects.length}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Enrolled this semester</p>
            </Card>

            <Card className="p-4">
              <span className="text-xs text-muted-foreground">Pending Tasks</span>
              <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                {tasks.filter(t => !t.deletedAt && t.status !== 'done').length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Due in upcoming cycle</p>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD TASK */}
      <Modal isOpen={isAddTaskOpen} onClose={() => setIsAddTaskOpen(false)} title="New Academic Task">
        <div className="space-y-3.5">
          <Select
            label="Course / Subject"
            value={taskSubjectId || subjects[0]?.id || ''}
            onChange={e => setTaskSubjectId(e.target.value)}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.code}: {s.name}
              </option>
            ))}
          </Select>

          <Input
            label="Task Title"
            placeholder="e.g. Lab 3 Report, Problem Set 2"
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={taskType} onChange={e => setTaskType(e.target.value as any)}>
              <option value="assignment">Assignment</option>
              <option value="lab_record">Lab Record</option>
              <option value="exam_internal">Exam / Midterm</option>
              <option value="project">Project Work</option>
              <option value="viva_prep">Viva Prep</option>
              <option value="study_session">Study Session</option>
            </Select>

            <Input
              label="Due Date"
              type="date"
              value={taskDueDate}
              onChange={e => setTaskDueDate(e.target.value)}
            />

            <Select
              label="Priority"
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as any)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          <Input
            label="Estimated Time (Minutes)"
            type="number"
            value={taskMinutes}
            onChange={e => setTaskMinutes(e.target.value)}
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Questions to cover, submission portal link, etc."
            value={taskNotes}
            onChange={e => setTaskNotes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!taskTitle.trim()}>
              Create Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: ADD SUBJECT */}
      <Modal isOpen={isAddSubjectOpen} onClose={() => setIsAddSubjectOpen(false)} title="Register Semester Course">
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Course Code"
              placeholder="e.g. CS201, MAT302"
              value={subCode}
              onChange={e => setSubCode(e.target.value)}
            />
            <Input
              label="Credits"
              type="number"
              value={subCredits}
              onChange={e => setSubCredits(e.target.value)}
            />
          </div>

          <Input
            label="Course Name"
            placeholder="e.g. Data Structures and Algorithms"
            value={subName}
            onChange={e => setSubName(e.target.value)}
          />

          <Input
            label="Instructor / Professor Name"
            placeholder="e.g. Dr. Verma"
            value={subInstructor}
            onChange={e => setSubInstructor(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddSubjectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubject} disabled={!subCode.trim() || !subName.trim()}>
              Register Course
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={async () => {
          if (!deletingTask) return;
          const now = new Date().toISOString();
          await db.academicTasks.update(deletingTask.id, { deletedAt: now });
          toastWithUndo(`Deleted task "${deletingTask.title}"`, async () => {
            await db.academicTasks.update(deletingTask.id, { deletedAt: null });
          });
          setDeletingTask(null);
        }}
        title="Delete Academic Task"
        description={`Are you sure you want to delete "${deletingTask?.title}"?`}
      />
    </div>
  );
}
