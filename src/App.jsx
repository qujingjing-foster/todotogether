import { useState, useEffect } from 'react'
import './App.css'
import { todoAPI } from './supabase'

const USERS = {
  user1: { id: 'user1', name: '用户 A', color: '#667eea' },
  user2: { id: 'user2', name: '用户 B', color: '#f5576c' }
}

const DEFAULT_TYPES = [
  { id: 'default', name: '工作', color: '#667eea' },
  { id: 'default2', name: '生活', color: '#10b981' },
  { id: 'default3', name: '学习', color: '#f59e0b' }
]

function App() {
  const [currentUser, setCurrentUser] = useState('user1')
  const [todos, setTodos] = useState([])
  const [types, setTypes] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState(null)
  const [syncStatus, setSyncStatus] = useState('connecting')
  const [supabaseConfigured, setSupabaseConfigured] = useState(false)
  const [showTypeManager, setShowTypeManager] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState('#667eea')

  useEffect(() => {
    let timeoutId
    let unsubscribeTodos
    let unsubscribeTypes

    const initSupabase = () => {
      try {
        unsubscribeTodos = todoAPI.subscribeTodos((newTodos) => {
          setTodos(newTodos)
          setSyncStatus('synced')
          setSupabaseConfigured(true)
          if (timeoutId) clearTimeout(timeoutId)
        })

        unsubscribeTypes = todoAPI.subscribeTypes((newTypes) => {
          setTypes(newTypes.length > 0 ? newTypes : DEFAULT_TYPES.map((t, i) => ({ ...t, id: i })))
        })

        setSyncStatus('connected')
      } catch (error) {
        console.error('Supabase连接错误:', error)
        fallBackToLocal()
      }
    }

    const fallBackToLocal = () => {
      setSupabaseConfigured(false)
      setSyncStatus('error')
      const savedTodos = localStorage.getItem('todotogether-todos')
      const savedTypes = localStorage.getItem('todotogether-types')
      setTodos(savedTodos ? JSON.parse(savedTodos) : [])
      setTypes(savedTypes ? JSON.parse(savedTypes) : DEFAULT_TYPES)
    }

    timeoutId = setTimeout(() => {
      if (!supabaseConfigured) {
        console.log('Supabase连接超时，使用本地存储')
        if (unsubscribeTodos) unsubscribeTodos()
        if (unsubscribeTypes) unsubscribeTypes()
        fallBackToLocal()
      }
    }, 3000)

    initSupabase()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (unsubscribeTodos) unsubscribeTodos()
      if (unsubscribeTypes) unsubscribeTypes()
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      localStorage.setItem('todotogether-todos', JSON.stringify(todos))
      localStorage.setItem('todotogether-types', JSON.stringify(types))
    }
  }, [todos, types, supabaseConfigured])

  const addTodo = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const newTodo = {
      text: inputValue.trim(),
      owner: currentUser,
      typeId: selectedTypeId,
      createdAt: new Date().toISOString()
    }

    if (supabaseConfigured) {
      todoAPI.addTodo(newTodo)
    } else {
      setTodos([{ ...newTodo, id: Date.now() }, ...todos])
    }
    setInputValue('')
    setSelectedTypeId(null)
  }

  const toggleTodo = (id, currentCompleted) => {
    if (supabaseConfigured) {
      todoAPI.toggleTodo(id, !currentCompleted)
    } else {
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ))
    }
  }

  const deleteTodo = (id) => {
    if (supabaseConfigured) {
      todoAPI.deleteTodo(id)
    } else {
      setTodos(todos.filter(todo => todo.id !== id))
    }
  }

  const addType = (e) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    const newType = {
      name: newTypeName.trim(),
      color: newTypeColor
    }

    if (supabaseConfigured) {
      todoAPI.addType(newType)
    } else {
      setTypes([...types, { ...newType, id: Date.now() }])
    }
    setNewTypeName('')
    setNewTypeColor('#667eea')
  }

  const deleteType = (id) => {
    if (supabaseConfigured) {
      todoAPI.deleteType(id)
    } else {
      setTypes(types.filter(t => t.id !== id))
    }
  }

  const getTypeColor = (typeId) => {
    const type = types.find(t => t.id === typeId)
    return type ? type.color : '#e2e8f0'
  }

  const getTypeName = (typeId) => {
    const type = types.find(t => t.id === typeId)
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
              onChange={(e) => setSelectedTypeId(e.target.value || null)}
            >
              <option value="">无类型</option>
              {types.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
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
              todos.map(todo => (
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
              ))
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
