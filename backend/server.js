import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
const uploadDir = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });

// Fail closed: never start with a placeholder JWT secret or an unrestricted/empty CORS policy.
const jwtSecret = String(process.env.JWT_SECRET || '');
if (jwtSecret.length < 32 || /CHANGE_ME|REPLACE|EXAMPLE|SECRET/i.test(jwtSecret)) {
  throw new Error('JWT_SECRET wajib diisi secret acak minimal 32 karakter; jangan gunakan nilai contoh.');
}
const allowedOrigins = String(process.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
if (!allowedOrigins.length || allowedOrigins.some(v => !/^https:\/\//i.test(v))) {
  throw new Error('CORS_ORIGIN wajib berisi minimal satu origin HTTPS yang benar.');
}
app.set('trust proxy', 1); // Nginx reverse proxy; review this value if proxy topology changes.
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json({ limit: '200kb' }));
app.use(rateLimit({ windowMs: 15*60*1000, limit: 180 }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5*1024*1024, files: 1 },
  fileFilter: (_req,file,cb)=>cb(null, ['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype))
});
function detectProofType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff) return { ext:'.jpg', mime:'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext:'.png', mime:'image/png' };
  if (buffer.length >= 12 && buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') return { ext:'.webp', mime:'image/webp' };
  if (buffer.length >= 5 && buffer.subarray(0,5).toString('ascii')==='%PDF-') return { ext:'.pdf', mime:'application/pdf' };
  return null;
}

async function init(){
 await pool.query(`
 CREATE TABLE IF NOT EXISTS admins(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS units(id SERIAL PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,description TEXT DEFAULT '',price_daily BIGINT NOT NULL CHECK(price_daily>=0),active BOOLEAN DEFAULT true,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,customer_name TEXT NOT NULL,phone TEXT NOT NULL,unit_id INT REFERENCES units(id),check_in DATE NOT NULL,days INT NOT NULL CHECK(days BETWEEN 1 AND 90),total BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'MENUNGGU_TRANSFER',proof_file TEXT,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS partners(id SERIAL PRIMARY KEY,owner_name TEXT NOT NULL,phone TEXT NOT NULL,property_name TEXT NOT NULL,property_type TEXT NOT NULL DEFAULT 'Apartemen',cooperation_type TEXT NOT NULL DEFAULT 'Pengelolaan sewa',status TEXT NOT NULL DEFAULT 'BARU',created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS audit_logs(id BIGSERIAL PRIMARY KEY,admin_email TEXT,action TEXT,booking_id TEXT,created_at TIMESTAMPTZ DEFAULT now());
 `);
 // Additive, idempotent schema upgrade. Existing rows are preserved.
 const migration = fs.readFileSync(path.join(process.cwd(),'migrations/001_owner_finance_foundation.sql'),'utf8');
 await pool.query(migration);
 const financeMigration = fs.readFileSync(path.join(process.cwd(),'migrations/002_payment_finance_integration.sql'),'utf8');
 await pool.query(financeMigration);
 await pool.query(fs.readFileSync(path.join(process.cwd(),"migrations/003_owner_commission.sql"),"utf8"));
 await pool.query(`CREATE TABLE IF NOT EXISTS payment_accounts(id SERIAL PRIMARY KEY, bank TEXT NOT NULL, account_number TEXT NOT NULL, account_name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true)`);
 await pool.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS operational_state text NOT NULL DEFAULT 'READY'; ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_check_in timestamptz; ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_check_out timestamptz;`);
 await pool.query(`CREATE TABLE IF NOT EXISTS customer_accounts(id BIGSERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now()); ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_account_id BIGINT REFERENCES customer_accounts(id);`);
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/006_email_recovery.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/007_google.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/008_session_recovery.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/009_account_management.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/010_owner_signup.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/011_owner_dashboard.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/012_unit_lifecycle.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/013_admin_profiles.sql'),'utf8'));
 await pool.query(fs.readFileSync(path.join(process.cwd(),'migrations/014_admin_permissions.sql'),'utf8'));
 await pool.query(`CREATE TABLE IF NOT EXISTS unit_photos(unit_id INT PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE, mime TEXT NOT NULL, data BYTEA NOT NULL, version UUID NOT NULL)`);
 const email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
 if(email && password && password!=='CHANGE_THIS_BEFORE_DEPLOY' && !(await pool.query('SELECT 1 FROM admins LIMIT 1')).rowCount){
   if(String(password).length < 12) throw new Error('ADMIN_PASSWORD minimal 12 karakter sebelum membuat akun admin.');
   const hash=await bcrypt.hash(password,12);
   await pool.query('INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',[email,hash]);
 }
}
const accountTables={admin:'admins',owner:'owner_accounts',customer:'customer_accounts'};
function sessionAuth(role){return async(req,res,next)=>{try{
 const p=jwt.verify((req.headers.authorization||'').replace(/^Bearer\s+/,''),jwtSecret,{algorithms:['HS256']});
 if(p.role!==role)return res.sendStatus(403);
 if(typeof p.jti!=='string'||typeof p.pv!=='string'||!p.id)return res.sendStatus(401);
 const q=await pool.query(`SELECT password_hash FROM ${accountTables[role]} WHERE id=$1${role==='owner'||role==='admin'?' AND active=true':''}`,[p.id]);
 if(!q.rowCount||p.pv!==passwordVersion(q.rows[0].password_hash))return res.sendStatus(401);
 const revoked=await pool.query('SELECT 1 FROM revoked_sessions WHERE jti=$1',[p.jti]);if(revoked.rowCount)return res.sendStatus(401);
 req[role]=p;next();}catch{return res.sendStatus(401);}};}
const auth=sessionAuth('admin'),ownerAuth=sessionAuth('owner'),customerAuth=sessionAuth('customer');
function issueSession(a,role){return jwt.sign({id:a.id,email:a.email,role,pv:passwordVersion(a.password_hash)},jwtSecret,{expiresIn:role==='customer'?'2h':'8h',jwtid:crypto.randomUUID()});}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const superOnly=asyncRoute(async(req,res,next)=>{const q=await pool.query('SELECT 1 FROM admins WHERE id=$1 AND active AND super_admin',[req.admin.id]);if(!q.rowCount)return res.sendStatus(403);next();});
const permissionKeys=['units','bookings','operations','finance','partners','reports'];
const validPermissions=v=>Array.isArray(v)&&v.every(k=>permissionKeys.includes(k));
const permit=k=>asyncRoute(async(req,res,next)=>{const q=await pool.query('SELECT super_admin,permissions FROM admins WHERE id=$1 AND active',[req.admin.id]);const a=q.rows[0];if(!a||(!a.super_admin&&!(a.permissions||[]).includes(k)))return res.sendStatus(403);next();});
app.get('/api/admin/me',auth,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT id,email,full_name,job_title,super_admin,permissions FROM admins WHERE id=$1 AND active',[req.admin.id]);res.json(q.rows[0]);}));
app.get('/health',(_req,res)=>res.json({ok:true,service:'AWAPART 66 API'}));
app.post('/api/owner/login',rateLimit({windowMs:15*60*1000,limit:8}),asyncRoute(async(req,res)=>{
 const {email,password}=req.body||{};
 const q=await pool.query('SELECT id,email,password_hash,active FROM owner_accounts WHERE email=$1',[String(email||'').toLowerCase().trim()]);
 if(!q.rowCount||!q.rows[0].active||!await bcrypt.compare(password||'',q.rows[0].password_hash))return res.status(401).json({error:'Email atau password salah'});
 const token=issueSession(q.rows[0],'owner');
 res.json({token,expiresIn:28800,role:'owner'});
}));

app.post('/api/admin/login',rateLimit({windowMs:15*60*1000,limit:8}),asyncRoute(async(req,res)=>{
 const {email,password}=req.body||{};
 const q=await pool.query('SELECT * FROM admins WHERE lower(trim(email))=lower(trim($1))',[email||'']);
 if(q.rowCount!==1 || !q.rows[0].active || typeof password!=='string' || !await bcrypt.compare(password,q.rows[0].password_hash)) return res.status(401).json({error:'Email atau password salah'});
 const token=issueSession(q.rows[0],'admin');
 res.json({token,expiresIn:28800});
}));
const customerLimit=rateLimit({windowMs:15*60*1000,limit:8});
const passwordVersion=h=>crypto.createHmac('sha256',jwtSecret).update(h).digest('hex');
function customerCredentials(body){const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';const password=typeof body?.password==='string'?body.password:'';return {email,password,valid:email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&password.length>=12&&Buffer.byteLength(password)<=72};}
app.post('/api/customer/register',customerLimit,asyncRoute(async(req,res)=>{const {email,password,valid}=customerCredentials(req.body);if(!valid)return res.status(400).json({error:'Email valid dan kata sandi minimal 12 karakter, maksimal 72 byte diperlukan'});const hash=await bcrypt.hash(password,12);const created=await pool.query('INSERT INTO customer_accounts(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id',[email,hash]);if(created.rowCount){try{await sendCustomerLink(created.rows[0].id,email,'verify');}catch{console.error('[RECOVERY] registration verification delivery failed');}}res.status(201).json({message:'Jika akun baru berhasil dibuat, periksa email untuk verifikasi. Jika belum menerima, gunakan tombol verifikasi email dengan kata sandi akun.'});}));
app.post('/api/customer/login',customerLimit,asyncRoute(async(req,res)=>{const {email,password,valid}=customerCredentials(req.body);if(!valid)return res.status(401).json({error:'Email atau password salah'});const q=await pool.query('SELECT id,password_hash FROM customer_accounts WHERE email=$1',[email]);if(!q.rowCount||!await bcrypt.compare(password,q.rows[0].password_hash))return res.status(401).json({error:'Email atau password salah'});res.json({token:issueSession(q.rows[0],'customer'),role:'customer'});}));

const emailLimit=rateLimit({windowMs:15*60*1000,limit:5});
const digestEmailToken=t=>crypto.createHash('sha256').update(t).digest('hex');
async function sendCustomerLink(id,email,purpose){
 const key=process.env.BREVO_API_KEY;
 if(!key)throw new Error('Email service not configured');
 const raw=crypto.randomBytes(32).toString('hex');
 await pool.query('DELETE FROM customer_email_tokens WHERE expires_at<now()');
 await pool.query("INSERT INTO customer_email_tokens(digest,customer_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '20 minutes')",[digestEmailToken(raw),id,purpose]);
 const link=publicOrigin+'/recovery.html#'+purpose+':'+raw;
 try { await sendManagementMail(email,purpose==='verify'?'Verifikasi email AWAPART 66':'Reset kata sandi AWAPART 66','Buka tautan ini dalam 20 menit: '+link+' . Abaikan jika Anda tidak meminta ini.'); }
 catch(e){await pool.query('DELETE FROM customer_email_tokens WHERE digest=$1',[digestEmailToken(raw)]);throw e;}
}
app.post('/api/customer/email/request',emailLimit,asyncRoute(async(req,res)=>{
 const {email,password,valid}=customerCredentials(req.body); const purpose=req.body?.purpose;
 if(!['verify','reset'].includes(purpose))return res.status(400).json({error:'Permintaan tidak valid'});
 if(!process.env.BREVO_API_KEY)return res.status(503).json({error:'Layanan email belum tersedia'});
 const q=await pool.query('SELECT id,email,password_hash,email_verified_at FROM customer_accounts WHERE email=$1',[email]); const a=q.rows[0];
 if(a && (purpose==='reset'?!!a.email_verified_at:valid&&await bcrypt.compare(password,a.password_hash))){try{await sendCustomerLink(a.id,a.email,purpose)}catch{console.error('Customer email delivery failed');}}
 res.json({message:'Jika akun terdaftar dan email telah diverifikasi, tautan akan dikirim. Periksa juga folder spam.'});
}));
app.post('/api/customer/email/confirm',emailLimit,asyncRoute(async(req,res)=>{
 const {token,purpose,password}=req.body||{};
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)||!['verify','reset'].includes(purpose))return res.status(400).json({error:'Tautan tidak valid'});
 if(purpose==='reset'&&(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72))return res.status(400).json({error:'Kata sandi minimal 12 karakter, maksimal 72 byte'});
 const hash=purpose==='reset'?await bcrypt.hash(password,12):null;
 const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query('DELETE FROM customer_email_tokens WHERE digest=$1 AND purpose=$2 AND expires_at>now() RETURNING customer_id',[digestEmailToken(token),purpose]);if(!q.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Tautan kedaluwarsa atau sudah digunakan'});}const id=q.rows[0].customer_id;
 if(purpose==='verify')await c.query('UPDATE customer_accounts SET email_verified_at=now() WHERE id=$1',[id]);else await c.query('UPDATE customer_accounts SET password_hash=$1 WHERE id=$2 AND email_verified_at IS NOT NULL',[hash,id]);
 await c.query('DELETE FROM customer_email_tokens WHERE customer_id=$1 AND purpose=$2',[id,purpose]);await c.query('COMMIT');res.json({message:'Berhasil. Silakan masuk kembali.'});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));


for(const role of ['admin','owner','customer']){
 app.post('/api/'+role+'/logout',sessionAuth(role),asyncRoute(async(req,res)=>{
 const p=req[role];await pool.query('DELETE FROM revoked_sessions WHERE expires_at<now()');
 await pool.query('INSERT INTO revoked_sessions(jti,expires_at) VALUES($1,to_timestamp($2)) ON CONFLICT DO NOTHING',[p.jti,p.exp]);res.json({ok:true});}));
}
app.post('/api/account/recovery/request',emailLimit,asyncRoute(async(req,res)=>{
 const {role,email}=req.body||{};if(!['admin','owner'].includes(role)||typeof email!=='string'||email.length>254)return res.sendStatus(400);
 if(!process.env.BREVO_API_KEY)return res.sendStatus(503);
 const q=await pool.query(`SELECT id,email FROM ${accountTables[role]} WHERE lower(trim(email))=$1 AND recovery_enabled=true${role==='owner'||role==='admin'?' AND active=true':''}`,[email.trim().toLowerCase()]);
 if(q.rowCount===1){const a=q.rows[0],raw=randomHex();try{
 await pool.query('DELETE FROM privileged_recovery WHERE expires_at<now()');
 await pool.query("INSERT INTO privileged_recovery(digest,role,account_id,email,expires_at) VALUES($1,$2,$3,$4,now()+interval '20 minutes')",[digestEmailToken(raw),role,a.id,a.email]);
 await sendManagementMail(a.email,'Pemulihan akun AWAPART 66','Buka dalam 20 menit: '+publicOrigin+'/recovery.html#'+role+':'+raw+' . Abaikan jika tidak meminta.');}catch{await pool.query('DELETE FROM privileged_recovery WHERE digest=$1',[digestEmailToken(raw)]);console.error('Privileged recovery delivery failed');}}
 res.json({message:'Jika akun terdaftar dan email telah diverifikasi, tautan akan dikirim. Periksa juga folder spam.'});
}));
app.post('/api/account/recovery/confirm',emailLimit,asyncRoute(async(req,res)=>{
 const {role,token,password}=req.body||{};if(!['admin','owner'].includes(role)||typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72)return res.sendStatus(400);
 const hash=await bcrypt.hash(password,12),c=await pool.connect();try{await c.query('BEGIN');
 const q=await c.query('SELECT account_id,email FROM privileged_recovery WHERE digest=$1 AND role=$2 AND expires_at>now()',[digestEmailToken(token),role]);if(!q.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Tautan tidak valid'});}
 const a=q.rows[0];const locked=await c.query(`SELECT id FROM ${accountTables[role]} WHERE id=$1 AND email=$2 AND recovery_enabled=true${role==='owner'||role==='admin'?' AND active=true':''} FOR UPDATE`,[a.account_id,a.email]);
 const used=await c.query('DELETE FROM privileged_recovery WHERE digest=$1 AND role=$2 AND expires_at>now() RETURNING account_id',[digestEmailToken(token),role]);
 if(!locked.rowCount||!used.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Tautan tidak valid'});}
 await c.query(`UPDATE ${accountTables[role]} SET password_hash=$1 WHERE id=$2`,[hash,a.account_id]);await c.query('DELETE FROM privileged_recovery WHERE role=$1 AND account_id=$2',[role,a.account_id]);await c.query('COMMIT');res.json({message:'Kata sandi diperbarui. Silakan masuk kembali.'});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
const publicOrigin=String(process.env.PUBLIC_ORIGIN||'').trim();
if(!['https://staging.awapart66.com','https://awapart66.com'].includes(publicOrigin))throw Error('PUBLIC_ORIGIN invalid');
const googleReady=()=>!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
const randomHex=()=>crypto.randomBytes(32).toString('hex');
app.post('/api/auth/google/start',customerLimit,asyncRoute(async(req,res)=>{
 if(!googleReady())return res.status(503).json({error:'Google Login belum dikonfigurasi'});
 const state=randomHex(), poll=randomHex(), verifier=randomHex();
 await pool.query('DELETE FROM google_attempts WHERE expires_at<now()');
 await pool.query("INSERT INTO google_attempts(state,poll_digest,verifier,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",[state,digestEmailToken(poll),verifier]);
 const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 u.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:publicOrigin+'/api/auth/google/callback',response_type:'code',scope:'openid email',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
 res.set('Cache-Control','no-store').json({url:u.href,poll});
}));
app.get('/api/auth/google/callback',asyncRoute(async(req,res)=>{
 res.set('Cache-Control','no-store');
 const {state,code}=req.query;if(typeof state!=='string'||typeof code!=='string'||!googleReady())return res.status(400).send('Login Google tidak selesai. Kembali ke aplikasi.');
 const a=await pool.query('UPDATE google_attempts SET used=true WHERE state=$1 AND used=false AND expires_at>now() RETURNING verifier',[state]);if(!a.rowCount)return res.status(400).send('Permintaan kedaluwarsa.');
 try{
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:publicOrigin+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:a.rows[0].verifier}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('exchange');const d=await r.json();
 // Userinfo is obtained directly from Google using the access token issued to this client.
 const ur=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+d.access_token},signal:AbortSignal.timeout(10000)});if(!ur.ok)throw Error('userinfo');const u=await ur.json();if(u.email_verified!==true||typeof u.sub!=='string'||typeof u.email!=='string')throw Error('identity');
 const email=u.email.trim().toLowerCase();let q=await pool.query('SELECT id,password_hash FROM customer_accounts WHERE google_sub=$1',[u.sub]);
 if(!q.rowCount){const hash=await bcrypt.hash(randomHex(),12);q=await pool.query('INSERT INTO customer_accounts(email,password_hash,email_verified_at,google_sub) VALUES($1,$2,now(),$3) ON CONFLICT DO NOTHING RETURNING id,password_hash',[email,hash,u.sub]);}
 if(!q.rowCount)throw Error('existing account');
 await pool.query('UPDATE google_attempts SET customer_id=$1 WHERE state=$2',[q.rows[0].id,state]);res.send('Login Google berhasil. Kembali ke aplikasi AWAPART 66.');
 }catch{await pool.query('UPDATE google_attempts SET failed=true WHERE state=$1',[state]);res.status(400).send('Login Google gagal. Jika email sudah terdaftar, gunakan login biasa.');}
}));
app.post('/api/auth/google/poll',asyncRoute(async(req,res)=>{
 const poll=req.body?.poll;if(typeof poll!=='string'||! /^[a-f0-9]{64}$/.test(poll))return res.sendStatus(400);
 const key=digestEmailToken(poll);const q=await pool.query('DELETE FROM google_attempts WHERE poll_digest=$1 AND expires_at>now() AND (customer_id IS NOT NULL OR failed) RETURNING customer_id,failed',[key]);res.set('Cache-Control','no-store');if(!q.rowCount)return res.json({pending:true});if(q.rows[0].failed)return res.status(400).json({error:'Login Google gagal. Gunakan login biasa jika email sudah terdaftar.'});
 const a=await pool.query('SELECT id,password_hash FROM customer_accounts WHERE id=$1',[q.rows[0].customer_id]);if(!a.rowCount)return res.sendStatus(401);res.json({token:issueSession(a.rows[0],'customer')});
}));

app.get('/api/customer/me',customerAuth,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT email FROM customer_accounts WHERE id=$1',[req.customer.id]);if(!q.rowCount)return res.status(401).json({error:'Akun tidak tersedia'});res.json(q.rows[0]);}));
app.get('/api/customer/bookings',customerAuth,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT id,check_in,days,total,status,payment_method FROM bookings WHERE customer_account_id=$1 ORDER BY created_at DESC LIMIT 100',[req.customer.id]);res.json(q.rows);}));
app.get('/api/units',customerAuth,asyncRoute(async(_req,res)=>{
 const q=await pool.query('SELECT id,name,location,description,price_daily,(SELECT version FROM unit_photos WHERE unit_id=units.id) AS photo_version FROM units WHERE active=true AND operational_state=\'READY\' ORDER BY id');
 res.json(q.rows);
}));
app.post('/api/partners',customerAuth,asyncRoute(async(req,res)=>{
 const {owner_name,phone,property_name,property_type='Apartemen',cooperation_type='Pengelolaan sewa'}=req.body||{};
 if(!owner_name?.trim()||!/^\+?[0-9]{8,16}$/.test(String(phone||'').replace(/[\s-]/g,''))||!property_name?.trim()) return res.status(400).json({error:'Data pengajuan kerja sama tidak valid'});
 const q=await pool.query('INSERT INTO partners(owner_name,phone,property_name,property_type,cooperation_type) VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at',[owner_name.trim(),String(phone).replace(/[\s-]/g,''),property_name.trim(),property_type,cooperation_type]);
 res.status(201).json(q.rows[0]);
}));
app.get('/api/admin/partners',auth,permit('partners'),asyncRoute(async(_req,res)=>{
 const q=await pool.query('SELECT id,owner_name,phone,property_name,property_type,cooperation_type,status,created_at FROM partners ORDER BY created_at DESC');res.json(q.rows);
}));
app.patch('/api/admin/partners/:id/status',auth,permit('partners'),asyncRoute(async(req,res)=>{
 const allowed=['BARU','DIHUBUNGI','DISETUJUI','DITOLAK'];if(!allowed.includes(req.body?.status))return res.status(400).json({error:'Status tidak valid'});
 const q=await pool.query('UPDATE partners SET status=$1 WHERE id=$2 RETURNING id,status',[req.body.status,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Pengajuan tidak ditemukan'});res.json(q.rows[0]);
}));
app.get('/api/bookings/lookup',customerAuth,asyncRoute(async(req,res)=>{
 const phone=String(req.query.phone||'').replace(/[\s-]/g,'');const id=String(req.query.id||'');
 if(!/^\+?[0-9]{8,16}$/.test(phone)||!id) return res.status(400).json({error:'Nomor WhatsApp dan kode booking wajib diisi'});
 const q=await pool.query(`SELECT b.id,b.check_in,b.days,b.total,b.status,b.payment_method,u.name AS unit_name FROM bookings b JOIN units u ON u.id=b.unit_id WHERE b.id=$1 AND b.phone=$2 AND b.customer_account_id=$3`,[id,phone,req.customer.id]);
 if(!q.rowCount)return res.status(404).json({error:'Booking tidak ditemukan'});res.json(q.rows[0]);
}));
app.get('/api/admin/units',auth,permit('units'),asyncRoute(async(_req,res)=>{
 const q=await pool.query(`SELECT u.id,u.name,u.location,u.description,u.price_daily,u.active,u.owner_id,u.application_id,u.commission_bps,(SELECT version FROM unit_photos WHERE unit_id=u.id) AS photo_version,o.full_name AS owner_name FROM units u LEFT JOIN owner_accounts o ON o.id=u.owner_id ORDER BY u.id`);
 res.json(q.rows);
}));
app.post('/api/admin/units',auth,permit('units'),asyncRoute(async(req,res)=>{
 const {name,location,description='',price_daily}=req.body||{};
 if(!name||!location||!Number.isSafeInteger(Number(price_daily))||Number(price_daily)<0) return res.status(400).json({error:'Data unit tidak valid'});
 const q=await pool.query('INSERT INTO units(name,location,description,price_daily) VALUES($1,$2,$3,$4) RETURNING *',[name,location,description,price_daily]);
 res.status(201).json(q.rows[0]);
}));
app.patch('/api/admin/units/:id',auth,permit('units'),asyncRoute(async(req,res)=>{
 const {name,location,description='',price_daily,active=true}=req.body||{};
 if(!name?.trim()||!location?.trim()||!Number.isSafeInteger(Number(price_daily))||Number(price_daily)<0)return res.status(400).json({error:'Data unit tidak valid'});
 const q=await pool.query('UPDATE units SET name=$1,location=$2,description=$3,price_daily=$4,active=$5 WHERE id=$6 RETURNING *',[name.trim(),location.trim(),description,price_daily,!!active,req.params.id]);
 if(!q.rowCount)return res.status(404).json({error:'Unit tidak ditemukan'});res.json(q.rows[0]);
}));
app.post('/api/bookings',customerAuth,asyncRoute(async(req,res)=>{
 const {customer_name,phone,unit_id,check_in,days}=req.body||{};
 const payment_method=String(req.body?.payment_method||'TRANSFER').toUpperCase();
 if(!customer_name||!phone||!unit_id||!['CASH','TRANSFER'].includes(payment_method)||!/^\d{4}-\d{2}-\d{2}$/.test(check_in||'')||!Number.isInteger(Number(days))||days<1||days>90) return res.status(400).json({error:'Data booking tidak valid'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const u=await client.query('SELECT * FROM units WHERE id=$1 AND active=true FOR UPDATE',[unit_id]);
  if(!u.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Unit tidak ditemukan'});}
  if(u.rows[0].operational_state!=='READY'){await client.query('ROLLBACK');return res.status(409).json({error:'Unit belum siap'});}
  // Prevent overlapping bookings for the same unit. The unit row lock above
  // serializes competing requests, so this check remains effective under concurrency.
  const conflict=await client.query(`SELECT id FROM bookings
    WHERE unit_id=$1
      AND status NOT IN ('DITOLAK','DIBATALKAN')
      AND check_in < ($2::date + $3::int)
      AND (check_in + days) > $2::date
    LIMIT 1`,[unit_id,check_in,Number(days)]);
  if(conflict.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Tanggal tersebut berbenturan dengan booking lain. Silakan pilih tanggal atau unit lain.'});}
  const total=Number(u.rows[0].price_daily)*Number(days);
  if(!Number.isSafeInteger(total)){await client.query('ROLLBACK');return res.status(400).json({error:'Total di luar batas'});}
  const id='AW66-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  const initialStatus=payment_method==='CASH'?'MENUNGGU_PEMBAYARAN':'MENUNGGU_TRANSFER';
  const b=await client.query('INSERT INTO bookings(id,customer_name,phone,unit_id,check_in,days,total,payment_method,status,commission_bps_snapshot,owner_id_snapshot,customer_account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,total,status,payment_method',[id,customer_name,phone,unit_id,check_in,days,total,payment_method,initialStatus,u.rows[0].commission_bps,u.rows[0].owner_id,req.customer.id]);
  await client.query('COMMIT');res.status(201).json({...b.rows[0],payment_instruction:payment_method==='CASH'?'Pembayaran tunai dicatat oleh Admin dan baru sah setelah diverifikasi.':'Silakan hubungi admin resmi untuk memperoleh instruksi transfer. Pembayaran dinyatakan sah setelah diverifikasi.'});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
app.post('/api/bookings/:id/proof',customerAuth,upload.single('proof'),asyncRoute(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Lampirkan JPG, PNG, WEBP, atau PDF maksimal 5 MB'});
 const detected=detectProofType(req.file.buffer);
 if(!detected || detected.mime!==req.file.mimetype) return res.status(400).json({error:'Isi file tidak sesuai dengan format JPG, PNG, WEBP, atau PDF'});
 if(!/^AW66-[A-F0-9]{8}$/.test(String(req.params.id))) return res.status(400).json({error:'Kode booking tidak valid'});
 const phone=String(req.body?.phone||'').replace(/[^0-9]/g,'');
 if(phone.length<8||phone.length>16)return res.status(400).json({error:'Masukkan nomor telepon yang digunakan saat booking'});
 const booking=await pool.query("SELECT id,proof_file FROM bookings WHERE id=$1 AND regexp_replace(phone,'[^0-9]','','g')=$2 AND payment_method='TRANSFER' AND status IN ('MENUNGGU_TRANSFER','MENUNGGU_VERIFIKASI') AND customer_account_id=$3",[req.params.id,phone,req.customer.id]);
 if(!booking.rowCount)return res.status(404).json({error:'Booking transfer tidak ditemukan, nomor telepon tidak cocok, atau status tidak mengizinkan upload'});
 const filename=crypto.randomUUID()+detected.ext;
 const destination=path.join(uploadDir,filename);
 await fs.promises.writeFile(destination,req.file.buffer,{flag:'wx',mode:0o640});
 try {
  const q=await pool.query("UPDATE bookings SET proof_file=$1,status='MENUNGGU_VERIFIKASI' WHERE id=$2 AND regexp_replace(phone,'[^0-9]','','g')=$3 AND payment_method='TRANSFER' AND status IN ('MENUNGGU_TRANSFER','MENUNGGU_VERIFIKASI') AND customer_account_id=$4 RETURNING id,status",[filename,req.params.id,phone,req.customer.id]);
  if(!q.rowCount){await fs.promises.unlink(destination);return res.status(409).json({error:'Status booking berubah. Muat ulang status booking dan coba lagi.'});}
  const old=booking.rows[0].proof_file;
  if(old && old!==filename && path.basename(old)===old) await fs.promises.unlink(path.join(uploadDir,old)).catch(()=>{});
  res.json(q.rows[0]);
 } catch(e) { await fs.promises.unlink(destination).catch(()=>{}); throw e; }
}));
app.get('/api/admin/bookings',auth,permit('bookings'),asyncRoute(async(_req,res)=>{
 const q=await pool.query(`SELECT b.id,b.customer_name,b.phone,b.check_in,b.days,b.total,b.status,b.payment_method,b.payment_verified_at,b.proof_file,u.name AS unit_name FROM bookings b JOIN units u ON u.id=b.unit_id ORDER BY b.created_at DESC`);
 res.json(q.rows);
}));
// Bukti pembayaran hanya dapat dibaca oleh Admin terautentikasi; file tidak diekspos sebagai folder publik.
app.get('/api/admin/bookings/:id/proof',auth,permit('bookings'),asyncRoute(async(req,res)=>{
 const q=await pool.query('SELECT proof_file FROM bookings WHERE id=$1',[req.params.id]);
 if(!q.rowCount||!q.rows[0].proof_file)return res.status(404).json({error:'Bukti pembayaran belum tersedia'});
 const filename=String(q.rows[0].proof_file);
 if(path.basename(filename)!==filename)return res.status(400).json({error:'Referensi berkas tidak valid'});
 const filePath=path.resolve(uploadDir,filename);
 const basePath=path.resolve(uploadDir)+path.sep;
 if(!filePath.startsWith(basePath))return res.status(400).json({error:'Lokasi berkas tidak valid'});
 let buffer;
 try{buffer=await fs.promises.readFile(filePath)}catch(e){if(e.code==='ENOENT')return res.status(404).json({error:'File bukti tidak ditemukan di penyimpanan'});throw e;}
 const ext=path.extname(filename).toLowerCase();
 const mime={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf'}[ext];
 if(!mime)return res.status(415).json({error:'Format bukti tidak didukung'});
 res.setHeader('Content-Type',mime);
 res.setHeader('Content-Length',buffer.length);
 res.setHeader('Content-Disposition','inline; filename="bukti-pembayaran'+ext+'"');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.send(buffer);
}));
app.patch('/api/admin/bookings/:id/status',auth,permit('bookings'),asyncRoute(async(req,res)=>{
 const allowed=['PEMBAYARAN_DIVERIFIKASI','DITOLAK','DIBATALKAN'];
 if(!allowed.includes(req.body?.status))return res.status(400).json({error:'Status tidak valid'});
 const q=await pool.query(`UPDATE bookings SET status=$1, payment_verified_at=CASE WHEN $1='PEMBAYARAN_DIVERIFIKASI' THEN COALESCE(payment_verified_at,now()) ELSE payment_verified_at END, payment_verified_by=CASE WHEN $1='PEMBAYARAN_DIVERIFIKASI' THEN $2 ELSE payment_verified_by END WHERE id=$3 AND actual_check_in IS NULL RETURNING id,status`,[req.body.status,req.admin.email,req.params.id]);
 if(!q.rowCount)return res.status(404).json({error:'Booking tidak ditemukan'});
 await pool.query('INSERT INTO audit_logs(admin_email,action,booking_id) VALUES($1,$2,$3)',[req.admin.email,req.body.status,req.params.id]);
 res.json(q.rows[0]);
}));
app.get('/api/admin/summary',auth,permit('reports'),asyncRoute(async(_req,res)=>{
 const q=await pool.query(`SELECT COUNT(*)::int AS bookings,COALESCE(SUM(total) FILTER(WHERE status='PEMBAYARAN_DIVERIFIKASI'),0)::bigint AS verified_revenue FROM bookings`);
 res.json(q.rows[0]);
}));

// Admin: owner account management. Owner accounts are created by an admin only.
app.get('/api/admin/owners',auth,superOnly,asyncRoute(async(_req,res)=>{
 const q=await pool.query(`SELECT o.id,o.full_name,o.email,o.phone,o.active,o.created_at,COUNT(u.id)::int AS unit_count FROM owner_accounts o LEFT JOIN units u ON u.owner_id=o.id GROUP BY o.id ORDER BY o.created_at DESC`);res.json(q.rows);
}));
app.post('/api/admin/owners',auth,superOnly,asyncRoute(async(req,res)=>{
 const {full_name,email,phone,password}=req.body||{};
 const normalizedEmail=String(email||'').trim().toLowerCase();
 if(!String(full_name||'').trim()||!/^\S+@\S+\.\S+$/.test(normalizedEmail)||!/^\+?[0-9]{8,16}$/.test(String(phone||'').replace(/[\s-]/g,''))||String(password||'').length<10)return res.status(400).json({error:'Nama, email, nomor telepon, dan kata sandi minimal 10 karakter wajib valid'});
 const hash=await bcrypt.hash(password,12);
 try{const q=await pool.query('INSERT INTO owner_accounts(full_name,email,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id,full_name,email,phone,active,created_at',[String(full_name).trim(),normalizedEmail,String(phone).replace(/[\s-]/g,''),hash]);res.status(201).json(q.rows[0]);}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'Email pemilik sudah terdaftar'});throw e;}
}));
app.patch('/api/admin/owners/:id',auth,superOnly,asyncRoute(async(req,res)=>{
 const {active}=req.body||{};if(typeof active!=='boolean')return res.status(400).json({error:'Status aktif harus true atau false'});
 const q=await pool.query('UPDATE owner_accounts SET active=$1,updated_at=now() WHERE id=$2 RETURNING id,full_name,email,phone,active',[active,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Pemilik tidak ditemukan'});res.json(q.rows[0]);
}));
app.get('/api/admin/unit-applications',auth,superOnly,asyncRoute(async(req,res)=>{
 const q=await pool.query("SELECT id,approved_owner_id,property_name,property_location,unit_count FROM owner_applications WHERE status='APPROVED' AND approved_owner_id IS NOT NULL AND unit_count>0 ORDER BY id");res.json(q.rows);
}));
app.get('/api/admin/dashboard-summary',auth,permit('reports'),asyncRoute(async(req,res)=>{
 const q=await pool.query("SELECT (SELECT count(*) FROM units) AS units,(SELECT count(*) FROM units WHERE active) AS active_units,(SELECT count(*) FROM owner_accounts) AS owners,(SELECT count(*) FROM owner_applications WHERE status='PENDING') AS pending,(SELECT count(*) FROM bookings) AS bookings");res.json(q.rows[0]);
}));
app.patch('/api/admin/units/:id/owner',auth,superOnly,asyncRoute(async(req,res)=>{
 const ownerId=req.body?.owner_id, appId=req.body?.application_id??null;
 if(ownerId!==null&&(!Number.isSafeInteger(Number(ownerId))||Number(ownerId)<=0))return res.status(400).json({error:'ID pemilik tidak valid'});
 if(appId!==null&&(!ownerId||!Number.isSafeInteger(Number(appId))||Number(appId)<=0))return res.status(400).json({error:'Pengajuan tidak valid'});
 const c=await pool.connect();try{await c.query('BEGIN');
 const u=await c.query('SELECT id,owner_id,application_id FROM units WHERE id=$1 FOR UPDATE',[req.params.id]);if(!u.rowCount){await c.query('ROLLBACK');return res.sendStatus(404);}
 if(ownerId!==null){const o=await c.query('SELECT id FROM owner_accounts WHERE id=$1 AND active=true',[ownerId]);if(!o.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Pemilik aktif tidak ditemukan'});}}
 const selected=req.body.application_id===undefined&&String(u.rows[0].owner_id)===String(ownerId)?u.rows[0].application_id:appId;
 if(selected!==null){const a=await c.query("SELECT unit_count FROM owner_applications WHERE id=$1 AND approved_owner_id=$2 AND status='APPROVED' FOR UPDATE",[selected,ownerId]);if(!a.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Pengajuan bukan milik akun ini'});}const n=await c.query('SELECT count(*)::int AS n FROM units WHERE application_id=$1 AND id<>$2',[selected,req.params.id]);if(n.rows[0].n>=a.rows[0].unit_count){await c.query('ROLLBACK');return res.status(409).json({error:'Jumlah unit pengajuan sudah terpenuhi'});}}
 const q=await c.query('UPDATE units SET owner_id=$1,application_id=$2 WHERE id=$3 RETURNING id,name,owner_id,application_id',[ownerId,selected,req.params.id]);
 await c.query('INSERT INTO audit_logs(admin_email,action) VALUES($1,$2)',[req.admin.email,'UNIT_ASSIGN '+req.params.id+' APPLICATION '+(selected??'NONE')]);await c.query('COMMIT');res.json(q.rows[0]);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
// Owner portal: only units and bookings assigned to the authenticated owner.
app.get('/api/owner/profile',ownerAuth,asyncRoute(async(req,res)=>{
 const q=await pool.query('SELECT id,full_name,email,phone FROM owner_accounts WHERE id=$1 AND active=true',[req.owner.id]);if(!q.rowCount)return res.status(401).json({error:'Akun pemilik tidak aktif'});const applications=await pool.query("SELECT a.id,a.property_name,a.property_location,a.unit_count,(SELECT count(*)::int FROM units u WHERE u.application_id=a.id AND u.owner_id=a.approved_owner_id) AS registered_count,(SELECT count(*)::int FROM units u WHERE u.application_id=a.id AND u.owner_id=a.approved_owner_id AND u.active) AS active_count FROM owner_applications a WHERE a.approved_owner_id=$1 AND a.status='APPROVED' ORDER BY a.id",[req.owner.id]);res.json({...q.rows[0],applications:applications.rows});
}));
app.get('/api/owner/units',ownerAuth,asyncRoute(async(req,res)=>{
 const q=await pool.query('SELECT id,name,location,description,price_daily,active FROM units WHERE owner_id=$1 ORDER BY id',[req.owner.id]);res.json(q.rows);
}));
app.get('/api/owner/bookings',ownerAuth,asyncRoute(async(req,res)=>{
 const q=await pool.query(`SELECT b.id,b.customer_name,b.check_in,b.days,b.total,b.status,u.id AS unit_id,u.name AS unit_name FROM bookings b JOIN units u ON u.id=b.unit_id WHERE b.owner_id_snapshot=$1 ORDER BY b.created_at DESC`,[req.owner.id]);res.json(q.rows);
}));
app.patch('/api/admin/units/:id/commission',auth,superOnly,asyncRoute(async(req,res)=>{
 const bps=req.body?.commission_bps;
 if(!Number.isInteger(bps)||bps<0||bps>10000)return res.status(400).json({error:'Komisi harus 0–100%'});
 const q=await pool.query('UPDATE units SET commission_bps=$1 WHERE id=$2 RETURNING id,commission_bps',[bps,req.params.id]);
 if(!q.rowCount)return res.status(404).json({error:'Unit tidak ditemukan'});res.json(q.rows[0]);
}));
app.get('/api/owner/finance',ownerAuth,asyncRoute(async(req,res)=>{
 const from=String(req.query.from||''),to=String(req.query.to||'');
 const valid=d=>!d||(/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d);
 if(!valid(from)||!valid(to)||(from&&to&&from>to))return res.status(400).json({error:'Periode tidak valid'});
 const q=await pool.query(`SELECT b.id,u.name AS unit_name,b.payment_method,b.payment_verified_at,b.total::text AS gross,b.commission_bps_snapshot AS commission_bps,CASE WHEN b.commission_bps_snapshot IS NOT NULL THEN round(b.total::numeric*b.commission_bps_snapshot/10000)::text END AS commission,CASE WHEN b.commission_bps_snapshot IS NOT NULL THEN (b.total-round(b.total::numeric*b.commission_bps_snapshot/10000))::text END AS net FROM bookings b JOIN units u ON u.id=b.unit_id WHERE b.owner_id_snapshot=$1 AND b.status='PEMBAYARAN_DIVERIFIKASI' AND (NULLIF($2,'')::date IS NULL OR (b.payment_verified_at AT TIME ZONE 'Asia/Jakarta')::date>=NULLIF($2,'')::date) AND (NULLIF($3,'')::date IS NULL OR (b.payment_verified_at AT TIME ZONE 'Asia/Jakarta')::date<=NULLIF($3,'')::date) ORDER BY b.payment_verified_at DESC`,[req.owner.id,from,to]);
 res.json(q.rows);
}));
// Admin finance ledger: manual cashbook + verified bookings, with duplicate protection.
app.get('/api/admin/finance',auth,permit('finance'),asyncRoute(async(req,res)=>{
 const from=String(req.query.from||'');const to=String(req.query.to||'');
 if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))||(from&&to&&from>to))return res.status(400).json({error:'Rentang tanggal tidak valid'});
 const q=await pool.query(`
  SELECT * FROM (
   SELECT f.id::text AS id,f.entry_date,f.entry_type,f.category,f.description,f.amount,f.payment_method,f.booking_id,f.unit_id,f.created_by,u.name AS unit_name,'MANUAL' AS source
   FROM finance_entries f LEFT JOIN units u ON u.id=f.unit_id
   WHERE ($1='' OR f.entry_date >= $1::date) AND ($2='' OR f.entry_date <= $2::date)
   UNION ALL
   SELECT ('BOOKING-'||b.id)::text AS id,COALESCE(b.payment_verified_at::date,b.created_at::date) AS entry_date,'INCOME'::text AS entry_type,'Sewa booking'::text AS category,('Pembayaran booking '||b.id||' • '||b.customer_name)::text AS description,b.total AS amount,b.payment_method,b.id AS booking_id,b.unit_id,b.payment_verified_by AS created_by,u.name AS unit_name,'BOOKING' AS source
   FROM bookings b JOIN units u ON u.id=b.unit_id
   WHERE b.status='PEMBAYARAN_DIVERIFIKASI'
    AND ($1='' OR COALESCE(b.payment_verified_at::date,b.created_at::date) >= $1::date)
    AND ($2='' OR COALESCE(b.payment_verified_at::date,b.created_at::date) <= $2::date)
    AND NOT EXISTS (SELECT 1 FROM finance_entries f WHERE f.booking_id=b.id)
  ) ledger ORDER BY entry_date DESC,id DESC`,[from,to]);
 const totals=await pool.query(`SELECT
  COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME'),0)::bigint AS income,
  COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE'),0)::bigint AS expense,
  COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME' AND payment_method='CASH'),0)::bigint AS cash_income,
  COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME' AND payment_method='TRANSFER'),0)::bigint AS transfer_income,
  COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE' AND payment_method='CASH'),0)::bigint AS cash_expense,
  COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE' AND payment_method='TRANSFER'),0)::bigint AS transfer_expense,
  (COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME'),0)-COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE'),0))::bigint AS balance
 FROM (
  SELECT f.entry_type,f.amount,f.payment_method FROM finance_entries f WHERE ($1='' OR f.entry_date >= $1::date) AND ($2='' OR f.entry_date <= $2::date)
  UNION ALL
  SELECT 'INCOME',b.total,b.payment_method FROM bookings b WHERE b.status='PEMBAYARAN_DIVERIFIKASI'
   AND ($1='' OR COALESCE(b.payment_verified_at::date,b.created_at::date) >= $1::date)
   AND ($2='' OR COALESCE(b.payment_verified_at::date,b.created_at::date) <= $2::date)
   AND NOT EXISTS (SELECT 1 FROM finance_entries f WHERE f.booking_id=b.id)
 ) x`,[from,to]);
 res.json({entries:q.rows,totals:totals.rows[0]});
}));
app.post('/api/admin/finance',auth,permit('finance'),asyncRoute(async(req,res)=>{
 const {entry_date,entry_type,category,description,amount,booking_id=null,unit_id=null}=req.body||{};
 const payment_method=String(req.body?.payment_method||'CASH').toUpperCase();
 if(!['INCOME','EXPENSE'].includes(entry_type)||!['CASH','TRANSFER'].includes(payment_method)||!String(category||'').trim()||!String(description||'').trim()||!Number.isSafeInteger(Number(amount))||Number(amount)<=0||(entry_date&&!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)))return res.status(400).json({error:'Data transaksi tidak valid'});
 const q=await pool.query(`INSERT INTO finance_entries(entry_date,entry_type,category,description,amount,payment_method,booking_id,unit_id,created_by) VALUES(COALESCE($1::date,CURRENT_DATE),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[entry_date||null,entry_type,String(category).trim(),String(description).trim(),amount,payment_method,booking_id,unit_id,req.admin.email]);res.status(201).json(q.rows[0]);
}));
app.get('/api/admin/finance/summary',auth,permit('finance'),asyncRoute(async(req,res)=>{
 const from=String(req.query.from||'');const to=String(req.query.to||'');
 const q=await pool.query(`SELECT COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME'),0)::bigint AS income,COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE'),0)::bigint AS expense,(COALESCE(SUM(amount) FILTER(WHERE entry_type='INCOME'),0)-COALESCE(SUM(amount) FILTER(WHERE entry_type='EXPENSE'),0))::bigint AS balance FROM (SELECT entry_type,amount FROM finance_entries WHERE (NULLIF($1,'') IS NULL OR entry_date >= NULLIF($1,'')::date) AND (NULLIF($2,'') IS NULL OR entry_date <= NULLIF($2,'')::date) UNION ALL SELECT 'INCOME',b.total FROM bookings b WHERE b.status='PEMBAYARAN_DIVERIFIKASI' AND (NULLIF($1,'') IS NULL OR COALESCE(b.payment_verified_at::date,b.created_at::date)>=NULLIF($1,'')::date) AND (NULLIF($2,'') IS NULL OR COALESCE(b.payment_verified_at::date,b.created_at::date)<=NULLIF($2,'')::date) AND NOT EXISTS(SELECT 1 FROM finance_entries f WHERE f.booking_id=b.id)) ledger`,[from,to]);res.json(q.rows[0]);
}));
app.get('/api/payment-accounts',customerAuth,asyncRoute(async(_req,res)=>{
 res.set('Cache-Control','no-store'); res.json((await pool.query('SELECT id,bank,account_number,account_name FROM payment_accounts WHERE active ORDER BY id')).rows);
}));
app.get('/api/admin/payment-accounts',auth,superOnly,asyncRoute(async(_req,res)=>res.json((await pool.query('SELECT * FROM payment_accounts ORDER BY id')).rows)));
function accountInput(body){const bank=String(body?.bank||'').trim(),number=String(body?.account_number||'').trim(),name=String(body?.account_name||'').trim();return bank.length>0&&bank.length<=80&&/^[0-9]{5,30}$/.test(number)&&name.length>0&&name.length<=120&&typeof body.active==='boolean'?[bank,number,name,body.active]:null;}
app.post('/api/admin/payment-accounts',auth,superOnly,asyncRoute(async(req,res)=>{const v=accountInput(req.body);if(!v)return res.status(400).json({error:'Data rekening tidak valid'});res.status(201).json((await pool.query('INSERT INTO payment_accounts(bank,account_number,account_name,active) VALUES($1,$2,$3,$4) RETURNING *',v)).rows[0]);}));
app.patch('/api/admin/payment-accounts/:id',auth,superOnly,asyncRoute(async(req,res)=>{const v=accountInput(req.body);if(!v||!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Data rekening tidak valid'});const q=await pool.query('UPDATE payment_accounts SET bank=$1,account_number=$2,account_name=$3,active=$4 WHERE id=$5 RETURNING *',[...v,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Rekening tidak ditemukan'});res.json(q.rows[0]);}));
app.get('/api/admin/commission-report',auth,permit('reports'),asyncRoute(async(req,res)=>{const from=String(req.query.from||''),to=String(req.query.to||'');if([from,to].some(x=>x&&!/^\d{4}-\d{2}-\d{2}$/.test(x)))return res.status(400).json({error:'Tanggal tidak valid'});res.json((await pool.query(`SELECT b.id,u.name AS unit_name,b.payment_method,b.total::text AS gross,b.owner_id_snapshot,CASE WHEN b.owner_id_snapshot IS NOT NULL THEN round(b.total::numeric*b.commission_bps_snapshot/10000)::text END AS commission,CASE WHEN b.owner_id_snapshot IS NOT NULL THEN (b.total-round(b.total::numeric*b.commission_bps_snapshot/10000))::text END AS net FROM bookings b JOIN units u ON u.id=b.unit_id WHERE b.status='PEMBAYARAN_DIVERIFIKASI' AND (NULLIF($1,'')::date IS NULL OR b.payment_verified_at::date>=NULLIF($1,'')::date) AND (NULLIF($2,'')::date IS NULL OR b.payment_verified_at::date<=NULLIF($2,'')::date) ORDER BY b.payment_verified_at DESC`,[from,to])).rows);}));


