import { TaskExecutor } from '@golem-sdk/golem-js'

;(async () => {
  const executor = await TaskExecutor.create({
    package: '529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4',
    yagnaOptions: { apiKey: 'try_golem' },
  })
  const result = await executor.run(
    async (ctx) => (await ctx.run('node -v')).stdout
  )
  await executor.end()

  console.log('Task result:', result)
})()