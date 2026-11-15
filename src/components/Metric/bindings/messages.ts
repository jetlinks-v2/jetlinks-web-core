export const bindingMessages = {
  zh:{ title:'关联指标',add:'关联已有指标',hint:'引用原指标结果；不会新增计算。汇总包含下级对象的关联，同一输出只计一次。',
    pending:'等待同步',remove:'解除关联',removeConfirm:'解除此关联？原指标仍会保留。',empty:'当前对象尚未关联指标',more:'读取更多',
    refresh:'刷新',failed:'读取关联指标失败',retry:'重试',concrete:'请选择一个具体对象的指标输出',targetType:'结果对象类型',summary:'关联汇总',detail:'查看原指标',
    noAggregate:'所选时段没有支持汇总的指标结果',period:'查看时段'},
  en:{ title:'Linked metrics',add:'Link an existing metric',hint:'Uses original results without new calculations. Includes links from descendants; each output contributes once.',
    pending:'Sync pending',remove:'Unlink',removeConfirm:'Unlink this output? The original metric will remain.',empty:'No metrics linked here',more:'Load more',
    refresh:'Refresh',failed:'Could not read linked metrics',retry:'Retry',concrete:'Select a metric output for a specific object',targetType:'Result object type',summary:'Linked summary',detail:'View original metric',
    noAggregate:'No aggregatable metric results in this period',period:'Period'},
}
