let teamTaskViewMode='tasks';
const teamWeightFilters={pics:null,projects:null,types:null,from:'',to:''};
let teamWeightPage=1,teamWeightSort='completedWeight',teamWeightDirection='desc',teamWeightDetailPic='',teamWeightDetailPage=1;

function teamTaskViewSwitcher(){
 return '<div class="team-weight-view"><span>View</span><div class="view-toggle" role="group" aria-label="Team Task View">'+[['tasks','Task List'],['weight','Weight Summary']].map(([value,label])=>'<button type="button" class="'+(teamTaskViewMode===value?'active':'')+'" aria-pressed="'+(teamTaskViewMode===value)+'" data-team-task-view="'+value+'">'+label+'</button>').join('')+'</div></div>';
}

function teamWeightSource(){
 const ids=subordinatePersonnelIds(),people=state.personnel.filter(person=>ids.has(person.personnel_id)),types=new Map(state.taskTypes.map(type=>[type.task_type_id,type])),projects=new Map(state.projects.map(project=>[project.project_id,project])),folders=new Map(state.folders.map(folder=>[folder.folder_id,folder]));
 const finite=value=>value==null||!Number.isFinite(Number(value))?null:Number(value),entries=[];
 for(const task of state.tasks){
  const pic=task.status==='Done'?(task.completed_by_personnel_id||task.assigned_personnel_id):task.assigned_personnel_id;
  if(!ids.has(pic))continue;
  const quantity=Number(task.planned_quantity??1),weight=finite(weightFor(task));
  entries.push({source:'project',id:task.task_id,pic,project:task.project_id,projectName:projects.get(task.project_id)?.project_name||'Project',folder:folders.get(task.folder_id)?.folder_name||'—',title:task.task_name,type:task.task_type_id||'__untyped__',typeName:types.get(task.task_type_id)?.task_type_name||task.task_type_name||'Unspecified Task Type',level:task.difficulty_level,quantity,status:task.status,finished:task.completed_at,activeWeight:weight==null?null:weight*quantity,completedWeight:finite(task.completed_weight??weight)==null?null:Number(task.completed_weight??weight)*quantity});
 }
 for(const task of state.generalWorks||[]){
  if(!ids.has(task.personnel_id))continue;
  const defined=task.definition_type==='Defined',estimate=defined?(task.parent_work_id?generalDashboardWeight(task):generalEstimate(task)):null;
  entries.push({source:'general',id:task.work_id,pic:task.personnel_id,project:'__general__',projectName:'General Tasks',folder:'—',title:task.title,type:defined?(task.task_type_id||'__untyped__'):'__undefined__',typeName:defined?(types.get(task.task_type_id)?.task_type_name||'Unspecified Task Type'):'Undefined',level:task.difficulty_level,quantity:defined?Number(task.quantity??1):null,status:task.status,finished:task.finished_at,activeWeight:finite(estimate),completedWeight:finite(task.completed_weight)});
 }
 return {people,entries};
}

function teamWeightFinishedInRange(value,from,to){
 if(!from&&!to)return true;
 const time=new Date(value||'').getTime();if(!Number.isFinite(time))return false;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
 return (!from||date>=from)&&(!to||date<=to);
}

function buildTeamWeightSummary(people,entries,filters){
 const selected=(values,value)=>values===null||values.includes(value),dateValid=!filters.from||!filters.to||filters.from<=filters.to;
 const rows=people.filter(person=>selected(filters.pics,person.personnel_id)).map(person=>({person,totalTasks:0,activeTasks:0,completedTasks:0,activeWeight:0,completedWeight:0,unestimated:0})),byPic=new Map(rows.map(row=>[row.person.personnel_id,row]));
 const scoped=entries.filter(entry=>byPic.has(entry.pic)&&selected(filters.projects,entry.project)&&selected(filters.types,entry.type));
 for(const entry of scoped){
  const row=byPic.get(entry.pic);row.totalTasks++;
  if(['Open','Pending','On Going'].includes(entry.status)){row.activeTasks++;if(entry.activeWeight==null)row.unestimated++;else row.activeWeight+=entry.activeWeight;}
  if(entry.status==='Done'&&dateValid&&teamWeightFinishedInRange(entry.finished,filters.from,filters.to)){row.completedTasks++;row.completedWeight+=entry.completedWeight??0;}
 }
 const totals=rows.reduce((sum,row)=>{for(const key of ['totalTasks','activeTasks','completedTasks','activeWeight','completedWeight','unestimated'])sum[key]+=row[key];return sum},{totalTasks:0,activeTasks:0,completedTasks:0,activeWeight:0,completedWeight:0,unestimated:0});
 return {rows,entries:scoped,totals,dateValid};
}

