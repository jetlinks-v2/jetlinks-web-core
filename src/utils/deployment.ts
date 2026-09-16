/** 判断当前构建是否用于私有化部署；部署方式在打包时确定，切换需重新构建。 */
export const isPrivateDeployment = (): boolean => {
  return import.meta.env.VITE_APP_DEPLOYMENT === 'private'
}
