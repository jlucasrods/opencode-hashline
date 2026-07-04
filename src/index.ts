import { HashlineRouting as routingPlugin } from "../.opencode/plugins/hashline-routing.js"

const hashlinePlugin = async (input: Parameters<typeof routingPlugin>[0]) => {
  const routingHooks = await routingPlugin(input)

  return routingHooks
}

export default hashlinePlugin
