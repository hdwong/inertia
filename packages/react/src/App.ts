import { createHeadManager, router } from 'b2_inertiajs_core'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import HeadContext from './HeadContext'
import PageContext from './PageContext'

export default function App({
  children,
  initialPage,
  initialComponent,
  resolveComponent,
  titleCallback,
  onHeadUpdate,
}) {
  const refPrevComponent = useRef(null);  // 用于保存上次渲染的组件
  const refChildElement = useRef(null);   // 用于保存最后一次创建的子元素

  const [current, setCurrent] = useState({
    component: initialComponent || null,
    page: initialPage,
    key: null,
  })

  const headManager = useMemo(() => {
    return createHeadManager(
      typeof window === 'undefined',
      titleCallback || ((title) => title),
      onHeadUpdate || (() => {}),
    )
  }, [])

  useEffect(() => {
    router.init({
      initialPage,
      resolveComponent,
      swapComponent: async ({ component, page, preserveState }) => {
        setCurrent((current) => {
          refPrevComponent.current = current.component; // 保存上次渲染的组件
          return {
            component,
            page,
            key: preserveState ? current.key : Date.now(),
          };
        })
      },
    })

    router.on('navigate', () => headManager.forceUpdate())
  }, [])

  if (!current.component) {
    return createElement(
      HeadContext.Provider,
      { value: headManager },
      createElement(PageContext.Provider, { value: current.page }, null),
    )
  }

  const renderChildren =
    children ||
    (({ Component, props, key }) => {
      const child = createElement(Component, { key, ...props })

      if (typeof Component.layout === 'function') {
        return Component.layout(child)
      }

      if (Array.isArray(Component.layout)) {
        return Component.layout
          .concat(child)
          .reverse()
          .reduce((children, Layout) => createElement(Layout, { children, ...props }))
      }

      return child
    })

  // 生成子元素
  let childElement;
  if (! current.component || ! refPrevComponent.current || current.component !== refPrevComponent.current) {
    // 如果渲染组件发生变化, 则重新生成子组件
    childElement = renderChildren({
      Component: current.component,
      key: current.key,
      props: current.page.props,
    });
    refChildElement.current = childElement;
  } else {
    // 否则使用上次的子组件
    childElement = refChildElement.current;
  }

  return createElement(
    HeadContext.Provider,
    { value: headManager },
    createElement(
      PageContext.Provider,
      { value: current.page },
      childElement,
    ),
  )
}

App.displayName = 'Inertia'
