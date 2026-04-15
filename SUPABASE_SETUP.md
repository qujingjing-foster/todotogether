# Supabase 实时同步配置指南

## 步骤 1: 创建 Supabase 项目

1. 访问 [Supabase 控制台](https://supabase.com/dashboard)
2. 点击 "New Project" 创建新项目
3. 输入项目名称（例如：TodoTogether）
4. 设置数据库密码（请记住这个密码）
5. 选择离你最近的区域
6. 点击 "Create new project"

## 步骤 2: 创建数据表

项目创建完成后：

### 表 1: todos（待办事项表）

1. 在左侧菜单中选择 "Table Editor"
2. 点击 "New table" 创建新表
3. 配置表信息：
   - Name: `todos`
   - Description: 待办事项列表

4. 添加以下列：

| Name          | Type       | Default Value | Primary Key |
|---------------|------------|---------------|-------------|
| id            | int8       | -             | ✅ 是       |
| text          | text       | -             | ❌ 否       |
| completed     | bool       | false         | ❌ 否       |
| owner         | text       | -             | ❌ 否       |
| type_id       | int8       | null          | ❌ 否       |
| created_at    | timestamptz| now()         | ❌ 否       |

5. 点击 "Save" 保存表

### 表 2: todo_types（任务类型表）

1. 在 "Table Editor" 中再次点击 "New table"
2. 配置表信息：
   - Name: `todo_types`
   - Description: 任务类型

3. 添加以下列：

| Name          | Type       | Default Value | Primary Key |
|---------------|------------|---------------|-------------|
| id            | int8       | -             | ✅ 是       |
| name          | text       | -             | ❌ 否       |
| color         | text       | -             | ❌ 否       |
| created_at    | timestamptz| now()         | ❌ 否       |

4. 点击 "Save" 保存表

## 步骤 3: 启用 Row Level Security (RLS)

### 为 todos 表配置策略

1. 在 "Table Editor" 中选择 `todos` 表
2. 点击 "Authentication" → "Policies" 标签
3. 点击 "New Policy"
4. 选择 "For full customization"
5. 创建以下策略：

#### 策略 1: 允许所有人读取
- Policy name: `Enable read access for all users`
- Allowed operation: `SELECT`
- USING expression: `true`

#### 策略 2: 允许所有人插入
- Policy name: `Enable insert access for all users`
- Allowed operation: `INSERT`
- WITH CHECK expression: `true`

#### 策略 3: 允许所有人更新
- Policy name: `Enable update access for all users`
- Allowed operation: `UPDATE`
- USING expression: `true`

#### 策略 4: 允许所有人删除
- Policy name: `Enable delete access for all users`
- Allowed operation: `DELETE`
- USING expression: `true`

6. 点击 "Review" 然后 "Save Policy"

### 为 todo_types 表配置策略

1. 在 "Table Editor" 中选择 `todo_types` 表
2. 点击 "Authentication" → "Policies" 标签
3. 点击 "New Policy"
4. 选择 "For full customization"
5. 创建以下策略（和上面一样）：

#### 策略 1: 允许所有人读取
- Policy name: `Enable read access for all users`
- Allowed operation: `SELECT`
- USING expression: `true`

#### 策略 2: 允许所有人插入
- Policy name: `Enable insert access for all users`
- Allowed operation: `INSERT`
- WITH CHECK expression: `true`

#### 策略 3: 允许所有人更新
- Policy name: `Enable update access for all users`
- Allowed operation: `UPDATE`
- USING expression: `true`

#### 策略 4: 允许所有人删除
- Policy name: `Enable delete access for all users`
- Allowed operation: `DELETE`
- USING expression: `true`

## 步骤 4: 启用 Realtime

1. 在左侧菜单中选择 "Database" → "Publications"
2. 点击 "New publication"
3. 配置：
   - Name: `supabase_realtime`
   - 勾选 `todos` 表
   - 勾选 `todo_types` 表
4. 点击 "Create publication"

或者：
1. 在左侧菜单中选择 "Database" → "Replication"
2. 在 "Supabase Realtime" 部分下，确保 `todos` 和 `todo_types` 表都已启用

## 步骤 5: 获取 API 配置

1. 在左侧菜单中选择 "Project Settings" → "API"
2. 复制以下信息：
   - Project URL (例如: `https://abcdefghijklmnopqrst.supabase.co`)
   - Project API keys → `anon public`

## 步骤 6: 更新应用配置

打开 `src/supabase.js` 文件，将配置替换为你的实际配置：

```javascript
const supabaseUrl = 'https://your-project-id.supabase.co'
const supabaseAnonKey = 'your-anon-key'
```

将上面的 URL 和 Key 替换为你在步骤 5 中复制的值。

## 步骤 7: 测试实时同步

1. 刷新应用页面
2. 在两个不同的浏览器窗口或设备中打开应用
3. 在一个窗口中添加/编辑待办事项
4. 观察另一个窗口是否实时更新

## 新功能：任务类型

现在应用支持任务类型功能：

1. **添加类型** - 点击 "⚙️ 管理类型" 按钮
2. **自定义颜色** - 为每个类型选择不同的颜色
3. **选择类型** - 添加待办时可以从下拉菜单选择类型
4. **视觉区分** - 不同类型的任务会有不同颜色的边框和标签

## 完成！

现在你的 Todo Together 应用已经支持跨设备实时同步和任务类型了！

## 部署到 Vercel (可选)

如果你想部署到 Vercel：

1. 将代码推送到 GitHub
2. 访问 [Vercel](https://vercel.com) 并导入你的仓库
3. 在项目设置中添加环境变量：
   - `VITE_SUPABASE_URL`: 你的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase anon key
4. 部署！