function teamWeightFilterOptions(source){
 const collate=(a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}),typeMap=new Map(source.entries.map(entry=>[entry.type,{value:entry.type,label:entry.typeName}]));
 return {pics:source.people.map(person=>({value:person.personnel_id,label:person.personnel_name})).sort(collate),projects:[{value:'__general__',label:'General Tasks'},...state.projects.map(project=>({value:project.project_id,label:project.project_name})).sort(collate)],types:[{value:'__undefined__',label:'Undefined'},...state.taskTypes.map(type=>({value:type.task_type_id,label:type.task_type_name})),...([...typeMap.values()].filter(type=>!state.taskTypes.some(item=>item.task_type_id===type.value)&&type.value!=='__undefined__'))].sort(collate)};
}

function teamWeightMultiFilter(key,label,options){
 const values=teamWeightFilters[key],selected=options.filter(option=>values===null||values.includes(option.value)),allLabel=key==='pics'?'All Team PICs':key==='projects'?'All Projects and General Tasks':'All Task Types',caption=values===null?allLabel:selected.length===1?selected[0].label:selected.length+' Selected';
 return '<div class="report-multi-filter"><span>'+label+'</span><details class="report-multi-details" data-team-weight-picker="'+key+'"><summary title="'+esc(caption)+'">'+esc(caption)+'</summary><div class="report-multi-options"><input type="search" placeholder="Search '+label+'…" aria-label="Search '+label+'" data-team-weight-search="'+key+'"><label><input type="checkbox" data-team-weight-all="'+key+'" '+(values===null?'checked':'')+'> '+allLabel+'</label>'+options.map(option=>'<label data-team-weight-option-label="'+esc(option.label.toLowerCase())+'"><input type="checkbox" data-team-weight-option="'+key+'" value="'+esc(option.value)+'" '+(values===null||values.includes(option.value)?'checked':'')+'> '+esc(option.label)+'</label>').join('')+'</div></details></div>';
}

function teamWeightPagination(page,total,kind){
 const pages=Math.max(1,Math.ceil(total/20)),offset=(page-1)*20;
 return '<div class="table-pagination-footer"><span>'+(total?'Showing '+(offset+1)+'–'+Math.min(offset+20,total)+' of '+total:'0')+' '+(kind==='summary'?'PICs':'Tasks')+'</span><div><button class="btn" type="button" data-team-weight-page="'+kind+'" data-delta="-1" '+(page<=1?'disabled':'')+'>Previous</button><span>Page '+page+' of '+pages+'</span><button class="btn" type="button" data-team-weight-page="'+kind+'" data-delta="1" '+(page>=pages?'disabled':'')+'>Next</button></div></div>';
}

