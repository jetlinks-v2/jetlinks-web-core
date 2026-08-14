import { isSaaS, isSubApp } from './consts'
import { isProjectRuntime } from './project-runtime'

export const isBusinessApplicationRuntime = () => (
  !isSubApp && (isSaaS || isProjectRuntime())
)
