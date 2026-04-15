import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ltjttzszsnphkhduakoy.supabase.co'
const supabaseAnonKey = 'sb_publishable_jMzxfh6T56spKiYZy0lUIA_YOJRhVFq'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const todoAPI = {
  getTodos: async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    return data || []
  },

  addTodo: async (todo) => {
    console.log('添加 todo:', todo)
    const insertData = {
      text: todo.text,
      completed: false,
      owner: todo.owner,
      created_at: todo.createdAt
    }
    if (todo.typeId && todo.typeId !== '') {
      const typeIdNum = Number(todo.typeId)
      if (!isNaN(typeIdNum)) {
        insertData.type_id = typeIdNum
      }
    }
    console.log('插入数据:', insertData)
    const result = await supabase.from('todos').insert([insertData])
    console.log('Supabase 完整结果:', result)
    return result
  },

  toggleTodo: async (id, completed) => {
    console.log('切换 todo:', id, completed)
    return await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id)
  },

  deleteTodo: async (id) => {
    console.log('删除 todo:', id)
    return await supabase
      .from('todos')
      .delete()
      .eq('id', id)
  },

  getTypes: async () => {
    const { data } = await supabase
      .from('todo_types')
      .select('*')
      .order('created_at', { ascending: true })
    return data || []
  },

  addType: async (type) => {
    console.log('添加 type:', type)
    return await supabase.from('todo_types').insert([
      {
        name: type.name,
        color: type.color,
        created_at: new Date().toISOString()
      }
    ])
  },

  deleteType: async (id) => {
    console.log('删除 type:', id)
    return await supabase
      .from('todo_types')
      .delete()
      .eq('id', id)
  }
}
