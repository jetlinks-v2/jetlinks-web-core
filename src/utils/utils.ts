// 是否不是community版本
import { getToken, randomString, setToken } from '@jetlinks-web/utils'
import {BASE_API} from "@jetlinks-web/constants";
import { PersonalAIKey, PersonalKey, PersonalToken } from '@jetlinks-web-core/utils/consts'

export const isNoCommunity = !(localStorage.getItem('version_code') === 'community');

export const openEdgeUrl = (id: string) => {
  const url = new URL(`${BASE_API}/ui/edge/cloud/default/`, window.location.origin)
  const hashParams = new URLSearchParams()
  hashParams.set('token', getToken())
  hashParams.set('thingId', id)
  hashParams.set('deviceId', id)
  hashParams.set('terminal', 'cloud-pc')
  hashParams.set('thingType', 'device')
  hashParams.set('proxy', BASE_API)
  url.hash = `/login?${hashParams.toString()}`
  window.open(url.toString())
}

export class TabSaveSuccess {
  private id: string
  private url: string

  constructor(url: string) {
    this.id = 'tab-save-success' + randomString(8)
    this.url = url
  }
}

export const initPersonal = () => {
  const url = new URL(window.location.href);
  const _token = url.searchParams.get(PersonalKey)

  if (_token) {
    PersonalToken.value = _token
    PersonalToken.aiToken = url.searchParams.get(PersonalAIKey)
  }
}
