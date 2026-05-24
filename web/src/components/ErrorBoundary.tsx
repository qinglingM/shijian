import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-4xl">😅</div>
          <h1 className="text-lg font-semibold text-neutral-800">出错了</h1>
          <p className="max-w-xs text-sm text-neutral-500">
            页面遇到了意外错误，请刷新重试。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            刷新页面
          </button>
          {!import.meta.env.PROD && this.state.error && (
            <pre className="mt-4 max-w-md overflow-auto rounded-lg bg-neutral-100 p-4 text-left text-xs text-neutral-600">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
