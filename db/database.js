const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'neondb.sqlite');

let dbInstance = null;
let autoSaveInterval = null;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(buffer);
    ensureSchema(dbInstance);
  } else {
    dbInstance = new SQL.Database();
    createSchema(dbInstance);
    seedData(dbInstance);
    saveDb();
  }

  autoSaveInterval = setInterval(saveDb, 30000);
  return dbInstance;
}

function createSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('superadmin','admin','vip','user')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT (date('now')),
      read_time TEXT NOT NULL DEFAULT '5 min',
      icon TEXT DEFAULT '⬡',
      visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','vip')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),
      author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      tech TEXT NOT NULL DEFAULT '[]',
      icon TEXT DEFAULT '⬡',
      link TEXT DEFAULT '#',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER,
      used_by INTEGER,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      used_at TEXT
    )
  `);
}

function ensureSchema(db) {
  try { db.run('ALTER TABLE articles ADD COLUMN visibility TEXT NOT NULL DEFAULT "public"'); } catch {}
  try { db.run('ALTER TABLE articles ADD COLUMN status TEXT NOT NULL DEFAULT "approved"'); } catch {}
  try { db.run('ALTER TABLE articles ADD COLUMN author_id INTEGER'); } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('superadmin','admin','vip','user')),
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        created_by INTEGER,
        used_by INTEGER,
        is_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        used_at TEXT
      )
    `);
  } catch {}
  // Migrate existing admin role to superadmin
  try {
    db.run("UPDATE users SET role = 'superadmin' WHERE role = 'admin'");
  } catch {}
}

