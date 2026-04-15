import { useState, useEffect } from 'react'
import './App.css'
import { supabase, todoAPI } from './supabase'

const USERS = {
  user1: { id: 'user1', name: '用户 A', color: '#667eea' },
  user2: { id: 'user2', name: '用户 B', color: '#f5576c' }
}

const DEFAULT_TYPES = [
  { id: 1, name: '工作', color: '#667eea' },
  { id: 2, name: '生活', color: '#10b981' },
  { id: 3, name: '学习', color: '#f59e0b' }
]

function App() {
  const [currentUser, setCurrentUser] = useState('user1')
  const [todos, setTodos] = useState(() => {
    const savedTodos = localStorage.getItem('todotogether-todos')
    return savedTodos ? JSON.parse(savedTodos) : []
  })
  const [types, setTypes] = useState(() => {
    const savedTypes = localStorage.getItem('todotogether-types')
    if (savedTypes) {
      const parsed = JSON.parse(savedTypes)
      const merged = [...DEFAULT_TYPES]
      parsed.forEach(t => {
        const exists = merged.some(m => m.id === t.id || m.name === t.name)
        if (!exists) {
          merged.push(t)
        }
      })
      return merged
    }
    return DEFAULT_TYPES
  })
  const [inputValue, setInputValue] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState(null)
  const [syncStatus, setSyncStatus] = useState('connecting')
  const [supabaseConfigured, setSupabaseConfigured] = useState(false)
  const [showTypeManager, setShowTypeManager] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState('#667eea')

  const refreshData = async () => {
    try {
      console.log('刷新数据...')
      
      const todosData = await todoAPI.getTodos()
      const typesData = await todoAPI.getTypes()

      setTodos(todosData)
      
      const mergedTypes = [...DEFAULT_TYPES]
      if (typesData && typesData.length > 0) {
        typesData.forEach(dbType => {
          const exists = mergedTypes.some(t => t.id === dbType.id || t.name === dbType.name)
          if (!exists) {
            mergedTypes.push(dbType)
          }
        })
      }
      setTypes(mergedTypes)
      
      setSupabaseConfigured(true)
      setSyncStatus('synced')
      console.log('数据刷新成功')
      return true
    } catch (error) {
      console.error('刷新数据失败:', error)
      return false
    }
  }

  const fallBackToLocal = () => {
    console.log('切换到本地存储模式')
    setSupabaseConfigured(false)
    setSyncStatus('error')
    const savedTodos = localStorage.getItem('todotogether-todos')
    const savedTypes = localStorage.getItem('todotogether-types')
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos))
    }
    if (savedTypes) {
      setTypes(JSON.parse(savedTypes))
    } else {
      setTypes(DEFAULT_TYPES)
    }
  }

  useEffect(() => {
    let isMounted = true
    let pollInterval = null

    const init = async () => {
      const success = await refreshData()
      if (!success && isMounted) {
        fallBackToLocal()
      }
    }

    init()
    
    pollInterval = setInterval(async () => {
      if (supabaseConfigured) {
        await refreshData()
      }
    }, 5000)

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      localStorage.setItem('todotogether-todos', JSON.stringify(todos))
      localStorage.setItem('todotogether-types', JSON.stringify(types))
    }
  }, [todos, types, supabaseConfigured])

  const addTodo = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    console.log('添加待办 - selectedTypeId:', selectedTypeId, '类型:', typeof selectedTypeId)
    console.log('添加待办:', { text: inputValue.trim(), typeId: selectedTypeId, supabaseConfigured })

    const newTodo = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      owner: currentUser,
      type_id: selectedTypeId,
      typeId: selectedTypeId,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }

    setTodos(prev => [newTodo, ...prev])
    setInputValue('')
    setSelectedTypeId(null)

    if (supabaseConfigured) {
      try {
        console.log('发送到 Supabase...')
        const result = await todoAPI.addTodo(newTodo)
        console.log('Supabase 添加结果:', result)
      } catch (error) {
        console.error('添加到 Supabase 失败:', error)
      }
    }
  }

  const toggleTodo = async (id, currentCompleted) => {
    console.log('切换任务 - id:', id, '当前状态:', currentCompleted, 'supabaseConfigured:', supabaseConfigured)

    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !currentCompleted } : todo
    ))

    if (supabaseConfigured) {
      try {
        console.log('发送到 Supabase...')
        const result = await todoAPI.toggleTodo(id, !currentCompleted)
        console.log('Supabase 切换结果:', result)
      } catch (error) {
        console.error('切换到 Supabase 失败:', error)
      }
    }
  }

  const deleteTodo = async (id) => {
    console.log('删除任务 - id:', id, 'supabaseConfigured:', supabaseConfigured)

    setTodos(todos.filter(todo => todo.id !== id))

    if (supabaseConfigured) {
      try {
        console.log('发送到 Supabase...')
        const result = await todoAPI.deleteTodo(id)
        console.log('Supabase 删除结果:', result)
      } catch (error) {
        console.error('删除到 Supabase 失败:', error)
      }
    }
  }

  const addType = async (e) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    const name = newTypeName.trim()
    console.log('添加类型:', { name, color: newTypeColor })

    const exists = types.some(t => t.name === name)
    if (exists) {
      console.log('类型已存在，跳过')
      setNewTypeName('')
      return
    }

    const newType = {
      id: Date.now(),
      name,
      color: newTypeColor
    }

    setTypes([...types, newType])
    setNewTypeName('')
    setNewTypeColor('#667eea')

    if (supabaseConfigured) {
      try {
        console.log('发送到 Supabase...')
        await todoAPI.addType(newType)
      } catch (error) {
        console.error('添加类型到 Supabase 失败:', error)
      }
    }
  }

  const deleteType = async (id) => {
    console.log('删除类型:', id)

    const isDefaultType = DEFAULT_TYPES.some(t => String(t.id) === String(id))
    if (isDefaultType) {
      console.log('不能删除默认类型')
      alert('默认类型不能删除！')
      return
    }

    setTypes(types.filter(t => String(t.id) !== String(id)))

    if (supabaseConfigured) {
      try {
        console.log('从 Supabase 删除...')
        await todoAPI.deleteType(id)
      } catch (error) {
        console.error('从 Supabase 删除类型失败:', error)
      }
    }
  }

  const getTypeColor = (typeId) => {
    if (!typeId) return '#e2e8f0'
    console.log('查找颜色 - typeId:', typeId, 'types:', types)
    const type = types.find(t => {
      const match = String(t.id) === String(typeId)
      console.log('比较:', t.id, typeId, match)
      return match
    })
    console.log('找到的类型:', type)
    return type ? type.color : '#e2e8f0'
  }

  const getTypeName = (typeId) => {
    if (!typeId) return ''
    const type = types.find(t => String(t.id) === String(typeId))
    return type ? type.name : ''
  }

  const getUserTodos = (userId) => {
    return todos.filter(todo => todo.owner === userId)
  }

  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    pending: todos.filter(t => !t.completed).length
  }

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'connecting':
        return '🔄 正在连接...'
      case 'connected':
        return '🔄 已连接'
      case 'synced':
        return '✅ 实时同步中'
      case 'error':
        return '⚠️ 离线模式'
      default:
        return ''
    }
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">Todo Together</h1>
          <p className="subtitle">双人共享待办清单</p>
          <div className="sync-status">
            <span className={syncStatus === 'error' ? 'sync-error' : ''}>
              {getSyncStatusText()}
            </span>
          </div>
        </div>

        {!supabaseConfigured && (
          <div className="config-notice">
            <p>⚠️ 请在 <code>src/supabase.js</code> 中配置你的 Supabase 项目以启用实时同步</p>
            <p className="config-hint">当前使用本地存储模式</p>
          </div>
        )}

        <div className="user-section">
          <div className="user-switcher">
            <button
              className={`user-btn user1 ${currentUser === 'user1' ? 'active' : ''}`}
              onClick={() => setCurrentUser('user1')}
            >
              <span className="user-name">{USERS.user1.name}</span>
              <span className="task-count">{getUserTodos('user1').length} 个待办</span>
            </button>
            <button
              className={`user-btn user2 ${currentUser === 'user2' ? 'active' : ''}`}
              onClick={() => setCurrentUser('user2')}
            >
              <span className="user-name">{USERS.user2.name}</span>
              <span className="task-count">{getUserTodos('user2').length} 个待办</span>
            </button>
          </div>
        </div>

        <div className="todo-section">
          <form className="add-form" onSubmit={addTodo}>
            <input
              type="text"
              className="add-input"
              placeholder={`${USERS[currentUser].name}，添加新的待办事项...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <select
              className="type-select"
              value={selectedTypeId || ''}
              onChange={(e) => {
                console.log('类型选择改变:', e.target.value, '当前 types:', types)
                setSelectedTypeId(e.target.value || null)
              }}
            >
              <option value="">无类型</option>
              {types.map(type => {
                console.log('渲染类型选项:', type)
                return (
                  <option key={type.id} value={type.id}>{type.name}</option>
                )
              })}
            </select>
            <button type="submit" className="add-btn">添加</button>
          </form>

          <div className="type-manager-toggle">
            <button
              className="type-manager-btn"
              onClick={() => setShowTypeManager(!showTypeManager)}
            >
              {showTypeManager ? '✕ 关闭类型管理' : '⚙️ 管理类型'}
            </button>
          </div>

          {showTypeManager && (
            <div className="type-manager">
              <h3 className="type-manager-title">类型管理</h3>
              <form className="type-add-form" onSubmit={addType}>
                <input
                  type="text"
                  className="type-name-input"
                  placeholder="类型名称"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
                <input
                  type="color"
                  className="type-color-input"
                  value={newTypeColor}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                />
                <button type="submit" className="type-add-btn">添加</button>
              </form>
              <div className="types-list">
                {types.map(type => (
                  <div key={type.id} className="type-item">
                    <div
                      className="type-color-preview"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="type-name">{type.name}</span>
                    <button
                      className="type-delete-btn"
                      onClick={() => deleteType(type.id)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="todo-list">
            {todos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <p className="empty-text">还没有待办事项，来添加第一个吧！</p>
              </div>
            ) : (
              <>
                {[...todos].filter(t => !t.completed).map(todo => {
                  console.log('渲染待办 todo:', todo)
                  return (
                  <div
                    key={todo.id}
                    className={`todo-item ${todo.completed ? 'completed' : ''}`}
                    style={{
                      borderLeft: `4px solid ${getTypeColor(todo.type_id || todo.typeId)}`
                    }}
                  >
                  <button
                    className={`checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="checkmark-svg">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div className="todo-content">
                    <span className="todo-text">{todo.text}</span>
                    {(todo.type_id || todo.typeId) && (
                      <span
                        className="todo-type-tag"
                        style={{ backgroundColor: getTypeColor(todo.type_id || todo.typeId) }}
                      >
                        {getTypeName(todo.type_id || todo.typeId)}
                      </span>
                    )}
                  </div>
                  <div className="todo-meta">
                    <span className={`todo-owner ${todo.owner}`}>
                      {USERS[todo.owner].name}
                    </span>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => deleteTodo(todo.id)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
                )
              })}

              {todos.filter(t => !t.completed).length > 0 && todos.filter(t => t.completed).length > 0 && (
                <div className="section-divider">
                  <span className="divider-text">已完成</span>
                </div>
              )}

              {[...todos].filter(t => t.completed).map(todo => {
                console.log('渲染已完成 todo:', todo)
                return (
                  <div
                    key={todo.id}
                    className={`todo-item ${todo.completed ? 'completed' : ''}`}
                    style={{
                      borderLeft: `4px solid ${getTypeColor(todo.type_id || todo.typeId)}`
                    }}
                  >
                  <button
                    className={`checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="checkmark-svg">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div className="todo-content">
                    <span className="todo-text">{todo.text}</span>
                    {(todo.type_id || todo.typeId) && (
                      <span
                        className="todo-type-tag"
                        style={{ backgroundColor: getTypeColor(todo.type_id || todo.typeId) }}
                      >
                        {getTypeName(todo.type_id || todo.typeId)}
                      </span>
                    )}
                  </div>
                  <div className="todo-meta">
                    <span className={`todo-owner ${todo.owner}`}>
                      {USERS[todo.owner].name}
                    </span>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => deleteTodo(todo.id)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
                )
              })}
              </>
            )}
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总计</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">已完成</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">待完成</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
