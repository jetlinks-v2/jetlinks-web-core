import { createRuntimeI18n } from './create'

const mainModules = import.meta.glob('./lang/*.json', {eager: true})
const modules = import.meta.glob('../../../modules/*/locales/lang/*.json', {eager: true})
export default createRuntimeI18n({ ...mainModules, ...modules })
