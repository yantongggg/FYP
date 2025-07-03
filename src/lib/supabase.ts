import { createClient } from '@supabase/supabase-js'

// 🌿 Load env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ✅ Validate env
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your-project')
const isValidKey = supabaseAnonKey && supabaseAnonKey.length > 20 && !supabaseAnonKey.includes('your_supabase_anon_key')

if (!isValidUrl || !isValidKey) {
  console.warn('⚠️ Supabase not configured properly. Using mock mode.')
}

// ✅ Mock Query Builder
class MockQueryBuilder {
  private filters: any[] = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private limitCount: number | null = null
  private isSingle = false
  private insertData: any = null
  private updateData: any = null
  private upsertData: any = null
  private deleteFlag = false

  constructor(private tableName: string) {}

  select() { return this }
  eq(column: string, value: any) { this.filters.push({ column, value }); return this }
  order(column: string, options: { ascending?: boolean } = {}) { this.orderBy = { column, ascending: options.ascending !== false }; return this }
  limit(count: number) { this.limitCount = count; return this }
  single() { this.isSingle = true; return this }
  insert(data: any) { this.insertData = data; return this }
  update(data: any) { this.updateData = data; return this }
  upsert(data: any) { this.upsertData = data; return this }
  delete() { this.deleteFlag = true; return this }

  then<T>(onfulfilled?: (value: any) => T | PromiseLike<T>, onrejected?: (reason: any) => T | PromiseLike<T>): Promise<T> {
    return this.execute().then(onfulfilled, onrejected);
  }
  catch<T>(onrejected?: (reason: any) => T | PromiseLike<T>): Promise<T> {
    return this.execute().catch(onrejected);
  }
  finally(onfinally?: () => void): Promise<any> {
    return this.execute().finally(onfinally);
  }

  private async execute() {
    if (this.insertData) return { data:[this.insertData], error:null }
    if (this.updateData) return { data:[this.updateData], error:null }
    if (this.upsertData) return { data:[this.upsertData], error:null }
    if (this.deleteFlag) return { data:[], error:null }

    const data = this.getMockData()
    const filtered = this.filters.reduce((acc,d)=>acc.filter(x=>x[d.column]===d.value), data)
    const limited = this.limitCount ? filtered.slice(0,this.limitCount) : filtered

    if (this.isSingle) return { data: limited[0] ?? null, error: limited.length?null:{message:'No data'} }
    return { data: limited, error: null }
  }

  private getMockData() {
    switch(this.tableName){
      case 'users': return [{id:'mock-1', email:'demo@example.com', username:'demo', role:'user', status:'active', is_biometric_enrolled:true, trust_score:90, created_at:new Date().toISOString()}]
      case 'biometric_profiles': return [{id:'bio-1', user_id:'mock-1', face_template_hash:'hash', enrollment_quality:0.9}]
      default: return []
    }
  }
}

// ✅ Mock Storage
interface MockStorageBucket {
  upload: (path:string, file:File|Blob)=>Promise<{data:{path:string}|null; error:any}>
  download: (path:string)=>Promise<{data:Blob|null; error:any}>
  list: ()=>Promise<{data:any[]; error:any}>
  getPublicUrl: (path:string)=>{data:{publicUrl:string}}
}
const createMockStorageBucket = (): MockStorageBucket => ({
  upload: async(path,file)=>({data:{path:`mock/${path}`},error:null}),
  download: async(path)=>({data:null,error:{message:'Mock storage'}}),
  list: async()=>({data:[],error:null}),
  getPublicUrl: (path)=>({data:{publicUrl:`https://mock/${path}`}})
})

// ✅ Mock Channel
class MockChannel {
  constructor(private name:string){}
  on(){return this}
  subscribe(){return {unsubscribe:()=>{}}}
}

// ✅ Mock Client
const createMockClient = ()=>({
  auth:{
    getUser:()=>Promise.resolve({data:{user:null},error:null}),
    getSession:()=>Promise.resolve({data:{session:null},error:null}),
    signUp:()=>Promise.resolve({data:null,error:{message:'Supabase not configured'}}),
    signInWithPassword:()=>Promise.resolve({data:null,error:{message:'Supabase not configured'}}),
    signOut:()=>Promise.resolve({error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})
  },
  from:(table:string)=>new MockQueryBuilder(table),
  channel:(name:string)=>new MockChannel(name),
  storage:{ from:()=>createMockStorageBucket() }
})

// ✅ Supabase client
export const supabase = (isValidUrl && isValidKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient() as any

// ✅ Types
export interface User {
  id:string
  username:string
  email:string
  role:'user'|'admin'
  status:'active'|'suspended'
  is_biometric_enrolled:boolean
  trust_score:number
  created_at:string
}
export interface BiometricData {
  id:string
  user_id:string
  biometric_type:string
  capture_timestamp:string
  data:any
  quality_score?:number
}
export interface LoginAudit {
  id:string
  user_id?:string
  event_ts:string
  success:boolean
}
export interface AnomalyAudit {
  id:string
  user_id?:string
  event_ts:string
  anomaly_type:string
  score:number
  action:string
  resolved:boolean
}

// ✅ CRUD Helpers
export class SupabaseCRUD {
  static async createUser(user:Partial<User>) {
    return this.make(async()=>{
      const {data,error} = await supabase.from('users').insert(user).select().single()
      if(error) throw error; return data
    })
  }
  static async getUser(id:string) {
    return this.make(async()=>{
      const {data,error} = await supabase.from('users').select('*').eq('id',id).single()
      if(error) throw error; return data
    })
  }
  static async updateUser(id:string, updates:Partial<User>) {
    return this.make(async()=>{
      const {data,error} = await supabase.from('users').update(updates).eq('id',id).select().single()
      if(error) throw error; return data
    })
  }
  static async getAllUsers() {
    return this.make(async()=>{
      const {data,error} = await supabase.from('users').select('*').order('created_at',{ascending:false})
      if(error) throw error; return data
    })
  }
  private static async make<T>(fn:()=>Promise<T>) {
    try{return await fn()}catch(e){console.error(e);throw e}
  }
}

// ✅ Upload Utility
export const uploadBiometricFile = async(bucket:string, path:string, file:File|Blob)=>{
  const {data,error} = await supabase.storage.from(bucket).upload(path,file)
  if(error) throw error
  const url = supabase.storage.from(bucket).getPublicUrl(data!.path).data.publicUrl
  return url
}