import { apiGet, apiPost, getSession, login as coreLogin, logout as coreLogout } from './erp-api';
export type ApiResult<T>={ok:boolean;data:T;error?:{code:string;message:string}};
export async function login(identifier:string,password:string){return coreLogin(identifier,password)}
export async function logout(){return coreLogout()}
export async function signedRequest<T>(path:string,method:'GET'|'POST'='GET',body?:unknown):Promise<T>{return method==='POST'?apiPost<T>(path,body??{}):apiGet<T>(path)}
export async function session(){return (await getSession())?.access_token??null}
