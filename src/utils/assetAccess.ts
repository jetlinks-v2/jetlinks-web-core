export type AssetAccessItem = {
  supportId?: unknown;
  id?: unknown;
  type?: unknown;
  name?: unknown;
  i18nName?: unknown;
  assetType?: unknown;
  granted?: boolean;
};

export type AssetAccessOwner = {
  assetTypes?: unknown;
  assetAccesses?: AssetAccessItem[];
};

export type AssetAccessSelection = Record<string, string | undefined>;

export type AssetAccessOption = AssetAccessItem & {
  supportId: string;
  label: string;
};

export const getAssetType = (asset: AssetAccessItem) => String(asset?.assetType || 'default');

export const getAssetAccessId = (asset?: AssetAccessItem) => asset?.supportId ?? asset?.id ?? asset?.type ?? asset?.name;

export const getAssetAccessValue = (asset?: AssetAccessItem) => String(getAssetAccessId(asset) ?? '');

export const getAssetAccessLabel = (asset?: AssetAccessItem) => {
  const label = asset?.i18nName || asset?.name || getAssetAccessId(asset);
  return String(label || '');
};

export const isTenantAccess = (asset?: AssetAccessItem) => {
  const supportId = getAssetAccessValue(asset).toLowerCase();
  return supportId === 'tenant' || supportId === 'tenant_member' || asset?.name === '所在租户';
};

export const getMenuAssetTypes = (owner: AssetAccessOwner) => {
  if (Array.isArray(owner?.assetTypes) && owner.assetTypes.length > 0) {
    return Array.from(new Set(owner.assetTypes.map(item => String(item)).filter(Boolean)));
  }
  return Array.from(new Set((owner?.assetAccesses || []).map(getAssetType).filter(Boolean)));
};

export const groupAssetAccessesByType = (assetAccesses: AssetAccessItem[] = []) => {
  const groupMap = new Map<string, AssetAccessItem[]>();
  assetAccesses.forEach((asset) => {
    const assetType = getAssetType(asset);
    if (!groupMap.has(assetType)) {
      groupMap.set(assetType, []);
    }
    groupMap.get(assetType)!.push(asset);
  });
  return groupMap;
};

export const getCommonAssetAccessOptions = (owner: AssetAccessOwner): AssetAccessOption[] => {
  const assetTypes = getMenuAssetTypes(owner);
  const groupMap = groupAssetAccessesByType(owner?.assetAccesses || []);
  if (assetTypes.length === 0) {
    return [];
  }

  const supportSets = assetTypes.map((assetType) => {
    return new Set((groupMap.get(assetType) || []).map(getAssetAccessValue).filter(Boolean));
  });
  if (supportSets.some(set => set.size === 0)) {
    return [];
  }

  const firstType = assetTypes[0];
  const visited = new Set<string>();
  return (groupMap.get(firstType) || []).reduce<AssetAccessOption[]>((options, asset) => {
    const supportId = getAssetAccessValue(asset);
    if (!supportId || visited.has(supportId) || !supportSets.every(set => set.has(supportId))) {
      return options;
    }
    visited.add(supportId);
    options.push({
      ...asset,
      supportId,
      label: getAssetAccessLabel(asset),
    });
    return options;
  }, []);
};

export const buildSupportSelection = (owner: AssetAccessOwner, supportId?: string): Record<string, string> => {
  if (!supportId) {
    return {};
  }

  const groupMap = groupAssetAccessesByType(owner?.assetAccesses || []);
  return getMenuAssetTypes(owner).reduce<Record<string, string>>((selection, assetType) => {
    const matched = (groupMap.get(assetType) || []).some(asset => getAssetAccessValue(asset) === supportId);
    if (matched) {
      selection[assetType] = supportId;
    }
    return selection;
  }, {});
};

export const getSelectedSupportId = (owner: AssetAccessOwner, selection?: AssetAccessSelection) => {
  const selectedIds = Array.from(new Set(Object.values(selection || {}).filter(Boolean).map(String)));
  if (selectedIds.length !== 1) {
    return undefined;
  }

  const supportId = selectedIds[0];
  return getCommonAssetAccessOptions(owner).some(option => option.supportId === supportId) ? supportId : undefined;
};

export const normalizeSupportSelection = (owner: AssetAccessOwner, selection?: AssetAccessSelection) => {
  return buildSupportSelection(owner, getSelectedSupportId(owner, selection));
};

export const getDefaultSupportSelection = (
  owner: AssetAccessOwner,
  preferredSupportIds: string[] = ['tenant', 'tenant_member'],
) => {
  const options = getCommonAssetAccessOptions(owner);
  const preferredSet = new Set(preferredSupportIds.map(item => item.toLowerCase()));
  const shouldUseTenantAlias = preferredSupportIds.some((item) => {
    const supportId = item.toLowerCase();
    return supportId === 'tenant' || supportId === 'tenant_member';
  });
  const access = options.find(option => preferredSet.has(option.supportId.toLowerCase())) || (shouldUseTenantAlias ? options.find(isTenantAccess) : undefined) || options[0];
  return buildSupportSelection(owner, access?.supportId);
};
