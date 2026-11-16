'use strict';
// Cache snapshot reads only. TEMP triggers keep local writes visible; data_version
// invalidates every entry when another database connection commits.
module.exports=function installSnapshotCache(db){
 const prepare=db.prepare.bind(db),cache=new Map();let active=false,versions=new Map(),external;
 db.exec('CREATE TEMP TABLE snapshot_versions(name TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0)');
 const tables=prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 for(const [i,table] of tables.entries()){
  prepare('INSERT INTO temp.snapshot_versions(name) VALUES(?)').run(table);
  for(const event of ['INSERT','UPDATE','DELETE'])db.exec('CREATE TEMP TRIGGER '+quote('snapshot_'+i+'_'+event)+' AFTER '+event+' ON main.'+quote(table)+" BEGIN UPDATE snapshot_versions SET version=version+1 WHERE name='"+table.replaceAll("'","''")+"'; END");
 }
 const versionQuery=prepare('SELECT name,version FROM temp.snapshot_versions'),externalQuery=prepare('PRAGMA data_version');
 db.prepare=function(sql){
  const statement=prepare(sql);
  if(!/^\s*SELECT\b/i.test(sql))return statement;
  const dependencies=[...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi)].map(m=>m[1]);
  if(!dependencies.length||dependencies.some(t=>!tables.includes(t)))return statement;
  return new Proxy(statement,{get(target,key){if(key!=='all'&&key!=='get'){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}return (...args)=>{
   if(!active)return target[key](...args);
   const signature=dependencies.map(t=>t+':'+versions.get(t)).join('|'),id=sql+'|'+key+'|'+JSON.stringify(args),hit=cache.get(id);
   if(hit&&hit.signature===signature)return structuredClone(hit.value);
   const value=target[key](...args);if(cache.size>=256)cache.delete(cache.keys().next().value);
   cache.set(id,{signature,value:structuredClone(value)});return value;
  }}});
 };
 return function snapshot(read){const next=externalQuery.get().data_version;if(next!==external){cache.clear();external=next}versions=new Map(versionQuery.all().map(r=>[r.name,r.version]));active=true;try{return read()}finally{active=false}};
};
