import { useState, useEffect } from 'react'
import './App.css'
import { supabase, todoAPI } from './supabase'

const USERS = {
  user1: { id: 'user1', name: '用户 A', color: '#4B5ED7' },
  user2: { id: 'user2', name: '用户 B', color: '#D7634B' }
}

const DEFAULT_TYPES = [
  { id: 1, name: '工作', color: '#4B5ED7' },
  { id: 2, name: '生活', color: '#10B981' },
  { id: 3, name: '学习', color: '#F59E0B' }
]

const getOfflineQueue = () => {
  const saved = localStorage.getItem('todotogether-offline-queue')
  return saved ? JSON.parse(saved) : []
}

const saveOfflineQueue = (queue) => {
  localStorage.setItem('todotogether-offline-queue', JSON.stringify(queue))
}

const addToOfflineQueue = (operation) => {
  const queue = getOfflineQueue()
  queue.push({
    ...operation,
    id: Date.now(),
    timestamp: new Date().toISOString()
  })
  saveOfflineQueue(queue)
}

const removeFromOfflineQueue = (operationId) => {
  const queue = getOfflineQueue()
  const filtered = queue.filter(op => op.id !== operationId)
  saveOfflineQueue(filtered)
}

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
  const [newTypeColor, setNewTypeColor] = useState('#4B5ED7')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSyncCount, setPendingSyncCount] = useState(getOfflineQueue().length)
  const [isSyncing, setIsSyncing] = useState(false)

  const refreshData = async () => {
    try {
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
      return true
    } catch (error) {
      return false
    }
  }

  const fallBackToLocal = () => {
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

  const syncOfflineOperations = async () => {
    const queue = getOfflineQueue()
    if (queue.length === 0 || !supabaseConfigured || !isOnline) {
      return
    }

    setIsSyncing(true)
    setSyncStatus('synced')

    let successCount = 0
    const failedOperations = []

    for (const operation of queue) {
      try {
        switch (operation.type) {
          case 'addTodo':
            await todoAPI.addTodo(operation.data)
            break
          case 'toggleTodo':
            await todoAPI.toggleTodo(operation.data.id, operation.data.completed)
            break
          case 'deleteTodo':
            await todoAPI.deleteTodo(operation.data.id)
            break
          case 'addType':
            await todoAPI.addType(operation.data)
            break
          case 'deleteType':
            await todoAPI.deleteType(operation.data.id)
            break
        }

        removeFromOfflineQueue(operation.id)
        successCount++
      } catch (error) {
        failedOperations.push(operation)
      }
    }

    if (failedOperations.length > 0) {
      saveOfflineQueue(failedOperations)
    }

    setPendingSyncCount(getOfflineQueue().length)
    setIsSyncing(false)
    
    if (successCount > 0) {
      await refreshData()
    }
  }

  useEffect(() => {
    let isMounted = true
    let pollInterval = null

    const init = async () => {
      const success = await refreshData()
      if (!success && isMounted) {
        fallBackToLocal()
      } else {
        await syncOfflineOperations()
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      if (supabaseConfigured) {
        syncOfflineOperations()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    init()
    
    pollInterval = setInterval(async () => {
      if (supabaseConfigured && isOnline) {
        await refreshData()
      }
    }, 5000)

    return () => {
      isMounted = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      localStorage.setItem('todotogether-todos', JSON.stringify(todos))
      localStorage.setItem('todotogether-types', JSON.stringify(types))
    }
  }, [todos, types, supabaseConfigured])

  useEffect(() => {
    if (isOnline && supabaseConfigured && !isSyncing) {
      const timer = setTimeout(() => {
        syncOfflineOperations()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [pendingSyncCount, isOnline, supabaseConfigured, isSyncing])

  const addTodo = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

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

    if (supabaseConfigured && isOnline) {
      try {
        await todoAPI.addTodo(newTodo)
      } catch (error) {
        addToOfflineQueue({ type: 'addTodo', data: newTodo })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      addToOfflineQueue({ type: 'addTodo', data: newTodo })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const toggleTodo = async (id, currentCompleted) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !currentCompleted } : todo
    ))

    if (supabaseConfigured && isOnline) {
      try {
        await todoAPI.toggleTodo(id, !currentCompleted)
      } catch (error) {
        addToOfflineQueue({ type: 'toggleTodo', data: { id, completed: !currentCompleted } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      addToOfflineQueue({ type: 'toggleTodo', data: { id, completed: !currentCompleted } })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const deleteTodo = async (id) => {
    setTodos(todos.filter(todo => todo.id !== id))

    if (supabaseConfigured && isOnline) {
      try {
        await todoAPI.deleteTodo(id)
      } catch (error) {
        addToOfflineQueue({ type: 'deleteTodo', data: { id } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      addToOfflineQueue({ type: 'deleteTodo', data: { id } })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const addType = async (e) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    const name = newTypeName.trim()
    const exists = types.some(t => t.name === name)
    if (exists) {
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
    setNewTypeColor('#4B5ED7')

    if (supabaseConfigured && isOnline) {
      try {
        await todoAPI.addType(newType)
      } catch (error) {
        addToOfflineQueue({ type: 'addType', data: newType })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      addToOfflineQueue({ type: 'addType', data: newType })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const deleteType = async (id) => {
    const isDefaultType = DEFAULT_TYPES.some(t => String(t.id) === String(id))
    if (isDefaultType) {
      alert('默认类型不能删除！')
      return
    }

    setTypes(types.filter(t => String(t.id) !== String(id)))

    if (supabaseConfigured && isOnline) {
      try {
        await todoAPI.deleteType(id)
      } catch (error) {
        addToOfflineQueue({ type: 'deleteType', data: { id } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      addToOfflineQueue({ type: 'deleteType', data: { id } })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const getTypeColor = (typeId) => {
    if (!typeId) return '#e2e8f0'
    const type = types.find(t => String(t.id) === String(typeId))
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
    let statusText = ''
    switch (syncStatus) {
      case 'connecting': statusText = '正在连接...'; break
      case 'synced': statusText = '实时同步中'; break
      case 'error': statusText = '离线模式'; break
      default: statusText = ''
    }
    
    if (pendingSyncCount > 0) {
      statusText += ` (${pendingSyncCount} 待同步)`
    }
    
    if (!isOnline) {
      statusText = '离线模式' + (pendingSyncCount > 0 ? ` (${pendingSyncCount} 待同步)` : '')
    }
    
    return statusText
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">Todo Together</h1>
          <p className="subtitle">共享每一刻，同步每一事</p>
          <div className="sync-status">
            <span className={!isOnline ? 'sync-error' : ''}>
              {isOnline ? '● ' : '○ '}{getSyncStatusText()}
            </span>
          </div>
        </div>

        <div className="user-section">
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

        <div className="todo-section">
          <form className="add-form" onSubmit={addTodo}>
            <input
              type="text"
              className="add-input"
              placeholder={`在这里添加任务...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <select
              className="type-select"
              value={selectedTypeId || ''}
              onChange={(e) => setSelectedTypeId(e.target.value || null)}
            >
              <option value="">选择类型</option>
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
              {showTypeManager ? '✕ 关闭管理' : '⚙️ 任务类型'}
            </button>
          </div>

          {showTypeManager && (
            <div className="type-manager">
              <h3 className="type-manager-title">管理类型</h3>
              <form className="type-add-form" onSubmit={addType}>
                <input
                  type="text"
                  className="type-name-input"
                  placeholder="新类型名称"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
                <input
                  type="color"
                  className="type-color-input"
                  value={newTypeColor}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                />
                <button type="submit" className="type-add-btn">创建</button>
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
                      disabled={DEFAULT_TYPES.some(t => String(t.id) === String(type.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="todo-list">
            {todos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛋️</div>
                <p className="empty-text">享受当下，目前没有任何待办事项</p>
              </div>
            ) : (
              <>
                {[...todos].filter(t => !t.completed).map(todo => (
                  <div
                    key={todo.id}
                    className="todo-item"
                    style={{ borderLeft: `6px solid ${getTypeColor(todo.type_id || todo.typeId)}` }}
                  >
                    <button
                      className={`checkbox ${todo.completed ? 'checked' : ''}`}
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                    >
                      {todo.completed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
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
                      <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>✕</button>
                    </div>
                  </div>
                ))}

                {todos.filter(t => !t.completed).length > 0 && todos.filter(t => t.completed).length > 0 && (
                  <div className="section-divider">
                    <span className="divider-text">已完成</span>
                  </div>
                )}

                {[...todos].filter(t => t.completed).map(todo => (
                  <div
                    key={todo.id}
                    className="todo-item completed"
                    style={{ borderLeft: `6px solid ${getTypeColor(todo.type_id || todo.typeId)}` }}
                  >
                    <button
                      className={`checkbox ${todo.completed ? 'checked' : ''}`}
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
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
                      <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">任务总数</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">已达成</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">进行中</div>
        </div>
      </div>
    </div>
  )
}

export default App
