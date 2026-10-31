export const SUGGESTED_STUDENT_CATEGORIES = [
  'Food & Canteen',
  'Hostel & Rent',
  'Books & Stationery',
  'Recharge & Internet',
  'Transport & Metro',
  'Snacks & Chai',
  'Entertainment',
  'Health & Personal Care',
  'Subscriptions',
  'Miscellaneous',
];

export const SUGGESTED_STUDENT_SUBJECTS = [
  { code: 'CS101', name: 'Data Structures & Algorithms', credits: 4, instructor: 'Faculty', color: '#3b82f6' },
  { code: 'CS102', name: 'Operating Systems', credits: 4, instructor: 'Faculty', color: '#10b981' },
  { code: 'CS103', name: 'Computer Networks', credits: 3, instructor: 'Faculty', color: '#8b5cf6' },
  { code: 'MA101', name: 'Engineering Mathematics', credits: 4, instructor: 'Faculty', color: '#f59e0b' },
];

export const SUGGESTED_STUDENT_HABITS = [
  { name: 'Daily 2-hr Deep Study', category: 'study' as const, frequency: 'daily' as const, color: '#3b82f6' },
  { name: 'Morning Exercise & Fitness', category: 'fitness' as const, frequency: 'daily' as const, color: '#10b981' },
  { name: 'Daily Water Hydration (2.5L)', category: 'health' as const, frequency: 'daily' as const, color: '#0ea5e9' },
  { name: 'Review Lecture Notes', category: 'study' as const, frequency: 'daily' as const, color: '#8b5cf6' },
];

export const SUGGESTED_STUDENT_GOALS = [
  {
    title: 'Score 8.5+ CGPA this Semester',
    category: 'academic' as const,
    targetDays: 90,
    measurableTarget: '8.5 CGPA',
    currentValue: '0.0 CGPA',
    steps: [
      { id: 's1', title: 'Finish OS Lab Records', isCompleted: false },
      { id: 's2', title: 'Prepare Formula Sheet for Mid-Terms', isCompleted: false },
    ],
  },
  {
    title: 'Build ₹10,000 Emergency Fund',
    category: 'financial' as const,
    targetDays: 180,
    measurableTarget: '₹10,000',
    currentValue: '₹0',
    steps: [
      { id: 's1', title: 'Open dedicated student savings account', isCompleted: false },
      { id: 's2', title: 'Save first ₹2,000 from freelancing', isCompleted: false },
    ],
  },
  {
    title: 'Complete Full-Stack Web Portfolio',
    category: 'career' as const,
    targetDays: 60,
    measurableTarget: '3 projects live',
    currentValue: '0 projects',
    steps: [
      { id: 's1', title: 'Build React + TypeScript portfolio app', isCompleted: false },
      { id: 's2', title: 'Deploy on Vercel / GitHub Pages', isCompleted: false },
    ],
  },
];
