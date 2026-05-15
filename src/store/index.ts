import { createPinia } from 'pinia';

export * from './auth'
export * from './user'
export * from './menu'
export * from './system'
export * from './application'
export * from './ai'
export * from './route-loading'

const pinia = createPinia();

export default pinia;
