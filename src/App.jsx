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
  const [newTypeColor, setNewTypeColor] = useState('#667eea')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingSyncCount, setPendingSyncCount] = useState(getOfflineQueue().length)
  const [isSyncing, setIsSyncing] = useState(false)

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

  const syncOfflineOperations = async () => {
    const queue = getOfflineQueue()
    if (queue.length === 0 || !supabaseConfigured || !isOnline) {
      return
    }

    console.log('开始同步离线操作，共', queue.length, '个')
    setIsSyncing(true)
    setSyncStatus('synced')

    let successCount = 0
    const failedOperations = []

    for (const operation of queue) {
      try {
        console.log('同步操作:', operation)
        
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
        console.error('同步操作失败:', operation, error)
        failedOperations.push(operation)
      }
    }

    if (failedOperations.length > 0) {
      saveOfflineQueue(failedOperations)
    }

    setPendingSyncCount(getOfflineQueue().length)
    setIsSyncing(false)
    
    if (successCount > 0) {
      console.log('同步完成，成功:', successCount, '失败:', failedOperations.length)
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
      console.log('网络已连接')
      setIsOnline(true)
      if (supabaseConfigured) {
        syncOfflineOperations()
      }
    }

    const handleOffline = () => {
      console.log('网络已断开')
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

    console.log('添加待办 - selectedTypeId:', selectedTypeId, '类型:', typeof selectedTypeId)
    console.log('添加待办:', { text: inputValue.trim(), typeId: selectedTypeId, supabaseConfigured, isOnline })

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
        console.log('发送到 Supabase...')
        const result = await todoAPI.addTodo(newTodo)
        console.log('Supabase 添加结果:', result)
      } catch (error) {
        console.error('添加到 Supabase 失败，加入离线队列:', error)
        addToOfflineQueue({ type: 'addTodo', data: newTodo })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      console.log('离线，添加到离线队列')
      addToOfflineQueue({ type: 'addTodo', data: newTodo })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const toggleTodo = async (id, currentCompleted) => {
    console.log('切换任务 - id:', id, '当前状态:', currentCompleted, 'supabaseConfigured:', supabaseConfigured, 'isOnline:', isOnline)

    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !currentCompleted } : todo
    ))

    if (supabaseConfigured && isOnline) {
      try {
        console.log('发送到 Supabase...')
        const result = await todoAPI.toggleTodo(id, !currentCompleted)
        console.log('Supabase 切换结果:', result)
      } catch (error) {
        console.error('切换到 Supabase 失败，加入离线队列:', error)
        addToOfflineQueue({ type: 'toggleTodo', data: { id, completed: !currentCompleted } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      console.log('离线，添加到离线队列')
      addToOfflineQueue({ type: 'toggleTodo', data: { id, completed: !currentCompleted } })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const deleteTodo = async (id) => {
    console.log('删除任务 - id:', id, 'supabaseConfigured:', supabaseConfigured, 'isOnline:', isOnline)

    setTodos(todos.filter(todo => todo.id !== id))

    if (supabaseConfigured && isOnline) {
      try {
        console.log('发送到 Supabase...')
        const result = await todoAPI.deleteTodo(id)
        console.log('Supabase 删除结果:', result)
      } catch (error) {
        console.error('删除到 Supabase 失败，加入离线队列:', error)
        addToOfflineQueue({ type: 'deleteTodo', data: { id } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      console.log('离线，添加到离线队列')
      addToOfflineQueue({ type: 'deleteTodo', data: { id } })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const addType = async (e) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    const name = newTypeName.trim()
    console.log('添加类型:', { name, color: newTypeColor, supabaseConfigured, isOnline })

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

    if (supabaseConfigured && isOnline) {
      try {
        console.log('发送到 Supabase...')
        await todoAPI.addType(newType)
      } catch (error) {
        console.error('添加类型到 Supabase 失败，加入离线队列:', error)
        addToOfflineQueue({ type: 'addType', data: newType })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      console.log('离线，添加到离线队列')
      addToOfflineQueue({ type: 'addType', data: newType })
      setPendingSyncCount(getOfflineQueue().length)
    }
  }

  const deleteType = async (id) => {
    console.log('删除类型:', id, 'supabaseConfigured:', supabaseConfigured, 'isOnline:', isOnline)

    const isDefaultType = DEFAULT_TYPES.some(t => String(t.id) === String(id))
    if (isDefaultType) {
      console.log('不能删除默认类型')
      alert('默认类型不能删除！')
      return
    }

    setTypes(types.filter(t => String(t.id) !== String(id)))

    if (supabaseConfigured && isOnline) {
      try {
        console.log('从 Supabase 删除...')
        await todoAPI.deleteType(id)
      } catch (error) {
        console.error('从 Supabase 删除类型失败，加入离线队列:', error)
        addToOfflineQueue({ type: 'deleteType', data: { id } })
        setPendingSyncCount(getOfflineQueue().length)
      }
    } else if (supabaseConfigured) {
      console.log('离线，添加到离线队列')
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
      case 'connecting':
        statusText = '🔄 正在连接...'
        break
      case 'connected':
        statusText = '🔄 已连接'
        break
      case 'synced':
        statusText = '✅ 实时同步中'
        break
      case 'error':
        statusText = '⚠️ 离线模式'
        break
      default:
        statusText = ''
    }
    
    if (pendingSyncCount > 0) {
      statusText += ` (${pendingSyncCount} 个待同步)`
    }
    
    if (!isOnline) {
      statusText = '📵 离线模式' + (pendingSyncCount > 0 ? ` (${pendingSyncCount} 个待同步)` : '')
    }
    
    return statusText
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">Todo Together</h1>
          <p className="subtitle">双人共享待办清单</p>
          <div className="sync-status">
            <span className={!isOnline ? 'sync-error' : ''}>
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
                      disabled={DEFAULT_TYPES.some(t => String(t.id) === String(type.id))}
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
                {[...todos].filter(t => !t.completed).map(todo => (
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
                ))}

                {todos.filter(t => !t.completed).length > 0 && todos.filter(t => t.completed).length > 0 && (
                  <div className="section-divider">
                    <span className="divider-text">已完成</span>
                  </div>
                )}

                {[...todos].filter(t => t.completed).map(todo => (
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
                ))}
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
