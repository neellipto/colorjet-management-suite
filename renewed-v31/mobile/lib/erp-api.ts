import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { requireApiBaseUrl } from './runtime-config';

const SESSION_KEY = 'colorjet_erp_session_v3';
const DEVICE_KEY = 'colorjet_device_id_v3';
export type ApiUser = { id:number|string; public_id?:string; name?:string; full_name?:string; email?:string; phone?:string; role?:string; employee_code?:string; employee_id?:string; must_change_password?:boolean; permissions?:string[] };
export type ApiSession = { access_token:string; refresh_token:string; user:ApiUser; access_expires_at?:string; refresh_expires_at?:string };
export type ApiError = Error & { code?:string; status?:number; requestId?:string };
type Envelope<T> = { ok?:boolean; success?:boolean; data?:T; error?:{message?:string;code?:string}; request_id?:string; message?:string } & T;
async function deviceId(): Promise<string> { let id=await AsyncStorage.getItem(DEVICE_KEY); if(!id){ id=`${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`; await AsyncStorage.setItem(DEVICE_KEY,id); } return id; }
async function setSession(value:ApiSession){ await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}); }
export async function getSession():Promise<ApiSession|null>{const raw=await SecureStore.getItemAsync(SESSION_KEY);if(!raw)return null;try{return JSON.parse(raw) as ApiSession}catch{await clearSession();return null}}
export async function clearSession(){await SecureStore.deleteItemAsync(SESSION_KEY)}
function err(message:string,status?:number,code?:string,requestId?:string):ApiError{const e=new Error(message) as ApiError;e.status=status;e.code=code;e.requestId=requestId;return e}
function pathOf(path:string){return path.replace(/^\/+/, '')}
async function request<T>(path:string,options:RequestInit={},auth=true,retried=false):Promise<T>{
  const base=await requireApiBaseUrl(); const session=await getSession(); const headers:Record<string,string>={Accept:'application/json'};
  if(options.body && !(options.body instanceof FormData))headers['Content-Type']='application/json';
  if(auth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  if(options.method&&options.method!=='GET')headers['Idempotency-Key']=`${Date.now()}-${Math.random().toString(36).slice(2)}-mobile`;
  let response:Response; try{response=await fetch(`${base}/${pathOf(path)}`,{...options,headers:{...headers,...(options.headers??{})}})}catch{throw err('Unable to reach COLORJET ERP. Check internet and server URL.',undefined,'NETWORK_ERROR')}
  const payload=await response.json().catch(()=>({})) as Envelope<T>;
  if((response.status===401||response.status===403)&&auth&&!retried&&session?.refresh_token){try{await refresh();return request<T>(path,options,auth,true)}catch{await clearSession()}}
  if(!response.ok||payload.ok===false||payload.success===false)throw err(payload.error?.message||payload.message||`ERP request failed (${response.status}).`,response.status,payload.error?.code,payload.request_id);
  return (payload.data??payload) as T;
}
export async function login(identifier:string,password:string):Promise<ApiSession>{const session=await request<ApiSession>('auth/login',{method:'POST',body:JSON.stringify({identifier,password,device:{device_id:await deviceId(),device_name:Platform.OS==='web'?'COLORJET Web':'COLORJET Android',platform:Platform.OS,app_version:'3.1.0'}})},false);if(!session.access_token||!session.refresh_token||!session.user)throw err('ERP login returned an invalid session.',undefined,'INVALID_LOGIN_RESPONSE');await setSession(session);return session}
export async function refresh():Promise<ApiSession>{const session=await getSession();if(!session?.refresh_token)throw err('Session expired.',401,'SESSION_EXPIRED');const update=await request<Partial<ApiSession>>('auth/refresh',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false);const next={...session,...update} as ApiSession;if(!next.access_token||!next.refresh_token)throw err('Session refresh failed.',401,'REFRESH_FAILED');await setSession(next);return next}
export async function logout(){try{await request('auth/logout',{method:'POST'},true)}finally{await clearSession()}}
export async function apiGet<T>(path:string):Promise<T>{return request<T>(path,{method:'GET'},true)}
export async function apiPost<T>(path:string,body:unknown):Promise<T>{return request<T>(path,{method:'POST',body:JSON.stringify(body)},true)}
export async function apiPatch<T>(path:string,body:unknown):Promise<T>{return request<T>(path,{method:'PATCH',body:JSON.stringify(body)},true)}
export async function apiUpload<T>(path:string,body:FormData):Promise<T>{return request<T>(path,{method:'POST',body},true)}
