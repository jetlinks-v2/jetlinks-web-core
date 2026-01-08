// 是否不是community版本
import { getToken, randomString, setToken } from '@jetlinks-web/utils'
import { BASE_API } from "@jetlinks-web/constants";
import { PersonalAIKey, PersonalKey, PersonalToken } from '@jetlinks-web-core/utils/consts'
import { get, set } from 'lodash-es'

export const isNoCommunity = !(localStorage.getItem('version_code') === 'community');

export const openEdgeUrl = (id: string, routePath?: string) => {
  const url = new URL(`${BASE_API}/ui/edge/cloud/default/`, window.location.origin)

  const hashParams = new URLSearchParams()
  hashParams.set('token', getToken())
  hashParams.set('thingId', id)
  hashParams.set('deviceId', id)
  hashParams.set('terminal', 'cloud-pc')
  hashParams.set('thingType', 'device')
  hashParams.set('proxy', BASE_API)

  url.hash = `${routePath || '/login'}?${hashParams.toString()}`
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

// 获取上一行
export function getEffectivePrevRow(rows: Record<string, any>, index: number) {
  let i = index - 1;
  while (i >= 0 && rows[i].sameAsAbove) {
    i--;
  }
  return i >= 0 ? rows[i] : null;
}

/**
 * 执行同上逻辑
 * @param rows
 * @param index
 * @param checked
 */
export function applySameAsAbove(rows: Record<string, any>, index: number, checked: boolean) {
  const current = rows[index];
  current.sameAsAbove = checked;

  if (!checked) {
    current.disabled = false;
    return rows;
  }

  const prev = getEffectivePrevRow(rows, index);
  if (!prev) {
    current.sameAsAbove = false;
    return rows;
  }

  // 复制字段（只复制业务字段）
  Object.assign(current, {
    name: prev.name,
    code: prev.code,
    disabled: true
  });

  return rows;
}

function syncFollowingSameRows(rows: Record<string, any>, index: number) {
  let base = rows[index];

  for (let i = index + 1; i < rows.length; i++) {
    if (!rows[i].sameAsAbove) break;

    rows[i].name = base.name;
    rows[i].code = base.code;
    rows[i].disabled = true;
  }

  return rows;
}
