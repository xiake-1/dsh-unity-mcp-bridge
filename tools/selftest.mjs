const plugin = await import(new URL('../lib/index.js', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const URL_ = process.env.UNITY_MCP_URL ?? 'http://localhost:24009/p/<your-token>'
const SRV = 'unityprobe'

console.log('1) 模块导出:', Object.keys(plugin).sort().join(', '))

const parsed = plugin.Config({
  transport: 'streamable-http',
  serverName: SRV,
  url: URL_,
  resyncAfterTools: ['tool-set-enabled-state'],
  resyncIntervalMs: 0,
})
console.log('2) Config 解析 OK — 新字段:', JSON.stringify({
  resyncAfterTools: parsed.resyncAfterTools,
  resyncIntervalMs: parsed.resyncIntervalMs,
  restoreToolName: parsed.restoreToolName,
  keepEnabledTools: parsed.keepEnabledTools,
  registerCatalogSkill: parsed.registerCatalogSkill,
  skillName: parsed.skillName,
}))

const registered = new Map()
const skills = []
const effects = []
const ctx = {
  root: {},
  logger: {
    info: (...a) => console.log('   [info]', ...a.map(String)),
    warn: (...a) => console.log('   [warn]', ...a.map(String)),
    error: (...a) => console.log('   [error]', ...a.map(String)),
    debug: () => {},
  },
  tools: {
    register(def) {
      registered.set(def.name, def)
      return () => registered.delete(def.name)
    },
  },
  skills: {
    register(skill) {
      skills.push(skill)
      return () => {}
    },
  },
  effect(fn, name) {
    effects.push({ name, dispose: fn() })
    return () => {}
  },
}

const bridged = () => [...registered.keys()].filter((k) => k.startsWith('mcp__'))

try {
  console.log('3) apply() 启动…')
  await plugin.apply(ctx, parsed)
  console.log('   桥接工具:', bridged().join(', '))
  console.log('   原生工具:', [...registered.keys()].filter((k) => !k.startsWith('mcp__')).join(', '))
  const sk = skills[0]
  console.log('   技能注册:', sk ? `name=${sk.name} provider=${sk.provider} resourceBase=${sk.resourceBase?.kind}:${sk.resourceBase?.path}` : '(未注册)')
  if (sk) {
    const hasWorkflow = sk.content.includes('工作流程') && sk.content.includes('unity_tools_restore')
    console.log('   技能正文包含工作流与恢复指令:', hasWorkflow)
    console.log('   whenToUse:', (sk.whenToUse ?? '').slice(0, 60), '…')
  }

  // --- 核心机制：通过桥接工具开启一个命令，插件应自行重同步 ---
  const mgmt = registered.get(`mcp__${SRV}__tool-set-enabled-state`)
  if (!mgmt) throw new Error('未注册管理工具，无法继续')
  console.log('4) 通过桥接工具开启 gameobject-find …')
  const r1 = await mgmt.execute({ tools: [{ name: 'gameobject-find', enabled: true }] }, { signal: undefined })
  console.log('   返回:', JSON.stringify(r1.content).slice(0, 120))
  await sleep(1200)
  const after = bridged()
  console.log('   重同步后桥接工具:', after.join(', '))
  console.log('   >>> 自动重同步是否生效:', after.includes(`mcp__${SRV}__gameobject-find`) ? '是 ✓' : '否 ✗')

  // --- 恢复工具：关闭除 keep 以外的全部 ---
  const restore = registered.get(parsed.restoreToolName)
  console.log('5) 调用恢复工具 keep=[unity-tool-list] …')
  const r2 = await restore.execute({ keep: ['unity-tool-list'] }, { signal: undefined })
  console.log('   返回:', JSON.stringify(r2.content).slice(0, 200))
  await sleep(1200)
  console.log('   恢复后桥接工具:', bridged().join(', '))
} catch (error) {
  console.log('!! 测试出错:', error?.message ?? String(error))
} finally {
  console.log('6) 释放（断开连接）…')
  for (const e of effects.reverse()) {
    try { await e.dispose?.() } catch (err) { console.log('   dispose 报错:', String(err)) }
  }
  console.log('完成')
}
