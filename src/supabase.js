import { createClient } from '@supabase/supabase-js'

// TODO: 请将下面的配置替换为你自己的 Supabase 配置
// 获取方式：1. 访问 https://supabase.com/dashboard
//          2. 创建新项目或选择现有项目
//          3. 进入项目设置 → API
//          4. 复制 Project URL 和 anon public key
const supabaseUrl = 'https://ljttjzzssnpikhduakoy.supabase.co'
const supabaseAnonKey = 'sb_publishable_jMzxfh6T56spKiYZy0lUIA_YOJRhVFq'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库操作函数
export const todoAPI = {
  // 监听待办事项变化（实时同步）
  subscribeTodos: (callback) => {
    const channel = supabase
      .channel('todos-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos'
        },
        async () => {
          const { data } = await supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: false })
          callback(data || [])
        }
      )
      .subscribe()

    // 初始加载数据
    supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        callback(data || [])
      })

    return () => {
      supabase.removeChannel(channel)
    }
  },

  // 添加新待办
  addTodo: async (todo) => {
    return await supabase.from('todos').insert([
      {
        text: todo.text,
        completed: false,
        owner: todo.owner,
        created_at: todo.createdAt
      }
    ])
  },

  // 更新待办状态
  toggleTodo: async (id, completed) => {
    return await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id)
  },

  // 删除待办
  deleteTodo: async (id) => {
    return await supabase
      .from('todos')
      .delete()
      .eq('id', id)
  }
}
