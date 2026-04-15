import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ljttjzzssnpikhduakoy.supabase.co'
const supabaseAnonKey = 'sb_publishable_jMzxfh6T56spKiYZy0lUIA_YOJRhVFq'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const todoAPI = {
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

  addTodo: async (todo) => {
    return await supabase.from('todos').insert([
      {
        text: todo.text,
        completed: false,
        owner: todo.owner,
        type_id: todo.typeId || null,
        created_at: todo.createdAt
      }
    ])
  },

  toggleTodo: async (id, completed) => {
    return await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id)
  },

  deleteTodo: async (id) => {
    return await supabase
      .from('todos')
      .delete()
      .eq('id', id)
  },

  subscribeTypes: (callback) => {
    const channel = supabase
      .channel('types-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_types'
        },
        async () => {
          const { data } = await supabase
            .from('todo_types')
            .select('*')
            .order('created_at', { ascending: true })
          callback(data || [])
        }
      )
      .subscribe()

    supabase
      .from('todo_types')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        callback(data || [])
      })

    return () => {
      supabase.removeChannel(channel)
    }
  },

  addType: async (type) => {
    return await supabase.from('todo_types').insert([
      {
        name: type.name,
        color: type.color,
        created_at: new Date().toISOString()
      }
    ])
  },

  deleteType: async (id) => {
    return await supabase
      .from('todo_types')
      .delete()
      .eq('id', id)
  }
}
