import router from '@jetlinks-web-core/router'

export const routerFallback = () => {
  if (window.history.state.back && window.history.length > 1) {
    router.go(-1)
  } else {
    const meta = router.currentRoute.value.meta
    const breadcrumb = meta.breadcrumb as Array<Record<string, any>>
    if (breadcrumb?.length > 1) {
      const item = breadcrumb[breadcrumb.length - 2]
      router.push(item.path)
    }
  }
}
