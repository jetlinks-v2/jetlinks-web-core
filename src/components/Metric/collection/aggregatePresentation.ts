import type { MetricAggregatePoint,MetricAggregateGroup,ReadOperation } from './types'

/** Keep template outputs together without merging different source/parameter/revision contributions. */
export function aggregateCards(groups:MetricAggregateGroup[]):Array<{id:string;groups:MetricAggregateGroup[]}> {
  const cards=new Map<string,MetricAggregateGroup[]>()
  for(const group of groups){const id=group.cardId || group.id;const entries=cards.get(id) || [];entries.push(group);cards.set(id,entries)}
  return [...cards].map(([id,groups])=>({id,groups}))
}

/** A bucket contains one latest sample per object; averaging must use valid objects, never report count. */
export function aggregateValue(point:MetricAggregatePoint,operation:ReadOperation):number | undefined {
  if(!point.valid)return
  if(operation==='average')return point.sum===undefined || point.sum===null ? undefined : point.sum/point.valid
  if(operation==='min')return point.min ?? undefined
  if(operation==='max')return point.max ?? undefined
  if(operation==='sum')return point.sum ?? undefined
}
