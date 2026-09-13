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

CREATE INDEX IF NOT EXISTS idx_students_email ON public.students (email);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students (grade);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON public.teachers (email);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON public.teachers (department);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses (code);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses (teacher_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements (is_published, published_at DESC);
