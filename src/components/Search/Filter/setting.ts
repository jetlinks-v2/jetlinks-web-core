export const TermTypeOptions = [
   { label: '=', value: 'eq' },
   { label: '!=', value: 'not' },
   { label: '包含', value: 'like' },
   { label: '不包含', value: 'nlike' },
   { label: '>', value: 'gt' },
   { label: '>=', value: 'gte' },
   { label: '<', value: 'lt' },
   { label: '<=', value: 'lte' },
   { label: "在...之中", value: 'in', isArray: true },
   { label: "不在...之中", value: 'nin', isArray: true },
   { label: "在...之间", value: 'btw', isArray: true },
   { label: "不在...之间", value: 'nbtw', isArray: true },
]