-- Greenwood Academy — CloudNivo managed PostgreSQL schema
-- Apply one statement at a time via POST /api/v1/projects/{id}/database/query

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text DEFAULT '',
  grade text NOT NULL DEFAULT '',
  enrollment_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text DEFAULT '',
  department text NOT NULL DEFAULT '',
  designation text DEFAULT '',
  bio text DEFAULT '',
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text DEFAULT '',
  teacher_id uuid,
  schedule text DEFAULT '',
  capacity integer DEFAULT 30,
  enrolled integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT 'Admin',
  is_published boolean DEFAULT true,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_date timestamptz NOT NULL,
  location text DEFAULT '',
  category text DEFAULT 'general',
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  category text DEFAULT 'campus',
  is_published boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  subject text DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text DEFAULT 'unread',
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  status text DEFAULT 'active',
  enrollment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  assignment_name text DEFAULT '',
  score numeric DEFAULT 0,
  max_score numeric DEFAULT 100,
  grade_letter text DEFAULT '',
  comments text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_email ON public.students (email);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students (grade);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON public.teachers (email);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON public.teachers (department);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses (code);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses (teacher_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_published ON public.events (is_published);
CREATE INDEX IF NOT EXISTS idx_gallery_category ON public.gallery (category);
CREATE INDEX IF NOT EXISTS idx_gallery_published ON public.gallery (is_published);
CREATE INDEX IF NOT EXISTS idx_contact_status ON public.contact_submissions (status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON public.grades (student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course ON public.grades (course_id);
