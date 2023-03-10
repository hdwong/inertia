import { Page, PageProps, PageResolver, setupProgress } from 'b2_inertiajs_core'
import { ComponentType, createElement, FunctionComponent, Key, ReactElement, ReactNode, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'

type ReactInstance = ReactElement
type ReactComponent = ReactNode

type HeadManagerOnUpdate = (elements: string[]) => void // TODO: When shipped, replace with: Inertia.HeadManagerOnUpdate
type HeadManagerTitleCallback = (title: string) => string // TODO: When shipped, replace with: Inertia.HeadManagerTitleCallback

type AppType<SharedProps extends PageProps = PageProps> = FunctionComponent<
  {
    children?: (props: { Component: ComponentType; key: Key; props: Page<SharedProps>['props'] }) => ReactNode
  } & SetupOptions<unknown, SharedProps>['props']
>

export type SetupOptions<ElementType, SharedProps extends PageProps> = {
  el: ElementType
  App: AppType
  props: {
    initialPage: Page<SharedProps>
    initialComponent: ReactComponent
    resolveComponent: PageResolver
    titleCallback?: HeadManagerTitleCallback
    onHeadUpdate?: HeadManagerOnUpdate
  }
}

type BaseInertiaAppOptions = {
  title?: HeadManagerTitleCallback
  resolve: PageResolver
}

type CreateInertiaAppSetupReturnType = ReactInstance | void
type InertiaAppOptionsForCSR<SharedProps extends PageProps> = BaseInertiaAppOptions & {
  id?: string
  page?: Page | string
  render?: undefined
  progress?:
    | false
    | {
        delay?: number
        color?: string
        includeCSS?: boolean
        showSpinner?: boolean
      }
  setup(options: SetupOptions<HTMLElement, SharedProps>): CreateInertiaAppSetupReturnType
}

type CreateInertiaAppSSRContent = { head: string[]; body: string }
type InertiaAppOptionsForSSR<SharedProps extends PageProps> = BaseInertiaAppOptions & {
  id?: undefined
  page: Page | string
  render: typeof renderToString
  progress?: undefined
  setup(options: SetupOptions<null, SharedProps>): ReactInstance
}

export default async function createInertiaApp<SharedProps extends PageProps = PageProps>(
  options: InertiaAppOptionsForCSR<SharedProps>,
): Promise<CreateInertiaAppSetupReturnType>
export default async function createInertiaApp<SharedProps extends PageProps = PageProps>(
  options: InertiaAppOptionsForSSR<SharedProps>,
): Promise<CreateInertiaAppSSRContent>
export default async function createInertiaApp<SharedProps extends PageProps = PageProps>({
  id = 'app',
  resolve,
  setup,
  title,
  progress = {},
  page,
  render,
}: InertiaAppOptionsForCSR<SharedProps> | InertiaAppOptionsForSSR<SharedProps>): Promise<
  CreateInertiaAppSetupReturnType | CreateInertiaAppSSRContent
> {
  const isServer = typeof window === 'undefined'
  const el = isServer ? null : document.getElementById(id)
  const elData = isServer ? null : document.getElementById(id + '-data'); // 从 app-data 中读取
  const initialPage = page || JSON.parse(atob(elData.dataset.page));      // base64_decode
  // @ts-expect-error
  const resolveComponent = (name) => Promise.resolve(resolve(name)).then((module) => module.default || module)

  let head = []

  const reactApp = await resolveComponent(initialPage.component).then((initialComponent) => {
    return setup({
      // @ts-expect-error
      el,
      App,
      props: {
        initialPage,
        initialComponent,
        resolveComponent,
        titleCallback: title,
        onHeadUpdate: isServer ? (elements) => (head = elements) : null,
      },
    })
  })

  if (!isServer && progress) {
    setupProgress(progress)
  }

  if (isServer) {
    const body = await render(
      createElement(Fragment, null,
        createElement(
          'div',
          {
            id,
          },
          // @ts-expect-error
          reactApp,
        ),
        createElement(
          'div',
          {
            id: id + '-data',
            'data-page': btoa(JSON.stringify(initialPage)), // 增加 app-data 并 base64_encode
          },
        )
      )
    )

    return { head, body }
  }
}