function renderTeamWeightDetails(summary){
 const row=summary.rows.find(item=>item.person.personnel_id===teamWeightDetailPic);if(!row)return '';
 const tasks=summary.entries.filter(entry=>entry.pic===teamWeightDetailPic);teamWeightDetailPage=Math.min(teamWeightDetailPage,Math.max(1,Math.ceil(tasks.length/20)));
 const offset=(teamWeightDetailPage-1)*20;
 const rows=tasks.slice(offset,offset+20).map((entry,index)=>{const active=['Open','Pending','On Going'].includes(entry.status),done=entry.status==='Done',inPeriod=done&&summary.dateValid&&teamWeightFinishedInRange(entry.finished,teamWeightFilters.from,teamWeightFilters.to);return '<tr><td>'+(offset+index+1)+'</td><td title="'+esc(entry.projectName)+'">'+esc(entry.projectName)+'</td><td title="'+esc(entry.folder)+'">'+esc(entry.folder)+'</td><td title="'+esc(entry.title)+'"><strong>'+esc(entry.title)+'</strong></td><td title="'+esc(entry.typeName)+'">'+esc(entry.typeName)+'</td><td>'+(entry.level??'—')+'</td><td>'+(entry.quantity??'—')+'</td><td>'+esc(entry.status)+'</td><td class="weight-number">'+(active&&entry.activeWeight!=null?entry.activeWeight.toFixed(2):'—')+'</td><td class="weight-number" title="'+(done&&!inPeriod?'Outside the selected completion period':'')+'">'+(inPeriod&&entry.completedWeight!=null?entry.completedWeight.toFixed(2):'—')+'</td><td>'+fmtDateTime(entry.finished)+'</td></tr>'}).join('');
 return '<section class="card team-weight-detail"><div class="panel-head"><div><div class="panel-title">'+esc(row.person.personnel_name)+' · Task Details</div><div class="panel-sub">Active Weight: '+row.activeWeight.toFixed(2)+' · Completed Weight: '+(summary.dateValid?row.completedWeight.toFixed(2):'—')+'</div></div><button class="btn" type="button" data-team-weight-close-details>Close Details</button></div><div class="table-wrap team-weight-detail-scroll" data-scroll-key="team-weight-details"><table class="table"><colgroup>'+[48,170,200,240,210,65,80,110,110,130,170].map(width=>'<col style="width:'+width+'px">').join('')+'</colgroup><thead><tr>'+['No.','Project','Folder','Task','Task Type','Level','Quantity','Status','Active Weight','Completed Weight','Finished On'].map(label=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="11" class="empty">No Tasks Match These Filters.</td></tr>')+'</tbody></table></div>'+teamWeightPagination(teamWeightDetailPage,tasks.length,'details')+'</section>';
}

function renderTeamWeightSummary(){
 const source=teamWeightSource(),options=teamWeightFilterOptions(source),summary=buildTeamWeightSummary(source.people,source.entries,teamWeightFilters),totals=summary.totals;
 const columnValue=row=>teamWeightSort==='name'?row.person.personnel_name:teamWeightSort==='department'?row.person.department||'':row[teamWeightSort];
 summary.rows.sort((a,b)=>{const left=columnValue(a),right=columnValue(b),comparison=typeof left==='number'?left-right:String(left).localeCompare(String(right),undefined,{sensitivity:'base'});return comparison*(teamWeightDirection==='asc'?1:-1)||a.person.personnel_name.localeCompare(b.person.personnel_name)});
 teamWeightPage=Math.min(teamWeightPage,Math.max(1,Math.ceil(summary.rows.length/20)));const offset=(teamWeightPage-1)*20;
 const sortHeader=(key,label)=>'<th><button type="button" class="weight-sort" data-team-weight-sort="'+key+'">'+label+(teamWeightSort===key?(teamWeightDirection==='asc'?' ▲':' ▼'):'')+'</button></th>';
 const rows=summary.rows.slice(offset,offset+20).map((row,index)=>'<tr class="'+(row.person.personnel_id===teamWeightDetailPic?'weight-row-selected':'')+'"><td>'+(offset+index+1)+'</td><td><button type="button" class="weight-person-link" data-team-weight-person="'+esc(row.person.personnel_id)+'">'+esc(row.person.personnel_name)+'</button></td><td>'+esc(state.departments.find(department=>department.department_id===row.person.department_id)?.department_name||row.person.department||'—')+'</td><td class="weight-number">'+row.totalTasks+'</td><td class="weight-number">'+row.activeWeight.toFixed(2)+(row.unestimated?'<small>'+row.unestimated+' Without Estimate</small>':'')+'</td><td class="weight-number">'+(summary.dateValid?row.completedTasks:'—')+'</td><td class="weight-number weight-completed">'+(summary.dateValid?row.completedWeight.toFixed(2):'—')+'</td><td><button class="btn" type="button" data-team-weight-person="'+esc(row.person.personnel_id)+'">View Tasks</button></td></tr>').join('');
 return '<section class="card team-weight-summary"><div class="my-tasks-head"><div><div class="panel-title">Weight Summary</div><div class="panel-sub">Project and General Task Weights for Your Team</div></div>'+teamTaskViewSwitcher()+'</div><div class="team-weight-filters">'+teamWeightMultiFilter('pics','PIC',options.pics)+teamWeightMultiFilter('projects','Project',options.projects)+teamWeightMultiFilter('types','Task Type',options.types)+'<label><span>Completed From</span><input type="date" data-team-weight-date="from" value="'+esc(teamWeightFilters.from)+'"></label><label><span>Completed Until</span><input type="date" data-team-weight-date="to" value="'+esc(teamWeightFilters.to)+'"></label><button type="button" class="btn" data-team-weight-reset>Reset Filters</button></div><div class="team-weight-explanation">Completion dates filter Completed Tasks and Completed Weight only. Total Tasks and Active Weight show all work matching PIC, Project, and Task Type. Active Weight includes Open, Pending, and On Going; tasks without an estimate do not add weight.</div>'+(!summary.dateValid?'<p class="team-weight-error" role="alert">Completed From must be on or before Completed Until.</p>':'')+'<div class="team-weight-totals">'+[['Team Members',summary.rows.length],['Total Tasks',totals.totalTasks],['Active Weight',totals.activeWeight.toFixed(2)],['Completed Weight',summary.dateValid?totals.completedWeight.toFixed(2):'—']].map(([label,value])=>'<div><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div><div class="table-wrap team-weight-summary-scroll" data-scroll-key="team-weight-summary"><table class="table"><colgroup>'+[48,230,170,110,160,150,170,120].map(width=>'<col style="width:'+width+'px">').join('')+'</colgroup><thead><tr><th>No.</th>'+sortHeader('name','PIC')+sortHeader('department','Department')+sortHeader('totalTasks','Total Tasks')+sortHeader('activeWeight','Active Weight')+sortHeader('completedTasks','Completed Tasks')+sortHeader('completedWeight','Completed Weight')+'<th>Details</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="empty">No Team PICs Selected.</td></tr>')+'</tbody></table></div>'+teamWeightPagination(teamWeightPage,summary.rows.length,'summary')+'</section>'+renderTeamWeightDetails(summary);
}

function refreshTeamWeight(openFilter=''){
 const previous=openFilter?document.querySelector('[data-team-weight-picker="'+openFilter+'"]'):null,query=previous?.querySelector('[data-team-weight-search]')?.value||'',scroll=previous?.querySelector('.report-multi-options')?.scrollTop||0;
 render();if(openFilter){const picker=document.querySelector('[data-team-weight-picker="'+openFilter+'"]');if(picker){picker.open=true;const search=picker.querySelector('[data-team-weight-search]');search.value=query;picker.querySelectorAll('[data-team-weight-option-label]').forEach(label=>label.hidden=!label.dataset.teamWeightOptionLabel.includes(query.trim().toLowerCase()));picker.querySelector('.report-multi-options').scrollTop=scroll;}}
}

document.addEventListener('click',event=>{
 const view=event.target.closest('[data-team-task-view]');if(view){teamTaskViewMode=view.dataset.teamTaskView;render();return;}
 const reset=event.target.closest('[data-team-weight-reset]');if(reset){Object.assign(teamWeightFilters,{pics:null,projects:null,types:null,from:'',to:''});teamWeightPage=1;teamWeightDetailPic='';refreshTeamWeight();return;}
 const sort=event.target.closest('[data-team-weight-sort]');if(sort){const key=sort.dataset.teamWeightSort;if(teamWeightSort===key)teamWeightDirection=teamWeightDirection==='asc'?'desc':'asc';else{teamWeightSort=key;teamWeightDirection=['name','department'].includes(key)?'asc':'desc'}teamWeightPage=1;refreshTeamWeight();return;}
 const person=event.target.closest('[data-team-weight-person]');if(person){teamWeightDetailPic=person.dataset.teamWeightPerson;teamWeightDetailPage=1;refreshTeamWeight();document.querySelector('.team-weight-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
 if(event.target.closest('[data-team-weight-close-details]')){teamWeightDetailPic='';refreshTeamWeight();return;}
 const pagination=event.target.closest('[data-team-weight-page]');if(pagination){if(pagination.dataset.teamWeightPage==='summary')teamWeightPage=Math.max(1,teamWeightPage+Number(pagination.dataset.delta));else teamWeightDetailPage=Math.max(1,teamWeightDetailPage+Number(pagination.dataset.delta));refreshTeamWeight();return;}
 if(!event.target.closest('[data-team-weight-picker]'))document.querySelectorAll('[data-team-weight-picker][open]').forEach(picker=>picker.open=false);
});

document.addEventListener('input',event=>{
 const search=event.target.closest('[data-team-weight-search]');if(!search)return;const query=search.value.trim().toLowerCase();search.closest('[data-team-weight-picker]').querySelectorAll('[data-team-weight-option-label]').forEach(label=>label.hidden=!label.dataset.teamWeightOptionLabel.includes(query));
});

document.addEventListener('change',event=>{
 const all=event.target.closest('[data-team-weight-all]'),option=event.target.closest('[data-team-weight-option]'),date=event.target.closest('[data-team-weight-date]');if(!all&&!option&&!date)return;
 const key=all?.dataset.teamWeightAll||option?.dataset.teamWeightOption;
 if(all)teamWeightFilters[key]=all.checked?null:[];
 if(option){const options=teamWeightFilterOptions(teamWeightSource())[key],selected=new Set(teamWeightFilters[key]===null?options.map(item=>item.value):teamWeightFilters[key]);if(option.checked)selected.add(option.value);else selected.delete(option.value);teamWeightFilters[key]=selected.size===options.length?null:[...selected];}
 if(date)teamWeightFilters[date.dataset.teamWeightDate]=date.value;
 teamWeightPage=1;teamWeightDetailPic='';refreshTeamWeight(key||'');
});
