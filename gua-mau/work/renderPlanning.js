function groupedPlan(projectId) {
  const map = new Map();
  for (const row of state.plan.filter(x => x.project_id === projectId)) {
    const key = row.deliverable_id + '|' + row.task_type_id;
    let group = map.get(key);
    if (!group) {
      const pd = state.projectDeliverables.find(x => x.project_id === projectId && x.deliverable_id === row.deliverable_id);
      group = { ...row, ratio_sum: 0, lines: [], deliverable_quantity: Number(pd?.quantity || 0), planned_quantity_override: row.planned_quantity_override };
      map.set(key, group);
    }
    group.lines.push(row);
    group.ratio_sum += Number(row.ratio_snapshot || 0);
    if (row.planned_quantity_override !== null && row.planned_quantity_override !== undefined) group.planned_quantity_override = Number(row.planned_quantity_override);
    group.is_selected = Number(group.is_selected) !== 0 && Number(row.is_selected) !== 0;
  }
  return [...map.values()].map(group => ({
    ...group,
    planned_quantity: group.planned_quantity_override !== null && group.planned_quantity_override !== undefined
      ? Number(group.planned_quantity_override)
      : Math.ceil(group.deliverable_quantity * group.ratio_sum)
  })).sort((a, b) => a.deliverable_name.localeCompare(b.deliverable_name) || a.task_type_name.localeCompare(b.task_type_name));
}
function renderPlanning() {
  const p = state.projects.find(x => x.project_id === planProjectId);
  const prod = state.productTypes.find(x => x.product_type_id === p?.product_type_id);
  if (!p) return '<div class="card empty">Project tidak ditemukan.</div>';
  const generated = state.tasks.some(t => t.project_id === p.project_id && t.plan_line_id);
  let h = `<div class="card panel"><h3>${esc(p.project_name)} | ${esc(prod?.product_type_name || '')}</h3><p>Mulai ${fmtDate(p.start_date)} | Deadline project ${fmtDate(p.deadline)}</p>`;
  if (!prod) return h + 'Jenis product belum diatur.</div>';

  if (planStep === 1 && !generated) {
    const chosen = new Set(state.projectDeliverables.filter(x => x.project_id === p.project_id).map(x => x.deliverable_id));
    h += '<p>Pilih deliverable yang digunakan.</p>' + prod.deliverables.map(d => `<label class="folder-item"><span>${esc(d.deliverable_name)}</span><input type="checkbox" data-plan-check="${d.deliverable_id}" ${chosen.has(d.deliverable_id) ? 'checked' : ''}></label>`).join('') + '<button class="btn primary" id="planNext">Lanjut pilih jumlah</button>';
  } else if (planStep === 2 && !generated) {
    const ids = Object.keys(window.planSelected || {});
    h += '<p>Masukkan jumlah setiap deliverable. Jumlah ini menjadi jumlah subfolder di dalam folder deliverable.</p>' + (ids.length ? ids.map(id => {
      const d = prod.deliverables.find(x => x.deliverable_id === id);
      const old = state.projectDeliverables.find(x => x.project_id === p.project_id && x.deliverable_id === id);
      return `<label class="folder-item">${esc(d?.deliverable_name || '')}<input type="number" min="0" step="1" data-plan-qty="${id}" value="${old?.quantity ?? 1}"></label>`;
    }).join('') : '<div class="empty">Pilih minimal satu deliverable.</div>') + '<button class="btn" id="planBack">Kembali</button> <button class="btn primary" id="planSave" ' + (ids.length ? '' : 'disabled') + '>Simpan dan hitung task</button>';
  } else {
    const groups = groupedPlan(p.project_id);
    const selected = groups.filter(x => Number(x.is_selected) !== 0 && Number(x.planned_quantity) > 0);
    const createCount = selected.reduce((sum, x) => sum + Number(x.planned_quantity), 0);
    const deadlines = state.projectDeadlines.filter(x => x.project_id === p.project_id);
    const deptRows = state.departments.map(d => {
      const deadline = deadlines.find(x => x.department_id === d.department_id);
      const days = localWorkdays(p.start_date, deadline?.deadline_date);
      const deptTasks = state.tasks.filter(t => t.project_id === p.project_id && t.plan_line_id && t.department_name === d.department_name);
      const missing = deptTasks.filter(t => {
        const type = state.taskTypes.find(x => x.task_type_id === t.task_type_id);
        return !t.difficulty_level || !type?.capacities.some(c => Number(c.difficulty_level) === Number(t.difficulty_level));
      }).length;
      const labor = deptTasks.reduce((sum, t) => {
        const type = state.taskTypes.find(x => x.task_type_id === t.task_type_id);
        const capacity = type?.capacities.find(c => Number(c.difficulty_level) === Number(t.difficulty_level));
        return sum + (capacity ? Number(t.planned_quantity || 1) / Number(capacity.tasks_per_person_per_day) : 0);
      }, 0);
      const load = generated ? (missing ? `Level belum lengkap (${missing})` : labor.toFixed(2)) : '—';
      const people = !generated || missing ? '—' : (days ? Math.ceil(labor / days) : (labor > 0 ? 'Cek deadline' : '0'));
      return `<tr><td>${esc(d.department_name)}</td><td><input type="date" class="inline-date" data-dept-deadline="${d.department_id}" value="${deadline?.deadline_date || ''}"></td><td>${days}</td><td>${load}</td><td><b>${people}</b></td></tr>`;
    }).join('');
    const taskRows = groups.map((x, i) => `<tr><td>${i + 1}</td><td><input type="checkbox" data-plan-line-selected="${x.plan_line_id}" ${Number(x.is_selected) !== 0 ? 'checked' : ''} ${generated ? 'disabled' : ''}></td><td>${esc(x.deliverable_name)}</td><td>${esc(x.task_type_name)}</td><td>${esc(x.department_name || '-')}</td><td><input type="number" class="inline-date" min="0" step="1" data-plan-line-qty="${x.plan_line_id}" value="${x.planned_quantity}" ${generated ? 'disabled' : ''}></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada task plan.</td></tr>';
    h += `<h3>Deadline departemen</h3><div class="table-wrap"><table class="table"><thead><tr><th>Departemen</th><th>Deadline</th><th>Hari kerja</th><th>Beban (orang-hari)</th><th>Estimasi personel</th></tr></thead><tbody>${deptRows}</tbody></table></div><p class="task-meta">Folder dibuat per deliverable, lalu satu subfolder per jumlah deliverable. Task dengan jenis yang sama digabung tanpa level; level dipilih setelah task dibuat. Jumlah task memakai rasio gabungan semua level.</p><h3>Task hasil perhitungan</h3><div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Pakai</th><th>Deliverable</th><th>Task</th><th>Departemen</th><th>Jumlah</th></tr></thead><tbody>${taskRows}</tbody></table></div>`;
    if (generated) h += '<p>Task sudah dibuat; level bisa diatur pada Daftar task. Kebutuhan personel terhitung setelah level diisi.</p><button class="btn" id="openProjectTasks">Buka task project</button>';
    else h += `<button class="btn" id="planBack">Ubah deliverable</button> <button class="btn primary" id="generateProjectTasks" ${selected.length ? '' : 'disabled'}>Buat ${createCount} task project</button>`;
  }
  return h + '</div>';
}
