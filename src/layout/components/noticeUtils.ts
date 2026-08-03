export interface CappedUnreadCount {
  topicProvider?: string;
  count?: number;
  overflow?: boolean;
}

export interface NoticeTabItem {
  key: string;
  tab: string;
  type: string[];
}

export const BADGE_OVERFLOW_COUNT = 99;
export const BADGE_OVERFLOW_VALUE = BADGE_OVERFLOW_COUNT + 1;

export const toBadgeCount = (count?: number) => {
  const value = Number(count || 0);
  return value > BADGE_OVERFLOW_COUNT ? BADGE_OVERFLOW_VALUE : value;
};

export const createUnreadQueryParams = (topicProviders: string[], pageSize: number) => ({
  pageIndex: 0,
  pageSize,
  sorts: [
    {
      name: 'notifyTime',
      order: 'desc',
    },
  ],
  terms: [
    {
      type: 'and',
      terms: [
        {
          type: 'and',
          value: topicProviders,
          termType: 'in',
          column: 'topicProvider',
        },
        {
          type: 'and',
          value: 'unread',
          termType: 'eq',
          column: 'state',
        },
      ],
    },
  ],
});

export const createTabCountMap = (
  tabs: NoticeTabItem[],
  counts: Record<string, number>,
): Record<string, CappedUnreadCount> => {
  return tabs.reduce<Record<string, CappedUnreadCount>>((result, tab) => {
    const count = Number(counts[tab.key] || 0);
    const overflow = count > BADGE_OVERFLOW_COUNT;
    result[tab.key] = {
      count: Math.min(count, BADGE_OVERFLOW_COUNT),
      overflow,
    };
    return result;
  }, {});
};

