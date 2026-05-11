# NEON_BLOG // 赛博空间

赛博朋克风格的全栈博客系统，Node.js + SQL.js + JWT 认证。

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Express |
| 数据库 | SQL.js (SQLite) |
| 认证 | JWT + bcryptjs |
| 前端 | 原生 JavaScript ES Modules + CSS3 |

## 快速启动

```bash
npm install
npm start
```

浏览器打开 http://localhost:3000

## 角色体系

| 角色 | 权限 | 预置账号 |
|------|------|---------|
| L1 超级管理员 | 全部权限 + 创建L2管理员 | `superadmin` / `admin123` |
| L2 管理员 | 审核文章 + 管理内容 + 生成邀请码 | `admin2` / `admin456` |
| VIP 用户 | 查看全部文章(含VIP专属) | `vipuser` / `vip123` |
| 普通用户 | 仅看公开文章 | `normal` / `user123` |

## 功能

- 文章 CRUD + 标签筛选 + 全文搜索
- VIP 专属文章 + 邀请码注册（一码一用）
- 二级管理员体系（L1 可创建 L2）
- 文章审核流程（待审 → 审核通过/拒绝）
- 项目作品集管理
- 3D 卡片翻转页面过渡动画
- 赛博朋克霓虹灯视觉效果
- 数据持久化（每30秒自动保存到 SQLite 文件）

## API

```
POST   /api/auth/login         登录
POST   /api/auth/register      注册（VIP需邀请码）
POST   /api/auth/create-admin  创建L2管理员（L1专属）
GET    /api/articles           文章列表（按角色过滤）
POST   /api/articles           创建文章
PUT    /api/articles/:id       更新文章
DELETE /api/articles/:id       删除文章
POST   /api/articles/review/:id/approve  审核通过
POST   /api/articles/review/:id/reject   审核拒绝
GET    /api/invites            邀请码列表
POST   /api/invites            生成邀请码
GET    /api/search?q=          全文搜索
```

## 项目结构

```
├── server.js              # Express 入口
├── db/database.js         # SQL.js 初始化 + Schema + 种子数据
├── middleware/auth.js     # JWT 认证中间件
├── routes/
│   ├── auth.js            # 认证路由
│   ├── articles.js        # 文章 CRUD + 审核
│   ├── projects.js        # 项目 CRUD
│   └── invites.js         # 邀请码管理
└── public/                # 前端
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js         # API 请求封装
        ├── main.js        # 路由 + 认证状态
        └── pages/         # 页面组件
```