function seedData(db) {
  const salt = bcrypt.genSaltSync(10);

  // Users
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['superadmin', bcrypt.hashSync('admin123', salt), 'superadmin']);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin2', bcrypt.hashSync('admin456', salt), 'admin']);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['vipuser', bcrypt.hashSync('vip123', salt), 'vip']);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['normal', bcrypt.hashSync('user123', salt), 'user']);

  // Invite codes
  db.run("INSERT INTO invite_codes (code, created_by, is_used) VALUES (?, 1, 0)", ['VIP2024-XYZ']);
  db.run("INSERT INTO invite_codes (code, created_by, is_used) VALUES (?, 1, 0)", ['NEON-8888']);
  db.run("INSERT INTO invite_codes (code, created_by, is_used, used_by, used_at) VALUES (?, 1, 1, 3, datetime('now'))", ['USED-TEST']);

  const seedArticles = [
    {
      title: '量子计算入门：从叠加态到量子门',
      excerpt: '探索量子计算的核心概念，理解量子比特如何通过叠加与纠缠实现超越经典计算的算力...',
      content: `<p>量子计算代表着计算范式的根本性变革。与传统计算机使用0和1的比特不同，量子计算机使用量子比特（qubit），它可以同时处于0和1的叠加状态。</p>
<h2>量子叠加与纠缠</h2>
<p>叠加态使得一个量子比特能够同时表示0和1，这意味着n个量子比特可以同时表示2^n个状态。而量子纠缠则允许量子比特之间存在非局域的关联，这种关联是量子加速的核心来源之一。</p>
<p>想像一下，你有一枚正在旋转的硬币——在它停下来之前，它既不是正面也不是反面，而是两者的概率叠加。这就是叠加态的直观类比。</p>
<h2>量子门操作</h2>
<p>量子门是对量子比特进行操作的数学变换。最常见的量子门包括：</p>
<h3>Hadamard门 (H门)</h3>
<p>将确定态变为均匀叠加态，是创建叠加态的基础操作。</p>
<pre><code>H|0⟩ = (|0⟩ + |1⟩)/√2
H|1⟩ = (|0⟩ - |1⟩)/√2</code></pre>
<h3>Pauli-X门</h3>
<p>类似于经典NOT门，将|0⟩翻转为|1⟩，反之亦然。</p>
<p>掌握这些基础门是进入量子编程世界的第一步。各大云平台如IBM Q、Google Quantum AI都提供了量子计算的云服务，你可以立即上手体验。</p>`,
      date: '2087-11-15', readTime: '8 min', icon: '⚛',
      tags: ['量子计算', '计算机科学', '前沿技术'], visibility: 'public', status: 'approved'
    },
    {
      title: 'WebGPU实战：构建高性能图形引擎',
      excerpt: 'WebGPU为浏览器带来了原生级别的GPU计算能力，本文将带你从零构建一个粒子渲染引擎...',
      content: `<p>WebGPU是新一代Web图形API，它相较于WebGL提供了更底层的GPU控制能力、更好的多线程支持，以及显著的性能提升。</p>
<h2>为什么选择WebGPU</h2>
<p>WebGPU基于现代图形API（Vulkan、Metal、DirectX 12）的设计理念，提供了：</p>
<p>- <code>Command Buffers</code>：预录制命令，减少CPU-GPU通信开销</p>
<p>- <code>Pipeline State Objects</code>：提前配置渲染管线</p>
<p>- <code>Bind Groups</code>：高效的资源绑定机制</p>
<p>- <code>Compute Shaders</code>：原生计算着色器支持</p>
<h2>创建管线</h2>
<p>一个典型的WebGPU渲染管线设置涉及：适配器选择 → 设备创建 → 着色器模块编译 → 管线布局定义 → 最终管线创建。这套流程虽然比WebGL繁琐，但带来的是运行时近乎零开销的状态切换。</p>
<h2>实战：粒子系统</h2>
<p>利用Compute Shader在GPU端计算粒子物理，每帧可处理数百万粒子的位置更新，同时保持60fps的流畅渲染。相比CPU计算方案，性能提升可达10-50倍。</p>`,
      date: '2087-10-28', readTime: '12 min', icon: '⬡',
      tags: ['WebGPU', '图形学', '前端开发'], visibility: 'public', status: 'approved'
    },
    {
      title: 'Rust异步运行时深度剖析：Tokio vs async-std',
      excerpt: '比较两大Rust异步运行时的架构设计、性能特性和适用场景，帮你做出正确的技术选型...',
      content: `<p>Rust的异步生态中有两大主流运行时：Tokio和async-std。它们在设计哲学、性能特性和API风格上各有侧重。</p>
<h2>架构差异</h2>
<h3>Tokio</h3>
<p>采用多线程工作窃取调度器，每个工作线程维护自己的任务队列。当某个线程空闲时，它会从其他繁忙线程"窃取"任务来执行，实现了极佳的负载均衡。</p>
<pre><code>#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        // 并发任务
    });
    handle.await.unwrap();
}</code></pre>
<h3>async-std</h3>
<p>API设计更贴近标准库，提供了与std模块几乎一一对应的异步版本。它的设计目标是让同步代码向异步迁移的工作量最小化。</p>
<h2>性能对比</h2>
<p>在IO密集型场景中，两者的性能差异通常不超过5%。Tokio在极高并发（10万+连接）下略有优势，这得益于其更成熟的工作窃取算法。而async-std在中小规模应用中代码更简洁。</p>
<h2>如何选择</h2>
<p>如果你在构建网络服务（HTTP、gRPC），Tokio的生态更丰富；如果你想快速将同步项目异步化，async-std的迁移成本更低。两者也可以混合使用，通过兼容层实现互操作。</p>`,
      date: '2087-10-10', readTime: '14 min', icon: '⚙',
      tags: ['Rust', '异步编程', '后端开发'], visibility: 'public', status: 'approved'
    },
    {
      title: 'Neovim配置终极指南：打造赛博朋克编辑器',
      excerpt: '从0到1配置你的Neovim，集成LSP、Tree-sitter、模糊搜索，让终端编辑器拥有IDE般体验...',
      content: `<p>Neovim是Vim的现代继承者，通过Lua配置、内置LSP客户端、Tree-sitter语法解析等特性，它已经成为许多开发者的首选编辑器。</p>
<h2>包管理器选择</h2>
<p>推荐使用<code>lazy.nvim</code>，它支持懒加载、自动安装和简洁的插件定义语法。一个典型的插件声明：</p>
<pre><code>{
  'nvim-telescope/telescope.nvim',
  dependencies = { 'nvim-lua/plenary.nvim' },
  keys = { '&lt;leader&gt;ff', '&lt;leader&gt;fg' },
  config = true,
}</code></pre>
<h2>LSP配置</h2>
<p>使用<code>nvim-lspconfig</code>和<code>mason.nvim</code>可以轻松安装和管理各种语言服务器。配合<code>nvim-cmp</code>实现自动补全，体验超越大多数图形化IDE。</p>
<h2>主题美化</h2>
<p>推荐<code>tokyonight.nvim</code>、<code>catppuccin</code>或<code>cyberdream.nvim</code>——后者完美契合赛博朋克美学，霓虹色调、半透明浮动窗口，让编码变成一种视觉享受。</p>`,
      date: '2087-09-20', readTime: '10 min', icon: '⎔',
      tags: ['工具链', '开发效率', 'Neovim'], visibility: 'public', status: 'approved'
    },
    {
      title: '零知识证明简明指南：ZK-SNARKs原理与应用',
      excerpt: '从交互式证明到非交互式零知识，理解区块链隐私保护的数学基础和实际应用场景...',
      content: `<p>零知识证明（Zero-Knowledge Proof）允许证明者向验证者证明某个陈述为真，而不泄露任何额外信息。这项技术在区块链隐私保护、身份验证等领域有广泛应用。</p>
<h2>核心概念</h2>
<p>一个零知识证明系统必须满足三个性质：</p>
<p>- <strong>完备性</strong>：真实陈述总能使验证者信服</p>
<p>- <strong>可靠性</strong>：虚假陈述无法欺骗验证者（概率极低）</p>
<p>- <strong>零知识性</strong>：验证者无法获得陈述本身以外的任何信息</p>
<h2>ZK-SNARKs</h2>
<p>ZK-SNARK是Zero-Knowledge Succinct Non-Interactive Argument of Knowledge的缩写，是目前最广泛使用的零知识证明构造。它通过可信设置将证明转化为简短且可快速验证的形式。</p>
<p>在区块链中，ZK-SNARKs使得交易可以在不暴露发送方、接收方和金额的情况下被验证——这正是Zcash等隐私币的核心技术。</p>
<h2>应用前景</h2>
<p>随着zkEVM和zk-rollup技术的发展，零知识证明正在从隐私工具演变为区块链扩容的核心基础设施，有望将交易吞吐量提升100倍以上。</p>`,
      date: '2087-09-05', readTime: '15 min', icon: '⧩',
      tags: ['密码学', '区块链', '隐私计算'], visibility: 'public', status: 'approved'
    },
    {
      title: 'Docker容器网络底层原理：veth pair与bridge',
      excerpt: '深入Linux内核网络命名空间，理解Docker容器之间及容器与宿主机通信的网络实现机制...',
      content: `<p>Docker的网络模型基于Linux内核的多种网络原语，包括网络命名空间、veth pair、bridge和iptables规则。</p>
<h2>网络命名空间</h2>
<p>每个Docker容器拥有独立的网络命名空间，这意味它有自己的网卡、路由表和iptables规则。不同命名空间之间的网络栈完全隔离。</p>
<h2>veth pair</h2>
<p>veth pair是虚拟以太网设备对，一端放在容器命名空间内作为eth0，另一端插在宿主机的docker0网桥上。数据从一端流入就会从另一端流出，就像一根虚拟网线。</p>
<h2>docker0网桥</h2>
<p>docker0是一个Linux bridge设备，起到二层交换机的作用。所有容器的veth pair都连接到这个网桥上，使得同一宿主机上的容器可以通过二层转发直接通信。</p>
<h2>端口映射</h2>
<p>当使用-p参数时，Docker通过iptables的DNAT规则将宿主机的端口流量转发到对应容器的IP:Port上，这一过程对容器内的应用完全透明。</p>`,
      date: '2087-08-18', readTime: '9 min', icon: '⬢',
      tags: ['Docker', '网络', 'DevOps'], visibility: 'public', status: 'approved'
    },
    {
      title: 'TypeScript 5.x 新特性全解析：装饰器与类型推导增强',
      excerpt: '深入了解TypeScript新版本的ECMAScript装饰器标准实现、const类型参数等关键更新...',
      content: `<p>TypeScript 5.x带来了一系列重要更新，其中最引人注目的是对ECMAScript Stage 3装饰器提案的完整实现。</p>
<h2>新装饰器语法</h2>
<p>与旧版实验性装饰器不同，新的装饰器标准不再像注解，而是作为一种特殊的函数调用：</p>
<pre><code>function logged(method, context) {
  return function(...args) {
    console.log('CALL:', context.name);
    return method.call(this, ...args);
  };
}
class Service {
  @logged
  fetch() { return api.get('/data'); }
}</code></pre>
<h2>Const类型参数</h2>
<p>新增的<code>const</code>修饰符允许在泛型推断时保留字面量类型，而不会拓宽到基础类型。</p>
<pre><code>function readConfig&lt;const T&gt;(config: T): T {
  return config;
}
// 推断结果类型为 { readonly name: "app" }
const cfg = readConfig({ name: "app" });</code></pre>
<p>这些特性让TypeScript的类型系统更加精准和表达力更强，为大型项目的类型安全提供了更好的保障。</p>`,
      date: '2087-08-01', readTime: '7 min', icon: 'Ⲧ',
      tags: ['TypeScript', '前端开发', '语言特性'], visibility: 'public', status: 'approved'
    },
    {
      title: 'Linux内核调度器演进：从O(n)到EEVDF',
      excerpt: '回顾Linux调度器的20年进化史，理解CFS完全公平调度和最新EEVDF调度的设计思想...',
      content: `<p>Linux调度器是内核中最核心的组件之一，它决定了进程何时获得CPU时间。从最初的O(n)调度器到最新的EEVDF，Linux调度器经历了多次重大重构。</p>
<h2>O(n)调度器 (2.4)</h2>
<p>每次调度都要遍历所有就绪进程，时间复杂度为O(n)。在进程数量较大的场景下表现糟糕，SMP多核支持也非常有限。</p>
<h2>O(1)调度器 (2.6初期)</h2>
<p>通过两个优先级位图和active/expired队列对，实现了常数时间调度。但交互性补偿算法过于复杂且难以维护。</p>
<h2>CFS完全公平调度 (2.6.23至今)</h2>
<p>使用红黑树组织任务，以虚拟运行时间（vruntime）为键值，每次选择vruntime最小的任务运行。这种方式自然地实现了按权重比例的CPU分配。</p>
<h2>EEVDF (6.6+)</h2>
<p>最早可截止时间优先（Earliest Eligible Virtual Deadline First），在CFS基础上引入截止时间概念，对延迟敏感型工作负载（如游戏、音频）有更好的调度表现。</p>`,
      date: '2087-07-15', readTime: '11 min', icon: '⬩',
      tags: ['Linux', '操作系统', '内核'], visibility: 'public', status: 'approved'
    },
    {
      title: '[VIP] 高级密码学：同态加密与多方安全计算',
      excerpt: '深入探索同态加密技术，实现数据可用不可见的高级隐私计算方案...',
      content: `<p>同态加密是一种革命性的密码学技术，允许直接在加密数据上执行计算，而无需先解密。计算结果在解密后与对原始数据执行相同计算的结果一致。</p>
<h2>全同态加密 (FHE)</h2>
<p>全同态加密支持任意计算操作，包括加法和乘法。这在理论上允许将任何程序运行在加密数据上，但计算开销目前仍较大。</p>
<h3>BFV方案</h3>
<p>适用于整数运算，在生物信息学、金融数据分析等领域有广泛应用。</p>
<h3>CKKS方案</h3>
<p>支持近似浮点数运算，是机器学习推理加密的首选方案。</p>
<h2>多方安全计算</h2>
<p>多方安全计算允许多个参与方在不泄露各自私有输入的情况下，共同计算一个函数并得到正确结果。典型应用包括隐私保护的数据挖掘、安全拍卖等。</p>
<pre><code>// MPC协议示例：安全求和
// 参与方A: x_a, 参与方B: x_b
// 目标: 计算 sum = x_a + x_b 而不暴露各自的值
// 通过秘密共享 (Secret Sharing) 实现</code></pre>
<p>这是VIP专属内容，展示了最前沿的隐私计算技术。</p>`,
      date: '2087-12-01', readTime: '18 min', icon: '🔒',
      tags: ['密码学', '隐私计算', 'VIP'], visibility: 'vip', status: 'approved'
    },
    {
      title: '[VIP] 高级分布式系统：Paxos与Raft共识算法深度对比',
      excerpt: '深入理解分布式一致性算法的核心差异，掌握CAP理论的工程实践...',
      content: `<p>分布式一致性是构建可靠分布式系统的基石。Paxos和Raft是最知名的两种共识算法。</p>
<h2>Paxos算法</h2>
<p>Leslie Lamport在1990年代提出的经典算法，以其正确性和难以理解而闻名。Paxos通过多阶段协议（Prepare、Promise、Accept、Accepted）确保在异步网络中达成一致。</p>
<h2>Raft算法</h2>
<p>Raft将共识问题分解为三个子问题：领导者选举、日志复制和安全性。相比Paxos，Raft的设计目标是易于理解和实现。</p>
<h3>领导者选举</h3>
<p>使用随机超时机制，避免分裂投票。节点在三种状态间转换：Follower → Candidate → Leader。</p>
<h3>日志复制</h3>
<p>领导者将客户端请求追加到自己的日志中，然后通过AppendEntries RPC复制到所有跟随者。当日志条目在大多数节点上持久化后，即可安全地提交并应用到状态机。</p>
<h2>CAP理论实践</h2>
<p>在分布式系统中，一致性、可用性和分区容错三者只能同时满足两个。理解这个理论有助于在架构设计中做出正确的取舍。</p>
<pre><code>// Raft领导者选举简化伪代码
if timeout {
    state = CANDIDATE
    term++
    voteCount = 1
    for each peer {
        requestVote(term, lastLogIndex, lastLogTerm)
    }
    if voteCount > majority {
        state = LEADER
    }
}</code></pre>
<p>VIP专属深度技术分析，涵盖工程实践细节。</p>`,
      date: '2087-11-28', readTime: '20 min', icon: '🔒',
      tags: ['分布式系统', '共识算法', 'VIP'], visibility: 'vip', status: 'approved'
    },
    // A pending article for review testing
    {
      title: '深度学习优化器选择指南：Adam vs SGD',
      excerpt: '比较不同优化器在深度学习训练中的表现，帮助工程师做出正确的算法选择...',
      content: `<p>优化器选择是深度学习训练中最重要的超参数之一。本文将深入分析主流优化器的优劣。</p>
<h2>SGD与动量</h2>
<p>随机梯度下降是最经典的优化算法，配合动量可以加速收敛并减少震荡。</p>
<h2>Adam自适应优化</h2>
<p>Adam结合了动量和自适应学习率，成为目前最常用的默认选择。</p>`,
      date: '2088-01-10', readTime: '6 min', icon: '🤖',
      tags: ['深度学习', 'AI'], visibility: 'public', status: 'pending'
    },
  ];

  const seedProjects = [
    { name: 'CYBER-VIEW // 赛博视图', description: '一个基于Three.js的实时数据可视化仪表盘，支持3D拓扑图、热力图和时序动画，用于服务器集群监控', tech: '["Three.js","WebSocket","Rust/Actix"]', icon: '⬡', link: '#' },
    { name: 'NEURAL-GATE // 神经网关', description: '高性能API网关，内置JWT鉴权、限流熔断、灰度发布，支持插件热加载和自定义路由规则', tech: '["Rust","Tokio","Redis","K8s"]', icon: '⚙', link: '#' },
    { name: 'QUANTUM-SHELL // 量子终端', description: '一个Web-based的终端模拟器，集成AI命令建议、多会话管理、SSH隧道可视化管理', tech: '["TypeScript","xterm.js","WebSocket","Go"]', icon: '⬢', link: '#' },
    { name: 'PIXEL-FORGE // 像素熔炉', description: '基于WebGPU的实时图像处理管线，支持滤镜链、神经网络风格迁移和视频流实时处理', tech: '["WebGPU","ONNX.js","Web Worker"]', icon: '⧩', link: '#' },
    { name: 'ECHO-CHAIN // 回声链', description: '轻量级区块链节点实现，P2P网络通信层 + 简易智能合约引擎，用于联盟链场景', tech: '["Go","libp2p","LevelDB"]', icon: '⎔', link: '#' },
    { name: 'NEON-DB // 霓虹数据库', description: '分布式时序数据库，面向IoT场景优化，支持列存储、自动降采样和SQL兼容查询接口', tech: '["C++","RocksDB","gRPC","PromQL"]', icon: 'Ⲧ', link: '#' }
  ];

  const tagSet = new Set();
  seedArticles.forEach(a => a.tags.forEach(t => tagSet.add(t)));

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  tagSet.forEach(tag => { insertTag.bind([tag]); insertTag.step(); insertTag.reset(); });
  insertTag.free();

  const insertArticle = db.prepare(
    'INSERT INTO articles (title, excerpt, content, date, read_time, icon, visibility, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertArticleTag = db.prepare(
    'INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)'
  );

  seedArticles.forEach(a => {
    insertArticle.bind([a.title, a.excerpt, a.content, a.date, a.readTime, a.icon, a.visibility, a.status]);
    insertArticle.step();
    const articleId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    a.tags.forEach(tagName => {
      const tagRow = db.exec('SELECT id FROM tags WHERE name = ?', [tagName])[0];
      if (tagRow) {
        insertArticleTag.bind([articleId, tagRow.values[0][0]]);
        insertArticleTag.step();
        insertArticleTag.reset();
      }
    });
    insertArticle.reset();
  });
  insertArticle.free();
  insertArticleTag.free();

  const insertProject = db.prepare(
    'INSERT INTO projects (name, description, tech, icon, link) VALUES (?, ?, ?, ?, ?)'
  );
  seedProjects.forEach(p => {
    insertProject.bind([p.name, p.description, p.tech, p.icon, p.link]);
    insertProject.step();
    insertProject.reset();
  });
  insertProject.free();
}

function saveDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function closeDb() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  if (dbInstance) {
    saveDb();
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = { initDb, closeDb, saveDb };
