export interface CappedUnreadCount {
  topicProvider?: string;
  count?: number;
  overflow?: boolean;
}

export interface UnreadSummary {
  total?: CappedUnreadCount;
  topics?: CappedUnreadCount[];
}

export interface NoticeTabItem {
  key: string;
  tab: string;
  type: string[];
}

export const BADGE_OVERFLOW_COUNT = 99;
export const BADGE_OVERFLOW_VALUE = BADGE_OVERFLOW_COUNT + 1;

export const toBadgeCount = (count?: CappedUnreadCount) => {
  if (!count) {
    return 0;
  }
  return count.overflow ? BADGE_OVERFLOW_VALUE : Number(count.count || 0);
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
      ],
    },
  ],
});

export const createTabCountMap = (
  tabs: NoticeTabItem[],
  summary?: UnreadSummary,
): Record<string, CappedUnreadCount> => {
  const providerCounts = new Map(
    (summary?.topics || [])
      .filter((item) => item.topicProvider)
      .map((item) => [item.topicProvider as string, item] as const),
  );

  return tabs.reduce<Record<string, CappedUnreadCount>>((result, tab) => {
    const count = tab.type.reduce((total, provider) => {
      return total + Number(providerCounts.get(provider)?.count || 0);
    }, 0);
    const overflow =
      tab.type.some((provider) => Boolean(providerCounts.get(provider)?.overflow)) ||
      count > BADGE_OVERFLOW_COUNT;
    result[tab.key] = {
      count: Math.min(count, BADGE_OVERFLOW_COUNT),
      overflow,
    };
    return result;
  }, {});
};

