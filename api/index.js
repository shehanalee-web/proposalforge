import { dispatchProductionApi } from '../server/productionApi.js'

export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  await dispatchProductionApi(req, res)
}
