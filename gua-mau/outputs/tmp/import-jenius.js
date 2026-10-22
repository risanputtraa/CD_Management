const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const dbPath = 'outputs/ruang-proyek.sqlite';
const data = JSON.parse(fs.readFileSync('outputs/tmp/jenius-import.json', 'utf8'));
const db = new DatabaseSync(dbPath);
const backupPath = `outputs/backups/ruang-proyek-${new Date().toISOString().replace(/[:.]/g, '-')}-pre-jenius-import.sqlite`;

if (db.prepare('SELECT 1 FROM projects WHERE project_name=?').get(data.project_name)) {
  throw new Error(`Project already exists: ${data.project_name}`);
}

db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size < 1_000_000) {
  throw new Error('Database backup could not be verified; import stopped.');
}

const productType = db.prepare('SELECT product_type_id FROM product_types WHERE product_type_name=? AND is_active=1').get(data.product_type_name);
if (!productType) throw new Error(`Active product type not found: ${data.product_type_name}`);

const id = () => crypto.randomUUID();
const taskTypes = new Map(db.prepare('SELECT task_type_id,task_type_name FROM task_types WHERE is_active=1').all().map(x => [x.task_type_name, x.task_type_id]));
const newTaskTypes = [
  'Camera Cinematic (Unity)',
  'QC Animation 3D Camera Cinematic (Unity)',
  'QC Assembly 3D Character',
];

const folderIds = new Map();
const personnel = new Map(db.prepare('SELECT personnel_id,personnel_name FROM personnel').all().map(x => [x.personnel_name.trim().toLocaleLowerCase(), x.personnel_id]));
const deliverableIds = new Map(db.prepare('SELECT d.deliverable_name,d.deliverable_id FROM deliverables d JOIN product_type_deliverables ptd ON ptd.deliverable_id=d.deliverable_id WHERE ptd.product_type_id=? AND d.is_active=1').all(productType.product_type_id).map(x => [x.deliverable_name, x.deliverable_id]));

db.exec('BEGIN IMMEDIATE');
try {
  const addType = db.prepare('INSERT INTO task_types(task_type_id,task_type_name,is_active,department_id) VALUES (?,?,1,?)');
  for (const name of newTaskTypes) {
    if (taskTypes.has(name)) continue;
    const typeId = id();
    addType.run(typeId, name, '3d-artist');
    taskTypes.set(name, typeId);
  }

  const projectId = id();
  db.prepare(`INSERT INTO projects(project_id,project_name,color,status,due,product_type_id,start_date,deadline)
    VALUES (?,?,?,'On Going',?,?,?,?)`).run(
    projectId, data.project_name, '#5b9b6d', data.deadline, productType.product_type_id, data.start_date, data.deadline,
  );

  const insertFolder = db.prepare('INSERT INTO folders(folder_id,project_id,parent_folder_id,folder_name) VALUES (?,?,?,?)');
  for (const f of data.folders) {
    const folderId = id();
    const parentId = f.parent_folder_id ? folderIds.get(f.parent_folder_id) : null;
    if (f.parent_folder_id && !parentId) throw new Error(`Missing parent folder for ${f.folder_name}`);
    folderIds.set(f.folder_id, folderId);
    insertFolder.run(folderId, projectId, parentId, f.folder_name);
  }

  const insertTask = db.prepare(`INSERT INTO tasks(
    task_id,task_name,project_id,owner,due_date,status,folder_id,started_at,elapsed_seconds,
    task_type_id,difficulty_level,note,assigned_personnel_id,completed_by_personnel_id,completed_at,created_by_user_id
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`);
  for (const t of data.tasks) {
    const typeId = taskTypes.get(t.task_type_name);
    const folderId = folderIds.get(t.folder_id);
    const personId = t.pic_name ? personnel.get(t.pic_name.trim().toLocaleLowerCase()) : null;
    if (!typeId || !folderId) throw new Error(`Task mapping failed: ${t.task_name}`);
    if (t.pic_name && !personId) throw new Error(`PIC not found in app personnel: ${t.pic_name}`);
    insertTask.run(
      id(), t.task_name, projectId, '', '', t.status, folderId, t.started_at,
      Math.max(0, Number(t.elapsed_seconds) || 0), typeId, t.difficulty_level, '', personId,
      t.status === 'Done' ? personId : null, t.completed_at,
    );
  }

  const insertDeliverable = db.prepare('INSERT INTO project_deliverables(project_id,deliverable_id,quantity) VALUES (?,?,?)');
  for (const [name, quantity] of Object.entries(data.deliverables)) {
    const deliverableId = deliverableIds.get(name);
    if (!deliverableId) throw new Error(`Deliverable is not enabled for ${data.product_type_name}: ${name}`);
    insertDeliverable.run(projectId, deliverableId, quantity);
  }

  db.exec('COMMIT');
  const result = {
    project_id: projectId,
    backup_path: backupPath,
    project: db.prepare('SELECT project_id,project_name,status,start_date,deadline FROM projects WHERE project_id=?').get(projectId),
    folders: db.prepare('SELECT COUNT(*) count FROM folders WHERE project_id=?').get(projectId).count,
    tasks: db.prepare('SELECT COUNT(*) count FROM tasks WHERE project_id=?').get(projectId).count,
    statuses: db.prepare('SELECT status,COUNT(*) count FROM tasks WHERE project_id=? GROUP BY status ORDER BY status').all(projectId),
    new_task_types: newTaskTypes.filter(name => !newTaskTypes.some((prior, i) => i < newTaskTypes.indexOf(name) && prior === name)),
    task_type_counts: db.prepare(`SELECT tt.task_type_name,COUNT(*) count FROM tasks t JOIN task_types tt USING(task_type_id)
      WHERE t.project_id=? GROUP BY tt.task_type_name ORDER BY tt.task_type_name`).all(projectId),
    assigned_tasks: db.prepare('SELECT COUNT(*) count FROM tasks WHERE project_id=? AND assigned_personnel_id IS NOT NULL').get(projectId).count,
    ongoing_tasks: db.prepare("SELECT COUNT(*) count FROM tasks WHERE project_id=? AND status='On Going'").get(projectId).count,
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
