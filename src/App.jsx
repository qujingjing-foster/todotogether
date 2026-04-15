import { useState, useEffect } from 'react'
import './App.css'
import { todoAPI } from './supabase'

const USERS = {
  user1: { id: 'user1', name: '用户 A', color: '#667eea' },
  user2: { id: 'user2', name: '用户 B', color: '#f5576c' }
}

function App() {
  const [currentUser, setCurrentUser] = useState('user1')
  const [todos, setTodos] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [syncStatus, setSyncStatus] = useState('connecting')
  const [supabaseConfigured, setSupabaseConfigured] = useState(false)

  useEffect(() => {
    let timeoutId
    let unsubscribe

    const initSupabase = () => {
      try {
        unsubscribe = todoAPI.subscribeTodos((newTodos) => {
          setTodos(newTodos)
          setSyncStatus('synced')
          setSupabaseConfigured(true)
          if (timeoutId) clearTimeout(timeoutId)
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
      const saved = localStorage.getItem('todotogether-todos')
      setTodos(saved ? JSON.parse(saved) : [])
    }

    timeoutId = setTimeout(() => {
      if (!supabaseConfigured) {
        console.log('Supabase连接超时，使用本地存储')
        if (unsubscribe) unsubscribe()
        fallBackToLocal()
      }
    }, 3000)

    initSupabase()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      localStorage.setItem('todotogether-todos', JSON.stringify(todos))
    }
  }, [todos, supabaseConfigured])

  const addTodo = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const newTodo = {
      text: inputValue.trim(),
      owner: currentUser,
      createdAt: new Date().toISOString()
    }

    if (supabaseConfigured) {
      todoAPI.addTodo(newTodo)
    } else {
      setTodos([{ ...newTodo, id: Date.now() }, ...todos])
    }
    setInputValue('')
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
            <button type="submit" className="add-btn">添加</button>
          </form>

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
                  <span className="todo-text">{todo.text}</span>
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
