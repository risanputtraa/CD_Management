'use strict';
const crypto=require('node:crypto');
// Persistent counters survive restarts. Use socket addresses, never untrusted proxy headers.
function createLoginThrottle(db,{now=Date.now,windowMs=15*60*1000,pairLimit=5,accountLimit=20,ipLimit=100}={}){
 db.exec('CREATE TABLE IF NOT EXISTS auth_login_limits(bucket_key TEXT PRIMARY KEY,failures INTEGER NOT NULL,expires_at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS auth_login_limits_expiry ON auth_login_limits(expires_at)');
 const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 const keys=(address,username)=>{const ip=String(address||'unknown').replace(/^::ffff:/,''),account=String(username||'').trim().replace(/[A-Z]/g,c=>c.toLowerCase());return [[digest('pair:'+JSON.stringify([ip,account])),pairLimit],[digest('account:'+account),accountLimit],[digest('ip:'+ip),ipLimit]]};
 const prune=at=>db.prepare('DELETE FROM auth_login_limits WHERE expires_at<=?').run(at);
 return {
  check(address,username){const at=now();prune(at);let retry=0;for(const [key,limit] of keys(address,username)){const row=db.prepare('SELECT failures,expires_at FROM auth_login_limits WHERE bucket_key=?').get(key);if(row&&row.failures>=limit)retry=Math.max(retry,Math.ceil((row.expires_at-at)/1000))}return retry},
  fail(address,username){const at=now();prune(at);const insert=db.prepare('INSERT INTO auth_login_limits(bucket_key,failures,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET failures=failures+1');for(const [key] of keys(address,username))insert.run(key,at+windowMs)},
  success(address,username){const [pair,account]=keys(address,username);db.prepare('DELETE FROM auth_login_limits WHERE bucket_key IN (?,?)').run(pair[0],account[0])}
 };
}
function installSessionRevocation(db){
 db.exec(`CREATE TRIGGER IF NOT EXISTS auth_revoke_sessions_on_user_change AFTER UPDATE OF account_status,password_hash,access_role ON users
 WHEN NEW.account_status='inactive' OR OLD.password_hash IS NOT NEW.password_hash OR OLD.access_role IS NOT NEW.access_role
 BEGIN DELETE FROM login_sessions WHERE user_id=NEW.user_id; END;
 DELETE FROM login_sessions WHERE user_id IN (SELECT user_id FROM users WHERE account_status='inactive') OR expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now');`);
}
module.exports={createLoginThrottle,installSessionRevocation};