app.get('/api/admin/operations',auth,permit('operations'),asyncRoute(async(_req,res)=>{
 const units=(await pool.query(`SELECT id,name,active,operational_state FROM units ORDER BY id`)).rows;
 const bookings=(await pool.query(`SELECT id,unit_id,check_in,days,actual_check_in,actual_check_out FROM bookings WHERE status='PEMBAYARAN_DIVERIFIKASI' AND actual_check_out IS NULL ORDER BY check_in`)).rows;
 const history=(await pool.query(`SELECT action,booking_id,created_at FROM audit_logs WHERE action LIKE 'OPS:%' ORDER BY id DESC LIMIT 100`)).rows;
 res.json({units,bookings,history});
}));
app.post('/api/admin/operations',auth,permit('operations'),asyncRoute(async(req,res)=>{
 const {unit_id,booking_id,action}=req.body||{};
 if(!/^\d+$/.test(String(unit_id))||!['CHECK_IN','CHECK_OUT','READY','MAINTENANCE'].includes(action))return res.status(400).json({error:'Data tidak valid'});
 const c=await pool.connect();try{await c.query('BEGIN');
 const u=(await c.query('SELECT * FROM units WHERE id=$1 FOR UPDATE',[unit_id])).rows[0];
 const fail=async(message)=>{await c.query('ROLLBACK');return res.status(409).json({error:message});};
 if(!u)return await fail('Unit tidak ditemukan');
 const occupied=(await c.query('SELECT id FROM bookings WHERE unit_id=$1 AND actual_check_in IS NOT NULL AND actual_check_out IS NULL',[unit_id])).rows;
 if(action==='CHECK_IN'||action==='CHECK_OUT'){
 const b=(await c.query(`SELECT *, (check_in <= (now() AT TIME ZONE 'Asia/Jakarta')::date AND check_in+days > (now() AT TIME ZONE 'Asia/Jakarta')::date) AS in_window FROM bookings WHERE id=$1 AND unit_id=$2 FOR UPDATE`,[booking_id,unit_id])).rows[0];
 if(!b||b.status!=='PEMBAYARAN_DIVERIFIKASI')return await fail('Booking belum terverifikasi');
 if(action==='CHECK_IN'){if(!u.active||u.operational_state!=='READY'||occupied.length||b.actual_check_in||!b.in_window)return await fail('Unit atau tanggal belum siap untuk check-in');await c.query('UPDATE bookings SET actual_check_in=now() WHERE id=$1',[booking_id]);}
 else {if(!b.actual_check_in||b.actual_check_out)return await fail('Booking belum check-in atau sudah selesai');await c.query('UPDATE bookings SET actual_check_out=now() WHERE id=$1',[booking_id]);await c.query("UPDATE units SET operational_state='CLEANING' WHERE id=$1",[unit_id]);}
 }else{if(occupied.length)return await fail('Unit masih terisi');await c.query('UPDATE units SET operational_state=$1 WHERE id=$2',[action,unit_id]);}
 await c.query('INSERT INTO audit_logs(admin_email,action,booking_id) VALUES($1,$2,$3)',[req.admin.email,'OPS:'+action+':UNIT:'+unit_id,booking_id||null]);await c.query('COMMIT');res.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));

app.get('/api/admin/final-reports',auth,permit('reports'),asyncRoute(async(req,res)=>{
 const {from='',to='',unit=''}=req.query; if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||!/^\d*$/.test(unit))return res.status(400).json({error:'Filter tidak valid'});
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const args=[from,to,unit];
 const entries=(await c.query(`SELECT f.entry_date::text, u.name AS unit_name,f.entry_type,f.payment_method,f.amount::text FROM finance_entries f LEFT JOIN units u ON u.id=f.unit_id WHERE f.entry_date BETWEEN $1::date AND $2::date AND ($3='' OR f.unit_id::text=$3) UNION ALL SELECT COALESCE((b.payment_verified_at AT TIME ZONE 'Asia/Jakarta')::date,(b.created_at AT TIME ZONE 'Asia/Jakarta')::date)::text,u.name,'INCOME',b.payment_method,b.total::text FROM bookings b JOIN units u ON u.id=b.unit_id WHERE b.status='PEMBAYARAN_DIVERIFIKASI' AND COALESCE((b.payment_verified_at AT TIME ZONE 'Asia/Jakarta')::date,(b.created_at AT TIME ZONE 'Asia/Jakarta')::date) BETWEEN $1::date AND $2::date AND ($3='' OR b.unit_id::text=$3) AND NOT EXISTS(SELECT 1 FROM finance_entries f WHERE f.booking_id=b.id) ORDER BY 1 DESC`,args)).rows;
 const rows=(await c.query(`SELECT owner_id_snapshot::text AS id,COALESCE(sum(round(total::numeric*commission_bps_snapshot/10000)),0)::text AS commission,COALESCE(sum(total-round(total::numeric*commission_bps_snapshot/10000)),0)::text AS net,count(*) FILTER(WHERE commission_bps_snapshot IS NULL)::int AS unknown FROM bookings WHERE status='PEMBAYARAN_DIVERIFIKASI' AND owner_id_snapshot IS NOT NULL AND (payment_verified_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date AND ($3='' OR unit_id::text=$3) GROUP BY owner_id_snapshot`,args)).rows;
 const o=(await c.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.unit_id=u.id AND b.actual_check_in IS NOT NULL AND b.actual_check_out IS NULL))::int AS occupied FROM units u WHERE active AND ($1='' OR u.id::text=$1)`,[unit])).rows[0];
 const t={income:0n,expense:0n,cash_income:0n,transfer_income:0n,cash_expense:0n,transfer_expense:0n,commission:0n,owner_net:0n};for(const e of entries){const k=e.entry_type==='INCOME'?'income':'expense';t[k]+=BigInt(e.amount);const m=String(e.payment_method).toLowerCase()+'_'+k;if(m in t)t[m]+=BigInt(e.amount);}for(const r of rows){t.commission+=BigInt(r.commission);t.owner_net+=BigInt(r.net);}t.balance=t.income-t.expense;await c.query('COMMIT');res.json({...Object.fromEntries(Object.entries(t).map(([k,v])=>[k,String(v)])),entries,owners:rows,unknown:rows.reduce((a,r)=>a+r.unknown,0),occupancy:o.total?Math.round(o.occupied/o.total*10000)/100:null});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));


const managementLimit=rateLimit({windowMs:15*60*1000,limit:10});
const validAddress=e=>typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const normAddress=e=>typeof e==='string'?e.trim().toLowerCase():'';
async function sendManagementMail(email,subject,textContent){
 const key=String(process.env.BREVO_API_KEY||'').trim();
 if(!key){console.error('[BREVO] missing API key');throw Error('Email service not configured');}
 let r;
 try {r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'AWAPART 66',email:'noreply@awapart66.com'},to:[{email}],subject,textContent}),signal:AbortSignal.timeout(10000)});}
 catch(e){console.error('[BREVO] network failure');throw Error('Email delivery failed');}
 if(!r.ok){console.error('[BREVO] rejected HTTP '+r.status);throw Error('Email delivery failed');}
 console.info('[BREVO] accepted HTTP '+r.status);

}
async function sendAdminActivation(id,email){const raw=randomHex();await pool.query("INSERT INTO privileged_recovery(digest,role,account_id,email,expires_at) VALUES($1,'admin',$2,$3,now()+interval '20 minutes')",[digestEmailToken(raw),id,email]);try{await sendManagementMail(email,'Aktivasi / reset AWAPART 66',publicOrigin+'/recovery.html#admin:'+raw);}catch(e){await pool.query('DELETE FROM privileged_recovery WHERE digest=$1',[digestEmailToken(raw)]);throw e;}}
app.post('/api/admin/account-management/admins/:id/activation',auth,superOnly,managementLimit,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT id,email FROM admins WHERE id=$1 AND active AND NOT super_admin AND recovery_enabled',[req.params.id]);if(!q.rowCount)return res.status(409).json({error:'Akun tidak aktif atau pemulihan belum diaktifkan.'});try{await sendAdminActivation(q.rows[0].id,q.rows[0].email);}catch{return res.status(503).json({error:'Email gagal dikirim. Coba lagi.'});}res.json({message:'Tautan dikirim ke email admin.'});}));
app.get('/api/admin/account-management',auth,superOnly,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT super_admin FROM admins WHERE id=$1',[req.admin.id]);const applications=await pool.query("SELECT id,full_name,email,phone,status,created_at,property_name,property_location,unit_count,email_verified_at,decided_at FROM owner_applications ORDER BY (status='PENDING') DESC,id DESC LIMIT 200");const admins=q.rows[0]?.super_admin?(await pool.query('SELECT id,email,active,super_admin,full_name,job_title,phone,permissions FROM admins ORDER BY id')).rows:[];res.json({super_admin:!!q.rows[0]?.super_admin,admins,applications:applications.rows});}));
app.post('/api/admin/account-management/admins',auth,superOnly,managementLimit,asyncRoute(async(req,res)=>{const email=normAddress(req.body?.email),name=String(req.body?.full_name||'').trim(),title=String(req.body?.job_title||'Operasional').trim();const phone=String(req.body?.phone||'').trim(),permissions=req.body?.permissions;if(!validPermissions(permissions)||!/^\+?[0-9]{8,16}$/.test(phone))return res.sendStatus(400);if(!validAddress(email)||!name||name.length>120||!title||title.length>80)return res.status(400).json({error:'Nama, email dan jabatan wajib valid'});const hash=await bcrypt.hash(randomHex(),12);try{await pool.query('INSERT INTO admins(email,password_hash,recovery_enabled,full_name,job_title,phone,permissions) VALUES($1,$2,true,$3,$4,$5,$6::jsonb)',[email,hash,name,title,phone,JSON.stringify(permissions)]);}catch(e){if(e.code==='23505')return res.status(409).json({error:'Email sudah terdaftar. Gunakan edit profil atau kirim tautan aktivasi.'});throw e;}await pool.query('INSERT INTO audit_logs(admin_email,action) VALUES($1,$2)',[req.admin.email,'ADMIN_INVITED']);let message='Akun dibuat. Tautan aktivasi dikirim.';try{const q=await pool.query('SELECT id FROM admins WHERE email=$1',[email]);await sendAdminActivation(q.rows[0].id,email);}catch{message='Akun dibuat, tetapi email gagal dikirim. Gunakan tombol Kirim tautan aktivasi.';}res.status(201).json({message});}));
app.patch('/api/admin/account-management/admins/:id/profile',auth,superOnly,managementLimit,asyncRoute(async(req,res)=>{const {full_name,job_title,phone,permissions}=req.body||{};if(typeof full_name!=='string'||!full_name.trim()||full_name.length>120||typeof job_title!=='string'||!job_title.trim()||job_title.length>80||typeof phone!=='string'||!/^\+?[0-9]{8,16}$/.test(phone)||!validPermissions(permissions))return res.sendStatus(400);const q=await pool.query('UPDATE admins SET full_name=$1,job_title=$2,phone=$3,permissions=$4::jsonb WHERE id=$5 AND NOT super_admin RETURNING id',[full_name.trim(),job_title.trim(),phone,JSON.stringify(permissions),req.params.id]);if(!q.rowCount)return res.sendStatus(404);await pool.query('INSERT INTO audit_logs(admin_email,action) VALUES($1,$2)',[req.admin.email,'ADMIN_PROFILE_CHANGED']);res.json({ok:true});}));
app.patch('/api/admin/account-management/admins/:id',auth,superOnly,asyncRoute(async(req,res)=>{if(typeof req.body?.active!=='boolean')return res.sendStatus(400);const q=await pool.query('UPDATE admins SET active=$1 WHERE id=$2 AND NOT super_admin RETURNING id',[req.body.active,req.params.id]);if(!q.rowCount)return res.sendStatus(403);await pool.query('INSERT INTO audit_logs(admin_email,action) VALUES($1,$2)',[req.admin.email,'ADMIN_STATUS_CHANGED']);res.json({ok:true});}));
app.post('/api/owner/applications',managementLimit,asyncRoute(async(req,res)=>{
 const b=req.body||{},email=normAddress(b.email),name=String(b.full_name||'').trim(),phone=String(b.phone||'').trim(),property=String(b.property_name||'').trim(),location=String(b.property_location||'').trim(),units=Number(b.unit_count);
 if(!validAddress(email)||!name||name.length>120||!/^\+?[0-9]{8,16}$/.test(phone)||!property||property.length>160||!location||location.length>200||!Number.isInteger(units)||units<1||units>10000)return res.status(400).json({error:'Data pengajuan tidak valid'});
 const raw=randomHex();await pool.query('DELETE FROM owner_signup_tokens WHERE expires_at<now()');
 await pool.query("INSERT INTO owner_signup_tokens VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')",[digestEmailToken(raw),email,name,phone,property,location,units]);
 try{await sendManagementMail(email,'Verifikasi pendaftaran pemilik AWAPART 66','Buka tautan dalam 30 menit untuk membuat kata sandi: '+publicOrigin+'/owner-verify.html#'+raw);}catch{console.error('Owner signup email delivery failed');return res.status(503).json({error:'Email belum dapat dikirim. Coba lagi nanti.'});}
 res.status(202).json({message:'Periksa email untuk membuat kata sandi dan menyelesaikan pengajuan.'});
}));
app.post('/api/owner/applications/confirm',managementLimit,asyncRoute(async(req,res)=>{
 const {token,password}=req.body||{};if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72)return res.status(400).json({error:'Tautan atau kata sandi tidak valid'});
 const hash=await bcrypt.hash(password,12),c=await pool.connect();try{await c.query('BEGIN');const q=await c.query('DELETE FROM owner_signup_tokens WHERE digest=$1 AND expires_at>now() RETURNING *',[digestEmailToken(token)]);const a=q.rows[0];if(!a){await c.query('ROLLBACK');return res.status(400).json({error:'Tautan tidak valid atau kedaluwarsa'});}
 const existing=await c.query('SELECT 1 FROM owner_accounts WHERE lower(email)=$1',[a.email]);if(existing.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Gunakan login atau pemulihan akun yang sudah ada'});}
 const added=await c.query("INSERT INTO owner_applications(full_name,email,phone,property_name,property_location,unit_count,pending_password_hash,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT DO NOTHING RETURNING id",[a.full_name,a.email,a.phone,a.property_name,a.property_location,a.unit_count,hash]);if(!added.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Sudah ada pengajuan menunggu keputusan'});}
 await c.query('COMMIT');res.json({message:'Email terverifikasi. Pengajuan menunggu persetujuan Admin.'});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
app.post('/api/admin/account-management/applications/:id',auth,superOnly,managementLimit,asyncRoute(async(req,res)=>{if(!['approve','reject'].includes(req.body?.action))return res.sendStatus(400);const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query("SELECT * FROM owner_applications WHERE id=$1 AND status='PENDING' FOR UPDATE",[req.params.id]);if(!q.rowCount){await c.query('ROLLBACK');return res.sendStatus(404);}const a=q.rows[0];if(req.body.action==='approve'){const hash=a.email_verified_at&&a.pending_password_hash?a.pending_password_hash:await bcrypt.hash(randomHex(),12);const created=await c.query('INSERT INTO owner_accounts(full_name,email,phone,password_hash,recovery_enabled) VALUES($1,$2,$3,$4,true) RETURNING id',[a.full_name,a.email,a.phone,hash]);await c.query('UPDATE owner_applications SET approved_owner_id=$1 WHERE id=$2',[created.rows[0].id,a.id]);}await c.query('UPDATE owner_applications SET status=$1,pending_password_hash=NULL,decided_at=now() WHERE id=$2',[req.body.action==='approve'?'APPROVED':'REJECTED',a.id]);await c.query('INSERT INTO audit_logs(admin_email,action) VALUES($1,$2)',[req.admin.email,'OWNER_APPLICATION_'+req.body.action.toUpperCase()]);await c.query('COMMIT');try{await sendManagementMail(a.email,'Status pengajuan AWAPART 66',req.body.action==='approve'?(a.email_verified_at?'Pengajuan disetujui. Silakan login dengan kata sandi Anda.':'Pengajuan disetujui. Gunakan Lupa kata sandi untuk aktivasi.'):'Pengajuan belum disetujui. Hubungi pengelola untuk informasi.');}catch{console.error('Owner decision email failed');}res.json({message:'Keputusan tersimpan.'});}catch(e){await c.query('ROLLBACK');if(e.code==='23505')return res.sendStatus(409);throw e;}finally{c.release();}}));
for(const r of ['admin','owner'])app.post('/api/'+r+'/account-email',sessionAuth(r),managementLimit,asyncRoute(async(req,res)=>{const email=normAddress(req.body?.email),password=req.body?.password;if(!validAddress(email)||typeof password!=='string'||Buffer.byteLength(password)>72)return res.sendStatus(400);const q=await pool.query(`SELECT email,password_hash FROM ${accountTables[r]} WHERE id=$1`,[req[r].id]);const a=q.rows[0];if(!a||!await bcrypt.compare(password,a.password_hash))return res.sendStatus(403);const raw=randomHex(),hash=await bcrypt.hash(password,12);await pool.query('DELETE FROM account_email_changes WHERE expires_at<now() OR (role=$1 AND account_id=$2)',[r,req[r].id]);await pool.query("INSERT INTO account_email_changes VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '20 minutes')",[digestEmailToken(raw),r,req[r].id,a.email,email,a.password_hash,hash]);await sendManagementMail(email,'Konfirmasi email AWAPART 66',publicOrigin+'/account-email.html#'+raw);res.json({message:'Periksa email baru untuk konfirmasi. Email lama masih berlaku.'});}));
app.post('/api/account-email/confirm',managementLimit,asyncRoute(async(req,res)=>{const raw=req.body?.token;if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))return res.sendStatus(400);const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query('DELETE FROM account_email_changes WHERE digest=$1 AND expires_at>now() RETURNING *',[digestEmailToken(raw)]);const a=q.rows[0];if(!a||!['admin','owner'].includes(a.role)){await c.query('ROLLBACK');return res.sendStatus(400);}const changed=await c.query(`UPDATE ${accountTables[a.role]} SET email=$1,password_hash=$2,recovery_enabled=true WHERE id=$3 AND email=$4 AND password_hash=$5 AND active=true RETURNING id`,[a.new_email,a.new_hash,a.account_id,a.old_email,a.old_hash]);if(!changed.rowCount){await c.query('ROLLBACK');return res.sendStatus(409);}await c.query('DELETE FROM privileged_recovery WHERE role=$1 AND account_id=$2',[a.role,a.account_id]);await c.query('DELETE FROM account_email_changes WHERE role=$1 AND account_id=$2',[a.role,a.account_id]);await c.query('COMMIT');res.json({message:'Email diperbarui. Masuk kembali.'});}catch(e){await c.query('ROLLBACK');if(e.code==='23505')return res.sendStatus(409);throw e;}finally{c.release();}}));


app.post('/api/admin/units/:id/photo',auth,permit('units'),upload.single('photo'),asyncRoute(async(req,res)=>{
 const f=req.file,d=detectProofType(f?.buffer);if(!d||d.mime==='application/pdf'||d.mime!==f.mimetype)return res.status(400).json({error:'Pilih JPG, PNG atau WEBP maksimal 5 MB'});
 if(!/^\d+$/.test(req.params.id))return res.sendStatus(400);
 const q=await pool.query('INSERT INTO unit_photos(unit_id,mime,data,version) SELECT id,$2,$3,$4 FROM units WHERE id=$1 ON CONFLICT(unit_id) DO UPDATE SET mime=EXCLUDED.mime,data=EXCLUDED.data,version=EXCLUDED.version RETURNING version',[req.params.id,d.mime,f.buffer,crypto.randomUUID()]);if(!q.rowCount)return res.sendStatus(404);res.json(q.rows[0]);
}));
app.delete('/api/admin/units/:id/photo',auth,permit('units'),asyncRoute(async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.sendStatus(400);await pool.query('DELETE FROM unit_photos WHERE unit_id=$1',[req.params.id]);res.json({ok:true});}));
app.get('/api/units/:id/photo',asyncRoute(async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.sendStatus(400);const q=await pool.query('SELECT p.mime,p.data FROM unit_photos p JOIN units u ON u.id=p.unit_id WHERE u.id=$1 AND u.active',[req.params.id]);if(!q.rowCount)return res.sendStatus(404);res.set('Cache-Control','no-store').type(q.rows[0].mime).send(q.rows[0].data);}));
app.get('/api/admin/units/:id/photo',auth,permit('units'),asyncRoute(async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.sendStatus(400);const q=await pool.query('SELECT mime,data FROM unit_photos WHERE unit_id=$1',[req.params.id]);if(!q.rowCount)return res.sendStatus(404);res.set('Cache-Control','no-store').type(q.rows[0].mime).send(q.rows[0].data);}));

app.use((err,_req,res,_next)=>{
 if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({error:'Ukuran berkas maksimal 5 MB'});
 if (err instanceof multer.MulterError) return res.status(400).json({error:'Berkas tidak dapat diproses'});
 console.error(err);res.status(500).json({error:'Terjadi kesalahan server'});
});
const port=Number(process.env.PORT||8080);
init().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`AWAPART 66 API listening on ${port}`))).catch(e=>{console.error(e);process.exit(1);});
