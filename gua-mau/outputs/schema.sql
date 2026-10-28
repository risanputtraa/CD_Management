-- Ruang Proyek: fresh SQLite schema. Existing databases are migrated by server.js.
PRAGMA foreign_keys = ON;

CREATE TABLE app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);
INSERT INTO app_settings(setting_key,setting_value) VALUES ('report_letter_sequence','12');

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  access_role TEXT NOT NULL CHECK (access_role IN ('admin','member')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE departments (
  department_id TEXT PRIMARY KEY,
  department_name TEXT NOT NULL UNIQUE,
  default_offset_workdays INTEGER NOT NULL DEFAULT 0 CHECK (default_offset_workdays >= 0)
);
CREATE TABLE personnel (
  personnel_id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  personnel_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  department_id TEXT REFERENCES departments(department_id) ON DELETE SET NULL
);
CREATE TABLE product_types (
  product_type_id TEXT PRIMARY KEY,
  product_type_name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
CREATE TABLE deliverables (
  deliverable_id TEXT PRIMARY KEY,
  deliverable_name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
CREATE TABLE task_types (
  task_type_id TEXT PRIMARY KEY,
  task_type_name TEXT NOT NULL UNIQUE,
  department_id TEXT REFERENCES departments(department_id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
CREATE TABLE default_task_type_dependencies (
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  predecessor_task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  PRIMARY KEY (task_type_id,predecessor_task_type_id),
  CHECK (task_type_id <> predecessor_task_type_id)
);
CREATE TABLE task_type_weights (
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 8),
  weight REAL NOT NULL CHECK (weight >= 0),
  PRIMARY KEY (task_type_id,difficulty_level)
);
CREATE TABLE task_type_capacities (
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 8),
  tasks_per_person_per_day REAL NOT NULL CHECK (tasks_per_person_per_day > 0),
  PRIMARY KEY (task_type_id,difficulty_level)
);
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  product_type_id TEXT REFERENCES product_types(product_type_id) ON DELETE RESTRICT,
  start_date TEXT,
  deadline TEXT,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'On Going' CHECK (status IN ('On Going','Pending','Complete','Canceled')),
  due TEXT
);
CREATE TABLE folders (
  folder_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  parent_folder_id TEXT,
  folder_name TEXT NOT NULL,
  UNIQUE (project_id,folder_id),
  FOREIGN KEY (project_id,parent_folder_id) REFERENCES folders(project_id,folder_id) ON DELETE CASCADE
);
CREATE TABLE product_type_deliverables (
  product_type_id TEXT NOT NULL REFERENCES product_types(product_type_id) ON DELETE CASCADE,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE RESTRICT,
  PRIMARY KEY (product_type_id,deliverable_id)
);
CREATE TABLE deliverable_task_ratios (
  ratio_id TEXT PRIMARY KEY,
  product_type_id TEXT NOT NULL,
  deliverable_id TEXT NOT NULL,
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE RESTRICT,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 8),
  ratio REAL NOT NULL CHECK (ratio >= 0),
  UNIQUE (product_type_id,deliverable_id,task_type_id,difficulty_level),
  FOREIGN KEY (product_type_id,deliverable_id) REFERENCES product_type_deliverables(product_type_id,deliverable_id) ON DELETE CASCADE
);
CREATE TABLE project_deliverables (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (project_id,deliverable_id)
);
CREATE TABLE project_department_deadlines (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
  deadline_date TEXT NOT NULL,
  is_override INTEGER NOT NULL DEFAULT 0 CHECK (is_override IN (0,1)),
  PRIMARY KEY (project_id,department_id)
);
CREATE TABLE holidays (
  holiday_date TEXT PRIMARY KEY,
  holiday_name TEXT NOT NULL DEFAULT 'Hari libur'
);
CREATE TABLE project_task_dependencies (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  predecessor_task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE CASCADE,
  PRIMARY KEY (project_id,task_type_id,predecessor_task_type_id),
  CHECK (task_type_id <> predecessor_task_type_id)
);
CREATE TABLE project_department_staffing (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  personnel_count INTEGER NOT NULL CHECK (personnel_count >= 0),
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id,department_id)
);
CREATE TABLE project_task_plan (
  plan_line_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE RESTRICT,
  task_type_id TEXT NOT NULL REFERENCES task_types(task_type_id) ON DELETE RESTRICT,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 8),
  ratio_snapshot REAL NOT NULL CHECK (ratio_snapshot >= 0),
  planned_quantity INTEGER NOT NULL CHECK (planned_quantity >= 0),
  is_selected INTEGER NOT NULL DEFAULT 1 CHECK (is_selected IN (0,1)),
  planned_quantity_override INTEGER CHECK (planned_quantity_override IS NULL OR planned_quantity_override >= 0),
  UNIQUE (project_id,deliverable_id,task_type_id,difficulty_level)
);
CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  folder_id TEXT,
  task_name TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Done','On Going','Canceled','Pending')),
  started_at TEXT,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  task_type_id TEXT REFERENCES task_types(task_type_id) ON DELETE RESTRICT,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 8),
  note TEXT NOT NULL DEFAULT '',
  assigned_personnel_id TEXT REFERENCES personnel(personnel_id) ON DELETE SET NULL,
  completed_by_personnel_id TEXT REFERENCES personnel(personnel_id) ON DELETE SET NULL,
  completed_at TEXT,
  completed_weight REAL,
  created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  plan_line_id TEXT REFERENCES project_task_plan(plan_line_id) ON DELETE SET NULL,
  planned_quantity INTEGER NOT NULL DEFAULT 1 CHECK (planned_quantity >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id,task_id),
  FOREIGN KEY (project_id,folder_id) REFERENCES folders(project_id,folder_id) ON DELETE CASCADE
);
CREATE TABLE timer_sessions (
  session_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  personnel_id TEXT NOT NULL REFERENCES personnel(personnel_id) ON DELETE RESTRICT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0)
);
CREATE TABLE login_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE task_audit (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  personnel_id TEXT,
  completed_at TEXT NOT NULL,
  weight_snapshot REAL
);

CREATE UNIQUE INDEX one_running_timer_per_task ON timer_sessions(task_id) WHERE ended_at IS NULL;
CREATE INDEX task_project_status_idx ON tasks(project_id,status);
CREATE INDEX task_personnel_status_idx ON tasks(assigned_personnel_id,status);
CREATE INDEX folder_project_parent_idx ON folders(project_id,parent_folder_id);
